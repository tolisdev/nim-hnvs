import React, { useState, useRef, useEffect, useMemo } from 'react';
import { PlayCircle, Clock, ListChecks, Search, X, CheckCircle2 } from 'lucide-react';
import type { TimestampItem } from '../api';

interface TimelineBottomProps {
  timestamps: TimestampItem[];
  activeTimestamp: TimestampItem | null;
  onSelectTimestamp: (ts: TimestampItem) => void;
  currentSeconds: number;
}

export const TimelineBottom: React.FC<TimelineBottomProps> = ({
  timestamps,
  activeTimestamp,
  onSelectTimestamp,
  currentSeconds
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const activeCardRef = useRef<HTMLButtonElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to active card when activeTimestamp changes
  useEffect(() => {
    if (activeCardRef.current && scrollContainerRef.current) {
      activeCardRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  }, [activeTimestamp?.timestamp_str]);

  const sortedTimestamps = useMemo(() => {
    return [...timestamps].sort((a, b) => a.seconds - b.seconds);
  }, [timestamps]);

  const filteredTimestamps = useMemo(() => {
    const q = searchFilter.toLowerCase().trim();
    if (!q) return sortedTimestamps;
    return sortedTimestamps.filter(
      (ts) =>
        ts.label.toLowerCase().includes(q) ||
        (ts.sublabel && ts.sublabel.toLowerCase().includes(q)) ||
        ts.timestamp_str.includes(q) ||
        String(ts.page).includes(q)
    );
  }, [sortedTimestamps, searchFilter]);

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-3 shadow-xl flex flex-col gap-2.5">
      {/* Header & In-Lesson Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ListChecks className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Χρονοετικέτες & Βήματα ({timestamps.length})
          </h3>
          <span className="text-[10px] text-slate-400 hidden md:inline">
            • Κάντε κλικ σε οποιοδήποτε βήμα για ταυτόχρονη μετάβαση στο βίντεο & σημειώσεις
          </span>
        </div>

        {/* Quick Search inside Lesson */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Φίλτρο θεμάτων (π.χ. ερώτημα 2)..."
            className="w-full bg-slate-950/80 border border-slate-800 hover:border-slate-700 focus:border-amber-500 rounded-xl py-1.5 pl-8 pr-7 text-xs text-slate-200 placeholder:text-slate-500 outline-none transition"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Scrollable Carousel of Timestamps */}
      <div
        ref={scrollContainerRef}
        className="flex items-stretch gap-2.5 overflow-x-auto py-1 px-0.5 scrollbar-thin scrollbar-thumb-slate-800"
      >
        {filteredTimestamps.length === 0 ? (
          <div className="p-4 text-xs text-slate-500 text-center w-full">
            Δεν βρέθηκαν σημεία που να περιέχουν «{searchFilter}».
          </div>
        ) : (
          filteredTimestamps.map((ts, idx) => {
            const isActive = activeTimestamp?.timestamp_str === ts.timestamp_str;
            const isPast = currentSeconds >= ts.seconds;

            return (
              <button
                key={ts.id || idx}
                ref={isActive ? activeCardRef : null}
                onClick={() => onSelectTimestamp(ts)}
                className={`flex flex-col justify-between text-left p-3 rounded-xl transition-all cursor-pointer shrink-0 w-64 border ${
                  isActive
                    ? 'bg-gradient-to-b from-amber-500/20 to-amber-500/10 border-amber-500/70 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/50 scale-[1.01]'
                    : isPast
                    ? 'bg-slate-950/80 border-slate-800/90 hover:bg-slate-800/70 hover:border-slate-700'
                    : 'bg-slate-950/50 border-slate-800/60 hover:bg-slate-800/50 hover:border-slate-700 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <div
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-mono text-xs font-bold ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : isPast
                        ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/50'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>{ts.timestamp_str}</span>
                  </div>

                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded-md border border-slate-700/60">
                    Σελ. {ts.page}
                  </span>
                </div>

                <div className="min-w-0 flex-1 my-1">
                  <h4
                    className={`text-xs font-bold line-clamp-2 leading-snug ${
                      isActive ? 'text-amber-200' : 'text-slate-200'
                    }`}
                    title={ts.label}
                  >
                    {ts.label}
                  </h4>
                  {ts.sublabel && (
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {ts.sublabel}
                    </p>
                  )}
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-800/70 flex items-center justify-between text-[10px] text-slate-500">
                  <span className="font-mono">{ts.seconds}s</span>
                  {isActive ? (
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                      <span>Ενεργό</span>
                    </span>
                  ) : isPast ? (
                    <span className="text-emerald-400/80 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Ολοκληρώθηκε</span>
                    </span>
                  ) : (
                    <PlayCircle className="w-3.5 h-3.5 text-slate-600" />
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

