/* What the Rubin tab shows, worked out from a digest: the sections, the words, and the
 * geometry of the chart and the map. Pure - no DOM, no fetching - so it is tested on
 * its own; rubin/rubin.js puts it on the page.
 *
 * The digest comes from the rubin-data repo (see js/collector.js for its format).
 * Visitors' browsers only ever read that file; they never contact Fink or JPL.
 */
import { CALIBRATION, READINGS, SHAPED, fitEquilibrium, chanceShaped, diameterAt } from './equilibrium.js';
import { albedosNear, diameterFromH } from './brightness.js';
import { FLAGS } from './flags.js';

/* Same origin as the site: rubin-data is published with GitHub Pages at
   developerkaleb.github.io/rubin-data/, beside developerkaleb.github.io/PortfolioWebPage/.
   So the tab keeps the site's rule that a visitor's browser contacts nothing but the site's
   own host (NOTES.md, "The site loads nothing from anywhere else"). raw.githubusercontent
   would have been a third party seeing every visitor. */
export const DATA_ROOT = '/rubin-data';
export const DIGEST_URL = `${DATA_ROOT}/digest/latest.json`;
export const CHANGES_URL = (month) => `${DATA_ROOT}/changes/${month}.json`;
export const DATA_REPO = 'https://github.com/DeveloperKaleb/rubin-data';

/* How many of the long large-if-dark list show before "show all". */
export const LARGE_IF_DARK_SHOWN = 8;

export const percent = (chance) => {
    const p = chance * 100;
    if (p >= 99.95) return '>99.9%';
    return `${p >= 99 ? p.toFixed(1) : Math.round(p)}%`;
};

const groupThousands = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/* How far in H the albedos behind a displayed size may come from. */
export const SIZE_WIDTH = 1;

export const kilometres = (km) => `${groupThousands(km)} km`;
export const au = (r) => `${r >= 100 ? Math.round(r) : r.toFixed(1)} AU`;

export function longDate(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${d} ${months[m - 1]} ${y}`;
}

/* The object's display name: JPL's "136199 Eris (2003 UB313)" without the brackets when
   it has a name, else the provisional designation alone. */
export function displayName(entry) {
    const named = entry.name.match(/^\d+\s+(.+?)\s+\(/);
    return named ? named[1] : entry.name.replace(/^\d+\s+/, '').replace(/[()]/g, '').trim();
}

/* Its size, said honestly: measured where it was, otherwise the size its brightness
   implies at the albedos typical of objects about as bright (the weighted median, from
   within SIZE_WIDTH magnitudes), marked as an estimate. */
export function sizeOf(entry) {
    if (entry.sizeFrom === 'measured') return { km: entry.diameterKm, text: `${kilometres(entry.diameterKm)}`, measured: true };
    /* Only objects within about a magnitude: uncapped, the bright end takes in dark
       albedos and overstates the size threefold (Eris from H alone: 6,500 km, not 2,326). */
    const { albedos, weights } = albedosNear(entry.H, { maxWidth: SIZE_WIDTH });
    const order = albedos.map((a, k) => [a, weights[k]]).sort((x, y) => x[0] - y[0]);
    let total = 0, median = order.at(-1)[0];
    for (const [albedo, w] of order) {
        total += w;
        if (total >= 0.5) { median = albedo; break; }
    }
    const km = diameterFromH(entry.H, median);
    return { km, text: `about ${kilometres(Math.round(km / 10) * 10)}`, measured: false };
}

export const flagsOf = (entry) => entry.flags.map((name) => ({ name, ...FLAGS[name] }));

/* The one-line status at the top of the tab. */
export function summary(digest) {
    const { counts } = digest;
    return [
        `Updated ${longDate(digest.date)}`,
        `${groupThousands(counts.assessed)} distant objects checked`,
        `${counts.passes} likely shaped by their own gravity`,
        `${counts.watch} worth watching`,
        `Rubin's own measurements for ${counts.withRubinH}`,
    ];
}

/* The digest split into the tab's sections, in the digest's own order (most promising
   first). */
export function sections(digest) {
    const passes = digest.entries.filter((e) => e.passes);
    const watch = digest.entries.filter((e) => !e.passes && e.watch);
    const largeIfDark = digest.entries
        .filter((e) => !e.passes && !e.watch && e.flags.includes('largeIfDark'))
        .sort((a, b) => b.chanceIfDark - a.chanceIfDark || b.chance - a.chance);
    return { passes, watch, largeIfDark };
}

