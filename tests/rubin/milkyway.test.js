import { describe, it, expect } from 'vitest';
import { skyBasis, skyAt, windowFade, paintSky } from '../../js/milkyway.js';
import { FLAT, TILT_3D } from '../../js/rubinview.js';
import { towardSagA } from '../../js/centauri.js';

describe('the Milky Way behind the map (owner, 2026-11-18)', () => {
    it('looks straight down through the flat map, at the south pole of the ecliptic (galactic 276.4, -29.8)', () => {
        const basis = skyBasis(FLAT);
        expect(basis.forward.map((v) => v + 0)).toEqual([0, 0, -1]);
        const { l, b } = skyAt(basis, 0, 0);
        expect(l).toBeCloseTo(276.38, 1);
        expect(b).toBeCloseTo(-29.81, 1);
    });

    it('puts Sagittarius A* at the very centre of the galaxy, looking straight at it', () => {
        const forward = towardSagA().way;
        const right = [forward[1], -forward[0], 0].map((v) => v / Math.hypot(forward[0], forward[1]));
        const up = [right[1] * forward[2] - right[2] * forward[1], right[2] * forward[0] - right[0] * forward[2], right[0] * forward[1] - right[1] * forward[0]];
        const { l, b } = skyAt({ forward, right, up }, 0, 0);
        expect(Math.min(l, 360 - l)).toBeLessThan(0.1);
        expect(Math.abs(b)).toBeLessThan(0.1);
    });

    it('keeps the camera square: its three directions at right angles, at any turn and tilt', () => {
        const { right, up, forward } = skyBasis({ turn: 0.7, tilt: TILT_3D });
        const dot = (a, c) => a.reduce((s, v, k) => s + v * c[k], 0);
        expect(dot(right, up)).toBeCloseTo(0, 12);
        expect(dot(right, forward)).toBeCloseTo(0, 12);
        expect(dot(up, forward)).toBeCloseTo(0, 12);
        expect(dot(forward, forward)).toBeCloseTo(1, 12);
    });

    it('fades out with the window, as the stylesheet does', () => {
        expect(windowFade(0.5, 1)).toBe(1);
        expect(windowFade(0.85, 1)).toBeCloseTo(0.5, 6);
        expect(windowFade(1, 1)).toBe(0);
        expect(windowFade(1.2, 1)).toBe(0);
    });

    it('paints the band where the galaxy is and nothing beyond the window', () => {
        /* A sky dark everywhere but a bright band 2 degrees either side of latitude 0. */
        const texture = { width: 36, height: 18, data: new Uint8Array(36 * 18).map((_, i) => (Math.floor(i / 36) === 8 || Math.floor(i / 36) === 9 ? 255 : 0)) };
        const size = 40;
        const image = { width: size, height: size, data: new Uint8ClampedArray(size * size * 4) };
        paintSky(image, texture, FLAT, 1);
        const alpha = (x, y) => image.data[(y * size + x) * 4 + 3];
        expect(alpha(0, 0)).toBe(0);
        const basis = skyBasis(FLAT);
        let brightest = 0;
        let where = null;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (alpha(x, y) > brightest) { brightest = alpha(x, y); where = [x, y]; }
        expect(brightest).toBeGreaterThan(50);
        const [px, py] = [(2 * (where[0] + 0.5)) / size - 1, 1 - (2 * (where[1] + 0.5)) / size];
        expect(Math.abs(skyAt(basis, px, py).b)).toBeLessThan(12);
    });
});
