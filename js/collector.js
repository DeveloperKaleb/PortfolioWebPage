/* The Rubin collector's logic: what a run fetches, how Rubin photometry and the JPL
 * catalogue combine into one H per object, and what the digest and the changes record.
 *
 * Pure: no files, no network. tools/rubin-collect.mjs does the reading, writing and
 * fetching around it, so everything here is tested on its own. See NOTES.md for the
 * layout of the rubin-data repo these produce.
 */
import { assessObject } from './verdict.js';
import { packDesignation, provisionalFrom, bandH, visualH, seenByRubin, FINK_H_LIMIT, CATALOGUE_H_ERR, RUBIN_STATION } from './sources.js';
import { CALIBRATION, READINGS, fitEquilibrium, diameterAt } from './equilibrium.js';
import { TNO_ALBEDOS_MODIFIED } from './tnoalbedos.js';
import { darkAlbedo } from './brightness.js';
import { ORBIT_THRESHOLDS, SCOPE_AU, RUBIN_SINGLE_VISIT, TYPICAL_V_MINUS_R, rubinState, positionAt, observe, tooBrightForRubin } from './orbit.js';

export const FORMAT = 1;

/* An object is recorded in the digest if it passes, nearly passes, could be large if
   dark, or is marked to watch. Orbit flags alone do not earn a place: hundreds of
   faint, small objects have unusual orbits. They are all in the month's inputs, so
   nothing is lost. */
export const NEAR_MISS = 0.5;

/* H moving by more than this between months is worth a line in the changes. */
export const H_CHANGE = 0.2;

export const monthOf = (date) => date.toISOString().slice(0, 7);

/* What this run fetches. JPL's count every run; the full JPL list when the count moved
   or the month turned; Fink once a month. */
export function planRun(state, date) {
    const month = monthOf(date);
    return {
        month,
        newMonth: state?.jplFetchedMonth !== month,
        fetchFink: state?.finkFetchedMonth !== month,
    };
}

/* The objects Fink is asked about, packed: bright enough to matter, seen by Rubin (when
   Rubin's list is given), and not a name Fink's lookup failed on recently. Those that
   cannot be packed are skipped and reported rather than guessed at. */
export function selectForFink(tnos, { rubinList = null, skip = new Set() } = {}) {
    const chosen = [], unpackable = [];
    for (const o of tnos) {
        if (o.H === null || o.H > FINK_H_LIMIT) continue;
        if (rubinList && !seenByRubin(rubinList, o)) continue;
        if (skip.has(o.designation)) continue;
        try {
            chosen.push({ packed: packDesignation(o.designation), provisional: o.provisional, designation: o.designation });
        } catch {
            unpackable.push(o.designation);
        }
    }
    return { chosen, unpackable };
}

/* Rubin is the source of truth (the project owner's direction, 2026-10-02); JPL and the
   others are validation and fallback.

   For each object: its brightness from Rubin's own photometry where Rubin has measured
   it, else the catalogue's, with its larger uncertainty; its orbit from Rubin's own
   position and velocity where Rubin has a record, else JPL's; and what Rubin has seen of
   it. An object Rubin has not measured is kept, labelled not yet confirmed by Rubin.
   JPL's elements and H are kept beside Rubin's for the cross-check. Objects with no H
   anywhere are left out and counted. */
/* jd (optional): the run's date, to tell which objects are too bright for Rubin to
   measure (js/orbit.js, RUBIN_SATURATION). Those keep their catalogue H whatever Rubin
   reports, since saturated detections clip the brightness. */
