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
    isDeckGap,
    isBridgeRamp,
    CELL,
    TOY_COLORS,
    toHex,
    MINE_COLORS,
    numberColor,
    SEQUENCE_PADS,
    PETS_COLORS,
    PETS_SKIES
} from '../js/logic.js';
import {
    createGame as createSequence,
    extendSequence,
    beginInput,
    pressPad,
    isRoundComplete,
    completedRounds,
    isUnstarted,
    isOver as isSequenceOver,
    padIndexes,
    stepDurationMs,
    toneFor,
    FAILURE_TONE,
    PRESETS as SEQUENCE_PRESETS,
    STATUS as SEQUENCE_STATUS
} from '../js/sequence.js';
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
    correctFlagCount,
    misplacedFlagCount,
    isOver,
    PRESETS as MINE_PRESETS,
    STATUS as MINE_STATUS
} from '../js/minesweeper.js';
// Classic and Terni Lapilli share one view and answer the same questions, so they are
// taken whole and the view picks between them - see PART 6.
import * as TicTacToe from '../js/tictactoe.js';
import * as TerniLapilli from '../js/ternilapilli.js';
import { ROUTES, routeFor, parentOf, backTitleFor } from '../js/routes.js';
import * as Pets from '../js/pets.js';
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

/* --- ROUTES / VIEW SWITCHING --- */
/* Which section a hash shows, and where Back goes, come from js/routes.js. Every section
   any route can show - the dashboard, the hubs and the game views - is hidden except the
   current one. */

// The game views by name, for the code below that asks whether one is on screen.
const views = {
    tetris: document.getElementById('tetris-system'),
    snake: document.getElementById('snake-system'),
    minesweeper: document.getElementById('minesweeper-system'),
    sequence: document.getElementById('sequence-system'),
    tictactoe: document.getElementById('tictactoe-system'),
    toy: document.getElementById('toy-system'),
    pets: document.getElementById('pets-system'),
};

// Every section a route can show, by element id.
const screens = Object.fromEntries(
    [...new Set(Object.values(ROUTES).map((route) => route.view))]
        .map((id) => [id, document.getElementById(id)]),
);

let currentRoute = routeFor(window.location.hash);

function showRoute(route) {
    currentRoute = route;
    /* Single player and pass the phone share the Tic-Tac-Toe view, and the route says
       which this is. It has to be known before stopAllGames, which is what starts the
       view's fresh game. */
    tictactoePlayers = route.players || 1;

    // Leaving a view abandons whatever was running in it. Hiding a game does not
    // stop its setInterval, so an abandoned game kept playing itself in the
    // background and eventually hit its own game-over - throwing its end-of-game
    // dialog over whichever game you had moved on to. That was a blocking alert()
    // when this was written; the dialog is in-page now, but an abandoned game
    // interrupting a live one is no better for being prettier.
    stopAllGames();
    Object.entries(screens).forEach(([id, el]) => { el.hidden = id !== route.view; });
    labelBackButtons(route);

    // Only now is the view on screen, which is when an opponent due to open may move.
    // Pass the phone has no opponent, so nothing to work out up front.
    if (route.view === views.tictactoe.id) {
        if (tictactoePlayers === 1) tictactoeRules().prepare();
        scheduleTicTacToeReply();
    }
    // The dog only fidgets, sleeps and keeps time while it can be seen; stopAllGames has
    // just cleared its timers.
    if (route.view === views.pets.id) startPetsView();
}

/* Back says where it goes, because that now depends on the route: a game's Back leads to
   its hub, a hub's and Finger Paint's to the dashboard. The end-of-game dialog's button
   says it too. */
function labelBackButtons(route) {
    const title = backTitleFor(route.key);
    document.querySelectorAll('.back-btn[data-back]').forEach((btn) => {
        btn.textContent = `← Back to ${title}`;
    });
    document.getElementById('game-over-back').textContent = `Back to ${title}`;
}

function applyHashRoute() {
    showRoute(routeFor(window.location.hash));
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
    ['modeSelect', 'startBtn', 'tetrisStartBtn', 'mineModeSelect', 'sequenceModeSelect', 'sequenceStartBtn'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.disabled = !enabled;
    });
}

/* The end-of-game dialog. It replaces alert(), which on a phone forced the browser
   toolbar back on screen and reset the scroll position - the nav bar reappearing and
   the pad scrolling out of reach. Being fixed to the viewport, this moves nothing. */
const gameOverEl = document.getElementById('game-over');
const gameOverModeEl = document.getElementById('game-over-mode');
const gameOverModeSelect = document.getElementById('game-over-mode-select');
let restartCurrentGame = null;
let restartModeSource = null;

/* Offer the same modes the game's own select offers, by copying its options rather than
   keeping a second list - two lists eventually disagree. The choice is written back to
   that select on Play Again, so there is still one source of truth and the control
   behind the dialog stays in step with what was chosen. */
function showModeChoice(source) {
    restartModeSource = source;
    gameOverModeEl.hidden = !source;
    if (!source) return;

    gameOverModeSelect.innerHTML = [...source.options]
        .map((option) => `<option value="${option.value}">${option.textContent}</option>`)
        .join('');
    gameOverModeSelect.value = source.value;
    document.getElementById('game-over-mode-label').textContent =
        source.getAttribute('aria-label') || 'Mode';
}

/* If a game ever ends with a board worth studying, the answer is not a button on this
   dialog that dismisses it - it is for that game not to use the dialog. Minesweeper was
   the case that raised the question and it now reports its result in place, above its
   own board, because everything this dialog offers was already on screen there. A
   review button existed here briefly and was removed with it: an unused hook is a
   guess about the next game, and the reasoning is in NOTES.md where it can be read
   rather than inferred. */
function showGameOver(message, score, restart, modeSource = null) {
    restartCurrentGame = restart;
    showModeChoice(modeSource);
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
    restartModeSource = null;
}

document.getElementById('play-again').addEventListener('click', () => {
    const restart = restartCurrentGame;

    // Hand the choice back to the game's own select before restarting: every init
    // function reads its mode from there, so this is all it takes to switch.
    if (restartModeSource) restartModeSource.value = gameOverModeSelect.value;

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
            // Blocked ground gets its gradient from the stylesheet; only open ground
            // is painted from here, because only open ground changes.
            const color = blocked ? '' : SNAKE_COLORS.ground;
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
        // Blocked ground never changes and is styled by CSS, so leave it be.
        if (btn.dataset.blocked !== 'true') btn.style.backgroundColor = SNAKE_COLORS.ground;
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
    const foodNode = nodeAt(currentShape.graph, food.x, food.y, food.strand);
    const foodLayer = foodNode ? foodNode.layer : 0;
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
        /* The food occludes the same way a segment does. A snake passing underneath a
           surface is behind whatever is lying on top of it, so drawing the snake over
           the food there would hide the one thing the player is steering towards -
           and hide it exactly when they cannot reach it anyway.

           Segments already occlude each other by layer; this puts the food into the
           same comparison instead of letting it be painted over by whatever is drawn
           last. Where the snake is on top it still wins, which is why this compares
           layers rather than always yielding to the food. */
        const sharesFoodCell = occupant.x === food.x && occupant.y === food.y;
        if (sharesFoodCell && occupant.layer < foodLayer) return;

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

    /* A hole in the Bridge's deck. The square is perfectly good ground - a snake down
       there walks straight through it - so the only way to fail moving into one is to
       have been up on the deck. */
    if (isDeckGap(currentShape.mask, target.x, target.y)) return 'FALL';

    /* The abutment at the end of the Bridge. A ramp can be walked onto from the side or
       from past the end of the bridge, so the only way a move into one fails is coming
       at it from underneath. */
    if (isBridgeRamp(currentShape.mask, target.x, target.y)) return 'ABUTMENT';

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
        case 'FALL':
            displayMessage = "Fall damage is real.";
            break;
        case 'ABUTMENT':
            displayMessage = "Endings are hard.";
            break;
        default:
            displayMessage = "System Overload.";
    }

    showGameOver(displayMessage, score, initSnakeGame, document.getElementById('modeSelect'));
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
const mineModeSelect = document.getElementById('mineModeSelect');

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
        /* On a loss, a flag that was not on a mine is marked as the mistake it was.
           Leaving every flag looking correct is what made a lost board unreadable:
           the player could see where the mines had been but not which of their own
           marks had been wrong, which is the half worth learning from. A flag that
           WAS on a mine stays a plain flag on unopened ground - it was right, and it
           needs no comment. */
        if (lost && !mined) {
            cell.classList.add('is-wrong-flag');
            cell.textContent = '✗';
            return;
        }
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

    /* The status line says what the controls do and nothing else. It must never
       describe the state of the board.

       An earlier version noticed when every safe square was open and said so, meaning
       to be helpful. It was telling the player that every hidden square left is a mine
       - the last deduction on the board, handed over. Working that out is the game.

       So the only thing the playing message depends on is flag mode, which is about
       the player's own controls, not about what is under the squares. Keep it that
       way: any message conditioned on revealed, flagged or mines is a hint. */
    /* Minesweeper reports its result here rather than in the end-of-game dialog, and
       is the only game that does. The dialog exists for the games whose board is not
       worth looking at afterwards - it covers the board, which for this one is exactly
       backwards: losing means a deduction went wrong and the board is the record of
       it. Everything the dialog offered is already on screen above the board, in this
       game's own controls: New Game, and the size to play next. So the game ends in
       place, nothing is covered, and there is nothing to dismiss or restore.

       The result line is the score, which is why it names the flags rather than the
       squares - see correctFlagCount in js/minesweeper.js. */
    const wrongFlags = misplacedFlagCount(mineGame);
    const messages = {
        [MINE_STATUS.READY]: 'Tap any square to begin.',
        [MINE_STATUS.PLAYING]: flagMode
            ? 'Flag mode: tap to mark a suspected mine.'
            : 'Clear every square that is not a mine.',
        [MINE_STATUS.WON]: `Swept. All ${mineGame.mineCount} mines correctly flagged.`,
        /* The legend is only mentioned when there is something for it to explain -
           a board lost with no misplaced flags has no crosses on it. */
        [MINE_STATUS.LOST]: `Detonated. ${correctFlagCount(mineGame)} of ${mineGame.mineCount} mines correctly flagged.`
            + (wrongFlags > 0 ? ` ✗ marks a flag that was wrong.` : ''),
    };
    mineStatusEl.textContent = messages[mineGame.status];
    // Only a finished game gets the banner treatment; in play this is a quiet hint line.
    mineStatusEl.classList.toggle('is-result', isOver(mineGame));
    mineBoard.classList.toggle('is-over', isOver(mineGame));
}

