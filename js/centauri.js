/* The nearest star system, for the far end of the Solar System tab's map: where Alpha
 * Centauri A and B and Proxima are on a date, in the map's own frame (AU from the Sun, the
 * plane of Earth's orbit, x toward the March equinox), so they sit in their true places
 * beside everything else on it.
 *
 * Pure: no DOM, no clock, no network. Sources, read 2026-11-13:
 *   - A and B's centre of gravity, their orbit about each other, their masses and their
 *     parallax: Akeson et al. 2021, AJ 162, 14 (arXiv:2104.10086), tables 8 and 9.
 *   - Proxima: Gaia DR3, as given by SIMBAD and Wikipedia's infobox.
 *   - Proxima's planets: b from Anglada-Escude et al. 2016, d from Faria et al. 2022; the
 *     candidate at A from Beichman, Sanghi et al. 2025 (arXiv:2508.03814).
 * What is not known is said, not drawn: nobody has measured how the planets' orbits are
 * tilted, so they are given as sizes only (PLANET_ORBITS).
 */

const DEG = Math.PI / 180;
const MAS = DEG / 3600000;
export const AU_PER_PARSEC = 648000 / Math.PI;
export const AU_PER_LIGHT_YEAR = 63241.077;
/* The tilt of Earth's equator to its orbit at J2000: turns sky coordinates into the map's. */
const OBLIQUITY = 23.4392911 * DEG;

/* Where each is on the sky, when that was measured, how fast it drifts (mas a year; the
   first already scaled by the cosine of the declination), and its parallax in mas. */
export const SKY = {
    centre: { ra: 219.85892215, dec: -60.83163195, epoch: 2019.5, pmRa: -3639.95, pmDec: 700.40, parallax: 750.81 },
    proxima: { ra: 217.428953, dec: -62.679484, epoch: 2000.0, pmRa: -3781.741, pmDec: 769.465, parallax: 768.0665 },
};

/* B's orbit about A (Akeson et al. 2021): period in years, the year of a closest approach,
   and the usual angles in degrees. The node is the one where B is moving away from us. */
export const BINARY = {
    period: 79.762, periastron: 1955.564, e: 0.51947, aArcsec: 17.4930,
    i: 79.2430, node: 205.073, peri: 231.519,
    massA: 1.0788, massB: 0.9092,
};
export const BINARY_A_AU = BINARY.aArcsec / (SKY.centre.parallax / 1000);

/* The planets. Sizes of orbit only: their tilt, and where each planet is along its orbit
   as seen from above, are not known. */
export const PLANET_ORBITS = [
    { star: 'proxima', name: 'Proxima d', a: 0.02881, status: 'confirmed' },
    { star: 'proxima', name: 'Proxima b', a: 0.04848, status: 'confirmed' },
    { star: 'a', name: 'candidate planet at A', a: 2, status: 'candidate' },
];

/* A decimal year from a Julian date, and back to the date's own year. */
export const yearOf = (jd) => 2000 + (jd - 2451545.0) / 365.25;

/* Unit vectors at a place on the sky, in equatorial coordinates: toward it, and north and
   east across it. */
function skyFrame(raDeg, decDeg) {
    const ra = raDeg * DEG, dec = decDeg * DEG;
    return {
        out: [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)],
        north: [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)],
        east: [-Math.sin(ra), Math.cos(ra), 0],
    };
}

/* Equatorial to the map's frame: a turn about the x axis by the obliquity. */
const toEcliptic = ([x, y, z]) => [
    x,
    y * Math.cos(OBLIQUITY) + z * Math.sin(OBLIQUITY),
    -y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY),
];

const point = ([x, y, z]) => ({ x, y, z, r: Math.hypot(x, y, z) });

/* Where a catalogued star is in a year, in the map's frame. Its drift across the sky is
   followed; its motion toward or away from us (a few AU a year) is not. */
function place(star, year) {
    const dt = year - star.epoch;
    const dec = star.dec + star.pmDec * dt * MAS / DEG;
    const ra = star.ra + star.pmRa * dt * MAS / DEG / Math.cos(star.dec * DEG);
    const distance = AU_PER_PARSEC / (star.parallax / 1000);
    return toEcliptic(skyFrame(ra, dec).out.map((v) => v * distance));
}

/* Kepler's equation, by Newton's method. */
function eccentricAnomaly(mean, e) {
    let E = mean;
    for (let k = 0; k < 30; k++) {
        const step = (E - e * Math.sin(E) - mean) / (1 - e * Math.cos(E));
        E -= step;
        if (Math.abs(step) < 1e-13) break;
    }
    return E;
}

/* B as seen from A in a year: across the sky (north and east, in AU) and along our line
   of sight (away from us positive). */
