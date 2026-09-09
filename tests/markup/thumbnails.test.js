import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
    TETRIS_COLORS,
    BOARD_COLORS,
    SNAKE_COLORS,
    SNAKE_GRADIENTS,
    MINE_COLORS,
    MINE_GRADIENTS,
    MINE_NUMBER_TIERS,
    SEQUENCE_COLORS,
    SEQUENCE_PADS,
    TOY_COLORS,
    toHex,
} from '../../js/logic.js';

/* The hub thumbnails have to be drawn in the colours of the game they advertise.
 *
 * This is a real drift that shipped rather than a hypothetical one. The Tetris and
 * Snake tiles were written before either game's palette was rewritten for colour
 * blindness, and nothing tied the two together - so the hub went on advertising
 * Falling Polyominos in a red (#b33939) that by then existed nowhere else on the
 * site, and Snake in the old olive. Nobody noticed until the cards were looked at
 * beside the boards.
 *
 * A thumbnail is decorative, so it is exempt from the contrast rules - nothing is
 * read against it. It is not exempt from being honest about what the game looks like,
 * which is all this checks: every colour in a tile has to come from that game's
 * palette. Rearranging the cells is free; inventing a colour is not.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const css = readFileSync(resolve(root, 'style.css'), 'utf8');

const normalise = (value) => toHex(value.trim().toLowerCase());
const paletteOf = (...groups) => new Set(groups.flat().map(normalise));

/* The toy's grid is styled in the stylesheet rather than from a palette module - it
   is the only board whose own cells never had colour rules to answer to, being a
   blank canvas. Its two surface colours are named here so the paints can still be
   checked against TOY_COLORS, which is the part that matters. */
const TOY_SURFACES = ['#a2a77f', '#dfe38c'];

const PALETTES = {
    tetris: paletteOf(Object.values(TETRIS_COLORS), Object.values(BOARD_COLORS)),
    snake: paletteOf(Object.values(SNAKE_COLORS), Object.values(SNAKE_GRADIENTS).flat()),
    mines: paletteOf(
        Object.values(MINE_COLORS),
        Object.values(MINE_GRADIENTS).flat(),
        MINE_NUMBER_TIERS.map((tier) => tier.color),
    ),
    sequence: paletteOf(
        Object.values(SEQUENCE_COLORS),
        SEQUENCE_PADS.map((pad) => pad.face),
        SEQUENCE_PADS.map((pad) => pad.lit),
    ),
    toy: paletteOf(TOY_COLORS.map((paint) => paint.value), TOY_SURFACES),
};

// Every background declared by a .thumb-<name> rule, whatever selector carries it.
function backgroundsFor(name) {
    const pattern = new RegExp(`\\.thumb-${name}\\b[^{}]*\\{([^}]*)\\}`, 'g');
    return [...css.matchAll(pattern)]
        .flatMap((rule) => [...rule[1].matchAll(/background(?:-color)?:\s*([^;]+);/g)])
        .map((match) => normalise(match[1]));
}

describe.each(Object.keys(PALETTES))('The %s thumbnail', (name) => {
    test('is drawn in colours that game actually uses', () => {
        const used = backgroundsFor(name);
        expect(used.length).toBeGreaterThan(0); // a renamed class would otherwise pass silently
        expect(used.filter((color) => !PALETTES[name].has(color))).toEqual([]);
    });
});

/* Sequence's board is two by two, not four by four like every other tile. The shared
   markup gives all five cards sixteen cells, so its extra twelve are dropped in CSS -
   and if that rule goes, twelve stray cells appear rather than anything failing
   loudly. */
describe('The sequence thumbnail', () => {
    const rules = css.slice(css.indexOf('.thumb-sequence'));

    test('is reshaped to the two-by-two panel', () => {
        expect(rules).toMatch(/grid-template-columns:\s*repeat\(2, 1fr\)/);
        expect(rules).toMatch(/grid-template-rows:\s*repeat\(2, 1fr\)/);
    });

    test('drops the cells the shared markup has spare', () => {
        expect(rules).toMatch(/\.thumb-sequence span:nth-child\(n\+5\)\s*\{\s*display:\s*none/);
    });

    /* The point of the tile: pads to the edge, so the dark reads as housing between
       and around them rather than as empty cells on the board. */
    test('fills all four cells, leaving the panel showing only as the frame', () => {
        const pads = [1, 2, 3, 4].map((n) => {
            const match = rules.match(new RegExp(`\\.thumb-sequence span:nth-child\\(${n}\\)\\s*\\{[^}]*background:\\s*([^;]+);`));
            return match && normalise(match[1]);
        });
        expect(pads.filter(Boolean)).toHaveLength(4);
        expect(pads).not.toContain(normalise(SEQUENCE_COLORS.panel));
    });
});
