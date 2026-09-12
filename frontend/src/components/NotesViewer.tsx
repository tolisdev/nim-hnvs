import React, { useRef, useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  Unlock,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  FileText
} from 'lucide-react';
import type { PageInfo, TimestampItem } from '../api';

interface NotesViewerProps {
  pages: PageInfo[];
  currentPage: number;
  onPageChange: (page: number) => void;
  timestamps: TimestampItem[];
  activeTimestamp: TimestampItem | null;
  onSelectTimestamp: (ts: TimestampItem) => void;
  isSyncLocked?: boolean;
  onToggleSyncLock?: () => void;
}

export const NotesViewer: React.FC<NotesViewerProps> = ({
  pages,
  currentPage,
  onPageChange,
  timestamps,
  activeTimestamp,
  onSelectTimestamp,
  isSyncLocked = true,
  onToggleSyncLock
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(100);
  const [fitMode, setFitMode] = useState<'page' | 'width' | 'custom'>('page');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const pageTimestamps = useMemo(() => {
    return [...timestamps]
      .filter((t) => t.page === currentPage)
      .sort((a, b) => a.seconds - b.seconds);
  }, [timestamps, currentPage]);
  const currentPageInfo = pages.find((p) => p.page_number === currentPage) || pages[0];

  const handleZoomIn = () => {
    setFitMode('custom');
    setZoom((prev) => Math.min(240, prev + 15));
  };

  const handleZoomOut = () => {
    setFitMode('custom');
    setZoom((prev) => Math.max(50, prev - 15));
  };

  const handleResetZoom = () => {
    setZoom(100);
    setFitMode('page');
  };

  return (
    <div
      className={`flex flex-col bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-xl transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : 'h-full'
      }`}
    >
      {/* Top Toolbar */}
      <div className="p-2.5 sm:p-3 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap">
        {/* Left: Page Navigator & Sync Lock */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-950/80 rounded-xl p-1 border border-slate-800 shadow-inner">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition"
              title="Προηγούμενη σελίδα (↑)"
              aria-label="Προηγούμενη σελίδα"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Quick jump select */}
            <select
              value={currentPage}
              onChange={(e) => onPageChange(Number(e.target.value))}
              className="bg-transparent text-xs font-mono font-bold text-amber-400 px-1 py-0.5 outline-none cursor-pointer text-center"
              aria-label="Επιλογή σελίδας"
            >
              {pages.map((p) => (
                <option key={p.page_number} value={p.page_number} className="bg-slate-900 text-slate-100">
                  Σελίδα {p.page_number} / {pages.length}
                </option>
              ))}
            </select>

            <button
              onClick={() => onPageChange(Math.min(pages.length, currentPage + 1))}
              disabled={currentPage >= pages.length}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition"
              title="Επόμενη σελίδα (↓)"
              aria-label="Επόμενη σελίδα"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Sync Lock Toggle */}
          {onToggleSyncLock && (
            <button
              onClick={onToggleSyncLock}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isSyncLocked
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 shadow-sm shadow-amber-500/10'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title={
                isSyncLocked
                  ? 'Κλείδωμα Ενεργό: Το PDF ακολουθεί αυτόματα τη σελίδα του βίντεο. (Πατήστε S για ελεύθερη περιήγηση)'
                  : 'Κλείδωμα Ανενεργό: Ελεύθερη περιήγηση στις σελίδες του PDF. (Πατήστε S για κλείδωμα)'
              }
            >
              {isSyncLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">Συγχρονισμός On</span>
                  <span className="sm:hidden">Sync</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="hidden sm:inline">Ελεύθερη Περιήγηση</span>
                  <span className="sm:hidden">Free</span>
                </>
              )}
            </button>
          )}

          {/* Jump to current video page if unlocked */}
          {!isSyncLocked && activeTimestamp?.page && activeTimestamp.page !== currentPage && (
            <button
              onClick={() => onPageChange(activeTimestamp.page)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 transition cursor-pointer"
              title="Μετάβαση στη σελίδα του βίντεο"
            >
              <Clock className="w-3 h-3 text-rose-400" />
              <span>Βίντεο: Σελ. {activeTimestamp.page}</span>
            </button>
          )}
        </div>

        {/* Right: Zoom & Fullscreen Controls */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 rounded-xl p-1 border border-slate-800">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 50}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 cursor-pointer transition"
            title="Σμίκρυνση (-)"
            aria-label="Σμίκρυνση"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleResetZoom}
            className="px-2 py-0.5 text-[11px] font-mono font-bold text-slate-300 hover:text-amber-300 transition cursor-pointer"
            title="Επαναφορά μεγέθους στο 100%"
          >
            {fitMode === 'page' ? 'Auto' : `${zoom}%`}
          </button>

          <button
            onClick={handleZoomIn}
            disabled={zoom >= 240}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 cursor-pointer transition"
            title="Μεγέθυνση (+)"
            aria-label="Μεγέθυνση"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="h-3.5 w-px bg-slate-800" />

          {/* Fit Mode Switcher: Page vs Width */}
          <div className="flex items-center gap-0.5 bg-slate-900 rounded-lg p-0.5 border border-slate-800">
            <button
              onClick={() => {
                setFitMode('page');
                setZoom(100);
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                fitMode === 'page'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Προσαρμογή ολόκληρης σελίδας (όλα τα περιθώρια ορατά)"
            >
              Σελίδα
            </button>
            <button
              onClick={() => {
                setFitMode('width');
                setZoom(100);
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                fitMode === 'width'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Προσαρμογή πλάτους"
            >
              Πλάτος
            </button>
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            title={isFullscreen ? 'Έξοδος από πλήρη οθόνη' : 'Πλήρης οθόνη σημειώσεων'}
            aria-label={isFullscreen ? 'Έξοδος από πλήρη οθόνη' : 'Πλήρης οθόνη σημειώσεων'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Page-Specific Timestamps Strip (if any exist for this page) */}
      {pageTimestamps.length > 0 && (
        <div className="px-3 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center gap-1">
            <FileText className="w-3 h-3 text-sky-400" />
            <span>Σημεία Σελίδας {currentPage}:</span>
          </span>

          <div className="flex items-center gap-1.5">
            {pageTimestamps.map((ts) => {
              const isActive = activeTimestamp?.timestamp_str === ts.timestamp_str;
              return (
                <button
                  key={ts.timestamp_str}
                  onClick={() => onSelectTimestamp(ts)}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer whitespace-nowrap border ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 border-amber-400 shadow-sm shadow-amber-500/20 font-black'
                      : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:bg-slate-800 hover:border-slate-700'
                  }`}
                  title={ts.label}
                >
                  <Clock className="w-2.5 h-2.5" />
                  <span>{ts.timestamp_str}</span>
                  <span className="max-w-[120px] truncate font-sans font-normal opacity-90">
                    • {ts.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Canvas Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto bg-[#070a11] relative scroll-smooth"
      >
        <div
          className={`min-h-full w-full flex flex-col items-center p-3 sm:p-5 ${
            fitMode === 'page' ? 'justify-center pb-5' : 'justify-start pb-16'
          }`}
        >
          {currentPageInfo ? (
            <div
              className="relative shadow-[0_12px_36px_rgba(0,0,0,0.75)] rounded-[2px] bg-white border border-slate-700/70 ring-1 ring-white/10 transition-all duration-150 flex items-center justify-center overflow-hidden"
              style={
                fitMode === 'page'
                  ? {
                      maxHeight: isFullscreen ? 'calc(100vh - 140px)' : '580px',
                      width: 'auto',
                      maxWidth: '100%'
                    }
                  : fitMode === 'width'
                  ? {
                      width: '100%',
                      maxWidth: '960px'
                    }
                  : {
                      width: `${zoom}%`,
                      maxWidth: 'none'
                    }
              }
            >
              <img
                src={currentPageInfo.image_url}
                alt={`Χειρόγραφες Σημειώσεις - Σελίδα ${currentPage}`}
                className={`block select-none rounded-[2px] ${
                  fitMode === 'page'
                    ? 'max-h-[calc(100vh-140px)] sm:max-h-[580px] w-auto h-auto object-contain'
                    : 'w-full h-auto object-contain'
                }`}
                draggable={false}
              />

              {/* Non-distracting active timestamp indicator */}
              {activeTimestamp && activeTimestamp.page === currentPage && (
                <div className="absolute top-3 right-3 bg-slate-900/90 border border-amber-500/60 text-amber-300 text-xs px-3 py-1.5 rounded-xl font-semibold shadow-xl backdrop-blur flex items-center gap-2 ring-1 ring-amber-500/30 pointer-events-none">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  <span className="font-mono">{activeTimestamp.timestamp_str}</span>
                  <span className="hidden sm:inline text-[11px] text-slate-300 max-w-[140px] truncate">
                    {activeTimestamp.label}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500 text-sm py-20 gap-2">
              <FileText className="w-10 h-10 text-slate-700" />
              <span>Δεν έχουν φορτωθεί χειρόγραφες σημειώσεις για αυτό το μάθημα.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

