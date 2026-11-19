import { describe, it, expect } from 'vitest';
import { treeOf, nodeOnScreen, tilesToDraw, tintOf, lookOf, STREET_PC, BLOCK_PC } from '../../js/starview.js';
import { buildTree, makeIndex, magByte, colourByte, NO_COLOUR } from '../../js/startiles.js';
import { initialView, projector, zoomAt, FLAT } from '../../js/rubinview.js';
import { AU_PER_PARSEC } from '../../js/centauri.js';

/* A small sky: stars spread through a cube 512 pc each way. */
function sky(n) {
    let seed = 7;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    return Array.from({ length: n }, () => ({ x: (next() * 2 - 1) * 500, y: (next() * 2 - 1) * 500, z: (next() * 2 - 1) * 500, absMag: next() * 15, colour: 1 }));
}
const { nodes } = buildTree(sky(20000), { half: 512, perNode: 500 });
const tree = treeOf(makeIndex(nodes, { half: 512, perNode: 500 }));
const blockView = initialView(BLOCK_PC * AU_PER_PARSEC, 750);

describe('the tree from an index', () => {
    it('links every node to its parent', () => {
        for (const node of tree.values()) if (node.path) expect(tree.get(node.path.slice(0, -1)).children).toContain(node.path);
        expect(tree.get('').cube.half).toBe(512);
    });
});

describe('which tiles a view needs', () => {
    it('starts with the root, and goes deeper the closer the view', () => {
        const deep = treeOf(makeIndex(buildTree(sky(20000), { half: 512, perNode: 50 }).nodes, { half: 512, perNode: 50 }));
        const far = initialView(4000 * AU_PER_PARSEC, 750);
        const wide = tilesToDraw(deep, far, projector(far, FLAT));
        expect(wide[0]).toBe('');
        const close = zoomAt(far, 64);
        const near = tilesToDraw(deep, close, projector(close, FLAT));
        const depth = (list) => Math.max(...list.map((p) => p.length));
        expect(depth(near)).toBeGreaterThan(depth(wide));
    });

    it('never goes past the star budget', () => {
        const close = zoomAt(blockView, 64);
        const list = tilesToDraw(tree, close, projector(close, FLAT), { budget: 3000 });
        expect(list.reduce((t, p) => t + tree.get(p).count, 0)).toBeLessThanOrEqual(3000);
        expect(list.length).toBeGreaterThan(0);
    });

    it('leaves out tiles off screen', () => {
        /* Zoomed far in near one corner of the cube, the opposite corner's tiles are not wanted. */
        const corner = { ...zoomAt(blockView, 64), cx: 400 * AU_PER_PARSEC, cy: 400 * AU_PER_PARSEC };
        const project = projector(corner, FLAT);
        const list = tilesToDraw(tree, corner, project);
        for (const p of list) expect(nodeOnScreen(tree.get(p), corner, project).visible).toBe(true);
        /* Octant 0 is x and y below the centre: off screen at this corner, past the root. */
        expect(list.some((p) => p.startsWith('0') && p.length > 1)).toBe(false);
    });

    it('turns with the map in 3D', () => {
        const cam = { turn: 0.7, tilt: 1.1 };
        const list = tilesToDraw(tree, blockView, projector(blockView, cam));
        expect(list[0]).toBe('');
        expect(list.length).toBeGreaterThan(1);
    });

    it('has the street, inside which the stars are drawn as marks already, at a million AU', () => {
        expect(STREET_PC).toBeCloseTo(4.848, 3);
    });
});

describe('how a star looks', () => {
    it('is larger and brighter the more luminous it is', () => {
        const bright = lookOf(magByte(-5));
        const faint = lookOf(magByte(15));
        expect(bright.size).toBeGreaterThan(faint.size);
        expect(bright.alpha).toBeGreaterThan(faint.alpha);
        expect(faint.size).toBeGreaterThanOrEqual(1);
        expect(bright.alpha).toBeLessThanOrEqual(1);
    });

    it('is bluer when hot and redder when cool, the Sun pale yellow', () => {
        const hot = tintOf(colourByte(-0.2));
        const sun = tintOf(colourByte(0.82));
        const cool = tintOf(colourByte(3));
        expect(hot[2]).toBeGreaterThan(hot[0]);
        expect(cool[0]).toBeGreaterThan(cool[2]);
        expect(sun[0]).toBeGreaterThan(sun[2]);
        expect(tintOf(NO_COLOUR)).toEqual([0.9, 0.9, 0.9]);
        for (const t of [hot, sun, cool, tintOf(colourByte(9)), tintOf(colourByte(-1))]) for (const v of t) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    });
});
