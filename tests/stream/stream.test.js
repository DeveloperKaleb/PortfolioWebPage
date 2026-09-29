import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStream, createForestFloor, forestDensity, renderFrame, TERRAIN, MIN_COLS, BLOCK, FOREST_RAMP } from '../../js/stream.js';

// A wide margin on a tall screen, and the narrowest one the page will draw.
const sizes = [[68, 180], [MIN_COLS, 150], [30, 120]];
const seeds = [1, 7, 42, 2026, 99991];

const cells = (stream, kind) => {
    const found = [];
    stream.terrain.forEach((k, i) => {
        if (k === kind) found.push({ x: i % stream.cols, y: Math.floor(i / stream.cols) });
    });
    return found;
};

describe.each(sizes)('A %i x %i stream', (cols, rows) => {
    test.each(seeds)('seed %i: a bank on both sides of every row', (seed) => {
        const stream = createStream({ cols, rows, seed });
        stream.channel.forEach(({ left, right }) => {
            expect(left).toBeGreaterThanOrEqual(2);
            expect(right).toBeLessThanOrEqual(cols - 3);
            expect(right - left).toBeGreaterThanOrEqual(3);
        });
    });

    test.each(seeds)('seed %i: has boulders standing in the water', (seed) => {
        const stream = createStream({ cols, rows, seed });
        expect(stream.boulders.length).toBeGreaterThan(0);
        stream.boulders.forEach((b) => {
            const { left, right } = stream.channel[Math.round(b.y)] ?? stream.channel.at(-1);
            expect(b.x).toBeGreaterThanOrEqual(left);
            expect(b.x).toBeLessThanOrEqual(right);
        });
    });

    test.each(seeds)('seed %i: one log, partly under water', (seed) => {
        const stream = createStream({ cols, rows, seed });
        const dry = cells(stream, TERRAIN.LOG);
        const sunk = cells(stream, TERRAIN.LOG_SUBMERGED);
        expect(dry.length).toBeGreaterThan(0);
        expect(sunk.length).toBeGreaterThan(0);

        // The sunk part is in the channel; the dry part reaches the bank.
        sunk.forEach(({ x, y }) => {
            expect(x).toBeGreaterThanOrEqual(stream.channel[y].left);
            expect(x).toBeLessThanOrEqual(stream.channel[y].right);
        });
        expect(dry.some(({ x, y }) => x < stream.channel[y].left || x > stream.channel[y].right)).toBe(true);
    });

    test.each(seeds)('seed %i: no boulder sits on the log', (seed) => {
        const stream = createStream({ cols, rows, seed });
        const { start, end, radius } = stream.log;
        stream.boulders.forEach((b) => {
            const dx = end.x - start.x, dy = end.y - start.y;
            const t = Math.max(0, Math.min(1, ((b.x - start.x) * dx + (b.y - start.y) * dy) / (dx * dx + dy * dy)));
            const gap = Math.hypot(b.x - start.x - t * dx, b.y - start.y - t * dy);
            expect(gap).toBeGreaterThan(b.r + radius);
        });
    });
});

