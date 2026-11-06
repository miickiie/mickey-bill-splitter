import { useTranslation } from 'react-i18next';
import type { MascotNotice } from '../hooks/useMascotNotifications';

export function MascotErrorBubble({ notice, onDismiss }: { notice: MascotNotice; onDismiss: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="pixel-bubble mascot-peeker-bubble mascot-peeker-bubble-action">
      <p role="alert">{t(notice.messageKey, notice.values)}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 rounded-xl border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        {t('mascotAcknowledge')}
      </button>
    </div>
  );
}
