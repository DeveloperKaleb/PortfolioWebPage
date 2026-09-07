// Import the core logic engine
import { 
    generateGridHtml, 
    isWallCollision,
    isValidDirection,
    TETROMINOES,
    isTetrisCollision,
    rotatePiece,
    ACTION_VECTORS,
    keyToAction,
    TETRIS_COLORS,
    BOARD_COLORS,
    SNAKE_COLORS,
    getBoardShape,
    cellKindAt,
    CELL,
    TOY_COLORS,
    toHex,
    MINE_COLORS,
    numberColor
} from '../js/logic.js';
import {
    createGame as createMinesweeper,
    reveal as revealCell,
    toggleFlag as toggleMineFlag,
    chord as chordCell,
    countAt,
    isMine,
    isRevealed,
    isFlagged,
    flagsRemaining,
    isOver,
    STATUS as MINE_STATUS
} from '../js/minesweeper.js';
import { contrastRatio } from '../js/contrast.js';
import {
    stepFrom,
    nodeAt,
    strandEdges,
    topStrandAt,
    isOverlapCell,
    isLayeredSelfCollision,
    isUnderneath,
    freeNodes,
    overlapCellsAround,
    topOccupant
} from '../js/strands.js';

/* --- SELECTORS --- */
const snakeBoard = document.getElementById('snakeDisplay');
const toyBoard = document.getElementById('toyDisplay');
const tetrisBoard = document.getElementById('tetrisDisplay');
const tetrisScoreEl = document.getElementById('tetris-score');
const tetrisLevelEl = document.getElementById('tetris-level');

/* --- HUB / VIEW SWITCHING --- */
const hub = document.getElementById('entertainment-hub');
const views = {
    tetris: document.getElementById('tetris-system'),
    snake: document.getElementById('snake-system'),
    minesweeper: document.getElementById('minesweeper-system'),
    toy: document.getElementById('toy-system'),
};

function showView(name) {
    // Leaving a view abandons whatever was running in it. Hiding a game does not
    // stop its setInterval, so an abandoned game kept playing itself in the
    // background and eventually hit its own game-over - throwing its end-of-game
    // dialog over whichever game you had moved on to. That was a blocking alert()
    // when this was written; the dialog is in-page now, but an abandoned game
    // interrupting a live one is no better for being prettier.
    stopAllGames();
    hub.hidden = Boolean(name);
    Object.entries(views).forEach(([key, el]) => { el.hidden = key !== name; });
}

function applyHashRoute() {
    const hash = window.location.hash.slice(1);
    showView(views[hash] ? hash : null);
}

/* --- SHARED STATE --- */
let previousPickedColors = {};

/* --- STATE --- */
let gameMode = 'classic'; // 'classic' or 'donut'
let canChangeDirection = true; // NEW: The Input Lock

/* --- PART 1: THE TOY LOGIC --- */

function addColorPicker() {
    if (document.getElementById('toyColorPicker')) return;

    /* Each option is tinted with the colour it selects, with its label flipped to
       black or white for whichever reads better on it. Option styling is honoured by
       Chrome, Firefox and Edge but ignored by Safari - which is why the swatch beside
       the select exists as well. That one is an ordinary element, so it shows the
       current colour everywhere. */
    const options = TOY_COLORS.map(({ label, value }) => {
        const hex = toHex(value);
        const text = contrastRatio('#000000', hex) >= contrastRatio('#ffffff', hex) ? '#000000' : '#ffffff';
        return `<option value="${value}" style="background-color: ${value}; color: ${text}">${label}</option>`;
    }).join('');

    const colorPickerForm = document.createElement('form');
    colorPickerForm.id = 'toyColorPicker';
    colorPickerForm.innerHTML = `
        <label for="colorPicker">Paint colour:</label>
        <span id="colorSwatch" aria-hidden="true"></span>
        <select id="colorPicker">${options}</select>`;

    const arrayForm = document.getElementById('arrayForm');
    arrayForm.insertAdjacentElement('afterend', colorPickerForm);

    const picker = document.getElementById('colorPicker');
    const swatch = document.getElementById('colorSwatch');
    const showSwatch = () => { swatch.style.backgroundColor = picker.value; };
    picker.addEventListener('change', showSwatch);
    showSwatch();
}

function displayArray(event) {
    event.preventDefault();
    const columns = document.getElementById('xVal').value;
    const rows = document.getElementById('yVal').value;
    
    // 1. Generate the HTML as usual
    toyBoard.innerHTML = generateGridHtml(columns, rows);

    if (!document.getElementById('toyColorPicker')) {
        addColorPicker();
    }
    
    // Reset inputs
    document.getElementById('xVal').value = null;
    document.getElementById('yVal').value = null;
    previousPickedColors = {};
}


