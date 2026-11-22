/* Sky photos, step 2: which stars a photo shows (plate solving), on the phone, with no
 * service asked. Pure. See NOTES.md, "Sky photos".
 *
 * A phone's main camera draws the sky as a pinhole would (a gnomonic projection): a star
 * at pixel (x, y) lies along (x - cx, y - cy, f) from the lens, f the focal length in
 * pixels. Knowing f, the angles between stars in the photo are the angles between them on
 * the sky, whichever way the phone was held. So: guess f from the usual phone lenses (or
 * the photo's own EXIF), take triangles of the brightest stars found, look for triangles
 * of bright catalogue stars with the same three angles and the same handedness, and keep
 * the turn of the sky that lines up the most stars. Then fit f and the turn to every
 * star lined up, and name them.
 *
 * Frames: sky vectors are ICRS (x to RA 0, z to the north pole); camera vectors are x
 * right, y down, z out of the lens. R turns camera vectors into sky vectors.
 */
import { STARS, STAR_COUNT, STAR_NAMES } from './skystars.js';
import { planetElements } from './planets.js';
import { positionAt, earthAt, OBLIQUITY_J2000 } from './orbit.js';

const DEG = Math.PI / 180;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const n = Math.hypot(a[0], a[1], a[2]); return [a[0] / n, a[1] / n, a[2] / n]; };
const angle = (a, b) => Math.acos(Math.min(1, Math.max(-1, dot(a, b))));
export const apply = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
export const applyT = (R, v) => [R[0] * v[0] + R[3] * v[1] + R[6] * v[2], R[1] * v[0] + R[4] * v[1] + R[7] * v[2], R[2] * v[0] + R[5] * v[1] + R[8] * v[2]];

/** Unit vector toward RA, Dec (degrees). */
export function skyVector(ra, dec) {
    const c = Math.cos(dec * DEG);
    return [c * Math.cos(ra * DEG), c * Math.sin(ra * DEG), Math.sin(dec * DEG)];
}
/** RA, Dec (degrees) of a unit vector. */
export function raDec(v) {
    return { ra: ((Math.atan2(v[1], v[0]) / DEG) % 360 + 360) % 360, dec: Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEG };
}

/* Rough V(1,0) of the planets, for ranking them among the stars only (never shown):
   brightness falls with the square of both distances; phase and Saturn's rings are left
   out, which is a few tenths of a magnitude. */
const PLANET_H = { Mercury: -0.6, Venus: -4.4, Mars: -1.5, Jupiter: -9.4, Saturn: -8.9, Uranus: -7.2 };

/** The planets as seen from Earth on a Julian date: { name, v (sky vector), mag }. */
export function planetsSeen(jd) {
    const earth = earthAt(jd);
    const c = Math.cos(OBLIQUITY_J2000), s = Math.sin(OBLIQUITY_J2000);
    return Object.keys(PLANET_H).map((name) => {
        const p = positionAt(planetElements(name, jd), jd);
        const x = p.x - earth.x, y = p.y - earth.y, z = p.z - earth.z;
        const delta = Math.hypot(x, y, z);
        // Ecliptic to equatorial: about x by the obliquity.
        const v = unit([x, c * y - s * z, s * y + c * z]);
        return { name, v, mag: PLANET_H[name] + 5 * Math.log10(p.r * delta) };
    });
}

/** Every catalogue star as { hip, name, v, mag }, brightest first, with the planets of jd placed among them. */
export function skyObjects(jd) {
    const out = [];
    for (let k = 0; k < STAR_COUNT; k++) {
        const hip = STARS[4 * k];
        out.push({ hip, name: STAR_NAMES[hip] ?? `HIP ${hip}`, v: skyVector(STARS[4 * k + 1] / 1000, STARS[4 * k + 2] / 1000), mag: STARS[4 * k + 3] / 100 });
    }
    if (jd != null) for (const p of planetsSeen(jd)) out.push({ planet: true, name: p.name, v: p.v, mag: p.mag });
    return out.sort((a, b) => a.mag - b.mag);
}

/** Focal length in pixels from a 35 mm-equivalent focal length (the diagonal of 36 x 24 mm is 43.27 mm). */
export const focalPixels = (mm35, width, height) => mm35 * Math.hypot(width, height) / 43.27;

