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

## Ribbon width and crossing reach are two different numbers

`halfWidth` is the ribbon's own thickness — it decides whether a cell is track at all.
`crossingHalfWidth` (wider) decides how near a *second* stretch of curve has to pass
before the cell counts as shared by two strands.

They were one number, and the mouths of the crossing suffered for it: where the two
strands run alongside each other before their ribbons actually merge, the second strand
sits 2.7–3.2 cells away against a 2.6 ribbon. Those cells were plain track, yet the
player is already committed to a strand there — turning across would kill you with no
outline to warn that anything was going on. Widening `halfWidth` instead would have
thickened the whole ribbon and changed the map's difficulty; this reaches further only
for the question of who shares a cell. The crossing went from 32 cells to 48 with the
play area unchanged at 352.

## Leaving your strand reads differently depending on which strand it is

Same move, opposite physical story. On the upper strand nothing is above you, so
leaving it is a fall — `EDGE`, "Lost Footing: Stepped off the crossing." Underneath,
the strand above is a ceiling and the sides of the gap are walls, so the same move is
running into one — `UNDERPASS`, "Structural Impact: Hit the underpass wall."

`isUnderneath(graph, position)` lives in `js/strands.js` rather than in the DOM layer,
because it answers three questions that must not drift apart: how a segment is drawn,
how leaving the strand reads, and whether the crossing is outlined. It is pure, so it
is unit tested.

## Two markings, doing different jobs

The crossing carries two separate visual cues, and they answer different questions.

**The bold edge is permanent.** `strandEdges` gives the directions in which the upper
strand's band ends, and those sides get a heavy inset border — the knot-diagram
convention, where the strand passing over keeps a continuous outline and the one beneath
is broken by it. It says *where the crossing is, and which strand is on top*, and it is
always drawn, so a route can be planned before arriving.

Written as an inline `box-shadow` when the board is built: it is fixed for a given
board, `drawFrame` only ever touches `background-color`, and a stylesheet rule would
need one class per combination of sides.

**The hatch is conditional.** It paints only under `.is-underneath`, which `drawFrame`
toggles from the **head's** strand each tick — the head is what counts, since once it is
out the far side the player is no longer underneath, whatever the tail is still doing.
It says *you are under something right now*.

The hatch is a `background-image` rather than a `box-shadow`, so it does not fight the
inline edge borders, and it skips cells carrying `.snake-on`, so it never runs across
the snake and eats into the contrast those colours depend on.

Splitting the two was the point: one permanent cue for *where*, one live cue for
*what is happening to you*. An earlier version gated the only marking there was, which
would have left the crossing unannounced until the player was already inside it.

## Touch targets reach past the buttons, and that has a blast radius

Each pad button carries an invisible `::after` reaching 20px further out, so the target
is larger than it looks without the pad growing — the visible size is what keeps the
cross readable. Keyed on `data-action`, so the d-pad and the Tetris row are both covered
without either needing its own rules.

**The reach is bigger along a button's own axis than across it** (`--pad-reach` 20px,
`--pad-perp` 4–8px). A thumb landing beside a button is as common a miss as one landing
short, so both are caught — but across is the direction the neighbours are in, and a
mis-resolved tap is worse than a missed one: it turns you the wrong way rather than not
at all.

How much perpendicular reach fits differs by pad:

- **d-pad** — each button has empty grid cells either side, and opposite arms only begin
  to overlap at 12px. 8px keeps a margin.
- **Tetris row** — rotate and soft-drop are horizontal neighbours splitting a single
  10px gap, so they start contesting the same pixels at 6px. 4px each is the limit.

Those figures are computed from the 64px buttons and 10px gaps, so changing either size
invalidates them.

**The reach is not free space.** The mobile layout stacks the Start row directly above
the pad, and at the 16px gap that row previously used, the UP button's 20px reach landed
on the Start button — the exact accidental tap the disabling below exists to prevent. The
gap is 28px for that reason. Anything that changes the vertical rhythm of the mobile
cluster has to keep the gap above the pad wider than the reach.

## Game config controls lock while a game runs

`setGameControlsEnabled()` disables the mode dropdown and both Start buttons while a game
is running, and releases them on every path out: either game-over, and leaving the view.

Disabled, not hidden. Hiding them would reflow the column mid-game and shift the board
and the pad under the player's thumb — trading an accidental tap for a worse problem.

Two things this prevents: Start silently restarting a good run when a thumb reaches high
on the pad, and a mode change mid-game leaving the snake on a board that no longer exists.

## Touch handling already in place

Worth knowing before adding more: the pads already use `pointerdown` with
`preventDefault()`, `touch-action: none`, `user-select: none` and a transparent
`-webkit-tap-highlight-color`. Between them these cover instant response, no scrolling or
zooming from pad gestures, no text-selection callout and no grey tap flash.

Added later for what those do not reach: `overscroll-behavior: none` on `html` for the
rubber-band bounce at the ends of the page (mid-game it reads as the board lurching,
since the pad is tapped rather than dragged), and `touch-action: manipulation` on
`.butMania button` for the double-tap zoom on board cells — which also drops the ~300ms
a browser spends deciding whether a tap was the first of two, so painting the Array Grid
feels immediate. `manipulation` rather than `none` there, because the page still needs
panning and pinch-zoom; never set `user-scalable=no` on the viewport, which would take
pinch-zoom away from anyone who needs it.

## Never dim a control with opacity

`opacity: 0.5` on the disabled Start button and mode dropdown shipped, and the labels
became unreadable — measured at roughly **1.6:1**. Opacity scales the text toward the
background along with everything else, so it destroys exactly the contrast the rules
elsewhere in this file exist to protect.

Disabled state now comes from muted *colours* — `#b9bba4` behind `#2f2a1f`, 7.18:1 —
with the values in `UI_COLORS` in `js/logic.js` and asserted in `tests/contrast/`. The
signal is that the control looks drained, not that its label disappears.

`-webkit-text-fill-color` has to be set alongside `color`: WebKit dims disabled text by
its own rule, which out-ranks a plain `color` declaration.

## The end-of-game dialog is in-page, not alert()

A native `alert()` on a phone forces the browser toolbar back on screen and resets the
scroll position. The visible effect is the nav bar reappearing and the pad scrolling out
of reach, which makes retrying a game slow — you have to scroll back down before you can
play again.

`#game-over` is fixed to the viewport, so nothing behind it moves, and it puts Play Again
under the thumb rather than at the top of the page. `focus({ preventScroll: true })` on
that button matters: a plain `focus()` scrolls its target into view and would reintroduce
the jump this exists to remove.

It needs `:not([hidden])` on the `display: flex` rule for the same reason the game views
do — `display` on a bare selector out-specifies the `hidden` attribute, and the dialog
would never close.

Side benefit: browser dialogs block everything, including the automation used to check
game behaviour. Nothing in the entertainment page calls `alert()` any more.

## Food has a strand, like the snake does

Food was excluded from crossing cells because "which strand is it on" had no answer.
Giving it a strand answers it, and the rest follows from rules that already existed:

- **Placement** is by node, not by cell (`freeNodes`). A crossing cell can hold a snake
  segment on one strand and food on the other — they are not in the same place.
- **Eating** compares the strand as well as the coordinates. Passing over food on the
  strand below does not pick it up; you have to come round and take the lower strand.
- **Underneath** food is drawn in `SNAKE_COLORS.foodUnder`, and the playable cells
  around it get `.peek`, opening a hatched window onto the level below.

That took placements from 304 to **400** — every cell, plus the second strand of each of
the 48 crossing cells. The middle of the board is somewhere to go again, not just
somewhere to pass through.

**The food's own cell is left unhatched**, though the request was for the full 3×3. The
hatch would sit over the one thing on the board the player is hunting for and cut its
contrast; the lighter colour already says it is below, and the ring around it draws the
eye. Hatching the centre is a one-line change if it reads better.

