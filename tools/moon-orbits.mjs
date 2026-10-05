/* Refits the round moons' orbits in js/moons.js from JPL Horizons, by hand.
 *
 *   npm run moons -- [YYYY-MM-DD]     (the epoch; default today)
 *
 * The scheduled collector already refits them once a year into rubin-data's moons.json, and
 * the digest carries that fit. This tool is for updating the fallback built into
 * js/moons.js: it makes the same requests (one per moon, through the courtesy layer, so
 * five seconds apart), prints each moon's error on the check date, and prints the
 * MOON_EPOCH and MOON_ORBITS to paste in. Luna is not fitted. See NOTES.md.
 */
import { jdFromDate } from '../js/orbit.js';
import { createPoliteFetch } from '../js/polite.js';
import { fetchMoonVectors } from '../js/sources.js';
import { MOON_HORIZONS, moonFitTimes, fitMoons } from '../js/moons.js';

const epoch = jdFromDate(new Date(`${process.argv[2] ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`));
const polite = createPoliteFetch({ fetch });
const { rows, failed } = await fetchMoonVectors(polite, MOON_HORIZONS, moonFitTimes(epoch));
if (failed.length) {
    console.error(`No positions for ${failed.join(', ')}; nothing printed.`);
    process.exit(1);
}
const fit = fitMoons(rows, epoch);
if (!fit.ok) {
    console.error(`Refit not usable: ${fit.reason}.`);
    process.exit(1);
}
for (const [name, degrees] of Object.entries(fit.checks)) console.error(`${name}: ${degrees} degrees off on the check date`);
const lines = Object.entries(fit.set.orbits).map(([name, o]) =>
    `    ${name}: { parent: '${o.parent}', a: ${o.a}, period: ${o.period}, p: [${o.p.join(', ')}], q: [${o.q.join(', ')}] },`);
console.log(`export const MOON_EPOCH = ${epoch};\n\nexport const MOON_ORBITS = {\n${lines.join('\n')}\n};`);
