/* Human spacecraft on the Solar System map (owner, 2026-11-19): every craft beyond Earth
 * orbit, working or not, and the satellites in Earth orbit as two counts.
 *
 * CRAFT below is kept by hand: each craft's name, whether it still works, and where it is.
 * A craft that flies free about the Sun (`horizons`) is placed from JPL Horizons, by
 * `npm run spacecraft` (tools/spacecraft/), which writes its track into
 * js/spacecrafttracks.js, never edited by hand. A craft that stays with a body (`at`) - in
 * orbit about Mars, the Moon or Jupiter, or looping about a point where the Sun's and
 * Earth's pulls balance (L1, L2) - is drawn at that body: its own orbit there is far too
 * small to see on this map.
 *
 * Statuses are as the owner and Claude know them on STATUS_AS_OF; `unsure` marks the ones
 * worth checking first. Craft that landed (rovers, landers, Rosetta on its comet) and craft
 * that were destroyed are left out: this is what is out there, flying. So are dead craft
 * whose last known track cannot be followed on as an orbit (WMAP and LISA Pathfinder, last
 * seen near L2 and L1; Mariner 2, last seen at its Venus flyby in 1962). Pure: no DOM.
 */
import { positionAt } from './orbit.js';
import { TRACKS, EARTH_ORBIT } from './spacecrafttracks.js';

export const STATUS_AS_OF = '2026-11-19';

/* The places a craft can stay with, as the map names them. L1 and L2 are 1.5 million km
   (0.01 AU) from Earth, toward the Sun and away from it. */
export const PLACE_WORDS = {
    Earth: 'in orbit about Earth',
    L1: 'near L1, 1.5 million km from Earth toward the Sun',
    L2: 'near L2, 1.5 million km from Earth away from the Sun',
    Luna: 'in orbit about the Moon',
    Venus: 'in orbit about Venus',
    Mars: 'in orbit about Mars',
    Jupiter: 'in orbit about Jupiter',
    Ceres: 'in orbit about Ceres',
};
export const LAGRANGE_AU = 0.01;

/* id, name, agency, launch year, active or not, where (horizons: the Horizons id; at: the
   place), and a line about it. */
const c = (id, name, agency, launched, active, where, blurb, extra = {}) => ({ id, name, agency, launched, active, ...where, blurb, ...extra });
const H = (horizons) => ({ horizons });
const AT = (at) => ({ at });

