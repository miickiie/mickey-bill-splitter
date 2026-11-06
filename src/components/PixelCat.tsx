import { useEffect, useRef, type CSSProperties } from 'react';

export type { CatExpression, CatVariant } from '../pixelCatDataUrl';
export { getPixelCatDataUrl } from '../pixelCatDataUrl';
import type { CatExpression, CatVariant } from '../pixelCatDataUrl';

export interface PixelCatProps {
  size?: number;
  expression?: CatExpression;
  variant?: CatVariant;
  celebrating?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  title?: string;
}

function useCatGaze() {
  const catRef = useRef<SVGSVGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const cat = catRef.current;
    const eyes = eyesRef.current;
    if (!cat || !eyes) return;

    let point: { x: number; y: number } | null = null;
    let target: Element | null = null;
    let frame: number | null = null;
    let inputMethod = '';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const setTransition = () => {
      eyes.style.transition = reducedMotion.matches ? 'none' : 'transform 100ms ease-out';
    };
    setTransition();

    const update = () => {
      frame = null;
      if (target?.isConnected) {
        const bounds = target.getBoundingClientRect();
        point = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
      }

      const bounds = cat.getBoundingClientRect();
      if (!point || !bounds.width || !bounds.height) {
        eyes.style.transform = 'translate(0px, 0px)';
        return;
      }

      // Work in the cat's 16x12 grid and keep the eyes inside its face.
      const dx = ((point.x - bounds.left) / bounds.width) * 16 - 8;
      const dy = ((point.y - bounds.top) / bounds.height) * 12 - 6;
      const distance = Math.max(8, Math.hypot(dx, dy));
      eyes.style.transform = `translate(${(dx / distance) * 0.75}px, ${(dy / distance) * 0.5}px)`;
    };
    const scheduleUpdate = () => {
      if (frame === null) frame = window.requestAnimationFrame(update);
    };
    const followPointer = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !event.isPrimary) return;
      inputMethod = 'mouse';
      target = null;
      point = { x: event.clientX, y: event.clientY };
      scheduleUpdate();
    };
    const followInteraction = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      inputMethod = event.pointerType;
      if (event.pointerType === 'mouse') {
        followPointer(event);
        return;
      }
      target = event.target instanceof Element
        ? event.target.closest('button, input, textarea, select, a, [role="button"], [contenteditable="true"]')
        : null;
      point = { x: event.clientX, y: event.clientY };
      scheduleUpdate();
    };
    const followFocus = (event: FocusEvent) => {
      if (inputMethod === 'mouse' || !(event.target instanceof Element)) return;
      target = event.target;
      scheduleUpdate();
    };
    const useKeyboard = () => {
      inputMethod = 'keyboard';
    };
    const reset = () => {
      target = null;
      point = null;
      scheduleUpdate();
    };
    const leave = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') reset();
    };

    document.addEventListener('pointermove', followPointer, { passive: true });
    document.addEventListener('pointerdown', followInteraction, { passive: true });
    document.addEventListener('focusin', followFocus);
    document.addEventListener('keydown', useKeyboard);
    document.addEventListener('pointerleave', leave);
    document.addEventListener('scroll', scheduleUpdate, { passive: true, capture: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('blur', reset);
    reducedMotion.addEventListener('change', setTransition);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', followPointer);
      document.removeEventListener('pointerdown', followInteraction);
      document.removeEventListener('focusin', followFocus);
      document.removeEventListener('keydown', useKeyboard);
      document.removeEventListener('pointerleave', leave);
      document.removeEventListener('scroll', scheduleUpdate, true);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('blur', reset);
      reducedMotion.removeEventListener('change', setTransition);
    };
  }, []);

  return { catRef, eyesRef };
}

/**
 * PixelCat: Fluffy, rounded kawaii pixel-art cat companion for Spliittrr.
 * 16x12 pixel grid SVG.
 * Supports Foodie (Option A) and Sushiro Chef (Option C) variants.
 */