/* --- PART 2: THE SNAKE SYSTEM --- */
/* A segment is a NODE - { x, y, strand } - because on a crossing map the same cell
   can be two different places. On boards without crossings every strand is 0 and
   this behaves exactly like the old coordinate pair. */
let snake = [{ x: 10, y: 10, strand: 0 }, { x: 10, y: 11, strand: 0 }, { x: 10, y: 12, strand: 0 }];
let direction = { x: 0, y: -1 };
let food = { x: 5, y: 5, strand: 0 };
let score = 0;
let gameInterval = null;

/* The board a game is played on. Classic and Donut are the 20x20 square; Infinity
   is a mask-driven ribbon whose grid is not square and not fully playable. */
let currentShape = getBoardShape('classic');

// Landscape gets the wide board, portrait the transposed one, so the board is
// always oriented along the screen's long axis.
const currentOrientation = () =>
    (window.innerWidth >= window.innerHeight ? 'horizontal' : 'vertical');

/* Locked while a game runs. On a phone the pad sits directly under these, so a thumb
   reaching high hits Start and silently restarts a good run - and changing the mode
   mid-game would leave the snake on a board that no longer exists.

   Disabled rather than hidden: hiding them would reflow the whole column mid-game and
   shift the board and pad under the player's thumb. */
function setGameControlsEnabled(enabled) {
    ['modeSelect', 'startBtn', 'tetrisStartBtn'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.disabled = !enabled;
    });
}

/* The end-of-game dialog. It replaces alert(), which on a phone forced the browser
   toolbar back on screen and reset the scroll position - the nav bar reappearing and
   the pad scrolling out of reach. Being fixed to the viewport, this moves nothing. */
const gameOverEl = document.getElementById('game-over');
let restartCurrentGame = null;

function showGameOver(message, score, restart) {
    restartCurrentGame = restart;
    document.getElementById('game-over-message').textContent = message;
    document.getElementById('game-over-score').textContent = 'Final Score: ' + score;
    gameOverEl.hidden = false;
    // preventScroll: focusing normally scrolls the target into view, which would undo
    // the very thing this dialog exists to avoid.
    document.getElementById('play-again').focus({ preventScroll: true });
}

function hideGameOver() {
    gameOverEl.hidden = true;
    restartCurrentGame = null;
}

document.getElementById('play-again').addEventListener('click', () => {
    const restart = restartCurrentGame;
    hideGameOver();
    if (restart) restart();
});

const selectedMode = () => {
    const modeSelect = document.getElementById('modeSelect');
    return modeSelect ? modeSelect.value : 'classic';
};

/* The bold outline of the upper strand, drawn on the sides where its band ends. This
   is the knot-diagram convention: the strand passing over keeps a continuous edge, so
   you can see which one is on top - and, because it is always drawn, where the
   crossing is before you reach it.

   An edge is simply a direction the top strand does not continue in, which is the same
   question movement already asks, so stepFrom answers it. Written inline because it is
   fixed for a given board and drawFrame only ever touches background-color; a
   stylesheet rule would need one class per combination of sides. */
const EDGE_SHADOWS = {
    '0,-1': 'inset 0 2px 0 0 #3b3026',
    '0,1': 'inset 0 -2px 0 0 #3b3026',
    '-1,0': 'inset 2px 0 0 0 #3b3026',
    '1,0': 'inset -2px 0 0 0 #3b3026',
};

function topStrandEdges(shape, x, y) {
    const top = topStrandAt(shape.graph, x, y);
    if (!top) return '';

    return strandEdges(shape.graph, top)
        .map((step) => EDGE_SHADOWS[`${step.x},${step.y}`])
        .join(', ');
}

// A cell the snake cannot occupy. Every board is mask-driven now, so this is the one
// question to ask regardless of mode.
function isBlockedCell(shape, x, y) {
    return cellKindAt(shape.mask, x, y) !== CELL.TRACK;
}

/**
 * Build the physical grid. Called on load and whenever the shape changes.
 */
