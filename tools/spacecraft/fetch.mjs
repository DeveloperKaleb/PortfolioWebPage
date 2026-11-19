/* Fetches the tracks the spacecraft built into the site need, once, and saves it here in raw/, so
 * nothing is ever asked for twice (delete a file to fetch it again):
 *
 *   npm run spacecraft:fetch     (then npm run spacecraft to build js/spacecrafttracks.js)
 *
 * - Each free-flying craft in CRAFT (js/spacecraft.js): its positions from JPL Horizons
 *   over SPAN_START to SPAN_STOP (fetchCraftTrack in js/sources.js, which cuts the span to
 *   what Horizons holds).
 *
 * The collector refreshes the craft monthly into rubin-data on its own; this is for the
 * fallback built into the site. Every request goes through the courtesy layer
 * (js/polite.js): one at a time, five seconds apart, within a budget.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPoliteFetch } from '../../js/polite.js';
import { fetchCraftTrack } from '../../js/sources.js';
import { CRAFT } from '../../js/spacecraft.js';
import { SPAN_START, SPAN_STOP } from './span.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const raw = join(here, 'raw');
mkdirSync(raw, { recursive: true });
const polite = createPoliteFetch({ fetch });
const today = new Date().toISOString().slice(0, 10);

for (const craft of CRAFT.filter((s) => s.horizons)) {
    const file = join(raw, `${craft.id}.json`);
    if (existsSync(file)) continue;
    const got = await fetchCraftTrack(polite, craft.horizons, SPAN_START, SPAN_STOP);
    if (!got.rows.length) {
        console.error(`${craft.name}: no rows. Horizons said:\n${got.said.slice(0, 600)}`);
        continue;
    }
    writeFileSync(file, JSON.stringify({ id: craft.id, horizons: craft.horizons, start: got.start, stop: got.stop, stepDays: 5, fetched: today, rows: got.rows }));
    console.error(`${craft.name}: ${got.rows.length} rows, ${got.start} to ${got.stop}`);
}
