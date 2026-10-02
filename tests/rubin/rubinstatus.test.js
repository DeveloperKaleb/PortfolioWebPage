import { describe, test, expect } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    parseNightlyAlerts, lastAlertNight, nightsWithout, announcedWindow, observingStatus, nextRun,
    shouldPullFink, nextUpdates, statusText, updateText, OFF_SKY_NIGHTS, pullNightFrom,
} from '../../js/rubinstatus.js';
import { nightlyAlertsUrl } from '../../js/sources.js';
import { collect, recordedPolite } from '../../tools/rubin-collect.mjs';
import { NIGHTLY_ALERTS } from '../sources/fixtures.js';

/* The winter storm that closed Cerro Pachon in July 2026, then planned maintenance from
   14 September - as Rubin's forum announced it. */
const STORM = { start: '2026-07-15', reason: 'Storm recovery and planned maintenance', link: 'https://www.rubin.community/t/summit-technical-progress-week-ending-2026-09-25/12773' };

describe("Rubin's alerts, night by night", () => {
    const nights = parseNightlyAlerts(JSON.parse(NIGHTLY_ALERTS));

    test("reads Fink's statistics into dated nights, last night last", () => {
        expect(nights.at(-1)).toEqual({ night: '2026-07-14', alerts: 473344 });
        expect(lastAlertNight(nights)).toBe('2026-07-14');
        expect(nightlyAlertsUrl(2026)).toMatch(/statistics\?date=2026&columns=f%3Anight%2Cf%3Aalerts/);
    });

    test('drops nights with no alerts', () => {
        expect(parseNightlyAlerts([{ 'f:night': '20260101', 'f:alerts': '0' }])).toEqual([]);
    });

    test('counts the quiet nights since, a night being named by the date it began', () => {
        expect(nightsWithout('2026-07-14', new Date('2026-07-15T12:00:00Z'))).toBe(0);
        expect(nightsWithout('2026-07-14', new Date('2026-10-02T18:00:00Z'))).toBe(79);
        expect(nightsWithout(null, new Date())).toBeNull();
    });
});

describe('Is Rubin observing', () => {
    test('a night or two without alerts is weather, not off-sky', () => {
        const s = observingStatus({ lastNight: '2026-07-12', today: new Date('2026-07-15T12:00:00Z') });
        expect(s.offSky).toBe(false);
        expect(statusText(s)).toBeNull();
    });

    test(`${OFF_SKY_NIGHTS} quiet nights in a row is off-sky, and says so`, () => {
        const s = observingStatus({ lastNight: '2026-07-14', today: new Date('2026-07-20T12:00:00Z') });
        expect(s.offSky).toBe(true);
        expect(statusText(s)[0]).toMatch(/no alerts since the night of 14 July 2026 \(\d+ nights\)/);
    });

    test('an announced window says why, and that no end is known', () => {
        const s = observingStatus({ lastNight: '2026-07-14', today: new Date('2026-10-02T18:00:00Z'), windows: [STORM] });
        expect(s.window).toMatchObject({ active: true, start: '2026-07-15' });
        expect(statusText(s)[0]).toBe('Rubin is in storm recovery and planned maintenance from 15 July 2026, with no return date announced yet.');
    });

    test('an announced window ahead is mentioned, and is not yet off-sky', () => {
        const ahead = { start: '2026-11-02', end: '2026-11-05', reason: 'Planned maintenance' };
        expect(announcedWindow([ahead], new Date('2026-10-20T00:00:00Z'))).toMatchObject({ active: false });
        const s = observingStatus({ lastNight: '2026-10-19', today: new Date('2026-10-20T12:00:00Z'), windows: [ahead] });
        expect(s.offSky).toBe(false);
        expect(statusText(s)[0]).toBe('Planned maintenance is announced from 2 November 2026 to 5 November 2026.');
    });
});

