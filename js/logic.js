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

/* Chrome around the games. Held to the same rules as the boards: a disabled control
   still has to be readable. Dimming one with opacity: 0.5 took its text to about
   1.6:1 - "unavailable" has to come from the colour being muted, not from the label
   becoming illegible. */
export const UI_COLORS = {
    disabledBackground: '#b9bba4', // Muted Olive Grey
    disabledText: '#2f2a1f',       // Near Black
    dialogBackground: '#002e2c',   // Deep Teal
    dialogText: '#eff1c5',         // Cream
};

// Snake is drawn on white cells, so its colours are the dark end of the range.
/* Pacific Northwest, matching Minesweeper: pale lichen for open ground, evergreen for
   what you cannot cross, and the snake in the darks of a forest floor.

   The whole ladder had to be darkened to move off white. The old colours sat right on
   the 4.5:1 floor against white, so tinting the ground even slightly pushed both of the
   "underneath" variants below it - lighter-means-underneath fights a background that is
   already light. Darkening the on-top colours makes the room, exactly as it did when
   the underneath body colour was first introduced. */
export const SNAKE_COLORS = {
    ground: '#e6e9dc',    // Lichen - open ground
    head: '#16241a',      // Deep Canopy
    body: '#2c5418',      // Fern - the snake on the upper strand
    bodyUnder: '#4c6b34', // Sunlit Fern - the snake passing underneath
    food: '#204c7c',      // Lake
    foodUnder: '#286890', // Shallows - food lying under a crossing
    hole: '#2f4a38',      // Evergreen - blocked ground, flat fallback
};

/* Blocked ground carries a gradient, the way Minesweeper's cells do. Nothing is ever
   drawn on top of it - the snake and the food only occupy open ground - so it is free
   to be decorative. Open ground stays flat because the crossing hatch is a
   background-image, and a gradient there would have to share that slot with it. */
export const SNAKE_GRADIENTS = {
    blocked: ['#35543f', '#2a4232'],
};

/* --- BOARD SHAPES --- */

import { CELL, buildStrandGraph, stepFrom, nodeAt, circularMean, linkByLevel } from './strands.js';
export { CELL };

/* The Infinity board is a ribbon traced around a Gerono lemniscate
   (x = cos t, y = sin(2t)/2) - a true figure-8 with exactly one self-crossing,
   rather than two lobes sitting side by side.

   Each cell records which stretches of the curve pass near it. A cell near two
   well-separated stretches is where the ribbon crosses itself; those `branches`
   are what a later over/under layer would key off, which is why they are kept
   even though nothing reads them yet. See NOTES.md. */
const LEMNISCATE_DEFAULTS = {
    width: 34,
    height: 14,
    scaleX: 15,
    /* A flatter figure-8 makes the two strands meet at a shallower angle, which widens
       the band where they overlap - the crossing is the interesting part of the map and
       was too cramped to use at 6x4. Flattening alone would have shrunk the track, so
       the ribbon is slightly thicker to compensate: the play area is 352 cells against
       the previous 356, which keeps Infinity where it sits on the difficulty gradient. */
    scaleY: 9,
    halfWidth: 2.6, // half the ribbon's thickness, in cells

    /* How near a second stretch of curve has to pass before a cell counts as shared
       by two strands. Deliberately wider than the ribbon itself: at the mouths of the
       crossing the strands run alongside each other a cell or two before their ribbons
       actually merge, and those cells behave like part of the crossing - you are
       already committed to a strand there - so they should be drawn and treated as
       such. Tied to halfWidth and this would be one number doing two jobs. */
    crossingHalfWidth: 3.3,

    samples: 720,   // how finely the curve is sampled before measuring distance
};

/* Classic and Donut as masks too. Uniform representation means one code path for
   movement and collision regardless of whether a board has crossings. */