**The window is clipped to real crossing cells** (`overlapCellsAround`). The hatch
means "there is a level below here", so a single-strand cell must never carry it -
it would show room to be underneath that does not exist, and on this board the shading
also reads as where you can travel. Before clipping, 32 of the 48 possible underneath
positions drew an oversized window, up to four cells too many. The stylesheet requires
`.cell-overlap` on `.peek` as well, so the invariant holds even if a caller widens it.

**The lighter colour was tightly constrained.** It has to stay above the 4.5:1 floor and
be at least 1.35× lighter than the normal food to read as a different colour — a window
of 4.50 to 5.16 against white. Both are blue, so the blue-yellow axis cannot separate
them and lightness has to do all the work. `#0070b8` sits at 4.99 and collides with
nothing else on the board. The obvious "just lighten it" candidates all fell through the
floor: `#2f86a8` is only 3.96.

`.peek` shares its hatch with `.is-underneath` — one is a window around underneath food,
the other the whole crossing while the snake's head is below. Both skip `.snake-on`, so
neither ever runs across the snake.

## Passing over your own tail

Handled: `gameStep` uses `isLayeredSelfCollision`, which compares `(x, y, strand)`, so a
head on the upper strand and a tail on the lower one sharing a cell is not a crash. Same
cell *and* same strand still is.

It takes a while to reach. The shortest loop from one strand of a crossing cell back to
the same cell on the other is **24 moves**, so the snake has to be longer than 24
segments for its tail still to be there when the head comes round — roughly score 240.
Longest such loop is 34. Tested on the real board, not just in the abstract, because it
is the kind of thing nobody reaches by hand for a long time.

Two consequences of that situation, both currently by design rather than by decision:

- **The head is hidden if a body segment is above it.** `topOccupant` picks purely by
  layer, so a head on the lower strand under its own body is not drawn. Physically
  right, but the player loses sight of where they are for a move or two.
- **The head has no underneath colour.** `SNAKE_COLORS` has `bodyUnder` but no
  `headUnder`, so a head that is below (and not occluded) looks the same as one on top.
  Being underneath is signalled by the body and the hatch, not the head.

### How the d-pad divides up its space

A cross in a 3×3 grid leaves the four corner cells belonging to no button. With each
button reaching only along its own axis plus a little across, that left a **64px dead
square diagonally out from the centre** — `down` stopped at x=146, `right` stopped at
y=146, and the cell between was nobody's. It is where a thumb lands reaching down and
slightly across, and **no amount of perpendicular expansion reaches it**, because it is
diagonal from both neighbours. Symmetric fuzziness cannot fix a diagonal gap; it took
two rounds of widening before the report "missing *right of* the down button" made the
shape of the hole obvious.

The space is carved up instead, in two pieces per horizontal button:

- **Up and down take their whole row**, exactly the width of the pad (`--pad-band`).
  Anything in the top band is up, anything in the bottom band is down — including the
  corners that used to be dead.
- **Left and right keep a narrow strip** beside the button (`--pad-perp`), then widen
  past the end of the pad into **full-height outer panels** (`--pad-out` wide,
  `--pad-tall` above and below). Out there nothing competes for the space, so there is
  no reason to be stingy with it.

The two pieces of a horizontal button are `::after` (the strip) and `::before` (the
panel), with `right: 100%` pinning the panel's far edge to the button's near edge so
they meet exactly and neither strays into the up/down band.

Reaching down-and-across lands on down; reaching out-and-up past the pad lands on left
or right. Nothing overlaps — verified by computing the rectangles, not by eye.

**The centre of the cross stays dead deliberately.** A tap there is genuinely ambiguous,
and on a d-pad guessing is worse than ignoring: a wrong guess turns you the wrong way.

All of it derives from `--pad-size` and `--pad-gap`, so changing a button size or gap no
longer silently invalidates the reaches — which is how the dead corners hid in the first
place. The Tetris row is untouched: one row, no corner cells.

## Array Grid toy: colours and swipe painting

**The palette lives in `js/logic.js`** (`TOY_COLORS`) rather than beside the markup, so
it can be contrast-checked. That is not academic: the CSS keyword `brown` (`#a52a2a`)
simulates to `#69681e` for a deuteranope, which is indistinguishable from `green` at
`#6a6a12`. Shipping it would have added a colour the project owner cannot tell from one
already there. The coffee brown `#6f4e37` is clear of everything.

`Red`/`Green` do collide, and always have. They predate the contrast rules and are left
alone pending a decision, since changing them changes pictures people already made. The
test pins the collision list to exactly that pair, so a *new* collision fails the suite
rather than shipping quietly.

**Swatches appear twice on purpose.** Each `<option>` is tinted with its own colour and
its label flipped to black or white for legibility — but Safari ignores `<option>`
styling entirely, so the tint cannot be the only cue. The `#colorSwatch` beside the
select is an ordinary element and shows the current colour everywhere.

**Swipe painting** uses `pointerdown`/`pointermove` with a per-stroke set of cells, so
crossing a cell twice in one sweep does not undo it — only a fresh tap toggles. Two
things it needs:

- `document.elementFromPoint`, because a touch pointer keeps reporting the element the
  stroke *started* on. `event.target` cannot say what is under the finger now.
- `touch-action: none` on `#toyDisplay`. `manipulation` on `.butMania button` kills
  double-tap zoom but still lets a drag pan the page, which would fight the stroke. The
  trade is that a drag starting on the grid belongs to the grid and will not scroll.

**The applied colour is kept in `dataset.color`, not read back from the inline style.**
Browsers re-serialise `style.backgroundColor`, so a hex comes back as
`rgb(111, 78, 55)`. Comparing that against the picker's value only worked while every
colour was a CSS keyword; the hex brown would have broken tap-to-undo silently.

## Why the contrast check simulates both deuteranopia and protanopia

`worstCaseContrast` and `areDistinguishable` take the **worse** of the two simulations.
That is a deliberate decision, confirmed 2026-09-07, not an accident of implementation.

The reason is that the two conditions fail on *different* pairs, and a check against
only one would wave the other's failures through. Measured on the toy palette:

| pair | deuteranopia | protanopia |
|---|---|---|
| Red / Green | 1.95 — fine | **1.03 — identical** |
| CSS `brown` / Green | **1.02 — identical** | 1.66 — fine |

Exact opposites. Testing deuteranopia alone would have passed red/green; testing
protanopia alone would have passed CSS brown. Only checking both catches each.

Relaxing to deuteranopia alone was considered, since it is roughly three times more
common (~6% of men against ~2%, with US-wide rates lower than the Northern-European
figures those come from) and would give more palette room. Rejected: protan-type
deficiency is still millions of people in the US, and the site is public.

The cost is usually low. **The way out of a tight spot is the blue-yellow axis**, which
survives both conditions — the shipped brown `#6f4e37` clears the bar that way, with a
b\* gap of 30.8 despite a lightness separation of only 1.24. The rule has genuinely
pinched exactly once, on `foodUnder`, where two blues had to be separated by lightness
alone because hue could not help, leaving a window of 4.50–5.16.

## Gradients are exempt from the distinguishability rule

**Decorative gradients may use colours that are indistinguishable from each other.** The
job of a gradient is the progression across it, not any one band being tellable from its
neighbour — two adjacent stops looking alike is the effect working, not a defect.
Applying the pairwise rule to a gradient's own steps would forbid the technique outright.

The exemption covers the gradient's own colours. It does **not** cover anything drawn on
top of one — text, a glyph, a game piece. Those still have to clear 4.5:1, and against a
gradient they have to clear it at **every stop**, because the background beneath them
changes across the element. `worstCaseOverGradient(color, stops)` in `js/contrast.js` is
that check, and the Minesweeper palette is asserted through it.

In practice that splits surfaces two ways:

- **Nothing read against it** — the Minesweeper board frame, page backgrounds. Free to
  be as decorative as it likes.
