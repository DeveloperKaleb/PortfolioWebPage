import { describe, it, expect } from 'vitest';
import { gmst, horizonToSky, deviceToHorizon, cameraToDevice, aimedTurn, averageTurn, cameraAltitude, turnRate, steadiness, STEADY, solveAimed, times, turnBetween, frameTurn, addAligned, frameRate, keepFrame, KEEP_RATE } from '../../js/skyaim.js';
import { apply, applyT, skyObjects, skyVector, focalPixels, toPixel } from '../../js/skysolve.js';
import { jdFromDate } from '../../js/orbit.js';

const DEG = Math.PI / 180;
function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const close = (a, b, eps = 1e-9) => a.forEach((v, k) => expect(v).toBeCloseTo(b[k], -Math.log10(eps)));

// Madison, WI, at 1:10 AM local on 2026-11-22, as in the owner's first photos.
const JD = jdFromDate(new Date('2026-11-22T07:10:00Z'));
const LAT = 43.07, LON = -89.4;
const objects = skyObjects(JD);

describe('where the phone points', () => {
    it('keeps sidereal time from J2000', () => {
        expect(gmst(2451545)).toBeCloseTo(280.46061837, 8);
        // One sidereal day on: the same sidereal time.
        expect(gmst(2451545 + 0.99726957)).toBeCloseTo(280.4606, 2);
    });

    it("tells how high the camera points from the tilt alone, as the full turn does", () => {
        expect(cameraAltitude(0, 0)).toBeCloseTo(-90, 9); // flat on a table, screen up
        expect(cameraAltitude(90, 0)).toBeCloseTo(0, 9); // upright, portrait
        expect(cameraAltitude(180, 0)).toBeCloseTo(90, 9); // screen down, lens to the zenith
        for (const [alpha, beta, gamma] of [[30, 140, 10], [200, 60, -25], [90, 100, 70], [0, 20, 0]]) {
            const lens = apply(times(deviceToHorizon(alpha, beta, gamma), cameraToDevice(0)), [0, 0, 1]);
            expect(cameraAltitude(beta, gamma)).toBeCloseTo(Math.asin(lens[2]) / DEG, 9);
        }
    });

    it('puts the celestial pole at the latitude, due north', () => {
        const H = horizonToSky(JD, LAT, LON);
        const pole = applyT(H, [0, 0, 1]); // east, north, up
        expect(pole[0]).toBeCloseTo(0, 9);
        expect(Math.asin(pole[2]) / DEG).toBeCloseTo(LAT, 6);
    });

    it('reads the spec frames: upright facing north looks north, flat looks down', () => {
        const upright = times(deviceToHorizon(0, 90, 0), cameraToDevice(0));
        close(apply(upright, [0, 0, 1]), [0, 1, 0]);  // lens: north
        close(apply(upright, [1, 0, 0]), [1, 0, 0]);  // picture's right: east
        close(apply(upright, [0, 1, 0]), [0, 0, -1]); // picture's down: down
        const flat = times(deviceToHorizon(0, 0, 0), cameraToDevice(0));
        close(apply(flat, [0, 0, 1]), [0, 0, -1]);
        // Facing east (alpha counts anticlockwise from north, so east is 270).
        close(apply(times(deviceToHorizon(270, 90, 0), cameraToDevice(0)), [0, 0, 1]), [1, 0, 0]);
        // Turned to landscape, the lens still looks the same way.
        close(apply(times(deviceToHorizon(0, 90, 0), cameraToDevice(90)), [0, 0, 1]), [0, 1, 0]);
    });

    it('points at the zenith star when held straight up', () => {
        const R = aimedTurn({ alpha: 0, beta: 180, gamma: 0, jd: JD, lat: LAT, lon: LON });
        const zenith = skyVector(gmst(JD) + LON, LAT);
        expect(turnBetween(R, R)).toBeCloseTo(0, 6);
        close(apply(R, [0, 0, 1]), zenith, 1e-6);
    });

    it('averages readings into a turn', () => {
        const a = deviceToHorizon(10, 80, 2), b = deviceToHorizon(14, 82, -2);
        const m = averageTurn([a, b]);
        expect(turnBetween(m, a)).toBeLessThan(turnBetween(a, b));
        close(times(m, [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]), [1, 0, 0, 0, 1, 0, 0, 0, 1], 1e-9);
    });
});

/* A made-up shot taken in the page: the true turn, the phone's reading of it (off by
   wrong degrees about a random axis), and its few brightest stars found. */