function createStaticBoard(shape = currentShape) {
    currentShape = shape;

    let snakeHtml = '';
    for (let y = 1; y <= shape.height; y++) {
        for (let x = 1; x <= shape.width; x++) {
            const blocked = isBlockedCell(shape, x, y);
            const color = blocked ? SNAKE_COLORS.hole : 'white';
            // The crossing needs to be visible before the snake reaches it, so the
            // player can see there is something to be over or under.
            const overlap = !blocked && isOverlapCell(shape.graph, x, y) ? ' cell-overlap' : '';
            const edges = blocked ? '' : topStrandEdges(shape, x, y);
            const shadow = edges ? `; box-shadow: ${edges}` : '';
            snakeHtml += `<button class="x${x}y${y}${overlap}" data-blocked="${blocked}" style="background-color: ${color}${shadow}"></button>`;
        }
    }
    snakeBoard.innerHTML = snakeHtml;
    snakeBoard.classList.remove('is-underneath');

    // The stylesheet lays the grid out and sizes the cells from these.
    snakeBoard.style.setProperty('--snake-cols', shape.width);
    snakeBoard.style.setProperty('--snake-rows', shape.height);
}

function initSnakeGame() {
    if (gameInterval) clearInterval(gameInterval);
    
    // 1. Capture the mode from the dropdown immediately
    const modeSelect = document.getElementById('modeSelect');
    gameMode = modeSelect ? modeSelect.value : 'classic';

    score = 0;
    document.getElementById('score').innerText = score;
    canChangeDirection = true;

    // 2. Build the board for this mode and take its opening position. Orientation is
    // read once, here - reflowing mid-game could drop the snake inside a wall.
    const shape = getBoardShape(gameMode, currentOrientation());
    createStaticBoard(shape);
    snake = shape.start.snake.map((segment) => ({ ...segment }));
    direction = { ...shape.start.direction };

    spawnFood();
    drawFrame();
    gameInterval = setInterval(gameStep, 150);
    setGameControlsEnabled(false);
    hideGameOver();
}

/**
 * Enhanced Spawn Logic: Food cannot land on the snake OR in the hole
 */
function spawnFood() {
    /* Collect what is free and pick one, rather than guessing at random until a guess
       lands. On the Infinity board only 352 of 476 places are playable, so rejection
       sampling would spin - and on a nearly full board, forever.

       Free by NODE, not by cell: the food gets a strand like the snake does, so it can
       lie under the crossing while the snake passes over it, and eating it means
       reaching it on its own strand. */
    const free = freeNodes(currentShape.graph, snake);

    // Nowhere left to put it means the board is full - the snake has won.
    if (!free.length) return;

    const chosen = free[Math.floor(Math.random() * free.length)];
    food = { x: chosen.x, y: chosen.y, strand: chosen.strand };
}

function gameStep() {
    // The graph knows what continues the snake's current strand; anything else is a
    // death, and where the move was headed says which kind.
    const head = stepFrom(currentShape.graph, snake[0], direction);

    if (!head) {
        return gameOver(failureAt(snake[0], direction));
    }

    // Layer-aware: sharing a cell with itself on the other strand is passing over,
    // not a crash.
    if (isLayeredSelfCollision(head, snake)) {
        return gameOver('SELF');
    }

    snake.unshift({ x: head.x, y: head.y, strand: head.strand });

    if (head.x === food.x && head.y === food.y && head.strand === food.strand) {
        score += 10;
        document.getElementById('score').innerText = score;
        spawnFood();
    } else {
        snake.pop();
    }

    drawFrame();
    
    // 3. UNLOCK THE INPUT: The move is done, user can turn again.
    canChangeDirection = true; 
}

