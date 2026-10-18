// Unit testy čistej logiky túlania zvierat (sliepky a psy na dvore).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWanderer } from './animals-core.js';

test('wanderer starts paused and picks a target after the timer', () => {
  const wanderer = createWanderer({ x: 0, z: 0, seed: 3 });
  assert.equal(wanderer.state.mode, 'pause');
  const before = wanderer.state.steps;
  wanderer.step(5);
  assert.equal(wanderer.state.mode, 'walk');
  assert.ok(wanderer.state.steps > before);
});

test('wanderer walks to its target and then pauses there', () => {
  const wanderer = createWanderer({ x: 0, z: 0, seed: 5, speed: 2 });
  wanderer.step(5);
  assert.equal(wanderer.state.mode, 'walk');
  const target = { x: wanderer.state.targetX, z: wanderer.state.targetZ };
  for (let i = 0; i < 40; i += 1) {
    wanderer.step(1);
    if (wanderer.state.mode === 'pause') break;
  }
  assert.equal(wanderer.state.mode, 'pause');
  assert.ok(Math.hypot(wanderer.state.x - target.x, wanderer.state.z - target.z) < 0.25);
});

test('wanderer never leaves the anchor radius', () => {
  const wanderer = createWanderer({ x: 10, z: -4, radius: 5, speed: 1.4, seed: 9 });
  for (let i = 0; i < 600; i += 1) {
    wanderer.step(0.1);
    const distance = Math.hypot(wanderer.state.x - 10, wanderer.state.z + 4);
    assert.ok(distance < 5.2, `distance=${distance}`);
  }
});

test('two seeds wander along different paths', () => {
  const a = createWanderer({ x: 0, z: 0, seed: 1 });
  const b = createWanderer({ x: 0, z: 0, seed: 2 });
  for (let i = 0; i < 300; i += 1) {
    a.step(0.1);
    b.step(0.1);
  }
  const apart = Math.hypot(a.state.x - b.state.x, a.state.z - b.state.z);
  assert.ok(apart > 0.5, `apart=${apart}`);
});

test('walking faces the target heading', () => {
  const wanderer = createWanderer({ x: 0, z: 0, seed: 7, speed: 1 });
  wanderer.step(5);
  assert.equal(wanderer.state.mode, 'walk');
  wanderer.step(0.5);
  const heading = Math.atan2(
    wanderer.state.targetX - wanderer.state.x,
    wanderer.state.targetZ - wanderer.state.z,
  );
  assert.ok(Math.abs(wanderer.state.heading - heading) < 0.2);
});
