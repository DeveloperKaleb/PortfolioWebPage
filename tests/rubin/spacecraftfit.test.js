import { describe, it, expect } from 'vitest';
import { horizonsTrackUrl, parseHorizonsTrack, horizonsLimit, fetchCraftTrack, SPACECRAFT_STEP_DAYS } from '../../js/sources.js';
import { orbitTrack, sampleTrack, buildTrack, spacecraftDue, craftToAsk, jdOfDay } from '../../js/spacecraftfit.js';
import { trackPosition, CRAFT } from '../../js/spacecraft.js';
import { TRACKS } from '../../js/spacecrafttracks.js';
import { positionAt } from '../../js/orbit.js';
import { VOYAGER_1_TRACK } from '../sources/spacecraft-fixtures.js';

const ok = (body) => ({ ok: true, status: 200, body });
const said = (text) => JSON.stringify({ result: text });

describe('Horizons spacecraft client', () => {
    it('asks for Sun-centred ecliptic positions every 5 days over the span', () => {
        const q = new URL(horizonsTrackUrl(-31, '2026-01-01', '2027-01-01')).searchParams;
        expect(q.get('COMMAND')).toBe("'-31'");
        expect(q.get('CENTER')).toBe("'500@10'");
        expect(q.get('REF_PLANE')).toBe('ECLIPTIC');
        expect(q.get('STEP_SIZE')).toBe(`'${SPACECRAFT_STEP_DAYS} d'`);
        expect(q.get('START_TIME')).toBe("'2026-01-01'");
    });

    it('reads the recorded Voyager 1 response', () => {
        const { rows } = parseHorizonsTrack(VOYAGER_1_TRACK);
        expect(rows.length).toBe(40);
        expect(rows[0][0]).toBe(2461041.5);
        expect(Math.hypot(...rows[0].slice(1))).toBeGreaterThan(165);
    });

    it('reads where a track starts or ends from what Horizons says', () => {
        expect(horizonsLimit('No ephemeris for target "Hera" after A.D. 2027-JAN-12 00:00:00.0000 TDB')).toEqual({ side: 'stop', date: '2027-01-11' });
        expect(horizonsLimit('No ephemeris for target "MMX" prior to A.D. 2026-OCT-19 12:00:00 TDB')).toEqual({ side: 'start', date: '2026-10-20' });
        expect(horizonsLimit('Something else')).toBeNull();
    });

    it('cuts the span to what Horizons holds and asks once more', async () => {
        const asked = [];
        const polite = async (url) => {
            const q = new URL(url).searchParams;
            asked.push([q.get('START_TIME'), q.get('STOP_TIME')]);
            return asked.length === 1 ? ok(said('No ephemeris for target "Hera" after A.D. 2027-JAN-12 00:00:00 TDB')) : ok(VOYAGER_1_TRACK);
        };
        const got = await fetchCraftTrack(polite, -91, '2026-11-09', '2027-12-24');
        expect(asked).toEqual([["'2026-11-09'", "'2027-12-24'"], ["'2026-11-09'", "'2027-01-11'"]]);
        expect(got.stop).toBe('2027-01-11');
        expect(got.rows.length).toBe(40);
    });

    it("asks a craft Horizons stopped following for its last 120 days", async () => {
        const asked = [];
        const polite = async (url) => {
            const q = new URL(url).searchParams;
            asked.push([q.get('START_TIME'), q.get('STOP_TIME')]);
            return asked.length === 1 ? ok(said('No ephemeris for target "Stardust" after A.D. 2011-MAR-13 00:00:00 TDB')) : ok(VOYAGER_1_TRACK);
        };
        const got = await fetchCraftTrack(polite, -29, '2026-11-09', '2027-12-24');
        expect(asked[1]).toEqual(["'2010-11-12'", "'2011-03-12'"]);
        expect(got.start).toBe('2010-11-12');
    });

    it('gives up quietly where Horizons has nothing to say', async () => {
        const got = await fetchCraftTrack(async () => ok(said('No such target')), -999, '2026-11-09', '2027-12-24');
        expect(got.rows).toEqual([]);
        expect(got.said).toBe('No such target');
    });
});

describe('fitting tracks', () => {
    const elements = { a: 2.4, e: 0.3, i: 8, om: 40, w: 120, ma: 10, epoch: 2461000.5 };
    const rows = Array.from({ length: 80 }, (_, k) => {
        const jd = 2461000.5 + 5 * k;
        const p = positionAt(elements, jd);
        return [jd, p.x, p.y, p.z];
    });

    it('finds the orbit of a coasting craft, which holds far beyond the rows', () => {
        const track = orbitTrack(rows);
        expect(track.elements.a).toBeCloseTo(2.4, 4);
        const later = 2461000.5 + 3000;
        const p = trackPosition(track, later);
        const q = positionAt(elements, later);
        expect(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)).toBeLessThan(1e-3);
    });

    it('keeps positions for a craft that steers, matching every row', () => {
        /* A push halfway: no single orbit fits. */
        const steered = rows.map(([jd, x, y, z], k) => (k < 40 ? [jd, x, y, z] : [jd, x + 0.002 * (k - 40), y, z]));
        expect(orbitTrack(steered)).toBeNull();
        const track = sampleTrack(steered, 2461000.5);
        for (const [jd, x, y, z] of steered) {
            const p = trackPosition(track, jd);
            expect(Math.hypot(p.x - x, p.y - y, p.z - z)).toBeLessThan(2.5e-4);
        }
        expect(trackPosition(track, steered.at(-1)[0] + 1)).toBeNull();
    });

    it('marks a craft Horizons stopped following as placed from its last known orbit', () => {
        const saved = { start: '2026-01-01', stop: '2027-02-04', rows };
        const track = buildTrack({ ...saved, stop: '2011-03-12' }, { spanStart: '2026-11-09', todayJd: jdOfDay('2026-11-19') });
        expect(track.lastKnown).toBe('2011-03-12');
        expect(buildTrack(saved, { spanStart: '2026-01-01', todayJd: jdOfDay('2026-11-19') }).lastKnown).toBeUndefined();
    });

    it('is due once a calendar month, until that month is complete', () => {
        expect(spacecraftDue(null, '2026-11')).toBe(true);
        expect(spacecraftDue({ complete: '2026-10' }, '2026-11')).toBe(true);
        expect(spacecraftDue({ complete: '2026-11' }, '2026-11')).toBe(false);
    });

    it("waits out the week Fink's month is pulled", () => {
        expect(spacecraftDue(null, '2026-12', { finkThisRun: true })).toBe(false);
        expect(spacecraftDue({ complete: '2026-11' }, '2026-12', { finkThisRun: false })).toBe(true);
    });

    it('asks only about craft that steer, once a month', () => {
        const craft = [{ id: 'coasting', horizons: -1 }, { id: 'old', horizons: -2 }, { id: 'steering', horizons: -3 }, { id: 'atMars', at: 'Mars' }, { id: 'unbuilt', horizons: -4 }];
        const builtIn = { coasting: { elements: {} }, old: { elements: {}, lastKnown: '2011-03-12' }, steering: { start: 0, step: 5, xyz: [] } };
        expect(craftToAsk(craft, builtIn, null, '2026-12').map((c) => c.id)).toEqual(['steering', 'unbuilt']);
        expect(craftToAsk(craft, builtIn, { asked: { steering: '2026-12' } }, '2026-12').map((c) => c.id)).toEqual(['unbuilt']);
    });

    it('asks about 16 of the craft built into the site', () => {
        expect(craftToAsk(CRAFT, TRACKS, null, '2026-12').length).toBe(16);
    });
});
