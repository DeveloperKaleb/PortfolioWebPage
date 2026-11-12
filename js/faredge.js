/* What shaped the far edge? The Solar System tab's section on the most distant orbits: which
 * way they point, how bunched those directions are, and what would explain it.
 *
 * The argument for an unseen planet rests on a few objects whose long axes seem to point
 * the same way. This module works that out from JPL's orbits: who counts, one number for
 * the bunching, how far one more object could move it, and what the number would have been
 * in each past year. It gives no odds for any explanation, and its test for bunching does
 * not allow for where telescopes looked - the words here say so wherever the number goes.
 *
 * The design, with the owner's decisions, is the Claude Doc "The far edge: design for a new
 * Solar System tab section" (2026-11-12); see NOTES.md.
 *
 * Pure: orbits in, numbers and words out. No DOM, no network, no clock.
 */

import { positionAt, elementsFromState } from './orbit.js';
import { PLANET_ELEMENTS, planetElements } from './planets.js';

const DEG = Math.PI / 180;
const wrap = (deg) => ((deg % 360) + 360) % 360;

/* ---- Orbits about the centre of mass -----------------------------------------------------
 *
 * JPL's catalogue gives each orbit as the Sun alone would shape it at one moment. For an
 * orbit hundreds of AU across that description wobbles as Jupiter swings the Sun about:
 * Sedna's catalogue orbit is 544 AU across the long way, 506 AU measured about the Solar
 * System's centre of mass, and the second is the one that stays put. The studies of these
 * objects use it (Chen et al. 2025 give 2023 KQ14 as 251.9 au; the catalogue says 247.6),
 * and the cuts are theirs, so the section does too.
 *
 * Worked out here rather than asked of JPL Horizons object by object: where the Sun is
 * about the centre of mass follows from where the planets are (js/planets.js), so it
 * costs no request. Checked against Horizons for six objects in tests/rubin. */

/* Each planet's mass in Suns (IAU 2009 system of constants; Earth's includes the Moon). */
export const PLANET_MASS = {
    Mercury: 1 / 6023600, Venus: 1 / 408523.71, Earth: 1 / 328900.56, Mars: 1 / 3098708,
    Jupiter: 1 / 1047.3486, Saturn: 1 / 3497.898, Uranus: 1 / 22902.98, Neptune: 1 / 19412.24,
};
const SYSTEM_MASS = 1 + Object.values(PLANET_MASS).reduce((s, m) => s + m, 0);

/* Position and velocity (AU, AU/day) on an orbit at a moment; the velocity from the
   positions half a day either side, which for bodies this slow is exact to many figures. */
function stateAt(el, jd) {
    const at = (t) => { const p = positionAt(el, t); return [p.x, p.y, p.z]; };
    const before = at(jd - 0.5), after = at(jd + 0.5);
    return { r: at(jd), v: after.map((c, k) => c - before[k]) };
}

/* The Sun about the centre of mass: pulled the opposite way from each planet, by that
   planet's share of the whole. */
const sunAt = new Map();
export function sunFromCentre(jd) {
    if (sunAt.has(jd)) return sunAt.get(jd);
    const r = [0, 0, 0], v = [0, 0, 0];
    for (const name of Object.keys(PLANET_ELEMENTS)) {
        const planet = stateAt(planetElements(name, jd), jd);
        const share = PLANET_MASS[name] / SYSTEM_MASS;
        for (let k = 0; k < 3; k++) { r[k] -= share * planet.r[k]; v[k] -= share * planet.v[k]; }
    }
    /* Nearly every catalogue orbit shares one epoch, so this is worked out once a run. */
    sunAt.set(jd, { r, v });
    return { r, v };
}

/* JPL's Sun-centred elements as an orbit about the centre of mass, at the elements' own
   epoch. The same shape of object as JPL's, with q added. */
