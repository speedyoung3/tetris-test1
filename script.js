const ROWS = 20;
const COLS = 10;
const SCORE_TABLE = [0, 100, 300, 500, 800];

const PIECES = {
  I: { color: 'cyan', matrix: [[1, 1, 1, 1]] },
  O: { color: 'yellow', matrix: [[1, 1], [1, 1]] },
  T: { color: 'purple', matrix: [[0, 1, 0], [1, 1, 1]] },
  S: { color: 'green', matrix: [[0, 1, 1], [1, 1, 0]] },
  Z: { color: 'pink', matrix: [[1, 1, 0], [0, 1, 1]] },
  J: { color: 'blue', matrix: [[1, 0, 0], [1, 1, 1]] },
  L: { color: 'orange', matrix: [[0, 0, 1], [1, 1, 1]] },
};

const boardElement = document.querySelector('#game-board');
const previewElement = document.querySelector('#next-preview');
const scoreElement = document.querySelector('#score');
const levelElement = document.querySelector('#level');
const linesElement = document.querySelector('#lines');
const statusPill = document.querySelector('#status-pill');
const statusText = document.querySelector('#status-text');
const pauseButton = document.querySelector('#pause-button');
const pauseLabel = document.querySelector('#pause-label');
const pauseIcon = document.querySelector('#pause-icon');
const overlay = document.querySelector('#game-overlay');
const overlayIcon = document.querySelector('#overlay-icon');
const overlayEyebrow = document.querySelector('#overlay-eyebrow');
const overlayTitle = document.querySelector('#overlay-title');
const overlayMessage = document.querySelector('#overlay-message');
const overlayResult = document.querySelector('#overlay-result');
const overlayAction = document.querySelector('#overlay-action');

const boardCells = [];
for (let index = 0; index < ROWS * COLS; index += 1) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.setAttribute('role', 'gridcell');
  boardElement.appendChild(cell);
  boardCells.push(cell);
}

for (let index = 0; index < 16; index += 1) {
  const cell = document.createElement('div');
  cell.className = 'preview-cell';
  previewElement.appendChild(cell);
}

let board;
let current;
let next;
let bag;
let score;
let lines;
let level;
let gameStatus;
let lastTime = 0;
let dropAccumulator = 0;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function shuffledBag() {
  const types = Object.keys(PIECES);
  for (let index = types.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [types[index], types[randomIndex]] = [types[randomIndex], types[index]];
  }
  return types;
}

function getNextType() {
  if (bag.length === 0) bag = shuffledBag();
  return bag.pop();
}

function copyMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function makePiece(type) {
  const matrix = copyMatrix(PIECES[type].matrix);
  return {
    type,
    color: PIECES[type].color,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: 0,
  };
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, column) => matrix.map((row) => row[column]).reverse());
}

function collides(piece, x = piece.x, y = piece.y, matrix = piece.matrix) {
  for (let row = 0; row < matrix.length; row += 1) {
    for (let column = 0; column < matrix[row].length; column += 1) {
      if (!matrix[row][column]) continue;
      const boardX = x + column;
      const boardY = y + row;
      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
      if (boardY >= 0 && board[boardY][boardX]) return true;
    }
  }
  return false;
}

function setStatus(status) {
  gameStatus = status;
  const statusMap = {
    playing: ['플레이 중', 'live'],
    paused: ['일시정지', 'paused'],
    gameover: ['게임 오버', 'gameover'],
  };
  const [label, className] = statusMap[status];
  statusText.textContent = label;
  statusPill.className = `status-pill ${className}`;
  pauseLabel.textContent = status === 'paused' ? '계속하기' : '일시정지';
  pauseIcon.textContent = status === 'paused' ? '▶' : 'Ⅱ';
}

function resetGame() {
  board = createBoard();
  bag = [];
  score = 0;
  lines = 0;
  level = 1;
  current = null;
  next = makePiece(getNextType());
  dropAccumulator = 0;
  lastTime = performance.now();
  setStatus('playing');
  hideOverlay();
  spawnPiece();
  updateScoreboard();
  render();
}

