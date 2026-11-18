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
 *   - Luhman 16 AB, two hydrogen tundrs (brown dwarfs, as usually called; the site counts
 *     them as the heaviest tundrs, owner 2026-11-14): their centre of gravity, drift,
 *     parallax, masses and orbit about each other from Bedin et al. 2024, AN 345, e20230158
 *     (arXiv:2403.08865), tables 1 and 3 - the orbit is table 3's MCMC fit, the one table 2
 *     whose numbers could be read. Table 1 does not print the position's epoch beside it;
 *     2000 fits both its 2MASS and WISE names (positions of about 2000 and 2010), and a
 *     wrong guess would move it about 90 AU, less than a pixel where it is not the centre.
 *   - Barnard's Star: Gaia DR3 (source 4472832130942575872), position at 2016.0, checked
 *     against Wikipedia's J2000 position and the drift between. Its four planets: periods
 *     from Basant et al. 2025 (ApJL 982, L1), orbit sizes from those by Kepler's third law
 *     with the star at 0.162 Suns, which gives c's published 0.0274 AU.
 * What is not known is said, not drawn: nobody has measured how the planets' orbits are
 * tilted, so they are given as sizes only (PLANET_ORBITS).
 */

import { elementsFromState, orbitPath, KM_S_TO_AU_PER_DAY } from './orbit.js';

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
    luhman16: { ra: 162.32821578, dec: -53.31941054, epoch: 2000.0, pmRa: -2768.511, pmDec: 358.472, parallax: 500.993 },
    barnard: { ra: 269.4485025, dec: 4.7394201, epoch: 2016.0, pmRa: -801.551, pmDec: 10362.394, parallax: 546.9759 },
};

/* B's orbit about A (Akeson et al. 2021): period in years, the year of a closest approach,
   and the usual angles in degrees. The node is the one where B is moving away from us. */
export const BINARY = {
    period: 79.762, periastron: 1955.564, e: 0.51947, aArcsec: 17.4930,
    i: 79.2430, node: 205.073, peri: 231.519,
    massA: 1.0788, massB: 0.9092,
};
export const BINARY_A_AU = BINARY.aArcsec / (SKY.centre.parallax / 1000);
const ALPHA_CEN_ORBIT = { ...BINARY, aAU: BINARY_A_AU };

/* Luhman 16 B's orbit about A (Bedin et al. 2024, table 3), the same way round; masses in
   Jupiter's. Without a measured velocity, which node is which is assumed as for Alpha
   Centauri: if it is the other way, A and B are mirrored front to back, a few AU. */
export const LUHMAN_ORBIT = {
    period: 25.508, periastron: 2018.009, e: 0.3262, aAU: 3.426,
    i: 79.804, node: 130.143, peri: 135.13,
    massA: 35.4, massB: 29.4,
};

/* The planets. Sizes of orbit only: their tilt, and where each planet is along its orbit
   as seen from above, are not known. */
export const PLANET_ORBITS = [
    { star: 'proxima', name: 'Proxima d', a: 0.02881, status: 'confirmed' },
    { star: 'proxima', name: 'Proxima b', a: 0.04848, status: 'confirmed' },
    { star: 'a', name: 'candidate planet at A', a: 2, status: 'candidate' },
    { star: 'barnard', name: 'Barnard d', a: 0.0188, status: 'confirmed' },
    { star: 'barnard', name: 'Barnard b', a: 0.0229, status: 'confirmed' },
    { star: 'barnard', name: 'Barnard c', a: 0.0274, status: 'confirmed' },
    { star: 'barnard', name: 'Barnard e', a: 0.0381, status: 'confirmed' },
];

/* Mercury's orbit about the Sun (its semi-major axis, AU): drawn about Barnard's Star for
   scale, around that star's four planets. */
export const MERCURY_AU = 0.3871;

/* Proxima's orbit about A and B (owner, 2026-11-18: a star orbiting another should show
   its orbit). From Kervella, Thevenin & Lovis 2017 (A&A 598, L7; arXiv:1611.03495), table
   B.1: Proxima's place and velocity relative to A and B's centre of gravity, at the
   Hipparcos epoch, in the Galactic frame (X toward the Galactic centre, Y the way the
   Galaxy turns, Z to its north pole; pc and km/s); and the three stars' mass, 2.165 Suns.
   The orbit is worked out from these rather than from the paper's table 3, whose angles,
   Kervella has since written, are in the Galactic frame and not comparable with A and B's
   orbit (Centauri Dreams, 2023-11-24). Worked out so, it gives the paper's own numbers:
   8,650 AU across its long half, eccentricity 0.50, 547,000 years round, near its far end
   now. A revised orbit from the same team is awaited. */
export const PROXIMA_ORBIT = {
    position: [-0.05622, -0.00198, -0.02785], // pc, Proxima less A and B
    velocity: [-0.099, 0.173, 0.188], // km/s
    year: 1991.25,
    massSuns: 2.165,
};
/* Galactic to equatorial (ICRS): the transpose of the Hipparcos matrix from equatorial to
   Galactic (ESA 1997, vol. 1, section 1.5.3). */
