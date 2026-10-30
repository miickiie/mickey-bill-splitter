import React from 'react';
import { Plus, Minus } from 'lucide-react';
import { Plates } from '../types';

export const SUSHIRO_PLATE_CONFIG = [
  { color: 'white' as const, emoji: '⚪️', label: '30' },
  { color: 'red' as const, emoji: '🔴', label: '40' },
  { color: 'silver' as const, emoji: '🔘', label: '60' },
  { color: 'gold' as const, emoji: '🟡', label: '80' },
  { color: 'black' as const, emoji: '⚫️', label: '100' },
] as const;

export interface SushiroPlateSelectorProps {
  plates?: Plates;
  onUpdatePlate: (color: keyof Plates, delta: number) => void;
  vibrate?: (pattern: number | number[]) => void;
}

export const SushiroPlateSelector: React.FC<SushiroPlateSelectorProps> = React.memo(({
  plates,
  onUpdatePlate,
  vibrate,
}) => {
  return (
    <div className="grid grid-cols-5 gap-2">
      {SUSHIRO_PLATE_CONFIG.map((p) => {
        const count = plates?.[p.color] || 0;
        return (
          <div key={p.color} className="flex flex-col items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{p.label}฿</span>
            <button
              type="button"
              onClick={() => {
                if (vibrate) {
                  if (p.color === 'black' || p.color === 'gold') {
                    vibrate([15, 30, 20]);
                  } else {
                    vibrate(10);
                  }
                }
                onUpdatePlate(p.color, 1);
              }}
              className="w-full aspect-square rounded-2xl bg-white/50 backdrop-blur-md border border-white flex items-center justify-center text-xl hover:bg-white hover:border-indigo-200 hover:shadow-sm active:scale-95 transition-all relative overflow-hidden group shadow-[0_2px_8px_rgba(0,0,0,0.02)] cursor-pointer"
              aria-label={`Add ${p.label}฿ plate`}
            >
              {p.emoji}
              <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus size={10} className="text-indigo-500" />
              </div>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (vibrate) vibrate(10);
                  onUpdatePlate(p.color, -1);
                }}
                disabled={count <= 0}
                className="w-5 h-5 rounded-full bg-white/60 border border-white flex items-center justify-center text-slate-500 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-colors shadow-sm disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                aria-label={`Remove ${p.label}฿ plate`}
              >
                <Minus size={10} />
              </button>
              <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 w-4 text-center tabular-nums">
                {count}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
});

SushiroPlateSelector.displayName = 'SushiroPlateSelector';