- **Something read against it** — the Minesweeper cells. The gradient is fine, but the
  flag glyph and the number tiers are checked against both ends. The tightest is the low
  tier at 4.56:1 against the dark end of the cleared-cell gradient, and the flag at
  4.73:1 against the light end of the canopy.

Keep gradient stops in the palette modules (`MINE_GRADIENTS`) rather than only in CSS,
or there is nothing for the tests to check them against.

## Minesweeper

10×10 with 12 mines (12%, close to the classic beginner density). Rules in
`js/minesweeper.js`, pure and immutable — every function returns a new game rather than
editing one, because a cascade that half-applied itself would be miserable to debug.

**Winning means the board is finished, not merely survived**: every safe square open
AND every mine flagged. Clearing the last safe square used to end it, which stopped the
game while the player still had flags in hand. Both `reveal` and `toggleFlag` can now be
the winning move, so both settle the status.

The flags are not checked for correctness, and do not need to be: a flag can only sit on
a hidden square, so once every safe square is open the only squares left to flag are
mines. The right *count* of flags can only mean the right flags.

One consequence: a player who clears the board but has not flagged everything is still
in play, and can still lose by opening a mine. Before, they would already have won.

The counter is `flagsRemaining`, named for what it counts. It goes down on any flag,
right or wrong - the game must not leak which mistakes the player has made.

**Mines are placed on the first click, not before**, and never on it or beside it. An
opening move that lands on a number, or on a mine, is luck rather than play; a clear
neighbourhood guarantees the first cascade has something to open.

**Numbers use three tiers, not the traditional eight colours.** Eight shades that all
clear 4.5:1 against one light background *and* stay apart from each other under both
colour-blindness simulations do not exist — the same wall the Tetris palette hit at
seven pieces. The digit is the information; the tier conveys rising danger. Lake for 1–2,
cedar for 3–4, basalt for 5+.

**Flagging needs two gestures.** Right-click covers a mouse. A touchscreen has no
equivalent, so there is a Flag mode toggle — a mode you can see, rather than a long-press
you have to be told about. It has to *look* switched on, since there is no other way to
know what the next tap will do.

The board is built once and repainted rather than rebuilt each move: replacing
`innerHTML` would drop the element the player just pressed, which on touch cancels the
gesture mid-tap.

Chording (tapping a satisfied number to open its neighbours) acts on the flags the
player placed, not on where the mines actually are — so a wrong flag loses. That is the
point of it.

## The game must not do the player's thinking

**Nothing in the Minesweeper UI may describe the state of the board.** The status line
says what the controls do; it never says what is under the squares, and never reacts to
what has been revealed, flagged or found.

This got broken almost immediately after it was written. A status message noticed when
every safe square was open and said "Ground cleared. Flag the last mines to finish."
It was meant as a convenience — a player standing on a cleared board should not be told
to keep clearing. But it announced that every remaining hidden square is a mine, which
is the last deduction on the board, handed over for free. Working that out *is* the
game.

The rule it broke is worth stating plainly, because it is not obvious while writing what
feels like a helpful message: **letting the player fail is part of the design.** Room to
be wrong is where the reasoning gets built. A hint that saves someone thirty seconds
also removes the thing they were about to learn.

Concretely, for anything added here later:

- The playing message may depend on **flag mode** — that is the player's own control,
  not information about the board.
- It may not depend on `revealed`, `flagged`, `mines`, or any count derived from them.
- Terminal states (won, lost) may say anything: the game is over, there is nothing left
  to deduce.
- The flag counter is fine as it stands. It shows mines minus flags placed, both of
  which the player already knows, and it deliberately does not know whether a flag is
  correct.

If a message needs a condition on board state to make sense, that is the signal it
should not exist.

## Board sizes, and changing mode from the end-of-game dialog

Minesweeper offers Standard (10×10, 12 mines, 12%) and Large (20×20, 60 mines, 15%).
**Density climbs with size on purpose**: a bigger board at the same density is only
longer, not harder, and what makes a large board interesting is that the deductions get
denser too. 12% is near the classic beginner ratio, 15% near intermediate.

The 20×20 board forced two corrections to the cell-size clamp, both of which were latent
bugs at 10×10:

- **The gaps are now subtracted before dividing.** At 10 columns the 18px they occupy
  disappears into the rounding; at 20 columns it is 38px, enough to push the board off a
  phone.
- **The floor dropped from 22px to 12px.** A floor above what actually fits does not keep
  cells tappable — it just guarantees the board overflows. A 20-wide board on a 375px
  screen lands near 15px a cell: small, but the whole board stays on screen, which beats
  a larger board you have to scroll.

Measured after the fix: 10×10 and 20×20 both fit within 375, 412 and 320px viewports.

**The end-of-game dialog offers a mode change** for any game that has modes — Snake's
board shapes, Minesweeper's sizes. Tetris has none, so the row stays hidden.

It **mirrors the game's own select rather than keeping its own list**: options are copied
from the page's control at show time, and the choice is written back to that control on
Play Again. Every `init` function already reads its mode from there, so that write is all
it takes to switch. Two lists would eventually disagree; there is only one.

The row uses `display` on `:not([hidden])` for the same reason the game views and the
dialog itself do — a bare `display` rule out-specifies the `hidden` attribute and the row
would never hide.

## Duplicate ids, and the patch-script hazard that caused one

Two board-size dropdowns shipped side by side on the Minesweeper page. A script that
inserted markup ran twice: the first run wrote the file and then failed later on, and
the "skip the part already applied" fix-up silently did not match, so the insertion went
in again.

**A duplicate id is silent.** The page renders, `getElementById` returns the first match,
and the second copy sits there looking like a real control while doing nothing. Nothing
in the build complains, because there is no build.

`tests/markup/ids.test.js` now fails on duplicate ids across both pages, on a `<label
for>` pointing at nothing, and on a page whose `?v=` stamps disagree with each other or
with the other page. Verified by reintroducing a duplicate and watching it fail.

The wider lesson for anyone editing these files by script: **an insertion is not
idempotent**. Check the target is absent before writing, or make the search string
include enough context that a second application cannot match.

## "Last updated" can disagree between the two pages for ten minutes

Not a bug, and nothing to fix. GitHub Pages serves HTML with `Cache-Control: max-age=600`
and that is not configurable.

The `?v=` stamps bust `style.css`, `nav.js`, `footer.js` and `entertainment.js`. Nothing
busts the **HTML itself**. So for up to ten minutes after a push, a browser may still
hold the old copy of one page, which references the old `?v=`, which loads the old
`footer.js` out of its own cache — and shows the previous timestamp. The other page, if
fetched after its own ten minutes expired, shows the new one. Hence one page right and
the other wrong, on the same device, at the same moment.

To confirm it is only this, check what the server is actually serving:

    curl -s .../entertainment/entertainment.html | grep -o "footer.js?v=[0-9-]*"
    curl -s .../scripts/footer.js | grep "LAST_UPDATED"

If those agree, the deployment is correct and the phone is holding a stale document.
Waiting it out or a hard refresh clears it.

## The Minesweeper board is deliberately not `.butMania`

Cells rendered at different widths, the right-hand column fattest, digits pushed to the
right, and a horizontal scrollbar under the board. All one cause, and it was **not**
subpixel rounding, which is where I looked first.

`#mineDisplay` carried `class="butMania"` alongside its own id, so it inherited
`.butMania button` — `width: 30px`, `height: 30px`, `margin: 1px`, a yellow border. That
selector scores **(0,1,1)** against `.mine-cell` at **(0,1,0)**, so it won. 30px buttons
were being packed into 14px grid tracks: they overflowed rightward and overlapped, and
each digit *was* centred — in a 30px box of which only the left 14px was visible.

It only showed on the 20×20 board because at 10×10 the track is about 31px and a 30px
button very nearly fits. The bug was there the whole time; the small board hid it.

