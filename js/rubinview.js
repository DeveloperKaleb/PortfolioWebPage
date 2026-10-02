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
import { planetsOn } from './planets.js';
import { jdFromDate } from './orbit.js';

/* Same origin as the site: rubin-data is published with GitHub Pages at
   developerkaleb.github.io/rubin-data/, beside developerkaleb.github.io/PortfolioWebPage/.
   So the tab keeps the site's rule that a visitor's browser contacts nothing but the site's
   own host (NOTES.md, "The site loads nothing from anywhere else"). raw.githubusercontent
   would have been a third party seeing every visitor. */
export const DATA_ROOT = '/rubin-data';
export const DIGEST_URL = `${DATA_ROOT}/digest/latest.json`;
export const CHANGES_URL = (month) => `${DATA_ROOT}/changes/${month}.json`;
export const DATA_REPO = 'https://github.com/DeveloperKaleb/rubin-data';

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
        `${counts.confirmedByRubin ?? counts.withRubinH} confirmed by Rubin`,
        ...(counts.discoveryKnown ? [`${counts.discoveredByRubin} found by Rubin`] : []),
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

/* The objects on the map, the planets where they are on the digest's date (js/planets.js),
   and the radius to fit them: the furthest object rounded up to a round number of AU. */
export function mapData(digest) {
    const { passes, watch } = sections(digest);
    const marks = [
        ...passes.map((e) => ({ entry: e, kind: e.flags.includes('disputed') ? 'disputed' : 'passes' })),
        ...watch.map((e) => ({ entry: e, kind: 'watch' })),
    ].filter((m) => Number.isFinite(m.entry.now?.x) && Number.isFinite(m.entry.now?.y));
    const planets = planetsOn(jdFromDate(new Date(`${digest.date}T00:00:00Z`)));
    const furthest = Math.max(31, ...marks.map((m) => Math.hypot(m.entry.now.x, m.entry.now.y)));
    const radius = Math.ceil(furthest / 50) * 50;
    return { marks, radius, planets };
}

/* Who found it, when the collector has looked it up: "17 July 2007 at Palomar
   Mountain", or "... by Rubin Observatory" for Rubin's own discoveries. Null while the
   lookup is still pending. */
export function discoveryText(entry) {
    const d = entry.discovery;
    if (!d) return null;
    const when = longDate(d.date);
    if (d.byRubin) return `${when}, by Rubin Observatory`;
    return `${when}, at ${d.stationName ?? `observatory ${d.station}`}`;
}

/* ---- Rubin as the source of truth ---------------------------------------------------- */

/* What Rubin itself has of the object, in words. Objects Rubin has not measured are
   kept, labelled - the owner's choice - and the label falls away as the survey reaches
   them. */
export function rubinStatus(entry) {
    const r = entry.rubin;
    if (!r?.confirmed) return { confirmed: false, text: 'Not yet confirmed by Rubin' };
    const span = r.arcDays >= 1 ? ` over ${Math.round(r.arcDays)} days` : '';
    const last = r.lastSeen ? `, last ${longDate(r.lastSeen)}` : '';
    return { confirmed: true, text: `Confirmed by Rubin: ${r.detections} detections${span}${last}` };
}

/* Rubin's values against JPL's, in words, or null when there was nothing to check. */
export function crossCheckText(entry) {
    const c = entry.crossCheck;
    if (!c) return null;
    if (c.agrees) return 'Agrees with JPL';
    const parts = [];
    if (c.dH !== undefined && !c.dHok) parts.push(`brightness by ${Math.abs(c.dH).toFixed(1)} mag`);
    if (Math.abs(c.dR ?? 0) > 0.1) parts.push(`distance by ${Math.abs(c.dR).toFixed(2)} AU`);
    if (Math.abs(c.dA ?? 0) > 0.05) parts.push(`orbit size by ${Math.round(Math.abs(c.dA) * 100)}%`);
    if (Math.abs(c.dI ?? 0) > 1) parts.push(`tilt by ${Math.abs(c.dI).toFixed(1)} degrees`);
    return `Differs from JPL: ${parts.join(', ')}`;
}

