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
import { NEARSTARS } from './nearstars.js';

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

/* Mercury's orbit about the Sun (its semi-major axis, AU): drawn for scale about a single
   star whose planets, if any, all lie inside it (systemOn's forScale) - Barnard's Star's
   four would fit inside it ten times over. */
export const MERCURY_AU = 0.3871;

/* Around each system's bodies the hatching stops: within a pair's widest reach of their
   centre, and within a star's planets' orbits. Alpha Centauri's pair, Proxima, Luhman 16's
   two tundrs (about 3.5 AU apart) and Barnard's Star; a system without its own figure gets
   one by rule (seenNearOf). */
export const SEEN_NEAR = { pair: 40, proxima: 0.1, luhman16: 4, barnard: 0.05 };

/* ---- The neighbours, as data -------------------------------------------------------------
 *
 * Every system beyond the Sun the map holds, nearest first, so that the map draws, picks,
 * clears the hatching about and travels to each the same way (stage 2 of taking the map out
 * to 1,000,000 AU, owner 2026-11-18; NOTES.md). A system has:
 *   id - its place, and its mark when the whole system is one dot (body:<id>);
 *   sky - where its centre is: the pair's centre of gravity, or the one star;
 *   members - its stars and tundrs: id (its mark is body:<id>), name, spectral type, size
 *     (radius in Suns or in Jupiters, with a range where only modelled), the mark's radius
 *     in pixels (markPx), its own sky place if it is a wide companion, what its hover says
 *     (rows) and the map's table (blurb), and its hatching clearing where the rule will not
 *     do (seenNear);
 *   pairs - two members on a known orbit about each other: key (their mark when too close
 *     on screen to tell apart, body:<key>), the orbit, and the clearing about them;
 *   groups - two or three members close together whose orbits are not in hand: always one
 *     mark (body:<key>), at the system's place or its own (sky), with how far apart they
 *     are in words (apartText) and the clearing about them (seenNear);
 *   planets - sizes of orbit only, about a member (star): their tilt, and where each planet
 *     is along its orbit, are not known;
 *   rungs - "Zoom on" steps in its view: label, what to centre on (a member or a pair), the
 *     reach in AU, and its name in a link (&zoom=);
 *   centreName - what a wide companion's distance is given from; a companion with
 *     roughOrbit has its orbit about the pair drawn dashed (proximaOrbit, Proxima's alone).
 * Sizes, read 2026-11-18: A and B, Kervella et al. 2017 (A&A 597, A137), interferometry;
 * Proxima, 0.1542 Suns as adopted by Kervella, Thevenin & Lovis 2017; Barnard's Star, Lane,
 * Boden & Kulkarni 2001 (ApJ 551, L81), interferometry; Luhman 16 A and B, not measured but
 * modelled from their light (Filippazzo et al., as used by the 2025 spectroscopic atlas,
 * arXiv:2503.19322), 1.01 and 1.02 Jupiters, +/- 0.07. */
