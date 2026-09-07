import { describe, test, expect } from 'vitest';
import {
    contrastRatio,
    simulateCVD,
    worstCaseContrast,
    worstCaseOverGradient,
    areDistinguishable,
    blueYellowAxis,
    MIN_AGAINST_BACKGROUND,
} from '../../js/contrast.js';
import { TETRIS_COLORS, BOARD_COLORS, SNAKE_COLORS, UI_COLORS, TOY_COLORS, toHex, MINE_COLORS, MINE_NUMBER_TIERS, MINE_GRADIENTS, numberColor } from '../../js/logic.js';

describe('Contrast maths', () => {
    test('black on white is the maximum 21:1', () => {
        expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    });

    test('a colour has no contrast with itself', () => {
        expect(contrastRatio('#a2a77f', '#a2a77f')).toBeCloseTo(1, 5);
    });

    test('the simulation collapses red and green toward each other', () => {
        // Pure red and pure green are far apart normally and much closer under
        // deuteranopia - if this ever stops holding, the simulation is broken.
        const before = Math.abs(blueYellowAxis('#ff0000') - blueYellowAxis('#00ff00'));
        const after = Math.abs(
            blueYellowAxis(simulateCVD('#ff0000', 'deuter')) -
            blueYellowAxis(simulateCVD('#00ff00', 'deuter'))
        );
        expect(after).toBeLessThan(before);
    });
});

describe('Tetris palette', () => {
    const pieces = Object.entries(TETRIS_COLORS);

    test.each(pieces)('%s piece is legible against the empty cell', (name, color) => {
        expect(worstCaseContrast(color, BOARD_COLORS.emptyCell))
            .toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
    });

    test('no two pieces are indistinguishable with red/green colour blindness', () => {
        const collisions = [];
        for (let i = 0; i < pieces.length; i++) {
            for (let j = i + 1; j < pieces.length; j++) {
                if (!areDistinguishable(pieces[i][1], pieces[j][1])) {
                    collisions.push(`${pieces[i][0]}/${pieces[j][0]}`);
                }
            }
        }
        expect(collisions).toEqual([]);
    });

    // Regression guard: the S piece was once set to the exact board background, and
    // the I piece sat at 1.07:1 against the empty cell - both effectively invisible.
    test('no piece matches a board surface', () => {
        Object.values(TETRIS_COLORS).forEach((color) => {
            expect(color).not.toBe(BOARD_COLORS.emptyCell);
            expect(color).not.toBe(BOARD_COLORS.gridLines);
        });
    });
});

describe('Snake palette', () => {
    // Snake clears its board to white before drawing.
    const BACKGROUND = '#ffffff';

    test.each(Object.entries(SNAKE_COLORS))('%s is legible on the board', (name, color) => {
        expect(worstCaseContrast(color, BACKGROUND))
            .toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
    });

    test('the food never blends into the snake', () => {
        expect(areDistinguishable(SNAKE_COLORS.food, SNAKE_COLORS.body)).toBe(true);
        expect(areDistinguishable(SNAKE_COLORS.food, SNAKE_COLORS.head)).toBe(true);
    });
});

describe('Layered snake colours', () => {
    // "Underneath" reads as lighter, but lighter on a white board means less contrast.
    // The body was darkened so there is room for a lighter under-colour that still
    // clears the floor - going the other way would have broken the rule.
    test('the underneath colour is genuinely lighter than the one on top', () => {
        expect(contrastRatio(SNAKE_COLORS.bodyUnder, '#ffffff'))
            .toBeLessThan(contrastRatio(SNAKE_COLORS.body, '#ffffff'));
    });

    test('over and under are still telling apart', () => {
        expect(areDistinguishable(SNAKE_COLORS.body, SNAKE_COLORS.bodyUnder)).toBe(true);
    });

    test('the underneath colour still clears the contrast floor', () => {
        expect(worstCaseContrast(SNAKE_COLORS.bodyUnder, '#ffffff'))
            .toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
    });
});

describe('UI chrome colours', () => {
    // A disabled control is still something a player has to read. This exists because
    // opacity: 0.5 shipped and took the labels to roughly 1.6:1.
    test('disabled control text is readable against its background', () => {
        expect(worstCaseContrast(UI_COLORS.disabledText, UI_COLORS.disabledBackground))
            .toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
    });

    test('dialog text is readable against the dialog', () => {
        expect(worstCaseContrast(UI_COLORS.dialogText, UI_COLORS.dialogBackground))
            .toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
    });
});

describe('Food on either layer', () => {
    test('food underneath is lighter than food on top', () => {
        expect(contrastRatio(SNAKE_COLORS.foodUnder, '#ffffff'))
            .toBeLessThan(contrastRatio(SNAKE_COLORS.food, '#ffffff'));
    });

    test('the two food colours are telling apart', () => {
        expect(areDistinguishable(SNAKE_COLORS.food, SNAKE_COLORS.foodUnder)).toBe(true);
    });

    // Food is the one thing on the board the player is hunting for, so the lighter
    // variant has to clear the floor and not collide with any snake colour.
    test('food underneath stays legible and unlike the snake', () => {
        expect(worstCaseContrast(SNAKE_COLORS.foodUnder, '#ffffff'))
            .toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
        ['head', 'body', 'bodyUnder', 'hole'].forEach((part) => {
            expect(areDistinguishable(SNAKE_COLORS.foodUnder, SNAKE_COLORS[part])).toBe(true);
        });
    });
});

