/* Sky photos, step 1: finding the stars in a picture of the night sky, and deciding
 * whether a picture is one. Pure: it takes pixels as arrays, so it is tested on made-up
 * skies. Matching the stars found against a catalogue (plate solving) comes next; see
 * NOTES.md, "Sky photos".
 *
 * Pictures arrive shrunk (MAX_SIDE) so a phone's 12-50 megapixel photo costs tens of
 * megabytes at most, not hundreds.
 */

/** Longest side, in pixels, a photo is shrunk to before it is searched. */
export const MAX_SIDE = 1600;

/** Brightness 0-255 from RGBA bytes (Rec. 709 weights), one Float32 a pixel. */
export function toGray(rgba, width, height) {
    const gray = new Float32Array(width * height);
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
        gray[i] = 0.2126 * rgba[p] + 0.7152 * rgba[p + 1] + 0.0722 * rgba[p + 2];
    }
    return gray;
}

/** The size a photo is drawn at before searching: the same shape, no side over MAX_SIDE. */
export function fitSize(width, height, max = MAX_SIDE) {
    const scale = Math.min(1, max / Math.max(width, height));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function median(values) {
    const sorted = Float32Array.from(values).sort();
    const n = sorted.length;
    return n === 0 ? 0 : n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

/* A picture cell by cell: each cell's median and its noise (1.4826 x the median absolute
   deviation, which is the standard deviation for Gaussian noise and is not pulled up by
   the stars themselves). Every other pixel of a cell is enough. Run on the photo for the
   sky's level, and on the smoothed photo for the noise a star must beat: measured there
   rather than worked out from the photo's, because shrinking and JPEG leave neighbouring
   pixels' noise alike, so smoothing takes less of it away than it would from a clean
   sensor's. */
const CELL = 48;
function skyGrid(gray, width, height) {
    const cols = Math.ceil(width / CELL), rows = Math.ceil(height / CELL);
    const level = new Float32Array(cols * rows), noise = new Float32Array(cols * rows);
    const sample = [];
    for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
            sample.length = 0;
            for (let y = cy * CELL; y < Math.min(height, (cy + 1) * CELL); y += 2) {
                for (let x = cx * CELL; x < Math.min(width, (cx + 1) * CELL); x += 2) sample.push(gray[y * width + x]);
            }
            const m = median(sample);
            const mad = median(sample.map((v) => Math.abs(v - m)));
            level[cy * cols + cx] = m;
            noise[cy * cols + cx] = Math.max(1.4826 * mad, 0.25);
        }
    }
    return { cols, rows, level, noise };
}

/* The sky's level at a pixel, between the centres of the cells around it, so a sky that
   brightens toward the horizon is followed rather than stepped. */
function skyAt(grid, x, y) {
    const gx = Math.min(Math.max(x / CELL - 0.5, 0), grid.cols - 1);
    const gy = Math.min(Math.max(y / CELL - 0.5, 0), grid.rows - 1);
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const x1 = Math.min(x0 + 1, grid.cols - 1), y1 = Math.min(y0 + 1, grid.rows - 1);
    const fx = gx - x0, fy = gy - y0;
    const at = (a, b) => grid.level[b * grid.cols + a];
    return (at(x0, y0) * (1 - fx) + at(x1, y0) * fx) * (1 - fy) + (at(x0, y1) * (1 - fx) + at(x1, y1) * fx) * fy;
}

/** How a picture looks overall: its median brightness, its noise, and how much is burnt white. */
export function photoStats(gray) {
    const step = Math.max(1, Math.floor(gray.length / 40000));
    const sample = [];
    let white = 0, seen = 0;
    for (let i = 0; i < gray.length; i += step) { sample.push(gray[i]); seen++; if (gray[i] >= 250) white++; }
    return { median: median(sample), white: white / seen };
}

/**
 * The stars in a picture, brightest first: { x, y, flux, peak, size }, x and y to a
 * fraction of a pixel. A star must stand SIGMA noise levels above the sky after a 3x3
 * smoothing, be the brightest point within RADIUS, and be neither a single hot pixel
 * (all its light in one pixel) nor a smear wider than MAX_SIZE (a cloud edge, a lit
 * window, the Moon).
 */
