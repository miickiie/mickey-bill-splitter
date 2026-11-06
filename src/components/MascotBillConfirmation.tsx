import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface MascotBillConfirmationProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export function MascotBillConfirmation({ onCancel, onConfirm }: MascotBillConfirmationProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => { previousFocus?.focus(); };
  }, []);

  return (
    <div
      className="pixel-bubble mascot-peeker-bubble mascot-peeker-bubble-action"
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <p id={titleId} className="font-bold">{t('mascotClearBillTitle')}</p>
      <p id={descriptionId} className="mt-2 text-sm leading-relaxed">{t('mascotClearBillDescription')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          {t('mascotCancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
        >
          {t('mascotClearBillAction')}
        </button>
      </div>
    </div>
  );
}