function drawFrame() {
    // Reset buttons on snakeBoard only
    const buttons = snakeBoard.querySelectorAll('button');
    buttons.forEach((btn) => {
        // data-blocked is stamped on when the board is built, so the walls and holes
        // do not have to be recomputed every frame.
        btn.style.backgroundColor = btn.dataset.blocked === 'true' ? SNAKE_COLORS.hole : 'white';
        // Cleared here, re-applied below for whatever the snake covers this frame, so
        // the hatch never runs across the snake and eats into its contrast.
        btn.classList.remove('snake-on', 'peek');
    });

    /* Draw the food. Under the crossing it takes the lighter colour and opens a hatched
       window in the cells around it - you are looking down into the lower level. The
       food's own cell is left unhatched on purpose: hatching over it would cut the
       contrast of the one thing on the board the player is trying to find, and the
       lighter colour already says it is below. */
    const foodBelow = isUnderneath(currentShape.graph, food);
    const foodEl = snakeBoard.querySelector(`.x${food.x}y${food.y}`);
    if (foodEl) foodEl.style.backgroundColor = foodBelow ? SNAKE_COLORS.foodUnder : SNAKE_COLORS.food;

    if (foodBelow) {
        overlapCellsAround(currentShape.graph, food.x, food.y).forEach(({ x, y }) => {
            const cell = snakeBoard.querySelector(`.x${x}y${y}`);
            if (cell) cell.classList.add('peek');
        });
    }

    /* The crossing is outlined only while the head is beneath the other strand, so the
       marking answers "you are under something right now" rather than "something
       happens here". The head is what counts - once it has come out the far side the
       player is no longer underneath, whatever the tail is still doing. */
    snakeBoard.classList.toggle('is-underneath', isUnderneath(currentShape.graph, snake[0]));

    /* Draw the snake. Where the snake crosses itself, one cell holds two segments -
       only the one on the upper strand is drawn, which is what makes the crossing
       read as over-and-under rather than as a collision. */
    const perCell = new Map();
    snake.forEach((segment, index) => {
        const node = nodeAt(currentShape.graph, segment.x, segment.y, segment.strand);
        if (!node) return;

        const occupant = { ...segment, layer: node.layer, isHead: index === 0 };
        const key = `${segment.x},${segment.y}`;
        const standing = perCell.get(key);
        perCell.set(key, standing ? topOccupant([standing, occupant]) : occupant);
    });

    perCell.forEach((occupant) => {
        const segEl = snakeBoard.querySelector(`.x${occupant.x}y${occupant.y}`);
        if (!segEl) return;

        // Underneath means: this cell has more than one strand and we are not on the
        // top one. Lighter reads as further away - see the contrast note in NOTES.md
        // for why the body was darkened to make room for it.
        segEl.classList.add('snake-on');
        segEl.style.backgroundColor = occupant.isHead
            ? SNAKE_COLORS.head
            : (isUnderneath(currentShape.graph, occupant) ? SNAKE_COLORS.bodyUnder : SNAKE_COLORS.body);
    });
}

/* The graph refuses a move without saying why, so reconstruct it from the target
   cell: off the grid or into a wall/hole reads as it always did, while a target that
   is perfectly good track means the snake tried to leave the strand it was on.

   Which strand decides how that reads. On the upper strand there is nothing above
   you and leaving it is a fall - you stepped off the crossing. Underneath, the strand
   above is a ceiling and the sides of the gap are walls, so the same move is running
   into one. Same failure, opposite physical story. */
function failureAt(from, heading) {
    const target = { x: from.x + heading.x, y: from.y + heading.y };

    if (isWallCollision([target.x, target.y], currentShape.width, currentShape.height)) {
        return 'WALL';
    }
    const kind = cellKindAt(currentShape.mask, target.x, target.y);
    if (kind === CELL.HOLE) return 'HOLE';
    if (kind === CELL.WALL) return 'WALL';

    return isUnderneath(currentShape.graph, from) ? 'UNDERPASS' : 'EDGE';
}

function gameOver(reason = '') {
    clearInterval(gameInterval);
    gameInterval = null;
    canChangeDirection = true; // Unlock keys for the next game
    setGameControlsEnabled(true);

    let displayMessage;

    switch (reason) {
        case 'WALL':
            displayMessage = "Containment Breach: Perimeter hit.";
            break;
        case 'SELF':
            displayMessage = "Critical Error: System looped back on itself.";
            break;
        case 'HOLE':
            displayMessage = "Vacuum Exposure: Fallen into the void.";
            break;
        case 'EDGE':
            displayMessage = "Lost Footing: Stepped off the crossing.";
            break;
        case 'UNDERPASS':
            displayMessage = "Structural Impact: Hit the underpass wall.";
            break;
        default:
            displayMessage = "System Overload.";
    }

    showGameOver(displayMessage, score, initSnakeGame);
}


/* --- PART 3: THE TETRIS SYSTEM --- */

/* --- TETRIS STATE --- */
let tetrisScore = 0;
let tetrisLevel = 1;
let tetrisLines = 0; 
let tetrisInterval = null;

let activePiece = null;   // { shape: [], x: 5, y: 1, type: 'I' }
let tetrisMatrix = Array.from({ length: 20 }, () => Array(10).fill(null));

function initTetrisGame() {
    if (tetrisInterval) clearInterval(tetrisInterval);

    tetrisScore = 0;
    tetrisLevel = 1;
    tetrisLines = 0;
    
    document.getElementById('tetris-score').innerText = tetrisScore;
    if (tetrisLevelEl) tetrisLevelEl.innerText = tetrisLevel;

    tetrisMatrix = Array.from({ length: 20 }, () => Array(10).fill(null));
    spawnTetromino(); 
    drawTetrisFrame(); 
    tetrisInterval = setInterval(tetrisStep, 500);
    setGameControlsEnabled(false);
    hideGameOver();
}

/**
 * Initialize the 10x20 Tetris Matrix
 */
