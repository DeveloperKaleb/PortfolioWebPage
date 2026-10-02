import { describe, test, expect } from 'vitest';
import { diameterFromH, albedosNear, assessH, darkAlbedo, ALBEDO_SAMPLE, FLAGS } from '../../js/brightness.js';
import { TNO_ALBEDOS, TNO_ALBEDOS_MODIFIED } from '../../js/tnoalbedos.js';

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

describe('The albedo snapshot', () => {
    test('is dated and large enough to average over', () => {
        expect(TNO_ALBEDOS_MODIFIED).toMatch(/\d{4}/);
        expect(TNO_ALBEDOS.length).toBeGreaterThan(100);
    });

    test.each(TNO_ALBEDOS.map((o) => [o.name, o]))('%s is a usable measurement', (_, o) => {
        expect(o.name.length).toBeGreaterThan(0);
        expect(Number.isFinite(o.H)).toBe(true);
        expect(o.albedo).toBeGreaterThan(0);
        expect(o.albedo).toBeLessThanOrEqual(1.5);
        expect(['O', 'I', 'E', 'T', 'H', 'Y']).toContain(o.method);
        expect(o.source.length).toBeGreaterThan(0);
    });

    test('keeps the dwarf planets, with their occultation and imaging albedos', () => {
        const find = (name) => TNO_ALBEDOS.find((o) => o.name.includes(name));
        expect(find('Eris')).toMatchObject({ albedo: 0.96, method: 'O' });
        expect(find('Makemake')).toMatchObject({ albedo: 0.8, method: 'O' });
        expect(find('Pluto').albedo).toBeGreaterThan(0.5);
    });

    /* The reason the albedos are taken from objects of similar brightness: big TNOs are
       bright with ice, small ones dark. If the data ever stopped showing this, the
       design would need rethinking. */
    test('shows the size-albedo link the averaging relies on', () => {
        const bright = TNO_ALBEDOS.filter((o) => o.H < 2).map((o) => o.albedo);
        const faint = TNO_ALBEDOS.filter((o) => o.H > 5).map((o) => o.albedo);
        expect(median(bright)).toBeGreaterThan(2 * median(faint));
    });
});

describe('Diameter from brightness', () => {
    test('recovers Eris from its H and occultation albedo', () => {
        expect(diameterFromH(-1.15, 0.96)).toBeGreaterThan(2326 * 0.95);
        expect(diameterFromH(-1.15, 0.96)).toBeLessThan(2326 * 1.05);
    });

    test('a darker surface means a bigger body for the same brightness', () => {
        expect(diameterFromH(4, 0.05)).toBeGreaterThan(diameterFromH(4, 0.5));
    });
});

