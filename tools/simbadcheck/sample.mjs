/* A random sample of the published star tiles (../gaia-stars/dr3-1pct), turned back into
 * sky places, for checking against Gaia DR3 itself (check.py). Seeded, so the same sample
 * every run. Writes raw/tile-sample.csv: for each star its tile, where the tile puts it
 * (ra, dec, distance), its G and BP-RP as stored, and how far off the tile's rounding can
 * have moved it (tol_deg, tol_pc).
 *
 *   node tools/simbadcheck/sample.mjs [count] [tiles folder]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeTile, cubeOf, tileName, magOf, colourOf, MAG_STEP, COLOUR_STEP } from '../../js/startiles.js';
import { skyToMap } from '../../js/centauri.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const count = Number(process.argv[2] ?? 1000);
const folder = process.argv[3] ?? path.resolve(here, '../../../gaia-stars/dr3-1pct');
const index = JSON.parse(fs.readFileSync(path.join(folder, 'index.json'), 'utf8'));

/* mulberry32: a small seeded generator. */
let seed = 20261119;
const random = () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* skyToMap is a rotation (times distance): its columns, from the three axes of the sky's
   frame, turn back by the transpose. */
const toMap = [skyToMap(0, 0, 1), skyToMap(90, 0, 1), skyToMap(0, 90, 1)];
const toSky = ([x, y, z]) => [0, 1, 2].map((i) => toMap[i][0] * x + toMap[i][1] * y + toMap[i][2] * z);

const total = index.nodes.reduce((n, [, c]) => n + c, 0);
const picks = new Set();
while (picks.size < count) picks.add(Math.floor(random() * total));
const wanted = [...picks].sort((a, b) => a - b);

const rows = ['tile,k,ra,dec,dist_pc,g,bp_rp,tol_deg,tol_pc'];
let start = 0;
let w = 0;
for (const [p, c] of index.nodes) {
    const mine = [];
    while (w < wanted.length && wanted[w] < start + c) mine.push(wanted[w++] - start);
    start += c;
    if (!mine.length) continue;
    const cube = cubeOf(p, index.rootHalf);
    const tile = decodeTile(new Uint8Array(fs.readFileSync(path.join(folder, tileName(p)))), cube);
    /* The rounding: half a step of 65535 across the cube, on each of three axes. */
    const tolPc = (2 * cube.half / 65535) / 2 * Math.sqrt(3);
    for (const k of mine) {
        const xyz = [tile.xyz[k * 3], tile.xyz[k * 3 + 1], tile.xyz[k * 3 + 2]];
        const d = Math.hypot(...xyz);
        const [sx, sy, sz] = toSky(xyz.map((v) => v / d));
        const ra = ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360;
        const dec = (Math.asin(Math.max(-1, Math.min(1, sz))) * 180) / Math.PI;
        const absMag = magOf(tile.mag[k]);
        const g = absMag + 5 * Math.log10(d) - 5;
        const c = colourOf(tile.colour[k]);
        const tolDeg = Math.min(1, (Math.asin(Math.min(1, tolPc / d)) * 180) / Math.PI + 1 / 3600);
        rows.push([p || 'root', k, ra.toFixed(7), dec.toFixed(7), d.toFixed(4), g.toFixed(4), c === null ? '' : c.toFixed(4), tolDeg.toExponential(4), tolPc.toExponential(4)].join(','));
    }
}
fs.mkdirSync(path.join(here, 'raw'), { recursive: true });
fs.writeFileSync(path.join(here, 'raw', 'tile-sample.csv'), rows.join('\n') + '\n');
console.log(`${rows.length - 1} stars sampled of ${total}; mag step ${MAG_STEP}, colour step ${COLOUR_STEP}`);
