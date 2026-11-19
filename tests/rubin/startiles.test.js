import { describe, it, expect } from 'vitest';
import {
    STAR_BYTES, ROOT_HALF, NO_COLOUR, gaiaStar, rootCube, childCube, octantOf, cubeOf, tileName,
    quantize, unquantize, magByte, magOf, colourByte, colourOf, encodeTile, decodeTile, buildTree, makeIndex,
} from '../../js/startiles.js';
import { mapToGalactic } from '../../js/centauri.js';

/* A repeatable spread of stars: a small linear congruential generator, so no test depends
   on Math.random. */
function stars(n, half = 1000) {
    let seed = 12345;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    return Array.from({ length: n }, () => ({
        x: (next() * 2 - 1) * half, y: (next() * 2 - 1) * half, z: (next() * 2 - 1) * half,
        absMag: -5 + next() * 20, colour: next() < 0.1 ? null : -0.5 + next() * 4,
    }));
}

describe("a Gaia star in the map's frame", () => {
    it('puts a star at RA 0, Dec 0 on the x axis, 1000/parallax parsecs out', () => {
        const s = gaiaStar({ ra: 0, dec: 0, parallax: 100, g: 10, bpRp: 1.2 });
        expect(s.x).toBeCloseTo(10, 12);
        expect(s.y).toBeCloseTo(0, 12);
        expect(s.z).toBeCloseTo(0, 12);
        expect(s.colour).toBe(1.2);
    });

    it("puts the north ecliptic pole straight up", () => {
        const s = gaiaStar({ ra: 270, dec: 90 - 23.4392911, parallax: 10, g: 5, bpRp: null });
        expect(s.z).toBeCloseTo(100, 9);
        expect(Math.hypot(s.x, s.y)).toBeLessThan(1e-9);
        expect(s.colour).toBeNull();
    });

    it('gives absolute magnitude from G and parallax', () => {
        /* At 10 parsecs absolute and apparent are the same. */
        expect(gaiaStar({ ra: 10, dec: 20, parallax: 100, g: 7.5, bpRp: 1 }).absMag).toBeCloseTo(7.5, 12);
        expect(gaiaStar({ ra: 10, dec: 20, parallax: 10, g: 7.5, bpRp: 1 }).absMag).toBeCloseTo(2.5, 12);
    });

    it('puts Sagittarius A*\'s direction toward the galactic centre', () => {
        const s = gaiaStar({ ra: 266.4168371, dec: -29.0078106, parallax: 0.122, g: 0, bpRp: 0 });
        const [gx, gy, gz] = mapToGalactic([s.x, s.y, s.z]).map((v) => v / Math.hypot(s.x, s.y, s.z));
        expect(gx).toBeGreaterThan(0.999);
        expect(Math.abs(gy) + Math.abs(gz)).toBeLessThan(0.01);
    });
});

describe('cubes and paths', () => {
    it('halves into eight children by octant bits', () => {
        const c = childCube(rootCube(100), 1 | 4);
        expect(c).toEqual({ cx: 50, cy: -50, cz: 50, half: 50 });
        expect(octantOf(rootCube(100), 3, -2, 9)).toBe(5);
        expect(cubeOf('51', 100)).toEqual(childCube(c, 1));
        expect(cubeOf('')).toEqual(rootCube(ROOT_HALF));
        expect(tileName('')).toBe('r.bin');
        expect(tileName('07')).toBe('r07.bin');
    });
});

