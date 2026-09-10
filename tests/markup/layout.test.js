import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

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