export const SIGMA = 6; // 5 let JPEG noise clumps through on a made-up sky (NOTES.md)
export const RADIUS = 4;
export const MAX_SIZE = 8;
/* A star is measured out to twice RADIUS, so a wide smear is seen whole rather than cut
   down to star size by the window. */
const MEASURE = 2 * RADIUS;
export function findStars(gray, width, height, { limit = 300 } = {}) {
    const grid = skyGrid(gray, width, height);
    const sky = new Float32Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) sky[y * width + x] = skyAt(grid, x, y);
    const rest = new Float32Array(width * height);
    for (let i = 0; i < rest.length; i++) rest[i] = gray[i] - sky[i];
    // 3x3 mean: one hot pixel drops to a ninth, a star (a few pixels wide) far less.
    const smooth = new Float32Array(width * height);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let s = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += rest[(y + dy) * width + x + dx];
            smooth[y * width + x] = s / 9;
        }
    }
    const noise = skyGrid(smooth, width, height);
    const stars = [];
    const edge = MEASURE + 1;
    for (let y = edge; y < height - edge; y++) {
        for (let x = edge; x < width - edge; x++) {
            const i = y * width + x;
            const v = smooth[i];
            if (v < SIGMA * noise.noise[Math.floor(y / CELL) * noise.cols + Math.floor(x / CELL)]) continue;
            let top = true;
            for (let dy = -RADIUS; dy <= RADIUS && top; dy++) {
                for (let dx = -RADIUS; dx <= RADIUS; dx++) {
                    const w = smooth[i + dy * width + dx];
                    if (w > v || (w === v && (dy < 0 || (dy === 0 && dx < 0)))) { top = false; break; }
                }
            }
            if (!top) continue;
            const star = measure(rest, smooth, width, x, y);
            if (!star) continue;
            if (star.size > MAX_SIZE) continue;
            if (star.peak > 0.6 * star.flux) continue;
            stars.push(star);
        }
    }
    stars.sort((a, b) => b.flux - a.flux);
    return stars.slice(0, limit);
}

/* Centroid and light of a star within RADIUS of its brightest point, and its width: the
   area of the smoothed picture above half the smoothed peak, out to MEASURE, read as a
   circle's diameter (a star's FWHM, a little widened by the smoothing). Read off the
   half-peak area, the width is not pulled up by the sky's noise as moments would be. */
function measure(rest, smooth, width, x0, y0) {
    let flux = 0, sx = 0, sy = 0, peak = 0;
    for (let dy = -RADIUS; dy <= RADIUS; dy++) {
        for (let dx = -RADIUS; dx <= RADIUS; dx++) {
            const v = rest[(y0 + dy) * width + x0 + dx];
            if (v <= 0) continue;
            flux += v; sx += v * dx; sy += v * dy;
            if (v > peak) peak = v;
        }
    }
    if (flux <= 0) return null;
    const half = smooth[y0 * width + x0] / 2;
    let area = 0;
    for (let dy = -MEASURE; dy <= MEASURE; dy++) {
        for (let dx = -MEASURE; dx <= MEASURE; dx++) if (smooth[(y0 + dy) * width + x0 + dx] > half) area++;
    }
    return { x: x0 + sx / flux, y: y0 + sy / flux, flux, peak, size: 2 * Math.sqrt(area / Math.PI) };
}

/* The polite answers, by reason. */
export const NOT_SKY = {
    bright: "This looks like a daytime or indoor picture. Star finding works on a photo of the night sky, taken outside after dark. Night mode helps, if your phone has it.",
    few: "We couldn't find enough stars in this picture. Try a photo taken outside at night, pointed up at a clear patch of sky, away from streetlights if you can. Holding the phone very still (or leaning it on something) helps a lot.",
};

/** Fewest stars a picture needs before matching is worth trying. */
export const MIN_STARS = 8;
/** Brightest a night sky's median is allowed to be (0-255). Provisional: to be set from real phone photos. */
export const MAX_NIGHT_MEDIAN = 110;

/** Whether a picture is a night sky worth matching: { ok: true } or { ok: false, reason, message }. */
export function judgeSky(stats, stars) {
    if (stats.median > MAX_NIGHT_MEDIAN) return { ok: false, reason: 'bright', message: NOT_SKY.bright };
    if (stars.length < MIN_STARS) return { ok: false, reason: 'few', message: NOT_SKY.few };
    return { ok: true };
}
