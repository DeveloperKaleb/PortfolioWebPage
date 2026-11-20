/* Builds the star name files (js/starnames.js): one r<path>.names.json beside each tile in
 * out/<max-pc>pc/, { k: name } for the stars of that tile that have a name better than
 * their Hipparcos or Gaia number. Run after build.mjs; makes no request.
 *
 *   node tools/gaiastars/names.mjs --max-pc 100000
 *
 * Reads what was saved by hand in raw/names/ (2026-11-19, NOTES.md):
 *   hip-hd.tsv               VizieR I/239/hip_main, HIP and HD (Harvard mirror)
 *   simbad-proper-bayer.csv  SIMBAD: every Gaia DR3 star's NAME and "* " identifiers
 *   simbad-nearby.csv        SIMBAD: within 100 light years, GJ, Wolf, Ross, LHS, HD, V*
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeIds, idsName } from '../../js/startiles.js';
import { bestName, namesName } from '../../js/starnames.js';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => { const k = process.argv.indexOf(`--${name}`); return k < 0 ? fallback : process.argv[k + 1]; };
const out = join(here, 'out', `${Number(arg('max-pc', 100000))}pc`);
const raw = join(here, 'raw', 'names');

const hd = new Map();
for (const line of readFileSync(join(raw, 'hip-hd.tsv'), 'utf8').split('\n')) {
    const m = /^\s*(\d+)\t\s*(\d+)\s*$/.exec(line);
    if (m) hd.set(m[1], m[2]);
}
const idents = new Map();
for (const file of ['simbad-proper-bayer.csv', 'simbad-nearby.csv']) {
    for (const line of readFileSync(join(raw, file), 'utf8').split('\n').slice(1)) {
        const m = /^"Gaia DR3 (\d+)","(.*)"\s*$/.exec(line);
        if (!m) continue;
        if (!idents.has(m[1])) idents.set(m[1], []);
        idents.get(m[1]).push(m[2]);
    }
}

const index = JSON.parse(readFileSync(join(out, 'index.json'), 'utf8'));
let named = 0, files = 0, bytes = 0;
const byRank = new Map();
for (const [path, count] of index.nodes) {
    const ids = decodeIds(new Uint8Array(readFileSync(join(out, idsName(path)))), count);
    const names = {};
    for (let k = 0; k < count; k++) {
        const list = [...(idents.get(ids.id(k)) ?? [])];
        const hip = ids.hip(k);
        if (hip && hd.has(String(hip))) list.push(`HD ${hd.get(String(hip))}`);
        const name = bestName(list);
        if (name) { names[k] = name; named++; const kind = name.split(' ')[0]; byRank.set(kind, (byRank.get(kind) ?? 0) + 1); }
    }
    const text = JSON.stringify(names);
    writeFileSync(join(out, namesName(path)), text);
    files++;
    bytes += text.length;
}
console.log(`${named.toLocaleString()} stars named in ${files} files, ${(bytes / 1e6).toFixed(2)} MB`);
console.log(`of which HD ${byRank.get('HD') ?? 0}, GJ ${byRank.get('GJ') ?? 0}, LHS ${byRank.get('LHS') ?? 0}; the rest proper, Bayer, Flamsteed, Wolf, Ross or variable`);
