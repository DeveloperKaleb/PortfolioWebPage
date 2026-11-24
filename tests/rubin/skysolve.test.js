import { describe, it, expect } from 'vitest';
import { bestTurn, apply, skyObjects, planetsSeen, skyVector, raDec, solve, focalPixels, toPixel, cameraVector, brightnessOrder, BRIGHT_CHECK } from '../../js/skysolve.js';
import { jdFromDate } from '../../js/orbit.js';

function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
// The turn that points the camera at ra, dec with the photo's top toward roll.
function aim(ra, dec, roll) {
    const z = skyVector(ra, dec);
    const north = [0, 0, 1];
    let x = [north[1] * z[2] - north[2] * z[1], north[2] * z[0] - north[0] * z[2], north[0] * z[1] - north[1] * z[0]];
    const n = Math.hypot(...x); x = x.map((v) => v / n);
    let y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    const c = Math.cos(roll), s = Math.sin(roll);
    [x, y] = [x.map((v, k) => c * v + s * y[k]), y.map((v, k) => -s * x[k] + c * v)];
    return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}
const JD = jdFromDate(new Date('2026-11-22T03:00:00Z'));
const objects = skyObjects(JD);

// A made-up phone photo of the sky: the catalogue's stars to a limit, as found stars.
function photo({ ra, dec, roll, mm = 26, width = 1600, height = 1200, limit = 4, drop = 0.1, extra = 3, jitter = 0.4, seed = 1 }) {
    const r = rng(seed);
    const sol = { R: aim(ra, dec, roll), f: focalPixels(mm, width, height) };
    const found = [];
    for (const o of objects) {
        if (o.mag > limit) continue;
        const p = toPixel(sol, o.v, width, height);
        if (!p || r() < drop) continue;
        found.push({ x: p.x + (r() - 0.5) * 2 * jitter, y: p.y + (r() - 0.5) * 2 * jitter, flux: 10 ** (-0.4 * o.mag) * (0.7 + 0.6 * r()), truth: o.name });
    }
    for (let k = 0; k < extra; k++) found.push({ x: r() * width, y: r() * height, flux: 10 ** (-0.4 * (1 + 3 * r())), truth: null });
    found.sort((a, b) => b.flux - a.flux);
    return { found, width, height, sol };
}

