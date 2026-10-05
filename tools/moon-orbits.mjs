/* Refits the round moons' orbits in js/moons.js from JPL Horizons.
 *
 *   npm run moons -- [YYYY-MM-DD]     (the epoch; default today)
 *
 * One request per moon (18), five seconds apart: each moon's position and velocity from its
 * parent at the epoch, a year later, and half a year before (the last only to check the fit).
 * Prints the MOON_ORBITS table to paste into js/moons.js, and each moon's error on the check
 * date. Run by hand, rarely - the fit stays within a few degrees for years. The Moon is not
 * fitted: js/moons.js uses the lunar series for it. See NOTES.md.
 */
import { jdFromDate } from '../js/orbit.js';
import { MOON_ORBITS } from '../js/moons.js';

const IDS = {
    Io: [501, 599], Europa: [502, 599], Ganymede: [503, 599], Callisto: [504, 599],
    Mimas: [601, 699], Enceladus: [602, 699], Tethys: [603, 699], Dione: [604, 699], Rhea: [605, 699], Titan: [606, 699], Iapetus: [608, 699],
    Miranda: [705, 799], Ariel: [701, 799], Umbriel: [702, 799], Titania: [703, 799], Oberon: [704, 799],
    Triton: [801, 899], Charon: [901, 999],
};

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a, k) => a.map((x) => x * k);
const minus = (a, b) => a.map((x, i) => x - b[i]);
const unit = (a) => scale(a, 1 / Math.hypot(...a));
const angle = (a, b) => (Math.acos(Math.min(1, dot(unit(a), unit(b)))) * 180) / Math.PI;

const epoch = jdFromDate(new Date(`${process.argv[2] ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`));
const times = [epoch - 183, epoch, epoch + 365];

async function vectors(id, center) {
    const query = new URLSearchParams({
        format: 'json', COMMAND: `'${id}'`, OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS',
        CENTER: `'500@${center}'`, TLIST: times.map((t) => `'${t}'`).join(' '), TLIST_TYPE: 'JD',
        REF_PLANE: 'ECLIPTIC', REF_SYSTEM: 'J2000', OUT_UNITS: 'AU-D', VEC_TABLE: '2', CSV_FORMAT: 'YES', VEC_LABELS: 'NO',
    });
    const response = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${query}`, {
        headers: { 'User-Agent': 'moon orbit refit (by hand, rarely), github.com/DeveloperKaleb/PortfolioWebPage' },
    });
    const { result } = await response.json();
    return result.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n').map((line) => {
        const c = line.split(',').map((s) => Number(s.trim()));
        return { r: [c[2], c[3], c[4]], v: [c[5], c[6], c[7]] };
    });
}

const lines = [];
for (const [name, [id, center]] of Object.entries(IDS)) {
    const [check, now, later] = await vectors(id, center);
    const p = unit(now.r);
    const q = unit(minus(now.v, scale(p, dot(now.v, p))));
    const a = Math.hypot(...now.r);
    let swept = Math.atan2(dot(later.r, q), dot(later.r, p));
    if (swept < 0) swept += 2 * Math.PI;
    /* Whole turns in the year, from the period already known; the fit supplies the rest. */
    const turns = Math.round(365 / MOON_ORBITS[name].period - swept / (2 * Math.PI));
    const period = (365 * 2 * Math.PI) / (2 * Math.PI * turns + swept);
    const t = (-183 * 2 * Math.PI) / period;
    const predicted = p.map((x, k) => a * (Math.cos(t) * x + Math.sin(t) * q[k]));
    const round = (x) => +x.toFixed(6);
    lines.push(`    ${name}: { parent: '${MOON_ORBITS[name].parent}', a: ${+a.toPrecision(6)}, period: ${+period.toPrecision(9)}, p: [${p.map(round).join(', ')}], q: [${q.map(round).join(', ')}] },`);
    console.error(`${name}: ${angle(predicted, check.r).toFixed(2)} degrees off on the check date`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
}
console.log(`export const MOON_EPOCH = ${epoch};\n\nexport const MOON_ORBITS = {\n${lines.join('\n')}\n};`);
