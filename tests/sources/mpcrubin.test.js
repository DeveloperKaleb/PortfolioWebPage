import { describe, test, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseRubinObservations, parseDiscovery, parseRubinList, reportedBandH, visualH, fetchDiscoveries, MPC_MAX_BYTES } from '../../js/sources.js';
import {
    choosePhotometry, buildDigest, provenance, mpcDue, mpcQueue, recordMpc, reportedByRubin, emptyMpcStore, emptyDiscoveryStore,
    monthsBetween, MPC_PER_RUN, RUBIN_VIA_MPC,
} from '../../js/collector.js';
import { rubinStatus, brightnessText, summary } from '../../js/rubinview.js';
import { collect, recordedPolite } from '../../tools/rubin-collect.mjs';
import { MPC_ED138, ED138, ED138_PAPER_HV, MPC_GONGGONG, GONGGONG_DETECTIONS, RUBIN_LIST } from './fixtures.js';
import { OBJECTS } from '../orbit/fixtures.js';

/* Rubin's measurements reach the public by two routes: its alerts (Fink) and its reports
   to the Minor Planet Center. 2026 ED138, which Rubin discovered, was never in an alert,
   so no broker has it; the MPC has all 30 of Rubin's observations. */

describe("Rubin's observations in the MPC's answer", () => {
    const observations = parseRubinObservations(MPC_ED138);

    test("keeps Rubin's rows only, oldest first, with band, magnitude and error", () => {
        expect(observations).toHaveLength(30);
        expect(observations[0]).toEqual({ time: '2026-03-04T09:33:14.740Z', band: 'y', mag: 19.319, rmsMag: 0.0218 });
        expect(observations.at(-1)).toMatchObject({ time: '2026-07-11T07:21:14.542Z', band: 'g', mag: 20.358 });
        expect(new Set(observations.map((o) => o.band))).toEqual(new Set(['u', 'g', 'r', 'i', 'z', 'y']));
    });

    test("leaves out other observatories, deprecated rows, rows without a magnitude and bands that are not Rubin's", () => {
        const row = (over) => ({ stn: 'X05', obstime: '2026-03-04T09:33:14Z', band: 'Lr', mag: '20.1', rmsmag: '0.02', deprecated: null, ...over });
        const body = JSON.stringify([{ ADES_DF: [
            row({}), row({ stn: 'W84' }), row({ deprecated: 'X' }), row({ mag: null }), row({ mag: '' }), row({ band: 'V' }), row({ obstime: 'not a time' }),
            row({ band: 'g', rmsmag: null }),
        ] }]);
        expect(parseRubinObservations(body)).toEqual([
            { time: '2026-03-04T09:33:14Z', band: 'r', mag: 20.1, rmsMag: 0.02 },
            { time: '2026-03-04T09:33:14Z', band: 'g', mag: 20.1, rmsMag: null },
        ]);
    });

    test('an answer without the table has none, and the discovery is still read from the same answer', () => {
        expect(parseRubinObservations(MPC_GONGGONG)).toEqual([]);
        expect(parseRubinObservations('[{"OBS80": ""}]')).toEqual([]);
        expect(parseDiscovery(MPC_ED138)).toEqual({ station: 'X05', date: '2026-03-04' });
    });

    test('one request gives both, and an object with no discovery marked still gives its observations', async () => {
        const noDiscovery = JSON.stringify([{ OBS80: '', ADES_DF: JSON.parse(MPC_ED138)[0].ADES_DF }]);
        const caps = [];
        const polite = async (url, options) => {
            caps.push(options.maxBytes);
            return { ok: true, status: 200, body: JSON.parse(options.body).desigs[0] === 'a' ? MPC_ED138 : noDiscovery };
        };
        const { found, observations: got, failed } = await fetchDiscoveries(polite, [{ designation: 'A', provisional: 'a' }, { designation: 'B', provisional: 'b' }]);
        expect(found).toEqual({ A: { station: 'X05', date: '2026-03-04' } });
        expect(got.A).toHaveLength(30);
        expect(got.B).toHaveLength(30);
        expect(failed).toEqual([{ designation: 'B', reason: 'no discovery observation marked' }]);
        expect(caps).toEqual([MPC_MAX_BYTES, MPC_MAX_BYTES]);
    });

    test('an object that could not be asked about has no observations recorded', async () => {
        const polite = async () => ({ ok: false, status: 503, body: '' });
        const { observations: got, failed } = await fetchDiscoveries(polite, [{ designation: 'A', provisional: 'a' }]);
        expect(got).toEqual({});
        expect(failed).toEqual([{ designation: 'A', reason: 'HTTP 503' }]);
    });
});

