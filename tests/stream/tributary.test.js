import { describe, test, expect } from 'vitest';
import { createStream, createForestFloor, snowCover, TERRAIN, BLOCK, JUNCTION_PX, STREAM_COLORS, GLACIAL_OPACITY, GLACIAL_REFERENCE } from '../../js/stream.js';
import { contrastRatio } from '../../js/contrast.js';

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

    test('foams a little along the seam where the waters first meet, and not for long', () => {
        // Rocks downstream foam in partly glacial water too; that is not the seam.
        const nearRock = (x, y) => stream.boulders.some((b) => Math.hypot(x - b.x, y - b.y) < b.r * 3 + 8);
        const seamFoam = (from, to) => {
            let n = 0;
            for (let y = from; y < to; y++) {
                for (let x = 0; x < cols; x++) {
                    const i = y * cols + x;
                    if (nearRock(x, y)) continue;
                    if (stream.glacial[i] > 0.2 && stream.glacial[i] < 0.8 && stream.foam[i] > 0.2) n++;
                }
            }
            return n;
        };
        expect(seamFoam(trib.row, trib.row + 15)).toBeGreaterThan(0);
        expect(seamFoam(trib.row + 60, trib.row + 120)).toBe(0);
    });

    /* No confluence in the reference photographs shows a hard edge between the waters. */
    test('shades from one water into the other rather than meeting at an edge', () => {
        const y = trib.row + 20;
        const c = stream.channel[y];
        let between = 0;
        for (let x = c.left; x <= c.right; x++) {
            const g = glacialAt(stream, x, y);
            if (at(stream, x, y) === TERRAIN.WATER && g > 0.05 && g < 0.5) between++;
        }
        expect(between).toBeGreaterThanOrEqual(cols > 40 ? 3 : 1);
    });

    /* The downstream corner comes to a point that water would wear away; it is only
       believable armoured. */
    test('has a boulder sitting on the sharp downstream corner', () => {
        const { tip, cornerRock } = stream;
        expect(tip.y).toBeGreaterThan(trib.row);
        // Big enough to round the point off, not just mark it: the tip, the cell into the
        // creek below it and the cell back into the bank beside it are all rock.
        expect(at(stream, tip.x, tip.y)).toBe(TERRAIN.BOULDER);
        expect(at(stream, tip.x - 1, tip.y + 1)).toBe(TERRAIN.BOULDER);
        expect(at(stream, tip.x + 1, tip.y)).toBe(TERRAIN.BOULDER);
        // Water on its upstream face, from the tributary.
        expect(at(stream, tip.x, Math.floor(cornerRock.y - cornerRock.r) - 1)).toBe(TERRAIN.WATER);
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

    /* These colours are exempt from the site's colour rules, by the project owner's
       decision; they are held to looking real instead. The glacial water against the
       creek has to sit within the contrasts measured from photographs of real clear-
       against-glacial confluences: the Otta at 1.33:1 and the Kenai meeting the Russian
       at 1.57:1. The first version was 2.05:1, which is the Rhone against the Arve - two
       big rivers and an unusually silty one - and looked wrong on a creek. */
    const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const hex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    const overBeds = (tint, k) => hex(STREAM_COLORS.bed.map(toRgb)
        .map((bed) => bed.map((v, i) => v + (toRgb(tint)[i] - v) * k))
        .reduce((sum, rgb) => sum.map((v, i) => v + rgb[i] / STREAM_COLORS.bed.length), [0, 0, 0]));
    // The creek at its middling depth, as it runs beside the plume.
    const creek = overBeds(STREAM_COLORS.water, 0.525);

    test('glacial water sits within the contrast of real confluences', () => {
        const ratio = contrastRatio(creek, overBeds(STREAM_COLORS.glacial, GLACIAL_OPACITY));
        expect(ratio).toBeGreaterThanOrEqual(GLACIAL_REFERENCE.otta);
        expect(ratio).toBeLessThanOrEqual(GLACIAL_REFERENCE.kenai);
    });

    test('and so does the plume where it runs beside the creek', () => {
        const stream = createStream({ cols: 69, rows: 320, seed: 7 });
        const y0 = stream.tributary.row;
        const average = (pick) => {
            const sum = [0, 0, 0];
            let n = 0;
            for (let i = 0; i < stream.terrain.length; i++) {
                const y = Math.floor(i / stream.cols);
                if (stream.terrain[i] !== TERRAIN.WATER || y < y0 + 10 || y >= y0 + 40 || !pick(stream.glacial[i])) continue;
                for (let k = 0; k < 3; k++) sum[k] += stream.shades[i * 9 + k];
                n++;
            }
            return hex(sum.map((v) => v / n));
        };
        const ratio = contrastRatio(average((g) => g < 0.05), average((g) => g > 0.6));
        expect(ratio).toBeGreaterThanOrEqual(GLACIAL_REFERENCE.otta);
        expect(ratio).toBeLessThanOrEqual(GLACIAL_REFERENCE.kenai);
    });

    /* Shallow water: the bed shows through the glacial water too, as it does through the
       clear water at the Kenai and the Otta. */
    test('the bed still shows through glacial water', () => {
        expect(GLACIAL_OPACITY).toBeLessThanOrEqual(0.5);
    });

    /* The difference is mostly hue: at the Kenai the two waters carry nearly the same red,
       and the glacial water far more blue and green. */
    test('glacial water differs from the creek more in hue than in brightness', () => {
        const [cr, , cb] = toRgb(creek);
        const [gr, , gb] = toRgb(overBeds(STREAM_COLORS.glacial, GLACIAL_OPACITY));
        expect(Math.abs(gr - cr)).toBeLessThan(15);
        expect((gb - gr) - (cb - cr)).toBeGreaterThan(10);
    });
});
