import React from 'react';
import { PlayCircle, FileText } from 'lucide-react';
import type { TimestampItem } from '../api';

interface TimelineSidebarProps {
  timestamps: TimestampItem[];
  activeTimestamp: TimestampItem | null;
  onSelectTimestamp: (ts: TimestampItem) => void;
  currentSeconds: number;
}

export const TimelineSidebar: React.FC<TimelineSidebarProps> = ({
  timestamps,
  activeTimestamp,
  onSelectTimestamp,
  currentSeconds
}) => {
  const sortedTimestamps = React.useMemo(() => {
    return [...timestamps].sort((a, b) => a.seconds - b.seconds);
  }, [timestamps]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="p-3.5 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-400" />
          Ευρετήριο & Χρονοετικέτες
        </h3>
        <span className="text-[11px] font-mono text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">
          {sortedTimestamps.length} σημεία
        </span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
        {sortedTimestamps.map((ts, idx) => {
          const isActive = activeTimestamp?.timestamp_str === ts.timestamp_str;
          const isPast = currentSeconds >= ts.seconds;

          return (
            <button
              key={ts.id || idx}
              onClick={() => onSelectTimestamp(ts)}
              className={
                "w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 cursor-pointer group " +
                (isActive
                  ? "bg-amber-500/15 border border-amber-500/40 shadow-md shadow-amber-500/5"
                  : "hover:bg-slate-800/70 border border-transparent")
              }
            >
              <div
                className={
                  "flex flex-col items-center justify-center px-2 py-1.5 rounded-lg font-mono text-xs font-bold shrink-0 transition-colors " +
                  (isActive
                    ? "bg-amber-500 text-slate-950 font-black"
                    : isPast
                    ? "bg-slate-800 text-amber-300 border border-slate-700"
                    : "bg-slate-800/50 text-slate-400 border border-slate-800")
                }
              >
                <span>{ts.timestamp_str}</span>
                <span className="text-[9px] font-normal opacity-80">Σελ. {ts.page}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4
                    className={
                      "text-xs font-semibold truncate " +
                      (isActive ? "text-amber-200" : "text-slate-200 group-hover:text-amber-300")
                    }
                  >
                    {ts.label}
                  </h4>
                </div>
                {ts.sublabel && (
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                    {ts.sublabel}
                  </p>
                )}
              </div>

              <div className="shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                <PlayCircle className="w-4 h-4 text-amber-400" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
