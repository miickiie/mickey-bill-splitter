import { useState, useRef, useEffect, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelCat, CatExpression, CatVariant } from './PixelCat';

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
  vibrate?: (pattern: number | number[]) => void;
}

export function MascotPeeker({
  variant = 'food',
  className = '',
  isDarkMode,
  isScanning = false,
  vibrate,
}: MascotPeekerProps) {
  const { t, i18n } = useTranslation();
  const [popped, setPopped] = useState(false);
  const [expression, setExpression] = useState<CatExpression>('default');
  const [bubble, setBubble] = useState<string | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const autoDuckTimer = useRef<number | undefined>(undefined);

  const triggerReaction = (message: string, expr: CatExpression = 'happy') => {
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

  const isMountedRef = useRef(false);
  const prevVariantRef = useRef(variant);
  const prevDarkModeRef = useRef(isDarkMode);
  const prevLangRef = useRef(i18n.language);
  const prevScanningRef = useRef(isScanning);

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
        if (!popped && !isScanning) {
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
  }, [popped, isScanning]);

  function handleInteract(e?: MouseEvent) {
    if (isScanning) return;
    e?.stopPropagation();
    if (vibrate) vibrate(10);
    window.clearTimeout(autoDuckTimer.current);

    if (!popped) {
      setPopped(true);
      setExpression('happy');
      setBubble(t(PEEKER_QUOTES[quoteIndex % PEEKER_QUOTES.length]));
      setQuoteIndex((prev) => prev + 1);

      autoDuckTimer.current = window.setTimeout(() => {
        setPopped(false);
        setExpression('default');
        setBubble(null);
      }, 3500);
    } else {
      setExpression('wink');
      setBubble(t(PEEKER_QUOTES[quoteIndex % PEEKER_QUOTES.length]));
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
        className={`mascot-peeker-btn ${isScanning ? 'is-thinking' : popped ? 'is-popped' : 'is-loafing'}`}
        onClick={handleInteract}
        aria-label="Peeking pixel cat mascot. Tap to play peek-a-boo."
        title={isScanning ? t('detectiveScanning') : "Peek-a-boo! 🐾 Tap me!"}
      >
        <PixelCat
          size={36}
          expression={isScanning ? 'thinking' : expression}
          variant={variant}
          className={isScanning ? 'is-thinking' : ''}
        />
      </button>

      {bubble && (
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
