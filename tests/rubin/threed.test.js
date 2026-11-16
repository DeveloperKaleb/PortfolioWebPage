import { describe, test, expect } from 'vitest';
import { centauriOn, places, towardSagA } from '../../js/centauri.js';
import {
    initialView, zoomAt, toScreen, ringRadii, glideView, unseenHoles, projector, turnBy, FLAT, TILT_3D, TILT_MAX,
} from '../../js/rubinview.js';
import { planetsOn } from '../../js/planets.js';

const system = centauriOn(2026.87);
const P = places(system, 200, 250);
const deg = Math.PI / 180;
const home = (p, threeD) => initialView(threeD ? p.radius3D : p.radiusAU, 750, [p.cx, p.cy, p.cz]);

describe('Flat is the map as it always was', () => {
    test('every point lands where toScreen puts it, whatever its height', () => {
        const view = zoomAt(initialView(200, 750), 3, [20, -10]);
        const at3 = projector(view, FLAT);
        for (const [x, y, z] of [[0, 0, 0], [33, 12, 0], [-40, 7, 25], [5, -60, -300]]) {
            const [a, b] = at3(x, y, z);
            const [c, d] = toScreen(view, x, y);
            expect(a).toBeCloseTo(c, 9);
            expect(b).toBeCloseTo(d, 9);
        }
        expect(at3.squash).toBe(1);
    });

    test('rings and the hatching are unchanged', () => {
        const view = initialView(200, 750);
        expect(ringRadii(view, 0, 60, 1)).toEqual(ringRadii(view, 0));
        const zones = [{ x: 0, y: 0, z: 0, radiusAU: 1000 }, { x: 5000, y: 0, z: -9000, radiusAU: 40 }];
        const far = { ...view, scale: 351 / 20000 };
        expect(unseenHoles(far, zones, undefined, projector(far))).toEqual(unseenHoles(far, zones));
    });
});

describe('3D', () => {
    const view = initialView(100, 750);
    const cam = { turn: 0.7, tilt: TILT_3D };
    const at3 = projector(view, cam);

    test('turning and tipping keep sizes: no point lands further off than it is', () => {
        for (const [x, y, z] of [[30, 0, 0], [0, 30, 0], [0, 0, 30], [12, -20, 17]]) {
            const [a, b] = at3(x, y, z);
            expect(Math.hypot(a - 375, b - 375) / view.scale).toBeLessThanOrEqual(Math.hypot(x, y, z) + 1e-9);
        }
    });

    test('above the plane is up the picture, below is down', () => {
        expect(at3(0, 0, 10)[1]).toBeLessThan(375);
        expect(at3(0, 0, -10)[1]).toBeGreaterThan(375);
    });

    test('edge-on, the height is all there is up the picture', () => {
        const side = projector(view, { turn: 0, tilt: Math.PI / 2 });
        expect(side(0, 50, 0)[1]).toBeCloseTo(375, 9);
        expect(side(0, 0, 50)[1]).toBeCloseTo(375 - 50 * view.scale, 9);
    });

    test('a ring in the plane is squashed by the cosine of the tilt, and its rings reach far enough', () => {
        expect(at3.squash).toBeCloseTo(Math.cos(TILT_3D), 12);
        const flat = ringRadii(view, 0);
        const tipped = ringRadii(view, 0, 60, 1 / at3.squash);
        expect(tipped.length).toBeGreaterThan(flat.length);
        expect(tipped.slice(0, flat.length)).toEqual(flat);
    });

    test('a direction turns with the map; flat, SagA points along the plane as before', () => {
        const sag = towardSagA();
        const [x, y] = projector(view).direction(...sag.way);
        expect(Math.atan2(-y, x)).toBeCloseTo(Math.atan2(sag.y, sag.x), 9);
        const [u, v] = projector(view, { turn: 0, tilt: Math.PI / 2 }).direction(...sag.way);
        expect(v).toBeGreaterThan(0); // below the plane: down the picture, edge-on
        expect(Math.hypot(u, v)).toBeLessThanOrEqual(1 + 1e-12);
    });

    test('a drag turns the map and tips it, stopping short of edge-on and of upside down', () => {
        expect(turnBy(FLAT, 0, -50).tilt).toBe(0);
        expect(turnBy({ turn: 0, tilt: TILT_3D }, 0, 5000).tilt).toBe(TILT_MAX);
        expect(turnBy(FLAT, 54, 0).turn).toBeCloseTo(-54 / 3 * deg, 12);
    });
});

describe('Places in 3D', () => {
    test('each has its height above the plane to turn about', () => {
        expect(P.sun.cz).toBe(0);
        expect(P.both.cz).toBe(0);
        expect(P.centauri.cz).toBe(system.centre.z);
        expect(P.barnard.cz).toBe(system.barnard.z);
        expect(P.luhman16.cz).toBe(system.luhman16.z);
        expect(P.sun.radius3D).toBe(250);
    });

    test('pulled back to the nearest bodies, every one stays in the picture however the map is turned', () => {
        const view = home(P.both, true);
        for (let turn = 0; turn < 360; turn += 15) {
            for (const tilt of [0, 30, 55, 85]) {
                const at3 = projector(view, { turn: turn * deg, tilt: tilt * deg });
                for (const body of [system.centre, system.proxima, system.barnard, system.luhman16, { x: 0, y: 0, z: 0 }]) {
                    const [x, y] = at3(body.x, body.y, body.z);
                    expect(Math.hypot(x - 375, y - 375)).toBeLessThan(375 - 20);
                }
            }
        }
    });

    test('a journey glides the height of the middle too', () => {
        const from = home(P.both, true);
        const to = home(P.centauri, true);
        expect(glideView(from, to, 0).cz).toBe(0);
        const mid = glideView(from, to, 0.5).cz;
        expect(mid).toBeLessThan(0);
        expect(mid).toBeGreaterThan(system.centre.z);
        expect(zoomAt(zoomAt(to, 8), 1 / 64).cz).toBe(system.centre.z);
    });
});

describe('The planets in 3D', () => {
    test("their orbits carry their height, so a tilted orbit is drawn tilted", () => {
        const mercury = planetsOn(2461360.5).find((p) => p.name === 'Mercury');
        const top = Math.max(...mercury.path.map((q) => q.z));
        expect(top).toBeGreaterThan(0.04);
        expect(top).toBeLessThan(0.06);
    });
});
