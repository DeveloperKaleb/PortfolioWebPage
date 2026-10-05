/* Where an outer Solar System object is, and what its orbit says about it.
 *
 * From the orbital elements JPL's small-body database gives (heliocentric, ecliptic and
 * equinox J2000): its position on a date by two-body motion, its distance from the Sun
 * and from Earth, how bright it should look, whether a single Rubin exposure could see
 * it, whether it is inside the project's 100,000 AU scope, and the orbit flags.
 *
 * Two-body motion ignores the planets' pull. For these distant objects that is small:
 * against JPL Horizons, which includes it, the distances agree to a few thousandths of
 * an AU near the elements' epoch and to well under 0.1 AU three years out (the tests use
 * recorded Horizons values). The collector refreshes the elements, so the error never
 * grows far.
 *
 * Pure: no network, no DOM.
 */

const DEG = Math.PI / 180;
/* Gaussian gravitational constant: the Sun's mean motion for a = 1 AU, radians per day. */
const K = 0.01720209895;

/* The project's outer limit: objects within 100,000 AU of the Sun. */
export const SCOPE_AU = 100000;

/* A single Rubin visit reaches about r = 24.7 (5 sigma), from Ivezic et al. (2019),
   "LSST: from science drivers to reference design and anticipated data products",
   ApJ 873, 111. Magnitudes here are visual, so an object's V - r colour is needed; 0.4
   is typical of TNOs, which are mostly red. The collector should use measured colours
   where Rubin has them. */
export const RUBIN_SINGLE_VISIT = { band: 'r', depth: 24.7 };
export const TYPICAL_V_MINUS_R = 0.4;

/* Brighter than this in r, a single Rubin visit saturates: the LSST Science Book gives
   r 15.8 for a 15 s exposure in 0.7" seeing, and Rubin's single 30 s exposures move that
   about 0.7-0.8 mag fainter, to about 16.5 - estimates made before real LSSTCam data, which
   vary with seeing (Rubin forum, "Saturation limits", 2026-09-24). 16 sits between the two.
   Rubin may still report a saturated object (its alerts flag saturated pixels), but its
   brightness is clipped, so it is never used. Pluto (r about 14.7) is the one object it
   catches; Makemake and Haumea (about 16.7-16.9) are just clear. See NOTES.md. */
export const RUBIN_SATURATION = { band: 'r', limit: 16 };

/* Whether an object as bright as this (V) is too bright for Rubin to measure. */
export const tooBrightForRubin = (V, vMinusR = TYPICAL_V_MINUS_R) => V - vMinusR < RUBIN_SATURATION.limit;

/* The thresholds for the orbit flags. extremeOrbit is the extreme-TNO definition of
   Trujillo & Sheppard (2014, Nature 507, 471). detached is the usual Sednoid perihelion
   cut. highlyInclined at 40 degrees is a convention, not a published line: to be tuned
   once the collector has the full TNO population to compare against. */
export const ORBIT_THRESHOLDS = {
    extreme: { a: 150, q: 30 },
    detachedQ: 50,
    inclined: 40,
    retrograde: 90,
};

export const jdFromDate = (date) => date.getTime() / 86400000 + 2440587.5;

/* Kepler's equation: the eccentric anomaly for a mean anomaly M (radians), elliptic
   (e < 1) or hyperbolic (e > 1), by Newton's method. */
export function solveKepler(M, e) {
    if (e < 1) {
        const m = Math.atan2(Math.sin(M), Math.cos(M));
        let E = e < 0.8 ? m : Math.PI * Math.sign(m || 1);
        for (let i = 0; i < 100; i++) {
            const step = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
            E -= step;
            if (Math.abs(step) < 1e-14) break;
        }
        return E;
    }
    let F = Math.asinh(M / e);
    for (let i = 0; i < 100; i++) {
        const step = (e * Math.sinh(F) - F - M) / (e * Math.cosh(F) - 1);
        F -= step;
        if (Math.abs(step) < 1e-14) break;
    }
    return F;
}

/* Heliocentric ecliptic J2000 position (AU) on a Julian date. Elements as JPL gives
   them: a (AU, negative when unbound), e, i, om, w and ma in degrees, epoch a JD. */
