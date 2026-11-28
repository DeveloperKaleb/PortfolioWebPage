/* Sky photos, aim and shoot: matching a photo taken in the page, with the phone's own
 * sense of where it points (compass, tilt, place and time) as a head start. Pure. See
 * NOTES.md, "Sky photos".
 *
 * Without it a photo is recognised by its pattern alone (js/skysolve.js solve), which takes
 * six or more real stars. With it, the bright stars that should be in the picture are
 * known to within the compass's error, so two stars that sit the right distance apart near
 * where two bright stars are expected are enough, and even one is a fair guess.
 *
 * Frames: as js/skysolve.js (camera x right, y down, z out of the lens; sky ICRS), and
 * the horizon's East, North, Up. The device's are the W3C DeviceOrientation spec's: x to
 * the screen's right, y to its top, z out of the screen toward the viewer, in its natural
 * (portrait) orientation.
 */
import { apply, applyT, bestTurn, cameraVector, skyVector, raDec } from './skysolve.js';

const DEG = Math.PI / 180;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const angle = (a, b) => Math.acos(Math.min(1, Math.max(-1, dot(a, b))));
/** Row-major 3x3 product. */
export function times(A, B) {
    const out = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out[3 * i + j] = A[3 * i] * B[j] + A[3 * i + 1] * B[3 + j] + A[3 * i + 2] * B[6 + j];
    return out;
}
/** The angle of the turn between two turns (radians): from the trace of A^T B. */
export function turnBetween(A, B) {
    let trace = 0;
    for (let k = 0; k < 9; k++) trace += A[k] * B[k];
    return Math.acos(Math.min(1, Math.max(-1, (trace - 1) / 2)));
}

/** Greenwich mean sidereal time in degrees (the USNO's approximation; NOTES.md). */
export function gmst(jd) {
    return ((280.46061837 + 360.98564736629 * (jd - 2451545)) % 360 + 360) % 360;
}

/* The turn from the horizon (East, North, Up) at latitude, east longitude (degrees) to the
   sky. Precession is left out: 0.4 degrees by 2026, well inside what the compass leaves. */
export function horizonToSky(jd, lat, lon) {
    const lst = gmst(jd) + lon;
    const up = skyVector(lst, lat);
    const east = skyVector(lst + 90, 0);
    const north = cross(up, east);
    return [east[0], north[0], up[0], east[1], north[1], up[1], east[2], north[2], up[2]];
}

/* The turn from the device to the horizon for DeviceOrientation's alpha, beta, gamma
   (degrees; alpha measured from north), the spec's Rz(alpha) Rx(beta) Ry(gamma). */
export function deviceToHorizon(alpha, beta, gamma) {
    const [ca, sa] = [Math.cos(alpha * DEG), Math.sin(alpha * DEG)];
    const [cb, sb] = [Math.cos(beta * DEG), Math.sin(beta * DEG)];
    const [cg, sg] = [Math.cos(gamma * DEG), Math.sin(gamma * DEG)];
    const Rz = [ca, -sa, 0, sa, ca, 0, 0, 0, 1];
    const Rx = [1, 0, 0, 0, cb, -sb, 0, sb, cb];
    const Ry = [cg, 0, sg, 0, 1, 0, -sg, 0, cg];
    return times(times(Rz, Rx), Ry);
}

/* The turn from the back camera's picture to the device, for the screen's orientation
   angle (screen.orientation.angle: 0 upright, 90 turned a quarter anticlockwise). The
   picture is shown upright on the screen, so its right is the screen's right and its down
   the screen's down; the lens looks out of the back (-z). */
export function cameraToDevice(screenAngle = 0) {
    const c = Math.cos(screenAngle * DEG), s = Math.sin(screenAngle * DEG);
    return [c, -s, 0, -s, -c, 0, 0, 0, -1];
}

/** How high the back camera points, in degrees above the horizon (negative: below), from
    the phone's tilt alone: the lens looks along the device's -z, whose Up part is
    -cos(beta) cos(gamma) whatever the compass says. */
export function cameraAltitude(beta, gamma) {
    return Math.asin(Math.min(1, Math.max(-1, -Math.cos(beta * DEG) * Math.cos(gamma * DEG)))) / DEG;
}

/** How fast the phone is turning, in degrees a second, from its recent orientation
    readings [{ t (ms), alpha, beta, gamma }]: the turn between readings at least
    STEADY.stepMs apart, over the time between them, averaged across the last
    STEADY.windowMs. Steps rather than every reading, so the sensor's own flicker (a tenth
    of a degree or so a reading) does not read as a shaking hand. Null until there is a
    step to measure. */
