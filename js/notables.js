/* Notable objects on the galactic map (owner, 2026-11-19): famous names a reader might
 * wonder "where is that?" about, and examples that fill a gap in what the map teaches (a
 * neutron star, a cluster, a nebula). Each is marked before the pointer comes near, but
 * only once the place's galactic map reaches it (holdsNotable, js/starview.js), and each
 * is a place in "Go to".
 *
 * Most are too bright for Gaia to measure (it was built for faint stars), so they are not
 * in the tiles: their places come from the measurements cited, and where those disagree
 * the words say so. Positions are J2000 sky places (SIMBAD's; the Hyades' is its 515
 * members' mean, Babusiaux et al. 2018) and a distance in parsecs. Checked against the
 * catalogues on 2026-11-19: tools/simbadcheck/report.txt.
 * kind: 'star', 'neutronstar', 'blackhole', 'cluster' or 'nebula'; type: a spectral type
 * for stars ('NS', 'BH', 'CL', 'NEB' otherwise), which "Go to"'s symbol and filter read.
 */
import { GAIA_BH1, gaiaBh1Pc, GAIA_BH1_ROWS, GAIA_BH1_SYSTEM, BLOCK_PC, NEIGHBORHOOD_PC, LY_PER_PARSEC } from './starview.js';

export const NOTABLES = [
    {
        id: 'vega', name: 'Vega', kind: 'star', type: 'A0 V', ra: 279.23473, dec: 38.78369, pc: 7.68,
        where: 'in Lyra', source: 'Hipparcos (van Leeuwen 2007)',
        facts: [
            ['A white star about twice the Sun\'s mass,', 'spinning so fast it bulges at its middle'],
            ['The first star after the Sun to be photographed,', 'in 1850'],
        ],
    },
    {
        id: 'arcturus', name: 'Arcturus', kind: 'star', type: 'K1.5 III', ra: 213.91530, dec: 19.18241, pc: 11.26,
        where: 'in Boötes', source: 'Hipparcos (van Leeuwen 2007)',
        facts: [
            ['An orange giant:', 'a star like the Sun grown old, swollen to about 25 times its width'],
            ['The brightest star', 'in the northern half of the sky'],
        ],
    },
    {
        id: 'aldebaran', name: 'Aldebaran', kind: 'star', type: 'K5 III', ra: 68.98016, dec: 16.50930, pc: 20.43,
        where: 'in Taurus', source: 'Hipparcos (van Leeuwen 2007)',
        facts: [
            ['An orange giant', 'about 45 times the Sun\'s width'],
            ['The eye of Taurus.', 'It lies in front of the Hyades, not among them: less than half as far'],
        ],
    },
    {
        id: 'hyades', name: 'Hyades', kind: 'cluster', type: 'CL', ra: 67.689, dec: 16.845, pc: 47.5,
        where: 'in Taurus', source: 'Gaia DR2 (Gaia Collaboration, Babusiaux et al. 2018)',
        facts: [
            ['The nearest star cluster:', 'hundreds of stars born together, about 650 million years ago'],
            ['The V of the bull\'s face', 'in Taurus'],
        ],
    },
    {
        id: 'rxj1856', name: 'RX J1856.5−3754', kind: 'neutronstar', type: 'NS', ra: 284.14917, dec: -37.91000, pc: 123,
        where: 'in Corona Australis', source: 'Walter et al. 2010',
        facts: [
            ['A neutron star:', 'the collapsed core of a star that exploded, about 25 km across'],
            ['One of the nearest neutron stars known,', 'glowing in X-rays with its own heat'],
        ],
    },
    {
        id: 'polaris', name: 'Polaris', kind: 'star', type: 'F7 Ib', ra: 37.95456, dec: 89.26411, pc: 133,
        where: 'in Ursa Minor', source: 'Hipparcos (van Leeuwen 2007); 447 by its companion (Bond et al. 2018)',
        farWords: 'About 430 to 450 light years',
        facts: [
            ['The North Star: a yellow supergiant', 'that swells and shrinks every 4 days'],
            ['Almost straight above Earth\'s north pole,', 'so the night sky seems to turn about it'],
        ],
    },
    {
        id: 'pleiades', name: 'Pleiades', kind: 'cluster', type: 'CL', ra: 56.85, dec: 24.1167, pc: 136,
        where: 'in Taurus', source: 'Gaia DR2 (Gaia Collaboration, Babusiaux et al. 2018)',
        facts: [
            ['The Seven Sisters:', 'over a thousand stars born together, about 100 million years ago'],
            ['The best-known star cluster;', 'six or seven of its stars can be seen by eye'],
        ],
    },
    {
        id: 'betelgeuse', name: 'Betelgeuse', kind: 'star', type: 'M2 Iab', ra: 88.79294, dec: 7.40706, pc: 168,
        where: 'in Orion', source: 'its pulsations, 550 ly (Joyce et al. 2020); Hipparcos alone, 500 (van Leeuwen 2007); radio and Hipparcos together, 720 (Harper et al. 2017)',
        farWords: 'About 500 to 720 light years',
        facts: [
            ['A red supergiant: in the Sun\'s place', 'it would swallow the orbits of Mercury, Venus, Earth and Mars'],
            ['Expected to explode as a supernova,', 'though perhaps not for 100,000 years'],
            ['Why so unsure how far:', 'too bright for Gaia, and wider than the shift a parallax measures, with a boiling surface that moves its centre of light'],
            ['A faint companion was reported in 2025;', 'once its orbit is measured, it may settle the distance'],
        ],
    },
    {
        id: 'antares', name: 'Antares', kind: 'star', type: 'M1.5 Iab', ra: 247.35192, dec: -26.43200, pc: 170,
        where: 'in Scorpius', source: 'Hipparcos (van Leeuwen 2007)',
        farWords: 'About 550 light years',
        facts: [
            ['A red supergiant', 'about 700 times the Sun\'s width'],
            ['Its name means "rival of Mars",', 'for its colour'],
        ],
    },
    {
        id: 'rigel', name: 'Rigel', kind: 'star', type: 'B8 Ia', ra: 78.63447, dec: -8.20164, pc: 265,
        where: 'in Orion', source: 'Hipparcos (van Leeuwen 2007)',
        farWords: 'About 860 light years',
        facts: [
            ['A blue supergiant', 'giving off about 120,000 times the Sun\'s light'],
            ['Orion\'s brightest star,', 'at the corner opposite Betelgeuse'],
        ],
    },
    {
        id: 'velapulsar', name: 'Vela pulsar', kind: 'neutronstar', type: 'NS', ra: 128.83588, dec: -45.17635, pc: 287,
        where: 'in Vela', source: 'its parallax by radio (Dodson et al. 2003)',
        facts: [
            ['A neutron star spinning 11 times a second,', 'sweeping a beam of radio across Earth with each turn'],
            ['Left by a supernova', 'about 11,000 years ago'],
        ],
    },
    {
        id: 'orionnebula', name: 'Orion Nebula', kind: 'nebula', type: 'NEB', ra: 83.82208, dec: -5.39111, pc: 414,
        where: 'in Orion', source: 'its stars\' parallaxes by radio (Menten et al. 2007)',
        facts: [
            ['A cloud of gas where stars are being born,', 'lit by young, hot stars at its heart'],
            ['Seen by eye as the middle "star"', 'of Orion\'s sword'],
        ],
    },
    {
        id: 'deneb', name: 'Deneb', kind: 'star', type: 'A2 Ia', ra: 310.35798, dec: 45.28034, pc: 802,
        where: 'in Cygnus', source: 'its spectrum, 2,600 ly (Schiller & Przybilla 2008); Hipparcos, 1,400 (van Leeuwen 2007); other estimates run to 3,200',
        farWords: 'About 1,400 to 2,600 light years',
        facts: [
            ['A white supergiant,', 'one of the most luminous stars known'],
            ['If it is as far as thought,', 'it gives off nearly 200,000 times the Sun\'s light'],
        ],
    },
];