const GALAXY_ROW = ['It orbits the centre of the galaxy,', 'once in about 230 million years'];
export const NEIGHBOURS = [
    {
        id: 'centauri', name: 'Alpha Centauri', sky: SKY.centre, markPx: 4, centreName: 'A and B',
        rows: [['Three stars:', 'A, B and Proxima']],
        members: [
            { id: 'a', name: 'Alpha Centauri A', type: 'G2 V', markPx: 4.5, size: { suns: 1.2234 } },
            { id: 'b', name: 'Alpha Centauri B', type: 'K1 V', markPx: 3.5, size: { suns: 0.8632 } },
            {
                id: 'proxima', name: 'Proxima Centauri', type: 'M5.5 Ve', markPx: 3, size: { suns: 0.1542 }, sky: SKY.proxima, seenNear: SEEN_NEAR.proxima, roughOrbit: true,
                rows: [['Orbits A and B once in about 550,000 years,', 'now near its farthest; the orbit is known only roughly, so it is drawn dashed']],
            },
        ],
        pairs: [{ key: 'ab', name: 'Alpha Centauri A and B', a: 'a', b: 'b', orbit: ALPHA_CEN_ORBIT, markPx: 4, seenNear: SEEN_NEAR.pair }],
        planets: [
            { star: 'proxima', name: 'Proxima d', a: 0.02881, status: 'confirmed' },
            { star: 'proxima', name: 'Proxima b', a: 0.04848, status: 'confirmed' },
            { star: 'a', name: 'candidate planet at A', a: 2, status: 'candidate' },
        ],
        rungs: [{ id: 'proxima', label: 'Proxima', on: 'proxima', radiusAU: 0.07 }, { id: 'pair', label: 'A and B', on: 'ab', radiusAU: 45 }],
    },
    {
        id: 'barnard', name: "Barnard's Star", sky: SKY.barnard,
        members: [{
            id: 'barnard', name: "Barnard's Star", type: 'M4 V', markPx: 3, size: { suns: 0.201 }, seenNear: SEEN_NEAR.barnard,
            blurb: 'The nearest single star, crossing our sky faster than any other',
            rows: [
                ['A single small star:', 'it crosses our sky faster than any other'],
                GALAXY_ROW,
                ['Its planets were confirmed in 2024 and 2025,', 'all within 0.04 AU of it'],
            ],
        }],
        planets: [
            { star: 'barnard', name: 'Barnard d', a: 0.0188, status: 'confirmed' },
            { star: 'barnard', name: 'Barnard b', a: 0.0229, status: 'confirmed' },
            { star: 'barnard', name: 'Barnard c', a: 0.0274, status: 'confirmed' },
            { star: 'barnard', name: 'Barnard e', a: 0.0381, status: 'confirmed' },
        ],
        /* Out to Mercury's orbit, drawn for scale (owner, 2026-11-18); "Zoom on" steps in to
           the planets, to show how close they are. */
        rungs: [{ id: 'planets', label: 'The four planets', on: 'barnard', radiusAU: 0.045 }, { id: 'innermost', label: 'Barnard d, the innermost', on: 'barnard', radiusAU: 0.021 }],
    },
    {
        id: 'luhman16', name: 'Luhman 16', sky: SKY.luhman16,
        members: [
            { id: 'luhmanA', name: 'Luhman 16 A', type: 'L7.5', markPx: 3.5, size: { jupiters: 1.01, plusMinus: 0.07 }, rows: [["About 35 times Jupiter's mass,", 'usually called a brown dwarf']], blurb: "About 35 times Jupiter's mass (usually called a brown dwarf)" },
            { id: 'luhmanB', name: 'Luhman 16 B', type: 'T0.5', markPx: 3, size: { jupiters: 1.02, plusMinus: 0.07 }, rows: [["About 29 times Jupiter's mass,", 'usually called a brown dwarf']], blurb: "About 29 times Jupiter's mass (usually called a brown dwarf)" },
        ],
        pairs: [{
            key: 'luhman16', name: 'Luhman 16 AB', a: 'luhmanA', b: 'luhmanB', orbit: LUHMAN_ORBIT, markPx: 3, seenNear: SEEN_NEAR.luhman16,
            rows: [["About 35 and 29 times Jupiter's mass;", 'the heaviest kind of tundr, usually called brown dwarfs'], ['Found in 2013:', 'the third-nearest system to the Sun']],
        }],
    },
    /* Every other system within 1,000,000 AU (stage 3, js/nearstars.js), nearest first. */
    ...NEARSTARS,
];

/* Every planet's orbit, about which member. */
export const PLANET_ORBITS = NEIGHBOURS.flatMap((s) => s.planets ?? []);

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
/* And back: a direction in the map's frame to galactic (x toward the centre, z toward the
   galaxy's north pole), for the Milky Way behind the map (js/milkyway.js). */
