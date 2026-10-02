/* The Rubin collector: one run reads the rubin-data repo's state, fetches what is due
 * from JPL and Fink through the courtesy layer, assesses every TNO, and writes the
 * month's inputs, digest and changes back. The logic is in js/collector.js; this file
 * only reads, writes and fetches.
 *
 *     node tools/rubin-collect.mjs --data <rubin-data checkout> [--date YYYY-MM-DD] [--live]
 *
 * Without --live it runs on recorded responses (the test fixtures), touching no live
 * service: a dry run to see a real digest before anything is fetched. Dev and CI only,
 * never shipped. The scheduled run is the GitHub Action in rubin-data; a template is in
 * tools/rubin-data-template/.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createPoliteFetch } from '../js/polite.js';
import { fetchTnos, fetchDetections, parseJplPage } from '../js/sources.js';
import { planRun, selectForFink, choosePhotometry, buildDigest, diffDigests, provenance, stringifyLines, FORMAT } from '../js/collector.js';
import { jdFromDate } from '../js/orbit.js';

const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null);
const writeJson = (file, value) => {
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, stringifyLines(value));
};

/* The newest month directory under inputs/ that holds this file, if any. */
function latestInput(dataDir, file) {
    const root = join(dataDir, 'inputs');
    if (!existsSync(root)) return null;
    const months = readdirSync(root).filter((m) => /^\d{4}-\d{2}$/.test(m) && existsSync(join(root, m, file))).sort();
    return months.length ? { month: months.at(-1), value: readJson(join(root, months.at(-1), file)) } : null;
}

/* The newest digest from a month before this one, to compare against. */
function previousDigest(dataDir, month) {
    const root = join(dataDir, 'digest');
    if (!existsSync(root)) return null;
    const months = readdirSync(root).map((f) => f.match(/^(\d{4}-\d{2})\.json$/)?.[1]).filter((m) => m && m < month).sort();
    return months.length ? readJson(join(root, `${months.at(-1)}.json`)) : null;
}

export async function collect({ dataDir, date = new Date(), polite, siteCommit = 'unknown', log = () => {} }) {
    const state = readJson(join(dataDir, 'state.json')) ?? { format: FORMAT };
    const plan = planRun(state, date);
    const notes = [];

    /* JPL: the count every run, the whole list when it moved or the month turned. */
    const stored = latestInput(dataDir, 'tnos.json');
    const listed = await fetchTnos(polite, { previousCount: plan.newMonth || !stored ? null : state.jplCount });
    let tnos, tnosFrom;
    if (listed) {
        tnos = listed.objects;
        tnosFrom = plan.month;
        writeJson(join(dataDir, 'inputs', plan.month, 'tnos.json'), { fetched: date.toISOString(), count: listed.count, objects: tnos });
        Object.assign(state, { jplCount: listed.count, jplFetchedMonth: plan.month });
        log(`JPL: ${listed.count} TNOs fetched`);
    } else {
        ({ value: { objects: tnos }, month: tnosFrom } = stored);
        log(`JPL: count unchanged at ${state.jplCount}, using ${tnosFrom}`);
    }

    /* Fink: once a month. A failure is noted in the digest, and last month's
       detections are used, rather than losing the run. */
    let detections = latestInput(dataDir, 'detections.json');
    let detectionsFrom = detections?.month ?? null;
    if (plan.fetchFink) {
        try {
            const { chosen, unpackable } = selectForFink(tnos);
            const { byProvisional, unresolved } = await fetchDetections(polite, chosen);
            const value = {
                fetched: date.toISOString(), asked: chosen.length,
                unresolved: unresolved.map((o) => o.designation), unpackable,
                detections: Object.fromEntries(byProvisional),
            };
            writeJson(join(dataDir, 'inputs', plan.month, 'detections.json'), value);
            detections = { month: plan.month, value };
            detectionsFrom = plan.month;
            state.finkFetchedMonth = plan.month;
            log(`Fink: asked about ${chosen.length}, detections for ${byProvisional.size}, unresolved ${unresolved.length}`);
        } catch (error) {
            notes.push(`Fink failed this month (${error.message}); used ${detectionsFrom ?? 'no'} detections.`);
            log(`Fink failed: ${error.message}`);
        }
    }

    const { objects, withoutH } = choosePhotometry(tnos, detections?.value.detections ?? {});
    if (withoutH.length) notes.push(`${withoutH.length} TNOs have no H anywhere and were not assessed.`);

    const digest = buildDigest({
        objects, date, jd: jdFromDate(date), notes,
        provenance: provenance({ siteCommit, sources: { jplCount: state.jplCount ?? tnos.length, tnosFrom, detectionsFrom, requests: polite.used?.() ?? null } }),
    });
    const changes = diffDigests(previousDigest(dataDir, plan.month), digest);

    writeJson(join(dataDir, 'digest', `${plan.month}.json`), digest);
    writeJson(join(dataDir, 'digest', 'latest.json'), digest);
    writeJson(join(dataDir, 'changes', `${plan.month}.json`), changes);
    writeJson(join(dataDir, 'state.json'), { ...state, format: FORMAT, lastRun: date.toISOString() });
    log(`Digest ${plan.month}: ${digest.counts.assessed} assessed, ${digest.counts.passes} pass, ${digest.entries.length} recorded, ${changes.entries.length} changes`);
    return { digest, changes, state };
}

