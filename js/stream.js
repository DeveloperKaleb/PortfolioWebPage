/* The landscape in the page margins: a shallow Pacific Northwest creek seen from above,
 * flowing down the left margin, and forest floor down the right. Boulders stand in the
 * creek and one log lies half in it. A smaller glacial stream comes down out of the snow
 * at the top of the right margin, runs behind the page column, and joins the creek from
 * the right about 900px down, clouding it and pushing its current across.
 *
 * Pure like the game modules: createStream lays out the left margin once for a grid size,
 * createForestFloor the right margin, and renderFrame colours either for a moment in time.
 * The canvases, the frame loop and the sizing to the margins live in scripts/stream.js.
 *
 * Everything is in cells, not pixels. The DOM layer draws one cell per canvas pixel and
 * scales the canvas up, which is where the pixelation comes from. The two margins are one
 * landscape with the page column hiding the middle, so the right margin's cells are
 * placed by their real distance across the page from the left margin's.
 *
 * The water is drawn as the bed seen through a tint, with a streak pattern carried along
 * each cell's direction of flow at its speed. Carrying one pattern at different speeds
 * side by side shears it apart over time, so it is two copies half a cycle apart, each
 * reset while the other is showing (a flow map, as games do it). See NOTES.md.
 */

/* Exempt from the colour rules in js/contrast.js - contrast and colour-blind
   distinguishability alike - by the project owner's decision. Nothing is read against
   them, and they sit in the gutter, beside the page column rather than under it. They
   are held to looking real instead: the glacial water against the creek is calibrated to
   photographs of real confluences (see NOTES.md and tests/stream/tributary.test.js). */
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
    /* Turquoise with rock flour. In shallow water the bed still shows through it, and
       against the creek it is mostly a shift in hue, not a jump in brightness - as in
       the reference photographs. */
    glacial: '#3c9c9c',

    snow: '#e9eff1',
    snowShadow: '#c3d0d8',

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

export const TERRAIN = { BANK: 0, WATER: 1, BOULDER: 2, LOG: 3, LOG_SUBMERGED: 4, BAR: 5, SNOW: 6 };

/* Narrower than this there is no room for two banks and a channel with a rock in it. */
export const MIN_COLS = 12;

/* Screen pixels per cell. The pure layer needs it wherever the landscape is measured
   across the page column, which is sized in pixels. */
export const BLOCK = 6;

/* Rows laid out past the bottom of the page; see createStream. */
const BEYOND = 24;

/* How far from the stream's near bank, in screen pixels, the forest floor starts to
   show and where it is complete. The page column is 1100px, so the right-hand margin
   begins a little past the start: a narrow margin gets scattered moss, and a wide one
   reaches the full floor at its outer edge. */
export const FOREST_RAMP = { start: 1100, full: 1500 };

/* The tributary: where it joins, in pixels down the page, and the angle it comes in at,
   below the horizontal. At 30 degrees it crosses the right margin 150-300px down and,
   on a wide screen, reaches the top right corner. */
export const JUNCTION_PX = 900;
const TRIB_ANGLE = Math.PI / 6;
const TAN = Math.tan(TRIB_ANGLE);
const COS = Math.cos(TRIB_ANGLE);
/* The direction it flows: down and to the left, towards the creek. */
const TRIB_FLOW = [-Math.cos(TRIB_ANGLE), Math.sin(TRIB_ANGLE)];

/* How far up the tributary from the junction, in pixels measured along it, the snow
   starts and where it is thickest. The tributary reaches the right margin about
   1300-1400px up, so even a narrow margin shows drifts along it - the snow is what tells
   the viewer the milky water is meltwater - and a wide one reaches deep snow in the top
   right corner. */
export const SNOW_RAMP = { start: 1000, full: 1600 };

/* How much of the bed the tributary's water hides. Set with the glacial colour so the
   two waters meet at 1.46:1, between the clear-against-glacial contrasts measured from
   photographs of the Otta (1.33:1) and the Kenai meeting the Russian (1.57:1). The first
   version hid 80% of the bed under a much paler tint and came out at 2.05:1 - the
   Rhone against the Arve, two big rivers and an unusually silty one. */
export const GLACIAL_OPACITY = 0.45;
export const GLACIAL_REFERENCE = { otta: 1.33, kenai: 1.57 };

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
const smooth = (v) => { const k = clamp(v, 0, 1); return k * k * (3 - 2 * k); };
const palette = () => Object.fromEntries(Object.entries(STREAM_COLORS).map(([k, v]) =>
    [k, Array.isArray(v) ? v.map(toRgb) : toRgb(v)]));

