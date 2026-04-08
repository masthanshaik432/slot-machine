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
  themePath: 'themes/desi-movie-set/theme.json',

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
    reelDurationMs: 1500
  },

  animation: {
    stripMinSymbols: 22,
    stripMaxSymbols: 34,
    accelPhase: 0.2,
    cruisePhase: 0.6,
    decelPhase: 0.2
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
  currentWinningLines: [],
  theme: null
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

const reelRefs = [];
let highlightTimeoutId = null;

// =========================
// INITIALIZATION
// =========================

bootstrap();

async function bootstrap() {
  await loadTheme();
  applyThemeUI();
  init();
}

function init() {
  buildGrid();
  buildPaylineOverlay();
  state.grid = generateRandomGrid();
  renderGrid(state.grid);
  updateUI();
  bindEvents();
}

async function loadTheme() {
  try {
    const response = await fetch(CONFIG.themePath, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Theme fetch failed with status ${response.status}`);
    }

    const parsedTheme = await response.json();
    state.theme = parsedTheme;
  } catch (error) {
    state.theme = null;
    console.warn('Theme not loaded; falling back to default symbol labels.', error);
  }
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
  reelRefs.length = 0;

  for (let reel = 0; reel < CONFIG.reels; reel += 1) {
    const reelWindowEl = document.createElement('div');
    reelWindowEl.className = 'reel-window';

    const reelStripEl = document.createElement('div');
    reelStripEl.className = 'reel-strip';

    reelWindowEl.appendChild(reelStripEl);
    reelGridEl.appendChild(reelWindowEl);

    reelRefs.push({
      windowEl: reelWindowEl,
      stripEl: reelStripEl
    });
  }
}

function renderGrid(grid) {
  for (let reel = 0; reel < CONFIG.reels; reel += 1) {
    const column = getColumnFromGrid(grid, reel);
    renderReelStrip(reel, column);
    setReelStripOffset(reel, 0);
  }
}

function buildPaylineOverlay() {
  paylineOverlayEl.innerHTML = '';

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
  });
}

function highlightWinningLines(indices) {
  // Intentionally disabled visually (paylines kept hidden by requirement).
  void indices;
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

function renderReelStrip(reelIndex, symbolIds) {
  const stripEl = reelRefs[reelIndex].stripEl;
  stripEl.innerHTML = '';

  for (const symbolId of symbolIds) {
    const cellEl = document.createElement('div');
    cellEl.className = 'symbol-cell';
    renderSymbolInCell(cellEl, symbolId);
    stripEl.appendChild(cellEl);
  }
}

function setReelStripOffset(reelIndex, offsetPx) {
  reelRefs[reelIndex].stripEl.style.transform = `translateY(${-offsetPx}px)`;
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
  clearWinningHighlights();
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
  highlightWinningCells(result.highlightCoords, 1500);

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
  const reelPromises = [];

  for (let reel = 0; reel < CONFIG.reels; reel += 1) {
    const finalColumn = getColumnFromGrid(finalGrid, reel);
    const stripSymbols = generateSpinStrip(finalColumn);
    const startDelay = reel * CONFIG.spinTiming.betweenReelsDelayMs;
    const duration =
      CONFIG.spinTiming.reelDurationMs +
      CONFIG.spinTiming.baseReelStopDelayMs +
      (reel * CONFIG.spinTiming.betweenReelsDelayMs);

    const promise = sleep(startDelay)
      .then(() => animateSingleReel(reel, stripSymbols, duration))
      .then(() => {
        playReelStopSound(reel);
      });

    reelPromises.push(promise);
  }

  await Promise.all(reelPromises);
  renderGrid(finalGrid);
  await sleep(100);
}

function animateSingleReel(reelIndex, stripSymbols, durationMs) {
  renderReelStrip(reelIndex, stripSymbols);

  const symbolHeight = getSymbolHeightPx();
  const finalOffset = (stripSymbols.length - CONFIG.rows) * symbolHeight;
  const startTime = performance.now();

  return new Promise((resolve) => {
    const tick = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / durationMs, 1);
      const progress = spinProgress(t);
      setReelStripOffset(reelIndex, finalOffset * progress);

      if (t < 1) {
        requestAnimationFrame(tick);
        return;
      }

      setReelStripOffset(reelIndex, finalOffset);
      resolve();
    };

    requestAnimationFrame(tick);
  });
}

function spinProgress(t) {
  const accelEnd = CONFIG.animation.accelPhase;
  const cruiseEnd = accelEnd + CONFIG.animation.cruisePhase;

  if (t <= accelEnd) {
    const u = t / accelEnd;
    return accelEnd * easeInQuad(u);
  }

  if (t <= cruiseEnd) {
    const u = (t - accelEnd) / CONFIG.animation.cruisePhase;
    return accelEnd + (CONFIG.animation.cruisePhase * u);
  }

  const u = (t - cruiseEnd) / CONFIG.animation.decelPhase;
  return cruiseEnd + (CONFIG.animation.decelPhase * easeOutQuad(u));
}

function easeInQuad(x) {
  return x * x;
}

function easeOutQuad(x) {
  return 1 - ((1 - x) * (1 - x));
}

function generateSpinStrip(finalColumn) {
  const randomCount = randomIntInclusive(CONFIG.animation.stripMinSymbols, CONFIG.animation.stripMaxSymbols);
  const strip = [];

  for (let i = 0; i < randomCount; i += 1) {
    strip.push(getRandomSymbolId());
  }

  strip.push(...finalColumn);
  return strip;
}

function getColumnFromGrid(grid, reelIndex) {
  return [grid[0][reelIndex], grid[1][reelIndex], grid[2][reelIndex]];
}

function getSymbolHeightPx() {
  const cssValue = getComputedStyle(document.documentElement).getPropertyValue('--cell-size').trim();
  const parsed = parseFloat(cssValue);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return 100;
}

// =========================
// GAME RULES / EVALUATION
// =========================

function evaluateSpin(grid, bet, bonusMultiplier) {
  let totalWin = 0;
  const winningLines = [];
  const winningLineCoordinates = [];
  const highlightCoords = [];

  CONFIG.paylines.forEach((line, lineIndex) => {
    const symbolsOnLine = line.map((rowIndex, reelIndex) => grid[rowIndex][reelIndex]);
    const lineResult = evaluatePayline(symbolsOnLine, line, bet, bonusMultiplier);

    if (lineResult.win > 0) {
      totalWin += lineResult.win;
      winningLines.push(lineIndex);
      winningLineCoordinates.push({
        lineIndex,
        coords: lineResult.winningCoords
      });
      highlightCoords.push(...lineResult.winningCoords);
    }
  });

  const scatterCount = countSymbolInGrid(grid, 'SCATTER');
  const scatterCoords = scatterCount >= 3 ? getSymbolCoordinatesInGrid(grid, 'SCATTER') : [];
  const scatterMultiplier = getPayoutMultiplier('SCATTER', scatterCount);

  if (scatterMultiplier > 0) {
    totalWin += Math.floor(bet * scatterMultiplier * bonusMultiplier);
    highlightCoords.push(...scatterCoords);
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
    winningLineCoordinates,
    scatterCount,
    scatterCoords,
    freeSpinsAwarded,
    randomBonusAwarded,
    highlightCoords: dedupeCoords(highlightCoords)
  };
}

function evaluatePayline(symbols, paylineRows, bet, bonusMultiplier) {
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
    return { win: 0, symbol: targetSymbol || WILD, count: consecutive, winningCoords: [] };
  }

  if (targetSymbol === null) {
    targetSymbol = WILD;
  }

  const multiplier = getPayoutMultiplier(targetSymbol, consecutive);
  if (multiplier <= 0) {
    return { win: 0, symbol: targetSymbol, count: consecutive, winningCoords: [] };
  }

  const win = Math.floor(bet * multiplier * bonusMultiplier);
  const winningCoords = Array.from({ length: consecutive }, (_, reelIndex) => ({
    reel: reelIndex,
    row: paylineRows[reelIndex]
  }));

  return { win, symbol: targetSymbol, count: consecutive, winningCoords };
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

function getSymbolCoordinatesInGrid(grid, symbolId) {
  const coords = [];
  for (let row = 0; row < CONFIG.rows; row += 1) {
    for (let reel = 0; reel < CONFIG.reels; reel += 1) {
      if (grid[row][reel] === symbolId) {
        coords.push({ reel, row });
      }
    }
  }
  return coords;
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

function getThemeSymbolPath(symbolId) {
  const themedSymbols = state.theme && state.theme.symbols;
  if (!themedSymbols || typeof themedSymbols !== 'object') {
    return null;
  }

  const path = themedSymbols[symbolId];
  return typeof path === 'string' && path.length > 0 ? path : null;
}

function getThemeBackgroundPath() {
  const themedUi = state.theme && state.theme.ui;
  if (!themedUi || typeof themedUi !== 'object') {
    return null;
  }

  const path = themedUi.background;
  return typeof path === 'string' && path.length > 0 ? path : null;
}

function applyThemeUI() {
  const backgroundPath = getThemeBackgroundPath();
  if (!backgroundPath) {
    return;
  }

  document.body.style.backgroundImage = `url("${backgroundPath}")`;
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundPosition = 'center';
  document.body.style.backgroundRepeat = 'no-repeat';
  document.body.style.backgroundAttachment = 'fixed';
}

function renderSymbolInCell(cell, symbolId) {
  const themeSymbolPath = getThemeSymbolPath(symbolId);
  const symbol = getSymbolById(symbolId);
  const contentEl = document.createElement('div');
  contentEl.className = 'symbol-content';
  cell.innerHTML = '';

  if (themeSymbolPath) {
    const img = document.createElement('img');
    img.src = themeSymbolPath;
    img.alt = `${symbol.id} symbol`;
    img.onerror = () => {
      img.remove();
      contentEl.textContent = symbol.label;
    };
    contentEl.appendChild(img);
    cell.appendChild(contentEl);
    return;
  }

  contentEl.textContent = symbol.label;
  cell.appendChild(contentEl);
}

function getVisibleCellElement(reelIndex, rowIndex) {
  const reelRef = reelRefs[reelIndex];
  if (!reelRef || !reelRef.stripEl) return null;
  return reelRef.stripEl.children[rowIndex] || null;
}

function clearWinningHighlights() {
  if (highlightTimeoutId) {
    clearTimeout(highlightTimeoutId);
    highlightTimeoutId = null;
  }

  const winningCells = reelGridEl.querySelectorAll('.symbol-cell.win');
  winningCells.forEach((cell) => cell.classList.remove('win'));
}

function highlightWinningCells(coords, durationMs) {
  clearWinningHighlights();

  coords.forEach(({ reel, row }) => {
    const cell = getVisibleCellElement(reel, row);
    if (cell) {
      cell.classList.add('win');
    }
  });

  highlightTimeoutId = setTimeout(() => {
    const winningCells = reelGridEl.querySelectorAll('.symbol-cell.win');
    winningCells.forEach((cell) => cell.classList.remove('win'));
    highlightTimeoutId = null;
  }, durationMs);
}

function dedupeCoords(coords) {
  const seen = new Set();
  const deduped = [];
  for (const coord of coords) {
    const key = `${coord.reel}-${coord.row}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(coord);
  }
  return deduped;
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
