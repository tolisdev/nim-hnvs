# -*- coding: utf-8 -*-
import os
import shutil
import json
import time
import hmac
import secrets
import functools
import re
from flask import Flask, request, jsonify, send_from_directory, Response, stream_with_context
from flask_cors import CORS
from services.pdf_service import extract_pdf_pages
from services.storage_service import load_lessons, get_lesson_by_id, upsert_lesson, delete_lesson
from services.ocr_service import analyze_page_cloud, analyze_page_local
from services.eclass_api_service import get_lesson_details, list_all_eclass_lessons, get_api_key

app = Flask(__name__)

# Security: Limit maximum upload size to 100MB to prevent DoS
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PAGES_DIR = os.path.join(BASE_DIR, 'storage', 'pages')
PDFS_DIR = os.path.join(BASE_DIR, 'storage', 'pdfs')

os.makedirs(PAGES_DIR, exist_ok=True)
os.makedirs(PDFS_DIR, exist_ok=True)

def load_env_vars():
    candidates = [
        os.path.join(BASE_DIR, '.env'),
        os.path.join(os.path.dirname(BASE_DIR), '.env')
    ]
    vars_dict = {}
    for env_path in candidates:
        if os.path.exists(env_path):
            try:
                with open(env_path, 'r', encoding='utf-8-sig') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            k, v = line.split('=', 1)
                            vars_dict[k.strip()] = v.strip()
            except Exception:
                pass
    return vars_dict

ENV_VARS = load_env_vars()

# Configure CORS with strict origins
allowed_origins = [o.strip() for o in ENV_VARS.get('CORS_ORIGINS', '').split(',') if o.strip()]
if not allowed_origins:
    allowed_origins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5055', 'http://127.0.0.1:5055']
CORS(app, origins=allowed_origins, supports_credentials=True)

# Active user sessions with 24-hour expiration TTL
# Format: { token: { "username": str, "expires_at": float } }
ACTIVE_SESSIONS = {}

def clean_expired_sessions():
    now = time.time()
    expired = [tok for tok, s in ACTIVE_SESSIONS.items() if s.get('expires_at', 0) <= now]
    for tok in expired:
        ACTIVE_SESSIONS.pop(tok, None)

def is_token_valid(token: str) -> bool:
    if not token:
        return False
    clean_expired_sessions()
    session = ACTIVE_SESSIONS.get(token)
    if not session:
        return False
    return time.time() < session.get('expires_at', 0)

