import os
import json
import base64
import time
import re
import requests
try:
    import cv2
    import numpy as np
except ImportError:
    cv2 = None
    np = None

_easyocr_reader = None

def get_easyocr_reader():
    global _easyocr_reader
    if _easyocr_reader is None:
        try:
            import easyocr
            _easyocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
        except Exception:
            _easyocr_reader = None
    return _easyocr_reader

def get_gemini_key():
    k = os.getenv("GEMINI_API_KEY")
    if k:
        return k.strip()
    
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(os.path.dirname(curr_dir), ".env"),
        os.path.join(curr_dir, ".env"),
        r"c:\Users\achrk\Documents\malakasiotis-video-sync\backend\.env"
    ]
    for env_path in candidates:
        if os.path.exists(env_path):
            try:
                content = open(env_path, "r", encoding="utf-8-sig").read()
                for line in content.splitlines():
                    line = line.strip()
                    if line.startswith("GEMINI_API_KEY="):
                        val = line.split("=", 1)[1].strip()
                        if val:
                            return val
            except Exception:
                pass
    return None

def analyze_page_cloud(image_path: str, page_num: int = 1):
    api_key = get_gemini_key()
    logs = []

    if not api_key:
        logs.append(f"[Σελίδα {page_num}] Σφάλμα: Δεν βρέθηκε GEMINI_API_KEY στο .env")
        return [], logs

    logs.append(f"[Σελίδα {page_num} - Cloud] Ανάλυση εικόνας: {os.path.basename(image_path)}")

    try:
        with open(image_path, "rb") as f:
            img_bytes = f.read()
        b64_data = base64.b64encode(img_bytes).decode("utf-8")
        logs.append(f"[Σελίδα {page_num} - Cloud] Εικόνα έτοιμη ({len(img_bytes)} bytes).")
    except Exception as e:
        logs.append(f"[Σελίδα {page_num} - Cloud] Σφάλμα ανάγνωσης: {e}")
        return [], logs

    prompt = (
        "Look at this handwritten Greek physics exam note page. "
        "Locate all red handwritten video timestamps (e.g. 4 min, 9 min, 16:55 min, 22:40, 26:35, 30:15, etc.). "
        "Return a JSON array of objects with keys: "
        "timestamp_str (e.g. '16:55'), seconds (integer total seconds), label (topic or question written next to it in Greek). "
        "Return ONLY the raw JSON array."
    )

    MODEL_NAME = "gemini-3.6-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={api_key}"

    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inlineData": {"mimeType": "image/png", "data": b64_data}}
            ]
        }],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }

    detected = []
    max_retries = 3

    for attempt in range(1, max_retries + 1):
        try:
            logs.append(f"[Σελίδα {page_num} - Cloud] Κλήση {MODEL_NAME} (προσπάθεια {attempt}/{max_retries})...")
            resp = requests.post(url, json=payload, timeout=50)
            logs.append(f"[Σελίδα {page_num} - Cloud] HTTP Status: {resp.status_code}")
            
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                detected = json.loads(text)
                logs.append(f"[Σελίδα {page_num} - Cloud] Επιτυχία! Εντοπίστηκαν {len(detected)} χρονοετικέτες.")
                time.sleep(0.3)
                return detected, logs
            elif resp.status_code == 429:
                logs.append(f"[Σελίδα {page_num} - Cloud] Rate Limit 429. Αναμονή 4s...")
                time.sleep(4)
            elif resp.status_code == 503:
                logs.append(f"[Σελίδα {page_num} - Cloud] Google Server 503. Αναμονή 3s...")
                time.sleep(3)
            else:
                logs.append(f"[Σελίδα {page_num} - Cloud] Σφάλμα ({resp.status_code}): {resp.text[:200]}")
                break
        except requests.exceptions.Timeout:
            logs.append(f"[Σελίδα {page_num} - Cloud] Timeout (>50s) αναμονής.")
        except Exception as e:
            logs.append(f"[Σελίδα {page_num} - Cloud] Exception: {str(e)}")

    return detected, logs

