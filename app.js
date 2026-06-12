/*
 * Proprietary and Confidential.
 * Copyright (c) 2026. All rights reserved.
 */
const MAX_ACTIONS = 6;
const OPERATORS = ['+', '-', 'x'];

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
  resultActions: document.getElementById('result-actions'),
  resultSequenceRow: document.getElementById('result-sequence-row'),
  resultSequence: document.getElementById('result-sequence'),
  shareBtn: document.getElementById('share-btn'),
  closeModalBtn: document.getElementById('close-modal-btn'),

  // New tab and modal elements
  tabPulse: document.getElementById('tab-pulse'),
  tabGuess: document.getElementById('tab-guess'),
  contentPulse: document.getElementById('content-pulse'),
  contentGuess: document.getElementById('content-guess'),
  helpBtn: document.getElementById('help-btn'),
  helpModal: document.getElementById('help-modal'),
  closeHelpBtn: document.getElementById('close-help-btn'),
};

const state = {
  actionsUsed: 0,
  isAnimating: false,
  isGameOver: false,
  isWin: false,
  history: [],
  pulseObservations: [],
  dailyKey: getDateKey(),
  secretOps: [],
  pulseCount: 0,
  guessCount: 0,
};

initialize();

function initialize() {
  state.secretOps = generateDailySequence(state.dailyKey);
  updateActionUI();

  // Event listeners
  elements.pulseBtn.addEventListener('click', handlePulse);
  elements.guessBtn.addEventListener('click', handleGuessSubmit);
  elements.shareBtn.addEventListener('click', shareScore);
  elements.closeModalBtn.addEventListener('click', () => elements.modal.close());

  // Tab switching
  elements.tabPulse.addEventListener('click', () => switchTab('pulse'));
  elements.tabGuess.addEventListener('click', () => switchTab('guess'));

  // Help Modal listeners
  elements.helpBtn.addEventListener('click', () => elements.helpModal.showModal());
  elements.closeHelpBtn.addEventListener('click', () => elements.helpModal.close());
  elements.helpModal.addEventListener('click', (e) => {
    if (e.target === elements.helpModal) {
      elements.helpModal.close();
    }
  });

  // Countdown timer init
  updateCountdown();
  window.setInterval(updateCountdown, 1000);
}

function switchTab(tab) {
  if (tab === 'pulse') {
    elements.tabPulse.classList.add('active');
    elements.tabGuess.classList.remove('active');
    elements.contentPulse.classList.add('active');
    elements.contentGuess.classList.remove('active');
  } else {
    elements.tabGuess.classList.add('active');
    elements.tabPulse.classList.remove('active');
    elements.contentGuess.classList.add('active');
    elements.contentPulse.classList.remove('active');
  }
}

function updateCountdown() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const diff = midnight - now;

  const hours = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, '0');
  const minutes = String(Math.floor((diff / (1000 * 60)) % 60)).padStart(2, '0');
  const seconds = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');

  const timerEl = document.getElementById('next-puzzle-time');
  if (timerEl) {
    timerEl.textContent = `${hours}:${minutes}:${seconds}`;
  }
}

function getOffsetDate() {
  const date = new Date();
  const urlParams = new URLSearchParams(window.location.search);
  const dayOffset = Number(urlParams.get('dayOffset')) || 0;
  if (dayOffset !== 0) {
    date.setDate(date.getDate() + dayOffset);
  }
  return date;
}

function getDateKey(date = getOffsetDate()) {
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
    setMessage('Enter a whole number from 1 to 20', true);
    return;
  }

  const alreadyObserved = state.pulseObservations.some((obs) => obs.input === inputValue);
  if (alreadyObserved) {
    setMessage(`Value ${inputValue} has already been pulsed`, true);
    return;
  }

  beginAction();
  setMessage('Pulse launched...');
  elements.finalOutput.textContent = '...';

  const finalValue = runSequence(inputValue);
  await animatePulseAcrossNetwork();

  state.pulseCount += 1;
  const pulseEntry = {
    type: 'pulse',
    input: inputValue,
    output: finalValue,
    index: state.pulseCount
  };

  state.pulseObservations.push({ input: inputValue, output: finalValue });
  state.history.push(pulseEntry);
  addHistoryRow(pulseEntry);

  elements.finalOutput.textContent = String(finalValue);
  setMessage('Signal returned! Scan details logged.');
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

  const alreadyGuessed = state.history.some((entry) => {
    if (entry.type !== 'guess') return false;
    return entry.guess.every((g, idx) => g.op === guess[idx].op && g.value === guess[idx].value);
  });
  if (alreadyGuessed) {
    setMessage('This guess has already been submitted', true);
    return;
  }

  const mismatches = validateGuessAgainstPulses(guess);

  if (mismatches.length > 0) {
    const mismatch = mismatches[0];
    elements.finalOutput.textContent = String(mismatch.guessed);
    setMessage(
      `Guess rejected: for input ${mismatch.input}, expected output is ${mismatch.expected} but guess yields ${mismatch.guessed}`,
      true
    );
    return;
  }

  beginAction();
  const feedback = evaluateGuess(guess, state.secretOps);
  applySlotFeedback(feedback);

  state.guessCount += 1;
  const guessEntry = {
    type: 'guess',
    feedback: [...feedback],
    guess: guess,
    index: state.guessCount
  };

  state.history.push(guessEntry);
  addHistoryRow(guessEntry);

  const solved = feedback.every((status) => status === 'correct');
  if (solved) {
    setMessage('System breached');
    endGame(true);
    return;
  }

  setMessage(getFeedbackMessage(feedback));
  endAction();
}

