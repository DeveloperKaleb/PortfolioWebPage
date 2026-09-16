import { describe, test, expect } from 'vitest';
import { SHAPES, SHAPE_BOARDS, MAX_SHAPE_SIZE, parseShape, articleFor, fingerprintRows } from '../../js/mineshapes.js';
import { MINE_OPENINGS } from '../../js/mineopenings.js';
import { createShapeGame, openShapeAt, solvesWithoutGuessing, isMine, countAt, STATUS } from '../../js/minesweeper.js';
import { profileShape } from '../../tools/mine-difficulty.mjs';

// A seeded random source, so every run checks the same openings.
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
   be playable to the end by reasoning alone from where it opens.

   The openings are worked out by tools/mine-openings.mjs and stored, and the tool proves
   every one of them when it writes them. Here they are spot-checked rather than all solved
   again - the project owner's call, so the tests stay fast as pictures are added: the
   fingerprint catches stale data, every opening is checked to be a real one, and three per
   picture are solved in full. */
describe.each(SHAPE_BOARDS.map((shape) => [shape.name, shape]))('The %s picture', (name, shape) => {
    const raw = SHAPES.find((picture) => picture.name === name);

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

    test('its stored openings were worked out from these rows', () => {
        expect(MINE_OPENINGS[name]?.fingerprint, 'stored openings are out of date - run npm run openings').toBe(fingerprintRows(raw.rows));
    });

    test('has at least one opening that solves it without guessing', () => {
        expect(shape.openings.length, 'no opening solves this picture without guessing - it needs reworking').toBeGreaterThan(0);
    });

    test('every stored opening is a square with no mine on or around it, opening nine or more', () => {
        shape.openings.forEach(([x, y]) => {
            const opened = openShapeAt(shape, { x, y });
            expect(isMine(opened, x, y)).toBe(false);
            expect(countAt(opened, x, y)).toBe(0);
            expect(opened.revealed.size).toBeGreaterThanOrEqual(9);
        });
    });

    test('three stored openings, chosen at random, solve without a single guess', () => {
        const random = seeded(1);
        for (let check = 0; check < Math.min(3, shape.openings.length); check++) {
            const [x, y] = shape.openings[Math.floor(random() * shape.openings.length)];
            expect(solvesWithoutGuessing(openShapeAt(shape, { x, y })), `opening at (${x},${y})`).toBe(true);
        }
    });

    /* The difficulty profile is measured once by the tool and stored - it says which
       techniques the picture forces, for choosing and checking pictures, never for the
       player. A small picture is cheap to re-measure, so its stored numbers are held to a
       fresh run; a big one would slow every test run down for little. */
    test('its difficulty profile is stored', () => {
        const profile = shape.difficulty;
        expect(profile, 'no stored difficulty - run npm run openings').toBeTruthy();
        [profile.simpleRounds, profile.pair, profile.count, profile.deeper].forEach((value) => {
            expect(Number.isInteger(value) && value >= 0).toBe(true);
        });
        expect(profile.sampled).toBeGreaterThan(0);
    });

    test('a small picture\'s stored profile still matches a fresh measurement', () => {
        if (shape.openings.length > 4) return;
        const fresh = profileShape(shape, { sample: shape.openings.length });
        expect({ pair: fresh.pair, count: fresh.count, deeper: fresh.deeper })
            .toEqual({ pair: shape.difficulty.pair, count: shape.difficulty.count, deeper: shape.difficulty.deeper });
    });

    test('every game lays exactly the picture and opens on a stored opening', () => {
        const random = seeded(2);
        for (let played = 0; played < 20; played++) {
            const opened = createShapeGame(shape, random);
            expect(opened.status).toBe(STATUS.PLAYING);
            expect([...opened.mines].sort()).toEqual([...shape.mines].sort());
            expect(shape.openings.some(([x, y]) => opened.revealed.has(`${x},${y}`))).toBe(true);
            expect(opened.revealed.size).toBeGreaterThanOrEqual(9);
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

    test('every stored set of openings belongs to a picture', () => {
        Object.keys(MINE_OPENINGS).forEach((name) => expect(SHAPES.some((shape) => shape.name === name)).toBe(true));
    });

    test('black squares are mines, white squares are not', () => {
        const picture = parseShape({ name: 'dots', rows: ['#..', '...', '..#'] });
        expect([...picture.mines].sort()).toEqual(['1,1', '3,3']);
        expect(picture.mineCount).toBe(2);
        expect([picture.width, picture.height]).toEqual([3, 3]);
    });

    test('a fingerprint is stable, and changes when any square does', () => {
        expect(fingerprintRows(['#.', '..'])).toBe(fingerprintRows(['#.', '..']));
        expect(fingerprintRows(['#.', '..'])).not.toBe(fingerprintRows(['.#', '..']));
        expect(fingerprintRows(['#.', '..'])).toMatch(/^[0-9a-f]{8}$/);
    });

    test('names take the right article, and can be told otherwise', () => {
        expect(articleFor('heart')).toBe('a');
        expect(articleFor('owl')).toBe('an');
        expect(parseShape({ name: 'unicorn', article: 'a', rows: ['#.'] }).article).toBe('a');
    });
});
