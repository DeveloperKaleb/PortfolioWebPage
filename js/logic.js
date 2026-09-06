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
export const isWallCollision = (head, width = 20, height = width) => {
    // height defaults to width so every existing square-board call still works.
    return head[0] < 1 || head[0] > width || head[1] < 1 || head[1] > height;
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

/* --- TETROMINO DEFINITIONS --- */
// Each shape is an array of [x, y] offsets from its center
export const TETROMINOES = {
    'I': [[-1, 0], [0, 0], [1, 0], [2, 0]], // Flat line at y=0
    'J': [[-1, 0], [0, 0], [1, 0], [-1, 1]], // Bottom tail at y=1
    'L': [[-1, 0], [0, 0], [1, 0], [1, 1]],  // Bottom tail at y=1
    'O': [[0, 0], [1, 0], [0, 1], [1, 1]],   // Square at y=0 and y=1
    'S': [[0, 0], [1, 0], [-1, 1], [0, 1]],  // Zig-zag
    'T': [[-1, 0], [0, 0], [1, 0], [0, 1]],  // T-shape
    'Z': [[-1, 0], [0, 0], [0, 1], [1, 1]]   // Zig-zag
};

/**
 * Rotation logic: (x, y) -> (-y, x) for 90-degree clockwise
 */
export function rotatePiece(shape) {
    return shape.map(([x, y]) => [-y, x]);
}

/**
 * Bounds checking specifically for the 10x20 Tetris Matrix
 */
export function isTetrisCollision(piece, matrix) {
    for (let {x, y} of piece) {
        // Wall collisions
        if (x < 1 || x > 10 || y > 20) return true;
        
        // Matrix collision (check if the cell is already occupied)
        // Note: y < 1 is allowed (spawning above the board)
        if (y >= 1 && matrix[y-1][x-1] !== null) return true;
    }
    return false;
}
/* --- INPUT ACTIONS --- */
/* Both games are driven by four abstract actions rather than by key names, so a
   keyboard arrow and an on-screen touch button can feed the same code path.
   The DOM layer maps whatever the user did onto one of these strings. */
export const ACTION_VECTORS = {
    up:    { x: 0, y: -1 },
    down:  { x: 0, y: 1 },
    left:  { x: -1, y: 0 },
    right: { x: 1, y: 0 },
};

const KEY_ACTIONS = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
};

// Returns null for any key neither game cares about, so callers can bail early.
export const keyToAction = (key) => KEY_ACTIONS[key] ?? null;

/* --- GAME PALETTES --- */
/* These live here rather than next to the rendering code so the contrast rules in
   js/contrast.js can be asserted against them in tests. See NOTES.md for why the
   old palette failed and how these values were chosen.
   Every colour below clears 4.5:1 against the surface behind it for normal,
   deuteranopic and protanopic vision, and no two are indistinguishable. */

// The board surfaces the pieces are read against.
export const BOARD_COLORS = {
    emptyCell: '#3b3026', // dark warm brown - the page column colour
    gridLines: '#51553a', // olive, showing through the 1px gaps
};

/* Pieces are spread along two axes that survive red/green colour blindness:
   lightness, and the blue-to-yellow axis. Hue on its own is not a cue. */
export const TETRIS_COLORS = {
    'I': '#d4eefa', // Pale Sky   - lightest blue
    'J': '#6aa9c8', // Steel Blue - darkest blue
    'L': '#d2d673', // Chartreuse - mid yellow
    'O': '#f7f2c2', // Cream      - lightest yellow
    'S': '#7fd0d6', // Aqua       - mid blue
    'T': '#a2a77f', // Artichoke  - darkest yellow
    'Z': '#e08a4f', // Amber      - warm, high on the yellow axis
};

// Snake is drawn on white cells, so its colours are the dark end of the range.
export const SNAKE_COLORS = {
    head: '#002e2c', // Deep Teal
    body: '#6e7349', // Dark Olive
    food: '#035e7b', // Dark Blue
    hole: '#51553a', // Olive - the donut-mode wall
};

/* --- BOARD SHAPES --- */

export const CELL = { TRACK: 'track', HOLE: 'hole', WALL: 'wall' };

/* The Infinity board is a ribbon traced around a Gerono lemniscate
   (x = cos t, y = sin(2t)/2) - a true figure-8 with exactly one self-crossing,
   rather than two lobes sitting side by side.

   Each cell records which stretches of the curve pass near it. A cell near two
   well-separated stretches is where the ribbon crosses itself; those `branches`
   are what a later over/under layer would key off, which is why they are kept
   even though nothing reads them yet. See NOTES.md. */
const LEMNISCATE_DEFAULTS = {
    width: 34,
    height: 18,
    scaleX: 15,
    scaleY: 13,
    halfWidth: 2.2, // half the ribbon's thickness, in cells
    samples: 720,   // how finely the curve is sampled before measuring distance
};

