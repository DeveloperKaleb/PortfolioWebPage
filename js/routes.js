/* The Entertainment page's routes, with no DOM.
 *
 * The page is a single document with a hash router (see NOTES.md): each hash shows one
 * section and hides the rest. This table says which section each hash shows, what it is
 * called, and where Back goes. It lives here rather than in entertainment.js so it can
 * be tested, and so the markup can be checked against it.
 *
 * Back goes to a route's parent, never to browser history. A visitor who arrived from a
 * link, or refreshed, has no history on this page, and history.back() would take them
 * off the site.
 */

export const DASHBOARD = '';

export const ROUTES = {
    [DASHBOARD]: { view: 'entertainment-dashboard', title: 'Entertainment' },
    single: { view: 'entertainment-hub', title: 'Single Player', parent: DASHBOARD },
    multi: { view: 'multiplayer-hub', title: 'Multiplayer', parent: DASHBOARD },

    tetris: { view: 'tetris-system', title: 'Falling Polyominos', parent: 'single' },
    snake: { view: 'snake-system', title: 'Snake', parent: 'single' },
    minesweeper: { view: 'minesweeper-system', title: 'Mine Sweeper', parent: 'single' },
    sequence: { view: 'sequence-system', title: 'Sequence', parent: 'single' },
    tictactoe: { view: 'tictactoe-system', title: 'Tic-Tac-Toe', parent: 'single', players: 1 },

    // Pass the phone: the same view, for two people taking turns on one device.
    'tictactoe-pass': { view: 'tictactoe-system', title: 'Tic-Tac-Toe', parent: 'multi', players: 2 },

    /* Finger Paint opens straight from the dashboard's Toys card. With one toy, a Toys hub
       would be a screen holding a single card; it gets one when there is a second toy. */
    toy: { view: 'toy-system', title: 'Finger Paint', parent: DASHBOARD },
};

const keyOf = (hash) => String(hash ?? '').replace(/^#/, '');

// The route for a hash, with its key. Anything unknown is the dashboard.
export function routeFor(hash) {
    const key = keyOf(hash);
    const known = Object.prototype.hasOwnProperty.call(ROUTES, key) ? key : DASHBOARD;
    return { key: known, ...ROUTES[known] };
}

// Where Back goes from a route. The dashboard has nowhere further back, so it stays put.
export const parentOf = (hash) => routeFor(hash).parent ?? DASHBOARD;

// What a Back button should say it goes back to.
export const backTitleFor = (hash) => ROUTES[parentOf(hash)].title;
