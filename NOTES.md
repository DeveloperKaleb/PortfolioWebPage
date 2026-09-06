# Project Notes

Running notes on non-obvious decisions and gotchas hit while working on this repo.
`CLAUDE.md` covers what the codebase *is*; this covers *why* some things are the way
they are, so nobody re-debugs the same thing twice.

## Array Grid Toy layout (`#toyDisplay` in `style.css`)

`generateGridHtml()` (in `js/logic.js`) wraps each row's buttons in a `<div class="y{row}">`.
That's incompatible with CSS Grid (which `.butMania` uses everywhere else) — Grid treats
each row-wrapper as a single cell, so buttons get squeezed into it and wrap onto multiple
lines instead of laying out horizontally. `#toyDisplay` overrides to a flex column of flex
rows instead, which matches the actual DOM shape.

Buttons there also have `margin: 0` (unlike the shared `.butMania button` rule). Margin
can't shrink the way `flex-shrink` can, so with margin left in it becomes the dominant
fixed cost per button at high column counts and buttons stop shrinking well before the
container is actually full — looks like a "shrink is capped" bug even though it isn't.

Snake and Tetris don't hit either issue: their board-builders (`createStaticBoard`,
`createTetrisBoard`) emit buttons as flat direct children, which Grid handles natively.

## Entertainment hub navigation

`entertainment.html` is a single page with a hash-based view router in `entertainment.js`
(`#tetris` / `#snake` / `#toy`, empty = the hub grid). No routing library, no separate
pages per game — deliberate, to avoid duplicating nav/footer/script-include boilerplate
across more HTML files and to keep `entertainment.js` as the one DOM/state layer for all
three toys/games, matching how it already worked before the hub existed.

## Manual cache-busting (`LAST_UPDATED` in `scripts/footer.js`)

Every push needs **two** manual bumps, done together:
1. `LAST_UPDATED` in `scripts/footer.js` (human-readable, drives the footer text).
2. The `?v=YYYYMMDD-HHmm` query string on the `style.css` / `nav.js` / `footer.js` /
   `entertainment.js` tags in both `index.html` and `entertainment.html`.

**Why it's not just one shared JS constant:** a version computed from a JS file's own
contents can't cache-bust that same file's `<script src>` tag — the browser has to fetch
it first, and that fetch has no version on it, so a stale cached copy just hands back a
stale version that "correctly" busts everything else into other stale, previously-cached
copies. Don't try to route this through a single computed constant again; the literal
query string in the HTML is load-bearing.

## GitHub Pages absolute-path gotcha

Already documented in `CLAUDE.md` under "Path conventions" — repeating only because it's
easy to forget when adding a new page: `entertainment.html` and `scripts/nav.js` use
`/PortfolioWebPage/...` absolute paths, so the site only fully works served from that
exact subpath (GitHub Pages), not opened from a local file path or a differently-rooted
static server.

## Verifying changes

- Logic changes (`js/logic.js`): run `npm test` (vitest).
- Appearance-only changes (CSS/layout): the project owner prefers to check these
  themselves in a real browser rather than have Claude drive one — make the change,
  describe what should look different, hand it back.
- Functional/interactive bugs (something doesn't click, doesn't route, throws): worth
  verifying directly (local static server + browser console) rather than guessing from
  reading code alone — a `?v=`/module-import change, for example, is easy to reason about
  wrong on paper but is a 30-second check in a real page load.

## Previewing locally (`npm run dev`)

Use `npm run dev`. Opening `index.html` off the filesystem does *not* work: `nav.js` is
included from the absolute `/PortfolioWebPage/scripts/nav.js`, so under `file://` (or any
static server rooted at the repo) the nav bar and stylesheet 404 and the page renders
unstyled and un-navigable. The site needs to be served from that exact subpath.

`tools/dev-server.js` handles that by mapping the URL prefix onto the repo root — a
request for `/PortfolioWebPage/style.css` is served from `./style.css`. The obvious
alternative is making the folder name on disk match the URL (a symlink, or `mklink /J` on
Windows, since the repo directory is `portfolio-webpage`, not `PortfolioWebPage`). That
works, but it needs setting up and tearing down every time and leaves a stray link behind
if you forget; prefix-mapping needs nothing on disk. If `BASE_PATH` there ever disagrees
with `basePath` in `scripts/nav.js`, the nav breaks — they're one setting in two files.

Responses are sent `Cache-Control: no-store` deliberately. This repo cache-busts by hand
(see above), so a cached preview would quietly show you a stale page and hide the change
you're checking. Refresh is enough; no hard reload.