export function choosePhotometry(tnos, detectionsByProvisional, { rubinList = null, jd = null } = {}) {
    const objects = [], withoutH = [];
    for (const o of tnos) {
        const rows = detectionsByProvisional?.get?.(o.provisional) ?? detectionsByProvisional?.[o.provisional] ?? [];
        const tooBright = jd !== null && o.H !== null && o.elements ? tooBrightForRubin(observe(o.elements, o.H, jd).V) : false;
        const photometry = rows.length && !tooBright ? visualH(bandH(rows)) : null;
        const state = rows.length ? rubinState(rows) : null;
        const rubin = {
            seen: rubinList ? seenByRubin(rubinList, o) : rows.length > 0,
            confirmed: Boolean(photometry),
            detections: rows.length,
            arcDays: state ? state.arcDays : null,
            lastSeenJd: state ? state.lastJd : null,
            ...(tooBright ? { tooBright: true } : {}),
        };
        const base = {
            ...o, rubin, jpl: { H: o.H, elements: o.elements },
            elements: state ? state.elements : o.elements,
            orbitFrom: state ? 'Rubin' : 'JPL',
        };
        if (photometry) {
            objects.push({ ...base, Hv: photometry.H, errH: photometry.errH, hSource: `Rubin: ${photometry.from}`, detections: rows.length });
        } else if (o.H !== null) {
            objects.push({ ...base, Hv: o.H, errH: CATALOGUE_H_ERR, hSource: 'catalogue (JPL)', detections: rows.length });
        } else {
            withoutH.push(o.designation);
        }
    }
    return { objects, withoutH };
}

/* Where Rubin and JPL disagree by more than this, the object is flagged jplDisagrees.
   Brightness: catalogue H is often a few tenths out, so half a magnitude. Distance now:
   0.1 AU. Orbit: 5% in semi-major axis, a degree in inclination. */
export const VALIDATION = { H: 0.5, rAu: 0.1, aFraction: 0.05, iDeg: 1 };

/* Rubin measures distant objects systematically fainter than JPL's catalogue: 0.35 mag
   (median) over the 50 objects of the first live run, range -0.07 to +0.81. Flagging
   raw differences would flag the catalogue's general bias, not real anomalies, so the
   brightness check is against that offset, measured afresh each month from every
   Rubin-confirmed object, once there are enough of them to trust. */
export const MIN_FOR_OFFSET = 10;

export function catalogueOffset(objects) {
    const diffs = objects.filter((o) => o.rubin?.confirmed && o.jpl?.H !== null && o.jpl?.H !== undefined)
        .map((o) => o.Hv - o.jpl.H).sort((a, b) => a - b);
    if (diffs.length < MIN_FOR_OFFSET) return { median: 0, n: diffs.length, used: false };
    const mid = diffs.length / 2;
    const median = diffs.length % 2 ? diffs[Math.floor(mid)] : (diffs[mid - 1] + diffs[mid]) / 2;
    return { median, n: diffs.length, used: true };
}

/* Rubin's values against JPL's, for an object Rubin has measured or has an orbit for.
   dH is raw; whether it disagrees is judged after taking off the usual offset. */
export function crossCheck(o, jd, { hOffset = 0 } = {}) {
    if (!o.rubin.confirmed && o.orbitFrom !== 'Rubin') return null;
    const check = {};
    if (o.rubin.confirmed && o.jpl.H !== null) check.dH = o.Hv - o.jpl.H;
    if (o.orbitFrom === 'Rubin') {
        check.dR = positionAt(o.elements, jd).r - positionAt(o.jpl.elements, jd).r;
        check.dA = (o.elements.a - o.jpl.elements.a) / o.jpl.elements.a;
        check.dI = o.elements.i - o.jpl.elements.i;
    }
    const v = VALIDATION;
    if (check.dH !== undefined) check.dHok = Math.abs(check.dH - hOffset) <= v.H;
    check.agrees = !(check.dHok === false || Math.abs(check.dR ?? 0) > v.rAu
        || Math.abs(check.dA ?? 0) > v.aFraction || Math.abs(check.dI ?? 0) > v.iDeg);
    return check;
}

const round = (value, places) => (value === null || value === undefined ? value : Number(value.toFixed(places)));

