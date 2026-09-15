import { describe, test, expect } from 'vitest';
import {
    ZOOM_STEPS, MIN_WINDOW_CELLS, TAP_FLOOR_PX, BOARD_GAP_PX, BOARD_FRAME_PX,
    wholeView, zoomLevels, windowSize, centreOn, viewCentre, canZoomIn, zoomIn, zoomOut,
    dragView, viewForBoard, tapZooms, zoomForTap, minimapScale, cellAtMinimap, predictCellSize,
} from '../../js/boardzoom.js';
import { PRESETS } from '../../js/minesweeper.js';

const boards = Object.entries(PRESETS);
const zoomable = boards.filter(([, board]) => zoomLevels(board).length > 0);

// Every view a board can be seen in: whole, and each zoom level.
const viewsOf = (board) => [wholeView(), ...zoomLevels(board).map((across) => centreOn(board, across, 1, 1))];

describe('Zoom levels', () => {
    test('count cells across, widest first', () => {
        expect(ZOOM_STEPS).toEqual([...ZOOM_STEPS].sort((a, b) => b - a));
    });

    test('are only offered when they show less than the whole board', () => {
        expect(zoomLevels({ width: 10, height: 10 })).toEqual([]);
        expect(zoomLevels({ width: 20, height: 20 })).toEqual([15, 12, 10]);
        expect(zoomLevels({ width: 40, height: 40 })).toEqual([15, 12, 10]);
    });

    /* The project owner found the Standard board very easy to tap, and anything closer
       than it dwarfed the window against the map. */
    test('the closest level is as wide as the Standard board', () => {
        expect(ZOOM_STEPS[ZOOM_STEPS.length - 1]).toBe(PRESETS.standard.width);
    });

    test('every board larger than Standard has more than one level', () => {
        boards
            .filter(([, board]) => board.width > PRESETS.standard.width)
            .forEach(([, board]) => expect(zoomLevels(board).length).toBeGreaterThan(1));
    });

    // The project owner's floor: 25, or 21 for a round window less its corners.
    test.each(boards)('%s: no view ever shows fewer than 21 cells', (_name, board) => {
        viewsOf(board).forEach((view) => {
            const { cols, rows } = windowSize(board, view.across);
            expect(cols * rows).toBeGreaterThanOrEqual(MIN_WINDOW_CELLS);
        });
    });
});

describe('Moving the window', () => {
    const board = { width: 20, height: 20 };

    test('centring puts the cell in the middle of the window', () => {
        const view = centreOn(board, 10, 10, 10);
        expect(view).toEqual({ across: 10, left: 6, top: 6 });
        expect(viewCentre(board, view)).toEqual({ x: 10, y: 10 });
    });

    test('centring near an edge keeps the window on the board', () => {
        expect(centreOn(board, 10, 1, 1)).toEqual({ across: 10, left: 1, top: 1 });
        expect(centreOn(board, 10, 20, 20)).toEqual({ across: 10, left: 11, top: 11 });
    });

    test('zooming in steps through the levels about the same spot', () => {
        let view = zoomIn(board, wholeView(), { x: 10, y: 10 });
        expect(view.across).toBe(15);
        expect(viewCentre(board, view)).toEqual({ x: 10, y: 10 });

        view = zoomIn(board, view);
        expect(view.across).toBe(12);
        expect(viewCentre(board, view)).toEqual({ x: 10, y: 10 });

        view = zoomIn(board, view);
        expect(view.across).toBe(10);
        expect(canZoomIn(board, view)).toBe(false);
        expect(zoomIn(board, view)).toBe(view);
    });

    test('zooming out retraces the steps to the whole board', () => {
        let view = centreOn(board, 10, 10, 10);
        view = zoomOut(board, view);
        expect(view.across).toBe(12);
        view = zoomOut(board, view);
        expect(view.across).toBe(15);
        view = zoomOut(board, view);
        expect(view).toEqual(wholeView());
        expect(zoomOut(board, view)).toBe(view);
    });

    test('a drag moves the board with the finger, in whole cells', () => {
        const start = centreOn(board, 10, 10, 10);
        expect(dragView(board, start, 3, 0, 32)).toEqual(start);
        expect(dragView(board, start, 32, 0, 32)).toEqual({ ...start, left: 5 });
        expect(dragView(board, start, 0, -65, 32)).toEqual({ ...start, top: 8 });
        expect(dragView(board, start, 10000, 10000, 32)).toEqual({ across: 10, left: 1, top: 1 });
    });

    test('a new board keeps the zoom level if it has it, and starts in the middle', () => {
        const huge = { width: 40, height: 40 };
        const small = { width: 10, height: 10 };
        expect(viewForBoard(huge, centreOn(board, 12, 3, 3))).toEqual(centreOn(huge, 12, 20, 20));
        expect(viewForBoard(small, centreOn(board, 12, 3, 3))).toEqual(wholeView());
        expect(viewForBoard(board, centreOn(huge, 15, 3, 3)).across).toBe(15);
    });
});

