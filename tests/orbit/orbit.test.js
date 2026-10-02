import { describe, test, expect } from 'vitest';
import {
    solveKepler, positionAt, earthAt, apparentMagnitude, observe, orbitFlags, qualityFlags, jdFromDate, ORBIT_QUALITY,
    SCOPE_AU, RUBIN_SINGLE_VISIT, TYPICAL_V_MINUS_R,
} from '../../js/orbit.js';
import { assessObject, watchWorthy } from '../../js/verdict.js';
import { FLAGS } from '../../js/flags.js';
import { OBJECTS, EPOCH } from './fixtures.js';

const jd = (date) => jdFromDate(new Date(`${date}T00:00:00Z`));

/* Against JPL Horizons, which includes the planets' pull that two-body motion leaves
   out: tight near the elements' epoch, looser three years on. */
describe.each(Object.entries(OBJECTS))('%s against JPL Horizons', (_, object) => {
    test.each(Object.entries(object.horizons))('on %s', (date, ref) => {
        const seen = observe(object.elements, object.H, jd(date));
        const nearEpoch = Math.abs(jd(date) - EPOCH) < 365;
        const tolerance = nearEpoch ? 0.002 : 0.02;
        expect(Math.abs(seen.r - ref.r)).toBeLessThan(tolerance);
        expect(Math.abs(seen.delta - ref.delta)).toBeLessThan(tolerance);
        expect(Math.abs(seen.V - ref.V)).toBeLessThan(0.01);
        expect(Math.abs(seen.phase - ref.phase)).toBeLessThan(0.02);
    });
});

describe("Kepler's equation", () => {
    test.each([0, 0.1, 0.5, 0.9, 0.99])('solves an ellipse with e = %s', (e) => {
        for (let M = -3; M <= 3; M += 0.25) {
            const E = solveKepler(M, e);
            const back = E - e * Math.sin(E);
            expect(Math.atan2(Math.sin(back - M), Math.cos(back - M))).toBeCloseTo(0, 10);
        }
    });

    test.each([1.1, 1.5, 3])('solves a hyperbola with e = %s', (e) => {
        for (let M = -20; M <= 20; M += 2.5) {
            const F = solveKepler(M, e);
            expect(e * Math.sinh(F) - F).toBeCloseTo(M, 9);
        }
    });
});

describe('Positions', () => {
    test('a circular orbit keeps its distance', () => {
        const circle = { a: 44, e: 0, i: 5, om: 20, w: 0, ma: 0, epoch: EPOCH };
        [0, 1000, 50000].forEach((days) => expect(positionAt(circle, EPOCH + days).r).toBeCloseTo(44, 9));
    });

    test('an elliptical orbit is at perihelion when the mean anomaly is zero', () => {
        const ellipse = { a: 100, e: 0.6, i: 10, om: 0, w: 0, ma: 0, epoch: EPOCH };
        expect(positionAt(ellipse, EPOCH).r).toBeCloseTo(40, 9);
    });

    test('an unbound orbit is at perihelion when the mean anomaly is zero, and recedes', () => {
        const open = { a: -50, e: 1.2, i: 10, om: 0, w: 0, ma: 0, epoch: EPOCH };
        expect(positionAt(open, EPOCH).r).toBeCloseTo(10, 9);
        expect(positionAt(open, EPOCH + 3650).r).toBeGreaterThan(positionAt(open, EPOCH + 365).r);
    });

    test('refuses a parabolic orbit rather than getting it wrong', () => {
        expect(() => positionAt({ a: 1e9, e: 1, i: 0, om: 0, w: 0, ma: 0, epoch: EPOCH }, EPOCH)).toThrow(RangeError);
    });

    test("puts Earth at perihelion in early January and aphelion in early July", () => {
        expect(earthAt(jd('2026-01-03')).r).toBeCloseTo(0.9833, 3);
        expect(earthAt(jd('2026-07-04')).r).toBeCloseTo(1.0167, 3);
    });
});