Flags: `--open` to launch a browser, `-- --port 8124` to move off the default 8123 (note
the extra `--`, which is what makes npm pass the flag through). Port already in use
usually means an older preview is still running.

## Mobile control placement (the thumb-reach rule)

**Rule: on a touch device, every control used mid-game sits below the board, grouped
together within thumb reach.** That means the Start button, the score readout and the
direction pad form one cluster — Start does not stay above the board on mobile.

The source order deliberately puts Start *above* the board, because that's the better
reading order on a desktop where the keyboard does the playing. On a phone that same
order strands Start at the top of the screen while the thumbs are at the bottom, with
the board in between. The fix is `order:` on the flex column under
`@media (pointer: coarse)`, so both layouts come from one DOM.

Two things to keep in mind when extending this to a new game:

- **Scope the container rule with `:not([hidden])`.** The views are hidden with the
  `hidden` attribute, which is nothing but `display: none` from the UA stylesheet. An
  unguarded `display: flex` on `#whatever-system` out-specifies it and reveals every
  view at once — the hub, and all three games stacked down the page.
- **The container needs `align-items: center`.** Flex children stretch to full width
  by default, so without it the buttons go full-bleed and stop looking like buttons.

The Array Grid toy is deliberately *not* reordered: its form generates the grid, so it
has to stay above it. Ordering only applies to `#snake-system` and `#tetris-system`.

## Colour contrast rules (hard rules, enforced by tests)

The original Tetris palette was picked by eye and it did not survive contact with a
red/green colourblind player. Measured against the empty cell it was:

| piece | old colour | contrast | what that means |
|---|---|---|---|
| I | `#035e7b` | **1.07:1** | invisible - the worst of them |
| Z | `#b33939` | **1.31:1** | red on olive, the classic red/green collision |
| S | `#002e2c` | **1.00:1** vs the board background | identical to it |
| J | `#a2a77f` | 3.09:1 | below any usable threshold |

L, O and T were separately a problem: three pale yellows that simulate to within
1.05-1.16 of each other, i.e. one colour as far as a deuteranope is concerned.

**The rules, in `js/contrast.js` and asserted in `tests/contrast/`:**

1. Any game tile clears **4.5:1** against the surface behind it - checked for normal,
   deuteranopic *and* protanopic vision, so the worst of the three has to pass.
2. Two colours a player must tell apart need either a **1.35:1 lightness gap** or a
   **22-unit gap on the CIELAB b\* (blue-yellow) axis**.

Rule 2 is the one that matters and the one that is easy to get wrong. Hue is not a
cue. Red/green colour blindness leaves exactly two things intact: how light a colour
is, and where it sits on the blue-to-yellow axis. So pieces are laid out on those two
axes deliberately - three blues at three different lightnesses, three yellows at three
different lightnesses, plus amber high on the yellow axis.

**Why the empty cell had to change from `#51553a` to `#3b3026`.** Getting seven colours
to 4.5:1 against a mid-olive forces all seven up into a narrow bright band, where they
collapse into each other under simulation - the two rules fight. Darkening the empty
cell creates the room for a lightness ladder. The board's grid lines went the other way
(`#002e2c` to `#51553a`) so they stay visible against the now-dark cells.

**Don't hand-edit a game colour.** `TETRIS_COLORS`, `SNAKE_COLORS` and `BOARD_COLORS`
live in `js/logic.js` rather than beside the rendering code specifically so the tests
can reach them. `npm test` fails on a colour that breaks either rule - verified by
putting the old `#035e7b` back and watching it fail. The one value that is duplicated
is the empty cell: `BOARD_COLORS.emptyCell` for a running game, and the
`#tetrisDisplay button` rule in `style.css` for the board at rest. Change both.

Still open: the pieces are distinguishable but seven colours is a lot to ask of two
axes. If more pieces or toys ever need distinguishing, add a non-colour cue (a border
or inset pattern per type) rather than trying to squeeze in an eighth colour.

## Games must be torn down when their view is left

Hiding a `.game-view` does not stop its `setInterval`. An abandoned game kept playing
itself behind the hidden view, and both games end by calling a **blocking `alert()`**
(`gameOver`, `gameOverTetris`) — so an abandoned Tetris would top out and throw a modal
into the middle of whichever game you had moved on to.

`stopAllGames()` in `entertainment.js` is called from `showView()`, so any view change
clears both intervals and resets both boards. It is deliberately broader than resetting
when the *next* game starts: an abandoned game left sitting on the hub screen would
still tick and still alert.

Clearing `tetrisMatrix` and `activePiece` matters as much as clearing the interval —
without it, returning to Tetris resumes the old stack instead of starting clean.

Anything added here that runs on a timer needs to be torn down in `stopAllGames()` too.
