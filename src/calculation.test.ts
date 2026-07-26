import assert from 'node:assert/strict';
import test from 'node:test';

import {calculateBill} from './calculation.ts';
import type {BillSettings, Item, Person} from './types.ts';

const settings = (overrides: Partial<BillSettings> = {}): BillSettings => ({
  sharedDiscount: 0,
  sharedDiscountType: 'amount',
  discountTiming: 'before',
  hasServiceCharge: false,
  hasVat: false,
  ...overrides,
});

const item = (id: string, price: number, overrides: Partial<Item> = {}): Item => ({
  id,
  name: id,
  price,
  ...overrides,
});

const person = (
  id: string,
  items: Item[],
  individualDiscount = 0,
): Person => ({
  id,
  name: id,
  items,
  individualDiscount,
});

const assertClose = (actual: number, expected: number) => {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`);
};

test('allocates a shared discount only across members with eligible items', () => {
  const result = calculateBill(
    [
      person('eligible', [item('meal', 100)]),
      person('excluded', [item('voucher', 100, {excludeDiscount: true})]),
    ],
    [],
    settings({sharedDiscount: 50}),
  );

  assert.equal(result.totalSharedDiscount, 50);
  assert.equal(result.grandTotal, 150);
  assert.deepEqual(result.peopleTotals, [
    {personId: 'eligible', finalShare: 50},
    {personId: 'excluded', finalShare: 100},
  ]);
});

test('reports only discounts that can actually be applied', () => {
  const result = calculateBill(
    [person('one', [item('meal', 40)], 100)],
    [],
    settings({sharedDiscount: 25}),
  );

  assert.equal(result.totalIndividualDiscounts, 40);
  assert.equal(result.totalSharedDiscount, 0);
  assert.equal(result.grandTotal, 0);
});

test('caps percentage discounts at one hundred percent', () => {
  const result = calculateBill(
    [person('one', [item('meal', 80)])],
    [],
    settings({sharedDiscount: 250, sharedDiscountType: 'percentage'}),
  );

  assert.equal(result.totalSharedDiscount, 80);
  assert.equal(result.grandTotal, 0);
});

test('keeps service charge ordering distinct before and after discount', () => {
  const before = calculateBill(
    [person('one', [item('meal', 100)])],
    [],
    settings({sharedDiscount: 10, hasServiceCharge: true}),
  );
  const after = calculateBill(
    [person('one', [item('meal', 100)])],
    [],
    settings({
      sharedDiscount: 10,
      discountTiming: 'after',
      hasServiceCharge: true,
    }),
  );

  assert.equal(before.serviceChargeTotal, 9);
  assert.equal(before.grandTotal, 99);
  assert.equal(after.serviceChargeTotal, 10);
  assert.equal(after.grandTotal, 100);
});

test('splits shared items without changing the bill subtotal', () => {
  const result = calculateBill(
    [person('one', []), person('two', [])],
    [item('shared', 99)],
    settings(),
  );

  assert.equal(result.subtotal, 99);
  assert.equal(result.sharedItemsTotal, 99);
  assert.equal(result.sharedItemPerPerson, 49.5);
  assert.deepEqual(result.peopleTotals, [
    {personId: 'one', finalShare: 49.5},
    {personId: 'two', finalShare: 49.5},
  ]);
});

test('respects per-item tax and discount exclusions', () => {
  const result = calculateBill(
    [person('one', [
      item('meal', 100),
      item('voucher', 50, {
        excludeDiscount: true,
        excludeServiceCharge: true,
        excludeVat: true,
      }),
    ])],
    [],
    settings({sharedDiscount: 10, hasServiceCharge: true, hasVat: true}),
  );

  assert.equal(result.totalSharedDiscount, 10);
  assertClose(result.serviceChargeTotal, 9);
  assertClose(result.vatTotal, 6.93);
  assertClose(result.grandTotal, 155.93);
});

test('caps an after-tax discount at the eligible gross amount', () => {
  const result = calculateBill(
    [person('one', [
      item('meal', 100),
      item('excluded', 50, {
        excludeDiscount: true,
        excludeServiceCharge: true,
        excludeVat: true,
      }),
    ])],
    [],
    settings({
      sharedDiscount: 500,
      discountTiming: 'after',
      hasServiceCharge: true,
      hasVat: true,
    }),
  );

  assertClose(result.totalSharedDiscount, 117.7);
  assertClose(result.serviceChargeTotal, 10);
  assertClose(result.vatTotal, 7.7);
  assertClose(result.grandTotal, 50);
});

test('includes Sushiro plates and sanitizes invalid numbers', () => {
  const result = calculateBill(
    [{
      ...person('one', [item('invalid', Number.NaN)], -10),
      plates: {white: 1, red: 0, silver: 0, gold: 0, black: 1},
    }],
    [],
    settings({isSushiroMode: true, sharedDiscount: Number.POSITIVE_INFINITY}),
  );

  assert.equal(result.subtotal, 130);
  assert.equal(result.totalIndividualDiscounts, 0);
  assert.equal(result.totalSharedDiscount, 0);
  assert.equal(result.grandTotal, 130);
});
