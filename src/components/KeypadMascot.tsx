import { useState, useEffect } from 'react';
import { PixelCat, CatExpression, CatVariant } from './PixelCat';

export interface KeypadMascotProps {
  expression: string;
  evaluatedValue: number;
  hasUserTyped: boolean;
  variant?: CatVariant;
  isConfirming?: boolean;
  vibrate?: (pattern: number | number[]) => void;
}

export function KeypadMascot({
  expression,
  evaluatedValue,
  hasUserTyped,
  variant = 'food',
  isConfirming = false,
  vibrate,
}: KeypadMascotProps) {
  const [expressionState, setExpressionState] = useState<CatExpression>('default');
  const [bouncing, setBouncing] = useState(false);

  // Derive expression from typing context
  useEffect(() => {
    if (isConfirming) {
      setExpressionState('happy');
      setBouncing(true);
      const timer = window.setTimeout(() => setBouncing(false), 700);
      return () => window.clearTimeout(timer);
    }

    if (evaluatedValue > 5000) {
      setExpressionState('shocked');
      return;
    }

    const hasOperators = /[\+\-\×\÷]/.test(expression);
    if (hasOperators) {
      setExpressionState('thinking');
      return;
    }

    if (hasUserTyped && expression !== '0') {
      setExpressionState('lookDown');
      return;
    }

    setExpressionState('default');
  }, [expression, evaluatedValue, hasUserTyped, isConfirming]);

  // Idle blinking when in default state
  useEffect(() => {
    if (expressionState !== 'default') return;

    const interval = window.setInterval(() => {
      setExpressionState('blink');
      window.setTimeout(() => {
        setExpressionState((prev) => (prev === 'blink' ? 'default' : prev));
      }, 200);
    }, 4500);

    return () => window.clearInterval(interval);
  }, [expressionState]);

  const handleTap = () => {
    if (vibrate) vibrate(10);
    setBouncing(true);
    setExpressionState('happy');
    window.setTimeout(() => {
      setBouncing(false);
      setExpressionState('default');
    }, 600);
  };

  return (
    <div className="keypad-mascot-wrap">
      <button
        type="button"
        onClick={handleTap}
        className={`keypad-mascot-btn ${bouncing || isConfirming ? 'is-celebrating' : ''}`}
        aria-label="Calculator companion cat"
        title="I'm watching the math! 🐾"
      >
        <PixelCat
          size={36}
          expression={expressionState}
          variant={variant}
          celebrating={isConfirming}
        />
      </button>
    </div>
  );
}

export default KeypadMascot;
