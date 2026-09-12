import React, { useState, useEffect } from 'react';
import {
  BookPlus,
  X,
  Upload,
  Download,
  Plus,
  Trash2,
  ArrowUpDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Video,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import {
  createLessonWithFile,
  fetchAvailableEclassLessons,
  fetchEclassLessonPreview
} from '../api';
import type { Lesson, TimestampItem, EclassLessonSummary } from '../api';

interface NewLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLessonCreated: (lesson: Lesson) => void;
  existingLessons?: Lesson[];
}

export const NewLessonModal: React.FC<NewLessonModalProps> = ({
  isOpen,
  onClose,
  onLessonCreated,
  existingLessons = []
}) => {
  const [number, setNumber] = useState('');
  const [title, setTitle] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [timestamps, setTimestamps] = useState<TimestampItem[]>([]);
  
  const [availableEclassLessons, setAvailableEclassLessons] = useState<EclassLessonSummary[]>([]);
  const [showEclassHelper, setShowEclassHelper] = useState<boolean>(false);
  const [selectedEclassId, setSelectedEclassId] = useState<string>('');
  
  const [isLoadingEclass, setIsLoadingEclass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Load eClass lessons catalog on mount for optional auto-fill
  useEffect(() => {
    if (isOpen) {
      fetchAvailableEclassLessons()
        .then((data) => {
          if (Array.isArray(data)) {
            setAvailableEclassLessons(data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setNumber('');
      setTitle('');
      setYoutubeUrl('');
      setPdfFile(null);
      setTimestamps([]);
      setSelectedEclassId('');
      setShowEclassHelper(false);
      setStatusMessage(null);
    }
  }, [isOpen]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const sortTimestampsList = (items: TimestampItem[]) => {
    return [...items].sort((a, b) => (a.seconds || 0) - (b.seconds || 0));
  };

  const handleSortTimestamps = () => {
    setTimestamps(sortTimestampsList(timestamps));
  };

  const extractYouTubeId = (url: string): string | null => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
  };

  const currentYoutubeId = extractYouTubeId(youtubeUrl);

  const isExistingLessonNumber = existingLessons.some(
    (l) => l.number.toLowerCase() === number.trim().toLowerCase()
  );

  // Optional auto-fill from eClass selection
  const handleSelectEclassLesson = async (lessonId: string) => {
    setSelectedEclassId(lessonId);
    if (!lessonId) return;

    const found = availableEclassLessons.find((l) => l.lesson_id === lessonId);
    if (!found) return;

    setNumber(found.lesson_id);
    setTitle(found.title);
    if (found.video_url) {
      setYoutubeUrl(found.video_url);
    }

    setIsLoadingEclass(true);
    setStatusMessage(null);

    try {
      const preview = await fetchEclassLessonPreview(found.lesson_id);
      if (preview.entries && Array.isArray(preview.entries)) {
        const mapped: TimestampItem[] = preview.entries.map((e: any, i: number) => ({
          id: `eclass_${i + 1}`,
          timestamp_str: e.timestamp || '00:00',
          seconds: e.seconds || 0,
          label: e.topic || '',
          sublabel: e.description || '',
          page: 1
        }));
        setTimestamps(sortTimestampsList(mapped));
        setStatusMessage({
          type: 'success',
          text: `Φορτώθηκαν επιτυχώς ${mapped.length} χρονοετικέτες και τα στοιχεία του μαθήματος ${found.lesson_id} από το eClass.`
        });
      }
      if (preview.video_url && !youtubeUrl) {
        setYoutubeUrl(preview.video_url);
      }
      if (preview.title && !title) {
        setTitle(preview.title);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Δεν ήταν δυνατή η ανάκτηση από το eClass: ${err.message}. Μπορείτε να συμπληρώσετε τα στοιχεία χειροκίνητα.`
      });
    } finally {
      setIsLoadingEclass(false);
    }
  };

  // Timestamp row mutations
  const handleAddTimestamp = () => {
    setTimestamps((prev) => [
      ...prev,
      {
        id: 't_' + Date.now(),
        timestamp_str: '00:00',
        seconds: 0,
        page: 1,
        label: 'Νέο Βήμα / Ερώτημα'
      }
    ]);
  };

  const handleRemoveTimestamp = (index: number) => {
    setTimestamps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateTimestamp = (index: number, field: keyof TimestampItem, val: any) => {
    setTimestamps((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      if (field === 'timestamp_str' && typeof val === 'string') {
        const parts = val.split(':').map((p) => parseInt(p, 10));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          copy[index].seconds = parts[0] * 60 + parts[1];
        }
      }
      return copy;
    });
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumber = number.trim();

    if (!cleanNumber) {
      setStatusMessage({
        type: 'error',
        text: 'Παρακαλώ εισάγετε αριθμό ή κωδικό μαθήματος (π.χ. 055, 056, 014α, ΕΠΑΝ-01).'
      });
      return;
    }

    if (!/^[a-zA-Z0-9_\-α-ωΑ-Ω]+$/.test(cleanNumber)) {
      setStatusMessage({
        type: 'error',
        text: 'Μη έγκυρος κωδικός μαθήματος. Επιτρέπονται γράμματα, αριθμοί, παύλες και κάτω παύλες.'
      });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append('number', cleanNumber);
      formData.append('title', title.trim() || `Μάθημα ${cleanNumber}`);
      formData.append('youtube_url', youtubeUrl.trim());
      if (pdfFile) {
        formData.append('pdf_file', pdfFile);
      }
      formData.append('timestamps_json', JSON.stringify(sortTimestampsList(timestamps)));

      const createdLesson = await createLessonWithFile(formData);
      onLessonCreated(createdLesson);
      onClose();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Σφάλμα δημιουργίας μαθήματος: ${err.message}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <BookPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  Δημιουργία Νέου Μαθήματος
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Χωρίς Περιορισμούς
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Εισαγωγή οποιουδήποτε μαθήματος (νέου ή από το eClass) με PDF σημειώσεων, YouTube βίντεο και χρονοετικέτες.
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer transition disabled:opacity-50"
            title="Κλείσιμο (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Status Message Banner */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
                statusMessage.type === 'error'
                  ? 'bg-rose-950/70 border-rose-800 text-rose-300'
                  : statusMessage.type === 'success'
                  ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                  : 'bg-sky-950/70 border-sky-800 text-sky-300'
              }`}
            >
              {statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{statusMessage.text}</span>
            </div>
          )}

          {/* Section 1: Core Lesson Details (100% Custom / Manual or Imported) */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                1. Στοιχεία Μαθήματος
              </h3>
              <span className="text-[11px] text-slate-400">
                Μπορείτε να εισάγετε οποιοδήποτε μάθημα (π.χ. 055, 056, 100...)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Lesson Number */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Αριθμός / Κωδικός Μαθήματος <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="π.χ. 055, 056, 038, 014α"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:border-amber-500 outline-none"
                />
                {isExistingLessonNumber ? (
                  <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                    <Info className="w-3 h-3 shrink-0" />
                    Υπάρχει ήδη μάθημα με αυτόν τον αριθμό (θα ενημερωθεί).
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Οποιοσδήποτε αριθμός ή αλφαριθμητικός κωδικός.
                  </p>
                )}
              </div>

              {/* Lesson Title */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Τίτλος Μαθήματος
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="π.χ. Μάθημα 055: Επαναληπτικές Ασκήσεις & Ειδικά Θέματα"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isSubmitting}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-amber-500 outline-none"
                  />
                  {!title && number && (
                    <button
                      type="button"
                      onClick={() => setTitle(`Μάθημα ${number}`)}
                      className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 cursor-pointer"
                      title="Αυτόματος τίτλος"
                    >
                      Default
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* YouTube URL */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-rose-500" />
                    YouTube URL (Unlisted ή Public)
                  </span>
                  {currentYoutubeId && (
                    <span className="text-[11px] text-emerald-400 font-mono">
                      ID: {currentYoutubeId}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=... ή https://youtu.be/..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-amber-500 outline-none"
                />
              </div>

              {/* PDF File Upload */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    Αρχείο PDF Χειρόγραφων Σημειώσεων
                  </span>
                  {pdfFile && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      {(pdfFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setPdfFile(e.target.files ? e.target.files[0] : null)}
                    disabled={isSubmitting}
                    className="flex-1 text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 file:cursor-pointer"
                  />
                  {pdfFile && (
                    <button
                      type="button"
                      onClick={() => setPdfFile(null)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg cursor-pointer"
                      title="Αφαίρεση αρχείου"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  (Προαιρετικό) Το σύστημα εξάγει αυτόματα όλες τις σελίδες σε υψηλή ανάλυση.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Optional eClass Auto-fill Helper (Collapsible) */}
          <div className="bg-slate-950/50 rounded-xl border border-slate-800/80 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowEclassHelper(!showEclassHelper)}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-900/40 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-200">
                  Προαιρετικά: Αυτόματη συμπλήρωση από Open eClass API
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
                  {availableEclassLessons.length} διαθέσιμα
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>{showEclassHelper ? 'Απόκρυψη' : 'Εμφάνιση'}</span>
                {showEclassHelper ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showEclassHelper && (
              <div className="p-4 pt-0 space-y-3 border-t border-slate-800/60 bg-slate-950/70">
                <p className="text-xs text-slate-400 mt-3">
                  Εάν το μάθημα υπάρχει ήδη στο eClass, μπορείτε να το επιλέξετε παρακάτω για να αντληθούν αυτόματα ο τίτλος, το YouTube βίντεο και οι επίσημες χρονοετικέτες:
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select
                    value={selectedEclassId}
                    onChange={(e) => handleSelectEclassLesson(e.target.value)}
                    disabled={isLoadingEclass || isSubmitting}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-amber-500 disabled:opacity-50"
                  >
                    <option value="">-- Επιλέξτε μάθημα από το eClass (προαιρετικό) --</option>
                    {availableEclassLessons.map((l) => {
                      const alreadySaved = existingLessons.some((ex) => ex.number === l.lesson_id);
                      return (
                        <option key={l.lesson_id} value={l.lesson_id}>
                          {l.lesson_id}: {l.title.slice(0, 50)}
                          {alreadySaved ? ' (Ήδη αποθηκευμένο)' : ''}
                        </option>
                      );
                    })}
                  </select>

                  {selectedEclassId && (
                    <button
                      type="button"
                      onClick={() => handleSelectEclassLesson(selectedEclassId)}
                      disabled={isLoadingEclass || isSubmitting}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 cursor-pointer flex items-center justify-center gap-1.5 transition"
                    >
                      {isLoadingEclass ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span>Επαναφόρτωση</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Timestamps Editor */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-200">
                  2. Χρονοετικέτες & Συγχρονισμός
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 font-mono text-xs border border-slate-700">
                  {timestamps.length} σημεία
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSortTimestamps}
                  disabled={timestamps.length === 0}
                  className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-sky-300 px-2.5 py-1.5 rounded-lg border border-slate-700 cursor-pointer disabled:opacity-50 transition"
                  title="Ταξινόμηση σε αύξουσα χρονολογική σειρά"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>Ταξινόμηση</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddTimestamp}
                  className="flex items-center gap-1 text-xs bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 px-2.5 py-1.5 rounded-lg border border-amber-500/30 cursor-pointer transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Προσθήκη Ετικέτας</span>
                </button>
              </div>
            </div>

            {timestamps.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl space-y-2 bg-slate-900/40">
                <p className="text-xs text-slate-400">
                  Δεν έχουν προστεθεί ακόμη χρονοετικέτες.
                </p>
                <p className="text-[11px] text-slate-500">
                  Μπορείτε να προσθέσετε χειροκίνητα σημεία συγχρονισμού του βίντεο με τις σελίδες PDF.
                </p>
                <button
                  type="button"
                  onClick={handleAddTimestamp}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Προσθήκη πρώτης χρονοετικέτας
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-64 overflow-y-auto border border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 z-10">
                    <tr>
                      <th className="py-2 px-2.5 w-24">Χρόνος</th>
                      <th className="py-2 px-2 w-20 text-slate-500">Δευτ/λεπτα</th>
                      <th className="py-2 px-2 w-20">Σελίδα</th>
                      <th className="py-2 px-2">Τίτλος Θέματος / Ερωτήματος</th>
                      <th className="py-2 px-2 w-12 text-center">Διαγραφή</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {timestamps.map((ts, idx) => (
                      <tr key={ts.id || idx} className="hover:bg-slate-900/60 transition">
                        <td className="py-2 px-2.5">
                          <input
                            type="text"
                            value={ts.timestamp_str}
                            onChange={(e) => handleUpdateTimestamp(idx, 'timestamp_str', e.target.value)}
                            placeholder="00:00"
                            className="w-18 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-amber-400 font-bold text-center outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-2 px-2 text-slate-500 text-xs">
                          {ts.seconds}s
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={ts.page || 1}
                            onChange={(e) => handleUpdateTimestamp(idx, 'page', parseInt(e.target.value, 10) || 1)}
                            className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-200 text-center outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-2 px-2 font-sans">
                          <input
                            type="text"
                            value={ts.label}
                            onChange={(e) => handleUpdateTimestamp(idx, 'label', e.target.value)}
                            placeholder="π.χ. Ερώτημα Α - Υπολογισμός ταχύτητας"
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-2 px-2 text-center font-sans">
                          <button
                            type="button"
                            onClick={() => handleRemoveTimestamp(idx)}
                            className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer rounded transition"
                            title="Διαγραφή γραμμής"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <div className="text-xs text-slate-400">
              {timestamps.length > 0 && (
                <span>{timestamps.length} χρονοετικέτες έτοιμες προς αποθήκευση</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 cursor-pointer transition disabled:opacity-50"
              >
                Ακύρωση
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !number.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Δημιουργία & Εξαγωγή...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Δημιουργία & Άνοιγμα Μαθήματος</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