export const mapToGalactic = ([x, y, z]) => {
    const e = [x, y * Math.cos(OBLIQUITY) - z * Math.sin(OBLIQUITY), y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY)];
    return GALACTIC.map((row) => row[0] * e[0] + row[1] * e[1] + row[2] * e[2]);
};

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

/* A direction on the sky (degrees) at a distance, as [x, y, z] in the map's frame, in the
   distance's units. Also used for Gaia's stars (js/startiles.js). */
export const skyToMap = (raDeg, decDeg, distance) => toEcliptic(skyFrame(raDeg, decDeg).out.map((v) => v * distance));

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

/* The clearing in the hatching about a pair (its figure, or a little past the widest the
   two get apart) and about a member (its figure, or a little past its planets, and never
   under 0.05 AU). */
export const seenNearOfPair = (pair) => pair.seenNear ?? pair.orbit.aAU * (1 + pair.orbit.e) * 1.1;
export function seenNearOf(system, member) {
    const planets = (system.planets ?? []).filter((p) => p.star === member.id).map((p) => p.a);
    return member.seenNear ?? Math.max(0.05, ...planets.map((a) => a * 1.3));
}

/* A system in a year: its centre, each member where it is ({ x, y, z, r } in AU from the
   Sun), each pair with its centre of gravity, the paths its two trace over one orbit and
   how far apart they are, the members on no orbit known (lone), how far its members reach
   from its centre (along the plane, and in 3D), how many marks it breaks into (units: a
   pair, a group or a lone member), and the orbit drawn about it for scale, if any
   (forScale). */
export function systemOn(system, year, { pathSteps = 96 } = {}) {
    const centre = point(place(system.sky, year));
    const at = new Map();
    const pairs = (system.pairs ?? []).map((pair) => {
        const on = pairOn(pair.sky ?? system.sky, pair.orbit, year, pathSteps);
        at.set(pair.a, on.a);
        at.set(pair.b, on.b);
        return { ...on, pair };
    });
    const groups = (system.groups ?? []).map((group) => {
        const at3 = group.sky ? point(place(group.sky, year)) : centre;
        for (const id of group.members) at.set(id, at3);
        return { group, centre: at3, members: group.members.map((id) => system.members.find((m) => m.id === id)) };
    });
    for (const m of system.members) if (!at.has(m.id)) at.set(m.id, m.sky ? point(place(m.sky, year)) : centre);
    const inPair = new Set([...pairs.flatMap((p) => [p.pair.a, p.pair.b]), ...groups.flatMap((g) => g.group.members)]);
    const lone = system.members.filter((m) => !inPair.has(m.id));
    const reach = (flat) => Math.max(0, ...[...at.values()].map((p) => Math.hypot(p.x - centre.x, p.y - centre.y, flat ? 0 : p.z - centre.z)));
    const planets = (system.planets ?? []).map((p) => p.a);
    const single = pairs.length === 0 && groups.length === 0 && lone.length === 1;
    return {
        system, centre, at, pairs, groups, lone,
        extent: reach(true),
        extent3D: reach(false),
        units: pairs.length + groups.length + lone.length,
        forScale: single && planets.every((a) => a < MERCURY_AU) ? MERCURY_AU : null,
    };
}

/* Every neighbour in a year, in NEIGHBOURS's order. */
export const neighboursOn = (year, options) => NEIGHBOURS.map((s) => systemOn(s, year, options));

/* The system in a year, as the map has always had it: Alpha Centauri's pair's centre of
   gravity, A, B and Proxima, each { x, y, z, r } in AU from the Sun, and the paths A and B
   trace about their centre over one orbit; Luhman 16 and its pair; Barnard's Star - and,
   for drawing, every neighbour (systems, from neighboursOn). */