def require_auth(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.split('Bearer ', 1)[1].strip() if auth_header.startswith('Bearer ') else ''
        if not token or not is_token_valid(token):
            return jsonify({'error': 'Unauthorized. Απαιτείται σύνδεση διαχειριστή.'}), 401
        return f(*args, **kwargs)
    return decorated

def get_admin_credentials():
    vars_dict = load_env_vars()
    user = vars_dict.get('ADMIN_USERNAME') or os.getenv('ADMIN_USERNAME') or 'nimalakasiotis'
    password = vars_dict.get('ADMIN_PASSWORD') or os.getenv('ADMIN_PASSWORD')
    return user, password

@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    return response

@app.errorhandler(413)
def handle_payload_too_large(e):
    return jsonify({'error': 'Το αρχείο είναι πολύ μεγάλο. Μέγιστο επιτρεπτό όριο είναι 100MB.'}), 413

@app.route('/api/auth/login', methods=['POST'])
def api_auth_login():
    data = request.json or {}
    username = str(data.get('username', '')).strip()
    password = str(data.get('password', '')).strip()

    admin_user, admin_pass = get_admin_credentials()
    if not admin_pass:
        return jsonify({'error': 'Ο κωδικός διαχειριστή δεν έχει ρυθμιστεί στο .env.'}), 500

    user_match = hmac.compare_digest(username.lower(), admin_user.lower())
    pass_match = hmac.compare_digest(password, admin_pass)

    if not pass_match:
        api_k = get_api_key()
        if api_k and hmac.compare_digest(password, api_k):
            pass_match = True
            user_match = True

    if not (user_match and pass_match):
        return jsonify({'error': 'Λανθασμένο όνομα χρήστη ή κωδικός πρόσβασης.'}), 401

    token = secrets.token_hex(32)
    ttl_hours = float(ENV_VARS.get('SESSION_TTL_HOURS', 24))
    ACTIVE_SESSIONS[token] = {
        'username': admin_user,
        'expires_at': time.time() + (ttl_hours * 3600)
    }

    return jsonify({
        'success': True,
        'token': token,
        'username': admin_user,
        'expires_in': int(ttl_hours * 3600)
    })

@app.route('/api/auth/verify', methods=['GET'])
def api_auth_verify():
    auth_header = request.headers.get('Authorization', '')
    token = auth_header.split('Bearer ', 1)[1].strip() if auth_header.startswith('Bearer ') else ''
    if token and is_token_valid(token):
        return jsonify({
            'authenticated': True,
            'username': ACTIVE_SESSIONS[token]['username']
        })
    return jsonify({'authenticated': False}), 401

@app.route('/api/auth/logout', methods=['POST'])
def api_auth_logout():
    auth_header = request.headers.get('Authorization', '')
    token = auth_header.split('Bearer ', 1)[1].strip() if auth_header.startswith('Bearer ') else ''
    if token:
        ACTIVE_SESSIONS.pop(token, None)
    return jsonify({'success': True})

@app.route('/api/lessons', methods=['GET'])
def list_lessons():
    return jsonify(load_lessons())

@app.route('/api/lessons/<lesson_id>', methods=['GET'])
def get_lesson(lesson_id):
    lesson = get_lesson_by_id(lesson_id)
    if not lesson:
        lookup = lesson_id.replace('lesson_', '')
        details = get_lesson_details(lookup)
        if details:
            vurl = details.get('video_url', '')
            yt_id = '2ovEBtdZJrI'
            if 'watch?v=' in vurl:
                yt_id = vurl.split('watch?v=')[-1].split('&')[0]
            elif 'youtu.be/' in vurl:
                yt_id = vurl.split('youtu.be/')[-1].split('?')[0]

            formatted_ts = []
            for idx, entry in enumerate(details.get('entries', [])):
                formatted_ts.append({
                    'id': f'eclass_{idx+1}',
                    'timestamp_str': entry.get('timestamp', '00:00'),
                    'seconds': entry.get('seconds', 0),
                    'label': entry.get('topic', ''),
                    'sublabel': entry.get('description', ''),
                    'page': 1
                })
            formatted_ts.sort(key=lambda x: int(x.get('seconds', 0)))

            lesson = {
                'id': f"lesson_{details['lesson_id']}",
                'number': details['lesson_id'],
                'title': details.get('title', f"Μάθημα {details['lesson_id']}"),
                'youtube_id': yt_id,
                'youtube_url': vurl,
                'total_pages': 0,
                'pages': [],
                'timestamps': formatted_ts
            }
            upsert_lesson(lesson)
            return jsonify(lesson)
        return jsonify({'error': 'Lesson not found'}), 404
    return jsonify(lesson)

@app.route('/api/pages/<folder>/<filename>')
def serve_page_image(folder, filename):
    # Defense-in-depth against Path Traversal (CWE-22)
    if not re.fullmatch(r'^[a-zA-Z0-9_\-]+$', folder):
        return jsonify({'error': 'Invalid folder parameter.'}), 400
    if not re.fullmatch(r'^[a-zA-Z0-9_\-\.]+\.(png|jpg|jpeg|webp)$', filename, re.IGNORECASE):
        return jsonify({'error': 'Invalid image filename parameter.'}), 400

    target_dir = os.path.abspath(os.path.join(PAGES_DIR, folder))
    pages_dir_abs = os.path.abspath(PAGES_DIR)
    if not target_dir.startswith(pages_dir_abs):
        return jsonify({'error': 'Access denied.'}), 403

    return send_from_directory(target_dir, filename)

@app.route('/api/lessons', methods=['POST'])
@require_auth
def create_lesson():
    number = request.form.get('number', '').strip()
    title = request.form.get('title', f'Lesson {number}').strip()
    youtube_url = request.form.get('youtube_url', '').strip()
    timestamps_json = request.form.get('timestamps_json', '[]')
    
    # Input validation on lesson number
    if not number or not re.fullmatch(r'^[0-9]+[a-zA-Zα-ωΑ-Ω]?$', number):
        return jsonify({'error': 'Απαιτείται έγκυρος αριθμός μαθήματος (π.χ. 001, 014α).'}), 400

    lesson_id = f'lesson_{number}'
    
    yt_id = youtube_url
    if 'watch?v=' in youtube_url:
        yt_id = youtube_url.split('watch?v=')[-1].split('&')[0]
    elif 'youtu.be/' in youtube_url:
        yt_id = youtube_url.split('youtu.be/')[-1].split('?')[0]

    pdf_file = request.files.get('pdf_file')
    page_files = []
    if pdf_file and pdf_file.filename:
        # File upload security checks
        filename_lower = pdf_file.filename.lower()
        if not filename_lower.endswith('.pdf'):
            return jsonify({'error': 'Επιτρέπονται μόνο έγκυρα αρχεία μορφής .pdf.'}), 400

        # Validate PDF magic bytes (%PDF-)
        magic_bytes = pdf_file.read(5)
        pdf_file.seek(0)
        if magic_bytes != b'%PDF-':
            return jsonify({'error': 'Το αρχείο δεν αποτελεί έγκυρο PDF έγγραφο.'}), 400

        pdf_save_path = os.path.join(PDFS_DIR, f'{lesson_id}.pdf')
        pdf_file.save(pdf_save_path)
        out_pages_dir = os.path.join(PAGES_DIR, lesson_id)
        page_files = extract_pdf_pages(pdf_save_path, out_pages_dir)

    try:
        raw_timestamps = json.loads(timestamps_json)
        if isinstance(raw_timestamps, list):
            raw_timestamps.sort(key=lambda x: int(x.get('seconds', 0)))
    except Exception:
        raw_timestamps = []

    lesson = {
        'id': lesson_id,
        'number': number,
        'title': title,
        'youtube_id': yt_id or 'fJ9rUzIMcZQ',
        'youtube_url': youtube_url,
        'total_pages': len(page_files),
        'pages': page_files,
        'timestamps': raw_timestamps
    }
    
    upsert_lesson(lesson)
    return jsonify(lesson)

@app.route('/api/lessons/<lesson_id>', methods=['PUT'])
@require_auth
def update_lesson(lesson_id):
    if not re.fullmatch(r'^[a-zA-Z0-9_\-]+$', lesson_id):
        return jsonify({'error': 'Invalid lesson_id'}), 400

    data = request.json or {}
    existing = get_lesson_by_id(lesson_id)
    if not existing:
        return jsonify({'error': 'Lesson not found'}), 404
    
    for key, val in data.items():
        existing[key] = val
    if 'timestamps' in existing and isinstance(existing['timestamps'], list):
        existing['timestamps'].sort(key=lambda x: int(x.get('seconds', 0)))
        
    upsert_lesson(existing)
    return jsonify(existing)

@app.route('/api/lessons/<lesson_id>/ocr-scan', methods=['POST'])
@require_auth
def trigger_ocr_scan_stream(lesson_id):
    if not re.fullmatch(r'^[a-zA-Z0-9_\-]+$', lesson_id):
        return jsonify({'error': 'Invalid lesson_id'}), 400

    lesson = get_lesson_by_id(lesson_id)
    if not lesson:
        return jsonify({'error': 'Lesson not found'}), 404

    mode = request.args.get('mode', 'cloud').lower() # 'cloud' or 'local'
    out_pages_dir = os.path.join(PAGES_DIR, lesson_id)
    
    def generate():
        if not os.path.exists(out_pages_dir):
            yield f"data: {json.dumps({'type': 'error', 'message': 'Δεν βρέθηκαν εξαγμένες σελίδες.'}, ensure_ascii=False)}\n\n"
            return

        pages = sorted([p for p in os.listdir(out_pages_dir) if p.endswith('.png')])
        total = len(pages)
        
        mode_label = "Τοπικό OCR (OpenCV & EasyOCR)" if mode == "local" else "Cloud Vision (Gemini 3.6 Flash)"
        yield f"data: {json.dumps({'type': 'log', 'message': f'Έναρξη σάρωσης ({mode_label}) για {total} σελίδες...', 'progress': 0}, ensure_ascii=False)}\n\n"
        
        detected_all = []

        for idx, page_file in enumerate(pages):
            try:
                page_num = int(page_file.replace('page_', '').replace('.png', ''))
            except Exception:
                page_num = idx + 1
                
            full_path = os.path.join(out_pages_dir, page_file)
            pct = int(((idx) / total) * 100)
            yield f"data: {json.dumps({'type': 'log', 'message': f'--- Επεξεργασία Σελίδας {page_num}/{total} ---', 'progress': pct, 'current_page': page_num, 'total_pages': total}, ensure_ascii=False)}\n\n"
            
            if mode == 'local':
                detected_page, page_logs = analyze_page_local(full_path, page_num=page_num)
            else:
                detected_page, page_logs = analyze_page_cloud(full_path, page_num=page_num)

            for l in page_logs:
                yield f"data: {json.dumps({'type': 'log', 'message': l}, ensure_ascii=False)}\n\n"
            
            for item in detected_page:
                item['page'] = page_num
                detected_all.append(item)

        if detected_all:
            detected_all.sort(key=lambda x: int(x.get('seconds', 0)))
            lesson['timestamps'] = detected_all
            upsert_lesson(lesson)
            yield f"data: {json.dumps({'type': 'log', 'message': f'Ολοκληρώθηκε! Βρέθηκαν {len(detected_all)} χρονοετικέτες (ταξινομημένες χρονολογικά).', 'progress': 100}, ensure_ascii=False)}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'log', 'message': 'Δεν επιστράφηκαν νέες χρονοετικέτες.', 'progress': 100}, ensure_ascii=False)}\n\n"

        yield f"data: {json.dumps({'type': 'complete', 'detected': detected_all, 'lesson': lesson}, ensure_ascii=False)}\n\n"

    return Response(stream_with_context(generate()), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no'
    })

