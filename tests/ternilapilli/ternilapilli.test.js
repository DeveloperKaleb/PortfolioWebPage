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
    worseMoves,
    randomMove,
    emptyTally,
    recordResult,
    otherMark,
    isPlayerTurn,
    isOpponentTurn,
    emptyPassTally,
    recordPassResult,
    playerNumberOf,
} from '../../js/ternilapilli.js';

const _ = null;
const { X, O } = MARKS;
const EMPTY = Array(9).fill(null);
const CORNERS = [0, 2, 6, 8];

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

// A random source that hands back exactly these values, in order.
const scripted = (...values) => {
    let i = 0;
    return () => values[i++];
};

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

const openingOf = (game) => game.board.findIndex((cell) => cell === X);

/* A movement-phase position with nobody threatening anything: X on 0, 2 and 7, O on 1, 6
   and 8, X to move. */
const QUIET = [X, O, X, _, _, _, O, X, O];

/* The Tic-Tac-Toe view swaps between the two modules without asking which it has, so
   anything it calls has to exist on both - a gap would only show up as a thrown error in
   the browser, mid-game. */
describe('Classic and Terni Lapilli answer the same questions', () => {
    const asked = ['createGame', 'outcome', 'isOver', 'isPlayerTurn', 'isOpponentTurn',
        'playerMove', 'opponentMove', 'pickOpponent', 'emptyTally', 'recordResult', 'prepare',
        'emptyPassTally', 'recordPassResult', 'playerNumberOf'];

    test.each(asked)('both provide %s', (name) => {
        expect(typeof Classic[name]).toBe('function');
        expect(typeof Terni[name]).toBe('function');
    });

    test('and play with the same opponents at the same accuracy', () => {
        expect(Terni.OPPONENTS).toBe(Classic.OPPONENTS);
        expect(Terni.ACCURACY).toBe(Classic.ACCURACY);
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
        expect(outcome(after)).toEqual({ status: STATUS.WON, line: [0, 1, 2], winner: X, repeated: false });
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
        expect(outcome(game)).toEqual({ status: STATUS.DRAW, line: null, winner: null, repeated: true });
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

describe('The perfect opponent', () => {
    /* The results the rules were chosen from - see NOTES.md. With the centre banned on the
       first move it is a draw; an edge opening loses; a corner opening draws. */
    test('the solve agrees with what the rules were chosen from', () => {
        expect(evaluate(EMPTY, X).result).toBe('draw');
        expect(evaluate([_, X, _, _, _, _, _, _, _], O).result).toBe('win');
        expect(evaluate([X, _, _, _, _, _, _, _, _], O).result).toBe('draw');
    });

    test('opens in a corner - any corner', () => {
        expect(tos(bestMoves(EMPTY, X))).toEqual(CORNERS);
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
       has no end. Every move the player could make, against every move the perfect
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

describe('Good and Bad opponents', () => {
    // Corners draw and edges lose, so an edge opening is the first mistake there is.
    test('know a mistake when there is one', () => {
        expect(tos(worseMoves(EMPTY, X))).toEqual([1, 3, 5, 7]);
    });

    test('a rolled mistake can be any worse move', () => {
        const game = createGame({ playerMark: O, opponent: 'bad' });
        const openings = new Set(spread(4).map((pickFrom) =>
            openingOf(opponentMove(game, scripted(0.99, pickFrom())))));
        expect([...openings].sort()).toEqual([1, 3, 5, 7]);
    });

    test('Perfect never rolls one', () => {
        const game = createGame({ playerMark: O, opponent: 'perfect' });
        expect(CORNERS).toContain(openingOf(opponentMove(game, () => 0.99)));
    });

    test.each([['good', 0.7], ['bad', 0.3]])('%s opens in a corner about %s of the time', (opponent, rate) => {
        const random = seeded(opponent.length * 31);
        const game = createGame({ playerMark: O, opponent });
        const trials = 4000;
        let corners = 0;
        for (let i = 0; i < trials; i++) {
            if (CORNERS.includes(openingOf(opponentMove(game, random)))) corners += 1;
        }
        expect(corners / trials).toBeGreaterThan(rate - 0.03);
        expect(corners / trials).toBeLessThan(rate + 0.03);
    });

    /* A position where every move leads to the same result, but not at the same distance,
       has no mistake in it - so even Bad plays one of the best moves there, and spends no
       roll doing it. */
    test('where every move leads to the same result, even Bad plays a best move', () => {
        const flat = reachable().find(({ board, turn }) =>
            !winnerOf(board)
            && worseMoves(board, turn).length === 0
            && bestMoves(board, turn).length < legalMoves(board, turn).length);
        expect(flat).toBeDefined();

        const game = withPosition(flat.board, flat.turn, { playerMark: otherMark(flat.turn), opponent: 'bad' });
        const played = opponentMove(game, () => 0.99);
        const bestBoards = bestMoves(flat.board, flat.turn).map((move) => applyMove(flat.board, flat.turn, move));
        expect(bestBoards).toContainEqual(played.board);
    });
});

/* Whole games against each opponent, from both sides, with a player moving at random.
   Every move either side makes has to be legal, and the perfect opponent never loses. */
describe('Playing it out', () => {
    test.each(['perfect', 'good', 'bad'])('against the %s opponent', (opponent) => {
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
                if (opponent === 'perfect') expect(outcome(game).status).not.toBe(STATUS.WON);
            }
        });
        // The perfect opponent never hands the player a forced win; Good and Bad do.
        if (opponent === 'perfect') expect(handed).toBe(0);
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
        const game = withPosition([X, X, _, O, O, X, O, _, _], O, { playerMark: X, opponent: 'good' });
        const handed = makeMove(game, { from: 4, to: 8 });
        expect(handed.board).toEqual([X, X, _, O, _, X, O, _, O]);
        expect(handed.winnable).toBe(true);
    });
});

describe('Pass the phone', () => {
    test('either side can move, and no opponent ever does', () => {
        let game = createGame({ players: 2 });
        expect(game.opponent).toBeNull();

        game = playerMove(game, { from: null, to: 0 });
        expect(isPlayerTurn(game)).toBe(true);
        expect(isOpponentTurn(game)).toBe(false);

        game = playerMove(game, { from: null, to: 4 });
        expect(game.board[0]).toBe(X);
        expect(game.board[4]).toBe(O);
        expect(opponentMove(game)).toBe(game);
    });

    /* The centre ban is for playing the computer: it hid the perfect opponent's opening
       and took the edge off moving first. Two people on one phone swap who goes first
       every game and have no opponent to hide, so pass the phone allows it. */
    test('the centre is allowed on the first move', () => {
        const game = playerMove(createGame({ players: 2 }), { from: null, to: CENTRE });
        expect(game.board[CENTRE]).toBe(X);
        expect(tos(legalMoves(EMPTY, X, { centreBan: false }))).toContain(CENTRE);
    });

    test('while single player still refuses it', () => {
        const game = createGame({ playerMark: X, opponent: 'good' });
        expect(game.centreBan).toBe(true);
        expect(playerMove(game, { from: null, to: CENTRE })).toBe(game);
    });

    // Player 1 holds O this game, so X's win is Player 2's.
    test('the winner is reported by mark, and credited to whoever held it', () => {
        const game = withPosition([X, X, _, O, _, X, O, _, O], X, { players: 2, playerMark: O });
        const after = playerMove(game, { from: 5, to: 2 });
        expect(outcome(after).winner).toBe(X);
        expect(playerNumberOf(after, X)).toBe(2);
        expect(recordPassResult(emptyPassTally(), after)).toEqual({ one: 0, two: 1, drawn: 0 });
    });

    test('a repetition draw is counted as a draw', () => {
        const lap = [{ from: 0, to: 3 }, { from: 8, to: 5 }, { from: 3, to: 0 }, { from: 5, to: 8 }];
        let game = withPosition(QUIET, X, { players: 2 });
        [...lap, ...lap].forEach((move) => { game = playerMove(game, move); });
        expect(recordPassResult(emptyPassTally(), game)).toEqual({ one: 0, two: 0, drawn: 1 });
    });

    // The same failed block that marks a game against a computer marks nothing here.
    test('never marks a game winnable', () => {
        const game = withPosition([X, X, _, O, O, X, O, _, _], O, { players: 2 });
        expect(makeMove(game, { from: 4, to: 8 }).winnable).toBe(false);
    });
});