/* Why a watched object is on the list, in one sentence. */
export function whyWatched(entry) {
    const orbit = flagsOf(entry).filter((f) => f.kind === 'orbit').map((f) => f.label.toLowerCase());
    const list = orbit.length > 1 ? `${orbit.slice(0, -1).join(', ')} and ${orbit.at(-1)}` : orbit[0];
    return `As faint as a small object, but ${percent(entry.chanceIfDark)} likely shaped by gravity if its surface is as dark as the darkest measured - and its orbit is ${list}.`;
}

/* One line of the changes file, in words. */
export function changeText(change, byDesignation = new Map()) {
    const known = byDesignation.get(change.designation);
    const who = known ? displayName(known) : change.designation;
    switch (change.what) {
        case 'new in digest': return `${who} appears for the first time.`;
        case 'left digest': return `${who} no longer qualifies for the list.`;
        case 'now passes': return `${who} now passes (${percent(change.chance)}).`;
        case 'no longer passes': return `${who} no longer passes (${percent(change.chance)}).`;
        case 'flags gained': return `${who} is now ${change.flags.map((f) => FLAGS[f]?.label.toLowerCase() ?? f).join(', ')}.`;
        case 'flags lost': return `${who} is no longer ${change.flags.map((f) => FLAGS[f]?.label.toLowerCase() ?? f).join(', ')}.`;
        case 'H changed': return `${who}'s brightness was revised from H ${change.from} to H ${change.to} (${change.hSource}).`;
        default: return `${who}: ${change.what}.`;
    }
}

/* ---- The chart: chance of having been shaped by gravity against diameter --------------- */

export const CHART_RANGE = { minKm: 100, maxKm: 6000 };

export function chartData({ steps = 120 } = {}) {
    const evidence = fitEquilibrium(READINGS.evidence(CALIBRATION));
    const grundy = fitEquilibrium(READINGS.grundy(CALIBRATION));
    const logMin = Math.log10(CHART_RANGE.minKm), logMax = Math.log10(CHART_RANGE.maxKm);
    const curve = (fit) => Array.from({ length: steps + 1 }, (_, k) => {
        const km = 10 ** (logMin + (logMax - logMin) * k / steps);
        return { km, chance: chanceShaped(fit, km) };
    });
    return {
        evidence: curve(evidence),
        grundy: curve(grundy),
        cutoffs: { evidence: diameterAt(evidence, 0.8), grundy: diameterAt(grundy, 0.8) },
        bodies: CALIBRATION
            .filter((b) => b.shaped !== SHAPED.UNCERTAIN)
            .filter((b) => b.diameterKm >= CHART_RANGE.minKm && b.diameterKm <= CHART_RANGE.maxKm)
            .map((b) => ({ name: b.name, km: b.diameterKm, shaped: b.shaped === SHAPED.YES, basis: b.basis })),
        uncertainCount: CALIBRATION.filter((b) => b.shaped === SHAPED.UNCERTAIN).length,
        chanceAt: (km) => ({ evidence: chanceShaped(evidence, km), grundy: chanceShaped(grundy, km) }),
    };
}

/* ---- The map: where the listed objects are now, seen from above -------------------------- */

export const PLANETS = [
    { name: 'Jupiter', au: 5.2 },
    { name: 'Saturn', au: 9.58 },
    { name: 'Uranus', au: 19.2 },
    { name: 'Neptune', au: 30.07 },
];

/* The objects on the map, and its radius: the furthest of them rounded up to a round
   number of AU, with distance rings every 50 AU. */
export function mapData(digest) {
    const { passes, watch } = sections(digest);
    const marks = [
        ...passes.map((e) => ({ entry: e, kind: e.flags.includes('disputed') ? 'disputed' : 'passes' })),
        ...watch.map((e) => ({ entry: e, kind: 'watch' })),
    ].filter((m) => Number.isFinite(m.entry.now?.x) && Number.isFinite(m.entry.now?.y));
    const furthest = Math.max(PLANETS.at(-1).au, ...marks.map((m) => Math.hypot(m.entry.now.x, m.entry.now.y)));
    const radius = Math.ceil(furthest / 50) * 50;
    const rings = Array.from({ length: radius / 50 }, (_, k) => (k + 1) * 50);
    return { marks, radius, rings, planets: PLANETS };
}