/* The channel at a row: its banks, centre and half-width, and where its fastest water
   runs. Two slow waves each, so it meanders without visibly repeating over one screen,
   and never narrows enough to lose a bank.

   Below the junction it carries the tributary's water too, so it widens, and the
   tributary shoving in from the right pushes the current against the far bank, which
   it has cut back into a bulge. */
function channelAt(y, cols, phase, trib) {
    const centre = cols / 2
        + cols * 0.07 * Math.sin(y * 0.045 + phase)
        + cols * 0.035 * Math.sin(y * 0.11 + phase * 2.3);
    const below = y - trib.row;
    const half = cols * 0.3 * (1 + 0.12 * Math.sin(y * 0.07 + phase * 1.7))
        * (1 + 0.22 * smooth((below + trib.mouth) / (25 + trib.mouth)));
    const scour = cols * 0.08 * Math.exp(-(((below - 22) / 14) ** 2));
    const left = clamp(Math.round(centre - half - scour), 2, cols - 5);
    const right = clamp(Math.round(centre + half), left + 3, cols - 3);
    const shift = (right - left) * 0.18 * smooth(below / 10) * Math.exp(-Math.max(0, below - 10) / 60);
    const mid = (left + right) / 2;
    return { left, right, centre: mid, half: (right - left) / 2, fast: mid - shift };
}

function distanceToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    return { distance: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t };
}

/* White water and slowing around rocks, for water flowing along (fx, fy): foam piled on
   the upstream face, a V trailing off downstream, and slack water inside the V. */
function rockEffects(x, y, fx, fy, rocks) {
    let foam = 0, slow = 1;
    for (const b of rocks) {
        const dx = x - b.x, dy = y - b.y;
        const reach = b.r * 3 + 8;
        if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue;
        const d = Math.hypot(dx, dy);
        const along = dx * fx + dy * fy;
        const across = Math.abs(dx * fy - dy * fx);
        if (along < 0 && d < b.r + 1.6) foam = Math.max(foam, 0.9);
        else if (d < b.r + 1.1) foam = Math.max(foam, 0.55);
        const wake = b.r * 3 + 6;
        if (along > 0 && along < wake) {
            const edge = b.r * 0.8 + along * 0.35;
            const fade = 1 - along / wake;
            if (Math.abs(across - edge) < 0.8) foam = Math.max(foam, 0.65 * fade);
            if (across < edge) slow *= 1 - 0.6 * fade;
        }
    }
    return { foam, slow };
}

const shadeRock = (C, b, x, y, seed) => {
    const lit = (b.x - x) + (b.y - y);
    if (lit > b.r * 0.5) return hash(x, y, seed + 3) < 0.5 ? C.rockMoss : C.rockLight;
    if (lit < -b.r * 0.5) return C.rockShadow;
    return C.rock;
};

/* A water surface for renderFrame: the grid's kinds, flow and foam, and for each water
   cell its three shades (the bed through the tint, a trough, a glint). glacial is how
   much of the tributary's water is in the cell, 0 to 1. */
function surface(cols, rows) {
    const size = cols * rows;
    return {
        cols, rows,
        terrain: new Uint8Array(size),
        speed: new Float32Array(size),
        flowX: new Float32Array(size),
        flowY: new Float32Array(size),
        foam: new Float32Array(size),
        glacial: new Float32Array(size),
        still: new Uint8ClampedArray(size * 4),
        shades: new Uint8ClampedArray(size * 9),
    };
}

function shadeWater(grid, i, under, depth, C) {
    const g = grid.glacial[i];
    const tint = mix(C.water, C.glacial, g);
    const base = mix(under, tint, (0.4 + 0.25 * depth) * (1 - g) + GLACIAL_OPACITY * g);
    const put = (o, rgb) => { grid.shades[o] = rgb[0]; grid.shades[o + 1] = rgb[1]; grid.shades[o + 2] = rgb[2]; };
    put(i * 9, base);
    put(i * 9 + 3, mix(base, C.waterDark, 0.45 - 0.2 * g));
    put(i * 9 + 6, mix(base, C.highlight, 0.5));
    /* The still layer holds the plain shade too, so the grid is a whole picture without
       an animation frame. */
    grid.still.set([...base, 255], i * 4);
}

