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
import { jdFromDate, positionAt, orbitPath, tooBrightForRubin } from './orbit.js';
import { moonOffset, moonRing, moonDistance, MOON_PARENTS, BUILT_IN_MOONS } from './moons.js';
import { NEIGHBOURS } from './centauri.js';

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

/* The diameters the calibration list (js/equilibrium.js) gives for distant objects, each
   measured directly and cited there: imaging, occultations or thermal emission. Preferred
   over the digest's, which works a size out from H and a measured albedo, and so for Pluto
   takes in Charon's light: 2,018 km, where New Horizons measured 2,377 (owner,
   2026-11-18). By name, as the list has it, without a designation in brackets. */
const LISTED_DIAMETERS = new Map(CALIBRATION.filter((b) => b.population === 'tno').map((b) => [b.name.replace(/\s*\(.*\)$/, ''), b.diameterKm]));

/* Its size, said honestly: measured where it was, otherwise the size its brightness
   implies at the albedos typical of objects about as bright (the weighted median, from
   within SIZE_WIDTH magnitudes), marked as an estimate. */
export function sizeOf(entry) {
    const listed = LISTED_DIAMETERS.get(displayName(entry));
    if (listed) return { km: listed, text: kilometres(listed), measured: true };
    if (entry.sizeFrom === 'measured') return { km: entry.diameterKm, text: `${kilometres(entry.diameterKm)}`, measured: true };
    const km = diameterFromH(entry.H, albedoQuantile(entry.H, 0.5));
    return { km, text: `about ${kilometres(Math.round(km / 10) * 10)}`, measured: false };
}

/* The albedo below which the given share of objects about as bright fall (weighted).
   Only objects within about a magnitude: uncapped, the bright end takes in dark albedos
   and overstates the size threefold (Eris from H alone: 6,500 km, not 2,326). */
function albedoQuantile(H, q) {
    const { albedos, weights } = albedosNear(H, { maxWidth: SIZE_WIDTH });
    const order = albedos.map((a, k) => [a, weights[k]]).sort((x, y) => x[0] - y[0]);
    let total = 0;
    for (const [albedo, w] of order) {
        total += w;
        if (total >= q) return albedo;
    }
    return order.at(-1)[0];
}

/* The share of objects about as bright left out at each end of an estimated size's range:
   the range runs from the 10th to the 90th percentile of their albedos. */
export const SIZE_RANGE_TAIL = 0.1;

/* Its size with, for an estimate, how small it would be if its surface were as bright as
   all but a tenth of objects about as bright (low), and how large if as dark (high). */
export function sizeRange(entry) {
    const size = sizeOf(entry);
    if (size.measured) return size;
    return {
        ...size,
        low: diameterFromH(entry.H, albedoQuantile(entry.H, 1 - SIZE_RANGE_TAIL)),
        high: diameterFromH(entry.H, albedoQuantile(entry.H, SIZE_RANGE_TAIL)),
    };
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
    /* An implausibly bright object is on no list until follow-up settles it (js/verdict.js). */
    const listed = digest.entries.filter((e) => !e.flags.includes('implausiblyBright'));
    /* Objects whose shape has been seen are known, not likely: they head the section. */
    const known = listed.filter(isKnownShape);
    const passes = listed.filter((e) => e.passes && !isKnownShape(e));
    const watch = listed.filter((e) => !e.passes && e.watch);
    const largeIfDark = listed
        .filter((e) => !e.passes && !e.watch && e.flags.includes('largeIfDark'))
        .sort((a, b) => b.chanceIfDark - a.chanceIfDark || b.chance - a.chance);
    return { known, passes, watch, largeIfDark };
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
    const { known, passes, watch } = sections(digest);
    const marks = [
        ...[...known, ...passes].map((e) => ({ entry: e, kind: e.flags.includes('disputed') ? 'disputed' : 'passes' })),
        ...watch.map((e) => ({ entry: e, kind: 'watch' })),
    ].filter((m) => Number.isFinite(m.entry.now?.x) && Number.isFinite(m.entry.now?.y));
    const jd = jdFromDate(new Date(`${digest.date}T00:00:00Z`));
    const planets = worldsOn(jd);
    const furthest = Math.max(31, ...marks.map((m) => Math.hypot(m.entry.now.x, m.entry.now.y)));
    const radius = Math.ceil(furthest / 50) * 50;
    /* In 3D an object far above or below the plane can reach further across the picture
       than its distance along the plane, so that view fits the true distances instead. */
    const furthest3D = Math.max(furthest, ...marks.map((m) => Math.hypot(m.entry.now.x, m.entry.now.y, m.entry.now.z ?? 0)));
    const radius3D = Math.ceil(furthest3D / 50) * 50;
    /* The digest carries the collector's latest moon fit; an older digest, the built-in one. */
    return { marks, radius, radius3D, planets, moons: moonsOn(jd, planets, known, digest.moons ?? BUILT_IN_MOONS) };
}

/* What the map draws of an object's orbit once it is picked (owner, 2026-11-16): the
   path, through where it is now; or, where the orbit is not pinned down yet (the
   uncertainOrbit flag), no path but a note saying so - a path drawn from a poor orbit would
   show the reader something nobody knows. A digest from before the collector kept the
   orbit's two turning angles (om and w) cannot draw it either. */
export function orbitOnMap(entry) {
    const o = entry.orbit;
    if (entry.flags.includes('uncertainOrbit')) {
        const q = entry.orbitQuality;
        const rows = [['Orbit not yet pinned down:', 'not drawn until it is']];
        if (q?.arcDays !== null && q?.arcDays !== undefined) {
            const span = q.arcDays < 730 ? `${Math.round(q.arcDays)} days` : `${Math.round(q.arcDays / 365.25)} years`;
            rows.push([`${q.nObs ? `${q.nObs} sightings` : 'Seen'} over ${span};`, `uncertainty ${q.conditionCode ?? '?'} on the 0 (well known) to 9 scale`]);
        }
        return { path: null, note: 'orbit not yet known', rows };
    }
    if (!Number.isFinite(o?.om) || !Number.isFinite(o?.w) || !Number.isFinite(entry.now?.z)) {
        return { path: null, note: 'orbit with the next update', rows: [['Orbit:', 'drawn once the next weekly update arrives']] };
    }
    return { path: orbitPath(o, { through: entry.now }), note: null, rows: [] };
}

