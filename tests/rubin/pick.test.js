import { describe, test, expect } from 'vitest';
import { orbitOnMap, centredOn, atHome, initialView, zoomAt, panBy } from '../../js/rubinview.js';
import { positionAt, jdFromDate } from '../../js/orbit.js';
import { OBJECTS } from '../orbit/fixtures.js';

const jd = jdFromDate(new Date('2026-11-16T00:00:00Z'));
const { elements } = OBJECTS.Sedna;
const at = positionAt(elements, jd);
const sedna = (over) => ({
    designation: '90377', flags: ['extremeOrbit', 'detached'],
    orbit: { a: 506.4, e: 0.854, i: 11.93, q: 73.9, om: elements.om, w: elements.w },
    orbitQuality: { arcDays: 26000, conditionCode: 2, nObs: 400 },
    now: { r: at.r, x: at.x, y: at.y, z: at.z },
    ...over,
});

describe("A picked object's orbit on the map", () => {
    test('is drawn through where it is now, when the orbit is known', () => {
        const { path, note } = orbitOnMap(sedna());
        expect(note).toBeNull();
        expect(Math.min(...path.map((p) => Math.hypot(p.x - at.x, p.y - at.y, p.z - at.z)))).toBeLessThan(1e-9);
    });

    test('is not drawn while it is uncertain, and the map says so, with why', () => {
        const doubtful = orbitOnMap(sedna({ flags: ['uncertainOrbit'], orbitQuality: { arcDays: 5900, conditionCode: 6, nObs: 34 } }));
        expect(doubtful.path).toBeNull();
        expect(doubtful.note).toBe('orbit not yet known');
        expect(doubtful.rows.flat().join(' ')).toMatch(/34 sightings over 16 years; uncertainty 6 on the 0 \(well known\) to 9 scale/);
        expect(orbitOnMap(sedna({ flags: ['uncertainOrbit'], orbitQuality: { arcDays: 40, conditionCode: 9, nObs: 12 } })).rows.flat().join(' ')).toMatch(/12 sightings over 40 days/);
    });

    test("waits for the next update when the digest lacks the orbit's turning angles", () => {
        const old = orbitOnMap(sedna({ orbit: { a: 506.4, e: 0.854, i: 11.93, q: 73.9 } }));
        expect(old.path).toBeNull();
        expect(old.note).toBe('orbit with the next update');
    });
});

describe('Centring the map on a picked body', () => {
    const view = zoomAt(initialView(100, 750), 4);

    test('moves the middle to it and keeps the zoom, its height too', () => {
        const next = centredOn(view, [30, -20, 7]);
        expect([next.cx, next.cy, next.cz]).toEqual([30, -20, 7]);
        expect(next.scale).toBe(view.scale);
        expect(atHome(view)).toBe(true);
        expect(atHome(next)).toBe(false);
    });

    test('keeps within the reach a drag is allowed, so a later drag does not jump', () => {
        const next = centredOn(view, [500, 0, 0]);
        expect(next.cx).toBe(100);
        expect(panBy(next, 0, 0).cx).toBe(next.cx);
    });

    test('zooming right out comes home again', () => {
        const away = centredOn(initialView(100, 750), [30, -20, 7]);
        expect(atHome(zoomAt(away, 1 / 2))).toBe(true);
    });
});
