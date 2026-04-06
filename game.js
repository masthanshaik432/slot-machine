/*
  Slot Machine Prototype (Phase 1)
  ---------------------------------------------------------------
  Phase 2 extension hooks:
  - Replace emoji labels with themed symbol images in `CONFIG.symbols`.
  - Add background music + SFX in `playSpinStartSound`, `playReelStopSound`, `playWinSound`.
  - Add glow/confetti/fireworks in `showCelebrationEffects`.
  - Integrate Bollywood-themed visuals/cinematics by swapping CSS + adding scene transitions.
*/

// =========================
// CONFIGURATION (TOP LEVEL)
// =========================

const CONFIG = {
  reels: 5,
  rows: 3,

  economy: {
    startingCredits: 2000,
    betOptions: [10, 20, 30, 50, 75, 100],
    defaultBet: 20
  },

  symbols: [
    // weight controls frequency: higher = more common
    { id: 'CHERRY', label: '🍒', weight: 28 },
    { id: 'LEMON', label: '🍋', weight: 24 },
    { id: 'BELL', label: '🔔', weight: 18 },
    { id: 'STAR', label: '⭐', weight: 14 },
    { id: 'GEM', label: '💎', weight: 9 },
    { id: 'WILD', label: '🃏', weight: 7, special: 'wild' },
    { id: 'SCATTER', label: '🌸', weight: 5, special: 'scatter' },
    { id: 'JACKPOT', label: '👑', weight: 2, special: 'jackpot' }
  ],

  // Expand by adding new arrays of 5 row indexes.
  // Row indexes: 0 = top, 1 = middle, 2 = bottom.
  paylines: [
    [0, 0, 0, 0, 0], // Top
    [1, 1, 1, 1, 1], // Middle
    [2, 2, 2, 2, 2], // Bottom
    [0, 1, 2, 1, 0], // V shape
    [2, 1, 0, 1, 2]  // Inverted V
  ],

  // Multipliers applied to total bet.
  // For symbols with no matching count key, payout is 0.
  paytable: {
    CHERRY: { 3: 2, 4: 4, 5: 8 },
    LEMON: { 3: 3, 4: 6, 5: 12 },
    BELL: { 3: 5, 4: 10, 5: 20 },
    STAR: { 3: 8, 4: 16, 5: 30 },
    GEM: { 3: 12, 4: 24, 5: 50 },
    JACKPOT: { 3: 30, 4: 120, 5: 500 },
    WILD: { 3: 10, 4: 25, 5: 60 },
    SCATTER: { 3: 2, 4: 10, 5: 40 }
  },

  freeSpins: {
    // Triggered by scatters anywhere on screen.
    triggerByScatterCount: {
      3: 8,
      4: 12,
      5: 18
    },
    bonusMultipliers: [2, 3],
    // Optional small random chance to grant extra spins on base game spins.
    randomBonusChance: 0.03,
    randomBonusSpinsRange: [1, 3]
  },

  spinTiming: {
    baseReelStopDelayMs: 650,
    betweenReelsDelayMs: 260,
    rollingTickMs: 85
  }
};

// =========================
// STATE
// =========================

const state = {
  credits: CONFIG.economy.startingCredits,
  betIndex: CONFIG.economy.betOptions.indexOf(CONFIG.economy.defaultBet),
  lastWin: 0,
  freeSpins: 0,
  bonusMultiplier: 1,
  isSpinning: false,
  grid: [],
  currentWinningLines: []
};

if (state.betIndex === -1) {
  state.betIndex = 0;
}

// =========================
// DOM REFERENCES
// =========================

const reelGridEl = document.getElementById('reelGrid');
const paylineOverlayEl = document.getElementById('paylineOverlay');

const creditsDisplayEl = document.getElementById('creditsDisplay');
const betDisplayEl = document.getElementById('betDisplay');
const winDisplayEl = document.getElementById('winDisplay');
const freeSpinsDisplayEl = document.getElementById('freeSpinsDisplay');
const multiplierDisplayEl = document.getElementById('multiplierDisplay');
const messageDisplayEl = document.getElementById('messageDisplay');

const betDownBtn = document.getElementById('betDownBtn');
const betUpBtn = document.getElementById('betUpBtn');
const spinBtn = document.getElementById('spinBtn');