export const CRAFT = [
    /* ---- Working ---- */
    c('voyager1', 'Voyager 1', 'NASA', 1977, true, H(-31), 'The farthest human-made object; in interstellar space since 2012'),
    c('voyager2', 'Voyager 2', 'NASA', 1977, true, H(-32), 'The only craft to have visited Uranus and Neptune; in interstellar space since 2018'),
    c('newHorizons', 'New Horizons', 'NASA', 2006, true, H(-98), 'Flew past Pluto in 2015 and Arrokoth in 2019, and is still heading out'),
    c('parker', 'Parker Solar Probe', 'NASA', 2018, true, H(-96), "Dips through the Sun's outer atmosphere; the fastest object humans have made"),
    c('solarOrbiter', 'Solar Orbiter', 'ESA and NASA', 2020, true, H(-144), "Climbing out of the plane of Earth's orbit to see the Sun's poles"),
    c('stereoA', 'STEREO-A', 'NASA', 2006, true, H(-234), 'Watches the Sun from a little ahead of Earth in its orbit'),
    c('bepiColombo', 'BepiColombo', 'ESA and JAXA', 2018, true, H(-121), 'Two orbiters, one European and one Japanese, for Mercury'),
    c('juice', 'JUICE', 'ESA', 2023, true, H(-28), "On its way to Jupiter's icy moons, due in 2031"),
    c('europaClipper', 'Europa Clipper', 'NASA', 2024, true, H(-159), "On its way to Jupiter's moon Europa, due in 2030"),
    c('lucy', 'Lucy', 'NASA', 2021, true, H(-49), "Touring the Trojan asteroids, which share Jupiter's orbit"),
    c('psyche', 'Psyche', 'NASA', 2023, true, H(-255), 'Bound for the metal-rich asteroid Psyche, due in 2029'),
    c('osirisApex', 'OSIRIS-APEX', 'NASA', 2016, true, H(-64), 'Brought back pieces of asteroid Bennu in 2023 (as OSIRIS-REx); now bound for Apophis in 2029'),
    c('hayabusa2', 'Hayabusa2', 'JAXA', 2014, true, H(-37), 'Brought back pieces of asteroid Ryugu in 2020; now bound for asteroid 1998 KY26'),
    c('hera', 'Hera', 'ESA', 2024, true, H(-91), "Going to look at the asteroid NASA's DART struck in 2022"),
    c('escapadeBlue', 'ESCAPADE Blue', 'NASA', 2025, true, H(-9), 'One of a pair of small craft going to study Mars from orbit'),
    c('escapadeGold', 'ESCAPADE Gold', 'NASA', 2025, true, H(-10), 'One of a pair of small craft going to study Mars from orbit'),
    c('mmx', 'MMX', 'JAXA', 2026, true, H(-239), "Going to Mars's moon Phobos, to bring back a piece of it"),
    c('soho', 'SOHO', 'ESA and NASA', 1995, true, AT('L1'), 'Has watched the Sun without a break for three decades'),
    c('ace', 'ACE', 'NASA', 1997, true, AT('L1'), 'Samples the solar wind before it reaches Earth'),
    c('wind', 'Wind', 'NASA', 1994, true, AT('L1'), 'Measures the solar wind'),
    c('dscovr', 'DSCOVR', 'NOAA and NASA', 2015, true, AT('L1'), "Photographs the whole sunlit face of Earth"),
    c('adityaL1', 'Aditya-L1', 'ISRO', 2023, true, AT('L1'), "India's first mission to study the Sun"),
    c('imap', 'IMAP', 'NASA', 2025, true, AT('L1'), "Maps the edge of the Sun's bubble from inside it"),
    c('swfoL1', 'SWFO-L1', 'NOAA', 2025, true, AT('L1'), 'Gives warning of space weather'),
    c('carruthers', 'Carruthers', 'NASA', 2025, true, AT('L1'), "Photographs the faint glow of hydrogen round Earth"),
    c('jwst', 'James Webb Space Telescope', 'NASA, ESA and CSA', 2021, true, AT('L2'), 'The largest telescope in space'),
    c('euclid', 'Euclid', 'ESA', 2023, true, AT('L2'), 'Mapping the dark universe across a third of the sky'),
    c('roman', 'Nancy Grace Roman Space Telescope', 'NASA', 2026, true, AT('L2'), 'A wide-field telescope, launched in 2026'),
    c('spektrRG', 'Spektr-RG', 'Roscosmos and DLR', 2019, true, AT('L2'), 'An X-ray observatory; its Russian telescope still works', { unsure: true }),
    c('lro', 'Lunar Reconnaissance Orbiter', 'NASA', 2009, true, AT('Luna'), 'Has mapped the Moon in fine detail since 2009'),
    c('chandrayaan2', 'Chandrayaan-2 orbiter', 'ISRO', 2019, true, AT('Luna'), "India's Moon orbiter"),
    c('danuri', 'Danuri', 'KARI', 2022, true, AT('Luna'), "South Korea's first Moon orbiter"),
    c('artemisP1', 'ARTEMIS P1', 'NASA', 2007, true, AT('Luna'), 'Studies the Moon in the solar wind; first flown as THEMIS-B'),
    c('artemisP2', 'ARTEMIS P2', 'NASA', 2007, true, AT('Luna'), 'Studies the Moon in the solar wind; first flown as THEMIS-C'),
    c('mro', 'Mars Reconnaissance Orbiter', 'NASA', 2005, true, AT('Mars'), 'Its camera can make out a car on the ground'),
    c('marsExpress', 'Mars Express', 'ESA', 2003, true, AT('Mars'), "Europe's first craft at another planet"),
    c('tgo', 'ExoMars Trace Gas Orbiter', 'ESA and Roscosmos', 2016, true, AT('Mars'), "Sniffs Mars's air for gases"),
    c('odyssey', 'Mars Odyssey', 'NASA', 2001, true, AT('Mars'), 'The longest-working craft at Mars', { unsure: true }),
    c('tianwen1', 'Tianwen-1 orbiter', 'CNSA', 2020, true, AT('Mars'), "China's Mars orbiter, which carried the Zhurong rover"),
    c('hope', 'Hope', 'UAE Space Agency', 2020, true, AT('Mars'), "Watches Mars's weather"),
    c('juno', 'Juno', 'NASA', 2011, true, AT('Jupiter'), 'Has orbited Jupiter since 2016', { unsure: true }),

    /* ---- No longer working ---- */
    c('pioneer10', 'Pioneer 10', 'NASA', 1972, false, H(-23), 'The first craft to visit Jupiter; last heard from in 2003'),
    c('pioneer11', 'Pioneer 11', 'NASA', 1973, false, H(-24), 'The first craft to visit Saturn; last heard from in 1995'),
    c('stereoB', 'STEREO-B', 'NASA', 2006, false, H(-235), 'Lost in 2014'),
    c('ulysses', 'Ulysses', 'ESA and NASA', 1990, false, H(-55), "Flew over the Sun's poles; switched off in 2009"),
    c('kepler', 'Kepler', 'NASA', 2009, false, H(-227), 'Found thousands of planets round other stars; retired in 2018'),
    c('spitzer', 'Spitzer', 'NASA', 2003, false, H(-79), 'An infrared telescope; retired in 2020'),
    c('gaia', 'Gaia', 'ESA', 2013, false, H(-139479), 'Measured where nearly two billion stars are; retired in 2025'),
    c('herschel', 'Herschel', 'ESA', 2009, false, H(-486), 'An infrared telescope; retired in 2013'),
    c('planck', 'Planck', 'ESA', 2009, false, H(-489), "Mapped the universe's first light; retired in 2013"),
    c('stardust', 'Stardust', 'NASA', 1999, false, H(-29), 'Brought back dust from comet Wild 2; retired in 2011'),
    c('deepImpact', 'Deep Impact', 'NASA', 2005, false, H(-140), 'Struck comet Tempel 1 with an impactor in 2005; lost in 2013'),
    c('deepSpace1', 'Deep Space 1', 'NASA', 1998, false, H(-30), 'Tested an ion engine; retired in 2001'),
    c('ice', 'ICE (ISEE-3)', 'NASA', 1978, false, H(-111), 'The first craft to fly through a comet tail; silent since 2014'),
    c('pioneer6', 'Pioneer 6', 'NASA', 1965, false, H(-6), 'Studied the solar wind; last heard from in 2000'),
    c('pioneer8', 'Pioneer 8', 'NASA', 1967, false, H(-20), 'Studied the solar wind; switched off in 1996'),
    c('nozomi', 'Nozomi', 'ISAS', 1998, false, H(-178), "Japan's Mars craft; failed to reach orbit there in 2003"),
    c('marcoA', 'MarCO-A', 'NASA', 2018, false, H(-65), 'A tiny craft that relayed InSight landing on Mars in 2018'),
    c('marcoB', 'MarCO-B', 'NASA', 2018, false, H(-66), 'A tiny craft that relayed InSight landing on Mars in 2018'),
    c('licia', 'LICIACube', 'ASI', 2021, false, H(-210), "Photographed DART's strike on Dimorphos in 2022"),
    c('bioSentinel', 'BioSentinel', 'NASA', 2022, false, H(-70007), 'Carried yeast past the Moon to study deep-space radiation'),
    c('lunarFlashlight', 'Lunar Flashlight', 'NASA', 2022, false, H(-164), 'Meant to look for ice on the Moon; its engines failed'),
    c('lunarTrailblazer', 'Lunar Trailblazer', 'NASA', 2025, false, H(-242), 'Meant to map water on the Moon; lost soon after launch'),
    c('roadster', "Starman's Tesla Roadster", 'SpaceX', 2018, false, H(-143205), 'A car sent past Mars as a test load, with a dummy driver'),
    c('maven', 'MAVEN', 'NASA', 2013, false, AT('Mars'), 'Studied how Mars lost its air; contact lost in December 2025', { unsure: true }),
    c('mgs', 'Mars Global Surveyor', 'NASA', 1996, false, AT('Mars'), 'Mapped Mars for nine years; lost in 2006'),
    c('mom', 'Mangalyaan', 'ISRO', 2013, false, AT('Mars'), "India's first Mars orbiter; contact lost in 2022"),
    c('akatsuki', 'Akatsuki', 'JAXA', 2010, false, AT('Venus'), "Japan's Venus orbiter; contact lost in 2024"),
    c('dawn', 'Dawn', 'NASA', 2007, false, AT('Ceres'), 'Orbited Vesta, then Ceres; out of fuel in 2018'),
];