/* The lenses to try when the photo does not say: phones' main cameras are about 22 to 32 mm
   equivalent (stepped 5%, so a guess is never more than 2.5% out and the triangle
   tolerance covers it), their ultra-wides about 13, their zooms 48 to 77. */
export const GUESS_MM = [26, 24.8, 27.3, 23.6, 28.7, 22.5, 30.1, 31.6, 13, 14, 15.5, 48, 52, 65, 77];

/** A photo pixel (x, y) as a camera unit vector, for focal length f and centre (cx, cy). */
export const cameraVector = (x, y, f, cx, cy) => unit([x - cx, y - cy, f]);

/* The best turn R with R c_k ~ s_k for pairs of unit vectors (Wahba's problem), by Horn's
   quaternion method: the top eigenvector of a 4x4 symmetric matrix, by Jacobi sweeps. */
export function bestTurn(cams, skies) {
    const B = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let k = 0; k < cams.length; k++) {
        const c = cams[k], s = skies[k];
        // Horn's S_ij: the sum of camera_i x sky_j, so the quaternion turns camera into sky.
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) B[3 * i + j] += c[i] * s[j];
    }
    const [Sxx, Sxy, Sxz, Syx, Syy, Syz, Szx, Szy, Szz] = B;
    const N = [
        [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
        [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
        [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
        [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
    ];
    const V = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
    for (let sweep = 0; sweep < 30; sweep++) {
        let off = 0;
        for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) off += N[p][q] ** 2;
        if (off < 1e-18) break;
        for (let p = 0; p < 4; p++) {
            for (let q = p + 1; q < 4; q++) {
                if (Math.abs(N[p][q]) < 1e-300) continue;
                const theta = (N[q][q] - N[p][p]) / (2 * N[p][q]);
                const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
                const c = 1 / Math.sqrt(t * t + 1), s = t * c;
                for (let k = 0; k < 4; k++) {
                    const a = N[k][p], b = N[k][q];
                    N[k][p] = c * a - s * b; N[k][q] = s * a + c * b;
                }
                for (let k = 0; k < 4; k++) {
                    const a = N[p][k], b = N[q][k];
                    N[p][k] = c * a - s * b; N[q][k] = s * a + c * b;
                }
                for (let k = 0; k < 4; k++) {
                    const a = V[k][p], b = V[k][q];
                    V[k][p] = c * a - s * b; V[k][q] = s * a + c * b;
                }
            }
        }
    }
    let top = 0;
    for (let k = 1; k < 4; k++) if (N[k][k] > N[top][top]) top = k;
    const [w, x, y, z] = [V[0][top], V[1][top], V[2][top], V[3][top]];
    return [
        w * w + x * x - y * y - z * z, 2 * (x * y - w * z), 2 * (x * z + w * y),
        2 * (x * y + w * z), w * w - x * x + y * y - z * z, 2 * (y * z - w * x),
        2 * (x * z - w * y), 2 * (y * z + w * x), w * w - x * x - y * y + z * z,
    ];
}

/* The catalogue's pairs closer than maxSep, sorted by separation (typed arrays), and each
   object's neighbours the same way (start[i] to start[i + 1] in idx and ang): what the
   triangle search looks things up in. */
function pairIndex(objects, maxSep) {
    const n = objects.length, cosMax = Math.cos(maxSep);
    const list = [];
    const near = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
        const vi = objects[i].v;
        for (let j = i + 1; j < n; j++) {
            const d = dot(vi, objects[j].v);
            if (d < cosMax) continue;
            const a = Math.acos(Math.min(1, d));
            list.push(a, i, j);
            near[i].push(a, j);
            near[j].push(a, i);
        }
    }
    const count = list.length / 3;
    const order = Array.from({ length: count }, (_, k) => k).sort((p, q) => list[3 * p] - list[3 * q]);
    const pairA = new Float64Array(count), pairU = new Int32Array(count), pairW = new Int32Array(count);
    order.forEach((k, m) => { pairA[m] = list[3 * k]; pairU[m] = list[3 * k + 1]; pairW[m] = list[3 * k + 2]; });
    const start = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) start[i + 1] = start[i] + near[i].length / 2;
    const idx = new Int32Array(start[n]), ang = new Float64Array(start[n]);
    for (let i = 0; i < n; i++) {
        const l = near[i];
        const o = Array.from({ length: l.length / 2 }, (_, t) => t).sort((p, q) => l[2 * p] - l[2 * q]);
        o.forEach((t, m) => { ang[start[i] + m] = l[2 * t]; idx[start[i] + m] = l[2 * t + 1]; });
    }
    return { pairA, pairU, pairW, start, idx, ang };
}
function firstAtLeast(sorted, value, lo = 0, hi = sorted.length) {
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < value) lo = mid + 1; else hi = mid; }
    return lo;
}
const handed = (a, b, c) => Math.sign(dot(cross(a, b), c));