describe('A tap on a cell too small to hit zooms in instead', () => {
    const board = { width: 20, height: 20 };

    test('below the floor a tap zooms', () => {
        expect(tapZooms(board, wholeView(), 14)).toBe(true);
    });

    test('at the floor and above a tap plays', () => {
        expect(tapZooms(board, wholeView(), TAP_FLOOR_PX)).toBe(false);
    });

    test('at the closest level a tap always plays, whatever the size', () => {
        expect(tapZooms(board, centreOn(board, 10, 1, 1), 20)).toBe(false);
    });

    /* Whole at 14px a cell, the board spans 320px: 15 across would be about 19px, 12
       across about 25px. Stepping would stop at 15 and ask for another tap. */
    test('it goes straight to the widest level that will play', () => {
        expect(zoomForTap(board, wholeView(), 14, { x: 10, y: 10 })).toEqual(centreOn(board, 12, 10, 10));
    });

    test('from a zoomed view it only ever goes closer', () => {
        expect(zoomForTap(board, centreOn(board, 15, 10, 10), 19, { x: 10, y: 10 }).across).toBe(12);
    });

    test('when no level would clear the floor, it goes to the closest', () => {
        expect(zoomForTap({ width: 40, height: 40 }, wholeView(), 4, { x: 1, y: 1 }).across).toBe(10);
    });
});

describe('The overview', () => {
    test.each([[10, 8], [20, 4], [40, 2]])('a %i-wide board draws at %ipx a cell, 80px across', (size, scale) => {
        expect(minimapScale({ width: size, height: size }, 80)).toBe(scale);
    });

    test('a press lands on the cell under it, and never off the board', () => {
        const board = { width: 20, height: 20 };
        expect(cellAtMinimap(board, 0, 0, 4)).toEqual({ x: 1, y: 1 });
        expect(cellAtMinimap(board, 9, 5, 4)).toEqual({ x: 3, y: 2 });
        expect(cellAtMinimap(board, 80, -3, 4)).toEqual({ x: 20, y: 1 });
    });
});

/* The pass mark: on a phone, the closest level is as easy to tap as the Standard board
   - which the project owner judged by playing it - and nothing smaller than 24px is
   ever played by a tap. Sizes come from predictCellSize, which mirrors the stylesheet;
   tests/markup/layout.test.js holds the two together. Whether it feels easier is still
   a play test; this is the part a test can hold. */
describe('The pass mark: tapping is measurably easier on a phone', () => {
    // Portrait phones. Below 720px the page column is 90% of the viewport.
    const phones = [['320x568', 320, 568], ['375x667', 375, 667], ['412x915', 412, 915]];

    const sizeOn = (board, view, width, height) => {
        const { cols, rows } = windowSize(board, view.across);
        return predictCellSize({
            cols, rows, columnPx: width * 0.9, viewportHeightPx: height, zoomed: view.across !== null,
        });
    };

    test('where it started: the 20x20 board, whole, is 14px a cell on a 375px phone', () => {
        expect(sizeOn(PRESETS.large, wholeView(), 375, 667)).toBe(14);
    });

    describe.each(phones)('on a %s phone', (_phone, width, height) => {
        test.each(zoomable)('%s: the closest level is as easy to tap as the Standard board', (_name, board) => {
            const levels = zoomLevels(board);
            const closest = centreOn(board, levels[levels.length - 1], 1, 1);
            expect(sizeOn(board, closest, width, height))
                .toBeGreaterThanOrEqual(sizeOn(PRESETS.standard, wholeView(), width, height));
        });

        test.each(boards)('%s: a tap never plays a cell under 24px', (_name, board) => {
            viewsOf(board).forEach((view) => {
                const size = sizeOn(board, view, width, height);
                expect(size >= TAP_FLOOR_PX || tapZooms(board, view, size)).toBe(true);
            });
        });

        test.each(zoomable)('%s: one tap on the whole board reaches a level that plays', (_name, board) => {
            const whole = sizeOn(board, wholeView(), width, height);
            const view = zoomForTap(board, wholeView(), whole, { x: 1, y: 1 });
            expect(sizeOn(board, view, width, height)).toBeGreaterThanOrEqual(TAP_FLOOR_PX);
        });

        test.each(boards)('%s: the whole board still fits the column', (_name, board) => {
            const size = sizeOn(board, wholeView(), width, height);
            const footprint = board.width * size + (board.width - 1) * BOARD_GAP_PX + BOARD_FRAME_PX;
            expect(footprint).toBeLessThanOrEqual(width * 0.9);
        });
    });
});