/* The view moved so a point is in the middle of the picture, keeping its zoom: what the
   map does when something on it is picked, so zooming and turning go about that body
   rather than the centre of its system (owner, 2026-11-16). Kept as near as the view
   allows (clampView). */
export const centredOn = (view, [x, y, z = 0]) => ({ ...clampView({ ...view, cx: x, cy: y }), cz: z });

/* Whether a view is at its home: the place's own middle. */
export const atHome = (view) => view.cx === (view.homeX ?? 0) && view.cy === (view.homeY ?? 0) && (view.cz ?? 0) === (view.homeZ ?? 0);

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
    /* Pluto: brighter than a Rubin visit can measure, so never "not yet". Worked out from the
       entry's brightness too, so digests from before the collector recorded it say so. */
    if (r?.tooBright || (Number.isFinite(entry.now?.V) && tooBrightForRubin(entry.now.V))) {
        return { confirmed: false, tooBright: true, text: 'Too bright for Rubin to measure' };
    }
    if (!r?.confirmed) return { confirmed: false, text: "Rubin's measurements not yet public" };
    const span = r.arcDays >= 1 ? ` over ${Math.round(r.arcDays)} days` : '';
    const last = r.lastSeen ? `, last ${longDate(r.lastSeen)}` : '';
    return { confirmed: true, text: `Confirmed by Rubin: ${r.detections} detections${span}${last}` };
}

/* Where the object's brightness comes from, and by which route when it is Rubin's own:
   its alerts, which the Fink broker collects, or its observations as Rubin reported them
   to the Minor Planet Center, for objects the alerts have not reached. Both count as
   confirmed by Rubin; the card says which (the owner's choice, 2026-11-11). Digests from
   before the second route have no `via`, and theirs were all alerts. */
export function brightnessText(entry) {
    if (!String(entry.hSource).startsWith('Rubin')) return 'from the catalogue (JPL)';
    return entry.rubin?.via === 'MPC'
        ? `from Rubin's observations, as reported to the Minor Planet Center (${entry.detections})`
        : `from Rubin's alerts, through Fink (${entry.detections})`;
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
/* Zoomed all the way in, Charon (13,000 km from Pluto) is a few pixels clear of it. */
export const MAP_ZOOM = { max: 50000, step: 2 };

/* From far out, zooming goes deeper still: in until the middle of the picture is this many
   AU from its edge, whatever the view's reach - so a body picked in the view of the nearest
   bodies, hundreds of thousands of AU across, can be zoomed in on until its planets show
   (owner, 2026-11-18: Barnard's Star's four lie within 0.04 AU of it). */
export const DEEPEST_AU = 0.005;
export const maxZoomOf = (view) => Math.max(MAP_ZOOM.max, (view.radiusAU ?? 0) / DEEPEST_AU);

/* The map is the tab's centrepiece, so it is wider than the text (owner, 2026-10-05): 750px,
   125% of the 600px column, reaching into the margins. On a narrower screen it takes the
   screen's width less a 16px gutter each side. The drawing is made at the size it is shown,
   so labels and marks stay their intended size instead of being stretched with it. */
export const MAP_WIDTH = 750;
export const MAP_GUTTER = 16;
export const mapSizeFor = (viewportPx) => Math.max(240, Math.min(MAP_WIDTH, Math.round(viewportPx - 2 * MAP_GUTTER)));

/* Full screen (owner, 2026-11-18), the map stays round and square: as large as fits the
   screen, less the gutter, and less the controls - above it (above, in pixels, with the
   space round them), or beside it (beside) on a wide screen, whichever leaves it larger. */
export const fullScreenSizeFor = (widthPx, heightPx, { above = 0, beside = 0 } = {}) => Math.max(240, Math.floor(Math.min(widthPx - 2 * MAP_GUTTER - beside, heightPx - above - MAP_GUTTER)));

/* The same view drawn at another size: the same zoom, middle and reach, so the picture is
   simply larger or smaller. The fitted scale leaves a 24px margin, so both scales move by
   the ratio of what is inside it. */
export function resizedView(view, sizePx) {
    const k = (sizePx / 2 - 24) / (view.sizePx / 2 - 24);
    return { ...view, sizePx, scale: view.scale * k, fitScale: view.fitScale * k };
}

/* A view that fits a radius about a home: the Sun unless told otherwise (the map can also
   be at Alpha Centauri, or pulled back to hold both - js/centauri.js). The home's height
   above the plane matters only in 3D, where the picture turns about it. */
export function initialView(radiusAU, sizePx, [homeX, homeY, homeZ = 0] = [0, 0]) {
    const scale = (sizePx / 2 - 24) / radiusAU;
    return { scale, cx: homeX, cy: homeY, cz: homeZ, fitScale: scale, radiusAU, sizePx, homeX, homeY, homeZ };
}

/* Map coordinates (AU, y up) to the drawing (pixels, y down), and back. */
export const toScreen = (view, x, y) => [view.sizePx / 2 + (x - view.cx) * view.scale, view.sizePx / 2 - (y - view.cy) * view.scale];
export const toWorld = (view, sx, sy) => [view.cx + (sx - view.sizePx / 2) / view.scale, view.cy - (sy - view.sizePx / 2) / view.scale];

const clampView = (view) => {
    const scale = Math.min(view.fitScale * maxZoomOf(view), Math.max(view.fitScale, view.scale));
    /* The centre stays where there is something to see: within the fitted radius of home. */
    const limit = view.radiusAU;
    const near = (value, home) => Math.max(home - limit, Math.min(home + limit, value));
    return { ...view, scale, cx: near(view.cx, view.homeX ?? 0), cy: near(view.cy, view.homeY ?? 0) };
};

/* Zoom by a factor, keeping the point under the anchor (AU) where it is on screen. At
   the widest it re-centres on its home, so zooming out always comes home. */
export function zoomAt(view, factor, anchor = [view.cx, view.cy]) {
    const scale = Math.min(view.fitScale * maxZoomOf(view), Math.max(view.fitScale, view.scale * factor));
    const k = view.scale / scale;
    const next = clampView({ ...view, scale, cx: anchor[0] - (anchor[0] - view.cx) * k, cy: anchor[1] - (anchor[1] - view.cy) * k });
    return scale <= view.fitScale ? { ...next, cx: view.homeX ?? 0, cy: view.homeY ?? 0, cz: view.homeZ ?? 0 } : next;
}

/* Drag by some pixels; the map moves with the pointer. */
export const panBy = (view, dxPx, dyPx) => clampView({ ...view, cx: view.cx - dxPx / view.scale, cy: view.cy + dyPx / view.scale });

export const zoomLevel = (view) => view.scale / view.fitScale;

/* Distance rings at a round spacing for the zoom: about four across the visible radius. */
const NICE = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000,
    10000, 20000, 50000, 100000, 200000, 500000];
