import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  BookOpen,
  Play,
  Clock,
  FileText,
  Video,
  Sparkles,
  GraduationCap,
  CheckCircle2,
  X,
  Star,
  Check,
  LayoutGrid,
  List,
  SlidersHorizontal,
  ListChecks
} from 'lucide-react';
import { fetchAvailableEclassLessons } from '../api';
import type { EclassLessonSummary, Lesson } from '../api';
import logoImg from '../assets/logo.webp';

interface HomePageProps {
  onSelectLesson: (lessonId: string, initialSeconds?: number) => void;
  savedLessons: Lesson[];
  completedLessons?: string[];
  onToggleCompleted?: (lessonId: string) => void;
  favoriteLessons?: string[];
  onToggleFavorite?: (lessonId: string) => void;
  lastWatchedLessonId?: string | null;
}

function extractYouTubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

export const HomePage: React.FC<HomePageProps> = ({
  onSelectLesson,
  savedLessons,
  completedLessons = [],
  onToggleCompleted,
  favoriteLessons = [],
  onToggleFavorite,
  lastWatchedLessonId
}) => {
  const [allLessons, setAllLessons] = useState<EclassLessonSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedChapter, setSelectedChapter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'favorites' | 'with_notes' | 'completed' | 'uncompleted'>('all');
  const [sortBy, setSortBy] = useState<'id_asc' | 'id_desc' | 'entries_desc'>('id_asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('home_view_mode') as 'grid' | 'list') || 'grid';
  });

  // Modal for quick timestamp list preview
  const [timestampsModalLesson, setTimestampsModalLesson] = useState<EclassLessonSummary | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAvailableEclassLessons()
      .then((data) => {
        setAllLessons(data);
      })
      .catch((err) => console.error('Failed to load eClass lessons:', err))
      .finally(() => setIsLoading(false));
  }, []);

  // Keyboard shortcut '/' to focus search, and 'Esc' to close timestamps modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && timestampsModalLesson) {
        setTimestampsModalLesson(null);
        return;
      }

      const active = document.activeElement;
      const isInput = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA';
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [timestampsModalLesson]);

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('home_view_mode', mode);
    } catch {}
  };

  const savedLessonsMap = useMemo(() => {
    const map = new Map<string, Lesson>();
    for (const l of savedLessons) {
      map.set(l.number, l);
      map.set(l.id, l);
    }
    return map;
  }, [savedLessons]);

  const chapters = [
    { id: 'all', label: 'Όλα τα Μαθήματα', count: allLessons.length },
    { id: 'collisions', label: 'Κρούσεις & Ορμή' },
    { id: 'oscillations', label: 'Ταλαντώσεις (ΑΑΤ)' },
    { id: 'fluids', label: 'Ρευστά' },
    { id: 'rotation', label: 'Στροφική Κίνηση' },
    { id: 'energy', label: 'Ενέργεια & Έργο' }
  ];

  const filteredAndSortedLessons = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = allLessons.filter((lesson) => {
      // 1. Chapter Filter
      if (selectedChapter === 'collisions') {
        const text = (lesson.title + ' ' + (lesson.entries || []).map((e) => e.topic).join(' ')).toLowerCase();
        if (!text.includes('κρουσ') && !text.includes('ορμ')) return false;
      } else if (selectedChapter === 'oscillations') {
        const text = (lesson.title + ' ' + (lesson.entries || []).map((e) => e.topic).join(' ')).toLowerCase();
        if (!text.includes('ταλαντ') && !text.includes('αατ') && !text.includes('πλατος')) return false;
      } else if (selectedChapter === 'fluids') {
        const text = (lesson.title + ' ' + (lesson.entries || []).map((e) => e.topic).join(' ')).toLowerCase();
        if (!text.includes('ρευστ') && !text.includes('bernoulli') && !text.includes('παροχ') && !text.includes('συνεχει')) return false;
      } else if (selectedChapter === 'rotation') {
        const text = (lesson.title + ' ' + (lesson.entries || []).map((e) => e.topic).join(' ')).toLowerCase();
        if (!text.includes('στροφ') && !text.includes('ροπ') && !text.includes('γωνιακ')) return false;
      } else if (selectedChapter === 'energy') {
        const text = (lesson.title + ' ' + (lesson.entries || []).map((e) => e.topic).join(' ')).toLowerCase();
        if (!text.includes('ενεργει') && !text.includes('εργο') && !text.includes('αδετ') && !text.includes('μεκ')) return false;
      }

      // 2. Status Filter
      const isFav = favoriteLessons.includes(lesson.lesson_id) || favoriteLessons.includes(String(lesson.lesson_number));
      const isDone = completedLessons.includes(lesson.lesson_id) || completedLessons.includes(String(lesson.lesson_number));
      const saved = savedLessonsMap.get(lesson.lesson_id);
      const hasNotes = Boolean(saved && saved.total_pages > 0);

      if (statusFilter === 'favorites' && !isFav) return false;
      if (statusFilter === 'completed' && !isDone) return false;
      if (statusFilter === 'uncompleted' && isDone) return false;
      if (statusFilter === 'with_notes' && !hasNotes) return false;

      // 3. Query Search
      if (!q) return true;

      const inNumber = lesson.lesson_id.includes(q) || String(lesson.lesson_number).includes(q);
      const inTitle = lesson.title.toLowerCase().includes(q);
      const inEntries = (lesson.entries || []).some(
        (e) => e.topic.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
      );

      return inNumber || inTitle || inEntries;
    });

    // Sorting
    return filtered.sort((a, b) => {
      if (sortBy === 'id_desc') {
        return b.lesson_number - a.lesson_number;
      } else if (sortBy === 'entries_desc') {
        return (b.total_entries || 0) - (a.total_entries || 0);
      }
      return a.lesson_number - b.lesson_number;
    });
  }, [allLessons, searchQuery, selectedChapter, statusFilter, sortBy, savedLessonsMap, favoriteLessons, completedLessons]);

  const totalTimestampsCount = useMemo(() => {
    return allLessons.reduce((acc, l) => acc + (l.total_entries || 0), 0);
  }, [allLessons]);

  const lastWatchedLesson = useMemo(() => {
    if (!lastWatchedLessonId) return null;
    return allLessons.find((l) => l.lesson_id === lastWatchedLessonId || String(l.lesson_number) === lastWatchedLessonId) || null;
  }, [allLessons, lastWatchedLessonId]);

  const completionPercent = useMemo(() => {
    if (!allLessons.length) return 0;
    return Math.round((completedLessons.length / allLessons.length) * 100);
  }, [completedLessons.length, allLessons.length]);

  return (
    <div className="flex-1 flex flex-col space-y-6 pb-16">
      
      {/* Modern Bento Hero: Curriculum Overview + Student Action Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Hero: Brand & Curriculum Value */}
        <div className="lg:col-span-7 bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800/90 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-700/80 p-1.5 flex items-center justify-center shadow-lg shrink-0">
                <img src={logoImg} alt="nimalakasiotis.gr" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                  <Sparkles className="w-3 h-3" />
                  <span>ΦΥΣΙΚΗ Γ΄ ΛΥΚΕΙΟΥ 2026–2027 • COURSES113</span>
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  nimalakasiotis<span className="text-amber-400">.gr</span>
                </div>
              </div>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Ευρετήριο Μαθημάτων &{' '}
                <span className="text-amber-400">
                  Συγχρονισμός Σημειώσεων
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed max-w-xl">
                54 πλήρη μαθήματα θεωρίας και επίλυσης ασκήσεων από τον Νίκο Μαλακασιώτη, με ταυτόχρονο συγχρονισμό χειρόγραφων σημειώσεων PDF.
              </p>
            </div>
          </div>

          {/* Quick Curriculum Badges */}
          <div className="grid grid-cols-3 gap-2.5 pt-6 mt-6 border-t border-slate-800/80 relative z-10">
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
              <div className="flex items-center gap-1.5 text-amber-400 mb-0.5">
                <GraduationCap className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Μαθήματα</span>
              </div>
              <div className="text-lg font-bold font-mono text-white">54</div>
              <div className="text-[10px] text-slate-500">Πλήρης σειρά</div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
              <div className="flex items-center gap-1.5 text-rose-400 mb-0.5">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Χρονοετικέτες</span>
              </div>
              <div className="text-lg font-bold font-mono text-white">{totalTimestampsCount || 562}</div>
              <div className="text-[10px] text-slate-500">Ακριβή σημεία</div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
              <div className="flex items-center gap-1.5 text-sky-400 mb-0.5">
                <FileText className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Dual Sync</span>
              </div>
              <div className="text-lg font-bold font-mono text-white">
                {savedLessons.filter((l) => l.total_pages > 0).length} / 54
              </div>
              <div className="text-[10px] text-slate-500">Με PDF σημειώσεις</div>
            </div>
          </div>
        </div>

        {/* Right Hero: Student Action Center (Continue Studying + Progress) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800/90 rounded-3xl p-6 flex flex-col justify-between shadow-xl relative overflow-hidden">
          <div className="space-y-4">
            {/* Top Bar: Progress Indicator */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Πρόοδος Μελέτης</span>
                </span>
                <span className="font-mono text-amber-400 font-bold">
                  {completedLessons.length} / {allLessons.length || 54} ({completionPercent}%)
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-amber-500 to-emerald-400 h-2 transition-all duration-500 rounded-full"
                  style={{ width: `${Math.max(2, completionPercent)}%` }}
                />
              </div>
            </div>

            {/* Continue Studying Highlight Card */}
            {lastWatchedLesson ? (
              <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
                    Συνεχεια Μελετης
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono">
                    Μάθημα {lastWatchedLesson.lesson_id}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Video Thumbnail */}
                  {extractYouTubeId(lastWatchedLesson.video_url) ? (
                    <div className="w-20 h-14 rounded-lg overflow-hidden bg-black shrink-0 relative border border-slate-800">
                      <img
                        src={`https://img.youtube.com/vi/${extractYouTubeId(lastWatchedLesson.video_url)}/mqdefault.jpg`}
                        alt="Thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-14 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-amber-400">
                      <Video className="w-6 h-6" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                      {lastWatchedLesson.title}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {lastWatchedLesson.total_entries} θέματα & ασκήσεις
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onSelectLesson(lastWatchedLesson.lesson_id)}
                  className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition active:scale-[0.98]"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Συνέχεια στο Μάθημα {lastWatchedLesson.lesson_id}</span>
                </button>
              </div>
            ) : (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    Ξεκινηστε Εδω
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    Μάθημα 001
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Ξεκινήστε από το Μάθημα 001 για τις Γενικές Σχέσεις ΜΕΚ και τη θεωρία κρούσεων.
                </p>
                <button
                  onClick={() => onSelectLesson('001')}
                  className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Έναρξη από το Μάθημα 001</span>
                </button>
              </div>
            )}
          </div>

          <div className="pt-4 mt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>
              ⭐ <strong>{favoriteLessons.length}</strong> αποθηκευμένα αγαπημένα
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              Shortcut: <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300">?</kbd>
            </span>
          </div>
        </div>
      </div>

      {/* Curriculum Chapters Segmented Bar */}
      <div className="bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl flex items-center gap-1.5 overflow-x-auto scrollbar-none shadow-sm">
        {chapters.map((ch) => {
          const isActive = selectedChapter === ch.id;
          return (
            <button
              key={ch.id}
              onClick={() => setSelectedChapter(ch.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span>{ch.label}</span>
              {ch.count !== undefined && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                  isActive ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                }`}>
                  {ch.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Secondary Controls: Search, Status Filter Chips, Sorting & View Toggle */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
        {/* Left: Search Bar */}
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Αναζήτηση εννοιών, ασκήσεων (π.χ. 4.187, ελαστική κρούση, 037)..."
            className="w-full bg-slate-950/80 border border-slate-800 hover:border-slate-700 focus:border-amber-500 rounded-xl py-2 pl-10 pr-16 text-xs text-slate-100 placeholder:text-slate-500 outline-none transition shadow-inner"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                aria-label="Καθαρισμός"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-400">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Right Controls: Status filter, Sort & View Switcher */}
        <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
          {/* Status Filter Chips */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter(statusFilter === 'favorites' ? 'all' : 'favorites')}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                statusFilter === 'favorites'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Προβολή μόνο των αγαπημένων"
            >
              <Star className="w-3 h-3" />
              <span className="hidden sm:inline">Αγαπημένα</span>
              {favoriteLessons.length > 0 && (
                <span className="font-mono text-[10px]">({favoriteLessons.length})</span>
              )}
            </button>

            <button
              onClick={() => setStatusFilter(statusFilter === 'with_notes' ? 'all' : 'with_notes')}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                statusFilter === 'with_notes'
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Προβολή μόνο μαθημάτων με χειρόγραφες σημειώσεις PDF"
            >
              <FileText className="w-3 h-3" />
              <span className="hidden sm:inline">Με PDF</span>
            </button>

            <button
              onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                statusFilter === 'completed'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Προβολή ολοκληρωμένων μαθημάτων"
            >
              <Check className="w-3 h-3" />
              <span className="hidden sm:inline">Ολοκληρωμένα</span>
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-xl border border-slate-800 text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-slate-300 font-medium outline-none cursor-pointer"
            >
              <option value="id_asc" className="bg-slate-900 text-slate-100">Αύξουσα (001 → 054)</option>
              <option value="id_desc" className="bg-slate-900 text-slate-100">Φθίνουσα (054 → 001)</option>
              <option value="entries_desc" className="bg-slate-900 text-slate-100">Περισσότερα Θέματα</option>
            </select>
          </div>

          {/* Grid vs List View Mode Toggle */}
          <div className="flex items-center bg-slate-950/80 p-0.5 rounded-xl border border-slate-800">
            <button
              onClick={() => handleViewModeChange('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Προβολή Πλέγματος (Cards)"
              aria-label="Προβολή Πλέγματος"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleViewModeChange('list')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Προβολή Λίστας / Ύλης"
              aria-label="Προβολή Λίστας"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results Header Info */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>
          Εμφάνιση <strong className="text-amber-400 font-mono">{filteredAndSortedLessons.length}</strong> μαθημάτων
          {searchQuery && <span> για «<span className="text-slate-200">{searchQuery}</span>»</span>}
        </span>
        {(searchQuery || selectedChapter !== 'all' || statusFilter !== 'all') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedChapter('all');
              setStatusFilter('all');
            }}
            className="text-amber-400 hover:underline cursor-pointer"
          >
            Επαναφορά όλων των φίλτρων
          </button>
        )}
      </div>

      {/* Main Course Content: Grid View or List View */}
      {isLoading ? (
        <div className="p-20 text-center text-slate-500 font-mono text-sm flex flex-col items-center gap-3">
          <span className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span>Φόρτωση μαθημάτων...</span>
        </div>
      ) : filteredAndSortedLessons.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-16 text-center space-y-3">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">Δεν βρέθηκαν μαθήματα</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Δεν υπάρχει μάθημα που να ταιριάζει με τα επιλεγμένα κριτήρια αναζήτησης ή φίλτρων.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW: Clean, Visual, Engaging Video Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredAndSortedLessons.map((lesson) => {
            const saved = savedLessonsMap.get(lesson.lesson_id);
            const hasNotes = Boolean(saved && saved.total_pages > 0);
            const ytId = extractYouTubeId(lesson.video_url);
            const isFav = favoriteLessons.includes(lesson.lesson_id) || favoriteLessons.includes(String(lesson.lesson_number));
            const isDone = completedLessons.includes(lesson.lesson_id) || completedLessons.includes(String(lesson.lesson_number));

            // Curated clean preview topics (2 items max), strictly sorted by timestamp
            const sortedEntries = [...(lesson.entries || [])].sort((a, b) => a.seconds - b.seconds);
            const previewEntries = sortedEntries.slice(0, 2);
            const totalEntries = lesson.total_entries || (lesson.entries || []).length;

            return (
              <div
                key={lesson.lesson_id}
                className={`bg-slate-900 border rounded-2xl flex flex-col justify-between transition-all hover:shadow-xl hover:shadow-black/50 group overflow-hidden ${
                  isDone
                    ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
                    : isFav
                    ? 'border-amber-500/40'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Card Media Header: 16:9 Thumbnail with Overlay Actions */}
                  <div
                    onClick={() => onSelectLesson(lesson.lesson_id)}
                    className="relative w-full aspect-video bg-black cursor-pointer overflow-hidden group/media"
                  >
                    {ytId ? (
                      <img
                        src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                        alt={`Μάθημα ${lesson.lesson_id}`}
                        className="w-full h-full object-cover group-hover/media:scale-105 transition-transform duration-300 opacity-90 group-hover/media:opacity-100"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center text-slate-600">
                        <Video className="w-10 h-10" />
                      </div>
                    )}

                    {/* Top Badges Overlay */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-950/90 backdrop-blur border border-amber-500/40 text-amber-300 font-mono font-bold text-xs shadow-md">
                        {lesson.lesson_id}
                      </span>
                      {hasNotes && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-950/90 backdrop-blur border border-sky-500/40 text-sky-300 text-[10px] font-medium shadow-md">
                          <CheckCircle2 className="w-2.5 h-2.5 text-sky-400" />
                          <span>{saved?.total_pages} Σελ. PDF</span>
                        </span>
                      )}
                    </div>

                    {/* Top Right Action: Favorite Star */}
                    <div className="absolute top-2.5 right-2.5 z-10" onClick={(e) => e.stopPropagation()}>
                      {onToggleFavorite && (
                        <button
                          onClick={() => onToggleFavorite(lesson.lesson_id)}
                          className={`p-1.5 rounded-lg backdrop-blur border transition cursor-pointer ${
                            isFav
                              ? 'bg-amber-500/30 text-amber-300 border-amber-400 shadow-md'
                              : 'bg-slate-950/70 text-slate-400 hover:text-amber-300 border-slate-700'
                          }`}
                          title={isFav ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}
                          aria-label="Αγαπημένο"
                        >
                          <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`} />
                        </button>
                      )}
                    </div>

                    {/* Hover Play Button Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-xl transform scale-90 group-hover/media:scale-100 transition-transform">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </div>

                    {/* Bottom Right Duration/Entries pill */}
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur text-[10px] font-mono text-slate-300 border border-slate-800">
                      {totalEntries} θέματα
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-4 space-y-3">
                    <h3
                      onClick={() => onSelectLesson(lesson.lesson_id)}
                      className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug cursor-pointer"
                      title={lesson.title}
                    >
                      {lesson.title || `Μάθημα ${lesson.lesson_id}`}
                    </h3>

                    {/* Clean Key Topics Highlight Chips */}
                    {previewEntries.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          {previewEntries.map((entry, idx) => (
                            <button
                              key={idx}
                              onClick={() => onSelectLesson(lesson.lesson_id, entry.seconds)}
                              className="text-left px-2 py-1 rounded-md bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 hover:text-amber-300 transition line-clamp-1 max-w-full cursor-pointer"
                              title={`Μετάβαση στο: ${entry.topic}`}
                            >
                              <span className="font-mono text-amber-400 font-semibold mr-1">{entry.timestamp}</span>
                              <span>{entry.topic}</span>
                            </button>
                          ))}
                        </div>

                        {totalEntries > 2 && (
                          <button
                            onClick={() => setTimestampsModalLesson(lesson)}
                            className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer pt-0.5"
                          >
                            <ListChecks className="w-3.5 h-3.5" />
                            <span>Δείτε και τα υπόλοιπα {totalEntries - 2} θέματα</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Bottom CTA Bar */}
                <div className="p-4 pt-0 flex items-center gap-2">
                  <button
                    onClick={() => onSelectLesson(lesson.lesson_id)}
                    className="flex-1 py-2 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-[0.98]"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Μελέτη & Συγχρονισμός</span>
                  </button>

                  {/* Toggle Completed Action */}
                  {onToggleCompleted && (
                    <button
                      onClick={() => onToggleCompleted(lesson.lesson_id)}
                      className={`p-2 rounded-xl border transition cursor-pointer shrink-0 ${
                        isDone
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                          : 'bg-slate-950 text-slate-400 hover:text-emerald-400 border-slate-800'
                      }`}
                      title={isDone ? 'Μαρκάρισμα ως μη μελετημένο' : 'Μαρκάρισμα ως μελετήθηκε'}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST / SYLLABUS VIEW: Clean, Structured Syllabus Table */
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-lg divide-y divide-slate-800/80">
          {filteredAndSortedLessons.map((lesson) => {
            const saved = savedLessonsMap.get(lesson.lesson_id);
            const hasNotes = Boolean(saved && saved.total_pages > 0);
            const ytId = extractYouTubeId(lesson.video_url);
            const isFav = favoriteLessons.includes(lesson.lesson_id) || favoriteLessons.includes(String(lesson.lesson_number));
            const isDone = completedLessons.includes(lesson.lesson_id) || completedLessons.includes(String(lesson.lesson_number));

            return (
              <div
                key={lesson.lesson_id}
                className={`p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-800/50 transition ${
                  isDone ? 'bg-emerald-950/10' : ''
                }`}
              >
                {/* Left: Completion toggle + Lesson Number + Thumbnail */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {onToggleCompleted && (
                    <button
                      onClick={() => onToggleCompleted(lesson.lesson_id)}
                      className={`p-1.5 rounded-lg border transition cursor-pointer shrink-0 ${
                        isDone
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                          : 'bg-slate-950 text-slate-500 hover:text-slate-300 border-slate-800'
                      }`}
                      title={isDone ? 'Μαρκάρισμα ως μη μελετημένο' : 'Μαρκάρισμα ως μελετήθηκε'}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold text-xs shrink-0">
                    {lesson.lesson_id}
                  </div>

                  {/* Small 48x32 thumbnail preview */}
                  {ytId && (
                    <div
                      onClick={() => onSelectLesson(lesson.lesson_id)}
                      className="hidden md:block w-14 h-9 rounded bg-black shrink-0 overflow-hidden cursor-pointer border border-slate-800"
                    >
                      <img
                        src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                        alt="Thumb"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Title & Metadata */}
                  <div className="min-w-0 flex-1">
                    <h3
                      onClick={() => onSelectLesson(lesson.lesson_id)}
                      className="text-xs sm:text-sm font-bold text-white hover:text-amber-300 cursor-pointer transition line-clamp-1"
                    >
                      {lesson.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-mono">
                      <span>{lesson.total_entries} θέματα</span>
                      {hasNotes && (
                        <>
                          <span>•</span>
                          <span className="text-sky-400 font-medium">{saved?.total_pages} Σελ. PDF</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Actions: Favorite Star + Quick Timestamps Preview + Open Button */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                  {lesson.entries && lesson.entries.length > 0 && (
                    <button
                      onClick={() => setTimestampsModalLesson(lesson)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium cursor-pointer transition flex items-center gap-1"
                      title="Προβολή θεμάτων μαθήματος"
                    >
                      <ListChecks className="w-3.5 h-3.5" />
                      <span>Θέματα ({lesson.total_entries})</span>
                    </button>
                  )}

                  {onToggleFavorite && (
                    <button
                      onClick={() => onToggleFavorite(lesson.lesson_id)}
                      className={`p-1.5 rounded-xl border transition cursor-pointer ${
                        isFav
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-950 text-slate-500 hover:text-amber-300 border-slate-800'
                      }`}
                      title={isFav ? 'Αφαίρεση από τα αγαπημένα' : 'Προσθήκη στα αγαπημένα'}
                    >
                      <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                  )}

                  <button
                    onClick={() => onSelectLesson(lesson.lesson_id)}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Μελέτη</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Timestamps Preview Modal */}
      {timestampsModalLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-xl p-6 shadow-2xl relative overflow-hidden text-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold">
                    Μάθημα {timestampsModalLesson.lesson_id}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {timestampsModalLesson.total_entries} θέματα
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white line-clamp-2">
                  {timestampsModalLesson.title}
                </h3>
              </div>

              <button
                onClick={() => setTimestampsModalLesson(null)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
                aria-label="Κλείσιμο"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of Timestamps (Chronological) */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {[...(timestampsModalLesson.entries || [])]
                .sort((a, b) => a.seconds - b.seconds)
                .map((entry, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    onSelectLesson(timestampsModalLesson.lesson_id, entry.seconds);
                    setTimestampsModalLesson(null);
                  }}
                  className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-amber-500/40 cursor-pointer transition flex items-start gap-3 group"
                >
                  <span className="px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-amber-400 font-mono text-xs font-bold shrink-0 group-hover:border-amber-500/50">
                    {entry.timestamp}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-slate-200 group-hover:text-white line-clamp-1">
                      {entry.topic}
                    </h4>
                    {entry.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                        {entry.description}
                      </p>
                    )}
                  </div>
                  <Play className="w-4 h-4 text-slate-600 group-hover:text-amber-400 shrink-0 mt-1" />
                </div>
              ))}
            </div>

            <div className="pt-4 mt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Κάντε κλικ σε οποιοδήποτε θέμα για απευθείας μετάβαση
              </span>
              <button
                onClick={() => {
                  onSelectLesson(timestampsModalLesson.lesson_id);
                  setTimestampsModalLesson(null);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Άνοιγμα Μαθήματος
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

