import { describe, test, expect } from 'vitest';
import {
    SHAPES, SHAPE_BOARDS, MAX_SHAPE_SIZE, parseShape, shapeDensity, articleFor, openingSquares,
} from '../../js/mineshapes.js';
import { createShapeGame, safeCellCount, hasProvenMine, STATUS } from '../../js/minesweeper.js';
import { findSafeSquare } from '../../js/minesolver.js';

// A seeded random source, so every run deals the same boards.
function seeded(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/* Every shape is checked the same way, so a new drawing is tested the moment it is added:
   well formed, small enough for the zoom, and always dealing a game the player can reason
   onwards from. Shapes need not be one piece or wide: the project owner's heart is a
   one-square outline with a lone square in each corner. */
describe.each(SHAPES.map((raw) => [raw.name, raw]))('The %s shape', (_name, raw) => {
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

    /* The promise of the mode: wherever the mines fall, the game opens itself somewhere
       the player can reason onwards from - a proven safe square to open or a proven mine
       to flag - on at least nine squares where the shape has room for that, and on more
       than one where it does not. */
    test('every deal opens as wide as the shape allows, with a provable move after', () => {
        const random = seeded(1);
        const smallest = openingSquares(shape).length ? 9 : 2;
        for (let deal = 0; deal < 20; deal++) {
            const game = createShapeGame(shape, random);
            expect(game.status).toBe(STATUS.PLAYING);
            expect(game.mines.size).toBe(shape.mineCount);
            expect(game.revealed.size).toBeGreaterThanOrEqual(smallest);
            [...game.revealed].forEach((key) => expect(game.mines.has(key)).toBe(false));
            const cleared = game.revealed.size === safeCellCount(game);
            expect(cleared || findSafeSquare(game).result === 'safe' || hasProvenMine(game)).toBe(true);
        }
    });
});

describe('Shape rules', () => {
    test('there is at least one shape to deal', () => {
        expect(SHAPE_BOARDS.length).toBeGreaterThan(0);
    });

    test('names are unique', () => {
        expect(new Set(SHAPES.map((shape) => shape.name)).size).toBe(SHAPES.length);
    });

    test('density climbs with area, like the rectangular boards', () => {
        expect(shapeDensity(100)).toBe(0.12);
        expect(shapeDensity(400)).toBe(0.15);
        expect(shapeDensity(1600)).toBe(0.18);
    });

    test('the mine count follows the area', () => {
        const block = parseShape({ name: 'block', rows: Array(10).fill('#'.repeat(10)) });
        expect(block.area).toBe(100);
        expect(block.mineCount).toBe(12);
    });

    test('names take the right article, and can be told otherwise', () => {
        expect(articleFor('heart')).toBe('a');
        expect(articleFor('owl')).toBe('an');
        expect(parseShape({ name: 'unicorn', article: 'a', rows: ['#'] }).article).toBe('a');
    });});
