// Import the core logic engine
import { 
    generateGridHtml, 
    isWallCollision,
    isHoleCollision,
    isSelfCollision, 
    getNextHead, 
    getCoordsFromIndex,
    isEatingFood,
    isValidDirection
} from '../js/logic.js';

/* --- SELECTORS --- */
const snakeBoard = document.getElementById('snakeDisplay');
const toyBoard = document.getElementById('toyDisplay');

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

// Toy Event Listener
document.getElementById('arrayForm').addEventListener('submit', displayArray);

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


/* --- Input Listener --- */
window.addEventListener('keydown', (e) => {
    const keysToCapture = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];

    if (gameInterval && keysToCapture.includes(e.key)) {
        e.preventDefault();
    }

    // 1. IF THE LOCK IS ON, BAIL OUT IMMEDIATELY
    if (!canChangeDirection) return;

    let newDirection;
    switch (e.key) {
        case 'ArrowUp':    newDirection = { x: 0, y: -1 }; break;
        case 'ArrowDown':  newDirection = { x: 0, y: 1 };  break;
        case 'ArrowLeft':  newDirection = { x: -1, y: 0 }; break;
        case 'ArrowRight': newDirection = { x: 1, y: 0 };  break;
        default: return; 
    }

    if (gameInterval && isValidDirection(direction, newDirection)) {
        direction = newDirection;
        // 2. TURN THE LOCK ON
        canChangeDirection = false; 
    }
}, { passive: false });

document.getElementById('startBtn').addEventListener('click', () => {
    gameMode = document.getElementById('modeSelect').value;
    initSnakeGame();
});

// RUN IMMEDIATELY: Initialize the snake board visually on load
createStaticBoard();