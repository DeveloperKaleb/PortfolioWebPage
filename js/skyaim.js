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

/** Where the phone says its camera points: the turn from camera to sky. */
export function aimedTurn({ alpha, beta, gamma, screenAngle = 0, jd, lat, lon }) {
    return times(times(horizonToSky(jd, lat, lon), deviceToHorizon(alpha, beta, gamma)), cameraToDevice(screenAngle));
}

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