/* The satellites in Earth orbit, as two marks: working and not. */
export const EARTH_ITEMS = [
    { id: 'earthActive', name: 'Working satellites in Earth orbit', active: true, at: 'Earth', count: EARTH_ORBIT.active },
    { id: 'earthInactive', name: 'Dead satellites in Earth orbit', active: false, at: 'Earth', count: EARTH_ORBIT.inactive },
];

/* Every item of the tree, working first, as the menu lists them. */
export const ALL_ITEMS = [...CRAFT, ...EARTH_ITEMS];
export const itemsOf = (active) => [EARTH_ITEMS.find((e) => e.active === active), ...CRAFT.filter((s) => s.active === active)];

/* A group's box in the tree: all on, some, or none. */
export function groupState(items, on) {
    const n = items.filter((s) => on.has(s.id)).length;
    return n === 0 ? 'none' : n === items.length ? 'all' : 'some';
}

/* Which items were left on, from what this browser saved: known ids only. Off by default. */
export function readShown(saved) {
    const known = new Set(ALL_ITEMS.map((s) => s.id));
    return new Set(Array.isArray(saved) ? saved.filter((id) => typeof id === 'string' && known.has(id)) : []);
}

/* Where a free-flying craft is on a Julian date (heliocentric ecliptic J2000, AU), from its
   track; null where the track does not reach (before launch, or past the end of what was
   fetched, for a craft that still steers). An orbit (elements) holds at any date. */
