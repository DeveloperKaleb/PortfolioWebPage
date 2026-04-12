console.log("Script Load Check: entertainment.js is active.");
console.log("Start Button Check:", document.getElementById('startBtn'));

/* --- SHARED SELECTORS --- */
const buttonSpace = document.querySelector(".butMania");
const main = document.getElementById('main');

/* --- PART 1: THE SILLY TOY (Your Original Logic) --- */
let previousPickedColors = {};
let renderHtml = '';
let colorPickerRendered = false;

function renderButtons(width, height, html, row = 1, column = 1) {
    if (row > height) {
        buttonSpace.innerHTML = html;
        return;
    }
    renderHtml = renderHtml.concat(`<div class="y${row}">`);
    let currentColumn = column;
    while (currentColumn <= width) {
        renderHtml += `<button class="x${currentColumn}y${row}" style="background-color: white"></button>`;
        currentColumn += 1;
    }
    renderHtml = renderHtml.concat('</div>');
    row += 1;
    renderButtons(width, height, renderHtml, row);
}

function addColorPicker() {
    // Double check we don't already have one (extra safety)
    if (document.getElementById('toyColorPicker')) return;

    const colorPickerForm = document.createElement('form');
    colorPickerForm.id = "toyColorPicker"; // Critical for the check above
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

    // Instead of insertBefore, just put it at the top of the container
    // This avoids the "Not a child of this node" error entirely
    buttonSpace.parentElement.prepend(colorPickerForm);
}

function displayArray(event) {
    event.preventDefault();
    buttonSpace.style.display = "block"; 
    buttonSpace.classList.remove('is-snake'); // Ensure snake styles are gone

    const columns = document.getElementById('xVal').value;
    const rows = document.getElementById('yVal').value;
    
    renderHtml = '';
    renderButtons(columns, rows, renderHtml);

    // SYSTEM CHECK: Look for the specific ID instead of a boolean flag
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
let snake = [[10, 10], [10, 11], [10, 12]]; // Initial coordinates
let direction = { x: 0, y: -1 }; // Starting "Up"
let food = [5, 5];
let score = 0;
let gameInterval = null;

function initSnakeGame() {
    renderHtml = ''; // CLEAR THIS FIRST
    buttonSpace.innerHTML = ''; // Wipe the current grid

    const oldPicker = document.getElementById('toyColorPicker');
    if (oldPicker) oldPicker.remove();

    buttonSpace.style.display = "grid"; // Switch to grid mode
    buttonSpace.classList.add('is-snake');
    
    // Flat render: 20x20 = 400 buttons without <div> wrappers
    for (let i = 1; i <= 400; i++) {
        let r = Math.ceil(i / 20);
        let c = i % 20 || 20;
        renderHtml += `<button class="x${c}y${r}" style="background-color: white"></button>`;
    }
    buttonSpace.innerHTML = renderHtml;
    
    // Stop any existing game loop
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
        // Generate potential coordinates
        newFood = [
            Math.floor(Math.random() * 20) + 1,
            Math.floor(Math.random() * 20) + 1
        ];

        // Check if these coordinates are under the snake's body
        isOccupied = snake.some(segment => segment[0] === newFood[0] && segment[1] === newFood[1]);
    }

    food = newFood;
}

function gameStep() {
    const head = [snake[0][0] + direction.x, snake[0][1] + direction.y];

    // 1. Wall Collision check (Existing)
    if (head[0] < 1 || head[0] > 20 || head[1] < 1 || head[1] > 20) {
        return gameOver();
    }

    // 2. Self-Collision check (New)
    // We check if the head's X and Y match any segment currently in the snake
    const bitItself = snake.some(segment => segment[0] === head[0] && segment[1] === head[1]);
    if (bitItself) {
        return gameOver('Don\'t eat yourself');
    }

    // Add new head
    snake.unshift(head);

    // Check if food eaten
    if (head[0] === food[0] && head[1] === food[1]) {
        score += 10;
        document.getElementById('score').innerText = score;
        spawnFood();
    } else {
        snake.pop(); // Remove tail
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
    switch (e.key) {
        case 'ArrowUp':    if (direction.y !== 1)  direction = { x: 0, y: -1 }; break;
        case 'ArrowDown':  if (direction.y !== -1) direction = { x: 0, y: 1 };  break;
        case 'ArrowLeft':  if (direction.x !== 1)  direction = { x: -1, y: 0 }; break;
        case 'ArrowRight': if (direction.x !== -1) direction = { x: 1, y: 0 };  break;
    }
});

document.getElementById('startBtn').addEventListener('click', initSnakeGame);