export function PixelCat({
  size = 40,
  expression = 'default',
  variant = 'food',
  celebrating = false,
  className = '',
  style,
  onClick,
  title = 'Spliittrr cat companion',
}: PixelCatProps) {
  const { catRef, eyesRef } = useCatGaze();
  const currentExpression: CatExpression = celebrating ? 'happy' : expression;
  const gridHeight = 12;
  const eyeY = currentExpression === 'thinking' ? 4
    : currentExpression === 'blink' || currentExpression === 'lookDown' ? 6 : 5;
  const eyeHeight = currentExpression === 'blink' ? 1 : 2;
  const eyeOffset = currentExpression === 'thinking' ? 1 : 0;

  // Palette
  const outline = '#475569';
  const face = '#faf8f5';
  const innerEar = '#f472b6';
  const nose = '#fb7185';
  const blush = '#fbcfe8';
  const eye = '#1e293b';
  const openMouth = '#f43f5e';
  const sushiSalmon = '#f97316';
  const sushiRice = '#ffffff';
  const sushiNori = '#1e293b';
  const headbandRed = '#e11d48';

  return (
    <svg
      ref={catRef}
      viewBox={`0 0 16 ${gridHeight}`}
      width={size}
      height={(size * gridHeight) / 16}
      className={`pixel-cat-svg ${celebrating ? 'is-celebrating' : ''} ${currentExpression === 'thinking' ? 'is-thinking' : ''} ${currentExpression === 'shocked' ? 'is-shocked' : ''} ${className}`}
      shapeRendering="geometricPrecision"
      style={{
        overflow: 'visible',
        ...style,
      }}
      onClick={onClick}
      role={onClick ? 'button' : 'img'}
      tabIndex={onClick ? 0 : undefined}
      aria-label={title}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      {/* Continuous fills avoid seams between pixel rows during transforms. */}
      <path
        d="M2 0H4V1H5V2H11V1H12V0H14V1H15V4H16V9H15V10H14V11H13V12H3V11H2V10H1V9H0V4H1V1H2Z"
        fill={outline}
      />
      <path
        d="M2 1H4V2H5V3H11V2H12V1H14V4H15V9H14V10H13V11H3V10H2V9H1V4H2Z"
        fill={face}
      />
      <path d="M3 1H4V2H5V3H3Z M12 1H13V3H11V2H12Z" fill={innerEar} />

      {variant === 'sushiro' && (
        <>
          <rect x="6" y="0" width="4" height="2" fill={sushiRice} />
          <rect x="6" y="0" width="4" height="1" fill={sushiSalmon} />
          <rect x="7" y="0" width="1" height="1" fill="#fed7aa" />
          <rect x="8" y="0" width="1" height="2" fill={sushiNori} />
          <rect x="2" y="3" width="12" height="1" fill={sushiRice} />
          <rect x="7" y="3" width="2" height="2" fill={headbandRed} />
        </>
      )}

      <rect x="7" y="7" width="2" height="1" fill={nose} />
      <rect x="1" y="8" width="2" height="1" fill={blush} />
      <rect x="13" y="8" width="2" height="1" fill={blush} />
      {(celebrating || currentExpression === 'shocked') && (
        <rect x="7" y="8" width="2" height={currentExpression === 'shocked' ? 2 : 1} fill={openMouth} />
      )}

      {/* Keep eye movement independent from the mascot's body animations. */}
      <g ref={eyesRef} className="pixel-cat-eyes" fill={eye}>
        {currentExpression === 'happy' ? (
          <>
            <rect x="3" y="5" width="2" height="1" />
            <rect x="11" y="5" width="2" height="1" />
            <rect x="2" y="6" width="1" height="1" />
            <rect x="5" y="6" width="1" height="1" />
            <rect x="10" y="6" width="1" height="1" />
            <rect x="13" y="6" width="1" height="1" />
          </>
        ) : (
          <>
            <rect x={3 + eyeOffset} y={eyeY} width="2" height={eyeHeight} />
            <rect x={11 + eyeOffset} y={currentExpression === 'wink' ? 6 : eyeY} width="2" height={currentExpression === 'wink' ? 1 : eyeHeight} />
          </>
        )}
      </g>
    </svg>
  );
}

export default PixelCat;
