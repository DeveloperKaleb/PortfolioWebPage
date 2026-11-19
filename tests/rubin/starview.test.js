import { describe, it, expect } from 'vitest';
import {
    treeOf, nodeOnScreen, tilesToDraw, tintOf, lookOf, STREET_PC, BLOCK_PC, nearestStar, starRows, lightText, colourText, kindText, lightYearsText,
    GAIA_BH1_ROWS, gaiaBh1Pc, holdsNotable, NEIGHBORHOOD_PC, magLimitOf, frontierOf, frontierLimit, glowOf, nearness, NEAR_PX, PICK_PX, focusReachPc, focusGlow, streetFades, FADE_STREET_BEYOND_PC, LY_PER_PARSEC,
} from '../../js/starview.js';
import { buildTree, makeIndex, magByte, colourByte, NO_COLOUR, rootCube } from '../../js/startiles.js';
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

describe('pointing at a star', () => {
    const cube = rootCube(512);
    const tileOf = (...stars) => ({ cube, count: stars.length, xyz: Float64Array.from(stars.flat()) });
    const project = projector(blockView, FLAT);
    const spot = (x, y, z) => project(x * AU_PER_PARSEC, y * AU_PER_PARSEC, z * AU_PER_PARSEC);

    it('finds the nearest star drawn within a few pixels', () => {
        const tile = tileOf([100, 50, 0], [101, 50, 0], [-80, 20, 3]);
        const [px, py] = spot(101, 50, 0);
        const hit = nearestStar([tile], blockView, project, px + 1, py);
        expect(hit.k).toBe(1);
        expect(nearestStar([tile], blockView, project, px + 60, py)).toBeNull();
    });

    it("passes over stars not drawn: inside the street, or past the place's edge", () => {
        const [sx, sy] = spot(1, 1, 0);
        expect(nearestStar([tileOf([1, 1, 0])], blockView, project, sx, sy)).toBeNull();
        /* Straight down the line of sight, far below the plane: on screen, but out of the block. */
        const [dx, dy] = spot(100, 50, -400);
        expect(nearestStar([tileOf([100, 50, -400])], blockView, project, dx, dy, { outerPc: BLOCK_PC })).toBeNull();
        expect(nearestStar([tileOf([100, 50, -200])], blockView, project, dx, dy, { outerPc: BLOCK_PC })).not.toBeNull();
    });
});

describe('a star in words', () => {
    it('says how far, how bright and what colour', () => {
        const rows = starRows({ x: 300, y: 0, z: 0 }, magByte(4.67), colourByte(0.82));
        expect(rows[1]).toEqual(['978 light years', 'from the Sun']);
        expect(rows[2][0]).toBe("About the Sun's light,");
        expect(rows[3][0]).toBe('Yellow-white:');
        expect(rows).toHaveLength(4);
    });

    it('in round numbers either side of the Sun', () => {
        expect(lightText(-0.33)[0]).toBe("100 times the Sun's light,");
        expect(lightText(7.17)[0]).toBe("10% of the Sun's light,");
        expect(lightText(14.67)[0]).toBe("1/10,000 of the Sun's light,");
        expect(colourText(null)).toBeNull();
        expect(colourText(0)[0]).toBe('Blue-white:');
        expect(colourText(2.5)[0]).toBe('Red:');
    });

    it('names giants and white dwarfs, and leaves stars like the Sun unnamed', () => {
        expect(kindText(0.5, 1.2)[0]).toBe('A giant:');
        expect(kindText(12, 0.3)[0]).toBe('A white dwarf:');
        expect(kindText(4.67, 0.82)).toBeNull();
        expect(kindText(10, 2.2)).toBeNull();
    });
});

describe('Gaia BH1', () => {
    it('is about 1,560 light years away, as published', () => {
        expect(gaiaBh1Pc()).toBeCloseTo(477, 0);
        expect(lightYearsText(gaiaBh1Pc())).toBe('1,560 light years');
        expect(GAIA_BH1_ROWS[1][0]).toBe('About 1,560 light years');
    });
});

