import { describe, test, expect } from 'vitest';
import { moonOffset, lunarOffset, moonRing, moonDistance, MOON_ORBITS, MOON_PARENTS, MOON_EPOCH } from '../../js/moons.js';
import { HORIZONS_APRIL_2026 } from './fixtures.js';

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
        expect(MOON_PARENTS.Moon).toBe('Earth');
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

    test("the Moon stays between perigee and apogee", () => {
        for (let d = 0; d < 60; d += 3) {
            const km = Math.hypot(...lunarOffset(MOON_EPOCH + d)) * 149597870.7;
            expect(km).toBeGreaterThan(355000);
            expect(km).toBeLessThan(407000);
        }
    });

    test('a ring for the map, and a mean distance to decide when to draw it', () => {
        expect(moonRing('Io', MOON_EPOCH)).toHaveLength(72);
        expect(moonDistance('Moon')).toBeCloseTo(0.00257, 4);
    });
});
