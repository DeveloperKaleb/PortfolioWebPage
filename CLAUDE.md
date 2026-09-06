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
- `entertainment/entertainment.html` — a hub page for three browser-based toy/game systems (Tetris, Snake, and an "Array Grid" color-painting toy), all rendered into `.butMania` grid containers of `<button>` cells. The page shows a landing grid of thumbnail cards (`#entertainment-hub`, split into Games/Toys) by default; clicking a card hides the hub and shows that game/toy's section (`.game-view`) full-screen, with a Back button to return. View switching is a plain URL-hash router (`#tetris`, `#snake`, `#toy`) implemented in `entertainment.js` — no routing library.
- `scripts/nav.js` — injects the shared `<nav>` markup into `<header id="global-nav">` on both pages and highlights the active link. Any new top-level page needs a `<header id="global-nav">` element and a `<script src="/PortfolioWebPage/scripts/nav.js">` include to get navigation.
- `style.css` — single global stylesheet for both pages, including the grid/game board styling (`.butMania`, `#tetrisDisplay`, etc.).

**Game/toy logic split (production code lives in `js/logic.js`):**
- `js/logic.js` is the single source of truth for all pure, framework-free logic used by the entertainment page: grid HTML generation, Snake collision/movement math, and Tetris piece definitions/rotation/collision. It has no DOM dependency and is unit-tested directly.
- `entertainment/entertainment.js` is the DOM/state layer: it imports from `js/logic.js` as an ES module (loaded via `<script type="module">`) and handles rendering, game loops (`setInterval`), input handling, and score/level UI updates for all three toys/games on that page.
- Tests in `tests/` import directly from `js/logic.js` — that's the file to edit when changing game rules, and the file to keep pure (no `document`/DOM calls) so it stays testable under Vitest without a browser environment.

When making changes to game logic or the toy page, edit `js/logic.js` (pure logic) and `entertainment/entertainment.js` (DOM/state layer) together.
