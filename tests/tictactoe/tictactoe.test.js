import { describe, test, expect } from 'vitest';
import {
    MARKS,
    OPPONENTS,
    OPPONENT_WEIGHTS,
    ACCURACY,
    STATUS,
    createGame,
    turnOf,
    legalMoves,
    winnerOf,
    outcome,
    isOver,
    isPlayerTurn,
    isOpponentTurn,
    playerMove,
    opponentMove,
    pickOpponent,
    bestMoves,
    worseMoves,
    optimalMove,
    randomMove,
    emptyTally,
    recordResult,
    emptyResults,
    recordGame,
    gamesRecorded,
    canViewResults,
    RESULTS_AFTER,
} from '../../js/tictactoe.js';

const _ = null;
const { X, O } = MARKS;
const CORNERS = [0, 2, 6, 8];

// A game with a given position, for tests that start mid-game.
const withBoard = (board, options = {}) => ({ ...createGame(options), board });

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

// A whole game, with the player moving at random.
function playOut(playerMark, opponent, random) {
    let game = createGame({ playerMark, opponent });
    while (!isOver(game)) {
        game = isPlayerTurn(game)
            ? playerMove(game, randomMove(game.board, playerMark, random))
            : opponentMove(game, random);
    }
    return game;
}

const markedBy = (game, mark) => game.board.findIndex((cell) => cell === mark);

describe('The board', () => {
    test('starts empty with X to move', () => {
        const game = createGame();
        expect(game.board).toEqual(Array(9).fill(null));
        expect(turnOf(game.board)).toBe(X);
    });

    test('turn alternates by counting the marks', () => {
        expect(turnOf([X, _, _, _, _, _, _, _, _])).toBe(O);
        expect(turnOf([X, O, _, _, _, _, _, _, _])).toBe(X);
    });

    test.each([
        ['a row', [X, X, X, O, O, _, _, _, _], [0, 1, 2]],
        ['a column', [O, X, _, O, X, _, O, _, X], [0, 3, 6]],
        ['a diagonal', [X, O, _, O, X, _, _, _, X], [0, 4, 8]],
        ['the other diagonal', [X, X, O, X, O, _, O, _, _], [2, 4, 6]],
    ])('finds a win along %s', (_label, board, line) => {
        expect(winnerOf(board).line).toEqual(line);
    });

    test('a full board with no line is a draw', () => {
        const game = withBoard([X, O, X, X, O, O, O, X, X]);
        expect(outcome(game)).toEqual({ status: STATUS.DRAW, line: null });
        expect(isOver(game)).toBe(true);
    });

    test('the outcome is from the player\'s side', () => {
        const board = [X, X, X, O, O, _, _, _, _];
        expect(outcome(withBoard(board, { playerMark: X })).status).toBe(STATUS.WON);
        expect(outcome(withBoard(board, { playerMark: O })).status).toBe(STATUS.LOST);
    });
});

describe('Moves', () => {
    test('the player can move on their own turn', () => {
        const game = playerMove(createGame({ playerMark: X }), 4);
        expect(game.board[4]).toBe(X);
    });

    test('a tap on the opponent\'s turn is ignored', () => {
        const game = createGame({ playerMark: O });
        expect(isPlayerTurn(game)).toBe(false);
        expect(playerMove(game, 4)).toBe(game);
    });

    test('an occupied cell cannot be taken', () => {
        const game = withBoard([X, O, _, _, _, _, _, _, _], { playerMark: X });
        expect(playerMove(game, 1)).toBe(game);
    });

    test('nothing can be played once the game is over', () => {
        const game = withBoard([X, X, X, O, O, _, _, _, _], { playerMark: O });
        expect(playerMove(game, 5)).toBe(game);
        expect(opponentMove(game)).toBe(game);
    });

    test('the opponent only moves on its own turn', () => {
        const game = createGame({ playerMark: X, opponent: 'good' });
        expect(opponentMove(game)).toBe(game);

        const afterPlayer = playerMove(game, 0);
        expect(isOpponentTurn(afterPlayer)).toBe(true);
        const afterReply = opponentMove(afterPlayer);
        expect(afterReply.board.filter((cell) => cell === O)).toHaveLength(1);
    });

    test('the opponent opens when the player is O', () => {
        const game = opponentMove(createGame({ playerMark: O, opponent: 'perfect' }));
        expect(game.board.filter((cell) => cell === X)).toHaveLength(1);
        expect(isPlayerTurn(game)).toBe(true);
    });
});