/* The digest's line for one assessed object. */
function entry(o, v) {
    const { a, e, i } = o.elements;
    return {
        designation: o.designation,
        name: o.fullName,
        H: round(o.Hv, 2), errH: round(o.errH, 2), hSource: o.hSource, detections: o.detections,
        sizeFrom: v.sizeFrom,
        ...(v.sizeFrom === 'measured' ? { diameterKm: round(v.diameterKm, 0), measured: { H: v.measured.H, albedo: v.measured.albedo, method: v.measured.method, source: v.measured.source } } : {}),
        chance: round(v.evidence, 3), chanceGrundy: round(v.grundy, 3), chanceIfDark: round(v.ifDark.evidence, 3),
        passes: v.passes, flags: v.flags, watch: v.watch,
        orbit: { a: round(a, 2), e: round(e, 3), i: round(i, 2), q: round(a * (1 - e), 2) },
        orbitFrom: o.orbitFrom ?? 'JPL',
        orbitQuality: o.quality ?? null,
        rubin: o.rubin ? {
            confirmed: o.rubin.confirmed, seen: o.rubin.seen, detections: o.rubin.detections,
            arcDays: round(o.rubin.arcDays, 1),
            lastSeen: o.rubin.lastSeenJd ? new Date((o.rubin.lastSeenJd - 2440587.5) * 86400000).toISOString().slice(0, 10) : null,
            ...(o.rubin.tooBright ? { tooBright: true } : {}),
        } : null,
        crossCheck: v.crossCheck ? Object.fromEntries(Object.entries(v.crossCheck).map(([k, x]) => [k, typeof x === 'number' ? round(x, k === 'dA' ? 4 : 3) : x])) : null,
        now: { r: round(v.orbit.r, 2), x: round(v.orbit.x, 2), y: round(v.orbit.y, 2), z: round(v.orbit.z, 2), V: round(v.orbit.V, 2), detectable: v.orbit.detectable },
    };
}

const interesting = (v) => v.passes || v.watch || v.evidence >= NEAR_MISS || v.flags.includes('largeIfDark');

/* What produced a digest, so any month can be reproduced after the filter changes. */
export function provenance({ siteCommit, sources }) {
    const evidenceFit = fitEquilibrium(READINGS.evidence(CALIBRATION));
    const grundyFit = fitEquilibrium(READINGS.grundy(CALIBRATION));
    return {
        siteCommit,
        sources,
        calibration: {
            bodies: CALIBRATION.length,
            cutoffKm: round(diameterAt(evidenceFit, 0.8), 1),
            cutoffKmGrundy: round(diameterAt(grundyFit, 0.8), 1),
        },
        albedos: { snapshot: TNO_ALBEDOS_MODIFIED, darkAlbedo: darkAlbedo() },
        thresholds: { pass: 0.8, nearMiss: NEAR_MISS, orbit: ORBIT_THRESHOLDS, scopeAu: SCOPE_AU },
        detection: { ...RUBIN_SINGLE_VISIT, typicalVMinusR: TYPICAL_V_MINUS_R },
    };
}

/* The month's digest: counts over every object, and a line for each interesting one,
   most promising first. */
export function buildDigest({ objects, jd, date, provenance: made, notes = [], observing = null }) {
    const entries = [];
    const counts = { assessed: 0, passes: 0, disputed: 0, largeIfDark: 0, watch: 0, nearMiss: 0, withRubinH: 0, measuredSize: 0, uncertainOrbit: 0, implausiblyBright: 0, confirmedByRubin: 0, seenByRubin: 0, orbitFromRubin: 0, jplDisagrees: 0 };
    const offset = catalogueOffset(objects);
    for (const o of objects) {
        const v = assessObject({
            H: o.Hv, errH: o.errH, elements: o.elements, quality: o.quality,
            designation: o.designation, provisional: o.provisional,
        }, jd);
        v.crossCheck = o.rubin ? crossCheck(o, jd, { hOffset: offset.median }) : null;
        if (v.crossCheck && !v.crossCheck.agrees) v.flags.push('jplDisagrees');
        counts.assessed++;
        if (o.hSource.startsWith('Rubin')) counts.withRubinH++;
        if (o.rubin?.confirmed) counts.confirmedByRubin++;
        if (o.rubin?.seen) counts.seenByRubin++;
        if (o.orbitFrom === 'Rubin') counts.orbitFromRubin++;
        if (v.flags.includes('jplDisagrees')) counts.jplDisagrees++;
        if (v.passes) counts.passes++;
        if (v.flags.includes('disputed')) counts.disputed++;
        if (v.flags.includes('largeIfDark') && !v.flags.includes('implausiblyBright')) counts.largeIfDark++;
        if (v.watch) counts.watch++;
        if (v.sizeFrom === 'measured') counts.measuredSize++;
        if (v.flags.includes('uncertainOrbit')) counts.uncertainOrbit++;
        if (v.flags.includes('implausiblyBright')) counts.implausiblyBright++;
        if (!v.passes && v.evidence >= NEAR_MISS && !v.flags.includes('implausiblyBright')) counts.nearMiss++;
        if (interesting(v)) entries.push(entry(o, v));
    }
    const rank = (x) => (x.passes ? 0 : x.watch ? 1 : x.flags.includes('largeIfDark') ? 2 : 3);
    entries.sort((x, y) => rank(x) - rank(y) || y.chance - x.chance || x.designation.localeCompare(y.designation));
    const catalogue = { offsetH: round(offset.median, 3), from: offset.n, used: offset.used };
    return { format: FORMAT, date: date.toISOString().slice(0, 10), counts, notes, provenance: made, catalogue, observing, entries };
}

