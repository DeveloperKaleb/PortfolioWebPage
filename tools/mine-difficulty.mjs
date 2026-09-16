/* What kinds of reasoning a Mine A Shape! picture forces - its difficulty profile.
 *
 * Not how long a board takes: which techniques it demands. A picture is played out from an
 * opening with the simple rules (a number with all its mines found, or with only mines
 * left). Where they stall, the weakest technique that gets moving again is recorded:
 *
 *   pair   - one number's squares sit inside another's, and the difference settles squares
 *   count  - groups that cannot overlap, whose demands use up every mine left
 *   deeper - js/minesolver.js proves a square that none of the above explains
 *
 * The heart needs one pair step and one deeper step; Mine Nonsense V1 needs six, one and
 * two, including the counting the owner had to find by hand. Nothing here reaches the
 * player: it is for choosing and checking pictures. See NOTES.md, "Mine A Shape!".
 *
 * Dev-only, so it lives in tools/ and is never shipped or precached. Needs Node 22+, like
 * the tool that calls it.
 */
import { openShapeAt, reveal, isRevealed, countAt, neighbours, safeCellCount } from '../js/minesweeper.js';
import { findSafeSquare } from '../js/minesolver.js';

const key = (x, y) => `${x},${y}`;

// One opening, played to the end. Counts the stalls by the technique that broke each one.
export function profileOpening(shape, [openX, openY]) {
    const W = shape.width, H = shape.height;
    let game = openShapeAt(shape, { x: openX, y: openY });
    const known = new Set();          // mines worked out so far, as a player's flags would be

    const closedUnknown = () => {
        const out = [];
        for (let y = 1; y <= H; y++) for (let x = 1; x <= W; x++) {
            if (!isRevealed(game, x, y) && !known.has(key(x, y))) out.push(key(x, y));
        }
        return out;
    };

    // Each number that still has unsettled squares beside it, and how many mines it needs there.
    const constraints = () => {
        const out = [];
        for (let y = 1; y <= H; y++) for (let x = 1; x <= W; x++) {
            if (!isRevealed(game, x, y)) continue;
            const around = neighbours(game, x, y).filter((n) => !isRevealed(game, n.x, n.y));
            const unknown = around.filter((n) => !known.has(key(n.x, n.y))).map((n) => key(n.x, n.y));
            if (unknown.length) out.push({ need: countAt(game, x, y) - (around.length - unknown.length), set: new Set(unknown) });
        }
        return out;
    };

    const apply = ({ safe = [], mines = [] }) => {
        mines.forEach((k) => known.add(k));
        safe.forEach((k) => {
            const [x, y] = k.split(',').map(Number);
            if (!isRevealed(game, x, y)) game = reveal(game, x, y);
        });
    };

    const runSimple = () => {
        let moved = true, rounds = 0;
        while (moved) {
            moved = false;
            for (const c of constraints()) {
                if (c.need === 0) { apply({ safe: [...c.set] }); moved = true; }
                else if (c.need === c.set.size) { apply({ mines: [...c.set] }); moved = true; }
            }
            if (moved) rounds++;
        }
        return rounds;
    };

    const pairRule = () => {
        const cs = constraints();
        for (const small of cs) for (const big of cs) {
            if (small === big || small.set.size >= big.set.size) continue;
            if (![...small.set].every((k) => big.set.has(k))) continue;
            const extra = [...big.set].filter((k) => !small.set.has(k));
            if (big.need === small.need) return { safe: extra };
            if (big.need - small.need === extra.length) return { mines: extra };
        }
        return null;
    };

    const countRule = () => {
        const left = shape.mineCount - known.size;
        const closed = closedUnknown();
        if (left === closed.length) return { mines: closed };
        // Groups sharing no squares: if their demands use up every mine, the rest is safe.
        const used = new Set();
        let demanded = 0;
        for (const c of [...constraints()].sort((a, b) => b.need - a.need)) {
            if ([...c.set].some((k) => used.has(k))) continue;
            c.set.forEach((k) => used.add(k));
            demanded += c.need;
        }
        if (demanded !== left) return null;
        const safe = closed.filter((k) => !used.has(k));
        return safe.length ? { safe } : null;
    };

    const stats = { simpleRounds: runSimple(), pair: 0, count: 0, deeper: 0, stuck: false };
    while (game.revealed.size < safeCellCount(game)) {
        const pair = pairRule();
        if (pair) { stats.pair++; apply(pair); stats.simpleRounds += runSimple(); continue; }
        const counted = countRule();
        if (counted) { stats.count++; apply(counted); stats.simpleRounds += runSimple(); continue; }
        const proof = findSafeSquare(game);
        if (proof.result !== 'safe') { stats.stuck = true; break; }
        stats.deeper++;
        apply({ safe: [key(proof.x, proof.y)] });
        stats.simpleRounds += runSimple();
    }
    return stats;
}

/* The picture's profile: the worst each technique gets across a sample of its openings,
   spread evenly through the list. The counts barely move between openings - a profile is a
   property of the picture - so a sample is enough; pass every opening to be certain. */
export function profileShape(shape, { sample = 5 } = {}) {
    const openings = shape.openings || [];
    const step = Math.max(1, Math.floor(openings.length / sample));
    const chosen = openings.filter((_, i) => i % step === 0).slice(0, sample);
    const runs = chosen.map((opening) => profileOpening(shape, opening));
    const worst = (pick) => runs.reduce((most, run) => Math.max(most, pick(run)), 0);
    return {
        simpleRounds: worst((r) => r.simpleRounds),
        pair: worst((r) => r.pair),
        count: worst((r) => r.count),
        deeper: worst((r) => r.deeper),
        sampled: chosen.length,
        stuck: runs.some((r) => r.stuck),
    };
}