def analyze_page_local(image_path: str, page_num: int = 1):
    logs = []
    logs.append(f"[Σελίδα {page_num} - Local] Επεξεργασία με OpenCV & EasyOCR...")

    if cv2 is None or np is None:
        logs.append(f"[Σελίδα {page_num} - Local] Το OpenCV/NumPy δεν είναι διαθέσιμο. Χρησιμοποιήστε το Cloud OCR (Gemini).")
        return [], logs

    try:
        img = cv2.imread(image_path)
        if img is None:
            logs.append(f"[Σελίδα {page_num} - Local] Αδυναμία φόρτωσης εικόνας.")
            return [], logs

        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

        # Red color masking in HSV
        lower_red1 = np.array([0, 50, 40])
        upper_red1 = np.array([12, 255, 255])
        lower_red2 = np.array([165, 50, 40])
        upper_red2 = np.array([180, 255, 255])

        mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask = mask1 | mask2

        inverted = cv2.bitwise_not(mask)
        temp_mask = image_path.replace('.png', f'_mask_{page_num}.png')
        cv2.imwrite(temp_mask, inverted)

        reader = get_easyocr_reader()
        results = reader.readtext(temp_mask)

        try:
            os.remove(temp_mask)
        except Exception:
            pass

        logs.append(f"[Σελίδα {page_num} - Local] Εντοπίστηκαν {len(results)} κόκκινες περιοχές κειμένου.")
        
        detected = []
        for bbox, text, score in results:
            text_clean = text.strip().replace(' ', '').replace(';', ':').replace(',', '.')
            
            m = re.search(r'(\d{1,2})[:.](\d{2})', text_clean)
            if m:
                mins = int(m.group(1))
                secs = int(m.group(2))
                total = mins * 60 + secs
                detected.append({
                    'timestamp_str': f"{mins:02d}:{secs:02d}",
                    'seconds': total,
                    'label': f"Βήμα {mins:02d}:{secs:02d} (Local OCR)"
                })
                logs.append(f"  -> Βρέθηκε: {mins:02d}:{secs:02d} ({text})")
            else:
                m2 = re.search(r'(\d+)\s*min', text, re.I)
                if m2:
                    mins = int(m2.group(1))
                    detected.append({
                        'timestamp_str': f"{mins:02d}:00",
                        'seconds': mins * 60,
                        'label': f"Βήμα {mins:02d}:00 (Local OCR)"
                    })
                    logs.append(f"  -> Βρέθηκε: {mins:02d}:00 ({text})")

        return detected, logs
    except Exception as e:
        logs.append(f"[Σελίδα {page_num} - Local] Σφάλμα τοπικής επεξεργασίας: {e}")
        return [], logs

def extract_page_timestamps(image_path: str):
    """
    Extracts all candidate timestamps (in seconds) from a page image using EasyOCR.
    Optimized for CPU speed: resizes image and checks red mask first.
    """
    found_seconds = set()
    reader = get_easyocr_reader()
    if reader is None:
        return found_seconds

    # Limit PyTorch threads to 2 for efficient CPU execution without thread contention
    try:
        import torch
        if torch.get_num_threads() > 2:
            torch.set_num_threads(2)
    except Exception:
        pass

    def parse_text_for_timestamps(text_str):
        # Normalize common OCR confusions in digits
        clean = text_str.replace('O', '0').replace('o', '0').replace('l', '1').replace('I', '1').replace('S', '5').replace(' ', '')
        
        # Look for mm:ss or mm.ss or mm;ss
        for m in re.finditer(r'(?<!\d)(\d{1,2})[:.;\-](\d{2})(?!\d)', clean):
            mins, secs = int(m.group(1)), int(m.group(2))
            # Heuristic: if mins > 60 and first digit is 9 or 7, often a misread of 2 or 1
            if mins > 60 and len(m.group(1)) == 2 and m.group(1)[0] in ('9', '7'):
                mins = int('2' + m.group(1)[1])
            if mins < 180 and secs < 60:
                found_seconds.add(mins * 60 + secs)

        # Look for Xmin or X'
        for m in re.finditer(r'(?<!\d)(\d{1,2})\s*(?:min|\'|m)(?!\w)', text_str, re.I):
            mins = int(m.group(1))
            if mins < 180:
                found_seconds.add(mins * 60)

    # 1. Read and downscale image to max width 1100 for fast CPU inference
    img = None
    if cv2 is not None and np is not None:
        try:
            img = cv2.imread(image_path)
            if img is not None:
                h, w = img.shape[:2]
                if w > 1100:
                    scale = 1100.0 / w
                    img = cv2.resize(img, (1100, int(h * scale)), interpolation=cv2.INTER_AREA)

                # Red mask extraction
                hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
                mask = cv2.inRange(hsv, np.array([0, 40, 30]), np.array([14, 255, 255])) | \
                       cv2.inRange(hsv, np.array([160, 40, 30]), np.array([180, 255, 255]))
                if cv2.countNonZero(mask) > 50:
                    inv = cv2.bitwise_not(mask)
                    res_red = reader.readtext(inv, paragraph=False, y_ths=0.2)
                    for _, text, _ in res_red:
                        parse_text_for_timestamps(text)
        except Exception:
            pass

    # If timestamps were already found in red ink, skip full page scan!
    if len(found_seconds) > 0:
        return found_seconds

    # 2. Fallback: Full page extraction using the resized image
    try:
        target_img = img if img is not None else image_path
        res_full = reader.readtext(target_img, paragraph=False, y_ths=0.2)
        for _, text, _ in res_full:
            parse_text_for_timestamps(text)
    except Exception:
        pass

    return found_seconds

