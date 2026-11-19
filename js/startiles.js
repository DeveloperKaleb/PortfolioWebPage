/* Gaia's stars as compact binary tiles (step 1 of "Gaia's stars, if we build toward them",
 * NOTES.md; owner, 2026-11-19). Pure: building tiles (tools/gaiastars/build.mjs) and
 * reading them (the page, later) both use this.
 *
 * The frame is the map's: the Sun at the centre, ecliptic J2000 (js/centauri.js), in
 * parsecs. Positions are Gaia DR3's at its epoch, 2016.0; a star's drift since is far
 * below what a tile can hold.
 *
 * Tiles are an octree. The root is a cube about the Sun, ROOT_HALF parsecs each way; each
 * node keeps up to its capacity of the most luminous stars in its cube that no node above
 * it took, and hands the rest down to its eight children. Drawing the root alone shows the
 * brightest stars everywhere; walking down where the view is closer fills in the fainter
 * ones there, so a visitor downloads only what is on screen.
 *
 * A star is 8 bytes:
 *   - x, y, z: three unsigned 16-bit numbers, little-endian, across its node's cube. The
 *     error is at most the cube's half-size / 65535: 0.03 parsecs (6,500 AU) in the root,
 *     halving at every level down.
 *   - Brightness: one byte of absolute G magnitude, in eighths from MAG_MIN (-8) to +23.875.
 *   - Colour: one byte of Gaia's BP-RP, in fortieths from -1 to +5.35; 255 when Gaia has
 *     none.
 * Within a tile stars are brightest first, so a tile cut short still shows the brightest.
 *
 * Each tile is a file of nothing but its stars (its length says how many). Which tiles
 * exist, and where their cubes are, comes from the index (makeIndex), so a tile needs no
 * header.
 */
import { skyToMap } from './centauri.js';

export const FORMAT = 1;
export const STAR_BYTES = 8;
export const ROOT_HALF = 2048;
export const PER_NODE = 4096;
export const MAG_MIN = -8;
export const MAG_STEP = 1 / 8;
export const COLOUR_MIN = -1;
export const COLOUR_STEP = 1 / 40;
export const NO_COLOUR = 255;
const Q = 65535;

/* A star from a row of Gaia's catalogue: ra and dec in degrees, parallax in mas, G and
   BP-RP in magnitudes (bpRp null or NaN when missing). Distance is 1/parallax: right for
   the stars this is built for (parallax error under 1%), wrong past about 20%. */
export function gaiaStar({ ra, dec, parallax, g, bpRp }) {
    const distance = 1000 / parallax;
    const [x, y, z] = skyToMap(ra, dec, distance);
    return { x, y, z, absMag: g + 5 * Math.log10(parallax) - 10, colour: Number.isFinite(bpRp) ? bpRp : null };
}

/* Cubes: { cx, cy, cz, half }. Octant bits: 1 for x at or past the centre, 2 for y, 4 for z. */
export const rootCube = (half = ROOT_HALF) => ({ cx: 0, cy: 0, cz: 0, half });
export function childCube(cube, octant) {
    const h = cube.half / 2;
    return {
        cx: cube.cx + (octant & 1 ? h : -h),
        cy: cube.cy + (octant & 2 ? h : -h),
        cz: cube.cz + (octant & 4 ? h : -h),
        half: h,
    };
}
export const octantOf = (cube, x, y, z) => (x >= cube.cx ? 1 : 0) | (y >= cube.cy ? 2 : 0) | (z >= cube.cz ? 4 : 0);
/* A node's path is its octants from the root, '' for the root itself: '' then '0'..'7',
   then '00'..'77', and so on. */
export function cubeOf(path, half = ROOT_HALF) {
    let cube = rootCube(half);
    for (const ch of path) cube = childCube(cube, Number(ch));
    return cube;
}
export const tileName = (path) => `r${path}.bin`;