describe('Brightness from those observations', () => {
    const observations = parseRubinObservations(MPC_ED138);

    /* Distances come from the orbit, since the MPC's rows have none. */
    test("2026 ED138: H_V 3.07, between the discovery paper's 3.19 and the MPC's 2.93", () => {
        const bands = reportedBandH(observations, ED138.elements);
        expect(bands.g.n).toBe(3);
        expect(bands.r.n).toBe(4);
        const v = visualH(bands);
        expect(v.from).toBe('g and r (Jester et al. 2005)');
        expect(v.H).toBeCloseTo(3.07, 1);
        expect(Math.abs(v.H - ED138_PAPER_HV)).toBeLessThan(0.2);
        expect(v.errH).toBeLessThan(0.1);
    });

    test('without r there is no visual H, and the catalogue stays', () => {
        const noR = observations.filter((o) => o.band !== 'r');
        expect(visualH(reportedBandH(noR, ED138.elements))).toBeNull();
        const [o] = choosePhotometry([ED138], {}, { reported: { [ED138.designation]: noR } }).objects;
        expect(o.hSource).toBe('catalogue (JPL)');
        expect(o.rubin).toMatchObject({ seen: true, confirmed: false });
        expect(o.rubin.via).toBeUndefined();
    });

    test('an observation with no stated error still counts, at a tenth of a magnitude', () => {
        const bands = reportedBandH([{ time: '2026-03-04T09:33:14Z', band: 'r', mag: 20, rmsMag: null }], ED138.elements);
        expect(bands.r).toMatchObject({ n: 1, errH: 0.1 });
    });
});