export function ringSpacing(view) {
    const visible = (view.sizePx / 2) / view.scale;
    return NICE.find((s) => visible / s <= 5) ?? NICE.at(-1);
}

/* The rings that cross the picture: radii at that spacing about a point whose distance
   from the middle of the view is given, in AU. Rings wholly off the picture are left out,
   which matters once the map can be 270,000 AU from the Sun - a ring that far off is
   millions of pixels wide, and browsers draw such things badly. */
export function ringRadii(view, distanceAU, most = 60, stretch = 1) {
    const spacing = ringSpacing(view);
    /* In 3D a ring is squashed top to bottom (stretch is one over its squash, ringStretch),
       so a ring too wide to cross the picture side to side can still cross it at the top
       or bottom. */
    const reach = (view.sizePx * Math.SQRT1_2) / view.scale;
    const first = Math.max(1, Math.ceil((distanceAU - reach) / spacing));
    const radii = [];
    for (let n = first; n * spacing <= (distanceAU + reach) * stretch && radii.length < most; n++) radii.push(n * spacing);
    return radii;
}

/* A ring's label: "30 AU", "0.05 AU", "100,000 AU". */
export const ringLabel = (radiusAU) => `${String(Number(radiusAU.toPrecision(6))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} AU`;

/* ---- Travelling between places -----------------------------------------------------------
 *
 * The map moves from one view to another the way a camera would: the scale changes evenly
 * as a ratio, and the centre moves in step with how much is in view, so that leaving a
 * place it stays in the picture until the end, and arriving it is in the picture from the
 * start. A journey between the Sun and Alpha Centauri goes by way of the view that holds
 * both. t runs from 0 to 1; nothing here keeps time. */
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

export function glideView(from, to, t) {
    const k = ease(Math.min(1, Math.max(0, t)));
    if (k >= 1) return to;
    const scale = from.scale * (to.scale / from.scale) ** k;
    const span = 1 / to.scale - 1 / from.scale;
    const w = Math.abs(span) < 1e-12 * (1 / from.scale) ? k : (1 / scale - 1 / from.scale) / span;
    const [fz, tz] = [from.cz ?? 0, to.cz ?? 0];
    return { ...to, scale, cx: from.cx + (to.cx - from.cx) * w, cy: from.cy + (to.cy - from.cy) * w, cz: fz + (tz - fz) * w };
}

export function journeyView(from, via, to, t) {
    return t < 0.5 ? glideView(from, via, t * 2) : glideView(via, to, t * 2 - 1);
}

/* ---- Flat or 3D --------------------------------------------------------------------------
 *
 * The map can be turned and tipped to show depth (owner, 2026-11-16), drawn by hand with no
 * 3D library. A camera is a turn about the plane's pole, then a tilt of the plane away from
 * the reader, both in radians; flat is straight down from above, the map as it always
 * was. The projection is parallel, not in perspective, so the scale is the same at every
 * depth: a ring in the plane becomes an ellipse, a ball (the light, the clear zones about
 * each star) stays a circle, and the AU rings still measure what they cross. */
export const FLAT = { turn: 0, tilt: 0 };
export const TILT_3D = 55 * Math.PI / 180;

/* A camera's maths, once per drawing: where a point lands in the picture, which way a
   direction points there (direction), and how much a ring in the plane is squashed top
   to bottom (squash: 1 seen from straight above or below, 0 edge-on). */
export function projector(view, cam = FLAT) {
    const [ct, st, cr, sr] = [Math.cos(cam.tilt), Math.sin(cam.tilt), Math.cos(cam.turn), Math.sin(cam.turn)];
    const half = view.sizePx / 2;
    const cz = view.cz ?? 0;
    /* Across the picture, and up it: the turn spins the plane, the tilt tips it away. */
    const across = (dx, dy) => dx * cr - dy * sr;
    const up = (dx, dy, dz) => (dx * sr + dy * cr) * ct + dz * st;
    const project = (x, y, z = 0) => {
        const [dx, dy, dz] = [x - view.cx, y - view.cy, z - cz];
        return [half + across(dx, dy) * view.scale, half - up(dx, dy, dz) * view.scale];
    };
    project.direction = (dx, dy, dz = 0) => [across(dx, dy), -up(dx, dy, dz)];
    project.squash = Math.abs(ct);
    return project;
}