function createTetrisBoard() {
    let tetrisHtml = '';
    // 10 columns * 20 rows = 200 buttons
    for (let row = 1; row <= 20; row++) {
        for (let col = 1; col <= 10; col++) {
            // Using a unique class naming convention for Tetris to avoid Snake conflicts
            // e.g., tx1ty1, tx2ty1...
            tetrisHtml += `<button class="tx${col}ty${row}"></button>`;
        }
    }
    tetrisBoard.innerHTML = tetrisHtml;
}

function tetrisStep() {
    const nextPos = { ...activePiece, y: activePiece.y + 1 };
    
    if (!isTetrisCollision(getAbsoluteCoords(nextPos), tetrisMatrix)) {
        activePiece = nextPos;
    } else {
        lockPiece();
        clearLines(); // <--- The System check
        spawnTetromino();
    }
    drawTetrisFrame();
}

function spawnTetromino() {
    const types = Object.keys(TETROMINOES);
    const type = types[Math.floor(Math.random() * types.length)];
    
    activePiece = {
        shape: TETROMINOES[type],
        type: type,
        x: 5, 
        y: 1  
    };

    // Check if the newly spawned piece is already colliding
    // (This happens if the player has stacked blocks to the top)
    if (isTetrisCollision(getAbsoluteCoords(activePiece), tetrisMatrix)) {
        gameOverTetris();
    }
}

/**
 * Helper to convert piece offsets + position into actual grid coordinates
 */
function getAbsoluteCoords(piece) {
    return piece.shape.map(([dx, dy]) => ({
        x: piece.x + dx,
        y: piece.y + dy
    }));
}

function lockPiece() {
    const coords = getAbsoluteCoords(activePiece);
    coords.forEach(({x, y}) => {
        if (y >= 1) {
            tetrisMatrix[y-1][x-1] = activePiece.type;
        }
    });
}

function clearLines() {
    let linesCleared = 0;

    // We loop through the matrix from top to bottom
    for (let y = 0; y < 20; y++) {
        // If every cell in this row is NOT null, it's a full line!
        if (tetrisMatrix[y].every(cell => cell !== null)) {
            // 1. Remove the full row
            tetrisMatrix.splice(y, 1);
            
            // 2. Add a fresh empty row to the top
            tetrisMatrix.unshift(Array(10).fill(null));
            
            linesCleared++;
            y--;
            
            // Note: Since we removed a row, the 'y' index now points to the 
            // NEXT row, so we don't need to increment 'y' for the next iteration.
        }
    }

    if (linesCleared > 0) {
        updateScore(linesCleared);
    }
}

function updateScore(lines) {
    // 1. Classic Nintendo Base Points Array
    // Index matches number of lines cleared: [0 lines, 1 line, 2 lines, 3 lines, 4 lines]
    const linePoints = [0, 40, 100, 300, 1200];
    
    // 2. Calculate and add score scaled by current level
    tetrisScore += linePoints[lines] * tetrisLevel;
    document.getElementById('tetris-score').innerText = tetrisScore;
    
    // 3. Accumulate total lines cleared
    tetrisLines += lines;
    
    // 4. Level up every 10 lines
    const targetLevel = Math.floor(tetrisLines / 10) + 1;
    
    if (targetLevel > tetrisLevel) {
        tetrisLevel = targetLevel;
        
        if (document.getElementById('tetris-level')) {
            document.getElementById('tetris-level').innerText = tetrisLevel;
        }

        // 5. Dynamic Gravity: Speed up the game loop interval as level increases
        clearInterval(tetrisInterval);
        
        // Calculates a faster speed. Level 1 = 500ms, Level 2 = 450ms, Level 3 = 400ms, etc.
        const newSpeed = Math.max(100, 500 - (tetrisLevel - 1) * 50); 
        tetrisInterval = setInterval(tetrisStep, newSpeed);
    }
}

function gameOverTetris() {
    clearInterval(tetrisInterval);
    tetrisInterval = null;
    setGameControlsEnabled(true);
    showGameOver('Matrix Critical Failure!', tetrisScore, initTetrisGame);
    
    // Optional: Visual feedback like "graying out" the board
}

