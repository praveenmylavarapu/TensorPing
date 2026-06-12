/*
 * Proprietary and Confidential.
 * Copyright (c) 2026. All rights reserved.
 */
const MAX_ACTIONS = 6;
const OPERATORS = ['+', '-', 'x'];
const FEEDBACK_TO_EMOJI = {
  correct: '🟦',
  present: '🟪',
  absent: '⬛',
};

const elements = {
  actionsCount: document.getElementById('actions-count'),
  actionsPill: document.querySelector('.actions-pill'),
  finalOutput: document.getElementById('final-output'),
  pulseInput: document.getElementById('pulse-input'),
  pulseBtn: document.getElementById('pulse-btn'),
  guessBtn: document.getElementById('guess-btn'),
  message: document.getElementById('message'),
  guessSlots: Array.from(document.querySelectorAll('.guess-slot')),
  historyList: document.getElementById('history-list'),
  lines: [
    document.getElementById('line-1'),
    document.getElementById('line-2'),
    document.getElementById('line-3'),
  ],
  nodes: [
    document.getElementById('node-a'),
    document.getElementById('node-b'),
    document.getElementById('node-c'),
    document.getElementById('node-d'),
  ],
  packet: document.getElementById('packet'),
  modal: document.getElementById('result-modal'),
  resultTitle: document.getElementById('result-title'),
  resultSummary: document.getElementById('result-summary'),
  shareBtn: document.getElementById('share-btn'),
  closeModalBtn: document.getElementById('close-modal-btn'),
};

const state = {
  actionsUsed: 0,
  isAnimating: false,
  isGameOver: false,
  history: [],
  pulseObservations: [],
  dailyKey: getDateKey(),
  secretOps: [],
};

initialize();