export function aboutCentre(el) {
    const body = stateAt(el, el.epoch);
    const sun = sunFromCentre(el.epoch);
    const out = elementsFromState(body.r.map((c, k) => c + sun.r[k]), body.v.map((c, k) => c + sun.v[k]), el.epoch, SYSTEM_MASS);
    return { ...out, q: out.a * (1 - out.e) };
}

/* One of the collector's objects (JPL's list, js/sources.js) as this module takes them.
   An orbit JPL calls unbound, or one with a missing element, is left out by the cuts. */
export function fromCatalogue(o) {
    const complete = ['a', 'e', 'i', 'om', 'w', 'ma', 'epoch'].every((k) => Number.isFinite(o.elements?.[k]));
    const el = complete && o.elements.e < 1 ? aboutCentre(o.elements) : { a: NaN, e: NaN, i: NaN, om: NaN, w: NaN, q: NaN };
    return {
        name: o.fullName, designation: o.designation,
        a: el.a, e: el.e, i: el.i, om: el.om, w: el.w, q: el.q,
        arcDays: o.quality?.arcDays ?? null, conditionCode: o.quality?.conditionCode ?? null,
    };
}

/* ---- Who counts ------------------------------------------------------------------------
 *
 * Fixed before the section went live (owner, 2026-11-12) and never tuned: the result swings
 * with the cut. Changing one restarts the history (see appendHistory).
 *
 *   extreme     Brown & Batygin 2021 (arXiv:2108.09868): "all known multi-opposition KBOs
 *               with 150<a<1000 AU and q>42 AU". The group the Planet Nine argument is made on.
 *   sednaLike   Chen et al. 2025 (arXiv:2508.02162), after Graham & Volk and Gomes et al.:
 *               a > 200 au, q > 60 au. Four are known.
 *   wide        Shankman et al. 2017 (arXiv:1706.05348), after Trujillo & Sheppard and
 *               Batygin & Brown: a > 150 au, q > 30 au. Shown beside the extreme group so the
 *               pattern is not seen to hang on one narrow choice.
 */
export const CUTS = {
    set: '2026-11-12',
    extreme: { aMin: 150, aMax: 1000, qMin: 42 },
    sednaLike: { aMin: 200, aMax: Infinity, qMin: 60 },
    wide: { aMin: 150, aMax: Infinity, qMin: 30 },
};

/* An orbit to be trusted: a year of observations and a usable fit. The 2021 paper says
   "multi-opposition", which this approximates. */
export const TRUSTED = { minArcDays: 365, maxConditionCode: 6 };

export const isTrusted = (o) => Number.isFinite(o.arcDays) && o.arcDays >= TRUSTED.minArcDays
    && Number.isFinite(o.conditionCode) && o.conditionCode <= TRUSTED.maxConditionCode;

export const inCut = (o, cut) => o.a > cut.aMin && o.a < cut.aMax && o.q > cut.qMin;

/* Which way the orbit's long axis points: the longitude of perihelion, node plus argument. */
export const longAxis = (o) => wrap(o.om + o.w);

/* The year an object was found, from its provisional designation ("2012 VP113", "90377
   Sedna (2003 VB12)"). JPL's first observation will not do: it includes images found
   afterwards in archives, years before anyone knew the object was there. */
export function foundYear(name) {
    const m = String(name).match(/\b(1[89]\d\d|20\d\d) [A-Z]{2}\d*\b/);
    return m ? Number(m[1]) : null;
}

/* Every object sorted into the section's groups. An object waiting is one that meets the
   wide rule on its present orbit but cannot be trusted yet; it is counted, never drawn. */
export function groups(objects) {
    const wideAll = objects.filter((o) => inCut(o, CUTS.wide));
    const trusted = wideAll.filter(isTrusted);
    const waiting = wideAll.filter((o) => !isTrusted(o));
    return {
        extreme: trusted.filter((o) => inCut(o, CUTS.extreme)),
        sednaLike: trusted.filter((o) => inCut(o, CUTS.sednaLike)),
        wide: trusted,
        waiting,
        waitingExtreme: waiting.filter((o) => inCut(o, CUTS.extreme)),
    };
}