let cellRefs = [];
let lineRefs = [];
let reelIntervals = [];

// =========================
// INITIALIZATION
// =========================

init();

function init() {
  buildGrid();
  buildPaylineOverlay();
  state.grid = generateRandomGrid();
  renderGrid(state.grid);
  updateUI();
  bindEvents();
}

function bindEvents() {
  betDownBtn.addEventListener('click', () => {
    if (state.isSpinning) return;
    state.betIndex = Math.max(0, state.betIndex - 1);
    updateUI();
  });

  betUpBtn.addEventListener('click', () => {
    if (state.isSpinning) return;
    state.betIndex = Math.min(CONFIG.economy.betOptions.length - 1, state.betIndex + 1);
    updateUI();
  });

  spinBtn.addEventListener('click', spin);
}

// =========================
// RENDERING
// =========================

function buildGrid() {
  reelGridEl.innerHTML = '';
  cellRefs = Array.from({ length: CONFIG.reels }, () => Array(CONFIG.rows));

  for (let reel = 0; reel < CONFIG.reels; reel += 1) {
    const reelEl = document.createElement('div');
    reelEl.className = 'reel';

    for (let row = 0; row < CONFIG.rows; row += 1) {
      const cellEl = document.createElement('div');
      cellEl.className = 'symbol-cell';
      cellEl.textContent = '⬛';
      reelEl.appendChild(cellEl);
      cellRefs[reel][row] = cellEl;
    }

    reelGridEl.appendChild(reelEl);
  }
}

function renderGrid(grid) {
  for (let reel = 0; reel < CONFIG.reels; reel += 1) {
    for (let row = 0; row < CONFIG.rows; row += 1) {
      const symbolId = grid[row][reel];
      const symbol = getSymbolById(symbolId);
      cellRefs[reel][row].textContent = symbol.label;
      cellRefs[reel][row].classList.remove('rolling');
    }
  }
}

function buildPaylineOverlay() {
  paylineOverlayEl.innerHTML = '';
  lineRefs = [];

  const xStep = 100 / (CONFIG.reels - 1);
  const rowCenters = [100 / 6, 50, 100 - 100 / 6];

  CONFIG.paylines.forEach((line, idx) => {
    const points = line
      .map((rowIndex, reelIndex) => `${(reelIndex * xStep).toFixed(2)},${rowCenters[rowIndex].toFixed(2)}`)
      .join(' ');

    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', points);
    polyline.setAttribute('class', 'payline');
    polyline.dataset.lineIndex = String(idx);

    paylineOverlayEl.appendChild(polyline);
    lineRefs[idx] = polyline;
  });
}

function highlightWinningLines(indices) {
  lineRefs.forEach((line, idx) => {
    line.classList.toggle('active', indices.includes(idx));
  });
}

function updateUI() {
  const currentBet = getCurrentBet();
  creditsDisplayEl.textContent = formatNumber(state.credits);
  betDisplayEl.textContent = formatNumber(currentBet);
  winDisplayEl.textContent = formatNumber(state.lastWin);
  freeSpinsDisplayEl.textContent = String(state.freeSpins);
  multiplierDisplayEl.textContent = `x${state.bonusMultiplier}`;

  betDownBtn.disabled = state.isSpinning || state.betIndex === 0;
  betUpBtn.disabled = state.isSpinning || state.betIndex === CONFIG.economy.betOptions.length - 1;
  spinBtn.disabled = state.isSpinning;
  spinBtn.textContent = state.freeSpins > 0 ? 'SPIN (FREE)' : 'SPIN';

  if (!state.isSpinning && state.freeSpins === 0 && state.credits < currentBet) {
    setMessage('Not enough credits for current bet.', 'warn');
  }
}

function setMessage(text, tone = '') {
  messageDisplayEl.textContent = text;
  messageDisplayEl.className = `message ${tone}`.trim();
}

function formatNumber(value) {
  return value.toLocaleString();
}

// =========================
// GAME FLOW
// =========================

