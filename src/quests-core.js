// Pure quest state machine: phases, timers, fail/retry and chains. Free of
// three.js and DOM so the whole quest flow can be unit tested.

export function createQuestState(defs) {
  return {
    quests: defs.map((def) => ({
      id: def.id,
      status: def.locked ? 'locked' : 'available',
      phase: 0,
      timeLeft: def.phases[0]?.timeLimit ?? null,
    })),
  };
}

export function findQuest(state, id) {
  return state.quests.find((quest) => quest.id === id) ?? null;
}

export function activeQuest(state) {
  return state.quests.find((quest) => quest.status === 'active') ?? null;
}

function defOf(defs, id) {
  return defs.find((def) => def.id === id) ?? null;
}

/** Accept (or retry) a quest. Returns its record, or null when not allowed. */
export function startQuest(state, id, defs) {
  const quest = findQuest(state, id);
  if (!quest) return null;
  if (quest.status !== 'available' && quest.status !== 'failed') return null;
  const def = defOf(defs, id);
  quest.status = 'active';
  quest.phase = 0;
  quest.timeLeft = def?.phases[0]?.timeLimit ?? null;
  return quest;
}

/** Reach the current phase target: advance, or complete on the last phase. */
export function advanceQuest(state, id, defs) {
  const quest = findQuest(state, id);
  if (!quest || quest.status !== 'active') return null;
  const def = defOf(defs, id);
  quest.phase += 1;
  if (!def || quest.phase >= def.phases.length) {
    quest.status = 'completed';
    quest.timeLeft = null;
    return { status: 'completed', quest, chain: def?.chain ?? null };
  }
  quest.timeLeft = def.phases[quest.phase]?.timeLimit ?? null;
  return { status: 'phase', quest, phase: def.phases[quest.phase] };
}

/** Fail an active quest; it can be retried from its giver (or marker). */
export function failQuest(state, id) {
  const quest = findQuest(state, id);
  if (!quest || quest.status !== 'active') return false;
  quest.status = 'failed';
  quest.timeLeft = null;
  return true;
}

/** Tick the active quest's timer; true when it just ran out and failed. */
export function tickQuest(state, id, dt) {
  const quest = findQuest(state, id);
  if (!quest || quest.status !== 'active' || quest.timeLeft === null) return false;
  quest.timeLeft = Math.max(0, quest.timeLeft - dt);
  if (quest.timeLeft > 0) return false;
  quest.status = 'failed';
  quest.timeLeft = null;
  return true;
}

/** Unlock a chained quest once its predecessor is done. */
export function unlockQuest(state, id) {
  const quest = findQuest(state, id);
  if (!quest || quest.status !== 'locked') return false;
  quest.status = 'available';
  return true;
}

/** Rows for the quest log in the pause menu (locked quests stay hidden). */
export function questLog(defs, state) {
  return state.quests
    .filter((quest) => quest.status !== 'locked')
    .map((quest) => {
      const def = defOf(defs, quest.id);
      const phase = def?.phases[quest.phase];
      return {
        id: quest.id,
        name: def?.name ?? quest.id,
        location: def?.location ?? '',
        status: quest.status,
        phase: quest.phase,
        totalPhases: def?.phases.length ?? 0,
        phaseText: quest.status === 'active' && phase ? phase.text : '',
        timeLeft: quest.timeLeft,
      };
    });
}

/** 0..1 progress through a quest (phases completed / total). */
export function questProgress(def, quest) {
  if (!def || !quest) return 0;
  if (quest.status === 'completed') return 1;
  return Math.min(1, quest.phase / def.phases.length);
}
