/* The planets, where they actually are on a date: for the Rubin tab's map.
 *
 * JPL's "Approximate Positions of the Planets" (E. M. Standish), Table 1: Keplerian
 * elements and their rates per century, mean ecliptic and equinox of J2000, valid 1800 AD
 * to 2050 AD - comfortably the length of the Rubin survey.
 * https://ssd.jpl.nasa.gov/planets/approx_pos.html
 *
 * Accurate to well under a degree in this era, which on a map spanning a hundred AU is far
 * below a pixel (checked against JPL Horizons in tests/rubin). Pure: no DOM.
 */
import { positionAt } from './orbit.js';

/* a (AU), e, I, L, long. perihelion, long. node (degrees), then each one's rate per
   Julian century from J2000. Earth is the Earth-Moon barycentre, as in the table. */
export const PLANET_ELEMENTS = {
    Mercury: [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
    Venus: [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255], [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
    Earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
    Mars: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
    Jupiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
    Saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
    Uranus: [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503], [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
    Neptune: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
};

export const VALID_UNTIL_JD = 2469807.5; // 2050 January 1

/* The planet's elements on a Julian date, in the form js/orbit.js takes (the mean
   anomaly given at that date, so the epoch is the date itself). */
export function planetElements(name, jd) {
    const [base, rate] = PLANET_ELEMENTS[name];
    const T = (jd - 2451545.0) / 36525;
    const [a, e, I, L, peri, node] = base.map((v, k) => v + rate[k] * T);
    return { a, e, i: I, om: node, w: peri - node, ma: L - peri, epoch: jd };
}

/* Where every planet is on a date (heliocentric ecliptic J2000, AU), and its orbit as a
   closed path for drawing, sampled evenly in mean anomaly. */
export function planetsOn(jd, { samples = 120 } = {}) {
    return Object.keys(PLANET_ELEMENTS).map((name) => {
        const el = planetElements(name, jd);
        const at = positionAt(el, jd);
        const period = 365.25 * el.a ** 1.5;
        const path = Array.from({ length: samples }, (_, k) => {
            const p = positionAt(el, jd + (period * k) / samples);
            return { x: p.x, y: p.y };
        });
        return { name, a: el.a, x: at.x, y: at.y, z: at.z, r: at.r, path };
    });
}
