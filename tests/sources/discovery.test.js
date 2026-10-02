import { describe, test, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    mpcObsRequest, mpcObscodeRequest, parseDiscovery, parseObscodeName, fetchDiscoveries, fetchStationNames, RUBIN_STATION,
} from '../../js/sources.js';
import { createPoliteFetch } from '../../js/polite.js';
import {
    discoveryQueue, annotateDiscoveries, unnamedStations, emptyDiscoveryStore, DISCOVERY_PER_RUN,
} from '../../js/collector.js';
import { discoveryText, summary } from '../../js/rubinview.js';
import { collect, recordedPolite, liveFetch } from '../../tools/rubin-collect.mjs';
import { MPC_GONGGONG, MPC_X05 } from './fixtures.js';

describe('Reading the MPC', () => {
    test("finds Gonggong's discovery in its real record: Palomar, 17 July 2007", () => {
        expect(parseDiscovery(MPC_GONGGONG)).toEqual({ station: '675', date: '2007-07-17' });
    });

    test('says so when no observation is marked as the discovery', () => {
        expect(parseDiscovery('[{"OBS80": ""}]')).toBeNull();
    });

    test("names Rubin's observatory code", () => {
        expect(RUBIN_STATION).toBe('X05');
        expect(parseObscodeName(MPC_X05)).toMatch(/Rubin Observatory/);
    });

    test('asks as the MPC wants: a GET with a JSON body, one object, 80-column format', () => {
        const { url, options } = mpcObsRequest('2007 OR10');
        expect(url).toMatch(/data\.minorplanetcenter\.net\/api\/get-obs$/);
        expect(options.method).toBe('GET');
        expect(JSON.parse(options.body)).toEqual({ desigs: ['2007 OR10'], output_format: ['OBS80'] });
        expect(JSON.parse(mpcObscodeRequest('X05').options.body)).toEqual({ obscode: 'X05' });
    });
});

describe('Asking politely', () => {
    test('the courtesy layer passes the method and body through', async () => {
        let seen;
        const polite = createPoliteFetch({ fetch: async (url, init) => { seen = init; return new Response('[]'); }, sleep: async () => {}, now: () => 0 });
        await polite('https://example.org/', { method: 'GET', body: '{"x":1}', headers: { 'Content-Type': 'application/json' } });
        expect(seen).toMatchObject({ method: 'GET', body: '{"x":1}' });
        expect(seen.headers['Content-Type']).toBe('application/json');
    });

    test('asks about no more than the limit, in the order given', async () => {
        const asked = [];
        const polite = async (url, options) => { asked.push(JSON.parse(options.body).desigs[0]); return { ok: true, status: 200, body: MPC_GONGGONG }; };
        const objects = Array.from({ length: 5 }, (_, k) => ({ designation: String(k), provisional: `p${k}` }));
        const { found } = await fetchDiscoveries(polite, objects, { limit: 3 });
        expect(asked).toEqual(['p0', 'p1', 'p2']);
        expect(Object.keys(found)).toEqual(['0', '1', '2']);
    });

    test('one failure does not stop the rest; running out of budget does, keeping what was found', async () => {
        let n = 0;
        const polite = async () => {
            n++;
            if (n === 1) return { ok: false, status: 404, body: '' };
            if (n === 3) throw new Error('request budget of 2 used up');
            return { ok: true, status: 200, body: MPC_GONGGONG };
        };
        const objects = Array.from({ length: 4 }, (_, k) => ({ designation: String(k), provisional: `p${k}` }));
        const { found, failed, stopped } = await fetchDiscoveries(polite, objects);
        expect(failed).toEqual([{ designation: '0', reason: 'HTTP 404' }]);
        expect(Object.keys(found)).toEqual(['1']);
        expect(stopped).toMatch(/budget/);
    });

    test('names observatory codes', async () => {
        const polite = async (url, options) => (JSON.parse(options.body).obscode === 'X05'
            ? { ok: true, status: 200, body: MPC_X05 } : { ok: false, status: 404, body: '' });
        expect(await fetchStationNames(polite, ['X05', '675'])).toEqual({ X05: 'Simonyi Survey Telescope, Rubin Observatory' });
    });

    test('the live fetch hands ordinary requests to fetch', async () => {
        const original = globalThis.fetch;
        let called = false;
        globalThis.fetch = async () => { called = true; return new Response('ok'); };
        try {
            await liveFetch('https://example.org/', { headers: {} });
            expect(called).toBe(true);
        } finally {
            globalThis.fetch = original;
        }
    });
});

