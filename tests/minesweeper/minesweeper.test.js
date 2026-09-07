import { describe, test, expect } from 'vitest';
import {
    createGame, reveal, toggleFlag, chord, placeMines, neighbours,
    countAt, isMine, isRevealed, isFlagged, flagsRemaining,
    safeCellCount, isOver, isWon, STATUS,
} from '../../js/minesweeper.js';

// Reveal everything that is not a mine, which is what winning requires.
const clearBoard = (game) => {
    let current = game;
    for (let y = 1; y <= current.height; y++) {
        for (let x = 1; x <= current.width; x++) {
            if (!isMine(current, x, y)) current = reveal(current, x, y, Math.random);
        }
    }
    return current;
};

// Flag every mine, which winning now requires.
const flagAllMines = (game) => {
    let current = game;
    for (let y = 1; y <= current.height; y++) {
        for (let x = 1; x <= current.width; x++) {
            if (isMine(current, x, y) && !isFlagged(current, x, y)) current = toggleFlag(current, x, y);
        }
    }
    return current;
};

const hiddenCells = (game) => {
    const found = [];
    for (let y = 1; y <= game.height; y++) {
        for (let x = 1; x <= game.width; x++) if (!isRevealed(game, x, y)) found.push({ x, y });
    }
    return found;
};

describe('Setting up', () => {
    test('a new game has no mines until the first click', () => {
        const game = createGame();
        expect(game.status).toBe(STATUS.READY);
        expect(game.mines.size).toBe(0);
    });

    test('the default board is 10x10', () => {
        const game = createGame();
        expect(game.width).toBe(10);
        expect(game.height).toBe(10);
        expect(safeCellCount(game)).toBe(100 - game.mineCount);
    });

    test('it places exactly the number of mines asked for', () => {
        const game = placeMines(createGame(), 5, 5, Math.random);
        expect(game.mines.size).toBe(game.mineCount);
    });

    /* The first click and everything around it are kept clear, so the opening move
       always cascades instead of landing on a number - or a mine - by luck. */
    test('the first click and its neighbours are never mined', () => {
        for (let attempt = 0; attempt < 50; attempt++) {
            const game = placeMines(createGame(), 4, 6, Math.random);
            expect(isMine(game, 4, 6)).toBe(false);
            neighbours(game, 4, 6).forEach((n) => expect(isMine(game, n.x, n.y)).toBe(false));
        }
    });

    // Picking at random until you have enough can place two mines in one square.
    test('mine placement never repeats a cell', () => {
        for (let attempt = 0; attempt < 30; attempt++) {
            const game = placeMines(createGame({ mineCount: 40 }), 1, 1, Math.random);
            expect(game.mines.size).toBe(40);
        }
    });

    test('it cannot place more mines than there are places to put them', () => {
        // A 3x3 with the centre and all its neighbours excluded leaves nowhere at all.
        const tiny = placeMines(createGame({ width: 3, height: 3, mineCount: 50 }), 2, 2, Math.random);
        expect(tiny.mines.size).toBe(0);
    });
});

describe('Counting neighbours', () => {
    test('corners have three, edges five, the middle eight', () => {
        const game = createGame();
        expect(neighbours(game, 1, 1)).toHaveLength(3);
        expect(neighbours(game, 5, 1)).toHaveLength(5);
        expect(neighbours(game, 5, 5)).toHaveLength(8);
    });

    test('every count matches the mines actually touching that cell', () => {
        const game = placeMines(createGame(), 5, 5, Math.random);
        for (let y = 1; y <= game.height; y++) {
            for (let x = 1; x <= game.width; x++) {
                const actual = neighbours(game, x, y).filter((n) => isMine(game, n.x, n.y)).length;
                expect(countAt(game, x, y)).toBe(actual);
            }
        }
    });

    test('the first click always opens onto empty space', () => {
        const game = placeMines(createGame(), 4, 6, Math.random);
        expect(countAt(game, 4, 6)).toBe(0);
    });
});

