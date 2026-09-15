/* Which squares the numbers prove - and forgiving the guesses nothing could avoid.
 *
 * When a tap would open a mine, js/minesweeper.js asks this module two things. Could any
 * square have been proven safe, from the revealed numbers and the total mine count alone?
 * And if not, is there a layout of the mines that fits everything on screen with the
 * tapped square safe? A forced guess is forgiven by moving the mines to the nearest such
 * layout. See NOTES.md, "Forgiving forced guesses".
 *
 * Exact rather than a set of rules: a square is proven only if it is the same in every
 * layout that fits, which covers every deduction a player could make - counting the mines
 * left included. Flags are ignored; they are the player's claims, not facts.
 *
 * How it stays fast enough:
 * - Boxes. Frontier squares that touch exactly the same numbers are interchangeable, so
 *   only how many mines each group holds is searched.
 * - A sweep. Each independent stretch of frontier is walked a box at a time, carrying only
 *   what the numbers still open at that point need. Layouts that agree on that merge, with
 *   the mine counts they can reach kept as a bitset (a BigInt), so the cost grows with the
 *   frontier's width rather than with how many layouts there are.
 *
 * Pure: no DOM and no timers. It reads an injected random source and an injected clock,
 * which is what lets the tests drive the time limit.
 */

export const FORGIVENESS_BUDGET_MS = 250;

/* The check gets 80% of the budget. Moving the mines gets whatever is left, but never less
   than the other 20% - so a check that runs out of time still leaves room to forgive. */
const CHECK_SHARE = 0.8;

const TIMEOUT = Symbol('timeout');
const defaultNow = () => performance.now();

function makeClock(budgetMs, now) {
    const deadline = now() + budgetMs;
    let ticks = 0;
    const check = () => { if (now() >= deadline) throw TIMEOUT; };
    return { check, tick: () => { if ((++ticks & 1023) === 0) check(); } };
}

// Every sum of a member of one set with a member of the other.
function conv(a, b) {
    let out = 0n;
    for (let shift = 0n; b; shift++, b >>= 1n) if (b & 1n) out |= a << shift;
    return out;
}

const bitsOf = (set) => {
    const out = [];
    for (let k = 0; set; k++, set >>= 1n) if (set & 1n) out.push(k);
    return out;
};

// Does the set hold a count that leaves between 0 and `room` of `remaining` over?
function fits(set, remaining, room) {
    const lo = Math.max(0, remaining - room);
    if (remaining < lo) return false;
    return (set & (((1n << BigInt(remaining - lo + 1)) - 1n) << BigInt(lo))) !== 0n;
}

const toIndex = (key, W) => {
    const comma = key.indexOf(',');
    return (Number(key.slice(comma + 1)) - 1) * W + Number(key.slice(0, comma)) - 1;
};
const toKey = (i, W) => `${(i % W) + 1},${Math.floor(i / W) + 1}`;

/* The board as the solver sees it: each revealed number with its hidden neighbours, the
   frontier grouped into boxes, the boxes into components that share no number, and the
   interior - hidden squares touching no number at all. */
function readBoard(game) {
    const W = game.width, H = game.height, N = W * H;
    const revealed = new Uint8Array(N);
    for (const key of game.revealed) revealed[toIndex(key, W)] = 1;
    // A Mine A Shape! board has holes: squares that are not on the board at all.
    const onBoard = new Uint8Array(N).fill(game.shape ? 0 : 1);
    if (game.shape) for (const key of game.shape.cells) onBoard[toIndex(key, W)] = 1;

    const cons = [];
    const cellCons = new Map();
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (!revealed[y * W + x]) continue;
            const cells = [];
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx, ny = y + dy;
                    const j = ny * W + nx;
                    if ((dx || dy) && nx >= 0 && ny >= 0 && nx < W && ny < H && onBoard[j] && !revealed[j]) cells.push(j);
                }
            }
            if (!cells.length) continue;
            for (const cell of cells) {
                if (!cellCons.has(cell)) cellCons.set(cell, []);
                cellCons.get(cell).push(cons.length);
            }
            cons.push({ cells, value: game.counts[y][x] });
        }
    }

    const boxByKey = new Map(), boxes = [], boxOf = new Map();
    for (const [cell, list] of cellCons) {
        const key = list.join(',');
        if (!boxByKey.has(key)) {
            boxByKey.set(key, { cells: [], cons: list });
            boxes.push(boxByKey.get(key));
        }
        boxByKey.get(key).cells.push(cell);
        boxOf.set(cell, boxByKey.get(key));
    }

    const parent = cons.map((_, i) => i);
    const find = (a) => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
    for (const box of boxes) for (const j of box.cons) parent[find(j)] = find(box.cons[0]);
    const byRoot = new Map(), comps = [];
    for (const box of boxes) {
        const root = find(box.cons[0]);
        if (!byRoot.has(root)) {
            byRoot.set(root, { boxes: [], index: comps.length });
            comps.push(byRoot.get(root));
        }
        box.comp = byRoot.get(root).index;
        byRoot.get(root).boxes.push(box);
    }

    const interior = [];
    for (let i = 0; i < N; i++) if (onBoard[i] && !revealed[i] && !cellCons.has(i)) interior.push(i);
    return { W, N, M: game.mineCount, revealed, onBoard, cons, comps, boxOf, interior };
}

