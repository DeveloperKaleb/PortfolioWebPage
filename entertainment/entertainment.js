// Import the core logic engine
import { 
    generateGridHtml, 
    isWallCollision, 
    isSelfCollision, 
    getNextHead, 
    getCoordsFromIndex,
    isEatingFood,
    isValidDirection
} from '../js/logic.js';

/* --- SHARED SELECTORS --- */
const buttonSpace = document.querySelector(".butMania");
const main = document.getElementById('main');

/* --- PART 1: THE SILLY TOY --- */
let previousPickedColors = {};

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
    buttonSpace.style.display = "block"; 
    buttonSpace.classList.remove('is-snake'); 

    const columns = document.getElementById('xVal').value;
    const rows = document.getElementById('yVal').value;
    
    // SYSTEM UPGRADE: Using the pure logic function to generate the HTML string
    buttonSpace.innerHTML = generateGridHtml(columns, rows);

    const existingPicker = document.getElementById('toyColorPicker');
    if (!existingPicker) {
        addColorPicker();
    }

    document.getElementById('xVal').value = null;
    document.getElementById('yVal').value = null;
    previousPickedColors = {};
}

document.getElementById('arrayForm').addEventListener('submit', displayArray);


/* --- PART 2: THE SNAKE SYSTEM --- */
let snake = [[10, 10], [10, 11], [10, 12]];
let direction = { x: 0, y: -1 };
let food = [5, 5];
let score = 0;
let gameInterval = null;

function initSnakeGame() {
    buttonSpace.innerHTML = ''; 

    const oldPicker = document.getElementById('toyColorPicker');
    if (oldPicker) oldPicker.remove();

    buttonSpace.style.display = "grid"; 
    buttonSpace.classList.add('is-snake');
    
    // SYSTEM UPGRADE: Using the pure math to generate coords for the 400-button grid
    let snakeHtml = '';
    for (let i = 1; i <= 400; i++) {
        const { x, y } = getCoordsFromIndex(i, 20);
        snakeHtml += `<button class="x${x}y${y}" style="background-color: white"></button>`;
    }
    buttonSpace.innerHTML = snakeHtml;
    
    if (gameInterval) clearInterval(gameInterval);
    
    score = 0;
    document.getElementById('score').innerText = score;
    snake = [[10, 10], [10, 11], [10, 12]];
    direction = { x: 0, y: -1 };
    
    spawnFood();
    gameInterval = setInterval(gameStep, 150);
}

function spawnFood() {
    let newFood;
    let isOccupied = true;
    while (isOccupied) {
        newFood = [
            Math.floor(Math.random() * 20) + 1,
            Math.floor(Math.random() * 20) + 1
        ];
        // Reuse logic: If food lands on snake, it's a "self collision" scenario
        isOccupied = isSelfCollision(newFood, snake);
    }
    food = newFood;
}

function gameStep() {
    const head = getNextHead(snake[0], direction);

    // Check for game over conditions.
    if (isWallCollision(head) || isSelfCollision(head, snake)) {
        return gameOver();
    }

    snake.unshift(head);

    // SYSTEM UPGRADE: Use the logic engine to check for food
    if (isEatingFood(head, food)) {
        score += 10;
        document.getElementById('score').innerText = score;
        spawnFood();
    } else {
        snake.pop(); 
    }

    drawFrame();
}

function drawFrame() {
    // Reset all buttons to default first
    const buttons = buttonSpace.querySelectorAll('button');
    buttons.forEach(btn => btn.style.backgroundColor = 'white');

    // Draw Food
    const foodEl = document.querySelector(`.x${food[0]}y${food[1]}`);
    if (foodEl) foodEl.style.backgroundColor = '#035e7b'; // Blue Sapphire

    // Draw Snake
    snake.forEach((seg, index) => {
        const segEl = document.querySelector(`.x${seg[0]}y${seg[1]}`);
        if (segEl) {
            segEl.style.backgroundColor = index === 0 ? '#002e2c' : '#a2a77f'; // Head is Black, body Artichoke
        }
    });
}

function gameOver(message = '') {
    clearInterval(gameInterval);

    if (message === '') {
        message = 'System Overload'
    }
    alert(`${message}! Final Score: ${score}`);
}

/* --- Input Listener --- */
window.addEventListener('keydown', (e) => {
    let newDirection;

    switch (e.key) {
        case 'ArrowUp':    newDirection = { x: 0, y: -1 }; break;
        case 'ArrowDown':  newDirection = { x: 0, y: 1 };  break;
        case 'ArrowLeft':  newDirection = { x: -1, y: 0 }; break;
        case 'ArrowRight': newDirection = { x: 1, y: 0 };  break;
        default: return; // Ignore other keys
    }

    // SYSTEM UPGRADE: Only update if the turn is legal (no 180s)
    if (isValidDirection(direction, newDirection)) {
        direction = newDirection;
    }
});

document.getElementById('startBtn').addEventListener('click', initSnakeGame);

// This listener lives forever and handles the "Painting" logic
buttonSpace.addEventListener("click", (event) => {
    // Only proceed if we are NOT in Snake mode (is-snake class check)
    if (buttonSpace.classList.contains('is-snake')) return;

    const clickedElement = event.target;
    const clickedClass = clickedElement.className;

    // Ensure we clicked a grid button and not the container
    if (!clickedClass || !clickedClass.includes('x')) return;

    const colorPicker = document.getElementById('colorPicker');
    if (!colorPicker) return; // Can't paint without a brush

    const buttonBackColor = clickedElement.style.backgroundColor;

    // Toggle back to previous color logic
    if (buttonBackColor === colorPicker.value && previousPickedColors[clickedClass]) {
        clickedElement.style.backgroundColor = `${previousPickedColors[clickedClass]}`;
        return;
    }

    previousPickedColors[clickedClass] = buttonBackColor;
    clickedElement.style.backgroundColor = `${colorPicker.value}`;
});