/* Builds the star tiles (js/startiles.js) from what fetch.mjs saved, and reports their
 * size. Makes no request.
 *
 *   node tools/gaiastars/build.mjs --max-pc 100 [--per-node 4096] [--root-half 2048]
 *
 * Writes out/<max-pc>pc/: index.json and one r<path>.bin per node. out/ is not committed:
 * the tiles are published from the gaia-stars repository (NOTES.md, "Step 3"), by copying
 * this folder into a new folder there.
 */
import { createReadStream, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGunzip, gzipSync } from 'node:zlib';
import { existsSync } from 'node:fs';
import { gaiaStar, buildTree, makeIndex, encodeTile, encodeIds, cubeOf, tileName, idsName, ROOT_HALF, PER_NODE } from '../../js/startiles.js';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => { const k = process.argv.indexOf(`--${name}`); return k < 0 ? fallback : process.argv[k + 1]; };
const maxPc = Number(arg('max-pc', 100));
const perNode = Number(arg('per-node', PER_NODE));
const half = Number(arg('root-half', ROOT_HALF));

/* Read a line at a time: the full 1% set is about 440 MB of text, too much to hold as one
   string beside its stars. */
/* With ids (fetch.mjs --ids, then --hip) the stars carry their source_ids and Hipparcos
   numbers, and an ID file is written beside each tile. */
const withIds = existsSync(join(here, 'raw', `gaia-1pct-ids-${maxPc}pc.csv.gz`));
const hipOf = new Map();
if (withIds && existsSync(join(here, 'raw', 'gaia-1pct-hip.csv.gz'))) {
    const hipLines = createInterface({ input: createReadStream(join(here, 'raw', 'gaia-1pct-hip.csv.gz')).pipe(createGunzip()), crlfDelay: Infinity });
    let first = true;
    for await (const line of hipLines) {
        if (first || !line) { first = false; continue; }
        const [id, hip] = line.split(',');
        hipOf.set(id, hip);
    }
}
const stars = [];
let cols = null, csvBytes = 0;
const lines = createInterface({ input: createReadStream(join(here, 'raw', `gaia-1pct-${withIds ? 'ids-' : ''}${maxPc}pc.csv.gz`)).pipe(createGunzip()), crlfDelay: Infinity });
for await (const line of lines) {
    if (!line) continue;
    csvBytes += line.length + 1;
    const v = line.split(',');
    if (!cols) { cols = ['ra', 'dec', 'parallax', 'phot_g_mean_mag', 'bp_rp', 'source_id'].map((n) => v.map((h) => h.replace(/"/g, '')).indexOf(n)); continue; }
    const [ra, dec, plx, g, bpRp, sid] = cols;
    const star = gaiaStar({ ra: +v[ra], dec: +v[dec], parallax: +v[plx], g: +v[g], bpRp: v[bpRp] === '' ? null : +v[bpRp] });
    if (sid >= 0) { star.id = v[sid]; star.hip = hipOf.get(v[sid]) ?? null; }
    stars.push(star);
}

const { nodes, outside } = buildTree(stars, { half, perNode });
const out = join(here, 'out', `${maxPc}pc`);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
let bytes = 0, zipped = 0, depth = 0, idsBytes = 0;
for (const [path, list] of nodes) {
    const tile = encodeTile(list, cubeOf(path, half));
    writeFileSync(join(out, tileName(path)), tile);
    if (withIds) { const idBytes = encodeIds(list); writeFileSync(join(out, idsName(path)), idBytes); idsBytes += idBytes.length; }
    bytes += tile.length;
    zipped += gzipSync(tile, { level: 9 }).length;
    depth = Math.max(depth, path.length);
}
const index = makeIndex(nodes, { half, perNode, source: `Gaia DR3, parallax error under 1%, within ${maxPc} pc` });
writeFileSync(join(out, 'index.json'), JSON.stringify(index));

const mb = (n) => `${(n / 1e6).toFixed(2)} MB`;
const noColour = stars.filter((s) => s.colour === null).length;
console.log(`${stars.length.toLocaleString('en-US')} stars read, ${outside} outside the root, ${noColour.toLocaleString('en-US')} without a colour`);
console.log(`${nodes.size} tiles, ${depth} levels below the root; root holds ${nodes.get('').length}`);
console.log(`tiles ${mb(bytes)} (${(bytes / index.stars).toFixed(2)} bytes a star), gzipped ${mb(zipped)}; index ${mb(JSON.stringify(index).length)}`);
console.log(`raw CSV for comparison: ${mb(csvBytes)}`);
if (withIds) console.log(`ID files ${mb(idsBytes)}; ${hipOf.size.toLocaleString('en-US')} Hipparcos numbers known`);