export function binaryOffset(year) {
    const { period, periastron, e } = BINARY;
    const mean = 2 * Math.PI * (((year - periastron) / period) % 1);
    const E = eccentricAnomaly(mean, e);
    const r = BINARY_A_AU * (1 - e * Math.cos(E));
    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    const u = nu + BINARY.peri * DEG;
    const node = BINARY.node * DEG, i = BINARY.i * DEG;
    return {
        north: r * (Math.cos(u) * Math.cos(node) - Math.sin(u) * Math.sin(node) * Math.cos(i)),
        east: r * (Math.cos(u) * Math.sin(node) + Math.sin(u) * Math.cos(node) * Math.cos(i)),
        away: r * Math.sin(u) * Math.sin(i),
        r,
    };
}

/* What an observer on Earth measures of the pair: how far apart on the sky, in arcseconds,
   and B's direction from A, in degrees from north through east. For checking against
   published measurements. */
export function binaryOnSky(year) {
    const { north, east } = binaryOffset(year);
    const separation = Math.hypot(north, east) / BINARY_A_AU * BINARY.aArcsec;
    return { separation, angle: ((Math.atan2(east, north) / DEG) + 360) % 360 };
}

/* The pair's offsets from their centre of gravity, in the map's frame. */
function pairAbout(centreSky, year) {
    const { north, east, away } = binaryOffset(year);
    const frame = skyFrame(centreSky.ra, centreSky.dec);
    const relative = toEcliptic([0, 1, 2].map((k) => north * frame.north[k] + east * frame.east[k] + away * frame.out[k]));
    const total = BINARY.massA + BINARY.massB;
    return {
        a: relative.map((v) => -v * BINARY.massB / total),
        b: relative.map((v) => v * BINARY.massA / total),
    };
}

/* The system in a year: the pair's centre of gravity, A, B and Proxima, each { x, y, z, r }
   in AU from the Sun, and the paths A and B trace about their centre over one orbit. */
export function centauriOn(year, { pathSteps = 96 } = {}) {
    const centre = place(SKY.centre, year);
    const add = (offset) => point(centre.map((v, k) => v + offset[k]));
    const now = pairAbout(SKY.centre, year);
    const paths = { a: [], b: [] };
    for (let k = 0; k < pathSteps; k++) {
        const at = pairAbout(SKY.centre, year + (k / pathSteps) * BINARY.period);
        paths.a.push(add(at.a));
        paths.b.push(add(at.b));
    }
    const proxima = point(place(SKY.proxima, year));
    return {
        centre: point(centre),
        a: add(now.a),
        b: add(now.b),
        proxima,
        paths,
        apart: Math.hypot(now.b[0] - now.a[0], now.b[1] - now.a[1], now.b[2] - now.a[2]),
        proximaFromCentre: Math.hypot(proxima.x - centre[0], proxima.y - centre[1], proxima.z - centre[2]),
    };
}

/* ---- Places on the map --------------------------------------------------------------------
 *
 * The map can be in three places: at the Sun, as it always was; at Alpha Centauri; and
 * pulled back until both are in view. Each is a centre and a radius to fit, in AU along
 * the map's plane. */
/* Around the other system's bodies the hatching stops: within the pair's widest reach of
   their centre, and within Proxima's planets' orbits. */
export const SEEN_NEAR = { pair: 40, proxima: 0.1 };

export function places(system, sunRadiusAU) {
    const { centre, proxima } = system;
    const reach = Math.hypot(proxima.x - centre.x, proxima.y - centre.y);
    const half = Math.hypot(centre.x, centre.y) / 2;
    return {
        sun: { id: 'sun', name: 'the Sun', cx: 0, cy: 0, radiusAU: sunRadiusAU },
        both: { id: 'both', name: 'both systems', cx: centre.x / 2, cy: centre.y / 2, radiusAU: Math.ceil((half + reach) * 1.08 / 10000) * 10000 },
        centauri: { id: 'centauri', name: 'Alpha Centauri', cx: centre.x, cy: centre.y, radiusAU: Math.ceil(reach * 1.25 / 1000) * 1000 },
    };
}

/* A distance for the far end of the map: AU while that reads well, light years beyond. */
export function farDistanceText(distanceAU) {
    if (distanceAU < 100) return `${distanceAU.toFixed(distanceAU < 10 ? 2 : 1)} AU`;
    const grouped = String(Math.round(distanceAU)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (distanceAU < 50000) return `${grouped} AU`;
    return `${(distanceAU / AU_PER_LIGHT_YEAR).toFixed(2)} light years (${grouped} AU)`;
}

/* How far along the plane and out of it, as the map's other objects say it. */
export function farPlaneText({ x, y, z }) {
    return `${farDistanceText(Math.hypot(x, y))} along the plane, ${farDistanceText(Math.abs(z))} ${z >= 0 ? 'above' : 'below'} it`;
}
