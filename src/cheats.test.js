import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CODES, pushKey, matchCode } from './cheats.js';

test('pushKey keeps only letters and digits', () => {
  assert.equal(pushKey('', 'Z'), 'z');
  assert.equal(pushKey('z', 'ArrowLeft'), 'z');
  assert.equal(pushKey('z', ' '), 'z');
  assert.equal(pushKey('z', '5'), 'z5');
});

test('pushKey keeps the last twelve characters', () => {
  const buffer = pushKey('abcdefghijklmn', 'x');
  assert.equal(buffer.length, 12);
  assert.equal(buffer, 'defghijklmnx');
});

test('matchCode finds a code typed at the end of the buffer', () => {
  assert.equal(matchCode('xxzdravie'), 'zdravie');
  assert.equal(matchCode('zdravie'), 'zdravie');
  assert.equal(matchCode('zdrav'), null);
  assert.equal(matchCode(''), null);
});

test('no code triggers early while a longer code is being typed', () => {
  // Každý prefix dlhšieho kódu musí mať jedinú zhodu — a to až na konci.
  for (const entry of CODES) {
    const text = entry.code.toLowerCase();
    for (let i = 1; i < text.length; i += 1) {
      assert.equal(matchCode(text.slice(0, i)), null, `predčasná zhoda v „${text.slice(0, i)}“`);
    }
    assert.equal(matchCode(text), entry.id);
  }
});

test('there are at least six cheat codes', () => {
  assert.ok(CODES.length >= 6);
  const ids = new Set(CODES.map((entry) => entry.id));
  assert.equal(ids.size, CODES.length);
});
