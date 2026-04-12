// Pure logic functions that don't need a browser to work
export const snakeLogic = {
    // 1. Calculate the new head position
    getNextHead: (head, direction) => [head[0] + direction.x, head[1] + direction.y],

    // 2. Check for wall collisions
    isWallCollision: (head, size = 20) => {
        return head[0] < 1 || head[0] > size || head[1] < 1 || head[1] > size;
    },

    // 3. Check for self-collision
    isSelfCollision: (head, snake) => {
        return snake.some(seg => seg[0] === head[0] && seg[1] === head[1]);
    },

    // 4. Validate if food is being eaten
    isEatingFood: (head, food) => head[0] === food[0] && head[1] === food[1],

    // 5. Grid Math: Convert flat index (1-400) to X/Y
    getCoordsFromIndex: (index, width = 20) => {
        const r = Math.ceil(index / width);
        const c = index % width || width;
        return { x: c, y: r };
    },

    // 6. Prevent 180-degree illegal turns
    isValidDirection: (current, next) => {
        if (current.x !== 0 && next.x === -current.x) return false;
        if (current.y !== 0 && next.y === -current.y) return false;
        return true;
    }
};