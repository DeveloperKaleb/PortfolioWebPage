import { describe, test, expect } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    moonOffset, lunarOffset, moonRing, moonDistance, MOON_ORBITS, MOON_PARENTS, MOON_EPOCH,
    fitMoons, moonsDue, moonFitTimes, MOON_HORIZONS, MOON_REFIT_DAYS, MOON_FIT_LIMIT_DEG,
} from '../../js/moons.js';
import { parseHorizonsVectors, horizonsVectorsUrl } from '../../js/sources.js';
import { collect, recordedPolite } from '../../tools/rubin-collect.mjs';
import { HORIZONS_APRIL_2026, HORIZONS_VECTORS, horizonsResponse } from './fixtures.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const degreesApart = (a, b) => (Math.acos(Math.min(1, dot(a, b) / (Math.hypot(...a) * Math.hypot(...b)))) * 180) / Math.PI;
const APRIL = 2461135.5; // 2026-04-05, a date the fit never saw

/* Mimas librates in its resonance with Tethys; Titan and Iapetus have eccentric orbits a
   circle ignores. Every other moon is held tighter. */
const LOOSE = { Mimas: 8, Titan: 8, Iapetus: 8 };

describe('Moon positions against JPL Horizons, half a year from the fit', () => {
    test.each(Object.keys(HORIZONS_APRIL_2026))('%s', (name) => {
        expect(degreesApart(moonOffset(name, APRIL), HORIZONS_APRIL_2026[name])).toBeLessThan(LOOSE[name] ?? 2);
        expect(Math.hypot(...moonOffset(name, APRIL)) / Math.hypot(...HORIZONS_APRIL_2026[name])).toBeCloseTo(1, 1);
    });
});

