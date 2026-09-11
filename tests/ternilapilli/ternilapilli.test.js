import { describe, test, expect } from 'vitest';
import * as Classic from '../../js/tictactoe.js';
import * as Terni from '../../js/ternilapilli.js';
import { winnerOf } from '../../js/tictactoe.js';
import {
    MARKS,
    STATUS,
    NEIGHBOURS,
    CENTRE,
    createGame,
    legalMoves,
    applyMove,
    makeMove,
    playerMove,
    opponentMove,
    movesFrom,
    isPlacing,
    outcome,
    isOver,
    timesSeen,
    positionKey,
    evaluate,
    bestMoves,
    randomMove,
    blunderingMove,
    winningMoves,
    pickOpponent,
    emptyTally,
    recordResult,
    otherMark,
} from '../../js/ternilapilli.js';

const _ = null;
const { X, O } = MARKS;
const EMPTY = Array(9).fill(null);

// A game at a given position, as if it had just arisen for the first time.
const withPosition = (board, turn, options = {}) => ({
    ...createGame(options),
    board,
    turn,
    seen: { [positionKey(board, turn)]: 1 },
});

const tos = (moves) => moves.map((move) => move.to);

// Every value an evenly spread random source would give over n draws.
const spread = (n) => Array.from({ length: n }, (_unused, i) => () => i / n);

// A small seeded generator, so the playouts below are the same on every run.
const seeded = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Every position reachable from the start by any moves at all.
function reachable() {
    const found = new Map();
    const queue = [[EMPTY, X]];
    for (let i = 0; i < queue.length; i++) {
        const [board, turn] = queue[i];
        const key = positionKey(board, turn);
        if (found.has(key)) continue;
        found.set(key, { board, turn });
        if (winnerOf(board)) continue;
        legalMoves(board, turn).forEach((move) => queue.push([applyMove(board, turn, move), otherMark(turn)]));
    }
    return [...found.values()];
}

/* A movement-phase position with nobody threatening anything: X on 0, 2 and 7, O on 1, 6
   and 8, X to move. */
const QUIET = [X, O, X, _, _, _, O, X, O];

/* The Tic-Tac-Toe view swaps between the two modules without asking which it has, so
   anything it calls has to exist on both - a gap would only show up as a thrown error in
   the browser, mid-game. prepare() matters most: without it the optimal opponent's first
   reply carries the whole search, and arrives late enough to give it away. */
describe('Classic and Terni Lapilli answer the same questions', () => {
    const asked = ['createGame', 'outcome', 'isOver', 'isPlayerTurn', 'isOpponentTurn',
        'playerMove', 'opponentMove', 'pickOpponent', 'emptyTally', 'recordResult', 'prepare'];

    test.each(asked)('both provide %s', (name) => {
        expect(typeof Classic[name]).toBe('function');
        expect(typeof Terni[name]).toBe('function');
    });
});

describe('The board', () => {
    test('the eight lines give each point its neighbours', () => {
        expect(NEIGHBOURS[CENTRE]).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
        expect(NEIGHBOURS[0]).toEqual([1, 3, 4]);
        expect(NEIGHBOURS[8]).toEqual([4, 5, 7]);
    });

    // No line runs between two edge points, so neither can step to the other.
    test('an edge point reaches its corners and the centre, not the other edges', () => {
        expect(NEIGHBOURS[1]).toEqual([0, 2, 4]);
        expect(NEIGHBOURS[3]).toEqual([0, 4, 6]);
    });
});

describe('Placing', () => {
    test('the first piece cannot go in the centre', () => {
        expect(tos(legalMoves(EMPTY, X))).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
        const game = createGame({ playerMark: X });
        expect(playerMove(game, { from: null, to: CENTRE })).toBe(game);
    });

    test('the second player may take it', () => {
        expect(tos(legalMoves([X, _, _, _, _, _, _, _, _], O))).toContain(CENTRE);
    });

    test('a line made while placing wins', () => {
        const game = withPosition([X, X, _, O, O, _, _, _, _], X, { playerMark: X });
        expect(outcome(playerMove(game, { from: null, to: 2 })).status).toBe(STATUS.WON);
    });

    test('with three pieces each down, every move is a step', () => {
        expect(isPlacing(QUIET, X)).toBe(false);
        expect(legalMoves(QUIET, X).every((move) => move.from !== null)).toBe(true);
    });
});