describe('The water', () => {
    const stream = createStream({ cols: 40, rows: 160, seed: 7 });
    const { cols, terrain, speed, foam } = stream;

    test('only water moves', () => {
        terrain.forEach((kind, i) => {
            const wet = kind === TERRAIN.WATER || kind === TERRAIN.LOG_SUBMERGED;
            expect(speed[i] > 0).toBe(wet);
        });
    });

    test('runs slower behind a boulder than beside it', () => {
        stream.boulders.forEach((b) => {
            const y = Math.round(b.y + b.r + 2);
            const behind = y * cols + Math.round(b.x);
            if (y >= stream.rows || terrain[behind] !== TERRAIN.WATER) return;
            const c = stream.channel[y];
            const open = Math.max(...Array.from({ length: c.right - c.left + 1 }, (_, k) => speed[y * cols + c.left + k]));
            expect(speed[behind]).toBeLessThan(open);
        });
    });

    test('white water piles up on the upstream face of every boulder', () => {
        stream.boulders.forEach((b) => {
            // The cell just above the boulder's top pixel in its middle column.
            const x = Math.round(b.x);
            let top = Math.round(b.y);
            while (top > 0 && terrain[(top - 1) * cols + x] === TERRAIN.BOULDER) top--;
            const y = top - 1;
            const i = y * cols + x;
            if (y < 0 || terrain[i] !== TERRAIN.WATER) return;
            expect(foam[i]).toBeGreaterThan(0.5);
        });
    });

    test('foams where it pours off the sunk end of the log', () => {
        const lip = cells(stream, TERRAIN.LOG_SUBMERGED)
            .map(({ x, y }) => (y + 1) * cols + x)
            .filter((i) => terrain[i] === TERRAIN.WATER);
        expect(lip.length).toBeGreaterThan(0);
        lip.forEach((i) => expect(foam[i]).toBeGreaterThan(0.5));
    });
});

describe('Rendering', () => {
    const stream = createStream({ cols: 40, rows: 160, seed: 7 });
    const a = renderFrame(stream, 3.0);
    const b = renderFrame(stream, 3.5);

    test('fills every cell, opaque', () => {
        expect(a.length).toBe(40 * 160 * 4);
        for (let o = 3; o < a.length; o += 4) expect(a[o]).toBe(255);
    });

    test('is the same picture for the same moment', () => {
        expect(renderFrame(stream, 3.0)).toEqual(a);
    });

    test('the water moves and nothing else does', () => {
        let waterChanged = 0;
        stream.terrain.forEach((kind, i) => {
            const same = [0, 1, 2].every((k) => a[i * 4 + k] === b[i * 4 + k]);
            if (kind === TERRAIN.WATER) waterChanged += same ? 0 : 1;
            else if (kind !== TERRAIN.LOG_SUBMERGED) expect(same).toBe(true);
        });
        expect(waterChanged).toBeGreaterThan(100);
    });

    test('draws only the band of rows it is asked for', () => {
        const buffer = new Uint8ClampedArray(40 * 160 * 4);
        renderFrame(stream, 3.0, buffer, 50, 80);
        for (let y = 0; y < 160; y++) {
            const row = buffer.subarray(y * 40 * 4, (y + 1) * 40 * 4);
            if (y >= 50 && y < 80) expect(row).toEqual(a.subarray(y * 40 * 4, (y + 1) * 40 * 4));
            else expect(row.every((v) => v === 0)).toBe(true);
        }
    });

    test('a band running off either end is clipped, not an error', () => {
        const buffer = new Uint8ClampedArray(40 * 160 * 4);
        expect(() => renderFrame(stream, 3.0, buffer, -5, 400)).not.toThrow();
        expect(buffer).toEqual(a);
    });

    test('reuses a buffer it is handed', () => {
        const buffer = new Uint8ClampedArray(40 * 160 * 4);
        expect(renderFrame(stream, 1, buffer)).toBe(buffer);
    });
});

test('refuses a margin too narrow for a stream', () => {
    expect(() => createStream({ cols: MIN_COLS - 1, rows: 100 })).toThrow(RangeError);
});