The board now carries only its id. `.mine-cell` owns all of its own styling, including
`touch-action: manipulation`, which has to be on the cell rather than the board because
`touch-action` applies to the element a gesture *starts* on.

**The general trap:** giving a new component a shared layout class "for consistency"
imports every descendant rule that class carries, and a single-class selector loses to
any of them that also names an element. If a component defines its own layout, give it
its own class and let it own its rules.

## Whole-pixel cell sizes

Kept from the first attempt at the above, because it is right on its own terms even
though it was not the bug. `--mine-cell` is rounded down to whole pixels and the
container width is stated as tracks plus gaps rather than left to `fit-content`, so no
column absorbs leftover slack.

**The rounding sits in an `@supports` block, and has to.** The usual two-declaration
fallback does not work for a custom property: a browser without `round()` still accepts
the declaration, because custom properties take almost any token stream, and only fails
when the value is *used* — leaving `grid-template-columns` invalid and collapsing the
grid entirely. A feature query is the only safe way to do it.

## Sequence: the first sound on the site

Built 2026-09-09, from the idea recorded under "Ideas not yet built" - suggested
2026-09-07 by the project owner's daughter. Her idea specified a **visual and an audio
cue together** on every pad, and that pairing turned out to settle most of the decisions
below rather than being a detail of them.

**The pairing is one code path, not two.** `firePad` in entertainment.js lights the pad
and plays its tone; nothing else does either. Two call sites - one for the machine's
playback, one for the player's own press - would eventually drift, and a drift here is
not cosmetic: it is the game going silent for someone playing by ear, or going dark for
someone playing with the sound off. Keep it single.

**What the pairing buys.** Each channel carries the whole game on its own. Sound off, or
a device with no Web Audio at all, and the lights still say everything; eyes elsewhere,
and the tones do. That is what a player who cannot hear the game needs, and it came free
with the idea instead of being retrofitted, which is the argument for having taken the
idea literally.

**Autoplay policy.** A browser will not let a page make noise before the player has
interacted with it: an `AudioContext` built at load is born suspended and stays suspended
even after a later gesture. So the context is created inside the Start handler - a real
click - and reused for the session. It is also resumed on each use, because coming back
to a backgrounded tab can suspend it again. Browsers cap how many contexts a page may
open, so one is kept rather than one per tone.

**Tones are enveloped, not gated.** Starting and stopping a bare oscillator puts a step
in the waveform, and a step is an audible click on every single pad. Each tone ramps up
over 8ms and decays exponentially to a floor. The floor matters:
`exponentialRampToValueAtTime` is undefined for a target of zero, so the ramp goes to
0.0001, not to 0.

**Why the pitches ascend with pad order.** Pad 1 is the lowest and pad 6 the highest, on
a minor pentatonic. Ascending order is what makes the run followable by ear alone;
pentatonic is what keeps it bearable, since any two of those pitches sit together however
the run orders them, and a run gets replayed from the start every single round.

**The difficulty ramp flattens.** `stepDurationMs` eases from 620ms to 300ms over 14
rounds and then stops. Two things are being asked of the player at once - a longer run
each round, and less time per pad - and only one of them should keep growing. Left to
climb, the tempo would eventually decide the game on reaction speed, which is a different
game. Past the floor the run keeps getting longer and the pace does not, so what ends a
game is recall. That is the intended failure.

**Presses during playback are ignored, not punished.** Hitting a pad while the machine is
still showing the run is being early, not being wrong. Ending a run for it would be
scoring the interface rather than the memory. `pressPad` only acts in the AWAITING state,
so this is a property of the rules, not of the UI, and it is tested.

**The run may repeat a pad.** Deliberate, and tested. A run that never repeated would
leak: after each pad the player could rule that one out for the next.

**Pads take pointerdown, with a guard for keyboard clicks.** `click` waits for the finger
to lift, which is a long time in a game about answering a rhythm. But a keyboard
activation of a `<button>` arrives as a click too, and handling both events unguarded
fires every pad twice. Keyboard clicks are the ones with `detail === 0`; that is the
check. The number keys 1-6 also play the pads, and only while the Sequence view is
visible - those are otherwise ordinary keys.

**Six pads is the palette ceiling, not a design choice.** Same wall the Tetris palette hit
at seven: a seventh colour could not be placed that cleared 4.5:1 on the panel and stayed
distinguishable from the other six under both simulations. The pads are laid out
alternately along lightness and the blue-yellow axis - neighbours in hue separated by
brightness, everything else by the axis red/green colour blindness leaves intact.

**The lit state is a lightness jump, never a hue shift.** This is the one that failed
first. The obvious palette put the pad faces at their brightest, which left the lit state
with nowhere to go: under simulation the flash disappeared, and the flash is the game's
entire visual output. Faces are pitched down the range so lighting one is a real change.
`tests/contrast` asserts it per pad.

**The mechanical look is carried by the housing, not by the colours.** Bezel, moulded
lip, travel on press, a lamp glow thrown onto the panel. Muting the pads to look more
industrial is the move to avoid - desaturating is precisely what breaks the contrast
rules, and the machine reads as a machine from the metal around the lamps instead.

**Leaving the view has to cancel playback by name.** Sequence schedules its steps with
`setTimeout`, not the `setInterval` the other games use, so `stopAllGames` cannot clear it
the same way - it calls `initSequence()`, which clears the pending timer list. An
abandoned run here would be the worst of the four to leave running, being the only one
that makes noise.

## The control bars are themed per game

Until 2026-09-09 the row of selects and buttons above each board was browser default
chrome: identical grey above five games that look nothing alike, and on a dark page the
default select was the brightest thing on screen - louder than the board it belonged to.
Each game's controls now take that game's own palette. Snake and Minesweeper share
Pacific Northwest, Sequence takes the machine's steel, Falling Polyominos takes the deep
teal with the piece colours as accents, Finger Paint takes the site's olive.

**Set with custom properties per view, not five copies of the rules.** Each `.game-view`
states only its colours; the structure is written once. Adding a sixth game means adding
one block of variables. The values live in `CONTROL_THEMES` in js/logic.js and are
asserted in tests/contrast, like every other colour on the site.

**Scoped by control-bar id, not by `.game-view`.** A game view also contains the board,
the touch pads and Sequence's own pads - all of them `<button>` elements with their own
styling. A rule targeting `.game-view button` would have taken every one of them.

**Borders are held to 3:1, not 4.5:1.** A border is an edge, not something read, so the
text floor does not apply - but a control with no visible boundary has no visible shape.
3:1 is the WCAG threshold for a graphic, and the Sequence border failed the first pass at
2.54:1 before being lightened.

**Toggles are checked in their on state.** Flag mode and the sound switch are modes
rather than momentary presses, so "on" has to be legible - a control that lost its
contrast when switched on would be least readable exactly when the state matters most.
Both are asserted.

**The select caret is drawn in CSS, not left to the system.** A native arrow is painted
in the OS's own colour, which on these surfaces ranges from invisible to jarring. Two
linear-gradients make a caret in the control's own text colour, so it follows the theme
with no image file. Two consequences worth knowing: `appearance: none` is required for
it, `background-color` has to be set separately or the `background` shorthand wipes the
caret out, and the disabled rule has to clear `background-image` or the caret stays in
the old text colour on the drained surface.

**`<option>` colours are stated explicitly.** The dropdown list is drawn by the OS, and
an option inheriting a dark surface with dark system text is unreadable. Finger Paint's
colour picker is the exception - it sets per-option colours inline, for the reason
recorded in its own note.

## Hub thumbnails drift, and now there is a test for it

The tiles on the hub are decorative - nothing is read against them, so they are exempt
from the contrast rules. They are not exempt from being honest about what the game looks
like, and by 2026-09-09 two of them were not: the Falling Polyominos and Snake tiles were
written before either palette was rewritten for colour blindness and nobody had gone back
to them. The hub was advertising Falling Polyominos in a red, `#b33939`, that by then
existed nowhere else on the site, and Snake in the old olive. It was spotted by looking
at the cards beside the boards, which is the only way it ever would have been.