export function buildLemniscateMask(options = {}) {
    const { width, height, scaleX, scaleY, halfWidth, samples } = { ...LEMNISCATE_DEFAULTS, ...options };
    const cx = (width + 1) / 2;
    const cy = (height + 1) / 2;
    const step = (2 * Math.PI) / samples;

    const curve = [];
    for (let i = 0; i < samples; i++) {
        const t = i * step;
        curve.push({ t, x: cx + scaleX * Math.cos(t), y: cy + scaleY * Math.sin(2 * t) / 2 });
    }

    // The t values passing within half a ribbon-width of this cell, grouped into runs.
    // Two runs means two separate stretches of curve, i.e. the self-crossing.
    const branchesAt = (gx, gy) => {
        const hits = curve.filter((p) => Math.hypot(p.x - gx, p.y - gy) <= halfWidth).map((p) => p.t);
        if (!hits.length) return [];

        const runs = [];
        let run = [hits[0]];
        for (let i = 1; i < hits.length; i++) {
            if (hits[i] - hits[i - 1] <= step * 3) run.push(hits[i]);
            else { runs.push(run); run = [hits[i]]; }
        }
        runs.push(run);

        // The curve is a loop, so a run can straddle t = 0 and appear as two.
        if (runs.length > 1) {
            const last = runs[runs.length - 1];
            if ((2 * Math.PI - last[last.length - 1]) + runs[0][0] <= step * 3) {
                runs[0] = runs.pop().concat(runs[0]);
            }
        }
        return runs.map((r) => r.reduce((a, b) => a + b, 0) / r.length);
    };

    const cells = [];
    for (let y = 1; y <= height; y++) {
        const row = [];
        for (let x = 1; x <= width; x++) {
            const branches = branchesAt(x, y);
            row.push(branches.length
                ? { kind: CELL.TRACK, branches }
                : { kind: CELL.WALL, branches: [] });
        }
        cells.push(row);
    }

    // Blank space reachable from the edge is outside the ribbon (an outer wall);
    // whatever blank space is left is enclosed by a lobe, which is an inner wall -
    // the same distinction Donut makes between WALL and HOLE.
    const outside = new Set();
    const queue = [];
    for (let x = 0; x < width; x++) { queue.push([x, 0], [x, height - 1]); }
    for (let y = 0; y < height; y++) { queue.push([0, y], [width - 1, y]); }
    while (queue.length) {
        const [x, y] = queue.pop();
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const key = `${x},${y}`;
        if (outside.has(key) || cells[y][x].kind === CELL.TRACK) continue;
        outside.add(key);
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (cells[y][x].kind !== CELL.TRACK && !outside.has(`${x},${y}`)) {
                cells[y][x].kind = CELL.HOLE;
            }
        }
    }

    return { width, height, cells };
}

// The portrait board is the landscape one turned on its side, so both orientations
// are guaranteed the same area, the same rules and the same difficulty.
export function transposeMask(mask) {
    const cells = [];
    for (let y = 0; y < mask.width; y++) {
        const row = [];
        for (let x = 0; x < mask.height; x++) row.push(mask.cells[x][y]);
        cells.push(row);
    }
    return { width: mask.height, height: mask.width, cells };
}

export const cellKindAt = (mask, x, y) => {
    if (x < 1 || y < 1 || x > mask.width || y > mask.height) return CELL.WALL;
    return mask.cells[y - 1][x - 1].kind;
};

/* Pick the opening move: the track cell and direction with the longest clear run
   ahead, so a new game never starts pointed at a wall. Deterministic - the first
   best-scoring option wins - so tests can assert on it. */
export function findStartingPosition(mask) {
    let best = null;
    for (let y = 1; y <= mask.height; y++) {
        for (let x = 1; x <= mask.width; x++) {
            if (cellKindAt(mask, x, y) !== CELL.TRACK) continue;
            for (const [name, d] of Object.entries(ACTION_VECTORS)) {
                // The two body segments trail behind the head.
                const tail = [1, 2].map((n) => [x - d.x * n, y - d.y * n]);
                if (tail.some(([tx, ty]) => cellKindAt(mask, tx, ty) !== CELL.TRACK)) continue;

                let runway = 0;
                let [rx, ry] = [x, y];
                while (cellKindAt(mask, rx + d.x, ry + d.y) === CELL.TRACK) {
                    runway++; rx += d.x; ry += d.y;
                }
                if (!best || runway > best.runway) {
                    best = { runway, direction: { ...d }, action: name, snake: [[x, y], ...tail] };
                }
            }
        }
    }
    return best;
}

export const INFINITY_MASK = buildLemniscateMask();
export const INFINITY_MASK_VERTICAL = transposeMask(INFINITY_MASK);

/* Everything the DOM layer needs to lay out and police a board. Classic and Donut
   keep their 20x20 grid and their existing rules; only Infinity carries a mask. */
export function getBoardShape(mode, orientation = 'horizontal') {
    if (mode === 'infinity') {
        const mask = orientation === 'vertical' ? INFINITY_MASK_VERTICAL : INFINITY_MASK;
        const start = findStartingPosition(mask);
        return { mode, width: mask.width, height: mask.height, mask, start };
    }
    return {
        mode,
        width: 20,
        height: 20,
        mask: null,
        start: mode === 'donut'
            ? { snake: [[4, 10], [4, 11], [4, 12]], direction: { x: 0, y: -1 } }
            : { snake: [[10, 10], [10, 11], [10, 12]], direction: { x: 0, y: -1 } },
    };
}
