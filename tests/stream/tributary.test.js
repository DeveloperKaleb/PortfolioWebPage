import { describe, test, expect } from 'vitest';
import { createStream, createForestFloor, snowCover, TERRAIN, BLOCK, JUNCTION_PX, STREAM_COLORS } from '../../js/stream.js';
import { areDistinguishable } from '../../js/contrast.js';

const cells = (grid, kind) => {
    const found = [];
    grid.terrain.forEach((k, i) => {
        if (k === kind) found.push({ x: i % grid.cols, y: Math.floor(i / grid.cols) });
    });
    return found;
};
const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;

/* The tributary: seen near the top of the right margin, angling down towards the creek,
   and joining it from the right about 900px down - on a 1920px screen and a narrow one. */
describe.each([[69, 'wide'], [20, 'narrow']])('The tributary, %i columns (%s)', (cols) => {
    const rows = 320;
    const stream = createStream({ cols, rows, seed: 7 });
    const trib = stream.tributary;
    const forest = createForestFloor(stream, { cols, offset: cols * BLOCK + 1100 });
    const at = (grid, x, y) => grid.terrain[y * grid.cols + x];
    const glacialAt = (grid, x, y) => grid.glacial[y * grid.cols + x];
    const waterRows = (grid, x) => {
        const found = [];
        for (let y = 0; y < grid.rows; y++) if (at(grid, x, y) === TERRAIN.WATER) found.push(y);
        return found;
    };

    test('joins about 900px down the page', () => {
        expect(Math.abs(trib.row * BLOCK - JUNCTION_PX)).toBeLessThanOrEqual(30);
    });

    test('crosses the right margin near the top, 150-300px down at the page edge', () => {
        const edge = waterRows(forest, 0);
        expect(edge.length).toBeGreaterThan(0);
        expect(mean(edge) * BLOCK).toBeGreaterThan(150);
        expect(mean(edge) * BLOCK).toBeLessThan(300);
    });

    test('is higher further from the page, so it angles towards the creek', () => {
        const far = waterRows(forest, cols - 1);
        expect(far.length).toBeGreaterThan(0);
        expect(mean(far)).toBeLessThan(mean(waterRows(forest, 0)));
    });

    test('flows down and to the left, and all of it is glacial', () => {
        for (let i = 0; i < forest.terrain.length; i++) {
            if (forest.terrain[i] !== TERRAIN.WATER) continue;
            expect(forest.flowX[i]).toBeLessThan(0);
            expect(forest.flowY[i]).toBeGreaterThan(0);
            expect(forest.glacial[i]).toBe(1);
        }
    });

    test('comes out from under the page on the left and meets the creek', () => {
        const c = stream.channel[trib.row];
        for (let x = c.right; x < cols; x++) expect(at(stream, x, trib.row)).toBe(TERRAIN.WATER);
    });

    test('leaves the creek above the junction untouched', () => {
        for (let y = 0; y < trib.row - trib.mouth - 1; y++) {
            for (let x = stream.channel[y].left; x <= stream.channel[y].right; x++) {
                expect(glacialAt(stream, x, y)).toBe(0);
            }
        }
    });

    test('runs down the right side of the creek below, and fades as it mixes', () => {
        const y = trib.row + 20;
        const c = stream.channel[y];
        const wet = [];
        for (let x = c.left; x <= c.right; x++) if (at(stream, x, y) === TERRAIN.WATER) wet.push(x);
        expect(glacialAt(stream, wet.at(-1), y)).toBeGreaterThan(0.5);
        expect(glacialAt(stream, wet[0], y)).toBeLessThan(0.1);

        const far = trib.row + 160;
        for (let x = stream.channel[far].left; x <= stream.channel[far].right; x++) {
            expect(glacialAt(stream, x, far)).toBeLessThan(0.25);
        }
    });

    test('carries more water on, so the creek is wider below the junction', () => {
        const width = (from, to) => mean(stream.channel.slice(from, to).map((c) => c.right - c.left));
        expect(width(trib.row + 10, trib.row + 40)).toBeGreaterThan(width(trib.row - 40, trib.row - 10));
    });

    test('pushes the fastest water of the creek towards the far bank', () => {
        const c = stream.channel[trib.row + 15];
        expect(c.fast).toBeLessThan(c.centre);
    });

    test('leaves an eddy turning back upstream, and a gravel bar, below the junction', () => {
        const { eddy, bar } = stream;
        expect(eddy.y).toBeGreaterThan(trib.row);
        let upstream = 0;
        for (let i = 0; i < stream.terrain.length; i++) {
            if (stream.terrain[i] === TERRAIN.WATER && stream.flowY[i] < -0.5) upstream++;
        }
        expect(upstream).toBeGreaterThan(0);

        expect(bar.y).toBeGreaterThan(eddy.y);
        const gravel = cells(stream, TERRAIN.BAR);
        expect(gravel.length).toBeGreaterThan(0);
        gravel.forEach(({ x, y }) => expect(x).toBeGreaterThan(stream.channel[y].centre));
    });

    test('foams along the seam between the two waters', () => {
        let seam = 0;
        for (let y = trib.row; y < trib.row + 30; y++) {
            for (let x = 0; x < cols; x++) {
                const i = y * cols + x;
                if (stream.glacial[i] > 0.2 && stream.glacial[i] < 0.8 && stream.foam[i] > 0.3) seam++;
            }
        }
        expect(seam).toBeGreaterThan(0);
    });

    test('keeps the log and the boulders out of the confluence', () => {
        expect(stream.log.end.y + stream.log.radius).toBeLessThan(trib.row - trib.mouth);
        stream.boulders.forEach((b) => {
            const inside = b.y + b.r > trib.row - trib.mouth && b.y - b.r < stream.bar.y + stream.bar.ry;
            expect(inside).toBe(false);
        });
    });

    test('comes down out of snow, around its upstream end and not down the page', () => {
        const snow = cells(forest, TERRAIN.SNOW);
        expect(snow.length).toBeGreaterThan(0);
        snow.forEach(({ y }) => expect(y * BLOCK).toBeLessThan(500));
    });
});

describe('Snow and glacial water', () => {
    test('snow deepens up the tributary', () => {
        expect(snowCover(900)).toBe(0);
        expect(snowCover(1400)).toBeGreaterThan(snowCover(1200));
        expect(snowCover(1700)).toBe(1);
    });

    test('a wider screen, reaching further up, shows more snow', () => {
        const snowOf = (cols) => {
            const stream = createStream({ cols, rows: 200, seed: 7 });
            return cells(createForestFloor(stream, { cols, offset: cols * BLOCK + 1100 }), TERRAIN.SNOW).length / cols;
        };
        expect(snowOf(69)).toBeGreaterThan(snowOf(20));
    });

    /* The mixing only shows if the two waters can be told apart, by a colour-blind viewer
       too: held to the same rule as the game palettes, over every bed colour. */
    test.each(STREAM_COLORS.bed)('glacial water is tellable from the creek over %s', (bed) => {
        const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        const hex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
        const over = (tint, k) => hex(toRgb(bed).map((v, i) => v + (toRgb(tint)[i] - v) * k));
        // The creek at its clearest and at its deepest, against the tributary's water.
        [0.4, 0.65].forEach((k) => {
            expect(areDistinguishable(over(STREAM_COLORS.water, k), over(STREAM_COLORS.glacial, 0.8))).toBe(true);
        });
    });
});
