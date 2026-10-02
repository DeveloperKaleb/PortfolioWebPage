/* How large an icy body has to be to have been shaped by its own gravity - the core of
 * the Rubin tab's filter, which looks for outer Solar System objects with at least an 80%
 * chance of it.
 *
 * No published curve gives that chance against size, so one is fitted here to bodies
 * whose state is known. "Shaped by its own gravity" is the project owner's chosen sense
 * of hydrostatic equilibrium: gravity rounded the body at some point, even if its shape
 * has since frozen. Moons that kept a bulge from a faster spin (Iapetus, Mimas) count,
 * because what froze them was tidal history, which a distant body on its own does not
 * have. The strict sense - in equilibrium today - was rejected: only a handful of bodies
 * are confirmed, and it would put the cutoff near Pluto's size. See NOTES.md.
 *
 * Pure, like the game modules: data and maths, no network, no DOM.
 */

/* The calibration list.
 *
 * Every label comes from evidence about the body's shape or interior, never from its
 * size: labelling by size would make the fit circular. A body with no shape evidence is
 * "uncertain" however large it is (Gonggong, Sedna), and uncertain bodies are kept in
 * the list, with the reasons, but left out of the fit.
 *
 * Moon diameters are twice the mean radii in JPL's satellite physical parameters table.
 * Dwarf planet and TNO diameters are those compiled in Wikipedia's list of possible dwarf
 * planets, cross-checked against the primary paper named where there is one. The citations
 * are for checking, not decoration: verify before relying on any single label. */
const JPL_SATS = 'https://ssd.jpl.nasa.gov/sats/phys_par/';
const WIKI_ROUNDED = 'https://en.wikipedia.org/wiki/List_of_gravitationally_rounded_objects_of_the_Solar_System';
const WIKI_DWARFS = 'https://en.wikipedia.org/wiki/List_of_possible_dwarf_planets';
const THOMAS_2010 = 'Thomas (2010), Sizes, shapes, and derived properties of the saturnian satellites after the Cassini nominal mission, Icarus 208';
const THOMAS_1988 = 'Thomas (1988), Radii, shapes, and topography of the satellites of Uranus from limb coordinates, Icarus 73';
const KARKOSCHKA_2003 = 'Karkoschka (2003), Sizes, shapes, and albedos of the inner satellites of Neptune, Icarus 162';

export const SHAPED = { YES: 'yes', NO: 'no', UNCERTAIN: 'uncertain' };

