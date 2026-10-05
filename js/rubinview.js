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
import { jdFromDate, positionAt, tooBrightForRubin } from './orbit.js';
import { moonOffset, moonRing, moonDistance, MOON_PARENTS, BUILT_IN_MOONS } from './moons.js';

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
    /* The digest carries the collector's latest moon fit; an older digest, the built-in one. */
    return { marks, radius, planets, moons: moonsOn(jd, planets, known, digest.moons ?? BUILT_IN_MOONS) };
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
    /* Pluto: brighter than a Rubin visit can measure, so never "not yet". Worked out from the
       entry's brightness too, so digests from before the collector recorded it say so. */
    if (r?.tooBright || (Number.isFinite(entry.now?.V) && tooBrightForRubin(entry.now.V))) {
        return { confirmed: false, tooBright: true, text: 'Too bright for Rubin to measure' };
    }
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
/* Zoomed all the way in, Charon (13,000 km from Pluto) is a few pixels clear of it. */
export const MAP_ZOOM = { max: 50000, step: 2 };

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
 * tundrs (Old Norse for tinder: ready but never lit), each kind named after what it is
 * mostly made of - never after where it formed, as "gas giant" and "ice giant" are. The
 * page explains this in a dialog wherever the word appears. */
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
        return { x: p.x, y: p.y };
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
            now: { r: parent.now.r },
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
        ...known.filter((e) => Number.isFinite(e.now?.x)).map((e) => [displayName(e), { x: e.now.x, y: e.now.y }]),
    ]);
    return Object.entries(MOON_PARENTS).filter(([, parent]) => parents.has(parent)).map(([name, parent]) => {
        const at = parents.get(parent);
        const [dx, dy] = moonOffset(name, jd, set);
        return {
            name, parent, a: moonDistance(name, set),
            x: at.x + dx, y: at.y + dy,
            path: moonRing(name, jd, 72, set).map(([rx, ry]) => ({ x: at.x + rx, y: at.y + ry })),
        };
    });
}
