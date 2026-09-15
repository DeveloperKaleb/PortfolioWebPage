/* Zooming a board whose cells are too small to tap.
 *
 * Built for Minesweeper, whose 20x20 board lands at about 14px a cell on a phone and
 * whose 40x40 board cannot fit one at a tappable size at all. Nothing in here knows
 * about mines: a board is anything with a width and a height, counted in cells from 1,
 * the way js/minesweeper.js counts them.
 *
 * Pure maths, no DOM and no timers - the drag, the measuring and the drawing live in
 * entertainment.js. See NOTES.md, "Zooming the Minesweeper board".
 */

/* Zoom levels are counted in cells across the window, not as a magnification. "2x" is a
   different window on every board and every phone; "10 across" is the same window
   everywhere. Widest first.

   The closest is 10 across, the Standard board's width. The first levels were 10, 7 and
   5; the project owner found 5 across dwarfed by the map, and the Standard board already
   very easy to tap, so nothing closer than it is offered. */
export const ZOOM_STEPS = [15, 12, 10];

/* The fewest cells a view may show: set by the project owner as 21 - a 5x5 window, or a
   round one less its four corners. The closest level now shows 100, so this is the
   floor any future level is held to rather than a limit anything is near. */
export const MIN_WINDOW_CELLS = 21;

/* 24px is the WCAG 2.2 minimum target size (2.5.8, AA): a finger's tap on anything
   smaller zooms in rather than playing. */
export const TAP_FLOOR_PX = 24;

// How far a press has to travel before it is a drag rather than a tap.
export const DRAG_THRESHOLD_PX = 8;

/* The board's sizing, mirrored from #mineDisplay in style.css so cell sizes can be
   predicted without a browser. tests/markup/layout.test.js checks the two agree. */
export const BOARD_GAP_PX = 2;
export const BOARD_FRAME_PX = 16; // 6px of padding and a 2px border, each side
export const BOARD_HEIGHT_VH = 52;
export const CELL_FLOOR_PX = 4;
export const WHOLE_CELL_CAP_PX = 40;
export const ZOOM_CELL_CAP_PX = 96;

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/* A view is { across, left, top }: `across` is null for the whole board or one of the
   zoom steps, and left/top name the board cell in the window's top-left corner. */
export const wholeView = () => ({ across: null, left: 1, top: 1 });

// A level is only worth offering if it shows less than the whole board.
export const zoomLevels = (board) =>
    ZOOM_STEPS.filter((across) => across < Math.max(board.width, board.height));

export const windowSize = (board, across) => (across === null
    ? { cols: board.width, rows: board.height }
    : { cols: Math.min(across, board.width), rows: Math.min(across, board.height) });

export function clampView(board, view) {
    const { cols, rows } = windowSize(board, view.across);
    return {
        across: view.across,
        left: clamp(view.left, 1, board.width - cols + 1),
        top: clamp(view.top, 1, board.height - rows + 1),
    };
}

// The window at this level with (x, y) as near its middle as the board's edges allow.
export function centreOn(board, across, x, y) {
    const { cols, rows } = windowSize(board, across);
    return clampView(board, {
        across,
        left: x - Math.floor((cols - 1) / 2),
        top: y - Math.floor((rows - 1) / 2),
    });
}

export function viewCentre(board, view) {
    const { cols, rows } = windowSize(board, view.across);
    return {
        x: view.left + Math.floor((cols - 1) / 2),
        y: view.top + Math.floor((rows - 1) / 2),
    };
}

export function canZoomIn(board, view) {
    const levels = zoomLevels(board);
    if (view.across === null) return levels.length > 0;
    return levels.indexOf(view.across) < levels.length - 1;
}

/* One step closer, centred on `focus` - by default the middle of the current window, so
   the buttons zoom about what is on screen. Hands back the same view when there is
   nowhere closer to go. */
export function zoomIn(board, view, focus = viewCentre(board, view)) {
    if (!canZoomIn(board, view)) return view;
    const levels = zoomLevels(board);
    const next = view.across === null ? levels[0] : levels[levels.indexOf(view.across) + 1];
    return centreOn(board, next, focus.x, focus.y);
}

