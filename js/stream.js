/* The mountain stream in the homepage's left margin: a shallow Pacific Northwest creek
 * seen from above, flowing down the page, with boulders standing out of it and one log
 * lying half in the water.
 *
 * Pure like the game modules: createStream lays the stream out once for a grid size, and
 * renderFrame colours every cell for a moment in time. The canvas, the frame loop and the
 * sizing to the margin live in scripts/stream.js.
 *
 * Everything is in cells, not pixels. The DOM layer draws one cell per canvas pixel and
 * scales the canvas up, which is where the pixelation comes from.
 *
 * The water is drawn as the bed seen through a tint, with a streak pattern carried down
 * at the local speed. Carrying one pattern at different speeds side by side shears it
 * apart over time, so it is two copies half a cycle apart, each reset while the other is
 * showing (a flow map, as games do it). See NOTES.md.
 */

/* Decorative: nothing is read against any of these, so the pairwise rules do not apply
   (the "nothing read against it" case in NOTES.md). They sit in the gutter, beside the
   page column rather than under it. */
export const STREAM_COLORS = {
    forest: '#233320',
    moss: '#3d5a2c',
    mossLight: '#557a36',
    fern: '#6f9a3e',
    soil: '#4a3f2c',
    gravel: '#7a7466',

    bed: ['#6d6a5a', '#5c5a4c', '#807662', '#4f4d42'],
    paleStone: '#8e8a7a',

    water: '#2b5f5a',
    waterDark: '#1f4744',
    highlight: '#8fc1b5',
    foam: '#e4eee8',

    rock: '#6f736c',
    rockLight: '#9a9d94',
    rockShadow: '#474a45',
    rockMoss: '#5e7c38',

    needles: '#6b4a2a',
    mushroomCap: '#c2a878',
    mushroomStem: '#e0d6bd',

    bark: '#5b3d27',
    barkLight: '#7a5536',
    barkDark: '#3b281a',
    endGrain: '#b08f5e',
};

export const TERRAIN = { BANK: 0, WATER: 1, BOULDER: 2, LOG: 3, LOG_SUBMERGED: 4 };

/* Narrower than this there is no room for two banks and a channel with a rock in it. */
export const MIN_COLS = 12;

/* Screen pixels per cell. The pure layer needs it for one thing: the forest floor's
   distance from the stream is measured across the page column, which is sized in pixels. */
export const BLOCK = 6;

/* How far from the stream's near bank, in screen pixels, the forest floor starts to
   show and where it is complete. The page column is 1100px, so the right-hand margin
   begins a little past the start: a narrow margin gets scattered moss, and a wide one
   reaches the full floor at its outer edge. */
export const FOREST_RAMP = { start: 1100, full: 1500 };

/* Cells per second at full speed, and the length of one flow-map cycle in seconds. */
const FLOW_RATE = 9;
const CYCLE = 1.6;

export function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hash(x, y, seed) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x, y, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const top = hash(x0, y0, seed) + (hash(x0 + 1, y0, seed) - hash(x0, y0, seed)) * sx;
    const bottom = hash(x0, y0 + 1, seed) + (hash(x0 + 1, y0 + 1, seed) - hash(x0, y0 + 1, seed)) * sx;
    return top + (bottom - top) * sy;
}

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* The channel's centre line and half-width at a row. Two slow waves each, so it meanders
   without visibly repeating over one screen, and never narrows enough to lose a bank. */
function channelAt(y, cols, phase) {
    const centre = cols / 2
        + cols * 0.07 * Math.sin(y * 0.045 + phase)
        + cols * 0.035 * Math.sin(y * 0.11 + phase * 2.3);
    const half = cols * 0.3 * (1 + 0.12 * Math.sin(y * 0.07 + phase * 1.7));
    const left = clamp(Math.round(centre - half), 2, cols - 5);
    const right = clamp(Math.round(centre + half), left + 3, cols - 3);
    return { left, right, centre: (left + right) / 2, half: (right - left) / 2 };
}

function distanceToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    return { distance: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t };
}