describe('When the page next changes', () => {
    test('the weekly run is Monday 06:00 UTC, strictly after now', () => {
        expect(nextRun(new Date('2026-10-02T18:00:00Z')).toISOString()).toBe('2026-10-05T06:00:00.000Z');
        expect(nextRun(new Date('2026-10-05T06:00:00Z')).toISOString()).toBe('2026-10-12T06:00:00.000Z');
        expect(nextRun(new Date('2026-10-05T05:59:00Z')).toISOString()).toBe('2026-10-05T06:00:00.000Z');
    });

    test('observing, with this month pulled: new Rubin data on the first run of next month', () => {
        const up = nextUpdates({ now: new Date('2026-10-02T18:00:00Z'), status: { offSky: false }, finkFetchedMonth: '2026-10' });
        expect(up.refresh.toISOString()).toBe('2026-10-05T06:00:00.000Z');
        expect(up.data.toISOString()).toBe('2026-11-02T06:00:00.000Z');
    });

    test('off-sky with no end announced: data waits for Rubin', () => {
        const status = observingStatus({ lastNight: '2026-07-14', today: new Date('2026-10-02T18:00:00Z'), windows: [STORM] });
        const up = nextUpdates({ now: new Date('2026-10-02T18:00:00Z'), status, finkFetchedMonth: '2026-10' });
        expect(up.data).toBeNull();
        expect(updateText(up)).toEqual([
            'This page next refreshes Monday 5 October, 06:00 UTC.',
            'New Rubin data arrives with the first weekly update after Rubin returns to the sky.',
        ]);
    });

    test('off-sky with an announced end: the first run after it, in a month not yet pulled', () => {
        const window = { start: '2026-10-01', end: '2026-10-20', reason: 'Planned maintenance' };
        const status = observingStatus({ lastNight: '2026-09-30', today: new Date('2026-10-08T12:00:00Z'), windows: [window] });
        const notPulled = nextUpdates({ now: new Date('2026-10-08T12:00:00Z'), status, finkFetchedMonth: '2026-09' });
        expect(notPulled.data.toISOString()).toBe('2026-10-26T06:00:00.000Z');
        const pulled = nextUpdates({ now: new Date('2026-10-08T12:00:00Z'), status, finkFetchedMonth: '2026-10' });
        expect(pulled.data.toISOString()).toBe('2026-11-02T06:00:00.000Z');
    });
});

describe('Asking Fink only when there is something new', () => {
    test('pulls once a month, when Rubin has sent alerts since the last pull', () => {
        expect(shouldPullFink({ month: '2026-11', finkFetchedMonth: '2026-10', lastPullNight: '2026-10-28', lastNight: '2026-10-31' }).pull).toBe(true);
        expect(shouldPullFink({ month: '2026-10', finkFetchedMonth: '2026-10', lastPullNight: '2026-10-01', lastNight: '2026-10-31' }).pull).toBe(false);
    });

    test('waits while Rubin is off-sky', () => {
        expect(shouldPullFink({ month: '2026-11', finkFetchedMonth: '2026-10', lastPullNight: '2026-07-14', lastNight: '2026-07-14' }))
            .toEqual({ pull: false, reason: 'no new Rubin alerts since the last pull' });
    });

    test('pulls when the history is unknown, rather than never', () => {
        expect(shouldPullFink({ month: '2026-11', finkFetchedMonth: '2026-10', lastPullNight: null, lastNight: '2026-07-14' }).pull).toBe(true);
    });

    test('a whole run skips Fink next month while Rubin is still off-sky, and records why', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rubin-data-'));
        try {
            writeFileSync(join(dir, 'maintenance.json'), JSON.stringify({ windows: [STORM] }));
            const october = await collect({ dataDir: dir, date: new Date('2026-10-05T06:00:00Z'), polite: await recordedPolite() });
            expect(october.digest.observing).toMatchObject({ lastAlertNight: '2026-07-14', offSky: true });
            const state = JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8'));
            expect(state.lastPullNight).toBe('2026-07-14');
            const november = await collect({ dataDir: dir, date: new Date('2026-11-02T06:00:00Z'), polite: await recordedPolite() });
            expect(november.digest.notes.join(' ')).toMatch(/Fink was not asked this week: no new Rubin alerts since the last pull/);
            expect(JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')).finkFetchedMonth).toBe('2026-10');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

/* The first live run pulled Fink before the collector recorded its last pull. Without
   filling that in, November would pull with "history unknown" though nothing is new. */
describe('A last pull recorded before there was a record', () => {
    test('is the night before the pull was made: everything earlier was already in Fink', () => {
        expect(pullNightFrom('2026-10-02T15:54:52.000Z')).toBe('2026-10-01');
        expect(pullNightFrom(null)).toBeNull();
    });

    test('a run with no recorded last pull fills it from the stored detections, and then waits', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rubin-data-'));
        try {
            await collect({ dataDir: dir, date: new Date('2026-10-05T06:00:00Z'), polite: await recordedPolite() });
            const statePath = join(dir, 'state.json');
            const state = JSON.parse(readFileSync(statePath, 'utf8'));
            delete state.lastPullNight;
            writeFileSync(statePath, JSON.stringify(state));
            const november = await collect({ dataDir: dir, date: new Date('2026-11-02T06:00:00Z'), polite: await recordedPolite() });
            expect(JSON.parse(readFileSync(statePath, 'utf8')).lastPullNight).toBe('2026-10-04');
            expect(november.digest.notes.join(' ')).toMatch(/Fink was not asked this week/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
