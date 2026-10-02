/* From how bright an object is to the chance it was shaped by its own gravity.
 *
 * Rubin never measures a distant object's size, only its absolute magnitude H. The same H
 * fits a small bright body or a large dark one: diameter = 1329 km / sqrt(albedo) x
 * 10^(-H/5). So the chance from js/equilibrium.js is averaged over the albedos the object
 * plausibly has.
 *
 * Which albedos matters as much as the averaging. Albedo is tied to size: the largest
 * TNOs are bright with ice and frost (Pluto, Eris, Haumea and Makemake average about
 * 0.77), the small ones mostly dark (the median TNO is about 0.13). Averaging over all
 * TNOs would treat a bright object as probably dark, so far larger than it is. The
 * albedos used are those measured for TNOs of similar H, from js/tnoalbedos.js, the
 * window widening until there are enough of them. See NOTES.md.
 *
 * H here is visual (V band), as in the albedo data. Rubin measures H in its own bands, so
 * a Rubin H has to be converted before it comes here - a job for the collector.
 *
 * Pure: no network, no DOM.
 */
import { CALIBRATION, READINGS, fitEquilibrium, chanceShaped } from './equilibrium.js';
import { TNO_ALBEDOS } from './tnoalbedos.js';

/* The standard relation between diameter, visual geometric albedo and absolute
   magnitude, from the Sun's apparent magnitude. */
export const DIAMETER_CONSTANT_KM = 1329;

export const diameterFromH = (H, albedo) => DIAMETER_CONSTANT_KM / Math.sqrt(albedo) * 10 ** (-H / 5);

/* How the measured albedos are weighted by closeness in H.
 *
 * Every measured albedo counts, weighted by a bell curve in H centred on the object. Its
 * width is the distance to the minCount-th nearest measurement, but never under
 * minWidth: narrow where the data is dense, wide where it is sparse. The first version
 * used a hard window that widened in steps, and objects dropping in and out of it made
 * the chance jump: five dark objects entering at H 3.25 made a fainter object score
 * higher than a brighter one. A bell curve lets each measurement fade in. */
export const ALBEDO_SAMPLE = { minCount: 10, minWidth: 0.5, maxWidth: Infinity };

/* The measured albedos with their weights (summing to 1) for an object of this H, and
   the bell curve's width. effectiveCount is how many equally weighted measurements the
   weights are worth. */
export function albedosNear(H, { sample = TNO_ALBEDOS, ...options } = {}) {
    const { minCount, minWidth, maxWidth } = { ...ALBEDO_SAMPLE, ...options };
    if (sample.length < minCount) throw new Error(`need at least ${minCount} measured albedos`);
    const distances = sample.map((o) => Math.abs(o.H - H)).sort((a, b) => a - b);
    /* maxWidth caps the reach for a size to show on the page (js/rubinview.js): at the
       bright end the uncapped curve takes in dark albedos and made Eris, from H alone,
       about 6,500 km. The filter's verdicts keep the uncapped curve. */
    const width = Math.min(maxWidth, Math.max(minWidth, distances[minCount - 1]));
    const raw = sample.map((o) => Math.exp(-0.5 * ((o.H - H) / width) ** 2));
    const total = raw.reduce((a, b) => a + b, 0);
    const weights = raw.map((w) => w / total);
    const effectiveCount = 1 / weights.reduce((a, w) => a + w * w, 0);
    return { albedos: sample.map((o) => o.albedo), weights, width, effectiveCount };
}

/* H uncertainty is folded in with three-point Gauss-Hermite quadrature: H at the mean and
   at sqrt(3) standard deviations either side, weighted 2/3, 1/6 and 1/6. Exact for the
   spread of a normal error up to fifth order, and three fits rather than hundreds. */
const H_POINTS = [[0, 2 / 3], [Math.sqrt(3), 1 / 6], [-Math.sqrt(3), 1 / 6]];

let fits = null;
const readingFits = () => fits ??= {
    evidence: fitEquilibrium(READINGS.evidence(CALIBRATION)),
    grundy: fitEquilibrium(READINGS.grundy(CALIBRATION)),
};

/* The albedo of the darkest TNOs measured: the given quantile of the snapshot (5% by
   default, about 0.035). Taken from the data rather than chosen, so it moves if darker
   objects are measured. */
export function darkAlbedo({ sample = TNO_ALBEDOS, quantile = 0.05 } = {}) {
    const sorted = sample.map((o) => o.albedo).sort((a, b) => a - b);
    return sorted[Math.floor(quantile * (sorted.length - 1))];
}