/* The objects by where they are, in cubes of the unit sphere's space CUBE across (about
   1.1 degrees), so the objects near a direction are found by looking only in the cubes
   within the tolerance of it (usually one to four) rather than at every object. Good for
   tolerances up to CUBE. */
const CUBE = 0.02;
const cubeOf = (v) => [Math.floor((v[0] + 1) / CUBE), Math.floor((v[1] + 1) / CUBE), Math.floor((v[2] + 1) / CUBE)];
const cubeKey = (x, y, z) => (x * 256 + y) * 256 + z;
function cubes(objects) {
    const map = new Map();
    objects.forEach((o, j) => {
        const [x, y, z] = cubeOf(o.v);
        const key = cubeKey(x, y, z);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(j);
    });
    return map;
}
function nearest(map, objects, s, cosTol, chord) {
    const [x, y, z] = cubeOf(s);
    // Which neighbouring cubes the tolerance reaches into, along each axis.
    const span = (c, k) => { const t = (s[k] + 1) / CUBE - c; return [t * CUBE < chord ? -1 : 0, (1 - t) * CUBE < chord ? 1 : 0]; };
    const [x0, x1] = span(x, 0), [y0, y1] = span(y, 1), [z0, z1] = span(z, 2);
    let best = -1, bestDot = cosTol;
    for (let dx = x0; dx <= x1; dx++) for (let dy = y0; dy <= y1; dy++) for (let dz = z0; dz <= z1; dz++) {
        const list = map.get(cubeKey(x + dx, y + dy, z + dz));
        if (!list) continue;
        for (const j of list) { const d = dot(s, objects[j].v); if (d > bestDot) { bestDot = d; best = j; } }
    }
    return [best, bestDot];
}

/* What is worked out once per catalogue and kept: the cubes, and pair indexes for the
   brightest K objects (K in steps, so the lens guesses share them) out to a few widths. */
const prepared = new WeakMap();
const K_STEPS = [100, 200, 400, 800, 1600];
const SEP_STEPS = [50 * DEG, 90 * DEG, 120 * DEG];
function preparedFor(objects) {
    if (!prepared.has(objects)) prepared.set(objects, { cubes: cubes(objects), sub: new Map(), pairs: new Map() });
    return prepared.get(objects);
}
function tierFor(objects, K, diag) {
    const prep = preparedFor(objects);
    const k = Math.min(objects.length, K_STEPS.find((t) => t >= K) ?? K_STEPS.at(-1));
    const sep = SEP_STEPS.find((t) => t >= diag) ?? SEP_STEPS.at(-1);
    const key = `${k}:${sep}`;
    if (!prep.sub.has(k)) { const sub = objects.slice(0, k); prep.sub.set(k, { sub, cubes: cubes(sub) }); }
    if (!prep.pairs.has(key)) prep.pairs.set(key, pairIndex(prep.sub.get(k).sub, sep));
    return { ...prep.sub.get(k), index: prep.pairs.get(key) };
}

/* How many photo stars a turn puts on a catalogue object, each object used once:
   [[photo index, object index], ...], nearest first. With need, it stops (returning what
   it has) as soon as too many have missed for need to be reached. */
function lineUp(R, cams, objects, map, tol, need = 0) {
    const cosTol = Math.cos(tol), chord = 2 * Math.sin(tol / 2);
    const cands = [];
    for (let i = 0; i < cams.length; i++) {
        const [best, d] = nearest(map, objects, apply(R, cams[i]), cosTol, chord);
        if (best >= 0) cands.push([d, i, best]);
        else if (cands.length + cams.length - 1 - i < need) return [];
    }
    cands.sort((a, b) => b[0] - a[0]);
    const taken = new Set();
    const hits = [];
    for (const [, i, j] of cands) if (!taken.has(j)) { taken.add(j); hits.push([i, j]); }
    return hits;
}

/* Fitting f and R to lined-up pairs: R by bestTurn for each f, f by golden section on
   the mean squared miss. */