export const CALIBRATION = [
    // Moons: shapes measured from spacecraft imaging.
    { name: 'Ganymede', diameterKm: 5262.4, shaped: 'yes', population: 'moon', basis: 'Round; generally held to be in equilibrium today.', sources: [JPL_SATS, WIKI_ROUNDED] },
    { name: 'Titan', diameterKm: 5149.5, shaped: 'yes', population: 'moon', basis: 'Round. Whether it is in equilibrium today is uncertain, but it was shaped by its gravity.', sources: [JPL_SATS, WIKI_ROUNDED] },
    { name: 'Callisto', diameterKm: 4820.6, shaped: 'yes', population: 'moon', basis: 'Round. Equilibrium today uncertain (partly differentiated); shaped by its gravity.', sources: [JPL_SATS, WIKI_ROUNDED] },
    { name: 'Europa', diameterKm: 3121.6, shaped: 'yes', population: 'moon', basis: 'Round; generally held to be in equilibrium today.', sources: [JPL_SATS, WIKI_ROUNDED] },
    { name: 'Triton', diameterKm: 2705.2, shaped: 'yes', population: 'moon', basis: 'Round; generally held to be in equilibrium today. Likely a captured Kuiper belt object.', sources: [JPL_SATS, WIKI_ROUNDED] },
    { name: 'Titania', diameterKm: 1577.8, shaped: 'yes', population: 'moon', basis: 'Round from Voyager 2 limb fits.', sources: [JPL_SATS, THOMAS_1988] },
    { name: 'Rhea', diameterKm: 1527.0, shaped: 'yes', population: 'moon', basis: 'Round. Equilibrium today uncertain (gravity data disagree); shaped by its gravity.', sources: [JPL_SATS, THOMAS_2010] },
    { name: 'Oberon', diameterKm: 1522.8, shaped: 'yes', population: 'moon', basis: 'Round from Voyager 2 limb fits.', sources: [JPL_SATS, THOMAS_1988] },
    { name: 'Iapetus', diameterKm: 1468.6, shaped: 'yes', population: 'moon', basis: 'Round with a fossil bulge from a faster early spin: once in equilibrium, frozen since.', sources: [JPL_SATS, THOMAS_2010] },
    { name: 'Charon', diameterKm: 1212.0, shaped: 'yes', population: 'moon', basis: 'Round in New Horizons imaging.', sources: [JPL_SATS, WIKI_ROUNDED] },
    { name: 'Umbriel', diameterKm: 1169.4, shaped: 'yes', population: 'moon', basis: 'Round from Voyager 2 limb fits.', sources: [JPL_SATS, THOMAS_1988] },
    { name: 'Ariel', diameterKm: 1157.8, shaped: 'yes', population: 'moon', basis: 'Round from Voyager 2 limb fits.', sources: [JPL_SATS, THOMAS_1988] },
    { name: 'Dione', diameterKm: 1122.8, shaped: 'yes', population: 'moon', basis: 'Round; once in equilibrium, no longer exactly.', sources: [JPL_SATS, THOMAS_2010] },
    { name: 'Tethys', diameterKm: 1062.2, shaped: 'yes', population: 'moon', basis: 'Round; once in equilibrium, no longer exactly.', sources: [JPL_SATS, THOMAS_2010] },
    { name: 'Enceladus', diameterKm: 504.2, shaped: 'yes', population: 'moon', basis: 'Ellipsoidal; once in equilibrium, no longer exactly. Tidally heated.', sources: [JPL_SATS, THOMAS_2010] },
    { name: 'Miranda', diameterKm: 471.6, shaped: 'yes', population: 'moon', basis: 'Ellipsoidal with large relief; not in equilibrium today, but rounded.', sources: [JPL_SATS, THOMAS_1988] },
    { name: 'Mimas', diameterKm: 396.4, shaped: 'yes', population: 'moon', basis: 'Ellipsoidal; once in equilibrium, no longer exactly. The smallest rounded body known.', sources: [JPL_SATS, THOMAS_2010] },
    { name: 'Proteus', diameterKm: 416.0, shaped: 'no', population: 'moon', basis: 'Irregular (polyhedral) in Voyager 2 imaging: the largest body known not to be rounded.', sources: [JPL_SATS, KARKOSCHKA_2003] },
    { name: 'Hyperion', diameterKm: 270.0, shaped: 'no', population: 'moon', basis: 'Irregular and highly porous.', sources: [JPL_SATS, THOMAS_2010] },
    { name: 'Phoebe', diameterKm: 213.0, shaped: 'uncertain', population: 'moon', basis: 'Nearly round but not in equilibrium; may have relaxed early when warm, or never.', sources: [JPL_SATS, THOMAS_2010] },
    { name: 'Larissa', diameterKm: 192.0, shaped: 'no', population: 'moon', basis: 'Irregular in Voyager 2 imaging.', sources: [JPL_SATS, KARKOSCHKA_2003] },
    { name: 'Janus', diameterKm: 178.4, shaped: 'no', population: 'moon', basis: 'Irregular in Cassini imaging.', sources: [JPL_SATS, THOMAS_2010] },
    { name: 'Amalthea', diameterKm: 167.0, shaped: 'no', population: 'moon', basis: 'Irregular and porous.', sources: [JPL_SATS, WIKI_ROUNDED] },
    { name: 'Epimetheus', diameterKm: 116.4, shaped: 'no', population: 'moon', basis: 'Irregular in Cassini imaging.', sources: [JPL_SATS, THOMAS_2010] },

    // The asteroid belt's one icy-rich rounded body.
    { name: 'Ceres', diameterKm: 939.4, shaped: 'yes', population: 'belt', basis: 'Close to equilibrium in Dawn imaging and gravity, with small deviations. About a quarter water.', sources: [WIKI_DWARFS, 'Park et al. (2016), A partially differentiated interior for (1) Ceres deduced from its gravity field and shape, Nature 537'] },

    // Trans-Neptunian objects. Shapes only where an occultation or flyby measured one.
    { name: 'Pluto', diameterKm: 2377, shaped: 'yes', population: 'tno', basis: 'Round in New Horizons imaging; confirmed in equilibrium.', sources: [WIKI_DWARFS, 'Nimmo et al. (2017), Mean radius and shape of Pluto and Charon from New Horizons images, Icarus 287'] },
    { name: 'Eris', diameterKm: 2326, shaped: 'yes', population: 'tno', basis: 'Round to within errors in a stellar occultation.', sources: [WIKI_DWARFS, 'Sicardy et al. (2011), A Pluto-like radius and a high albedo for the dwarf planet Eris from an occultation, Nature 478'] },
    { name: 'Haumea', diameterKm: 1544, shaped: 'yes', population: 'tno', basis: 'Triaxial ellipsoid set by its fast spin, from occultation; whether exactly in equilibrium is debated, but gravity shaped it.', sources: [WIKI_DWARFS, 'Ortiz et al. (2017), The size, shape, density and ring of the dwarf planet Haumea from a stellar occultation, Nature 550'] },
    { name: 'Makemake', diameterKm: 1430, shaped: 'yes', population: 'tno', basis: 'Close to round in a stellar occultation.', sources: [WIKI_DWARFS, 'Ortiz et al. (2012), Albedo and atmospheric constraints of dwarf planet Makemake from a stellar occultation, Nature 491'] },
    { name: 'Quaoar', diameterKm: 1098, shaped: 'yes', population: 'tno', basis: 'Ellipsoidal from occultations, but not the ellipsoid its current spin would give: a frozen shape, so shaped by gravity in the chosen sense.', sources: [WIKI_DWARFS] },
    { name: 'Gonggong', diameterKm: 1230, shaped: 'uncertain', population: 'tno', basis: 'No shape measurement; size from thermal emission.', sources: [WIKI_DWARFS] },
    { name: 'Sedna', diameterKm: 906, shaped: 'uncertain', population: 'tno', basis: 'No shape measurement; size poorly known (thermal 906, occultation chord about 1025).', sources: [WIKI_DWARFS] },
    { name: 'Orcus', diameterKm: 910, shaped: 'uncertain', population: 'tno', basis: 'No shape measurement; density 1.4 is ambiguous.', sources: [WIKI_DWARFS] },
    { name: 'Salacia', diameterKm: 838, shaped: 'uncertain', grundy: 'no', population: 'tno', basis: 'No shape measurement; density 1.5 suggests incomplete compaction to some authors.', sources: [WIKI_DWARFS] },
    { name: 'Máni (2002 MS4)', diameterKm: 796, shaped: 'uncertain', population: 'tno', basis: 'Occultation limb shows large relief; whether it is relaxed is unclear.', sources: [WIKI_DWARFS] },
    { name: 'Varda', diameterKm: 740, shaped: 'uncertain', grundy: 'no', population: 'tno', basis: 'Density estimates disagree (1.23 to 1.78); Grundy et al. argue against equilibrium.', sources: [WIKI_DWARFS] },
    { name: 'Uni (2002 UX25)', diameterKm: 659, shaped: 'uncertain', grundy: 'no', population: 'tno', basis: 'Density 0.82, below water ice: porous and uncompacted per Grundy et al. (2019), but low rock fraction with at most ~20% porosity per Brown (2013).', sources: [WIKI_DWARFS, 'Brown (2013), The density of mid-sized Kuiper belt object 2002 UX25 and the formation of the dwarf planets, ApJL 778 (arXiv:1311.0553)'] },
    { name: 'Varuna', diameterKm: 654, shaped: 'uncertain', grundy: 'no', population: 'tno', basis: 'Elongated by fast spin; density about 1.0 derived assuming equilibrium, so it cannot settle the question.', sources: [WIKI_DWARFS] },
    { name: 'Gǃkúnǁʼhòmdímà', diameterKm: 634, shaped: 'uncertain', grundy: 'no', population: 'tno', basis: 'Density about 1.04; argued never to have compacted its porosity, so not shaped by gravity, but the reading is contested.', sources: [WIKI_DWARFS, 'Grundy et al. (2019), The mutual orbit, mass, and density of transneptunian binary Gǃkúnǁʼhòmdímà (229762 2007 UK126), Icarus 334'] },
];