export function centauriOn(year, { pathSteps = 96 } = {}) {
    const systems = neighboursOn(year, { pathSteps });
    const by = Object.fromEntries(systems.map((s) => [s.system.id, s]));
    const { centauri, luhman16, barnard } = by;
    const [pair] = centauri.pairs;
    const proxima = centauri.at.get('proxima');
    return {
        centre: pair.centre, a: pair.a, b: pair.b, paths: pair.paths, apart: pair.apart,
        proxima,
        proximaFromCentre: Math.hypot(proxima.x - pair.centre.x, proxima.y - pair.centre.y, proxima.z - pair.centre.z),
        /* Not part of the system: 6.5 light years away, but far enough below the plane that
           it lands inside the view of both. Its centre of gravity, and its pair as above. */
        luhman16: luhman16.pairs[0].centre,
        luhmanPair: luhman16.pairs[0],
        /* Nor this: the nearest single star, 5.96 light years away. Its drift across our
           sky, the fastest of any star, is about 19 AU a year at its distance. */
        barnard: barnard.at.get('barnard'),
        systems,
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
 * every other system within a million AU; or pulled back until all are in view. Each is a
 * centre and a radius to fit, in AU along the map's plane. All are seen from the Sun in
 * "Galactic street" (called "Nearest bodies", then briefly "Galactic block", until 2026-11-19; the id stays 'both' so links keep working), with the rings about it. */
/* Up to the next round figure of two digits: 15,070 to 16,000, 0.449 to 0.45. */
export const roundUp = (x) => {
    const step = 10 ** (Math.floor(Math.log10(x)) - 1);
    return Number((Math.ceil(x / step - 1e-9) * step).toPrecision(2));
};

/* How far a system's own view reaches (radiusAU along the plane, radius3D in 3D): with
   room for all its members, a quarter again; a pair alone, half again its clearing; a
   single star, its planets a quarter again - or, where they all lie inside Mercury's orbit,
   that orbit, drawn for scale (forScale). */
export function reachOf(on) {
    const { system } = on;
    if (system.radiusAU) return { radiusAU: system.radiusAU, radius3D: system.radius3D ?? system.radiusAU };
    if (on.units > 1) return { radiusAU: roundUp(on.extent * 1.25), radius3D: roundUp(on.extent3D * 1.25) };
    if (on.pairs.length || on.groups.length) {
        const r = roundUp((on.pairs.length ? seenNearOfPair(on.pairs[0].pair) : on.groups[0].group.seenNear) * 1.5);
        return { radiusAU: r, radius3D: r };
    }
    const planets = (system.planets ?? []).map((p) => p.a);
    const r = roundUp(on.forScale ? on.forScale * 1.16 : Math.max(...planets) * 1.25);
    return { radiusAU: r, radius3D: r };
}

/* Where the map can be: at the Sun; pulled back to hold every neighbour ('both', kept for
   links from when it held only Alpha Centauri and the Sun); and at each neighbour, by its
   id. In 3D (js/rubinview.js) the picture can be turned to show any body's true distance
   across it, so each place also has a radius to fit then (radius3D), and the height of its
   home above the plane (cz), which the picture turns about. system: from centauriOn. */
export function places(system, sunRadiusAU, sunRadius3D = sunRadiusAU) {
    const { systems } = system;
    const along = (body) => Math.hypot(body.x, body.y);
    const farthest = Math.max(...systems.map((on) => along(on.centre) + on.extent));
    const farthest3D = Math.max(...systems.map((on) => on.centre.r + on.extent3D));
    const out = {
        sun: { id: 'sun', name: 'the Sun', label: 'The Sun', cx: 0, cy: 0, cz: 0, radiusAU: sunRadiusAU, radius3D: sunRadius3D, },
        both: { id: 'both', name: 'the galactic street', label: 'Galactic street', cx: 0, cy: 0, cz: 0, radiusAU: Math.ceil(farthest * 1.08 / 10000) * 10000, radius3D: Math.ceil(farthest3D * 1.08 / 10000) * 10000 },
    };
    for (const on of systems) {
        const { id, name } = on.system;
        out[id] = { id, name, label: name, cx: on.centre.x, cy: on.centre.y, cz: on.centre.z, ...reachOf(on) };
    }
    return out;
}

/* ---- The systems "Go to" lists ------------------------------------------------------------
 *
 * Every system the map holds, in "Go to" (owner, 2026-11-18: every system, found by typing,
 * each with a symbol for its stars' types, the full type on hovering a name, and a system
 * of several stars split into one piece per star, each with its own). In order of distance;
 * id is the place it goes to, and each member's key is its mark on the map. Types are the
 * usual spectral classes, from NEIGHBOURS: the Sun's by definition; A, B and Proxima from
 * SIMBAD; Barnard's Star from SIMBAD; Luhman 16 A and B from the 2025 spectroscopic atlas
 * (arXiv:2503.19322). */
export const SYSTEMS = [
    { id: 'sun', name: 'The Sun', confirmedPlanets: 8, members: [{ key: 'body:sun', name: 'The Sun', type: 'G2 V' }] },
    ...NEIGHBOURS.map((s) => ({
        id: s.id, name: s.name,
        confirmedPlanets: (s.planets ?? []).filter((p) => p.status === 'confirmed').length,
        members: s.members.map((m) => ({ key: `body:${m.id}`, name: m.name, type: m.type })),
    })),
];

/* What a spectral type means, in words, and how its symbol is drawn: the colour's name in
   RUBIN_COLORS-style keys (STAR_TYPE_COLORS, js/rubincolors.js), and the shape - a filled
   disc for a star burning hydrogen, a dot in a ring for a white dwarf, a ring for a tundr.
   O, B, A and F share one colour: white. */
export function starKind(type) {
    /* Stellar remnants that are not white dwarfs have no spectral type: these two words
       stand in for one (2026-11-19, for Gaia BH1). Dark, ringed, like a tundr. */
    if (type === 'BH') return { colour: 'white', shape: 'hole', plain: true, words: "a black hole: what is left when a very heavy star collapses, so dense that not even light gets out" };
    if (type === 'NS') return { colour: 'white', shape: 'hole', plain: true, words: 'a neutron star: the collapsed core of a heavy star, a city across and heavier than the Sun' };
    const letter = type.trim()[0].toUpperCase();
    if (letter === 'D') return { colour: 'white', shape: 'dot', words: "a white dwarf: the burnt-out core of a star like the Sun, about Earth's size" };
    if ('LTY'.includes(letter)) return { colour: 'tundr', shape: 'ring', words: 'a Hydrogen Tundr, usually called a brown dwarf: too light to burn hydrogen' };
    if (letter === 'M') return { colour: 'red', shape: 'disc', words: 'a red dwarf: a small, cool star, the commonest kind' };
    if (letter === 'K') return { colour: 'orange', shape: 'disc', words: 'an orange dwarf: a star a little smaller and cooler than the Sun' };
    if (letter === 'G') return { colour: 'yellow', shape: 'disc', words: 'a yellow dwarf: a star like the Sun' };
    return { colour: 'white', shape: 'disc', words: 'a white star: larger and hotter than the Sun' };
}

/* What planets are known (owner, 2026-11-18: say whether each system has any), for the
   map's hovers and "Go to": how many are confirmed and how many candidates, and in words,
   each planet by what tells it apart from the others in the system ("b", or "A b" where
   the system's stars each have some). systemName is taken off the front of each name. */
const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
export function planetSummary(planets, systemName = '') {
    const sure = planets.filter((p) => p.status === 'confirmed');
    const maybe = planets.filter((p) => p.status !== 'confirmed');
    const short = (p) => {
        const rest = p.name.startsWith(systemName) && systemName ? p.name.slice(systemName.length).trim() : '';
        return rest || p.name.split(' ').at(-1);
    };
    const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0]);
    const count = (n, what) => `${NUMBER_WORDS[n] ?? n} ${what}${n === 1 ? '' : 's'}`;
    const candidates = maybe.length ? count(maybe.length, 'candidate').toLowerCase() + `, about ${list(maybe.map((p) => `${p.a} AU`))} out, unconfirmed` : '';
    let rows;
    if (sure.length) rows = [[`${count(sure.length, 'planet')} known:`, list(sure.map(short)) + (candidates ? `; and ${candidates}` : '')]];
    else if (maybe.length) rows = [[`No planets confirmed;`, candidates]];
    else rows = [['No planets known yet']];
    return { confirmed: sure.length, candidates: maybe.length, rows, text: rows[0].join(' ') };
}

