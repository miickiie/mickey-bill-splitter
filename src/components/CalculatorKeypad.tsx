import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Delete, X, Check, Calculator } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  evaluateExpression,
  appendKeyToExpression,
  backspaceExpression,
} from '../calculator';
import { KeypadMascot } from './KeypadMascot';
import type { CatVariant } from './PixelCat';

const PERCENT_PRESETS = [0, 7, 10, 15];
const AMOUNT_PRESETS = [10, 50, 100];

export interface CalculatorKeypadProps {
  isOpen: boolean;
  title: string;
  initialValue: number;
  unit?: '฿' | '%';
  max?: number;
  variant?: CatVariant;
  onConfirm: (value: number) => void;
  onClose: () => void;
  vibrate?: (pattern: number | number[]) => void;
}

export function CalculatorKeypad({
  isOpen,
  title,
  initialValue,
  unit = '฿',
  max = Number.POSITIVE_INFINITY,
  variant = 'food',
  onConfirm,
  onClose,
  vibrate,
}: CalculatorKeypadProps) {
  const { t } = useTranslation();
  const [expression, setExpression] = useState<string>('0');
  const [hasUserTyped, setHasUserTyped] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const displayRef = useRef<HTMLDivElement>(null);

  // Reset or initialize when opened
  useEffect(() => {
    if (isOpen) {
      const initialStr = initialValue > 0 ? String(initialValue) : '0';
      setExpression(initialStr);
      setHasUserTyped(false);
    }
  }, [isOpen, initialValue]);

  // Keep display scrolled to the end as user enters numbers/operators
  useEffect(() => {
    if (displayRef.current) {
      displayRef.current.scrollLeft = displayRef.current.scrollWidth;
    }
  }, [expression]);

  const handleVibrate = useCallback(() => {
    if (vibrate) {
      vibrate(10);
    }
  }, [vibrate]);

  const evaluatedValue = useMemo(() => {
    const raw = evaluateExpression(expression);
    return Math.min(raw, max);
  }, [expression, max]);

  const hasOperators = useMemo(() => {
    return /[\+\-\×\÷]/.test(expression);
  }, [expression]);

  const handleKeyPress = useCallback((key: string) => {
    handleVibrate();
    if (!hasUserTyped) {
      setHasUserTyped(true);
      if (/^[0-9]$/.test(key)) {
        setExpression(key);
        return;
      }
      if (key === '.') {
        setExpression('0.');
        return;
      }
    }
    setExpression((prev) => appendKeyToExpression(prev, key));
  }, [handleVibrate, hasUserTyped]);

  const handleBackspace = useCallback(() => {
    handleVibrate();
    setHasUserTyped(true);
    setExpression((prev) => backspaceExpression(prev));
  }, [handleVibrate]);

  const handleClear = useCallback(() => {
    handleVibrate();
    setHasUserTyped(true);
    setExpression('0');
  }, [handleVibrate]);

  const handleConfirm = useCallback(() => {
    handleVibrate();
    setIsConfirming(true);
    window.setTimeout(() => {
      onConfirm(evaluatedValue);
      onClose();
      setIsConfirming(false);
    }, 180);
  }, [handleVibrate, evaluatedValue, onConfirm, onClose]);

  // Keyboard navigation on desktop
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        handleKeyPress('.');
      } else if (e.key === '+' || e.key === '-') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === '*' || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        handleKeyPress('×');
      } else if (e.key === '/') {
        e.preventDefault();
        handleKeyPress('÷');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Delete' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyPress, handleBackspace, handleClear, handleConfirm, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 select-none"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%', opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="w-full sm:max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t sm:border border-white/80 dark:border-slate-800 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-5 sm:p-6 shadow-2xl dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] text-slate-900 dark:text-slate-100 space-y-4 relative overflow-hidden transition-colors duration-200"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title || t('enterAmount')}
          >
            {/* Top pill, mascot buddy and close action */}
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100/80 dark:border-indigo-900/50 text-xs font-bold text-indigo-700 dark:text-indigo-300 shadow-sm max-w-[65%] truncate">
                <Calculator size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="truncate">{title || t('enterAmount')}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <KeypadMascot
                  expression={expression}
                  evaluatedValue={evaluatedValue}
                  hasUserTyped={hasUserTyped}
                  variant={variant}
                  isConfirming={isConfirming}
                  vibrate={vibrate}
                />
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  aria-label={t('cancel')}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Large Amount Display */}
            <div className="pt-2 pb-1">
              <div
                ref={displayRef}
                className="flex items-baseline gap-2 overflow-x-auto scrollbar-none py-1 scroll-smooth h-14 sm:h-16 items-center"
              >
                {unit === '฿' && (
                  <span className="text-3xl sm:text-4xl font-extrabold text-indigo-600 dark:text-indigo-400 shrink-0">
                    ฿
                  </span>
                )}
                <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums whitespace-nowrap">
                  {expression}
                </span>
                <span className="text-sm sm:text-base font-bold text-slate-400 dark:text-slate-500 self-end mb-1 shrink-0">
                  {unit === '฿' ? 'THB' : '%'}
                </span>
              </div>

              {/* Fixed-height sub-result slot to eliminate any layout shift (CLS) */}
              <div className="h-6 mt-1 flex items-center tabular-nums">
                {hasOperators ? (
                  <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 transition-opacity duration-150">
                    <span className="text-slate-400 dark:text-slate-500 font-normal">=</span>
                    <span>
                      {unit === '฿' ? '฿' : ''}
                      {evaluatedValue.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                      {unit === '%' ? '%' : ''}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-slate-400/80 dark:text-slate-500/80 tracking-wide select-none">
                    {t('enterAmount')}
                  </span>
                )}
              </div>
            </div>

            {/* Subheader: Presets & Clear */}
            <div className="flex items-center justify-between border-t border-slate-200/80 dark:border-slate-800 pt-3 gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                {unit === '%' ? (
                  PERCENT_PRESETS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        handleVibrate();
                        setHasUserTyped(true);
                        setExpression(String(pct));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 dark:bg-slate-800 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-300 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 active:scale-95 text-xs font-bold transition-all cursor-pointer"
                    >
                      {pct}%
                    </button>
                  ))
                ) : (
                  AMOUNT_PRESETS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        handleVibrate();
                        setHasUserTyped(true);
                        setExpression((prev) => {
                          const trimmed = prev.trim();
                          if (trimmed === '0' || !trimmed) {
                            return String(amt);
                          }
                          const lastChar = trimmed[trimmed.length - 1];
                          if (['+', '-', '×', '÷'].includes(lastChar)) {
                            return `${trimmed} ${amt}`;
                          }
                          return `${trimmed} + ${amt}`;
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 dark:bg-slate-800 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-300 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 active:scale-95 text-xs font-bold transition-all cursor-pointer"
                    >
                      +{amt}
                    </button>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors uppercase tracking-wider px-2.5 py-1 rounded-lg cursor-pointer shrink-0"
              >
                {t('clearKeypad')}
              </button>
            </div>

            {/* 4x4 Keypad Grid */}
            <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
              {/* Row 1 */}
              <button
                type="button"
                onClick={() => handleKeyPress('1')}
                className="h-14 sm:h-16 rounded-2xl bg-slate-50 hover:bg-white text-slate-800 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700/60 shadow-xs active:scale-95 text-2xl font-semibold flex items-center justify-center transition-all cursor-pointer"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('2')}
                className="h-14 sm:h-16 rounded-2xl bg-slate-50 hover:bg-white text-slate-800 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700/60 shadow-xs active:scale-95 text-2xl font-semibold flex items-center justify-center transition-all cursor-pointer"
              >
                2
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('3')}
                className="h-14 sm:h-16 rounded-2xl bg-slate-50 hover:bg-white text-slate-800 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700/60 shadow-xs active:scale-95 text-2xl font-semibold flex items-center justify-center transition-all cursor-pointer"
              >
                3
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('÷')}
                className="h-14 sm:h-16 rounded-2xl bg-indigo-50/80 hover:bg-indigo-100/80 text-indigo-600 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-100/80 dark:border-indigo-900/50 shadow-xs active:scale-95 font-bold text-3xl flex items-center justify-center transition-all cursor-pointer"
              >
                ÷
              </button>

              {/* Row 2 */}
              <button
                type="button"
                onClick={() => handleKeyPress('4')}
                className="h-14 sm:h-16 rounded-2xl bg-slate-50 hover:bg-white text-slate-800 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700/60 shadow-xs active:scale-95 text-2xl font-semibold flex items-center justify-center transition-all cursor-pointer"
              >
                4
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('5')}
                className="h-14 sm:h-16 rounded-2xl bg-slate-50 hover:bg-white text-slate-800 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700/60 shadow-xs active:scale-95 text-2xl font-semibold flex items-center justify-center transition-all cursor-pointer"
              >
                5
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('6')}
                className="h-14 sm:h-16 rounded-2xl bg-slate-50 hover:bg-white text-slate-800 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700/60 shadow-xs active:scale-95 text-2xl font-semibold flex items-center justify-center transition-all cursor-pointer"
              >
                6
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('×')}
                className="h-14 sm:h-16 rounded-2xl bg-indigo-50/80 hover:bg-indigo-100/80 text-indigo-600 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-100/80 dark:border-indigo-900/50 shadow-xs active:scale-95 font-bold text-2xl flex items-center justify-center transition-all cursor-pointer"
              >
                ×
              </button>

              {/* Row 3 */}
              <button
                type="button"
                onClick={() => handleKeyPress('7')}
                className="h-14 sm:h-16 rounded-2xl bg-slate-50 hover:bg-white text-slate-800 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700/60 shadow-xs active:scale-95 text-2xl font-semibold flex items-center justify-center transition-all cursor-pointer"
              >
                7
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('8')}
                className="h-14 sm:h-16 rounded-2xl bg-slate-50 hover:bg-white text-slate-800 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700/60 shadow-xs active:scale-95 text-2xl font-semibold flex items-center justify-center transition-all cursor-pointer"
              >
                8
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('9')}
                className="h-14 sm:h-16 rounded-2xl bg-slate-50 hover:bg-white text-slate-800 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700/60 shadow-xs active:scale-95 text-2xl font-semibold flex items-center justify-center transition-all cursor-pointer"
              >
                9
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('-')}
                className="h-14 sm:h-16 rounded-2xl bg-indigo-50/80 hover:bg-indigo-100/80 text-indigo-600 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-100/80 dark:border-indigo-900/50 shadow-xs active:scale-95 font-bold text-3xl flex items-center justify-center transition-all cursor-pointer"
              >
                -
              </button>

              {/* Row 4 */}
              <button
                type="button"
                onClick={() => handleKeyPress('.')}
                className="h-14 sm:h-16 rounded-2xl bg-slate-50 hover:bg-white text-slate-800 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700/60 shadow-xs active:scale-95 text-3xl font-extrabold flex items-center justify-center transition-all cursor-pointer"
              >
                .
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                className="h-14 sm:h-16 rounded-2xl bg-slate-50 hover:bg-white text-slate-800 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700/60 shadow-xs active:scale-95 text-2xl font-semibold flex items-center justify-center transition-all cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="h-14 sm:h-16 rounded-2xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 dark:bg-slate-800/90 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/60 shadow-xs active:scale-95 flex items-center justify-center transition-all cursor-pointer"
                aria-label="Backspace"
              >
                <Delete size={22} />
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('+')}
                className="h-14 sm:h-16 rounded-2xl bg-indigo-50/80 hover:bg-indigo-100/80 text-indigo-600 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-100/80 dark:border-indigo-900/50 shadow-xs active:scale-95 font-bold text-2xl flex items-center justify-center transition-all cursor-pointer"
              >
                +
              </button>
            </div>

            {/* Bottom Confirm Action */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleConfirm}
                className="w-full py-3.5 sm:py-4 rounded-2xl vibrant-gradient-light hover:opacity-95 active:scale-[0.98] text-white font-extrabold text-base tracking-wider uppercase transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check size={20} strokeWidth={3} />
                <span>
                  {t('done')} (
                  {unit === '฿' ? '฿' : ''}
                  {evaluatedValue.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                  {unit === '%' ? '%' : ''}
                  )
                </span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
