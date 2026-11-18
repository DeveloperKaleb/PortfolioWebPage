import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fullScreenSizeFor, resizedView, initialView, zoomAt, toScreen, zoomLevel, MAP_GUTTER } from '../../js/rubinview.js';

describe('The map in full screen', () => {
    test('is as large as fits the shorter side, less the controls and the gutter', () => {
        expect(fullScreenSizeFor(1920, 1080, { above: 110 })).toBe(1080 - 110 - MAP_GUTTER);
        expect(fullScreenSizeFor(412, 915, { above: 150 })).toBe(412 - 2 * MAP_GUTTER);
        expect(fullScreenSizeFor(300, 200, { above: 150 })).toBe(240);
    });

    test('on a phone turned sideways, the controls beside it leave it far larger than above it', () => {
        const above = fullScreenSizeFor(915, 412, { above: 150 });
        const beside = fullScreenSizeFor(915, 412, { above: MAP_GUTTER, beside: 256 });
        expect(above).toBe(412 - 150 - MAP_GUTTER);
        expect(beside).toBe(412 - 2 * MAP_GUTTER);
        expect(beside).toBeGreaterThan(above + 100);
    });

    test('keeps the zoom and the middle, so the same things are in view, only larger', () => {
        const view = zoomAt(initialView(100, 750, [3, 4, 5]), 6, [20, -10]);
        const big = resizedView(view, 1000);
        expect(zoomLevel(big)).toBeCloseTo(zoomLevel(view), 12);
        expect([big.cx, big.cy, big.cz]).toEqual([view.cx, view.cy, view.cz]);
        /* A point at the edge of the fitted map stays at the same share of the picture's margin. */
        const [x] = toScreen(view, view.cx + (375 - 24) / view.scale, view.cy);
        const [X] = toScreen(big, big.cx + (500 - 24) / big.scale, big.cy);
        expect([x, X]).toEqual([750 - 24, 1000 - 24]);
        expect(resizedView(big, 750)).toMatchObject({ scale: expect.closeTo(view.scale, 9), fitScale: expect.closeTo(view.fitScale, 9) });
    });

    test('a home fitted at the new size is the same as the old home resized', () => {
        const home = initialView(100, 750);
        expect(resizedView(home, 1000).fitScale).toBeCloseTo(initialView(100, 1000).fitScale, 12);
    });
});

describe("The light, through a phone's locks and reloads (owner, 2026-11-18)", () => {
    const page = readFileSync(resolve(__dirname, '../../rubin/rubin.js'), 'utf8');

    test('every redraw of the map moves the light with it, even while its timer is stopped', () => {
        expect(page).toContain("if (document.hidden || !(mapOnScreen || filling)) { if (always) drawLight(); return; }");
        expect(page).toContain('runLight({ always: true });');
    });

    test("this visit's light is kept for the tab, so a reload does not start it again", () => {
        expect(page).toContain("firstVisit(sessionStorage.getItem('rubin-visit-opened'), now)");
    });
});
