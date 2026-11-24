import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveTheme, THEMES } from './themes.ts';

test('migrates saved IDs for the three replaced themes', () => {
  assert.equal(resolveTheme('champagne', true), 'kyoto-berry');
  assert.equal(resolveTheme('emerald', false), 'solar-dune');
  assert.equal(resolveTheme('emerald-club', false), 'solar-dune');
  assert.equal(resolveTheme('midnight', false), 'nordic-slate');
  assert.equal(resolveTheme('midnight-gold', false), 'nordic-slate');
});

test('preserves current theme IDs and falls back to the system color scheme', () => {
  for (const { id } of THEMES) {
    assert.equal(resolveTheme(id, id === 'light'), id);
  }

  assert.equal(resolveTheme(null, true), 'dark');
  assert.equal(resolveTheme('unknown-theme', false), 'light');
});
