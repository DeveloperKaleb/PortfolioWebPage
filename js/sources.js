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
    if (cycle >= 620) return packExtended(century, year, half, second, cycle, text);
    const packedCycle = cycle < 100 ? String(cycle).padStart(2, '0') : BASE62[Math.floor(cycle / 10)] + (cycle % 10);
    return BASE62[Number(century)] + year + half + packedCycle + second;
}

/* The MPC's extended packed format, for cycle counts of 620 and over (more than 15,500
   designations in a half-month, which large surveys now reach):
   https://docs.minorplanetcenter.net/mpc-ops-docs/designations/provisional-designations/
   "_" (and so a year in the 2000s), the year's last two digits as one base-62 digit
   (P = 25), the half-month letter, then four base-62 digits of the designation's order
   in the half-month minus 15,501. The order is cycle x 25 plus the second letter's place,
   A = 1 with I skipped. Checked against the MPC's examples: 2025 DA620 = _PD0000 and
   2029 FL591673 = _TFzzzz. */
const LETTER_ORDER = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';

function packExtended(century, year, half, second, cycle, text) {
    if (century !== '20') throw new RangeError(`extended packing only covers the 2000s: "${text}"`);
    const order = cycle * 25 + LETTER_ORDER.indexOf(second) + 1;
    let rest = order - 15501;
    if (LETTER_ORDER.indexOf(second) < 0 || rest < 0 || rest >= 62 ** 4) throw new RangeError(`cannot pack designation "${text}"`);
    let digits = '';
    for (let k = 0; k < 4; k++) { digits = BASE62[rest % 62] + digits; rest = Math.floor(rest / 62); }
    return '_' + BASE62[Number(year)] + half + digits;
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
/* data_arc, condition_code and n_obs_used say how well the orbit is known: a fresh
   discovery's orbit can be far off, and must not look like a find (js/orbit.js). */
const JPL_FIELDS = ['pdes', 'full_name', 'H', 'a', 'e', 'i', 'om', 'w', 'ma', 'epoch', 'data_arc', 'condition_code', 'n_obs_used'];

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
            quality: col.data_arc === undefined ? null : { arcDays: num('data_arc'), conditionCode: num('condition_code'), nObs: num('n_obs_used') },
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
    /* Rubin's position (AU) and velocity (km/s), equatorial: its view of the orbit (js/orbit.js). */
    'r:helio_x', 'r:helio_y', 'r:helio_z', 'r:helio_vx', 'r:helio_vy', 'r:helio_vz',
];

/* Fink is only asked about objects bright enough to matter: the flags stop at about
   H 6, and catalogue H can be half a magnitude or more off (Gonggong's was), so 7.5. */
export const FINK_H_LIMIT = 7.5;
export const FINK_BATCH = 100;

export const finkUrl = (packed) => `${FINK_SSO}?${new URLSearchParams({
    n_or_d: packed.join(','), columns: FINK_COLUMNS.join(','), 'output-format': 'json',
})}`;

/* Everything Rubin has seen: Fink's monthly table, cut to three columns - about 750 KB in
   one request. It is what decides who gets asked about: only objects Rubin has seen are
   worth a detections request. Asking about every bright TNO took 34 batches when only
   151 of 3,430 had any detections. Its fitted columns are empty for distant objects, but
   the membership is complete. */
export const rubinListUrl = () => `${FINK_SSO.replace(/sso$/, 'ssoft')}?${new URLSearchParams({
    'output-format': 'csv', columns: 'designation,sso_number,n_days',
})}`;

/* The objects in Rubin's list, by provisional designation and by number. */
export function parseRubinList(csv) {
    const [header, ...lines] = String(csv).trim().split(/\r?\n/);
    const col = Object.fromEntries(header.split(',').map((name, k) => [name.trim(), k]));
    const designations = new Set(), numbers = new Set();
    for (const line of lines) {
        const cells = line.split(',');
        const designation = cells[col.designation]?.trim();
        const number = cells[col.sso_number]?.trim();
        if (designation) designations.add(designation);
        if (number) numbers.add(String(Number(number)));
    }
    return { designations, numbers, size: lines.length };
}

export const seenByRubin = (list, { designation, provisional }) =>
    list.numbers.has(String(designation)) || list.designations.has(provisional) || list.designations.has(String(designation));

/* One designation Fink's name lookup does not know fails the whole batch with an HTTP 400
   that names it - in more than one wording ("... for the object 50000 according to
   quaero", "K11Uf3H is not a valid name or number according to quaero"). Rather than
   parse each wording, find which of the batch's names the message mentions, as a whole
   word. Returns its index in the batch, or -1. */
export function rejectedIn(body, batch) {
    const text = String(body);
    const mentions = (name) => name && new RegExp(`(^|[^0-9A-Za-z~_])${name.replace(/[.*+?^${}()|[]\]/g, '\$&')}([^0-9A-Za-z]|$)`).test(text);
    return batch.findIndex((o) => mentions(o.packed) || mentions(o.provisional) || mentions(o.designation));
}