/* ---- Dry run: recorded responses only ---------------------------------------------- */

/* Answers like JPL and Fink would, from what was recorded on 2026-10-02: the three-object
   JPL page, plus Eris, Sedna and Gonggong (whose orbits were recorded for the orbit
   tests) so the dry run has Rubin detections to use. Nothing leaves the machine. */
export async function recordedPolite() {
    const { JPL_PAGE, GONGGONG_DETECTIONS } = await import('../tests/sources/fixtures.js');
    const { OBJECTS } = await import('../tests/orbit/fixtures.js');
    const page = JSON.parse(JPL_PAGE);
    const extra = [['136199', ' 136199 Eris (2003 UB313)', OBJECTS.Eris], ['90377', ' 90377 Sedna (2003 VB12)', OBJECTS.Sedna], ['225088', ' 225088 Gonggong (2007 OR10)', OBJECTS.Gonggong]];
    for (const [pdes, fullName, o] of extra) {
        const { a, e, i, om, w, ma, epoch } = o.elements;
        page.data.push([pdes, fullName, String(o.H), ...[a, e, i, om, w, ma, epoch].map(String)]);
    }
    page.count = page.data.length;
    let used = 0;
    const polite = async (url) => {
        used++;
        const answer = (body) => ({ status: 200, ok: true, notModified: false, headers: new Headers(), body });
        if (url.includes('sbdb_query') && !url.includes('fields=')) return answer(JSON.stringify({ count: page.count }));
        if (url.includes('sbdb_query')) return answer(JSON.stringify(page));
        if (url.includes('fink')) return answer(JSON.stringify(url.includes('M5088') ? GONGGONG_DETECTIONS : []));
        throw new Error(`dry run has no recording for ${url}`);
    };
    polite.used = () => used;
    return polite;
}

/* ---- Command line ------------------------------------------------------------------- */

function siteCommitHere() {
    try {
        return execSync('git rev-parse HEAD', { cwd: fileURLToPath(new URL('..', import.meta.url)) }).toString().trim();
    } catch {
        return 'unknown';
    }
}

async function main(argv) {
    const arg = (name) => { const k = argv.indexOf(name); return k >= 0 ? argv[k + 1] : null; };
    const dataDir = arg('--data');
    if (!dataDir) {
        console.error('usage: node tools/rubin-collect.mjs --data <rubin-data checkout> [--date YYYY-MM-DD] [--live]');
        process.exit(1);
    }
    const live = argv.includes('--live');
    const date = arg('--date') ? new Date(`${arg('--date')}T06:00:00Z`) : new Date();
    const polite = live ? createPoliteFetch({ fetch: globalThis.fetch }) : await recordedPolite();
    console.log(live ? 'LIVE run: fetching from JPL and Fink.' : 'Dry run: recorded responses only, nothing fetched.');
    await collect({ dataDir: resolve(dataDir), date, polite, siteCommit: siteCommitHere(), log: console.log });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main(process.argv.slice(2)).catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
