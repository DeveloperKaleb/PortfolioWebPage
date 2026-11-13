import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    centauriOn, binaryOnSky, binaryOffset, places, BINARY, BINARY_A_AU, PLANET_ORBITS, SEEN_NEAR, AU_PER_LIGHT_YEAR,
    farDistanceText, farPlaneText, yearOf,
} from '../../js/centauri.js';
import { CENTAURI, UNSEEN_FROM_AU } from '../../js/light.js';
import {
    initialView, zoomAt, panBy, toScreen, ringRadii, ringLabel, ringSpacing, glideView, journeyView, unseenHoles, MAP_ZOOM,
} from '../../js/rubinview.js';

const root = resolve(__dirname, '../..');
const YEAR = 2026.87;
const system = centauriOn(YEAR);

describe('Where Alpha Centauri is', () => {
    test('4.344 light years away, as its parallax says', () => {
        expect(system.centre.r / AU_PER_LIGHT_YEAR).toBeCloseTo(4.344, 2);
        expect(Math.abs(system.centre.r - CENTAURI.distanceAU)).toBeLessThan(100);
    });

    test('far below the plane of the planets, in the direction of Scorpius and Lupus', () => {
        const longitude = (Math.atan2(system.centre.y, system.centre.x) * 180 / Math.PI + 360) % 360;
        const latitude = Math.asin(system.centre.z / system.centre.r) * 180 / Math.PI;
        expect(longitude).toBeCloseTo(239.4, 0);
        expect(latitude).toBeCloseTo(-42.6, 0);
    });

    test('the stars drift across the sky, but hardly at this scale: 26 years moves them under 200 AU', () => {
        const then = centauriOn(2000);
        const moved = Math.hypot(then.centre.x - system.centre.x, then.centre.y - system.centre.y, then.centre.z - system.centre.z);
        expect(moved).toBeGreaterThan(50);
        expect(moved).toBeLessThan(200);
    });

    test('a Julian date becomes a year', () => {
        expect(yearOf(2451545.0)).toBe(2000);
        expect(yearOf(2451545.0 + 365.25 * 26.5)).toBeCloseTo(2026.5, 9);
    });
});

describe('A and B about each other', () => {
    /* Measured separations and directions as published (Wikipedia's Alpha Centauri, from the
       Washington Double Star catalogue): 4.0" at 300 degrees in February 2016, 4.92" at
       337.1 in 2019, 5.49" at 345.3 in 2020. The directions swing about nine degrees a year
       here, so they are held to the year's worth the dates are quoted to. */
    test('as seen from Earth, against published measurements', () => {
        expect(binaryOnSky(2016.12).separation).toBeCloseTo(4.0, 1);
        expect(binaryOnSky(2019.0).separation).toBeCloseTo(4.92, 1);
        expect(binaryOnSky(2020.0).separation).toBeCloseTo(5.49, 1);
        expect(Math.abs(binaryOnSky(2016.12).angle - 300)).toBeLessThan(6);
        expect(Math.abs(binaryOnSky(2019.0).angle - 337.1)).toBeLessThan(6);
        expect(Math.abs(binaryOnSky(2020.0).angle - 345.3)).toBeLessThan(6);
    });

    test('between 11.2 and 35.6 AU apart, closest in 2035', () => {
        let least = Infinity, most = 0, closestYear = 0;
        for (let year = 2000; year < 2000 + BINARY.period; year += 0.02) {
            const { r } = binaryOffset(year);
            if (r < least) { least = r; closestYear = year; }
            most = Math.max(most, r);
        }
        expect(least).toBeCloseTo(11.2, 1);
        expect(most).toBeCloseTo(35.4, 1);
        expect(closestYear).toBeCloseTo(2035.33, 1);
    });

    test('the same one orbit later', () => {
        const a = binaryOffset(2026.87), b = binaryOffset(2026.87 + BINARY.period);
        expect(b.north).toBeCloseTo(a.north, 8);
        expect(b.away).toBeCloseTo(a.away, 8);
    });

    test('the orbit is 23.3 AU in size', () => {
        expect(BINARY_A_AU).toBeCloseTo(23.3, 1);
    });

    test('their centre of gravity lies between them, nearer the heavier A', () => {
        const from = (p) => Math.hypot(p.x - system.centre.x, p.y - system.centre.y, p.z - system.centre.z);
        expect(from(system.a) + from(system.b)).toBeCloseTo(system.apart, 6);
        expect(from(system.a)).toBeLessThan(from(system.b));
        expect(from(system.a) * BINARY.massA).toBeCloseTo(from(system.b) * BINARY.massB, 6);
    });

    test('each traces a closed path that passes through where it is', () => {
        expect(system.paths.a).toHaveLength(96);
        expect(system.paths.a[0].x).toBeCloseTo(system.a.x, 6);
        expect(system.paths.b[0].y).toBeCloseTo(system.b.y, 6);
    });
});