function spawnPiece() {
  current = next || makePiece(getNextType());
  current.x = Math.floor((COLS - current.matrix[0].length) / 2);
  current.y = 0;
  next = makePiece(getNextType());
  if (collides(current)) endGame();
}

function tryMove(dx, dy) {
  if (gameStatus !== 'playing') return false;
  const nextX = current.x + dx;
  const nextY = current.y + dy;
  if (collides(current, nextX, nextY)) return false;
  current.x = nextX;
  current.y = nextY;
  return true;
}

function softDrop() {
  if (tryMove(0, 1)) {
    score += 1;
    updateScoreboard();
    render();
  } else {
    lockPiece();
  }
}

function hardDrop() {
  if (gameStatus !== 'playing') return;
  let distance = 0;
  while (tryMove(0, 1)) distance += 1;
  score += distance * 2;
  lockPiece();
}

function rotate() {
  if (gameStatus !== 'playing') return;
  tryRotate(rotateMatrix(current.matrix));
}

function rotateCounterClockwise() {
  if (gameStatus !== 'playing') return;
  const rotated = rotateMatrix(rotateMatrix(rotateMatrix(current.matrix)));
  tryRotate(rotated);
}

function tryRotate(rotated) {
  const kicks = [0, -1, 1, -2, 2];
  for (const offset of kicks) {
    if (!collides(current, current.x + offset, current.y, rotated)) {
      current.matrix = rotated;
      current.x += offset;
      render();
      return true;
    }
  }
  return false;
}

function lockPiece() {
  if (gameStatus !== 'playing') return;
  current.matrix.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (!value) return;
      const y = current.y + rowIndex;
      const x = current.x + columnIndex;
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) board[y][x] = current.color;
    });
  });

  const cleared = clearLines();
  if (cleared > 0) {
    score += SCORE_TABLE[cleared] * level;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
  }
  spawnPiece();
  dropAccumulator = 0;
  updateScoreboard();
  render();
}

function clearLines() {
  const remaining = board.filter((row) => row.some((cell) => !cell));
  const cleared = ROWS - remaining.length;
  while (remaining.length < ROWS) remaining.unshift(Array(COLS).fill(null));
  board = remaining;
  return cleared;
}

function getGhostDistance() {
  let distance = 0;
  while (!collides(current, current.x, current.y + distance + 1)) distance += 1;
  return distance;
}

function paintCell(cell, color, type) {
  cell.className = `cell ${type} color-${color}`;
}

function render() {
  boardCells.forEach((cell, index) => {
    const row = Math.floor(index / COLS);
    const column = index % COLS;
    const color = board[row][column];
    cell.className = color ? `cell filled color-${color}` : 'cell';
  });

  if (current && gameStatus !== 'gameover') {
    const ghostDistance = getGhostDistance();
    current.matrix.forEach((row, rowIndex) => {
      row.forEach((value, columnIndex) => {
        if (!value) return;
        const ghostY = current.y + ghostDistance + rowIndex;
        const ghostX = current.x + columnIndex;
        if (ghostY >= 0 && ghostY < ROWS && ghostX >= 0 && ghostX < COLS && !board[ghostY][ghostX]) {
          paintCell(boardCells[ghostY * COLS + ghostX], current.color, 'ghost');
        }
      });
    });
    current.matrix.forEach((row, rowIndex) => {
      row.forEach((value, columnIndex) => {
        if (!value) return;
        const y = current.y + rowIndex;
        const x = current.x + columnIndex;
        if (y >= 0 && y < ROWS && x >= 0 && x < COLS) paintCell(boardCells[y * COLS + x], current.color, 'active');
      });
    });
  }
  renderPreview();
}