function setFlagMode(on) {
    flagMode = on;
    flagToggleEl.setAttribute('aria-pressed', String(on));
    flagToggleEl.classList.toggle('is-active', on);
    drawMineBoard();
}

function initMinesweeper() {
    const preset = MINE_PRESETS[mineModeSelect ? mineModeSelect.value : 'standard'] || MINE_PRESETS.standard;
    mineGame = createMinesweeper(preset);
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

    // No end-of-game dialog: drawMineBoard has just written the result into the status
    // line and left the board exactly where it is. See the note in drawMineBoard.
    drawMineBoard();
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

// Changing the size starts a fresh board of that size; there is nothing to preserve.
mineModeSelect.addEventListener('change', initMinesweeper);
document.getElementById('mineStartBtn').addEventListener('click', initMinesweeper);

/* --- PART 5: SEQUENCE --- */
/* The Simon-style memory game. The machine plays a growing run of pads; the player
   plays it back. Suggested by the project owner's daughter, whose idea included the
   pairing of a light and a tone on every pad - see NOTES.md. That pairing is load
   bearing, not decoration: it is what makes the game playable with the sound off and
   playable without watching, so it is fired from one place below rather than from two
   code paths that could drift apart.

   The rules are in js/sequence.js and know nothing about time. Everything to do with
   the clock - how long a pad stays lit, the gap between two, when the player's turn
   starts - lives here. */

const sequenceBoard = document.getElementById('sequenceDisplay');
const sequenceRoundEl = document.getElementById('sequence-round');
const sequenceBestEl = document.getElementById('sequence-best');
const sequenceStatusEl = document.getElementById('sequence-status');
const sequenceModeSelect = document.getElementById('sequenceModeSelect');
const sequenceSoundToggle = document.getElementById('sequenceSoundToggle');

let sequenceGame = createSequence(SEQUENCE_PRESETS.four);
let sequenceBest = 0;
let sequenceTimers = [];      // every pending step of the current playback
let sequenceRunning = false;  // a game is under way, as opposed to sitting on the panel

/* --- Sound --- */
/* The first audio on this site, which brings the autoplay rule with it: a context
   created before the player has interacted with the page is born suspended and stays
   that way. So it is built on the first press of Start - a real gesture - and never at
   load. One context is kept for the session; browsers cap how many a page may open. */
let audioCtx = null;
let soundOn = true;

try {
    // Remembered so the choice is made once, not on every visit. Storage can throw in
    // a locked-down browser, and a silent default of "on" is the right fallback.
    soundOn = window.localStorage.getItem('sequence-sound') !== 'off';
} catch { /* no storage - stay with the default */ }

/* The page's one audio context, shared by everything that makes a sound - Sequence's pads
   and the Pets bark. Each asks through its own sound setting first. */
function audioContext() {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null; // no Web Audio: everything still works without sound
    if (!audioCtx) audioCtx = new Ctor();
    // Returning to the tab can leave it suspended even after the first gesture.
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function ensureAudio() {
    if (!soundOn) return null;
    return audioContext();
}

/* A pad's voice: a square wave rolled off by a low-pass, which is a relay or a bench
   buzzer rather than a flute. The envelope matters more than the waveform - gating a
   raw oscillator on and off puts a step in the signal, and a step is an audible click.
   The attack is 8ms and the release is exponential to a floor rather than to zero,
   because a ramp to a true zero is undefined for exponentialRampToValueAtTime. */
function playTone(frequency, durationMs, { type = 'square', gain = 0.09 } = {}) {
    const ctx = ensureAudio();
    if (!ctx) return;

    const now = ctx.currentTime;
    const seconds = durationMs / 1000;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    // Tracks the pitch, so the low pads are not muddier than the high ones.
    filter.frequency.setValueAtTime(Math.min(frequency * 6, 7000), now);

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + seconds);

    osc.connect(filter).connect(envelope).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + seconds + 0.02);
}

function setSoundOn(on) {
    soundOn = on;
    sequenceSoundToggle.setAttribute('aria-pressed', String(on));
    sequenceSoundToggle.classList.toggle('is-active', on);
    sequenceSoundToggle.classList.toggle('is-muted', !on);
    try {
        window.localStorage.setItem('sequence-sound', on ? 'on' : 'off');
    } catch { /* nothing to do - the game just forgets between visits */ }
}

/* --- The panel --- */

function currentSequencePreset() {
    return SEQUENCE_PRESETS[sequenceModeSelect ? sequenceModeSelect.value : 'four'] || SEQUENCE_PRESETS.four;
}

function buildSequencePads() {
    sequenceBoard.innerHTML = padIndexes(sequenceGame).map((pad) => {
        const { name, face, lit } = SEQUENCE_PADS[pad];
        /* The two colours are handed to CSS as custom properties rather than being
           written to style.backgroundColor on every flash. Lighting a pad is then a
           class, which means the transition and the press travel are described once in
           the stylesheet instead of being animated from here. */
        return `<button type="button" class="sequence-pad" data-pad="${pad}"
                    style="--pad-face: ${face}; --pad-lit: ${lit}"
                    aria-label="Pad ${pad + 1}, ${name}"></button>`;
    }).join('');
    sequenceBoard.style.setProperty('--pad-count', sequenceGame.padCount);
}

/* The one place a pad is lit, so the light and the tone can never come apart. Both
   cues, or neither - a player relying on either channel alone gets the whole game. */
function firePad(pad, durationMs) {
    const el = sequenceBoard.querySelector(`.sequence-pad[data-pad="${pad}"]`);
    if (el) {
        el.classList.add('is-lit');
        sequenceTimers.push(setTimeout(() => el.classList.remove('is-lit'), durationMs));
    }
    playTone(toneFor(pad), durationMs);
}

function clearSequenceTimers() {
    sequenceTimers.forEach(clearTimeout);
    sequenceTimers = [];
    sequenceBoard.querySelectorAll('.is-lit').forEach((el) => el.classList.remove('is-lit'));
}

function drawSequenceStatus() {
    sequenceRoundEl.textContent = sequenceGame.round;
    sequenceBestEl.textContent = sequenceBest;

    const messages = {
        [SEQUENCE_STATUS.READY]: sequenceRunning
            ? 'Correct. Watch for the next one.'
            : 'Tap any pad to begin, then repeat what the machine plays.',
        [SEQUENCE_STATUS.SHOWING]: 'Watch and listen.',
        [SEQUENCE_STATUS.AWAITING]: 'Your turn - play it back.',
        [SEQUENCE_STATUS.LOST]: 'Wrong pad. The run ends there.',
    };
    sequenceStatusEl.textContent = messages[sequenceGame.status];
    sequenceBoard.classList.toggle('is-showing', sequenceGame.status === SEQUENCE_STATUS.SHOWING);
}

/* Show the run, one pad at a time, then hand over. Chained timeouts rather than a
   setInterval because the gap changes with the round - and because the last step has
   to know it is last, which is where the player's turn begins. */
function playSequenceBack() {
    clearSequenceTimers();
    drawSequenceStatus();

    const step = stepDurationMs(sequenceGame.round);
    const lit = Math.round(step * 0.6); // dark between flashes, so a repeat reads as two

    sequenceGame.sequence.forEach((pad, i) => {
        sequenceTimers.push(setTimeout(() => firePad(pad, lit), i * step));
    });

    // A beat after the last pad goes dark, so the run does not run into the answer.
    sequenceTimers.push(setTimeout(() => {
        sequenceGame = beginInput(sequenceGame);
        drawSequenceStatus();
    }, sequenceGame.sequence.length * step + 250));
}

function nextSequenceRound() {
    sequenceGame = extendSequence(sequenceGame);
    playSequenceBack();
}

/* Getting a run going, from whichever gesture asked for it. Both routes have to pass
   through here rather than only the Start button, because this is where the audio
   context is created - and it can only be created from a real user gesture, or the
   browser hands back one that is permanently suspended. */