export function positionAt(el, jd) {
    const { a, e } = el;
    if (Math.abs(e - 1) < 1e-9) throw new RangeError('a parabolic orbit needs perihelion time, not a mean anomaly');
    const n = K / Math.abs(a) ** 1.5;
    const M = el.ma * DEG + n * (jd - el.epoch);
    let xv, yv;
    if (e < 1) {
        const E = solveKepler(M, e);
        xv = a * (Math.cos(E) - e);
        yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
    } else {
        const F = solveKepler(M, e);
        xv = a * (Math.cosh(F) - e);
        yv = -a * Math.sqrt(e * e - 1) * Math.sinh(F);
    }
    const [O, w, i] = [el.om * DEG, el.w * DEG, el.i * DEG];
    const [cO, sO, cw, sw, ci, si] = [Math.cos(O), Math.sin(O), Math.cos(w), Math.sin(w), Math.cos(i), Math.sin(i)];
    const x = (cO * cw - sO * sw * ci) * xv + (-cO * sw - sO * cw * ci) * yv;
    const y = (sO * cw + cO * sw * ci) * xv + (-sO * sw + cO * cw * ci) * yv;
    const z = (sw * si) * xv + (cw * si) * yv;
    return { x, y, z, r: Math.hypot(x, y, z) };
}

/* Earth's heliocentric ecliptic J2000 position (AU), from the low-precision solar
   coordinates of the Astronomical Almanac (good to about 0.01 degrees), turned from the
   equinox of date back to J2000. Plenty for distances to objects tens of AU away. */
export function earthAt(jd) {
    const n = jd - 2451545.0;
    const g = (357.528 + 0.9856003 * n) * DEG;
    const L = 280.460 + 0.9856474 * n;
    const lambdaOfDate = L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g);
    const lambda = (lambdaOfDate - 1.397 * (n / 36525)) * DEG;
    const R = 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g);
    return { x: -R * Math.cos(lambda), y: -R * Math.sin(lambda), z: 0, r: R };
}

/* Apparent visual magnitude from H, the distances and the phase angle (degrees), with
   the IAU H-G phase function (Bowell et al. 1989). Distant objects never show more than
   a degree or two of phase, so G barely matters; 0.15 is the standard default. */
export function apparentMagnitude(H, r, delta, phaseDeg, G = 0.15) {
    const t = Math.tan(phaseDeg * DEG / 2);
    const phi1 = Math.exp(-3.33 * t ** 0.63);
    const phi2 = Math.exp(-1.87 * t ** 1.22);
    return H + 5 * Math.log10(r * delta) - 2.5 * Math.log10((1 - G) * phi1 + G * phi2);
}

/* How the object looks from Earth on a date: distances, phase angle, visual magnitude,
   whether one Rubin visit could detect it, and whether it is within scope. */
export function observe(el, H, jd, { vMinusR = TYPICAL_V_MINUS_R } = {}) {
    const p = positionAt(el, jd);
    const earth = earthAt(jd);
    const d = { x: p.x - earth.x, y: p.y - earth.y, z: p.z - earth.z };
    const delta = Math.hypot(d.x, d.y, d.z);
    const cosPhase = (p.x * d.x + p.y * d.y + p.z * d.z) / (p.r * delta);
    const phase = Math.acos(Math.min(1, Math.max(-1, cosPhase))) / DEG;
    const V = apparentMagnitude(H, p.r, delta, phase);
    return {
        r: p.r, delta, phase, V,
        /* Where it is, heliocentric ecliptic AU, for the tab's top-down map. */
        x: p.x, y: p.y, z: p.z,
        detectable: V - vMinusR <= RUBIN_SINGLE_VISIT.depth,
        inScope: p.r <= SCOPE_AU,
    };
}

/* The orbit flags (defined in js/flags.js) for a set of elements. q, the perihelion, is
   worked out from a and e rather than trusted from the input. */
export function orbitFlags(el) {
    const { a, e, i } = el;
    const q = a * (1 - e);
    const t = ORBIT_THRESHOLDS;
    const flags = [];
    if (e >= 1) flags.push('unbound');
    if (e < 1 && a > t.extreme.a && q > t.extreme.q) flags.push('extremeOrbit');
    if (q > t.detachedQ) flags.push('detached');
    if (i > t.retrograde) flags.push('retrograde');
    else if (i > t.inclined) flags.push('highlyInclined');
    return flags;
}

/* How well an orbit is known, from JPL's data_arc (days the observations span) and
   condition_code (the MPC's U, 0 well known to 9 highly uncertain). A fresh discovery's
   orbit can be far off: the first live run's watch list included 2026 RY158, found this
   year, with a perihelion of 11 AU and a retrograde orbit - more likely an early orbit
   than a find. These lines are conventions, not published cuts: a year of observations
   pins a distant orbit far better than a few weeks, and U of 6 or more means positions a
   year on are uncertain by degrees. */
export const ORBIT_QUALITY = { minArcDays: 365, maxConditionCode: 5 };