export const STEADY = { windowMs: 600, stepMs: 100, still: 0.25, nearly: 1 };
export function turnRate(samples, now = samples.at(-1)?.t) {
    const recent = samples.filter((s) => s.t >= now - STEADY.windowMs);
    let turned = 0, time = 0, from = recent[0];
    for (const s of recent.slice(1)) {
        if (s.t - from.t < STEADY.stepMs) continue;
        turned += turnBetween(deviceToHorizon(from.alpha, from.beta, from.gamma), deviceToHorizon(s.alpha, s.beta, s.gamma)) / DEG;
        time += (s.t - from.t) / 1000;
        from = s;
    }
    return time ? turned / time : null;
}
/** 'still', 'nearly' or 'moving' for a turn rate. Under STEADY.still (0.25 degrees a
    second) a 1.2 s shot smears a star by 0.3 degrees at most, about 7 pixels on a main
    camera at 1600 px across; at 1 degree a second, 30. A first guess, to tune from
    calibration reports, which log the rate; the sensor's flicker may set a floor. */
export function steadiness(rate) {
    if (rate == null) return null;
    return rate < STEADY.still ? 'still' : rate < STEADY.nearly ? 'nearly' : 'moving';
}

/** Where the phone says its camera points: the turn from camera to sky. */
export function aimedTurn({ alpha, beta, gamma, screenAngle = 0, jd, lat, lon }) {
    return times(times(horizonToSky(jd, lat, lon), deviceToHorizon(alpha, beta, gamma)), cameraToDevice(screenAngle));
}

/* Lining up the frames of a shot (owner, 2026-11-27). The owner's first night shots were
   held by hand, turning 0.7-2.7 degrees a second, so over the 1.3 s of frames each star was
   smeared 10-30 px (21 px a degree at the main camera) and faded into the noise. Each frame
   has the phone's own reading of where it pointed (aimedTurn), so before it is added it is
   turned back to where the first frame pointed: for a pixel of the first frame, the ray
   it sees (cameraVector) is carried by Ri^T R0 into frame i, and frame i's pixel there is
   the one added. Nearest pixel: the sensors are good to a pixel or two, no better. */

/** The 3x3 turn carrying the first frame's camera rays into frame i's (R0, Ri: camera to sky). */
export function frameTurn(R0, Ri) {
    const RiT = [Ri[0], Ri[3], Ri[6], Ri[1], Ri[4], Ri[7], Ri[2], Ri[5], Ri[8]];
    return times(RiT, R0);
}

/** Adds an RGBA frame into sum (and count, per pixel) as seen from the first frame's aim:
    M from frameTurn, f the focal length in pixels. Pixels that land outside the frame are
    left out, and counted out, so the edges are averaged over the frames that cover them. */
export function addAligned(sum, count, data, width, height, M, f) {
    const cx = width / 2, cy = height / 2;
    for (let y = 0; y < height; y++) {
        const dy = y + 0.5 - cy;
        for (let x = 0; x < width; x++) {
            const dx = x + 0.5 - cx;
            const z = M[6] * dx + M[7] * dy + M[8] * f;
            if (z <= 0) continue;
            const sx = Math.floor(cx + f * (M[0] * dx + M[1] * dy + M[2] * f) / z);
            const sy = Math.floor(cy + f * (M[3] * dx + M[4] * dy + M[5] * f) / z);
            if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
            const from = (sy * width + sx) * 4, to = (y * width + x) * 4;
            sum[to] += data[from];
            sum[to + 1] += data[from + 1];
            sum[to + 2] += data[from + 2];
            count[y * width + x]++;
        }
    }
}

/** Degrees a second the phone turned between two frames' readings (camera-to-sky turns),
    ms apart. */
export function frameRate(A, B, ms) {
    return ms > 0 ? turnBetween(A, B) / DEG / (ms / 1000) : null;
}
/* Which frames of a shot are added (owner, 2026-11-27: keep the steady moments). At a
   tenth of a second a frame, 2 degrees a second smears a star 0.2 degrees, about 4 px at
   the main camera; the sensors' own flicker reads as up to about 1 degree a second
   between frames, so the line sits above it. Unknown (no reading yet) counts as steady. */
export const KEEP_RATE = 2;
export const keepFrame = (rate) => rate == null || rate <= KEEP_RATE;

/* The average of several turns, made a turn again (Gram-Schmidt on its columns): the
   sensors' readings over the second the shot takes. */
