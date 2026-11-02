import { useState, useRef, useEffect, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelCat, CatExpression, CatVariant } from './PixelCat';
import type { PwaLifecycle } from '../hooks/usePwaLifecycle';
import type { MascotNotice } from '../hooks/useMascotNotifications';
import { PwaMascotPrompt } from './PwaMascotPrompt';
import { MascotBillConfirmation, type MascotBillConfirmationProps } from './MascotBillConfirmation';
import { MascotErrorBubble } from './MascotNotice';

const PEEKER_QUOTES = [
  'mascotPeekerQuote1',
  'mascotPeekerQuote2',
  'mascotPeekerQuote3',
  'mascotPeekerQuote4',
  'mascotPeekerQuote5',
];

export interface MascotPeekerProps {
  variant?: CatVariant;
  className?: string;
  isDarkMode?: boolean;
  isScanning?: boolean;
  qrReady?: boolean;
  qrIssueKey?: string | null;
  pwa?: PwaLifecycle;
  notice?: MascotNotice;
  onDismissNotice?: (id: number) => void;
  clearConfirmation?: MascotBillConfirmationProps;
  vibrate?: (pattern: number | number[]) => void;
}

export function MascotPeeker({
  variant = 'food',
  className = '',
  isDarkMode,
  isScanning = false,
  qrReady = false,
  qrIssueKey,
  pwa,
  notice,
  onDismissNotice,
  clearConfirmation,
  vibrate,
}: MascotPeekerProps) {
  const { t, i18n } = useTranslation();
  const [popped, setPopped] = useState(false);
  const [expression, setExpression] = useState<CatExpression>('default');
  const [bubble, setBubble] = useState<string | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const autoDuckTimer = useRef<number | undefined>(undefined);
  const hasPwaPrompt = Boolean(pwa?.updateAvailable || pwa?.installOffer);
  const hasPrioritySpeech = Boolean(clearConfirmation || notice || isScanning || hasPwaPrompt || qrIssueKey);
  const showPopped = hasPrioritySpeech || popped;
  const displayedNoticeId = notice && !clearConfirmation && (notice.tone === 'error' || (!isScanning && !hasPwaPrompt))
    ? notice.id : null;

  useEffect(() => () => window.clearTimeout(autoDuckTimer.current), []);

  // Action prompts and explicit operation results never use the playful speech timer.
  useEffect(() => {
    window.clearTimeout(autoDuckTimer.current);
    setPopped(false);
    setExpression('default');
    setBubble(null);
  }, [hasPrioritySpeech]);

  const triggerReaction = (message: string, expr: CatExpression = 'happy') => {
    if (hasPrioritySpeech) return;
    window.clearTimeout(autoDuckTimer.current);
    setPopped(true);
    setExpression(expr);
    setBubble(message);
    autoDuckTimer.current = window.setTimeout(() => {
      setPopped(false);
      setExpression('default');
      setBubble(null);
    }, 3500);
  };

  const previousQrReady = useRef(qrReady);
  useEffect(() => {
    const becameReady = qrReady && !previousQrReady.current;
    previousQrReady.current = qrReady;
    if (becameReady) triggerReaction(t('qrCheerleader'));
  }, [qrReady, t]);

  const previousAppearance = useRef({ variant, isDarkMode, language: i18n.language });
  useEffect(() => {
    const previous = previousAppearance.current;
    previousAppearance.current = { variant, isDarkMode, language: i18n.language };
    if (variant !== previous.variant) {
      triggerReaction(t(variant === 'sushiro' ? 'mascotReactionSushiroOn' : 'mascotReactionSushiroOff'));
    } else if (isDarkMode !== previous.isDarkMode) {
      triggerReaction(t(isDarkMode ? 'mascotReactionDarkMode' : 'mascotReactionLightMode'), 'wink');
    } else if (i18n.language !== previous.language) {
      triggerReaction(t(i18n.language === 'en' ? 'mascotReactionLangEn' : 'mascotReactionLangTh'));
    }
  }, [variant, isDarkMode, i18n.language, t]);

  useEffect(() => {
    let timer: number | undefined;
    let blinkEndTimer: number | undefined;
    const scheduleNextBlink = () => {
      timer = window.setTimeout(() => {
        if (!showPopped) {
          setExpression('blink');
          blinkEndTimer = window.setTimeout(() => {
            setExpression('default');
            scheduleNextBlink();
          }, 200);
        } else {
          scheduleNextBlink();
        }
      }, Math.floor(Math.random() * 2000) + 3000);
    };
    scheduleNextBlink();
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(blinkEndTimer);
    };
  }, [showPopped]);

  function handleInteract(event?: MouseEvent) {
    event?.stopPropagation();
    if (hasPrioritySpeech) return;
    vibrate?.(10);
    triggerReaction(t(PEEKER_QUOTES[quoteIndex % PEEKER_QUOTES.length]), popped ? 'wink' : 'happy');
    setQuoteIndex(index => index + 1);
  }

  const spokenText = isScanning
    ? t('detectiveScanning')
    : notice ? t(notice.messageKey, notice.values)
      : qrIssueKey ? t(qrIssueKey) : bubble;

  return (
    <div className={`mascot-peeker-footer ${className}`}>
      <button
        type="button"
        className={`mascot-peeker-btn ${isScanning ? 'is-thinking' : showPopped ? 'is-popped' : 'is-loafing'}`}
        onClick={handleInteract}
        aria-label={t('mascotLabel')}
        title={hasPrioritySpeech ? undefined : 'Peek-a-boo! 🐾'}
      >
        <PixelCat
          size={36}
          expression={isScanning || notice?.tone === 'error' ? 'thinking' : hasPrioritySpeech ? 'happy' : expression}
          variant={variant}
          celebrating={notice?.tone === 'success' && displayedNoticeId !== null}
          className={isScanning ? 'is-thinking' : ''}
        />
      </button>
      {clearConfirmation ? (
        <MascotBillConfirmation {...clearConfirmation} />
      ) : notice?.tone === 'error' ? (
        <MascotErrorBubble notice={notice} onDismiss={() => onDismissNotice?.(notice.id)} />
      ) : isScanning ? (
        <div className="pixel-bubble mascot-peeker-bubble" role="status" aria-live="polite">{t('detectiveScanning')}</div>
      ) : hasPwaPrompt && pwa ? (
        <PwaMascotPrompt pwa={pwa} />
      ) : spokenText && (
        <div
          id={qrIssueKey && !notice ? 'mascot-qr-validation' : undefined}
          className="pixel-bubble mascot-peeker-bubble"
          role="status"
          aria-live="polite"
        >
          {spokenText}
        </div>
      )}
    </div>
  );
}

export default MascotPeeker;
