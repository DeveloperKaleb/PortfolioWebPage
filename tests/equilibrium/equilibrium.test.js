import { describe, test, expect } from 'vitest';
import {
    CALIBRATION, SHAPED, PUBLISHED_VIEWS, READINGS, fitEquilibrium, chanceShaped, diameterAt, bootstrapDiameterAt, assessDiameter,
} from '../../js/equilibrium.js';

describe('The calibration list', () => {
    test.each(CALIBRATION.map((b) => [b.name, b]))('%s is complete and sourced', (_, body) => {
        expect(body.diameterKm).toBeGreaterThan(0);
        expect(Object.values(SHAPED)).toContain(body.shaped);
        expect(['moon', 'belt', 'tno']).toContain(body.population);
        expect(body.basis.length).toBeGreaterThan(10);
        expect(body.sources.length).toBeGreaterThan(0);
    });

    test('names each body once', () => {
        const names = CALIBRATION.map((b) => b.name);
        expect(new Set(names).size).toBe(names.length);
    });

    test('has rounded and irregular bodies on both sides of the threshold region', () => {
        const definite = CALIBRATION.filter((b) => b.shaped !== SHAPED.UNCERTAIN);
        const smallestRounded = Math.min(...definite.filter((b) => b.shaped === SHAPED.YES).map((b) => b.diameterKm));
        const largestIrregular = Math.max(...definite.filter((b) => b.shaped === SHAPED.NO).map((b) => b.diameterKm));
        // Mimas and Proteus overlap: that overlap is what keeps the fit's slope finite.
        expect(smallestRounded).toBeLessThan(largestIrregular);
    });

    /* Labels come from shape or interior evidence, never from size, or the fit would be
       circular. A size-based label would show up as a large body called rounded with no
       measurement behind it: every large TNO without a measured shape stays uncertain. */
    test('leaves large distant objects with no measured shape uncertain', () => {
        ['Gonggong', 'Sedna', 'Orcus'].forEach((name) => {
            expect(CALIBRATION.find((b) => b.name === name).shaped).toBe(SHAPED.UNCERTAIN);
        });
    });
});

describe('The fit', () => {
    const fit = fitEquilibrium();

    test('ignores uncertain bodies', () => {
        const definiteOnly = fitEquilibrium(CALIBRATION.filter((b) => b.shaped !== SHAPED.UNCERTAIN));
        expect(definiteOnly.a).toBeCloseTo(fit.a, 8);
        expect(definiteOnly.b).toBeCloseTo(fit.b, 8);
    });

    test('gives a larger chance to a larger body', () => {
        expect(fit.b).toBeGreaterThan(0);
        expect(chanceShaped(fit, 1000)).toBeGreaterThan(chanceShaped(fit, 500));
    });

    test('agrees with the obvious cases', () => {
        expect(chanceShaped(fit, 5262)).toBeGreaterThan(0.99); // Ganymede
        expect(chanceShaped(fit, 270)).toBeLessThan(0.05); // Hyperion
    });

    test('diameterAt is the inverse of chanceShaped', () => {
        [0.5, 0.8, 0.95].forEach((p) => expect(chanceShaped(fit, diameterAt(fit, p))).toBeCloseTo(p, 10));
    });

    /* Pinned so a change to the list cannot move the cutoff unnoticed. If the list is
       changed on purpose, update this range and say why in NOTES.md. */
    test('puts the 80% cutoff at about 445 km', () => {
        const d80 = diameterAt(fit, 0.8);
        expect(d80).toBeGreaterThan(435);
        expect(d80).toBeLessThan(455);
    });

    /* The ridge only steadies bootstrap draws that lose the Mimas-Proteus overlap. On the
       full list it must not be what sets the answer. */
    test('the ridge barely moves the cutoff', () => {
        const unridged = fitEquilibrium(CALIBRATION, { ridge: 1e-9 });
        expect(Math.abs(diameterAt(fit, 0.8) - diameterAt(unridged, 0.8))).toBeLessThan(5);
    });

    test('refuses a list with only one kind of body', () => {
        expect(() => fitEquilibrium(CALIBRATION.filter((b) => b.shaped === SHAPED.YES))).toThrow();
    });
});

describe('How firm the cutoff is', () => {
    const spread = bootstrapDiameterAt(0.8);

    test('is reproducible', () => {
        expect(bootstrapDiameterAt(0.8)).toEqual(spread);
    });

    test('brackets the fitted cutoff', () => {
        const d80 = diameterAt(fitEquilibrium(), 0.8);
        expect(spread.low).toBeLessThan(d80);
        expect(spread.high).toBeGreaterThan(d80);
        expect(spread.samples).toBeGreaterThan(900);
    });
});

/* Not an agreement test: the published views disagree with each other (400 to 1000 km),
   so the fit cannot match them all. This records where it sits among them. */
describe('Against the published views', () => {
    const d80 = diameterAt(fitEquilibrium(), 0.8);

    test('sits above the 2006 icy threshold and in Brown\'s "probably" tier', () => {
        expect(d80).toBeGreaterThan(PUBLISHED_VIEWS.iau2006);
        const tier = PUBLISHED_VIEWS.brown.find((t) => d80 >= t.from);
        expect(tier.label).toBe('probably');
    });

    test('sits well below Grundy\'s 900-1000 km', () => {
        expect(d80).toBeLessThan(PUBLISHED_VIEWS.grundy.from);
    });
});

/* The filter passes on the evidence reading and flags passes that Grundy's reading of the
   low-density mid-sized TNOs would fail - the project owner's choice. */
describe('The two readings', () => {
    const grundyFit = fitEquilibrium(READINGS.grundy(CALIBRATION));

    test('Grundy\'s reading relabels exactly the five low-density mid-sized TNOs', () => {
        const relabelled = CALIBRATION.filter((b) => b.grundy);
        expect(relabelled.map((b) => b.name).sort()).toEqual(
            ['Gǃkúnǁʼhòmdímà', 'Salacia', 'Uni (2002 UX25)', 'Varda', 'Varuna'].sort(),
        );
        relabelled.forEach((b) => {
            expect(b.shaped).toBe(SHAPED.UNCERTAIN);
            expect(b.population).toBe('tno');
        });
    });

    test('Grundy\'s reading puts the cutoff at about 940 km', () => {
        const d80 = diameterAt(grundyFit, 0.8);
        expect(d80).toBeGreaterThan(920);
        expect(d80).toBeLessThan(960);
    });

    test('the evidence reading leaves the list as it is', () => {
        expect(READINGS.evidence(CALIBRATION)).toEqual(CALIBRATION);
    });

    test('a body above both cutoffs passes, undisputed', () => {
        expect(assessDiameter(1200)).toMatchObject({ passes: true, disputed: false });
    });

    test('a body between the cutoffs passes, flagged as disputed', () => {
        const verdict = assessDiameter(650);
        expect(verdict.passes).toBe(true);
        expect(verdict.disputed).toBe(true);
        expect(verdict.evidence).toBeGreaterThanOrEqual(0.8);
        expect(verdict.grundy).toBeLessThan(0.8);
    });

    test('a body below both cutoffs fails, and is not called disputed', () => {
        expect(assessDiameter(300)).toMatchObject({ passes: false, disputed: false });
    });
});