/* ---- How bunched -------------------------------------------------------------------------
 *
 * The Rayleigh test for directions: each direction is a step of length one, and r is how
 * far the steps get from where they started, as a share of the distance they would cover
 * all in a line. 0 is no bunching, 1 is every one the same. p is how often directions drawn
 * at random would get at least that far, by Zar's approximation (Biostatistical Analysis,
 * eq. 27.4), good to a few parts in a thousand even for five or ten directions. */
export const MIN_SAMPLE = 5;

export function bunching(anglesDeg) {
    const n = anglesDeg.length;
    if (n === 0) return { n: 0, r: null, toward: null, p: null };
    const c = anglesDeg.reduce((s, t) => s + Math.cos(t * DEG), 0);
    const s = anglesDeg.reduce((sum, t) => sum + Math.sin(t * DEG), 0);
    const R = Math.hypot(c, s);
    const r = R / n;
    /* With no net direction the mean points nowhere. */
    const toward = r < 1e-9 ? null : wrap(Math.atan2(s, c) / DEG);
    const p = n < MIN_SAMPLE ? null : Math.min(1, Math.exp(Math.sqrt(1 + 4 * n + 4 * (n * n - R * R)) - (1 + 2 * n)));
    return { n, r, toward, p };
}

/* The two numbers for a group: its long axes, and which way its orbits tilt (the ascending
   node, where the orbit climbs through the plane of the planets). */
export const groupBunching = (members) => ({
    axes: bunching(members.map(longAxis)),
    tilts: bunching(members.map((o) => wrap(o.om))),
});

/* How thin the sample is: the bunching if the next object pointed with the group, and if it
   pointed the opposite way. */
export function oneMore(anglesDeg) {
    const now = bunching(anglesDeg);
    if (now.toward === null) return null;
    return {
        withGroup: bunching([...anglesDeg, now.toward]),
        against: bunching([...anglesDeg, now.toward + 180]),
    };
}

const apart = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

/* The Sedna-like objects are too few for a test, so they are counted: how many point within
   a quarter turn of the group's own mean direction, and how many do not. */
export function split(members) {
    const { toward } = bunching(members.map(longAxis));
    /* The page passes each object's display name as its label. */
    const label = (o) => o.label ?? o.name;
    if (toward === null) return { together: [], apart: members.map(label) };
    return {
        together: members.filter((o) => apart(longAxis(o), toward) <= 90).map(label),
        apart: members.filter((o) => apart(longAxis(o), toward) > 90).map(label),
    };
}

/* ---- The history --------------------------------------------------------------------------
 *
 * Hindsight: what the dial would have shown at the end of each year, using today's orbits
 * and the year each object was found. Drawn apart from the weekly points, and labelled as
 * hindsight, because nobody had these orbits then. */
export function backfill(members, fromYear, toYear) {
    const dated = members.map((o) => ({ o, year: foundYear(o.name) })).filter((d) => d.year !== null);
    const points = [];
    for (let year = fromYear; year <= toYear; year++) {
        const known = dated.filter((d) => d.year <= year).map((d) => d.o);
        const { n, r, p } = bunching(known.map(longAxis));
        points.push({ year, n, r: n >= MIN_SAMPLE ? r : null, p });
    }
    return points;
}

/* One week's point, as kept in the history file. */
export function weekPoint(date, objects, { joined = [] } = {}) {
    const g = groups(objects);
    const { axes, tilts } = groupBunching(g.extreme);
    const round = (x) => (x === null ? null : Math.round(x * 1000) / 1000);
    return {
        date,
        cuts: CUTS.set,
        extreme: { n: axes.n, r: round(axes.r), toward: axes.toward === null ? null : Math.round(axes.toward), p: round(axes.p), tiltR: round(tilts.r), tiltP: round(tilts.p) },
        wide: { n: g.wide.length, r: round(bunching(g.wide.map(longAxis)).r) },
        sednaLike: { together: split(g.sednaLike).together.length, apart: split(g.sednaLike).apart.length },
        waiting: g.waiting.length,
        /* Who joined the extreme group this week, by name: usually nobody. */
        ...(joined.length ? { joined } : {}),
    };
}

