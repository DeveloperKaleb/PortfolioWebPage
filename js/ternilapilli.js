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
    otherMark,
    winnerOf,
    pickOpponent,
    emptyTally,
    recordStatus,
} from './tictactoe.js';

export { LINES, MARKS, STATUS, OPPONENTS, otherMark, pickOpponent, emptyTally };

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

export function createGame({ playerMark = MARKS.X, opponent = 'random' } = {}) {
    const board = Array(9).fill(null);
    return {
        board,
        // Stored, unlike Classic: once all six pieces are down the counts no longer say
        // whose turn it is.
        turn: MARKS.X,
        playerMark,
        opponent,
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

/* The result from the player's side. `repeated` says a draw came from the repetition
   rule, which is the only way this game draws. */
export function outcome(game) {
    const win = winnerOf(game.board);
    if (win) {
        return { status: win.mark === game.playerMark ? STATUS.WON : STATUS.LOST, line: win.line, repeated: false };
    }
    if (timesSeen(game) >= REPETITION_LIMIT) {
        return { status: STATUS.DRAW, line: null, repeated: true };
    }
    return { status: STATUS.PLAYING, line: null, repeated: false };
}

export const isOver = (game) => outcome(game).status !== STATUS.PLAYING;

export const isPlayerTurn = (game) => !isOver(game) && game.turn === game.playerMark;

export const isOpponentTurn = (game) => !isOver(game) && game.turn !== game.playerMark;

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

/* Do the solve now rather than on the optimal opponent's first move. Only that opponent
   ever asks for it, so leaving it until then would make its first reply alone arrive
   late - a tell, on a slow phone a visible one. The DOM layer calls this before any
   opponent is due to move, whoever the opponent is. */
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

/* Every move a perfect player could make here. The optimal opponent picks among them at
   random, so it does not replay the same game - and so its opening, which the solve says
   is any of the four corners, is not one fixed point. */
export function bestMoves(board, turn) {
    const scored = legalMoves(board, turn).map((move) => ({ move, score: moveScore(board, turn, move) }));
    const top = Math.max(...scored.map((entry) => entry.score));
    return scored.filter((entry) => entry.score === top).map((entry) => entry.move);
}

export const optimalMove = (board, turn, random = Math.random) => pick(bestMoves(board, turn), random);

export const randomMove = (board, turn, random = Math.random) => pick(legalMoves(board, turn), random);

// Moves that would complete a line for `mark` right now.
export const winningMoves = (board, mark) =>
    legalMoves(board, mark).filter((move) => winnerOf(applyMove(board, mark, move))?.mark === mark);

/* The deliberately bad player, meaning what it means in Classic: random, except it never
 * makes a move that wins and never one that takes away a win the player had lined up for
 * their next turn. If every move open to it is one of those, it has no choice and plays
 * one anyway. */
export function blunderingMove(board, turn, random = Math.random) {
    const them = otherMark(turn);
    const theyHaveAWin = winningMoves(board, them).length > 0;
    const moves = legalMoves(board, turn);

    const allowed = moves.filter((move) => {
        const next = applyMove(board, turn, move);
        if (winnerOf(next)?.mark === turn) return false;
        if (theyHaveAWin && winningMoves(next, them).length === 0) return false;
        return true;
    });

    return pick(allowed.length ? allowed : moves, random);
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
    return makeMove(game, strategy(game.board, game.turn, random));
}

export const recordResult = (tally, game) => recordStatus(tally, outcome(game).status);
