import { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { VideoPlayer } from './components/VideoPlayer';
import { NotesViewer } from './components/NotesViewer';
import { TimelineBottom } from './components/TimelineBottom';
import { AdminModal } from './components/AdminModal';
import { NewLessonModal } from './components/NewLessonModal';
import { HomePage } from './components/HomePage';
import { LoginModal } from './components/LoginModal';
import { LessonDrawer } from './components/LessonDrawer';
import { ShortcutsModal } from './components/ShortcutsModal';
import { fetchLessons, fetchLesson, verifyAuthToken } from './api';
import type { Lesson, TimestampItem } from './api';
import {
  ArrowLeft,
  Menu,
  Columns2,
  FileText,
  Video,
  Star,
  Check
} from 'lucide-react';

export function App() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [currentSeconds, setCurrentSeconds] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [activeTimestamp, setActiveTimestamp] = useState<TimestampItem | null>(null);
  const [seekToSeconds, setSeekToSeconds] = useState<number | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isNewLessonOpen, setIsNewLessonOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncLocked, setIsSyncLocked] = useState<boolean>(true);
  const [currentView, setCurrentView] = useState<'home' | 'player'>('home');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token'));
  });
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

  // Layout mode for player view: 'split' | 'video_focus' | 'notes_focus'
  const [layoutMode, setLayoutMode] = useState<'split' | 'video_focus' | 'notes_focus'>('split');
  // Mobile tab toggle when on smaller screens
  const [mobileTab, setMobileTab] = useState<'both' | 'video' | 'notes'>('both');

  // Student Study Tracking via localStorage
  const [completedLessons, setCompletedLessons] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('student_completed_lessons');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [favoriteLessons, setFavoriteLessons] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('student_favorite_lessons');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [lastWatchedLessonId, setLastWatchedLessonId] = useState<string | null>(() => {
    return localStorage.getItem('student_last_watched') || null;
  });

  const handleToggleCompleted = (lessonId: string) => {
    setCompletedLessons((prev) => {
      const next = prev.includes(lessonId)
        ? prev.filter((id) => id !== lessonId)
        : [...prev, lessonId];
      try {
        localStorage.setItem('student_completed_lessons', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleToggleFavorite = (lessonId: string) => {
    setFavoriteLessons((prev) => {
      const next = prev.includes(lessonId)
        ? prev.filter((id) => id !== lessonId)
        : [...prev, lessonId];
      try {
        localStorage.setItem('student_favorite_lessons', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_user');
    setIsLoggedIn(false);
    setIsAdminOpen(false);
    setIsNewLessonOpen(false);
  };

  useEffect(() => {
    const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
    if (token) {
      verifyAuthToken().then((valid) => {
        if (!valid) {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
          sessionStorage.removeItem('admin_token');
          sessionStorage.removeItem('admin_user');
          setIsLoggedIn(false);
          setIsAdminOpen(false);
          setIsNewLessonOpen(false);
        }
      });
    }
  }, []);

  useEffect(() => {
    fetchLessons()
      .then((data) => {
        setLessons(data);
        if (data.length > 0) {
          setSelectedLesson(data[0]);
        }
      })
      .catch((err) => console.error('Failed to fetch lessons:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleOpenLessonFromHome = async (lessonId: string, initialSeconds?: number) => {
    const formattedId = lessonId.startsWith('lesson_') ? lessonId : `lesson_${lessonId}`;
    try {
      const loaded = await fetchLesson(formattedId);
      setSelectedLesson(loaded);
      setCurrentPage(1);
      if (initialSeconds !== undefined) {
        setSeekToSeconds(initialSeconds);
        setCurrentSeconds(initialSeconds);
      } else {
        setSeekToSeconds(0);
        setCurrentSeconds(0);
      }
      setActiveTimestamp(null);
      setCurrentView('player');
      setLastWatchedLessonId(lessonId);
      try {
        localStorage.setItem('student_last_watched', lessonId);
      } catch {}

      // add to lessons list if not already there
      setLessons((prev) => {
        if (!prev.some((l) => l.id === loaded.id)) {
          return [...prev, loaded];
        }
        return prev;
      });
    } catch (e) {
      console.error('Failed to load lesson:', e);
      alert('Σφάλμα κατά τη φόρτωση του μαθήματος.');
    }
  };

  const sortedLessonTimestamps = useMemo(() => {
    if (!selectedLesson || !selectedLesson.timestamps) return [];
    return [...selectedLesson.timestamps].sort((a, b) => a.seconds - b.seconds);
  }, [selectedLesson]);

  useEffect(() => {
    if (sortedLessonTimestamps.length === 0) return;

    let matched: TimestampItem | null = null;

    for (const ts of sortedLessonTimestamps) {
      if (currentSeconds >= ts.seconds) {
        matched = ts;
      } else {
        break;
      }
    }

    if (matched) {
      setActiveTimestamp(matched);
      if (isSyncLocked && matched.page && matched.page !== currentPage) {
        setCurrentPage(matched.page);
      }
    }
  }, [currentSeconds, sortedLessonTimestamps, currentPage, isSyncLocked]);

  const handleToggleSyncLock = useCallback(() => {
    setIsSyncLocked((prev) => {
      const next = !prev;
      if (next && activeTimestamp?.page) {
        setCurrentPage(activeTimestamp.page);
      }
      return next;
    });
  }, [activeTimestamp]);

  const handleSelectTimestamp = (ts: TimestampItem) => {
    setSeekToSeconds(ts.seconds);
    setActiveTimestamp(ts);
    if (ts.page) {
      setCurrentPage(ts.page);
    }
  };

  const handleLessonSaved = (updated: Lesson) => {
    setLessons((prev) => {
      const idx = prev.findIndex((l) => l.id === updated.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [...prev, updated];
    });
    if (selectedLesson?.id === updated.id) {
      setSelectedLesson(updated);
    }
  };

  const handleLessonCreated = (newLesson: Lesson) => {
    setLessons((prev) => {
      const idx = prev.findIndex((l) => l.id === newLesson.id || l.number === newLesson.number);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newLesson;
        return copy;
      }
      return [newLesson, ...prev];
    });
    setSelectedLesson(newLesson);
    setCurrentPage(1);
    setSeekToSeconds(0);
    setCurrentSeconds(0);
    setActiveTimestamp(null);
    setCurrentView('player');
    setLastWatchedLessonId(newLesson.number || newLesson.id);
    try {
      localStorage.setItem('student_last_watched', newLesson.number || newLesson.id);
    } catch {}
  };

  // Keyboard shortcut listener for '?', 'v', 's'
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === '?') {
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === 'v' || e.key === 'V') {
        setLayoutMode((prev) => {
          if (prev === 'split') return 'notes_focus';
          if (prev === 'notes_focus') return 'video_focus';
          return 'split';
        });
      } else if (e.key === 's' || e.key === 'S') {
        handleToggleSyncLock();
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [handleToggleSyncLock]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0b0f17] flex flex-col items-center justify-center text-amber-400 font-mono text-sm gap-3">
        <span className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <span>Φόρτωση Μαθημάτων & Σημειώσεων...</span>
      </div>
    );
  }

  const isCurrentLessonFavorite = selectedLesson
    ? favoriteLessons.includes(selectedLesson.number) || favoriteLessons.includes(selectedLesson.id)
    : false;

  const isCurrentLessonCompleted = selectedLesson
    ? completedLessons.includes(selectedLesson.number) || completedLessons.includes(selectedLesson.id)
    : false;

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Navbar */}
      <Header
        lessons={lessons}
        selectedLesson={selectedLesson}
        onSelectLesson={(l) => {
          setSelectedLesson(l);
          setCurrentPage(1);
          setCurrentSeconds(0);
          setActiveTimestamp(null);
          setLastWatchedLessonId(l.number || l.id);
        }}
        isAdminOpen={isAdminOpen}
        onToggleAdmin={() => {
          if (!isLoggedIn) {
            setIsLoginOpen(true);
          } else {
            setIsAdminOpen(!isAdminOpen);
          }
        }}
        currentView={currentView}
        onNavigate={(v) => setCurrentView(v)}
        isLoggedIn={isLoggedIn}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
        onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
        completedCount={completedLessons.length}
        totalLessonsCount={lessons.length}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenNewLesson={() => setIsNewLessonOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-3 md:p-6 max-w-[1920px] w-full mx-auto flex flex-col gap-4">
        {currentView === 'home' ? (
          <HomePage
            onSelectLesson={handleOpenLessonFromHome}
            savedLessons={lessons}
            completedLessons={completedLessons}
            onToggleCompleted={handleToggleCompleted}
            favoriteLessons={favoriteLessons}
            onToggleFavorite={handleToggleFavorite}
            lastWatchedLessonId={lastWatchedLessonId}
            isLoggedIn={isLoggedIn}
            onOpenNewLesson={() => setIsNewLessonOpen(true)}
          />
        ) : (
          <>
            {/* Player View Top Bar / Breadcrumbs & Student Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 backdrop-blur border border-slate-800 p-3 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Drawer Button */}
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold text-xs rounded-xl border border-amber-500/30 cursor-pointer transition shadow-sm"
                  title="Άνοιγμα λίστας μαθημάτων"
                >
                  <Menu className="w-4 h-4 text-amber-400" />
                  <span>Μαθήματα ({lessons.length})</span>
                </button>

                <button
                  onClick={() => setCurrentView('home')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs rounded-xl border border-slate-700 cursor-pointer transition shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Αρχική</span>
                </button>

                <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>

                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono">
                      Μάθημα {selectedLesson?.number}
                    </span>
                    <span className="line-clamp-1 max-w-[280px] sm:max-w-md">{selectedLesson?.title}</span>
                  </h2>

                  {/* Star and Completed Toggles for active lesson */}
                  {selectedLesson && (
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleToggleFavorite(selectedLesson.number || selectedLesson.id)}
                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                          isCurrentLessonFavorite
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-950/60 text-slate-500 hover:text-amber-300 border-slate-800'
                        }`}
                        title={isCurrentLessonFavorite ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}
                        aria-label="Αγαπημένο"
                      >
                        <Star className={`w-3.5 h-3.5 ${isCurrentLessonFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>

                      <button
                        onClick={() => handleToggleCompleted(selectedLesson.number || selectedLesson.id)}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                          isCurrentLessonCompleted
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                            : 'bg-slate-950/60 text-slate-400 hover:text-emerald-400 border-slate-800'
                        }`}
                        title={isCurrentLessonCompleted ? 'Μαρκάρισμα ως μη μελετημένο' : 'Μαρκάρισμα ως μελετήθηκε'}
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="hidden md:inline">
                          {isCurrentLessonCompleted ? 'Μελετήθηκε' : 'Μαρκάρισμα ως Μελετήθηκε'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Layout Mode Switcher & Lesson Stats */}
              <div className="flex items-center gap-3 justify-between sm:justify-end">
                {/* Desktop Layout Mode Switcher */}
                <div className="hidden lg:flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setLayoutMode('split')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                      layoutMode === 'split'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Ισομερής διάταξη 50% - 50% (V)"
                  >
                    <Columns2 className="w-3.5 h-3.5" />
                    <span>50 / 50</span>
                  </button>

                  <button
                    onClick={() => setLayoutMode('video_focus')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                      layoutMode === 'video_focus'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Εστίαση στο Βίντεο (V)"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Βίντεο+</span>
                  </button>

                  <button
                    onClick={() => setLayoutMode('notes_focus')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                      layoutMode === 'notes_focus'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Εστίαση στις Σημειώσεις PDF (V)"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Σημειώσεις+</span>
                  </button>
                </div>

                {/* Mobile / Tablet View Switcher */}
                <div className="flex lg:hidden items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setMobileTab('both')}
                    className={`px-2 py-1 rounded-lg font-medium transition cursor-pointer ${
                      mobileTab === 'both' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    Και τα δύο
                  </button>
                  <button
                    onClick={() => setMobileTab('video')}
                    className={`px-2 py-1 rounded-lg font-medium transition cursor-pointer ${
                      mobileTab === 'video' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    Βίντεο
                  </button>
                  <button
                    onClick={() => setMobileTab('notes')}
                    className={`px-2 py-1 rounded-lg font-medium transition cursor-pointer ${
                      mobileTab === 'notes' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    Σημειώσεις
                  </button>
                </div>

                <div className="text-xs font-mono text-slate-400 hidden xl:flex items-center gap-2">
                  <span>{selectedLesson?.timestamps?.length || 0} σημεία</span>
                  <span>•</span>
                  <span>{selectedLesson?.total_pages || 0} σελίδες PDF</span>
                </div>
              </div>
            </div>

            {/* Flexible Split Row for Video & Notes */}
            <div
              className={`grid gap-4 ${
                layoutMode === 'video_focus'
                  ? 'grid-cols-1 lg:grid-cols-12 h-[720px]'
                  : layoutMode === 'notes_focus'
                  ? 'grid-cols-1 lg:grid-cols-12 h-[720px]'
                  : 'grid-cols-1 lg:grid-cols-2 h-[700px]'
              }`}
            >
              {/* Video Player Column */}
              <div
                className={`h-full flex flex-col ${
                  mobileTab === 'notes' ? 'hidden lg:flex' : ''
                } ${
                  layoutMode === 'video_focus'
                    ? 'lg:col-span-7 xl:col-span-8'
                    : layoutMode === 'notes_focus'
                    ? 'lg:col-span-5 xl:col-span-4'
                    : ''
                }`}
              >
                {selectedLesson ? (
                  <VideoPlayer
                    youtubeId={selectedLesson.youtube_id}
                    onTimeUpdate={(sec) => setCurrentSeconds(sec)}
                    seekToSeconds={seekToSeconds}
                    onSeekComplete={() => setSeekToSeconds(null)}
                  />
                ) : (
                  <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-500">
                    Δεν έχει επιλεγεί μάθημα
                  </div>
                )}
              </div>

              {/* Notes Viewer Column */}
              <div
                className={`h-full flex flex-col ${
                  mobileTab === 'video' ? 'hidden lg:flex' : ''
                } ${
                  layoutMode === 'video_focus'
                    ? 'lg:col-span-5 xl:col-span-4'
                    : layoutMode === 'notes_focus'
                    ? 'lg:col-span-7 xl:col-span-8'
                    : ''
                }`}
              >
                {selectedLesson ? (
                  <NotesViewer
                    pages={selectedLesson.pages || []}
                    currentPage={currentPage}
                    onPageChange={(p) => setCurrentPage(p)}
                    timestamps={sortedLessonTimestamps}
                    activeTimestamp={activeTimestamp}
                    onSelectTimestamp={handleSelectTimestamp}
                    isSyncLocked={isSyncLocked}
                    onToggleSyncLock={handleToggleSyncLock}
                  />
                ) : null}
              </div>
            </div>

            {/* Bottom Row: Full-width Horizontal Timeline */}
            <div>
              <TimelineBottom
                timestamps={sortedLessonTimestamps}
                activeTimestamp={activeTimestamp}
                onSelectTimestamp={handleSelectTimestamp}
                currentSeconds={currentSeconds}
              />
            </div>
          </>
        )}
      </main>

      {/* Keyboard Shortcuts Cheatsheet Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Lesson Drawer (Off-canvas sidebar) */}
      <LessonDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentLessonId={selectedLesson?.id}
        onSelectLesson={handleOpenLessonFromHome}
        savedLessons={lessons}
        completedLessons={completedLessons}
        favoriteLessons={favoriteLessons}
        isLoggedIn={isLoggedIn}
        onOpenNewLesson={() => setIsNewLessonOpen(true)}
      />

      {/* Admin Modal - accessible ONLY when logged in */}
      {isLoggedIn && (
        <AdminModal
          lesson={selectedLesson}
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
          onLessonSaved={handleLessonSaved}
          onOpenNewLesson={() => {
            setIsAdminOpen(false);
            setIsNewLessonOpen(true);
          }}
        />
      )}

      {/* New Lesson Modal - accessible ONLY when logged in */}
      {isLoggedIn && (
        <NewLessonModal
          isOpen={isNewLessonOpen}
          onClose={() => setIsNewLessonOpen(false)}
          onLessonCreated={handleLessonCreated}
          existingLessons={lessons}
        />
      )}
    </div>
  );
}

export default App;

