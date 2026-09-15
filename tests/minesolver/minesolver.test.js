import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
    findSafeSquare, relocateMines, resolveForcedGuess, FORGIVENESS_BUDGET_MS,
} from '../../js/minesolver.js';
import {
    createGame, reveal, chord, toggleFlag, countAt, isMine, isRevealed, neighbours,
    safeCellCount, STATUS, PRESETS, inBounds, hasProvenMine,
} from '../../js/minesweeper.js';
import { parseShape } from '../../js/mineshapes.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// A seeded random source, so every run plays the same positions.
function seeded(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Every square on the board - for a Mine A Shape! board, the shape's squares only.
const cellsOf = (game) => {
    const out = [];
    for (let y = 1; y <= game.height; y++) for (let x = 1; x <= game.width; x++) if (inBounds(game, x, y)) out.push({ x, y });
    return out;
};
const hidden = (game) => cellsOf(game).filter(({ x, y }) => !isRevealed(game, x, y));
const cleared = (game) => game.revealed.size === safeCellCount(game);
const touchesNumber = (game, { x, y }) => neighbours(game, x, y).some((n) => isRevealed(game, n.x, n.y));
const keyOf = ({ x, y }) => `${x},${y}`;

const SMALL = [
    { width: 4, height: 4, mineCount: 3 },
    { width: 5, height: 5, mineCount: 5 },
    { width: 6, height: 6, mineCount: 6 },
    { width: 6, height: 6, mineCount: 9 },
    { width: 7, height: 5, mineCount: 8 },
    { width: 8, height: 6, mineCount: 12 },
    // Shaped boards, with holes the solver must never treat as squares.
    {
        width: 6, height: 6, mineCount: 5,
        shape: parseShape({ name: 'ring', rows: ['.####.', '######', '##..##', '##..##', '######', '.####.'] }),
    },
    {
        width: 7, height: 7, mineCount: 6,
        shape: parseShape({ name: 'cross', rows: ['..###..', '..###..', '#######', '#######', '#######', '..###..', '..###..'] }),
    },
];

/* Positions part-way through small games, with few enough hidden squares to check by brute
   force. Moves are only ever made on truly safe squares, so nothing here is forgiven. */
function smallPositions(count, seed) {
    const random = seeded(seed);
    const out = [];
    for (let attempt = 0; out.length < count && attempt < count * 40; attempt++) {
        const size = SMALL[attempt % SMALL.length];
        const fresh = createGame(size);
        const squares = cellsOf(fresh);
        const first = squares[Math.floor(random() * squares.length)];
        let game = reveal(fresh, first.x, first.y, random);
        const moves = Math.floor(random() * size.width * size.height);
        for (let i = 0; i < moves && !cleared(game); i++) {
            const safe = hidden(game).filter(({ x, y }) => !isMine(game, x, y));
            const pick = safe[Math.floor(random() * safe.length)];
            game = reveal(game, pick.x, pick.y, random);
        }
        if (!cleared(game) && hidden(game).length <= 16) out.push(game);
    }
    return out;
}

/* The answer by brute force: every layout of the mines over the hidden squares that fits
   every revealed number and the total, and for each hidden square whether it is 'safe' in
   all of them, a 'mine' in all of them, or 'open'. */
function verdicts(game) {
    const squares = hidden(game);
    const numbers = cellsOf(game).filter(({ x, y }) => isRevealed(game, x, y)).map(({ x, y }) => ({
        value: countAt(game, x, y),
        around: neighbours(game, x, y)
            .map((n) => squares.findIndex((s) => s.x === n.x && s.y === n.y))
            .filter((i) => i >= 0),
    }));
    const layouts = [];
    const pick = new Array(squares.length).fill(false);
    (function place(i, left) {
        if (left > squares.length - i) return;
        if (i === squares.length) {
            if (numbers.every(({ value, around }) => around.filter((j) => pick[j]).length === value)) layouts.push([...pick]);
            return;
        }
        place(i + 1, left);
        if (left > 0) { pick[i] = true; place(i + 1, left - 1); pick[i] = false; }
    })(0, game.mineCount);

    const out = new Map();
    squares.forEach((square, i) => {
        const mined = layouts.some((layout) => layout[i]);
        const clear = layouts.some((layout) => !layout[i]);
        out.set(keyOf(square), mined && clear ? 'open' : mined ? 'mine' : 'safe');
    });
    return out;
}

const fitsEveryNumber = (game, mines) => cellsOf(game)
    .filter(({ x, y }) => isRevealed(game, x, y))
    .every(({ x, y }) => neighbours(game, x, y).filter((n) => mines.has(keyOf(n))).length === countAt(game, x, y));

describe('Proving a square safe', () => {
    const positions = smallPositions(200, 1);

    test('there are enough positions to mean something', () => {
        expect(positions).toHaveLength(200);
    });

    test('finds a square exactly when brute force proves one, and only a proven one', () => {
        const answers = positions.map((game) => {
            const truth = verdicts(game);
            const anySafe = [...truth.values()].includes('safe');
            const result = findSafeSquare(game);
            expect(result.result).toBe(anySafe ? 'safe' : 'none');
            if (anySafe) expect(truth.get(keyOf(result))).toBe('safe');
            return result.result;
        });
        // Both answers have to have come up, or the test above proved half of nothing.
        expect(answers).toContain('safe');
        expect(answers).toContain('none');
    });

    /* Counting the mines left is part of the reasoning the solver has to cover. These
       squares touch no number, so only the total can decide them. */
    test('the positions include proofs that rest on the mine count alone', () => {
        const byCount = positions.filter((game) => {
            const truth = verdicts(game);
            return hidden(game).some((square) => !touchesNumber(game, square) && truth.get(keyOf(square)) !== 'open');
        });
        expect(byCount.length).toBeGreaterThan(0);
    });
});

describe('Moving the mines to spare a square', () => {
    test('spares a square exactly when some layout does, and the layout fits every number', () => {
        const random = seeded(3);
        smallPositions(200, 2).forEach((game) => {
            const truth = verdicts(game);
            hidden(game).forEach((square) => {
                const mines = relocateMines(game, square.x, square.y, { random });
                if (truth.get(keyOf(square)) === 'mine') {
                    expect(mines).toBeNull();
                    return;
                }
                expect(mines).not.toBeNull();
                expect(mines.has(keyOf(square))).toBe(false);
                expect(mines.size).toBe(game.mineCount);
                expect(fitsEveryNumber(game, mines)).toBe(true);
                // Never into a hole in a shaped board.
                [...mines].forEach((key) => {
                    const [mx, my] = key.split(',').map(Number);
                    expect(inBounds(game, mx, my)).toBe(true);
                });
                // Any layout that fits keeps these, but it is the promise, so it is checked.
                truth.forEach((verdict, key) => { if (verdict === 'mine') expect(mines.has(key)).toBe(true); });
            });
        });
    });

    /* Nearest, not fresh: the board changes as little as it can. A mine on a square that
       touches no number just moves to another such square, and nothing else changes. */
    test('a mine touching no number moves to another square touching no number, and that is all', () => {
        const random = seeded(4);
        let checked = 0;
        smallPositions(300, 5).forEach((game) => {
            const loose = hidden(game).filter((square) => !touchesNumber(game, square));
            const mine = loose.find(({ x, y }) => isMine(game, x, y));
            if (!mine || !loose.some(({ x, y }) => !isMine(game, x, y))) return;
            const mines = relocateMines(game, mine.x, mine.y, { random });
            const changed = [...game.mines].filter((key) => !mines.has(key)).length
                + [...mines].filter((key) => !game.mines.has(key)).length;
            expect(changed).toBe(2);
            checked++;
        });
        expect(checked).toBeGreaterThan(0);
    });
});

/* hasProvenMine (js/minesweeper.js) lets Mine A Shape! count a proven mine as a way
   forward. It asks the solver whether a mine beside a number could be moved; brute force
   says whether the numbers prove it. They have to agree. */
describe('Proving a mine beside a number', () => {
    test('hasProvenMine agrees with brute force', () => {
        let proven = 0;
        smallPositions(200, 13).forEach((game) => {
            const truth = verdicts(game);
            const expected = hidden(game).some((square) => touchesNumber(game, square) && truth.get(keyOf(square)) === 'mine');
            expect(hasProvenMine(game)).toBe(expected);
            if (expected) proven++;
        });
        expect(proven).toBeGreaterThan(0);
    });
});

describe('Tapping a mine', () => {
    test('loses only when a safe square was provable or the square was a proven mine', () => {
        const random = seeded(8);
        let forgiven = 0, lost = 0;
        // Forced positions are a few percent of these late, small-board positions, so it
        // takes a few hundred to be sure of meeting some.
        smallPositions(600, 9).forEach((game) => {
            const truth = verdicts(game);
            const anySafe = [...truth.values()].includes('safe');
            hidden(game).filter(({ x, y }) => isMine(game, x, y)).forEach(({ x, y }) => {
                const after = reveal(game, x, y, random);
                if (anySafe || truth.get(`${x},${y}`) === 'mine') {
                    expect(after.status).toBe(STATUS.LOST);
                    lost++;
                    return;
                }
                expect(after.status).not.toBe(STATUS.LOST);
                expect(isRevealed(after, x, y)).toBe(true);
                expect(after.mines.size).toBe(game.mineCount);
                // Every number the player has already seen still reads the same.
                cellsOf(game)
                    .filter((cell) => isRevealed(game, cell.x, cell.y))
                    .forEach((cell) => expect(countAt(after, cell.x, cell.y)).toBe(countAt(game, cell.x, cell.y)));
                forgiven++;
            });
        });
        expect(forgiven).toBeGreaterThan(0);
        expect(lost).toBeGreaterThan(0);
    });

    // A forced position and a mine in it that some layout spares.
    const forcedSetup = (seed) => {
        for (const game of smallPositions(400, seed)) {
            const truth = verdicts(game);
            if ([...truth.values()].includes('safe')) continue;
            const mine = hidden(game).find((square) => isMine(game, square.x, square.y) && truth.get(keyOf(square)) === 'open');
            if (mine) return { game, mine };
        }
        return null;
    };

    test('a forgiven tap leaves the flags exactly where the player put them', () => {
        const { game, mine } = forcedSetup(12);
        let flagged = game;
        hidden(game).filter((square) => keyOf(square) !== keyOf(mine)).slice(0, 2)
            .forEach(({ x, y }) => { flagged = toggleFlag(flagged, x, y); });
        const after = reveal(flagged, mine.x, mine.y, Math.random);
        expect(after.status).not.toBe(STATUS.LOST);
        expect([...after.flagged].sort()).toEqual([...flagged.flagged].sort());
    });

    /* The only way a chord opens a mine is a wrong flag - the player's mistake - so it is
       never forgiven, even where tapping the same square would be. */
    test('a chord onto a mine loses, even where a tap on it would be forgiven', () => {
        let checked = 0;
        for (const game of smallPositions(400, 10)) {
            const truth = verdicts(game);
            if ([...truth.values()].includes('safe')) continue;
            for (const mine of hidden(game).filter((s) => isMine(game, s.x, s.y) && truth.get(keyOf(s)) === 'open')) {
                for (const number of neighbours(game, mine.x, mine.y).filter((n) => isRevealed(game, n.x, n.y))) {
                    const value = countAt(game, number.x, number.y);
                    const others = neighbours(game, number.x, number.y)
                        .filter((n) => !isRevealed(game, n.x, n.y) && keyOf(n) !== keyOf(mine));
                    if (value === 0 || others.length < value) continue;
                    let flagged = game;
                    others.slice(0, value).forEach(({ x, y }) => { flagged = toggleFlag(flagged, x, y); });
                    expect(reveal(flagged, mine.x, mine.y, Math.random).status).not.toBe(STATUS.LOST);
                    expect(chord(flagged, number.x, number.y, Math.random).status).toBe(STATUS.LOST);
                    checked++;
                    break;
                }
                if (checked) break;
            }
            if (checked) break;
        }
        expect(checked).toBe(1);
    });
});

describe('The time limit', () => {
    const game = smallPositions(1, 6)[0];

    test('is 250ms', () => {
        expect(FORGIVENESS_BUDGET_MS).toBe(250);
    });

    // A clock that never moves, with no budget: the deadline has already arrived.
    test('a check that runs out of time says so', () => {
        expect(findSafeSquare(game, { budgetMs: 0, now: () => 0 }).result).toBe('timeout');
    });

    test('moving the mines gives up when it runs out of time', () => {
        const { x, y } = hidden(game)[0];
        expect(relocateMines(game, x, y, { budgetMs: 0, now: () => 0 })).toBeNull();
    });

    /* Try to forgive, decided with the project owner: a check that runs out of time counts
       as finding nothing. The accepted cost is that it then forgives even where a safe
       square existed - which is exactly the position used here. */
    test('a check that runs out of time still forgives, if the mines can be moved', () => {
        const position = smallPositions(200, 7).map((g) => ({ g, truth: verdicts(g) })).find(({ g, truth }) =>
            [...truth.values()].includes('safe')
            && hidden(g).some((s) => isMine(g, s.x, s.y) && truth.get(keyOf(s)) === 'open'));
        const { g, truth } = position;
        const mine = hidden(g).find((s) => isMine(g, s.x, s.y) && truth.get(keyOf(s)) === 'open');
        expect(resolveForcedGuess(g, mine.x, mine.y)).toBeNull();
        expect(resolveForcedGuess(g, mine.x, mine.y, { checkBudgetMs: 0 })).not.toBeNull();
    });
});

/* The promise, end to end on a real board size: guess only when nothing is provable, never
   on a square the numbers prove is a mine, and the game is never lost. */
describe('A player who never guesses while a move is provable', () => {
    test('never loses a 20x20 game', () => {
        const random = seeded(11);
        for (let played = 0; played < 5; played++) {
            let game = reveal(createGame(PRESETS.large), 10, 10, random);
            while (!cleared(game)) {
                const proof = findSafeSquare(game);
                if (proof.result === 'safe') {
                    game = reveal(game, proof.x, proof.y, random);
                } else {
                    const options = hidden(game);
                    for (let i = options.length - 1; i > 0; i--) {
                        const j = Math.floor(random() * (i + 1));
                        [options[i], options[j]] = [options[j], options[i]];
                    }
                    const guess = options.find(({ x, y }) => relocateMines(game, x, y, { random }) !== null);
                    game = reveal(game, guess.x, guess.y, random);
                }
                expect(game.status).not.toBe(STATUS.LOST);
            }
        }
    });
});

/* The project owner keeps the site small, and this is the largest piece of game logic
   added for a single rule. Measured when it was built: 17.1KB, 5.9KB compressed. The
   limits leave room to fix and explain it, not to grow it by half again - raising them
   should be a decision, not a side effect. */
describe('Size', () => {
    const source = readFileSync(resolve(root, 'js/minesolver.js'));

    test('js/minesolver.js stays under 20KB', () => {
        expect(source.length).toBeLessThanOrEqual(20 * 1024);
    });

    test('and under 7KB compressed, which is nearer what a visitor downloads', () => {
        expect(gzipSync(source, { level: 9 }).length).toBeLessThanOrEqual(7 * 1024);
    });
});