describe('Array Grid toy palette', () => {
    const swatches = TOY_COLORS.map(({ label, value }) => [label, toHex(value)]);

    const collisions = () => {
        const found = [];
        for (let i = 0; i < swatches.length; i++) {
            for (let j = i + 1; j < swatches.length; j++) {
                if (!areDistinguishable(swatches[i][1], swatches[j][1])) {
                    found.push(`${swatches[i][0]}/${swatches[j][0]}`);
                }
            }
        }
        return found;
    };

    /* Red and Green are indistinguishable with red/green colour blindness and always
       have been - they predate the contrast rules and are left alone pending a call
       from the project owner, since changing them changes existing pictures.
       Pinning the list here means any NEW collision fails the suite instead of
       shipping quietly, which is how `brown` (#a52a2a) was caught: it simulates to
       #69681e against Green's #6a6a12. */
    test('no colour collides beyond the one known pair', () => {
        expect(collisions()).toEqual(['Red/Green']);
    });

    test('the brown that shipped is distinguishable from green', () => {
        const brown = TOY_COLORS.find((c) => c.label === 'Brown').value;
        const green = toHex(TOY_COLORS.find((c) => c.label === 'Green').value);
        expect(areDistinguishable(toHex(brown), green)).toBe(true);
    });

    test('blue is distinguishable from everything', () => {
        const blue = toHex('blue');
        swatches.filter(([label]) => label !== 'Blue').forEach(([, hex]) => {
            expect(areDistinguishable(blue, hex)).toBe(true);
        });
    });
});

describe('Minesweeper palette', () => {
    const { revealed, hidden, flag, mine, detonated, detonatedMine } = MINE_COLORS;

    test.each([
        ['a flag on unopened ground', flag, hidden],
        ['a mine on cleared ground', mine, revealed],
        ['the detonated mine on its own cell', detonatedMine, detonated],
    ])('%s is legible', (_label, color, background) => {
        expect(worstCaseContrast(color, background)).toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
    });

    test('every number tier is legible on cleared ground', () => {
        MINE_NUMBER_TIERS.forEach((tier) => {
            expect(worstCaseContrast(tier.color, revealed)).toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
        });
    });

    /* Three tiers, not the traditional eight colours: eight shades that all clear the
       floor on one light background and stay apart under both simulations do not
       exist. The digit carries the information; the tier conveys rising danger. */
    test('the tiers are telling apart from each other', () => {
        for (let i = 0; i < MINE_NUMBER_TIERS.length; i++) {
            for (let j = i + 1; j < MINE_NUMBER_TIERS.length; j++) {
                expect(areDistinguishable(MINE_NUMBER_TIERS[i].color, MINE_NUMBER_TIERS[j].color)).toBe(true);
            }
        }
    });

    test('opened and unopened ground are obviously different', () => {
        expect(worstCaseContrast(hidden, revealed)).toBeGreaterThan(4);
    });

    test('every count from 0 to 8 maps to a tier', () => {
        for (let count = 0; count <= 8; count++) {
            expect(numberColor(count)).toBeTruthy();
        }
        expect(numberColor(1)).toBe(numberColor(2));
        expect(numberColor(1)).not.toBe(numberColor(8));
    });
});

describe('Reading against a gradient', () => {
    /* Decorative gradients are exempt from the distinguishability rule - the point of
       one is the progression, and adjacent bands looking alike is the effect working.
       What is drawn ON a gradient is not exempt: the background under it changes, so
       it has to clear the floor at every stop, not just on average. */
    test('the flag is legible at both ends of the unopened-cell gradient', () => {
        expect(worstCaseOverGradient(MINE_COLORS.flag, MINE_GRADIENTS.hidden))
            .toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
    });

    test('every number tier is legible at both ends of the cleared-cell gradient', () => {
        MINE_NUMBER_TIERS.forEach((tier) => {
            expect(worstCaseOverGradient(tier.color, MINE_GRADIENTS.revealed))
                .toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
        });
    });

    test('the mine glyph is legible at both ends too', () => {
        expect(worstCaseOverGradient(MINE_COLORS.mine, MINE_GRADIENTS.revealed))
            .toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
    });

    // The helper has to take the worst stop, not the first or the average.
    test('the check reports the worst stop', () => {
        // Black is perfect on white and nearly invisible on dark grey.
        const stops = ['#ffffff', '#333333'];
        expect(worstCaseOverGradient('#000000', stops))
            .toBeCloseTo(worstCaseContrast('#000000', '#333333'), 5);
        expect(worstCaseOverGradient('#000000', stops))
            .toBeLessThan(worstCaseContrast('#000000', '#ffffff'));
    });
});