describe('Two routes, one count', () => {
    const reported = { [ED138.designation]: parseRubinObservations(MPC_ED138) };
    const gonggong = { designation: '225088', provisional: '2007 OR10', fullName: '225088 Gonggong (2007 OR10)', H: 1.82, elements: OBJECTS.Gonggong.elements };
    const eris = { designation: '136199', provisional: '2003 UB313', fullName: '136199 Eris (2003 UB313)', H: -1.26, elements: OBJECTS.Eris.elements };
    const { objects } = choosePhotometry([ED138, gonggong, eris], { '2007 OR10': GONGGONG_DETECTIONS }, { rubinList: parseRubinList(RUBIN_LIST), reported });
    const [ed138, viaAlerts, neither] = objects;

    test("an object only the MPC has is confirmed by Rubin, by that route, on JPL's orbit", () => {
        expect(ed138.hSource).toBe(`${RUBIN_VIA_MPC}: g and r (Jester et al. 2005)`);
        expect(ed138.Hv).toBeCloseTo(3.07, 1);
        expect(ed138.rubin).toMatchObject({ seen: true, confirmed: true, via: 'MPC', detections: 30 });
        expect(ed138.rubin.arcDays).toBeCloseTo(128.9, 0);
        expect(ed138.orbitFrom).toBe('JPL');
        expect(ed138.jpl.H).toBe(ED138.H);
    });

    test("alerts are preferred where Rubin's alerts have the object, even if the MPC has it too", () => {
        expect(viaAlerts.rubin.via).toBe('alerts');
        const both = choosePhotometry([gonggong], { '2007 OR10': GONGGONG_DETECTIONS }, { reported: { 225088: reported[ED138.designation] } }).objects[0];
        expect(both.rubin).toMatchObject({ via: 'alerts', detections: GONGGONG_DETECTIONS.length });
        expect(both.hSource).toMatch(/^Rubin: /);
        expect(both.orbitFrom).toBe('Rubin');
    });

    test('an object neither route has stays on the catalogue', () => {
        expect(neither.hSource).toBe('catalogue (JPL)');
        expect(neither.rubin).toMatchObject({ seen: false, confirmed: false });
    });

    test('too bright for Rubin keeps the catalogue H by this route too', () => {
        const bright = { ...ED138, H: -4 };
        const [o] = choosePhotometry([bright], {}, { reported, jd: 2461355.5 }).objects;
        expect(o.hSource).toBe('catalogue (JPL)');
        expect(o.rubin).toMatchObject({ tooBright: true, confirmed: false });
    });

    const digest = buildDigest({ objects, date: new Date('2026-11-11T06:00:00Z'), jd: 2461355.75, provenance: provenance({ siteCommit: 'x', sources: {} }) });
    const entry = digest.entries.find((e) => e.designation === '2026 ED138');

    test('the digest counts both routes together, and says how many came by the MPC', () => {
        expect(digest.counts).toMatchObject({ confirmedByRubin: 2, confirmedViaMpc: 1, withRubinH: 2, seenByRubin: 2, orbitFromRubin: 1 });
        expect(summary(digest)).toContain('2 confirmed by Rubin');
        expect(entry.rubin).toMatchObject({ confirmed: true, via: 'MPC', detections: 30, lastSeen: '2026-07-11' });
        expect(entry.crossCheck).toMatchObject({ agrees: true });
    });

    test('each card shows the route', () => {
        expect(rubinStatus(entry).text).toBe('Confirmed by Rubin: 30 detections over 129 days, last 11 July 2026');
        expect(brightnessText(entry)).toBe("from Rubin's observations, as reported to the Minor Planet Center (30)");
        expect(brightnessText(digest.entries.find((e) => e.designation === '225088'))).toBe(`from Rubin's alerts, through Fink (${GONGGONG_DETECTIONS.length})`);
        expect(brightnessText({ hSource: 'catalogue (JPL)', detections: 0 })).toBe('from the catalogue (JPL)');
        /* A digest from before the second route: Rubin's H was always from alerts. */
        expect(brightnessText({ hSource: 'Rubin: r with a typical TNO colour', detections: 5, rubin: { confirmed: true } })).toBe("from Rubin's alerts, through Fink (5)");
    });
});

