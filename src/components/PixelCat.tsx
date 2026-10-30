import type { CSSProperties } from 'react';

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
  const currentExpression: CatExpression = celebrating ? 'happy' : expression;
  const gridHeight = 12;

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
      viewBox={`0 0 16 ${gridHeight}`}
      width={size}
      height={(size * gridHeight) / 16}
      className={`pixel-cat-svg ${celebrating ? 'is-celebrating' : ''} ${currentExpression === 'thinking' ? 'is-thinking' : ''} ${currentExpression === 'shocked' ? 'is-shocked' : ''} ${className}`}
      shapeRendering="crispEdges"
      style={{
        imageRendering: 'pixelated',
        shapeRendering: 'crispEdges',
        overflow: 'visible',
        ...style,
      }}
      onClick={onClick}
      role={onClick ? 'button' : 'img'}
      tabIndex={onClick ? 0 : undefined}
      aria-label={title}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      {/* Row 0: Ear tips (2px wide each) + optional Sushiro Salmon sushi */}
      <rect x="2" y="0" width="2" height="1" fill={outline} />
      <rect x="12" y="0" width="2" height="1" fill={outline} />
      {variant === 'sushiro' && (
        <>
          <rect x="6" y="0" width="4" height="1" fill={sushiSalmon} />
          <rect x="7" y="0" width="1" height="1" fill="#fed7aa" />
          <rect x="8" y="0" width="1" height="1" fill={sushiNori} />
        </>
      )}

      {/* Row 1: Ears upper section + sushi base in Sushiro mode */}
      <rect x="1" y="1" width="1" height="1" fill={outline} />
      <rect x="2" y="1" width="1" height="1" fill={face} />
      <rect x="3" y="1" width="1" height="1" fill={innerEar} />
      <rect x="4" y="1" width="1" height="1" fill={outline} />

      {variant === 'sushiro' && (
        <>
          <rect x="6" y="1" width="4" height="1" fill={sushiRice} />
          <rect x="8" y="1" width="1" height="1" fill={sushiNori} />
        </>
      )}

      <rect x="11" y="1" width="1" height="1" fill={outline} />
      <rect x="12" y="1" width="1" height="1" fill={innerEar} />
      <rect x="13" y="1" width="1" height="1" fill={face} />
      <rect x="14" y="1" width="1" height="1" fill={outline} />

      {/* Row 2: Lower ears + top of head bridge */}
      <rect x="1" y="2" width="1" height="1" fill={outline} />
      <rect x="2" y="2" width="1" height="1" fill={face} />
      <rect x="3" y="2" width="2" height="1" fill={innerEar} />
      <rect x="5" y="2" width="6" height="1" fill={outline} />
      <rect x="11" y="2" width="2" height="1" fill={innerEar} />
      <rect x="13" y="2" width="1" height="1" fill={face} />
      <rect x="14" y="2" width="1" height="1" fill={outline} />

      {/* Row 3: Forehead / Sushiro Chef Headband */}
      <rect x="1" y="3" width="1" height="1" fill={outline} />
      <rect x="2" y="3" width="12" height="1" fill={variant === 'sushiro' ? '#ffffff' : face} />
      {variant === 'sushiro' && (
        <rect x="7" y="3" width="2" height="1" fill={headbandRed} />
      )}
      <rect x="14" y="3" width="1" height="1" fill={outline} />

      {/* Row 4: Puffy cheeks top */}
      <rect x="0" y="4" width="1" height="1" fill={outline} />
      <rect x="1" y="4" width="14" height="1" fill={face} />
      {variant === 'sushiro' && (
        <rect x="7" y="4" width="2" height="1" fill={headbandRed} />
      )}
      <rect x="15" y="4" width="1" height="1" fill={outline} />
      {currentExpression === 'thinking' && (
        <>
          <rect x="4" y="4" width="2" height="1" fill={eye} />
          <rect x="12" y="4" width="2" height="1" fill={eye} />
        </>
      )}

      {/* Row 5: Upper eyes & chubby cheeks */}
      <rect x="0" y="5" width="1" height="1" fill={outline} />
      <rect x="1" y="5" width="14" height="1" fill={face} />
      <rect x="15" y="5" width="1" height="1" fill={outline} />

      {/* Row 5 Eye details */}
      {(currentExpression === 'default' || currentExpression === 'wink') && (
        <rect x="3" y="5" width="2" height="1" fill={eye} />
      )}
      {currentExpression === 'default' && (
        <rect x="11" y="5" width="2" height="1" fill={eye} />
      )}
      {currentExpression === 'happy' && (
        <>
          <rect x="3" y="5" width="2" height="1" fill={eye} />
          <rect x="11" y="5" width="2" height="1" fill={eye} />
        </>
      )}
      {currentExpression === 'thinking' && (
        <>
          <rect x="4" y="5" width="2" height="1" fill={eye} />
          <rect x="12" y="5" width="2" height="1" fill={eye} />
        </>
      )}
      {currentExpression === 'shocked' && (
        <>
          <rect x="3" y="5" width="2" height="1" fill={eye} />
          <rect x="11" y="5" width="2" height="1" fill={eye} />
        </>
      )}

      {/* Row 6: Lower eyes & chubby cheeks */}
      <rect x="0" y="6" width="1" height="1" fill={outline} />
      <rect x="1" y="6" width="14" height="1" fill={face} />
      <rect x="15" y="6" width="1" height="1" fill={outline} />

      {/* Row 6 Eye details */}
      {currentExpression === 'default' && (
        <>
          <rect x="3" y="6" width="2" height="1" fill={eye} />
          <rect x="11" y="6" width="2" height="1" fill={eye} />
        </>
      )}
      {currentExpression === 'blink' && (
        <>
          <rect x="3" y="6" width="2" height="1" fill={eye} />
          <rect x="11" y="6" width="2" height="1" fill={eye} />
        </>
      )}
      {currentExpression === 'wink' && (
        <>
          <rect x="3" y="6" width="2" height="1" fill={eye} />
          <rect x="11" y="6" width="2" height="1" fill={eye} />
        </>
      )}
      {currentExpression === 'happy' && (
        <>
          <rect x="2" y="6" width="1" height="1" fill={eye} />
          <rect x="5" y="6" width="1" height="1" fill={eye} />
          <rect x="10" y="6" width="1" height="1" fill={eye} />
          <rect x="13" y="6" width="1" height="1" fill={eye} />
        </>
      )}
      {currentExpression === 'lookDown' && (
        <>
          <rect x="3" y="6" width="2" height="1" fill={eye} />
          <rect x="11" y="6" width="2" height="1" fill={eye} />
        </>
      )}
      {currentExpression === 'shocked' && (
        <>
          <rect x="3" y="6" width="2" height="1" fill={eye} />
          <rect x="11" y="6" width="2" height="1" fill={eye} />
        </>
      )}

      {/* Row 7: Cute pink nose & chubby cheeks */}
      <rect x="0" y="7" width="1" height="1" fill={outline} />
      <rect x="1" y="7" width="14" height="1" fill={face} />
      <rect x="7" y="7" width="2" height="1" fill={nose} />
      {currentExpression === 'lookDown' && (
        <>
          <rect x="3" y="7" width="2" height="1" fill={eye} />
          <rect x="11" y="7" width="2" height="1" fill={eye} />
        </>
      )}
      <rect x="15" y="7" width="1" height="1" fill={outline} />

      {/* Row 8: Blush cheeks */}
      <rect x="0" y="8" width="1" height="1" fill={outline} />
      <rect x="1" y="8" width="2" height="1" fill={blush} />
      <rect x="3" y="8" width="10" height="1" fill={face} />
      <rect x="13" y="8" width="2" height="1" fill={blush} />
      <rect x="15" y="8" width="1" height="1" fill={outline} />
      {(celebrating || currentExpression === 'shocked') && (
        <rect x="7" y="8" width="2" height="1" fill={openMouth} />
      )}

      {/* Row 9: Lower cheeks tapering inward */}
      <rect x="1" y="9" width="1" height="1" fill={outline} />
      <rect x="2" y="9" width="12" height="1" fill={face} />
      {currentExpression === 'shocked' && (
        <rect x="7" y="9" width="2" height="1" fill={openMouth} />
      )}
      <rect x="14" y="9" width="1" height="1" fill={outline} />

      {/* Row 10: Chin tapering inward */}
      <rect x="2" y="10" width="1" height="1" fill={outline} />
      <rect x="3" y="10" width="10" height="1" fill={face} />
      <rect x="13" y="10" width="1" height="1" fill={outline} />

      {/* Row 11: Chin bottom outline */}
      <rect x="3" y="11" width="10" height="1" fill={outline} />
    </svg>
  );
}

export default PixelCat;
