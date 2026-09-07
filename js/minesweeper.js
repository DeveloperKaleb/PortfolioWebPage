/* Minesweeper rules. Pure - no DOM, no timers, no randomness of its own beyond an
 * injected source - so the whole game can be played out in tests.
 *
 * State is treated as immutable: every function returns a new game rather than editing
 * the one it was given. Reveals cascade, so a bug that half-applies a change is easy to
 * write and miserable to find; returning a fresh object makes that impossible.
 */

export const STATUS = { READY: 'ready', PLAYING: 'playing', WON: 'won', LOST: 'lost' };

export const DEFAULTS = { width: 10, height: 10, mineCount: 12 };

const key = (x, y) => `${x},${y}`;

export function createGame(options = {}) {
    const { width, height, mineCount } = { ...DEFAULTS, ...options };
    return {
        width,
        height,
        mineCount,
        mines: new Set(),
        counts: null,      // filled in once the mines are placed
        revealed: new Set(),
        flagged: new Set(),
        status: STATUS.READY,
    };
}

const copy = (game, changes) => ({
    ...game,
    mines: new Set(game.mines),
    revealed: new Set(game.revealed),
    flagged: new Set(game.flagged),
    ...changes,
});

export const inBounds = (game, x, y) => x >= 1 && y >= 1 && x <= game.width && y <= game.height;

export function neighbours(game, x, y) {
    const found = [];
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (inBounds(game, x + dx, y + dy)) found.push({ x: x + dx, y: y + dy });
        }
    }
    return found;
}

export const isMine = (game, x, y) => game.mines.has(key(x, y));
export const isRevealed = (game, x, y) => game.revealed.has(key(x, y));
export const isFlagged = (game, x, y) => game.flagged.has(key(x, y));

/* Mines are placed after the first click, never on it or beside it. Opening onto a
 * number - or worse, a mine - on move one is luck rather than play, and the empty
 * pocket a clear neighbourhood guarantees is what gives the first cascade something
 * to work with. */
export function placeMines(game, safeX, safeY, random = Math.random) {
    const forbidden = new Set([key(safeX, safeY)]);
    neighbours(game, safeX, safeY).forEach((n) => forbidden.add(key(n.x, n.y)));

    const candidates = [];
    for (let y = 1; y <= game.height; y++) {
        for (let x = 1; x <= game.width; x++) {
            if (!forbidden.has(key(x, y))) candidates.push(key(x, y));
        }
    }

    // Fisher-Yates as far as we need it, so the draw is uniform and never repeats.
    const wanted = Math.min(game.mineCount, candidates.length);
    for (let i = 0; i < wanted; i++) {
        const j = i + Math.floor(random() * (candidates.length - i));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const mines = new Set(candidates.slice(0, wanted));
    return withCounts(copy(game, { mines, status: STATUS.PLAYING }));
}

// How many mines touch each cell, worked out once rather than on every render.
function withCounts(game) {
    const counts = [];
    for (let y = 1; y <= game.height; y++) {
        const row = [];
        for (let x = 1; x <= game.width; x++) {
            row.push(neighbours(game, x, y).filter((n) => isMine(game, n.x, n.y)).length);
        }
        counts.push(row);
    }
    return { ...game, counts };
}

export const countAt = (game, x, y) => (game.counts ? game.counts[y - 1][x - 1] : 0);

/* Revealing an empty cell opens everything it touches, and keeps going through any
 * further empties - the cascade that makes the game playable. Flagged cells are left
 * alone: the flag is the player saying "not here", and a cascade overruling that would
 * throw away their reasoning. */
function cascade(game, x, y) {
    const revealed = new Set(game.revealed);
    const queue = [{ x, y }];

    while (queue.length) {
        const cell = queue.pop();
        const id = key(cell.x, cell.y);
        if (revealed.has(id) || game.flagged.has(id)) continue;
        revealed.add(id);

        if (countAt(game, cell.x, cell.y) === 0) {
            neighbours(game, cell.x, cell.y).forEach((n) => {
                if (!revealed.has(key(n.x, n.y))) queue.push(n);
            });
        }
    }
    return revealed;
}

export const safeCellCount = (game) => game.width * game.height - game.mineCount;

/* Winning means the board is finished, not merely survived: every safe square opened
   AND every mine flagged. Ending on the last safe square instead would call it a win
   while the player still had flags in hand, which reads as the game stopping early.

   The flags do not need checking for correctness. A flag can only sit on a hidden
   square, and once every safe square is open the only hidden squares left are mines -
   so the right count of flags can only mean the right flags. */
export const isWon = (game) =>
    game.revealed.size === safeCellCount(game) && game.flagged.size === game.mineCount;

// Work out where a move leaves the game. A loss is already decided by the time this runs.
const settle = (game) => (isWon(game) ? { ...game, status: STATUS.WON } : game);

export function reveal(game, x, y, random = Math.random) {
    if (game.status === STATUS.WON || game.status === STATUS.LOST) return game;
    if (!inBounds(game, x, y)) return game;
    if (isFlagged(game, x, y) || isRevealed(game, x, y)) return game;

    const started = game.status === STATUS.READY ? placeMines(game, x, y, random) : game;

    if (isMine(started, x, y)) {
        const revealed = new Set(started.revealed);
        revealed.add(key(x, y));
        return copy(started, { revealed, status: STATUS.LOST });
    }

    const revealed = cascade(started, x, y);
    return settle(copy(started, { revealed, status: STATUS.PLAYING }));
}

export function toggleFlag(game, x, y) {
    if (game.status === STATUS.WON || game.status === STATUS.LOST) return game;
    if (!inBounds(game, x, y) || isRevealed(game, x, y)) return game;

    const flagged = new Set(game.flagged);
    const id = key(x, y);
    if (flagged.has(id)) flagged.delete(id); else flagged.add(id);

    // Placing the last flag is a winning move, so flagging has to settle too.
    return settle(copy(game, { flagged }));
}

/* Clicking a satisfied number opens its remaining neighbours in one go. Standard
 * minesweeper, and the difference between playing the game and clicking every cell of
 * it by hand. Wrong flags make this lose, which is the point - it acts on what you
 * claimed, not on what is true. */
export function chord(game, x, y, random = Math.random) {
    if (game.status !== STATUS.PLAYING || !isRevealed(game, x, y)) return game;

    const around = neighbours(game, x, y);
    const flags = around.filter((n) => isFlagged(game, n.x, n.y)).length;
    if (flags !== countAt(game, x, y) || flags === 0) return game;

    return around.reduce(
        (current, n) => (isFlagged(current, n.x, n.y) || isRevealed(current, n.x, n.y)
            ? current
            : reveal(current, n.x, n.y, random)),
        game
    );
}

/* Flags still to place. Named for what it actually counts: it goes down on any flag,
   right or wrong, because the game cannot tell the player which they have made. */
export const flagsRemaining = (game) => game.mineCount - game.flagged.size;

export const isOver = (game) => game.status === STATUS.WON || game.status === STATUS.LOST;

/* Board sizes offered in the UI. Density climbs with size deliberately: a bigger board
   at the same density is only longer, not harder, and the interesting part of a large
   board is that the deductions get denser too. 12% is close to the classic beginner
   ratio, 15% to intermediate. */
export const PRESETS = {
    standard: { label: 'Standard (10x10)', width: 10, height: 10, mineCount: 12 },
    large: { label: 'Large (20x20)', width: 20, height: 20, mineCount: 60 },
};

export const mineDensity = (preset) => preset.mineCount / (preset.width * preset.height);
