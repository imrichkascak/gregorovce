// Unit testy pre čistú logiku rádia (stanice, plán beatov, DJ a reklamy).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATIONS,
  TALK_EVERY,
  advance,
  createRadioPlan,
  nextStation,
  setStation,
  stationAt,
  stationRows,
} from './radio-core.js';

test('radio: six or more stations, each with a genre and both talk kinds', () => {
  assert.ok(STATIONS.length >= 5, `stations=${STATIONS.length}`);
  for (const station of STATIONS) {
    assert.ok(station.genre && station.name, `${station.id} has name and genre`);
    assert.ok(station.dj.length >= 2, `${station.id} has DJ lines`);
    assert.ok(station.ads.length >= 2, `${station.id} has ads`);
    assert.ok(station.scale.length >= 5 && station.tempo > 0, `${station.id} has music`);
  }
  const genres = new Set(STATIONS.map((s) => s.genre));
  assert.equal(genres.size, STATIONS.length, 'every station has its own genre');
});

test('radio: beats play notes until the talk break', () => {
  const plan = createRadioPlan();
  const notes = [];
  for (let i = 0; i < TALK_EVERY - 1; i += 1) notes.push(advance(plan));
  assert.ok(notes.every((event) => event.kind === 'note'));
  assert.ok(notes.every((event) => event.frequency > 0));
  assert.equal(plan.talks, 0, 'no talk before the break');
});

test('radio: every talkEvery-th beat is a DJ line or an ad', () => {
  const plan = createRadioPlan();
  let last = null;
  for (let i = 0; i < TALK_EVERY; i += 1) last = advance(plan);
  assert.equal(last.kind, 'dj');
  assert.ok(last.text && last.text.length > 10, `text=${last.text}`);
  assert.equal(plan.talks, 1);
  assert.equal(plan.song, 1);
  assert.equal(last.name, STATIONS[0].name, 'talk belongs to the current station');
});

test('radio: DJ lines and ads alternate', () => {
  const plan = createRadioPlan();
  const kinds = [];
  for (let i = 0; i < TALK_EVERY * 4; i += 1) {
    const event = advance(plan);
    if (event.kind !== 'note') kinds.push(event.kind);
  }
  assert.deepEqual(kinds, ['dj', 'ad', 'dj', 'ad']);
  const texts = new Set();
  for (let i = 0; i < TALK_EVERY * 6; i += 1) {
    const event = advance(plan);
    if (event.kind !== 'note') texts.add(event.text);
  }
  assert.ok(texts.size >= 3, 'texts rotate instead of repeating one line');
});

test('radio: switching the station resets the beat but keeps the song count', () => {
  const plan = createRadioPlan();
  for (let i = 0; i < 5; i += 1) advance(plan);
  const station = setStation(plan, 3);
  assert.equal(plan.station, 3);
  assert.equal(plan.beat, 0);
  assert.equal(station.genre, 'dedinská ľudovka');
  const event = advance(plan);
  assert.equal(event.station, 3, 'notes come from the new station');
  assert.equal(event.name, STATIONS[3].name);
});

test('radio: next station wraps around and stationAt is safe', () => {
  const plan = createRadioPlan();
  setStation(plan, STATIONS.length - 1);
  const wrapped = nextStation(plan);
  assert.equal(plan.station, 0);
  assert.equal(wrapped.id, STATIONS[0].id);
  assert.equal(stationAt(-1).id, STATIONS[STATIONS.length - 1].id);
  assert.equal(stationAt(STATIONS.length).id, STATIONS[0].id);
});

test('radio: station rows list every station with its genre', () => {
  const rows = stationRows();
  assert.equal(rows.length, STATIONS.length);
  assert.ok(rows.every((row) => row.name && row.genre));
});

test('radio: the last talk survives the notes that follow it', () => {
  const plan = createRadioPlan();
  let talk = null;
  for (let i = 0; i < TALK_EVERY; i += 1) talk = advance(plan);
  assert.equal(talk.kind, 'dj');
  for (let i = 0; i < 5; i += 1) {
    const event = advance(plan);
    assert.equal(event.kind, 'note');
    assert.equal(plan.lastText, talk.text, 'HUD keeps the DJ line');
    assert.equal(plan.lastTalk, 'dj');
  }
  const station = setStation(plan, 1);
  assert.equal(plan.lastText, null, 'switching the station clears the caption');
  assert.equal(station.id, STATIONS[1].id);
});
