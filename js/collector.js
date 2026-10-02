/* The Rubin collector's logic: what a run fetches, how Rubin photometry and the JPL
 * catalogue combine into one H per object, and what the digest and the changes record.
 *
 * Pure: no files, no network. tools/rubin-collect.mjs does the reading, writing and
 * fetching around it, so everything here is tested on its own. See NOTES.md for the
 * layout of the rubin-data repo these produce.
 */
import { assessObject } from './verdict.js';
import { packDesignation, bandH, visualH, FINK_H_LIMIT, CATALOGUE_H_ERR } from './sources.js';
import { CALIBRATION, READINGS, fitEquilibrium, diameterAt } from './equilibrium.js';
import { TNO_ALBEDOS_MODIFIED } from './tnoalbedos.js';
import { darkAlbedo } from './brightness.js';
import { ORBIT_THRESHOLDS, SCOPE_AU, RUBIN_SINGLE_VISIT, TYPICAL_V_MINUS_R } from './orbit.js';

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

/* The objects Fink is asked about, packed. Those that cannot be packed are skipped and
   reported rather than guessed at. */
export function selectForFink(tnos) {
    const chosen = [], unpackable = [];
    for (const o of tnos) {
        if (o.H === null || o.H > FINK_H_LIMIT) continue;
        try {
            chosen.push({ packed: packDesignation(o.designation), provisional: o.provisional, designation: o.designation });
        } catch {
            unpackable.push(o.designation);
        }
    }
    return { chosen, unpackable };
}

/* One H per object: Rubin's own photometry converted to visual where it can be,
   otherwise the catalogue's, with its larger uncertainty. Objects with neither are
   left out and counted. */
export function choosePhotometry(tnos, detectionsByProvisional) {
    const objects = [], withoutH = [];
    for (const o of tnos) {
        const rows = detectionsByProvisional?.get?.(o.provisional) ?? detectionsByProvisional?.[o.provisional] ?? [];
        const rubin = rows.length ? visualH(bandH(rows)) : null;
        if (rubin) {
            objects.push({ ...o, Hv: rubin.H, errH: rubin.errH, hSource: `Rubin: ${rubin.from}`, detections: rows.length });
        } else if (o.H !== null) {
            objects.push({ ...o, Hv: o.H, errH: CATALOGUE_H_ERR, hSource: 'catalogue (JPL)', detections: rows.length });
        } else {
            withoutH.push(o.designation);
        }
    }
    return { objects, withoutH };
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
        orbitQuality: o.quality ?? null,
        now: { r: round(v.orbit.r, 2), V: round(v.orbit.V, 2), detectable: v.orbit.detectable },
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
export function buildDigest({ objects, jd, date, provenance: made, notes = [] }) {
    const entries = [];
    const counts = { assessed: 0, passes: 0, disputed: 0, largeIfDark: 0, watch: 0, nearMiss: 0, withRubinH: 0, measuredSize: 0, uncertainOrbit: 0 };
    for (const o of objects) {
        const v = assessObject({
            H: o.Hv, errH: o.errH, elements: o.elements, quality: o.quality,
            designation: o.designation, provisional: o.provisional,
        }, jd);
        counts.assessed++;
        if (o.hSource.startsWith('Rubin')) counts.withRubinH++;
        if (v.passes) counts.passes++;
        if (v.flags.includes('disputed')) counts.disputed++;
        if (v.flags.includes('largeIfDark')) counts.largeIfDark++;
        if (v.watch) counts.watch++;
        if (v.sizeFrom === 'measured') counts.measuredSize++;
        if (v.flags.includes('uncertainOrbit')) counts.uncertainOrbit++;
        if (!v.passes && v.evidence >= NEAR_MISS) counts.nearMiss++;
        if (interesting(v)) entries.push(entry(o, v));
    }
    const rank = (x) => (x.passes ? 0 : x.watch ? 1 : x.flags.includes('largeIfDark') ? 2 : 3);
    entries.sort((x, y) => rank(x) - rank(y) || y.chance - x.chance || x.designation.localeCompare(y.designation));
    return { format: FORMAT, date: date.toISOString().slice(0, 10), counts, notes, provenance: made, entries };
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