`tests/markup/thumbnails.test.js` now parses the `.thumb-*` rules out of style.css and
checks every colour against that game's palette in js/logic.js. Rearranging the cells
stays free; inventing a colour does not. The test was confirmed to fail by putting
`#b33939` back before it was trusted - a drift test that has never been seen to fail is
not yet a test.

**The toy is the loose end.** Finger Paint's grid is styled in the stylesheet rather than
from a palette module, being the one board whose cells never had colour rules to answer
to. Its two surface colours are named in the test file so its paints can still be checked
against TOY_COLORS, which is the half that matters.

**Sequence's tile is reshaped, not just recoloured.** Its board is 2x2 where every other
tile is 4x4, so the CSS restates the grid and drops the twelve spare cells from the
shared markup. The pads run to the edge, leaving the panel showing only as the gaps and
the frame - which is how the real board reads, where the dark is housing rather than
empty cells. If that `nth-child(n+5)` rule is ever lost, twelve stray cells appear rather
than anything failing loudly, so the test pins it.

## Boards ran off the right edge, and why centring was the symptom

Reported 2026-09-10, on mobile: once a board got big enough, it stopped being centred
and ran off the right of the screen. Four separate causes, all of which had shipped, and
one shared mechanism underneath.

**The mechanism.** `margin: auto` cannot centre a block that is wider than its
container - the auto margins compute to zero and the box sits flush against the left
edge, overflowing right. So "centring failed" was never a centring bug. It is what
overflowing looks like, and every fix below is about making the thing fit or giving its
overflow somewhere to go.

**1. Boards were sized against the viewport, not against the column they live in.** The
page column is 90% of the viewport below 720px and a flat 600px above it, but Snake,
Minesweeper, Tetris and the touch pads all divided up `100vw` minus a guessed allowance.
A board budgeting for the whole screen comes out wider than the column, and then cannot
centre in it. Minesweeper's 20x20 board did this in any window under about 900px, so it
was never only a phone problem - it was just easiest to see on one.

They now divide `--board-space`, which is `100cqw` of the `.game-view`. Container query
units measure the container, which is precisely the question being asked, and it tracks
the 720px breakpoint for free rather than restating it.

**The container is the .game-view, never the .wrapper, and that placement is load
bearing.** `container-type: inline-size` applies `contain: layout`, and a
layout-contained element becomes the containing block for its fixed-position
descendants. `#game-over` is `position: fixed` for a reason recorded elsewhere in this
file - a dialog that moves the page under a phone's thumb is the bug it was built to
fix - and it lives inside the wrapper. Containing the wrapper would have silently turned
it into a scrolling dialog. It is a sibling of the views, so containing the views leaves
it alone, and a view's inline size is the column's anyway.

**The vw fallback has to be its own declaration, before the @supports block.** Same trap
as the Minesweeper rounding: a browser with no container units still accepts `100cqw`
inside a custom property, because custom properties take almost any tokens, and only
fails where the value is *used* - which would leave `grid-template-columns` invalid and
collapse the board rather than falling back.

**2. Snake divided the bare width and added the gaps afterwards.** 34 columns means 33px
of gaps plus 8px of frame, added on top of a board that had already spent the whole
screen. Minesweeper had learned this exact lesson on its own 20x20 board; Snake had
not. Both subtract now, before dividing.

**3. `fit-content` boards pushed the page instead of scrolling.** `.butMania` carries
`overflow-x: auto`, but Snake and Tetris override its width with `fit-content` - and a
box that is only ever as wide as its own contents has no overflow to scroll. The
overflow escaped to the page. `max-width: 100%` caps them at the container, which is
what turns the escape back into a scroll inside the board, while `fit-content` still
keeps the frame tight when the board fits.

**4. Centring inside a scroll container hides half the overflow.** `justify-content:
center` overflows a scroll container equally in both directions, and `scrollLeft` stops
at zero, so the left half cannot be reached - the board looks shoved right with its
first columns simply gone. `safe center` falls back to start alignment exactly when it
overflows. The unprefixed value stays first as the fallback.

**5. The Sequence panel had no border-box.** This stylesheet sets `box-sizing` on two
individual rules rather than globally, and the panel mixed `width: min(92vw, 30rem)`
with 18px of padding and a 3px border - a real footprint of 92vw + 42px, about 12px past
the right edge of a 375px phone. It states `border-box` itself now and measures `100%`
of its container rather than the viewport.

**Minesweeper's floor came down from 12px to 10px.** The existing reasoning held - a
floor above what fits does not keep cells tappable, it only guarantees an overflow - but
once the board was measured against the column, 12px had itself become such a floor: a
320px phone needs 11.7px cells to fit the 20x20 board into its 288px column.

`tests/markup/layout.test.js` pins all of it. None of it can be seen without a browser,
but each mistake has a shape in the stylesheet, and that is what the test reads.

## Minesweeper ends in place, and reports the flags

Both changes asked for by the project owner on 2026-09-10, after being caught out twice
by the same thing.

**The end-of-game score counted the wrong thing.** It said how many squares had been
cleared. Clearing squares is the means, not the game: on a board with a big opening
cascade most of them are handed over by one lucky first tap, so the number flattered a
game that had deduced nothing. It reports correctly flagged mines now -
`correctFlagCount` in js/minesweeper.js, beside `misplacedFlagCount`.

Note what those two must never become: a live readout. A running count of correct flags
would hand the player the deduction they are there to make - the same reason
`flagsRemaining` is deliberately unable to tell a right flag from a wrong one, recorded
above. They are the finished game's account, and there is a test that says so.

**The dialog was covering the evidence, so Minesweeper no longer opens it.** Losing
means a deduction went wrong somewhere and the board holds the whole record of it, but
the end-of-game dialog sat on top of exactly that, and the only ways out started a new
game or left the page. Twice this cost the owner the chance to see what he had misread.

The game ends in place instead. The result goes into the status line above the board,
styled as a banner so it carries the weight the dialog would have, and nothing moves.
Everything the dialog offered is already on screen there in this game's own controls:
New Game, and the size to play next. There is nothing to dismiss and nothing to restore.

**How that was arrived at matters more than the answer, because the first two attempts
were both arrangements of the wrong thing.** A Review the board button was added to the
dialog; it was in the wrong place, so it was moved above the mode select; it still read
badly. The tell was there the whole time: a button whose only job is to dismiss the
thing in the way means the thing should not have been in the way. Four options were put
up before this one was picked - among them making the dialog dismissible by tapping
outside, and collapsing it to one primary action with quiet links - and the one chosen
removes the conflict rather than arranging it.

**The dialog is still right for the other four.** Snake, Falling Polyominos and Sequence
end with a board not worth studying, and on a phone their controls have scrolled away
under the pad, which is the problem the dialog was built for. It stays exactly as it
was; only Minesweeper opts out. The `onReview` hook that existed briefly was removed
with it - an unused hook is a guess about the next game, and the reasoning is better
written down here than left as code nobody calls.

**A game that ends in place has to be safe to leave sitting there.** Minesweeper already
was: every cell ignores a tap once the game is over, and the state is immutable. Worth
checking before letting another game end this way.

**Wrong flags are marked, because otherwise there is nothing to read.** A lost board used
to show every flag identically, so the player could see where the mines had been but not
which of their own marks had been wrong - which is the half worth learning from. A flag
that was not on a mine is now a cross in the detonated colours; a flag that was on one
stays a plain flag on unopened ground, since it was right and needs no comment. The mine
that went off and a mistaken flag share those colours deliberately, both being the board
saying where it went against the player: the glyph separates them, a disc against a
cross. Colour is never the difference.

The result line mentions the cross only when there is one on the board. A legend for a
marker that is not there is noise, and on a clean loss there are no misplaced flags to
explain.

