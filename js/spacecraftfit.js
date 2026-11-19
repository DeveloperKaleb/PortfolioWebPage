/* Turning a spacecraft's positions from JPL Horizons into the smallest track that still
 * puts it where Horizons does (js/spacecraft.js draws them). Used by the hand tool
 * (tools/spacecraft/build.mjs, for the tracks built into the site) and by the collector
 * (monthly, for rubin-data's spacecraft.json), never by the page. Pure.
 *
 * - A plain orbit about the Sun (elements), where one fits every row within
 *   ORBIT_TOLERANCE: craft coasting with nothing to steer them. It holds at any date.
 * - Otherwise its positions, as few as will do: every 1, 2, 4, 8 or 16 rows, the widest a
 *   cubic through them still matches every row within SAMPLE_TOLERANCE. These end where
 *   the rows end.
 * - A dead craft Horizons stopped following (its rows end before the span asked for): an
 *   orbit fitted to its last six weeks only, since earlier rows may run through a last
 *   flyby, marked lastKnown with the date. None if no orbit fits.
 */
import { elementsFromState, positionAt } from './orbit.js';
import { trackPosition } from './spacecraft.js';

/* How far off a track may put a craft, in AU, by its distance from the Sun r: on the whole
   map a pixel is tens of AU, and zoomed on Earth and the Moon a few ten-thousandths. */
export const ORBIT_TOLERANCE = (r) => Math.max(5e-4, 2e-4 * r);
export const SAMPLE_TOLERANCE = (r) => Math.max(2e-4, 1e-4 * r);

const round = (v, places) => Number(v.toFixed(places));
export const jdOfDay = (iso) => Date.parse(`${iso}T00:00:00Z`) / 86400000 + 2440587.5;

const worst = (rows, at) => {
    let bad = 0;
    for (const [jd, x, y, z] of rows) {
        const p = at(jd);
        bad = Math.max(bad, Math.hypot(p.x - x, p.y - y, p.z - z) / ORBIT_TOLERANCE(Math.hypot(x, y, z)));
    }
    return bad;
};

/* Velocity at row k from the five rows about it (fourth order), AU/day. */
function velocity(rows, k) {
    const h = rows[k + 1][0] - rows[k][0];
    return [1, 2, 3].map((d) => (rows[k - 2][d] - 8 * rows[k - 1][d] + 8 * rows[k + 1][d] - rows[k + 2][d]) / (12 * h));
}

export function orbitTrack(rows) {
    if (rows.length < 9) return null;
    let best = null;
    /* Tried from a few moments; where it is furthest out it moves slowest, so its speed
       there is best known. */
    const inner = rows.slice(2, -2);
    const far = 2 + inner.reduce((b, r, k) => (Math.hypot(...r.slice(1)) > Math.hypot(...inner[b].slice(1)) ? k : b), 0);
    for (const k of [2, Math.floor(rows.length / 2), rows.length - 3, far]) {
        /* The speed from five positions is a hair off, which slips the craft along its orbit
           more each lap: so the speed is scaled, by golden section, to fit every row best. */
        const v = velocity(rows, k);
        const fit = (scale) => {
            const el = elementsFromState(rows[k].slice(1), v.map((c) => c * scale), rows[k][0]);
            if (!Number.isFinite(el.a) || Math.abs(el.e - 1) < 1e-6) return { el, bad: Infinity };
            return { el, bad: worst(rows, (jd) => positionAt(el, jd)) };
        };
        let [lo, hi] = [0.997, 1.003];
        const g = (Math.sqrt(5) - 1) / 2;
        for (let n = 0; n < 40; n++) {
            const [m1, m2] = [hi - g * (hi - lo), lo + g * (hi - lo)];
            if (fit(m1).bad < fit(m2).bad) hi = m2; else lo = m1;
        }
        const got = [fit(1), fit((lo + hi) / 2)].reduce((p, q) => (q.bad < p.bad ? q : p));
        if (Number.isFinite(got.bad) && (!best || got.bad < best.bad)) best = got;
    }
    if (!best || best.bad > 1) return null;
    const { a, e, i, om, w, ma, epoch } = best.el;
    return { from: rows[0][0], elements: { a: round(a, 9), e: round(e, 9), i: round(i, 7), om: round(om, 7), w: round(w, 7), ma: round(ma, 7), epoch } };
}

/* The kept positions are counted back from the last, so the track reaches the end of the
   rows; any row inside it must match, and a row before it may be left out only if it is
   already past (todayJd): the map never shows an earlier moment. */
export function sampleTrack(rows, todayJd) {
    const n = rows.length;
    if (n < 2) return null;
    const step = rows[1][0] - rows[0][0];
    for (const every of [16, 8, 4, 2, 1]) {
        const kept = rows.filter((_, k) => (n - 1 - k) % every === 0);
        if (kept.length < 4 && every > 1) continue;
        const track = { start: kept[0][0], step: step * every, xyz: kept.flatMap((r) => r.slice(1).map((v) => round(v, 5))) };
        const ok = rows.every(([jd, x, y, z]) => {
            const p = trackPosition(track, jd);
            if (!p) return jd < todayJd;
            return Math.hypot(p.x - x, p.y - y, p.z - z) <= SAMPLE_TOLERANCE(Math.hypot(x, y, z));
        });
        if (ok || every === 1) return track;
    }
    return null;
}

/* The track for one craft's fetched rows ({ start, stop, rows }), given the span that was
   asked for and today; null if none will do. */
export function buildTrack(saved, { spanStart, todayJd }) {
    if (saved.stop < spanStart) {
        const track = orbitTrack(saved.rows.slice(-9));
        return track ? { ...track, lastKnown: saved.stop } : null;
    }
    const orbit = orbitTrack(saved.rows);
    if (orbit) return orbit;
    /* Positions from a month before today only. */
    const recent = saved.rows.filter((r) => r[0] >= todayJd - 31);
    return sampleTrack(recent.length >= 2 ? recent : saved.rows, todayJd);
}

/* The collector refreshes the tracks once a calendar month; a month whose fetch did not
   finish (the run's request budget ran out) is tried again the next week. Not in a run that
   pulls Fink's month of detections (owner, 2026-11-19): that pull alone can use the whole
   budget, so the craft wait for the next week rather than be cut off. */
export const spacecraftDue = (saved, month, { finkThisRun = false } = {}) => !finkThisRun && (!saved || saved.complete !== month);

/* Which craft to ask Horizons about this month: free-flying ones not yet asked this month,
   leaving out any built into the site as a plain orbit (owner, 2026-11-19). Those coast
   with nothing to steer them, so a new track would say the same thing; that takes in the
   craft placed from a last known orbit. A craft that starts steering again needs its
   built-in track rebuilt (npm run spacecraft) to be asked again. */
export const craftToAsk = (craft, builtIn, saved, month) =>
    craft.filter((c) => c.horizons && !builtIn[c.id]?.elements && saved?.asked?.[c.id] !== month);