export function buildSquareMask(size = 20, { hole = null } = {}) {
    const cells = [];
    for (let y = 1; y <= size; y++) {
        const row = [];
        for (let x = 1; x <= size; x++) {
            const inHole = hole && x >= hole.x1 && x <= hole.x2 && y >= hole.y1 && y <= hole.y2;
            row.push({ kind: inHole ? CELL.HOLE : CELL.TRACK, branches: [] });
        }
        cells.push(row);
    }
    return { width: size, height: size, cells };
}

export function buildLemniscateMask(options = {}) {
    const { width, height, scaleX, scaleY, halfWidth, crossingHalfWidth, samples } = { ...LEMNISCATE_DEFAULTS, ...options };
    const cx = (width + 1) / 2;
    const cy = (height + 1) / 2;
    const step = (2 * Math.PI) / samples;

    const curve = [];
    for (let i = 0; i < samples; i++) {
        const t = i * step;
        curve.push({ t, x: cx + scaleX * Math.cos(t), y: cy + scaleY * Math.sin(2 * t) / 2 });
    }

    /* The stretches of curve passing near this cell. Gathered at the wider crossing
       reach, then filtered: the cell is track if any stretch is within the ribbon, and
       every stretch within the crossing reach counts as a strand present there. */
    const branchesAt = (gx, gy) => {
        const near = curve.filter((p) => Math.hypot(p.x - gx, p.y - gy) <= crossingHalfWidth);
        if (!near.length) return [];

        // Nothing within the ribbon proper means this cell is not on the track at all.
        const onTrack = near.some((p) => Math.hypot(p.x - gx, p.y - gy) <= halfWidth);
        if (!onTrack) return [];

        const hits = near.map((p) => p.t);

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
        // Circular, not arithmetic: a run straddling the 2pi -> 0 wrap at the tip of a
        // lobe would otherwise average to roughly pi - a parameter pointing at the far
        // side of the curve, which severs the ribbon there.
        return runs.map(circularMean);
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

/* Pick the opening move: the node and direction with the longest clear run ahead, so
   a new game never starts pointed at a wall. Walks the graph rather than the mask, so
   on a crossing map the runway follows the strand the snake is actually on.
   Deterministic - the first best-scoring option wins - so tests can assert on it. */
export function findStartingPosition(graph) {
    let best = null;
    for (const node of graph.nodes.values()) {
        for (const [name, d] of Object.entries(ACTION_VECTORS)) {
            const back = { x: -d.x, y: -d.y };

            // The two body segments trail behind the head, along the same strand.
            const tail = [];
            let previous = node;
            for (let i = 0; i < 2; i++) {
                previous = stepFrom(graph, previous, back);
                if (!previous) break;
                tail.push(previous);
            }
            if (tail.length < 2) continue;

            let runway = 0;
            let ahead = node;
            while ((ahead = stepFrom(graph, ahead, d))) runway++;

            if (!best || runway > best.runway) {
                best = {
                    runway,
                    direction: { ...d },
                    action: name,
                    snake: [node, ...tail].map(({ x, y, strand }) => ({ x, y, strand })),
                };
            }
        }
    }
    return best;
}

export const INFINITY_MASK = buildLemniscateMask();
export const INFINITY_MASK_VERTICAL = transposeMask(INFINITY_MASK);
export const CLASSIC_MASK = buildSquareMask(20);
export const DONUT_MASK = buildSquareMask(20, { hole: { x1: 7, x2: 14, y1: 7, y2: 14 } });

/* Everything the DOM layer needs to lay out and police a board. Classic and Donut
   keep their 20x20 grid and their existing rules; only Infinity carries a mask. */
const MASKS = {
    classic: () => CLASSIC_MASK,
    donut: () => DONUT_MASK,
    infinity: (orientation) => (orientation === 'vertical' ? INFINITY_MASK_VERTICAL : INFINITY_MASK),
    // Square and with a bridge that runs top to bottom, so turning it on its side
    // would turn the bridge sideways too. Same board in both orientations.
    bridge: () => BRIDGE_MASK,
};

/* Most maps derive their strands from a curve, and the default continuity rule suits
   them. The Bridge does not: its strands are levels, so it brings its own. This is the
   seam the tooling was built with - see NOTES.md.

   A function rather than an object because the Bridge constants are declared further
   down the file: an object literal here would read them before they exist. */
const graphOptionsFor = (mode, mask) =>
    (mode === 'bridge' ? { link: makeBridgeLink(mask) } : undefined);

// Built once each - the graphs never change, and rebuilding per game would be waste.
const graphCache = new Map();

export function getBoardShape(mode, orientation = 'horizontal') {
    const maskFor = MASKS[mode] || MASKS.classic;
    const mask = maskFor(orientation);
    const cacheKey = `${mode}:${orientation}`;

    if (!graphCache.has(cacheKey)) graphCache.set(cacheKey, buildStrandGraph(mask, graphOptionsFor(mode, mask)));
    const graph = graphCache.get(cacheKey);

    // Classic and Donut keep the start they have always had; a crossing map has no
    // obvious hand-picked spot, so it gets the longest clear run on the board.
    const fixedStart = { classic: [10, 10], donut: [4, 10] }[mode];
    const start = fixedStart
        ? {
            direction: { x: 0, y: -1 },
            snake: [0, 1, 2].map((n) => ({ x: fixedStart[0], y: fixedStart[1] + n, strand: 0 })),
            runway: null,
        }
        : findStartingPosition(graph);

    return { mode, width: mask.width, height: mask.height, mask, graph, start };
}

/* --- ARRAY GRID TOY PALETTE --- */
/* The toy's paint colours. Here rather than beside the markup so the contrast rules
   can be asserted against them - CSS keywords are convenient but not automatically
   safe. The CSS keyword `brown` (#a52a2a) is the reason this matters: it simulates to
   #69681e for a deuteranope, which is indistinguishable from `green` at #6a6a12. The
   coffee brown below is far enough away to survive. */
export const TOY_COLORS = [
    { label: 'Black', value: 'black' },
    { label: 'White', value: 'white' },
    { label: 'Red', value: 'red' },
    { label: 'Green', value: 'green' },
    { label: 'Blue', value: 'blue' },
    { label: 'Brown', value: '#6f4e37' },
    { label: 'Purple', value: 'purple' },
    { label: 'Pink', value: 'pink' },
    { label: 'Yellow', value: 'yellow' },
];

// Keyword colours need resolving before any contrast maths can be done on them.
export const CSS_COLOR_HEX = {
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    green: '#008000',
    blue: '#0000ff',
    purple: '#800080',
    pink: '#ffc0cb',
    yellow: '#ffff00',
};

export const toHex = (value) => CSS_COLOR_HEX[value] || value;

/* --- MINESWEEPER PALETTE --- */
/* Pacific Northwest evergreen: dark canopy for the unopened board, pale lichen for
   cleared ground, cedar and lake for the numbers.

   Numbers run in three tiers rather than the traditional eight colours. Eight shades
   that all clear 4.5:1 against one light background AND stay apart from each other
   under both colour blindness simulations do not exist - the same wall the Tetris
   palette hit with seven. The digit is the information anyway; colour is there to
   convey rising danger at a glance, which three tiers do honestly. */
export const MINE_COLORS = {
    frame: '#141f18',        // Deep Canopy - the grid behind the cells
    hidden: '#2f4a38',       // Evergreen - unopened ground
    hiddenLit: '#3d5c48',    // Sunlit Needle - hover
    revealed: '#dfe3d4',     // Lichen - cleared ground
    flag: '#f0c07a',         // Lantern - a marked cell
    mine: '#241a12',         // Bark - a mine, once the board is shown
    detonated: '#8c3a2a',    // Madrone - the one that was stepped on
    detonatedMine: '#f4d9a8',// its glyph, light enough to read on that red
};

/* The cells are gradients, not flat fills - evergreen has depth and a flat green reads
   as plastic. Decorative gradients are exempt from the distinguishability rule (see
   js/contrast.js), but anything drawn ON one still has to clear the floor at every
   stop, because the background beneath it changes. These stops are what the flag and
   the numbers are checked against. */
export const MINE_GRADIENTS = {
    hidden: ['#35543f', '#2a4232'],   // canopy, lit above and shaded below
    revealed: ['#e6e9dc', '#d3d8c6'], // lichen, brighter where the light falls
};

/* Which tier a number falls in. Below the first threshold is "quiet", above the last
   is "get out". */
export const MINE_NUMBER_TIERS = [
    { upTo: 2, color: '#2a5f80' }, // Lake
    { upTo: 4, color: '#6b3316' }, // Cedar
    { upTo: 8, color: '#241f18' }, // Basalt
];

export const numberColor = (count) =>
    (MINE_NUMBER_TIERS.find((tier) => count <= tier.upTo) || MINE_NUMBER_TIERS[MINE_NUMBER_TIERS.length - 1]).color;

/* --- THE BRIDGE BOARD --- */
/* An open arena with a bridge running top to bottom and a path beneath it running
   left to right. Unlike the ribbon maps, the ground here is a plain open area - the
   strand tooling does not require a curve, only that each cell says which levels
   exist there.

   Three levels. Ground is everywhere inside the arena. The deck sits above the ground
   down the middle band. Ramps are where the deck meets the ground at either end, and
   are the only way on or off it: linkByLevel keeps ground and deck from connecting
   directly, so you cannot climb up from underneath.

   The gap in the middle of the deck is the interesting part. It is simply a deck cell
   with no deck strand - so a snake on the deck finds nothing continuing its level and
   falls, while a snake on the ground passes underneath unobstructed. */
const BRIDGE_DEFAULTS = {
    width: 22,
    height: 22,

    /* The arena is a square with its corners filled out and a bite taken from the
       middle of each edge, rather than a circle with wavy sides.

       The wavy version left a three-square protrusion in each corner, and food landing
       in one had to be fetched down a narrow dead end and backed out of. That is a
       kind of demand no other map makes - and it got worse when the pocket happened to
       sit beside an entrance to the bridge, where a wrong line costs you the run.
       Filling the corners means every part of the arena is approachable from two
       directions. The notches stay: they shape the space without trapping anything. */
    half: 10.3,      // half the arena's span
    power: 10,       // superellipse exponent - higher is squarer at the corners
    notchHalf: 2.5,  // half-width of the bite in each edge
    notchDepth: 1.5,

    /* The deck is not a straight band. It is broad where it meets the ground and drawn
       in at the waist, so its edges read as curves - an hourglass rather than a barrel.
       Wide ends make it easy to get onto and easy to leave; the pinch is the part that
       asks something of you, and it sits where the hole is. */
    halfMid: 2.5,
    halfEnd: 4.5,
    rampRows: 2,     // how deep the ground-level approach is at each end

    holeHalfW: 1,
    holeHalfH: 1.5,
};

export const BRIDGE_LEVELS = { ground: 0, ramp: 0.6, deck: 1 };
export const BRIDGE_LINK_TOLERANCE = 0.6;

/* Levels connect by nearness, with one extra rule about ramps.
 *
 * A ramp meets the ground at its outer end, and that is where you walk onto it - from
 * the side, or straight on from beyond the end of the bridge. What you cannot do is
 * come at one from underneath: walking along the underpass and arriving at the far end
 * puts you against the abutment, not on a slope up.
 *
 * Without that the underside of the bridge has no wall at all, and a snake down there
 * can only be killed by the perimeter.
 *
 * The two are the same pair of levels, so the geometry has to separate them: a ground
 * square inside the deck's span is beneath the bridge, one outside it is past the end.
 * Which is why this is built from the mask rather than being a constant. */
const levelsLink = linkByLevel(BRIDGE_LINK_TOLERANCE);

export function makeBridgeLink({ deckTop, deckBottom }) {
    return function bridgeLink(from, to, step) {
        if (!levelsLink(from, to)) return false;

        const touchesRamp = from.param === BRIDGE_LEVELS.ramp || to.param === BRIDGE_LEVELS.ramp;
        const touchesGround = from.param === BRIDGE_LEVELS.ground || to.param === BRIDGE_LEVELS.ground;
        if (!touchesRamp || !touchesGround) return true;

        // Sideways onto a ramp is always the approach.
        if (step.y === 0) return true;

        // Head on, only from past the end of the bridge - never from under the deck.
        const ground = from.param === BRIDGE_LEVELS.ground ? from : to;
        return ground.y < deckTop || ground.y > deckBottom;
    };
}

export function buildBridgeMask(options = {}) {
    const { width, height, half, power, notchHalf, notchDepth,
        halfMid, halfEnd, rampRows, holeHalfW, holeHalfH } = { ...BRIDGE_DEFAULTS, ...options };
    const cx = (width + 1) / 2;
    const cy = (height + 1) / 2;

    // A squared-off superellipse, with a notch bitten out of the middle of each edge.
    const inSquare = (x, y) =>
        Math.pow(Math.abs(x - cx) / half, power) + Math.pow(Math.abs(y - cy) / half, power) <= 1;

    const inNotch = (x, y) => {
        const dx = Math.abs(x - cx);
        const dy = Math.abs(y - cy);
        return (dx <= notchHalf && dy >= half - notchDepth)
            || (dy <= notchHalf && dx >= half - notchDepth);
    };

    const inArena = (x, y) => inSquare(x, y) && !inNotch(x, y);

    const inHole = (x, y) => Math.abs(x - cx) <= holeHalfW && Math.abs(y - cy) <= holeHalfH;

    // The deck runs the full height of the band; the rows at either end are the ramps.
    const bandRows = [];
    for (let y = 1; y <= height; y++) if (inArena(Math.round(cx), y)) bandRows.push(y);
    const bandTop = bandRows[0];
    const bandBottom = bandRows[bandRows.length - 1];

    /* The taper is measured across the raised deck, not the whole band, so the widest
       point falls where the deck begins and ends rather than out on the approach. */
    const deckTop = bandTop + rampRows;
    const deckBottom = bandBottom - rampRows;
    const span = (deckBottom - deckTop) / 2;
    const middle = (deckTop + deckBottom) / 2;

    // Parabolic: pinched to halfMid at the waist, opening to halfEnd at either end.
    const halfAt = (y) => {
        const t = Math.min(1, Math.abs(y - middle) / span);
        return halfMid + (halfEnd - halfMid) * t * t;
    };

    /* Clamped to the band's own rows. Without it the widening runs away past the ends
       of the bridge and swallows the scraps of ground in the arena's corners. */
    const inBand = (x, y) => y >= bandTop && y <= bandBottom && Math.abs(x - cx) <= halfAt(y);
    const onRamp = (y) => y < deckTop || y > deckBottom;
    const elevated = (x, y) => inBand(x, y) && !onRamp(y);

    const cells = [];
    for (let y = 1; y <= height; y++) {
        const row = [];
        for (let x = 1; x <= width; x++) {
            if (!inArena(x, y)) { row.push({ kind: CELL.WALL, branches: [] }); continue; }

            if (inBand(x, y) && onRamp(y)) {
                row.push({ kind: CELL.TRACK, branches: [BRIDGE_LEVELS.ramp] });
                continue;
            }

            const branches = [BRIDGE_LEVELS.ground];
            const gap = elevated(x, y) && inHole(x, y);
            if (elevated(x, y) && !gap) branches.push(BRIDGE_LEVELS.deck);

            // gap marks a hole in the deck, so falling through it can be reported as
            // its own kind of death rather than as stepping off an edge.
            row.push({ kind: CELL.TRACK, branches, gap });
        }
        cells.push(row);
    }

    return { width, height, cells, deckTop, deckBottom };
}

export const BRIDGE_MASK = buildBridgeMask();

/* A ramp square. Worth being able to identify, because walking into one is the only
   move on this map that can fail without the square itself being unusable: every other
   way of meeting a ramp is a legal approach, so a failure here is the abutment. */
export const isBridgeRamp = (mask, x, y) => {
    if (x < 1 || y < 1 || x > mask.width || y > mask.height) return false;
    const { branches } = mask.cells[y - 1][x - 1];
    return branches.length === 1 && branches[0] === BRIDGE_LEVELS.ramp;
};

export const isDeckGap = (mask, x, y) => {
    if (x < 1 || y < 1 || x > mask.width || y > mask.height) return false;
    return Boolean(mask.cells[y - 1][x - 1].gap);
};

/* --- SEQUENCE PALETTE --- */
/* A machine panel: gunmetal, steel, bone, and the warm metals. The aesthetic is
   carried by the panel and the pad shape - bezels, travel, a lit lamp behind a face -
   rather than by muting the colours, because muted industrial palettes are exactly
   where the contrast rules fail. The pads stay legible; the machine is built around
   them.

   Two things every pad has to satisfy, both asserted in tests/contrast:
   - its face clears 4.5:1 on the panel, so a dark pad is never a hole in the board;
   - its lit state is a real lightness jump from its own face, not a hue shift. That
     is what makes the flash readable to someone who cannot separate the hues, and it
     is why the faces are not at the top of the range - a pad already near white has
     nowhere brighter to go when it lights.

   The pads are also spread alternately along the blue-yellow axis and lightness, so
   neighbours in hue are separated by brightness and everything else by the one axis
   red/green colour blindness leaves intact. Six was the ceiling: the seventh could not
   be placed without colliding with something, the same wall the Tetris palette hit. */
export const SEQUENCE_COLORS = {
    panel: '#171c21',      // Gunmetal - the machine's face
    bezel: '#2b3339',      // Brushed steel - the surround a pad sits in
    housing: '#0e1216',    // Shadow inside the bezel
    readout: '#cfe3ea',    // Pale steel - the round counter
};

/* Ordered, and the four-pad game takes the first four - so the easier game gets the
   widest spread on the blue-yellow axis rather than an arbitrary subset. */
export const SEQUENCE_PADS = [
    { name: 'steel',  face: '#b6c4ea', lit: '#eef2ff' },
    { name: 'bone',   face: '#e0dcd0', lit: '#ffffff' },
    { name: 'copper', face: '#bc8c70', lit: '#e8c0a4' },
    { name: 'amber',  face: '#c08628', lit: '#f0c07a' },
    { name: 'slate',  face: '#7898a0', lit: '#bcd6dc' },
    { name: 'brass',  face: '#cdba6e', lit: '#f7ecbc' },
];

/* --- TIC-TAC-TOE PALETTE --- */
/* Pencil and paper: ink-blue crosses, pencil-brown noughts, graphite lines. The marks
   are told apart by shape first - a cross and a ring - and colour only second, but the
   colour still has to hold up on its own: blue and brown sit at opposite ends of the
   blue-yellow axis, which survives both kinds of red/green colour blindness.

   The strike-through goes over whichever mark won, so it is near-black graphite - a
   clear lightness step below both inks rather than a third hue beside them. */
export const TICTACTOE_COLORS = {
    paper: '#f1ead6',   // the board
    grid: '#6b645a',    // graphite - the lines, and the frame
    x: '#1f4f8f',       // ink blue
    o: '#8a4b0f',       // pencil brown
    strike: '#1c1a17',  // the winning line
};

/* --- PETS PALETTE --- */
/* A small warm room and a yellow Labrador. The dog is a silhouette first: a dark outline
   that clears the text floor on the wall, the floor and the tray, so its shape reads
   whatever the fur does. The eye and nose clear it on the fur. The rest is held to the
   graphic threshold or to distinguishability, per role - see tests/contrast.

   The water failed the first measurement against its own bowl, at 1.47:1, and was
   darkened while the bowl was lightened. Blue water in a pale bowl, brown kibble in an
   amber one: the two sit apart on the blue-yellow axis as well as by shape. */
export const PETS_COLORS = {
    wall: '#f1ead6',
    floor: '#d9c9a5',
    tray: '#e6dcc2',
    outline: '#3b2a1a',
    fur: '#e6be72',
    furShade: '#c4914a',
    furLight: '#f6e2b0',
    nose: '#17120d',        // also the eye, and the open mouth
    collar: '#2b62a8',
    collarShade: '#1c4378', // the collar's lower edge, curving round the neck
    collarTag: '#cfd8e0',   // the small metal tag at the throat
    tongue: '#d9707c',      // the happy face's tongue - decoration, held apart from its neighbours
    foodBowl: '#d98c3f',
    waterBowl: '#c9d7e4',
    kibble: '#6b3f1d',
    water: '#1b5aa6',
    waterHighlight: '#cfe6fb',
    bag: '#a8683a',
    bagLabel: '#f3e3bf',
    bagCrimp: '#7a4a28',
    // The room's furnishings. They are drawn behind the dog, so every fill it can walk in
    // front of clears the text floor against its outline; the window is out of its reach.
    sceneLine: '#8a7556',   // the soft edge of everything behind the dog - a graphic, 3:1
    trim: '#fbf8f1',        // the painted skirting board and window frame
    floorShade: '#c9b690',  // the floorboard seams - shading, not something to tell apart
    sky: '#8ec5ee',
    fence: '#f7f4ec',
    grass: '#6fa850',
    grassShade: '#5a9140',  // tufts - shading again
    leaf: '#9ccc6e',
    leafShade: '#7fb356',
    pot: '#9fb7cf',
    potShade: '#86a0bb',
    moon: '#f2edd0',        // the night sky's moon and stars, drawn only at night
    star: '#dfe5f5',
    // The fish, its tank on a wooden stand, its flakes and its bubbles.
    fishBody: '#f2a33a',
    fishShade: '#d9812a',   // belly and the shut eye - shading on the body
    fishFin: '#f7c77a',     // fins and tail - shading again
    tankWater: '#cfeaf0',
    tankSurface: '#a9d8e3',
    tankAir: '#eef6f4',
    tankLid: '#d5dade',     // light, so the Z's of a sleeping fish still show rising past it
    gravel: '#c9b28a',
    gravelShade: '#b49b75', // lightened from #a9906a, which missed the text floor for the outline
    flake: '#b5482a',
    bubble: '#ffffff',      // the shine inside a bubble's ring
    stand: '#9a6b43',
    standShade: '#7d5434',
    shaker: '#3f7fb5',      // the flake shaker in the tray
};

/* The sky through the Pets window at each time of day - overrides of PETS_COLORS for the
   view outside, applied only to the window. Day is the room's own colours. Everything
   out there is a picture, so each colour is held apart from its neighbours rather than to
   a floor; the dog never walks in front of the window. The fence and grass darken toward
   night so the yard dims with the sky instead of glowing in front of it. */
export const PETS_SKIES = {
    dawn: { sky: '#e7b3c0', fence: '#f4eee6', grass: '#5c964a', grassShade: '#4c7f3d' },
    day: {},
    dusk: { sky: '#d9825a', fence: '#d6c6b4', grass: '#4a7a3a', grassShade: '#3d6830' },
    night: { sky: '#1e2b52', fence: '#7d8299', grass: '#2c4a33', grassShade: '#243d2a' },
};

/* --- CONTROL BAR THEMES --- */
/* The row of selects, buttons and readouts above each board. These were browser
   defaults until now: identical grey chrome above five games that otherwise look
   nothing alike, and on a dark page the default select was the brightest thing on
   screen - louder than the board it belonged to.

   Each game's controls take that game's own palette, so the chrome reads as part of
   the machine rather than as the page's furniture. Same rules as everywhere else:
   `text` clears 4.5:1 on `surface`, and `readout` clears it on the page column, which
   is BOARD_COLORS.emptyCell. Asserted in tests/contrast.

   `border` is not held to the text floor - it is an edge, not something read - but it
   is kept clearly off its own surface so a control still has a visible boundary. */

// Pacific Northwest, shared by Snake and Minesweeper, matching their boards.
const PNW_CONTROLS = {
    surface: '#2f4a38',      // Evergreen
    text: '#dfe3d4',         // Lichen
    border: '#7d9a86',       // Sunlit needle
    readout: '#dfe3d4',      // Lichen, on the page column
    activeSurface: '#f0c07a',// Lantern - a toggle that is switched on
    activeText: '#241f18',   // Bark
};

export const CONTROL_THEMES = {
    snake: PNW_CONTROLS,
    minesweeper: PNW_CONTROLS,

    /* Sequence: the panel and its fascia, the same metal as the pads sit in. The
       switched-on toggle is a lit lamp, because on this machine that is what "on"
       already looks like. */
    sequence: {
        surface: '#2b3339',      // Brushed steel - SEQUENCE_COLORS.bezel
        text: '#cfe3ea',         // Pale steel - SEQUENCE_COLORS.readout
        border: '#7b909c',       // Machined edge
        readout: '#cfe3ea',
        activeSurface: '#bcd6dc',// The steel pad, lit
        activeText: '#0e1216',   // SEQUENCE_COLORS.housing
    },

    /* Falling Polyominos: the site's deep teal, with the piece colours themselves as
       accents on the controls. Those seven are already proved pairwise distinguishable
       under both simulations (see the Tetris palette above), so borrowing them for the
       chrome costs nothing and cannot introduce a collision - which is the only way to
       throw a colour party on a board that has to stay readable. */
    tetris: {
        surface: '#002e2c',      // Deep Teal
        text: '#eff1c5',         // Cream
        border: '#7fd0d6',       // Aqua - the S piece
        readout: '#eff1c5',
        activeSurface: '#d2d673',// Chartreuse - the L piece
        activeText: '#2f2a1f',
    },

    // Finger Paint: the paint tray, in the site's own olive and cream.
    toy: {
        surface: '#51553a',      // Olive - the gutter colour
        text: '#eff1c5',         // Cream
        border: '#dfe38c',       // Straw
        readout: '#e3e7af',
        activeSurface: '#dfe38c',
        activeText: '#2f2a1f',
    },

    /* Tic-Tac-Toe: the controls are the ink and their labels the paper, so the bar reads
       as the same pad the board is drawn on. It has no toggle yet; the on state is
       stated anyway so the theme is whole and asserted like the others. */
    tictactoe: {
        surface: '#23384d',      // Ink
        text: '#f1ead6',         // Paper - TICTACTOE_COLORS.paper
        border: '#8aa4bd',       // Washed ink
        readout: '#f1ead6',
        activeSurface: '#e8c872',// Pencil yellow
        activeText: '#1c1a17',   // Graphite - TICTACTOE_COLORS.strike
    },

    // Pets: leather and fur, from the dog's own palette.
    pets: {
        surface: '#5a3d24',      // Leather
        text: '#f6e2b0',         // Light fur - PETS_COLORS.furLight
        border: '#c4914a',       // Fur shade - PETS_COLORS.furShade
        readout: '#f6e2b0',
        activeSurface: '#e6be72',// Fur - PETS_COLORS.fur
        activeText: '#3b2a1a',   // PETS_COLORS.outline
    },
};

/* The piece colours handed round the Tetris controls, one each, so the row is a
   spread of the palette rather than one accent repeated. Ordered to alternate across
   the blue-yellow axis, which is what keeps neighbouring controls apart. */
export const TETRIS_CONTROL_ACCENTS = [
    TETRIS_COLORS.I, // Pale Sky
    TETRIS_COLORS.Z, // Amber
    TETRIS_COLORS.S, // Aqua
    TETRIS_COLORS.L, // Chartreuse
];