**The banner takes the control theme's colours, not a win-green and a lose-red.** Those
are already contrast-checked, and the outcome is carried by the words - putting it on
colour would be putting it on the one channel this site never trusts.

**Nothing steals focus any more.** The status line carries `role="status"`, so the result
is announced when it changes without moving the player anywhere. The `tabindex="-1"` it
briefly needed is gone with the dialog: there is no hidden element left holding focus to
rescue it from.

## Sequence: two corrections from play

Both reported by the project owner on 2026-09-10, after playing it.

**The end-of-game count was reading the round it died on.** `round` goes up the moment
the machine adds a pad, before the player has repeated anything, so a game lost on the
fourth run had `round === 4` while only three had been seen through - and the dialog
credited the player with the round that beat them. `completedRounds` in js/sequence.js
is the honest count: it agrees with `round` only in the READY state, the gap between
rounds where the run has been repeated in full and the next has not started. Every other
state is mid-round, and mid-round means the current one is not earned.

The session Best was reading the same field and happened to be right, because it is only
ever read on round completion - which is exactly that state. It goes through
`completedRounds` now anyway, so both numbers come from one place rather than one being
correct by luck.

**The live readout still shows the round in progress**, so mid-game it can read
`Round: 4 · Best: 3`. That is deliberate - it says which run you are on - but it does
mean Best trails Round by one during play. If that ever reads as a bug rather than as a
label, the readout is the thing to change, not `completedRounds`.

**A pad press now starts the first round.** There are two ways in as a result, the Start
button and the panel itself, which is what was wanted: on a machine covered in buttons,
pressing one is the obvious thing to try, and being ignored teaches the player the panel
is dead when it is only waiting.

Only from an unstarted game - `isUnstarted`, which is READY with no rounds behind it. A
press between rounds is the same READY status and must not start anything, and a press
after a loss is behind the dialog anyway.

**The order of the two lines that do it is load bearing.** The pressed pad is fired
first and the run is scheduled second. Firing the pad sounds it, which builds the audio
context *inside the press* - `startSequenceRun` asks for the context as well, but it
runs from a timer, outside the gesture, and Safari will not start a context from there.
Reordering them would leave the game silent on iOS while working fine on the desktop it
was tested on.

## Tic-Tac-Toe: an opponent you have to work out

Built 2026-09-10 at the project owner's request. Single player. Each game draws its
opponent at random, a third of the time each: **optimal**, **deliberately bad**, or
**random**. Rules and opponents in `js/tictactoe.js`; the clock and the board in
`entertainment.js`.

**The opponent is never revealed** - not during play, not at the end. The owner's call,
chosen over revealing it at the end: working out who you are up against is part of the
game. That makes a rule for everything around it: **nothing may vary with the
opponent.** The obvious leaks are closed off deliberately:

- **The reply delay is fixed** (`TICTACTOE_REPLY_MS`). A delay that tracked how long the
  search took would be a tell. Minimax is memoised, so it is instant anyway, but the pause
  is not allowed to depend on that.
- **Messages are identical** for all three. "The opponent is thinking" is said by the
  random player too.
- **The optimal player's opening says nothing.** It picks at random among all equally
  good moves, and from an empty board every move draws with best play - so all nine are
  equal and its first move is uniform, exactly like the random player's. A perfect player
  that always took the centre would give itself away on move one. Tested.

**Optimal** is full minimax, scored so a sooner win is worth more and a later loss costs
less - otherwise it dawdles through won positions, which looks like a mistake to a person
watching. Tested exhaustively: every player line against every optimal choice, from both
sides, and it never loses.

**Deliberately bad** plays at random, except it never takes a win that is sitting there
and never blocks yours. When every open square is one of those it has no choice and
plays one, so a player who refuses to finish a line can still lose to it. The owner chose
this over "tries to lose" (reverse minimax), knowing it is the harder of the two to tell
apart from random - which, with the opponent hidden, is part of the puzzle rather than a
problem.

**Who goes first alternates.** X always moves first; the player swaps between X and O -
but only once the game before had a move in it. Leaving the view or pressing New Game on
an untouched board is not a game played, so it does not use up a turn at going first.

**The tally** (won / drawn / lost) is session-only and counts finished games only. An
abandoned game counts for nothing, which means a losing position can be dodged with New
Game. Accepted: nobody is being ranked.

**It ends in place, like Minesweeper**, with the result as a banner in the status line and
the winning line struck through - a graphite line over the marks, so the win is a shape
and not only a colour. The dialog would cover the one thing worth looking at.

**The reply is scheduled from `showView`, not from `stopAllGames`.** `stopAllGames` runs
before the new view is unhidden, so when the player is O, a fresh game's opening move
scheduled from there would land on a hidden board, or fire behind another game. The
timer also checks the view is visible when it fires.

The hub tile is reshaped to 3x3 the way Sequence's is to 2x2, and pinned by the same kind
of test.

## Ideas not yet built

Kept with dates and attribution so they can be prioritised later rather than
rediscovered. Nothing here is committed to; it is a record of what was suggested and
when.

### Suggested 2026-09-08, by the project owner

**Splitting the site in two** - a personal site for his own work, and a separate games
site. Not decided, and explicitly a later question, but recorded because it changes what
other decisions are worth making. The photo question above is one of them: a games site
has no reason to carry a family photograph at all, which would settle it by structure
rather than by caching policy.

### Suggested 2026-09-07, by the project owner's daughter

Both came out of the same session that produced the Infinity Snake board and
Minesweeper, several of her ideas from which *were* built.

**Sequence memory game — BUILT 2026-09-09, on screen as Sequence.** The Simon-style kind:
a set of items, each with its own sound. The game plays a sequence, giving a **visual and
an audio cue together** each time an item is used, and the player has to reproduce the
order. The pairing of the two cues was specifically part of the idea, not an
embellishment — it was preserved, and it is what most of the decisions in "Sequence: the
first sound on the site" above turn on. Left here rather than deleted so the idea keeps
its attribution.

What that turned into: the pure rules are in `js/sequence.js`, the audio and the clock
in `entertainment/entertainment.js`. Autoplay policy, the mute control and the
deaf-accessible question were all real and are all answered in the section above.

**Solitaire.** Klondike presumably, though the variant was not specified — worth asking
before building.

Notes for whoever picks it up: the rules are pure and very testable, but this is the
first thing on the site needing **drag and drop**, which runs straight into the touch
work in this file. `touch-action: none` on a draggable area is required for dragging and
also stops the page scrolling, and a tall card layout on a phone needs to scroll. A
tap-to-select-then-tap-to-place scheme avoids that entirely and is usually kinder on
touch than dragging — worth considering before reaching for drag.

## Rule: multiplayer rewards couch play over remote play

**Any multiplayer built here has to be better in the same room than it is apart.** Stated
by the project owner 2026-09-07, as a standard to hold the site to going forward, on the
view that the industry's drift toward remote-by-default play has been a loss.

Note the shape of it: **reward** co-presence, not **prevent** remote. Anything on the web
can be played over a video call if people are determined, and effort spent trying to stop
that is effort wasted on the wrong problem. The test to apply is: *would two people in the
same room have a better time than two people on a call?* If the answer is "about the
same", the design has not honoured the rule yet.

What that means in practice, for whoever builds the first one:

- **One shared screen, phones as controllers.** The game state lives on a screen everyone
  can see. A phone is a controller and a place for private information - not a second
  copy of the game. Give every player their own full view and you have built remote play
  that happens to be in a room.
- **Joining should require being there.** A short code or QR shown *only* on the shared
  screen gates entry to people who can see it. That is a natural consequence of the
  design rather than a restriction bolted on, which is what makes it the right mechanism.
- **Lean on what only co-presence gives you.** Reading a face, talking over each other,
  reacting out loud, passing a phone around. Mechanics built on those are better in person
  because of what they are, not because the remote version was hobbled.
