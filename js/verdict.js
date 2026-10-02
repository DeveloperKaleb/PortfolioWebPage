/* The Rubin filter's whole verdict on one object: the brightness check (js/brightness.js)
 * and the orbit (js/orbit.js) together. This is what the collector will call for each
 * object and what the digest will record.
 *
 * Passing is the brightness check alone. The orbit only adds facts (where it is, whether
 * Rubin could see it) and flags. An object outside the 100,000 AU scope never passes.
 *
 * Pure: no network, no DOM.
 */
import { assessH } from './brightness.js';
import { observe, orbitFlags } from './orbit.js';
import { FLAGS } from './flags.js';

/* An object worth watching even though it fails: possibly large, if dark, and on an
   orbit that marks it as out of place. */
export const watchWorthy = (flags) =>
    flags.includes('largeIfDark') && flags.some((f) => FLAGS[f].kind === 'orbit');

/* object: { H (visual absolute magnitude), errH (optional), elements (as JPL gives
   them, numbers) }. jd: the Julian date to place it on. */
export function assessObject({ H, errH = 0, elements }, jd, options = {}) {
    const brightness = assessH(H, { errH, ...options });
    const seen = observe(elements, H, jd, options);
    const flags = [...brightness.flags, ...orbitFlags(elements)];
    return {
        ...brightness,
        passes: brightness.passes && seen.inScope,
        flags,
        watch: watchWorthy(flags),
        orbit: seen,
    };
}
