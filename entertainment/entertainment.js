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
    CELL
} from '../js/logic.js';
import {
    stepFrom,
    nodeAt,
    strandsAt,
    isOverlapCell,
    isLayeredSelfCollision,
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
    toy: document.getElementById('toy-system'),
};

function showView(name) {
    // Leaving a view abandons whatever was running in it. Hiding a game does not
    // stop its setInterval, so an abandoned game kept playing itself in the
    // background and eventually hit its own game-over - firing a blocking alert()
    // into the middle of whichever game you had moved on to.
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

    const colorPickerForm = document.createElement('form');
    colorPickerForm.id = "toyColorPicker";
    colorPickerForm.innerHTML = `
        <select id="colorPicker" style="margin: 1rem">
            <option value="black">Black</option>
            <option value="white">White</option>
            <option value="red">Red</option>
            <option value="green">Green</option>
            <option value="purple">Purple</option>
            <option value="pink">Pink</option>
            <option value="yellow">Yellow</option>
        </select>`;

    const arrayForm = document.getElementById('arrayForm');
    arrayForm.insertAdjacentElement('afterend', colorPickerForm);
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
let food = { x: 5, y: 5 };
let score = 0;
let gameInterval = null;

/* The board a game is played on. Classic and Donut are the 20x20 square; Infinity
   is a mask-driven ribbon whose grid is not square and not fully playable. */
let currentShape = getBoardShape('classic');

// Landscape gets the wide board, portrait the transposed one, so the board is
// always oriented along the screen's long axis.
const currentOrientation = () =>
    (window.innerWidth >= window.innerHeight ? 'horizontal' : 'vertical');

const selectedMode = () => {
    const modeSelect = document.getElementById('modeSelect');
    return modeSelect ? modeSelect.value : 'classic';
};

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
            snakeHtml += `<button class="x${x}y${y}${overlap}" data-blocked="${blocked}" style="background-color: ${color}"></button>`;
        }
    }
    snakeBoard.innerHTML = snakeHtml;

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
}

/**
 * Enhanced Spawn Logic: Food cannot land on the snake OR in the hole
 */
function spawnFood() {
    // Collect the free cells and pick one, rather than guessing at random until a
    // guess lands. On the Infinity board only 356 of 612 cells are even playable,
    // so rejection sampling would spin - and on a nearly full board, forever.
    const free = [];
    for (let y = 1; y <= currentShape.height; y++) {
        for (let x = 1; x <= currentShape.width; x++) {
            if (isBlockedCell(currentShape, x, y)) continue;
            // Never on a crossing: "which strand is the food on" has no good answer.
            if (isOverlapCell(currentShape.graph, x, y)) continue;
            if (snake.some((segment) => segment.x === x && segment.y === y)) continue;
            free.push({ x, y });
        }
    }

    // Nowhere left to put it means the board is full - the snake has won.
    if (!free.length) return;
    food = free[Math.floor(Math.random() * free.length)];
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

    if (head.x === food.x && head.y === food.y) {
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
    });

    // Draw Food on snakeBoard
    const foodEl = snakeBoard.querySelector(`.x${food.x}y${food.y}`);
    if (foodEl) foodEl.style.backgroundColor = SNAKE_COLORS.food;

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
        const strands = strandsAt(currentShape.graph, occupant.x, occupant.y);
        const isUnderneath = strands.length > 1 && occupant.layer < strands[strands.length - 1].layer;

        segEl.style.backgroundColor = occupant.isHead
            ? SNAKE_COLORS.head
            : (isUnderneath ? SNAKE_COLORS.bodyUnder : SNAKE_COLORS.body);
    });
}

/* The graph refuses a move without saying why, so reconstruct it from the target
   cell: off the grid or into a wall/hole reads as it always did, while a target that
   is perfectly good track means the snake tried to leave the strand it was on -
   stepping off the edge of the crossing. */
function failureAt(from, heading) {
    const target = { x: from.x + heading.x, y: from.y + heading.y };

    if (isWallCollision([target.x, target.y], currentShape.width, currentShape.height)) {
        return 'WALL';
    }
    const kind = cellKindAt(currentShape.mask, target.x, target.y);
    if (kind === CELL.HOLE) return 'HOLE';
    if (kind === CELL.WALL) return 'WALL';
    return 'EDGE';
}

function gameOver(reason = '') {
    clearInterval(gameInterval);
    gameInterval = null;
    canChangeDirection = true; // Unlock keys for the next game

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
        default:
            displayMessage = "System Overload.";
    }

    alert(`${displayMessage}\nFinal Score: ${score}`);
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
    alert(`Matrix Critical Failure! Final Score: ${tetrisScore}`);
    
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

// Painting Logic: Target toyBoard specifically
toyBoard.addEventListener("click", (event) => {
    const clickedElement = event.target;
    const clickedClass = clickedElement.className;

    if (!clickedClass || !clickedClass.includes('x')) return;

    const colorPicker = document.getElementById('colorPicker');
    if (!colorPicker) return;

    const buttonBackColor = clickedElement.style.backgroundColor;

    if (buttonBackColor === colorPicker.value && previousPickedColors[clickedClass]) {
        clickedElement.style.backgroundColor = `${previousPickedColors[clickedClass]}`;
        return;
    }

    previousPickedColors[clickedClass] = buttonBackColor;
    clickedElement.style.backgroundColor = `${colorPicker.value}`;
});

// RUN IMMEDIATELY: Initialize the game boards visually on load
createStaticBoard();
createTetrisBoard();

/* Tear down both games and put their boards back to a clean starting state. Called
   whenever the view changes, so a game is never left running behind a hidden view.

   This is deliberately broader than only resetting when another game starts: an
   abandoned Tetris left on the hub screen would still tick, top out, and alert. */
function stopAllGames() {
    // A pad button can be left held while the view changes out from under it,
    // which would otherwise leave its repeat timer running against the next game.
    stopRepeat();

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