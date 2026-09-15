import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
    BOARD_GAP_PX, BOARD_FRAME_PX, BOARD_HEIGHT_VH, CELL_FLOOR_PX, WHOLE_CELL_CAP_PX, ZOOM_CELL_CAP_PX,
} from '../../js/boardzoom.js';

/* The overflow rules, pinned.
 *
 * A board running off the right edge of a phone is not something any test here can
 * see - none of this runs in a browser, and there is no layout to measure. What can be
 * checked is that the specific mistakes behind it are not made again, because each one
 * is visible in the stylesheet as a shape:
 *
 *   - sizing a board by dividing up the viewport, when it lives in a narrower column;
 *   - centring content inside a scroll container with plain `center`, which puts half
 *     the overflow somewhere that cannot be scrolled to;
 *   - a `fit-content` box with nothing capping it, which pushes the page instead of
 *     scrolling itself;
 *   - a vw width with padding outside it, on a stylesheet that has no global
 *     border-box.
 *
 * All four shipped at once. These are cheap tests for expensive bugs.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const css = readFileSync(resolve(root, 'style.css'), 'utf8');

/* Comments are stripped first. These rules explain themselves at length, and several
   of the explanations quote the very value that was wrong - a check against the raw
   text would be reading the note about the bug as the bug itself. */
const withoutComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');
const declarations = withoutComments(css);

const ruleFor = (selector) => {
    const match = declarations.match(new RegExp(`(^|\\})\\s*${selector}\\s*\\{([^}]*)\\}`, 'm'));
    return match ? match[2] : null;
};

