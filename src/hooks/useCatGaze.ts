import { useEffect, useRef } from 'react';
import type { CatExpression } from '../pixelCatDataUrl';

type GazeTarget = { x: number; y: number } | Element;

const interactiveElements = 'button, a[href], input, textarea, select, label, [role="button"], [role="slider"], [contenteditable="true"], [tabindex]';

export function useCatGaze(expression: CatExpression) {
  const catRef = useRef<SVGSVGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const targetRef = useRef<GazeTarget | null>(null);

  useEffect(() => {
    let frame: number | null = null;

    const update = () => {
      frame = null;
      const cat = catRef.current;
      const eyes = eyesRef.current;
      const target = targetRef.current;
      if (!cat || !eyes) return;

      if (!target || (target instanceof Element && !target.isConnected)) {
        eyes.style.transform = 'translate(0px, 0px)';
        targetRef.current = null;
        return;
      }

      const bounds = target instanceof Element ? target.getBoundingClientRect() : null;
      const point = bounds
        ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
        : target as { x: number; y: number };
      const matrix = cat.getScreenCTM();
      if (!matrix || !cat.getBoundingClientRect().width) return;

      // Work in the cat's pixel grid, including any parent scale or rotation.
      const localPoint = new DOMPoint(point.x, point.y).matrixTransform(matrix.inverse());
      const dx = localPoint.x - 8;
      const dy = localPoint.y - 6;
      const distance = Math.max(24, Math.hypot(dx, dy));
      // Directional expressions already offset their eyes from the neutral pose.
      const baseX = expression === 'thinking' ? 1 : 0;
      const baseY = expression === 'thinking' ? -1 : expression === 'lookDown' ? 1 : 0;
      const x = dx / distance - baseX;
      const y = (dy / distance) * 0.75 - baseY;
      eyes.style.transform = `translate(${x}px, ${y}px)`;
    };

    const scheduleUpdate = () => {
      if (frame === null) frame = window.requestAnimationFrame(update);
    };

    const followPointer = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      targetRef.current = { x: event.clientX, y: event.clientY };
      scheduleUpdate();
    };

    const followInteraction = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return;
      const element = event.target instanceof Element
        ? event.target.closest(interactiveElements)
        : null;
      targetRef.current = element instanceof HTMLLabelElement
        ? element.control ?? element
        : element ?? { x: event.clientX, y: event.clientY };
      scheduleUpdate();
    };

    const followFocus = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      targetRef.current = event.target;
      scheduleUpdate();
    };

    const reset = () => {
      targetRef.current = null;
      scheduleUpdate();
    };

    const leavePage = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.relatedTarget === null) reset();
    };

    document.addEventListener('pointermove', followPointer, { passive: true });
    document.addEventListener('pointerdown', followInteraction, { passive: true });
    document.addEventListener('focusin', followFocus);
    document.addEventListener('pointerout', leavePage);
    window.addEventListener('scroll', scheduleUpdate, { capture: true, passive: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('blur', reset);
    scheduleUpdate();

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', followPointer);
      document.removeEventListener('pointerdown', followInteraction);
      document.removeEventListener('focusin', followFocus);
      document.removeEventListener('pointerout', leavePage);
      window.removeEventListener('scroll', scheduleUpdate, true);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('blur', reset);
    };
  }, [expression]);

  return { catRef, eyesRef };
}
