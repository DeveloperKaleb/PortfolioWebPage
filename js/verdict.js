/* The Rubin filter's whole verdict on one object: the brightness check (js/brightness.js)
 * and the orbit (js/orbit.js) together. This is what the collector calls for each object
 * and what the digest records.
 *
 * Passing is the size check alone: from a measured diameter where the object's albedo
 * has been measured, otherwise from its brightness averaged over typical albedos. The
 * orbit only adds facts (where it is, whether Rubin could see it) and flags. An object
 * outside the 100,000 AU scope never passes.
 *
 * Pure: no network, no DOM.
 */
import { assessH, assessDiameter, measuredFor, diameterFromH } from './brightness.js';
import { observe, orbitFlags, qualityFlags } from './orbit.js';
import { FLAGS } from './flags.js';

/* An object worth watching even though it fails: possibly large, if dark, on an orbit
   that marks it as out of place - and an orbit known well enough to believe. A fresh,
   uncertain orbit keeps its flags, but is not watched on their strength. */
export const watchWorthy = (flags) =>
    flags.includes('largeIfDark')
    && flags.some((f) => FLAGS[f].kind === 'orbit')
    && !flags.includes('uncertainOrbit');

/* object: { H (visual absolute magnitude), errH (optional), elements (as JPL gives
   them, numbers), quality (optional: arcDays, conditionCode), designation and
   provisional (optional, to find a measured albedo) }. jd: the Julian date to place it
   on. */
export function assessObject({ H, errH = 0, elements, quality = null, designation, provisional }, jd, options = {}) {
    const measured = designation || provisional ? measuredFor({ designation, provisional }) : null;
    const size = measured
        ? { ...assessDiameter(diameterFromH(measured.H, measured.albedo), options), sizeFrom: 'measured', measured }
        : { ...assessH(H, { errH, ...options }), sizeFrom: 'brightness' };
    const seen = observe(elements, H, jd, options);
    const flags = [...size.flags, ...orbitFlags(elements), ...qualityFlags(quality)];
    return {
        ...size,
        passes: size.passes && seen.inScope,
        flags,
        watch: watchWorthy(flags),
        orbit: seen,
    };
}