@app.route('/api/eclass/lessons', methods=['GET'])
def get_eclass_lessons():
    return jsonify(list_all_eclass_lessons())

@app.route('/api/eclass/lesson/<lesson_num>', methods=['GET'])
def get_eclass_lesson(lesson_num):
    details = get_lesson_details(lesson_num)
    if not details:
        return jsonify({'error': f'Δεν βρέθηκαν δεδομένα για το μάθημα {lesson_num}'}), 404
    return jsonify(details)

@app.route('/api/lessons/<lesson_id>/fetch-api', methods=['POST'])
@require_auth
def fetch_lesson_timestamps_api(lesson_id):
    if not re.fullmatch(r'^[a-zA-Z0-9_\-]+$', lesson_id):
        return jsonify({'error': 'Invalid lesson_id'}), 400

    lesson = get_lesson_by_id(lesson_id)
    lookup_id = lesson_id
    if lesson and lesson.get('number'):
        lookup_id = lesson.get('number')
        
    details = get_lesson_details(lookup_id)
    if not details or not details.get('entries'):
        return jsonify({'error': f'Δεν βρέθηκαν χρονοετικέτες για το μάθημα {lookup_id} στο API.'}), 404
        
    if lesson:
        existing_page_map = {ts.get('seconds'): ts.get('page') for ts in lesson.get('timestamps', [])}
        new_timestamps = []
        for idx, entry in enumerate(details['entries']):
            sec = entry.get('seconds', 0)
            assigned_page = existing_page_map.get(sec, 1)
            new_timestamps.append({
                'id': f'eclass_{idx+1}',
                'timestamp_str': entry.get('timestamp', '00:00'),
                'seconds': sec,
                'label': entry.get('topic', ''),
                'sublabel': entry.get('description', ''),
                'page': assigned_page
            })
            
        lesson['timestamps'] = new_timestamps
        if details.get('video_url') and (not lesson.get('youtube_url') or 'watch?v=' not in lesson.get('youtube_url')):
            lesson['youtube_url'] = details['video_url']
            vurl = details['video_url']
            if 'watch?v=' in vurl:
                lesson['youtube_id'] = vurl.split('watch?v=')[-1].split('&')[0]
            elif 'youtu.be/' in vurl:
                lesson['youtube_id'] = vurl.split('youtu.be/')[-1].split('?')[0]
                
        if not lesson.get('title') or lesson['title'].startswith('Lesson '):
            lesson['title'] = details.get('title', lesson['title'])
            
        upsert_lesson(lesson)
        return jsonify({
            'success': True,
            'lesson': lesson,
            'source': details.get('source'),
            'fetched_count': len(new_timestamps),
            'video_url': details.get('video_url', '')
        })
    else:
        formatted_ts = []
        for idx, entry in enumerate(details['entries']):
            formatted_ts.append({
                'id': f'eclass_{idx+1}',
                'timestamp_str': entry.get('timestamp', '00:00'),
                'seconds': entry.get('seconds', 0),
                'label': entry.get('topic', ''),
                'sublabel': entry.get('description', ''),
                'page': 1
            })
        return jsonify({
            'success': True,
            'details': details,
            'timestamps': formatted_ts,
            'fetched_count': len(formatted_ts),
            'video_url': details.get('video_url', ''),
            'title': details.get('title', '')
        })

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5055, debug=False)