describe('How often the MPC is asked', () => {
    const entry = (over = {}) => ({ designation: 'x', name: '(2026 AB1)', passes: false, rubin: { confirmed: false }, ...over });
    const oneObservation = [['2026-03-04T09:33:14Z', 'r', 20, 0.02]];

    test('an object never asked about is due; one that failed this month waits for the next', () => {
        expect(mpcDue(entry(), undefined, '2026-11')).toBe(true);
        expect(mpcDue(entry(), { asked: null, obs: [], failed: '2026-11' }, '2026-11')).toBe(false);
        expect(mpcDue(entry(), { asked: null, obs: [], failed: '2026-11' }, '2026-12')).toBe(true);
    });

    test('monthly where the MPC has Rubin observations or Rubin found it, every three months otherwise', () => {
        const some = { asked: '2026-11', obs: oneObservation };
        const none = { asked: '2026-11', obs: [] };
        expect(mpcDue(entry(), some, '2026-11')).toBe(false);
        expect(mpcDue(entry(), some, '2026-12')).toBe(true);
        expect(mpcDue(entry(), none, '2026-12')).toBe(false);
        expect(mpcDue(entry(), none, '2026-12', { byRubin: true })).toBe(true);
        expect(mpcDue(entry(), none, '2027-01')).toBe(false);
        expect(mpcDue(entry(), none, '2027-02')).toBe(true);
        expect(monthsBetween('2026-11', '2027-02')).toBe(3);
    });

    test("an object Rubin's alerts cover is asked once, then left alone", () => {
        const alerts = entry({ rubin: { confirmed: true, via: 'alerts' } });
        expect(mpcDue(alerts, undefined, '2026-11')).toBe(true);
        expect(mpcDue(alerts, { asked: '2026-01', obs: oneObservation }, '2026-11')).toBe(false);
    });

    test('the queue: passes first, then what Rubin found or reported, then the rest, each in digest order', () => {
        const digest = { entries: [
            { designation: 'rest', name: '(2001 AA1)', passes: false },
            { designation: 'found', name: '(2026 AB1)', passes: false },
            { designation: 'pass', name: '9 Old (1999 AA1)', passes: true },
            { designation: 'has', name: '(2002 AA1)', passes: false },
            { designation: 'fresh', name: '(2003 AA1)', passes: true },
        ] };
        const discovery = { ...emptyDiscoveryStore(), objects: {
            rest: { station: '675', date: '2001-01-01' }, found: { station: 'X05', date: '2026-01-04' }, pass: { station: '675', date: '1999-01-01' },
            has: { station: '675', date: '2002-01-01' }, fresh: { station: '675', date: '2003-01-01' },
        } };
        const mpc = { ...emptyMpcStore(), objects: {
            has: { asked: '2026-10', obs: oneObservation },
            fresh: { asked: '2026-11', obs: [] },
        } };
        expect(mpcQueue(digest, discovery, mpc, '2026-11')).toEqual([
            { designation: 'pass', provisional: '1999 AA1' },
            { designation: 'found', provisional: '2026 AB1' },
            { designation: 'has', provisional: '2002 AA1' },
            { designation: 'rest', provisional: '2001 AA1' },
        ]);
    });

    test('an object whose discovery is not known yet is asked about even when its observations are not due', () => {
        const digest = { entries: [{ designation: 'a', name: '(2001 AA1)', passes: false }] };
        const mpc = { ...emptyMpcStore(), objects: { a: { asked: '2026-11', obs: [] } } };
        expect(mpcQueue(digest, emptyDiscoveryStore(), mpc, '2026-11')).toHaveLength(1);
        expect(mpcQueue(digest, { ...emptyDiscoveryStore(), failed: { a: '2026-11' } }, mpc, '2026-11')).toEqual([]);
    });
});

describe('Keeping what the MPC said', () => {
    const observations = parseRubinObservations(MPC_ED138);

    test('an answer replaces what was kept and marks the month; a change says the digest must be redone', () => {
        const store = emptyMpcStore();
        expect(recordMpc(store, { observations: { '2026 ED138': observations, quiet: [] } }, '2026-11')).toBe(true);
        expect(store.objects['2026 ED138']).toMatchObject({ asked: '2026-11' });
        expect(store.objects['2026 ED138'].obs[0]).toEqual(['2026-03-04T09:33:14.740Z', 'y', 19.319, 0.0218]);
        expect(store.objects.quiet).toEqual({ asked: '2026-11', obs: [] });
        expect(recordMpc(store, { observations: { '2026 ED138': observations } }, '2026-12')).toBe(false);
        expect(store.objects['2026 ED138'].asked).toBe('2026-12');
        expect(reportedByRubin(store)).toEqual({ '2026 ED138': observations });
    });

    test('a failed request keeps what was there, and is left until next month', () => {
        const store = emptyMpcStore();
        recordMpc(store, { observations: { '2026 ED138': observations } }, '2026-11');
        expect(recordMpc(store, { failed: [{ designation: '2026 ED138', reason: 'HTTP 503' }, { designation: 'new', reason: 'HTTP 503' }] }, '2026-12')).toBe(false);
        expect(store.objects['2026 ED138']).toMatchObject({ asked: '2026-11', failed: '2026-12' });
        expect(store.objects['2026 ED138'].obs).toHaveLength(30);
        expect(store.objects.new).toEqual({ asked: null, obs: [], failed: '2026-12' });
    });

    test('an answer with no discovery marked is not a failure to fetch the observations', () => {
        const store = emptyMpcStore();
        recordMpc(store, { observations: { a: [] }, failed: [{ designation: 'a', reason: 'no discovery observation marked' }] }, '2026-11');
        expect(store.objects.a).toEqual({ asked: '2026-11', obs: [] });
    });
});

