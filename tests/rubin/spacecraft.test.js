import { describe, it, expect } from 'vitest';
import {
    CRAFT, ALL_ITEMS, PLACE_WORDS, LAGRANGE_AU, itemsOf, groupState, readShown, trackPosition, trackPath, placesOn, craftOn, clusterMarks,
} from '../../js/spacecraft.js';
import { TRACKS } from '../../js/spacecrafttracks.js';
import { positionAt } from '../../js/orbit.js';

describe('the craft list', () => {
    it('gives every item a unique id', () => {
        const ids = ALL_ITEMS.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('places every craft either by Horizons or at a known place, never both', () => {
        for (const s of CRAFT) {
            expect(Boolean(s.horizons) !== Boolean(s.at), s.id).toBe(true);
            if (s.at) expect(PLACE_WORDS[s.at], s.id).toBeTruthy();
            expect(typeof s.active, s.id).toBe('boolean');
            expect(s.blurb, s.id).toBeTruthy();
        }
    });

    it('has a built track for every craft placed by Horizons (run npm run spacecraft)', () => {
        for (const s of CRAFT.filter((c) => c.horizons)) expect(TRACKS[s.id], s.name).toBeTruthy();
    });

    /* Owner, 2026-11-19: science craft only. */
    it('lists no commercial craft and no Earth-orbit satellites', () => {
        const ids = ALL_ITEMS.map((s) => s.id);
        expect(ids).not.toContain('roadster');
        expect(ids.some((id) => /^earth/.test(id))).toBe(false);
        expect(CRAFT.some((s) => /SpaceX|Tesla/.test(`${s.agency} ${s.name}`))).toBe(false);
        expect(CRAFT.some((s) => s.at === 'Earth')).toBe(false);
    });

    it('splits the tree into active and inactive', () => {
        expect(itemsOf(true).every((s) => s.active)).toBe(true);
        expect(itemsOf(false).every((s) => !s.active)).toBe(true);
        expect(itemsOf(true).length + itemsOf(false).length).toBe(ALL_ITEMS.length);
    });
});

describe('what is shown', () => {
    it('is nothing until asked for', () => {
        expect(readShown(null).size).toBe(0);
        expect(readShown(undefined).size).toBe(0);
        expect(readShown({ voyager1: true }).size).toBe(0);
    });

    it('keeps only known ids from what was saved', () => {
        expect([...readShown(['voyager1', 'nonsense', 3, 'mro', 'earthActive'])]).toEqual(['voyager1', 'mro']);
    });

    it('reads a branch as all, some or none', () => {
        const items = [{ id: 'a' }, { id: 'b' }];
        expect(groupState(items, new Set())).toBe('none');
        expect(groupState(items, new Set(['a']))).toBe('some');
        expect(groupState(items, new Set(['a', 'b', 'z']))).toBe('all');
    });
});

describe('tracks', () => {
    const quadratic = (t) => [1 + 0.01 * t + 1e-5 * t * t, -2 + 0.02 * t, 0.5 - 3e-6 * t * t];
    const track = { start: 100, step: 10, xyz: Array.from({ length: 6 }, (_, k) => quadratic(k * 10)).flat() };

    it('puts a craft between samples on a smooth path, exactly for a quadratic', () => {
        for (const t of [0, 3, 17.5, 25, 44, 50]) {
            const p = trackPosition(track, 100 + t);
            const [x, y, z] = quadratic(t);
            expect(p.x).toBeCloseTo(x, 10);
            expect(p.y).toBeCloseTo(y, 10);
            expect(p.z).toBeCloseTo(z, 10);
        }
    });

    it('places nothing outside the samples', () => {
        expect(trackPosition(track, 99.9)).toBeNull();
        expect(trackPosition(track, 150.1)).toBeNull();
        expect(trackPosition(null, 120)).toBeNull();
    });

    it('follows an orbit at any date after it starts', () => {
        const elements = { a: -3.5, e: 3.7, i: 35, om: 179, w: 338, ma: 70, epoch: 2461041.5 };
        const orbit = { from: 2461041.5, elements };
        const p = trackPosition(orbit, 2470000);
        const q = positionAt(elements, 2470000);
        expect([p.x, p.y, p.z]).toEqual([q.x, q.y, q.z]);
        expect(trackPosition(orbit, 2461000)).toBeNull();
    });

    it('draws a path along the track once picked', () => {
        const path = trackPath(track, 120);
        expect(path.length).toBeGreaterThan(10);
        expect(path[0].x).toBeCloseTo(1, 10);
    });

    it('puts Voyager 1 about 170 AU out in 2026, far above the plane', () => {
        const p = trackPosition(TRACKS.voyager1, 2461200.5);
        const r = Math.hypot(p.x, p.y, p.z);
        expect(r).toBeGreaterThan(165);
        expect(r).toBeLessThan(175);
        expect(p.z / r).toBeGreaterThan(0.5);
    });
});

describe('places', () => {
    const planets = [{ name: 'Earth', x: 0.6, y: -0.8, z: 0 }, { name: 'Mars', x: 1.5, y: 0, z: 0.03 }];
    const moons = [{ name: 'Luna', x: 0.6025, y: -0.8, z: 0 }];

    it('puts L1 and L2 0.01 AU from Earth, toward the Sun and away', () => {
        const at = placesOn(planets, moons);
        expect(Math.hypot(at.L1.x, at.L1.y)).toBeCloseTo(1 - LAGRANGE_AU, 12);
        expect(Math.hypot(at.L2.x, at.L2.y)).toBeCloseTo(1 + LAGRANGE_AU, 12);
        expect(at.L1.x / at.L1.y).toBeCloseTo(0.6 / -0.8, 12);
        expect(at.Luna.x).toBe(0.6025);
    });

    it('draws a craft at its place, and lists one with no position as missing', () => {
        const { shown, missing } = craftOn(2461200.5, planets, moons, {});
        const mro = shown.find((c) => c.item.id === 'mro');
        expect([mro.x, mro.y, mro.z, mro.place]).toEqual([1.5, 0, 0.03, 'Mars']);
        expect(missing.map((s) => s.id)).toContain('voyager1');
        /* Juno's Jupiter is not in this test's planets, so it is missing too. */
        expect(missing.map((s) => s.id)).toContain('juno');
    });
});

describe('clusters', () => {
    it('merges marks closer than the given pixels, the first leading', () => {
        const cl = clusterMarks([{ sx: 0, sy: 0, id: 1 }, { sx: 5, sy: 5, id: 2 }, { sx: 40, sy: 0, id: 3 }], 16);
        expect(cl.length).toBe(2);
        expect(cl[0].members.map((m) => m.id)).toEqual([1, 2]);
        expect([cl[0].x, cl[0].y]).toEqual([0, 0]);
    });
});