describe('Moving', () => {
    test('a piece steps one point along a line, onto an empty point', () => {
        expect(legalMoves(QUIET, X)).toEqual([
            { from: 0, to: 3 }, { from: 0, to: 4 },
            { from: 2, to: 4 }, { from: 2, to: 5 },
            { from: 7, to: 4 },
        ]);
    });

    test('a jump, or moving the other side\'s piece, is refused', () => {
        const game = withPosition(QUIET, X, { playerMark: X });
        expect(playerMove(game, { from: 7, to: 3 })).toBe(game);
        expect(playerMove(game, { from: 1, to: 3 })).toBe(game);
    });

    test('lists where one piece can go', () => {
        expect(movesFrom(withPosition(QUIET, X), 2)).toEqual([4, 5]);
    });

    test('a line made while moving wins', () => {
        const game = withPosition([X, X, _, O, _, X, O, _, O], X, { playerMark: X });
        const after = playerMove(game, { from: 5, to: 2 });
        expect(outcome(after)).toEqual({ status: STATUS.WON, line: [0, 1, 2], repeated: false });
    });
});

describe('Endless games', () => {
    // X and O each step out and back; after two laps the position has come up three times.
    test('the same position a third time is a draw', () => {
        const lap = [{ from: 0, to: 3 }, { from: 8, to: 5 }, { from: 3, to: 0 }, { from: 5, to: 8 }];
        let game = withPosition(QUIET, X, { playerMark: X });

        lap.forEach((move) => { game = makeMove(game, move); });
        expect(timesSeen(game)).toBe(2);
        expect(isOver(game)).toBe(false);

        lap.forEach((move) => { game = makeMove(game, move); });
        expect(outcome(game)).toEqual({ status: STATUS.DRAW, line: null, repeated: true });
        expect(recordResult(emptyTally(), game)).toEqual({ won: 0, drawn: 1, lost: 0 });
    });

    /* Why there is no rule for a side that cannot move: it cannot happen. All three of a
       player's pieces are only hemmed in when the three opposing pieces make a line, and
       by then the game is over. */
    test('nobody is ever left without a move unless the game is already won', () => {
        const stuck = reachable().filter(({ board, turn }) => !winnerOf(board) && legalMoves(board, turn).length === 0);
        expect(stuck).toEqual([]);
    });
});

describe('Choosing the opponent', () => {
    test('each is picked a third of the time', () => {
        const counts = { optimal: 0, bad: 0, random: 0 };
        spread(3000).forEach((random) => { counts[pickOpponent(random)] += 1; });
        expect(counts).toEqual({ optimal: 1000, bad: 1000, random: 1000 });
    });
});

