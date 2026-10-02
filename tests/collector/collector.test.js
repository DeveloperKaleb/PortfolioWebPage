import { describe, test, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    planRun, selectForFink, choosePhotometry, buildDigest, diffDigests, stringifyLines, provenance, NEAR_MISS,
} from '../../js/collector.js';
import { CATALOGUE_H_ERR, FINK_H_LIMIT } from '../../js/sources.js';
import { jdFromDate } from '../../js/orbit.js';
import { collect, recordedPolite } from '../../tools/rubin-collect.mjs';
import { GONGGONG_DETECTIONS } from '../sources/fixtures.js';
import { OBJECTS } from '../orbit/fixtures.js';

const tno = (designation, H, elements, provisional = designation, fullName = designation) =>
    ({ designation, provisional, fullName, H, elements });
const ordinary = { a: 44, e: 0.05, i: 2, om: 0, w: 0, ma: 0, epoch: 2461200.5 };

describe('Planning a run', () => {
    const october = new Date('2026-10-05T06:00:00Z');

    test('a first run fetches everything', () => {
        expect(planRun(null, october)).toEqual({ month: '2026-10', newMonth: true, fetchFink: true });
    });

    test('a later week in the same month fetches neither the full list nor Fink', () => {
        const state = { jplFetchedMonth: '2026-10', finkFetchedMonth: '2026-10' };
        expect(planRun(state, new Date('2026-10-12T06:00:00Z'))).toMatchObject({ newMonth: false, fetchFink: false });
    });

    test('a new month fetches both again', () => {
        const state = { jplFetchedMonth: '2026-10', finkFetchedMonth: '2026-10' };
        expect(planRun(state, new Date('2026-11-02T06:00:00Z'))).toMatchObject({ newMonth: true, fetchFink: true });
    });
});

describe('Choosing what to ask Fink, and which H to use', () => {
    test('asks only about bright-enough objects, and reports what it cannot pack', () => {
        const { chosen, unpackable } = selectForFink([
            tno('225088', 1.8, ordinary, '2007 OR10'),
            tno('15760', FINK_H_LIMIT + 0.5, ordinary),
            tno('P-L 2040', 5, ordinary),
            tno('99999', null, ordinary),
        ]);
        expect(chosen.map((c) => c.packed)).toEqual(['M5088']);
        expect(unpackable).toEqual(['P-L 2040']);
    });

    test("prefers Rubin's photometry, falls back to the catalogue, and counts the rest", () => {
        const { objects, withoutH } = choosePhotometry([
            tno('225088', 1.82, ordinary, '2007 OR10'),
            tno('15760', 7.18, ordinary, '1992 QB1'),
            tno('99999', null, ordinary),
        ], { '2007 OR10': GONGGONG_DETECTIONS });
        expect(objects[0].hSource).toMatch(/^Rubin/);
        expect(objects[0].detections).toBe(GONGGONG_DETECTIONS.length);
        expect(objects[0].Hv).not.toBe(1.82);
        expect(objects[1]).toMatchObject({ Hv: 7.18, errH: CATALOGUE_H_ERR, hSource: 'catalogue (JPL)' });
        expect(withoutH).toEqual(['99999']);
    });
});

describe('The digest', () => {
    const date = new Date('2026-10-05T06:00:00Z');
    const made = provenance({ siteCommit: 'abc', sources: {} });
    const objects = choosePhotometry([
        tno('136199', -1.26, OBJECTS.Eris.elements),
        tno('dark', 4.8, OBJECTS.Sedna.elements), // faint, extreme orbit: large if dark, watched
        tno('small', 8, ordinary), // ordinary and faint: not recorded
        tno('orbitOnly', 8, { ...OBJECTS.Sedna.elements }), // unusual orbit but tiny: not recorded
    ], {}).objects;
    const digest = buildDigest({ objects, date, jd: jdFromDate(date), provenance: made });

    test('counts every object but records only the interesting ones, most promising first', () => {
        expect(digest.counts.assessed).toBe(4);
        expect(digest.entries.map((e) => e.designation)).toEqual(['136199', 'dark']);
        expect(digest.entries[1]).toMatchObject({ passes: false, watch: true });
    });

    test('records near misses', () => {
        const near = choosePhotometry([tno('near', 4.6, ordinary)], {}).objects;
        const d = buildDigest({ objects: near, date, jd: jdFromDate(date), provenance: made });
        expect(d.entries[0].chance).toBeGreaterThanOrEqual(NEAR_MISS);
        expect(d.entries[0].passes).toBe(false);
    });

    test('says what produced it', () => {
        expect(digest.provenance.siteCommit).toBe('abc');
        expect(digest.provenance.calibration.cutoffKm).toBeCloseTo(445, -1);
        expect(digest.provenance.calibration.cutoffKmGrundy).toBeCloseTo(940, -1);
        expect(digest.provenance.albedos.darkAlbedo).toBeCloseTo(0.035, 3);
    });

    test('is plain JSON with one entry per line', () => {
        const text = stringifyLines(digest);
        expect(JSON.parse(text)).toEqual(digest);
        const entryLines = text.split('\n').filter((line) => line.trim().startsWith('{"designation"'));
        expect(entryLines).toHaveLength(digest.entries.length);
    });
});

