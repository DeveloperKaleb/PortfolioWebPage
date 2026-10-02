/* The two places the Rubin digest gets its data, and how a Rubin brightness becomes the
 * visual H the filter uses.
 *
 * - JPL's Small-Body Database: the list of trans-Neptunian objects and their orbits. A
 *   count-only query first (one small request) says whether anything changed.
 * - Fink, a Rubin alert broker: Rubin's individual detections of those objects. Not
 *   Fink's fitted table (SSoFT): its fit needs a range of phase angles, which distant
 *   objects never show, so for them it is empty (Gonggong's row: no H, fit code 4). H is
 *   computed here from the detections instead. Checked against Gonggong: its Rubin
 *   r-band detections give H_V = 2.17 +- 0.16 with a typical colour, against 2.34
 *   published (Gonggong is unusually red), where JPL's catalogue H is 1.82.
 *
 * Fink's own name lookup can fail for an object (it failed for Quaoar, 50000), which
 * rejects the whole batch; fetchDetections sets that object aside and asks again.
 *
 * Every request goes through the courtesy layer (js/polite.js), passed in as `polite`.
 * Parsing and the photometry are pure and tested against recorded responses; the
 * fetching functions are tested with a fake network. No DOM.
 */
import { apparentMagnitude, TYPICAL_V_MINUS_R } from './orbit.js';

/* ---- Designations ------------------------------------------------------------------ */

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/* The Minor Planet Center's packed form. Fink resolves packed designations directly,
   where a plain number goes through a name lookup that failed for Quaoar. */
export function packDesignation(designation) {
    const text = String(designation).trim();
    if (/^\d+$/.test(text)) {
        const n = Number(text);
        if (n < 100000) return text.padStart(5, '0');
        if (n < 620000) return BASE62[Math.floor(n / 10000)] + String(n % 10000).padStart(4, '0');
        let rest = n - 620000, out = '';
        for (let k = 0; k < 4; k++) { out = BASE62[rest % 62] + out; rest = Math.floor(rest / 62); }
        return '~' + out;
    }
    const match = text.match(/^(\d{2})(\d{2}) ([A-Z])([A-Z])(\d*)$/);
    if (!match) throw new RangeError(`cannot pack designation "${text}"`);
    const [, century, year, half, second, cycleText] = match;
    const cycle = cycleText ? Number(cycleText) : 0;
    if (cycle >= 620) throw new RangeError(`cycle count too large to pack: "${text}"`);
    const packedCycle = cycle < 100 ? String(cycle).padStart(2, '0') : BASE62[Math.floor(cycle / 10)] + (cycle % 10);
    return BASE62[Number(century)] + year + half + packedCycle + second;
}

/* JPL's full name is "225088 Gonggong (2007 OR10)" for a numbered object and
   "(2010 BK118)" for an unnumbered one. The provisional designation is what Fink's
   detections carry, so it is the join between the two sources. */
export function provisionalFrom(fullName, pdes) {
    const inBrackets = fullName.match(/\(([^)]+)\)\s*$/);
    return inBrackets ? inBrackets[1].trim() : String(pdes).trim();
}

/* ---- JPL ------------------------------------------------------------------------------- */

const JPL_QUERY = 'https://ssd-api.jpl.nasa.gov/sbdb_query.api';
const JPL_FIELDS = ['pdes', 'full_name', 'H', 'a', 'e', 'i', 'om', 'w', 'ma', 'epoch'];

export const jplCountUrl = () => `${JPL_QUERY}?${new URLSearchParams({ 'sb-class': 'TNO' })}`;

/* full-prec matters: by default JPL rounds elements to about 3 significant figures,
   which visibly misplaces Sedna. */
export const jplPageUrl = ({ limit, from = 0 }) => `${JPL_QUERY}?${new URLSearchParams({
    'sb-class': 'TNO', fields: JPL_FIELDS.join(','), 'full-prec': '1', limit: String(limit), 'limit-from': String(from),
})}`;

