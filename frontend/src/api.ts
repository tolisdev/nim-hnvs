export interface PageInfo {
  page_number: number;
  image_url: string;
  width: number;
  height: number;
}

export interface TimestampItem {
  id?: string;
  timestamp_str: string;
  seconds: number;
  page: number;
  label: string;
  sublabel?: string;
  y_position_percent?: number;
}

export interface Lesson {
  id: string;
  number: string;
  title: string;
  youtube_id: string;
  youtube_url: string;
  total_pages: number;
  pages: PageInfo[];
  timestamps: TimestampItem[];
}

export const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token') || null;
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export async function verifyAuthToken(): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchLessons(): Promise<Lesson[]> {
  const res = await fetch(API_BASE + '/lessons');
  if (!res.ok) throw new Error('Failed to fetch lessons');
  return res.json();
}

export async function fetchLesson(id: string): Promise<Lesson> {
  const res = await fetch(API_BASE + '/lessons/' + id);
  if (!res.ok) throw new Error('Failed to fetch lesson');
  return res.json();
}

export async function updateLesson(lesson: Lesson): Promise<Lesson> {
  const res = await fetch(API_BASE + '/lessons/' + lesson.id, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(lesson)
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Απαιτείται σύνδεση διαχειριστή ή η συνεδρία σας έληξε.');
    throw new Error('Failed to update lesson');
  }
  return res.json();
}

export async function createLessonWithFile(formData: FormData): Promise<Lesson> {
  const res = await fetch(API_BASE + '/lessons', {
    method: 'POST',
    headers: {
      ...getAuthHeaders()
    },
    body: formData
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    if (res.status === 401) throw new Error('Απαιτείται σύνδεση διαχειριστή ή η συνεδρία σας έληξε.');
    throw new Error((data && data.error) || 'Failed to create lesson');
  }
  return res.json();
}

export async function triggerOcrScan(lessonId: string, geminiKey?: string): Promise<any> {
  const headers: Record<string, string> = {
    ...getAuthHeaders()
  };
  if (geminiKey) headers['X-Gemini-Key'] = geminiKey;
  
  const res = await fetch(API_BASE + '/lessons/' + lessonId + '/ocr-scan', {
    method: 'POST',
    headers
  });
  
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || ('HTTP ' + res.status + ' ' + res.statusText);
    throw new Error(msg);
  }
  return data;
}

export async function fetchLessonTimestampsFromApi(lessonId: string): Promise<{
  success: boolean;
  lesson: Lesson;
  fetched_count: number;
  video_url: string;
  source: string;
}> {
  const res = await fetch(`${API_BASE}/lessons/${lessonId}/fetch-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    }
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) throw new Error('Απαιτείται σύνδεση διαχειριστή ή η συνεδρία σας έληξε.');
    throw new Error((data && data.error) || 'Failed to fetch timestamps from API');
  }
  return data;
}

export async function fetchEclassLessonPreview(number: string): Promise<any> {
  const res = await fetch(`${API_BASE}/eclass/lesson/${number}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || 'Failed to load eClass lesson');
  }
  return data;
}

export interface EclassEntry {
  timestamp: string;
  seconds: number;
  topic: string;
  description: string;
  keywords?: string[];
  video_url?: string | null;
}

export interface EclassLessonSummary {
  lesson_id: string;
  lesson_number: number;
  title: string;
  video_url: string;
  total_entries: number;
  entries?: EclassEntry[];
}

export async function fetchAvailableEclassLessons(): Promise<EclassLessonSummary[]> {
  const res = await fetch(`${API_BASE}/eclass/lessons`);
  if (!res.ok) return [];
  return res.json();
}
