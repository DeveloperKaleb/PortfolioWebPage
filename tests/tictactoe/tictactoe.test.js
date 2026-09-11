import { describe, test, expect } from 'vitest';
import {
    MARKS,
    OPPONENTS,
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
    completingMoves,
    optimalMove,
    randomMove,
    blunderingMove,
    emptyTally,
    recordResult,
} from '../../js/tictactoe.js';

const _ = null;
const { X, O } = MARKS;

// A game with a given position, for tests that start mid-game.
const withBoard = (board, options = {}) => ({ ...createGame(options), board });

// Every value an evenly spread random source would give over n draws.
const spread = (n) => Array.from({ length: n }, (_unused, i) => () => i / n);

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
        const game = createGame({ playerMark: X, opponent: 'random' });
        expect(opponentMove(game)).toBe(game);

        const afterPlayer = playerMove(game, 0);
        expect(isOpponentTurn(afterPlayer)).toBe(true);
        const afterReply = opponentMove(afterPlayer);
        expect(afterReply.board.filter((cell) => cell === O)).toHaveLength(1);
    });

    test('the opponent opens when the player is O', () => {
        const game = opponentMove(createGame({ playerMark: O, opponent: 'optimal' }));
        expect(game.board.filter((cell) => cell === X)).toHaveLength(1);
        expect(isPlayerTurn(game)).toBe(true);
    });
});

describe('Choosing the opponent', () => {
    test('there are exactly three', () => {
        expect(OPPONENTS).toEqual(['optimal', 'bad', 'random']);
    });

    // An evenly spread set of draws from [0, 1) lands exactly a third on each.
    test('each is picked a third of the time', () => {
        const counts = { optimal: 0, bad: 0, random: 0 };
        spread(3000).forEach((random) => { counts[pickOpponent(random)] += 1; });
        expect(counts).toEqual({ optimal: 1000, bad: 1000, random: 1000 });
    });

    test('and Math.random gets there too', () => {
        const counts = { optimal: 0, bad: 0, random: 0 };
        for (let i = 0; i < 30000; i++) counts[pickOpponent()] += 1;
        Object.values(counts).forEach((count) => {
            expect(count).toBeGreaterThan(9400);
            expect(count).toBeLessThan(10600);
        });
    });
});

describe('The optimal opponent', () => {
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

    /* The property that matters, checked exhaustively: every line the player could take,
       against every move the optimal opponent could choose, from both sides of the board.
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

        explore(createGame({ playerMark, opponent: 'optimal' }));
        expect(games).toBeGreaterThan(0);
        expect(losses).toBe(0);
    });
});

describe('The random opponent', () => {
    test('can play any open cell', () => {
        const board = [X, _, O, _, X, _, _, _, _];
        const chosen = new Set(spread(6).map((random) => randomMove(board, O, random)));
        expect([...chosen].sort()).toEqual(legalMoves(board));
    });

    test('does not steer away from a win', () => {
        // O to move; 2 wins. The random player can land on it like anywhere else.
        const board = [O, O, _, X, X, _, X, _, _];
        expect(randomMove(board, O, () => 0)).toBe(2);
    });
});

describe('The deliberately bad opponent', () => {
    test('passes up a win', () => {
        // O to move: 2 wins for O. (X also threatens 7, which it will not block either.)
        const board = [O, O, _, X, _, _, X, _, X];
        spread(20).forEach((random) => {
            expect(blunderingMove(board, O, random)).not.toBe(2);
        });
    });

    test('never blocks the player', () => {
        // O to move, X threatens 2, O has no win of its own.
        const board = [X, X, _, _, O, _, _, _, _];
        spread(20).forEach((random) => {
            expect(blunderingMove(board, O, random)).not.toBe(2);
        });
    });

    test('avoids both at once', () => {
        // O to move: O wins at 2; X threatens 5 (middle row) and 2 (the diagonal).
        const board = [O, O, _, X, X, _, X, _, _];
        spread(20).forEach((random) => {
            expect([7, 8]).toContain(blunderingMove(board, O, random));
        });
    });

    test('otherwise plays at random, reaching every other cell', () => {
        const board = [X, X, _, _, O, _, _, _, _];
        const chosen = new Set(spread(50).map((random) => blunderingMove(board, O, random)));
        expect([...chosen].sort()).toEqual([3, 5, 6, 7, 8]);
    });

    /* Forced: the only open cell completes a line. There is no other legal move, so it
       has to play it - a player who will not finish their own line can still lose. */
    test('plays a win when nothing else is left', () => {
        // X to move, and 8 completes the diagonal.
        const board = [X, O, X, O, X, O, O, X, _];
        expect(completingMoves(board, X)).toEqual([8]);
        expect(blunderingMove(board, X, () => 0.5)).toBe(8);
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
