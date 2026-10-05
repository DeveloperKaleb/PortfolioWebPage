/* Where the round moons are, for the Rubin tab's map (owner, 2026-10-05: each moon visible
 * once zoomed in far enough to tell it from its parent).
 *
 * Each moon (but Luna, Earth's) is a circle around its parent: radius, period, and the plane and
 * direction of motion, fitted once to JPL Horizons positions on 2026-10-05 and 2027-10-05
 * (heliocentric ecliptic J2000 axes, AU; tools/moon-orbits.mjs, which makes one request per
 * moon and was run once). The count of turns between those dates was settled with each
 * moon's known period. Checked against Horizons on 2026-04-05, a date the fit never saw: within
 * 1.2 degrees for most, 5-7 for Mimas (its slow resonance with Tethys) and Titan and Iapetus
 * (eccentric orbits a circle ignores). The error grows slowly over the years; rerun the tool
 * to refresh.
 *
 * Luna is too disturbed by the Sun for a fixed circle, so it uses the standard
 * low-precision lunar series (within 0.3 degrees of Horizons on all three dates), shifted from
 * the ecliptic of date to J2000.
 *
 * Pure: no network, no DOM. */

export const MOON_EPOCH = 2461318.5; // 2026-10-05

export const MOON_ORBITS = {
    Io: { parent: 'Jupiter', a: 0.00283028, period: 1.76914262, p: [-0.999097, 0.040506, -0.012835], q: [-0.040011, -0.998526, -0.036686] },
    Europa: { parent: 'Jupiter', a: 0.00447799, period: 3.55138339, p: [0.166334, -0.985717, -0.026366], q: [0.985863, 0.165693, 0.024902] },
    Ganymede: { parent: 'Jupiter', a: 0.00716257, period: 7.15451376, p: [-0.516698, -0.855221, -0.040242], q: [0.856043, -0.516854, -0.007241] },
    Callisto: { parent: 'Jupiter', a: 0.0125496, period: 16.6890003, p: [0.549066, -0.835568, -0.018781], q: [0.835671, 0.548494, 0.028426] },
    Mimas: { parent: 'Saturn', a: 0.00125738, period: 0.94244329, p: [-0.399501, 0.819875, -0.410127], q: [-0.914837, -0.327794, 0.235848] },
    Enceladus: { parent: 'Saturn', a: 0.00159515, period: 1.37021681, p: [-0.461416, -0.766752, 0.446303], q: [0.88306, -0.445372, 0.147811] },
    Tethys: { parent: 'Saturn', a: 0.00196993, period: 1.88780322, p: [0.886883, 0.377016, -0.267015], q: [-0.457109, 0.799919, -0.388819] },
    Dione: { parent: 'Saturn', a: 0.00252718, period: 2.73691685, p: [0.560097, -0.754945, 0.3411], q: [0.824031, 0.465347, -0.323147] },
    Rhea: { parent: 'Saturn', a: 0.00351961, period: 4.51752401, p: [0.990511, -0.135847, -0.020841], q: [0.109919, 0.874059, -0.473222] },
    Titan: { parent: 'Saturn', a: 0.00830887, period: 15.9441635, p: [-0.45218, 0.810271, -0.37282], q: [-0.887568, -0.367502, 0.277786] },
    Iapetus: { parent: 'Saturn', a: 0.023728, period: 79.0631488, p: [0.287048, -0.944542, 0.159513], q: [0.938456, 0.243895, -0.244572] },
    Miranda: { parent: 'Uranus', a: 0.000867792, period: 1.41346719, p: [0.784133, -0.148117, 0.602658], q: [0.550565, -0.282095, -0.785685] },
    Ariel: { parent: 'Uranus', a: 0.00127641, period: 2.52037859, p: [0.545197, -0.002918, 0.838303], q: [0.811143, -0.250668, -0.528406] },
    Umbriel: { parent: 'Uranus', a: 0.00177328, period: 4.14416792, p: [-0.915201, 0.243626, 0.32102], q: [0.343546, 0.05522, 0.937511] },
    Titania: { parent: 'Uranus', a: 0.00292075, period: 8.70585099, p: [0.811017, -0.097164, 0.576897], q: [0.545247, -0.231857, -0.805573] },
    Oberon: { parent: 'Uranus', a: 0.00390823, period: 13.4632693, p: [-0.826024, 0.101173, -0.554481], q: [-0.522705, 0.230535, 0.820751] },
    Triton: { parent: 'Neptune', a: 0.00237112, period: 5.87684086, p: [-0.322208, 0.553389, 0.768077], q: [0.785955, 0.608635, -0.108806] },
    Charon: { parent: 'Pluto', a: 0.000131008, period: 6.38722503, p: [-0.734308, -0.597771, 0.321656], q: [-0.031884, 0.503697, 0.863292] },
};

const DEG = Math.PI / 180;
const AU_KM = 149597870.7;

/* Luna (the Moon) from Earth: ecliptic J2000, AU. */
export function lunarOffset(jd) {
    const d = jd - 2451545.0;
    const L = 218.316 + 13.176396 * d;
    const Mm = 134.963 + 13.064993 * d;
    const F = 93.272 + 13.229350 * d;
    const D = 297.850 + 12.190749 * d;
    const Ms = 357.529 + 0.98560028 * d;
    const lon = L + 6.289 * Math.sin(Mm * DEG) + 1.274 * Math.sin((2 * D - Mm) * DEG) + 0.658 * Math.sin(2 * D * DEG)
        - 0.186 * Math.sin(Ms * DEG) - 0.0139696 * (d / 365.25); // the last term: precession back to J2000
    const lat = 5.128 * Math.sin(F * DEG);
    const r = (385001 - 20905 * Math.cos(Mm * DEG)) / AU_KM;
    return [r * Math.cos(lat * DEG) * Math.cos(lon * DEG), r * Math.cos(lat * DEG) * Math.sin(lon * DEG), r * Math.sin(lat * DEG)];
}

/* A moon's offset from its parent on a Julian date: ecliptic J2000, AU. */
export function moonOffset(name, jd) {
    if (name === 'Luna') return lunarOffset(jd);
    const { a, period, p, q } = MOON_ORBITS[name];
    const t = (2 * Math.PI * (jd - MOON_EPOCH)) / period;
    const c = Math.cos(t), s = Math.sin(t);
    return [0, 1, 2].map((k) => a * (c * p[k] + s * q[k]));
}

/* Every moon's parent, its mean distance from it (AU), and its orbit as a ring of offsets
   for the map. */
export const MOON_PARENTS = { Luna: 'Earth', ...Object.fromEntries(Object.entries(MOON_ORBITS).map(([n, o]) => [n, o.parent])) };
export const moonDistance = (name) => (name === 'Luna' ? 385001 / AU_KM : MOON_ORBITS[name].a);

export function moonRing(name, jd, samples = 72) {
    const period = name === 'Luna' ? 27.321661 : MOON_ORBITS[name].period;
    return Array.from({ length: samples }, (_, k) => moonOffset(name, jd + (period * k) / samples));
}
