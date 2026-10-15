import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createQuestState,
  findQuest,
  activeQuest,
  startQuest,
  advanceQuest,
  failQuest,
  tickQuest,
  unlockQuest,
  questLog,
  questProgress,
} from './quests-core.js';

const DEFS = [
  {
    id: 'a',
    name: 'Áčko',
    location: 'kostol',
    chain: 'c',
    phases: [{ text: 'Choď', timeLimit: 90 }, { text: 'Vráť sa', target: 'giver' }],
  },
  { id: 'b', name: 'Béčko', location: 'krčma', phases: [{ text: 'Urob' }, { text: 'Vráť sa' }] },
  { id: 'c', name: 'Céčko', location: 'úrad', locked: true, phases: [{ text: 'Urob' }] },
];

test('quests: start only from available or failed', () => {
  const state = createQuestState(DEFS);
  assert.equal(startQuest(state, 'c', DEFS), null, 'locked quest cannot start');
  assert.ok(startQuest(state, 'a', DEFS));
  assert.equal(findQuest(state, 'a').status, 'active');
  assert.equal(startQuest(state, 'a', DEFS), null, 'active quest cannot restart');
});

test('quests: phases advance and complete with a chain', () => {
  const state = createQuestState(DEFS);
  startQuest(state, 'a', DEFS);
  const first = advanceQuest(state, 'a', DEFS);
  assert.equal(first.status, 'phase');
  assert.equal(first.phase.text, 'Vráť sa');
  assert.equal(findQuest(state, 'a').timeLeft, null, 'no limit on the return phase');
  const done = advanceQuest(state, 'a', DEFS);
  assert.equal(done.status, 'completed');
  assert.equal(done.chain, 'c');
  assert.equal(unlockQuest(state, done.chain), true);
  assert.equal(findQuest(state, 'c').status, 'available');
  assert.equal(activeQuest(state), null);
});

test('quests: timers fail a quest and retry resets it', () => {
  const state = createQuestState(DEFS);
  startQuest(state, 'a', DEFS);
  assert.equal(tickQuest(state, 'a', 30), false);
  assert.equal(findQuest(state, 'a').timeLeft, 60);
  assert.equal(tickQuest(state, 'a', 60), true, 'timer runs out');
  assert.equal(findQuest(state, 'a').status, 'failed');
  assert.equal(activeQuest(state), null);
  assert.ok(startQuest(state, 'a', DEFS), 'failed quest can be retried');
  assert.equal(findQuest(state, 'a').phase, 0);
  assert.equal(findQuest(state, 'a').timeLeft, 90);
});

test('quests: failQuest only touches active quests', () => {
  const state = createQuestState(DEFS);
  assert.equal(failQuest(state, 'b'), false, 'available quest cannot fail');
  startQuest(state, 'b', DEFS);
  assert.equal(failQuest(state, 'b'), true);
  assert.equal(findQuest(state, 'b').status, 'failed');
});

test('quests: quest log hides locked quests and shows the phase', () => {
  const state = createQuestState(DEFS);
  startQuest(state, 'a', DEFS);
  const rows = questLog(DEFS, state);
  assert.equal(rows.length, 2, 'locked quest is hidden');
  const rowA = rows.find((row) => row.id === 'a');
  assert.equal(rowA.status, 'active');
  assert.equal(rowA.phaseText, 'Choď');
  assert.equal(rowA.timeLeft, 90);
  assert.equal(rowA.totalPhases, 2);
});

test('quests: progress runs 0 → half → 1', () => {
  const state = createQuestState(DEFS);
  const def = DEFS[0];
  startQuest(state, 'a', DEFS);
  assert.equal(questProgress(def, findQuest(state, 'a')), 0);
  advanceQuest(state, 'a', DEFS);
  assert.equal(questProgress(def, findQuest(state, 'a')), 0.5);
  advanceQuest(state, 'a', DEFS);
  assert.equal(questProgress(def, findQuest(state, 'a')), 1);
});