/* Two readings of the list, and the filter uses both (the project owner's choice).
 *
 * The evidence reading uses the labels as they are. Every distant object with a definite
 * label is over 1,000 km, so its cutoff comes entirely from icy moons. Grundy's reading
 * also counts the five low-density mid-sized TNOs tagged `grundy: 'no'` as never shaped
 * (never compacted), which roughly doubles the cutoff. Whether cold mid-sized TNOs behave
 * like icy moons is open, so the filter passes on the evidence reading and flags anything
 * that would fail Grundy's, so the digest shows what the dispute affects. */
export const READINGS = {
    evidence: (bodies) => bodies,
    grundy: (bodies) => bodies.map((b) => (b.grundy ? { ...b, shaped: b.grundy } : b)),
};

/* The filter's verdict on one diameter: the chance under each reading, whether it passes
   (evidence reading at or above the threshold), and whether that pass is disputed (it
   would fail under Grundy's reading). */
export function assessDiameter(diameterKm, { threshold = 0.8, bodies = CALIBRATION } = {}) {
    const evidence = chanceShaped(fitEquilibrium(READINGS.evidence(bodies)), diameterKm);
    const grundy = chanceShaped(fitEquilibrium(READINGS.grundy(bodies)), diameterKm);
    const passes = evidence >= threshold;
    return { evidence, grundy, passes, disputed: passes && grundy < threshold };
}