export function trackPosition(track, jd) {
    if (!track) return null;
    if (track.elements) {
        if (jd < track.from) return null;
        const p = positionAt(track.elements, jd);
        return { x: p.x, y: p.y, z: p.z };
    }
    const { start, step, xyz } = track;
    const n = xyz.length / 3;
    const t = (jd - start) / step;
    if (t < 0 || t > n - 1) return null;
    /* Cubic through the four samples about the date (three at an end). */
    const k = Math.min(Math.max(Math.floor(t) - 1, 0), Math.max(0, n - 4));
    const m = Math.min(4, n - k);
    const out = [0, 0, 0];
    for (let a = 0; a < m; a++) {
        let w = 1;
        for (let b = 0; b < m; b++) if (b !== a) w *= (t - (k + b)) / ((k + a) - (k + b));
        for (let d = 0; d < 3; d++) out[d] += w * xyz[(k + a) * 3 + d];
    }
    return { x: out[0], y: out[1], z: out[2] };
}

/* A free-flying craft's path for drawing once picked: its orbit, or the track itself. */
export function trackPath(track, jd, { span = 730, steps = 120 } = {}) {
    if (!track) return null;
    const out = [];
    const from = track.elements ? Math.max(track.from, jd - span) : track.start;
    const to = track.elements ? jd + span : track.start + track.step * (track.xyz.length / 3 - 1);
    for (let k = 0; k <= steps; k++) {
        const p = trackPosition(track, from + ((to - from) * k) / steps);
        if (p) out.push(p);
    }
    return out.length > 1 ? out : null;
}

/* A free-flying craft's path by its id, or null for one that stays with a body. */
export const craftPath = (id, jd, tracks = TRACKS) => trackPath(tracks[id], jd);

/* Where each place is on the map's date, from the planets and moons the map already has. */
export function placesOn(planets, moons) {
    const out = {};
    for (const p of planets) out[p.name] = { x: p.x, y: p.y, z: p.z };
    const luna = moons.find((m) => m.name === 'Luna');
    if (luna) out.Luna = { x: luna.x, y: luna.y, z: luna.z };
    const earth = out.Earth;
    if (earth) {
        const r = Math.hypot(earth.x, earth.y, earth.z);
        const along = (k) => ({ x: earth.x * k, y: earth.y * k, z: earth.z * k });
        out.L1 = along(1 - LAGRANGE_AU / r);
        out.L2 = along(1 + LAGRANGE_AU / r);
    }
    return out;
}

/* Every item where it is on the date: { item, x, y, z, place, lastKnown } (the date of the
   orbit it is placed from, for a dead craft Horizons stopped following). One the date does not
   reach is left out, and listed in missing. */
export function craftOn(jd, planets, moons, tracks = TRACKS) {
    const where = placesOn(planets, moons);
    const shown = [], missing = [];
    for (const item of ALL_ITEMS) {
        const at = item.at ? where[item.at] : trackPosition(tracks[item.id], jd);
        if (at) shown.push({ item, ...at, place: item.at ?? null, lastKnown: item.at ? null : tracks[item.id]?.lastKnown ?? null });
        else missing.push(item);
    }
    return { shown, missing };
}

/* Marks closer than px on screen become one: each cluster's members, nearest to the
   first-placed first. Greedy, in the given order, so the order sets which mark leads. */
export function clusterMarks(points, px) {
    const clusters = [];
    for (const p of points) {
        const near = clusters.find((cl) => Math.hypot(cl.x - p.sx, cl.y - p.sy) < px);
        if (near) near.members.push(p);
        else clusters.push({ x: p.sx, y: p.sy, members: [p] });
    }
    return clusters;
}

/* A count as the map says it: "about 11,900". */
export const aboutCount = (n) => `about ${(Math.round(n / 100) * 100).toLocaleString('en-US')}`;