describe('Proxima, in its true place', () => {
    test('about 12,000 AU from the pair, and the ruler uses the same figure', () => {
        expect(system.proximaFromCentre).toBeGreaterThan(11800);
        expect(system.proximaFromCentre).toBeLessThan(12300);
        expect(Math.abs(system.proximaFromCentre - CENTAURI.proxima.fromCentreAU)).toBeLessThan(100);
    });

    test('nearer to us than the pair by about 6,000 AU, and off to one side', () => {
        expect(system.centre.r - system.proxima.r).toBeGreaterThan(5500);
        expect(system.centre.r - system.proxima.r).toBeLessThan(6800);
        const sideways = Math.sqrt(system.proximaFromCentre ** 2 - (system.centre.r - system.proxima.r) ** 2);
        expect(sideways).toBeGreaterThan(9500);
    });

    test('about 2.2 degrees from the pair in our sky', () => {
        const dot = system.centre.x * system.proxima.x + system.centre.y * system.proxima.y + system.centre.z * system.proxima.z;
        const angle = Math.acos(dot / (system.centre.r * system.proxima.r)) * 180 / Math.PI;
        expect(angle).toBeCloseTo(2.2, 1);
    });

    test('4.2465 light years away, as Gaia has it', () => {
        expect(system.proxima.r / AU_PER_LIGHT_YEAR).toBeCloseTo(4.2465, 3);
    });
});

describe('The planets: sizes only', () => {
    test('two confirmed at Proxima, one candidate at A, and nothing claimed about their tilt', () => {
        expect(PLANET_ORBITS.filter((o) => o.status === 'confirmed').map((o) => o.name)).toEqual(['Proxima d', 'Proxima b']);
        expect(PLANET_ORBITS.filter((o) => o.status === 'candidate')).toHaveLength(1);
        PLANET_ORBITS.forEach((o) => expect(Object.keys(o).sort()).toEqual(['a', 'name', 'star', 'status']));
    });

    test("the hatching stops outside Proxima's planets and outside the pair's widest reach", () => {
        PLANET_ORBITS.filter((o) => o.star === 'proxima').forEach((o) => expect(o.a).toBeLessThan(SEEN_NEAR.proxima));
        expect(SEEN_NEAR.pair).toBeGreaterThan(35.6 * BINARY.massA / (BINARY.massA + BINARY.massB));
    });
});

describe('The three places', () => {
    const P = places(system, 200);

    test('the Sun as it always was', () => {
        expect(P.sun).toEqual({ id: 'sun', name: 'the Sun', cx: 0, cy: 0, radiusAU: 200 });
    });

    test('Alpha Centauri, with room for Proxima', () => {
        const reach = Math.hypot(system.proxima.x - system.centre.x, system.proxima.y - system.centre.y);
        expect(P.centauri.radiusAU).toBeGreaterThan(reach);
        expect(P.centauri.radiusAU).toBeLessThan(reach * 1.5);
        expect([P.centauri.cx, P.centauri.cy]).toEqual([system.centre.x, system.centre.y]);
    });

    test('both: every star inside the view that fits it', () => {
        const view = initialView(P.both.radiusAU, 750, [P.both.cx, P.both.cy]);
        for (const body of [{ x: 0, y: 0 }, system.centre, system.proxima]) {
            const [x, y] = toScreen(view, body.x, body.y);
            expect(Math.hypot(x - 375, y - 375)).toBeLessThan(375 - 24);
        }
    });

    test('zoomed all the way in at Alpha Centauri, the orbit of Proxima b is wide enough to see', () => {
        const home = initialView(P.centauri.radiusAU, 340, [P.centauri.cx, P.centauri.cy]);
        expect(0.04848 * home.fitScale * MAP_ZOOM.max).toBeGreaterThan(20);
    });
});

