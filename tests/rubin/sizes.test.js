import { describe, it, expect } from 'vitest';
import { sizeOf, sizeRange, sizeLineup, lineupText, widthText, STAR_SIZES, SIZE_REFERENCES, LINEUP_PX, SPECK_PX } from '../../js/rubinview.js';

const estimated = { designation: '90377', name: '90377 Sedna (2003 VB12)', H: 1.5, sizeFrom: 'brightness' };
const named = (lineup) => lineup.bodies.map((b) => b.name);

describe('sizeRange', () => {
    it('keeps a measured size as it is, with no range', () => {
        const entry = { sizeFrom: 'measured', diameterKm: 984 };
        expect(sizeRange(entry)).toEqual(sizeOf(entry));
        expect(sizeRange(entry).low).toBeUndefined();
    });

    it('brackets an estimate: smaller if bright, larger if dark, the usual size between', () => {
        const r = sizeRange(estimated);
        expect(r.km).toBe(sizeOf(estimated).km);
        expect(r.low).toBeLessThan(r.km);
        expect(r.high).toBeGreaterThan(r.km);
    });
});

describe('sizeLineup', () => {
    it('sets a small body beside the familiar bodies nearest it in size', () => {
        expect(named(sizeLineup([{ designation: 'x', name: 'X', km: 250 }]))).toEqual(['X', 'The Moon', 'Ceres']);
    });

    it('adds Earth, as home, where everything stays at least a few pixels across', () => {
        expect(named(sizeLineup([{ designation: 'x', name: 'X', km: 1040 }]))).toEqual(['X', 'Earth', 'The Moon', 'Ceres']);
        expect(named(sizeLineup(STAR_SIZES['body:proxima']))).not.toContain('Earth');
        expect(named(sizeLineup([{ designation: 'x', name: 'X', km: 6000 }]))).toEqual(['X', 'Earth', 'The Moon']);
    });

    it('never compares a body with itself', () => {
        const earth = SIZE_REFERENCES.find((r) => r.name === 'Earth');
        expect(named(sizeLineup([earth])).slice(1)).not.toContain('Earth');
        expect(named(sizeLineup(STAR_SIZES['body:sun']))).toEqual(['The Sun', 'Jupiter', 'Earth']);
    });

    it('draws everything to one scale, the largest at full size', () => {
        const { bodies } = sizeLineup(STAR_SIZES['body:proxima']);
        expect(named({ bodies })).toEqual(['Proxima Centauri', 'The Sun', 'Jupiter']);
        const sun = bodies.find((b) => b.name === 'The Sun');
        const proxima = bodies[0];
        expect(sun.px).toBeCloseTo(LINEUP_PX, 6);
        expect(proxima.px / sun.px).toBeCloseTo(0.1542, 4);
    });

    it('draws a body too small to see as the smallest dot, and says so', () => {
        const { bodies } = sizeLineup(STAR_SIZES['body:sun']);
        const earth = bodies.find((b) => b.name === 'Earth');
        expect(earth.speck).toBe(true);
        expect(earth.px).toBe(SPECK_PX);
        expect(lineupText(STAR_SIZES['body:sun'], sizeLineup(STAR_SIZES['body:sun'])).lines.at(-1)).toMatch(/^Earth is drawn as the smallest dot/);
    });

    it('scales to the dashed ring of an estimate, so it fits', () => {
        const r = { designation: 'x', name: 'X', ...sizeRange(estimated) };
        const [x] = sizeLineup([r]).bodies;
        expect(x.outerPx).toBeLessThanOrEqual(LINEUP_PX + 1e-9);
        expect(x.px).toBeLessThan(x.outerPx);
    });

    it('shows every member of a system picked as one', () => {
        expect(named(sizeLineup(STAR_SIZES['body:centauri'])).slice(0, 3)).toEqual(['Alpha Centauri A', 'Alpha Centauri B', 'Proxima Centauri']);
    });
});

describe('the words', () => {
    it('says how many times as wide, in words', () => {
        expect(widthText(1.5, 'Jupiter')).toBe('1.5 times as wide as Jupiter');
        expect(widthText(109, 'Earth')).toBe('109 times as wide as Earth');
        expect(widthText(1.05, 'Earth')).toBe('about as wide as Earth');
        expect(widthText(0.29, 'the Moon')).toBe('29% as wide as the Moon');
    });

    it('says an estimate is probably so, and gives its range', () => {
        const r = { designation: 'x', name: 'Sedna', ...sizeRange(estimated) };
        const { title, lines } = lineupText([r], sizeLineup([r]));
        expect(title).toMatch(/^Sedna beside .+, to one scale$/);
        expect(lines[0]).toMatch(/^Sedna is probably /);
        expect(lines[1]).toMatch(/bright \(the solid disc\).+dark \(the dashed ring\)/);
    });

    it("says Luhman 16's tundrs are sized from models, not measured", () => {
        const { lines } = lineupText(STAR_SIZES['body:luhmanA'], sizeLineup(STAR_SIZES['body:luhmanA']));
        expect(lines.join(' ')).toMatch(/models, not measured/);
    });
});