describe('The forest floor', () => {
    // A 1920px screen: 410px margins either side of the 1100px column.
    const stream = createStream({ cols: 69, rows: 300, seed: 7 });
    const offset = 69 * BLOCK + 1100;
    const forest = createForestFloor(stream, { cols: 69, offset });

    const covered = (floor, from, to) => {
        let n = 0, all = 0;
        for (let y = 0; y < floor.rows; y++) {
            for (let x = from; x < to; x++) { all++; if (floor.pixels[(y * floor.cols + x) * 4 + 3]) n++; }
        }
        return n / all;
    };

    test('thickens with distance from the stream', () => {
        expect(forestDensity(FOREST_RAMP.start - 1)).toBe(0);
        expect(forestDensity(FOREST_RAMP.full + 1)).toBe(1);
        expect(forestDensity(1300)).toBeGreaterThan(forestDensity(1200));
    });

    test('is only partly there beside the page, and nearly whole at the far edge', () => {
        const near = covered(forest, 0, 10);
        const far = covered(forest, 59, 69);
        expect(near).toBeLessThan(0.6);
        expect(far).toBeGreaterThan(0.85);
        expect(far).toBeGreaterThan(near);
    });

    test('a narrow margin gets only scattered moss', () => {
        const narrowStream = createStream({ cols: 17, rows: 300, seed: 7 });
        const narrow = createForestFloor(narrowStream, { cols: 17, offset: 17 * BLOCK + 1100 });
        expect(covered(narrow, 0, 17)).toBeLessThan(0.4);
        expect(covered(narrow, 0, 17)).toBeLessThan(covered(forest, 0, 69));
    });

    test('changes down the page, so scrolling shows different ground', () => {
        const rowOf = (y) => forest.pixels.subarray(y * 69 * 4, (y + 1) * 69 * 4);
        expect(rowOf(40)).not.toEqual(rowOf(200));
    });

    test('keeps its stumps far from the water', () => {
        const [er, eg, eb] = [0xb0, 0x8f, 0x5e];
        let stumps = 0;
        for (let i = 0; i < forest.density.length; i++) {
            const o = i * 4;
            if (forest.pixels[o] === er && forest.pixels[o + 1] === eg && forest.pixels[o + 2] === eb) {
                stumps++;
                expect(forest.density[i]).toBeGreaterThan(0.6);
            }
        }
        expect(stumps).toBeGreaterThan(0);
    });

    test('is the same ground for the same stream', () => {
        expect(createForestFloor(stream, { cols: 69, offset }).pixels).toEqual(forest.pixels);
    });
});

/* A row has to look the same whatever the page's length: that is what makes the stream
   match between Home and Entertainment, and what stops it reshuffling when a page grows
   (the photo loading, a game view opening). */
describe('The same stream on every page', () => {
    const short = createStream({ cols: 69, rows: 120, seed: 7 });
    const long = createStream({ cols: 69, rows: 400, seed: 7 });
    const band = 120 * 69;

    test('every row is laid out the same, down to the last', () => {
        expect(long.terrain.subarray(0, band)).toEqual(short.terrain);
        expect(long.log).toEqual(short.log);
    });

    test('and moves the same, so the water matches too', () => {
        // The last row can see one row further down on a longer page, so it is left out.
        const upTo = (119 * 69) * 4;
        expect(renderFrame(long, 12.3).subarray(0, upTo)).toEqual(renderFrame(short, 12.3).subarray(0, upTo));
    });

    test('the forest floor matches as well', () => {
        const offset = 69 * BLOCK + 1100;
        const a = createForestFloor(short, { cols: 69, offset }).pixels;
        const b = createForestFloor(long, { cols: 69, offset }).pixels;
        expect(b.subarray(0, a.length)).toEqual(a);
    });

    test('the log is near the top, where a first screen shows it', () => {
        [1, 7, 42, 2026, 99991].forEach((seed) => {
            const { log } = createStream({ cols: 69, rows: 400, seed });
            expect(log.start.y * BLOCK).toBeLessThanOrEqual(540);
        });
    });
});

describe('Both pages carry the landscape', () => {
    const read = (page) => readFileSync(resolve(__dirname, '../..', page), 'utf8');

    test.each(['index.html', 'entertainment/entertainment.html'])('%s', (page) => {
        const html = read(page);
        expect(html).toMatch(/<div id="landscape"[^>]*>\s*<canvas id="stream"><\/canvas>\s*<canvas id="forest"><\/canvas>/);
        // Render-blocking, so the landscape is drawn before a view transition captures it.
        expect(html).toContain('<script type="module" blocking="render" src="/PortfolioWebPage/scripts/stream.js');
    });
});
