import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Item } from '../types';

export interface ItemRowProps {
  item: Item;
  placeholderName: string;
  onUpdate: (updates: Partial<Item>) => void;
  onRemove: () => void;
  onOpenKeypad: (id: string, title: string, price: number) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  keypadId: string;
  keypadTitle: string;
  vibrate?: (pattern: number | number[]) => void;
  isShared?: boolean;
}

export const ItemRow: React.FC<ItemRowProps> = React.memo(({
  item,
  placeholderName,
  onUpdate,
  onRemove,
  onOpenKeypad,
  isExpanded,
  onToggleExpanded,
  keypadId,
  keypadTitle,
  vibrate,
  isShared = false,
}) => {
  const { t } = useTranslation();

  const handleOpenKeypad = () => {
    onOpenKeypad(keypadId, keypadTitle, item.price || 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpenKeypad();
    }
  };

  return (
    <motion.div
      layout
      transition={{ duration: 0.2, ease: 'easeOut' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      className={`flex flex-col gap-2 transition-all ${
        isShared
          ? 'p-1'
          : 'bg-white/40 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-3 rounded-[1.25rem] group/item border border-white/50 focus-within:bg-white/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)]'
      }`}
    >
      <div className="flex items-center gap-2 sm:gap-3 w-full">
        <input
          type="text"
          value={item.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className={`flex-1 min-w-0 text-base font-semibold text-slate-900 placeholder:text-slate-400 ${
            isShared
              ? 'glass-input rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500'
              : 'bg-transparent border-none focus:ring-0 p-0'
          }`}
          placeholder={placeholderName}
        />
        <div className="relative shrink-0">
          <input
            type="text"
            readOnly
            value={item.price ? String(item.price) : ''}
            onClick={handleOpenKeypad}
            onKeyDown={handleKeyDown}
            className="w-20 sm:w-24 text-base font-extrabold glass-input rounded-xl px-2 sm:px-3 py-2 text-right text-slate-900 focus:scale-[1.03] transition-transform cursor-pointer"
            placeholder="0"
            title={t('enterAmount')}
            aria-label={`${item.name || placeholderName} ${t('enterAmount')}`}
          />
          <span className="absolute -left-3 sm:-left-3.5 top-1/2 -translate-y-1/2 text-sm text-indigo-500 font-extrabold pointer-events-none">
            ฿
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            if (vibrate) vibrate(10);
            onToggleExpanded();
          }}
          className={`p-1 sm:p-1.5 transition-colors shrink-0 rounded-xl cursor-pointer ${
            isExpanded
              ? 'bg-indigo-100 text-indigo-600'
              : 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-50'
          }`}
          aria-label={t('globalSettings')}
          title={t('globalSettings')}
        >
          <SlidersHorizontal size={18} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (vibrate) vibrate([20, 50, 20]);
            onRemove();
          }}
          className="p-1 sm:p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shrink-0 cursor-pointer"
          aria-label={t('clear')}
          title={t('clear')}
        >
          <X size={18} />
        </button>
      </div>

      {/* Expanded item options */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 pt-1 pb-1 overflow-x-auto hide-scrollbar"
          >
            <button
              type="button"
              onClick={() => {
                if (vibrate) vibrate(10);
                onUpdate({ excludeDiscount: !item.excludeDiscount });
              }}
              className={`px-2.5 py-1 text-sm font-bold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                !item.excludeDiscount
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-100 text-slate-400 line-through'
              }`}
            >
              {!item.excludeDiscount && <Check size={12} />}
              {t('discount')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (vibrate) vibrate(10);
                onUpdate({ excludeServiceCharge: !item.excludeServiceCharge });
              }}
              className={`px-2.5 py-1 text-sm font-bold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                !item.excludeServiceCharge
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-100 text-slate-400 line-through'
              }`}
            >
              {!item.excludeServiceCharge && <Check size={12} />}
              {t('serviceCharge')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (vibrate) vibrate(10);
                onUpdate({ excludeVat: !item.excludeVat });
              }}
              className={`px-2.5 py-1 text-sm font-bold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                !item.excludeVat
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-100 text-slate-400 line-through'
              }`}
            >
              {!item.excludeVat && <Check size={12} />}
              {t('vat')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

ItemRow.displayName = 'ItemRow';