- **Local network only.** No relay server, no accounts, no matchmaking with strangers.
  That keeps latency honest and keeps the scope of the thing small.
- **No spectator-proofing, no anti-cheat.** Both assume adversaries. This is a game for a
  living room.

The rule is a constraint on design, not a feature to implement. It applies to anything
multiplayer added later, including ideas already recorded below.

### Suggested 2026-09-07, by the project owner

**Multiplayer using phones as controllers.** The shared screen would be a laptop or TV
showing the game; each player's phone is their controller. Explicitly subject to the rule
above.

Notes for whoever picks it up: the D-pad work already in this file is most of a phone
controller, so the input side largely exists. The hard part is the connection - peer to
peer on a local network from a static GitHub Pages site is the real constraint, since
there is no server to run and WebRTC still needs signalling from somewhere. That
question is worth settling before any of the game design, because the answer may change
what is possible.

## The Bridge board

From a sketch by the project owner, 2026-09-07. A squared-off arena with a bite out of
the middle of each edge, a bridge running top to bottom, the ground passing left to right
beneath it, and a hole through the middle of the deck.

```
 .......      .......
 .....==========.....
 .....##########.....
 ......########......
  ......##oo##......
 ......########......
 .....##########.....
 .....==========.....
 .......      .......
```

`#` deck over ground · `=` ramp · `o` hole through the deck · `.` open ground

### The corners are square on purpose

The arena began as a circle with wavy sides, which left a **three-square protrusion in
each corner**. Play-testing found the problem: food landing in one had to be fetched down
a narrow dead end and backed out of, and it got worse when the pocket sat beside an
entrance to the bridge, where a wrong line costs the run. That made the Bridge play
*harder than Infinity* — and by a kind of demand no other map makes. Infinity is
constrained everywhere and asks for commitment; a pocket asks for precise routing in one
spot, which is a different and less interesting difficulty.

So the corners are filled out to the edge and only the notches remain: every part of the
arena is now approachable from two directions, and nothing traps. The notches shape the
space without costing anything.

The lesson generalises — **a narrow dead end is worth more difficulty than its size
suggests**, especially next to something that already demands precision. Look for them
when adding a map, and prefer shapes where every region can be entered and left by
different routes.

464 nodes. It is the first **open arena** — every other map
is a track you follow. Off the deck you can wander anywhere, and only the outer wall and
the hole will kill you.

### Three levels, not a curve

Every other map derives its strands from a curve, and the default continuity rule handles
them. **This one has no curve.** Its strands are levels: ground `0`, ramp `0.6`, deck `1`,
joined by `linkByLevel(0.6)` — the `link` seam the tooling was built with, used in anger
for the first time.

Ground and deck are 1.0 apart, so they never connect: **you cannot climb onto the bridge
from underneath.** Ramps sit between and reach both.

**The ramp's 0.6 is not arbitrary.** Put it halfway at 0.5 and stepping off it is a tie —
0.5 to the deck, 0.5 to the ground — resolved by whichever strand happens to be listed
first, which is meaningless. At 0.6 the deck is nearer, so walking down a ramp puts you on
the bridge, as walking down a ramp should. The spacing carries the meaning.

### The hole is an absence, not a feature

The gap in the deck is a deck cell **with no deck strand**. Everything follows from that,
with no special cases anywhere:

- A snake on the deck finds nothing continuing its level and falls. `failureAt` reports
  `FALL` — "Fall damage is real." — because a gap square is perfectly good ground, so the
  only way to fail entering one is to have been up on the deck.
- A snake on the ground walks straight through, because its own level is untouched.
- **It is lit as it passes.** Under the deck a cell has two strands and `isUnderneath` is
  true, so the snake draws in the underneath colour. In the gap the cell has one strand,
  `isUnderneath` is false, and it draws normal — then shaded again beyond. Daylight
  through the hole, and not a line of rendering code: it falls out of the model.

The deck's bold outline and the crossing hatch come free from the same machinery the
Infinity board uses, which is why the rendered board matches the sketch's heavy edges
around the deck and around the hole.

### Where it sits on the difficulty gradient

Aimed between Donut and Infinity, and closer to the easy end. The arena is open and forgiving, and
the bridge is optional — you can play the whole board without ever going up. That is a
different axis from Infinity's constrained ribbon rather than a step below it, and worth
a verdict from play rather than from the node count.

### The deck is an hourglass, and the ends are abutments

Both from play-testing, and both corrections to my first reading of the sketch.

**The deck is broad where it meets the ground and drawn in at the waist** — `halfEnd: 4.5`
down to `halfMid: 2.5`, parabolic between, 10 squares wide at either end and 6 through
the middle. I built it the other way round first, barrel rather than hourglass, from
misreading which way the drawn curves bowed. Wide ends make it easy to get onto and
easy to leave; the pinch is the part that asks something of you, and it sits where the
hole is.

The taper is measured across **the raised deck**, not the whole band, so the widest
point lands where the deck begins rather than out on the approach. `inBand` is also
clamped to the band's own rows: without that the widening runs away past the ends of the
bridge and swallows the scraps of ground in the arena's corners.

**A ramp is reached from beside it, or head-on from past the end of the bridge — never
from underneath.** That is the abutment. Without it the underside had no wall at all: a
snake could walk the length of the underpass, reach the far end and climb straight out,
and nothing down there could kill it but the perimeter. That is what the first
play-test found.

The first attempt at the rule was too blunt — it blocked *every* vertical step between
ground and ramp, including the legitimate approach onto the ramp's outer end, which
stranded the corner scraps of ground with no way onto the board. Both moves are the same
pair of levels, so only the geometry separates them:

```js
if (step.y === 0) return true;                              // from the side
const ground = from.param === GROUND ? from : to;
return ground.y < deckTop || ground.y > deckBottom;         // past the end, not beneath
```

Which is why the rule is built from the mask rather than being a constant, and why
`buildBridgeMask` returns `deckTop` and `deckBottom` alongside the cells.

It reports as `UNDERPASS` — "Structural Impact: Hit the underpass wall" — which is what
an abutment is. **The reachability test is what caught the over-blocking**, and is worth
running against any change to a link rule: a rule that is too permissive makes a boring
map, but one that is too strict silently strands part of the board.

### Death messages on the Bridge, and the mode order

Three ways to die that are the Bridge's own, told apart by the square being moved into
rather than by the map being asked which one it is:

| square | reported | message |
|---|---|---|
| a gap in the deck | `FALL` | "Fall damage is real." |
| a ramp, approached from underneath | `ABUTMENT` | "Endings are hard." |
| outside the arena | `WALL` | the usual perimeter message |

Both of the first two work because **the square identifies the death**. A gap is good
ground, so the only way to fail entering one is to have been on the deck. A ramp can be
walked onto from the side or from past the end of the bridge, so the only way to be
refused one is to have come at it from underneath. Neither needs the game to track how
the snake got there.

The mode dropdown is ordered **Classic, Donut, Bridge, Infinity** — by how hard they
play, not by when they were built. Bridge sits third: harder than Donut because the
crossing and the hole ask something of you, much easier than Infinity because the arena
is open and the bridge is optional. See the difficulty-gradient note above.

## Food occludes by layer, like everything else

A snake passing under a surface used to paint over food sitting on top of it. The snake
was simply drawn after the food and overwrote the cell, so it won regardless of which of
the two was actually on top.

Segments already occlude each other by layer — that is what makes a crossing read as
over-and-under. The food was just not part of that comparison. It is now: where a snake
segment shares a cell with the food, the higher layer is drawn.

So a snake underneath leaves food on the deck visible, and a snake on the deck still
covers food underneath. It compares layers rather than always yielding to the food,
because both directions are real.

Worth stating why it mattered beyond looking wrong: it hid the one thing the player is
steering toward, at exactly the moment they could not reach it anyway — so it read as
the food having vanished rather than as the snake being beneath it.