export function createStream({ cols, rows, seed = 7 }) {
    if (cols < MIN_COLS) throw new RangeError(`a stream needs at least ${MIN_COLS} columns`);

    const random = mulberry32(seed);
    const phase = random() * Math.PI * 2;
    const channel = Array.from({ length: rows }, (_, y) => channelAt(y, cols, phase));

    const size = cols * rows;
    const terrain = new Uint8Array(size);
    for (let y = 0; y < rows; y++) {
        for (let x = channel[y].left; x <= channel[y].right; x++) terrain[y * cols + x] = TERRAIN.WATER;
    }

    /* The log: one end resting on a bank, angled downstream into the channel, the far
       end sunk. Placed first so the boulders can keep clear of it. */
    const logRow = Math.round(rows * (0.5 + random() * 0.2));
    const fromLeft = random() < 0.5;
    const at = channel[clamp(logRow, 0, rows - 1)];
    const reach = at.half * 2 * (0.6 + random() * 0.15);
    const logStart = {
        x: fromLeft ? at.left - 2 : at.right + 2,
        y: logRow,
    };
    const drop = Math.max(3, reach * 0.55);
    const logEnd = {
        x: fromLeft ? at.left + reach : at.right - reach,
        y: logRow + drop,
    };
    const logRadius = Math.max(0.9, cols * 0.045);
    /* Past this fraction of its length the log is under water. */
    const sinksAt = 0.45 + random() * 0.1;
    const log = { start: logStart, end: logEnd, radius: logRadius, sinksAt, fromLeft };

    for (let y = Math.max(0, Math.floor(logStart.y - logRadius - 1)); y <= Math.min(rows - 1, Math.ceil(logEnd.y + logRadius + 1)); y++) {
        for (let x = 0; x < cols; x++) {
            const { distance, t } = distanceToSegment(x, y, logStart.x, logStart.y, logEnd.x, logEnd.y);
            if (distance > logRadius) continue;
            const i = y * cols + x;
            if (t < sinksAt || terrain[i] === TERRAIN.BANK) terrain[i] = TERRAIN.LOG;
            else terrain[i] = TERRAIN.LOG_SUBMERGED;
        }
    }

    const nearLog = (x, y, margin) =>
        distanceToSegment(x, y, logStart.x, logStart.y, logEnd.x, logEnd.y).distance < logRadius + margin;

    /* Boulders every so often down the channel, some mid-stream and some shouldering out
       of a bank. Kept off the log and off each other. */
    const boulders = [];
    const spacing = Math.max(9, Math.round(cols * 0.9));
    for (let y = Math.round(spacing * 0.4); y < rows - 2; y += Math.round(spacing * (0.7 + random() * 0.6))) {
        const count = random() < 0.35 ? 2 : 1;
        for (let n = 0; n < count; n++) {
            const c = channel[y];
            const r = Math.max(1, cols * (0.045 + random() * 0.05));
            const bx = c.left + random() * (c.right - c.left);
            const by = y + (random() - 0.5) * 4;
            const clear = !nearLog(bx, by, r + 3)
                && boulders.every((b) => Math.hypot(b.x - bx, b.y - by) > b.r + r + 2);
            if (clear) boulders.push({ x: bx, y: by, r });
        }
    }
    for (const b of boulders) {
        for (let y = Math.max(0, Math.floor(b.y - b.r)); y <= Math.min(rows - 1, Math.ceil(b.y + b.r)); y++) {
            for (let x = Math.max(0, Math.floor(b.x - b.r)); x <= Math.min(cols - 1, Math.ceil(b.x + b.r)); x++) {
                if (Math.hypot(x - b.x, y - b.y) <= b.r) terrain[y * cols + x] = TERRAIN.BOULDER;
            }
        }
    }

    /* Speed and white water, per cell. Fastest mid-channel, slow at the edges, slower
       still in the eddy behind a rock or the log. Foam piles on a rock's upstream face,
       trails off in a V behind it, and lines the lip where water pours over the log. */
    const speed = new Float32Array(size);
    const foam = new Float32Array(size);
    const isWater = (x, y) => x >= 0 && x < cols && y >= 0 && y < rows
        && (terrain[y * cols + x] === TERRAIN.WATER || terrain[y * cols + x] === TERRAIN.LOG_SUBMERGED);

    for (let y = 0; y < rows; y++) {
        const c = channel[y];
        for (let x = 0; x < cols; x++) {
            if (!isWater(x, y)) continue;
            const i = y * cols + x;
            const across = (x - c.centre) / (c.half + 0.5);
            let v = Math.max(0.3, 1 - across * across);
            let f = 0;
            if (!isWater(x - 1, y) || !isWater(x + 1, y)) f = Math.max(f, 0.15);

            for (const b of boulders) {
                const dx = x - b.x, dy = y - b.y;
                const d = Math.hypot(dx, dy);
                if (dy < 0 && d < b.r + 1.6) f = Math.max(f, 0.9);
                else if (d < b.r + 1.1) f = Math.max(f, 0.55);
                const wake = b.r * 3 + 6;
                if (dy > 0 && dy < wake) {
                    const edge = b.r * 0.8 + dy * 0.35;
                    const fade = 1 - dy / wake;
                    if (Math.abs(Math.abs(dx) - edge) < 0.8) f = Math.max(f, 0.65 * fade);
                    if (Math.abs(dx) < edge) v *= 1 - 0.6 * fade;
                }
            }

            if (terrain[i] === TERRAIN.LOG_SUBMERGED) {
                v = Math.min(1.2, v * 1.25);
                f = Math.max(f, 0.2);
            } else {
                /* Just below the sunk part of the log the water pours over its lip; just
                   above the dry part, it piles up against it. */
                const above = y > 0 ? terrain[(y - 1) * cols + x] : -1;
                const above2 = y > 1 ? terrain[(y - 2) * cols + x] : -1;
                const below = y < rows - 1 ? terrain[(y + 1) * cols + x] : -1;
                if (above === TERRAIN.LOG_SUBMERGED) f = Math.max(f, 0.85);
                else if (above2 === TERRAIN.LOG_SUBMERGED) f = Math.max(f, 0.45);
                if (below === TERRAIN.LOG) f = Math.max(f, 0.7);
                if (above === TERRAIN.LOG || above2 === TERRAIN.LOG) v *= 0.45;
            }

            speed[i] = v;
            foam[i] = f;
        }
    }

    /* Colours that never change: banks, rocks and the dry log outright, and for the water
       the three shades each cell can be (the bed through the tint, a trough, a glint). */
    const C = Object.fromEntries(Object.entries(STREAM_COLORS).map(([k, v]) =>
        [k, Array.isArray(v) ? v.map(toRgb) : toRgb(v)]));
    const still = new Uint8ClampedArray(size * 3);
    const shades = new Uint8ClampedArray(size * 9);
    const put = (arr, i, rgb) => { arr[i] = rgb[0]; arr[i + 1] = rgb[1]; arr[i + 2] = rgb[2]; };

    const logDx = logEnd.x - logStart.x, logDy = logEnd.y - logStart.y;
    const logLength = Math.hypot(logDx, logDy);
    /* Which side of the log is up-page, so its upper edge catches the light. */
    const sideOf = (x, y) => ((x - logStart.x) * logDy - (y - logStart.y) * logDx) / logLength
        * (fromLeft ? -1 : 1);
    const barkAt = (x, y) => {
        const { t } = distanceToSegment(x, y, logStart.x, logStart.y, logEnd.x, logEnd.y);
        if (t < 0.5 / logLength + 0.02) return C.endGrain;
        const side = sideOf(x, y);
        if (side > logRadius * 0.4) return C.barkLight;
        if (side < -logRadius * 0.4) return C.barkDark;
        return hash(Math.round(t * logLength), 0, seed) < 0.3 ? C.barkDark : C.bark;
    };

    for (let y = 0; y < rows; y++) {
        const c = channel[y];
        for (let x = 0; x < cols; x++) {
            const i = y * cols + x;
            const kind = terrain[i];

            if (kind === TERRAIN.BANK) {
                const gap = x < c.left ? c.left - x : x - c.right;
                const n = noise(x * 0.35, y * 0.35, seed + 1);
                let rgb;
                if (gap === 1) rgb = n < 0.45 ? C.gravel : C.soil;
                else if (gap === 2 && n < 0.35) rgb = C.soil;
                else if (n > 0.66) rgb = C.mossLight;
                else if (n < 0.3) rgb = C.forest;
                else rgb = C.moss;
                /* Ferns: flecks of bright green scattered through the moss. */
                if (gap > 1 && hash(x, y, seed + 2) < 0.06) rgb = C.fern;
                put(still, i * 3, rgb);
            } else if (kind === TERRAIN.BOULDER) {
                const b = boulders.find((o) => Math.hypot(x - o.x, y - o.y) <= o.r);
                const lit = (b.x - x) + (b.y - y);
                let rgb = C.rock;
                if (lit > b.r * 0.5) rgb = hash(x, y, seed + 3) < 0.5 ? C.rockMoss : C.rockLight;
                else if (lit < -b.r * 0.5) rgb = C.rockShadow;
                put(still, i * 3, rgb);
            } else if (kind === TERRAIN.LOG) {
                put(still, i * 3, barkAt(x, y));
            } else {
                let under;
                if (kind === TERRAIN.LOG_SUBMERGED) under = barkAt(x, y);
                else {
                    const stone = hash(Math.floor(x / 1.5), Math.floor(y / 1.5), seed + 4);
                    under = stone > 0.93 ? C.paleStone : C.bed[Math.floor(noise(x * 0.5, y * 0.5, seed + 5) * 4) % 4];
                }
                const depth = kind === TERRAIN.LOG_SUBMERGED ? 0 : 1 - Math.abs((x - c.centre) / (c.half + 0.5));
                const base = mix(under, C.water, 0.4 + 0.25 * depth);
                put(shades, i * 9, base);
                put(shades, i * 9 + 3, mix(base, C.waterDark, 0.45));
                put(shades, i * 9 + 6, mix(base, C.highlight, 0.5));
            }
        }
    }

    return { cols, rows, seed, channel, terrain, boulders, log, speed, foam, still, shades, foamRgb: C.foam };
}