describe('The moons', () => {
    test('every round moon has an orbit and a parent', () => {
        expect(Object.keys(MOON_PARENTS)).toHaveLength(19);
        expect(MOON_PARENTS.Charon).toBe('Pluto');
        expect(MOON_PARENTS.Luna).toBe('Earth');
    });

    test('a circle orbit keeps its radius and returns after one period', () => {
        const { a, period } = MOON_ORBITS.Titan;
        const start = moonOffset('Titan', MOON_EPOCH);
        expect(Math.hypot(...start) / a).toBeCloseTo(1, 5);
        expect(degreesApart(moonOffset('Titan', MOON_EPOCH + period), start)).toBeLessThan(0.001);
    });

    test('Triton goes round backwards, as it does', () => {
        const { p, q } = MOON_ORBITS.Triton;
        const normal = [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
        const io = MOON_ORBITS.Io;
        const ioNormal = [io.p[1] * io.q[2] - io.p[2] * io.q[1], io.p[2] * io.q[0] - io.p[0] * io.q[2], io.p[0] * io.q[1] - io.p[1] * io.q[0]];
        expect(normal[2]).toBeLessThan(0);
        expect(ioNormal[2]).toBeGreaterThan(0);
    });

    test("Luna stays between perigee and apogee", () => {
        for (let d = 0; d < 60; d += 3) {
            const km = Math.hypot(...lunarOffset(MOON_EPOCH + d)) * 149597870.7;
            expect(km).toBeGreaterThan(355000);
            expect(km).toBeLessThan(407000);
        }
    });

    test('a ring for the map, and a mean distance to decide when to draw it', () => {
        expect(moonRing('Io', MOON_EPOCH)).toHaveLength(72);
        expect(moonDistance('Luna')).toBeCloseTo(0.00257, 4);
    });
});

/* ---- The yearly refit ---------------------------------------------------------------- */

describe('Refitting the moons', () => {
    const fitted = Object.fromEntries(Object.entries(HORIZONS_VECTORS).filter(([name]) => name !== 'Luna'));

    test('from the recorded rows, the refit reproduces the fit built in', () => {
        const fit = fitMoons(fitted, MOON_EPOCH);
        expect(fit.ok).toBe(true);
        for (const [name, orbit] of Object.entries(MOON_ORBITS)) {
            expect(fit.set.orbits[name]).toEqual(orbit);
            expect(fit.checks[name]).toBeLessThanOrEqual(MOON_FIT_LIMIT_DEG);
        }
    });

    test('a refit any moon misses its check by too much is not used', () => {
        const bad = { ...fitted, Titan: [{ ...fitted.Titan[0], r: fitted.Titan[0].r.map((x) => -x) }, fitted.Titan[1], fitted.Titan[2]] };
        const fit = fitMoons(bad, MOON_EPOCH);
        expect(fit.ok).toBe(false);
        expect(fit.reason).toMatch(/Titan/);
    });

    test('a refit missing a moon is not used', () => {
        const { Charon, ...rest } = fitted;
        expect(fitMoons(rest, MOON_EPOCH).ok).toBe(false);
    });

    test('is due once the fit in use is a year old, built in or stored', () => {
        expect(moonsDue(null, MOON_EPOCH + MOON_REFIT_DAYS - 1)).toBe(false);
        expect(moonsDue(null, MOON_EPOCH + MOON_REFIT_DAYS)).toBe(true);
        expect(moonsDue({ epoch: MOON_EPOCH + 300 }, MOON_EPOCH + MOON_REFIT_DAYS)).toBe(false);
    });

    test('positions follow whichever fit is given', () => {
        const later = { epoch: MOON_EPOCH + 10, orbits: MOON_ORBITS };
        expect(moonOffset('Io', MOON_EPOCH + 10, later)).toEqual(moonOffset('Io', MOON_EPOCH));
    });

    test('asks Horizons for the check date, the epoch and a year on', () => {
        expect(moonFitTimes(MOON_EPOCH)).toEqual([MOON_EPOCH - 183, MOON_EPOCH, MOON_EPOCH + 365]);
        expect(Object.keys(MOON_HORIZONS)).toEqual(Object.keys(MOON_ORBITS));
    });
});

describe("Horizons's answers", () => {
    test('reads the rows between the markers', () => {
        const rows = parseHorizonsVectors(horizonsResponse(HORIZONS_VECTORS.Io));
        expect(rows).toEqual(HORIZONS_VECTORS.Io);
    });

    test('an error has no rows', () => {
        expect(parseHorizonsVectors(JSON.stringify({ result: 'No ephemeris for target "Io" prior to A.D. 1600' }))).toEqual([]);
    });

    test('one request per moon, its dates listed', () => {
        const url = new URL(horizonsVectorsUrl(606, 699, moonFitTimes(MOON_EPOCH)));
        expect(url.host).toBe('ssd.jpl.nasa.gov');
        expect(url.searchParams.get('COMMAND')).toBe("'606'");
        expect(url.searchParams.get('CENTER')).toBe("'500@699'");
        expect(url.searchParams.get('TLIST').split(' ')).toHaveLength(3);
    });
});

/* The collector refits once a year, and keeps the old fit when a refit cannot be trusted. */
describe('The collector and the moons', () => {
    const run = async ({ stored, polite, date = '2026-10-05T06:00:00Z' }) => {
        const dir = mkdtempSync(join(tmpdir(), 'rubin-data-'));
        try {
            if (stored) writeFileSync(join(dir, 'moons.json'), JSON.stringify(stored));
            const log = [];
            const { digest } = await collect({ dataDir: dir, date: new Date(date), polite, log: (line) => log.push(line) });
            const file = join(dir, 'moons.json');
            return { digest, log, saved: existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null };
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    };

    test('a recent fit is left alone, with no requests to Horizons', async () => {
        const polite = await recordedPolite();
        const stored = { epoch: MOON_EPOCH - 10, orbits: MOON_ORBITS };
        const { digest, saved } = await run({ stored, polite });
        expect(saved.epoch).toBe(MOON_EPOCH - 10);
        expect(digest.moons.epoch).toBe(MOON_EPOCH - 10);
    });

    test('a fit a year old is refitted, saved, and carried in the digest: one request per moon', async () => {
        const quiet = await recordedPolite();
        await run({ stored: { epoch: MOON_EPOCH - 10, orbits: MOON_ORBITS }, polite: quiet });
        const polite = await recordedPolite();
        const { digest, saved } = await run({ stored: { epoch: MOON_EPOCH - 400, orbits: MOON_ORBITS }, polite });
        expect(saved.epoch).toBe(MOON_EPOCH);
        expect(saved.orbits).toEqual(MOON_ORBITS);
        expect(digest.moons).toEqual({ epoch: MOON_EPOCH, orbits: MOON_ORBITS });
        expect(polite.used() - quiet.used()).toBe(Object.keys(MOON_HORIZONS).length);
    });

    test('if Horizons fails for any moon, the previous fit stays', async () => {
        const recorded = await recordedPolite();
        const polite = async (url, options) => (url.includes("COMMAND=%27901%27")
            ? { status: 503, ok: false, notModified: false, headers: new Headers(), body: '' }
            : recorded(url, options));
        polite.used = recorded.used;
        const stored = { epoch: MOON_EPOCH - 400, orbits: MOON_ORBITS };
        const { digest, saved, log } = await run({ stored, polite });
        expect(saved.epoch).toBe(MOON_EPOCH - 400);
        expect(digest.moons.epoch).toBe(MOON_EPOCH - 400);
        expect(log.some((line) => /refit not used.*Charon/.test(line))).toBe(true);
    });
});
