import React from 'react';
import { Settings, LayoutGrid, Play, Menu, LogIn, LogOut, Keyboard, CheckCircle2, Plus } from 'lucide-react';
import type { Lesson } from '../api';
import logoImg from '../assets/logo.webp';

interface HeaderProps {
  lessons: Lesson[];
  selectedLesson: Lesson | null;
  onSelectLesson: (lesson: Lesson) => void;
  isAdminOpen: boolean;
  onToggleAdmin: () => void;
  currentView: 'home' | 'player';
  onNavigate: (view: 'home' | 'player') => void;
  isLoggedIn: boolean;
  onOpenLogin: () => void;
  onLogout: () => void;
  onToggleDrawer: () => void;
  completedCount?: number;
  totalLessonsCount?: number;
  onOpenShortcuts?: () => void;
  onOpenNewLesson?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lessons,
  selectedLesson,
  onSelectLesson,
  isAdminOpen,
  onToggleAdmin,
  currentView,
  onNavigate,
  isLoggedIn,
  onOpenLogin,
  onLogout,
  onToggleDrawer,
  completedCount = 0,
  totalLessonsCount = 0,
  onOpenShortcuts,
  onOpenNewLesson
}) => {
  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 py-2.5">
      <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-4">
        {/* Left: Hamburger (in player view) + Logo & Brand */}
        <div className="flex items-center gap-3">
          {currentView === 'player' && (
            <button
              onClick={onToggleDrawer}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 cursor-pointer transition shadow-sm flex items-center gap-1.5"
              title="Άνοιγμα λίστας μαθημάτων"
            >
              <Menu className="w-4 h-4" />
              <span className="hidden md:inline text-xs font-semibold text-slate-200">Μαθήματα</span>
            </button>
          )}

          <div
            onClick={() => onNavigate('home')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="h-10 w-10 rounded-xl bg-slate-950/80 border border-slate-800 p-1 flex items-center justify-center shadow-md shadow-black/40 group-hover:border-amber-500/50 group-hover:scale-105 transition-all">
              <img src={logoImg} alt="nimalakasiotis.gr logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight leading-none group-hover:text-amber-300 transition-colors">
                nimalakasiotis<span className="text-amber-400">.gr</span>
              </h1>
              <p className="text-[11px] text-slate-400 mt-1 font-sans">
                Φυσική Γ΄ Λυκείου • COURSES113
              </p>
            </div>
          </div>
        </div>

        {/* Center Nav Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-2xl border border-slate-800 shadow-inner">
          <button
            onClick={() => onNavigate('home')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentView === 'home'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Όλα τα Μαθήματα</span>
          </button>

          <button
            onClick={() => onNavigate('player')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentView === 'player'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>
              {selectedLesson ? `Προβολή: Μάθημα ${selectedLesson.number}` : 'Προβολή & Συγχρονισμός'}
            </span>
          </button>
        </div>

        {/* Right Actions: Study Progress + Shortcuts + Quick selector + Login / Admin */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Student Study Progress Badge */}
          {completedCount > 0 && (
            <div
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-semibold"
              title={`${completedCount} από ${totalLessonsCount} μαθήματα ολοκληρώθηκαν`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {completedCount}/{totalLessonsCount} ({Math.round((completedCount / (totalLessonsCount || 1)) * 100)}%)
              </span>
            </div>
          )}

          {/* Keyboard Shortcuts Dialog Trigger */}
          {onOpenShortcuts && (
            <button
              onClick={onOpenShortcuts}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-amber-400 border border-slate-700/80 transition cursor-pointer flex items-center justify-center"
              title="Συντομεύσεις Πληκτρολογίου (?)"
              aria-label="Συντομεύσεις Πληκτρολογίου"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          )}

          {/* Quick Lesson Dropdown */}
          <div className="hidden xl:flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs">
            <span className="font-semibold text-amber-400 font-mono">
              Μάθημα:
            </span>
            <select
              value={selectedLesson?.id || ''}
              onChange={(e) => {
                const found = lessons.find((l) => l.id === e.target.value);
                if (found) {
                  onSelectLesson(found);
                  onNavigate('player');
                }
              }}
              className="bg-transparent text-xs font-medium text-slate-200 outline-none cursor-pointer max-w-[160px] truncate"
            >
              {lessons.map((l) => (
                <option key={l.id} value={l.id} className="bg-slate-900 text-slate-100">
                  {l.number} - {l.title.slice(0, 28)}...
                </option>
              ))}
            </select>
          </div>

          {/* Authentication & Admin Button */}
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              {/* Create New Lesson Modal Button */}
              {onOpenNewLesson && (
                <button
                  onClick={onOpenNewLesson}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-sm cursor-pointer transition"
                  title="Δημιουργία Νέου Μαθήματος"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span className="hidden sm:inline">Νέο Μάθημα</span>
                </button>
              )}

              {/* Admin Button: Visible ONLY when logged in */}
              <button
                onClick={onToggleAdmin}
                className={
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer " +
                  (isAdminOpen
                    ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                    : "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40")
                }
                title="Διαχείριση μαθήματος, PDF & OCR"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isAdminOpen ? 'Κλείσιμο Admin' : 'Admin'}</span>
              </button>

              {/* User badge with logout */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-slate-300 font-medium hidden md:inline">Admin</span>
                <button
                  onClick={onLogout}
                  className="p-0.5 rounded text-slate-400 hover:text-rose-400 cursor-pointer transition"
                  title="Αποσύνδεση"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
              title="Σύνδεση Διαχειριστή"
            >
              <LogIn className="w-3.5 h-3.5 text-amber-400" />
              <span>Σύνδεση</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