export function averageTurn(turns) {
    const m = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const R of turns) for (let k = 0; k < 9; k++) m[k] += R[k];
    const col = (j) => [m[j], m[3 + j], m[6 + j]];
    const norm = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
    const x = norm(col(0));
    const yRaw = col(1), d = dot(x, yRaw);
    const y = norm(yRaw.map((v, k) => v - d * x[k]));
    const z = cross(x, y);
    return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

/** Settings: how far the phone may be wrong (compass and tilt together), how far its
    lens guess may be, how many found stars to use, and how close a third star must land
    (once two stars set the lens and the turn) and how far its brightness may disagree.
    tol was 1 degree: false spots (a plane, a light) were lined up with some star that
    close too often, and a wrong answer then looked sure.
    fSlack 0.15: phones' main cameras are 23-28 mm equivalent around the 26 guessed, with a
    little cropped off for steadying the video. At 0.25 two stars were too easily paired
    with the wrong two (Castor and Dubhe, 44.7 degrees apart, taken for Castor and Alioth,
    58.6). */
export const AIM = { maxTurn: 25 * DEG, fSlack: 0.15, stars: 8, candidates: 150, tol: 0.35 * DEG, magSlack: 2, weigh: 0.3 };

/**
 * Names the stars in a photo taken in the page, with R0 (aimedTurn) and f0 (the lens's
 * focal length in pixels, a guess) as the head start. Returns what solve does, plus
 * confidence: 'sure' (four or more stars line up, few spots left over), 'likely' (two or
 * more, at most one left over) or 'guess' (one star, named as the brightest object near
 * where it should be, or more spots unexplained); or null.
 */
