import { useState, useRef, useEffect, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelCat, CatExpression, CatVariant } from './PixelCat';
import type { PwaLifecycle } from '../hooks/usePwaLifecycle';
import { PwaMascotPrompt } from './PwaMascotPrompt';

const PEEKER_QUOTES = [
  'mascotPeekerQuote1',
  'mascotPeekerQuote2',
  'mascotPeekerQuote3',
  'mascotPeekerQuote4',
  'mascotPeekerQuote5',
];

const QR_PEEKER_QUOTES = [
  'qrCheerleader',
  'mascotPeekerQuote3',
  'mascotPeekerQuote4',
  'mascotPeekerQuote1',
  'mascotPeekerQuote5',
];

export interface MascotPeekerProps {
  variant?: CatVariant;
  className?: string;
  isDarkMode?: boolean;
  isScanning?: boolean;
  isQrView?: boolean;
  isQrCopied?: boolean;
  summaryCopyCount?: number;
  pwa?: PwaLifecycle;
  vibrate?: (pattern: number | number[]) => void;
}

export function MascotPeeker({
  variant = 'food',
  className = '',
  isDarkMode,
  isScanning = false,
  isQrView = false,
  isQrCopied = false,
  summaryCopyCount = 0,
  pwa,
  vibrate,
}: MascotPeekerProps) {
  const { t, i18n } = useTranslation();
  const [popped, setPopped] = useState(false);
  const [expression, setExpression] = useState<CatExpression>('default');
  const [bubble, setBubble] = useState<string | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const autoDuckTimer = useRef<number | undefined>(undefined);
  const hasPwaPrompt = Boolean(pwa?.updateAvailable || pwa?.installOffer);
  const showPopped = hasPwaPrompt || popped;

  useEffect(() => () => window.clearTimeout(autoDuckTimer.current), []);

  useEffect(() => {
    window.clearTimeout(autoDuckTimer.current);
    setPopped(false);
    setExpression('default');
    setBubble(null);
  }, [hasPwaPrompt]);

  const triggerReaction = (message: string, expr: CatExpression = 'happy', duration = 3500) => {
    if (hasPwaPrompt) return;
    window.clearTimeout(autoDuckTimer.current);
    setPopped(true);
    setExpression(expr);
    setBubble(message);

    autoDuckTimer.current = window.setTimeout(() => {
      setPopped(false);
      setExpression('default');
      setBubble(null);
    }, duration);
  };

  const isMountedRef = useRef(false);
  const prevVariantRef = useRef(variant);
  const prevDarkModeRef = useRef(isDarkMode);
  const prevLangRef = useRef(i18n.language);
  const prevScanningRef = useRef(isScanning);
  const prevQrViewRef = useRef(isQrView);
  const prevQrCopiedRef = useRef(isQrCopied);
  const prevSummaryCopyCountRef = useRef(summaryCopyCount);

  // React to every successful summary copy, including repeated taps.
  useEffect(() => {
    if (summaryCopyCount !== prevSummaryCopyCountRef.current) {
      prevSummaryCopyCountRef.current = summaryCopyCount;
      triggerReaction(t('mascotShareCopied'), 'happy', 5000);
    }
  }, [summaryCopyCount, t]);

  // React to navigating to QR view
  useEffect(() => {
    if (!isMountedRef.current) return;
    if (isQrView !== prevQrViewRef.current) {
      prevQrViewRef.current = isQrView;
      if (isQrView) {
        triggerReaction(t('qrCheerleader'), 'happy');
      }
    }
  }, [isQrView, t]);

  // React to copying/downloading QR code
  useEffect(() => {
    if (!isMountedRef.current) return;
    if (isQrCopied !== prevQrCopiedRef.current) {
      prevQrCopiedRef.current = isQrCopied;
      if (isQrCopied) {
        triggerReaction(t('qrCheerleaderSuccess'), 'happy');
      }
    }
  }, [isQrCopied, t]);

  // React to bill scanning state
  useEffect(() => {
    if (isScanning === prevScanningRef.current) return;
    prevScanningRef.current = isScanning;

    window.clearTimeout(autoDuckTimer.current);
    if (isScanning) {
      setPopped(true);
      setExpression('thinking');
      setBubble(t('detectiveScanning'));
    } else {
      setPopped(true);
      setExpression('happy');
      setBubble(t('detectiveFound'));
      autoDuckTimer.current = window.setTimeout(() => {
        setPopped(false);
        setExpression('default');
        setBubble(null);
      }, 3200);
    }
  }, [isScanning, t]);

  // React to mode (Sushiro), theme (Dark/Light), or language change
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }

    if (isScanning) return;

    if (variant !== prevVariantRef.current) {
      prevVariantRef.current = variant;
      const msg = variant === 'sushiro' ? t('mascotReactionSushiroOn') : t('mascotReactionSushiroOff');
      triggerReaction(msg, 'happy');
      return;
    }

    if (isDarkMode !== prevDarkModeRef.current) {
      prevDarkModeRef.current = isDarkMode;
      const msg = isDarkMode ? t('mascotReactionDarkMode') : t('mascotReactionLightMode');
      triggerReaction(msg, 'wink');
      return;
    }

    if (i18n.language !== prevLangRef.current) {
      prevLangRef.current = i18n.language;
      const msg = i18n.language === 'en' ? t('mascotReactionLangEn') : t('mascotReactionLangTh');
      triggerReaction(msg, 'happy');
      return;
    }
  }, [variant, isDarkMode, i18n.language, isScanning, t]);

  // Subtle periodic ear twitch / blink when loafing every 3–5 seconds
  useEffect(() => {
    let timer: number | undefined;
    let blinkEndTimer: number | undefined;

    const scheduleNextBlink = () => {
      // Random interval between 3000ms and 5000ms (3–5 seconds)
      const nextDelay = Math.floor(Math.random() * 2000) + 3000;
      timer = window.setTimeout(() => {
        if (!showPopped && !isScanning) {
          setExpression('blink');
          blinkEndTimer = window.setTimeout(() => {
            setExpression('default');
            scheduleNextBlink();
          }, 200);
        } else {
          scheduleNextBlink();
        }
      }, nextDelay);
    };

    scheduleNextBlink();

    return () => {
      if (timer) window.clearTimeout(timer);
      if (blinkEndTimer) window.clearTimeout(blinkEndTimer);
    };
  }, [showPopped, isScanning]);

  function handleInteract(e?: MouseEvent) {
    if (hasPwaPrompt) return;
    if (isScanning) return;
    e?.stopPropagation();
    if (vibrate) vibrate(10);
    window.clearTimeout(autoDuckTimer.current);

    const activeQuotes = isQrView ? QR_PEEKER_QUOTES : PEEKER_QUOTES;

    if (!popped) {
      setPopped(true);
      setExpression('happy');
      setBubble(t(activeQuotes[quoteIndex % activeQuotes.length]));
      setQuoteIndex((prev) => prev + 1);

      autoDuckTimer.current = window.setTimeout(() => {
        setPopped(false);
        setExpression('default');
        setBubble(null);
      }, 3500);
    } else {
      setExpression('wink');
      setBubble(t(activeQuotes[quoteIndex % activeQuotes.length]));
      setQuoteIndex((prev) => prev + 1);

      autoDuckTimer.current = window.setTimeout(() => {
        setPopped(false);
        setExpression('default');
        setBubble(null);
      }, 3500);
    }
  }

  return (
    <div className={`mascot-peeker-footer ${className}`}>
      <button
        type="button"
        className={`mascot-peeker-btn ${isScanning ? 'is-thinking' : showPopped ? 'is-popped' : 'is-loafing'}`}
        onClick={handleInteract}
        aria-label="Peeking pixel cat mascot. Tap to play peek-a-boo."
        title={isScanning ? t('detectiveScanning') : "Peek-a-boo! 🐾 Tap me!"}
      >
        <PixelCat
          size={36}
          expression={isScanning ? 'thinking' : hasPwaPrompt ? 'happy' : expression}
          variant={variant}
          celebrating={isQrCopied}
          className={isScanning ? 'is-thinking' : ''}
        />
      </button>

      {hasPwaPrompt && pwa ? <PwaMascotPrompt pwa={pwa} /> : bubble && (
        <div
          className="pixel-bubble mascot-peeker-bubble"
          role="status"
          aria-live="polite"
        >
          {bubble}
        </div>
      )}
    </div>
  );
}

export default MascotPeeker;
