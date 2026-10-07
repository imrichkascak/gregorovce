import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MOTION, stepHorizontal } from './motion.js';

function hold(seconds, wishX, wishZ, wishSpeed, grounded, flying) {
  let v = { x: 0, z: 0 };
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    v = stepHorizontal(v.x, v.z, wishX, wishZ, wishSpeed, dt, grounded, flying);
  }
  return v;
}

test('a walk reaches the wish speed and does not run past it', () => {
  const v = hold(1.2, 0, 1, MOTION.walk, true, false);
  const speed = Math.hypot(v.x, v.z);
  assert.ok(speed > MOTION.walk * 0.92, `too slow: ${speed}`);
  assert.ok(speed <= MOTION.walk + 0.05, `overshot: ${speed}`);
});

test('diagonals are not faster than moving straight', () => {
  const straight = hold(1.2, 0, 1, MOTION.walk, true, false);
  const diagonal = hold(1.2, Math.SQRT1_2, Math.SQRT1_2, MOTION.walk, true, false);
  const a = Math.hypot(straight.x, straight.z);
  const b = Math.hypot(diagonal.x, diagonal.z);
  assert.ok(Math.abs(a - b) < 0.15, `straight ${a} vs diagonal ${b}`);
});

test('letting go of the keys stops you within half a second', () => {
  let v = hold(1, 0, 1, MOTION.run, true, false);
  const dt = 1 / 60;
  for (let t = 0; t < 0.55; t += dt) {
    v = stepHorizontal(v.x, v.z, 0, 0, 0, dt, true, false);
  }
  assert.ok(Math.hypot(v.x, v.z) < 0.2, `still moving at ${Math.hypot(v.x, v.z)}`);
});

test('you can steer while falling, but slower than on the ground', () => {
  const v = hold(0.12, 0, 1, MOTION.walk, false, false);
  const speed = Math.hypot(v.x, v.z);
  assert.ok(speed > 0.4, `air control is missing: ${speed}`);
  assert.ok(speed < MOTION.walk * 0.85, `air control is too strong: ${speed}`);
});
