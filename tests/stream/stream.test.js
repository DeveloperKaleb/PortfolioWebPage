import { describe, test, expect } from 'vitest';
import { createStream, renderFrame, TERRAIN, MIN_COLS } from '../../js/stream.js';

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

    test('reuses a buffer it is handed', () => {
        const buffer = new Uint8ClampedArray(40 * 160 * 4);
        expect(renderFrame(stream, 1, buffer)).toBe(buffer);
    });
});

test('refuses a margin too narrow for a stream', () => {
    expect(() => createStream({ cols: MIN_COLS - 1, rows: 100 })).toThrow(RangeError);
});