/* The forward sweep of one component. `lim[bi]` is the most mines box bi may hold - its
   size, or one less for the box holding a square that has to be safe. L[t] holds the
   states before step t, each with the mine counts that reach it; K is every count the
   whole component can hold. */
function sweep(board, comp, clock, limits) {
    clock.check();
    const q = comp.boxes.length;
    const localOf = new Map(), val = [], consBoxes = [];
    const boxCons = comp.boxes.map((box, bi) => box.cons.map((j) => {
        if (!localOf.has(j)) {
            localOf.set(j, val.length);
            val.push(board.cons[j].value);
            consBoxes.push([]);
        }
        consBoxes[localOf.get(j)].push(bi);
        return localOf.get(j);
    }));
    const size = comp.boxes.map((box) => box.cells.length);
    const lim = limits || size;

    // Walk the frontier from one end: breadth-first from the far side of a first pass.
    const bfs = (start) => {
        const seen = new Uint8Array(q), out = [start];
        seen[start] = 1;
        for (let h = 0; h < out.length; h++) {
            for (const lj of boxCons[out[h]]) for (const nb of consBoxes[lj]) if (!seen[nb]) { seen[nb] = 1; out.push(nb); }
        }
        return out;
    };
    const order = bfs(bfs(0).pop());
    const pos = [];
    order.forEach((bi, t) => { pos[bi] = t; });

    // A number is open between its first box and its last; only open numbers are carried.
    const p = val.length;
    const first = consBoxes.map((bs) => Math.min(...bs.map((bi) => pos[bi])));
    const last = consBoxes.map((bs) => Math.max(...bs.map((bi) => pos[bi])));
    const open = Array.from({ length: q + 1 }, () => []);
    for (let lj = 0; lj < p; lj++) for (let t = first[lj] + 1; t <= last[lj]; t++) open[t].push(lj);
    const stepInfo = order.map((bi, t) => boxCons[bi].map((lj) => ({
        lj,
        isNew: first[lj] === t,
        isLast: last[lj] === t,
        room: consBoxes[lj].reduce((s, b) => s + (pos[b] > t ? size[b] : 0), 0),
    })));

    // Put m mines in the box at step t: the state after, or null if a number cannot be met.
    const r = new Int32Array(p);
    function step(t, res, m) {
        open[t].forEach((lj, i) => { r[lj] = res[i]; });
        for (const info of stepInfo[t]) {
            const need = (info.isNew ? val[info.lj] : r[info.lj]) - m;
            if (need < 0 || (info.isLast ? need !== 0 : need > info.room)) return null;
            r[info.lj] = need;
        }
        return open[t + 1].map((lj) => r[lj]);
    }

    const L = [new Map([['', { res: [], k: 1n }]])];
    for (let t = 0; t < q; t++) {
        const next = new Map();
        for (const st of L[t].values()) {
            for (let m = 0; m <= lim[order[t]]; m++) {
                clock.tick();
                const res = step(t, st.res, m);
                if (!res) continue;
                const key = res.join(',');
                if (!next.has(key)) next.set(key, { res, k: 0n });
                next.get(key).k |= st.k << BigInt(m);
            }
        }
        L.push(next);
    }
    const done = L[q].get('');
    return { comp, q, order, lim, step, L, K: done ? done.k : 0n };
}

