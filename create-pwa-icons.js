import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNGBuffer(width, height, getPixelRGBA) {
  // 8-byte PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw uncompressed scanlines
  // Each scanline: 1 byte filter type (0) + width * 4 bytes RGBA
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixelRGBA(x, y, width, height);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  // IDAT chunk (compressed rawData)
  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);

  // CRC32 calculation
  const crcBuf = Buffer.alloc(4 + len);
  buf.copy(crcBuf, 0, 4, 8 + len);
  const crc = crc32(crcBuf);
  buf.writeUInt32BE(crc, 8 + len);

  return buf;
}

// CRC32 table & function
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// App icon pixel generator function: stylish Indigo gradient background with glowing rounded rectangle and receipt/sushi symbol
function getIconPixel(x, y, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.44;

  // Normalized coordinates [-1, 1]
  const nx = (x - cx) / (width / 2);
  const ny = (y - cy) / (height / 2);

  // Squircle / rounded rectangle distance
  const cornerR = 0.22;
  const dx = Math.max(0, Math.abs(nx) - (1 - cornerR));
  const dy = Math.max(0, Math.abs(ny) - (1 - cornerR));
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > cornerR) {
    return [0, 0, 0, 0]; // transparent outer corner
  }

  // Gradient background from indigo-600 (#4f46e5) to slate-900 (#0f172a)
  const t = (ny + 1) / 2; // 0 to 1
  let r = Math.round(79 * (1 - t) + 15 * t);
  let g = Math.round(70 * (1 - t) + 23 * t);
  let b = Math.round(229 * (1 - t) + 42 * t);

  // Draw inner receipt / sushi card shape in center
  const cardWidth = 0.52;
  const cardHeight = 0.62;
  const inCardX = Math.abs(nx) < cardWidth && Math.abs(ny) < cardHeight;

  if (inCardX) {
    // White / glossy card surface
    r = 255;
    g = 255;
    b = 255;

    // Draw indigo accent stripes inside the card (representing bill lines)
    if (ny > -0.35 && ny < -0.25 && Math.abs(nx) < 0.38) {
      r = 79; g = 70; b = 229; // Title line
    } else if (ny > -0.15 && ny < -0.08 && Math.abs(nx) < 0.38) {
      r = 147; g = 197; b = 253; // Item 1
    } else if (ny > 0.02 && ny < 0.09 && Math.abs(nx) < 0.38) {
      r = 147; g = 197; b = 253; // Item 2
    } else if (ny > 0.22 && ny < 0.32 && Math.abs(nx) < 0.38) {
      r = 16; g = 185; b = 129; // Total line (emerald)
    }
  }

  return [r, g, b, 255];
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Generating PWA icons...');
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), createPNGBuffer(192, 192, getIconPixel));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), createPNGBuffer(512, 512, getIconPixel));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPNGBuffer(180, 180, getIconPixel));
console.log('Icons generated successfully in public/');