export function zoomOut(board, view) {
    if (view.across === null) return view;
    const levels = zoomLevels(board);
    const index = levels.indexOf(view.across);
    if (index <= 0) return wholeView();
    const { x, y } = viewCentre(board, view);
    return centreOn(board, levels[index - 1], x, y);
}

export const panView = (board, view, dCols, dRows) =>
    clampView(board, { ...view, left: view.left + dCols, top: view.top + dRows });

/* A drag, measured from where the press started, in whole cells. The board follows the
   finger the way a map does - drag right and the window moves left - and moves only in
   whole cells, so the window is always exactly its level's size. `pitch` is a cell plus
   the gap after it. */
export const dragView = (board, start, dxPx, dyPx, pitchPx) =>
    panView(board, start, -Math.round(dxPx / pitchPx), -Math.round(dyPx / pitchPx));

/* A new game keeps the player's zoom level if the new board offers it, and starts in
   the middle - the old window's position means nothing on a fresh board. */
export function viewForBoard(board, previous) {
    const across = previous && zoomLevels(board).includes(previous.across) ? previous.across : null;
    return centreOn(board, across, Math.ceil(board.width / 2), Math.ceil(board.height / 2));
}

/* The rule taken from tap-to-zoom: on the whole board, a finger's tap on a cell under the
   floor zooms in on it instead of playing it. Once zoomed, every tap plays, whatever the
   size - the project owner found a second zoom from a zoomed view jarring. Whether the
   press came from a finger is the caller's call. */
export const tapZooms = (board, view, cellPx) =>
    view.across === null && cellPx < TAP_FLOOR_PX && canZoomIn(board, view);

/* Where a tap on the whole board goes when it zooms: straight to the widest level whose
   cells will clear the floor. It is the only zoom a tap ever makes - once zoomed, taps
   play - so it has to land somewhere playable in one go. Each level's size is estimated
   from the cells' size now, the window's span shared among fewer cells; tests/boardzoom
   checks the estimate lands on 24px or more at real phone sizes. If no level clears the
   floor, the closest. */
export function zoomForTap(board, view, cellPx, focus) {
    const levels = zoomLevels(board);
    const closer = view.across === null ? levels : levels.slice(levels.indexOf(view.across) + 1);
    if (closer.length === 0) return view;
    const { cols } = windowSize(board, view.across);
    const span = (cellPx + BOARD_GAP_PX) * cols;
    const target = closer.find((across) => span / across - BOARD_GAP_PX >= TAP_FLOOR_PX)
        ?? closer[closer.length - 1];
    return centreOn(board, target, focus.x, focus.y);
}

// The overview: whole pixels a cell, as large as fits in maxPx.
export const minimapScale = (board, maxPx) =>
    Math.max(1, Math.floor(maxPx / Math.max(board.width, board.height)));

export const cellAtMinimap = (board, px, py, scale) => ({
    x: clamp(Math.floor(px / scale) + 1, 1, board.width),
    y: clamp(Math.floor(py / scale) + 1, 1, board.height),
});

/* What the stylesheet's --mine-fit comes to, rounded down to whole pixels as the
   @supports block does. columnPx is the page column (--board-space); the height budget
   has no frame subtracted, because the stylesheet's has none. */
export function predictCellSize({ cols, rows, columnPx, viewportHeightPx, zoomed = false }) {
    const byWidth = (columnPx - (cols - 1) * BOARD_GAP_PX - BOARD_FRAME_PX) / cols;
    const byHeight = ((BOARD_HEIGHT_VH / 100) * viewportHeightPx - (rows - 1) * BOARD_GAP_PX) / rows;
    const cap = zoomed ? ZOOM_CELL_CAP_PX : WHOLE_CELL_CAP_PX;
    return Math.floor(Math.max(CELL_FLOOR_PX, Math.min(byWidth, byHeight, cap)));
}
