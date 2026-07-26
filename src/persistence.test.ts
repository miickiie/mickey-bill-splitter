import assert from 'node:assert/strict';
import test from 'node:test';

import {parseStoredBillState} from './persistence.ts';

test('rejects structurally invalid persisted state', () => {
  const result = parseStoredBillState(JSON.stringify({
    people: [{id: 'one', name: 'One'}],
    sharedItems: [],
    settings: {},
  }));

  assert.equal(result, null);
});

test('sanitizes persisted numeric values and optional settings', () => {
  const result = parseStoredBillState(JSON.stringify({
    people: [{
      id: 'one',
      name: 'One',
      items: [{id: 'meal', name: 'Meal', price: -100}],
      individualDiscount: -20,
      plates: {white: 1.5, red: 0, silver: 0, gold: 0, black: 0},
    }],
    sharedItems: [],
    settings: {
      sharedDiscount: 250,
      sharedDiscountType: 'percentage',
      hasServiceCharge: true,
      hasVat: false,
    },
  }));

  assert.ok(result);
  assert.equal(result.people[0].items[0].price, 0);
  assert.equal(result.people[0].individualDiscount, 0);
  assert.equal(result.people[0].plates?.white, 1);
  assert.equal(result.settings.sharedDiscount, 100);
  assert.equal(result.settings.discountTiming, 'before');
});
