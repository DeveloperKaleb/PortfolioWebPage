// Import the core logic engine
import { 
    generateGridHtml, 
    isWallCollision,
    isHoleCollision,
    isSelfCollision, 
    getNextHead, 
    getCoordsFromIndex,
    isEatingFood,
    isValidDirection,
    TETROMINOES,
    isTetrisCollision,
    rotatePiece,
    ACTION_VECTORS,
    keyToAction
} from '../js/logic.js';

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
    // A pad button can be left held while the view changes out from under it, which
    // would otherwise leave its repeat timer running against the next game.
    stopRepeat();
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
let snake = [[10, 10], [10, 11], [10, 12]];
let direction = { x: 0, y: -1 };
let food = [5, 5];
let score = 0;
let gameInterval = null;

/**
 * Build the physical grid once when the script loads
 */
function createStaticBoard() {
    let snakeHtml = '';
    for (let i = 1; i <= 400; i++) {
        const { x, y } = getCoordsFromIndex(i, 20);
        snakeHtml += `<button class="x${x}y${y}" style="background-color: white"></button>`;
    }
    // Target snakeBoard specifically
    snakeBoard.innerHTML = snakeHtml;
}

function initSnakeGame() {
    if (gameInterval) clearInterval(gameInterval);
    
    // 1. Capture the mode from the dropdown immediately
    const modeSelect = document.getElementById('modeSelect');
    gameMode = modeSelect ? modeSelect.value : 'classic';

    score = 0;
    document.getElementById('score').innerText = score;
    canChangeDirection = true;

    // 2. Set starting positions based on mode
    if (gameMode === 'donut') {
        // Safe start left of the center hole
        snake = [[4, 10], [4, 11], [4, 12]];
        direction = { x: 0, y: -1 }; 
    } else {
        // Classic middle start
        snake = [[10, 10], [10, 11], [10, 12]];
        direction = { x: 0, y: -1 };
    }

    spawnFood();
    drawFrame();
    gameInterval = setInterval(gameStep, 150);
}

/**
 * Enhanced Spawn Logic: Food cannot land on the snake OR in the hole
 */
function spawnFood() {
    let newFood;
    let isInvalid = true;
    while (isInvalid) {
        newFood = [
            Math.floor(Math.random() * 20) + 1,
            Math.floor(Math.random() * 20) + 1
        ];
        
        // Ensure consistency: pass the array [x, y] to logic functions
        const hitsSnake = isSelfCollision(newFood, snake);
        const hitsHole = (gameMode === 'donut' && isHoleCollision(newFood));
        
        isInvalid = hitsSnake || hitsHole;
    }
    food = newFood;
}

function gameStep() {
    const head = getNextHead(snake[0], direction);

    // UPDATED COLLISION CHECK
    const hitWall = isWallCollision(head);
    const hitSelf = isSelfCollision(head, snake);
    const hitHole = (gameMode === 'donut' && isHoleCollision(head));

    // 1. Check each condition individually to identify the "Cause"
    if (isWallCollision(head)) {
        return gameOver('WALL');
    }
    
    if (isSelfCollision(head, snake)) {
        return gameOver('SELF');
    }
    
    if (gameMode === 'donut' && isHoleCollision(head)) {
        return gameOver('HOLE');
    }

    snake.unshift(head);

    if (isEatingFood(head, food)) {
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
    buttons.forEach(btn => btn.style.backgroundColor = 'white');

    // If Donut mode, color the hole differently (or hide it)
    if (gameMode === 'donut') {
        for (let x = 7; x <= 14; x++) {
            for (let y = 7; y <= 14; y++) {
                const holeEl = snakeBoard.querySelector(`.x${x}y${y}`);
                if (holeEl) holeEl.style.backgroundColor = '#51553a'; // Matches your background
            }
        }
    }

    // Draw Food on snakeBoard
    const foodEl = snakeBoard.querySelector(`.x${food[0]}y${food[1]}`);
    if (foodEl) foodEl.style.backgroundColor = '#035e7b';

    // Draw Snake on snakeBoard
    snake.forEach((seg, index) => {
        const segEl = snakeBoard.querySelector(`.x${seg[0]}y${seg[1]}`);
        if (segEl) {
            segEl.style.backgroundColor = index === 0 ? '#002e2c' : '#a2a77f';
        }
    });
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
const TETRIS_COLORS = {
    'I': '#035e7b', // Dark Blue
    'J': '#a2a77f', // Artichoke
    'L': '#dfe38c', // Green Yellow
    'O': '#eff1c5', // Cream
    'S': '#002e2c', // Deep Teal
    'T': '#e3e7af', // Pale Green
    'Z': '#b33939'  // Olive
};

function drawTetrisFrame() {
    // 1. Clear the board (reset to empty space color)
    const buttons = tetrisBoard.querySelectorAll('button');
    buttons.forEach(btn => btn.style.backgroundColor = '#51553a');

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

/* --- Hub Navigation Listeners --- */
document.querySelectorAll('.entry-card').forEach((card) => {
    card.addEventListener('click', () => { window.location.hash = card.dataset.view; });
});

document.querySelectorAll('[data-back]').forEach((btn) => {
    btn.addEventListener('click', () => { window.location.hash = ''; });
});

window.addEventListener('hashchange', applyHashRoute);
applyHashRoute();