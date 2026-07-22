import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const GRADIENT_STOPS = [
  { position: 0, l: 0.511, c: 0.262, h: 276.966 },
  { position: 0.5, l: 0.585, c: 0.233, h: 277.117 },
  { position: 1, l: 0.627, c: 0.265, h: 303.9 }
];

function createPNGBuffer(width, height, getPixelRGBA) {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  for (let y = 0; y < height; y += 1) {
    rawData[offset++] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = getPixelRGBA(x, y, width, height);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdrData),
    createChunk('IDAT', zlib.deflateSync(rawData)),
    createChunk('IEND', Buffer.alloc(0))
  ]);
}

function createChunk(type, data) {
  const buffer = Buffer.alloc(12 + data.length);
  buffer.writeUInt32BE(data.length, 0);
  buffer.write(type, 4, 4, 'ascii');
  data.copy(buffer, 8);

  const crcBuffer = Buffer.alloc(4 + data.length);
  buffer.copy(crcBuffer, 0, 4, 8 + data.length);
  buffer.writeUInt32BE(crc32(crcBuffer), 8 + data.length);
  return buffer;
}

const crcTable = [];
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = crcTable[(crc ^ buffer[index]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function oklchToOklab({ l, c, h }) {
  const radians = h * (Math.PI / 180);
  return { l, a: c * Math.cos(radians), b: c * Math.sin(radians) };
}

function linearToSrgb(value) {
  return value <= 0.0031308
    ? 12.92 * value
    : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}

function oklabToRgb({ l, a, b }) {
  const lPrime = l + (0.3963377774 * a) + (0.2158037573 * b);
  const mPrime = l - (0.1055613458 * a) - (0.0638541728 * b);
  const sPrime = l - (0.0894841775 * a) - (1.291485548 * b);
  const lCube = lPrime ** 3;
  const mCube = mPrime ** 3;
  const sCube = sPrime ** 3;

  const red = (4.0767416621 * lCube) - (3.3077115913 * mCube) + (0.2309699292 * sCube);
  const green = (-1.2684380046 * lCube) + (2.6097574011 * mCube) - (0.3413193965 * sCube);
  const blue = (-0.0041960863 * lCube) - (0.7034186147 * mCube) + (1.707614701 * sCube);

  return [red, green, blue].map(channel => (
    Math.round(Math.max(0, Math.min(1, linearToSrgb(channel))) * 255)
  ));
}

function gradientColor(t) {
  const clamped = Math.max(0, Math.min(1, t));
  const endIndex = GRADIENT_STOPS.findIndex(stop => stop.position >= clamped);
  const end = GRADIENT_STOPS[endIndex === -1 ? GRADIENT_STOPS.length - 1 : endIndex];
  const start = GRADIENT_STOPS[Math.max(0, (endIndex === -1 ? GRADIENT_STOPS.length - 1 : endIndex) - 1)];
  const range = end.position - start.position;
  const localT = range === 0 ? 0 : (clamped - start.position) / range;
  const startLab = oklchToOklab(start);
  const endLab = oklchToOklab(end);

  return oklabToRgb({
    l: startLab.l + ((endLab.l - startLab.l) * localT),
    a: startLab.a + ((endLab.a - startLab.a) * localT),
    b: startLab.b + ((endLab.b - startLab.b) * localT)
  });
}

function rgbToHex(rgb) {
  return `#${rgb.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

function createSvgGradientStops() {
  return Array.from({ length: 33 }, (_, index) => {
    const position = index / 32;
    return `      <stop offset="${position}" stop-color="${rgbToHex(gradientColor(position))}"/>`;
  }).join('\n');
}

function pointInReceipt(x, y) {
  if (x < 16 || x > 48 || y < 13 || y > 51) return false;

  if (y < 17) {
    if (x < 20) return ((x - 20) ** 2) + ((y - 17) ** 2) <= 16;
    if (x > 44) return ((x - 44) ** 2) + ((y - 17) ** 2) <= 16;
    return true;
  }

  if (y <= 48.5) return true;

  const segment = Math.min(7, Math.floor((x - 16) / 4));
  const startX = 16 + (segment * 4);
  const startY = segment % 2 === 0 ? 51 : 48.5;
  const endY = segment % 2 === 0 ? 48.5 : 51;
  const bottomEdge = startY + ((endY - startY) * ((x - startX) / 4));
  return y <= bottomEdge;
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = (dx * dx) + (dy * dy);
  const projection = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, (((px - x1) * dx) + ((py - y1) * dy)) / lengthSquared));
  const closestX = x1 + (projection * dx);
  const closestY = y1 + (projection * dy);
  return Math.sqrt(((px - closestX) ** 2) + ((py - closestY) ** 2));
}

function createIconPixel({ roundedCorners = false, artworkScale = 1 } = {}) {
  return (x, y, width, height) => {
    const nx = ((x + 0.5) / width) * 2 - 1;
    const ny = ((y + 0.5) / height) * 2 - 1;

    if (roundedCorners) {
      const cornerRadius = 0.5;
      const dx = Math.max(0, Math.abs(nx) - (1 - cornerRadius));
      const dy = Math.max(0, Math.abs(ny) - (1 - cornerRadius));
      if (Math.sqrt((dx * dx) + (dy * dy)) > cornerRadius) {
        return [0, 0, 0, 0];
      }
    }

    let [r, g, b] = gradientColor((((x + 0.5) / width) + ((y + 0.5) / height)) / 2);
    const iconX = nx / artworkScale;
    const iconY = ny / artworkScale;
    const svgX = (iconX + 1) * 32;
    const svgY = (iconY + 1) * 32;

    if (pointInReceipt(svgX, svgY)) [r, g, b] = [255, 255, 255];

    const onReceiptLine = distanceToSegment(svgX, svgY, 24, 24, 40, 24) <= 2
      || distanceToSegment(svgX, svgY, 24, 32, 40, 32) <= 2
      || distanceToSegment(svgX, svgY, 24, 40, 31, 40) <= 2;
    if (onReceiptLine) [r, g, b] = [79, 70, 229];

    if (((svgX - 43) ** 2) + ((svgY - 40) ** 2) <= 49) {
      [r, g, b] = [34, 197, 94];
    }

    const onPlus = distanceToSegment(svgX, svgY, 40, 40, 46, 40) <= 1.25
      || distanceToSegment(svgX, svgY, 43, 37, 43, 43) <= 1.25;
    if (onPlus) [r, g, b] = [255, 255, 255];

    return [r, g, b, 255];
  };
}

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
${createSvgGradientStops()}
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#bg)"/>
  <path d="M20 13h24a4 4 0 0 1 4 4v34l-4-2.5-4 2.5-4-2.5-4 2.5-4-2.5-4 2.5-4-2.5-4 2.5V17a4 4 0 0 1 4-4Z" fill="#fff"/>
  <path d="M24 24h16M24 32h16M24 40h7" fill="none" stroke="#4f46e5" stroke-width="4" stroke-linecap="round"/>
  <circle cx="43" cy="40" r="7" fill="#22c55e"/>
  <path d="M40 40h6M43 37v6" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
</svg>
`;

const publicDir = path.resolve('public');
fs.mkdirSync(publicDir, { recursive: true });

const icons = [
  ['favicon-32.png', 32, createIconPixel({ roundedCorners: true })],
  ['apple-touch-icon.png', 180, createIconPixel()],
  ['icon-192.png', 192, createIconPixel()],
  ['icon-512.png', 512, createIconPixel()],
  ['icon-maskable-512.png', 512, createIconPixel({ artworkScale: 0.72 })]
];

console.log('Generating PWA icons with the active-toggle gradient...');
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg);
for (const [filename, size, pixelGenerator] of icons) {
  fs.writeFileSync(
    path.join(publicDir, filename),
    createPNGBuffer(size, size, pixelGenerator)
  );
}
console.log(`Generated favicon.svg and ${icons.length} PNG icons in public/`);
