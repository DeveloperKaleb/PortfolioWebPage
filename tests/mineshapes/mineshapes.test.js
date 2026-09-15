import { describe, test, expect } from 'vitest';
import { SHAPES, SHAPE_BOARDS, MAX_SHAPE_SIZE, parseShape, articleFor } from '../../js/mineshapes.js';
import { createShapeGame, solvableStarts, solvesWithoutGuessing, STATUS } from '../../js/minesweeper.js';

// A seeded random source, so every run opens the same starts.
function seeded(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/* Every picture the project owner draws is checked here the moment it is added. The one
   that matters is solvability: a forced guess on a picture board loses, so a picture has to
   be playable to the end by reasoning alone from where it opens. One that is not is sent
   back to be reworked - the test failing is the signal, by design. */
describe.each(SHAPES.map((raw) => [raw.name, raw]))('The %s picture', (_name, raw) => {
    const shape = parseShape(raw);

    test('is drawn in # and . only, every row the same length', () => {
        raw.rows.forEach((row) => {
            expect(row).toMatch(/^[#.]+$/);
            expect(row.length).toBe(raw.rows[0].length);
        });
    });

    test('fits the largest board the zoom is built for', () => {
        expect(shape.width).toBeLessThanOrEqual(MAX_SHAPE_SIZE);
        expect(shape.height).toBeLessThanOrEqual(MAX_SHAPE_SIZE);
    });

    test('has mines to find and safe squares to clear', () => {
        expect(shape.mineCount).toBeGreaterThan(0);
        expect(shape.mineCount).toBeLessThan(shape.width * shape.height);
    });

    test('can be solved without a single guess from at least one opening', () => {
        expect(solvableStarts(shape).length, 'no opening of nine or more squares solves this picture without guessing - it needs reworking').toBeGreaterThan(0);
    });

    test('every game lays exactly the picture and opens somewhere it solves from', () => {
        const random = seeded(1);
        for (let played = 0; played < 20; played++) {
            const opened = createShapeGame(shape, random);
            expect(opened.status).toBe(STATUS.PLAYING);
            expect([...opened.mines].sort()).toEqual([...shape.mines].sort());
            expect(opened.revealed.size).toBeGreaterThanOrEqual(9);
            expect(solvesWithoutGuessing(opened)).toBe(true);
        }
    });
});

describe('Picture rules', () => {
    test('there is at least one picture', () => {
        expect(SHAPE_BOARDS.length).toBeGreaterThan(0);
    });

    test('names are unique', () => {
        expect(new Set(SHAPES.map((shape) => shape.name)).size).toBe(SHAPES.length);
    });

    test('black squares are mines, white squares are not', () => {
        const picture = parseShape({ name: 'dots', rows: ['#..', '...', '..#'] });
        expect([...picture.mines].sort()).toEqual(['1,1', '3,3']);
        expect(picture.mineCount).toBe(2);
        expect([picture.width, picture.height]).toEqual([3, 3]);
    });

    test('names take the right article, and can be told otherwise', () => {
        expect(articleFor('heart')).toBe('a');
        expect(articleFor('owl')).toBe('an');
        expect(parseShape({ name: 'unicorn', article: 'a', rows: ['#.'] }).article).toBe('a');
    });
});