function initialize() {
  state.secretOps = generateDailySequence(state.dailyKey);
  updateActionUI();
  elements.pulseBtn.addEventListener('click', handlePulse);
  elements.guessBtn.addEventListener('click', handleGuessSubmit);
  elements.shareBtn.addEventListener('click', shareScore);
  elements.closeModalBtn.addEventListener('click', () => elements.modal.close());
}

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashStringToSeed(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function rng() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateDailySequence(dateKey) {
  const rng = mulberry32(hashStringToSeed(dateKey));
  return Array.from({ length: 3 }, () => ({
    op: OPERATORS[Math.floor(rng() * OPERATORS.length)],
    value: Math.floor(rng() * 5) + 1,
  }));
}

function applyOperation(input, operation) {
  if (operation.op === '+') return input + operation.value;
  if (operation.op === '-') return input - operation.value;
  return input * operation.value;
}

function runSequence(input, sequence = state.secretOps) {
  return sequence.reduce((total, op) => applyOperation(total, op), input);
}

async function handlePulse() {
  if (!canUseAction()) return;

  const inputValue = Number(elements.pulseInput.value);
  if (!Number.isInteger(inputValue) || inputValue < 1 || inputValue > 20) {
    setMessage('Enter a whole number from 1 to 20.');
    return;
  }

  beginAction();
  setMessage('Pulse launched...');
  elements.finalOutput.textContent = '...';

  const finalValue = runSequence(inputValue);
  await animatePulseAcrossNetwork();

  const pulseEntry = { type: 'pulse', input: inputValue, output: finalValue };
  state.pulseObservations.push({ input: inputValue, output: finalValue });
  state.history.push(pulseEntry);
  addHistoryRow(pulseEntry);

  elements.finalOutput.textContent = String(finalValue);
  setMessage('Output captured at Node D.');
  endAction();
}

function getCurrentGuess() {
  return elements.guessSlots.map((slot) => ({
    op: slot.querySelector('.op-select').value,
    value: Number(slot.querySelector('.num-select').value),
  }));
}

function validateGuessAgainstPulses(guess) {
  return state.pulseObservations
    .map((pulse) => ({
      input: pulse.input,
      expected: pulse.output,
      guessed: runSequence(pulse.input, guess),
    }))
    .filter((result) => result.guessed !== result.expected);
}

function evaluateGuess(guess, answer) {
  const result = Array(guess.length).fill('absent');
  const answerUsed = Array(answer.length).fill(false);
  const guessUsed = Array(guess.length).fill(false);

  for (let i = 0; i < guess.length; i += 1) {
    if (guess[i].op === answer[i].op && guess[i].value === answer[i].value) {
      result[i] = 'correct';
      answerUsed[i] = true;
      guessUsed[i] = true;
    }
  }

  for (let i = 0; i < guess.length; i += 1) {
    if (guessUsed[i]) continue;

    for (let j = 0; j < answer.length; j += 1) {
      if (answerUsed[j]) continue;
      if (guess[i].op === answer[j].op && guess[i].value === answer[j].value) {
        result[i] = 'present';
        answerUsed[j] = true;
        break;
      }
    }
  }

  return result;
}

function applySlotFeedback(feedback) {
  elements.guessSlots.forEach((slot, index) => {
    slot.classList.remove('feedback-correct', 'feedback-present', 'feedback-absent', 'flash');
    slot.classList.add(`feedback-${feedback[index]}`);
    slot.classList.add('flash');
    window.setTimeout(() => slot.classList.remove('flash'), 350);
  });
}

function handleGuessSubmit() {
  if (!canUseAction()) return;

  const guess = getCurrentGuess();
  const mismatches = validateGuessAgainstPulses(guess);

  if (mismatches.length > 0) {
    const mismatch = mismatches[0];
    elements.finalOutput.textContent = String(mismatch.guessed);
    setMessage(
      `Guess not accepted: for pulse ${mismatch.input}, recorded output is ${mismatch.expected} but this guess gives ${mismatch.guessed}.`
    );
    return;
  }

  beginAction();
  const feedback = evaluateGuess(guess, state.secretOps);
  applySlotFeedback(feedback);

  const guessEntry = { type: 'guess', feedback: [...feedback] };
  state.history.push(guessEntry);
  addHistoryRow(guessEntry);

  const solved = feedback.every((status) => status === 'correct');
  if (solved) {
    setMessage('Network solved.');
    endGame(true);
    return;
  }

  setMessage('Guess accepted. Keep deducing.');
  endAction();
}

function addHistoryRow(entry) {
  const row = document.createElement('div');
  row.className = 'history-row';

  if (entry.type === 'pulse') {
    row.innerHTML = `<span>⚡ Pulse ${entry.input}</span><strong>${entry.output}</strong>`;
  } else {
    row.classList.add('history-guess');
    entry.feedback.forEach((status) => {
      const chip = document.createElement('span');
      chip.className = `history-chip ${status}`;
      chip.textContent = FEEDBACK_TO_EMOJI[status];
      row.appendChild(chip);
    });
  }

  elements.historyList.prepend(row);
}

function canUseAction() {
  if (state.isGameOver) {
    setMessage('Game over. Start again tomorrow for a new TensorPing puzzle.');
    return false;
  }
  if (state.isAnimating) return false;
  if (state.actionsUsed >= MAX_ACTIONS) {
    endGame(false);
    return false;
  }
  return true;
}

function beginAction() {
  state.actionsUsed += 1;
  updateActionUI();
  toggleControls(false);
}

function endAction() {
  if (state.actionsUsed >= MAX_ACTIONS && !state.isGameOver) {
    endGame(false);
    return;
  }
  toggleControls(true);
}

function toggleControls(enabled) {
  elements.pulseBtn.disabled = !enabled;
  elements.guessBtn.disabled = !enabled;
  elements.pulseInput.disabled = !enabled;

  elements.guessSlots.forEach((slot) => {
    slot.querySelectorAll('select').forEach((select) => {
      select.disabled = !enabled;
    });
  });
}

function updateActionUI() {
  elements.actionsCount.textContent = String(state.actionsUsed);
  elements.actionsPill.classList.remove('bump');
  window.requestAnimationFrame(() => elements.actionsPill.classList.add('bump'));
}

function setMessage(text) {
  elements.message.textContent = text;
}

async function animatePulseAcrossNetwork() {
  state.isAnimating = true;
  const pathStops = [
    elements.nodes[0].getBoundingClientRect(),
    elements.nodes[1].getBoundingClientRect(),
    elements.nodes[2].getBoundingClientRect(),
    elements.nodes[3].getBoundingClientRect(),
  ];

  const networkRect = document.querySelector('.network').getBoundingClientRect();
  placePacket(pathStops[0], networkRect);
  await wait(100);

  for (let i = 0; i < elements.lines.length; i += 1) {
    elements.lines[i].classList.add('active');
    placePacket(pathStops[i + 1], networkRect);
    await wait(450);
    elements.lines[i].classList.remove('active');
  }

  elements.packet.style.transform = 'translate(-999px, -50%)';
  state.isAnimating = false;
}

function placePacket(nodeRect, networkRect) {
  const x = nodeRect.left - networkRect.left + nodeRect.width / 2 - 6;
  elements.packet.style.transform = `translate(${x}px, -50%)`;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getPuzzleNumber() {
  const base = new Date(2026, 0, 1);
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - base) / msPerDay) + 1);
}

function buildShareText() {
  const historyLines = state.history.map((entry) => {
    if (entry.type === 'pulse') return '⚡';
    return entry.feedback.map((status) => FEEDBACK_TO_EMOJI[status]).join(' ');
  });

  return [`TensorPing #${getPuzzleNumber()}`, `Actions: ${state.actionsUsed}/${MAX_ACTIONS}`, ...historyLines, `Play at ${window.location.href}`].join('\n');
}

async function shareScore() {
  const text = buildShareText();
  try {
    await navigator.clipboard.writeText(text);
    setMessage('Share text copied to clipboard.');
  } catch (error) {
    setMessage('Copy failed. You can manually copy from the modal text below.');
    elements.resultSummary.textContent = `${elements.resultSummary.textContent}\n\n${text}`;
  }
}

function endGame(isWin) {
  state.isGameOver = true;
  toggleControls(false);

  const secret = state.secretOps.map((step) => `[${step.op}${step.value}]`).join(' ');
  elements.resultTitle.textContent = isWin ? 'TensorPing Solved' : 'TensorPing Complete';
  elements.resultSummary.textContent = isWin
    ? `You solved it in ${state.actionsUsed}/${MAX_ACTIONS} actions.`
    : `Out of actions. Daily sequence: ${secret}`;

  if (!elements.modal.open) {
    elements.modal.showModal();
  }
}