/* The history only grows. A week already recorded is never recomputed with later orbits,
   and a point made under other cuts does not join a history made under these: the history
   restarts, and the page says when and why. */
export function appendHistory(history, point) {
    if (history.some((h) => h.cuts !== point.cuts)) return { history: [point], restarted: true };
    if (history.some((h) => h.date >= point.date)) return { history, restarted: false };
    return { history: [...history, point], restarted: false };
}

/* ---- The section, as the digest carries it ---------------------------------------------------
 *
 * Built by the collector each run from JPL's whole list (the one it already fetches: no
 * request is made for this section) and what the data repository kept from earlier runs:
 * { cuts, members, points } - the cuts' date, last run's extreme group, and the history. */
export const emptyStore = () => ({ cuts: CUTS.set, members: null, points: [] });

/* "90377 Sedna (2003 VB12)" is Sedna; "(2012 VP113)" and "148209 (2000 CR105)" go by their
   designations. */
export function shortName(fullName) {
    const named = fullName.match(/^\s*\d+\s+([^()]+?)\s*\(/);
    if (named) return named[1];
    return fullName.match(/\(([^)]+)\)/)?.[1] ?? fullName.trim();
}

const round = (x, places) => (Number.isFinite(x) ? Math.round(x * 10 ** places) / 10 ** places : null);
const rounded = (b) => ({ n: b.n, r: round(b.r, 3), toward: b.toward === null ? null : Math.round(b.toward), p: round(b.p, 4) });

export function buildSection({ tnos, date, store = emptyStore(), backfillFrom = 2003 }) {
    const objects = tnos.map(fromCatalogue).map((o) => ({ ...o, label: shortName(o.name) }));
    const g = groups(objects);
    const sedna = new Set(g.sednaLike.map((o) => o.designation));
    const extreme = new Set(g.extreme.map((o) => o.designation));
    /* The dial: every extreme object, and any Sedna-like one outside the extreme group
       (drawn, marked as such, and not counted in the extreme group's numbers). */
    const drawn = [...g.extreme, ...g.sednaLike.filter((o) => !extreme.has(o.designation))];
    const sameCuts = store.cuts === CUTS.set;
    const before = sameCuts && store.members ? new Set(store.members) : null;
    const joined = before ? g.extreme.filter((o) => !before.has(o.designation)).map((o) => o.label) : [];
    const { history, restarted } = appendHistory(store.points ?? [], weekPoint(date, objects, { joined }));
    const { axes, tilts } = groupBunching(g.extreme);
    const angles = g.extreme.map(longAxis);
    const next = angles.length >= MIN_SAMPLE ? oneMore(angles) : null;
    const trusted = objects.filter(isTrusted);
    const year = Number(date.slice(0, 4));
    return {
        restarted,
        store: { cuts: CUTS.set, members: [...extreme].sort(), points: history },
        section: {
            cuts: CUTS,
            trusted: TRUSTED,
            objects: drawn.map((o) => ({
                designation: o.designation, name: o.label, found: foundYear(o.name),
                a: round(o.a, 1), q: round(o.q, 1), i: round(o.i, 1), axis: round(longAxis(o), 1), node: round(wrap(o.om), 1),
                extreme: extreme.has(o.designation), sednaLike: sedna.has(o.designation),
            })).sort((x, y) => x.axis - y.axis),
            axes: rounded(axes),
            tilts: rounded(tilts),
            oneMore: next ? { withGroup: round(next.withGroup.r, 3), against: round(next.against.r, 3) } : null,
            wide: rounded(bunching(g.wide.map(longAxis))),
            sednaLike: split(g.sednaLike),
            waiting: {
                count: g.waiting.length,
                extreme: g.waitingExtreme.length,
                recent: g.waiting.filter((o) => (foundYear(o.name) ?? 0) >= RUBIN_FROM).length,
                since: RUBIN_FROM,
            },
            /* Of every trans-Neptunian object with a trusted orbit. */
            shares: shares(trusted),
            backfill: backfill(g.extreme, backfillFrom, year).map((p) => ({ year: p.year, n: p.n, r: round(p.r, 3) })),
            history,
        },
    };
}

