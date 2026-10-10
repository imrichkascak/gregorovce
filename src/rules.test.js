import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatClock, stars, clampWanted, formatMoney } from './rules.js';

test('formatClock wraps a full day and pads', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(8 * 60 + 5), '08:05');
  assert.equal(formatClock(23 * 60 + 59), '23:59');
  assert.equal(formatClock(24 * 60), '00:00');
  assert.equal(formatClock(25 * 60 + 30), '01:30');
});

test('stars fills the first `level` stars', () => {
  assert.equal(stars(0), '☆☆☆☆☆☆');
  assert.equal(stars(3), '★★★☆☆☆');
  assert.equal(stars(6), '★★★★★★');
});

test('clampWanted keeps levels in range', () => {
  assert.equal(clampWanted(-2), 0);
  assert.equal(clampWanted(3), 3);
  assert.equal(clampWanted(9), 6);
});

test('formatMoney is an eight-digit euro counter', () => {
  assert.equal(formatMoney(350), '€00000350');
  assert.equal(formatMoney(0), '€00000000');
  assert.equal(formatMoney(-5), '€00000000');
});