function fitFocal(found, pairs, objects, f0, cx, cy) {
    const miss = (f) => {
        const cams = pairs.map(([i]) => cameraVector(found[i].x, found[i].y, f, cx, cy));
        const skies = pairs.map(([, j]) => objects[j].v);
        const R = bestTurn(cams, skies);
        let sum = 0;
        for (let k = 0; k < cams.length; k++) sum += angle(apply(R, cams[k]), skies[k]) ** 2;
        return { R, rms: Math.sqrt(sum / cams.length) };
    };
    let a = f0 * 0.85, b = f0 * 1.15;
    const g = (Math.sqrt(5) - 1) / 2;
    let c = b - g * (b - a), d = a + g * (b - a);
    let fc = miss(c).rms, fd = miss(d).rms;
    for (let k = 0; k < 40; k++) {
        if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = miss(c).rms; }
        else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = miss(d).rms; }
    }
    const f = (a + b) / 2;
    return { f, ...miss(f) };
}

/** Matching settings: how many photo stars to try triangles from and to check against,
    and how long to look before giving up (ms; a phone is several times slower than the
    computer the tests run on). */
export const SOLVE = { triangleStars: 10, checkStars: 30, maxTriangles: 120, minMatches: 6, budgetMs: 20000 };

/**
 * Solves a photo: found stars (brightest first, from js/skyphoto.js findStars), its size,
 * the catalogue (skyObjects), and the 35 mm-equivalent focal lengths to try. Returns
 * { R, f, rms, matches: [{ star, object }], centre: {ra, dec}, fov } or null; or
 * { gaveUp: true } when the time ran out first.
 */
export function solve(found, width, height, objects, { mm = GUESS_MM, budgetMs = SOLVE.budgetMs, now = () => performance.now() } = {}) {
    if (found.length < 4) return null;
    const until = now() + budgetMs;
    const cx = width / 2, cy = height / 2;
    const top = found.slice(0, SOLVE.triangleStars);
    const check = found.slice(0, SOLVE.checkStars);
    const all = preparedFor(objects).cubes;
    /* The first side may differ by the lens guess's error (up to 2.5%) and more; once it is
       matched, that sets the scale, and the other two sides must agree with it closely: a
       wrong f changes every angle by nearly the same factor (to within 0.5% across a
       phone's field, from the tangent). */
    const loose = (a) => 0.028 * a + 0.15 * DEG;
    const tight = (a) => 0.006 * a + 0.12 * DEG;
    for (const mm35 of mm) {
        const f = focalPixels(mm35, width, height);
        const diag = 2 * Math.atan(Math.hypot(width, height) / 2 / f);
        const area = (2 * Math.atan(width / 2 / f)) * (2 * Math.atan(height / 2 / f)) / (4 * Math.PI);
        // About twice as many catalogue objects in the field as the photo has stars.
        const { sub, cubes: subCubes, index } = tierFor(objects, Math.max(60, Math.round(2 * check.length / area)), diag);
        const { pairA, pairU, pairW, start, idx, ang } = index;
        const cams = top.map((s) => cameraVector(s.x, s.y, f, cx, cy));
        const checkCams = check.map((s) => cameraVector(s.x, s.y, f, cx, cy));
        const need = Math.max(SOLVE.minMatches, Math.ceil(0.4 * Math.min(check.length, 20)));
        const quick = Math.min(cams.length, Math.max(4, Math.ceil(0.4 * cams.length)));
        let tried = 0;
        for (let k = 2; k < cams.length && tried < SOLVE.maxTriangles; k++) {
            for (let j = 1; j < k && tried < SOLVE.maxTriangles; j++) {
                for (let i = 0; i < j && tried < SOLVE.maxTriangles; i++) {
                    tried++;
                    if (now() > until) return { gaveUp: true };
                    const a = angle(cams[i], cams[j]), b = angle(cams[i], cams[k]), c = angle(cams[j], cams[k]);
                    if (Math.min(a, b, c) < 1.5 * DEG) continue;
                    const hand = handed(cams[i], cams[j], cams[k]);
                    const ta = loose(a), tb = tight(b), tc = tight(c);
                    for (let m = firstAtLeast(pairA, a - ta); m < pairA.length && pairA[m] <= a + ta; m++) {
                        const scale = pairA[m] / a, bs = b * scale, cs = c * scale;
                        for (let turn = 0; turn < 2; turn++) {
                            const p = turn ? pairW[m] : pairU[m], q = turn ? pairU[m] : pairW[m];
                            for (let r = firstAtLeast(ang, bs - tb, start[p], start[p + 1]); r < start[p + 1] && ang[r] <= bs + tb; r++) {
                                const o = idx[r];
                                if (o === q) continue;
                                if (Math.abs(angle(sub[q].v, sub[o].v) - cs) > tc) continue;
                                if (handed(sub[p].v, sub[q].v, sub[o].v) !== hand) continue;
                                const R = bestTurn([cams[i], cams[j], cams[k]], [sub[p].v, sub[q].v, sub[o].v]);
                                /* First the stars the triangles come from: a true turn lines
                                   up most of them, and a chance one is dropped after a few
                                   misses. Then the rest. */
                                if (lineUp(R, cams, sub, subCubes, 0.5 * DEG, quick).length < quick) continue;
                                const hits = lineUp(R, checkCams, sub, subCubes, 0.5 * DEG, need);
                                if (hits.length < need) continue;
                                // sub is the start of objects, so its indices are objects' too.
                                const result = refine(found, width, height, objects, all, f, hits);
                                if (result) return result;
                            }
                        }
                    }
                }
            }
        }
    }
    return null;
}