async function spin() {
  if (state.isSpinning) return;

  const bet = getCurrentBet();
  const usingFreeSpin = state.freeSpins > 0;

  if (!usingFreeSpin && state.credits < bet) {
    setMessage('Insufficient credits. Lower your bet or top up.', 'warn');
    return;
  }

  state.isSpinning = true;
  state.lastWin = 0;
  state.currentWinningLines = [];
  highlightWinningLines([]);

  if (usingFreeSpin) {
    state.freeSpins -= 1;
    state.bonusMultiplier = randomFromArray(CONFIG.freeSpins.bonusMultipliers);
    setMessage(`Free Spin! Bonus multiplier is x${state.bonusMultiplier}.`);
  } else {
    state.credits -= bet;
    state.bonusMultiplier = 1;
    setMessage('Spinning...');
  }

  playSpinStartSound();
  updateUI();

  const finalGrid = generateRandomGrid();

  await animateSpinToGrid(finalGrid);

  state.grid = finalGrid;

  const result = evaluateSpin(finalGrid, bet, state.bonusMultiplier);
  applySpinResult(result);

  state.isSpinning = false;
  updateUI();
}

function applySpinResult(result) {
  const totalWin = result.totalWin;

  state.credits += totalWin;
  state.lastWin = totalWin;
  state.currentWinningLines = result.winningLines;

  if (result.freeSpinsAwarded > 0) {
    state.freeSpins += result.freeSpinsAwarded;
  }

  if (result.randomBonusAwarded > 0) {
    state.freeSpins += result.randomBonusAwarded;
  }

  highlightWinningLines(result.winningLines);

  if (totalWin > 0) {
    playWinSound(totalWin);
    showCelebrationEffects(totalWin);
  }

  const messages = [];

  if (totalWin > 0) {
    messages.push(`Win: ${formatNumber(totalWin)}`);
  } else {
    messages.push('No line win this spin.');
  }

  if (result.scatterCount >= 3) {
    messages.push(`Scatters: ${result.scatterCount}`);
  }

  if (result.freeSpinsAwarded > 0) {
    messages.push(`+${result.freeSpinsAwarded} free spins`);
  }

  if (result.randomBonusAwarded > 0) {
    messages.push(`Lucky bonus: +${result.randomBonusAwarded} free spins`);
  }

  setMessage(messages.join(' • '), totalWin > 0 ? 'win' : '');
}

async function animateSpinToGrid(finalGrid) {
  reelIntervals = [];

  for (let reel = 0; reel < CONFIG.reels; reel += 1) {
    startReelRolling(reel);
  }

  const stopPromises = [];

  for (let reel = 0; reel < CONFIG.reels; reel += 1) {
    const delayMs = CONFIG.spinTiming.baseReelStopDelayMs + (reel * CONFIG.spinTiming.betweenReelsDelayMs);

    const p = sleep(delayMs).then(() => {
      stopReelRolling(reel, finalGrid);
      playReelStopSound(reel);
    });

    stopPromises.push(p);
  }

  await Promise.all(stopPromises);
  await sleep(120);
}

function startReelRolling(reelIndex) {
  const intervalId = setInterval(() => {
    for (let row = 0; row < CONFIG.rows; row += 1) {
      const randomSymbol = getRandomSymbolId();
      const symbol = getSymbolById(randomSymbol);
      const cell = cellRefs[reelIndex][row];
      cell.textContent = symbol.label;
      cell.classList.add('rolling');
    }
  }, CONFIG.spinTiming.rollingTickMs);

  reelIntervals[reelIndex] = intervalId;
}

function stopReelRolling(reelIndex, finalGrid) {
  clearInterval(reelIntervals[reelIndex]);

  for (let row = 0; row < CONFIG.rows; row += 1) {
    const symbol = getSymbolById(finalGrid[row][reelIndex]);
    const cell = cellRefs[reelIndex][row];
    cell.textContent = symbol.label;
    cell.classList.remove('rolling');
  }
}

// =========================
// GAME RULES / EVALUATION
// =========================