/* Dragging turns the map and tips it: each pixel across is a third of a degree of turn,
   and each one down tips it a third of a degree further over - all the way round if the
   reader likes, through edge-on to seeing the plane from below (owner, 2026-11-16). Both
   angles are kept between minus and plus half a turn. */
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
export function turnBy(cam, dxPx, dyPx) {
    const step = Math.PI / 540;
    return { turn: wrap(cam.turn - dxPx * step), tilt: wrap(cam.tilt + dyPx * step) };
}

/* How much further the rings must reach for a squash, short of the endless rings edge-on
   would ask for (ringRadii caps how many are drawn anyway). */
export const ringStretch = (squash) => 1 / Math.max(squash, 0.05);

/* ---- Where nothing has been seen -----------------------------------------------------------
 *
 * Beyond 1,000 AU from the Sun the map is hatched, except close about the other system's
 * bodies (js/centauri.js). Given the clear zones as circles in AU, this answers what to
 * draw: nothing when the whole picture is inside one, otherwise the circles, in pixels,
 * that reach into the picture and so must be cut out of the hatching. The hatching is
 * round, `reachPx` from the middle (the whole square when not given). Each zone is a ball,
 * so in 3D (project, from projector) it is still a circle of the same size. */
export function unseenHoles(view, zones, reachPx, project = (x, y) => toScreen(view, x, y)) {
    const half = view.sizePx / 2;
    const corner = reachPx ?? half * Math.SQRT2;
    const holes = [];
    for (const zone of zones) {
        const [x, y] = project(zone.x, zone.y, zone.z ?? 0);
        const away = Math.hypot(x - half, y - half);
        const r = zone.radiusAU * view.scale;
        if (away + corner <= r) return null;
        if (away - corner < r && r >= 0.5) holes.push({ x, y, r });
    }
    return holes;
}

/* A planet is drawn once its orbit is big enough on screen to tell from the Sun, and
   labelled once there is room for its name. */
export const PLANET_DRAW_PX = 6;
export const PLANET_LABEL_PX = 26;

/* ---- Distance along the plane, and out of it ---------------------------------------------
 *
 * The map is seen from above the plane of Earth's orbit, so it shows an object's distance
 * along that plane, not its true distance from the Sun. For a steeply tilted orbit the
 * two differ a lot: 2014 UN225 (tilted 53 degrees) is 43.7 AU from the Sun but 26.3 AU
 * along the plane, 34.9 AU below it, so the map drew it between the 20 and 30 AU rings.
 * So the tooltip and table give both. A side view may come later. */

/* Below this height the object is near enough the plane that its map position tells the
   truth, and only the true distance is given. */
export const PLANE_NOTE_AU = 1;

export function planeParts(entry) {
    const { r, x, y, z } = entry.now;
    const along = Math.hypot(x, y);
    /* z is recorded from 2026-10-05; before that only its size can be worked out. */
    const height = Number.isFinite(z) ? Math.abs(z) : Math.sqrt(Math.max(0, r * r - along * along));
    const side = Number.isFinite(z) ? (z >= 0 ? 'above' : 'below') : null;
    return { r, along, height, side };
}

export function planeText(entry) {
    const { along, height, side } = planeParts(entry);
    if (height < PLANE_NOTE_AU) return null;
    return `${au(along)} along the plane, ${au(height)} ${side ? `${side} it` : 'out of it'}`;
}

/* ---- Planets and tundrs ------------------------------------------------------------------
 *
 * The site's stance (NOTES.md): a planet is rounded by its own gravity, has a surface, and
 * has no fusion in its core. The four giants have no surface, so the site calls them
 * tundrs (Old Norse for tinder: ready but never lit as a star), each kind named after what
 * it is mostly made of - never after where it formed, as "gas giant" and "ice giant" are.
 * Brown dwarfs are the heaviest hydrogen tundrs, up to the star line at about 80 Jupiter
 * masses (owner, 2026-11-14). The page explains this in a dialog wherever the word
 * appears. */
export const TUNDRS = { Jupiter: 'hydrogen', Saturn: 'hydrogen', Uranus: 'water', Neptune: 'water' };
export const KIND_LABEL = { planet: 'Planet', hydrogen: 'Hydrogen Tundr', water: 'Water Tundr' };
export const bodyKind = (name) => TUNDRS[name] ?? 'planet';

/* ---- Labels on the map -------------------------------------------------------------------
 *
 * Pluto is a planet on this site, so the map names it as it names Mercury. Every object
 * with a proper name (Pluto, Eris, Sedna...) is labelled when there is room; objects with
 * only a designation are not. Labels are kept in priority order - planets and tundrs
 * first, then the largest objects - and one that would overlap a label already kept, or
 * run off the map, is left out. Zooming in makes room, so more names appear. */