// Map piece types to your portfolio colors
function drawTetrisFrame() {
    // 1. Clear the board (reset to empty space color)
    const buttons = tetrisBoard.querySelectorAll('button');
    buttons.forEach(btn => btn.style.backgroundColor = BOARD_COLORS.emptyCell);

    // 2. Draw the Locked Matrix (Data is 0-19, UI is 1-20)
    tetrisMatrix.forEach((row, y) => {
        row.forEach((type, x) => {
            if (type !== null) {
                const cell = tetrisBoard.querySelector(`.tx${x + 1}ty${y + 1}`);
                if (cell) cell.style.backgroundColor = TETRIS_COLORS[type];
            }
        });
    });

    // 3. Draw the Active Piece (Logic is 1-10/1-20, UI is 1-10/1-20)
    if (activePiece) {
        const coords = getAbsoluteCoords(activePiece);
        coords.forEach(({x, y}) => {
            // Check if the cell exists before trying to color it
            // This prevents the "ty0" error when spawning
            const cell = tetrisBoard.querySelector(`.tx${x}ty${y}`);
            if (cell) {
                cell.style.backgroundColor = TETRIS_COLORS[activePiece.type];
            }
        });
    }
}


/* --- PART 4: MINESWEEPER --- */

const mineBoard = document.getElementById('mineDisplay');
const mineCountEl = document.getElementById('mine-count');
const mineStatusEl = document.getElementById('mine-status');
const flagToggleEl = document.getElementById('flagToggle');

let mineGame = createMinesweeper();
let flagMode = false;

/* The board is built once and then repainted, rather than rebuilt on every move. A
   fresh innerHTML would drop the element the player just pressed, which on touch
   cancels the gesture mid-tap. */
function createMineBoard() {
    let html = '';
    for (let y = 1; y <= mineGame.height; y++) {
        for (let x = 1; x <= mineGame.width; x++) {
            html += `<button class="mine-cell" data-x="${x}" data-y="${y}"></button>`;
        }
    }
    mineBoard.innerHTML = html;
    mineBoard.style.setProperty('--mine-cols', mineGame.width);
    mineBoard.style.setProperty('--mine-rows', mineGame.height);
}

function paintMineCell(cell) {
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    const revealed = isRevealed(mineGame, x, y);
    const flagged = isFlagged(mineGame, x, y);
    const mined = isMine(mineGame, x, y);
    const lost = mineGame.status === MINE_STATUS.LOST;

    cell.classList.toggle('is-revealed', revealed);
    cell.classList.toggle('is-flagged', flagged && !revealed);
    cell.textContent = '';
    cell.style.color = '';
    cell.style.backgroundColor = '';

    if (flagged && !revealed) {
        cell.textContent = '⚑';
        return;
    }

    // On a loss the whole board is shown: where the mines were, and which one went off.
    if (lost && mined) {
        cell.classList.add('is-mine');
        cell.textContent = '●';
        if (revealed) cell.classList.add('is-detonated');
        return;
    }

    if (!revealed) return;

    const count = countAt(mineGame, x, y);
    if (count > 0) {
        cell.textContent = String(count);
        cell.style.color = numberColor(count);
    }
}

function drawMineBoard() {
    mineBoard.querySelectorAll('.mine-cell').forEach(paintMineCell);
    mineCountEl.textContent = flagsRemaining(mineGame);

    /* Once the ground is clear the only thing left is flagging, so say that rather
       than repeating the general instruction - otherwise a player who has opened
       everything is told to keep clearing squares that are already open. */
    const allClear = mineGame.revealed.size === mineGame.width * mineGame.height - mineGame.mineCount;
    const playing = allClear
        ? 'Ground cleared. Flag the last mines to finish.'
        : (flagMode ? 'Flag mode: tap to mark a suspected mine.' : 'Clear every square that is not a mine.');

    const messages = {
        [MINE_STATUS.READY]: 'Tap any square to begin.',
        [MINE_STATUS.PLAYING]: playing,
        [MINE_STATUS.WON]: 'Swept. Every mine found and flagged.',
        [MINE_STATUS.LOST]: 'Detonated. The board is shown below.',
    };
    mineStatusEl.textContent = messages[mineGame.status];
    mineBoard.classList.toggle('is-over', isOver(mineGame));
}

function setFlagMode(on) {
    flagMode = on;
    flagToggleEl.setAttribute('aria-pressed', String(on));
    flagToggleEl.classList.toggle('is-active', on);
    drawMineBoard();
}

function initMinesweeper() {
    mineGame = createMinesweeper();
    setFlagMode(false);
    createMineBoard();
    drawMineBoard();
}

function playMineCell(x, y, { flag = false } = {}) {
    if (isOver(mineGame)) return;

    if (flag) {
        mineGame = toggleMineFlag(mineGame, x, y);
    } else if (isRevealed(mineGame, x, y)) {
        // A tap on an open number tries to chord; on anything else it does nothing.
        mineGame = chordCell(mineGame, x, y);
    } else {
        mineGame = revealCell(mineGame, x, y);
    }

    drawMineBoard();

    if (isOver(mineGame)) {
        showGameOver(
            mineGame.status === MINE_STATUS.WON ? 'Swept!' : 'Detonated.',
            mineGame.status === MINE_STATUS.WON
                ? `All ${mineGame.mineCount} mines flagged`
                : `${mineGame.revealed.size} of ${mineGame.width * mineGame.height - mineGame.mineCount} squares cleared`,
            initMinesweeper
        );
    }
}

