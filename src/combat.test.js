import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDamage, inMeleeArc, comboHits } from './combat.js';

test('applyDamage: no armor, health floors at zero', () => {
  assert.deepEqual(applyDamage(100, 0, 30), { health: 70, armor: 0, absorbed: 0 });
  assert.deepEqual(applyDamage(10, 0, 30), { health: 0, armor: 0, absorbed: 0 });
});

test('applyDamage: armor soaks two thirds of a hit', () => {
  assert.deepEqual(applyDamage(100, 100, 30), { health: 90, armor: 80, absorbed: 20 });
  assert.deepEqual(applyDamage(100, 5, 30), { health: 75, armor: 0, absorbed: 5 });
});

test('inMeleeArc: ahead in range hits, behind and far do not', () => {
  // yaw 0 faces -z, so a target at z - 2 is straight ahead.
  assert.equal(inMeleeArc(0, 0, 0, 0, -2, 3, 0.95), true);
  assert.equal(inMeleeArc(0, 0, 0, 0, 2, 3, 0.95), false);
  assert.equal(inMeleeArc(0, 0, 0, 0, -4, 3, 0.95), false);
});

test('inMeleeArc: the cone has a fixed width', () => {
  // 45° off-axis: inside a 0.95 rad (~54°) cone, outside a 0.5 rad one.
  const side = { x: Math.SQRT1_2 * 2, z: -Math.SQRT1_2 * 2 };
  assert.equal(inMeleeArc(0, 0, 0, side.x, side.z, 3, 0.95), true);
  assert.equal(inMeleeArc(0, 0, 0, side.x, side.z, 3, 0.5), false);
});

test('inMeleeArc: standing on the target counts', () => {
  assert.equal(inMeleeArc(5, 5, 1.2, 5, 5, 3, 0.9), true);
});

test('comboHits counts only hits inside the window', () => {
  assert.equal(comboHits([0, 0.5, 1.2], 1.5), 3);
  assert.equal(comboHits([0, 0.5, 1.2], 3), 1);
  assert.equal(comboHits([], 1), 0);
});