/* An object's proper name, or null when it has only a designation. */
export const properName = (entry) => entry.name.match(/^\d+\s+(.+?)\s+\(/)?.[1] ?? null;

/* The label's box, from where the text sits beside its dot: 12px text, about 7px a
   character, set 7px right of and above the dot. */
export const LABEL = { offset: 7, charPx: 7, linePx: 14 };

export function placeLabels(labels, sizePx) {
    const kept = [];
    for (const label of labels) {
        const x0 = label.x + LABEL.offset;
        const y1 = label.y - LABEL.offset + 3;
        const box = { x0, x1: x0 + label.text.length * LABEL.charPx, y0: y1 - LABEL.linePx, y1 };
        if (box.x0 < 0 || box.x1 > sizePx || box.y0 < 0 || box.y1 > sizePx) continue;
        if (kept.some(({ box: k }) => box.x0 < k.x1 && k.x0 < box.x1 && box.y0 < k.y1 && k.y0 < box.y1)) continue;
        kept.push({ ...label, box });
    }
    return kept;
}

/* ---- NASA's images ------------------------------------------------------------------------
 *
 * NASA has no one page of every image of an object, and its image library's search mixes
 * real pictures with artist's concepts (Eris: 2 results, one a painting). So this is a
 * checked list (owner's choice, 2026-10-02): only objects NASA has released real images
 * of, each linked to the best NASA page for them. Checked against NASA's image library
 * and science.nasa.gov on 2026-10-02; Haumea, Orcus, Varda and others have telescope
 * images, but none NASA released. A visitor's browser contacts NASA only if they click.
 * Keyed by designation. */
export const NASA_IMAGES = {
    134340: { url: 'https://science.nasa.gov/dwarf-planets/pluto/', text: "NASA's Pluto page, with New Horizons' close-up images (2015)" },
    136199: { url: 'https://science.nasa.gov/asset/hubble/hubble-view-of-eris-and-dysnomia-unannotated/', text: 'Hubble: Eris and its moon Dysnomia (2005-06)' },
    90377: { url: 'https://science.nasa.gov/asset/hubble/hstacs-co-added-image-of-sedna-march-16-2004/', text: "Hubble's sharpest view of Sedna, one pixel wide (2004)" },
    50000: { url: 'https://science.nasa.gov/photojournal/new-horizons-spies-a-kuiper-belt/', text: 'New Horizons: Quaoar from 2.1 billion km (2016)' },
    136472: { url: 'https://science.nasa.gov/asset/hubble/makemake-and-its-moon/', text: 'Hubble: Makemake and its moon (2015)' },
    225088: { url: 'https://science.nasa.gov/asset/hubble/hubble-images-of-2007-or10/', text: 'Hubble: Gonggong and its moon (2009-10)' },
};

/* What the card says about NASA's images of an object: a link, or that there are none. */
export const nasaImages = (entry) => entry.images ?? NASA_IMAGES[entry.designation] ?? null;

/* ---- The known worlds -----------------------------------------------------------------------
 *
 * The planets and tundrs get cards too (owner, 2026-10-02), in their own row at the top of
 * the gravity section: they are certain, not likely. Their sizes are measured, from NASA's
 * Planetary Fact Sheet (equatorial diameter; the tundrs' at the 1-bar level, as they have
 * no surface); their distance from the Sun is where they are on the digest's date
 * (js/planets.js). Every one has a NASA page with its missions' images. */
export const WORLD_PREFIX = 'world:';
export const KNOWN_WORLDS = [
    { name: 'Mercury', km: 4879, found: 'Known since antiquity' },
    { name: 'Venus', km: 12104, found: 'Known since antiquity' },
    { name: 'Earth', km: 12756, found: null },
    { name: 'Mars', km: 6792, found: 'Known since antiquity' },
    { name: 'Ceres', km: 939.4, across: 'across, on average', found: '1 January 1801, by Giuseppe Piazzi, from Palermo', images: { url: 'https://science.nasa.gov/dwarf-planets/ceres/', text: "NASA's Ceres page, with Dawn's close-up images (2015-18)" } },
    { name: 'Jupiter', km: 142984, found: 'Known since antiquity' },
    { name: 'Saturn', km: 120536, found: 'Known since antiquity' },
    { name: 'Uranus', km: 51118, found: '13 March 1781, by William Herschel, from Bath' },
    { name: 'Neptune', km: 49528, found: "23 September 1846, by Johann Galle at Berlin Observatory, where Urbain Le Verrier's maths said it would be" },
];

export function knownWorlds(digest) {
    const where = new Map(worldsOn(jdFromDate(new Date(`${digest.date}T00:00:00Z`)), { samples: 2 }).map((p) => [p.name, p]));
    return KNOWN_WORLDS.map((w) => {
        const p = where.get(w.name);
        return {
            ...w,
            designation: WORLD_PREFIX + w.name,
            world: true,
            kind: bodyKind(w.name),
            a: p.a,
            across: w.across ?? 'across the equator',
            now: { r: p.r, x: p.x, y: p.y, z: p.z },
            images: w.images ?? { url: `https://science.nasa.gov/${w.name.toLowerCase()}/`, text: `NASA's ${w.name} page, with its missions' images` },
        };
    });
}

/* ---- Known shapes ----------------------------------------------------------------------------
 *
 * "Known worlds" is read literally (owner, 2026-10-05): every body the calibration list
 * (js/equilibrium.js) marks as seen to be shaped by gravity; the round moons follow below
 * (KNOWN_MOONS). Apart from the moons, that is
 * Pluto, Eris, Haumea, Makemake and Quaoar from the digest, and Ceres. Their cards move up
 * from the likely row, keeping all their Rubin details. Bodies the list calls uncertain
 * (Gonggong, Sedna, Orcus...) stay likely. Matched by name. */
export const KNOWN_SHAPES = new Set(CALIBRATION.filter((b) => b.shaped === 'yes' && b.population !== 'moon').map((b) => b.name));
export const isKnownShape = (entry) => KNOWN_SHAPES.has(displayName(entry));

/* Ceres, from JPL's orbit (sbdb.api, 2026-10-05, full precision; epoch 2026-Jul-07.0).
   Two-body, so Jupiter's pull makes it drift a little over the years: plenty for the map. */
export const CERES_ELEMENTS = { a: 2.765552595034094, e: 0.07969229514816586, i: 10.58802780183462, om: 80.24862682043221, w: 73.29421453021587, ma: 274.4193463761342, epoch: 2461200.5 };

/* The planets, the tundrs and Ceres where they are on a date, in order from the Sun. */
export function worldsOn(jd, { samples = 120 } = {}) {
    const at = positionAt(CERES_ELEMENTS, jd);
    const period = 365.25 * CERES_ELEMENTS.a ** 1.5;
    const path = Array.from({ length: samples }, (_, k) => {
        const p = positionAt(CERES_ELEMENTS, jd + (period * k) / samples);
        return { x: p.x, y: p.y, z: p.z };
    });
    const ceres = { name: 'Ceres', a: CERES_ELEMENTS.a, x: at.x, y: at.y, z: at.z, r: at.r, path };
    return [...planetsOn(jd, { samples }), ceres].sort((p, q) => p.a - q.a).map((p) => ({ ...p, kind: bodyKind(p.name) }));
}

/* The Known worlds row: the planets, tundrs and Ceres, and the digest's known shapes, in
   order of distance from the Sun. */
export function knownRow(digest) {
    const bodies = [...knownWorlds(digest), ...sections(digest).known].sort((p, q) => (p.a ?? p.orbit.a) - (q.a ?? q.orbit.a));
    /* Each round moon follows its parent, innermost first. */
    const moons = knownMoons(bodies);
    return bodies.flatMap((b) => [b, ...moons.filter((m) => m.parent === displayName(b))]);
}

/* ---- The round moons ---------------------------------------------------------------------------
 *
 * Planets by the site's definition (owner, 2026-10-05): rounded by their own gravity, with
 * a surface, and no fusion. These are the calibration list's moons seen to be shaped by
 * gravity, plus Luna (the Moon; owner's name for it, 2026-10-05) and Io, which are rocky and so not in that icy list but just as
 * certainly round. Sizes are mean diameters (the list's, and NASA's for Luna and Io);
 * discovery as usually credited; images from each one's NASA page, checked to load on
 * 2026-10-05. In order outward from their parent. A moon is where its parent is, as far as
 * the map's scale can tell, so it has no mark of its own. */
const calibrated = (name) => CALIBRATION.find((b) => b.name === name)?.diameterKm;
const NASA = 'https://science.nasa.gov/';
export const KNOWN_MOONS = [
    { name: 'Luna', parent: 'Earth', km: 3474.8, found: 'Known since antiquity', url: `${NASA}moon/`, page: 'Moon' },
    { name: 'Io', parent: 'Jupiter', km: 3643.2, found: 'January 1610, by Galileo Galilei', url: `${NASA}jupiter/jupiter-moons/io/` },
    { name: 'Europa', parent: 'Jupiter', found: 'January 1610, by Galileo Galilei', url: `${NASA}jupiter/jupiter-moons/europa/` },
    { name: 'Ganymede', parent: 'Jupiter', found: 'January 1610, by Galileo Galilei', url: `${NASA}jupiter/jupiter-moons/ganymede/` },
    { name: 'Callisto', parent: 'Jupiter', found: 'January 1610, by Galileo Galilei', url: `${NASA}jupiter/jupiter-moons/callisto/` },
    { name: 'Mimas', parent: 'Saturn', found: '17 September 1789, by William Herschel', url: `${NASA}saturn/moons/mimas/` },
    { name: 'Enceladus', parent: 'Saturn', found: '28 August 1789, by William Herschel', url: `${NASA}saturn/moons/enceladus/` },
    { name: 'Tethys', parent: 'Saturn', found: 'March 1684, by Giovanni Domenico Cassini', url: `${NASA}saturn/moons/tethys/` },
    { name: 'Dione', parent: 'Saturn', found: 'March 1684, by Giovanni Domenico Cassini', url: `${NASA}saturn/moons/dione/` },
    { name: 'Rhea', parent: 'Saturn', found: '23 December 1672, by Giovanni Domenico Cassini', url: `${NASA}saturn/moons/rhea/` },
    { name: 'Titan', parent: 'Saturn', found: '25 March 1655, by Christiaan Huygens', url: `${NASA}saturn/moons/titan/` },
    { name: 'Iapetus', parent: 'Saturn', found: '25 October 1671, by Giovanni Domenico Cassini', url: `${NASA}saturn/moons/iapetus/` },
    { name: 'Miranda', parent: 'Uranus', found: '16 February 1948, by Gerard Kuiper', url: `${NASA}uranus/moons/miranda/` },
    { name: 'Ariel', parent: 'Uranus', found: '24 October 1851, by William Lassell', url: `${NASA}uranus/moons/ariel/` },
    { name: 'Umbriel', parent: 'Uranus', found: '24 October 1851, by William Lassell', url: `${NASA}uranus/moons/umbriel/` },
    { name: 'Titania', parent: 'Uranus', found: '11 January 1787, by William Herschel', url: `${NASA}uranus/moons/titania/` },
    { name: 'Oberon', parent: 'Uranus', found: '11 January 1787, by William Herschel', url: `${NASA}uranus/moons/oberon/` },
    { name: 'Triton', parent: 'Neptune', found: '10 October 1846, by William Lassell', url: `${NASA}neptune/moons/triton/` },
    { name: 'Charon', parent: 'Pluto', found: '22 June 1978, by James Christy', url: `${NASA}dwarf-planets/pluto/moons/charon/` },
];

/* The moons as cards, each placed where its parent is (bodies: the known row's other
   members, which carry their distance from the Sun). */
export function knownMoons(bodies) {
    const parents = new Map(bodies.map((b) => [displayName(b), b]));
    return KNOWN_MOONS.filter((m) => parents.has(m.parent)).map((m) => {
        const parent = parents.get(m.parent);
        return {
            name: m.name,
            parent: m.parent,
            designation: WORLD_PREFIX + m.name,
            world: true,
            moon: true,
            kind: 'planet',
            km: m.km ?? calibrated(m.name),
            across: 'across, on average',
            found: m.found,
            /* A moon is where its parent is, near enough for distances from the Sun and Earth. */
            now: { r: parent.now.r, x: parent.now.x, y: parent.now.y, z: parent.now.z },
            /* NASA's own name for its page, where it differs (the Moon, for Luna). */
            images: { url: m.url, text: `NASA's ${m.page ?? m.name} page, with its missions' images` },
        };
    });
}

/* ---- Moons on the map ----------------------------------------------------------------------
 *
 * Each round moon is drawn once zoomed in far enough to tell it from its parent
 * (MOON_DRAW_PX), on its orbit, where it is on the digest's date (js/moons.js). Its parent
 * is a planet or tundr from worldsOn, or Pluto from the digest. */
export const MOON_DRAW_PX = 8;

export function moonsOn(jd, planets, known = [], set = BUILT_IN_MOONS) {
    const parents = new Map([
        ...planets.map((p) => [p.name, p]),
        ...known.filter((e) => Number.isFinite(e.now?.x)).map((e) => [displayName(e), { x: e.now.x, y: e.now.y, z: e.now.z ?? 0 }]),
    ]);
    return Object.entries(MOON_PARENTS).filter(([, parent]) => parents.has(parent)).map(([name, parent]) => {
        const at = parents.get(parent);
        const [dx, dy] = moonOffset(name, jd, set);
        return {
            name, parent, a: moonDistance(name, set),
            /* Fitted as circles in the plane, so drawn in the plane through the parent. */
            x: at.x + dx, y: at.y + dy, z: at.z ?? 0,
            path: moonRing(name, jd, 72, set).map(([rx, ry]) => ({ x: at.x + rx, y: at.y + ry, z: at.z ?? 0 })),
        };
    });
}

/* ---- Sizes side by side --------------------------------------------------------------------
 *
 * The map cannot show size: at the whole map even Jupiter would be far smaller than a
 * pixel. So the body picked last is drawn beside the two familiar bodies nearest it in
 * size, all to one scale, under the map (owner, 2026-11-18: "the lack of implied size in the map").
 * An estimated size shows its range: a solid disc for the size if its surface is bright,
 * a dashed ring for the size if it is dark. */

/* The IAU's nominal solar radius (2015 Resolution B3), in km. */
const SUN_RADIUS_KM = 695700;
/* Jupiter's equatorial diameter at the 1-bar level (NASA's Planetary Fact Sheet), in km. */
const JUPITER_KM = 142984;

/* The familiar bodies, largest first. Each has the designation it is picked by, so a body
   is never compared with itself; called is its name inside a sentence. */
export const SIZE_REFERENCES = [
    { designation: 'body:sun', name: 'The Sun', called: 'the Sun', km: 2 * SUN_RADIUS_KM },
    { designation: 'world:Jupiter', name: 'Jupiter', called: 'Jupiter', km: JUPITER_KM },
    { designation: 'world:Earth', name: 'Earth', called: 'Earth', km: 12756 },
    { designation: 'world:Luna', name: 'The Moon', called: 'the Moon', km: 3474.8 },
    { designation: 'world:Ceres', name: 'Ceres', called: 'Ceres', km: 939.4 },
];

/* The neighbours' stars' and tundrs' sizes, from the radii in NEIGHBOURS (js/centauri.js
   and js/nearstars.js, where each is sourced): in Suns or Jupiters; measured where no
   range is given, otherwise worked out some other way (how) and drawn as a range. */
function sizeOfMember(m) {
    const designation = `body:${m.id}`;
    const { suns, jupiters, plusMinus, how = 'models' } = m.size;
    const unit = suns ? 2 * SUN_RADIUS_KM : JUPITER_KM;
    const radius = suns ?? jupiters;
    if (!plusMinus) return { designation, name: m.name, km: radius * unit, measured: true };
    return {
        designation, name: m.name, km: radius * unit, measured: false, estimatedBy: how,
        low: (radius - plusMinus) * unit, high: (radius + plusMinus) * unit,
    };
}
/* How an unmeasured star's or tundr's size was had, for the panel's words. */
const ESTIMATED_BY = {
    models: 'worked out from its light with models',
    light: 'worked out from its light and temperature',
    brightness: 'estimated from its brightness in infrared light',
    typical: 'taken as the usual size for its type',
    catalogue: "taken from a catalogue's adopted value",
};
/* What each star mark on the map stands for: one star; a pair drawn as one, both; a whole
   system drawn as one dot, all its members. */
export const STAR_SIZES = (() => {
    const sizes = { 'body:sun': [{ ...SIZE_REFERENCES[0], measured: true }] };
    for (const system of NEIGHBOURS) {
        const members = new Map(system.members.map((m) => [m.id, sizeOfMember(m)]));
        for (const [id, size] of members) sizes[`body:${id}`] = [size];
        for (const pair of system.pairs ?? []) sizes[`body:${pair.key}`] = [members.get(pair.a), members.get(pair.b)];
        for (const group of system.groups ?? []) sizes[`body:${group.key}`] = group.members.map((id) => members.get(id));
        sizes[`body:${system.id}`] ??= [...members.values()];
    }
    return sizes;
})();

/* How large the largest disc is drawn, and the least anything is drawn: a body smaller
   than that is a speck at this scale, and says so. */
export const LINEUP_PX = 88;
export const SPECK_PX = 2;
export const EARTH_ROOM_PX = 4;

/* The picks shown at once: the last two; and the discs at most, picks and familiar bodies
   together (owner, 2026-11-18). */
export const LINEUP_PICKS = 2;
export const LINEUP_MAX = 4;

/* The subjects to draw, from each pick's members in the order picked (a system picked as
   one has several): each body once, in its newest pick (Proxima, then Alpha Centauri as a
   whole, is the whole system once), from the last LINEUP_PICKS picks, and leaving room for
   at least one familiar body - the older pick's members give way first. Each is numbered
   by its pick (pick), oldest first. */
export function lineupSubjects(picks, { maxPicks = LINEUP_PICKS, max = LINEUP_MAX } = {}) {
    const seen = new Set();
    const kept = [];
    for (const members of [...picks].reverse()) {
        const fresh = members.filter((m) => !seen.has(m.designation));
        fresh.forEach((m) => seen.add(m.designation));
        if (fresh.length) kept.unshift(fresh);
        if (kept.length === maxPicks) break;
    }
    let room = max - 1;
    const shown = [...kept].reverse().map((members) => {
        const taken = [...members].sort((a, b) => b.km - a.km).slice(0, Math.max(0, room));
        room -= taken.length;
        return members.filter((m) => taken.includes(m));
    }).reverse().filter((members) => members.length);
    return shown.flatMap((members, pick) => members.map((m) => ({ ...m, pick })));
}

/* Each pick's largest member: the one its sentence is about. pick numbers a subject's pick
   (a system picked as one has several members); subjects without one are one pick. */
export function picksOf(subjects) {
    const largest = new Map();
    for (const s of subjects) {
        const k = s.pick ?? 0;
        if (!largest.has(k) || s.km > largest.get(k).km) largest.set(k, s);
    }
    return [...largest.values()];
}

/* The bodies to draw: the subjects (the last picks, each one body or a system's members),
   then the two familiar bodies nearest the newest pick in size (by ratio), and Earth where there is
   room - LINEUP_MAX discs at most - largest first; each with its drawn diameter in pixels (px), and for a range the
   dashed ring's (outerPx). */
export function sizeLineup(subjects, { maxPx = LINEUP_PX, references = SIZE_REFERENCES, max = LINEUP_MAX } = {}) {
    const own = new Set(subjects.map((s) => s.designation));
    /* The familiar bodies are chosen for the newest pick (owner, 2026-11-18: Alpha Centauri
       A and B, then Proxima, should show what is nearest Proxima's size). */
    const newest = picksOf([...subjects].sort((a, b) => (a.pick ?? 0) - (b.pick ?? 0))).at(-1);
    /* The discs left for familiar bodies: the nearest first, then Earth. */
    const slots = Math.max(1, max - subjects.length);
    const nearest = references
        .filter((r) => !own.has(r.designation))
        .map((r) => ({ ...r, apart: Math.abs(Math.log(r.km / newest.km)) }))
        .sort((p, q) => p.apart - q.apart)
        .slice(0, Math.min(2, slots));
    /* Earth too, as home, wherever it leaves everything at least EARTH_ROOM_PX across (an
       estimate at its usual size). */
    const earth = references.find((r) => r.designation === 'world:Earth');
    if (earth && nearest.length < slots && !own.has(earth.designation) && !nearest.some((r) => r === earth || r.designation === earth.designation)) {
        const sizes = [...subjects.map((s) => s.km), ...nearest.map((r) => r.km), earth.km];
        if ((Math.min(...sizes) / Math.max(...sizes, ...subjects.map((s) => s.high ?? s.km))) * maxPx >= EARTH_ROOM_PX) nearest.push({ ...earth, apart: Infinity });
    }
    const top = Math.max(...subjects.map((s) => s.high ?? s.km), ...nearest.map((r) => r.km));
    const px = (km) => (km * maxPx) / top;
    const drawn = (body, subject) => {
        const inner = px(body.low ?? body.km);
        return {
            ...body,
            subject,
            px: Math.max(SPECK_PX, inner),
            speck: inner < SPECK_PX,
            ...(body.high ? { outerPx: Math.max(SPECK_PX, px(body.high)) } : {}),
        };
    };
    return { bodies: [...subjects.map((s) => drawn(s, true)), ...[...nearest].sort((p, q) => q.km - p.km).map((r) => drawn(r, false))] };
}

/* How many times as wide, in words: "1.5 times", "12 times", "about as wide", "29%". */
export function widthText(ratio, called) {
    if (ratio >= 1.15) return `${ratio < 10 ? ratio.toFixed(1) : Math.round(ratio).toLocaleString('en-US')} times as wide as ${called}`;
    if (ratio > 0.87) return `about as wide as ${called}`;
    return `${ratio >= 0.1 ? Math.round(ratio * 100) : (ratio * 100).toFixed(1)}% as wide as ${called}`;
}

const roughly = (km) => (km >= 10000 ? Math.round(km / 1000) * 1000 : km >= 1000 ? Math.round(km / 100) * 100 : Math.round(km / 10) * 10);

/* What the panel says: a title, and a sentence or two under the discs. */
export function lineupText(subjects, { bodies }) {
    const names = subjects.map((s) => s.name);
    const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0]);
    const shown = bodies.filter((b) => !b.subject);
    const title = `${list(names)} beside ${list(shown.map((b) => b.called))}, to one scale`;
    const lines = [];
    const probably = (s) => (s.measured === false ? 'probably ' : '');
    /* Each pick beside the familiar body nearest it in size, and beside Earth, home, where
       it is drawn too. */
    const mains = picksOf(subjects);
    for (const main of mains) {
        const nearest = shown.reduce((a, b) => (Math.abs(Math.log(b.km / main.km)) < Math.abs(Math.log(a.km / main.km)) ? b : a));
        const earth = shown.find((b) => b.designation === 'world:Earth' && b !== nearest);
        const also = earth ? `, and ${widthText(main.km / earth.km, earth.called)}` : '';
        lines.push(`${main.name} is ${probably(main)}${widthText(main.km / nearest.km, nearest.called)}${also}.`);
    }
    /* Two picks: the newer beside the older. */
    if (mains.length === 2) {
        const [older, newer] = mains;
        const either = older.measured === false || newer.measured === false ? 'probably ' : '';
        lines.push(`${newer.name} is ${either}${widthText(newer.km / older.km, older.name)}.`);
    }
    for (const s of subjects) {
        if (s.estimatedBy) lines.push(`${s.name}'s size is ${ESTIMATED_BY[s.estimatedBy]}, not measured: about ${kilometres(roughly(s.km))} across, between ${kilometres(roughly(s.low))} and ${kilometres(roughly(s.high))} (solid disc to dashed ring).`);
        else if (s.low) lines.push(`${s.name}'s size is estimated from its brightness: about ${kilometres(roughly(s.km))} across, but anywhere from ${kilometres(roughly(s.low))} if its surface is bright (the solid disc) to ${kilometres(roughly(s.high))} if it is dark (the dashed ring).`);
    }
    const specks = bodies.filter((b) => b.speck).map((b) => b.name);
    if (specks.length) lines.push(`${list(specks)} ${specks.length > 1 ? 'are' : 'is'} drawn as the smallest dot that shows: at this scale ${specks.length > 1 ? 'they are' : 'it is'} smaller still.`);
    return { title, lines };
}