/* ---- The passing star's number -------------------------------------------------------------
 *
 * Pfalzner, Govind & Portegies Zwart 2024 (arXiv:2409.03342) predict Rubin will find
 * Sedna-like objects rising from about 0.1% to 7% of trans-Neptunian objects, and those on
 * backwards orbits from 0.15% to about 5%. Their Sedna-like is perihelion beyond 60 au with
 * eccentricity over 0.5; backwards is an inclination over 90 degrees. Counted over every
 * known trans-Neptunian object, which the collector asks JPL for. */
export const PASSING_STAR = {
    sednaLike: { now: 0.001, afterRubin: 0.07 },
    backwards: { now: 0.0015, afterRubin: 0.05 },
};
export const isPfalznerSednaLike = (o) => o.q > 60 && o.e > 0.5;
export const isBackwards = (o) => o.i > 90;

export function shares(tnos) {
    const total = tnos.length;
    if (total === 0) return { total: 0, sednaLike: null, backwards: null };
    const sednaLike = tnos.filter(isPfalznerSednaLike).length;
    const backwards = tnos.filter(isBackwards).length;
    return { total, sednaLike: { count: sednaLike, share: sednaLike / total }, backwards: { count: backwards, share: backwards / total } };
}

/* ---- The words -------------------------------------------------------------------------------
 *
 * Held by tests/rubin/faredge.test.js: a bunching figure never appears without the count it
 * rests on, the chance figure never without the warning, and nothing here states the odds
 * that any explanation is true. */
export const BIAS_WARNING = 'This simple test ignores where and when telescopes looked, which the published analyses allow for.';

const groupThousands = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function shareText(share) {
    const pct = share * 100;
    if (pct === 0) return 'none';
    if (pct < 0.01) return 'under 0.01%';
    return `${pct < 1 ? pct.toFixed(2) : pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
}

/* "about 7% of the time", for how often chance alone does as well. */
export function chanceText(p) {
    if (p < 0.001) return 'less than 0.1% of the time';
    const pct = p * 100;
    return `about ${pct < 1 ? pct.toFixed(1) : Math.round(pct)}% of the time`;
}

/* The sentence for one bunching number. what: "long axes" / "tilts". */
export function bunchingText(result, what, groupName) {
    const { n, r, toward, p } = result;
    if (n < MIN_SAMPLE) return `Only ${n} ${groupName} ${n === 1 ? 'object has' : 'objects have'} a trusted orbit: too few to measure how bunched their ${what} are.`;
    const where = toward === null ? '' : `, toward ${Math.round(toward)}°`;
    return `The ${what} of the ${n} ${groupName} objects are bunched at ${r.toFixed(2)} on a scale from 0 (none) to 1 (all the same)${where}. Directions drawn at random would look at least this bunched ${chanceText(p)}. ${BIAS_WARNING}`;
}

export function oneMoreText(anglesDeg) {
    const next = oneMore(anglesDeg);
    if (!next || anglesDeg.length < MIN_SAMPLE) return null;
    return `With ${anglesDeg.length} objects the sample is thin: one more pointing with the group would make it ${next.withGroup.r.toFixed(2)}, one pointing the opposite way ${next.against.r.toFixed(2)}.`;
}

export function splitText(members) {
    const { together, apart: away } = split(members);
    if (members.length === 0) return 'No Sedna-like object has a trusted orbit yet.';
    const list = (names) => names.join(', ').replace(/, ([^,]*)$/, ' and $1');
    if (away.length === 0) return `All ${together.length} Sedna-like objects point roughly the same way (${list(together)}).`;
    return `Of the ${members.length} Sedna-like objects, ${together.length} point roughly the same way (${list(together)}) and ${away.length} ${away.length === 1 ? 'points' : 'point'} away from them (${list(away)}).`;
}

/* Rubin's first data reached the catalogues in 2025. */
export const RUBIN_FROM = 2025;

export function waitingText(waiting, { since = RUBIN_FROM } = {}) {
    if (waiting.length === 0) return 'No object is waiting for a longer run of observations.';
    const recent = waiting.filter((o) => foundYear(o.name) !== null && foundYear(o.name) >= since).length;
    const noun = waiting.length === 1 ? 'object is' : 'objects are';
    return `${groupThousands(waiting.length)} more ${noun} waiting: on a distant orbit, but watched for under a year or with an orbit too uncertain to place on the dial. ${recent} of them were found since ${since}, the years of Rubin's first data. As they mature, the dial will change.`;
}

