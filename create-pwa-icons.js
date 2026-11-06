import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const source = readFileSync(
  new URL('./assets/branding/app-icon-source.svg', import.meta.url),
  'utf8',
);
const VIEWBOX_SIZE = 128;
const MASKABLE_ARTWORK_SCALE = 0.72;
const maskablePadding = (VIEWBOX_SIZE * (1 - MASKABLE_ARTWORK_SCALE)) / 2;
const mascotGroup = '<g id="mascot">';

if (!source.includes(mascotGroup)) {
  throw new Error('The icon SVG must contain the mascot group for maskable padding.');
}

const maskableSource = source.replace(
  mascotGroup,
  `<g id="mascot" transform="translate(${maskablePadding} ${maskablePadding}) scale(${MASKABLE_ARTWORK_SCALE})">`,
);

function renderIcon(size, svg = source) {
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts: false },
  }).render().asPng();
}

function writeAsset(filename, content) {
  writeFileSync(new URL(`./public/${filename}`, import.meta.url), content);
}

for (const filename of ['app-logo.svg', 'favicon.svg', 'icon.svg']) {
  writeAsset(filename, source);
}
writeAsset('icon-maskable.svg', maskableSource);

const icons = [
  { filename: 'app-logo.png', size: 256 },
  { filename: 'favicon-16.png', size: 16 },
  { filename: 'favicon-32.png', size: 32 },
  { filename: 'apple-touch-icon.png', size: 180 },
  { filename: 'icon-192.png', size: 192 },
  { filename: 'icon-512.png', size: 512 },
  { filename: 'icon-maskable-512.png', size: 512, maskable: true },
];

for (const { filename, size, maskable } of icons) {
  writeAsset(filename, renderIcon(size, maskable ? maskableSource : source));
}

const icoImages = [16, 32, 48].map((size) => ({ size, content: renderIcon(size) }));
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(icoImages.length, 4);
const icoDirectory = Buffer.alloc(16 * icoImages.length);
let imageOffset = icoHeader.length + icoDirectory.length;

for (const [index, { size, content }] of icoImages.entries()) {
  const entryOffset = index * 16;
  icoDirectory.writeUInt8(size, entryOffset);
  icoDirectory.writeUInt8(size, entryOffset + 1);
  icoDirectory.writeUInt16LE(1, entryOffset + 4);
  icoDirectory.writeUInt16LE(32, entryOffset + 6);
  icoDirectory.writeUInt32LE(content.length, entryOffset + 8);
  icoDirectory.writeUInt32LE(imageOffset, entryOffset + 12);
  imageOffset += content.length;
}

writeAsset('favicon.ico', Buffer.concat([
  icoHeader,
  icoDirectory,
  ...icoImages.map(({ content }) => content),
]));

console.log('Generated vector logos and icons, plus PNG/ICO fallbacks, from the SVG source.');