mineBoard.addEventListener('click', (event) => {
    const cell = event.target.closest('.mine-cell');
    if (!cell) return;
    playMineCell(Number(cell.dataset.x), Number(cell.dataset.y), { flag: flagMode });
});

// Right-click flags on a mouse; the toggle is what a touchscreen uses instead.
mineBoard.addEventListener('contextmenu', (event) => {
    const cell = event.target.closest('.mine-cell');
    if (!cell) return;
    event.preventDefault();
    playMineCell(Number(cell.dataset.x), Number(cell.dataset.y), { flag: true });
});

flagToggleEl.addEventListener('click', () => setFlagMode(!flagMode));
document.getElementById('mineStartBtn').addEventListener('click', initMinesweeper);

/* --- Input Listeners --- */
document.getElementById('arrayForm').addEventListener('submit', displayArray); // Toy Event Listener

document.getElementById('tetrisStartBtn').addEventListener('click', initTetrisGame);

document.getElementById('startBtn').addEventListener('click', () => {
    gameMode = document.getElementById('modeSelect').value;
    initSnakeGame();
});

// Preview the board as soon as the mode changes, so the shape is visible before
// pressing Start rather than appearing only once the game is underway.
document.getElementById('modeSelect').addEventListener('change', () => {
    if (gameInterval) return; // never reshape a board out from under a running game
    createStaticBoard(getBoardShape(selectedMode(), currentOrientation()));
});

/* Snake and Tetris both take one of the four action strings from logic.js. Keeping
   the game response separate from how the input arrived is what lets the on-screen
   touch pads reuse the exact same code as the arrow keys. */
function handleSnakeAction(action) {
    if (!gameInterval) return;
    if (!canChangeDirection) return;

    const newDirection = ACTION_VECTORS[action];
    if (!newDirection) return;

    if (isValidDirection(direction, newDirection)) {
        direction = newDirection;
        canChangeDirection = false;
    }
}

function handleTetrisAction(action) {
    if (!tetrisInterval || !activePiece) return;

    let nextPos = { ...activePiece };

    switch (action) {
        case 'left':
            nextPos.x -= 1;
            break;
        case 'right':
            nextPos.x += 1;
            break;
        case 'down':
            nextPos.y += 1;
            break;
        case 'up':
            // Rotation!
            nextPos.shape = rotatePiece(activePiece.shape);
            break;
        default: return;
    }

    // Only apply the move if it doesn't cause a collision
    if (!isTetrisCollision(getAbsoluteCoords(nextPos), tetrisMatrix)) {
        activePiece = nextPos;
        drawTetrisFrame();
    }
}

function dispatchAction(action) {
    if (!action) return;
    handleSnakeAction(action);
    handleTetrisAction(action);
}

window.addEventListener('keydown', (e) => {
    const keysToCapture = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];

    // Prevent scrolling if either game is running
    if ((gameInterval || tetrisInterval) && keysToCapture.includes(e.key)) {
        e.preventDefault();
    }

    dispatchAction(keyToAction(e.key));
}, { passive: false });

/* --- TOUCH PADS --- */
/* A held button repeats, matching how holding an arrow key behaves. Snake ignores
   the extra presses within a tick anyway; for Tetris this is the soft drop. */
let repeatTimer = null;
let repeatInterval = null;

function stopRepeat() {
    clearTimeout(repeatTimer);
    clearInterval(repeatInterval);
    repeatTimer = null;
    repeatInterval = null;
}

/* pointerdown rather than click: it fires on finger-down instead of finger-up, which
   is the difference between the controls feeling immediate and feeling laggy. The
   preventDefault stops the browser following up with synthetic mouse events and
   stops a fast repeated tap being taken for a double-tap zoom. */
document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        dispatchAction(btn.dataset.action);

        stopRepeat();
        // Wait out an initial delay so a normal single tap never repeats.
        repeatTimer = setTimeout(() => {
            repeatInterval = setInterval(() => dispatchAction(btn.dataset.action), 80);
        }, 250);
    });

    // pointerleave and pointercancel matter as much as pointerup here: a finger that
    // slides off the button or gets taken over by a browser gesture never sends
    // pointerup, and the repeat would otherwise run on forever.
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((evt) => {
        btn.addEventListener(evt, stopRepeat);
    });
});