def match_lesson_timestamps_to_pages(pages_dir: str, target_timestamps: list, progress_callback=None):
    """
    Target-driven page matching:
    Scans the pages and assigns the correct page number to each existing timestamp,
    preserving 100% of the original official titles, labels, and descriptions from the API.
    """
    logs = []
    if not os.path.exists(pages_dir):
        logs.append("Δεν βρέθηκε ο φάκελος σελίδων.")
        return target_timestamps, logs

    page_files = sorted(
        [p for p in os.listdir(pages_dir) if p.startswith('page_') and p.endswith('.png')],
        key=lambda x: int(re.search(r'\d+', x).group()) if re.search(r'\d+', x) else 0
    )
    total_pages = len(page_files)
    if total_pages == 0:
        logs.append("Δεν υπάρχουν εξαγμένες σελίδες στο μάθημα.")
        return target_timestamps, logs

    if not target_timestamps:
        logs.append("Δεν υπάρχουν διαθέσιμες χρονοετικέτες για αντιστοίχιση.")
        return target_timestamps, logs

    logs.append(f"Έναρξη αντιστοίχισης για {len(target_timestamps)} επίσημες χρονοετικέτες σε {total_pages} σελίδες...")

    # Sort target timestamps chronologically
    targets = sorted(target_timestamps, key=lambda x: int(x.get('seconds', 0)))

    # Step 1: Scan each page and collect detected timestamp seconds
    page_to_seconds = {}
    for idx, pfile in enumerate(page_files):
        p_num = idx + 1
        try:
            m = re.search(r'page_(\d+)', pfile)
            if m:
                p_num = int(m.group(1))
        except Exception:
            pass

        full_path = os.path.join(pages_dir, pfile)
        if progress_callback:
            pct = int(((idx) / total_pages) * 85)
            progress_callback(f"Σάρωση αριθμών στη Σελίδα {p_num}/{total_pages}...", pct, p_num, total_pages)

        detected_secs = extract_page_timestamps(full_path)
        page_to_seconds[p_num] = detected_secs

        formatted_found = [f"{s//60:02d}:{s%60:02d}" for s in sorted(list(detected_secs))]
        found_str = ', '.join(formatted_found)
        if formatted_found:
            logs.append(f"[Σελίδα {p_num}] Εντοπίστηκαν χρόνοι σημειώσεων: {found_str}")
        else:
            logs.append(f"[Σελίδα {p_num}] Δεν εντοπίστηκε εμφανής χρόνος.")

    # Step 2: Match each target timestamp to best page
    matched_pages = [None] * len(targets)
    matched_diffs = [float('inf')] * len(targets)

    for i, item in enumerate(targets):
        target_sec = int(item.get('seconds', 0))
        for p_num, sec_set in page_to_seconds.items():
            for sec in sec_set:
                diff = abs(sec - target_sec)
                # Allow tolerance of up to 90 seconds
                if diff <= 90 and diff < matched_diffs[i]:
                    matched_diffs[i] = diff
                    matched_pages[i] = p_num

    # Step 3: Enforce chronological monotonicity
    if matched_pages[0] is None:
        matched_pages[0] = 1

    for i in range(len(targets)):
        if matched_pages[i] is None:
            next_p = total_pages
            for j in range(i + 1, len(targets)):
                if matched_pages[j] is not None:
                    next_p = matched_pages[j]
                    break
            prev_p = matched_pages[i - 1] if i > 0 else 1
            matched_pages[i] = min(max(prev_p, 1), next_p)
        elif i > 0 and matched_pages[i] < matched_pages[i - 1]:
            matched_pages[i] = matched_pages[i - 1]

    # Step 4: Update target timestamps and log
    for i, item in enumerate(targets):
        assigned = matched_pages[i]
        item['page'] = assigned
        ts_str = item.get('timestamp_str', '')
        label = item.get('label', '')
        if matched_diffs[i] < float('inf'):
            logs.append(f"✓ {ts_str} -> Σελίδα {assigned} (Εντοπίστηκε για: '{label}')")
        else:
            logs.append(f"• {ts_str} -> Σελίδα {assigned} (Χρονολογική σειρά: '{label}')")

    logs.append(f"Ολοκληρώθηκε! Αντιστοιχίστηκαν και οι {len(targets)} χρονοετικέτες στις {total_pages} σελίδες.")
    return targets, logs
