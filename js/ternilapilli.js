/* Terni Lapilli: the Roman game on the tic-tac-toe board, with no DOM and no timers.
 *
 * Each side has three pieces. They are placed one at a time, X first, and once all six
 * are down a turn is moving one of your own pieces a single step along one of the
 * board's eight lines - three rows, three columns, the two long diagonals - onto an
 * empty point. Three in a row on any line wins, whether it happens while placing or
 * while moving.
 *
 * Two rules were settled by solving the game rather than by tradition; see NOTES.md.
 *   - The first piece may not go in the centre. With it allowed, the first player wins
 *     by taking it, and only by taking it; without, the game is a draw with best play.
 *   - The same position with the same side to move, for the third time, is a draw.
 *     Pieces can otherwise shuffle forever.
 *
 * Immutable, like the other rules modules. The lines, the marks and the choice of
 * opponent are Classic's, imported rather than restated.
 */

import {
    LINES,
    MARKS,
    STATUS,
    OPPONENTS,
    ACCURACY,
    otherMark,
    winnerOf,
    pickOpponent,
    pickWithAccuracy,
    emptyTally,
    recordStatus,
    emptyPassTally,
    recordPassOutcome,
    playerNumberOf,
} from './tictactoe.js';

export { LINES, MARKS, STATUS, OPPONENTS, ACCURACY, otherMark, pickOpponent, emptyTally, emptyPassTally, playerNumberOf };

export const CENTRE = 4;
export const PIECES_EACH = 3;
export const REPETITION_LIMIT = 3;

/* Where a piece can step: its neighbours along the eight lines. The centre touches all
   eight others; a corner touches its two edge points and the centre; an edge point
   touches its two corners and the centre, but not the other edge points - no line runs
   between them. */
export const NEIGHBOURS = (() => {
    const near = Array.from({ length: 9 }, () => new Set());
    for (const [a, b, c] of LINES) {
        near[a].add(b);
        near[b].add(a);
        near[b].add(c);
        near[c].add(b);
    }
    return near.map((points) => [...points].sort((p, q) => p - q));
})();

export const positionKey = (board, turn) => board.map((cell) => cell || '-').join('') + turn;

// `players: 2` is pass the phone, as in Classic: no opponent, `playerMark` is Player 1's.
export function createGame({ playerMark = MARKS.X, opponent = 'good', players = 1 } = {}) {
    const board = Array(9).fill(null);
    return {
        board,
        // Stored, unlike Classic: once all six pieces are down the counts no longer say
        // whose turn it is.
        turn: MARKS.X,
        playerMark,
        players,
        opponent: players === 2 ? null : opponent,
        // How many times each position has come up, for the repetition rule.
        seen: { [positionKey(board, MARKS.X)]: 1 },
        // Set once the player, on their turn, could have forced a win - see View Results.
        winnable: false,
    };
}

export const isPlacing = (board, mark) => board.filter((cell) => cell === mark).length < PIECES_EACH;

// Every move open to `turn`, as { from, to }. `from` is null while placing.
export function legalMoves(board, turn) {
    const empty = board.flatMap((cell, index) => (cell === null ? [index] : []));

    if (isPlacing(board, turn)) {
        const firstMove = empty.length === 9;
        return empty
            .filter((to) => !(firstMove && to === CENTRE))
            .map((to) => ({ from: null, to }));
    }

    return board.flatMap((cell, from) => (cell !== turn ? [] :
        NEIGHBOURS[from].filter((to) => board[to] === null).map((to) => ({ from, to }))));
}

export function applyMove(board, turn, { from, to }) {
    const next = [...board];
    if (from !== null) next[from] = null;
    next[to] = turn;
    return next;
}

export const timesSeen = (game) => game.seen[positionKey(game.board, game.turn)] || 0;

/* The result from the player's side, plus the winning mark for pass the phone. `repeated`
   says a draw came from the repetition rule, which is the only way this game draws. */
export function outcome(game) {
    const win = winnerOf(game.board);
    if (win) {
        return {
            status: win.mark === game.playerMark ? STATUS.WON : STATUS.LOST,
            line: win.line,
            winner: win.mark,
            repeated: false,
        };
    }
    if (timesSeen(game) >= REPETITION_LIMIT) {
        return { status: STATUS.DRAW, line: null, winner: null, repeated: true };
    }
    return { status: STATUS.PLAYING, line: null, winner: null, repeated: false };
}

