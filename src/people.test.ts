import assert from 'node:assert/strict';
import test from 'node:test';

import {shouldReplaceStarterPerson} from './people.ts';
import type {Person} from './types.ts';

const starter = (name: string): Person => ({
  id: '1',
  name,
  items: [],
  individualDiscount: 0,
});

test('replaces an untouched starter after the UI language changes', () => {
  assert.equal(
    shouldReplaceStarterPerson([starter('สมาชิก 1')], ['Member 1', 'สมาชิก 1']),
    true,
  );
});

test('preserves a renamed empty participant for shared-item splitting', () => {
  assert.equal(
    shouldReplaceStarterPerson([starter('Alice')], ['Member 1', 'สมาชิก 1']),
    false,
  );
});