/* --- Painting the Array Grid --- */

/* The colour actually applied is kept in a data attribute rather than read back off
   the inline style. Browsers re-serialise style.backgroundColor - a hex comes back as
   "rgb(111, 78, 55)" - so comparing it against the picker's value only ever worked
   while every colour was a CSS keyword. The brown is a hex, which would have broken
   tap-to-undo silently. */
function paintCell(cell, { toggle = false } = {}) {
    const id = cell.className;
    if (!id || !id.includes('x')) return;

    const picker = document.getElementById('colorPicker');
    if (!picker) return;

    const applied = cell.dataset.color || '';

    // A second tap on a cell you just painted puts back what was underneath.
    if (toggle && applied === picker.value && previousPickedColors[id] !== undefined) {
        const restored = previousPickedColors[id];
        cell.style.backgroundColor = restored;
        cell.dataset.color = restored;
        return;
    }

    previousPickedColors[id] = applied;
    cell.style.backgroundColor = picker.value;
    cell.dataset.color = picker.value;
}

/* Hold and drag to paint. The set is per stroke, so crossing a cell twice in one
   sweep does not undo it - only a fresh tap toggles. */
let painting = false;
let strokeCells = new Set();

const cellUnder = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el && el.tagName === 'BUTTON' && toyBoard.contains(el) ? el : null;
};

toyBoard.addEventListener('pointerdown', (event) => {
    const cell = event.target;
    if (cell.tagName !== 'BUTTON') return;

    event.preventDefault();
    painting = true;
    strokeCells = new Set([cell.className]);
    paintCell(cell, { toggle: true });
});

toyBoard.addEventListener('pointermove', (event) => {
    if (!painting) return;
    event.preventDefault();

    /* Touch pointers keep reporting the element the stroke started on, so the target
       cannot say what is under the finger now - the board has to be asked directly. */
    const cell = cellUnder(event.clientX, event.clientY);
    if (!cell || strokeCells.has(cell.className)) return;

    strokeCells.add(cell.className);
    paintCell(cell);
});

/* Ended on the window, not the board: a stroke that wanders off the grid and back
   should carry on, but one that ends anywhere at all has to stop. */
const endStroke = () => {
    painting = false;
    strokeCells.clear();
};
window.addEventListener('pointerup', endStroke);
window.addEventListener('pointercancel', endStroke);

// RUN IMMEDIATELY: Initialize the game boards visually on load
createStaticBoard();
createTetrisBoard();
initMinesweeper();

/* Tear down both games and put their boards back to a clean starting state. Called
   whenever the view changes, so a game is never left running behind a hidden view.

   This is deliberately broader than only resetting when another game starts: an
   abandoned Tetris left on the hub screen would still tick, top out, and alert. */
function stopAllGames() {
    // A pad button can be left held while the view changes out from under it,
    // which would otherwise leave its repeat timer running against the next game.
    stopRepeat();
    setGameControlsEnabled(true);
    hideGameOver();

    clearInterval(gameInterval);
    gameInterval = null;
    clearInterval(tetrisInterval);
    tetrisInterval = null;

    // Snake back to a blank board and a zeroed score.
    canChangeDirection = true;
    score = 0;
    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.innerText = score;
    // Rebuild for the mode currently selected, so the board on screen always matches
    // the dropdown rather than reverting to the square one.
    createStaticBoard(getBoardShape(selectedMode(), currentOrientation()));

    // Tetris likewise - clearing the matrix and the active piece matters as much as
    // clearing the interval, or returning to the game would resume the old stack.
    tetrisScore = 0;
    tetrisLevel = 1;
    tetrisLines = 0;
    activePiece = null;
    tetrisMatrix = Array.from({ length: 20 }, () => Array(10).fill(null));
    if (tetrisScoreEl) tetrisScoreEl.innerText = tetrisScore;
    if (tetrisLevelEl) tetrisLevelEl.innerText = tetrisLevel;
    drawTetrisFrame();

    // Minesweeper has no loop to stop, but leaving a half-played board behind and
    // coming back to it mid-game is the same surprise the others were fixed for.
    initMinesweeper();
}

/* --- Hub Navigation Listeners --- */
document.querySelectorAll('.entry-card').forEach((card) => {
    card.addEventListener('click', () => { window.location.hash = card.dataset.view; });
});

document.querySelectorAll('[data-back]').forEach((btn) => {
    btn.addEventListener('click', () => { window.location.hash = ''; });
});

window.addEventListener('hashchange', applyHashRoute);
applyHashRoute();