/* The month's measured offset between Rubin's brightness and JPL's catalogue, in words. */
export function offsetText(digest) {
    const c = digest.catalogue;
    if (!c?.used) return null;
    const dir = c.offsetH >= 0 ? 'fainter' : 'brighter';
    return `Rubin measures these objects ${Math.abs(c.offsetH).toFixed(2)} magnitudes ${dir} than JPL's catalogue, as a median over the ${c.from} it has measured - so where Rubin has not yet looked, sizes from the catalogue may run a little large.`;
}

/* ---- Choosing which cards show -------------------------------------------------------- */

/* Cards show only for objects the reader picks - by name in each section, or on the
   map - because a card for every object buried the rest of the page. A section with more
   objects than this gets a filter box over its names. */
export const FILTER_FROM = 24;

/* Whether an object matches the filter box: by name or designation, ignoring case and
   spaces, so "2017of" finds 2017 OF201. */
export function matchesQuery(entry, query) {
    const squash = (s) => String(s).toLowerCase().replace(/\s+/g, '');
    const q = squash(query);
    if (!q) return true;
    return squash(displayName(entry)).includes(q) || squash(entry.designation).includes(q) || squash(entry.name).includes(q);
}

/* ---- Zooming the map ------------------------------------------------------------------
 *
 * The map spans a hundred AU or more, so the inner planets are a dot at the centre until
 * the reader zooms in. A view is a scale (pixels per AU) and a centre (AU); marks keep
 * their size in pixels at every zoom. Pure, so the maths is tested on its own. */

/* From fitting everything, in to about the size of Mercury's orbit. */
export const MAP_ZOOM = { max: 400, step: 2 };

export function initialView(radiusAU, sizePx) {
    const scale = (sizePx / 2 - 24) / radiusAU;
    return { scale, cx: 0, cy: 0, fitScale: scale, radiusAU, sizePx };
}

/* Map coordinates (AU, y up) to the drawing (pixels, y down), and back. */
export const toScreen = (view, x, y) => [view.sizePx / 2 + (x - view.cx) * view.scale, view.sizePx / 2 - (y - view.cy) * view.scale];
export const toWorld = (view, sx, sy) => [view.cx + (sx - view.sizePx / 2) / view.scale, view.cy - (sy - view.sizePx / 2) / view.scale];

const clampView = (view) => {
    const scale = Math.min(view.fitScale * MAP_ZOOM.max, Math.max(view.fitScale, view.scale));
    /* The centre stays where there is something to see. */
    const limit = view.radiusAU;
    return { ...view, scale, cx: Math.max(-limit, Math.min(limit, view.cx)), cy: Math.max(-limit, Math.min(limit, view.cy)) };
};

/* Zoom by a factor, keeping the point under the anchor (AU) where it is on screen. At
   the widest it re-centres on the Sun, so zooming out always comes home. */
export function zoomAt(view, factor, anchor = [view.cx, view.cy]) {
    const scale = Math.min(view.fitScale * MAP_ZOOM.max, Math.max(view.fitScale, view.scale * factor));
    const k = view.scale / scale;
    const next = clampView({ ...view, scale, cx: anchor[0] - (anchor[0] - view.cx) * k, cy: anchor[1] - (anchor[1] - view.cy) * k });
    return scale <= view.fitScale ? { ...next, cx: 0, cy: 0 } : next;
}

/* Drag by some pixels; the map moves with the pointer. */
export const panBy = (view, dxPx, dyPx) => clampView({ ...view, cx: view.cx - dxPx / view.scale, cy: view.cy + dyPx / view.scale });

export const zoomLevel = (view) => view.scale / view.fitScale;

/* Distance rings at a round spacing for the zoom: about four across the visible radius. */
const NICE = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
export function ringSpacing(view) {
    const visible = (view.sizePx / 2) / view.scale;
    return NICE.find((s) => visible / s <= 5) ?? NICE.at(-1);
}

/* A planet is drawn once its orbit is big enough on screen to tell from the Sun, and
   labelled once there is room for its name. */
export const PLANET_DRAW_PX = 6;
export const PLANET_LABEL_PX = 26;