const bedAt = (C, x, y, seed) => {
    const stone = hash(Math.floor(x / 1.5), Math.floor(y / 1.5), seed + 4);
    return stone > 0.93 ? C.paleStone : C.bed[Math.floor(noise(x * 0.5, y * 0.5, seed + 5) * 4) % 4];
};

const isWet = (kind) => kind === TERRAIN.WATER || kind === TERRAIN.LOG_SUBMERGED;

export function createStream({ cols, rows, seed = 7 }) {
    if (cols < MIN_COLS) throw new RangeError(`a stream needs at least ${MIN_COLS} columns`);

    const random = mulberry32(seed);
    const phase = random() * Math.PI * 2;

    /* The tributary has its own random stream, so adding it left everything upstream
       of the junction where it was. Its geometry is in this grid's cells, extended
       across the page: x past the right edge of this margin is behind the column. */
    const tribRandom = mulberry32(seed + 101);
    const tribHalf = Math.max(1.2, cols * 0.12);
    const trib = {
        row: Math.round(JUNCTION_PX / BLOCK + (tribRandom() - 0.5) * 8),
        half: tribHalf,
        mouth: tribHalf / COS,
        wobble: tribRandom() * Math.PI * 2,
        x: 0,
    };
    const chan = (y) => channelAt(y, cols, phase, trib);
    trib.x = chan(trib.row).right;
    /* The tributary's centre line: straight up and to the right from the junction at
       TRIB_ANGLE, with a gentle meander that fades out where it joins. */
    const tribCentre = (X) => trib.row - (X - trib.x) * TAN
        + 2.5 * Math.sin(X * 0.09 + trib.wobble) * clamp((X - trib.x) / 20, 0, 1);
    /* Signed distance across the tributary, positive on its downstream (lower) side. */
    const tribOffset = (X, y) => (y - tribCentre(X)) * COS;

    /* Rocks in the tributary, out where the right margin sees it. */
    const tribRocks = [];
    for (let k = 0; k < 60; k++) {
        if (hash(k, 3, seed) < 0.35) continue;
        const X = trib.x + 30 + k * 26 + hash(k, 1, seed) * 10;
        const across = (hash(k, 2, seed) - 0.5) * tribHalf * 0.9;
        tribRocks.push({ x: X, y: tribCentre(X) + across / COS, r: Math.max(0.9, tribHalf * 0.4) });
    }

    /* Laid out a little past the last row, so a boulder or fern just below the bottom
       edge still reaches up into it exactly as it would on a longer page. */
    const channel = Array.from({ length: rows + BEYOND }, (_, y) => chan(y));

    /* What the junction leaves below it on the tributary's side: a slow eddy turning in
       the corner, and a bar of gravel dropped in the slack water under it. */
    const eddyR = Math.max(1.5, tribHalf * 1.2);
    const eddyY = trib.row + trib.mouth + eddyR * 1.1;
    const eddy = { x: chan(Math.round(eddyY)).right - eddyR * 0.9, y: eddyY, r: eddyR };
    const barRy = Math.max(2, tribHalf * 1.8);
    const barY = eddy.y + eddyR + barRy * 0.5;
    const bar = { x: chan(Math.round(barY)).right + 0.3, y: barY, rx: Math.max(1, tribHalf * 0.6), ry: barRy };
    /* Rows kept clear of boulders, so the confluence reads on its own. */
    const calmFrom = trib.row - trib.mouth - 6;
    const calmTo = bar.y + bar.ry + 25;

    const grid = surface(cols, rows);
    const { terrain, speed, flowX, flowY, foam, glacial } = grid;
    for (let y = 0; y < rows; y++) {
        for (let x = channel[y].left; x <= channel[y].right; x++) terrain[y * cols + x] = TERRAIN.WATER;
        for (let x = channel[y].right + 1; x < cols; x++) {
            if (Math.abs(tribOffset(x, y)) <= tribHalf) terrain[y * cols + x] = TERRAIN.WATER;
        }
        for (let x = channel[y].left; x <= channel[y].right; x++) {
            if (((x - bar.x) / bar.rx) ** 2 + ((y - bar.y) / bar.ry) ** 2 <= 1) terrain[y * cols + x] = TERRAIN.BAR;
        }
    }

    /* The log: one end resting on a bank, angled downstream into the channel, the far
       end sunk. Placed first so the boulders can keep clear of it.

       It sits a set distance down the page (360-540px, beside the top of the column on
       any desktop screen), never a fraction of the page's height. Nothing in the layout
       may depend on how many rows there are: then a row looks the same on every page and
       at every page length, so the stream matches across Home and Entertainment, and a
       page that grows - the photo loading, a game view opening - only adds stream at the
       bottom rather than reshuffling it. */
    const logRow = Math.round(60 + random() * 30);
    const fromLeft = random() < 0.5;
    const at = chan(logRow);
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
       of a bank. Kept off the log, off each other and out of the confluence. */
    const boulders = [];
    const spacing = Math.max(9, Math.round(cols * 0.9));
    for (let y = Math.round(spacing * 0.4); y < rows + BEYOND - 8; y += Math.round(spacing * (0.7 + random() * 0.6))) {
        const count = random() < 0.35 ? 2 : 1;
        for (let n = 0; n < count; n++) {
            const c = channel[y];
            const r = Math.max(1, cols * (0.045 + random() * 0.05));
            const bx = c.left + random() * (c.right - c.left);
            const by = y + (random() - 0.5) * 4;
            const clear = !nearLog(bx, by, r + 3)
                && (by + r < calmFrom || by - r > calmTo)
                && boulders.every((b) => Math.hypot(b.x - bx, b.y - by) > b.r + r + 2);
            if (clear) boulders.push({ x: bx, y: by, r });
        }
    }

    /* The downstream corner of the junction, where the tributary's lower bank meets the
       creek's right bank, comes to a sharp point: a straight bank at 30 degrees against
       one running down the page and bending away as the creek widens. Water would wear a
       point like that away quickly, so it only survives armoured - a big boulder sitting
       on it, taking the tributary's water on its upstream face. Found from the geometry:
       the first row below the junction where the cell just past the creek's bank is no
       longer tributary. Kept apart from the random boulders, which stay out of the
       confluence. */
    let tipY = trib.row;
    while (tipY < trib.row + 60 && Math.abs(tribOffset(chan(tipY).right + 1, tipY)) <= tribHalf) tipY++;
    const tip = { x: chan(tipY).right + 1, y: tipY };
    const cornerR = Math.max(1.3, tribHalf * 0.65);
    const cornerRock = { x: tip.x, y: tip.y + cornerR * 0.3, r: cornerR };
    const rocks = [...boulders, cornerRock];

    for (const b of rocks) {
        for (let y = Math.max(0, Math.floor(b.y - b.r)); y <= Math.min(rows - 1, Math.ceil(b.y + b.r)); y++) {
            for (let x = Math.max(0, Math.floor(b.x - b.r)); x <= Math.min(cols - 1, Math.ceil(b.x + b.r)); x++) {
                if (Math.hypot(x - b.x, y - b.y) <= b.r) terrain[y * cols + x] = TERRAIN.BOULDER;
            }
        }
    }

    const wetAt = (x, y) => x >= 0 && x < cols && y >= 0 && y < rows && isWet(terrain[y * cols + x]);
    /* Past the grid's edges counts as water: the tributary runs on behind the page, and
       the creek on above and below, so neither edge is a bank to foam against. */
    const openAt = (x, y) => x < 0 || x >= cols || y < 0 || y >= rows || wetAt(x, y);
    const depth = new Float32Array(cols * rows);

    /* Speed, direction, white water and glacial water, per cell. */
    for (let y = 0; y < rows; y++) {
        const c = channel[y];
        const plume = y - (trib.row - trib.mouth);
        for (let x = 0; x < cols; x++) {
            if (!wetAt(x, y)) continue;
            const i = y * cols + x;
            let fx = 0, fy = 1, v, g = 0, f = 0;

            if (x > c.right) {
                /* The tributary's last stretch, crossing the bank to the creek. */
                const o = tribOffset(x, y);
                [fx, fy] = TRIB_FLOW;
                v = Math.max(0.3, 0.85 * (1 - (o / tribHalf) ** 2));
                g = 1;
                depth[i] = 1 - Math.abs(o) / tribHalf;
            } else {
                /* Fastest down the thalweg, slow at the edges, slower still in the eddy
                   behind a rock or the log. */
                const across = (x - c.fast) / (c.half + 0.5);
                v = Math.max(0.3, 1 - across * across);
                depth[i] = clamp(1 - Math.abs(across), 0, 1);

                if (plume >= 0) {
                    /* The tributary's water shoots partway across, then is bent
                       downstream and runs down the right side, spreading and mixing
                       until it is gone. The two waters shade into each other over a
                       few cells, widening downstream, as in the reference photographs,
                       where no confluence shows a hard edge. A little foam marks the
                       seam where they first meet and churn, and fades within ~150px. */
                    const width = c.right - c.left;
                    const reachAcross = Math.min(width * 0.85, width * 0.4 * smooth(plume / 6) + plume * 0.06);
                    const seam = c.right + 0.5 - reachAcross;
                    const side = smooth((x - seam) / (3 + plume * 0.15) + 0.5);
                    g = side * Math.exp(-plume / 90);
                    if (Math.abs(x - seam) < 0.75 && plume > 1) f = Math.max(f, 0.3 * Math.exp(-plume / 25));

                    /* Where it comes in it still runs its own way, across the creek. */
                    const jet = 0.85 * Math.exp(-plume / 7) * side;
                    fx = TRIB_FLOW[0] * jet;
                    fy = 1 - jet + TRIB_FLOW[1] * jet;
                    v = Math.max(v, v * (1 - jet) + 0.8 * jet);
                    /* And the creek beside it is shoved towards the far bank. */
                    fx -= 0.3 * Math.exp(-plume / 25) * (1 - side);
                }

                const ex = x - eddy.x, ey = y - eddy.y;
                const er = Math.hypot(ex, ey);
                if (er < eddy.r) {
                    /* Turning back upstream along the bank, down again on the creek side. */
                    v = 0.18 + 0.12 * (er / eddy.r);
                    if (er > 0.3) { fx = ey / er; fy = -ex / er; }
                    g = Math.max(g, 0.85);
                    f = Math.max(f, 0.22);
                    /* Scum and bubbles collect in an eddy and ride round it in a ring. */
                    if (Math.abs(er - eddy.r * 0.6) < 0.7) f = Math.max(f, 0.55);
                }
            }

            const norm = Math.hypot(fx, fy) || 1;
            fx /= norm; fy /= norm;

            if (!openAt(x - 1, y) || !openAt(x + 1, y) || !openAt(x, y - 1) || !openAt(x, y + 1)) f = Math.max(f, 0.15);
            const nearRocks = rockEffects(x, y, fx, fy, rocks);
            f = Math.max(f, nearRocks.foam);
            v *= nearRocks.slow;

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
            flowX[i] = fx;
            flowY[i] = fy;
            foam[i] = f;
            glacial[i] = g;
        }
    }

    /* Colours that never change: banks, rocks, the bar and the dry log outright, and the
       shades for the water. */
    const C = palette();
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
    const paintStill = (i, rgb) => grid.still.set([...rgb, 255], i * 4);

    for (let y = 0; y < rows; y++) {
        const c = channel[y];
        for (let x = 0; x < cols; x++) {
            const i = y * cols + x;
            const kind = terrain[i];

            if (kind === TERRAIN.BANK) {
                let gap = x < c.left ? c.left - x : x - c.right;
                if (x > c.right) gap = Math.min(gap, Math.ceil(Math.abs(tribOffset(x, y)) - tribHalf));
                const n = noise(x * 0.35, y * 0.35, seed + 1);
                let rgb;
                if (gap <= 1) rgb = n < 0.45 ? C.gravel : C.soil;
                else if (gap === 2 && n < 0.35) rgb = C.soil;
                else if (n > 0.66) rgb = C.mossLight;
                else if (n < 0.3) rgb = C.forest;
                else rgb = C.moss;
                /* Ferns: flecks of bright green scattered through the moss. */
                if (gap > 1 && hash(x, y, seed + 2) < 0.06) rgb = C.fern;
                paintStill(i, rgb);
            } else if (kind === TERRAIN.BAR) {
                paintStill(i, hash(x, y, seed + 9) < 0.3 ? C.paleStone : C.gravel);
            } else if (kind === TERRAIN.BOULDER) {
                const b = rocks.find((o) => Math.hypot(x - o.x, y - o.y) <= o.r);
                paintStill(i, shadeRock(C, b, x, y, seed));
            } else if (kind === TERRAIN.LOG) {
                paintStill(i, barkAt(x, y));
            } else {
                const under = kind === TERRAIN.LOG_SUBMERGED ? barkAt(x, y) : bedAt(C, x, y, seed);
                shadeWater(grid, i, under, kind === TERRAIN.LOG_SUBMERGED ? 0 : depth[i], C);
            }
        }
    }

    return Object.assign(grid, {
        seed, channel, boulders, cornerRock, tip, log, eddy, bar, foamRgb: C.foam,
        tributary: { ...trib, rocks: tribRocks, centre: tribCentre, offset: tribOffset },
        origin: { x: trib.x, y: trib.row },
    });
}