function shot({ alpha, beta, gamma = 0, wrong = 15, keep = 3, seed = 1, width = 1200, height = 1600 }) {
    const r = rng(seed);
    const R = aimedTurn({ alpha, beta, gamma, jd: JD, lat: LAT, lon: LON });
    const axis = (() => { const v = [r() - 0.5, r() - 0.5, r() - 0.5]; const n = Math.hypot(...v); return v.map((x) => x / n); })();
    const [x, y, z] = axis, c = Math.cos(wrong * DEG), s = Math.sin(wrong * DEG), t = 1 - c;
    const W = [c + x * x * t, x * y * t - z * s, x * z * t + y * s, y * x * t + z * s, c + y * y * t, y * z * t - x * s, z * x * t - y * s, z * y * t + x * s, c + z * z * t];
    const f = focalPixels(26, width, height);
    const found = [];
    for (const o of objects) {
        const p = toPixel({ R, f }, o.v, width, height);
        if (!p) continue;
        found.push({ x: p.x, y: p.y, flux: 10 ** (-0.4 * o.mag) * (0.8 + 0.4 * r()), truth: o.name });
        if (found.length === keep) break;
    }
    found.sort((a, b) => b.flux - a.flux);
    // The lens guess a little off too, as the page's is.
    return { found, width, height, R0: times(W, R), f0: f * 1.08, R };
}

describe('naming stars with the phone as a head start', () => {
    // Facing north-east and south, 45 to 70 degrees up.
    const aims = [[315, 135], [180, 120], [90, 150]];

    it('names three stars when the compass is 15 degrees out', () => {
        for (const [alpha, beta] of aims) {
            const s = shot({ alpha, beta, keep: 3 });
            const got = solveAimed(s.found, s.width, s.height, objects, { R0: s.R0, f0: s.f0 });
            expect(got.confidence).toBe('likely');
            for (const m of got.matches) expect(m.object.name).toBe(m.star.truth);
            expect(turnBetween(got.R, s.R) / DEG).toBeLessThan(1);
        }
    });

    it('names two', () => {
        for (const [alpha, beta] of aims) {
            const s = shot({ alpha, beta, keep: 2, seed: 4 });
            const got = solveAimed(s.found, s.width, s.height, objects, { R0: s.R0, f0: s.f0 });
            expect(got.matches.length).toBe(2);
            for (const m of got.matches) expect(m.object.name).toBe(m.star.truth);
        }
    });

    it('is sure with five', () => {
        const s = shot({ alpha: 200, beta: 130, keep: 5, wrong: 20, seed: 9 });
        const got = solveAimed(s.found, s.width, s.height, objects, { R0: s.R0, f0: s.f0 });
        expect(got.confidence).toBe('sure');
        for (const m of got.matches) expect(m.object.name).toBe(m.star.truth);
    });

    it('guesses one, and says it is a guess', () => {
        const s = shot({ alpha: 315, beta: 135, keep: 1, wrong: 8 });
        const got = solveAimed(s.found, s.width, s.height, objects, { R0: s.R0, f0: s.f0 });
        expect(got.confidence).toBe('guess');
        expect(got.matches).toHaveLength(1);
    });

    /* A real sky hides some stars behind cloud and adds false spots (planes, lights). A wrong
       answer may happen then, but it must rarely be called likely or sure. */
    it('seldom calls a wrong answer likely or sure, with clouds and false spots', () => {
        const r = rng(7);
        let confidentWrong = 0, right = 0;
        for (let n = 0; n < 100; n++) {
            const s = shot({ alpha: r() * 360, beta: 110 + r() * 70, gamma: (r() - 0.5) * 20, keep: 12, seed: n + 100 });
            const kept = s.found.filter(() => r() > 0.3).slice(0, 3);
            const faint = Math.min(...kept.map((q) => q.flux));
            kept.push({ x: r() * s.width, y: r() * s.height, flux: faint * (0.5 + 2 * r()), truth: null });
            kept.sort((a, b) => b.flux - a.flux);
            const got = solveAimed(kept, s.width, s.height, objects, { R0: s.R0, f0: s.f0 });
            const allRight = got.matches.every((m) => m.object.name === m.star.truth);
            if (allRight) right++;
            else if (got.confidence !== 'guess') confidentWrong++;
        }
        expect(confidentWrong).toBeLessThanOrEqual(3);
        expect(right).toBeGreaterThanOrEqual(85);
    });

    it('takes well under a second', () => {
        const s = shot({ alpha: 90, beta: 150, keep: 8, seed: 3 });
        const t = performance.now();
        solveAimed(s.found, s.width, s.height, objects, { R0: s.R0, f0: s.f0 });
        expect(performance.now() - t).toBeLessThan(1500);
    });
});