describe('A view with a home', () => {
    const P = places(system, 200);
    const home = initialView(P.centauri.radiusAU, 750, [P.centauri.cx, P.centauri.cy]);

    test('the Sun is home unless told otherwise, exactly as before', () => {
        const view = initialView(200, 750);
        expect([view.cx, view.cy, view.homeX, view.homeY]).toEqual([0, 0, 0, 0]);
        expect(zoomAt(zoomAt(view, 8, [50, 20]), 1 / 64)).toMatchObject({ cx: 0, cy: 0, scale: view.fitScale });
    });

    test('zooming all the way out comes back to its own home, not the Sun', () => {
        const out = zoomAt(zoomAt(home, 16, [system.proxima.x, system.proxima.y]), 1 / 100);
        expect(out.cx).toBe(P.centauri.cx);
        expect(out.cy).toBe(P.centauri.cy);
    });

    test('dragging cannot leave the neighbourhood of home', () => {
        const dragged = panBy(zoomAt(home, 4), 1e7, -1e7);
        expect(Math.abs(dragged.cx - P.centauri.cx)).toBeLessThanOrEqual(P.centauri.radiusAU);
        expect(Math.abs(dragged.cy - P.centauri.cy)).toBeLessThanOrEqual(P.centauri.radiusAU);
    });
});

describe('Rings that cross the picture', () => {
    test('at the Sun: the same round spacing as ever, from the first ring out', () => {
        const view = initialView(200, 750);
        expect(ringSpacing(view)).toBe(50);
        expect(ringRadii(view, 0).slice(0, 4)).toEqual([50, 100, 150, 200]);
    });

    test('pulled back to both systems, the spacing is still round and the rings few', () => {
        const P = places(system, 200);
        const view = initialView(P.both.radiusAU, 750, [P.both.cx, P.both.cy]);
        expect(ringSpacing(view)).toBe(50000);
        const radii = ringRadii(view, Math.hypot(P.both.cx, P.both.cy));
        expect(radii.length).toBeGreaterThan(2);
        expect(radii.length).toBeLessThan(10);
    });

    test('270,000 AU from the Sun and zoomed in, no ring about the Sun is drawn at all', () => {
        const P = places(system, 200);
        const view = zoomAt(initialView(P.centauri.radiusAU, 750, [P.centauri.cx, P.centauri.cy]), 2000);
        const radii = ringRadii(view, Math.hypot(view.cx, view.cy));
        radii.forEach((r) => expect(Math.abs(r - Math.hypot(view.cx, view.cy)) * view.scale).toBeLessThan(750));
        expect(radii.length).toBeLessThan(60);
    });

    test('labels read as distances', () => {
        expect(ringLabel(30)).toBe('30 AU');
        expect(ringLabel(0.05)).toBe('0.05 AU');
        expect(ringLabel(100000)).toBe('100,000 AU');
    });
});

describe('Travelling', () => {
    const P = places(system, 200);
    const sun = initialView(P.sun.radiusAU, 750);
    const both = initialView(P.both.radiusAU, 750, [P.both.cx, P.both.cy]);
    const there = initialView(P.centauri.radiusAU, 750, [P.centauri.cx, P.centauri.cy]);

    test('a glide starts where it was and ends exactly where it is going', () => {
        expect(glideView(sun, both, 0)).toMatchObject({ scale: sun.scale, cx: 0, cy: 0 });
        expect(glideView(sun, both, 1)).toBe(both);
    });

    test('pulling back, the scale only falls and the Sun never leaves the picture', () => {
        let last = Infinity;
        for (let t = 0; t <= 1; t += 0.02) {
            const view = glideView(sun, both, t);
            expect(view.scale).toBeLessThanOrEqual(last);
            last = view.scale;
            const [x, y] = toScreen(view, 0, 0);
            expect(Math.hypot(x - 375, y - 375)).toBeLessThan(375);
        }
    });

    test('closing in, the destination is in the picture from the start', () => {
        for (let t = 0; t <= 1; t += 0.02) {
            const [x, y] = toScreen(glideView(both, there, t), system.centre.x, system.centre.y);
            expect(Math.hypot(x - 375, y - 375)).toBeLessThan(375);
        }
    });

    test('a journey between the systems passes through the view that holds both', () => {
        expect(journeyView(sun, both, there, 0)).toMatchObject({ scale: sun.scale, cx: 0 });
        expect(journeyView(sun, both, there, 0.5)).toMatchObject({ scale: both.scale, cx: both.cx, cy: both.cy });
        expect(journeyView(sun, both, there, 1)).toBe(there);
    });

    test('a glide between views of the same scale moves evenly, without dividing by nothing', () => {
        const mid = glideView(there, { ...there, cx: there.cx + 100 }, 0.5);
        expect(mid.cx).toBeCloseTo(there.cx + 50, 6);
        expect(Number.isFinite(mid.scale)).toBe(true);
    });
});

