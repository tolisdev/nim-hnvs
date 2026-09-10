import os
import json

STORAGE_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'storage', 'lessons.json')

def sort_timestamps(items):
    if not isinstance(items, list):
        return []
    try:
        return sorted(items, key=lambda x: int(x.get('seconds', 0)) if isinstance(x, dict) else 0)
    except Exception:
        return items

def load_lessons():
    if not os.path.exists(STORAGE_FILE):
        return []
    try:
        with open(STORAGE_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                for l in data:
                    if isinstance(l, dict) and 'timestamps' in l:
                        l['timestamps'] = sort_timestamps(l['timestamps'])
            return data
    except Exception:
        return []

def save_lessons(lessons):
    os.makedirs(os.path.dirname(STORAGE_FILE), exist_ok=True)
    for l in lessons:
        if isinstance(l, dict) and 'timestamps' in l:
            l['timestamps'] = sort_timestamps(l['timestamps'])
    with open(STORAGE_FILE, 'w', encoding='utf-8') as f:
        json.dump(lessons, f, ensure_ascii=False, indent=2)

def get_lesson_by_id(lesson_id: str):
    lessons = load_lessons()
    for l in lessons:
        if str(l.get('id')) == str(lesson_id) or str(l.get('number')) == str(lesson_id):
            if 'timestamps' in l:
                l['timestamps'] = sort_timestamps(l['timestamps'])
            return l
    return None

def upsert_lesson(lesson_data: dict):
    if isinstance(lesson_data, dict) and 'timestamps' in lesson_data:
        lesson_data['timestamps'] = sort_timestamps(lesson_data['timestamps'])
    lessons = load_lessons()
    idx = -1
    for i, l in enumerate(lessons):
        if str(l.get('id')) == str(lesson_data.get('id')):
            idx = i
            break
    if idx >= 0:
        lessons[idx] = lesson_data
    else:
        lessons.append(lesson_data)
    save_lessons(lessons)
    return lesson_data

def delete_lesson(lesson_id: str):
    lessons = load_lessons()
    lessons = [l for l in lessons if str(l.get('id')) != str(lesson_id)]
    save_lessons(lessons)