export function qualityFlags(quality) {
    if (!quality) return [];
    const { arcDays, conditionCode } = quality;
    const short = arcDays !== null && arcDays !== undefined && arcDays < ORBIT_QUALITY.minArcDays;
    const poor = conditionCode !== null && conditionCode !== undefined && conditionCode > ORBIT_QUALITY.maxConditionCode;
    return short || poor ? ['uncertainOrbit'] : [];
}

/* ---- Orbits from Rubin's own records ------------------------------------------------- */

/* Rubin's detection records carry the object's heliocentric position (AU) and velocity
   (km/s) in the equatorial frame (ICRS). Checked against Gonggong: rotated into the
   equatorial frame, JPL's orbit agrees to 0.0007 AU in position and 0.0005 km/s in
   velocity. These are Rubin's own predictions for the object (from the MPC orbit its
   observations feed), the closest thing to Rubin's view of the orbit until orbits can be
   fitted from Rubin's sky positions alone. See NOTES.md. */
export const OBLIQUITY_J2000 = 23.4392911 * DEG;
export const KM_S_TO_AU_PER_DAY = 86400 / 149597870.7;

/* Equatorial (ICRS) to ecliptic J2000: a rotation about x by the obliquity. */
export function equatorialToEcliptic([x, y, z]) {
    const c = Math.cos(OBLIQUITY_J2000), s = Math.sin(OBLIQUITY_J2000);
    return [x, c * y + s * z, -s * y + c * z];
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => Math.sqrt(dot(a, a));
const wrapDeg = (rad) => ((rad / DEG) % 360 + 360) % 360;

/* Orbital elements, in the same form as JPL's (a in AU, negative when unbound; angles in
   degrees; epoch a JD), from a heliocentric ecliptic position (AU) and velocity
   (AU/day) at a moment. Two-body, the Sun's mass alone, like the rest of this module. */
export function elementsFromState(position, velocity, epoch) {
    const mu = K * K;
    const r = norm(position);
    const h = cross(position, velocity);
    const n = [-h[1], h[0], 0];
    const eVec = cross(velocity, h).map((c, k) => c / mu - position[k] / r);
    const e = norm(eVec);
    const energy = dot(velocity, velocity) / 2 - mu / r;
    const a = -mu / (2 * energy);
    const i = Math.acos(Math.max(-1, Math.min(1, h[2] / norm(h))));
    const nLen = norm(n);
    /* Undefined for an orbit in the ecliptic or a circle; set to zero then, as is usual. */
    const om = nLen > 1e-12 ? Math.atan2(n[1], n[0]) : 0;
    let w = 0;
    if (nLen > 1e-12 && e > 1e-10) {
        w = Math.acos(Math.max(-1, Math.min(1, dot(n, eVec) / (nLen * e))));
        if (eVec[2] < 0) w = 2 * Math.PI - w;
    }
    let nu = e > 1e-10
        ? Math.acos(Math.max(-1, Math.min(1, dot(eVec, position) / (e * r))))
        : Math.atan2(position[1], position[0]) - om;
    if (dot(position, velocity) < 0) nu = 2 * Math.PI - nu;
    let ma;
    if (e < 1) {
        const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
        ma = E - e * Math.sin(E);
    } else {
        const F = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2));
        ma = e * Math.sinh(F) - F;
    }
    return { a, e, i: i / DEG, om: wrapDeg(om), w: wrapDeg(w), ma: e < 1 ? wrapDeg(ma) : ma / DEG, epoch };
}

/* Rubin's view of an object from its detections (Fink rows): the latest usable record's
   position and velocity, turned into elements, and how long Rubin has been following it.
   Null when no record carries a position. */
export function rubinState(rows) {
    const usable = rows.filter((row) => ['r:helio_x', 'r:helio_y', 'r:helio_z', 'r:helio_vx', 'r:helio_vy', 'r:helio_vz', 'r:midpointMjdTai']
        .every((k) => Number.isFinite(row[k])));
    if (!usable.length) return null;
    const times = usable.map((row) => row['r:midpointMjdTai']);
    const latest = usable[times.indexOf(Math.max(...times))];
    const jd = latest['r:midpointMjdTai'] + 2400000.5;
    const position = equatorialToEcliptic([latest['r:helio_x'], latest['r:helio_y'], latest['r:helio_z']]);
    const velocity = equatorialToEcliptic([latest['r:helio_vx'], latest['r:helio_vy'], latest['r:helio_vz']]).map((v) => v * KM_S_TO_AU_PER_DAY);
    return {
        elements: elementsFromState(position, velocity, jd),
        firstJd: Math.min(...times) + 2400000.5,
        lastJd: jd,
        arcDays: Math.max(...times) - Math.min(...times),
    };
}