describe('The optimal opponent', () => {
    /* The results the rules were chosen from - see NOTES.md. With the centre banned on the
       first move it is a draw; an edge opening loses; a corner opening draws. */
    test('the solve agrees with what the rules were chosen from', () => {
        expect(evaluate(EMPTY, X).result).toBe('draw');
        expect(evaluate([_, X, _, _, _, _, _, _, _], O).result).toBe('win');
        expect(evaluate([X, _, _, _, _, _, _, _, _], O).result).toBe('draw');
    });

    test('opens in a corner - any corner', () => {
        expect(tos(bestMoves(EMPTY, X))).toEqual([0, 2, 6, 8]);
    });

    test('takes a win that is there', () => {
        expect(bestMoves([X, X, _, O, _, X, O, _, O], X)).toEqual([{ from: 5, to: 2 }]);
    });

    /* From every position the solve calls won, each best move reaches a lost position one
       move nearer the end. That is what keeps a winning line from ever repeating, and so
       what stops the repetition rule rescuing the side that is losing. */
    test('always makes progress on a win', () => {
        const won = reachable().filter(({ board, turn }) => !winnerOf(board) && evaluate(board, turn).result === 'win');
        expect(won.length).toBeGreaterThan(0);
        won.forEach(({ board, turn }) => {
            const { depth } = evaluate(board, turn);
            bestMoves(board, turn).forEach((move) => {
                expect(evaluate(applyMove(board, turn, move), otherMark(turn))).toEqual({ result: 'loss', depth: depth - 1 });
            });
        });
    });

    /* Exhaustive over positions rather than games - positions repeat, so a tree of games
       has no end. Every move the player could make, against every move the optimal
       opponent could choose, from both sides: no position reached has a line for the
       player. */
    test.each([X, O])('never loses, whatever the player does (player is %s)', (playerMark) => {
        const seen = new Set();
        const queue = [[EMPTY, X]];
        let playerLines = 0;

        for (let i = 0; i < queue.length; i++) {
            const [board, turn] = queue[i];
            const key = positionKey(board, turn);
            if (seen.has(key)) continue;
            seen.add(key);

            const win = winnerOf(board);
            if (win) {
                if (win.mark === playerMark) playerLines += 1;
                continue;
            }
            const moves = turn === playerMark ? legalMoves(board, turn) : bestMoves(board, turn);
            moves.forEach((move) => queue.push([applyMove(board, turn, move), otherMark(turn)]));
        }

        expect(seen.size).toBeGreaterThan(100);
        expect(playerLines).toBe(0);
    });
});

describe('The random opponent', () => {
    test('can play any legal move', () => {
        const chosen = new Set(spread(5).map((random) => JSON.stringify(randomMove(QUIET, X, random))));
        expect(chosen.size).toBe(legalMoves(QUIET, X).length);
    });
});

describe('The deliberately bad opponent', () => {
    test('passes up a win', () => {
        const board = [X, X, _, O, _, X, O, _, O];
        spread(20).forEach((random) => {
            expect(blunderingMove(board, X, random)).not.toEqual({ from: 5, to: 2 });
        });
    });

    test('never blocks the player', () => {
        // X to move, two pieces each: O threatens 0, which X is free to take.
        const board = [_, X, _, _, O, X, _, _, O];
        expect(tos(winningMoves(board, O))).toEqual([0]);
        expect(tos(legalMoves(board, X))).toContain(0);
        spread(20).forEach((random) => {
            expect(blunderingMove(board, X, random).to).not.toBe(0);
        });
    });
});

/* Whole games against each opponent, from both sides, with a player moving at random.
   Every move either side makes has to be legal, and the optimal opponent never loses. */
describe('Playing it out', () => {
    test.each(['optimal', 'bad', 'random'])('against the %s opponent', (opponent) => {
        const random = seeded(opponent.length * 7919);
        let handed = 0;
        [X, O].forEach((playerMark) => {
            for (let g = 0; g < 25; g++) {
                let game = createGame({ playerMark, opponent });
                for (let ply = 0; ply < 400 && !isOver(game); ply++) {
                    const next = game.turn === playerMark
                        ? playerMove(game, randomMove(game.board, game.turn, random))
                        : opponentMove(game, random);
                    expect(next).not.toBe(game);
                    game = next;
                }
                if (game.winnable) handed += 1;
                if (outcome(game).status === STATUS.WON) expect(game.winnable).toBe(true);
                if (opponent === 'optimal') expect(outcome(game).status).not.toBe(STATUS.WON);
            }
        });
        // The perfect opponent never hands the player a forced win; the other two do.
        if (opponent === 'optimal') expect(handed).toBe(0);
        else expect(handed).toBeGreaterThan(0);
    });
});

describe('Winnable games', () => {
    test('a game starts not winnable', () => {
        expect(createGame().winnable).toBe(false);
    });

    /* O to move, and only 4 to 2 stops X finishing the top row with 5 to 2. Stepping 4 to 8
       instead hands the win over. */
    test('the opponent failing to block marks the game', () => {
        const game = withPosition([X, X, _, O, O, X, O, _, _], O, { playerMark: X, opponent: 'random' });
        const handed = makeMove(game, { from: 4, to: 8 });
        expect(handed.board).toEqual([X, X, _, O, _, X, O, _, O]);
        expect(handed.winnable).toBe(true);
    });
});