export const isOver = (game) => outcome(game).status !== STATUS.PLAYING;

// With two players on one phone, every turn is a player's and the opponent never moves.
export const isPlayerTurn = (game) =>
    !isOver(game) && (game.players === 2 || game.turn === game.playerMark);

export const isOpponentTurn = (game) =>
    !isOver(game) && game.players !== 2 && game.turn !== game.playerMark;

/* Play for whichever side is to move. Anything illegal - the centre on move one, a taken
   point, a step off the lines, the other side's piece - hands back the same game. */
export function makeMove(game, move) {
    if (isOver(game) || !move) return game;
    const legal = legalMoves(game.board, game.turn)
        .some((candidate) => candidate.from === move.from && candidate.to === move.to);
    if (!legal) return game;

    const board = applyMove(game.board, game.turn, move);
    const turn = otherMark(game.turn);
    const key = positionKey(board, turn);
    const next = { ...game, board, turn, seen: { ...game.seen, [key]: (game.seen[key] || 0) + 1 } };
    return { ...next, winnable: Boolean(game.winnable) || playerCanForceWin(next) };
}

/* Whether the player, now to move, could force a win from here - the opponent has handed
   one over. A lookup in the solve, which prepare() has built before any game is played,
   and it runs whoever the opponent is. Once set it stays set: View Results counts games
   where the chance was there, taken or not. */
function playerCanForceWin(game) {
    // Pass the phone has no opponent to hand anything over - and so never builds the solve.
    if (game.players === 2) return false;
    if (isOver(game) || game.turn !== game.playerMark) return false;
    return solve().get(positionKey(game.board, game.turn))?.result === WIN;
}

// A move from the player. On the opponent's turn it is ignored, not queued.
export const playerMove = (game, move) => (isPlayerTurn(game) ? makeMove(game, move) : game);

// The points the piece on `from` can step to, for the side to move.
export const movesFrom = (game, from) =>
    legalMoves(game.board, game.turn).filter((move) => move.from === from).map((move) => move.to);

/* --- The opponents --- */

const pick = (options, random) => options[Math.floor(random() * options.length)];

const WIN = 'win';
const LOSS = 'loss';
const DRAW = 'draw';

/* The whole game, solved backwards.
 *
 * Classic's minimax cannot work here: positions repeat, so a search that recurses into
 * the next move never bottoms out. Instead every position reachable from the start -
 * about five thousand - is collected once, and results flow back from the finished ones:
 * a position is a win if some move reaches a position lost for the other side, and a loss
 * if every move reaches one won for them. Whatever never resolves is a draw - a position
 * both sides can keep going round.
 *
 * Worked breadth first from the finished positions, so each win is found at its shortest
 * distance and each loss at its longest. The optimal player takes the quickest win and
 * the slowest loss, and that is what makes the repetition rule safe: along a winning line
 * the distance falls with every move, so no position on it can come up again, and the
 * losing side can never shelter in a threefold draw.
 *
 * Built on first use and kept. */
let solved = null;

