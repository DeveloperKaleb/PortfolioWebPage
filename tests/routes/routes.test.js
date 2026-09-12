import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ROUTES, DASHBOARD, routeFor, parentOf, backTitleFor } from '../../js/routes.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = readFileSync(resolve(root, 'entertainment/entertainment.html'), 'utf8');

describe('Routes', () => {
    test('an empty or unknown hash is the dashboard', () => {
        ['', '#', '#no-such-thing', undefined].forEach((hash) => {
            expect(routeFor(hash).key).toBe(DASHBOARD);
        });
    });

    test('the leading # is optional', () => {
        expect(routeFor('#tetris').key).toBe('tetris');
        expect(routeFor('tetris').key).toBe('tetris');
    });

    // Links from before the dashboard existed have to keep landing on their games.
    test.each(['tetris', 'snake', 'minesweeper', 'sequence', 'tictactoe', 'toy'])(
        'the existing link #%s still works',
        (key) => {
            expect(routeFor(`#${key}`).key).toBe(key);
        },
    );

    test.each([
        ['tetris', 'single'],
        ['snake', 'single'],
        ['minesweeper', 'single'],
        ['sequence', 'single'],
        ['tictactoe', 'single'],
        ['tictactoe-pass', 'multi'],
        ['toy', 'toys'],
        ['pets', 'toys'],
        ['toys', DASHBOARD],
        ['single', DASHBOARD],
        ['multi', DASHBOARD],
        [DASHBOARD, DASHBOARD],
    ])('Back from "%s" goes to "%s"', (from, to) => {
        expect(parentOf(from)).toBe(to);
    });

    test('every parent is a route, and pressing Back enough always reaches the dashboard', () => {
        Object.keys(ROUTES).forEach((key) => {
            let at = key;
            for (let step = 0; step < 10 && at !== DASHBOARD; step++) {
                expect(Object.keys(ROUTES)).toContain(parentOf(at));
                at = parentOf(at);
            }
            expect(at).toBe(DASHBOARD);
        });
    });

    test('Back names where it goes', () => {
        expect(backTitleFor('tetris')).toBe('Single Player');
        expect(backTitleFor('tictactoe-pass')).toBe('Multiplayer');
        expect(backTitleFor('toy')).toBe('Toys');
        expect(backTitleFor('pets')).toBe('Toys');
    });

    test('pass the phone is the Tic-Tac-Toe view, for two', () => {
        expect(routeFor('tictactoe-pass').view).toBe(routeFor('tictactoe').view);
        expect(routeFor('tictactoe-pass').players).toBe(2);
        expect(routeFor('tictactoe').players).toBe(1);
    });
});

/* The table names element ids and the cards name routes, and neither is checked by
   anything else - a typo on either side would only show as a card that does nothing, or
   a route that shows a blank page. */
describe('The markup matches the routes', () => {
    test.each(Object.entries(ROUTES))('route "%s" shows an element that exists', (_key, route) => {
        expect(html).toContain(`id="${route.view}"`);
    });

    test('every card leads to a route', () => {
        const targets = [...html.matchAll(/data-route="([^"]*)"/g)].map((match) => match[1]);
        expect(targets.length).toBeGreaterThan(0);
        targets.forEach((target) => expect(Object.keys(ROUTES)).toContain(target));
    });

    test('nothing still uses the old data-view attribute', () => {
        expect(html).not.toMatch(/data-view=/);
    });

    test('the dashboard offers Single Player, Multiplayer and Toys', () => {
        const dashboard = html.slice(
            html.indexOf('id="entertainment-dashboard"'),
            html.indexOf('id="entertainment-hub"'),
        );
        ['single', 'multi', 'toys'].forEach((key) => {
            expect(dashboard).toContain(`data-route="${key}"`);
        });
    });
});
