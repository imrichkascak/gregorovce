// Dialogue UI: speaker name, a line of text and numbered choices. Choices can be
// picked by click/tap, by Digit1..9, or by the touch buttons on mobile.
export function createDialogue({ onChoice }) {
  const root = document.getElementById('dialogue');
  const nameEl = document.getElementById('dialogue-name');
  const textEl = document.getElementById('dialogue-text');
  const choicesEl = document.getElementById('dialogue-choices');
  const state = { open: false, speaker: '', text: '', choices: [], questId: null };

  function show({ speaker = '', text = '', choices = [], questId = null }) {
    state.open = true;
    state.speaker = speaker;
    state.text = text;
    state.choices = choices;
    state.questId = questId;
    nameEl.textContent = speaker;
    textEl.textContent = text;
    choicesEl.innerHTML = '';
    choices.forEach((choice, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${index + 1}. ${choice.label}`;
      button.dataset.choice = choice.id;
      button.addEventListener('click', () => choose(choice.id));
      choicesEl.append(button);
    });
    root.classList.remove('hidden');
  }

  function hide() {
    state.open = false;
    state.choices = [];
    root.classList.add('hidden');
  }

  function choose(id) {
    if (!state.open) return false;
    const { questId } = state;
    hide();
    if (onChoice) onChoice(id, { questId });
    return true;
  }

  /** Keyboard bridge: Digit1..9 pick a choice, Escape closes. */
  function handleKey(code) {
    if (!state.open) return false;
    if (code === 'Escape') {
      choose('close');
      return true;
    }
    const match = /^Digit([1-9])$/.exec(code);
    if (match) {
      const choice = state.choices[Number(match[1]) - 1];
      if (choice) choose(choice.id);
      return true;
    }
    return true; // swallow game keys while the dialogue is open
  }

  return { state, show, hide, choose, handleKey, root };
}