/* The flags are defined, with their words, in js/flags.js, shared with the orbit
   checks. Re-exported here for anything that only needs the brightness side. */
export { FLAGS } from './flags.js';

/* The filter's verdict on an object of visual absolute magnitude H (with standard error
   errH):
   - evidence, grundy: the chance under each reading of the calibration list, averaged
     over plausible albedos and over the error in H;
   - ifDark: the same chances if it were as dark as the darkest TNOs measured;
   - passes: the evidence reading at or above the threshold;
   - flags: names from FLAGS. 'disputed' only on a pass, 'largeIfDark' only on a fail.

   The plain average is a bet on what is typical, and at faint H nearly everything
   measured is small, so a large dark body - something out of place, captured or
   scattered in - would be averaged away: at albedo 0.04 a body up to about 1,000 km
   fails. ifDark and the largeIfDark flag record those instead of losing them, without
   loosening the filter. */
export function assessH(H, { errH = 0, threshold = 0.8, sample = TNO_ALBEDOS } = {}) {
    const { evidence: evidenceFit, grundy: grundyFit } = readingFits();
    const dark = darkAlbedo({ sample });
    let evidence = 0, grundy = 0, darkEvidence = 0, darkGrundy = 0, effectiveCount = 0, width = 0;
    for (const [offset, weight] of H_POINTS) {
        const h = H + offset * errH;
        const near = albedosNear(h, { sample });
        if (offset === 0) ({ width, effectiveCount } = near);
        near.albedos.forEach((albedo, k) => {
            const d = diameterFromH(h, albedo);
            evidence += weight * near.weights[k] * chanceShaped(evidenceFit, d);
            grundy += weight * near.weights[k] * chanceShaped(grundyFit, d);
        });
        const darkD = diameterFromH(h, dark);
        darkEvidence += weight * chanceShaped(evidenceFit, darkD);
        darkGrundy += weight * chanceShaped(grundyFit, darkD);
    }
    const passes = evidence >= threshold;
    const flags = [];
    if (passes && grundy < threshold) flags.push('disputed');
    if (!passes && darkEvidence >= threshold) flags.push('largeIfDark');
    return {
        evidence, grundy, passes, flags,
        disputed: flags.includes('disputed'),
        ifDark: { albedo: dark, evidence: darkEvidence, grundy: darkGrundy },
        effectiveCount, width,
    };
}

/* ---- Measured sizes ------------------------------------------------------------------- */

/* For an object whose albedo has been measured (js/tnoalbedos.js), the size is known and
   averaging over typical albedos would throw that away. The first live run showed it:
   Salacia's catalogue H, averaged over typical albedos, gave 78% and failed, though its
   albedo is measured (dark, 0.041). The measured pair gives the diameter directly. */

/* The snapshot names objects "(120347) Salacia 2004 SB60" or "2014 UZ224": index by
   number and by provisional designation, either of which JPL may use. */
let measuredIndex = null;
function indexMeasured(sample) {
    const index = new Map();
    for (const o of sample) {
        const number = o.name.match(/^\((\d+)\)/)?.[1];
        const provisional = o.name.match(/(\d{4} [A-Z]{2}\d*)$/)?.[1];
        if (number) index.set(number, o);
        if (provisional) index.set(provisional, o);
    }
    return index;
}

/* The measured albedo for an object, by JPL designation or provisional designation, or
   null. */
export function measuredFor({ designation, provisional }, { sample = TNO_ALBEDOS } = {}) {
    const index = sample === TNO_ALBEDOS ? (measuredIndex ??= indexMeasured(sample)) : indexMeasured(sample);
    return index.get(String(designation)) ?? index.get(String(provisional)) ?? null;
}

/* The verdict for an object of known diameter: the same shape as assessH, but no
   averaging, so no large-if-dark question - the size is measured. */
export function assessDiameter(diameterKm, { threshold = 0.8 } = {}) {
    const { evidence: evidenceFit, grundy: grundyFit } = readingFits();
    const evidence = chanceShaped(evidenceFit, diameterKm);
    const grundy = chanceShaped(grundyFit, diameterKm);
    const passes = evidence >= threshold;
    const flags = passes && grundy < threshold ? ['disputed'] : [];
    return {
        evidence, grundy, passes, flags,
        disputed: flags.includes('disputed'),
        ifDark: { albedo: null, evidence, grundy },
        diameterKm,
    };
}