/* What the fit is checked against: published views, which are words or thresholds rather
   than probabilities. */
export const PUBLISHED_VIEWS = {
    /* Brown's dwarf planet list: diameter tiers, km. */
    brown: [
        { from: 900, label: 'nearly certain' },
        { from: 600, label: 'highly likely' },
        { from: 500, label: 'likely' },
        { from: 400, label: 'probably' },
        { from: 200, label: 'possibly' },
    ],
    /* Grundy et al. (2019): TNOs up to about 900-1000 km may never have compacted. */
    grundy: { from: 900, to: 1000 },
    /* The icy threshold assumed around the 2006 IAU definition. */
    iau2006: 400,
};

/* --- The fit ---------------------------------------------------------------------------
 *
 * Logistic regression on log10(diameter): P(shaped | D) = 1 / (1 + e^-(a + b log10 D)).
 * Fitted by Newton's method (iteratively reweighted least squares).
 *
 * The labels nearly separate by size: every irregular body is smaller than every rounded
 * one, except that Mimas (rounded, 396 km) is smaller than Proteus (irregular, 416 km).
 * That one overlap is what gives the slope a finite best value, so the full list needs no
 * help. A resampled list in the bootstrap can lose Mimas or Proteus, and on perfectly
 * separated data the best slope is infinite, so a ridge on the slope keeps those finite.
 *
 * It is kept negligible on purpose. A ridge is a claim that the transition is gradual,
 * and it moves the cutoff: at 0.01 the 80% diameter is 497 km, at 0.1 it is 598 km,
 * against 443 km from the data alone. Choosing it would be choosing the answer. At
 * 0.0001 it moves the full-list cutoff by 2 km. */
const RIDGE = 0.0001;

export function fitEquilibrium(bodies = CALIBRATION, { ridge = RIDGE } = {}) {
    const points = bodies
        .filter((b) => b.shaped === SHAPED.YES || b.shaped === SHAPED.NO)
        .map((b) => ({ x: Math.log10(b.diameterKm), y: b.shaped === SHAPED.YES ? 1 : 0 }));
    if (!points.some((p) => p.y === 1) || !points.some((p) => p.y === 0)) {
        throw new Error('the fit needs both rounded and irregular bodies');
    }

    let a = 0, b = 0;
    for (let iteration = 0; iteration < 100; iteration++) {
        let ga = 0, gb = -ridge * b;
        let haa = 0, hab = 0, hbb = ridge;
        for (const { x, y } of points) {
            const p = 1 / (1 + Math.exp(-(a + b * x)));
            const w = p * (1 - p);
            ga += y - p;
            gb += (y - p) * x;
            haa += w;
            hab += w * x;
            hbb += w * x * x;
        }
        const det = haa * hbb - hab * hab;
        const da = (hbb * ga - hab * gb) / det;
        const db = (haa * gb - hab * ga) / det;
        a += da;
        b += db;
        if (Math.abs(da) < 1e-10 && Math.abs(db) < 1e-10) break;
    }
    return { a, b, n: points.length };
}

/* The chance a body of this diameter was shaped by its own gravity, under a fit. */
export function chanceShaped(fit, diameterKm) {
    return 1 / (1 + Math.exp(-(fit.a + fit.b * Math.log10(diameterKm))));
}

/* The diameter at which the chance reaches p (0.8 for the Rubin filter). */
export function diameterAt(fit, p) {
    return 10 ** ((Math.log(p / (1 - p)) - fit.a) / fit.b);
}

export function mulberry32(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/* How firmly the data pins the cutoff: refit on resampled lists (with replacement, seeded
   so the answer is reproducible) and report the spread of the diameter at p. The list is
   small, so this is the honest error bar on the cutoff. */
export function bootstrapDiameterAt(p, { bodies = CALIBRATION, samples = 1000, seed = 1 } = {}) {
    const usable = bodies.filter((b) => b.shaped !== SHAPED.UNCERTAIN);
    const random = mulberry32(seed);
    const found = [];
    for (let s = 0; s < samples; s++) {
        const draw = Array.from({ length: usable.length }, () => usable[Math.floor(random() * usable.length)]);
        try {
            found.push(diameterAt(fitEquilibrium(draw), p));
        } catch {
            /* A draw with no rounded or no irregular bodies says nothing; skip it. */
        }
    }
    found.sort((x, y) => x - y);
    const at = (q) => found[Math.min(found.length - 1, Math.floor(q * found.length))];
    return { median: at(0.5), low: at(0.16), high: at(0.84), samples: found.length };
}