function renderPreview() {
  const cells = [...previewElement.children];
  cells.forEach((cell) => { cell.className = 'preview-cell'; });
  if (!next) return;
  const matrix = next.matrix;
  const offsetX = Math.floor((4 - matrix[0].length) / 2);
  const offsetY = Math.floor((4 - matrix.length) / 2);
  matrix.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (!value) return;
      const x = offsetX + columnIndex;
      const y = offsetY + rowIndex;
      if (x >= 0 && x < 4 && y >= 0 && y < 4) {
        cells[y * 4 + x].className = `preview-cell filled color-${next.color}`;
        cells[y * 4 + x].style.setProperty('--piece-color', `var(--${next.color})`);
      }
    });
  });
}

function updateScoreboard() {
  scoreElement.textContent = String(score).padStart(6, '0');
  levelElement.textContent = String(level).padStart(2, '0');
  linesElement.textContent = String(lines).padStart(2, '0');
}

function showOverlay(mode) {
  overlay.classList.remove('is-hidden');
  if (mode === 'paused') {
    overlayIcon.textContent = 'Ⅱ';
    overlayEyebrow.textContent = 'PAUSED';
    overlayTitle.textContent = '잠시 멈췄어요';
    overlayMessage.textContent = '준비가 되면 게임을 계속하세요.';
    overlayResult.innerHTML = '현재 점수 <strong>' + score.toLocaleString('ko-KR') + '</strong>';
    overlayAction.textContent = '계속하기';
  } else {
    overlayIcon.textContent = '✦';
    overlayEyebrow.textContent = 'GAME OVER';
    overlayTitle.textContent = '게임 오버';
    overlayMessage.textContent = '블록이 맨 위까지 쌓였습니다.';
    overlayResult.innerHTML = '최종 점수 <strong>' + score.toLocaleString('ko-KR') + '</strong>';
    overlayAction.textContent = '다시 하기';
  }
}

function hideOverlay() {
  overlay.classList.add('is-hidden');
}

function endGame() {
  setStatus('gameover');
  showOverlay('gameover');
  render();
}

function togglePause() {
  if (gameStatus === 'gameover') return;
  if (gameStatus === 'paused') {
    setStatus('playing');
    hideOverlay();
    lastTime = performance.now();
  } else {
    setStatus('paused');
    showOverlay('paused');
  }
  render();
}

function handleAction(action) {
  if (action === 'pause') return togglePause();
  if (action === 'restart') return resetGame();
  if (action === 'left' && gameStatus === 'playing') { tryMove(-1, 0); render(); }
  if (action === 'right' && gameStatus === 'playing') { tryMove(1, 0); render(); }
  if (action === 'rotate') rotate();
  if (action === 'soft' && gameStatus === 'playing') softDrop();
  if (action === 'hard') hardDrop();
}

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  const handledKeys = ['arrowleft', 'arrowright', 'arrowdown', 'arrowup', ' ', 'p', 'escape', 'r', 'z'];
  if (!handledKeys.includes(key)) return;
  event.preventDefault();
  if (key === 'arrowleft') handleAction('left');
  if (key === 'arrowright') handleAction('right');
  if (key === 'arrowdown') handleAction('soft');
  if (key === 'arrowup') handleAction('rotate');
  if (key === ' ') handleAction('hard');
  if (key === 'p' || key === 'escape') handleAction('pause');
  if (key === 'r') handleAction('restart');
  if (key === 'z') rotateCounterClockwise();
});

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => handleAction(button.dataset.action));
});
pauseButton.addEventListener('click', () => handleAction('pause'));
document.querySelector('#restart-button').addEventListener('click', () => handleAction('restart'));
overlayAction.addEventListener('click', () => {
  if (gameStatus === 'paused') togglePause();
  else resetGame();
});

function gameLoop(time) {
  const delta = time - lastTime;
  lastTime = time;
  if (gameStatus === 'playing') {
    dropAccumulator += delta;
    const dropInterval = Math.max(90, 760 - ((level - 1) * 60));
    if (dropAccumulator >= dropInterval) {
      if (!tryMove(0, 1)) lockPiece();
      dropAccumulator = 0;
      render();
    }
  }
  requestAnimationFrame(gameLoop);
}

resetGame();
requestAnimationFrame(gameLoop);