describe('Revealing', () => {
    test('an empty cell opens the pocket around it', () => {
        const game = reveal(createGame(), 5, 5, Math.random);
        expect(isRevealed(game, 5, 5)).toBe(true);
        expect(game.revealed.size).toBeGreaterThan(1);
    });

    test('revealing a mine ends the game', () => {
        let game = reveal(createGame(), 1, 1, Math.random);
        const [mx, my] = [...game.mines][0].split(',').map(Number);
        game = reveal(game, mx, my, Math.random);
        expect(game.status).toBe(STATUS.LOST);
        expect(isOver(game)).toBe(true);
    });

    test('a flagged cell is protected from being revealed', () => {
        let game = reveal(createGame(), 1, 1, Math.random);
        const target = hiddenCells(game)[0];
        game = toggleFlag(game, target.x, target.y);

        const before = game.revealed.size;
        game = reveal(game, target.x, target.y, Math.random);
        expect(game.revealed.size).toBe(before);
    });

    /* A cascade must not overrule a flag: the flag is the player saying "not here",
       and opening it anyway throws away their reasoning. */
    test('a cascade stops at flags', () => {
        let game = createGame();
        game = placeMines(game, 5, 5, Math.random);

        // Flag every hidden neighbour of the opening cell, then open it.
        neighbours(game, 5, 5).forEach((n) => { game = toggleFlag(game, n.x, n.y); });
        game = reveal(game, 5, 5, Math.random);

        neighbours(game, 5, 5).forEach((n) => expect(isRevealed(game, n.x, n.y)).toBe(false));
        expect(isRevealed(game, 5, 5)).toBe(true);
    });

    test('nothing happens once the game is over', () => {
        let game = reveal(createGame(), 1, 1, Math.random);
        const [mx, my] = [...game.mines][0].split(',').map(Number);
        game = reveal(game, mx, my, Math.random);

        const after = reveal(game, 5, 5, Math.random);
        expect(after.revealed.size).toBe(game.revealed.size);
    });
});

describe('Flagging', () => {
    test('a flag goes on and comes off', () => {
        let game = createGame();
        game = toggleFlag(game, 2, 3);
        expect(isFlagged(game, 2, 3)).toBe(true);
        game = toggleFlag(game, 2, 3);
        expect(isFlagged(game, 2, 3)).toBe(false);
    });

    /* The counter is flags still to place. It cannot be anything else: the game must
       not tell the player whether a flag is right, so it counts them all alike. */
    test('the counter tracks flags placed, not flags that are right', () => {
        let game = reveal(createGame(), 5, 5, Math.random);
        expect(flagsRemaining(game)).toBe(game.mineCount);

        // Deliberately a wrong flag - on a square known to be safe.
        const safe = hiddenCells(game).find((c) => !isMine(game, c.x, c.y));
        game = toggleFlag(game, safe.x, safe.y);
        expect(flagsRemaining(game)).toBe(game.mineCount - 1);
    });

    test('taking a flag back puts the count up again', () => {
        let game = createGame();
        game = toggleFlag(game, 1, 1);
        game = toggleFlag(game, 1, 1);
        expect(flagsRemaining(game)).toBe(game.mineCount);
    });

    test('a revealed cell cannot be flagged', () => {
        let game = reveal(createGame(), 5, 5, Math.random);
        game = toggleFlag(game, 5, 5);
        expect(isFlagged(game, 5, 5)).toBe(false);
    });
});

describe('Chording', () => {
    // Find a revealed number whose mines are all in its own neighbourhood.
    const findNumber = (game) => {
        for (let y = 1; y <= game.height; y++) {
            for (let x = 1; x <= game.width; x++) {
                if (isRevealed(game, x, y) && countAt(game, x, y) > 0) return { x, y };
            }
        }
        return null;
    };

    test('a satisfied number opens its remaining neighbours', () => {
        let game = reveal(createGame(), 5, 5, Math.random);
        const target = findNumber(game);
        expect(target).not.toBeNull();

        const around = neighbours(game, target.x, target.y);
        around.forEach((n) => { if (isMine(game, n.x, n.y)) game = toggleFlag(game, n.x, n.y); });

        game = chord(game, target.x, target.y, Math.random);

        // Everything that was neither mined nor flagged is now open.
        around.forEach((n) => {
            if (!isMine(game, n.x, n.y)) expect(isRevealed(game, n.x, n.y)).toBe(true);
        });
        expect(game.status).not.toBe(STATUS.LOST);
    });

    test('a number with no flags on it chords to nothing', () => {
        const game = reveal(createGame(), 5, 5, Math.random);
        const target = findNumber(game);
        expect(chord(game, target.x, target.y, Math.random).revealed.size).toBe(game.revealed.size);
    });

    /* Chording acts on what the player claimed, not on what is true, so a wrong flag
       loses the game. That is the risk that makes it worth using. */
    test('chording on a wrong flag loses', () => {
        let game = reveal(createGame(), 5, 5, Math.random);
        const target = findNumber(game);
        const around = neighbours(game, target.x, target.y);

        // Flag exactly the wrong cells: safe ones, up to the number shown.
        let placed = 0;
        around.forEach((n) => {
            if (placed < countAt(game, target.x, target.y) && !isMine(game, n.x, n.y) && !isRevealed(game, n.x, n.y)) {
                game = toggleFlag(game, n.x, n.y);
                placed++;
            }
        });

        if (placed === countAt(game, target.x, target.y)) {
            game = chord(game, target.x, target.y, Math.random);
            expect(game.status).toBe(STATUS.LOST);
        }
    });
});

