import React, { useEffect } from 'react';
import { X, Keyboard, Play, FileText, Eye } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
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

  const shortcuts = [
    {
      category: 'Αναπαραγωγή Βίντεο',
      icon: Play,
      items: [
        { keys: ['Space'], desc: 'Αναπαραγωγή / Παύση (Play/Pause)' },
        { keys: ['←', '→'], desc: 'Μετάβαση 5 δευτερόλεπτα πίσω / εμπρός' },
        { keys: ['J', 'L'], desc: 'Μετάβαση 10 δευτερόλεπτα πίσω / εμπρός' }
      ]
    },
    {
      category: 'Σημειώσεις PDF & Συγχρονισμός',
      icon: FileText,
      items: [
        { keys: ['↑', '↓'], desc: 'Προηγούμενη / Επόμενη σελίδα σημειώσεων' },
        { keys: ['S'], desc: 'Εναλλαγή κλειδώματος συγχρονισμού (Sync Lock)' },
        { keys: ['+', '-'], desc: 'Μεγέθυνση / Σμίκρυνση σημειώσεων PDF' },
        { keys: ['0'], desc: 'Επαναφορά μεγέθους στο 100%' }
      ]
    },
    {
      category: 'Πλοήγηση & Μελέτη',
      icon: Eye,
      items: [
        { keys: ['/'], desc: 'Εστίαση στην αναζήτηση μαθημάτων' },
        { keys: ['V'], desc: 'Εναλλαγή διάταξης (50-50 / Εστίαση Σημειώσεων / Βίντεο)' },
        { keys: ['?'], desc: 'Άνοιγμα / Κλείσιμο αυτού του οδηγού συντομεύσεων' },
        { keys: ['Esc'], desc: 'Κλείσιμο παραθύρων & μενού' }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative overflow-hidden text-slate-100">
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Συντομεύσεις Πληκτρολογίου
              </h2>
              <p className="text-xs text-slate-400">
                Ελέγξτε τη μελέτη σας άμεσα χωρίς ποντίκι
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            aria-label="Κλείσιμο"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          {shortcuts.map((sec, idx) => {
            const Icon = sec.icon;
            return (
              <div key={idx} className="bg-slate-950/60 rounded-2xl p-3.5 border border-slate-800/80">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-2.5">
                  <Icon className="w-3.5 h-3.5" />
                  <span>{sec.category}</span>
                </div>
                <div className="space-y-2">
                  {sec.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="flex items-center justify-between text-xs gap-3">
                      <span className="text-slate-300">{item.desc}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((k, kIdx) => (
                          <kbd
                            key={kIdx}
                            className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 font-mono text-[11px] font-bold text-slate-200 shadow-sm"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>
            Πατήστε <kbd className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-slate-300">?</kbd> ανά πάσα στιγμή
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition cursor-pointer"
          >
            Κατάλαβα
          </button>
        </div>
      </div>
    </div>
  );
};