describe('Keeping what was found', () => {
    const digest = {
        date: '2026-10-05', counts: {},
        entries: [
            { designation: '225088', name: '225088 Gonggong (2007 OR10)' },
            { designation: '2026 AB1', name: '(2026 AB1)' },
            { designation: '9', name: '9 Old (1999 AA1)' },
        ],
    };

    test('asks only about what it does not know, in the digest order, by provisional designation', () => {
        const store = { ...emptyDiscoveryStore(), objects: { 9: { station: '675', date: '1999-01-01' } } };
        expect(discoveryQueue(digest, store, '2026-10')).toEqual([
            { designation: '225088', provisional: '2007 OR10' },
            { designation: '2026 AB1', provisional: '2026 AB1' },
        ]);
    });

    test('does not ask again this month about an object the MPC could not answer for', () => {
        const store = { ...emptyDiscoveryStore(), failed: { 225088: '2026-10' } };
        expect(discoveryQueue(digest, store, '2026-10').map((o) => o.designation)).toEqual(['2026 AB1', '9']);
        expect(discoveryQueue(digest, store, '2026-11').map((o) => o.designation)).toEqual(['225088', '2026 AB1', '9']);
    });

    test("marks Rubin's own discoveries and counts them", () => {
        const store = {
            objects: { 225088: { station: '675', date: '2007-07-17' }, '2026 AB1': { station: 'X05', date: '2026-01-04' } },
            stations: { X05: 'Simonyi Survey Telescope, Rubin Observatory' },
            failed: {},
        };
        const copy = structuredClone(digest);
        annotateDiscoveries(copy, store);
        expect(copy.counts).toMatchObject({ discoveryKnown: 2, discoveredByRubin: 1 });
        expect(copy.entries[1].discovery).toMatchObject({ byRubin: true, station: 'X05' });
        expect(unnamedStations(store)).toEqual(['675']);
    });

    test('the tab says who found it, and how many Rubin found', () => {
        expect(discoveryText({ discovery: { date: '2026-01-04', station: 'X05', byRubin: true } })).toBe('4 January 2026, by Rubin Observatory');
        expect(discoveryText({ discovery: { date: '2007-07-17', station: '675', stationName: null, byRubin: false } })).toBe('17 July 2007, at observatory 675');
        expect(discoveryText({})).toBeNull();
        const s = summary({ date: '2026-10-05', counts: { assessed: 1, passes: 0, watch: 0, withRubinH: 0, discoveryKnown: 2, discoveredByRubin: 1 } });
        expect(s.at(-1)).toBe('1 found by Rubin');
    });

    test('a whole run keeps discoveries in discovery.json and puts them in the digest', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rubin-data-'));
        try {
            const { digest: made } = await collect({ dataDir: dir, date: new Date('2026-10-05T06:00:00Z'), polite: await recordedPolite() });
            const store = JSON.parse(readFileSync(join(dir, 'discovery.json'), 'utf8'));
            expect(store.objects['225088']).toEqual({ station: '675', date: '2007-07-17' });
            expect(made.entries.find((e) => e.designation === '225088').discovery).toMatchObject({ date: '2007-07-17', byRubin: false });
            // The same month again: nothing left to ask, so no MPC requests (only JPL's count, Fink's nightly alerts and Rubin's news).
            const polite = await recordedPolite();
            await collect({ dataDir: dir, date: new Date('2026-10-12T06:00:00Z'), polite });
            expect(polite.used()).toBe(3);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test('backfills at most DISCOVERY_PER_RUN a run', () => {
        expect(DISCOVERY_PER_RUN).toBeLessThanOrEqual(50);
    });
});