describe('plate solving', () => {
    it('turns camera into sky', () => {
        const R = aim(80, 20, 0.5);
        const cams = [[0, 0, 1], [0.3, 0.1, 0.95], [-0.2, 0.25, 0.9]].map((v) => { const n = Math.hypot(...v); return v.map((x) => x / n); });
        const turned = bestTurn(cams, cams.map((c) => apply(R, c)));
        turned.forEach((v, k) => expect(v).toBeCloseTo(R[k], 9));
    });

    it('knows the bright stars by name, and puts the planets among them', () => {
        const names = objects.slice(0, 30).map((o) => o.name);
        for (const n of ['Sirius', 'Canopus', 'Vega', 'Rigel', 'Jupiter', 'Venus']) expect(names).toContain(n);
        const sirius = objects.find((o) => o.name === 'Sirius');
        const { ra, dec } = raDec(sirius.v);
        expect(ra).toBeCloseTo(101.287, 1);
        expect(dec).toBeCloseTo(-16.716, 1);
    });

    it.each([
        // JPL Horizons, geocentric astrometric RA and Dec (ICRF), 2026-Nov-22 03:00 UT,
        // saved in tools/skystars/raw/horizons-599.txt and horizons-299.txt.
        ['Jupiter', 148.46181, 13.59121],
        ['Venus', 201.99736, -9.18107],
    ])('places %s where JPL Horizons has it, to well under a pixel of the search', (name, ra, dec) => {
        const v = planetsSeen(JD).find((p) => p.name === name).v;
        const miss = Math.acos(v.reduce((s, x, k) => s + x * skyVector(ra, dec)[k], 0)) * 180 / Math.PI;
        expect(miss).toBeLessThan(0.1);
    });

    it.each([
        ['Orion', 84, 2, 0.3],
        ['the Big Dipper, phone on its side', 175, 55, 1.7],
        ['Cassiopeia', 15, 60, -2.4],
        ['Scorpius', 250, -30, 3.0],
    ])('names the stars of a photo of %s', (_, ra, dec, roll) => {
        const pic = photo({ ra, dec, roll });
        const started = performance.now();
        const got = solve(pic.found, pic.width, pic.height, objects);
        const ms = performance.now() - started;
        expect(got).toBeTruthy();
        const miss = Math.acos(Math.min(1, skyVector(got.centre.ra, got.centre.dec).reduce((s, v, k) => s + v * skyVector(ra, dec)[k], 0))) * 180 / Math.PI;
        expect(miss).toBeLessThan(0.1);
        expect(got.f / pic.sol.f).toBeCloseTo(1, 2);
        const right = got.matches.filter((m) => m.star.truth === m.object.name).length;
        expect(right).toBe(got.matches.length);
        expect(right).toBeGreaterThanOrEqual(0.8 * pic.found.filter((s) => s.truth).length);
        expect(ms).toBeLessThan(3000);
    });

    it('works out the lens when it is not a usual one', () => {
        const pic = photo({ ra: 84, dec: 2, roll: 1, mm: 35, limit: 4.5 });
        const got = solve(pic.found, pic.width, pic.height, objects, { mm: [35 * 1.02] });
        expect(got.f / pic.sol.f).toBeCloseTo(1, 2);
    });

    it('finds nothing in random dots', () => {
        const r = rng(5);
        const found = Array.from({ length: 25 }, () => ({ x: r() * 1600, y: r() * 1200, flux: r() })).sort((a, b) => b.flux - a.flux);
        expect(solve(found, 1600, 1200, objects)).toBeNull();
    }, 30000);

    it('gives up when its time runs out', () => {
        const r = rng(6);
        const found = Array.from({ length: 25 }, () => ({ x: r() * 1600, y: r() * 1200, flux: r() })).sort((a, b) => b.flux - a.flux);
        let clock = 0;
        expect(solve(found, 1600, 1200, objects, { budgetMs: 10, now: () => (clock += 1) })).toEqual({ gaveUp: true });
    });
});

describe('not fooled by spots that only look like a pattern (2026-11-24)', () => {
    const objects = skyObjects(jdFromDate(new Date('2026-11-24T14:00:00Z')));
    // Twelve equal dots on a near-regular grid, as drawn in a browser test: once named as
    // six faint stars of Orion, with Rigel, Betelgeuse and the belt "in the picture" unseen.
    const grid = Array.from({ length: 12 }, (_, i) => ({ x: 40 + i * 60, y: 50 + ((i * 137) % 500), flux: 300, peak: 250, size: 6 }));

    it('finds no answer for the grid, and did find Orion without the bright-star checks', () => {
        expect(solve(grid, 800, 600, objects, { budgetMs: 1e6 })).toBeNull();
        const kept = { ...BRIGHT_CHECK };
        try {
            Object.assign(BRIGHT_CHECK, { atLeast: Infinity, minOrder: -Infinity });
            const fooled = solve(grid, 800, 600, objects, { budgetMs: 1e6 });
            expect(fooled.matches.map((m) => m.object.name)).toContain('Pi¹ Orionis');
        } finally {
            Object.assign(BRIGHT_CHECK, kept);
        }
    }, 60000);

    it('scores brightness order from 1 (brightest spots on the brightest stars) to -1', () => {
        const found = [{ flux: 900 }, { flux: 400 }, { flux: 100 }, { flux: 50 }];
        const objs = [{ mag: 1 }, { mag: 2 }, { mag: 3 }, { mag: 4 }];
        expect(brightnessOrder(found, objs, [[0, 0], [1, 1], [2, 2], [3, 3]])).toBe(1);
        expect(brightnessOrder(found, objs, [[0, 3], [1, 2], [2, 1], [3, 0]])).toBe(-1);
        expect(brightnessOrder(found, objs, [[0, 0], [1, 1]])).toBe(1); // too few to say
    });
});