/* Colours every cell at time t (seconds) into an RGBA buffer the size of the grid,
   ready for an ImageData. Pass the previous buffer back in to avoid allocating. from and
   to limit it to a band of rows - the ones on screen - and leave the rest untouched. */
export function renderFrame(stream, t, out = new Uint8ClampedArray(stream.cols * stream.rows * 4),
    from = 0, to = stream.rows) {
    const { cols, rows, terrain, speed, foam, still, shades, foamRgb, seed } = stream;
    const phaseA = (t / CYCLE) % 1;
    const phaseB = (phaseA + 0.5) % 1;
    const cycleA = Math.floor(t / CYCLE);
    const cycleB = Math.floor(t / CYCLE + 0.5);
    const weightA = 1 - Math.abs(1 - 2 * phaseA);
    const weightB = 1 - weightA;
    const norm = 1 / Math.hypot(weightA, weightB);
    const glintTick = Math.floor(t * 6);

    for (let y = Math.max(0, from); y < Math.min(rows, to); y++) {
        for (let x = 0; x < cols; x++) {
            const i = y * cols + x;
            const o = i * 4;
            out[o + 3] = 255;
            const kind = terrain[i];
            if (kind !== TERRAIN.WATER && kind !== TERRAIN.LOG_SUBMERGED) {
                out[o] = still[i * 3]; out[o + 1] = still[i * 3 + 1]; out[o + 2] = still[i * 3 + 2];
                continue;
            }

            const travel = speed[i] * FLOW_RATE * CYCLE;
            const a = noise(x * 0.8, (y - travel * phaseA) * 0.22 + cycleA * 7.3, seed + 6);
            const b = noise(x * 0.8, (y - travel * phaseB) * 0.22 + cycleB * 7.3 + 3.1, seed + 6);
            const n = 0.5 + ((a - 0.5) * weightA + (b - 0.5) * weightB) * norm;

            let rgb = null;
            const f = foam[i];
            if (f > 0) {
                const churn = noise(x * 1.1, (y - speed[i] * FLOW_RATE * t) * 0.6, seed + 7);
                if (churn < f * 0.85) rgb = foamRgb;
            }
            if (!rgb && hash(x, y + glintTick * 131, seed + 8) > 0.996) rgb = foamRgb;

            if (rgb) {
                out[o] = rgb[0]; out[o + 1] = rgb[1]; out[o + 2] = rgb[2];
            } else {
                const shade = n > 0.68 ? 2 : n < 0.3 ? 1 : 0;
                const s = i * 9 + shade * 3;
                out[o] = shades[s]; out[o + 1] = shades[s + 1]; out[o + 2] = shades[s + 2];
            }
        }
    }
    return out;
}