const GALACTIC = [
    [-0.0548755604, -0.8734370902, -0.4838350155],
    [0.4941094279, -0.4448296300, 0.7469822445],
    [-0.8676661490, -0.1980763734, 0.4559837762],
];
const galacticToMap = (g) => toEcliptic([0, 1, 2].map((k) => GALACTIC[0][k] * g[0] + GALACTIC[1][k] * g[1] + GALACTIC[2][k] * g[2]));

/* The orbit, as elements about A and B (orbit.js's form), and its path in the map's frame.
   Today's Gaia parallaxes put Proxima about 12,050 AU from A and B and a little to one
   side of where the paper had it (12,950 AU), so the path is turned and shrunk about A
   and B's centre, the least that brings it through where Proxima is: its shape and
   period are the paper's, its size about 7% smaller. */
export function proximaOrbit(system, { steps = 240 } = {}) {
    const { position, velocity, massSuns } = PROXIMA_ORBIT;
    const was = galacticToMap(position).map((v) => v * AU_PER_PARSEC);
    const moving = galacticToMap(velocity).map((v) => v * KM_S_TO_AU_PER_DAY);
    const elements = elementsFromState(was, moving, 2451545.0 + (PROXIMA_ORBIT.year - 2000) * 365.25, massSuns);
    const { centre, proxima } = system;
    const now = [proxima.x - centre.x, proxima.y - centre.y, proxima.z - centre.z];
    const [lw, ln] = [Math.hypot(...was), Math.hypot(...now)];
    const [u, v] = [was.map((c) => c / lw), now.map((c) => c / ln)];
    /* The turn taking one direction to the other, about the line square to both (Rodrigues). */
    const axis = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const sin = Math.hypot(...axis);
    const cos = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const k = sin > 1e-12 ? axis.map((c) => c / sin) : [0, 0, 1];
    const turn = (p) => {
        const kxp = [k[1] * p[2] - k[2] * p[1], k[2] * p[0] - k[0] * p[2], k[0] * p[1] - k[1] * p[0]];
        const kdp = k[0] * p[0] + k[1] * p[1] + k[2] * p[2];
        return [0, 1, 2].map((j) => p[j] * cos + kxp[j] * sin + k[j] * kdp * (1 - cos));
    };
    const shrink = ln / lw;
    const path = orbitPath(elements, { steps, through: { x: was[0], y: was[1], z: was[2] } }).map((q) => {
        const [x, y, z] = turn([q.x, q.y, q.z]).map((c) => c * shrink);
        return { x: centre.x + x, y: centre.y + y, z: centre.z + z };
    });
    return { elements, path, shrink, turnDeg: Math.atan2(sin, cos) / DEG, periodYears: 2 * Math.PI / (0.01720209895 * Math.sqrt(massSuns) / elements.a ** 1.5) / 365.25 };
}

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
   of sight (away from us positive). Alpha Centauri's pair unless another orbit is given. */