/* What changed between two months' digests. */
export function diffDigests(previous, next) {
    const before = new Map((previous?.entries ?? []).map((x) => [x.designation, x]));
    const after = new Map(next.entries.map((x) => [x.designation, x]));
    const changes = { from: previous?.date ?? null, to: next.date, entries: [] };
    const add = (designation, what, detail = {}) => changes.entries.push({ designation, what, ...detail });

    for (const [designation, now] of after) {
        const was = before.get(designation);
        if (!was) { add(designation, 'new in digest', { passes: now.passes, flags: now.flags }); continue; }
        if (was.passes !== now.passes) add(designation, now.passes ? 'now passes' : 'no longer passes', { chance: now.chance });
        const gained = now.flags.filter((f) => !was.flags.includes(f));
        const lost = was.flags.filter((f) => !now.flags.includes(f));
        if (gained.length) add(designation, 'flags gained', { flags: gained });
        if (lost.length) add(designation, 'flags lost', { flags: lost });
        if (Math.abs(now.H - was.H) > H_CHANGE) add(designation, 'H changed', { from: was.H, to: now.H, hSource: now.hSource });
    }
    for (const designation of before.keys()) if (!after.has(designation)) add(designation, 'left digest');
    return changes;
}

/* JSON with each entry of a top-level array on its own line, so the data repo's history
   shows one changed line per changed object. Still plain JSON. */
export function stringifyLines(value) {
    const parts = Object.entries(value).map(([key, v]) => {
        if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
            return `${JSON.stringify(key)}: [\n${v.map((x) => '  ' + JSON.stringify(x)).join(',\n')}\n]`;
        }
        return `${JSON.stringify(key)}: ${JSON.stringify(v)}`;
    });
    return `{\n${parts.join(',\n')}\n}\n`;
}

/* ---- Discovery circumstances -------------------------------------------------------- */

/* Who found each object, from the MPC (js/sources.js). Discovery never changes, so it is
   asked once per object and kept in rubin-data's discovery.json. Only objects in the
   digest are asked about, most interesting first, at most DISCOVERY_PER_RUN per run, so
   the first backfill of a few hundred spreads over several weekly runs. An object the MPC
   could not answer for is tried again the next month, not every week. */
export const DISCOVERY_PER_RUN = 40;
export const STATION_NAMES_PER_RUN = 10;

export const emptyDiscoveryStore = () => ({ objects: {}, stations: {}, failed: {} });

/* The digest's objects still to look up, in the digest's own order (passes first). */
export function discoveryQueue(digest, store, month) {
    return digest.entries
        .filter((e) => !store.objects[e.designation] && store.failed[e.designation] !== month)
        .map((e) => ({ designation: e.designation, provisional: provisionalFrom(e.name, e.designation) }));
}

/* Observatory codes seen in discoveries but not yet named. */
export const unnamedStations = (store) =>
    [...new Set(Object.values(store.objects).map((d) => d.station))].filter((code) => !(code in store.stations));

/* Each digest entry gets its discovery, where known, and the counts say how many Rubin
   found. */
export function annotateDiscoveries(digest, store) {
    let known = 0, byRubin = 0;
    for (const e of digest.entries) {
        const d = store.objects[e.designation];
        if (!d) continue;
        known++;
        const rubin = d.station === RUBIN_STATION;
        if (rubin) byRubin++;
        e.discovery = { date: d.date, station: d.station, stationName: store.stations[d.station] ?? null, byRubin: rubin };
    }
    digest.counts.discoveryKnown = known;
    digest.counts.discoveredByRubin = byRubin;
    return digest;
}
