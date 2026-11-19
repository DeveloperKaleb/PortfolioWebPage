/* Fetches Gaia DR3 stars with a parallax error under 1% (parallax_over_error > 100) out to
 * a distance, once, and saves them in raw/ (delete the file to fetch again):
 *
 *   node tools/gaiastars/fetch.mjs --max-pc 100                  (then build.mjs --max-pc 100)
 *   node tools/gaiastars/fetch.mjs --max-pc 100000 --pieces 30   (the whole 1% set)
 *
 * Asynchronous queries to the Gaia archive, asked anonymously, one at a time; this waits
 * on each, asking how it is going every 15 seconds. Saved as gzipped CSV: ra, dec
 * (degrees), parallax (mas), phot_g_mean_mag, bp_rp.
 *
 * An anonymous job may run for 60 seconds, which writing out the whole 1% set (5.8
 * million rows) does not fit (2026-11-19). So --pieces splits the query by Gaia's
 * random_index, which spreads the stars evenly, into pieces of about 200,000 rows or
 * fewer (a 243,700-row query fitted). Each piece is saved as it comes, in
 * raw/parts-<max-pc>pc/, and never asked for again, so a run cut short picks up where it
 * stopped; once all are in, they are joined into the one file and the pieces removed.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => { const k = process.argv.indexOf(`--${name}`); return k < 0 ? fallback : process.argv[k + 1]; };
const maxPc = Number(arg('max-pc', 100));
const pieces = Number(arg('pieces', 1));
const raw = join(here, 'raw');
mkdirSync(raw, { recursive: true });
const file = join(raw, `gaia-1pct-${maxPc}pc.csv.gz`);
if (existsSync(file)) { console.error(`${file} is already saved; delete it to fetch again.`); process.exit(0); }

/* gaiadr3.gaia_source's random_index runs from 0 to one less than its 1,811,709,771 rows. */
const SOURCES = 1811709771;
const TAP = 'https://gea.esac.esa.int/tap-server/tap/async';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(query) {
    const body = new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', PHASE: 'RUN', MAXREC: '20000000', QUERY: query });
    const start = await fetch(TAP, { method: 'POST', body, redirect: 'manual' });
    const job = start.headers.get('location');
    if (!job) throw new Error(`Gaia: no job (HTTP ${start.status})`);
    let phase;
    for (;;) {
        await wait(15000);
        phase = (await (await fetch(`${job}/phase`)).text()).trim();
        if (['COMPLETED', 'ERROR', 'ABORTED'].includes(phase)) break;
    }
    if (phase !== 'COMPLETED') throw new Error(`Gaia job ${job} ended ${phase}: ${(await (await fetch(job)).text()).match(/<uws:message><!\[CDATA\[([\s\S]*?)\]\]>/)?.[1] ?? ''}`);
    return (await fetch(`${job}/results/result`)).text();
}

const where = `parallax_over_error > 100 AND parallax > ${1000 / maxPc} AND phot_g_mean_mag IS NOT NULL`;
const select = 'SELECT ra, dec, parallax, phot_g_mean_mag, bp_rp FROM gaiadr3.gaia_source WHERE';
if (pieces === 1) {
    const csv = await ask(`${select} ${where}`);
    writeFileSync(file, gzipSync(csv));
    console.error(`Saved ${csv.split('\n').length - 2} stars to ${file}`);
} else {
    /* A piece that runs out of the archive's 60 seconds (it happened to one piece in 30 on
       2026-11-19, the archive being slower for a moment) is asked again as two halves, and
       those halved again if need be, down to a sixteenth. */
    const askRange = async (lo, hi, depth = 0) => {
        try {
            return await ask(`${select} random_index >= ${lo} AND random_index < ${hi} AND ${where}`);
        } catch (error) {
            if (!/Maximum execution time/.test(error.message) || depth >= 4) throw error;
            const mid = Math.floor((lo + hi) / 2);
            console.error(`  ran out of time; asking again in two halves`);
            await wait(5000);
            const [a, b] = [await askRange(lo, mid, depth + 1), await askRange(mid, hi, depth + 1)];
            const [head, ...rowsA] = a.split('\n').filter(Boolean);
            const [, ...rowsB] = b.split('\n').filter(Boolean);
            return `${head}\n${[...rowsA, ...rowsB].join('\n')}\n`;
        }
    };
    const parts = join(raw, `parts-${maxPc}pc`);
    mkdirSync(parts, { recursive: true });
    const partFile = (k) => join(parts, `part-${String(k).padStart(3, '0')}.csv.gz`);
    for (let k = 0; k < pieces; k++) {
        if (existsSync(partFile(k))) continue;
        const lo = Math.floor(SOURCES * k / pieces), hi = Math.floor(SOURCES * (k + 1) / pieces);
        const csv = await askRange(lo, hi);
        writeFileSync(partFile(k), gzipSync(csv));
        console.error(`Piece ${k + 1} of ${pieces}: ${csv.split('\n').length - 2} stars`);
        await wait(5000);
    }
    /* Join them, the header once. */
    let header = null, rows = 0;
    const chunks = [];
    for (let k = 0; k < pieces; k++) {
        const lines = gunzipSync(readFileSync(partFile(k))).toString('utf8').split('\n').filter(Boolean);
        header ??= lines[0];
        if (lines[0] !== header) throw new Error(`Piece ${k} has a different header`);
        chunks.push(lines.slice(1).join('\n'));
        rows += lines.length - 1;
    }
    writeFileSync(file, gzipSync(`${header}\n${chunks.join('\n')}\n`));
    rmSync(parts, { recursive: true, force: true });
    console.error(`Saved ${rows} stars to ${file}`);
}
