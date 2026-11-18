/* The Milky Way behind the Solar System map (owner, 2026-11-18: "additional perspective
 * when removing the lines").
 *
 * Everything on the map lies deep inside the galaxy's disk - it is about 1,000 light years
 * thick, the map 31 across - so the galaxy cannot be drawn to scale behind it. What is drawn
 * is the sky: what you would see beyond the map, looking the way the camera looks, as if
 * through a lens 90 degrees wide. Seen flat, from above the plane of Earth's orbit, that is
 * the sky toward its south pole, with the Milky Way's band along one side; in 3D it turns
 * with the map. Distance does not move it, so panning and zooming leave it be.
 *
 * The sky itself is rubin/milkyway.png, built by tools/milkyway from Gaia DR3's star counts:
 * galactic longitude across, latitude down from +90, grey for how crowded with stars. Only
 * the dark window of the map shows it, fading out with the window's own fade.
 */
import { mapToGalactic } from './centauri.js';

/* Half the lens's width, as a tangent: 1 is 90 degrees across the picture. */
export const SKY_TAN_HALF = 1;
const DEG = 180 / Math.PI;

/* The camera's three directions in the map's frame, from projector()'s turn and tilt (in
   js/rubinview.js): across the picture, up it, and away from the reader into it. */
export function skyBasis(cam) {
    const [ct, st, cr, sr] = [Math.cos(cam.tilt), Math.sin(cam.tilt), Math.cos(cam.turn), Math.sin(cam.turn)];
    const right = [cr, -sr, 0];
    const up = [sr * ct, cr * ct, st];
    /* up x right: away from the reader (straight down, flat). */
    const forward = [up[1] * right[2] - up[2] * right[1], up[2] * right[0] - up[0] * right[2], up[0] * right[1] - up[1] * right[0]];
    return { right, up, forward };
}

/* Galactic longitude and latitude, in degrees, of the sky at a point of the picture: px
   and py from -1 to 1, right and up from the middle. */
export function skyAt(basis, px, py, tanHalf = SKY_TAN_HALF) {
    const { right, up, forward } = basis;
    const d = [0, 1, 2].map((k) => forward[k] + tanHalf * (px * right[k] + py * up[k]));
    const n = Math.hypot(...d);
    const [gx, gy, gz] = mapToGalactic(d.map((v) => v / n));
    return { l: ((Math.atan2(gy, gx) * DEG) % 360 + 360) % 360, b: Math.asin(Math.max(-1, Math.min(1, gz))) * DEG };
}

/* How the window fades, as the stylesheet draws it: dark to 70% of its radius, then a
   smooth step to the page's brown at its edge. r and edge in the same units. */
export function windowFade(r, edge) {
    const t = Math.min(1, Math.max(0, (r - 0.7 * edge) / (0.3 * edge)));
    return 1 - t * t * (3 - 2 * t);
}

/* The sky's colour, the map's pale text colour; how strongly it shows at its densest, so
   the faintest marks stay clear over it; and the share of the texture's grey that counts
   as empty sky, so the sparse sky away from the band leaves the window dark. */
const GLOW = [227, 231, 175];
const STRONGEST = 0.42;
const EMPTY = 0.35;

/* Paints the sky into image (an ImageData's data, width, height) from the sky texture
   (data as grey or RGBA, its width and height), for a camera, with the window's radius as
   a share of the picture's half-width. */
export function paintSky(image, texture, cam, windowShare, tanHalf = SKY_TAN_HALF) {
    const { width: w, height: h, data } = image;
    const { width: tw, height: th } = texture;
    const tex = texture.data;
    const stride = tex.length / (tw * th);
    /* The turn to galactic is linear, so the camera's directions are turned once and each
       point of the picture is a sum of them: a few multiplications and two angles a pixel,
       fast enough to repaint while the map is dragged round. */
    const { right, up, forward } = skyBasis(cam);
    const [F, R, U] = [forward, right, up].map(mapToGalactic);
    const PER_DEG_U = tw / 360;
    const PER_DEG_V = th / 180;
    for (let y = 0; y < h; y++) {
        const py = 1 - (2 * (y + 0.5)) / h;
        for (let x = 0; x < w; x++) {
            const px = (2 * (x + 0.5)) / w - 1;
            const i = (y * w + x) * 4;
            const fade = windowFade(Math.sqrt(px * px + py * py), windowShare);
            if (fade <= 0) { data[i + 3] = 0; continue; }
            const [a, c] = [tanHalf * px, tanHalf * py];
            const gx = F[0] + a * R[0] + c * U[0];
            const gy = F[1] + a * R[1] + c * U[1];
            const gz = F[2] + a * R[2] + c * U[2];
            const l = Math.atan2(gy, gx) * DEG;
            const b = Math.asin(gz / Math.sqrt(gx * gx + gy * gy + gz * gz)) * DEG;
            /* Between the four texture pixels about it; longitude wraps round. */
            const u = (l < 0 ? l + 360 : l) * PER_DEG_U - 0.5;
            const v = Math.min(th - 1, Math.max(0, (90 - b) * PER_DEG_V - 0.5));
            const c0 = Math.floor(u);
            const r0 = Math.floor(v);
            const fu = u - c0;
            const fv = v - r0;
            const ca = (c0 + tw) % tw;
            const cb = (c0 + 1 + tw) % tw;
            const ra = r0 * tw;
            const rb = Math.min(th - 1, r0 + 1) * tw;
            const g = (tex[(ra + ca) * stride] * (1 - fu) + tex[(ra + cb) * stride] * fu) * (1 - fv)
                + (tex[(rb + ca) * stride] * (1 - fu) + tex[(rb + cb) * stride] * fu) * fv;
            data[i] = GLOW[0];
            data[i + 1] = GLOW[1];
            data[i + 2] = GLOW[2];
            const t = (g / 255 - EMPTY) / (1 - EMPTY);
            data[i + 3] = t > 0 ? Math.round(255 * STRONGEST * t ** 1.4 * fade) : 0;
        }
    }
}
