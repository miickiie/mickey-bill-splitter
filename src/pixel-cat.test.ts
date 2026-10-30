import assert from 'node:assert/strict';
import test from 'node:test';
import { getPixelCatDataUrl } from './pixelCatDataUrl.ts';

test('getPixelCatDataUrl returns a valid data URI containing SVG markup', () => {
  const dataUrl = getPixelCatDataUrl({ variant: 'food', expression: 'happy', size: 48 });
  assert.ok(dataUrl.startsWith('data:image/svg+xml;utf8,'));
  const decoded = decodeURIComponent(dataUrl.replace('data:image/svg+xml;utf8,', ''));
  assert.ok(decoded.includes('<svg'));
  assert.ok(decoded.includes('viewBox="0 0 24 24"'));
  assert.ok(decoded.includes('width="48"'));
});

test('getPixelCatDataUrl includes Sushiro chef headband and emblem in sushiro mode', () => {
  const dataUrl = getPixelCatDataUrl({ variant: 'sushiro', expression: 'happy', size: 64 });
  const decoded = decodeURIComponent(dataUrl.replace('data:image/svg+xml;utf8,', ''));
  // Should contain crimson red headband accent (#e11d48) and salmon (#f97316)
  assert.ok(decoded.includes('#e11d48'));
  assert.ok(decoded.includes('#f97316'));
});

test('getPixelCatDataUrl defaults safely when no arguments are provided', () => {
  const dataUrl = getPixelCatDataUrl();
  assert.ok(dataUrl.startsWith('data:image/svg+xml;utf8,'));
  const decoded = decodeURIComponent(dataUrl.replace('data:image/svg+xml;utf8,', ''));
  assert.ok(decoded.includes('<rect'));
});
