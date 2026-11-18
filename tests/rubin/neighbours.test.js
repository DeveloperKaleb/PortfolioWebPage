import { describe, test, expect } from 'vitest';
import { centauriOn, places, proximaOrbit, PLANET_ORBITS, MERCURY_AU } from '../../js/centauri.js';
import { initialView, zoomAt, maxZoomOf, zoomLevel, MAP_ZOOM, DEEPEST_AU } from '../../js/rubinview.js';

const system = centauriOn(2026.88);
const P = places(system, 150, 150);

describe("Proxima's orbit about A and B", () => {
    const orbit = proximaOrbit(system);
    const fromCentre = (q) => Math.hypot(q.x - system.centre.x, q.y - system.centre.y, q.z - system.centre.z);

    test("worked out from Kervella et al.'s relative place and velocity, it is the paper's orbit", () => {
        expect(orbit.elements.a).toBeGreaterThan(8300);
        expect(orbit.elements.a).toBeLessThan(9400);
        expect(orbit.elements.e).toBeCloseTo(0.50, 1);
        expect(orbit.periodYears / 1000).toBeGreaterThan(507);
        expect(orbit.periodYears / 1000).toBeLessThan(613);
        /* Near its far end: the paper's apastron is 13.0 kau, against 12.95 kau then. */
        expect(orbit.elements.a * (1 + orbit.elements.e)).toBeCloseTo(12950, -2);
    });

    test('runs through Proxima where it is today, about A and B, little changed to get there', () => {
        const { proxima } = system;
        expect(Math.min(...orbit.path.map((q) => Math.hypot(q.x - proxima.x, q.y - proxima.y, q.z - proxima.z)))).toBeLessThan(1e-6);
        expect(orbit.shrink).toBeGreaterThan(0.9);
        expect(orbit.turnDeg).toBeLessThan(10);
        expect(Math.max(...orbit.path.map(fromCentre))).toBeCloseTo(system.proximaFromCentre, -1);
        expect(Math.min(...orbit.path.map(fromCentre))).toBeCloseTo(orbit.elements.a * (1 - orbit.elements.e) * orbit.shrink, -1);
    });
});

describe("Barnard's Star's planets", () => {
    test('its whole view reaches out to Mercury\'s orbit, drawn there for scale, ten times wider than theirs', () => {
        expect(P.barnard.radiusAU).toBeGreaterThan(MERCURY_AU);
        const widest = Math.max(...PLANET_ORBITS.filter((o) => o.star === 'barnard').map((o) => o.a));
        expect(MERCURY_AU / widest).toBeGreaterThan(10);
    });

    test('from the view of the nearest bodies, zooming in on it goes deep enough to show them', () => {
        const far = { ...initialView(P.both.radiusAU, 750), cx: system.barnard.x, cy: system.barnard.y };
        const deepest = zoomAt(far, 1e12, [system.barnard.x, system.barnard.y]);
        expect(zoomLevel(deepest)).toBeCloseTo(maxZoomOf(far), 3);
        expect((375 - 24) / deepest.scale).toBeCloseTo(DEEPEST_AU, 9);
        const innermost = PLANET_ORBITS.find((o) => o.name === 'Barnard d');
        expect(innermost.a * deepest.scale).toBeGreaterThan(375);
    });

    test('nearer in, the zoom limit is as it was', () => {
        expect(maxZoomOf(initialView(150, 750))).toBe(MAP_ZOOM.max);
    });
});
