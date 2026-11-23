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
            // Never under half a grey level: a phone's night sky is often crushed to near
            // black, where the measured noise is nearly nil and a cloud's 2-level ripple
            // (one JPEG rounding step) would pass as a star (the owner's photos, 2026-11-22).
            noise[cy * cols + cx] = Math.max(1.4826 * mad, 0.5);
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
 * window, a streetlight's glow), nor wider than COMPACT unless it is bright.
 */
export const SIGMA = 6; // 5 let JPEG noise clumps through on a made-up sky (NOTES.md)
export const RADIUS = 4;
/* 16, not 8: a bright star or planet in a phone photo is a bloated, burnt-out disc (a
   made-up Jupiter at 8 px was thrown away). The Moon (about 12 px at a 26 mm lens) gets
   through and is simply matched to nothing. */
export const MAX_SIZE = 16;
/* Faint stars are points, all the camera's own small size (2.5-3.5 px in the owner's
   phone photos of 2026-11-22, at MAX_SIDE); only a bright one bloats. So a spot wider
   than COMPACT counts only if its peak is at least BLOATED_PEAK (0-255) above the sky.
   Those photos were mostly lit cloud on a near-black sky: its texture came through as
   dozens of wide, faint "stars" (4.8-15.8 px, peaks 2-13) that hid the three real ones. */
export const COMPACT = 6;
export const BLOATED_PEAK = 64;
/* A star is measured out to three times RADIUS, so a wide smear is seen whole rather than
   cut down to star size by the window, and a bloated bright star's light is all counted. */
const MEASURE = 3 * RADIUS;
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
            if (star.size > COMPACT && star.peak < BLOATED_PEAK) continue;
            if (star.peak > 0.6 * star.flux) continue;
            stars.push(star);
        }
    }
    stars.sort((a, b) => b.flux - a.flux);
    return stars.slice(0, limit);
}

/* A star's width first: the area of the smoothed picture above half the smoothed peak,
   out to MEASURE, read as a circle's diameter (its FWHM, a little widened by the
   smoothing); read that way it is not pulled up by the sky's noise as moments would be.
   Then its centroid and light within a window as wide as it is (RADIUS at least), so a
   bloated bright star's light is all counted and a faint one's window holds little noise. */
function measure(rest, smooth, width, x0, y0) {
    // Square rings outward, stopping at the first with nothing above half: a neighbour
    // further out is not counted into this star.
    const half = smooth[y0 * width + x0] / 2;
    let area = 0;
    for (let d = 0; d <= MEASURE; d++) {
        let ring = 0;
        for (let dy = -d; dy <= d; dy++) {
            for (let dx = -d; dx <= d; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
                if (smooth[(y0 + dy) * width + x0 + dx] > half) ring++;
            }
        }
        if (ring === 0) break;
        area += ring;
    }
    const size = 2 * Math.sqrt(area / Math.PI);
    const r = Math.min(MEASURE, Math.max(RADIUS, Math.ceil(size)));
    let flux = 0, sx = 0, sy = 0, peak = 0, near = 0;
    for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
            const v = rest[(y0 + dy) * width + x0 + dx];
            if (v <= 0) continue;
            flux += v;
            if (v > peak) peak = v;
            // The centre from the middle only, where a neighbour's light cannot reach.
            if (Math.abs(dx) <= RADIUS && Math.abs(dy) <= RADIUS) { near += v; sx += v * dx; sy += v * dy; }
        }
    }
    if (flux <= 0 || near <= 0) return null;
    return { x: x0 + sx / near, y: y0 + sy / near, flux, peak, size };
}

/* The polite answers, by reason. */
export const NOT_SKY = {
    bright: "This looks like a daytime or indoor picture. Star finding works on a photo of the night sky, taken outside after dark. Night mode helps, if your phone has it.",
    few: "We couldn't find enough stars in this picture to work out which part of the sky it shows. Clouds, haze or city glow may be hiding them. Try a photo taken outside at night, pointed up at a clear patch of sky, away from streetlights and roof lights if you can. Holding the phone very still (or leaning it on something) helps a lot.",
    unmatched: "We found the stars but couldn't match them to the sky. Some may not be stars at all (thin cloud, lights, planes), or there may be too few real ones to make out a pattern. A clear night works best.",
    slow: "We found the stars but couldn't work out which part of the sky this is in the time we allow. A photo of a clear patch of sky, with more stars in it, may work better.",
};