/* The backward sweep: R[t] gives, for each state before step t, the mine counts that can
   still complete it. `onBox(bi, links)` sees every live transition into a box as it is
   passed - [counts reaching it, mines put in, counts completing after] - and can stop the
   walk by returning a square. */
function completions(sc, clock, onBox) {
    const { q, order, lim, step, L } = sc;
    const R = new Array(q + 1);
    R[q] = new Map([['', 1n]]);
    for (let t = q - 1; t >= 0; t--) {
        R[t] = new Map();
        const links = [];
        for (const [key, st] of L[t]) {
            let acc = 0n;
            for (let m = 0; m <= lim[order[t]]; m++) {
                clock.tick();
                const res = step(t, st.res, m);
                const after = res && R[t + 1].get(res.join(','));
                if (after === undefined || after === null) continue;
                acc |= after << BigInt(m);
                if (onBox) links.push([st.k, m, after]);
            }
            if (acc) R[t].set(key, acc);
        }
        const cell = onBox ? onBox(order[t], links) : -1;
        if (cell >= 0) return { R, found: cell };
    }
    return { R, found: -1 };
}

// Which counts each component may really hold, once the others and the interior must fit.
function allowedCounts(board, sweeps) {
    const C = sweeps.length;
    const prefix = [1n], suffix = new Array(C + 1).fill(1n);
    for (let c = 0; c < C; c++) prefix.push(conv(prefix[c], sweeps[c].K));
    for (let c = C - 1; c >= 0; c--) suffix[c] = conv(suffix[c + 1], sweeps[c].K);
    const allowed = sweeps.map((sc, c) => {
        const others = conv(prefix[c], suffix[c + 1]);
        return bitsOf(sc.K).reduce((F, k) => (fits(others, board.M - k, board.interior.length) ? F | (1n << BigInt(k)) : F), 0n);
    });
    return { allowed, totals: prefix[C] };
}

function firstSafeCell(board, clock) {
    const sweeps = board.comps.map((comp) => sweep(board, comp, clock));
    const { allowed, totals } = allowedCounts(board, sweeps);

    // The interior first: once the totals are known it costs nothing.
    const inside = board.interior.length;
    if (inside && !bitsOf(totals).some((t) => board.M - t >= 1 && board.M - t <= inside)) return board.interior[0];

    // Smallest components first - a proof is quickest to find there.
    for (const sc of [...sweeps].sort((a, b) => a.q - b.q)) {
        const F = allowed[sc.comp.index];
        const binding = (sc.K & ~F) !== 0n;
        const { found } = completions(sc, clock, (bi, links) => {
            const canMine = links.some(([k, m, after]) => m > 0 && (!binding || ((conv(k, after) << BigInt(m)) & F) !== 0n));
            return canMine ? -1 : sc.comp.boxes[bi].cells[0];
        });
        if (found >= 0) return found;
    }
    return -1;
}

/* { result: 'safe', x, y } for the first square found that is provably safe;
   { result: 'none' } when there is none, so any guess now is forced;
   { result: 'timeout' } when the budget ran out first. */
export function findSafeSquare(game, { budgetMs = Infinity, now = defaultNow } = {}) {
    try {
        const clock = makeClock(budgetMs, now);
        const board = readBoard(game);
        clock.check();
        const cell = firstSafeCell(board, clock);
        return cell < 0 ? { result: 'none' } : { result: 'safe', x: (cell % board.W) + 1, y: Math.floor(cell / board.W) + 1 };
    } catch (error) {
        if (error === TIMEOUT) return { result: 'timeout' };
        throw error;
    }
}

// Set exactly `want` of these squares as mines, changing as few as possible.
function settleCells(mine, cells, want, avoid, random) {
    const on = cells.filter((c) => mine[c]);
    const off = cells.filter((c) => !mine[c] && c !== avoid);
    const [pool, change, value] = on.length > want ? [on, on.length - want, 0] : [off, want - on.length, 1];
    for (let i = 0; i < change; i++) {
        const j = i + Math.floor(random() * (pool.length - i));
        [pool[i], pool[j]] = [pool[j], pool[i]];
        mine[pool[i]] = value;
    }
}

/* Mine counts per box for one component, totalling `target`. Walked forward, each box takes
   the count closest to what it holds now that can still be completed. */
