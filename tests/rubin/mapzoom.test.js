import { describe, test, expect } from 'vitest';
import { planetsOn, planetElements, VALID_UNTIL_JD } from '../../js/planets.js';
import { jdFromDate } from '../../js/orbit.js';
import {
    initialView, zoomAt, panBy, toScreen, toWorld, zoomLevel, ringSpacing, MAP_ZOOM,
} from '../../js/rubinview.js';

/* JPL Horizons, heliocentric ecliptic longitude, latitude and distance on 2026-10-02
   00:00 UT, recorded that day (quantities 18 and 19). */
const HORIZONS = {
    Jupiter: { lon: 131.2061, lat: 0.6654, r: 5.307265709168 },
    Neptune: { lon: 2.6534, lat: -1.3733, r: 29.87803435904 },
};

describe('The planets, where they really are', () => {
    const planets = planetsOn(jdFromDate(new Date('2026-10-02T00:00:00Z')));

    test.each(Object.entries(HORIZONS))('%s agrees with JPL Horizons', (name, ref) => {
        const p = planets.find((q) => q.name === name);
        const lon = ((Math.atan2(p.y, p.x) * 180) / Math.PI + 360) % 360;
        const lat = (Math.asin(p.z / p.r) * 180) / Math.PI;
        expect(Math.abs(lon - ref.lon)).toBeLessThan(0.1);
        expect(Math.abs(lat - ref.lat)).toBeLessThan(0.05);
        expect(Math.abs(p.r - ref.r)).toBeLessThan(0.01);
    });

    test('Earth is opposite the Sun in early October', () => {
        const earth = planets.find((q) => q.name === 'Earth');
        const lon = ((Math.atan2(earth.y, earth.x) * 180) / Math.PI + 360) % 360;
        expect(lon).toBeGreaterThan(0);
        expect(lon).toBeLessThan(20);
        expect(earth.r).toBeCloseTo(1, 1);
    });

    test('each orbit is drawn as a closed path at the planet\'s distance', () => {
        const saturn = planets.find((q) => q.name === 'Saturn');
        saturn.path.forEach((q) => expect(Math.hypot(q.x, q.y)).toBeGreaterThan(8.9));
        saturn.path.forEach((q) => expect(Math.hypot(q.x, q.y)).toBeLessThan(10.2));
    });

    test('the table holds for the length of the survey', () => {
        expect(VALID_UNTIL_JD).toBeGreaterThan(jdFromDate(new Date('2036-12-31T00:00:00Z')));
        expect(planetElements('Neptune', VALID_UNTIL_JD).a).toBeCloseTo(30.07, 1);
    });
});

describe('Zooming the map', () => {
    const fit = initialView(150, 440);

    test('starts fitted, centred on the Sun', () => {
        expect(zoomLevel(fit)).toBe(1);
        expect(toScreen(fit, 0, 0)).toEqual([220, 220]);
    });

    test('screen and map coordinates are inverses', () => {
        const view = zoomAt(fit, 8, [40, -20]);
        const [x, y] = toScreen(view, 33, 12);
        const back = toWorld(view, x, y);
        expect(back[0]).toBeCloseTo(33, 9);
        expect(back[1]).toBeCloseTo(12, 9);
    });

    test('zooming keeps the point under the pointer where it is', () => {
        const anchor = [50, 30];
        const before = toScreen(fit, ...anchor);
        const after = toScreen(zoomAt(fit, 4, anchor), ...anchor);
        expect(after[0]).toBeCloseTo(before[0], 6);
        expect(after[1]).toBeCloseTo(before[1], 6);
    });

    test('stays between the whole map and the most zoomed', () => {
        expect(zoomLevel(zoomAt(fit, 1e9))).toBeCloseTo(MAP_ZOOM.max, 6);
        expect(zoomLevel(zoomAt(fit, 1e-9))).toBe(1);
    });

    test('zooming all the way out comes back to the Sun', () => {
        const away = panBy(zoomAt(fit, 10, [100, 100]), 50, 50);
        const home = zoomAt(away, 1e-9);
        expect([home.cx, home.cy]).toEqual([0, 0]);
    });

    test('dragging moves the map with the pointer', () => {
        const view = zoomAt(fit, 4);
        const moved = panBy(view, 30, -10);
        const [x, y] = toScreen(moved, view.cx, view.cy);
        expect(x).toBeCloseTo(220 + 30, 6);
        expect(y).toBeCloseTo(220 - 10, 6);
    });

    test('cannot drag off into empty space', () => {
        const far = panBy(zoomAt(fit, 50), -1e7, 1e7);
        expect(Math.abs(far.cx)).toBeLessThanOrEqual(150);
        expect(Math.abs(far.cy)).toBeLessThanOrEqual(150);
    });

    test('distance rings re-space to round numbers as it zooms', () => {
        expect(ringSpacing(fit)).toBe(50);
        expect(ringSpacing(zoomAt(fit, 30))).toBeLessThanOrEqual(2);
        expect([0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]).toContain(ringSpacing(zoomAt(fit, 7)));
    });

    test('zoomed in far enough, the inner planets are visible', () => {
        const deep = zoomAt(fit, MAP_ZOOM.max);
        expect(1.52 * deep.scale).toBeGreaterThan(100); // Mars's orbit spans well over 100 px
    });
});
