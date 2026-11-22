import { describe, it, expect } from 'vitest';
import { toGray, fitSize, photoStats, findStars, judgeSky, MIN_STARS, MAX_SIDE } from '../../js/skyphoto.js';

// A repeatable made-up night: a seeded random, Gaussian noise, Gaussian stars.
function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
function sky({ width = 400, height = 300, level = 20, noise = 3, gradient = 0, stars = [], hot = [], seed = 1 }) {
    const r = rng(seed);
    const gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
    const gray = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) gray[y * width + x] = level + gradient * (y / height) + noise * gauss();
    }
    for (const { x, y, flux, fwhm = 2.5 } of stars) {
        const s = fwhm / 2.3548;
        for (let dy = -8; dy <= 8; dy++) {
            for (let dx = -8; dx <= 8; dx++) {
                const px = Math.round(x) + dx, py = Math.round(y) + dy;
                if (px < 0 || py < 0 || px >= width || py >= height) continue;
                gray[py * width + px] += flux / (2 * Math.PI * s * s) * Math.exp(-((px - x) ** 2 + (py - y) ** 2) / (2 * s * s));
            }
        }
    }
    for (const [x, y] of hot) gray[y * width + x] = 255;
    return { gray, width, height };
}
const field = (n, seed) => {
    const r = rng(seed);
    return Array.from({ length: n }, () => ({ x: 15 + r() * 370, y: 15 + r() * 270, flux: 300 + r() * 3000 }));
};

describe('sky photos', () => {
    it('shrink a photo to the searched size, keeping its shape', () => {
        expect(fitSize(4000, 3000)).toEqual({ width: MAX_SIDE, height: 1200 });
        expect(fitSize(3000, 4000)).toEqual({ width: 1200, height: MAX_SIDE });
        expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
    });

    it('read brightness from colour', () => {
        const gray = toGray(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]), 2, 1);
        expect(gray[0]).toBeCloseTo(255, 3);
        expect(gray[1]).toBe(0);
    });

    it('find every star to a fraction of a pixel, brightest first', () => {
        const stars = field(25, 7);
        const pic = sky({ stars, gradient: 30 });
        const found = findStars(pic.gray, pic.width, pic.height);
        expect(found.length).toBe(stars.length);
        for (const s of stars) {
            const near = found.find((f) => Math.hypot(f.x - s.x, f.y - s.y) < 0.4);
            expect(near, `star at ${s.x.toFixed(1)}, ${s.y.toFixed(1)}`).toBeTruthy();
        }
        for (let i = 1; i < found.length; i++) expect(found[i].flux).toBeLessThanOrEqual(found[i - 1].flux);
    });

    it('pass over hot pixels, smears and plain noise', () => {
        const pic = sky({ hot: [[50, 50], [200, 120], [333, 222]], stars: [{ x: 100, y: 100, flux: 40000, fwhm: 14 }], seed: 3 });
        expect(findStars(pic.gray, pic.width, pic.height)).toEqual([]);
    });

    it('tell a night sky from a day picture or an empty dark one', () => {
        const night = sky({ stars: field(20, 9) });
        const found = findStars(night.gray, night.width, night.height);
        expect(judgeSky(photoStats(night.gray), found)).toEqual({ ok: true });

        const day = sky({ level: 180, noise: 4, stars: field(20, 9) });
        expect(judgeSky(photoStats(day.gray), findStars(day.gray, day.width, day.height)).reason).toBe('bright');

        const cloud = sky({ stars: field(MIN_STARS - 3, 4) });
        const verdict = judgeSky(photoStats(cloud.gray), findStars(cloud.gray, cloud.width, cloud.height));
        expect(verdict.reason).toBe('few');
        expect(verdict.message).toMatch(/outside at night/);
    });
});