describe('What changed', () => {
    const base = { designation: 'x', H: 4, passes: false, flags: [], chance: 0.6 };

    test('notes new, departed, crossings, flags and H shifts', () => {
        const before = { date: '2026-10-05', entries: [base, { ...base, designation: 'gone' }] };
        const after = {
            date: '2026-11-02',
            entries: [{ ...base, H: 3.7, passes: true, flags: ['disputed'], chance: 0.85 }, { ...base, designation: 'fresh' }],
        };
        const what = diffDigests(before, after).entries.map((c) => `${c.designation}: ${c.what}`).sort();
        expect(what).toEqual(['fresh: new in digest', 'gone: left digest', 'x: H changed', 'x: flags gained', 'x: now passes']);
    });

    test('a first digest has everything new', () => {
        const changes = diffDigests(null, { date: '2026-10-05', entries: [base] });
        expect(changes.from).toBeNull();
        expect(changes.entries[0].what).toBe('new in digest');
    });
});

/* Whole runs against the recorded responses, in a temporary rubin-data folder. */
describe('A collector run', () => {
    const fresh = () => mkdtempSync(join(tmpdir(), 'rubin-data-'));
    const read = (dir, file) => JSON.parse(readFileSync(join(dir, file), 'utf8'));

    test('a first run writes inputs, digest, latest, changes and state', async () => {
        const dir = fresh();
        try {
            await collect({ dataDir: dir, date: new Date('2026-10-05T06:00:00Z'), polite: await recordedPolite() });
            ['inputs/2026-10/tnos.json', 'inputs/2026-10/detections.json', 'digest/2026-10.json', 'digest/latest.json', 'changes/2026-10.json', 'state.json']
                .forEach((file) => expect(existsSync(join(dir, file))).toBe(true));
            expect(read(dir, 'state.json')).toMatchObject({ jplFetchedMonth: '2026-10', finkFetchedMonth: '2026-10' });
            const gonggong = read(dir, 'digest/latest.json').entries.find((e) => e.designation === '225088');
            expect(gonggong.hSource).toMatch(/^Rubin/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test('a quiet week in the same month makes one request', async () => {
        const dir = fresh();
        try {
            await collect({ dataDir: dir, date: new Date('2026-10-05T06:00:00Z'), polite: await recordedPolite() });
            const polite = await recordedPolite();
            await collect({ dataDir: dir, date: new Date('2026-10-12T06:00:00Z'), polite });
            expect(polite.used()).toBe(1);
            // Still Rubin photometry, from the month's stored detections.
            expect(read(dir, 'digest/latest.json').entries.find((e) => e.designation === '225088').hSource).toMatch(/^Rubin/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test('a new month fetches again and compares against last month', async () => {
        const dir = fresh();
        try {
            await collect({ dataDir: dir, date: new Date('2026-10-05T06:00:00Z'), polite: await recordedPolite() });
            const polite = await recordedPolite();
            const { changes } = await collect({ dataDir: dir, date: new Date('2026-11-02T06:00:00Z'), polite });
            expect(polite.used()).toBeGreaterThan(2);
            expect(changes.from).toBe('2026-10-05');
            expect(existsSync(join(dir, 'inputs/2026-11/tnos.json'))).toBe(true);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test('a Fink failure is noted and the run still completes', async () => {
        const dir = fresh();
        try {
            const recorded = await recordedPolite();
            const polite = async (url) => {
                if (url.includes('fink')) throw new Error('Fink is down');
                return recorded(url);
            };
            const { digest } = await collect({ dataDir: dir, date: new Date('2026-10-05T06:00:00Z'), polite });
            expect(digest.notes.join(' ')).toMatch(/only partly fetched.*Fink is down.*ask again next week/);
            expect(read(dir, 'state.json').finkFetchedMonth).toBeUndefined();
            expect(read(dir, 'inputs/2026-10/detections.json')).toMatchObject({ complete: false, stopped: 'Fink is down' });
            expect(digest.entries.every((e) => e.hSource === 'catalogue (JPL)')).toBe(true);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test('a JPL failure writes nothing at all', async () => {
        const dir = fresh();
        try {
            const polite = async () => ({ status: 503, ok: false, body: '' });
            await expect(collect({ dataDir: dir, date: new Date('2026-10-05T06:00:00Z'), polite })).rejects.toThrow(/JPL/);
            expect(existsSync(join(dir, 'state.json'))).toBe(false);
            expect(existsSync(join(dir, 'digest'))).toBe(false);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