/* From a first line-up to the answer: fit f and R, line up every found star against the
   whole catalogue with a tighter tolerance and the brightness check, fit again; then judge
   it. A true answer lines up at least half of the 20 brightest stars found to within a
   few pixels; a chance one, from a triangle that happened to fit, does not. */
function refine(found, width, height, objects, map, f0, pairs) {
    const cx = width / 2, cy = height / 2;
    let fit = fitFocal(found, pairs, objects, f0, cx, cy);
    for (let round = 0; round < 3; round++) {
        const tol = Math.max(3 / fit.f, Math.min(2.5 * fit.rms, 0.3 * DEG));
        const cams = found.map((s) => cameraVector(s.x, s.y, fit.f, cx, cy));
        const hits = lineUp(fit.R, cams, objects, map, tol);
        pairs = brightEnough(found, objects, hits);
        if (pairs.length < SOLVE.minMatches) return null;
        fit = fitFocal(found, pairs, objects, fit.f, cx, cy);
    }
    const topMatched = pairs.filter(([i]) => i < 20).length;
    if (topMatched < Math.ceil(0.5 * Math.min(found.length, 20))) return null;
    if (fit.rms * fit.f > 2.5) return null;
    const centre = raDec(apply(fit.R, [0, 0, 1]));
    return {
        R: fit.R, f: fit.f, rms: fit.rms, centre,
        fov: { width: 2 * Math.atan(width / 2 / fit.f) / DEG, height: 2 * Math.atan(height / 2 / fit.f) / DEG },
        matches: pairs.map(([i, j]) => ({ star: found[i], object: objects[j] })),
    };
}

/* Drops line-ups whose brightness disagrees: the photo's magnitude scale is its own
   (-2.5 log flux, plus an offset), set by the median of the pairs. A found star more than
   MAG_SLACK.brighter brighter than its object should be on that scale is something else (a
   plane, a satellite) that happens to sit near a fainter star. Looking fainter is allowed
   far more (MAG_SLACK.fainter): a bright star or planet burns out in a phone photo and
   its light is cut off (a made-up Jupiter came out 1.8 magnitudes short), and haze low
   down dims stars too. */
export const MAG_SLACK = { brighter: 1.75, fainter: 4 };
function brightEnough(found, objects, hits) {
    if (hits.length < 4) return hits;
    const offsets = hits.map(([i, j]) => -2.5 * Math.log10(found[i].flux) - objects[j].mag).sort((a, b) => a - b);
    const mid = offsets[offsets.length >> 1];
    return hits.filter(([i, j]) => {
        const off = -2.5 * Math.log10(found[i].flux) - objects[j].mag - mid;
        return off >= -MAG_SLACK.brighter && off <= MAG_SLACK.fainter;
    });
}

/** Where a sky vector falls in the photo for a solution, or null if behind or outside it. */
export function toPixel(solution, v, width, height) {
    const c = applyT(solution.R, v);
    if (c[2] <= 0) return null;
    const x = width / 2 + solution.f * c[0] / c[2], y = height / 2 + solution.f * c[1] / c[2];
    return x < 0 || y < 0 || x > width || y > height ? null : { x, y };
}
