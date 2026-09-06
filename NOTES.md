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

## The Infinity Snake board

A ribbon traced around a **Gerono lemniscate** (`x = cos t`, `y = sin(2t)/2`) — a true
figure-8 with exactly one self-crossing. It is deliberately *not* two lobes placed side
by side: two tangent circles read as something other than an infinity sign, and the
crossing is the thing that makes it one continuous ribbon.

`34 × 18`, **356 playable cells** (Classic is 400, Donut 336), fully connected.

**Inner vs outer wall** matches Donut. After the ribbon is drawn, a flood fill from the
grid edge marks everything it reaches as outer `WALL`; the blank space left over is
enclosed by a lobe and becomes `HOLE`. That is what keeps `gameOver('WALL')` and
`gameOver('HOLE')` meaning the same thing they mean in Donut.

**Orientation** is the horizontal mask transposed, so both orientations have identical
area, rules and difficulty — one mask to tune, not two. It is chosen at game start from
`window.innerWidth >= window.innerHeight` and deliberately does *not* reflow mid-game:
re-laying the grid under a running snake can drop it inside a wall.

**Cell sizing clamps on both axes** (`--snake-cell` in `style.css`). Width alone was
enough while every board was square; the Infinity board is 34 cells on its long axis,
which in portrait becomes 34 *rows* and would run off the bottom of a phone and put the
board under the thumb pad. The `55vh` term prevents that. Measured: a 375×667 phone
resolves to a 194×367px board, well inside the viewport.

**`branches` on each cell is not dead data.** It records which stretches of the curve
pass near that cell; two entries means the cell is part of the self-crossing. Nothing
reads it yet — it is the foundation for the planned over/under layering, where the snake
travels on one strand and passes above or beneath the other. Don't strip it.

Food spawns by collecting the free cells and picking one, rather than guessing at random
until a guess lands. Only 356 of 612 cells are playable here, so rejection sampling
would spin badly, and on a nearly-full board it would never terminate.

## Chrome throttles game timers in a background tab

Script-driven testing of Snake/Tetris from a non-focused tab is unreliable: Chrome
throttles `setInterval` in a hidden tab to roughly once per second, so a game configured
at 150ms per tick runs ~7x slow. This is why an abandoned game appeared not to reach its
own game-over during earlier automated checks — the harness, not the code. Game
behaviour is verified by the project owner in a real, focused browser.

## Strand graphs: boards whose cells overlap (`js/strands.js`)

A normal board is one cell = one place to be. That breaks the moment a map crosses
over itself: the middle of the Infinity board is a cell the snake can occupy on the
upper strand or the lower one, and those are **different places that share
coordinates**.

So a position is a **node** — `(x, y, strand)` — and a board is a graph of nodes, not
a grid. `js/strands.js` is map-agnostic: hand it a mask whose cells list their strands
and it produces the graph. Nothing in it knows what a lemniscate is.

**Every board goes through it**, including Classic and Donut, which are masks whose
cells each carry a single plain strand. One movement path, one collision path, no
"is this a crossing map" branching anywhere.

Three seams for a future map:

- **`link(from, to, direction)`** decides whether neighbouring nodes are the same
  continuous track. The default suits any curve-derived map: points along one strand
  have nearly the same parameter, while strands meeting at a crossing are far apart on
  it. A map built some other way passes its own predicate — that is what keeps this
  general rather than lemniscate-specific.
- **`order(cellNodes)`** decides which strand lies on top. The default sorts by curve
  parameter, so the ordering holds across a whole crossing instead of being decided
  cell by cell — otherwise the snake would surface halfway through going underneath.
- **`branches`** on a mask cell lists one parameter per strand. Empty means a single
  plain strand.

**The rule that makes crossings work:** `stepFrom` returns `null` when nothing
continues the current strand. Turning off the upper strand mid-crossing is therefore
not a blocked move, it is a death — `gameOver('EDGE')`. The graph will not say *why*
it refused, so `failureAt()` reconstructs it from the target cell: off-grid or a
wall/hole reads as it always did, and a target that is *perfectly good track* means
the snake tried to leave its strand.

Self-collision compares the strand too (`isLayeredSelfCollision`), which is what lets
the snake pass over itself instead of crashing into itself.

**Rendering.** Where two segments share a cell only the upper one is drawn — that
occlusion is what reads as over-and-under. The underneath segment uses
`SNAKE_COLORS.bodyUnder`; see the contrast section for why the body was *darkened* to
make room for a lighter under-colour rather than the other way round.

The crossing is outlined (`.cell-overlap`) so it is visible before the snake gets
there. Outline, not fill: a fill light enough to look right pushed the underneath
colour to 4.32:1, below the floor, in the exact place that colour is used. A fill also
would not have shown at all — `drawFrame` writes `background-color` inline every
frame, which out-specifies any stylesheet rule. `box-shadow` has no such conflict.

Food never spawns on a crossing cell: "which strand is it on" has no good answer.

## Curve parameters must be averaged circularly (a bug that shipped)

`buildLemniscateMask` collapses the run of `t` values passing near a cell into one
parameter. That was an arithmetic mean, which is wrong for any cell straddling the
`2π → 0` wrap at the tip of a lobe: the mean of 6.2 and 0.1 is about π, a parameter
pointing at the **opposite end of the curve**.

Consequence: those cells failed the continuity check against their real neighbours, so
the ribbon was **severed at the right-hand tip** — 376 nodes with only 368 reachable.
Driving into it produced `gameOver('EDGE')`, "stepped off the crossing", on track that
was perfectly good. The message was right; the geometry was wrong.

Fixed with `circularMean` in `js/strands.js` (sum unit vectors, take the atan2), and
guarded by three tests in `tests/board/strands.test.js`:

- every node on every board is reachable from every other,
- linked neighbours are within the continuity tolerance on the curve,
- `circularMean` averages across the wrap rather than through the middle.

**The reachability test is the one that matters.** An earlier "walk a lap of the board"
test did not catch this: it steered by a naive turn-whichever-way-continues rule, so it
wandered back to its start without ever crossing the severed tip and passed. It has been
removed — reachability states the property directly instead of hoping a walker stumbles
into the fault.

## Sizing the crossing band

The crossing was 20 cells (6×4) and too cramped to play with. Widening it is *not* a
matter of thickening the ribbon — that inflates the whole play area and makes the map
easier, moving it on the difficulty gradient.

The lever is **`scaleY`**: a flatter figure-8 makes the two strands meet at a shallower
angle, which widens the band where they overlap. Flattening alone shrinks the track, so
`halfWidth` goes up slightly to compensate. `scaleY: 9, halfWidth: 2.6` gives a 32-cell
crossing in an 8×6 band with 352 playable cells, against 20 cells and 356 before — a
much bigger crossing at effectively the same difficulty. The board is 34×14 rather than
34×18, since the flatter curve no longer needs the height.