/* One member's type in full, for hovering its piece of the symbol. */
export const memberTypeText = (member) => (starKind(member.type).plain ? starKind(member.type).words : `${member.type}, ${starKind(member.type).words}`);

/* The whole system's type, for hovering its name: how many stars and tundrs, and each one's
   type. */
export function systemTypeText(system) {
    if (system.typeText) return system.typeText;
    const { members } = system;
    if (members.length === 1) return memberTypeText(members[0]);
    const counts = ['', '', 'Two', 'Three', 'Four', 'Five', 'Six'];
    const allTundrs = members.every((m) => starKind(m.type).shape === 'ring');
    const anyTundr = members.some((m) => starKind(m.type).shape === 'ring');
    const what = allTundrs ? 'Hydrogen Tundrs' : anyTundr ? 'bodies' : 'stars';
    return `${counts[members.length] ?? members.length} ${what}: ${members.map((m) => `${m.name.replace(`${system.name} `, '')}, ${m.type}`).join('; ')}`;
}

/* The systems whose name, or any member's, holds what was typed: letters and digits only,
   in any case, so "barnards" finds Barnard's Star and "proxima" Alpha Centauri. Those whose
   own name starts with it first; otherwise in the list's order. */
export function findSystems(query, systems = SYSTEMS) {
    const plain = (text) => text.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
    const q = plain(query);
    if (!q) return systems;
    const hits = systems.filter((s) => [s.name, ...s.members.map((m) => m.name)].some((n) => plain(n).includes(q)));
    return [...hits.filter((s) => plain(s.name).startsWith(q)), ...hits.filter((s) => !plain(s.name).startsWith(q))];
}