describe('Choosing the opponent', () => {
    test('there are three: Perfect, Good and Bad', () => {
        expect(OPPONENTS).toEqual(['perfect', 'good', 'bad']);
    });

    // An evenly spread set of draws from [0, 1) lands on each exactly by its weight.
    test('they come up 20, 40 and 40 games in a hundred', () => {
        expect(OPPONENT_WEIGHTS).toEqual({ perfect: 20, good: 40, bad: 40 });
        const counts = { perfect: 0, good: 0, bad: 0 };
        spread(1000).forEach((random) => { counts[pickOpponent(random)] += 1; });
        expect(counts).toEqual({ perfect: 200, good: 400, bad: 400 });
    });

    test('and Math.random gets there too', () => {
        const counts = { perfect: 0, good: 0, bad: 0 };
        for (let i = 0; i < 50000; i++) counts[pickOpponent()] += 1;
        expect(counts.perfect).toBeGreaterThan(9400);
        expect(counts.perfect).toBeLessThan(10600);
        [counts.good, counts.bad].forEach((count) => {
            expect(count).toBeGreaterThan(19200);
            expect(count).toBeLessThan(20800);
        });
    });
});

describe('The perfect opponent', () => {
    test('takes a win when there is one', () => {
        // O to move: 2 finishes the top row, even though X is threatening 5.
        expect(bestMoves([O, O, _, X, X, _, X, _, _], O)).toEqual([2]);
    });

    test('blocks a win it cannot beat', () => {
        // O to move, X threatens 2, and O has nothing to win with.
        expect(bestMoves([X, X, _, _, O, _, _, _, _], O)).toEqual([2]);
    });

    test('wins now rather than blocking and winning later', () => {
        // X to move: 2 wins at once; 5 blocks O and keeps the game going.
        expect(bestMoves([X, X, _, O, O, _, _, _, _], X)).toEqual([2]);
    });

    /* From an empty board every move draws with best play, so all nine are equal - which
       is what keeps its first move from giving away who is playing. */
    test('treats every opening as equal, so its first move reveals nothing', () => {
        expect(bestMoves(Array(9).fill(null), X)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });

    test('picks among equally good moves at random', () => {
        const board = Array(9).fill(null);
        expect(optimalMove(board, X, () => 0)).toBe(0);
        expect(optimalMove(board, X, () => 0.99)).toBe(8);
    });

    test('never rolls a mistake', () => {
        const game = playerMove(createGame({ playerMark: X, opponent: 'perfect' }), 4);
        expect(CORNERS).toContain(markedBy(opponentMove(game, () => 0.99), O));
    });

    /* The property that matters, checked exhaustively: every line the player could take,
       against every move the perfect opponent could choose, from both sides of the board.
       It never loses. */
    test.each([X, O])('never loses, whatever the player does (player is %s)', (playerMark) => {
        let losses = 0;
        let games = 0;

        const explore = (game) => {
            if (isOver(game)) {
                games += 1;
                if (outcome(game).status === STATUS.WON) losses += 1;
                return;
            }
            if (isPlayerTurn(game)) {
                legalMoves(game.board).forEach((cell) => explore(playerMove(game, cell)));
            } else {
                const mark = turnOf(game.board);
                bestMoves(game.board, mark).forEach((cell) => {
                    const board = [...game.board];
                    board[cell] = mark;
                    explore({ ...game, board });
                });
            }
        };

        explore(createGame({ playerMark, opponent: 'perfect' }));
        expect(games).toBeGreaterThan(0);
        expect(losses).toBe(0);
    });
});

describe('Good and Bad opponents', () => {
    // X has taken the centre and O is to move.
    const CENTRE_TAKEN = [_, _, _, _, X, _, _, _, _];

    test('play the best move 100, 70 and 30 percent of the time', () => {
        expect(ACCURACY).toEqual({ perfect: 1, good: 0.7, bad: 0.3 });
    });

    // Against the centre, a corner holds the draw and an edge loses.
    test('know a mistake when there is one', () => {
        expect(bestMoves(CENTRE_TAKEN, O)).toEqual(CORNERS);
        expect(worseMoves(CENTRE_TAKEN, O)).toEqual([1, 3, 5, 7]);
    });

    test('a rolled mistake can be any worse move', () => {
        const game = playerMove(createGame({ playerMark: X, opponent: 'bad' }), 4);
        const replies = new Set(spread(4).map((pickFrom) =>
            markedBy(opponentMove(game, scripted(0.99, pickFrom())), O)));
        expect([...replies].sort()).toEqual([1, 3, 5, 7]);
    });

    test.each([['good', 0.7], ['bad', 0.3]])('%s answers the centre with a corner about %s of the time', (opponent, rate) => {
        const random = seeded(opponent.length * 17);
        const game = playerMove(createGame({ playerMark: X, opponent }), 4);
        const trials = 4000;
        let corners = 0;
        for (let i = 0; i < trials; i++) {
            if (CORNERS.includes(markedBy(opponentMove(game, random), O))) corners += 1;
        }
        expect(corners / trials).toBeGreaterThan(rate - 0.03);
        expect(corners / trials).toBeLessThan(rate + 0.03);
    });

    /* O to move, and every move loses: anywhere but 2 and X wins at once; 2 lets X fork
       from the centre. With every result the same there is no mistake to make, so even Bad
       plays the best move - the slowest loss - and spends no roll on it. */
    test('where every move leads to the same result, even Bad plays the best one', () => {
        const game = withBoard([X, X, _, O, _, _, _, _, _], { playerMark: X, opponent: 'bad' });
        expect(worseMoves(game.board, O)).toEqual([]);
        expect(bestMoves(game.board, O)).toEqual([2]);
        expect(opponentMove(game, () => 0.99).board[2]).toBe(O);
    });

    test('and an empty board has no mistake in it at all', () => {
        expect(worseMoves(Array(9).fill(null), X)).toEqual([]);
    });
});

describe('The session tally', () => {
    test('counts a finished game by its outcome', () => {
        let tally = emptyTally();
        tally = recordResult(tally, withBoard([X, X, X, O, O, _, _, _, _], { playerMark: X }));
        tally = recordResult(tally, withBoard([X, X, X, O, O, _, _, _, _], { playerMark: O }));
        tally = recordResult(tally, withBoard([X, O, X, X, O, O, O, X, X]));
        expect(tally).toEqual({ won: 1, drawn: 1, lost: 1 });
    });

    test('ignores a game still in play', () => {
        const tally = emptyTally();
        expect(recordResult(tally, createGame())).toBe(tally);
    });
});

describe('Winnable games', () => {
    test('a game starts not winnable', () => {
        expect(createGame().winnable).toBe(false);
    });

    // X takes the centre; Bad rolls a mistake and answers on an edge, which loses.
    test('an opponent\'s mistake that hands over a win marks the game', () => {
        const game = playerMove(createGame({ playerMark: X, opponent: 'bad' }), 4);
        const handed = opponentMove(game, scripted(0.99, 0));
        expect(handed.board[1]).toBe(O);
        expect(handed.winnable).toBe(true);
    });

    // The column counts chances, not conversions.
    test('and it stays marked when the win is thrown away', () => {
        const game = playerMove(createGame({ playerMark: X, opponent: 'bad' }), 4);
        const thrown = playerMove(opponentMove(game, scripted(0.99, 0)), 2);
        expect(thrown.winnable).toBe(true);
    });

    test('a drawn position does not mark it', () => {
        const game = opponentMove(playerMove(createGame({ playerMark: X, opponent: 'perfect' }), 4), () => 0);
        expect(game.winnable).toBe(false);
    });

    test.each([X, O])('the perfect opponent never hands one over (player is %s)', (playerMark) => {
        const random = seeded(playerMark === X ? 11 : 12);
        for (let g = 0; g < 200; g++) {
            expect(playOut(playerMark, 'perfect', random).winnable).toBe(false);
        }
    });

    test('Good and Bad do', () => {
        const random = seeded(13);
        ['good', 'bad'].forEach((opponent) => {
            const handed = Array.from({ length: 100 }, () => playOut(X, opponent, random))
                .filter((game) => game.winnable);
            expect(handed.length).toBeGreaterThan(0);
        });
    });

    // A win is always reached from a won position, so won can never exceed winnable.
    test('every game won was winnable', () => {
        const random = seeded(14);
        for (let g = 0; g < 300; g++) {
            const game = playOut(g % 2 ? X : O, OPPONENTS[g % 3], random);
            if (outcome(game).status === STATUS.WON) expect(game.winnable).toBe(true);
        }
    });
});

describe('Results', () => {
    const finished = (opponent, status, winnable = false) => ({ opponent, status, winnable });

    test('are counted per opponent', () => {
        let results = emptyResults();
        results = recordGame(results, finished('perfect', STATUS.DRAW));
        results = recordGame(results, finished('bad', STATUS.WON, true));
        results = recordGame(results, finished('bad', STATUS.LOST, true));
        results = recordGame(results, finished('good', STATUS.LOST));
        expect(results).toEqual({
            perfect: { played: 1, won: 0, drawn: 1, winnable: 0 },
            good: { played: 1, won: 0, drawn: 0, winnable: 0 },
            bad: { played: 2, won: 1, drawn: 0, winnable: 2 },
        });
        expect(gamesRecorded(results)).toBe(4);
    });

    test('ignore a game still in play', () => {
        const results = emptyResults();
        expect(recordGame(results, finished('good', STATUS.PLAYING))).toBe(results);
    });

    test('can be viewed once five games are finished, and not before', () => {
        expect(RESULTS_AFTER).toBe(5);
        let results = emptyResults();
        for (let i = 0; i < RESULTS_AFTER; i++) {
            expect(canViewResults(results)).toBe(false);
            results = recordGame(results, finished(OPPONENTS[i % 3], STATUS.DRAW));
        }
        expect(canViewResults(results)).toBe(true);
    });
});