/* Whole runs against the recorded responses, in a temporary rubin-data folder. */
describe('A collector run with the MPC route', () => {
    const fresh = () => mkdtempSync(join(tmpdir(), 'rubin-data-'));
    const read = (dir, file) => JSON.parse(readFileSync(join(dir, file), 'utf8'));
    /* A run that notes which objects the MPC was asked about. */
    const run = async (dir, date, { mpcDown = false } = {}) => {
        const recorded = await recordedPolite();
        const asked = [];
        const polite = async (url, options) => {
            if (!url.includes('get-obs')) return recorded(url, options);
            asked.push(JSON.parse(options.body).desigs[0]);
            return mpcDown ? { status: 503, ok: false, notModified: false, headers: new Headers(), body: '' } : recorded(url, options);
        };
        polite.used = recorded.used;
        const { digest } = await collect({ dataDir: dir, date: new Date(date), polite });
        return { asked, digest, ed138: digest.entries.find((e) => e.designation === '2026 ED138') };
    };

    test('2026 ED138 is confirmed by Rubin on the first run that asks the MPC about it', async () => {
        const dir = fresh();
        try {
            const { digest, ed138 } = await run(dir, '2026-11-16T06:00:00Z');
            expect(ed138.hSource).toMatch(/^Rubin via the MPC/);
            expect(ed138.H).toBeCloseTo(3.07, 1);
            expect(ed138.rubin).toMatchObject({ confirmed: true, via: 'MPC', detections: 30 });
            expect(ed138.discovery).toMatchObject({ byRubin: true, date: '2026-03-04' });
            expect(digest.counts).toMatchObject({ confirmedByRubin: 2, confirmedViaMpc: 1 });
            expect(read(dir, 'digest/latest.json').entries.find((e) => e.designation === '2026 ED138').rubin.via).toBe('MPC');
            expect(read(dir, 'mpc-rubin.json').objects['2026 ED138'].obs).toHaveLength(30);
            expect(read(dir, 'mpc-rubin.json').objects['225088']).toEqual({ asked: '2026-11', obs: [] });
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test('a later week in the month asks the MPC nothing; the next month asks again only where it is due', async () => {
        const dir = fresh();
        try {
            const first = await run(dir, '2026-11-02T06:00:00Z');
            expect(first.asked).toContain('2026 ED138');
            expect(first.asked).toContain('2007 OR10');
            expect((await run(dir, '2026-11-09T06:00:00Z')).asked).toEqual([]);
            const december = await run(dir, '2026-12-07T06:00:00Z');
            expect(december.asked).toContain('2026 ED138');
            /* Gonggong is covered by Rubin's alerts, so it is not asked about again. */
            expect(december.asked).not.toContain('2007 OR10');
            expect(december.ed138.rubin.via).toBe('MPC');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("when the MPC cannot be reached, last month's observations are still used", async () => {
        const dir = fresh();
        try {
            await run(dir, '2026-11-02T06:00:00Z');
            const { ed138 } = await run(dir, '2026-12-07T06:00:00Z', { mpcDown: true });
            expect(ed138.rubin).toMatchObject({ confirmed: true, via: 'MPC', detections: 30 });
            expect(read(dir, 'mpc-rubin.json').objects['2026 ED138']).toMatchObject({ asked: '2026-11', failed: '2026-12' });
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test('never asks about more than the limit in one run', () => {
        expect(MPC_PER_RUN).toBeLessThanOrEqual(100);
    });
});