/* "Go to"'s filter (owner, 2026-11-19): by what a system holds, and whether it has
   confirmed planets. Kinds of star, then stellar remnants, then tundrs on their own (not
   those that orbit a star). A system shows if it holds any of the kinds ticked (all, if
   none is), and, with "planets" ticked, has a confirmed planet too. */
export const GO_KINDS = [
    { id: 'white', group: 'Stars', label: 'White stars' },
    { id: 'yellow', group: 'Stars', label: 'Yellow dwarfs' },
    { id: 'orange', group: 'Stars', label: 'Orange dwarfs' },
    { id: 'red', group: 'Stars', label: 'Red dwarfs' },
    { id: 'whitedwarf', group: 'Stellar remnants', label: 'White dwarfs' },
    { id: 'neutronstar', group: 'Stellar remnants', label: 'Neutron stars' },
    { id: 'blackhole', group: 'Stellar remnants', label: 'Black holes' },
    { id: 'tundr', group: 'Hydrogen Tundrs', label: 'Tundrs on their own' },
];
export function kindOfMember(type) {
    if (type === 'BH') return 'blackhole';
    if (type === 'NS') return 'neutronstar';
    const { colour, shape } = starKind(type);
    if (shape === 'dot') return 'whitedwarf';
    if (shape === 'ring') return 'tundr';
    return colour;
}
export function kindsOf(system) {
    const kinds = new Set(system.members.map((m) => kindOfMember(m.type)));
    /* Tundrs count only on their own: a system that is nothing else. */
    if (kinds.has('tundr') && kinds.size > 1) kinds.delete('tundr');
    return kinds;
}
export function filterSystems(systems, { kinds = new Set(), planets = false } = {}) {
    return systems.filter((s) => (!kinds.size || [...kindsOf(s)].some((k) => kinds.has(k))) && (!planets || s.confirmedPlanets > 0));
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