describe('Winning', () => {
    /* The board has to be finished, not merely survived: every safe square open AND
       every mine flagged. Ending on the last safe square would call it a win while the
       player still had flags in hand. */
    test('clearing every safe cell is not enough on its own', () => {
        const game = clearBoard(reveal(createGame(), 5, 5, Math.random));
        expect(game.revealed.size).toBe(safeCellCount(game));
        expect(game.flagged.size).toBe(0);
        expect(game.status).toBe(STATUS.PLAYING);
    });

    test('flagging every mine is not enough on its own', () => {
        const game = flagAllMines(reveal(createGame(), 5, 5, Math.random));
        expect(game.flagged.size).toBe(game.mineCount);
        expect(game.status).toBe(STATUS.PLAYING);
    });

    test('clearing the board and flagging every mine wins', () => {
        const game = flagAllMines(clearBoard(reveal(createGame(), 5, 5, Math.random)));
        expect(game.status).toBe(STATUS.WON);
        expect(flagsRemaining(game)).toBe(0);
    });

    test('the final flag is the winning move', () => {
        let game = clearBoard(reveal(createGame(), 5, 5, Math.random));
        const mines = [...game.mines].map((k) => k.split(',').map(Number));

        mines.slice(0, -1).forEach(([x, y]) => { game = toggleFlag(game, x, y); });
        expect(game.status).toBe(STATUS.PLAYING);
        expect(flagsRemaining(game)).toBe(1);

        const [lastX, lastY] = mines[mines.length - 1];
        game = toggleFlag(game, lastX, lastY);
        expect(game.status).toBe(STATUS.WON);
    });

    /* Flags are not checked for correctness, and do not need to be: a flag can only sit
       on a hidden square, so once every safe square is open the only squares left to
       flag are mines. The right count can only mean the right flags. */
    test('a misplaced flag blocks the win by blocking the square under it', () => {
        let game = reveal(createGame(), 5, 5, Math.random);
        const safe = hiddenCells(game).find((c) => !isMine(game, c.x, c.y));
        game = toggleFlag(game, safe.x, safe.y);

        game = flagAllMines(clearBoard(game));
        expect(isRevealed(game, safe.x, safe.y)).toBe(false);
        expect(game.status).not.toBe(STATUS.WON);
    });

    test('isWon agrees with the status it produced', () => {
        const won = flagAllMines(clearBoard(reveal(createGame(), 5, 5, Math.random)));
        expect(isWon(won)).toBe(true);
        expect(isWon(createGame())).toBe(false);
    });

    test('a won game ignores further moves', () => {
        const game = flagAllMines(clearBoard(reveal(createGame(), 5, 5, Math.random)));
        const [mx, my] = [...game.mines][0].split(',').map(Number);
        expect(reveal(game, mx, my, Math.random).status).toBe(STATUS.WON);
        expect(toggleFlag(game, mx, my).flagged.size).toBe(game.flagged.size);
    });
});

/* Every function returns a new game rather than editing the one it was given. A
   cascade that half-applied itself would be miserable to debug. */
describe('State is never shared between moves', () => {
    test('revealing does not mutate the game it was given', () => {
        const game = reveal(createGame(), 5, 5, Math.random);
        const snapshot = new Set(game.revealed);
        reveal(game, 1, 1, Math.random);
        expect(game.revealed).toEqual(snapshot);
    });

    test('flagging does not mutate the game it was given', () => {
        const game = createGame();
        toggleFlag(game, 4, 4);
        expect(game.flagged.size).toBe(0);
    });
});
