// Grid Array Logic
export const generateGridHtml = (width, height) => {
    let html = '';
    for (let row = 1; row <= height; row++) {
        html += `<div class="y${row}">`;
        for (let col = 1; col <= width; col++) {
            html += `<button class="x${col}y${row}" style="background-color: white"></button>`;
        }
        html += '</div>';
    }
    return html;
};

// Snake Game Logic
export const isWallCollision = (head, size = 20) => {
    return head[0] < 1 || head[0] > size || head[1] < 1 || head[1] > size;
};

export const isSelfCollision = (head, snakeBody) => {
    return snakeBody.some(segment => segment[0] === head[0] && segment[1] === head[1]);
};

export function isHoleCollision(head) {
    const x = head[0];
    const y = head[1];
    // The 8x8 center of a 20x20 grid
    return (x >= 7 && x <= 14 && y >= 7 && y <= 14);
}

export const getNextHead = (currentHead, direction) => {
    return [currentHead[0] + direction.x, currentHead[1] + direction.y];
};

export const getCoordsFromIndex = (index, width = 20) => {
    const r = Math.ceil(index / width);
    const c = index % width || width;
    return { x: c, y: r };
};

export const isEatingFood = (head, food) => {
    return head[0] === food[0] && head[1] === food[1];
};

export const isValidDirection = (current, next) => {
    // A 180-degree turn means the sum of X or Y will be 0 if they are opposites
    // e.g., Up (y: -1) + Down (y: 1) = 0
    if (current.x + next.x === 0 && current.x !== 0) return false;
    if (current.y + next.y === 0 && current.y !== 0) return false;
    return true;
};