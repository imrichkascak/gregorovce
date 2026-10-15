import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStats,
  trackDistance,
  addMoney,
  noteCrime,
  formatDistance,
  formatPlayTime,
  statsRows,
} from './stats.js';

test('trackDistance counts on foot and in a car separately', () => {
  const stats = createStats();
  trackDistance(stats, 2, { onFoot: true, speed: 3 });
  trackDistance(stats, 2, { onFoot: false, speed: 10 });
  trackDistance(stats, 2, { onFoot: true, speed: -5 }); // spiatočka sa nepočíta
  assert.equal(stats.walked, 6);
  assert.equal(stats.driven, 20);
});

test('addMoney splits earnings and spending', () => {
  const stats = createStats();
  addMoney(stats, 150);
  addMoney(stats, -40);
  addMoney(stats, 0);
  assert.equal(stats.moneyEarned, 150);
  assert.equal(stats.moneySpent, 40);
});

test('noteCrime counts crimes and tracks the top wanted level', () => {
  const stats = createStats();
  noteCrime(stats, 2);
  noteCrime(stats, 4);
  noteCrime(stats, 1);
  assert.equal(stats.crimes, 3);
  assert.equal(stats.maxStars, 4);
});

test('formatDistance switches to kilometres', () => {
  assert.equal(formatDistance(320), '320 m');
  assert.equal(formatDistance(1400), '1,4 km');
});

test('formatPlayTime renders seconds, minutes and hours', () => {
  assert.equal(formatPlayTime(45), '45 s');
  assert.equal(formatPlayTime(12 * 60 + 30), '12 min');
  assert.equal(formatPlayTime(3600 + 5 * 60), '1 h 05 min');
});

test('statsRows lists at least six rows with live values', () => {
  const stats = createStats();
  stats.walked = 900;
  const rows = statsRows(stats, { money: 250, respect: 7, stars: 2, health: 80 });
  assert.ok(rows.length >= 6);
  const byLabel = Object.fromEntries(rows.map((row) => [row.label, row.value]));
  assert.equal(byLabel['Odchodené'], '900 m');
  assert.equal(byLabel['Peniaze'], '250 €');
  assert.equal(byLabel['Hviezdy'], '2/6');
});