describe('Boards are measured against the column they sit in', () => {
    test('the column is exposed to them as --board-space', () => {
        expect(ruleFor('\\.game-view')).toMatch(/--board-space:/);
    });

    /* Container units measure the container, which is the question being asked. The
       vw fallback has to come first, and has to be its own declaration - a browser
       without container units accepts 100cqw inside a custom property and only fails
       where it is used, which would collapse the board's grid entirely. */
    test('container units are used, behind a feature query, with a vw fallback first', () => {
        const fallback = css.indexOf('--board-space: calc(100vw');
        const supports = css.indexOf('@supports (container-type: inline-size)');
        expect(fallback).toBeGreaterThan(-1);
        expect(supports).toBeGreaterThan(fallback);
        expect(css).toMatch(/@supports \(container-type: inline-size\)[^}]*\{[\s\S]*?--board-space: 100cqw/);
    });

    /* The containment goes on the views, never the wrapper: contain: layout makes an
       element the containing block for fixed-position descendants, and the end-of-game
       dialog inside the wrapper is fixed for a reason worth keeping. */
    test('containment is scoped to the views, not the wrapper around the dialog', () => {
        const contained = css.match(/@supports \(container-type: inline-size\)\s*\{\s*([^{]+)\{/);
        expect(contained[1].trim()).toBe('.game-view');
    });

    test.each([
        ['--snake-cell', '--snake-cols'],
        ['--mine-fit', '--mine-cols'],
        ['--tetris-cell', null],
        ['--pad-size', null],
    ])('%s divides the column rather than the viewport', (name) => {
        const declaration = declarations.match(new RegExp(`${name}:[^;]*;`, 's'))[0];
        expect(declaration).toContain('var(--board-space)');
        expect(declaration).not.toContain('100vw');
    });

    /* The gaps and the frame come out before the division, not after. Budgeting for
       cells alone and then adding 33px of gaps is what pushed the Infinity board off
       the edge; Minesweeper's 20x20 board taught it first. */
    test.each([
        ['--snake-cell', '--snake-cols'],
        ['--mine-fit', '--mine-cols'],
    ])('%s subtracts its gaps before dividing', (name, cols) => {
        const declaration = declarations.match(new RegExp(`${name}:[^;]*;`, 's'))[0];
        expect(declaration).toMatch(new RegExp(`\\(var\\(${cols}\\) - 1\\)`));
    });
});

/* js/boardzoom.js predicts the Minesweeper cell size so the phone pass mark can be
   tested without a browser. A prediction is only worth anything while it matches what
   the stylesheet does, so the numbers are held against each other here. */
describe('The zoom maths and the stylesheet agree on cell size', () => {
    const fit = declarations.match(/--mine-fit:[^;]*;/s)[0];

    test('the floor, the whole-board cap, the gaps and the height budget', () => {
        expect(fit).toContain(`max(${CELL_FLOOR_PX}px,`);
        expect(fit).toContain(`var(--mine-cap, ${WHOLE_CELL_CAP_PX}px)`);
        expect(fit).toContain(`* ${BOARD_GAP_PX}px - ${BOARD_FRAME_PX}px)`);
        expect(fit).toContain(`calc((${BOARD_HEIGHT_VH}vh - (var(--mine-rows) - 1) * ${BOARD_GAP_PX}px)`);
    });

    test('the gap and the frame the board is drawn with', () => {
        const board = ruleFor('#mineDisplay');
        expect(board).toContain(`gap: ${BOARD_GAP_PX}px;`);
        expect(board).toContain('padding: 6px;');
        expect(board).toContain('border: 2px solid');
        expect(BOARD_FRAME_PX).toBe(2 * 6 + 2 * 2);
    });

    test('a zoomed window lifts the cap', () => {
        expect(ruleFor('#mineDisplay\\.is-zoomed')).toContain(`--mine-cap: ${ZOOM_CELL_CAP_PX}px;`);
    });
});

/* A zoomed board is dragged, so it has to stop the page scrolling under the finger. The
   whole board is only ever tapped, and taking scrolling away there would trap a phone's
   page behind it. */
describe('Only a zoomed board takes over dragging', () => {
    test('touch-action: none while zoomed, on the board and on the cells', () => {
        expect(ruleFor('#mineDisplay\\.is-zoomed')).toContain('touch-action: none');
        expect(ruleFor('#mineDisplay\\.is-zoomed \\.mine-cell')).toContain('touch-action: none');
    });

    test('the whole board still lets the page scroll', () => {
        expect(ruleFor('#mineDisplay')).toContain('touch-action: manipulation');
    });
});

/* The rounding block was once pasted into the middle of the .mine-cell.is-revealed rule.
   Nothing broke visibly and no test failed: under CSS nesting it became a rule for
   `.mine-cell.is-revealed #mineDisplay`, which matches nothing, so the rounding simply
   stopped. Nesting depth is the shape that mistake leaves behind. */
describe('Whole-pixel rounding', () => {
    const at = declarations.indexOf('@supports (width: round(');

    test('the feature query sits at the top level, not inside another rule', () => {
        expect(at).toBeGreaterThan(-1);
        const before = declarations.slice(0, at);
        const depth = (before.match(/\{/g) || []).length - (before.match(/\}/g) || []).length;
        expect(depth).toBe(0);
    });

    test('it rounds the board cell down', () => {
        expect(declarations.slice(at)).toMatch(
            /^@supports \(width: round\(down, 1\.5px, 1px\)\)\s*\{\s*#mineDisplay\s*\{\s*--mine-cell: round\(down, var\(--mine-fit\), 1px\);/,
        );
    });
});

describe('Overflow has somewhere to go', () => {
    /* Plain `center` in a scroll container overflows both ways and scrollLeft stops at
       zero, so the first columns become unreachable. `safe` falls back to start when
       it overflows. The unprefixed value stays as the fallback for older browsers. */
    test('the scroll container centres safely', () => {
        const rule = ruleFor('\\.butMania');
        expect(rule).toMatch(/justify-content: center;/);
        expect(rule).toMatch(/justify-content: safe center;/);
        expect(rule.indexOf('safe center')).toBeGreaterThan(rule.indexOf('justify-content: center;'));
    });

    test.each(['\\.butMania\\.is-snake', '#tetrisDisplay'])(
        '%s caps its fit-content width so it scrolls instead of pushing the page',
        (selector) => {
            const rule = ruleFor(selector);
            expect(rule).toContain('width: fit-content');
            expect(rule).toContain('max-width: 100%');
        },
    );

    /* This stylesheet sets border-box on individual rules rather than globally, so any
       element mixing a relative width with its own padding has to say so itself. The
       Sequence panel did not, and its real footprint was 92vw + 42px. */
    test('the Sequence panel counts its own padding', () => {
        const rule = ruleFor('\\.sequence-panel');
        expect(rule).toContain('box-sizing: border-box');
        expect(rule).toMatch(/width: min\(100%/);
        expect(rule).not.toContain('92vw');
    });
});

/* Anything that shows and hides by the hidden attribute has to keep its display rule
   behind :not([hidden]). An id selector beats [hidden] on specificity, so a plain
   `#thing { display: block }` makes the attribute do nothing and the element never
   hides. This has been hit twice in this stylesheet - the game views and the
   end-of-game dialog - and a third time by a review button that has since been
   removed, which is enough to pin it. */
describe('Things that hide stay hideable', () => {
    /* The views are the case that does not appear here, and deliberately: they set no
       display of their own, so the attribute already works and there is nothing to
       guard. The rule is only needed once something wants a display value back. */
    test('the game views set no display of their own', () => {
        expect(declarations).not.toMatch(/(^|\})\s*\.game-view\s*\{[^}]*display:/m);
    });

    test.each(['#game-over', '#game-over-mode', '#mine-zoom'])(
        '%s gives itself display only when not hidden',
        (selector) => {
            const escaped = selector.replace(/[.#]/g, (char) => '\\' + char);
            const guarded = new RegExp(escaped + ':not\\(\\[hidden\\]\\)\\s*\\{[^}]*display:');
            const bare = new RegExp('(^|\\})\\s*' + escaped + '\\s*\\{[^}]*display:', 'm');
            expect(declarations).toMatch(guarded);
            expect(declarations).not.toMatch(bare);
        },
    );
});

/* The end-of-game dialog reads top to bottom as the order of the decisions it offers:
   what happened, then what the next game should be, then start it, then leave.

   Reviewing the finished board is deliberately not among them. It was, briefly, and the
   arrangement never sat right - because a button whose only job is to dismiss the thing
   in the way is a sign the thing should not have been in the way. Minesweeper reports
   its result above its own board instead and never opens this dialog at all. */
describe('The end-of-game dialog offers its choices in order', () => {
    const panel = readFileSync(resolve(root, 'entertainment/entertainment.html'), 'utf8')
        .match(/<div id="game-over-panel"[\s\S]*?\n {12}<\/div>/)[0];

    test('message, config, new game, back', () => {
        // The panel's own id, and the two inside the mode block, are not the sequence.
        const inner = ['game-over-panel', 'game-over-mode-select', 'game-over-mode-label'];
        const order = [...panel.matchAll(/\sid="([^"]+)"/g)]
            .map((match) => match[1])
            .filter((id) => !inner.includes(id));

        expect(order).toEqual([
            'game-over-message',
            'game-over-score',
            'game-over-mode',
            'play-again',
            'game-over-back',
        ]);
    });
});

/* Minesweeper ends in place: its result goes into its own status line and the dialog
   never opens. The dialog covers the board, and for this one game the board is the
   record of what went wrong - which is the whole reason a player wants to look at it.
   Everything the dialog offers is already above the board in this game's controls. */
describe('Minesweeper ends in place', () => {
    const script = readFileSync(resolve(root, 'entertainment/entertainment.js'), 'utf8');
    const withoutJsComments = script
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

    test('the minesweeper layer never opens the end-of-game dialog', () => {
        const mineSection = withoutJsComments.slice(withoutJsComments.indexOf('PART 4'), withoutJsComments.indexOf('PART 5'));
        expect(mineSection).not.toContain('showGameOver');
    });

    test('the other games still use it', () => {
        expect(withoutJsComments.match(/showGameOver\(/g).length).toBeGreaterThan(3);
    });

    /* The result has to look like a result rather than the hint line it replaces, and
       it takes the control theme's colours - which are contrast-checked - rather than
       inventing a win-green and a lose-red. The outcome is in the words. */
    test('the result is styled as a banner in the theme colours', () => {
        const rule = ruleFor('#mine-status\.is-result');
        expect(rule).toContain('var(--control-surface)');
        expect(rule).toContain('var(--control-text)');
        expect(rule).toMatch(/font-weight:\s*bold/);
    });
});