function startSequenceRun() {
    sequenceRunning = true;
    ensureAudio();
    nextSequenceRound();
}

function initSequence({ start = false } = {}) {
    clearSequenceTimers();
    sequenceRunning = start;
    sequenceGame = createSequence(currentSequencePreset());
    buildSequencePads();
    drawSequenceStatus();
    if (start) startSequenceRun();
}

function playSequencePad(pad) {
    /* A pad press on an idle panel starts the game, which is the second way in
       alongside the Start button. On a machine covered in buttons, pressing one is the
       obvious thing to try first, and being ignored teaches the player the panel is
       dead when it is only waiting.

       The pad answers before the run begins - lit and sounded like any other press -
       so the gesture is acknowledged and the player hears what that pad does before
       being asked to remember it. Only from unstarted: a press between rounds must not
       start anything, and a press after a loss is behind the dialog anyway. */
    if (isUnstarted(sequenceGame)) {
        /* firePad first, and not only for the feedback: it sounds the pad, which builds
           the audio context inside the press itself. startSequenceRun asks for the
           context too, but it runs from a timer - outside the gesture - and Safari will
           not start a context from there. By then it is already running and the second
           call is a no-op. Reordering these two would leave the game silent on iOS. */
        firePad(pad, 180);
        sequenceTimers.push(setTimeout(startSequenceRun, 450));
        return;
    }

    if (sequenceGame.status !== SEQUENCE_STATUS.AWAITING) return;

    sequenceGame = pressPad(sequenceGame, pad);

    if (isSequenceOver(sequenceGame)) {
        /* The pad that was actually pressed is lit and sounded first, then the buzz -
           so a mistake shows what was played, not only that it was wrong. */
        firePad(pad, 180);
        sequenceTimers.push(setTimeout(() => playTone(FAILURE_TONE, 420, { gain: 0.12 }), 200));
        drawSequenceStatus();
        sequenceRunning = false;
        sequenceTimers.push(setTimeout(() => showGameOver(
            'Wrong pad.',
            // The finished game's own count, not the round it died on - see
            // completedRounds in js/sequence.js.
            `${completedRounds(sequenceGame)} ${completedRounds(sequenceGame) === 1 ? 'round' : 'rounds'}`,
            () => initSequence({ start: true }),
            sequenceModeSelect
        ), 500));
        return;
    }

    firePad(pad, 180);

    if (isRoundComplete(sequenceGame)) {
        sequenceBest = Math.max(sequenceBest, completedRounds(sequenceGame));
        drawSequenceStatus();
        /* A pause before the next run starts, or the reward for finishing one is being
           talked over immediately. */
        sequenceTimers.push(setTimeout(nextSequenceRound, 800));
        return;
    }

    drawSequenceStatus();
}

/* pointerdown, not click: on a touchscreen click waits for the finger to lift, and a
   game about answering a rhythm should not lag behind the finger by that much.

   A pad still has to work from the keyboard, and a keyboard activation arrives as a
   click with no pointer behind it. detail === 0 is what distinguishes those from the
   click that follows every tap - handling both events unguarded would fire each pad
   twice. */
const padFromEvent = (event) => event.target.closest('.sequence-pad');

sequenceBoard.addEventListener('pointerdown', (event) => {
    const pad = padFromEvent(event);
    if (!pad) return;
    event.preventDefault(); // no focus ring chasing the finger, no double-tap zoom
    playSequencePad(Number(pad.dataset.pad));
});

sequenceBoard.addEventListener('click', (event) => {
    const pad = padFromEvent(event);
    if (!pad || event.detail !== 0) return; // a real click already went through pointerdown
    playSequencePad(Number(pad.dataset.pad));
});

sequenceSoundToggle.addEventListener('click', () => setSoundOn(!soundOn));

// Changing the pad count is a different game, so it starts a fresh panel.
sequenceModeSelect.addEventListener('change', () => initSequence());
document.getElementById('sequenceStartBtn').addEventListener('click', () => initSequence({ start: true }));

setSoundOn(soundOn);

/* --- PART 6: TIC-TAC-TOE --- */
/* Single player, against an opponent drawn at random for each game - Perfect, Good or
   Bad, twenty, forty and forty games in a hundred - and never named during play.
   Working out which one you are facing is left to the player; View Results gives the
   answer in aggregate once five games are done. See NOTES.md.

   That puts a rule on this layer: nothing here may behave differently depending on who
   the opponent is. Same pause before every reply, same messages, same look.

   Two games share the view. Classic is js/tictactoe.js; Terni Lapilli, the Roman game -
   three pieces each, then moved one step along the board's eight lines - is
   js/ternilapilli.js. Both answer the same questions (createGame, outcome, playerMove,
   opponentMove and the rest), so most of this layer asks tictactoeRules() rather than
   caring which game it has. Where they differ is input: a Terni Lapilli piece is picked
   up and put down, which is the one piece of state below that Classic does not use.

   Like Minesweeper it ends in place rather than in the end-of-game dialog. The finished
   position is the whole story of a game this small, and covering it to announce who
   won would hide the evidence to report the verdict. */

const tictactoeBoard = document.getElementById('tictactoeDisplay');
const tictactoeStatusEl = document.getElementById('tictactoe-status');
const tictactoeModeSelect = document.getElementById('tictactoeModeSelect');
const tictactoeTallyEls = {
    won: document.getElementById('tictactoe-won'),
    drawn: document.getElementById('tictactoe-drawn'),
    lost: document.getElementById('tictactoe-lost'),
};
const tictactoeResultsBtn = document.getElementById('tictactoeResultsBtn');
const tictactoeResultsPanel = document.getElementById('tictactoe-results');
const tictactoeResultsCaption = document.getElementById('tictactoe-results-caption');
const tictactoeResultsBody = document.getElementById('tictactoe-results-body');
const tictactoeResultsClose = document.getElementById('tictactoeResultsClose');
const tictactoeTitleEl = document.getElementById('tictactoe-title');
const tictactoeSoloScoreEl = document.getElementById('tictactoe-score-solo');
const tictactoePassScoreEl = document.getElementById('tictactoe-score-pass');
const tictactoePassTallyEls = {
    one: document.getElementById('tictactoe-one'),
    two: document.getElementById('tictactoe-two'),
    drawn: document.getElementById('tictactoe-pass-drawn'),
};

const TICTACTOE_RULES = { classic: TicTacToe, terni: TerniLapilli };
const { MARKS: TICTACTOE_MARKS, STATUS: TICTACTOE_STATUS, LINES: TICTACTOE_LINES, otherMark } = TicTacToe;

/* Long enough that the reply is seen arriving rather than landing with the tap. Fixed,
   and the same for all three opponents: a pause that tracked how hard the opponent had
   to think would tell the player who it was. */
const TICTACTOE_REPLY_MS = 450;

const TICTACTOE_GLYPHS = {
    X: '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="M24 24 L76 76 M76 24 L24 76" /></svg>',
    O: '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="28" /></svg>',
};

let tictactoeMode = 'classic';
let tictactoeGame = null;
let tictactoeTimer = null; // the opponent's pending reply
let terniHeld = null;      // the Terni Lapilli piece picked up, waiting for somewhere to go

// One tally per game, for this session only - a reload starts them again.
const tictactoeTallies = { classic: TicTacToe.emptyTally(), terni: TicTacToe.emptyTally() };

/* Pass the phone: two people on this one device, set by the route (#tictactoe-pass). Its
   score follows the players, per mode, and is kept apart from single player's. */
let tictactoePlayers = 1;
const tictactoePassTallies = { classic: TicTacToe.emptyPassTally(), terni: TicTacToe.emptyPassTally() };

/* And, per mode, who the player was up against in each finished game - never shown in
   play, only through View Results once enough games are behind them. See NOTES.md. */
const tictactoeResults = { classic: TicTacToe.emptyResults(), terni: TicTacToe.emptyResults() };
const TICTACTOE_OPPONENT_NAMES = { perfect: 'Perfect', good: 'Good', bad: 'Bad' };

const tictactoeRules = () => TICTACTOE_RULES[tictactoeMode];
const isTerni = () => tictactoeMode === 'terni';
const isPass = () => tictactoePlayers === 2;

const tictactoeCentre = (cell) => ({ x: (cell % 3) + 0.5, y: Math.floor(cell / 3) + 0.5 });

/* Built once and repainted, like Minesweeper's board: replacing the buttons under a
   finger cancels the tap on touch. Both overlays are SVGs in board units - three a side -
   so a line between two points' centres needs no measuring.

   The Roman board's eight lines sit behind the points, shown only for Terni Lapilli.
   They are that game's movement rules - a piece steps along one - which is why it cannot
   be drawn as a grid of squares: the squares hide the diagonals. */
