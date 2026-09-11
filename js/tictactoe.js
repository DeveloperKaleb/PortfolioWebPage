/* Tic-Tac-Toe: the rules and the three opponents, with no DOM and no timers.
 *
 * Immutable like js/minesweeper.js and js/sequence.js - every function returns a new
 * game - so a test can hold a position and try every continuation from it.
 *
 * The board is nine cells in reading order, 0 top-left to 8 bottom-right, each null,
 * 'X' or 'O'. X always moves first. Whose turn it is is worked out from the counts
 * rather than stored, so it cannot drift out of step with the board.
 *
 * The opponent is picked at random per game and is never shown to the player - see
 * NOTES.md. Nothing in this file leaks which one is playing, and the DOM layer has to
 * keep it that way: the same delay before every reply, the same messages whoever is on
 * the other side.
 */

export const MARKS = { X: 'X', O: 'O' };

export const OPPONENTS = ['optimal', 'bad', 'random'];

export const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6],            // diagonals
];

export const STATUS = {
    PLAYING: 'playing',
    WON: 'won',   // the player won
    LOST: 'lost', // the opponent won
    DRAW: 'draw',
};

export const otherMark = (mark) => (mark === MARKS.X ? MARKS.O : MARKS.X);

export function createGame({ playerMark = MARKS.X, opponent = 'random' } = {}) {
    return {
        board: Array(9).fill(null),
        playerMark,
        opponent,
    };
}

export const opponentMark = (game) => otherMark(game.playerMark);

export function turnOf(board) {
    const xs = board.filter((cell) => cell === MARKS.X).length;
    const os = board.filter((cell) => cell === MARKS.O).length;
    return xs === os ? MARKS.X : MARKS.O;
}

export const legalMoves = (board) =>
    board.flatMap((cell, index) => (cell === null ? [index] : []));

// The completed line and whose it is, or null. A legal game can only ever have one.
export function winnerOf(board) {
    for (const line of LINES) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { mark: board[a], line };
        }
    }
    return null;
}

const isFull = (board) => board.every((cell) => cell !== null);

/* The result from the player's side of the board. `line` is the winning line when
   there is one, so the DOM layer can strike through it. */
export function outcome(game) {
    const win = winnerOf(game.board);
    if (win) {
        return { status: win.mark === game.playerMark ? STATUS.WON : STATUS.LOST, line: win.line };
    }
    return { status: isFull(game.board) ? STATUS.DRAW : STATUS.PLAYING, line: null };
}

export const isOver = (game) => outcome(game).status !== STATUS.PLAYING;

export const isPlayerTurn = (game) => !isOver(game) && turnOf(game.board) === game.playerMark;

export const isOpponentTurn = (game) => !isOver(game) && turnOf(game.board) === opponentMark(game);

// Put the mark whose turn it is on a cell. Anything illegal hands back the same game.
function place(game, cell) {
    if (isOver(game)) return game;
    if (!Number.isInteger(cell) || cell < 0 || cell > 8) return game;
    if (game.board[cell] !== null) return game;

    const board = [...game.board];
    board[cell] = turnOf(game.board);
    return { ...game, board };
}

// A tap from the player. Taps on the opponent's turn are ignored, not queued.
export function playerMove(game, cell) {
    return isPlayerTurn(game) ? place(game, cell) : game;
}

/* --- The opponents --- */

const pick = (options, random) => options[Math.floor(random() * options.length)];

/* One of the three, each a third of the time. */
export const pickOpponent = (random = Math.random) => pick(OPPONENTS, random);

/* Minimax, scored from `mark`'s side: a win is worth more the sooner it comes and a loss
 * costs less the later it comes. Without the depth term every forced win looks the same,
 * and a perfect player would happily dawdle - which reads as a mistake to a person
 * watching, even though it is not one.
 *
 * Memoised on the board. There are only a few thousand reachable positions, so after the
 * first search every reply is a lookup. */
const scoreCache = new Map();

function score(board, mark) {
    const key = board.map((cell) => cell || '-').join('') + mark;
    if (scoreCache.has(key)) return scoreCache.get(key);

    const win = winnerOf(board);
    const empty = legalMoves(board).length;
    let value;

    if (win) {
        // The mark that just moved won. Fewer empty squares means it took longer.
        value = (win.mark === mark ? 1 : -1) * (empty + 1);
    } else if (empty === 0) {
        value = 0;
    } else {
        const toMove = turnOf(board);
        const results = legalMoves(board).map((cell) => {
            const next = [...board];
            next[cell] = toMove;
            return score(next, mark);
        });
        value = toMove === mark ? Math.max(...results) : Math.min(...results);
    }

    scoreCache.set(key, value);
    return value;
}

/* Every move a perfect player could make here, not just one of them. The optimal
   opponent picks among these at random, so it does not play the same game every time -
   and, from an empty board, where every move draws with best play, its first move tells
   the player nothing about who they are up against. */
export function bestMoves(board, mark = turnOf(board)) {
    const scored = legalMoves(board).map((cell) => {
        const next = [...board];
        next[cell] = mark;
        return { cell, value: score(next, mark) };
    });
    const top = Math.max(...scored.map((move) => move.value));
    return scored.filter((move) => move.value === top).map((move) => move.cell);
}

// Cells that would complete a line for `mark` right now.
export function completingMoves(board, mark) {
    return legalMoves(board).filter((cell) => {
        const next = [...board];
        next[cell] = mark;
        return winnerOf(next)?.mark === mark;
    });
}

export const optimalMove = (board, mark, random = Math.random) => pick(bestMoves(board, mark), random);

export const randomMove = (board, _mark, random = Math.random) => pick(legalMoves(board), random);

/* The deliberately bad player: random, except it never takes a win that is sitting there
 * and never blocks one of yours. Those are the two moves anyone would spot, and missing
 * both every time is what makes it bad rather than merely unlucky.
 *
 * If every open cell is a win or a block, it has no choice left and plays one of them
 * anyway. A player who refuses to finish their own line can still lose to it. */
export function blunderingMove(board, mark, random = Math.random) {
    const avoid = new Set([
        ...completingMoves(board, mark),
        ...completingMoves(board, otherMark(mark)),
    ]);
    const allowed = legalMoves(board).filter((cell) => !avoid.has(cell));
    return pick(allowed.length ? allowed : legalMoves(board), random);
}

const STRATEGIES = {
    optimal: optimalMove,
    bad: blunderingMove,
    random: randomMove,
};

// The opponent's reply, or the same game if it is not the opponent's turn.
export function opponentMove(game, random = Math.random) {
    if (!isOpponentTurn(game)) return game;
    const strategy = STRATEGIES[game.opponent] || randomMove;
    return place(game, strategy(game.board, opponentMark(game), random));
}

/* --- The session tally --- */

export const emptyTally = () => ({ won: 0, drawn: 0, lost: 0 });

// Only a finished game counts. An abandoned one changes nothing.
export function recordResult(tally, game) {
    const { status } = outcome(game);
    if (status === STATUS.WON) return { ...tally, won: tally.won + 1 };
    if (status === STATUS.LOST) return { ...tally, lost: tally.lost + 1 };
    if (status === STATUS.DRAW) return { ...tally, drawn: tally.drawn + 1 };
    return tally;
}