function nearestCounts(sc, R, target, holding, clock) {
    const counts = [];
    let res = [], used = 0;
    for (let t = 0; t < sc.q; t++) {
        const bi = sc.order[t];
        const options = Array.from({ length: sc.lim[bi] + 1 }, (_, m) => m)
            .sort((a, b) => Math.abs(a - holding(bi)) - Math.abs(b - holding(bi)));
        const pick = options.find((m) => {
            clock.tick();
            const next = sc.step(t, res, m);
            const after = next && R[t + 1].get(next.join(','));
            const need = target - used - m;
            if (!after || need < 0 || !((after >> BigInt(need)) & 1n)) return false;
            res = next;
            return true;
        });
        if (pick === undefined) return null;
        counts[bi] = pick;
        used += pick;
    }
    return counts;
}

/* A new set of mines with (x, y) safe, every revealed number still true and the same total -
   as near the current layout as can be found - or null if there is none, or no time. */
export function relocateMines(game, x, y, { random = Math.random, budgetMs = Infinity, now = defaultNow } = {}) {
    try {
        const clock = makeClock(budgetMs, now);
        const board = readBoard(game);
        clock.check();
        const { W, M, comps, interior } = board;
        const spot = (y - 1) * W + (x - 1);
        if (board.revealed[spot] || !board.onBoard[spot]) return null;

        const mine = new Uint8Array(board.N);
        for (const key of game.mines) mine[toIndex(key, W)] = 1;
        mine[spot] = 0;
        const holding = (cells) => cells.reduce((n, c) => n + mine[c], 0);

        const home = board.boxOf.get(spot);
        const sweeps = comps.map((comp) => sweep(board, comp, clock,
            comp.boxes.map((box) => box.cells.length - (box === home ? 1 : 0))));
        const current = comps.map((comp) => comp.boxes.reduce((n, box) => n + holding(box.cells), 0));
        const room = interior.length - (home ? 0 : 1);

        // Every other component keeps its count if the total allows; the tapped square's
        // own component goes last, and gives way.
        const order = comps.map((comp) => comp.index).filter((c) => !home || c !== home.comp);
        if (home) order.push(home.comp);
        const rest = new Array(order.length + 1).fill(1n);
        for (let i = order.length - 1; i >= 0; i--) rest[i] = conv(rest[i + 1], sweeps[order[i]].K);

        const chosen = [];
        let used = 0;
        for (let i = 0; i < order.length; i++) {
            const c = order[i];
            const k = bitsOf(sweeps[c].K)
                .sort((a, b) => Math.abs(a - current[c]) - Math.abs(b - current[c]))
                .find((option) => fits(rest[i + 1], M - used - option, room));
            if (k === undefined) return null;
            chosen[c] = k;
            used += k;
        }
        if (M - used < 0 || M - used > room) return null;

        for (const c of order) {
            if (home && c === home.comp ? false : chosen[c] === current[c]) continue;
            const sc = sweeps[c];
            const counts = nearestCounts(sc, completions(sc, clock).R, chosen[c], (bi) => holding(sc.comp.boxes[bi].cells), clock);
            if (!counts) return null;
            sc.comp.boxes.forEach((box, bi) => settleCells(mine, box.cells, counts[bi], spot, random));
        }
        settleCells(mine, interior, M - used, spot, random);

        const mines = new Set();
        mine.forEach((isMine, i) => { if (isMine) mines.add(toKey(i, W)); });
        return mines;
    } catch (error) {
        if (error === TIMEOUT) return null;
        throw error;
    }
}

/* What js/minesweeper.js calls when a tap lands on a mine: null if the tap loses - a safe
   square was provable, or no layout spares this one - otherwise the forgiving mines.

   A check that runs out of time is treated as finding nothing, so the game still tries to
   forgive. `checkBudgetMs` and `moveBudgetMs` override the split, for tests. */
export function resolveForcedGuess(game, x, y, options = {}) {
    const { random = Math.random, now = defaultNow, budgetMs = FORGIVENESS_BUDGET_MS } = options;
    const start = now();
    const check = findSafeSquare(game, { budgetMs: options.checkBudgetMs ?? budgetMs * CHECK_SHARE, now });
    if (check.result === 'safe') return null;
    const left = options.moveBudgetMs ?? Math.max(budgetMs - (now() - start), budgetMs * (1 - CHECK_SHARE));
    return relocateMines(game, x, y, { random, budgetMs: left, now });
}