describe('one star in 8 bytes', () => {
    it('places a star within half a step of where it was', () => {
        const half = 2048;
        for (const v of [-2048, -1000.123, 0, 0.0001, 777.7, 2048]) {
            const back = unquantize(quantize(v, 0, half), 0, half);
            expect(Math.abs(back - v)).toBeLessThanOrEqual(half / 65535 + 1e-12);
        }
        expect(quantize(-5000, 0, half)).toBe(0);
        expect(quantize(5000, 0, half)).toBe(65535);
    });

    it('keeps brightness to an eighth of a magnitude and colour to a fortieth', () => {
        for (const m of [-8, -1.3, 4.83, 15.06, 23.875]) expect(Math.abs(magOf(magByte(m)) - m)).toBeLessThanOrEqual(1 / 16 + 1e-12);
        expect(magByte(-20)).toBe(0);
        expect(magByte(40)).toBe(255);
        for (const c of [-1, 0.65, 2.5, 5.35]) expect(Math.abs(colourOf(colourByte(c)) - c)).toBeLessThanOrEqual(1 / 80 + 1e-12);
        expect(colourByte(null)).toBe(NO_COLOUR);
        expect(colourByte(NaN)).toBe(NO_COLOUR);
        expect(colourByte(9)).toBe(254);
        expect(colourOf(NO_COLOUR)).toBeNull();
    });

    it('writes a tile of exactly 8 bytes a star, and reads it back', () => {
        const cube = childCube(rootCube(1000), 6);
        const list = stars(500, 1000).map((s) => ({ ...s, x: cube.cx + s.x / 2, y: cube.cy + s.y / 2, z: cube.cz + s.z / 2 }));
        const bytes = encodeTile(list, cube);
        expect(bytes.length).toBe(500 * STAR_BYTES);
        const back = decodeTile(bytes, cube);
        expect(back.count).toBe(500);
        list.forEach((s, k) => {
            expect(Math.abs(back.xyz[k * 3] - s.x)).toBeLessThanOrEqual(cube.half / 65535 + 1e-9);
            expect(Math.abs(back.xyz[k * 3 + 2] - s.z)).toBeLessThanOrEqual(cube.half / 65535 + 1e-9);
            expect(back.mag[k]).toBe(magByte(s.absMag));
            expect(back.colour[k]).toBe(colourByte(s.colour));
        });
    });

    it('refuses a tile that is not whole stars', () => {
        expect(() => decodeTile(new Uint8Array(12), rootCube())).toThrow(/whole number/);
    });

    it('reads a tile that sits inside a bigger buffer', () => {
        const cube = rootCube(10);
        const one = encodeTile([{ x: 1, y: 2, z: 3, absMag: 4, colour: 1 }], cube);
        const bigger = new Uint8Array(32);
        bigger.set(one, 16);
        const back = decodeTile(bigger.subarray(16, 24), cube);
        expect(back.xyz[1]).toBeCloseTo(2, 3);
    });
});

describe('the octree', () => {
    const list = stars(20000);
    const { nodes, outside } = buildTree(list, { half: 1024, perNode: 1000 });

    it('keeps every star once, in some node', () => {
        const all = [...nodes.values()].flat();
        expect(all.length + outside).toBe(list.length);
        expect(new Set(all).size).toBe(all.length);
    });

    it('fills a node before handing stars down, and none holds more than its capacity', () => {
        for (const [path, s] of nodes) {
            expect(s.length).toBeLessThanOrEqual(1000);
            if ([0, 1, 2, 3, 4, 5, 6, 7].some((o) => nodes.has(path + o))) expect(s.length).toBe(1000);
        }
    });

    it('keeps the brightest highest, brightest first in each tile', () => {
        const rootFaintest = Math.max(...nodes.get('').map((s) => s.absMag));
        for (const [path, s] of nodes) {
            for (let k = 1; k < s.length; k++) expect(s[k].absMag).toBeGreaterThanOrEqual(s[k - 1].absMag);
            if (path) expect(Math.min(...s.map((t) => t.absMag))).toBeGreaterThanOrEqual(rootFaintest);
        }
    });

    it("puts each star inside its node's cube", () => {
        for (const [path, s] of nodes) {
            const c = cubeOf(path, 1024);
            for (const t of s) {
                expect(Math.abs(t.x - c.cx)).toBeLessThanOrEqual(c.half);
                expect(Math.abs(t.y - c.cy)).toBeLessThanOrEqual(c.half);
                expect(Math.abs(t.z - c.cz)).toBeLessThanOrEqual(c.half);
            }
        }
    });

    it('leaves out and counts stars beyond the root', () => {
        const r = buildTree([{ x: 0, y: 0, z: 0, absMag: 1, colour: 0 }, { x: 5000, y: 0, z: 0, absMag: 0, colour: 0 }], { half: 1024 });
        expect(r.outside).toBe(1);
        expect(r.nodes.get('').length).toBe(1);
    });

    it('builds the same tree every time', () => {
        const again = buildTree(list, { half: 1024, perNode: 1000 });
        expect([...again.nodes.keys()]).toEqual([...nodes.keys()]);
        expect(again.nodes.get('7')).toEqual(nodes.get('7'));
    });

    it('lists every node in the index, root first, with counts that add up', () => {
        const index = makeIndex(nodes, { half: 1024, perNode: 1000, source: 'test' });
        const paths = index.nodes.map(([p]) => p);
        expect(index.nodes[0]).toEqual(['', 1000]);
        expect(index.stars).toBe(list.length - outside);
        expect(JSON.parse(JSON.stringify(index)).nodes).toEqual(index.nodes);
        expect(index.starBytes).toBe(8);
        for (const p of paths.slice(1)) expect(paths).toContain(p.slice(0, -1));
    });
});