describe('The hatching on the map', () => {
    const P = places(system, 200);
    const zones = [
        { x: 0, y: 0, radiusAU: UNSEEN_FROM_AU },
        { x: system.centre.x, y: system.centre.y, radiusAU: SEEN_NEAR.pair },
        { x: system.proxima.x, y: system.proxima.y, radiusAU: SEEN_NEAR.proxima },
    ];

    test('none at the Sun, where the whole picture is within 1,000 AU', () => {
        expect(unseenHoles(initialView(200, 750), zones)).toBeNull();
        expect(unseenHoles(zoomAt(initialView(200, 750), 500, [30, 0]), zones)).toBeNull();
    });

    test('with both systems in view, hatching everywhere but a small clearing at the Sun', () => {
        const view = initialView(P.both.radiusAU, 750, [P.both.cx, P.both.cy]);
        const holes = unseenHoles(view, zones);
        expect(holes).toHaveLength(1);
        expect(holes[0].r).toBeCloseTo(1000 * view.scale, 9);
        expect(toScreen(view, 0, 0)).toEqual([holes[0].x, holes[0].y]);
    });

    test('zoomed in on the pair: a clearing about them, and none once the picture is inside it', () => {
        const home = initialView(P.centauri.radiusAU, 750, [P.centauri.cx, P.centauri.cy]);
        const near = { ...home, scale: 351 / 200 };
        expect(unseenHoles(near, zones)).toHaveLength(1);
        expect(unseenHoles({ ...home, scale: 351 / 10 }, zones)).toBeNull();
    });

    test('the hatching is round: none when only the corners reach past the clearing', () => {
        const home = initialView(P.centauri.radiusAU, 750, [P.centauri.cx, P.centauri.cy]);
        const view = { ...home, scale: 10 }; // round window reaches 33.75 AU, the corners 53
        expect(unseenHoles(view, zones)).toHaveLength(1);
        expect(unseenHoles(view, zones, 375 * 0.9)).toBeNull();
    });

    test('a clearing far off the picture is not drawn', () => {
        const home = initialView(P.centauri.radiusAU, 750, [P.centauri.cx, P.centauri.cy]);
        const holes = unseenHoles({ ...home, scale: 351 / 200 }, zones);
        holes.forEach((h) => expect(Math.hypot(h.x - 375, h.y - 375) - h.r).toBeLessThan(375 * Math.SQRT2));
    });
});

describe('Distances at the far end', () => {
    test('AU while that reads, light years beyond', () => {
        expect(farDistanceText(18.22)).toBe('18.2 AU');
        expect(farDistanceText(2)).toBe('2.00 AU');
        expect(farDistanceText(12054)).toBe('12,054 AU');
        expect(farDistanceText(274723)).toBe('4.34 light years (274,723 AU)');
    });

    test('along the plane and out of it, as the other objects say it', () => {
        expect(farPlaneText({ x: 3, y: 4, z: -12 })).toBe('5.00 AU along the plane, 12.0 AU below it');
    });
});

describe('The page', () => {
    test('centauri.js is pure: no DOM, no clock, no network', () => {
        const source = readFileSync(resolve(root, 'js/centauri.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        expect(source).not.toMatch(/document|window|localStorage|Date\.now|new Date|fetch\(/);
    });

    test('a journey leaves visitors who asked for less motion where they are going, at once', () => {
        const page = readFileSync(resolve(root, 'rubin/rubin.js'), 'utf8');
        expect(page).toContain('if (reducedMotion.matches) { view = toView; render(); return; }');
    });
});