/* What the published analyses found, to set beside this page's simpler number. chance is
   the probability they give that the bunching is chance or bias; null where the finding is
   that the sample is consistent with random. */
export const PUBLISHED = [
    { who: 'Batygin & Brown', year: 2016, objects: 6, chance: 0.00007, finding: 'bunched', url: 'https://arxiv.org/abs/1601.05438' },
    { who: 'Shankman et al. (OSSOS)', year: 2017, objects: 8, chance: null, finding: 'consistent with random', url: 'https://arxiv.org/abs/1706.05348' },
    { who: 'Brown & Batygin', year: 2019, objects: 14, chance: 0.002, finding: 'bunched', url: 'https://arxiv.org/abs/1901.07115' },
    { who: 'Napier et al.', year: 2021, objects: 14, chance: null, finding: 'consistent with random', url: 'https://arxiv.org/abs/2102.05601' },
    { who: 'Brown & Batygin', year: 2021, objects: 11, chance: 0.004, finding: 'bunched', url: 'https://arxiv.org/abs/2108.09868' },
];

/* The explanations, each with what it predicts, where that is published, and which of the
   section's measurements bears on it. No row says how likely it is. */
export const EXPLANATIONS = [
    {
        name: 'A hidden planet, there today',
        predicts: 'The long axes of orbits beyond about 250 AU stay bunched, the orbits tilt a common way, some stay well clear of Neptune, and some are steeply tilted or backwards.',
        source: 'Batygin, Adams, Brown & Becker 2019',
        url: 'https://arxiv.org/abs/1902.10103',
        evidence: 'axes',
    },
    {
        name: 'An early alignment, since drifted',
        predicts: 'The Sedna-like orbits pointed the same way about 4.2 billion years ago and have drifted apart under the four giant planets. Its authors say this and a planet there today cannot both be true.',
        source: 'Chen et al. 2025',
        url: 'https://arxiv.org/abs/2508.02162',
        evidence: 'split',
    },
    {
        name: 'A star that passed close',
        predicts: 'A passing star explains why Sedna-like and backwards orbits exist at all, and Rubin should find both to be common: Sedna-like rising from 0.1% to 7% of the objects beyond Neptune, backwards from 0.15% to 5%. It makes no claim about which way orbits point.',
        source: 'Pfalzner, Govind & Portegies Zwart 2024',
        url: 'https://arxiv.org/abs/2409.03342',
        evidence: 'shares',
    },
    {
        name: 'Nothing unusual',
        predicts: 'The directions are random once you allow for where telescopes looked.',
        source: 'Shankman et al. 2017; Napier et al. 2021',
        url: 'https://arxiv.org/abs/2102.05601',
        evidence: 'chance',
    },
];