describe('Brightness and detection', () => {
    test('at zero phase, magnitude is H plus the distance term', () => {
        expect(apparentMagnitude(2, 50, 49, 0)).toBeCloseTo(2 + 5 * Math.log10(50 * 49), 10);
    });

    test('Eris, Sedna and Gonggong are all within a single Rubin visit', () => {
        Object.values(OBJECTS).forEach((o) => expect(observe(o.elements, o.H, jd('2026-10-02')).detectable).toBe(true));
    });

    test('the detection limit is the single-visit depth, after the colour', () => {
        const far = { a: 300, e: 0, i: 0, om: 0, w: 0, ma: 0, epoch: EPOCH };
        const seen = (H) => observe(far, H, EPOCH);
        // Find the H at which it just stops being detectable, and check that is the depth.
        let H = 0;
        while (seen(H + 0.01).detectable) H += 0.01;
        expect(seen(H).V - TYPICAL_V_MINUS_R).toBeLessThanOrEqual(RUBIN_SINGLE_VISIT.depth);
        expect(seen(H + 0.01).V - TYPICAL_V_MINUS_R).toBeGreaterThan(RUBIN_SINGLE_VISIT.depth);
    });

    test('nothing beyond 100,000 AU is in scope', () => {
        const beyond = { a: SCOPE_AU * 2, e: 0, i: 0, om: 0, w: 0, ma: 0, epoch: EPOCH };
        const within = { a: SCOPE_AU / 2, e: 0, i: 0, om: 0, w: 0, ma: 0, epoch: EPOCH };
        expect(observe(beyond, 0, EPOCH).inScope).toBe(false);
        expect(observe(within, 0, EPOCH).inScope).toBe(true);
    });
});

describe('Orbit flags', () => {
    test('Sedna is extreme and detached', () => {
        expect(orbitFlags(OBJECTS.Sedna.elements).sort()).toEqual(['detached', 'extremeOrbit']);
    });

    test('Eris, at 44 degrees, is highly inclined', () => {
        expect(orbitFlags(OBJECTS.Eris.elements)).toEqual(['highlyInclined']);
    });

    test('an ordinary classical TNO raises nothing', () => {
        expect(orbitFlags({ a: 44, e: 0.05, i: 2 })).toEqual([]);
    });

    test('retrograde replaces highly inclined rather than adding to it', () => {
        expect(orbitFlags({ a: 40, e: 0.2, i: 120 })).toEqual(['retrograde']);
    });

    test('an open orbit is unbound, and never called extreme', () => {
        expect(orbitFlags({ a: -500, e: 1.3, i: 10 })).toContain('unbound');
        expect(orbitFlags({ a: -500, e: 1.3, i: 10 })).not.toContain('extremeOrbit');
    });

    test('works out perihelion itself', () => {
        // a = 200, e = 0.7 gives q = 60: extreme and detached.
        expect(orbitFlags({ a: 200, e: 0.7, i: 5 }).sort()).toEqual(['detached', 'extremeOrbit']);
    });
});

describe('The whole verdict', () => {
    const today = jd('2026-10-02');

    test('passes Sedna, with its orbit flags and where it is', () => {
        const v = assessObject(OBJECTS.Sedna, today);
        expect(v.passes).toBe(true);
        expect(v.flags).toEqual(expect.arrayContaining(['extremeOrbit', 'detached']));
        expect(v.orbit.r).toBeCloseTo(82.84, 1);
        expect(v.watch).toBe(false);
    });

    /* The case the project most wants not to miss: faint, so failing as a typical object,
       but possibly large if dark, on an orbit that marks it as out of place. */
    test('watches a faint object that could be large if dark, on an extreme orbit', () => {
        const v = assessObject({ H: 4.8, elements: { ...OBJECTS.Sedna.elements } }, today);
        expect(v.passes).toBe(false);
        expect(v.flags).toEqual(expect.arrayContaining(['largeIfDark', 'extremeOrbit']));
        expect(v.watch).toBe(true);
    });

    test('does not watch a large-if-dark object on an ordinary orbit', () => {
        const ordinary = { a: 44, e: 0.05, i: 2, om: 0, w: 0, ma: 0, epoch: EPOCH };
        const v = assessObject({ H: 4.8, elements: ordinary }, today);
        expect(v.flags).toEqual(['largeIfDark']);
        expect(v.watch).toBe(false);
    });

    test('never passes an object outside the 100,000 AU scope', () => {
        const beyond = { a: SCOPE_AU * 2, e: 0, i: 0, om: 0, w: 0, ma: 0, epoch: EPOCH };
        expect(assessObject({ H: -2, elements: beyond }, today).passes).toBe(false);
    });

    test('watchWorthy needs both the dark flag and an orbit flag', () => {
        expect(watchWorthy(['largeIfDark', 'retrograde'])).toBe(true);
        expect(watchWorthy(['largeIfDark'])).toBe(false);
        expect(watchWorthy(['retrograde'])).toBe(false);
    });

    test('every flag is defined, with a kind and words for the digest', () => {
        const raised = new Set();
        [OBJECTS.Eris, OBJECTS.Sedna, OBJECTS.Gonggong].forEach((o) => assessObject(o, today).flags.forEach((f) => raised.add(f)));
        ['unbound', 'retrograde', 'highlyInclined', 'extremeOrbit', 'detached', 'uncertainOrbit'].forEach((f) => raised.add(f));
        raised.forEach((name) => {
            expect(['brightness', 'orbit', 'quality']).toContain(FLAGS[name].kind);
            expect(FLAGS[name].label.length).toBeGreaterThan(0);
            expect(FLAGS[name].means.length).toBeGreaterThan(20);
        });
    });
});