### Where the Bridge's difficulty ended up

Confirmed by play 2026-09-08, after squaring off the corners: it sits between Donut and
Infinity, and the hard part is **food tucked into the inside of the deck's curve at
either end**. That is the right place for it — the pinch is a consequence of the shape
rather than an obstacle added to make the map harder, and it is a demand for commitment
rather than for precise routing down a dead end, which is what the corner pockets used
to be.

One structural difference from Infinity worth knowing. On Infinity the shortest loop from
one strand back to the other is **24 moves**, so the snake cannot pass over itself until
roughly score 240. On the Bridge it is **4 moves** — near the ends of the deck the ground
beside the bridge is close enough to go up, along and back under almost immediately — so
the over/under mechanic is reachable from about five segments.

That is a large part of why the Bridge reads as the friendlier map despite sharing the
machinery: its signature move is available from the first few seconds, where Infinity
holds it back until the snake is long.

## Snake wears the Pacific Northwest palette too

Snake and Minesweeper now share a world: pale lichen for open ground, evergreen for
what cannot be crossed, deep canopy behind the board.

| | |
|---|---|
| open ground | `#e6e9dc` Lichen |
| blocked ground | `#35543f` → `#2a4232` Evergreen, a gradient |
| head | `#16241a` Deep Canopy |
| body / underneath | `#2c5418` Fern / `#4c6b34` Sunlit Fern |
| food / underneath | `#204c7c` Lake / `#286890` Shallows |

**Moving off white forced the whole ladder darker.** The old colours sat right on the
4.5:1 floor against white — `bodyUnder` at 4.98, `foodUnder` at 4.99 — so tinting the
ground at all pushed both under it. Lighter-means-underneath fights a light background,
and the room has to come from darkening what sits on top. That is the second time this
has come up; it is a property of the metaphor, not a one-off.

**Blocked ground gets the gradient, open ground does not.** Nothing is ever drawn on
blocked ground — the snake and the food only occupy open ground — so it is free to be
decorative. Open ground stays flat because the crossing hatch is a `background-image`
and a gradient there would be competing for the same slot. Blocked cells are also no
longer repainted every frame, since they never change.

**Food and blocked ground are almost the same lightness** — 1.04:1 — and are told apart
on the blue-yellow axis, which survives both kinds of colour blindness. What keeps the
food findable is its 6.9:1 against the pale ground it actually sits on.

Two older tests were removed as part of this: they measured the snake against `#ffffff`,
which stopped being the board's colour. They still passed, because the colours clear the
floor on white too — which is exactly what makes a stale test worth deleting rather than
leaving. It was no longer checking the thing its name claimed.

## Display names are not the names in the code

On screen the games are **Falling Polyominos**, **Snake**, **Mine Sweeper** and **Finger
Paint**. In the source they are still `tetris`, `snake`, `minesweeper` and `toy` — ids,
classes, hash routes, variables, palettes, test files, all of it.

Renaming the internals would touch every selector, the hash routes, the palettes and
all nine test files, and change nothing a player sees. So the mapping stays, and it is
written down in CLAUDE.md as well: **searching the codebase for a display name will find
nothing.** Search for the internal one.

Only the markup carries the display names — eight strings in
`entertainment/entertainment.html`. No player-visible string in the JavaScript names a
game, which is why the rename was contained to one file.

## The site loads nothing from anywhere else

`normalize.css` used to come from cdnjs. It is now `vendor/normalize.css`, served from
this repo, and both pages point at it with the usual `?v=` stamp.

It was the only third-party subresource on the site, and it carried three separate
problems for 1.9KB of CSS:

- **Every visitor's browser contacted Cloudflare**, which saw their IP and the referring
  page — a third party on a personal site that gained nothing by being there.
- **The bytes were not integrity-checked.** There was no `integrity` attribute, so the
  pages applied whatever the CDN returned. CSS cannot run scripts, so the blast radius is
  smaller than a compromised `<script>`, but it can still hide or overlay content.
- **It failed with no network**, taking the reset with it — the one thing a page of
  offline games ought to survive.

Vendored rather than deleted, deliberately: removing it would change how the pages look
in ways that need checking element by element, while vendoring is identical by
construction — the same bytes, from your own origin. The MIT licence header is kept in
the file, which is the condition for redistributing it.

`tests/markup/ids.test.js` now fails on any stylesheet, script, image or media loaded
from another origin, so a CDN link cannot quietly come back. Verified by putting the old
one back and watching it fail. Footer links to GitHub and LinkedIn are untouched: those
are somewhere the reader chooses to go, not something the page fetches for them.

The practical upshot is that the site is now **entirely self-contained** — which is what
makes offline play a matter of caching files rather than a matter of dependencies.

## Offline play: the service worker

`sw.js` precaches the whole site — 13 files, 448KB — so a device that has visited once
works with no network. Registered by `scripts/offline.js`, included on both pages.

**Documents are network-first, everything else cache-first.** That split is the whole
safety design. Assets carry `?v=` stamps, so a cache hit is never a stale hit — the URL
changes when the contents do. Documents are the exception because the HTML is what
*names* the current stamps: fetching it from the network first means anyone with a
connection always lands on the newest build, and the cache is only the fallback for
being offline.

**`VERSION` in `sw.js` must be bumped with every push**, alongside `LAST_UPDATED` and
the `?v=` stamps. It is the most consequential of the manual bumps: the others go stale
for ten minutes, while a service worker caches until told otherwise. A `VERSION` left
behind pins an old build on every device that has visited, with no obvious way for its
owner to clear it. The cache is named after `VERSION`, and a new name is what deletes
the old files — so if it drifts, nothing is ever retired. `tests/markup/ids.test.js`
fails if it disagrees with the pages.

`skipWaiting()` and `clients.claim()` are there for the same reason: a worker that waits
for every tab to close is a worker that keeps serving the old build.

**It does not register on localhost.** `tools/dev-server.js` sends `Cache-Control:
no-store` so an edit shows on the next refresh, and a worker serving assets from its own
cache would quietly undo that — you would edit `style.css`, reload, and see the previous
version with nothing to explain why.

Verified by stopping the dev server and reloading: nav, stylesheet, both game boards,
the modules and the footer all came back with nothing listening on the port.

**If it ever needs killing**, push an `sw.js` whose `install` calls
`self.registration.unregister()`. Deleting the file is not enough — browsers keep the
worker they already have.

### The family photo is not precached

Deliberate, and worth keeping deliberate.

Caching it would expose nothing a visit does not already - a browser stores it in the
ordinary HTTP cache either way, sandboxed to this origin. But a service worker holds it
far longer and more purposefully, on the device of everyone who has ever opened the
page. And it buys nothing for the reason the worker exists: offline play means the
games, and the entertainment page never references the photo.

Leaving it out takes the precache from 448KB to **168KB** at no cost to anything anyone
wanted offline. The home page still loads without a network; the picture hides itself
rather than showing a broken-image icon.

Both photos in the repo were checked for embedded metadata and have none - no EXIF, no
GPS, no camera model or timestamp. That is the failure mode that actually harms people
and it is absent, but it is worth re-checking before adding any new photo.

**The real exposure was never the cache.** The photo is on a public site and in a public
repo, and the superseded one from before the swap is still retrievable from history in
commit `0eabb87`. Deleting a file does not remove it from history; that needs a rewrite,
which breaks every existing clone. Worth doing deliberately if ever wanted, not as a
side effect of a caching decision.

### What stops caches like this filling up a phone

Quotas and eviction, not restraint. Browsers cap what one origin may store and evict
least-recently-used data when disk runs short; storage is best-effort unless a site
asks for persistence, which this one does not. Measured on a desktop Chrome: this site
uses **448KB against a 10GB quota**, about 0.004%. Safari is stricter still and clears
script-writable storage, service worker included, after roughly a week without a visit.
