import { describe, test, expect } from 'vitest';
import { orbitPath, positionAt, jdFromDate } from '../../js/orbit.js';
import { OBJECTS, EPOCH } from './fixtures.js';

const jd = jdFromDate(new Date('2026-11-16T00:00:00Z'));
const near = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
/* How far a point is from a path, along its straight pieces. */
function offPath(path, p, closed = true) {
    let best = Infinity;
    const n = closed ? path.length : path.length - 1;
    for (let k = 0; k < n; k++) {
        const [a, b] = [path[k], path[(k + 1) % path.length]];
        const ab = [b.x - a.x, b.y - a.y, b.z - a.z];
        const ap = [p.x - a.x, p.y - a.y, p.z - a.z];
        const len = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
        const t = len ? Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / len)) : 0;
        best = Math.min(best, Math.hypot(ap[0] - t * ab[0], ap[1] - t * ab[1], ap[2] - t * ab[2]));
    }
    return best;
}

describe('An orbit drawn as a path', () => {
    test.each(Object.entries(OBJECTS))("%s: every point is on the orbit, and the object's place on any date is on the path", (_, { elements }) => {
        const path = orbitPath(elements);
        const { a, e } = elements;
        for (const p of path) {
            const r = Math.hypot(p.x, p.y, p.z);
            expect(r).toBeGreaterThanOrEqual(a * (1 - e) - 1e-9);
            expect(r).toBeLessThanOrEqual(a * (1 + e) + 1e-9);
        }
        for (const days of [0, 3000, 40000]) {
            expect(offPath(path, positionAt(elements, jd + days)) / a).toBeLessThan(0.002);
        }
    });

    test('given where the object is, the path runs exactly through it, even from rounded elements', () => {
        const { elements } = OBJECTS.Sedna;
        const now = positionAt(elements, jd);
        const rounded = { a: Number(elements.a.toFixed(2)), e: Number(elements.e.toFixed(3)), i: Number(elements.i.toFixed(2)), om: Number(elements.om.toFixed(3)), w: Number(elements.w.toFixed(3)) };
        const path = orbitPath(rounded, { through: now });
        expect(Math.min(...path.map((p) => near(p, now)))).toBeLessThan(1e-9);
        /* Points crowd in either side, so the line is true through the mark at any zoom. */
        expect(path.filter((p) => near(p, now) < 1e-3 * now.r).length).toBeGreaterThanOrEqual(7);
        /* The rest is the orbit, give or take the rounding. */
        expect(offPath(path, positionAt(elements, jd + 20000)) / elements.a).toBeLessThan(0.002);
    });

    test('an unbound orbit is the arm of its hyperbola, out to a reach', () => {
        const open = { a: -50, e: 1.2, i: 10, om: 30, w: 40, ma: 0, epoch: EPOCH };
        const path = orbitPath(open, { reachAU: 200 });
        const rs = path.map((p) => Math.hypot(p.x, p.y, p.z));
        expect(Math.min(...rs)).toBeCloseTo(50 * 0.2, 6);
        expect(Math.max(...rs)).toBeCloseTo(200, 6);
        expect(offPath(path, positionAt({ ...open, ma: 5 }, EPOCH), false)).toBeLessThan(0.5);
    });
});
