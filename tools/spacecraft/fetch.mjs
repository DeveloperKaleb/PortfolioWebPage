/* Fetches what the spacecraft built into the site need, once, and saves it here in raw/, so
 * nothing is ever asked for twice (delete a file to fetch it again):
 *
 *   npm run spacecraft:fetch     (then npm run spacecraft to build js/spacecrafttracks.js)
 *
 * - Each free-flying craft in CRAFT (js/spacecraft.js): its positions from JPL Horizons
 *   over SPAN_START to SPAN_STOP (fetchCraftTrack in js/sources.js, which cuts the span to
 *   what Horizons holds).
 * - The satellites in Earth orbit, working and not, counted from CelesTrak's satellite
 *   catalogue: one download, of which only the counts are kept.
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

/* CelesTrak's catalogue: payloads still in orbit about Earth. Its status codes: + working,
   P partly, B backup, S spare, X extended mission; - not working, ? unknown. */
const earthFile = join(raw, 'earth-orbit.json');
if (!existsSync(earthFile)) {
    const response = await polite('https://celestrak.org/pub/satcat.csv', { headers: { Accept: 'text/csv, text/plain, */*' } });
    if (!response.ok) throw new Error(`CelesTrak: HTTP ${response.status}`);
    const [head, ...lines] = response.body.trim().split(/\r?\n/);
    const col = Object.fromEntries(head.split(',').map((name, k) => [name, k]));
    let active = 0, inactive = 0, unknown = 0;
    for (const line of lines) {
        const cells = line.split(',');
        if (cells[col.OBJECT_TYPE] !== 'PAY' || cells[col.ORBIT_CENTER] !== 'EA' || cells[col.DECAY_DATE]) continue;
        const status = cells[col.OPS_STATUS_CODE];
        if (status && '+PBSX'.includes(status)) active++;
        else if (status === '?') unknown++;
        else inactive++;
    }
    writeFileSync(earthFile, JSON.stringify({ active, inactive: inactive + unknown, unknownCounted: unknown, source: 'CelesTrak satellite catalogue (celestrak.org/pub/satcat.csv)', date: today }, null, 1));
    console.error(`Earth orbit: ${active} working, ${inactive} not, ${unknown} unknown (counted as not)`);
}