export const parseJplCount = (body) => JSON.parse(body).count;

export function parseJplPage(body) {
    const json = JSON.parse(body);
    const col = Object.fromEntries(json.fields.map((f, k) => [f, k]));
    return (json.data ?? []).map((row) => {
        const num = (field) => (row[col[field]] === null || row[col[field]] === '' ? null : Number(row[col[field]]));
        const pdes = row[col.pdes].trim();
        return {
            designation: pdes,
            fullName: row[col.full_name].trim(),
            provisional: provisionalFrom(row[col.full_name], pdes),
            H: num('H'),
            elements: { a: num('a'), e: num('e'), i: num('i'), om: num('om'), w: num('w'), ma: num('ma'), epoch: num('epoch') },
        };
    });
}

/* The whole TNO list, in pages. Returns null when the count matches the previous run's,
   so a quiet week costs one tiny request. */
export async function fetchTnos(polite, { previousCount = null, pageSize = 2500 } = {}) {
    const counted = await polite(jplCountUrl());
    if (!counted.ok) throw new Error(`JPL count failed: HTTP ${counted.status}`);
    const count = parseJplCount(counted.body);
    if (count === previousCount) return null;
    const objects = [];
    for (let from = 0; from < count; from += pageSize) {
        const page = await polite(jplPageUrl({ limit: pageSize, from }));
        if (!page.ok) throw new Error(`JPL page at ${from} failed: HTTP ${page.status}`);
        objects.push(...parseJplPage(page.body));
    }
    return { count, objects };
}

/* ---- Fink ------------------------------------------------------------------------------ */

const FINK_SSO = 'https://api.lsst.fink-portal.org/api/v1/sso';

/* Only the columns the photometry uses, out of about 144. */
export const FINK_COLUMNS = [
    'r:designation', 'r:band', 'r:midpointMjdTai', 'r:psfFlux', 'r:psfFluxErr', 'r:helioRange', 'r:topoRange',
    'r:phaseAngle', 'r:psfFlux_flag', 'r:pixelFlags_saturatedCenter', 'r:reliability', 'r:timeWithdrawnMjdTai',
];

/* Fink is only asked about objects bright enough to matter: the flags stop at about
   H 6, and catalogue H can be half a magnitude or more off (Gonggong's was), so 7.5. */
export const FINK_H_LIMIT = 7.5;
export const FINK_BATCH = 100;

export const finkUrl = (packed) => `${FINK_SSO}?${new URLSearchParams({
    n_or_d: packed.join(','), columns: FINK_COLUMNS.join(','), 'output-format': 'json',
})}`;

/* One unresolvable designation fails Fink's whole batch with an HTTP 400 naming it. */
export function unresolvedIn(body) {
    const match = String(body).match(/for the object (\S+?)(?: according|\s|$)/);
    return match ? match[1] : null;
}

/* Detections for a list of objects ({ packed, provisional }), in batches. An object Fink
   cannot resolve is set aside and the rest of its batch asked again. Returns the
   detections grouped by provisional designation, and the objects Fink could not find. */
export async function fetchDetections(polite, objects, { batchSize = FINK_BATCH } = {}) {
    const byProvisional = new Map();
    const unresolved = [];
    for (let start = 0; start < objects.length; start += batchSize) {
        let batch = objects.slice(start, start + batchSize);
        while (batch.length) {
            const response = await polite(finkUrl(batch.map((o) => o.packed)));
            if (response.status === 400) {
                const bad = unresolvedIn(response.body);
                const index = batch.findIndex((o) => o.packed === bad || o.provisional === bad || o.designation === bad);
                if (index < 0) throw new Error(`Fink rejected a batch without naming an object: ${response.body.slice(0, 200)}`);
                unresolved.push(batch[index]);
                batch = batch.filter((_, k) => k !== index);
                continue;
            }
            if (!response.ok) throw new Error(`Fink batch failed: HTTP ${response.status}`);
            for (const row of JSON.parse(response.body)) {
                const key = row['r:designation'];
                if (!byProvisional.has(key)) byProvisional.set(key, []);
                byProvisional.get(key).push(row);
            }
            break;
        }
    }
    return { byProvisional, unresolved };
}