function solve() {
    if (solved) return solved;

    const nodes = new Map();   // position key -> { next, result, depth, unresolved }
    const parents = new Map(); // position key -> keys of the positions one move before it
    const start = Array(9).fill(null);
    const queue = [[start, MARKS.X]];
    nodes.set(positionKey(start, MARKS.X), null);

    for (let i = 0; i < queue.length; i++) {
        const [board, turn] = queue[i];
        const key = positionKey(board, turn);
        const node = { next: [] };
        nodes.set(key, node);

        // The side that has just moved made a line, so the side to move has lost.
        if (winnerOf(board)) {
            node.result = LOSS;
            node.depth = 0;
            continue;
        }

        for (const move of legalMoves(board, turn)) {
            const nextBoard = applyMove(board, turn, move);
            const nextTurn = otherMark(turn);
            const nextKey = positionKey(nextBoard, nextTurn);
            node.next.push(nextKey);
            if (!parents.has(nextKey)) parents.set(nextKey, []);
            parents.get(nextKey).push(key);
            if (!nodes.has(nextKey)) {
                nodes.set(nextKey, null);
                queue.push([nextBoard, nextTurn]);
            }
        }
        node.unresolved = node.next.length;
    }

    const work = [...nodes.keys()].filter((key) => nodes.get(key).result === LOSS);
    for (let i = 0; i < work.length; i++) {
        const child = nodes.get(work[i]);
        for (const parentKey of parents.get(work[i]) || []) {
            const parent = nodes.get(parentKey);
            if (parent.result) continue;
            if (child.result === LOSS) {
                parent.result = WIN;
                parent.depth = child.depth + 1;
                work.push(parentKey);
            } else if (--parent.unresolved === 0) {
                parent.result = LOSS;
                parent.depth = child.depth + 1;
                work.push(parentKey);
            }
        }
    }

    /* Only the answer is kept. The move lists and counters were scaffolding for working
       it out, and dropping them roughly halves what stays in memory for the session. */
    solved = new Map();
    for (const [key, node] of nodes) {
        solved.set(key, node.result
            ? { result: node.result, depth: node.depth }
            : { result: DRAW, depth: null });
    }
    return solved;
}

/* Do the solve now rather than inside the first reply. It was written when only the
   perfect opponent read the solve, and its first reply alone arrived late - a tell.
   Every opponent reads it now, so that tell has gone, but a first reply that stalls for
   the build would still be a visible hitch on a slow phone. The DOM layer calls this
   before any opponent is due to move. */
export function prepare() {
    solve();
}

/* How a position stands for the side to move - 'win', 'loss' or 'draw' - and, for a win
   or a loss, in how many moves with best play. */
export function evaluate(board, turn) {
    const node = solve().get(positionKey(board, turn));
    if (!node) throw new Error(`Terni Lapilli: ${positionKey(board, turn)} cannot arise in a game`);
    return { result: node.result, depth: node.depth };
}

// A move scored from the mover's side: a sooner win scores higher, a later loss less low.
function moveScore(board, turn, move) {
    const { result, depth } = evaluate(applyMove(board, turn, move), otherMark(turn));
    if (result === LOSS) return 1000 - depth;
    if (result === WIN) return -1000 + depth;
    return 0;
}

/* Every move a perfect player could make here. It picks among them at random, so it does
   not replay the same game - and so its opening, which the solve says is any of the four
   corners, is not one fixed point. */
export function bestMoves(board, turn) {
    const scored = legalMoves(board, turn).map((move) => ({ move, score: moveScore(board, turn, move) }));
    const top = Math.max(...scored.map((entry) => entry.score));
    return scored.filter((entry) => entry.score === top).map((entry) => entry.move);
}

/* Moves with a worse result than the best available - a draw where a win was there, a
   loss where a draw was. Result, not distance: a slower win is not a mistake. The empty
   board is the plainest case: the corners draw and the edges lose, so an edge opening is
   the first mistake Good or Bad can make. */
export function worseMoves(board, turn) {
    const classed = legalMoves(board, turn)
        .map((move) => ({ move, result: Math.sign(moveScore(board, turn, move)) }));
    const best = Math.max(...classed.map((entry) => entry.result));
    return classed.filter((entry) => entry.result < best).map((entry) => entry.move);
}

export const optimalMove = (board, turn, random = Math.random) => pick(bestMoves(board, turn), random);

// Any legal move. No opponent plays like this; the tests use it for a player not trying.
export const randomMove = (board, turn, random = Math.random) => pick(legalMoves(board, turn), random);

// The opponent's reply, chosen the way Classic's opponents choose - see pickWithAccuracy.
export function opponentMove(game, random = Math.random) {
    if (!isOpponentTurn(game)) return game;
    const accuracy = ACCURACY[game.opponent] ?? ACCURACY.good;
    const move = pickWithAccuracy(
        bestMoves(game.board, game.turn),
        worseMoves(game.board, game.turn),
        accuracy,
        random,
    );
    return makeMove(game, move);
}

export const recordResult = (tally, game) => recordStatus(tally, outcome(game).status);

export const recordPassResult = (tally, game) => recordPassOutcome(tally, outcome(game), game.playerMark);
