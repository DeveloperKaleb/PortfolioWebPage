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
import { TETRIS_COLORS, BOARD_COLORS, SNAKE_COLORS, SNAKE_GRADIENTS, UI_COLORS, TOY_COLORS, toHex, MINE_COLORS, MINE_NUMBER_TIERS, MINE_GRADIENTS, numberColor, SEQUENCE_COLORS, SEQUENCE_PADS, CONTROL_THEMES, TETRIS_CONTROL_ACCENTS } from '../../js/logic.js';

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
    /* Open ground is lichen, not white. The board's own surfaces - the ground itself and
       the blocked cells drawn on top of it - are not measured against it: one IS the
       background, and nothing is ever drawn on the other. */
    const GROUND = SNAKE_COLORS.ground;
    const drawnOnGround = Object.entries(SNAKE_COLORS)
        .filter(([name]) => name !== 'ground' && name !== 'hole');

    test.each(drawnOnGround)('%s is legible on the ground', (_name, color) => {
        expect(worstCaseContrast(color, GROUND)).toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
    });

    test('the food never blends into the snake', () => {
        expect(areDistinguishable(SNAKE_COLORS.food, SNAKE_COLORS.body)).toBe(true);
        expect(areDistinguishable(SNAKE_COLORS.food, SNAKE_COLORS.head)).toBe(true);
    });

    // Where you can go and where you cannot has to be obvious at a glance.
    test('blocked ground is obviously not open ground, at both gradient stops', () => {
        expect(worstCaseOverGradient(GROUND, SNAKE_GRADIENTS.blocked)).toBeGreaterThan(4);
    });

    /* The whole ladder was darkened when the ground stopped being white. The old
       colours sat on the 4.5:1 floor against white, so any tint at all pushed both
       "underneath" variants under it - lighter-means-underneath fights a light
       background, and the room has to come from darkening what sits on top. */
    test('the underneath variants clear the floor on a tinted ground', () => {
        expect(worstCaseContrast(SNAKE_COLORS.bodyUnder, GROUND)).toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
        expect(worstCaseContrast(SNAKE_COLORS.foodUnder, GROUND)).toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
    });

    test('and are still lighter than what sits on top', () => {
        expect(contrastRatio(SNAKE_COLORS.bodyUnder, GROUND))
            .toBeLessThan(contrastRatio(SNAKE_COLORS.body, GROUND));
        expect(contrastRatio(SNAKE_COLORS.foodUnder, GROUND))
            .toBeLessThan(contrastRatio(SNAKE_COLORS.food, GROUND));
    });

    test('no two things drawn on the ground collide', () => {
        const collisions = [];
        for (let i = 0; i < drawnOnGround.length; i++) {
            for (let j = i + 1; j < drawnOnGround.length; j++) {
                if (!areDistinguishable(drawnOnGround[i][1], drawnOnGround[j][1])) {
                    collisions.push(`${drawnOnGround[i][0]}/${drawnOnGround[j][0]}`);
                }
            }
        }
        expect(collisions).toEqual([]);
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

describe('Food against the ground it lies on', () => {
    // Food is the one thing on the board the player is hunting for, so it must not be
    // mistakable for the snake or for ground it cannot enter.
    /* The food is a blue and blocked ground is a green of almost the same lightness -
       1.04:1 between them. They are told apart on the blue-yellow axis instead, which is
       the axis that survives both kinds of colour blindness, so this asks for
       distinguishability rather than for a lightness gap. What actually keeps the food
       findable is its contrast against the pale ground it sits on, which is tested
       above. */
    test('neither food colour can be mistaken for blocked ground', () => {
        [SNAKE_COLORS.food, SNAKE_COLORS.foodUnder].forEach((colour) => {
            expect(areDistinguishable(colour, SNAKE_COLORS.hole)).toBe(true);
            SNAKE_GRADIENTS.blocked.forEach((stop) => {
                expect(areDistinguishable(colour, stop)).toBe(true);
            });
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

describe('Sequence palette', () => {
    const { panel } = SEQUENCE_COLORS;

    test.each(SEQUENCE_PADS)('the $name pad face is legible on the panel', ({ face }) => {
        expect(worstCaseContrast(face, panel)).toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
    });

    test.each(SEQUENCE_PADS)('the $name pad stays legible while lit', ({ lit }) => {
        expect(worstCaseContrast(lit, panel)).toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
    });

    /* The flash is the game's whole output channel, so it has to be a lightness jump
       rather than a hue shift. A pad whose face already sat near white had nowhere
       brighter to go and its flash vanished under simulation - which is why the faces
       are pitched down the range rather than at the top of it. */
    test.each(SEQUENCE_PADS)('the $name pad lighting up is visible as a change', ({ face, lit }) => {
        expect(areDistinguishable(face, lit)).toBe(true);
    });

    /* Pads are told apart by position first, but a run recalled by colour must not
       turn on hue alone. Six was the ceiling here: a seventh could not be placed
       without colliding, the same wall the Tetris palette hit at seven pieces. */
    test('no two pads are indistinguishable with red/green colour blindness', () => {
        const collisions = [];
        for (let i = 0; i < SEQUENCE_PADS.length; i++) {
            for (let j = i + 1; j < SEQUENCE_PADS.length; j++) {
                if (!areDistinguishable(SEQUENCE_PADS[i].face, SEQUENCE_PADS[j].face)) {
                    collisions.push(`${SEQUENCE_PADS[i].name}/${SEQUENCE_PADS[j].name}`);
                }
            }
        }
        expect(collisions).toEqual([]);
    });

    /* The four-pad game takes the first four of the list, so that subset has to hold
       up on its own - it is the game most people will play. */
    test('the four-pad subset is spread across the blue-yellow axis', () => {
        const axes = SEQUENCE_PADS.slice(0, 4).map((pad) => blueYellowAxis(pad.face));
        expect(Math.max(...axes) - Math.min(...axes)).toBeGreaterThan(40);
    });

    test('the readout is legible on the panel', () => {
        expect(worstCaseContrast(SEQUENCE_COLORS.readout, panel))
            .toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
    });
});

describe('Control bar themes', () => {
    const themes = Object.entries(CONTROL_THEMES);

    /* The page column the controls sit on. Every game's readout is measured against
       this one background, because the control bar is on the page, not on the board. */
    const PAGE = BOARD_COLORS.emptyCell;

    test.each(themes)('%s: the control label is legible on the control', (_name, theme) => {
        expect(worstCaseContrast(theme.text, theme.surface))
            .toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
    });

    test.each(themes)('%s: the readout is legible on the page', (_name, theme) => {
        expect(worstCaseContrast(theme.readout, PAGE))
            .toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
    });

    /* A toggle that is on has to be readable in that state too. Flag mode and the
       sound switch are both modes, not momentary presses - if the "on" look cost the
       label its contrast, the control would be least readable exactly when it matters. */
    test.each(themes)('%s: a switched-on toggle stays readable', (_name, theme) => {
        expect(worstCaseContrast(theme.activeText, theme.activeSurface))
            .toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
    });

    /* The border is an edge rather than something read, so it is not held to the text
       floor - but a control with no visible boundary on its own surface is a control
       you cannot see the shape of. 3:1 is the WCAG threshold for a graphic. */
    test.each(themes)('%s: the control has a visible edge', (_name, theme) => {
        expect(worstCaseContrast(theme.border, theme.surface)).toBeGreaterThanOrEqual(3);
    });

    /* On is a different state, not a brighter version of off. Distinguishable rather
       than merely different, so it survives both simulations. */
    test.each(themes)('%s: on and off are tellable apart', (_name, theme) => {
        expect(areDistinguishable(theme.activeSurface, theme.surface)).toBe(true);
    });

    /* The Tetris controls borrow the piece colours as accents. They are already proved
       pairwise distinguishable as pieces; what has to hold here is that each one is
       legible as an edge on the control surface it is drawn against. */
    test.each(TETRIS_CONTROL_ACCENTS)('the %s accent is visible on the Tetris control', (accent) => {
        expect(worstCaseContrast(accent, CONTROL_THEMES.tetris.surface)).toBeGreaterThanOrEqual(3);
    });

    test('Snake and Minesweeper share one theme rather than two copies of it', () => {
        expect(CONTROL_THEMES.snake).toBe(CONTROL_THEMES.minesweeper);
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
