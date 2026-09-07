# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See `NOTES.md` for non-obvious decisions and gotchas from past work on this repo (why
certain CSS/layout choices exist, the manual cache-busting workflow, etc.) — check it
before re-deriving something that's already been debugged once.

## What this is

A static, vanilla HTML/CSS/JS personal portfolio site with no build step. It is deployed as-is via GitHub Pages at `https://developerkaleb.github.io/PortfolioWebPage/` from this repo (`DeveloperKaleb/PortfolioWebPage`). There is no bundler, framework, or transpilation — files are served directly, so any path/script reference must work unmodified in the browser.

## Commands

- Run all tests: `npm test` (runs `vitest`)
- Run a single test file: `npx vitest run tests/snake/snake.test.js`
- Run tests matching a name: `npx vitest run -t "isWallCollision"`
- Preview the site locally: `npm run dev` (serves the working tree at
  `http://localhost:8123/PortfolioWebPage/`, caching disabled). Add `--open` to launch a
  browser, `-- --port 8124` to move it. This is the only preview that works — see the
  path-conventions gotcha below for why opening `index.html` off the filesystem does not.
- There is no build or lint script defined in `package.json`.

## Path conventions (important gotcha)

Because the site is hosted at the `/PortfolioWebPage/` subpath on GitHub Pages, script/stylesheet references are inconsistent between absolute and relative paths across files:
- `index.html` uses relative paths (`scripts/nav.js`, `./index.js`, `style.css`).
- `entertainment/entertainment.html` and `scripts/nav.js` use paths hardcoded to `/PortfolioWebPage/...` (an absolute path baked into `nav.js` as `basePath`).

This means the site only fully works when served from that exact subpath (as on GitHub Pages) — opening `entertainment.html` from a local file path or a differently-named deployment will break the nav bar and stylesheet links. When editing navigation or adding new top-level pages, keep this `basePath` convention in mind rather than mixing in root-relative paths. `npm run dev` exists precisely to satisfy this constraint locally — see `tools/dev-server.js`.

## Architecture

**Two pages, shared nav and styles:**
- `index.html` — homepage/bio.
- `entertainment/entertainment.html` — a hub page for four browser-based toy/game systems (Tetris, Snake, Minesweeper, and an "Array Grid" color-painting toy), all rendered into `.butMania` grid containers of `<button>` cells. The page shows a landing grid of thumbnail cards (`#entertainment-hub`, split into Games/Toys) by default; clicking a card hides the hub and shows that game/toy's section (`.game-view`) full-screen, with a Back button to return. View switching is a plain URL-hash router (`#tetris`, `#snake`, `#minesweeper`, `#toy`) implemented in `entertainment.js` — no routing library.
- `scripts/nav.js` — injects the shared `<nav>` markup into `<header id="global-nav">` on both pages and highlights the active link. Any new top-level page needs a `<header id="global-nav">` element and a `<script src="/PortfolioWebPage/scripts/nav.js">` include to get navigation.
- `style.css` — single global stylesheet for both pages, including the grid/game board styling (`.butMania`, `#tetrisDisplay`, etc.).

**Game/toy logic split (pure logic in `js/`, DOM/state in `entertainment/`):**

The pure layer is four modules, all free of `document`/DOM calls so they stay testable
under Vitest without a browser:

- `js/logic.js` — grid HTML generation, Snake movement/collision maths, Tetris piece
  definitions and rotation, board masks and shapes, and every game palette. Colours live
  here rather than beside the markup so the contrast rules can be asserted against them.
- `js/contrast.js` — the colour rules: WCAG contrast, colour-blindness simulation, and
  the thresholds everything else is measured against. See NOTES.md before changing a
  colour anywhere.
- `js/strands.js` — boards whose cells can hold more than one piece of track, for maps
  that cross over themselves. Map-agnostic; the Infinity Snake board is its first user.
- `js/minesweeper.js` — Minesweeper rules: mine placement, cascades, flags, chording,
  win/lose. Immutable, so every function returns a new game.

`entertainment/entertainment.js` is the DOM/state layer for all four games and the toy:
rendering, game loops (`setInterval`), input handling and score/status UI. It imports
the modules above as ES modules (loaded via `<script type="module">`).

Tests in `tests/` import the pure modules directly. Those are the files to edit when
changing game rules; keep them pure.

When making changes, edit the pure module and `entertainment/entertainment.js` together.
