import React, { useState, useEffect } from 'react';
import { Upload, Sparkles, Cpu, Plus, Trash2, Save, X, Terminal, Loader2, Download, CheckCircle, ArrowUpDown } from 'lucide-react';
import {
  createLessonWithFile,
  updateLesson,
  fetchLessonTimestampsFromApi,
  fetchEclassLessonPreview,
  fetchAvailableEclassLessons,
  getAuthHeaders
} from '../api';
import type { Lesson, TimestampItem } from '../api';

interface AdminModalProps {
  lesson: Lesson | null;
  isOpen: boolean;
  onClose: () => void;
  onLessonSaved: (lesson: Lesson) => void;
  onOpenNewLesson?: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  lesson,
  isOpen,
  onClose,
  onLessonSaved,
  onOpenNewLesson
}) => {
  const [number, setNumber] = useState(lesson?.number || '');
  const [title, setTitle] = useState(lesson?.title || '');
  const [youtubeUrl, setYoutubeUrl] = useState(lesson?.youtube_url || '');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [timestamps, setTimestamps] = useState<TimestampItem[]>(lesson?.timestamps || []);
  const [isScanning, setIsScanning] = useState(false);
  const [activeMode, setActiveMode] = useState<'cloud' | 'local' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [ocrLogs, setOcrLogs] = useState<string[]>([]);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const [isFetchingApi, setIsFetchingApi] = useState(false);
  const [apiSuccessMsg, setApiSuccessMsg] = useState<string | null>(null);
  const [availableLessons, setAvailableLessons] = useState<any[]>([]);

  const sortTimestampsList = (items: TimestampItem[]) => {
    return [...items].sort((a, b) => (a.seconds || 0) - (b.seconds || 0));
  };

  useEffect(() => {
    if (lesson) {
      setNumber(lesson.number || '');
      setTitle(lesson.title || '');
      setYoutubeUrl(lesson.youtube_url || '');
      setTimestamps(sortTimestampsList(lesson.timestamps || []));
    }
  }, [lesson]);

  useEffect(() => {
    fetchAvailableEclassLessons().then((data) => {
      if (Array.isArray(data)) setAvailableLessons(data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFetchFromApi = async () => {
    const targetId = lesson?.id || number;
    if (!targetId) {
      alert('Παρακαλώ εισάγετε πρώτα τον αριθμό μαθήματος (π.χ. 037).');
      return;
    }
    setIsFetchingApi(true);
    setApiSuccessMsg(null);
    try {
      if (lesson?.id) {
        const res = await fetchLessonTimestampsFromApi(lesson.id);
        setTimestamps(sortTimestampsList(res.lesson.timestamps || []));
        if (res.video_url) setYoutubeUrl(res.video_url);
        if (res.lesson.title) setTitle(res.lesson.title);
        onLessonSaved(res.lesson);
        setApiSuccessMsg(`Επιτυχία! Ανακτήθηκαν ${res.fetched_count} χρονοετικέτες και το βίντεο (${res.source === 'remote_api' ? 'Remote API' : 'eClass Data'}).`);
      } else {
        const preview = await fetchEclassLessonPreview(number);
        if (preview.entries) {
          const mapped = preview.entries.map((e: any, i: number) => ({
            id: `eclass_${i + 1}`,
            timestamp_str: e.timestamp || '00:00',
            seconds: e.seconds || 0,
            label: e.topic || '',
            sublabel: e.description || '',
            page: 1
          }));
          setTimestamps(sortTimestampsList(mapped));
        }
        if (preview.video_url) setYoutubeUrl(preview.video_url);
        if (preview.title) setTitle(preview.title);
        setApiSuccessMsg(`Επιτυχία! Φορτώθηκαν ${preview.entries?.length || 0} χρονοετικέτες και στοιχεία μαθήματος.`);
      }
    } catch (err: any) {
      alert('Σφάλμα ανάκτησης από API: ' + err.message);
    } finally {
      setIsFetchingApi(false);
    }
  };

  const handleSelectPredefinedLesson = async (lessonId: string) => {
    if (!lessonId) return;
    const found = availableLessons.find((l) => l.lesson_id === lessonId);
    if (!found) return;
    setNumber(found.lesson_id);
    setTitle(found.title);
    if (found.video_url) setYoutubeUrl(found.video_url);

    setIsFetchingApi(true);
    setApiSuccessMsg(null);
    try {
      const preview = await fetchEclassLessonPreview(found.lesson_id);
      if (preview.entries) {
        const mapped = preview.entries.map((e: any, i: number) => ({
          id: `eclass_${i + 1}`,
          timestamp_str: e.timestamp || '00:00',
          seconds: e.seconds || 0,
          label: e.topic || '',
          sublabel: e.description || '',
          page: 1
        }));
        setTimestamps(sortTimestampsList(mapped));
        setApiSuccessMsg(`Επιτυχία! Φορτώθηκαν ${mapped.length} χρονοετικέτες για το μάθημα ${found.lesson_id}.`);
      }
    } catch (e: any) {
      console.warn('Could not auto-fetch preview', e);
    } finally {
      setIsFetchingApi(false);
    }
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!number) return alert('Παρακαλώ εισάγετε αριθμό μαθήματος (π.χ. 038)');

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('number', number);
      formData.append('title', title || ('Μάθημα ' + number));
      formData.append('youtube_url', youtubeUrl);
      if (pdfFile) {
        formData.append('pdf_file', pdfFile);
      }
      formData.append('timestamps_json', JSON.stringify(sortTimestampsList(timestamps)));

      const created = await createLessonWithFile(formData);
      onLessonSaved(created);
      alert('Το μάθημα δημιουργήθηκε επιτυχώς!');
    } catch (err: any) {
      alert('Σφάλμα: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateTimestamps = async () => {
    if (!lesson) return;
    const sorted = sortTimestampsList(timestamps);
    setTimestamps(sorted);
    setIsSaving(true);
    try {
      const updated = await updateLesson({
        ...lesson,
        timestamps: sorted
      });
      onLessonSaved(updated);
      alert('Οι αλλαγές αποθηκεύτηκαν επιτυχώς (σε χρονολογική σειρά)!');
    } catch (err: any) {
      alert('Σφάλμα κατά την αποθήκευση: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunOcr = async (mode: 'cloud' | 'local') => {
    if (!lesson) return alert('Επιλέξτε πρώτα ένα υπάρχον μάθημα για σάρωση.');
    setIsScanning(true);
    setActiveMode(mode);
    setOcrLogs([
      `Έναρξη σύνδεσης (${mode === 'cloud' ? 'Cloud Gemini 3.6 Flash' : 'Τοπικό OpenCV + EasyOCR'})...`
    ]);
    setOcrStatus(`Σάρωση σε εξέλιξη (${mode === 'cloud' ? 'Cloud Flash' : 'Local Offline'})...`);
    setProgressPct(5);

    try {
      const response = await fetch(`/api/lessons/${lesson.id}/ocr-scan?mode=${mode}`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders()
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.replace('data: ', '').trim());
                if (data.type === 'log') {
                  setOcrLogs((prev) => [...prev, data.message]);
                  if (typeof data.progress === 'number') {
                    setProgressPct(data.progress);
                  }
                  if (data.current_page && data.total_pages) {
                    setOcrStatus(`Ανάλυση Σελίδας ${data.current_page} από ${data.total_pages}...`);
                  }
                } else if (data.type === 'complete') {
                  setProgressPct(100);
                  if (data.detected && data.detected.length > 0) {
                    const sorted = sortTimestampsList(data.detected);
                    setTimestamps(sorted);
                    setOcrStatus(`Επιτυχία! Εντοπίστηκαν ${sorted.length} χρονοετικέτες (σε χρονολογική σειρά).`);
                    if (data.lesson) {
                      data.lesson.timestamps = sorted;
                      onLessonSaved(data.lesson);
                    }
                  } else {
                    setOcrStatus('Η σάρωση ολοκληρώθηκε.');
                  }
                } else if (data.type === 'error') {
                  setOcrLogs((prev) => [...prev, `[Σφάλμα]: ${data.message}`]);
                }
              } catch (e) {
                // non-json line
              }
            }
          }
        }
      }
    } catch (err: any) {
      setOcrLogs((prev) => [...prev, `[Σφάλμα]: ${err.message}`]);
      setOcrStatus('Σφάλμα κατά την εκτέλεση.');
    } finally {
      setIsScanning(false);
      setActiveMode(null);
    }
  };

  const addTimestampRow = () => {
    setTimestamps([
      ...timestamps,
      {
        id: 't_' + Date.now(),
        timestamp_str: '00:00',
        seconds: 0,
        page: 1,
        label: 'Νέο Βήμα / Ερώτημα'
      }
    ]);
  };

  const removeTimestampRow = (index: number) => {
    setTimestamps(timestamps.filter((_, i) => i !== index));
  };

  const updateTimestampRow = (index: number, field: keyof TimestampItem, val: any) => {
    const copy = [...timestamps];
    copy[index] = { ...copy[index], [field]: val };
    
    if (field === 'timestamp_str' && typeof val === 'string') {
      const parts = val.split(':').map((p) => parseInt(p, 10));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        copy[index].seconds = parts[0] * 60 + parts[1];
      }
    }
    setTimestamps(copy);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-400" />
              {lesson ? `Διαχείριση: Μάθημα ${lesson.number}` : 'Διαχείριση Μαθήματος & Σημειώσεων'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Ανεβάστε PDF σημειώσεων, συνδέστε YouTube βίντεο και συγχρονίστε τις χρονοετικέτες.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onOpenNewLesson && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenNewLesson();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm cursor-pointer transition"
                title="Άνοιγμα παραθύρου δημιουργίας νέου μαθήματος"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden sm:inline">Νέο Μάθημα</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Section 1: Upload / Edit Details */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-amber-400">1. Βασικά Στοιχεία Μαθήματος</h3>
              
              <div className="flex items-center gap-2">
                {availableLessons.length > 0 && !lesson && (
                  <select
                    onChange={(e) => handleSelectPredefinedLesson(e.target.value)}
                    defaultValue=""
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-500 max-w-[200px] truncate"
                  >
                    <option value="" disabled>Επιλογή από eClass...</option>
                    {availableLessons.map((l) => (
                      <option key={l.lesson_id} value={l.lesson_id}>
                        {l.lesson_id}: {l.title.slice(0, 35)}...
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={handleFetchFromApi}
                  disabled={isFetchingApi || (!number && !lesson)}
                  className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-1.5 disabled:opacity-50 transition"
                  title="Ανάκτηση χρονοετικετών και βίντεο από το eClass API"
                >
                  {isFetchingApi ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{isFetchingApi ? 'Ανάκτηση...' : 'Fetch Χρονοετικέτες'}</span>
                </button>
              </div>
            </div>

            {apiSuccessMsg && (
              <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 p-2.5 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{apiSuccessMsg}</span>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Αριθμός Μαθήματος</label>
                <input
                  type="text"
                  placeholder="π.χ. 037"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-amber-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">Τίτλος Μαθήματος</label>
                <input
                  type="text"
                  placeholder="π.χ. Μάθημα 037: Άσκηση 4.187 - Κρούσεις & Ταλαντώσεις"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">YouTube URL (Unlisted)</label>
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Αρχείο PDF Σημειώσεων</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 file:cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleCreateNew}
                disabled={isSaving}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Αποθήκευση...' : 'Αποθήκευση / Εισαγωγή Μαθήματος'}
              </button>
            </div>
          </div>

          {/* Section 2: Dual OCR (Cloud & Local) */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-rose-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  2. Αυτόματη Αναγνώριση Κόκκινων Χρονοετικετών (Cloud & Local)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {timestamps.length > 0
                    ? 'Το Τοπικό OCR εντοπίζει σε ποιες σελίδες ανήκουν οι υπάρχουσες χρονοετικέτες του eClass (χωρίς κατανάλωση API Quota).'
                    : 'Επιλέξτε ανάμεσα σε Cloud Gemini Flash (υψηλή ακρίβεια) ή Τοπικό OpenCV + EasyOCR (100% offline).'}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Button 1: Cloud Flash */}
                <button
                  onClick={() => handleRunOcr('cloud')}
                  disabled={isScanning}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  title="Σάρωση με το δωρεάν Gemini 3.6 Flash API"
                >
                  {isScanning && activeMode === 'cloud' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>Cloud Flash OCR</span>
                </button>

                {/* Button 2: Local Offline OCR */}
                <button
                  onClick={() => handleRunOcr('local')}
                  disabled={isScanning}
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  title={timestamps.length > 0 ? "Εντοπισμός σελίδων για τις υπάρχουσες χρονοετικέτες (100% Offline)" : "100% Offline σάρωση με OpenCV & EasyOCR"}
                >
                  {isScanning && activeMode === 'local' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Cpu className="w-3.5 h-3.5" />
                  )}
                  <span>{timestamps.length > 0 ? 'Τοπική Αντιστοίχιση (Offline)' : 'Τοπικό OCR (Offline)'}</span>
                </button>
              </div>
            </div>

            {/* Live Progress Bar */}
            {isScanning && (
              <div className="space-y-1.5 bg-slate-900 border border-slate-800 p-3 rounded-xl">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-rose-400 animate-spin" />
                    {ocrStatus || 'Επεξεργασία σελίδων...'}
                  </span>
                  <span className="text-amber-400 font-mono">{progressPct}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                  <div
                    className="bg-gradient-to-r from-amber-500 via-rose-500 to-sky-500 h-2 transition-all duration-300 rounded-full"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Terminal Logs View */}
            {(ocrLogs.length > 0 || isScanning) && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 text-slate-400">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
                    <Terminal className="w-3.5 h-3.5 text-amber-400" />
                    Live Debugging Stream ({ocrLogs.length} γραμμές)
                  </span>
                  {ocrStatus && !isScanning && (
                    <span className="text-[11px] text-amber-300">{ocrStatus}</span>
                  )}
                </div>
                
                <div className="max-h-52 overflow-y-auto space-y-1 text-slate-300 pr-1 flex flex-col-reverse">
                  {ocrLogs.slice().reverse().map((log, idx) => (
                    <div
                      key={idx}
                      className={
                        "leading-relaxed " +
                        (log.includes('Σφάλμα') || log.includes('Timeout') || log.includes('429')
                          ? 'text-rose-400'
                          : log.includes('Επιτυχία') || log.includes('Βρέθηκε:')
                          ? 'text-emerald-400 font-bold'
                          : log.includes('---')
                          ? 'text-amber-300 font-bold pt-1'
                          : 'text-slate-400')
                      }
                    >
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Timestamps Alignment Table */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">
                3. Αντιστοίχιση Χρονοετικετών σε Σελίδες ({timestamps.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFetchFromApi}
                  disabled={isFetchingApi || (!number && !lesson)}
                  className="flex items-center gap-1.5 text-xs bg-emerald-700/80 hover:bg-emerald-600 text-white px-2.5 py-1 rounded-lg border border-emerald-600 cursor-pointer disabled:opacity-50 transition"
                  title="Ανάκτηση των επίσημων χρονοετικετών από το API"
                >
                  {isFetchingApi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>{isFetchingApi ? 'Ανάκτηση...' : 'Fetch από eClass API'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTimestamps(sortTimestampsList(timestamps))}
                  className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-sky-300 px-2.5 py-1 rounded-lg border border-slate-700 cursor-pointer transition"
                  title="Ταξινόμηση όλων των γραμμών σε αύξουσα χρονολογική σειρά"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  Χρονολογική Ταξινόμηση
                </button>
                <button
                  onClick={addTimestampRow}
                  className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 px-2.5 py-1 rounded-lg border border-slate-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Προσθήκη Ετικέτας
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-2 w-20">Χρόνος</th>
                    <th className="py-2 px-2 w-20">Δευτ/λεπτα</th>
                    <th className="py-2 px-2 w-20">Σελίδα PDF</th>
                    <th className="py-2 px-2">Τίτλος Βήματος / Ερωτήματος</th>
                    <th className="py-2 px-2 w-10 text-center">Διαγραφή</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {timestamps.map((ts, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/60">
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={ts.timestamp_str}
                          onChange={(e) => updateTimestampRow(idx, 'timestamp_str', e.target.value)}
                          className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-amber-400 font-bold text-center"
                        />
                      </td>
                      <td className="py-2 px-2 text-slate-400">
                        {ts.seconds}s
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min={1}
                          max={lesson?.total_pages || 50}
                          value={ts.page}
                          onChange={(e) => updateTimestampRow(idx, 'page', parseInt(e.target.value, 10) || 1)}
                          className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-200 text-center"
                        />
                      </td>
                      <td className="py-2 px-2 font-sans">
                        <input
                          type="text"
                          value={ts.label}
                          onChange={(e) => updateTimestampRow(idx, 'label', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                        />
                      </td>
                      <td className="py-2 px-2 text-center font-sans">
                        <button
                          onClick={() => removeTimestampRow(idx)}
                          className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleUpdateTimestamps}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>Αποθήκευση Αλλαγών Χρονοετικετών</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
