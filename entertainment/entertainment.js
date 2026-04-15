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
    rotatePiece
} from '../js/logic.js';

/* --- SELECTORS --- */
const snakeBoard = document.getElementById('snakeDisplay');
const toyBoard = document.getElementById('toyDisplay');
const tetrisBoard = document.getElementById('tetrisDisplay');
const tetrisScoreEl = document.getElementById('tetris-score');

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
    
    // 2. FORCE the grid to have exactly the number of columns requested
    // "repeat(X, 20px)" tells the browser: "Make exactly X columns, each 20px wide"
    toyBoard.style.gridTemplateColumns = `repeat(${columns}, 20px)`;
    
    toyBoard.style.display = "grid"; // Ensure it's using grid layout

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
let tetrisInterval = null;

let activePiece = null;   // { shape: [], x: 5, y: 1, type: 'I' }
let tetrisMatrix = Array.from({ length: 20 }, () => Array(10).fill(null));

function initTetrisGame() {
    // 1. Clear any existing game loop
    if (tetrisInterval) clearInterval(tetrisInterval);

    // 2. Reset the System State
    tetrisScore = 0;
    tetrisLevel = 1;
    document.getElementById('tetris-score').innerText = tetrisScore;
    
    // Reset the Matrix to all nulls
    tetrisMatrix = Array.from({ length: 20 }, () => Array(10).fill(null));

    // 3. Kick off the logic
    spawnTetromino(); // This creates activePiece
    drawTetrisFrame(); // This shows the board immediately

    // 4. Start the "Gravity" loop
    // Note: Tetris usually feels better a bit faster than Snake, 
    // maybe 500ms to start.
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
    // Classic Tetris scoring (scaled by level)
    const linePoints = [0, 40, 100, 300, 1200];
    tetrisScore += linePoints[lines] * tetrisLevel;
    
    // Update the UI
    document.getElementById('tetris-score').innerText = tetrisScore;
    
    // Level up every 10 lines (optional logic)
    // tetrisLevel = Math.floor(tetrisScore / 1000) + 1;
    // document.getElementById('tetris-level').innerText = tetrisLevel;
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
    'Z': '#51553a'  // Olive
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

window.addEventListener('keydown', (e) => {
    const keysToCapture = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];

    // Prevent scrolling if either game is running
    if ((gameInterval || tetrisInterval) && keysToCapture.includes(e.key)) {
        e.preventDefault();
    }

    // --- SNAKE INPUT LOGIC ---
    if (gameInterval) {
        if (!canChangeDirection) return;

        let newDirection;
        switch (e.key) {
            case 'ArrowUp':    newDirection = { x: 0, y: -1 }; break;
            case 'ArrowDown':  newDirection = { x: 0, y: 1 };  break;
            case 'ArrowLeft':  newDirection = { x: -1, y: 0 }; break;
            case 'ArrowRight': newDirection = { x: 1, y: 0 };  break;
            default: return;
        }

        if (isValidDirection(direction, newDirection)) {
            direction = newDirection;
            canChangeDirection = false;
        }
    }

    // --- TETRIS INPUT LOGIC ---
    if (tetrisInterval && activePiece) {
        let nextPos = { ...activePiece };

        switch (e.key) {
            case 'ArrowLeft':
                nextPos.x -= 1;
                break;
            case 'ArrowRight':
                nextPos.x += 1;
                break;
            case 'ArrowDown':
                nextPos.y += 1;
                break;
            case 'ArrowUp':
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
}, { passive: false });

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