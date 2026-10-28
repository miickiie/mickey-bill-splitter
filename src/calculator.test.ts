import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateExpression,
  appendKeyToExpression,
  backspaceExpression,
} from './calculator.ts';

test('evaluates simple numbers and decimals', () => {
  assert.equal(evaluateExpression('150'), 150);
  assert.equal(evaluateExpression('12.5'), 12.5);
  assert.equal(evaluateExpression('0'), 0);
  assert.equal(evaluateExpression(''), 0);
});

test('evaluates simple binary operations', () => {
  assert.equal(evaluateExpression('100 + 50'), 150);
  assert.equal(evaluateExpression('100 - 30'), 70);
  assert.equal(evaluateExpression('25 × 4'), 100);
  assert.equal(evaluateExpression('100 ÷ 4'), 25);
  assert.equal(evaluateExpression('10 * 3'), 30);
  assert.equal(evaluateExpression('50 / 2'), 25);
});

test('respects standard operator precedence', () => {
  assert.equal(evaluateExpression('10 + 20 × 3'), 70);
  assert.equal(evaluateExpression('100 - 20 ÷ 2'), 90);
  assert.equal(evaluateExpression('5 × 4 + 10 ÷ 2'), 25);
});

test('handles trailing operators gracefully without errors', () => {
  assert.equal(evaluateExpression('120 + '), 120);
  assert.equal(evaluateExpression('80 × '), 80);
});

test('safely handles division by zero', () => {
  assert.equal(evaluateExpression('100 ÷ 0'), 0);
  assert.equal(evaluateExpression('50 / 0 + 10'), 10);
});

test('rounds to 2 decimal places and avoids negative numbers', () => {
  assert.equal(evaluateExpression('10 ÷ 3'), 3.33);
  assert.equal(evaluateExpression('20 - 50'), 0);
});

test('appends numbers and operators correctly', () => {
  let expr = '0';
  expr = appendKeyToExpression(expr, '5');
  assert.equal(expr, '5');
  expr = appendKeyToExpression(expr, '0');
  assert.equal(expr, '50');
  expr = appendKeyToExpression(expr, '+');
  assert.equal(expr, '50 + ');
  // Replacing operator if typed consecutively
  expr = appendKeyToExpression(expr, '×');
  assert.equal(expr, '50 × ');
  expr = appendKeyToExpression(expr, '2');
  assert.equal(expr, '50 × 2');
  assert.equal(evaluateExpression(expr), 100);
});

test('prevents duplicate decimal points in a single number token', () => {
  let expr = '12.5';
  expr = appendKeyToExpression(expr, '.');
  assert.equal(expr, '12.5');
  expr = appendKeyToExpression(expr, '+');
  expr = appendKeyToExpression(expr, '3');
  expr = appendKeyToExpression(expr, '.');
  expr = appendKeyToExpression(expr, '5');
  assert.equal(expr, '12.5 + 3.5');
  assert.equal(evaluateExpression(expr), 16);
});

test('backspace deletes characters and handles operators', () => {
  assert.equal(backspaceExpression('50 × 2'), '50 × ');
  assert.equal(backspaceExpression('50 × '), '50');
  assert.equal(backspaceExpression('5'), '0');
  assert.equal(backspaceExpression('0'), '0');
});

test('replaces leading zero in operand and preserves proper spacing for decimals', () => {
  let expr = '10 + 0';
  expr = appendKeyToExpression(expr, '5');
  assert.equal(expr, '10 + 5');

  let expr2 = '10 + ';
  expr2 = appendKeyToExpression(expr2, '.');
  assert.equal(expr2, '10 + 0.');
});