/* Colours every cell of a grid - the stream, or the forest floor with its stretch of
   tributary - at time t (seconds) into an RGBA buffer the size of the grid, ready for an
   ImageData. Pass the previous buffer back in to avoid allocating. from and to limit it
   to a band of rows - the ones on screen - and leave the rest untouched. */
export function renderFrame(grid, t, out = new Uint8ClampedArray(grid.cols * grid.rows * 4),
    from = 0, to = grid.rows) {
    const { cols, rows, terrain, speed, flowX, flowY, foam, still, shades, foamRgb, seed, origin } = grid;
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
            if (!isWet(terrain[i])) {
                out[o] = still[o]; out[o + 1] = still[o + 1]; out[o + 2] = still[o + 2]; out[o + 3] = still[o + 3];
                continue;
            }
            out[o + 3] = 255;

            /* The streaks are laid along the flow: measured from the junction, so the
               coordinates are small where the direction turns, and the pattern stays
               whole through the bend. */
            const fx = flowX[i], fy = flowY[i];
            const lx = x - origin.x, ly = y - origin.y;
            const along = lx * fx + ly * fy;
            const across = lx * fy - ly * fx;

            const travel = speed[i] * FLOW_RATE * CYCLE;
            const a = noise(across * 0.8, (along - travel * phaseA) * 0.22 + cycleA * 7.3, seed + 6);
            const b = noise(across * 0.8, (along - travel * phaseB) * 0.22 + cycleB * 7.3 + 3.1, seed + 6);
            const n = 0.5 + ((a - 0.5) * weightA + (b - 0.5) * weightB) * norm;

            let rgb = null;
            const f = foam[i];
            if (f > 0) {
                const churn = noise(across * 1.1, (along - speed[i] * FLOW_RATE * t) * 0.6, seed + 7);
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

/* 0 to 1: how snowy the ground is this many pixels up the tributary from the junction. */
export function snowCover(px) {
    return smooth((px - SNOW_RAMP.start) / (SNOW_RAMP.full - SNOW_RAMP.start));
}

/* The forest floor in the right-hand margin, as one continuous landscape with the stream:
   the page column hides the ground in between. offset is the distance in pixels from the
   left edge of the stream's grid to the left edge of this one, so a cell's distance from
   the water is measured from the stream's right bank at the same row. Cells with no
   floor are transparent and the page's olive shows through.

   The tributary crosses it on its way to the creek, with its own banks cutting through
   the floor, and comes down out of snow: snow lies on the ground around its upstream
   end, deepest furthest up. A grid for renderFrame, since the tributary moves;
   pixels is the still picture. */
export function createForestFloor(stream, { cols, offset }) {
    const { rows, channel, seed, tributary: trib } = stream;
    const C = palette();
    const grid = surface(cols, rows);
    const { terrain, speed, flowX, flowY, foam, glacial, still } = grid;
    const density = new Float32Array(cols * rows);
    const X0 = offset / BLOCK;

    const rocks = trib.rocks.map((b) => ({ ...b, x: b.x - X0 }))
        .filter((b) => b.x > -b.r - 1 && b.x < cols + b.r + 1);
    /* Distance past the tributary's edge, in cells; negative inside it. */
    const tribGap = (x, y) => Math.abs(trib.offset(X0 + x, y)) - trib.half;
    /* Snow lies around the tributary's upstream end: how far up it a cell is, measured
       along its line, and thinning away from the water on either side, so it gathers in
       the top right rather than running down the whole margin. */
    const snowAt = (x, y) => {
        const up = ((X0 + x - trib.x) * COS - (y - trib.row) * Math.sin(TRIB_ANGLE)) * BLOCK;
        return snowCover(up) * Math.exp(-Math.max(0, tribGap(x, y)) / 14);
    };
    const densityAt = (x, y) =>
        forestDensity(offset + clamp(x, 0, cols - 1) * BLOCK - (channel[y].right + 1) * BLOCK);

    const paint = (x, y, rgb) => {
        if (x < 0 || x >= cols || y < 0 || y >= rows) return;
        const i = y * cols + x;
        if (terrain[i] !== TERRAIN.BANK) return;
        still.set([...rgb, 255], i * 4);
    };

    /* The ground itself: patches that join up as the density rises, full along the
       tributary's banks, and snow where it is snowy enough. */
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const i = y * cols + x;
            const k = densityAt(x, y);
            density[i] = k;
            const gap = tribGap(x, y);

            if (gap <= 0) {
                const rock = rocks.find((b) => Math.hypot(x - b.x, y - b.y) <= b.r);
                if (rock) {
                    terrain[i] = TERRAIN.BOULDER;
                    still.set([...shadeRock(C, rock, x, y, seed), 255], i * 4);
                } else terrain[i] = TERRAIN.WATER;
                continue;
            }

            const s = snowAt(x, y);
            const drift = noise(x * 0.25, y * 0.25, seed + 18) * 0.75 + noise(x * 0.7, y * 0.7, seed + 19) * 0.25;
            if (s > 0 && drift < s * 1.25) {
                terrain[i] = TERRAIN.SNOW;
                /* Shadowed on the lower-right edge of each drift, lit on the rest. */
                const lower = noise((x - 1) * 0.25, (y - 1) * 0.25, seed + 18) * 0.75
                    + noise((x - 1) * 0.7, (y - 1) * 0.7, seed + 19) * 0.25;
                still.set([...(lower >= s * 1.25 ? C.snowShadow : C.snow), 255], i * 4);
                continue;
            }

            const n = noise(x * 0.35, y * 0.35, seed + 1);
            if (gap < 1.5) {
                paint(x, y, n < 0.45 ? C.gravel : C.soil);
                continue;
            }
            const banked = gap < 4;
            const patch = noise(x * 0.22, y * 0.22, seed + 11) * 0.7 + noise(x * 0.6, y * 0.6, seed + 12) * 0.3;
            if (!banked && (k <= 0 || patch > k * 1.15)) continue;
            let rgb = n > 0.66 ? C.mossLight : n < 0.3 ? C.forest : C.moss;
            if (hash(x, y, seed + 13) < 0.1 * k) rgb = C.needles;
            paint(x, y, rgb);
        }
    }

    /* Things lying on it, each only where the floor is thick enough to carry it, and
       never on the water, its gravel edge or the snow. Placed on a coarse lattice so
       they never pile on top of one another. */
    const cell = 6;
    /* Past the last row too, for a fern rooted below the edge that reaches up into it. */
    for (let gy = 0; gy < rows + 2 * cell; gy += cell) {
        for (let gx = 0; gx < cols; gx += cell) {
            const x = gx + Math.floor(hash(gx, gy, seed + 14) * (cell - 2)) + 1;
            const y = gy + Math.floor(hash(gx, gy, seed + 15) * (cell - 2)) + 1;
            if (tribGap(x, y) < 2.5 || snowAt(x, y) > 0.3) continue;
            const k = densityAt(x, y);
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

    /* The tributary's water: all glacial, down and to the left, fastest mid-stream. */
    /* As in the stream, past the grid's edges counts as water. */
    const openAt = (x, y) => x < 0 || x >= cols || y < 0 || y >= rows || terrain[y * cols + x] === TERRAIN.WATER;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const i = y * cols + x;
            if (terrain[i] !== TERRAIN.WATER) continue;
            const o = trib.offset(X0 + x, y);
            const edge = !openAt(x - 1, y) || !openAt(x + 1, y) || !openAt(x, y - 1) || !openAt(x, y + 1);
            const f = edge ? 0.15 : 0;
            const r = rockEffects(x, y, TRIB_FLOW[0], TRIB_FLOW[1], rocks);
            speed[i] = Math.max(0.3, 0.85 * (1 - (o / trib.half) ** 2)) * r.slow;
            [flowX[i], flowY[i]] = TRIB_FLOW;
            foam[i] = Math.max(f, r.foam);
            glacial[i] = 1;
            shadeWater(grid, i, bedAt(C, x, y, seed), 1 - Math.abs(o) / trib.half, C);
        }
    }

    return Object.assign(grid, {
        seed, density, pixels: still, foamRgb: C.foam,
        origin: { x: trib.x - X0, y: trib.row },
    });
}