/* Detections for a list of objects ({ packed, provisional, designation }), in batches.
 *
 * Nothing already fetched is ever thrown away. The first live run lost every batch to one
 * error it could not read, so now:
 *   - an object Fink rejects by name is set aside and the rest of its batch asked again;
 *   - a batch that fails any other way is skipped, with the reason, and the next batch
 *     asked;
 *   - if the run has to stop (out of request budget, response too large, network gone),
 *     what was fetched so far is returned, with the reason.
 * The caller decides whether a month with skipped batches counts as fetched. */
export async function fetchDetections(polite, objects, { batchSize = FINK_BATCH } = {}) {
    const byProvisional = new Map();
    const unresolved = [];
    const skipped = [];
    let stopped = null;
    batches: for (let start = 0; start < objects.length; start += batchSize) {
        let batch = objects.slice(start, start + batchSize);
        while (batch.length) {
            let response;
            try {
                response = await polite(finkUrl(batch.map((o) => o.packed)));
            } catch (error) {
                stopped = error.message;
                skipped.push({ designations: objects.slice(start).map((o) => o.designation), reason: `stopped: ${error.message}` });
                break batches;
            }
            if (response.status === 400) {
                const index = rejectedIn(response.body, batch);
                if (index >= 0) {
                    unresolved.push(batch[index]);
                    batch = batch.filter((_, k) => k !== index);
                    continue;
                }
            }
            if (!response.ok) {
                skipped.push({ designations: batch.map((o) => o.designation), reason: `HTTP ${response.status}: ${String(response.body).slice(0, 200)}` });
                break;
            }
            for (const row of JSON.parse(response.body)) {
                const key = row['r:designation'];
                if (!byProvisional.has(key)) byProvisional.set(key, []);
                byProvisional.get(key).push(row);
            }
            break;
        }
    }
    return { byProvisional, unresolved, skipped, stopped };
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

/* ---- Minor Planet Center: who discovered it ---------------------------------------------- */

/* Rubin's observatory code at the MPC: "Simonyi Survey Telescope, Rubin Observatory"
   (confirmed against the MPC's observatory codes API). */
export const RUBIN_STATION = 'X05';

const MPC_OBS = 'https://data.minorplanetcenter.net/api/get-obs';
const MPC_OBSCODES = 'https://data.minorplanetcenter.net/api/obscodes';

/* The MPC's APIs take a GET with a JSON body, one object per request, and return its
   whole observation history - so the collector asks only about objects in the digest,
   once each, and keeps the answer (discovery never changes). Only the 80-column format is
   asked for. */
export const mpcObsRequest = (designation) => ({
    url: MPC_OBS,
    options: {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desigs: [designation], output_format: ['OBS80'] }),
    },
});

export const mpcObscodeRequest = (code) => ({
    url: MPC_OBSCODES,
    options: { method: 'GET', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ obscode: code }) },
});

/* The discovery observation is the one marked with an asterisk in column 13 of the
   80-column format; the date is in columns 16-32 and the observatory code in 78-80.
   Returns { station, date } or null when no observation is marked. */
export function parseDiscovery(responseText) {
    const json = JSON.parse(responseText);
    const record = Array.isArray(json) ? json[0] : json;
    const lines = String(record?.OBS80 ?? '').split('\n');
    const line = lines.find((l) => l.length >= 80 && l[12] === '*');
    if (!line) return null;
    const [year, month, day] = line.slice(15, 32).trim().split(/\s+/);
    return {
        station: line.slice(77, 80),
        date: `${year}-${month.padStart(2, '0')}-${String(Math.floor(Number(day))).padStart(2, '0')}`,
    };
}

export const parseObscodeName = (responseText) => {
    const json = JSON.parse(responseText);
    return json.short_name || json.name || null;
};

/* Discovery circumstances for a list of objects ({ designation, provisional }), at most
   `limit` of them, most interesting first (the caller orders them). Asks by provisional
   designation, which the MPC resolves for numbered objects too. A failure for one object
   is recorded and the rest carry on; running out of request budget stops early, keeping
   what was found. */
export async function fetchDiscoveries(polite, objects, { limit = Infinity } = {}) {
    const found = {}, failed = [];
    let stopped = null;
    for (const o of objects.slice(0, limit)) {
        const { url, options } = mpcObsRequest(o.provisional ?? o.designation);
        try {
            const response = await polite(url, { ...options, maxBytes: 20 * 1024 * 1024 });
            const discovery = response.ok ? parseDiscovery(response.body) : null;
            if (discovery) found[o.designation] = discovery;
            else failed.push({ designation: o.designation, reason: response.ok ? 'no discovery observation marked' : `HTTP ${response.status}` });
        } catch (error) {
            if (error.name === 'BudgetExceeded' || /budget/.test(error.message)) { stopped = error.message; break; }
            failed.push({ designation: o.designation, reason: error.message });
        }
    }
    return { found, failed, stopped };
}

/* Names for observatory codes not yet known, asked once each and kept. */
export async function fetchStationNames(polite, codes) {
    const names = {};
    for (const code of codes) {
        const { url, options } = mpcObscodeRequest(code);
        try {
            const response = await polite(url, options);
            if (response.ok) names[code] = parseObscodeName(response.body);
        } catch (error) {
            if (/budget/.test(error.message)) break;
        }
    }
    return names;
}