/* Below this 35 mm-equivalent focal length a photo came from a phone's ultra-wide (0.5x)
   lens: 13-16 mm on current phones, against 23-28 mm for the main lens. The owner's first
   real photos (2026-11-22) were all 12 mm. Its edges bend the sky, which the matching
   does not allow for yet, and it spreads the stars thin. */
export const ULTRA_WIDE_MM = 20;
export const LENS_TIP = "Your phone took this photo with its ultra-wide (0.5×) lens. Switching to 1× before you take it usually catches more stars, and doesn't bend the edges of the picture.";
/** The lens tip for a photo whose EXIF says it came from the ultra-wide lens, else ''. */
export function lensTip(mm35) {
    return mm35 && mm35 < ULTRA_WIDE_MM ? LENS_TIP : '';
}

/** Fewest stars a picture needs before matching is worth trying. */
export const MIN_STARS = 8;
/** Brightest a night sky's median is allowed to be (0-255). Provisional: to be set from real phone photos. */
export const MAX_NIGHT_MEDIAN = 110;

/** Whether a picture is a night sky worth matching: { ok: true } or { ok: false, reason, message }.
    A shot aimed with the phone's sensors (js/skyaim.js) needs only one star. */
export function judgeSky(stats, stars, { minStars = MIN_STARS } = {}) {
    if (stats.median > MAX_NIGHT_MEDIAN) return { ok: false, reason: 'bright', message: NOT_SKY.bright };
    if (stars.length < minStars) return { ok: false, reason: 'few', message: NOT_SKY.few };
    return { ok: true };
}

/* What a photo's EXIF says that the search can use: the 35 mm-equivalent focal length
   (tag 0xA405), and when it was taken (DateTimeOriginal, 0x9003, with its time zone,
   OffsetTimeOriginal, 0x9011, when the phone wrote one). Only these are read; nothing
   else in the file is looked at or kept. Returns { mm35, taken } with either missing
   (null) when the file does not say, or is not a JPEG. */
export function readExif(bytes) {
    const none = { mm35: null, taken: null };
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (b[0] !== 0xff || b[1] !== 0xd8) return none;
    let p = 2;
    while (p + 4 < b.length && b[p] === 0xff) {
        const marker = b[p + 1], size = (b[p + 2] << 8) | b[p + 3];
        if (marker === 0xe1 && String.fromCharCode(...b.subarray(p + 4, p + 8)) === 'Exif') return readTiff(b, p + 10, size - 8) ?? none;
        if (marker === 0xda) break;
        p += 2 + size;
    }
    return none;
}
function readTiff(b, start, length) {
    const end = Math.min(b.length, start + length);
    const little = b[start] === 0x49;
    const u16 = (o) => (o + 2 > end ? 0 : little ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
    const u32 = (o) => (o + 4 > end ? 0 : little ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
    const ascii = (o, n) => String.fromCharCode(...b.subarray(o, Math.min(o + n, end))).replace(/\0.*$/, '');
    const entries = (ifd) => {
        const at = start + ifd, n = u16(at), out = new Map();
        for (let k = 0; k < n && at + 2 + 12 * k + 12 <= end; k++) {
            const e = at + 2 + 12 * k;
            out.set(u16(e), { type: u16(e + 2), count: u32(e + 4), at: e + 8 });
        }
        return out;
    };
    const ifd0 = entries(u32(start + 4));
    const exifPtr = ifd0.get(0x8769);
    if (!exifPtr) return null;
    const exif = entries(u32(exifPtr.at));
    const value = (tag) => {
        const e = exif.get(tag);
        if (!e) return null;
        if (e.type === 3) return u16(e.at);
        if (e.type === 2) return ascii(e.count > 4 ? start + u32(e.at) : e.at, e.count);
        return null;
    };
    const mm = value(0xa405);
    const when = value(0x9003), zone = value(0x9011);
    let taken = null;
    const m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(when ?? '');
    if (m) {
        const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${/^[+-]\d\d:\d\d$/.test(zone ?? '') ? zone : ''}`;
        const d = new Date(iso);
        if (!Number.isNaN(d.getTime())) taken = d;
    }
    return { mm35: mm > 0 ? mm : null, taken };
}
