/* Tic-Tac-Toe: the rules and the opponents, with no DOM and no timers.
 *
 * Immutable like js/minesweeper.js and js/sequence.js - every function returns a new
 * game - so a test can hold a position and try every continuation from it.
 *
 * The board is nine cells in reading order, 0 top-left to 8 bottom-right, each null,
 * 'X' or 'O'. X always moves first. Whose turn it is is worked out from the counts
 * rather than stored, so it cannot drift out of step with the board.
 *
 * The opponent - Perfect, Good or Bad - is picked at random per game and is never shown
 * during play; see NOTES.md. Nothing in this file leaks which one is playing, and the DOM
 * layer has to keep it that way: the same delay before every reply, the same messages
 * whoever is on the other side.
 */

export const MARKS = { X: 'X', O: 'O' };

/* Three opponents, told apart only by how often they play the best move. */
export const OPPONENTS = ['perfect', 'good', 'bad'];

// How many games in a hundred each is drawn for.
export const OPPONENT_WEIGHTS = { perfect: 20, good: 40, bad: 40 };

// How often each plays the best move, wherever a worse one was there to play instead.
export const ACCURACY = { perfect: 1, good: 0.7, bad: 0.3 };

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

export function createGame({ playerMark = MARKS.X, opponent = 'good' } = {}) {
    return {
        board: Array(9).fill(null),
        playerMark,
        opponent,
        // Set once the player, on their turn, could have forced a win - see View Results.
        winnable: false,
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
    const next = { ...game, board };
    return { ...next, winnable: Boolean(game.winnable) || playerCanForceWin(next) };
}

/* Whether the player, now to move, could force a win from here - the opponent has handed
   one over. A lookup once prepare() has filled the memo, and it runs whoever the opponent
   is. Once set it stays set: View Results counts games where the chance was there, taken
   or not. */
function playerCanForceWin(game) {
    return isPlayerTurn(game) && score(game.board, game.playerMark) > 0;
}

// A tap from the player. Taps on the opponent's turn are ignored, not queued.
export function playerMove(game, cell) {
    return isPlayerTurn(game) ? place(game, cell) : game;
}

/* --- The opponents --- */

const pick = (options, random) => options[Math.floor(random() * options.length)];

// One of the three, by OPPONENT_WEIGHTS.
export function pickOpponent(random = Math.random) {
    let roll = random() * 100;
    for (const opponent of OPPONENTS) {
        roll -= OPPONENT_WEIGHTS[opponent];
        if (roll < 0) return opponent;
    }
    return OPPONENTS[OPPONENTS.length - 1];
}

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

const scoredMoves = (board, mark) => legalMoves(board).map((cell) => {
    const next = [...board];
    next[cell] = mark;
    return { cell, value: score(next, mark) };
});

/* Every move a perfect player could make here, not just one of them. It picks among
   these at random, so it does not play the same game every time - and, from an empty
   board, where every move draws with best play, its first move tells the player nothing
   about who they are up against. */
export function bestMoves(board, mark = turnOf(board)) {
    const scored = scoredMoves(board, mark);
    const top = Math.max(...scored.map((move) => move.value));
    return scored.filter((move) => move.value === top).map((move) => move.cell);
}

/* Moves with a worse result than the best available: a draw where a win was there, a loss
   where a draw was. Result, not score - a slower win is not among them, because nobody
   watching would call it a mistake. Empty when every move leads to the same result. */
export function worseMoves(board, mark = turnOf(board)) {
    const classed = scoredMoves(board, mark).map((move) => ({ cell: move.cell, result: Math.sign(move.value) }));
    const best = Math.max(...classed.map((move) => move.result));
    return classed.filter((move) => move.result < best).map((move) => move.cell);
}

/* How every opponent chooses, in both modes. The best move, unless a roll against its
 * accuracy says otherwise - and then any worse move, at random: sometimes a slip from a
 * win to a draw, sometimes a blunder that hands the player the game.
 *
 * Where no worse move exists there is no mistake to make, so no roll is spent and a best
 * move is played. That covers the empty board, forced moves and lost positions, and it
 * means the accuracy is a rate over the moves where a mistake was possible - which is
 * what makes 70 and 30 mean what they say. */
export function pickWithAccuracy(best, worse, accuracy, random = Math.random) {
    if (worse.length === 0 || random() < accuracy) return pick(best, random);
    return pick(worse, random);
}

/* Fill the search's memo now rather than inside the first reply. It was written when
   only the perfect opponent searched, and its first reply alone arrived late - a tell.
   Every opponent searches now, so that tell has gone, but a first reply that stalls while
   the search runs would still be a visible hitch on a slow phone. The DOM layer calls
   this before any opponent is due to move. Scores are kept per side, so both are filled:
   X from the empty board, and O from every opening X could make. */
export function prepare() {
    const empty = Array(9).fill(null);
    bestMoves(empty, MARKS.X);
    legalMoves(empty).forEach((cell) => {
        const opened = [...empty];
        opened[cell] = MARKS.X;
        bestMoves(opened, MARKS.O);
    });
}

export const optimalMove = (board, mark, random = Math.random) => pick(bestMoves(board, mark), random);

// Any open cell. No opponent plays like this; the tests use it for a player not trying.
export const randomMove = (board, _mark, random = Math.random) => pick(legalMoves(board), random);

// The opponent's reply, or the same game if it is not the opponent's turn.
export function opponentMove(game, random = Math.random) {
    if (!isOpponentTurn(game)) return game;
    const mark = opponentMark(game);
    const accuracy = ACCURACY[game.opponent] ?? ACCURACY.good;
    return place(game, pickWithAccuracy(bestMoves(game.board, mark), worseMoves(game.board, mark), accuracy, random));
}

/* --- The session tally --- */

export const emptyTally = () => ({ won: 0, drawn: 0, lost: 0 });

/* Counted by status rather than by game, so Terni Lapilli - which has its own idea of a
   draw - can share it. Only a finished game counts; an abandoned one changes nothing. */
export function recordStatus(tally, status) {
    if (status === STATUS.WON) return { ...tally, won: tally.won + 1 };
    if (status === STATUS.LOST) return { ...tally, lost: tally.lost + 1 };
    if (status === STATUS.DRAW) return { ...tally, drawn: tally.drawn + 1 };
    return tally;
}

export const recordResult = (tally, game) => recordStatus(tally, outcome(game).status);

/* --- Results, by opponent ---
 *
 * The opponent is never shown during play. Once RESULTS_AFTER games are finished the
 * player may look back at them, grouped by who they were up against: how many were
 * played, won and drawn, and how many were winnable - the opponent handed over a forced
 * win at some point, whether or not it was taken. Shared by both modes; each keeps its
 * own record. */

export const RESULTS_AFTER = 5;

export const emptyResults = () =>
    Object.fromEntries(OPPONENTS.map((opponent) => [opponent, { played: 0, won: 0, drawn: 0, winnable: 0 }]));

/* Only a finished game counts, as with the score. Draws are counted as well as wins
   because against the perfect opponent a draw is the best there is - without the column,
   holding it every game would read as nothing. */
export function recordGame(results, { opponent, status, winnable }) {
    const row = results[opponent];
    if (!row || status === STATUS.PLAYING) return results;
    return {
        ...results,
        [opponent]: {
            played: row.played + 1,
            won: row.won + (status === STATUS.WON ? 1 : 0),
            drawn: row.drawn + (status === STATUS.DRAW ? 1 : 0),
            winnable: row.winnable + (winnable ? 1 : 0),
        },
    };
}

export const gamesRecorded = (results) =>
    OPPONENTS.reduce((total, opponent) => total + results[opponent].played, 0);

export const canViewResults = (results) => gamesRecorded(results) >= RESULTS_AFTER;
