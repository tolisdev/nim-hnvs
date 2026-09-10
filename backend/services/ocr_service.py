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
        import easyocr
        _easyocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
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
                time.sleep(2)
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