export function solveAimed(found, width, height, objects, { R0, f0, maxTurn = AIM.maxTurn, fSlack = AIM.fSlack, weigh = AIM.weigh } = {}) {
    if (!found.length) return null;
    const cx = width / 2, cy = height / 2;
    const stars = found.slice(0, AIM.stars);
    const cams0 = stars.map((s) => cameraVector(s.x, s.y, f0, cx, cy));
    const axis = apply(R0, [0, 0, 1]);
    const half = Math.atan(Math.hypot(width, height) / 2 / (f0 * (1 - fSlack)));
    // The brightest objects that could be in the picture at all.
    const cands = objects.filter((o) => angle(o.v, axis) <= half + maxTurn).slice(0, AIM.candidates);
    if (!cands.length) return null;
    // How far a star's own spot may be from where the phone puts it: the turn, plus the
    // lens guess's error, which grows away from the middle.
    const reach = cams0.map((c) => maxTurn + fSlack * angle(c, [0, 0, 1]) + 1 * DEG);
    const predicted = cams0.map((c) => apply(R0, c));
    const nearCands = predicted.map((p, i) => cands.map((o, j) => [j, angle(o.v, p)]).filter(([, a]) => a <= reach[i]).map(([j]) => j));
    const fluxMag = (s) => -2.5 * Math.log10(Math.max(s.flux, 1e-9));

    /* Among answers lining up as many stars, the one with the least against it: each
       object it puts in the picture, brighter than the faintest it matched, that was not
       found (clouds can hide one, so this counts rather than rules out); stars whose
       brightness disagrees with their objects' (in magnitudes, spread of the offsets);
       and how far it turns the phone's reading (a fraction of maxTurn). */
    const cost = (R, f, hits) => {
        const matched = new Set(hits.map(([, j]) => j));
        const faintest = Math.max(...hits.map(([, j]) => cands[j].mag));
        let missing = 0;
        for (let j = 0; j < cands.length && cands[j].mag < faintest; j++) {
            if (matched.has(j)) continue;
            const c = applyT(R, cands[j].v);
            if (c[2] <= 0) continue;
            const x = cx + f * c[0] / c[2], y = cy + f * c[1] / c[2];
            if (x >= 0 && y >= 0 && x <= width && y <= height) missing++;
        }
        const offsets = hits.map(([i, j]) => fluxMag(stars[i]) - cands[j].mag);
        const spread = Math.max(...offsets) - Math.min(...offsets);
        return missing + 0.5 * spread + turnBetween(R0, R) / maxTurn;
    };
    let best = null;
    const consider = (R, f, hits) => {
        const value = hits.length - weigh * cost(R, f, hits);
        if (!best || value > best.value) best = { R, f, hits, value };
    };
    for (let i = 0; i < stars.length; i++) {
        for (let k = i + 1; k < stars.length; k++) {
            const a0 = angle(cams0[i], cams0[k]);
            if (a0 < 0.5 * DEG) continue;
            for (const p of nearCands[i]) {
                for (const q of nearCands[k]) {
                    if (p === q) continue;
                    const sep = angle(cands[p].v, cands[q].v);
                    const scale = sep / a0;
                    if (scale < 1 - fSlack || scale > 1 / (1 - fSlack)) continue;
                    // Brighter in the photo should not be far fainter in the sky.
                    const dPhoto = fluxMag(stars[i]) - fluxMag(stars[k]), dSky = cands[p].mag - cands[q].mag;
                    if (Math.abs(dPhoto - dSky) > 3) continue;
                    // The focal length that makes the pair's angle the sky's, by two steps.
                    let f = f0 / scale;
                    for (let n = 0; n < 2; n++) f *= angle(cameraVector(stars[i].x, stars[i].y, f, cx, cy), cameraVector(stars[k].x, stars[k].y, f, cx, cy)) / sep;
                    const cams = stars.map((s) => cameraVector(s.x, s.y, f, cx, cy));
                    const R = bestTurn([cams[i], cams[k]], [cands[p].v, cands[q].v]);
                    if (turnBetween(R0, R) > maxTurn) continue;
                    const hits = [[i, p], [k, q]];
                    const used = new Set([p, q]);
                    // The pair's brightness scale: photo magnitude minus catalogue magnitude.
                    const offset = (fluxMag(stars[i]) - cands[p].mag + fluxMag(stars[k]) - cands[q].mag) / 2;
                    for (let m = 0; m < stars.length; m++) {
                        if (m === i || m === k) continue;
                        const s = apply(R, cams[m]);
                        let bj = -1, ba = Math.max(AIM.tol, 4 / f);
                        for (let j = 0; j < cands.length; j++) {
                            if (used.has(j)) continue;
                            const a = angle(s, cands[j].v);
                            if (a < ba && Math.abs(fluxMag(stars[m]) - cands[j].mag - offset) <= AIM.magSlack) { ba = a; bj = j; }
                        }
                        if (bj >= 0) { used.add(bj); hits.push([m, bj]); }
                    }
                    consider(R, f, hits);
                }
            }
        }
    }
    let confidence;
    if (best) {
        /* Spots left unexplained make it less sure: with two matched and one not, any two
           of the three could be the real pair (made-up shots: right 56% of the time, against
           98% with none left over). */
        const n = best.hits.length, unmatched = stars.length - n;
        confidence = n >= 4 && unmatched < n - 2 ? 'sure' : unmatched < n - 1 ? 'likely' : 'guess';
        if (best.hits.length >= 3) {
            const cams = best.hits.map(([i]) => cameraVector(stars[i].x, stars[i].y, best.f, cx, cy));
            best.R = bestTurn(cams, best.hits.map(([, j]) => cands[j].v));
        }
    } else {
        // One star: the brightest object near where the phone says it is, and the
        // phone's turn nudged the least way that puts it there.
        const [j] = nearCands[0];
        if (j === undefined) return null;
        const R = nudge(R0, predicted[0], cands[j].v);
        best = { R, f: f0, hits: [[0, j]] };
        confidence = 'guess';
    }
    const { R, f, hits } = best;
    let sum = 0;
    for (const [i, j] of hits) sum += angle(apply(R, cameraVector(stars[i].x, stars[i].y, f, cx, cy)), cands[j].v) ** 2;
    return {
        R, f, rms: Math.sqrt(sum / hits.length), confidence,
        centre: raDec(apply(R, [0, 0, 1])),
        fov: { width: 2 * Math.atan(width / 2 / f) / DEG, height: 2 * Math.atan(height / 2 / f) / DEG },
        matches: hits.map(([i, j]) => ({ star: stars[i], object: cands[j] })),
    };
}

/* R0 turned the least way (about a × b, by Rodrigues' formula) that takes sky direction a to b. */
function nudge(R0, a, b) {
    const axis = cross(a, b), s = Math.hypot(...axis), c = dot(a, b);
    if (s < 1e-12) return R0;
    const [x, y, z] = axis.map((v) => v / s);
    const t = 1 - c;
    const T = [
        c + x * x * t, x * y * t - z * s, x * z * t + y * s,
        y * x * t + z * s, c + y * y * t, y * z * t - x * s,
        z * x * t - y * s, z * y * t + x * s, c + z * z * t,
    ];
    return times(T, R0);
}