/* 0 to 1: how much forest floor there is this many pixels from the stream. */
export function forestDensity(px) {
    return clamp((px - FOREST_RAMP.start) / (FOREST_RAMP.full - FOREST_RAMP.start), 0, 1);
}

/* The forest floor in the right-hand margin, as one continuous landscape with the stream:
   the page column hides the ground in between. offset is the distance in pixels from the
   left edge of the stream's grid to the left edge of this one, so a cell's distance from
   the water is measured from the stream's right bank at the same row. Returns an RGBA
   buffer; cells with no floor are transparent and the page's olive shows through. It
   does not move, so it is drawn once. */
export function createForestFloor(stream, { cols, offset }) {
    const { rows, channel, seed } = stream;
    const C = Object.fromEntries(Object.entries(STREAM_COLORS).map(([k, v]) =>
        [k, Array.isArray(v) ? v.map(toRgb) : toRgb(v)]));
    const pixels = new Uint8ClampedArray(cols * rows * 4);
    const density = new Float32Array(cols * rows);

    const paint = (x, y, rgb) => {
        if (x < 0 || x >= cols || y < 0 || y >= rows) return;
        const o = (y * cols + x) * 4;
        pixels[o] = rgb[0]; pixels[o + 1] = rgb[1]; pixels[o + 2] = rgb[2]; pixels[o + 3] = 255;
    };

    /* The ground itself: patches that join up as the density rises. */
    for (let y = 0; y < rows; y++) {
        const bank = (channel[y].right + 1) * BLOCK;
        for (let x = 0; x < cols; x++) {
            const k = forestDensity(offset + x * BLOCK - bank);
            density[y * cols + x] = k;
            if (k <= 0) continue;
            const patch = noise(x * 0.22, y * 0.22, seed + 11) * 0.7 + noise(x * 0.6, y * 0.6, seed + 12) * 0.3;
            if (patch > k * 1.15) continue;
            const n = noise(x * 0.35, y * 0.35, seed + 1);
            let rgb = n > 0.66 ? C.mossLight : n < 0.3 ? C.forest : C.moss;
            if (hash(x, y, seed + 13) < 0.1 * k) rgb = C.needles;
            paint(x, y, rgb);
        }
    }

    /* Things lying on it, each only where the floor is thick enough to carry it. Placed
       on a coarse lattice so they never pile on top of one another. */
    const at = (x, y) => density[clamp(y, 0, rows - 1) * cols + clamp(x, 0, cols - 1)];
    const cell = 6;
    for (let gy = 0; gy < rows; gy += cell) {
        for (let gx = 0; gx < cols; gx += cell) {
            const x = gx + Math.floor(hash(gx, gy, seed + 14) * (cell - 2)) + 1;
            const y = gy + Math.floor(hash(gx, gy, seed + 15) * (cell - 2)) + 1;
            const k = at(x, y);
            const roll = hash(gx, gy, seed + 16);

            if (k > 0.75 && roll < 0.05) {
                /* A stump, seen from above: end grain ringed with bark. */
                const r = 2 + (roll < 0.02 ? 1 : 0);
                for (let dy = -r - 1; dy <= r + 1; dy++) {
                    for (let dx = -r - 1; dx <= r + 1; dx++) {
                        const d = Math.hypot(dx, dy);
                        if (d > r + 0.5) continue;
                        const rgb = d > r - 0.5 ? C.bark : Math.abs(d - r / 2) < 0.5 ? C.barkLight : C.endGrain;
                        paint(x + dx, y + dy, rgb);
                    }
                }
                paint(x + r, y + 1, C.barkDark);
            } else if (k > 0.5 && roll < 0.13) {
                /* Mushrooms: a cap and a stem, sometimes a pair. */
                paint(x, y, C.mushroomCap);
                paint(x, y + 1, C.mushroomStem);
                if (roll < 0.09) { paint(x + 2, y + 1, C.mushroomCap); paint(x + 2, y + 2, C.mushroomStem); }
            } else if (k > 0.25 && roll < 0.35 + 0.35 * k) {
                /* A sword fern: a stem with fronds stepping out either side. */
                const height = 3 + Math.floor(hash(gx, gy, seed + 17) * 3);
                for (let step = 0; step < height; step++) {
                    paint(x, y - step, C.fern);
                    if (step > 0 && step < height - 1) {
                        paint(x - 1 - (step % 2), y - step, C.mossLight);
                        paint(x + 1 + ((step + 1) % 2), y - step, C.mossLight);
                    }
                }
            }
        }
    }

    return { cols, rows, pixels, density };
}