function getFeedbackMessage(feedback) {
  const correctCount = feedback.filter((status) => status === 'correct').length;
  const presentCount = feedback.filter((status) => status === 'present').length;

  if (correctCount === 2) {
    return 'So close! I can hear the mainframe sweating.';
  }
  if (correctCount === 1 && presentCount === 2) {
    return 'You have all the right operations! Just shuffle their positions.';
  }
  if (correctCount === 0 && presentCount === 3) {
    return 'Oh, the irony! All the right keys, but in all the wrong locks.';
  }
  if (correctCount === 0 && presentCount === 0) {
    return 'Absolute void. Are we even hacking the same network?';
  }
  if (correctCount === 1) {
    return 'A flicker of connection! We\'re breaking through!';
  }
  if (presentCount > 0) {
    return 'Faint echoes. Frequencies exist but in the wrong order.';
  }
  return 'Guess accepted. Keep deducing, agent.';
}

function addHistoryRow(entry) {
  const placeholder = elements.historyList.querySelector('.history-placeholder');
  if (placeholder) {
    placeholder.remove();
  }

  const row = document.createElement('div');
  row.className = 'history-row';

  if (entry.type === 'pulse') {
    row.innerHTML = `
      <div class="history-index">P${entry.index}</div>
      <div class="history-pulse-content">
        <div class="history-pulse-label">
          <span class="material-symbols-outlined">bolt</span>
          <span>IN: ${entry.input}</span>
        </div>
        <span class="history-pulse-value">OUT: ${entry.output}</span>
      </div>
    `;
  } else {
    let chipsHtml = '';
    entry.feedback.forEach((status, i) => {
      const guessOp = entry.guess ? `${entry.guess[i].op}${entry.guess[i].value}` : '?';
      chipsHtml += `<div class="history-chip ${status}">${guessOp}</div>`;
    });
    row.innerHTML = `
      <div class="history-index">G${entry.index}</div>
      <div class="history-chips-container">
        ${chipsHtml}
      </div>
    `;
  }

  elements.historyList.prepend(row);
}

function canUseAction() {
  if (state.isGameOver) {
    setMessage('Game over. Start again tomorrow for a new puzzle.', false);
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

function setMessage(text, isError = false) {
  elements.message.textContent = text;
  if (isError) {
    elements.message.classList.add('error');
  } else {
    elements.message.classList.remove('error');
  }
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

  // Flash Node A at the start
  elements.nodes[0].classList.add('pulse-node');
  setTimeout(() => elements.nodes[0].classList.remove('pulse-node'), 500);

  for (let i = 0; i < elements.lines.length; i += 1) {
    elements.lines[i].classList.add('active');
    placePacket(pathStops[i + 1], networkRect);
    await wait(450);
    elements.lines[i].classList.remove('active');

    // Flash corresponding node when packet lands on it
    const nodeIndex = i + 1;
    elements.nodes[nodeIndex].classList.add('pulse-node');
    setTimeout(() => elements.nodes[nodeIndex].classList.remove('pulse-node'), 500);
  }

  // Position offscreen
  elements.packet.style.transform = 'translate(-999px, -999px) translate(-50%, -50%)';
  state.isAnimating = false;
}

function placePacket(nodeRect, networkRect) {
  const x = nodeRect.left - networkRect.left + nodeRect.width / 2;
  const y = nodeRect.top - networkRect.top + nodeRect.height / 2;
  elements.packet.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getPuzzleNumber() {
  const base = new Date(2026, 6, 12);
  const now = getOffsetDate();
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - base) / msPerDay) + 1);
}

function buildShareText() {
  const historyLines = state.history.map((entry) => {
    if (entry.type === 'pulse') return '⚡  ⚡  ⚡';
    return entry.feedback.map((status) => {
      if (status === 'correct') return '🟦';
      if (status === 'present') return '🟪';
      return '⬛';
    }).join('  ');
  });

  const actionsText = state.isWin ? `${state.actionsUsed}/${MAX_ACTIONS}` : `X/${MAX_ACTIONS}`;
  const statusText = state.isWin ? '🔓 Breached' : '🔒 Locked Out';

  return [
    `TensorPing #${getPuzzleNumber()} - ${statusText}`,
    `Actions: ${actionsText}`,
    '',
    ...historyLines,
    '',
    `Play at ${window.location.href.split('?')[0]}`
  ].join('\n');
}

async function shareScore() {
  const text = buildShareText();
  try {
    await navigator.clipboard.writeText(text);
    setMessage('Score copied to clipboard');
  } catch (error) {
    setMessage('Copy failed. You can copy the score manually.');
  }
}

function endGame(isWin) {
  state.isGameOver = true;
  state.isWin = isWin;
  toggleControls(false);

  const secret = state.secretOps.map((step) => `[${step.op}${step.value}]`).join(' ');
  elements.resultTitle.textContent = isWin ? 'SYSTEM BREACH SUCCESSFUL' : 'SYSTEM LOCKOUT';
  elements.resultSummary.innerHTML = isWin
    ? 'Encryption key retrieved and decoded'
    : 'Maximum attempts exceeded<br>Daily sequence encrypted';

  elements.resultActions.textContent = `${state.actionsUsed}/${MAX_ACTIONS}`;
  elements.resultSequenceRow.hidden = !isWin;
  elements.resultSequence.textContent = isWin ? secret : '—';

  if (!elements.modal.open) {
    elements.modal.showModal();
  }
}