describe('Albedos near a brightness', () => {
    const weightedMean = ({ albedos, weights }) => albedos.reduce((sum, a, k) => sum + a * weights[k], 0);

    test('weights sum to one and favour the nearest measurements', () => {
        const near = albedosNear(4.5);
        expect(near.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
        const nearest = TNO_ALBEDOS.reduce((best, o, k) => (Math.abs(o.H - 4.5) < Math.abs(TNO_ALBEDOS[best].H - 4.5) ? k : best), 0);
        expect(near.weights[nearest]).toBe(Math.max(...near.weights));
    });

    test('is worth at least minCount measurements everywhere', () => {
        [-1, 1, 3, 4.5, 7, 10].forEach((H) => {
            expect(albedosNear(H).effectiveCount).toBeGreaterThanOrEqual(ALBEDO_SAMPLE.minCount);
        });
    });

    test('stays at its narrowest where the cutoff falls, where the data is densest', () => {
        [3.75, 4, 4.5, 5].forEach((H) => expect(albedosNear(H).width).toBe(ALBEDO_SAMPLE.minWidth));
    });

    test('gives bright objects brighter albedos than faint ones', () => {
        expect(weightedMean(albedosNear(0))).toBeGreaterThan(weightedMean(albedosNear(6)));
    });
});

describe('The verdict on a brightness', () => {
    /* Caught a real bug: a hard H window let five dark objects in at once and made a
       fainter object score higher. Checked finely, so any such jump shows. */
    test('a brighter object always has the better chance', () => {
        let previous = 1;
        for (let H = -1.5; H <= 8; H += 0.05) {
            const { evidence } = assessH(H);
            expect(evidence).toBeLessThanOrEqual(previous + 1e-9);
            previous = evidence;
        }
    });

    test('passes the dwarf planets, undisputed', () => {
        [['Eris', -1.15], ['Pluto', -0.55], ['Makemake', -0.25], ['Haumea', 0.43]].forEach(([, H]) => {
            expect(assessH(H)).toMatchObject({ passes: true, disputed: false });
        });
    });

    test('fails a faint object', () => {
        expect(assessH(7)).toMatchObject({ passes: false, disputed: false });
    });

    test('flags a pass that Grundy\'s reading would fail', () => {
        expect(assessH(4)).toMatchObject({ passes: true, disputed: true });
    });

    /* Pinned so a change to the calibration list or the albedo snapshot cannot move the
       cutoff unnoticed. Update deliberately, with a note in NOTES.md. */
    test('puts the cutoff at H of about 4.1', () => {
        expect(assessH(3.8).passes).toBe(true);
        expect(assessH(4.4).passes).toBe(false);
    });

    test('folds in an uncertain H without leaving 0 to 1', () => {
        const sure = assessH(4.5);
        const unsure = assessH(4.5, { errH: 0.5 });
        expect(assessH(4.5, { errH: 0 })).toEqual(sure);
        expect(unsure.evidence).toBeGreaterThan(0);
        expect(unsure.evidence).toBeLessThan(1);
        expect(unsure.evidence).not.toBeCloseTo(sure.evidence, 3);
    });
});

/* A large dark body - something out of place - is fainter than its size suggests, and
   the plain average treats it as a typical small object. The large-if-dark flag records
   it instead of losing it, without loosening the filter. */
describe('Large if dark', () => {
    test('assumes the darkness of the darkest TNOs measured, taken from the data', () => {
        const albedos = TNO_ALBEDOS.map((o) => o.albedo);
        const darker = albedos.filter((a) => a < darkAlbedo()).length;
        expect(darker / albedos.length).toBeLessThanOrEqual(0.05);
        expect(darkAlbedo()).toBeGreaterThan(0.02);
        expect(darkAlbedo()).toBeLessThan(0.06);
    });

    test('flags an 800 km body as dark as that, which fails as a typical object', () => {
        const H = -5 * Math.log10(800 * Math.sqrt(darkAlbedo()) / 1329);
        const verdict = assessH(H);
        expect(verdict.passes).toBe(false);
        expect(verdict.flags).toContain('largeIfDark');
        expect(verdict.ifDark.evidence).toBeGreaterThanOrEqual(0.8);
    });

    test('assuming dark never makes a body less likely to be large', () => {
        for (let H = -1.5; H <= 8; H += 0.25) {
            const verdict = assessH(H);
            expect(verdict.ifDark.evidence).toBeGreaterThanOrEqual(verdict.evidence - 1e-9);
        }
    });

    test('flags only failures, and passes only get disputed', () => {
        for (let H = -1.5; H <= 8; H += 0.1) {
            const { passes, flags } = assessH(H);
            if (passes) expect(flags).not.toContain('largeIfDark');
            else expect(flags).not.toContain('disputed');
        }
    });

    /* Pinned like the cutoff: the flag starts where passing stops and runs to about
       H 6, where even the darkest surface leaves a body under the 80% size. */
    test('covers H from about 4.1 to about 6, right after the pass cutoff', () => {
        expect(assessH(4.3).flags).toContain('largeIfDark');
        expect(assessH(5.8).flags).toContain('largeIfDark');
        expect(assessH(6.3).flags).not.toContain('largeIfDark');
        expect(assessH(-1).flags).not.toContain('largeIfDark');
    });

    test('leaves a faint ordinary object alone', () => {
        expect(assessH(7.5)).toMatchObject({ passes: false, flags: [] });
    });

    test('every flag it can raise is defined, with words for the digest to show', () => {
        const raised = new Set();
        for (let H = -1.5; H <= 8; H += 0.1) assessH(H).flags.forEach((f) => raised.add(f));
        raised.forEach((name) => {
            expect(FLAGS[name].label.length).toBeGreaterThan(0);
            expect(FLAGS[name].means.length).toBeGreaterThan(20);
        });
        expect([...raised].sort()).toEqual(['disputed', 'largeIfDark']);
    });
});