function evaluateSpin(grid, bet, bonusMultiplier) {
  let totalWin = 0;
  const winningLines = [];

  CONFIG.paylines.forEach((line, lineIndex) => {
    const symbolsOnLine = line.map((rowIndex, reelIndex) => grid[rowIndex][reelIndex]);
    const lineResult = evaluatePayline(symbolsOnLine, bet, bonusMultiplier);

    if (lineResult.win > 0) {
      totalWin += lineResult.win;
      winningLines.push(lineIndex);
    }
  });

  const scatterCount = countSymbolInGrid(grid, 'SCATTER');
  const scatterMultiplier = getPayoutMultiplier('SCATTER', scatterCount);

  if (scatterMultiplier > 0) {
    totalWin += Math.floor(bet * scatterMultiplier * bonusMultiplier);
  }

  const freeSpinsAwarded = CONFIG.freeSpins.triggerByScatterCount[scatterCount] || 0;

  let randomBonusAwarded = 0;
  if (Math.random() < CONFIG.freeSpins.randomBonusChance) {
    randomBonusAwarded = randomIntInclusive(
      CONFIG.freeSpins.randomBonusSpinsRange[0],
      CONFIG.freeSpins.randomBonusSpinsRange[1]
    );
  }

  return {
    totalWin,
    winningLines,
    scatterCount,
    freeSpinsAwarded,
    randomBonusAwarded
  };
}

function evaluatePayline(symbols, bet, bonusMultiplier) {
  const WILD = 'WILD';
  const SCATTER = 'SCATTER';

  let targetSymbol = null;
  let consecutive = 0;

  for (let i = 0; i < symbols.length; i += 1) {
    const symbol = symbols[i];

    if (symbol === SCATTER) {
      break;
    }

    if (i === 0) {
      consecutive = 1;
      if (symbol !== WILD) targetSymbol = symbol;
      continue;
    }

    if (targetSymbol === null) {
      if (symbol === WILD) {
        consecutive += 1;
      } else {
        targetSymbol = symbol;
        consecutive += 1;
      }
      continue;
    }

    if (symbol === targetSymbol || symbol === WILD) {
      consecutive += 1;
    } else {
      break;
    }
  }

  if (consecutive < 3) {
    return { win: 0, symbol: targetSymbol || WILD, count: consecutive };
  }

  if (targetSymbol === null) {
    targetSymbol = WILD;
  }

  const multiplier = getPayoutMultiplier(targetSymbol, consecutive);
  if (multiplier <= 0) {
    return { win: 0, symbol: targetSymbol, count: consecutive };
  }

  const win = Math.floor(bet * multiplier * bonusMultiplier);
  return { win, symbol: targetSymbol, count: consecutive };
}

function getPayoutMultiplier(symbolId, count) {
  const row = CONFIG.paytable[symbolId];
  if (!row) return 0;
  return row[count] || 0;
}

function countSymbolInGrid(grid, symbolId) {
  let count = 0;
  for (let row = 0; row < CONFIG.rows; row += 1) {
    for (let reel = 0; reel < CONFIG.reels; reel += 1) {
      if (grid[row][reel] === symbolId) count += 1;
    }
  }
  return count;
}

// =========================
// RNG / SYMBOL GENERATION
// =========================

function generateRandomGrid() {
  const grid = Array.from({ length: CONFIG.rows }, () => Array(CONFIG.reels));

  for (let reel = 0; reel < CONFIG.reels; reel += 1) {
    for (let row = 0; row < CONFIG.rows; row += 1) {
      grid[row][reel] = getRandomSymbolId();
    }
  }

  return grid;
}

function getRandomSymbolId() {
  const totalWeight = CONFIG.symbols.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const symbol of CONFIG.symbols) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol.id;
  }

  return CONFIG.symbols[CONFIG.symbols.length - 1].id;
}

function getSymbolById(symbolId) {
  const symbol = CONFIG.symbols.find((s) => s.id === symbolId);
  if (!symbol) {
    throw new Error(`Unknown symbol ID: ${symbolId}`);
  }
  return symbol;
}

function getCurrentBet() {
  return CONFIG.economy.betOptions[state.betIndex];
}

// =========================
// HELPERS
// =========================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomFromArray(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// =========================
// PHASE 2 STUB HOOKS
// =========================

function playSpinStartSound() {
  // Phase 2: Hook background/SFX audio engine here.
}

function playReelStopSound(_reelIndex) {
  // Phase 2: Add per-reel stop click/chime SFX.
}

function playWinSound(_winAmount) {
  // Phase 2: Add escalating win/jackpot audio cues.
}

function showCelebrationEffects(_winAmount) {
  // Phase 2: Trigger glow, confetti, fireworks, cinematic overlays, etc.
}
