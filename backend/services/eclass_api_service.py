# -*- coding: utf-8 -*-
import os
import json
import csv
import re
import urllib.request
import urllib.error

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
API_DIR = os.path.join(ROOT_DIR, 'api')
DATA_DIR = os.path.join(API_DIR, 'data')
CONFIG_PATH = os.path.join(API_DIR, 'config.php')

REMOTE_API_BASE = 'https://eclass.nimalakasiotis.gr/gpt-api'
def get_api_key():
    env_k = os.getenv('ECLASS_API_KEY')
    if env_k:
        return env_k.strip()

    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                txt = f.read()
                m = re.search(r"'api_key'\s*=>\s*'([^']+)'", txt)
                if m:
                    return m.group(1).strip()
        except Exception:
            pass
    return None

def canonical_lesson_id(lesson_input):
    s = str(lesson_input).strip()
    s = s.replace('lesson_', '').replace('Lesson', '').replace('Μάθημα', '').strip()
    m = re.match(r'(\d+)', s)
    if m:
        num = int(m.group(1))
        return f"{num:03d}"
    return s

def load_local_video_links():
    csv_path = os.path.join(DATA_DIR, 'video_links.csv')
    links = {}
    if not os.path.exists(csv_path):
        return links
    try:
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                lid = str(row.get('lesson_id', '')).strip()
                url = str(row.get('video_base_url', '')).strip()
                if lid and url:
                    clean_url = url.split('?t=')[0].split('&t=')[0]
                    links[lid] = clean_url
    except Exception as e:
        print(f"Error reading video_links.csv: {e}")
    return links

def load_local_lessons_data():
    json_path = os.path.join(DATA_DIR, 'lessons.json')
    if not os.path.exists(json_path):
        return None
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading lessons.json: {e}")
        return None

def fetch_from_remote_api(lesson_id):
    api_key = get_api_key()
    url = f"{REMOTE_API_BASE}/lesson?id={lesson_id}"
    req = urllib.request.Request(
        url,
        headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Authorization': f'Bearer {api_key}',
            'Accept': 'application/json'
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=4) as resp:
            if resp.status == 200:
                raw = resp.read().decode('utf-8')
                return json.loads(raw)
    except Exception:
        # Fallback to query param
        try:
            alt_url = f"{REMOTE_API_BASE}/?key={urllib.parse.quote(api_key)}&lesson={lesson_id}"
            alt_req = urllib.request.Request(alt_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(alt_req, timeout=4) as resp:
                if resp.status == 200:
                    raw = resp.read().decode('utf-8')
                    return json.loads(raw)
        except Exception:
            pass
    return None

def get_lesson_details(lesson_input):
    cid = canonical_lesson_id(lesson_input)
    
    # 1. Try remote API first
    remote_data = fetch_from_remote_api(cid)
    if remote_data and 'entries' in remote_data:
        return {
            'source': 'remote_api',
            'lesson_id': remote_data.get('lesson_id', cid),
            'lesson_number': remote_data.get('lesson_number', int(cid) if cid.isdigit() else 0),
            'title': remote_data.get('title', f'Μάθημα {cid}'),
            'video_url': remote_data.get('video_base_url', ''),
            'entries': remote_data.get('entries', [])
        }
        
    # 2. Fallback to local ./api database
    local_data = load_local_lessons_data()
    video_links = load_local_video_links()
    
    if not local_data:
        return None
        
    for l in local_data.get('lessons', []):
        lid = str(l.get('lesson_id', '')).strip()
        lnum = str(l.get('lesson_number', '')).strip()
        if lid == cid or lnum == str(int(cid) if cid.isdigit() else -1):
            vurl = video_links.get(lid, l.get('video_base_url', ''))
            entries = l.get('entries', [])
            return {
                'source': 'local_api_data',
                'lesson_id': lid,
                'lesson_number': l.get('lesson_number', 0),
                'title': l.get('title', ''),
                'video_url': vurl,
                'entries': entries
            }
            
    return None

def list_all_eclass_lessons():
    local_data = load_local_lessons_data()
    video_links = load_local_video_links()
    if not local_data:
        return []
    
    results = []
    for l in local_data.get('lessons', []):
        lid = str(l.get('lesson_id', '')).strip()
        vurl = video_links.get(lid, l.get('video_base_url', ''))
        entries = l.get('entries', [])
        results.append({
            'lesson_id': lid,
            'lesson_number': l.get('lesson_number', 0),
            'title': l.get('title', ''),
            'video_url': vurl,
            'total_entries': len(entries),
            'entries': entries
        })
    return results