describe('how steady the phone is', () => {
    const at = (t, alpha, beta, gamma) => ({ t, alpha, beta, gamma });

    it('measures a steady turn in degrees a second', () => {
        // Tilting up at 2 degrees a second, read 60 times a second.
        const s = Array.from({ length: 40 }, (_, k) => at(1000 + k * 1000 / 60, 30, 100 + 2 * k / 60, 0));
        expect(turnRate(s)).toBeCloseTo(2, 1);
        expect(steadiness(turnRate(s))).toBe('moving');
    });

    it("does not count the sensor's flicker as shaking", () => {
        // +-0.05 degrees of noise on a phone that is not moving.
        const s = Array.from({ length: 40 }, (_, k) => at(1000 + k * 1000 / 60, 30 + (k % 2 ? 0.05 : -0.05), 100 + (k % 3 ? 0.05 : -0.05), 0));
        expect(turnRate(s)).toBeLessThan(STEADY.still);
        expect(steadiness(turnRate(s))).toBe('still');
    });

    it('looks only at the last moments, and says nothing until it can', () => {
        const old = Array.from({ length: 30 }, (_, k) => at(k * 20, 30, 100 + k, 0)); // moving, long ago
        const now = Array.from({ length: 40 }, (_, k) => at(5000 + k * 20, 30, 130, 0)); // still since
        expect(steadiness(turnRate([...old, ...now]))).toBe('still');
        expect(turnRate([at(0, 1, 2, 3)])).toBeNull();
        expect(steadiness(null)).toBeNull();
        expect(steadiness(0.5)).toBe('nearly');
    });
});

describe('lining up the frames of a shot (owner, 2026-11-27)', () => {
    const W = 120, H = 160, f = 120;
    // A dark frame with one bright pixel, as the camera saw it from where it pointed.
    const frameWith = (x, y) => { const d = new Uint8ClampedArray(W * H * 4); d[(y * W + x) * 4] = 200; return d; };
    const brightest = (sum, count) => {
        let best = -1, at = null;
        for (let i = 0; i < W * H; i++) { const v = count[i] ? sum[i * 4] / count[i] : 0; if (v > best) { best = v; at = [i % W, Math.floor(i / W)]; } }
        return at;
    };

    it('the same aim adds pixel to pixel', () => {
        const sum = new Uint16Array(W * H * 4), count = new Uint16Array(W * H);
        const R = aimedTurn({ alpha: 30, beta: 140, gamma: 2, jd: 2461372.6, lat: 43, lon: -89.4 });
        addAligned(sum, count, frameWith(70, 90), W, H, frameTurn(R, R), f);
        expect(brightest(sum, count)).toEqual([70, 90]);
        expect(count.every((c) => c === 1)).toBe(true);
    });

    it('a frame taken after the phone turned lands back where the first frame saw the star', () => {
        const at = { jd: 2461372.6, lat: 43, lon: -89.4 };
        const R0 = aimedTurn({ alpha: 30, beta: 140, gamma: 2, ...at });
        const R1 = aimedTurn({ alpha: 31.5, beta: 141, gamma: 2.5, ...at });
        // Where a star at the first frame's pixel (60, 80) shows in the second frame.
        const star = apply(R0, [60 + 0.5 - W / 2, 80 + 0.5 - H / 2, f].map((v, _, a) => v / Math.hypot(...a)));
        const c = applyT(R1, star);
        const x1 = Math.floor(W / 2 + f * c[0] / c[2]), y1 = Math.floor(H / 2 + f * c[1] / c[2]);
        expect(Math.hypot(x1 - 60, y1 - 80)).toBeGreaterThan(2);
        const sum = new Uint16Array(W * H * 4), count = new Uint16Array(W * H);
        addAligned(sum, count, frameWith(x1, y1), W, H, frameTurn(R0, R1), f);
        const [x, y] = brightest(sum, count);
        expect(Math.hypot(x - 60, y - 80)).toBeLessThanOrEqual(1);
    });
});

describe('keeping the steady moments of a shot (owner, 2026-11-27)', () => {
    const at = { jd: 2461372.6, lat: 43, lon: -89.4 };
    it('measures how fast the phone turned between two frames', () => {
        const A = aimedTurn({ alpha: 30, beta: 140, gamma: 0, ...at });
        const B = aimedTurn({ alpha: 30, beta: 141, gamma: 0, ...at });
        expect(frameRate(A, B, 500)).toBeCloseTo(2, 5);
        expect(frameRate(A, A, 100)).toBeCloseTo(0, 5);
        expect(frameRate(A, B, 0)).toBeNull();
    });
    it('keeps frames taken while it turned slowly, and leaves out a twitch', () => {
        expect(keepFrame(0.4)).toBe(true);
        expect(keepFrame(KEEP_RATE)).toBe(true);
        expect(keepFrame(2.7)).toBe(false);
        expect(keepFrame(null)).toBe(true);
    });
});