describe('the faintest stars a view shows', () => {
    it('are fainter the closer the view, and stop falling past where Gaia reaches', () => {
        const at = (pc) => magLimitOf(pc);
        expect(at(30)).toBeGreaterThan(at(100));
        expect(at(100)).toBeGreaterThan(at(250));
        /* The Sun (4.67) is still shown 250 pc out, and nearly so at a thousand. */
        expect(at(250)).toBeGreaterThan(4.67);
        expect(at(1000)).toBeCloseTo(at(4000), 6);
        expect(at(1000)).toBeGreaterThan(3.5);
    });
});

describe('cutting where the tiles stop short', () => {
    it('finds the drawn tiles with children in the picture left out, and cuts at the faintest of them', () => {
        const project = projector(blockView, FLAT);
        const all = tilesToDraw(tree, blockView, project);
        expect(frontierOf(tree, all, blockView, project).every((p) => all.includes(p))).toBe(true);
        const part = tilesToDraw(tree, blockView, project, { budget: 2000 });
        const edge = frontierOf(tree, part, blockView, project);
        expect(edge.length).toBeGreaterThan(0);
        const faint = Object.fromEntries(edge.map((p, k) => [p, 8 - k]));
        expect(frontierLimit(edge, (p) => faint[p], 99)).toBe(8 - edge.length + 1);
        expect(frontierLimit(edge, () => undefined, 6.5)).toBe(6.5);
    });
});

describe('dimming a crowded picture', () => {
    it('leaves a thin field alone, and dims a crowded one in proportion', () => {
        expect(glowOf(1000, blockView, BLOCK_PC)).toBe(1);
        const crowded = glowOf(2000000, blockView, BLOCK_PC);
        expect(crowded).toBeLessThan(1);
        expect(glowOf(4000000, blockView, BLOCK_PC)).toBeCloseTo(crowded / 2, 6);
    });
});

describe('each place its own stars', () => {
    it("takes no tile wholly past the place's edge", () => {
        const project = projector(blockView, FLAT);
        const list = tilesToDraw(tree, blockView, project, { outerPc: 100 });
        for (const p of list) {
            const { cx, cy, cz, half } = tree.get(p).cube;
            expect(Math.hypot(cx, cy, cz) - half * Math.sqrt(3)).toBeLessThanOrEqual(100);
        }
        expect(list.length).toBeLessThan(tilesToDraw(tree, blockView, project).length);
    });
});

describe('stars near the pointer', () => {
    it('brighten most under it, less further off, and not at all past NEAR_PX', () => {
        expect(nearness(0)).toBe(1);
        expect(nearness(NEAR_PX / 2)).toBeCloseTo(0.5, 6);
        expect(nearness(NEAR_PX * 0.25)).toBeGreaterThan(nearness(NEAR_PX * 0.75));
        expect(nearness(NEAR_PX)).toBe(0);
        expect(nearness(NEAR_PX * 3)).toBe(0);
    });

    it('can be picked a little way off, well inside the glow', () => {
        expect(PICK_PX).toBeGreaterThanOrEqual(8);
        expect(PICK_PX).toBeLessThan(NEAR_PX / 2);
    });
});

describe('notable objects, only inside the map drawn', () => {
    it('marks Gaia BH1 in the neighborhood, not the block or the street', () => {
        expect(holdsNotable(NEIGHBORHOOD_PC, gaiaBh1Pc())).toBe(true);
        expect(holdsNotable(BLOCK_PC, gaiaBh1Pc())).toBe(false);
        expect(holdsNotable(0, gaiaBh1Pc())).toBe(false);
    });
});

describe('the star in focus', () => {
    it('lights the stars nearest it most, falling to the background further off', () => {
        const reach = focusReachPc(BLOCK_PC);
        expect(focusGlow(0, reach)).toBe(1);
        expect(focusGlow(reach, reach)).toBeCloseTo(0.5, 6);
        expect(focusGlow(reach * 5, reach)).toBeLessThan(0.05);
        expect(reach * LY_PER_PARSEC).toBeGreaterThan(100);
    });

    it("fades the street's stars only past 20 light years beyond its edge", () => {
        expect(FADE_STREET_BEYOND_PC * LY_PER_PARSEC).toBeCloseTo(35.8, 1);
        expect(streetFades(0)).toBe(false);
        expect(streetFades(30 / LY_PER_PARSEC)).toBe(false);
        expect(streetFades(40 / LY_PER_PARSEC)).toBe(true);
    });
});