function buildTicTacToeBoard() {
    const cells = Array.from({ length: 9 }, (_, i) =>
        `<button type="button" class="tictactoe-cell" data-cell="${i}"></button>`).join('');
    const lines = TICTACTOE_LINES.map(([a, , c]) => {
        const from = tictactoeCentre(a);
        const to = tictactoeCentre(c);
        return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`;
    }).join('');

    tictactoeBoard.innerHTML = cells
        + '<svg class="tictactoe-strike" viewBox="0 0 3 3" preserveAspectRatio="none" aria-hidden="true" focusable="false"><line /></svg>'
        + `<svg class="terni-lines" viewBox="0 0 3 3" preserveAspectRatio="none" aria-hidden="true" focusable="false">${lines}</svg>`;
}

function drawTicTacToeStrike(line) {
    tictactoeBoard.classList.toggle('is-struck', Boolean(line));
    if (!line) return;

    // Carried a little past the end points' centres, so it reads as crossing them out.
    const from = tictactoeCentre(line[0]);
    const to = tictactoeCentre(line[2]);
    const reach = 0.36;
    const dx = Math.sign(to.x - from.x) * reach;
    const dy = Math.sign(to.y - from.y) * reach;
    const el = tictactoeBoard.querySelector('.tictactoe-strike line');
    el.setAttribute('x1', from.x - dx);
    el.setAttribute('y1', from.y - dy);
    el.setAttribute('x2', to.x + dx);
    el.setAttribute('y2', to.y + dy);
}

/* What a tap can do right now in Terni Lapilli's movement phase: which of the player's
   pieces can move, and where the one in hand can go. Legality only - nothing here says
   which move is any good. */
function terniMarkers(game) {
    const none = { movable: new Set(), destinations: new Set() };
    if (!isTerni() || !TerniLapilli.isPlayerTurn(game) || TerniLapilli.isPlacing(game.board, game.turn)) {
        return none;
    }
    return {
        movable: new Set(TerniLapilli.legalMoves(game.board, game.turn).map((move) => move.from)),
        destinations: new Set(terniHeld === null ? [] : TerniLapilli.movesFrom(game, terniHeld)),
    };
}

/* None of these may depend on who the opponent is, and none describe the position - the
   same rule Minesweeper's status line keeps. They say what the controls do and what the
   rules allow. The mark for the next game is fine to state: the alternation decides it,
   not the board. */
/* Pass the phone's messages name the players, with the mark each holds this game. The
   marks change hands every game, so a mark on its own would not say whose turn it is. */
function passMessage(game, { status, winner, repeated }) {
    const who = (mark) => `Player ${TicTacToe.playerNumberOf(game, mark)} (${mark})`;
    // X goes first, and next game X belongs to whoever holds O now.
    const nextFirst = `Player ${TicTacToe.playerNumberOf(game, TICTACTOE_MARKS.O)} is X next game.`;

    if (winner) return `Player ${TicTacToe.playerNumberOf(game, winner)} wins. ${nextFirst}`;
    if (status === TICTACTOE_STATUS.DRAW) {
        return repeated
            ? `A draw: the same position came up three times. ${nextFirst}`
            : `A draw. ${nextFirst}`;
    }

    const mover = isTerni() ? game.turn : TicTacToe.turnOf(game.board);
    const untouched = game.board.every((cell) => cell === null);

    if (!isTerni()) return untouched ? `${who(mover)} goes first. Tap any square.` : `${who(mover)} to move.`;
    // No centre ban here - pass the phone allows it; see createGame in js/ternilapilli.js.
    if (untouched) return `${who(mover)} goes first. Place a piece anywhere.`;
    if (TerniLapilli.isPlacing(game.board, game.turn)) return `${who(mover)}: place a piece.`;
    return terniHeld === null
        ? `${who(mover)}: pick up one of your pieces.`
        : 'Tap a marked point to move there, or pick up a different piece.';
}

function tictactoeMessage(game, result) {
    if (isPass()) return passMessage(game, result);
    const { status, repeated } = result;
    const you = game.playerMark;
    const next = otherMark(you);
    const untouched = game.board.every((cell) => cell === null);

    if (status === TICTACTOE_STATUS.WON) return `You win. Next game you are ${next}.`;
    if (status === TICTACTOE_STATUS.LOST) return `The opponent wins. Next game you are ${next}.`;
    if (status === TICTACTOE_STATUS.DRAW) {
        return repeated
            ? `A draw: the same position came up three times. Next game you are ${next}.`
            : `A draw. Next game you are ${next}.`;
    }

    if (tictactoeRules().isOpponentTurn(game)) return 'The opponent is thinking.';

    if (!isTerni()) {
        return untouched ? `You are ${you} and go first. Tap any square.` : `Your move. You are ${you}.`;
    }
    if (untouched) return `You are ${you} and go first. Place a piece on any point but the centre.`;
    if (TerniLapilli.isPlacing(game.board, game.turn)) return `Your move. Place a piece. You are ${you}.`;
    return terniHeld === null
        ? `Your move. Pick up one of your pieces. You are ${you}.`
        : 'Tap a marked point to move there, or pick up a different piece.';
}

function drawTicTacToe() {
    const game = tictactoeGame;
    const result = tictactoeRules().outcome(game);
    const over = result.status !== TICTACTOE_STATUS.PLAYING;
    const { movable, destinations } = terniMarkers(game);

    tictactoeBoard.classList.toggle('is-terni', isTerni());

    tictactoeBoard.querySelectorAll('.tictactoe-cell').forEach((cell) => {
        const index = Number(cell.dataset.cell);
        const mark = game.board[index] || '';
        // Only rewritten when it changes, so a repaint never swaps out what is under a finger.
        if (cell.dataset.mark !== mark) {
            cell.dataset.mark = mark;
            cell.innerHTML = mark ? TICTACTOE_GLYPHS[mark] : '';
        }
        cell.classList.toggle('is-movable', movable.has(index));
        cell.classList.toggle('is-held', index === terniHeld);
        cell.classList.toggle('is-destination', destinations.has(index));

        const where = `row ${Math.floor(index / 3) + 1}, column ${(index % 3) + 1}`;
        const notes = [
            mark || 'empty',
            index === terniHeld ? 'picked up' : '',
            destinations.has(index) ? 'can move here' : '',
        ].filter(Boolean).join(', ');
        cell.setAttribute('aria-label', `${isTerni() ? 'Point' : 'Square'}, ${where}, ${notes}`);
    });

    drawTicTacToeStrike(result.line);
    tictactoeBoard.classList.toggle('is-over', over);
    tictactoeBoard.classList.toggle('is-waiting', tictactoeRules().isOpponentTurn(game));

    tictactoeTitleEl.textContent = isPass() ? 'Tic-Tac-Toe: pass the phone' : 'Tic-Tac-Toe';
    tictactoeSoloScoreEl.hidden = isPass();
    tictactoePassScoreEl.hidden = !isPass();

    const tally = tictactoeTallies[tictactoeMode];
    Object.entries(tictactoeTallyEls).forEach(([key, el]) => { el.textContent = tally[key]; });
    const passTally = tictactoePassTallies[tictactoeMode];
    Object.entries(tictactoePassTallyEls).forEach(([key, el]) => { el.textContent = passTally[key]; });

    // Results are about the computer opponents, so pass the phone has nothing to show.
    tictactoeResultsBtn.hidden = isPass() || !TicTacToe.canViewResults(tictactoeResults[tictactoeMode]);

    tictactoeStatusEl.textContent = tictactoeMessage(game, result);
    tictactoeStatusEl.classList.toggle('is-result', over);
}

/* The pause, then the reply - only while the view is on screen. stopAllGames resets
   this game before the next view is shown, so a reply scheduled from there would be
   played onto a hidden board; showRoute asks again once the view is visible. */
function scheduleTicTacToeReply() {
    if (tictactoeTimer || views.tictactoe.hidden || !tictactoeRules().isOpponentTurn(tictactoeGame)) return;
    tictactoeTimer = setTimeout(() => {
        tictactoeTimer = null;
        if (views.tictactoe.hidden) return;
        tictactoeGame = tictactoeRules().opponentMove(tictactoeGame);
        settleTicTacToe();
    }, TICTACTOE_REPLY_MS);
}

// After any move: score a finished game, repaint, and hand over if the opponent is next.
function settleTicTacToe() {
    const rules = tictactoeRules();
    if (rules.isOver(tictactoeGame) && isPass()) {
        tictactoePassTallies[tictactoeMode] = rules.recordPassResult(tictactoePassTallies[tictactoeMode], tictactoeGame);
    } else if (rules.isOver(tictactoeGame)) {
        tictactoeTallies[tictactoeMode] = rules.recordResult(tictactoeTallies[tictactoeMode], tictactoeGame);
        tictactoeResults[tictactoeMode] = TicTacToe.recordGame(tictactoeResults[tictactoeMode], {
            opponent: tictactoeGame.opponent,
            status: rules.outcome(tictactoeGame).status,
            winnable: tictactoeGame.winnable,
        });
    }
    drawTicTacToe();
    scheduleTicTacToeReply();
}

/* A new game of whichever mode is selected, with a freshly drawn opponent. The player
   swaps marks - and so who goes first, since X always does - but only once the game
   before had a move in it. Leaving the view, or pressing New Game on an untouched
   board, is not a game played and does not use up a turn at going first. */
function initTicTacToe() {
    clearTimeout(tictactoeTimer);
    tictactoeTimer = null;
    terniHeld = null;
    // Results are read between games; starting the next one puts them away.
    if (tictactoeResultsPanel.open) tictactoeResultsPanel.close();

    const previous = tictactoeGame;
    let playerMark = TICTACTOE_MARKS.X;
    // Coming over from the other kind of game starts the alternation afresh: you, or
    // Player 1, go first as X. Carrying single player's turn into pass the phone would
    // decide who starts by something neither player did.
    if (previous && previous.players === tictactoePlayers) {
        const played = previous.board.some((cell) => cell !== null);
        playerMark = played ? otherMark(previous.playerMark) : previous.playerMark;
    }

    tictactoeMode = TICTACTOE_RULES[tictactoeModeSelect.value] ? tictactoeModeSelect.value : 'classic';
    const rules = tictactoeRules();
    tictactoeGame = rules.createGame({ playerMark, opponent: rules.pickOpponent(), players: tictactoePlayers });
    drawTicTacToe();
}

// Anything illegal comes back as the same game, and is simply ignored.
function commitTicTacToe(next) {
    if (next === tictactoeGame) return;
    tictactoeGame = next;
    terniHeld = null;
    settleTicTacToe();
}

/* A tap plays - or, in Terni Lapilli once the pieces are down, picks up or puts down. */
function tapTicTacToe(index) {
    const rules = tictactoeRules();
    const game = tictactoeGame;
    if (!rules.isPlayerTurn(game)) return;

    if (!isTerni()) {
        commitTicTacToe(rules.playerMove(game, index));
        return;
    }

    if (TerniLapilli.isPlacing(game.board, game.turn)) {
        commitTicTacToe(rules.playerMove(game, { from: null, to: index }));
        return;
    }

    if (game.board[index] === game.turn) {
        // Your own piece: put it back, or pick it up - unless it has nowhere to go, when
        // picking it up would only offer a choice that is not there.
        if (terniHeld === index) terniHeld = null;
        else if (TerniLapilli.movesFrom(game, index).length) terniHeld = index;
        drawTicTacToe();
        return;
    }

    if (terniHeld !== null) commitTicTacToe(rules.playerMove(game, { from: terniHeld, to: index }));
}

tictactoeBoard.addEventListener('click', (event) => {
    const cell = event.target.closest('.tictactoe-cell');
    if (cell) tapTicTacToe(Number(cell.dataset.cell));
});

/* prepare() does the optimal opponent's thinking up front, for every game whoever the
   opponent is, so that no reply ever carries it. Here and in showRoute - the two ways a
   game can be started with the view on screen - and never inside the reply itself. */
const startTicTacToe = () => {
    initTicTacToe();
    if (!isPass()) tictactoeRules().prepare();
    scheduleTicTacToeReply();
};

document.getElementById('tictactoeStartBtn').addEventListener('click', startTicTacToe);

/* View Results: per opponent, games played, won, and winnable. Offered only once
   RESULTS_AFTER games of this mode are finished - before that the opponents stay a
   question. Opening it clears this mode's record and score, so what is shown is the
   account of those games and the next ones start a fresh puzzle. Cleared on opening
   rather than on closing, so leaving the page mid-view cannot leave an already-seen
   record running on. */
function showTicTacToeResults() {
    const results = tictactoeResults[tictactoeMode];
    const modeName = tictactoeModeSelect.options[tictactoeModeSelect.selectedIndex].textContent;

    tictactoeResultsCaption.textContent = `${modeName}, your last ${TicTacToe.gamesRecorded(results)} games`;
    tictactoeResultsBody.innerHTML = TicTacToe.OPPONENTS.map((opponent) => {
        const { played, won, drawn, winnable } = results[opponent];
        return `<tr><th scope="row">${TICTACTOE_OPPONENT_NAMES[opponent]}</th>`
            + `<td>${played}</td><td>${won}</td><td>${drawn}</td><td>${winnable}</td></tr>`;
    }).join('');

    tictactoeResults[tictactoeMode] = TicTacToe.emptyResults();
    tictactoeTallies[tictactoeMode] = TicTacToe.emptyTally();
    drawTicTacToe();

    /* A native modal dialog, not a hand-built overlay. Esc closes it, focus stays inside
       while it is open and lands on Done without scrolling the page, and it sits in the
       browser's top layer. That last part matters here: each .game-view is a size
       container, which confines a fixed-position overlay inside it to the view - see the
       note on --board-space. The top layer is not confined by anything. */
    if (typeof tictactoeResultsPanel.showModal === 'function') tictactoeResultsPanel.showModal();
    else tictactoeResultsPanel.setAttribute('open', '');
}

function closeTicTacToeResults() {
    if (typeof tictactoeResultsPanel.close === 'function') tictactoeResultsPanel.close();
    else tictactoeResultsPanel.removeAttribute('open');
}

tictactoeResultsBtn.addEventListener('click', showTicTacToeResults);
tictactoeResultsClose.addEventListener('click', closeTicTacToeResults);
/* A tap on the dimmed backdrop closes it too. The content fills an inner panel, so a
   click whose target is the dialog element itself can only have landed outside it. */
tictactoeResultsPanel.addEventListener('click', (event) => {
    if (event.target === tictactoeResultsPanel) closeTicTacToeResults();
});
// Changing the game starts a fresh board of it; the one abandoned is not scored.
tictactoeModeSelect.addEventListener('change', startTicTacToe);

buildTicTacToeBoard();

/* --- PART 7: PETS --- */
/* A toy, not a game: nothing to win or lose. A pixel-art pet in a small room - a yellow
   Labrador retriever for now, with the species select there for the animals to come.
   Stroke it and it leans into your hand and gives a soft bark; drag food or water to its
   bowls and it walks over to eat or drink.

   The sprites, what counts as a stroke, when a bark is due, and the bowls are in
   js/pets.js; the colours are PETS_COLORS in js/logic.js. Everything with a clock lives
   here, as it does for Sequence. It all runs on timers, so it is torn down in
   stopAllGames with the rest. */

const petsScene = document.getElementById('pets-scene');
const petsSvg = document.getElementById('pets-svg');
const petsDogHit = document.getElementById('pets-dog-hit');
const petsStatusEl = document.getElementById('pets-status');
const petsSpeciesSelect = document.getElementById('petsSpeciesSelect');
const petsSoundToggle = document.getElementById('petsSoundToggle');
const petsItems = document.querySelectorAll('.pets-item');
const petsBowlSlots = {
    food: petsScene.querySelector('.pets-bowl-slot[data-bowl="food"]'),
    water: petsScene.querySelector('.pets-bowl-slot[data-bowl="water"]'),
};

const PETS_STEP_MS = 70;          // one pixel of walking
const PETS_HALF_CHOMP_MS = 190;   // head up, or head down
const PETS_HALF_CHOMPS_PER_BITE = 4;
const PETS_WAG_MS = 170;
const PETS_TICK_MS = 100;         // how often a held stroke is checked
const PETS_HINT_MS = 2800;        // how long a hint stays before the usual line returns
const PETS_DROP_PAD = 24;         // slack around a bowl for a finger
const PETS_DRAG_START_PX = 8;     // movement before a press on an item is a drag, not a tap

const petsReduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

let pets = null;       // the pet and its room; see resetPets
let petsDrag = null;   // an item being dragged: { item, startX, startY, moved, ghost, target }
let petsSoundOn = true;

try {
    // Remembered separately from Sequence's switch: one is a game's tones, the other a pet.
    petsSoundOn = window.localStorage.getItem('pets-sound') !== 'off';
} catch { /* no storage - stay with the default */ }

const petSpecies = () => Pets.SPECIES[pets.species];
const petsDefaultMessage = () => {
    const name = petSpecies().name.toLowerCase();
    return pets?.asleep
        ? `The ${name} is asleep. Stroke it to wake it up.`
        : `Stroke the ${name} to pet it. Drag food or water to its bowl.`;
};
const petsDogLabel = () => (pets.asleep
    ? `${petSpecies().description}, asleep. Stroke it to wake it up.`
    : `${petSpecies().description}. Stroke it to pet it.`);

// A sprite as SVG rects, one per run of a colour, offset into place. The window passes the
// sky's colours for the time of day.
const petRects = (rows, x0 = 0, y0 = 0, colors = PETS_COLORS) => Pets.spriteRuns(rows)
    .map(({ x, y, width, key }) =>
        `<rect x="${x + x0}" y="${y + y0}" width="${width}" height="1" fill="${colors[Pets.SPRITE_KEYS[key]]}"/>`)
    .join('');

// Place an HTML overlay over a region of the room, in room pixels. Percentages, so it
// follows the room as it resizes.
function placePetsOverlay(el, x, y, width, height) {
    const room = Pets.SCENE;
    el.style.left = `${(x / room.width) * 100}%`;
    el.style.top = `${(y / room.height) * 100}%`;
    el.style.width = `${(width / room.width) * 100}%`;
    el.style.height = `${(height / room.height) * 100}%`;
}

/* The room is built once, back to front: wall, skirting board and floor, the window and the
   plant, then a group for the dog and one for each bowl. Drawing a frame only replaces
   what is inside those groups. The bowls come after the dog, so they draw in front of it -
   a lowered head then looks like it is in the bowl rather than beside it. */
function buildPetsScene() {
    const { width, height, floorY } = Pets.SCENE;
    const band = (y, rows, color) => `<rect x="0" y="${y}" width="${width}" height="${rows}" fill="${color}"/>`;
    const furnishing = ({ x, y, rows }) => `<g transform="translate(${x} ${y})">${petRects(rows)}</g>`;
    petsSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    petsSvg.innerHTML =
        band(0, floorY, PETS_COLORS.wall)
        + band(Pets.SKIRTING_TOP, 1, PETS_COLORS.sceneLine)
        + band(Pets.SKIRTING_TOP + 1, floorY - Pets.SKIRTING_TOP - 1, PETS_COLORS.trim)
        + band(floorY, 1, PETS_COLORS.sceneLine)
        + band(floorY + 1, height - floorY - 1, PETS_COLORS.floor)
        + Pets.FLOOR_SEAMS.map((y) => band(y, 1, PETS_COLORS.floorShade)).join('')
        + '<g class="pets-window"></g>'   // drawn by drawPetsWindow, for the time of day
        + furnishing(Pets.PLANT)
        + '<g class="pets-dog"><g class="pets-body"></g><g class="pets-head"></g></g>'
        + '<g class="pets-zzz"></g>'
        + Pets.ITEMS.map((kind) => `<g class="pets-bowl" data-bowl="${kind}"></g>`).join('');

    Pets.ITEMS.forEach((kind) => {
        const { x, y } = Pets.BOWLS[kind];
        placePetsOverlay(petsBowlSlots[kind], x, y, Pets.BOWL_SIZE.width, Pets.BOWL_SIZE.height);
    });

    petsItems.forEach((item) => {
        const rows = Pets.ITEM_ICONS[item.dataset.item];
        item.innerHTML = `<svg viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${petRects(rows)}</svg>`;
    });
}

function drawPet() {
    const species = petSpecies();
    const body = species.body[Pets.bodyFrame(pets.posture, pets.wag, pets.stepsWalked, pets.breath)];
    const offset = Pets.headOffset(pets.posture, {
        leaning: pets.leaning,
        leanDx: pets.leanDx,
        chompUp: pets.chompUp,
        stepsWalked: pets.stepsWalked,
    });

    const dog = petsSvg.querySelector('.pets-dog');
    /* Facing right is the same drawing mirrored within its own box, so the dog stays in the
       same place and the stroke overlay still covers it. */
    dog.setAttribute('transform', pets.facing === 'right'
        ? `translate(${pets.x + species.size.width} ${Pets.DOG_Y}) scale(-1 1)`
        : `translate(${pets.x} ${Pets.DOG_Y})`);
    dog.querySelector('.pets-body').innerHTML = petRects(body);
    dog.querySelector('.pets-head').innerHTML = petRects(species.head[pets.eyes], offset.dx, offset.dy);
    // The Z's are outside the dog's group, so a mirrored dog could never mirror the letters.
    petsSvg.querySelector('.pets-zzz').innerHTML = pets.asleep
        ? Pets.zzzFrame(pets.zzzStep).map(({ x, y, rows }) => petRects(rows, pets.x + x, Pets.DOG_Y + y)).join('')
        : '';
    placePetsOverlay(petsDogHit, pets.x, Pets.DOG_Y, species.size.width, species.size.height);
}

function drawPetBowls() {
    Pets.ITEMS.forEach((kind) => {
        const { x, y } = Pets.BOWLS[kind];
        petsSvg.querySelector(`.pets-bowl[data-bowl="${kind}"]`).innerHTML = petRects(Pets.bowlRows(kind, pets.bowls[kind]), x, y);
    });
}

// A hint in the status line, which goes back to the usual line after a moment.
function petsHint(message) {
    petsStatusEl.textContent = message;
    clearTimeout(pets.timers.hint);
    pets.timers.hint = setTimeout(() => { petsStatusEl.textContent = petsDefaultMessage(); }, PETS_HINT_MS);
}

function clearPetsTimers() {
    const { walk, chomp, wag, tick, barkSteps, thank, hint, fidget, sleep, clock } = pets.timers;
    clearTimeout(fidget);
    clearInterval(sleep);
    clearInterval(clock);
    clearInterval(walk);
    clearInterval(chomp);
    clearInterval(wag);
    clearInterval(tick);
    barkSteps.forEach(clearTimeout);
    clearTimeout(thank);
    clearTimeout(hint);
}

/* A fresh room: the pet at home, the bowls empty, nothing moving. Called on load, when the
   animal changes, and from stopAllGames whenever the view changes. */
function resetPets() {
    if (pets) clearPetsTimers();
    endPetsDrag();
    petsDogHit.classList.remove('is-petting');

    const period = petsTimeOfDay();
    const asleep = period === 'night'; // opened at night, the dog is already asleep
    pets = {
        species: Pets.SPECIES[petsSpeciesSelect.value] ? petsSpeciesSelect.value : 'dog',
        x: Pets.HOME_X,
        homeX: Pets.HOME_X, // where it last settled, and goes back to after eating
        facing: 'left',     // left | right - right only while walking right
        activity: 'idle',   // idle | walking | eating | drinking | thanking | fidgeting
        posture: asleep ? 'sleep' : Pets.RESTING_POSTURE, // sit | stand | down | walk | sleep
        leaning: false,     // head raised into a stroking hand
        barking: false,     // from the first yip to the end of the last, gaps included
        stepsWalked: 0,     // pixels into the current walk, for the leg frames
        eyes: asleep ? 'asleep' : 'open', // open | happy | bark | asleep
        wag: false,
        leanDx: -1,
        chompUp: false,
        period,             // dawn | day | dusk | night - see Pets.timeOfDay
        asleep,
        breath: false,      // the half of a sleeping breath where the back is up
        zzzStep: 0,         // how far the Z's have drifted
        bowls: Pets.emptyBowls(),
        stroke: null,
        lastBarkAt: -Infinity,
        timers: { walk: null, chomp: null, wag: null, tick: null, barkSteps: [], thank: null, hint: null, fidget: null, sleep: null, clock: null },
    };

    petsDogHit.setAttribute('aria-label', petsDogLabel());
    petsStatusEl.textContent = petsDefaultMessage();
    drawPetsWindow();
    drawPetBowls();
    drawPet();
}

/* The wag. With reduced motion the tail simply stays up while the pet is happy, rather than
   swinging - the tail up still says it. */
function setPetWagging(on) {
    if (petsReduceMotion.matches) {
        pets.wag = on;
        return;
    }
    if (on && !pets.timers.wag) {
        pets.timers.wag = setInterval(() => {
            pets.wag = !pets.wag;
            drawPet();
        }, PETS_WAG_MS);
    } else if (!on && pets.timers.wag) {
        clearInterval(pets.timers.wag);
        pets.timers.wag = null;
        pets.wag = false;
    }
}

/* --- Petting --- */

const petsPoint = (event) => ({ x: event.clientX, y: event.clientY, t: performance.now() });

function petsBusyMessage() {
    const name = petSpecies().name.toLowerCase();
    if (pets.activity === 'eating') return `Let the ${name} finish eating first.`;
    if (pets.activity === 'drinking') return `Let the ${name} finish drinking first.`;
    if (pets.activity === 'fidgeting') return `The ${name} is finding a new spot.`;
    if (pets.activity === 'thanking') return `The ${name} is saying thank you.`;
    return `The ${name} is on its way to its bowl.`;
}

// Leaning into the hand: head raised toward it, eyes closed, tail going.
function showPetRubbing(leanDx) {
    pets.leanDx = leanDx;
    if (pets.asleep) wakePet(); // petting is the one thing that wakes it at night
    if (pets.barking) return; // the bark finishes first, then the rub resumes
    // Only the head moves: the dog stays sitting to be petted.
    pets.leaning = !petsReduceMotion.matches;
    pets.eyes = 'happy';
    setPetWagging(true);
    drawPet();
}

/* Back to resting quietly - sitting, if it is at home - and, if something was put in a bowl
   meanwhile, over to it. */
function settlePet() {
    if (pets.asleep) return; // a tap that never became a stroke leaves it sleeping
    pets.leaning = false;
    if (pets.activity === 'idle') {
        pets.posture = Pets.RESTING_POSTURE;
        // It turns back to face the bowls when it sits, whichever way it walked.
        pets.facing = 'left';
    }
    pets.eyes = 'open';
    setPetWagging(false);
    drawPet();
    maybeVisitBowl();
    // At night, each time it settles, the countdown to dozing off starts again.
    if (pets.activity === 'idle' && pets.period === 'night' && !views.pets.hidden) scheduleFidget();
}

/* The bark is built as samples by barkSamples in js/pets.js - pure, and so tested for its
   shape - and played from a buffer here, made once for the audio context's sample rate and
   reused. It plays the picked sound exactly: an earlier version varied each bark's speed
   a little, but that moved the pitch away from what was chosen by ear. */
let petsBarkBuffer = null;

function playBark() {
    if (!petsSoundOn) return;
    const ctx = audioContext();
    if (!ctx) return;

    if (!petsBarkBuffer || petsBarkBuffer.sampleRate !== ctx.sampleRate) {
        const samples = Pets.barkSamples(ctx.sampleRate);
        petsBarkBuffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
        petsBarkBuffer.getChannelData(0).set(samples);
    }

    const source = ctx.createBufferSource();
    source.buffer = petsBarkBuffer;

    const level = ctx.createGain();
    level.gain.value = Pets.BARK.playbackGain;

    source.connect(level).connect(ctx.destination);
    source.start();
}

/* The mouth opens and the bark sounds together - the same pairing Sequence keeps - and now
   once per yip rather than once for the whole bark. barkMouthTimes in js/pets.js says
   when, from the same settings the sound is built from. Between yips the face goes back to
   what it was, happy if the dog is still being stroked; after the last yip the dog settles
   as before. `barking` covers the whole bark, gaps included, so a stroke that ends between
   yips does not cut the bark short. */
function barkPet(finished = null) {
    pets.lastBarkAt = performance.now();
    pets.barking = true;
    setPetWagging(true);
    playBark();

    pets.timers.barkSteps.forEach(clearTimeout);
    pets.timers.barkSteps = [];
    const stillStroked = () => pets.stroke && Pets.isRubbing(pets.stroke, performance.now());
    const times = Pets.barkMouthTimes();

    times.forEach(({ openMs, closeMs }, i) => {
        const openMouth = () => {
            pets.eyes = 'bark';
            drawPet();
        };
        if (openMs === 0) openMouth();
        else pets.timers.barkSteps.push(setTimeout(openMouth, openMs));

        pets.timers.barkSteps.push(setTimeout(() => {
            if (i < times.length - 1) {
                pets.eyes = stillStroked() ? 'happy' : 'open';
                drawPet();
                return;
            }
            pets.barking = false;
            pets.timers.barkSteps = [];
            if (finished) {
                finished();
            } else if (stillStroked()) {
                pets.eyes = 'happy';
                drawPet();
            } else {
                settlePet();
            }
        }, closeMs));
    });
}

// While a stroke is held: bark on a long pet, and stop rubbing when the hand goes still.
function petsTick() {
    if (!pets.stroke) return;
    const now = performance.now();
    if (Pets.barkDue(pets.stroke, { now, lastBarkAt: pets.lastBarkAt })) {
        pets.stroke = { ...pets.stroke, barked: true };
        barkPet();
        return;
    }
    if (!pets.barking && pets.eyes === 'happy' && !Pets.isRubbing(pets.stroke, now)) settlePet();
}

function endPetStroke() {
    const stroke = pets.stroke;
    if (!stroke) return;
    pets.stroke = null;
    clearInterval(pets.timers.tick);
    pets.timers.tick = null;
    petsDogHit.classList.remove('is-petting');

    if (Pets.barkDue(stroke, { now: performance.now(), ending: true, lastBarkAt: pets.lastBarkAt })) {
        barkPet();
    } else if (!pets.barking) {
        settlePet();
    }
}

petsDogHit.addEventListener('pointerdown', (event) => {
    if (pets.activity !== 'idle') {
        petsHint(petsBusyMessage());
        return;
    }
    event.preventDefault();
    /* The bark can come from a long stroke, which arrives as pointermove - and that is not
       a gesture a browser will start audio from. So the context is started here, on the
       press itself. */
    if (petsSoundOn) audioContext();
    try { petsDogHit.setPointerCapture(event.pointerId); } catch { /* keep going without capture */ }
    pets.stroke = Pets.startStroke(petsPoint(event));
    petsDogHit.classList.add('is-petting');
    clearInterval(pets.timers.tick);
    pets.timers.tick = setInterval(petsTick, PETS_TICK_MS);
});

petsDogHit.addEventListener('pointermove', (event) => {
    if (!pets.stroke) return;
    pets.stroke = Pets.moveStroke(pets.stroke, petsPoint(event));
    if (!Pets.isRubbing(pets.stroke, performance.now())) return;

    const rect = petsDogHit.getBoundingClientRect();
    const headCentre = rect.left + rect.width * (petSpecies().headCentreX / petSpecies().size.width);
    showPetRubbing(Pets.leanToward(event.clientX, headCentre));
});

['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => {
    petsDogHit.addEventListener(type, endPetStroke);
});

/* --- Food and water --- */

function maybeVisitBowl() {
    if (pets.activity !== 'idle' || pets.stroke || pets.asleep) return;
    const next = Pets.bowlToVisit(pets.bowls);
    if (next) visitBowl(next);
}

/* Walk a pixel at a time. With reduced motion the pet is simply there - where it is going
   is the information, not the walk. */
function walkPetTo(targetX, arrived) {
    clearInterval(pets.timers.walk);
    pets.timers.walk = null;
    pets.facing = Pets.facingFor(pets.x, targetX, pets.facing);
    if (petsReduceMotion.matches || pets.x === targetX) {
        pets.x = targetX;
        drawPet();
        arrived();
        return;
    }

    /* The legs cycle through WALK_CYCLE as the dog goes - a frame every couple of pixels,
       the head dipping on each stride - and it arrives standing. The pace is unchanged. */
    pets.posture = 'walk';
    pets.stepsWalked = 0;
    drawPet();
    pets.timers.walk = setInterval(() => {
        pets.x = Pets.stepToward(pets.x, targetX);
        pets.stepsWalked += 1;
        if (pets.x === targetX) {
            clearInterval(pets.timers.walk);
            pets.timers.walk = null;
            pets.posture = 'stand';
            drawPet();
            arrived();
            return;
        }
        drawPet();
    }, PETS_STEP_MS);
}

// Getting up: food or water is the only thing that brings the dog to its feet.
function visitBowl(kind) {
    pets.activity = 'walking';
    pets.posture = 'stand';
    pets.leaning = false;
    pets.eyes = 'open';
    setPetWagging(true);
    walkPetTo(Pets.dogXForBowl(kind), () => startEating(kind));
}

function startEating(kind) {
    pets.activity = kind === 'food' ? 'eating' : 'drinking';
    pets.posture = 'down';
    pets.chompUp = false;
    drawPet();

    let halfChomps = 0;
    pets.timers.chomp = setInterval(() => {
        halfChomps += 1;
        if (!petsReduceMotion.matches) pets.chompUp = !pets.chompUp;
        if (halfChomps % PETS_HALF_CHOMPS_PER_BITE === 0) {
            pets.bowls = Pets.takeBite(pets.bowls, kind);
            drawPetBowls();
        }
        drawPet();
        if (pets.bowls[kind] === 0 && !pets.chompUp) {
            clearInterval(pets.timers.chomp);
            pets.timers.chomp = null;
            finishEating(kind);
        }
    }, PETS_HALF_CHOMP_MS);
}

/* Then to the other bowl if it has something in it. If not, the meal is over: a thank-you
   bark standing at the last bowl - the owner's pick over barking at home or after every
   bowl - and then home. One bark per meal, whether it ate, drank or both. The bark is set
   apart by a pause either side, so it reads as its own moment rather than part of the
   eating or the walk: stand, wait, bark, wait, go. The owner tuned the pauses by feel: a
   second either side at first, then half a second before. */
const PETS_THANK_WAIT_BEFORE_MS = 500;
const PETS_THANK_WAIT_AFTER_MS = 1000;

function finishEating(kind) {
    pets.posture = 'stand';
    pets.chompUp = false;
    const other = kind === 'food' ? 'water' : 'food';
    const next = Pets.bowlToVisit(pets.bowls, other);
    if (next) {
        visitBowl(next);
        return;
    }
    pets.activity = 'thanking';
    drawPet();
    pets.timers.thank = setTimeout(() => {
        pets.timers.thank = null;
        barkPet(() => {
            pets.eyes = 'open';
            drawPet();
            pets.timers.thank = setTimeout(() => {
                pets.timers.thank = null;
                // A bowl filled meanwhile is still visited before going home, and thanked for.
                const refilled = Pets.bowlToVisit(pets.bowls, other);
                if (refilled) {
                    visitBowl(refilled);
                    return;
                }
                pets.activity = 'walking';
                // Back to wherever it last settled, which fidgeting moves about.
                walkPetTo(pets.homeX, () => {
                    pets.activity = 'idle';
                    settlePet();
                });
            }, PETS_THANK_WAIT_AFTER_MS);
        });
    }, PETS_THANK_WAIT_BEFORE_MS);
}

function givePetItem(kind) {
    const { bowls, filled } = Pets.fillBowl(pets.bowls, kind);
    if (!filled) {
        petsHint(`The ${kind} bowl is already full.`);
        return;
    }
    pets.bowls = bowls;
    drawPetBowls();
    // Food and water don't wake it at night - the owner's call. Once petting has, it goes to eat.
    if (pets.asleep) petsHint(`The ${petSpecies().name.toLowerCase()} is asleep. It will find this when it wakes.`);
    maybeVisitBowl();
}

/* --- Dragging --- */

function petsBowlTargets() {
    return Pets.ITEMS.map((kind) => {
        const { left, top, right, bottom } = petsBowlSlots[kind].getBoundingClientRect();
        return { kind, rect: { left, top, right, bottom } };
    });
}

function movePetsDrag(event) {
    const drag = petsDrag;
    drag.ghost.style.left = `${event.clientX}px`;
    drag.ghost.style.top = `${event.clientY}px`;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > PETS_DRAG_START_PX) drag.moved = true;
    drag.target = Pets.dropTarget({ x: event.clientX, y: event.clientY }, petsBowlTargets(), PETS_DROP_PAD);
    // Only the bowl the item belongs in lights up, so the outline never invites a wrong drop.
    Pets.ITEMS.forEach((kind) => {
        petsBowlSlots[kind].classList.toggle('is-drop-target', kind === drag.target && kind === drag.item.dataset.item);
    });
}

function endPetsDrag() {
    if (!petsDrag) return;
    petsDrag.ghost.remove();
    petsDrag.item.classList.remove('is-dragging');
    Pets.ITEMS.forEach((kind) => petsBowlSlots[kind].classList.remove('is-drop-target'));
    petsDrag = null;
}

function dropPetsItem(event) {
    movePetsDrag(event);
    const item = petsDrag.item.dataset.item;
    const { target, moved } = petsDrag;
    endPetsDrag();

    if (target && Pets.acceptsItem(target, item)) givePetItem(item);
    else if (target) petsHint(`That goes in the ${item} bowl.`);
    else if (!moved) petsHint(`Drag the ${item} to its bowl.`);
}

petsItems.forEach((item) => {
    item.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        endPetsDrag();
        try { item.setPointerCapture(event.pointerId); } catch { /* keep going without capture */ }

        /* The copy that follows the finger goes on the body, not in the view: each
           .game-view is a size container, which would confine a fixed-position element to
           the view instead of the screen. */
        const ghost = document.createElement('div');
        ghost.className = 'pets-ghost';
        ghost.innerHTML = item.innerHTML;
        document.body.appendChild(ghost);

        petsDrag = { item, startX: event.clientX, startY: event.clientY, moved: false, ghost, target: null };
        item.classList.add('is-dragging');
        movePetsDrag(event);
    });
    item.addEventListener('pointermove', (event) => {
        if (petsDrag && petsDrag.item === item) movePetsDrag(event);
    });
    item.addEventListener('pointerup', (event) => {
        if (petsDrag && petsDrag.item === item) dropPetsItem(event);
    });
    item.addEventListener('pointercancel', endPetsDrag);
    /* A keyboard activation arrives as a click with no pointer behind it (detail === 0, as
       in Sequence). There is no dragging from a keyboard, so it fills the bowl directly. */
    item.addEventListener('click', (event) => {
        if (event.detail === 0) givePetItem(item.dataset.item);
    });
});

function setPetsSoundOn(on) {
    petsSoundOn = on;
    petsSoundToggle.setAttribute('aria-pressed', String(on));
    petsSoundToggle.classList.toggle('is-active', on);
    petsSoundToggle.classList.toggle('is-muted', !on);
    try {
        window.localStorage.setItem('pets-sound', on ? 'on' : 'off');
    } catch { /* nothing to do - the toy just forgets between visits */ }
}

petsSoundToggle.addEventListener('click', () => setPetsSoundOn(!petsSoundOn));
petsSpeciesSelect.addEventListener('change', resetPets);

/* --- Fidgeting --- */
/* Left alone, the dog gets up every so often and resettles nearby - the owner's brief: wait
   a random whole number of seconds, walk a random, bounded distance, sit, and wait again.
   The numbers and the bounds are FIDGET in js/pets.js, and tested there. At dusk the waits
   are twice as long; at night the same timer is the countdown to dozing off instead.

   It only runs while the Pets view is on screen: showRoute starts it, and stopAllGames
   clears it through resetPets. A fidget that falls due while the dog is busy - being
   petted, mid-drag, walking or eating - is skipped, and a fresh wait begins. */
function scheduleFidget() {
    clearTimeout(pets.timers.fidget);
    pets.timers.fidget = setTimeout(fidget, Pets.restDelayMs(pets.period));
}

function fidget() {
    pets.timers.fidget = null;
    if (views.pets.hidden) return;
    if (pets.asleep) return; // waking starts the next wait
    if (pets.activity !== 'idle' || pets.stroke || petsDrag) {
        scheduleFidget();
        return;
    }
    if (pets.period === 'night') {
        fallAsleep();
        return;
    }

    const target = Pets.fidgetTarget(pets.x);
    pets.activity = 'fidgeting';
    pets.posture = 'stand';
    pets.leaning = false;
    pets.eyes = 'open';
    setPetWagging(false);
    walkPetTo(target, () => {
        pets.homeX = target;
        pets.activity = 'idle';
        settlePet();
        scheduleFidget();
    });
}

/* --- Time of day --- */
/* The room follows the device's local clock - the sky through the window, and the dog,
   drowsy at dusk and asleep at night. The rules are in js/pets.js; here is the clock. It
   is checked on opening the view and once a minute while it stays open, so a room left
   open through the evening goes dark on its own.

   ?time=dawn, day, dusk or night on the page's address pins the time of day, so night can
   be looked at in daylight - e.g. entertainment.html?time=night#pets. It is in the query,
   not the hash, because the hash is the route. */
const PETS_CLOCK_MS = 60000;

const petsTimeOverride = (() => {
    try {
        const asked = new URLSearchParams(window.location.search).get('time');
        return Pets.TIMES_OF_DAY.includes(asked) ? asked : null;
    } catch {
        return null;
    }
})();

function petsTimeOfDay() {
    return petsTimeOverride ?? Pets.timeOfDay(new Date());
}

function drawPetsWindow() {
    const { x, y, rows } = Pets.WINDOW;
    const view = pets.period === 'night' ? Pets.patchRows(rows, Pets.NIGHT_SKY) : rows;
    petsSvg.querySelector('.pets-window').innerHTML =
        petRects(view, x, y, { ...PETS_COLORS, ...PETS_SKIES[pets.period] });
}

/* The breathing and the Z's share one timer. With reduced motion neither moves: the dog
   lies still with its Z's in place, which still says asleep. */
function startPetSleepAnimation() {
    clearInterval(pets.timers.sleep);
    pets.timers.sleep = null;
    if (!pets.asleep || petsReduceMotion.matches || views.pets.hidden) return;
    pets.timers.sleep = setInterval(() => {
        pets.zzzStep += 1;
        pets.breath = Math.floor(pets.zzzStep / Pets.SLEEP.stepsPerBreath) % 2 === 1;
        drawPet();
    }, Pets.SLEEP.zzzStepMs);
}

// Lying down where it is, facing the bowls.
function fallAsleep() {
    pets.asleep = true;
    pets.posture = 'sleep';
    pets.eyes = 'asleep';
    pets.facing = 'left';
    pets.leaning = false;
    pets.breath = false;
    pets.zzzStep = 0;
    setPetWagging(false);
    petsStatusEl.textContent = petsDefaultMessage();
    petsDogHit.setAttribute('aria-label', petsDogLabel());
    drawPet();
    startPetSleepAnimation();
}

// Sitting up, awake. Whoever woke it carries on from here - a stroke, or the morning.
function wakePet() {
    pets.asleep = false;
    clearInterval(pets.timers.sleep);
    pets.timers.sleep = null;
    pets.posture = Pets.RESTING_POSTURE;
    pets.eyes = 'open';
    pets.breath = false;
    petsStatusEl.textContent = petsDefaultMessage();
    petsDogHit.setAttribute('aria-label', petsDogLabel());
    drawPet();
}

function applyPetsTimeOfDay() {
    const period = petsTimeOfDay();
    if (period === pets.period) return;
    pets.period = period;
    drawPetsWindow();
    if (period !== 'night' && pets.asleep) {
        // Morning: it wakes, and anything left in a bowl overnight is found now.
        wakePet();
        settlePet();
    }
    // How long it rests depends on the time of day, so the wait starts over.
    scheduleFidget();
}

// Opening the view: the clock, the sleep animation if it is asleep, and the first wait.
function startPetsView() {
    applyPetsTimeOfDay();
    startPetSleepAnimation();
    scheduleFidget();
    clearInterval(pets.timers.clock);
    pets.timers.clock = setInterval(applyPetsTimeOfDay, PETS_CLOCK_MS);
}

setPetsSoundOn(petsSoundOn);
buildPetsScene();
resetPets();

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

    /* The number row plays Sequence's pads, 1 to 6, left to right. Only while its view
       is the one on screen: these are otherwise ordinary keys, and a game that is not
       visible has no business claiming them. Repeats are dropped, since holding a key
       down is one press of a pad, not a stream of them. */
    if (!views.sequence.hidden && !e.repeat) {
        const pad = Number(e.key) - 1;
        if (Number.isInteger(pad) && pad >= 0 && pad < sequenceGame.padCount) {
            playSequencePad(pad);
        }
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

/* --- Finger Paint: the painting itself --- */

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

    /* Sequence keeps its pending steps in timeouts rather than an interval, so they
       have to be cleared by name - an abandoned run would otherwise go on lighting
       pads and playing tones behind whatever view came next. Being audible, it would
       be the most intrusive of these to leave running. */
    initSequence();

    /* Tic-Tac-Toe's opponent replies from a timeout, which has to be cancelled by name
       like Sequence's. A game left half played is abandoned, not scored. The reply for
       the fresh game is not scheduled from here - see scheduleTicTacToeReply. */
    initTicTacToe();

    /* Pets runs its walk, chomp, wag and bark on timers, and a drag leaves a copy of the
       item on the page body. A dog left eating behind another view, or a food bag left
       floating over it, is exactly what this function is for. */
    resetPets();
}

/* --- Hub Navigation Listeners --- */
document.querySelectorAll('.entry-card').forEach((card) => {
    card.addEventListener('click', () => { window.location.hash = card.dataset.route; });
});

// Back goes to the current route's parent, never to browser history - see js/routes.js.
document.querySelectorAll('[data-back]').forEach((btn) => {
    btn.addEventListener('click', () => { window.location.hash = parentOf(currentRoute.key); });
});

window.addEventListener('hashchange', applyHashRoute);
applyHashRoute();