/* How far, in words: three figures, or a range where the measurements disagree. */
const lightYears = (pc) => Number((pc * LY_PER_PARSEC).toPrecision(3)).toLocaleString('en-US');
const KIND_WORDS = { star: 'a star', neutronstar: 'a neutron star', blackhole: 'a black hole', cluster: 'a star cluster', nebula: 'a nebula' };

/* Every notable, ready for the map and "Go to": its distance, the place (rung) whose map
   first holds it, its hover rows, and its row in "Go to". Gaia BH1 is one of them. */
export const NOTABLE_LIST = [
    ...NOTABLES.map((n) => {
        const far = n.farWords ?? `About ${lightYears(n.pc)} light years`;
        return {
            ...n,
            rungPc: n.pc <= BLOCK_PC ? BLOCK_PC : NEIGHBORHOOD_PC,
            rows: [
                [n.name, KIND_WORDS[n.kind]],
                [far, `from the Sun, ${n.where}`],
                ...n.facts,
                ['How far:', `from ${n.source}`],
            ],
            system: {
                id: n.id, name: n.name, confirmedPlanets: 0,
                farText: n.farWords ? `~${n.farWords.replace(/^About /, '').replace(/ light years$/, '')} ly` : `${lightYears(n.pc)} ly`,
                typeText: `${n.name}: ${KIND_WORDS[n.kind]}, ${n.where}`,
                members: [{ key: `body:${n.id}`, name: n.name, type: n.type }],
            },
        };
    }),
    {
        id: 'gaiabh1', name: GAIA_BH1.name, kind: 'blackhole', type: 'BH', ra: GAIA_BH1.ra, dec: GAIA_BH1.dec, pc: gaiaBh1Pc(),
        rungPc: NEIGHBORHOOD_PC, rows: GAIA_BH1_ROWS, system: GAIA_BH1_SYSTEM,
    },
].sort((a, b) => a.pc - b.pc);

/* A notable's own view in "Go to": about it, wide enough to hold the Sun too where it is
   near (so Vega is seen beside us), up to 100 parsecs about the far ones. */
export const notableViewPc = (pc) => Math.min(100, Math.max(15, pc * 0.4));