/* For an object with a measured albedo, the size is known: the first live run failed
   Salacia (78%) by averaging over typical albedos, though its albedo is measured. */
describe('Measured sizes', () => {
    const today = jd('2026-10-02');
    const salacia = { a: 42.06, e: 0.105, i: 23.93, om: 280, w: 310, ma: 120, epoch: EPOCH };

    test('Salacia fails on its brightness alone, but is flagged large if dark', () => {
        const v = assessObject({ H: 4.12, errH: 0.3, elements: salacia }, today);
        expect(v.passes).toBe(false);
        expect(v.sizeFrom).toBe('brightness');
        expect(v.flags).toContain('largeIfDark');
    });

    test('with its measured albedo found by number, Salacia passes, sized from the measurement', () => {
        const v = assessObject({ H: 4.12, errH: 0.3, elements: salacia, designation: '120347', provisional: '2004 SB60' }, today);
        expect(v.passes).toBe(true);
        expect(v.sizeFrom).toBe('measured');
        expect(v.measured.albedo).toBe(0.041);
        expect(v.flags).not.toContain('largeIfDark');
    });

    test('finds a measured albedo by provisional designation too', () => {
        const v = assessObject({ H: 3.5, elements: salacia, designation: '2014 UZ224', provisional: '2014 UZ224' }, today);
        expect(v.sizeFrom).toBe('measured');
    });

    test('an object with no measurement is sized from its brightness', () => {
        expect(assessObject({ H: 4, elements: salacia, designation: '999999', provisional: '2099 ZZ99' }, today).sizeFrom).toBe('brightness');
    });
});

/* A fresh discovery's orbit can be far off. The first live run watched 2026 RY158, found
   this year, with a perihelion of 11 AU and a retrograde orbit. */
describe('Orbit quality', () => {
    const today = jd('2026-10-02');
    const ry158 = { a: 434.91, e: 1 - 11.04 / 434.91, i: 95.47, om: 0, w: 0, ma: 1, epoch: EPOCH };

    test('flags an orbit from under a year of observations', () => {
        expect(qualityFlags({ arcDays: ORBIT_QUALITY.minArcDays - 1, conditionCode: 2 })).toEqual(['uncertainOrbit']);
    });

    test('flags an orbit the MPC rates poorly known', () => {
        expect(qualityFlags({ arcDays: 3000, conditionCode: ORBIT_QUALITY.maxConditionCode + 1 })).toEqual(['uncertainOrbit']);
    });

    test('leaves a well-known orbit, or one with no quality data, alone', () => {
        expect(qualityFlags({ arcDays: 11075, conditionCode: 3 })).toEqual([]);
        expect(qualityFlags(null)).toEqual([]);
    });

    test('keeps the flags of a fresh, odd orbit, but does not watch it on their strength', () => {
        const fresh = assessObject({ H: 4.8, elements: ry158, quality: { arcDays: 40, conditionCode: 9 } }, today);
        expect(fresh.flags).toEqual(expect.arrayContaining(['largeIfDark', 'retrograde', 'uncertainOrbit']));
        expect(fresh.watch).toBe(false);
        const settled = assessObject({ H: 4.8, elements: ry158, quality: { arcDays: 4000, conditionCode: 2 } }, today);
        expect(settled.watch).toBe(true);
    });
});