export function binaryOffset(year, orbit = ALPHA_CEN_ORBIT) {
    const { period, periastron, e } = orbit;
    const mean = 2 * Math.PI * (((year - periastron) / period) % 1);
    const E = eccentricAnomaly(mean, e);
    const r = orbit.aAU * (1 - e * Math.cos(E));
    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    const u = nu + orbit.peri * DEG;
    const node = orbit.node * DEG, i = orbit.i * DEG;
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
function pairAbout(centreSky, year, orbit) {
    const { north, east, away } = binaryOffset(year, orbit);
    const frame = skyFrame(centreSky.ra, centreSky.dec);
    const relative = toEcliptic([0, 1, 2].map((k) => north * frame.north[k] + east * frame.east[k] + away * frame.out[k]));
    const total = orbit.massA + orbit.massB;
    return {
        a: relative.map((v) => -v * orbit.massB / total),
        b: relative.map((v) => v * orbit.massA / total),
    };
}

/* A pair in a year: its centre of gravity, A and B, each { x, y, z, r } in AU from the
   Sun, how far apart they are, and the paths A and B trace about their centre over one
   orbit. */
function pairOn(centreSky, orbit, year, pathSteps) {
    const centre = place(centreSky, year);
    const add = (offset) => point(centre.map((v, k) => v + offset[k]));
    const now = pairAbout(centreSky, year, orbit);
    const paths = { a: [], b: [] };
    for (let k = 0; k < pathSteps; k++) {
        const at = pairAbout(centreSky, year + (k / pathSteps) * orbit.period, orbit);
        paths.a.push(add(at.a));
        paths.b.push(add(at.b));
    }
    return {
        centre: point(centre),
        a: add(now.a),
        b: add(now.b),
        paths,
        apart: Math.hypot(now.b[0] - now.a[0], now.b[1] - now.a[1], now.b[2] - now.a[2]),
    };
}

/* The system in a year: the pair's centre of gravity, A, B and Proxima, each { x, y, z, r }
   in AU from the Sun, and the paths A and B trace about their centre over one orbit. */
export function centauriOn(year, { pathSteps = 96 } = {}) {
    const pair = pairOn(SKY.centre, ALPHA_CEN_ORBIT, year, pathSteps);
    const centre = [pair.centre.x, pair.centre.y, pair.centre.z];
    const proxima = point(place(SKY.proxima, year));
    const luhman = pairOn(SKY.luhman16, LUHMAN_ORBIT, year, pathSteps);
    return {
        ...pair,
        proxima,
        proximaFromCentre: Math.hypot(proxima.x - centre[0], proxima.y - centre[1], proxima.z - centre[2]),
        /* Not part of the system: 6.5 light years away, but far enough below the plane that
           it lands inside the view of both. Its centre of gravity, and its pair as above. */
        luhman16: luhman.centre,
        luhmanPair: luhman,
        /* Nor this: the nearest single star, 5.96 light years away. Its drift across our
           sky, the fastest of any star, is about 19 AU a year at its distance. */
        barnard: point(place(SKY.barnard, year)),
    };
}

/* ---- Toward the centre of the galaxy -----------------------------------------------------
 *
 * Sagittarius A* ("SagA" on the map, the owner's word), the black hole at the centre of the
 * Milky Way: its radio position (Reid & Brunthaler 2004, J2000), and its distance and mass
 * from the GRAVITY collaboration (2019: 8.178 kpc; 2022: 4.30 million Suns). The map shows
 * only which way it is: the direction along the plane, as a unit vector. */
export const SAG_A = { ra: 266.4168371, dec: -29.0078106, lightYears: 26670, millionSuns: 4.3 };

export function towardSagA() {
    const [x, y, z] = toEcliptic(skyFrame(SAG_A.ra, SAG_A.dec).out);
    const along = Math.hypot(x, y);
    /* Along the plane (x, y), how far below it in degrees, and the whole direction (way), for 3D. */
    return { x: x / along, y: y / along, below: -Math.asin(z) / DEG, way: [x, y, z] };
}

/* ---- Places on the map --------------------------------------------------------------------
 *
 * The map can be at the Sun, as it always was; at each of the nearest bodies beyond it -
 * Alpha Centauri, Barnard's Star and Luhman 16; or pulled back until all are in view. Each is a centre and a radius to fit, in AU along
 * the map's plane, and how wide the map's dark window is there (dark), as a share of the
 * picture's half-width. Both systems are seen from the Sun ("Nearest bodies", since it also
 * holds Luhman 16; the id stays 'both' so links keep working), with the rings about it and a
 * smaller window, so Alpha Centauri sits out near the edge (owner, 2026-11-14). */
/* Around the other system's bodies the hatching stops: within the pair's widest reach of
   their centre, and within Proxima's planets' orbits. Likewise about Luhman 16's two
   tundrs, about 3.5 AU apart. */
export const SEEN_NEAR = { pair: 40, proxima: 0.1, luhman16: 4, barnard: 0.05 };

/* In 3D (js/rubinview.js) the picture can be turned to show any body's true distance
   across it, so each place also has a radius to fit then (radius3D), and the height of
   its home above the plane (cz), which the picture turns about. */
export function places(system, sunRadiusAU, sunRadius3D = sunRadiusAU) {
    const { centre, proxima, luhman16, barnard } = system;
    const reach = Math.hypot(proxima.x - centre.x, proxima.y - centre.y);
    const reach3D = Math.hypot(proxima.x - centre.x, proxima.y - centre.y, proxima.z - centre.z);
    const along = (body) => Math.hypot(body.x, body.y);
    const farthest = Math.max(along(centre) + reach, along(luhman16), along(barnard));
    const farthest3D = Math.max(centre.r + reach3D, luhman16.r, barnard.r);
    return {
        sun: { id: 'sun', name: 'the Sun', label: 'The Sun', cx: 0, cy: 0, cz: 0, radiusAU: sunRadiusAU, radius3D: sunRadius3D, dark: 1 },
        both: { id: 'both', name: 'the nearest bodies', label: 'Nearest bodies', cx: 0, cy: 0, cz: 0, radiusAU: Math.ceil(farthest * 1.08 / 10000) * 10000, radius3D: Math.ceil(farthest3D * 1.08 / 10000) * 10000, dark: 0.65 },
        centauri: { id: 'centauri', name: 'Alpha Centauri', label: 'Alpha Centauri', cx: centre.x, cy: centre.y, cz: centre.z, radiusAU: Math.ceil(reach * 1.25 / 1000) * 1000, radius3D: Math.ceil(reach3D * 1.25 / 1000) * 1000, dark: 1 },
        /* Room for the clearing about the two tundrs. */
        luhman16: { id: 'luhman16', name: 'Luhman 16', label: 'Luhman 16', cx: luhman16.x, cy: luhman16.y, cz: luhman16.z, radiusAU: 6, radius3D: 6, dark: 1 },
        /* Out to Mercury's orbit, drawn there for scale (owner, 2026-11-18), with the four
           planets bunched in the middle; "Zoom on" steps in to them. */
        barnard: { id: 'barnard', name: "Barnard's Star", label: "Barnard's Star", cx: barnard.x, cy: barnard.y, cz: barnard.z, radiusAU: 0.45, radius3D: 0.45, dark: 1 },
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
