export type CatExpression = 'default' | 'happy' | 'blink' | 'wink' | 'lookDown' | 'thinking' | 'shocked';
export type CatVariant = 'food' | 'sushiro';

/**
 * Returns a data URL string for embedding the pixel cat as an image (e.g. inside QRCodeCanvas).
 * Places the cat on a clean rounded white badge with a subtle border.
 */
export function getPixelCatDataUrl(options?: {
  variant?: CatVariant;
  expression?: CatExpression;
  size?: number;
}): string {
  const variant = options?.variant ?? 'food';
  const expression = options?.expression ?? 'happy';
  const size = options?.size ?? 64;

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

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
  <rect width="24" height="24" rx="6" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
  <g transform="translate(4, 5)">
    <!-- Row 0 -->
    <rect x="2" y="0" width="2" height="1" fill="${outline}" />
    <rect x="12" y="0" width="2" height="1" fill="${outline}" />
    ${variant === 'sushiro' ? `
    <rect x="6" y="0" width="4" height="1" fill="${sushiSalmon}" />
    <rect x="7" y="0" width="1" height="1" fill="#fed7aa" />
    <rect x="8" y="0" width="1" height="1" fill="${sushiNori}" />
    ` : ''}

    <!-- Row 1 -->
    <rect x="1" y="1" width="1" height="1" fill="${outline}" />
    <rect x="2" y="1" width="1" height="1" fill="${face}" />
    <rect x="3" y="1" width="1" height="1" fill="${innerEar}" />
    <rect x="4" y="1" width="1" height="1" fill="${outline}" />
    ${variant === 'sushiro' ? `
    <rect x="6" y="1" width="4" height="1" fill="${sushiRice}" />
    <rect x="8" y="1" width="1" height="1" fill="${sushiNori}" />
    ` : ''}
    <rect x="11" y="1" width="1" height="1" fill="${outline}" />
    <rect x="12" y="1" width="1" height="1" fill="${innerEar}" />
    <rect x="13" y="1" width="1" height="1" fill="${face}" />
    <rect x="14" y="1" width="1" height="1" fill="${outline}" />

    <!-- Row 2 -->
    <rect x="1" y="2" width="1" height="1" fill="${outline}" />
    <rect x="2" y="2" width="1" height="1" fill="${face}" />
    <rect x="3" y="2" width="2" height="1" fill="${innerEar}" />
    <rect x="5" y="2" width="6" height="1" fill="${outline}" />
    <rect x="11" y="2" width="2" height="1" fill="${innerEar}" />
    <rect x="13" y="2" width="1" height="1" fill="${face}" />
    <rect x="14" y="2" width="1" height="1" fill="${outline}" />

    <!-- Row 3 -->
    <rect x="1" y="3" width="1" height="1" fill="${outline}" />
    <rect x="2" y="3" width="12" height="1" fill="${variant === 'sushiro' ? '#ffffff' : face}" />
    ${variant === 'sushiro' ? `<rect x="7" y="3" width="2" height="1" fill="${headbandRed}" />` : ''}
    <rect x="14" y="3" width="1" height="1" fill="${outline}" />

    <!-- Row 4 -->
    <rect x="0" y="4" width="1" height="1" fill="${outline}" />
    <rect x="1" y="4" width="14" height="1" fill="${face}" />
    ${variant === 'sushiro' ? `<rect x="7" y="4" width="2" height="1" fill="${headbandRed}" />` : ''}
    <rect x="15" y="4" width="1" height="1" fill="${outline}" />

    <!-- Row 5 -->
    <rect x="0" y="5" width="1" height="1" fill="${outline}" />
    <rect x="1" y="5" width="14" height="1" fill="${face}" />
    <rect x="15" y="5" width="1" height="1" fill="${outline}" />
    ${expression === 'happy' ? `
    <rect x="3" y="5" width="2" height="1" fill="${eye}" />
    <rect x="11" y="5" width="2" height="1" fill="${eye}" />
    ` : `
    <rect x="3" y="5" width="2" height="1" fill="${eye}" />
    <rect x="11" y="5" width="2" height="1" fill="${eye}" />
    `}

    <!-- Row 6 -->
    <rect x="0" y="6" width="1" height="1" fill="${outline}" />
    <rect x="1" y="6" width="14" height="1" fill="${face}" />
    <rect x="15" y="6" width="1" height="1" fill="${outline}" />
    ${expression === 'happy' ? `
    <rect x="2" y="6" width="1" height="1" fill="${eye}" />
    <rect x="5" y="6" width="1" height="1" fill="${eye}" />
    <rect x="10" y="6" width="1" height="1" fill="${eye}" />
    <rect x="13" y="6" width="1" height="1" fill="${eye}" />
    ` : `
    <rect x="3" y="6" width="2" height="1" fill="${eye}" />
    <rect x="11" y="6" width="2" height="1" fill="${eye}" />
    `}

    <!-- Row 7 -->
    <rect x="0" y="7" width="1" height="1" fill="${outline}" />
    <rect x="1" y="7" width="14" height="1" fill="${face}" />
    <rect x="7" y="7" width="2" height="1" fill="${nose}" />
    <rect x="15" y="7" width="1" height="1" fill="${outline}" />

    <!-- Row 8 -->
    <rect x="0" y="8" width="1" height="1" fill="${outline}" />
    <rect x="1" y="8" width="2" height="1" fill="${blush}" />
    <rect x="3" y="8" width="10" height="1" fill="${face}" />
    <rect x="13" y="8" width="2" height="1" fill="${blush}" />
    <rect x="15" y="8" width="1" height="1" fill="${outline}" />
    <rect x="7" y="8" width="2" height="1" fill="${openMouth}" />

    <!-- Row 9 -->
    <rect x="1" y="9" width="1" height="1" fill="${outline}" />
    <rect x="2" y="9" width="12" height="1" fill="${face}" />
    <rect x="14" y="9" width="1" height="1" fill="${outline}" />

    <!-- Row 10 -->
    <rect x="2" y="10" width="1" height="1" fill="${outline}" />
    <rect x="3" y="10" width="10" height="1" fill="${face}" />
    <rect x="13" y="10" width="1" height="1" fill="${outline}" />

    <!-- Row 11 -->
    <rect x="3" y="11" width="10" height="1" fill="${outline}" />
  </g>
</svg>
`.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
