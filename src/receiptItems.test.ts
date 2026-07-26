import assert from 'node:assert/strict';
import test from 'node:test';

import {parseReceiptItems} from './receiptItems.ts';

test('parses valid fenced receipt output', () => {
  assert.deepEqual(
    parseReceiptItems('```json\n[{"name":"Tea","quantity":2,"price":80}]\n```'),
    [{name: 'Tea', quantity: 2, price: 80}],
  );
});

test('defaults a missing quantity to one', () => {
  assert.deepEqual(
    parseReceiptItems('[{"name":"Rice","price":45}]'),
    [{name: 'Rice', quantity: 1, price: 45}],
  );
});

test('rejects fractional quantities before they can multiply totals', () => {
  assert.throws(
    () => parseReceiptItems('[{"name":"Tea","quantity":1.5,"price":80}]'),
    /invalid quantity/,
  );
});

test('rejects negative and non-finite prices', () => {
  assert.throws(
    () => parseReceiptItems('[{"name":"Tea","quantity":1,"price":-1}]'),
    /invalid price/,
  );
});

test('rejects non-array output, blank names, and zero quantities', () => {
  assert.throws(() => parseReceiptItems('{"name":"Tea","price":10}'), /must be an array/);
  assert.throws(
    () => parseReceiptItems('[{"name":" ","quantity":1,"price":10}]'),
    /has no name/,
  );
  assert.throws(
    () => parseReceiptItems('[{"name":"Tea","quantity":0,"price":10}]'),
    /invalid quantity/,
  );
});