const clampRound = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(v)));
export const quantize = (v, centre, half) => clampRound(((v - centre) / half + 1) / 2 * Q, 0, Q);
export const unquantize = (q, centre, half) => centre + (q / Q * 2 - 1) * half;
export const magByte = (absMag) => clampRound((absMag - MAG_MIN) / MAG_STEP, 0, 255);
export const magOf = (byte) => MAG_MIN + byte * MAG_STEP;
export const colourByte = (colour) => (colour === null || !Number.isFinite(colour) ? NO_COLOUR : clampRound((colour - COLOUR_MIN) / COLOUR_STEP, 0, 254));
export const colourOf = (byte) => (byte === NO_COLOUR ? null : COLOUR_MIN + byte * COLOUR_STEP);

/* stars: an array of { x, y, z, absMag, colour }, already in the order to write. */
export function encodeTile(stars, cube) {
    const bytes = new Uint8Array(stars.length * STAR_BYTES);
    const view = new DataView(bytes.buffer);
    stars.forEach((s, k) => {
        const o = k * STAR_BYTES;
        view.setUint16(o, quantize(s.x, cube.cx, cube.half), true);
        view.setUint16(o + 2, quantize(s.y, cube.cy, cube.half), true);
        view.setUint16(o + 4, quantize(s.z, cube.cz, cube.half), true);
        bytes[o + 6] = magByte(s.absMag);
        bytes[o + 7] = colourByte(s.colour);
    });
    return bytes;
}

/* A tile's bytes back to stars: positions as one Float64Array of x, y, z in turn (parsecs,
   the map's frame), brightness and colour as their bytes (magOf, colourOf read them). */
export function decodeTile(bytes, cube) {
    if (bytes.length % STAR_BYTES) throw new Error(`A tile must be a whole number of ${STAR_BYTES}-byte stars; this one is ${bytes.length} bytes`);
    const count = bytes.length / STAR_BYTES;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const xyz = new Float64Array(count * 3);
    const mag = new Uint8Array(count);
    const colour = new Uint8Array(count);
    const centre = [cube.cx, cube.cy, cube.cz];
    for (let k = 0; k < count; k++) {
        const o = k * STAR_BYTES;
        for (let d = 0; d < 3; d++) xyz[k * 3 + d] = unquantize(view.getUint16(o + 2 * d, true), centre[d], cube.half);
        mag[k] = bytes[o + 6];
        colour[k] = bytes[o + 7];
    }
    return { count, xyz, mag, colour };
}

/* The octree: a Map from path to that node's stars, brightest first. Stars outside the
   root cube are left out and counted. Ties keep the input's order, so a build is the same
   every time. Below maxDepth a node keeps everything handed to it. */
export function buildTree(stars, { half = ROOT_HALF, perNode = PER_NODE, maxDepth = 12 } = {}) {
    const root = rootCube(half);
    const inside = [];
    let outside = 0;
    stars.forEach((s, k) => {
        if (Math.max(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z)) > half) outside++;
        else inside.push(k);
    });
    /* Brightest first once, for all: each node then takes a prefix of what reaches it. */
    inside.sort((a, b) => stars[a].absMag - stars[b].absMag || a - b);
    const nodes = new Map();
    const visit = (path, cube, list) => {
        if (list.length <= perNode || path.length >= maxDepth) {
            nodes.set(path, list.map((k) => stars[k]));
            return;
        }
        nodes.set(path, list.slice(0, perNode).map((k) => stars[k]));
        const parts = Array.from({ length: 8 }, () => []);
        for (const k of list.slice(perNode)) parts[octantOf(cube, stars[k].x, stars[k].y, stars[k].z)].push(k);
        parts.forEach((part, octant) => { if (part.length) visit(path + octant, childCube(cube, octant), part); });
    };
    visit('', root, inside);
    return { nodes, outside };
}

/* What the page needs to find the tiles: the format, the root's size, and every node's
   path and star count, as [path, count] pairs, root first then by depth. Pairs, not an
   object: an object would put paths like "0" to "7" first, as numbers. */
export function makeIndex(nodes, { half = ROOT_HALF, perNode = PER_NODE, source = '' } = {}) {
    const list = [...nodes].map(([path, s]) => [path, s.length]).sort(([a], [b]) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
    return {
        format: FORMAT,
        frame: 'Sun-centred, ecliptic J2000, parsecs',
        rootHalf: half,
        perNode,
        starBytes: STAR_BYTES,
        source,
        stars: list.reduce((t, [, n]) => t + n, 0),
        nodes: list,
    };
}
