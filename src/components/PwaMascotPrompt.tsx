import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { PwaLifecycle } from '../hooks/usePwaLifecycle';

interface PwaMascotPromptProps {
  pwa: PwaLifecycle;
  vibrate?: (pattern: number | number[]) => void;
}

export function PwaMascotPrompt({ pwa, vibrate }: PwaMascotPromptProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const isUpdate = pwa.updateAvailable;

  if (!isUpdate && !pwa.installOffer) return null;

  const description = isUpdate
    ? 'updateAvailableDesc'
    : pwa.installOffer === 'ios' ? 'installIosDesc' : 'installAppDesc';
  const primaryLabel = !isUpdate
    ? 'installApp'
    : pwa.updateInProgress ? 'updatingApp' : pwa.updateError ? 'retryUpdate' : 'refreshApp';

  return (
    <div
      className="pixel-bubble mascot-peeker-bubble mascot-peeker-bubble-action"
      role="group"
      aria-labelledby={titleId}
    >
      <div className="max-h-[calc(100dvh-240px)] overflow-y-auto">
        <div aria-live="polite" aria-atomic="true">
          <p id={titleId} className="font-bold">{t(isUpdate ? 'updateAvailable' : 'installApp')}</p>
          <p className="mt-2 text-sm leading-relaxed">{t(description)}</p>
          {isUpdate && pwa.updateError && (
            <p className="mt-2 text-sm font-semibold text-rose-600 dark:text-rose-300" role="alert">
              {t('updateFailed')}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(isUpdate || pwa.installOffer === 'native') && (
          <button
            type="button"
            onClick={() => {
              vibrate?.(10);
              void (isUpdate ? pwa.applyUpdate() : pwa.requestInstall());
            }}
            disabled={isUpdate && pwa.updateInProgress}
            className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-wait disabled:opacity-60"
          >
            {t(primaryLabel)}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            vibrate?.(10);
            (isUpdate ? pwa.dismissUpdate : pwa.dismissInstall)();
          }}
          disabled={isUpdate && pwa.updateInProgress}
          aria-label={isUpdate ? undefined : t('dismissInstallApp')}
          className="rounded-xl border border-current px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-wait disabled:opacity-60"
        >
          {t('later')}
        </button>
      </div>
    </div>
  );
}
