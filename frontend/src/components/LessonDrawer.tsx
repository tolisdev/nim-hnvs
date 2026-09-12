import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  BookOpen,
  CheckCircle2,
  Play,
  FileText,
  Star,
  Check,
  Plus
} from 'lucide-react';
import { fetchAvailableEclassLessons } from '../api';
import type { EclassLessonSummary, Lesson } from '../api';
import logoImg from '../assets/logo.webp';

interface LessonDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentLessonId?: string;
  onSelectLesson: (lessonId: string) => void;
  savedLessons: Lesson[];
  completedLessons?: string[];
  favoriteLessons?: string[];
  isLoggedIn?: boolean;
  onOpenNewLesson?: () => void;
}

export const LessonDrawer: React.FC<LessonDrawerProps> = ({
  isOpen,
  onClose,
  currentLessonId,
  onSelectLesson,
  savedLessons,
  completedLessons = [],
  favoriteLessons = [],
  isLoggedIn = false,
  onOpenNewLesson
}) => {
  const [eclassLessons, setEclassLessons] = useState<EclassLessonSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'with_notes' | 'favorites' | 'completed'>('all');

  useEffect(() => {
    fetchAvailableEclassLessons()
      .then((data) => {
        if (Array.isArray(data)) setEclassLessons(data);
      })
      .catch((err) => console.error('Failed to load lessons for drawer:', err));
  }, []);

  // Dynamically merge eClass catalog with any saved or custom lessons (e.g. lessons beyond 54)
  const allLessons = useMemo<EclassLessonSummary[]>(() => {
    const list: EclassLessonSummary[] = [...eclassLessons];
    for (const saved of savedLessons) {
      const idx = list.findIndex(
        (l) => l.lesson_id.toLowerCase() === saved.number.toLowerCase() || `lesson_${l.lesson_id.toLowerCase()}` === saved.id.toLowerCase()
      );
      const parsedNum = parseInt(saved.number.replace(/\D/g, ''), 10) || 0;
      const converted: EclassLessonSummary = {
        lesson_id: saved.number,
        lesson_number: parsedNum,
        title: saved.title || `Μάθημα ${saved.number}`,
        video_url: saved.youtube_url || '',
        total_entries: saved.timestamps?.length || 0,
        entries: (saved.timestamps || []).map((t) => ({
          timestamp: t.timestamp_str,
          seconds: t.seconds,
          topic: t.label,
          description: t.sublabel || ''
        }))
      };
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...converted };
      } else {
        list.push(converted);
      }
    }
    return list.sort((a, b) => {
      const numA = parseInt(a.lesson_id.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.lesson_id.replace(/\D/g, ''), 10) || 0;
      if (numA !== numB) return numA - numB;
      return a.lesson_id.localeCompare(b.lesson_id);
    });
  }, [eclassLessons, savedLessons]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const savedMap = useMemo(() => {
    const map = new Map<string, Lesson>();
    for (const l of savedLessons) {
      map.set(l.number, l);
      map.set(l.id, l);
    }
    return map;
  }, [savedLessons]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return allLessons.filter((l) => {
      if (filterMode === 'with_notes') {
        const s = savedMap.get(l.lesson_id);
        if (!s || s.total_pages === 0) return false;
      } else if (filterMode === 'favorites') {
        if (!favoriteLessons.includes(l.lesson_id) && !favoriteLessons.includes(String(l.lesson_number))) {
          return false;
        }
      } else if (filterMode === 'completed') {
        if (!completedLessons.includes(l.lesson_id) && !completedLessons.includes(String(l.lesson_number))) {
          return false;
        }
      }

      if (!q) return true;

      const inId = l.lesson_id.includes(q) || String(l.lesson_number).includes(q);
      const inTitle = l.title.toLowerCase().includes(q);
      const inEntries = (l.entries || []).some((e) => e.topic.toLowerCase().includes(q));

      return inId || inTitle || inEntries;
    });
  }, [allLessons, searchQuery, filterMode, savedMap, favoriteLessons, completedLessons]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-sm sm:max-w-md bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-left duration-300">
        {/* Drawer Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 p-1 flex items-center justify-center shrink-0">
              <img src={logoImg} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5 leading-none">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <span>Επιλογή Μαθήματος</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">
                {allLessons.length} διαθέσιμα μαθήματα
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isLoggedIn && onOpenNewLesson && (
              <button
                onClick={() => {
                  onClose();
                  onOpenNewLesson();
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm cursor-pointer transition"
                title="Δημιουργία Νέου Μαθήματος (Admin)"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Νέο</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title="Κλείσιμο"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Quick Filters */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Αναζήτηση μαθήματος (π.χ. 037, κρούση)..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl py-2 pl-9 pr-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-500 outline-none transition"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                filterMode === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Όλα ({allLessons.length})
            </button>
            <button
              onClick={() => setFilterMode('with_notes')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                filterMode === 'with_notes'
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>Με PDF ({savedLessons.filter((l) => l.total_pages > 0).length})</span>
            </button>
            <button
              onClick={() => setFilterMode('favorites')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                filterMode === 'favorites'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Star className="w-3 h-3" />
              <span>Αγαπημένα ({favoriteLessons.length})</span>
            </button>
            <button
              onClick={() => setFilterMode('completed')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                filterMode === 'completed'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Check className="w-3 h-3" />
              <span>Ολοκληρωμένα ({completedLessons.length})</span>
            </button>
          </div>
        </div>

        {/* Lessons List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Δεν βρέθηκε μάθημα με αυτόν τον όρο.
            </div>
          ) : (
            filtered.map((lesson) => {
              const saved = savedMap.get(lesson.lesson_id);
              const hasNotes = saved && saved.total_pages > 0;
              const isActive =
                currentLessonId === lesson.lesson_id ||
                currentLessonId === `lesson_${lesson.lesson_id}` ||
                currentLessonId === String(lesson.lesson_number);

              const isFav = favoriteLessons.includes(lesson.lesson_id) || favoriteLessons.includes(String(lesson.lesson_number));
              const isDone = completedLessons.includes(lesson.lesson_id) || completedLessons.includes(String(lesson.lesson_number));

              return (
                <button
                  key={lesson.lesson_id}
                  onClick={() => {
                    onSelectLesson(lesson.lesson_id);
                    onClose();
                  }}
                  className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 cursor-pointer group ${
                    isActive
                      ? 'bg-amber-500/15 border border-amber-500/50 shadow-md shadow-amber-500/5'
                      : isDone
                      ? 'bg-emerald-950/20 border border-emerald-800/40 hover:bg-slate-800/80'
                      : 'hover:bg-slate-800/80 border border-transparent'
                  }`}
                >
                  {/* Number Badge */}
                  <div
                    className={`px-2 py-1.5 rounded-lg font-mono text-xs font-bold shrink-0 flex flex-col items-center justify-center ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : isDone
                        ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50'
                        : 'bg-slate-950 text-amber-300 border border-slate-800 group-hover:border-amber-500/40'
                    }`}
                  >
                    <span>{lesson.lesson_id}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] font-bold ${isActive ? 'text-amber-300' : 'text-slate-200 group-hover:text-white'}`}>
                          Μάθημα {lesson.lesson_id}
                        </span>
                        {isFav && <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />}
                        {isDone && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                      </div>
                      {hasNotes && (
                        <span className="flex items-center gap-0.5 text-[10px] text-sky-400 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{saved.total_pages} σελ.</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 group-hover:text-slate-300 line-clamp-2 leading-snug">
                      {lesson.title}
                    </p>

                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500 font-mono">
                      <span>{lesson.total_entries} θέματα</span>
                      {isActive && (
                        <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>Τρέχον</span>
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