/* ---- Photometry ------------------------------------------------------------------------ */

/* Rubin fluxes are in nanojanskys; AB magnitude = 31.4 - 2.5 log10(flux). */
export const abMagnitude = (fluxNJy) => 31.4 - 2.5 * Math.log10(fluxNJy);

/* A detection is used only if it is positive, unflagged, unsaturated, not withdrawn and
   reliable. */
export const MIN_RELIABILITY = 0.5;
export const usable = (row) => row['r:psfFlux'] > 0 && row['r:psfFluxErr'] > 0
    && !row['r:psfFlux_flag'] && !row['r:pixelFlags_saturatedCenter']
    && row['r:timeWithdrawnMjdTai'] == null && (row['r:reliability'] ?? 1) >= MIN_RELIABILITY
    && row['r:helioRange'] > 0 && row['r:topoRange'] > 0;

/* The smallest uncertainty a per-band H is given: rotation and calibration alone make a
   single number uncertain at this level. */
export const H_FLOOR = 0.05;

/* H in each Rubin band, from the detections: each detection's magnitude reduced to 1 AU
   from Sun and Earth and zero phase (H-G, G = 0.15), then averaged weighted by its
   photometric error. The uncertainty is the larger of the statistical error and the
   scatter between detections (rotation shows up as scatter), never under H_FLOOR. */
export function bandH(rows) {
    const perBand = {};
    for (const row of rows.filter(usable)) {
        const m = abMagnitude(row['r:psfFlux']);
        const H = m - (apparentMagnitude(0, row['r:helioRange'], row['r:topoRange'], row['r:phaseAngle'] ?? 0));
        const sigma = 1.0857 * row['r:psfFluxErr'] / row['r:psfFlux'];
        (perBand[row['r:band']] ??= []).push({ H, w: 1 / (sigma * sigma) });
    }
    const out = {};
    for (const [band, list] of Object.entries(perBand)) {
        const W = list.reduce((s, d) => s + d.w, 0);
        const mean = list.reduce((s, d) => s + d.w * d.H, 0) / W;
        const scatter = list.length > 1
            ? Math.sqrt(list.reduce((s, d) => s + (d.H - mean) ** 2, 0) / (list.length - 1) / list.length)
            : 0;
        out[band] = { H: mean, errH: Math.max(H_FLOOR, Math.sqrt(1 / W), scatter), n: list.length };
    }
    return out;
}

/* Visual H from Rubin's bands. With g and r, the Jester et al. (2005) transformation
   V = g - 0.59 (g - r) - 0.01. With r only, a typical TNO colour (V - r = 0.4), with
   0.15 mag added to the uncertainty for not knowing the real colour. Otherwise null:
   the caller falls back to the catalogue H. */
export const UNKNOWN_COLOUR_ERR = 0.15;

export function visualH(bands) {
    const { g, r } = bands;
    if (g && r) {
        return {
            H: g.H - 0.59 * (g.H - r.H) - 0.01,
            errH: Math.hypot(0.41 * g.errH, 0.59 * r.errH),
            from: 'g and r (Jester et al. 2005)',
        };
    }
    if (r) return { H: r.H + TYPICAL_V_MINUS_R, errH: Math.hypot(r.errH, UNKNOWN_COLOUR_ERR), from: 'r with a typical TNO colour' };
    return null;
}

/* Catalogue H (JPL, from the Minor Planet Center) is often a few tenths out for distant
   objects, so when it is all there is, it carries this uncertainty. */
export const CATALOGUE_H_ERR = 0.3;
