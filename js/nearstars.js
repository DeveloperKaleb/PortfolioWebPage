/* Every other star system within 1,000,000 AU of the Sun (parallax over 206.265 mas),
 * for the Solar System tab's map: stage 3 of taking it out to a million AU (owner,
 * 2026-11-18; NOTES.md). Written once by a script from the sources below, read 2026-11-18,
 * and shipped as it is: the page asks no one for it. Alpha Centauri, Barnard's Star and
 * Luhman 16 stay in js/centauri.js, where they began.
 *
 * Pure data, in NEIGHBOURS's form (js/centauri.js), nearest first. Sources:
 *   - Places, drifts and parallaxes: Gaia DR3 where it has the star; Hipparcos (van
 *     Leeuwen 2007) for the bright ones it lacks; and, for EZ Aquarii and four tundrs too
 *     faint for Gaia, the published values named beside each. Each place's source is noted
 *     beside it. Pairs Gaia measures badly (Luyten 726-8, Wolf 424) share the mean of their
 *     two parallaxes; a wide companion shares its primary's.
 *   - Sirius and Procyon: their orbits from Bond et al. 2017 (ApJ 840, 70) and 2015 (ApJ
 *     813, 106), with those papers' parallaxes and masses. Sirius's centre of gravity is
 *     tied to Gaia's B in 2016 and Hipparcos's A in 1991, which fixes its drift; Procyon's
 *     to Hipparcos's A alone. As for Luhman 16, which node is which is assumed: if wrong,
 *     a pair is mirrored front to back by a few AU.
 *   - Planets: NASA Exoplanet Archive (pscomppars), sizes of orbit only; those it flags as
 *     disputed are drawn as candidates.
 *   - Spectral types: as usually given (RECONS, the Exoplanet Archive, the papers above).
 *     SIMBAD was unreachable on 2026-11-18, so they were not checked against it.
 *   - Sizes: measured (interferometry, or for white dwarfs their light and gravity) where
 *     the source says so; for red dwarfs, worked out from their infrared brightness (2MASS
 *     K, Mann et al. 2015's relation; how: 'brightness'); otherwise the size usual for the
 *     type ('typical'), a catalogue's adopted value ('catalogue'), or from models or light
 *     for tundrs. Each unmeasured size carries its range.
 *   - Close pairs and triples whose orbits are not in hand (groups) are one mark: their
 *     members are too close to tell apart at any zoom the map has a reason to reach.
 */

export const NEARSTARS = [
    {
        id: "wise0855",
        name: "WISE 0855-0714",
        sky: { ra: 133.795132, dec: -7.245146, epoch: 2000.0, pmRa: -8123.7, pmDec: 673.2, parallax: 439.0 } /* SIMBAD position via Wikipedia; drift and parallax Kirkpatrick et al. 2021 */,
        members: [
            { id: "wise0855", name: "WISE 0855-0714", type: "Y4", markPx: 3, size: { jupiters: 1.045, plusMinus: 0.072, how: "light" }, blurb: "The coldest known object outside the Solar System: about 3 degrees C" },
        ],
    },
    {
        id: "wolf359",
        name: "Wolf 359",
        sky: { ra: 164.103190308, dec: 7.002726941, epoch: 2016.0, pmRa: -3866.338275144, pmDec: -2699.214987679, parallax: 415.179415678 } /* Gaia DR3 3864972938605115520 */,
        members: [
            { id: "wolf359", name: "Wolf 359", type: "M6 V", markPx: 3, size: { suns: 0.136, plusMinus: 0.004, how: "brightness" }, blurb: "A small red dwarf that often flares" },
        ],
    },
    {
        id: "lalande21185",
        name: "Lalande 21185",
        sky: { ra: 165.830959676, dec: 35.948653033, epoch: 2016.0, pmRa: -580.057087214, pmDec: -4776.588719443, parallax: 392.752945439 } /* Gaia DR3 762815470562110464 */,
        members: [
            { id: "lalande21185", name: "Lalande 21185", type: "M2 V", markPx: 3.5, size: { suns: 0.411, plusMinus: 0.045, how: "brightness" }, blurb: "The brightest red dwarf in the northern sky, though too faint to see without a telescope" },
        ],
        planets: [{ star: "lalande21185", name: "Lalande 21185 b", a: 0.07879, status: "confirmed" }, { star: "lalande21185", name: "Lalande 21185 c", a: 2.94, status: "confirmed" }],
    },
    {
        id: "sirius",
        name: "Sirius",
        sky: { ra: 101.284634497, dec: -16.721408866, epoch: 2016.0, pmRa: -534.987605648, pmDec: -1249.783496643, parallax: 378.9 } /* centre of gravity from Gaia DR3 B (2016.0) and Hipparcos A (1991.25) on the orbit; parallax Bond et al. 2017 */,
        members: [
            { id: "siriusA", name: "Sirius A", type: "A1 V", markPx: 4.5, size: { suns: 1.7144 }, blurb: "The brightest star in our night sky" },
            { id: "siriusB", name: "Sirius B", type: "DA2", markPx: 2.5, size: { suns: 0.008098 }, blurb: "The nearest white dwarf: about Earth's size with about the Sun's mass" },
        ],
        pairs: [{ key: "sirius", name: "Sirius A and B", a: "siriusA", b: "siriusB", orbit: { period: 50.1284, periastron: 1994.5715, e: 0.59142, aAU: 19.7828, i: 136.336, node: 45.4, peri: 149.161, massA: 2.063, massB: 1.018 }, markPx: 4.5 }],
    },
    {
        id: "luyten7268",
        name: "Luyten 726-8",
        sky: { ra: 24.771674208, dec: -17.94768286, epoch: 2016.0, pmRa: 3178.694257575, pmDec: 584.061335039, parallax: 370.778104225 } /* Gaia DR3 5140693571158946048 */,
        members: [
            { id: "blCeti", name: "BL Ceti (Luyten 726-8 A)", type: "M5.5 V", markPx: 3, size: { suns: 0.15, plusMinus: 0.03, how: "typical" } },
            { id: "uvCeti", name: "UV Ceti (Luyten 726-8 B)", type: "M6 V", markPx: 3, size: { suns: 0.14, plusMinus: 0.03, how: "typical" }, blurb: "The flare star all flare stars of its kind are named after" },
        ],
        groups: [{ key: "luyten7268", name: "Luyten 726-8 A and B", members: ["blCeti", "uvCeti"], seenNear: 9, apartText: "about 5.5 AU apart on average, round each other every 26.3 years" }],
    },
    {
        id: "ross154",
        name: "Ross 154",
        sky: { ra: 282.458789018, dec: -23.837097449, epoch: 2016.0, pmRa: 639.367850336, pmDec: -193.957925071, parallax: 336.026601668 } /* Gaia DR3 4075141768785646848 */,
        members: [
            { id: "ross154", name: "Ross 154", type: "M3.5 Ve", markPx: 3, size: { suns: 0.211, plusMinus: 0.006, how: "brightness" } },
        ],
    },
    {
        id: "ross248",
        name: "Ross 248",
        sky: { ra: 355.480015258, dec: 44.170375701, epoch: 2016.0, pmRa: 112.527464934, pmDec: -1591.649761815, parallax: 316.481186782 } /* Gaia DR3 1926461164913660160 */,
        members: [
            { id: "ross248", name: "Ross 248", type: "M6 Ve", markPx: 3, size: { suns: 0.178, plusMinus: 0.005, how: "brightness" }, blurb: "Coming toward us: in about 36,000 years it will be the nearest star to the Sun" },
        ],
    },
    {
        id: "epsEri",
        name: "Epsilon Eridani",
        sky: { ra: 53.228293415, dec: -9.458168216, epoch: 2016.0, pmRa: -974.75814525, pmDec: 20.87584009, parallax: 310.577292801 } /* Gaia DR3 5164707970261890560 */,
        members: [
            { id: "epsEri", name: "Epsilon Eridani", type: "K2 V", markPx: 4, size: { suns: 0.735 }, blurb: "A young orange dwarf, ringed by dust" },
        ],
        planets: [{ star: "epsEri", name: "Epsilon Eridani b", a: 3.53, status: "confirmed" }],
    },
    {
        id: "lacaille9352",
        name: "Lacaille 9352",
        sky: { ra: 346.50391668, dec: -35.847164208, epoch: 2016.0, pmRa: 6765.995136251, pmDec: 1330.285274718, parallax: 304.1353692 } /* Gaia DR3 6553614253923452800 */,
        members: [
            { id: "lacaille9352", name: "Lacaille 9352", type: "M0.5 V", markPx: 3.5, size: { suns: 0.468, plusMinus: 0.02, how: "catalogue" } },
        ],
        planets: [{ star: "lacaille9352", name: "Lacaille 9352 e", a: 0.0417, status: "confirmed" }, { star: "lacaille9352", name: "Lacaille 9352 b", a: 0.0683, status: "confirmed" }, { star: "lacaille9352", name: "Lacaille 9352 c", a: 0.121, status: "confirmed" }, { star: "lacaille9352", name: "Lacaille 9352 d", a: 0.212, status: "confirmed" }],
    },
    {
        id: "ross128",
        name: "Ross 128",
        sky: { ra: 176.93768799, dec: 0.79911997, epoch: 2016.0, pmRa: 607.299076681, pmDec: -1223.028354888, parallax: 296.305307914 } /* Gaia DR3 3796072592206250624 */,
        members: [
            { id: "ross128", name: "Ross 128", type: "M4 V", markPx: 3, size: { suns: 0.21, plusMinus: 0.006, how: "brightness" }, blurb: "One of the quietest red dwarfs, seldom flaring" },
        ],
        planets: [{ star: "ross128", name: "Ross 128 b", a: 0.0496, status: "confirmed" }],
    },
    {
        id: "ezAqr",
        name: "EZ Aquarii",
        sky: { ra: 339.640541667, dec: -15.29925, epoch: 2000.0, pmRa: 2314, pmDec: 2295, parallax: 293.6 } /* Wikipedia: 2MASS position, Salim & Gould 2003 drift, Torres 2009 parallax */,
        members: [
            { id: "ezAqrA", name: "EZ Aquarii A", type: "M5 V", markPx: 3, size: { suns: 0.15, plusMinus: 0.03, how: "typical" } },
            { id: "ezAqrC", name: "EZ Aquarii C", type: "M V", markPx: 3, size: { suns: 0.13, plusMinus: 0.03, how: "typical" } },
            { id: "ezAqrB", name: "EZ Aquarii B", type: "M V", markPx: 3, size: { suns: 0.14, plusMinus: 0.03, how: "typical" } },
        ],
        groups: [{ key: "ezAqr", name: "EZ Aquarii A, B and C", members: ["ezAqrA", "ezAqrC", "ezAqrB"], seenNear: 2.5, apartText: "A and C round each other in 3.8 days; B rounds both every 2.25 years, about 1.2 AU off" }],
    },
    {
        id: "61cyg",
        name: "61 Cygni",
        sky: { ra: 316.748479294, dec: 38.763862446, epoch: 2016.0, pmRa: 4164.208692285, pmDec: 3249.613883849, parallax: 285.994948296 } /* Gaia DR3 1872046609345556480 */,
        members: [
            { id: "61cygA", name: "61 Cygni A", type: "K5 V", markPx: 4, size: { suns: 0.665 }, blurb: "The first star whose distance was measured, by Bessel in 1838" },
            { id: "61cygB", name: "61 Cygni B", type: "K7 V", markPx: 4, size: { suns: 0.595 }, sky: { ra: 316.753662753, dec: 38.756072772, epoch: 2016.0, pmRa: 4105.976428209, pmDec: 3155.941639827, parallax: 285.994948296 } /* Gaia DR3 1872046574983497216 */ },
        ],
        centreName: "61 Cygni A",
    },
    {
        id: "procyon",
        name: "Procyon",
        sky: { ra: 114.827402429, dec: 5.227880289, epoch: 1991.25, pmRa: -602.180440289, pmDec: -1092.431741969, parallax: 285.0 } /* centre of gravity from Hipparcos A (1991.25) on the orbit; parallax Bond et al. 2015 */,
        members: [
            { id: "procyonA", name: "Procyon A", type: "F5 IV-V", markPx: 4.5, size: { suns: 2.043 }, blurb: "Starting to swell into a giant: about twice the Sun across" },
            { id: "procyonB", name: "Procyon B", type: "DQZ", markPx: 2.5, size: { suns: 0.01232 }, blurb: "A white dwarf" },
        ],
        pairs: [{ key: "procyon", name: "Procyon A and B", a: "procyonA", b: "procyonB", orbit: { period: 40.84, periastron: 1968.076, e: 0.39785, aAU: 15.114, i: 31.408, node: 100.683, peri: 89.23, massA: 1.478, massB: 0.592 }, markPx: 4.5 }],
    },
    {
        id: "struve2398",
        name: "Struve 2398",
        sky: { ra: 280.683070835, dec: 59.638357908, epoch: 2016.0, pmRa: -1311.679082552, pmDec: 1792.32455583, parallax: 283.840118018 } /* Gaia DR3 2154880616774131840 */,
        members: [
            { id: "struve2398A", name: "Struve 2398 A", type: "M3 V", markPx: 3, size: { suns: 0.348, plusMinus: 0.01, how: "brightness" } },
            { id: "struve2398B", name: "Struve 2398 B", type: "M3.5 V", markPx: 3, size: { suns: 0.281, plusMinus: 0.008, how: "brightness" }, sky: { ra: 280.683086246, dec: 59.635145455, epoch: 2016.0, pmRa: -1400.263516757, pmDec: 1862.525147749, parallax: 283.840118018 } /* Gaia DR3 2154880616774131712 */ },
        ],
        centreName: "Struve 2398 A",
        planets: [{ star: "struve2398A", name: "Struve 2398 A b", a: 0.068, status: "confirmed" }, { star: "struve2398B", name: "Struve 2398 B c", a: 0.139, status: "confirmed" }],
    },
    {
        id: "groombridge34",
        name: "Groombridge 34",
        sky: { ra: 4.613226258, dec: 44.024786744, epoch: 2016.0, pmRa: 2891.518077337, pmDec: 411.832020366, parallax: 280.706821579 } /* Gaia DR3 385334230892516480 */,
        members: [
            { id: "groombridge34A", name: "Groombridge 34 A", type: "M1.5 V", markPx: 3.5, size: { suns: 0.406, plusMinus: 0.012, how: "brightness" } },
            { id: "groombridge34B", name: "Groombridge 34 B", type: "M3.5 V", markPx: 3, size: { suns: 0.196, plusMinus: 0.006, how: "brightness" }, sky: { ra: 4.625300681, dec: 44.028744517, epoch: 2016.0, pmRa: 2862.796426497, pmDec: 336.431903719, parallax: 280.706821579 } /* Gaia DR3 385334196532776576 */ },
        ],
        centreName: "Groombridge 34 A",
        planets: [{ star: "groombridge34A", name: "Groombridge 34 A b", a: 0.072, status: "candidate" }, { star: "groombridge34A", name: "Groombridge 34 A c", a: 5.4, status: "confirmed" }],
    },
    {
        id: "dxCnc",
        name: "DX Cancri",
        sky: { ra: 127.450092402, dec: 26.773285965, epoch: 2016.0, pmRa: -1113.693546785, pmDec: -612.191072829, parallax: 279.249639101 } /* Gaia DR3 703790044252850688 */,
        members: [
            { id: "dxCnc", name: "DX Cancri", type: "M6.5 V", markPx: 3, size: { suns: 0.124, plusMinus: 0.004, how: "brightness" } },
        ],
    },
    {
        id: "epsInd",
        name: "Epsilon Indi",
        sky: { ra: 330.87240788, dec: -56.797254661, epoch: 2016.0, pmRa: 3966.660538748, pmDec: -2536.191986804, parallax: 274.843141522 } /* Gaia DR3 6412595290592307840 */,
        members: [
            { id: "epsIndA", name: "Epsilon Indi A", type: "K5 V", markPx: 4, size: { suns: 0.713, plusMinus: 0.02, how: "catalogue" } },
            { id: "epsIndBa", name: "Epsilon Indi Ba", type: "T1", markPx: 3, size: { jupiters: 1.0, plusMinus: 0.15, how: "typical" } },
            { id: "epsIndBb", name: "Epsilon Indi Bb", type: "T6", markPx: 3, size: { jupiters: 1.0, plusMinus: 0.15, how: "typical" } },
        ],
        centreName: "Epsilon Indi A",
        planets: [{ star: "epsIndA", name: "Epsilon Indi A b", a: 15.76, status: "confirmed" }],
        groups: [{ key: "epsIndB", name: "Epsilon Indi Ba and Bb", members: ["epsIndBa", "epsIndBb"], sky: { ra: 331.076452597, dec: -56.793812067, epoch: 2016.0, pmRa: 3981.976662961, pmDec: -2466.831814766, parallax: 274.843141522 } /* Gaia DR3 6412596012146801152 */, seenNear: 3.5, apartText: "about 2.4 AU apart, round each other every 11 years" }],
    },
    {
        id: "tauCet",
        name: "Tau Ceti",
        sky: { ra: 26.009055057, dec: -15.933680201, epoch: 2016.0, pmRa: -1721.727794472, pmDec: 854.963157059, parallax: 273.809745119 } /* Gaia DR3 2452378776434477184 */,
        members: [
            { id: "tauCet", name: "Tau Ceti", type: "G8 V", markPx: 4, size: { suns: 0.793 }, blurb: "The nearest single star like the Sun" },
        ],
        planets: [{ star: "tauCet", name: "Tau Ceti g", a: 0.133, status: "candidate" }, { star: "tauCet", name: "Tau Ceti h", a: 0.243, status: "candidate" }, { star: "tauCet", name: "Tau Ceti f", a: 1.334, status: "candidate" }],
    },
    {
        id: "gj1061",
        name: "GJ 1061",
        sky: { ra: 54.003393877, dec: -44.514362316, epoch: 2016.0, pmRa: 745.654340004, pmDec: -373.323280914, parallax: 272.161540832 } /* Gaia DR3 4848140361962951552 */,
        members: [
            { id: "gj1061", name: "GJ 1061", type: "M5.5 V", markPx: 3, size: { suns: 0.156, plusMinus: 0.005, how: "brightness" } },
        ],
        planets: [{ star: "gj1061", name: "GJ 1061 b", a: 0.021, status: "confirmed" }, { star: "gj1061", name: "GJ 1061 c", a: 0.0342, status: "confirmed" }, { star: "gj1061", name: "GJ 1061 d", a: 0.054, status: "confirmed" }],
    },
    {
        id: "yzCet",
        name: "YZ Ceti",
        sky: { ra: 18.133254254, dec: -16.996154872, epoch: 2016.0, pmRa: 1205.074450318, pmDec: 637.546633968, parallax: 269.05730465 } /* Gaia DR3 2358524597030794112 */,
        members: [
            { id: "yzCet", name: "YZ Ceti", type: "M4.5 V", markPx: 3, size: { suns: 0.169, plusMinus: 0.005, how: "brightness" } },
        ],
        planets: [{ star: "yzCet", name: "YZ Ceti b", a: 0.01634, status: "confirmed" }, { star: "yzCet", name: "YZ Ceti c", a: 0.02156, status: "confirmed" }, { star: "yzCet", name: "YZ Ceti d", a: 0.02851, status: "confirmed" }],
    },
    {
        id: "luytensStar",
        name: "Luyten's Star",
        sky: { ra: 111.854628443, dec: 5.209382702, epoch: 2016.0, pmRa: 571.232346729, pmDec: -3691.486565379, parallax: 264.126897755 } /* Gaia DR3 3139847906307949696 */,
        members: [
            { id: "luytensStar", name: "Luyten's Star", type: "M3.5 V", markPx: 3, size: { suns: 0.315, plusMinus: 0.009, how: "brightness" } },
        ],
        planets: [{ star: "luytensStar", name: "Luyten's Star c", a: 0.03647, status: "confirmed" }, { star: "luytensStar", name: "Luyten's Star b", a: 0.0911, status: "confirmed" }],
    },
    {
        id: "teegarden",
        name: "Teegarden's Star",
        sky: { ra: 43.269642477, dec: 16.864373819, epoch: 2016.0, pmRa: 3429.082826808, pmDec: -3805.541122737, parallax: 260.98844068 } /* Gaia DR3 35227046884571776 */,
        members: [
            { id: "teegarden", name: "Teegarden's Star", type: "M7 V", markPx: 3, size: { suns: 0.119, plusMinus: 0.004, how: "brightness" }, blurb: "So faint it was found only in 2003" },
        ],
        planets: [{ star: "teegarden", name: "Teegarden's Star b", a: 0.0259, status: "confirmed" }, { star: "teegarden", name: "Teegarden's Star c", a: 0.0455, status: "confirmed" }, { star: "teegarden", name: "Teegarden's Star d", a: 0.0791, status: "confirmed" }],
    },
    {
        id: "kapteyn",
        name: "Kapteyn's Star",
        sky: { ra: 77.95993735, dec: -45.043812699, epoch: 2016.0, pmRa: 6491.223339062, pmDec: -5708.614150045, parallax: 254.198593264 } /* Gaia DR3 4810594479418041856 */,
        members: [
            { id: "kapteyn", name: "Kapteyn's Star", type: "M1 VI", markPx: 3.5, size: { suns: 0.302, plusMinus: 0.009, how: "brightness" }, blurb: "An old star of the galaxy's halo, passing through" },
        ],
        planets: [{ star: "kapteyn", name: "Kapteyn c", a: 0.311, status: "candidate" }],
    },
    {
        id: "lacaille8760",
        name: "Lacaille 8760",
        sky: { ra: 319.295018138, dec: -38.872456401, epoch: 2016.0, pmRa: -3258.966218702, pmDec: -1145.862396912, parallax: 251.912422211 } /* Gaia DR3 6583272171336048640 */,
        members: [
            { id: "lacaille8760", name: "Lacaille 8760", type: "M0 V", markPx: 3.5, size: { suns: 0.592, plusMinus: 0.045, how: "brightness" }, blurb: "The brightest red dwarf in our sky, just visible to the eye" },
        ],
    },
    {
        id: "kruger60",
        name: "Kruger 60",
        sky: { ra: 337.001740352, dec: 57.69701976, epoch: 1991.25, pmRa: -865.47, pmDec: -461.53, parallax: 249.94 } /* Hipparcos (van Leeuwen 2007) HIP 110893 */,
        members: [
            { id: "kruger60A", name: "Kruger 60 A", type: "M3 V", markPx: 3, size: { suns: 0.35, plusMinus: 0.05, how: "typical" } },
            { id: "kruger60B", name: "Kruger 60 B", type: "M4 V", markPx: 3, size: { suns: 0.25, plusMinus: 0.05, how: "typical" } },
        ],
        groups: [{ key: "kruger60", name: "Kruger 60 A and B", members: ["kruger60A", "kruger60B"], seenNear: 15, apartText: "about 9.5 AU apart on average, round each other every 44.6 years" }],
    },
    {
        id: "scr1845",
        name: "SCR 1845-6357",
        sky: { ra: 281.298043862, dec: -63.960567367, epoch: 2016.0, pmRa: 2583.189785995, pmDec: 588.504138102, parallax: 249.66514589 } /* Gaia DR3 6439125097427143808 */,
        members: [
            { id: "scr1845A", name: "SCR 1845-6357 A", type: "M8.5 V", markPx: 3, size: { suns: 0.115, plusMinus: 0.017, how: "brightness" } },
            { id: "scr1845B", name: "SCR 1845-6357 B", type: "T6", markPx: 3, size: { jupiters: 1.0, plusMinus: 0.15, how: "typical" } },
        ],
        groups: [{ key: "scr1845", name: "SCR 1845-6357 A and B", members: ["scr1845A", "scr1845B"], seenNear: 7, apartText: "about 4.5 AU apart on the sky" }],
    },
    {
        id: "denis1048",
        name: "DENIS J1048-3956",
        sky: { ra: 162.053887717, dec: -39.939625947, epoch: 2016.0, pmRa: -1179.311133843, pmDec: -988.12149596, parallax: 247.215586922 } /* Gaia DR3 5393446658454453632 */,
        members: [
            { id: "denis1048", name: "DENIS J1048-3956", type: "M8.5 V", markPx: 3, size: { suns: 0.115, plusMinus: 0.017, how: "brightness" }, blurb: "Found only in 2000: among the smallest stars known" },
        ],
    },
    {
        id: "ugps0722",
        name: "UGPS 0722-0540",
        sky: { ra: 110.613708333, dec: -5.675, epoch: 2000.0, pmRa: -904.14, pmDec: 352.025, parallax: 242.8 } /* Lucas et al. 2010 and Cushing et al. 2011 position; Leggett et al. 2012 drift and parallax */,
        members: [
            { id: "ugps0722", name: "UGPS 0722-0540", type: "T9", markPx: 3, size: { jupiters: 1.02, plusMinus: 0.1, how: "models" }, blurb: "A cold tundr, about 230 degrees C" },
        ],
    },
    {
        id: "ross614",
        name: "Ross 614",
        sky: { ra: 97.345811592, dec: -2.812476749, epoch: 1991.25, pmRa: 705.28, pmDec: -611.92, parallax: 242.32 } /* Hipparcos (van Leeuwen 2007) HIP 30920 */,
        members: [
            { id: "ross614A", name: "Ross 614 A", type: "M4.5 V", markPx: 3, size: { suns: 0.2, plusMinus: 0.04, how: "typical" } },
            { id: "ross614B", name: "Ross 614 B", type: "M5.5 V", markPx: 3, size: { suns: 0.15, plusMinus: 0.03, how: "typical" } },
        ],
        groups: [{ key: "ross614", name: "Ross 614 A and B", members: ["ross614A", "ross614B"], seenNear: 7, apartText: "about 4 AU apart, round each other every 16.6 years" }],
    },
    {
        id: "wolf1061",
        name: "Wolf 1061",
        sky: { ra: 247.574814162, dec: -12.667851081, epoch: 2016.0, pmRa: -94.209594994, pmDec: -1183.917157588, parallax: 232.13898084 } /* Gaia DR3 4330690742322011520 */,
        members: [
            { id: "wolf1061", name: "Wolf 1061", type: "M3 V", markPx: 3, size: { suns: 0.322, plusMinus: 0.01, how: "brightness" } },
        ],
        planets: [{ star: "wolf1061", name: "Wolf 1061 b", a: 0.0375, status: "confirmed" }, { star: "wolf1061", name: "Wolf 1061 c", a: 0.089, status: "confirmed" }, { star: "wolf1061", name: "Wolf 1061 d", a: 0.47, status: "confirmed" }],
    },
    {
        id: "vanMaanen",
        name: "van Maanen's Star",
        sky: { ra: 12.29674025, dec: 5.376556608, epoch: 2016.0, pmRa: 1231.399465379, pmDec: -2711.882504485, parallax: 231.779999532 } /* Gaia DR3 2552928187080872832 */,
        members: [
            { id: "vanMaanen", name: "van Maanen's Star", type: "DZ8", markPx: 2.5, size: { suns: 0.011, plusMinus: 0.002, how: "typical" }, blurb: "The nearest lone white dwarf" },
        ],
    },
    {
        id: "gj1",
        name: "Gliese 1",
        sky: { ra: 1.383284152, dec: -37.367744028, epoch: 2016.0, pmRa: 5633.438087895, pmDec: -2334.721272652, parallax: 230.097034029 } /* Gaia DR3 2306965202564744064 */,
        members: [
            { id: "gj1", name: "Gliese 1", type: "M1.5 V", markPx: 3.5, size: { suns: 0.396, plusMinus: 0.012, how: "brightness" } },
        ],
    },
    {
        id: "wolf424",
        name: "Wolf 424",
        sky: { ra: 188.314492802, dec: 9.022091625, epoch: 2016.0, pmRa: -1795.66090246, pmDec: 217.788566562, parallax: 227.297985813 } /* Gaia DR3 3902874650602495232 */,
        members: [
            { id: "wolf424A", name: "Wolf 424 A", type: "M5.5 V", markPx: 3, size: { suns: 0.15, plusMinus: 0.03, how: "typical" } },
            { id: "wolf424B", name: "Wolf 424 B", type: "M7 V", markPx: 3, size: { suns: 0.12, plusMinus: 0.03, how: "typical" } },
        ],
        groups: [{ key: "wolf424", name: "Wolf 424 A and B", members: ["wolf424A", "wolf424B"], seenNear: 6, apartText: "about 4 AU apart, round each other every 15.5 years" }],
    },
    {
        id: "tzAri",
        name: "TZ Arietis",
        sky: { ra: 30.058987048, dec: 13.044071201, epoch: 2016.0, pmRa: 1096.458485897, pmDec: -1771.526145379, parallax: 223.73208721 } /* Gaia DR3 76868614540049408 */,
        members: [
            { id: "tzAri", name: "TZ Arietis", type: "M4.5 V", markPx: 3, size: { suns: 0.18, plusMinus: 0.005, how: "brightness" } },
        ],
        planets: [{ star: "tzAri", name: "TZ Arietis c", a: 0.88, status: "confirmed" }],
    },
    {
        id: "gj687",
        name: "Gliese 687",
        sky: { ra: 264.104052573, dec: 68.333497638, epoch: 2016.0, pmRa: -320.67472433, pmDec: -1269.893286659, parallax: 219.78977212 } /* Gaia DR3 1637645127018395776 */,
        members: [
            { id: "gj687", name: "Gliese 687", type: "M3 V", markPx: 3, size: { suns: 0.407, plusMinus: 0.012, how: "brightness" } },
        ],
        planets: [{ star: "gj687", name: "Gliese 687 b", a: 0.163, status: "confirmed" }, { star: "gj687", name: "Gliese 687 c", a: 1.165, status: "confirmed" }],
    },
    {
        id: "gj674",
        name: "Gliese 674",
        sky: { ra: 262.170163922, dec: -46.899104899, epoch: 2016.0, pmRa: 572.56846182, pmDec: -880.582618762, parallax: 219.646251388 } /* Gaia DR3 5951824121022278144 */,
        members: [
            { id: "gj674", name: "Gliese 674", type: "M2.5 V", markPx: 3.5, size: { suns: 0.365, plusMinus: 0.011, how: "brightness" } },
        ],
        planets: [{ star: "gj674", name: "Gliese 674 b", a: 0.039, status: "confirmed" }],
    },
    {
        id: "lhs292",
        name: "LHS 292",
        sky: { ra: 162.055183999, dec: -11.34280332, epoch: 2016.0, pmRa: 579.018668285, pmDec: -1530.076483588, parallax: 219.330212631 } /* Gaia DR3 3757613049856225792 */,
        members: [
            { id: "lhs292", name: "LHS 292", type: "M6.5 V", markPx: 3, size: { suns: 0.12, plusMinus: 0.004, how: "brightness" } },
        ],
    },
    {
        id: "wise1741",
        name: "WISE 1741+2553",
        sky: { ra: 265.350916667, dec: 25.8886, epoch: 2010.7, pmRa: -512.2, pmDec: -1478.8, parallax: 216.93 } /* Kirkpatrick et al. 2011 position (2010.7); Vrba 2026 drift and parallax */,
        members: [
            { id: "wise1741", name: "WISE 1741+2553", type: "T9", markPx: 3, size: { jupiters: 0.851, plusMinus: 0.05, how: "models" } },
        ],
    },
    {
        id: "gj440",
        name: "GJ 440",
        sky: { ra: 176.456646617, dec: -64.843052846, epoch: 2016.0, pmRa: 2661.639591834, pmDec: -344.932507623, parallax: 215.675273448 } /* Gaia DR3 5332606522595645952 */,
        members: [
            { id: "gj440", name: "GJ 440", type: "DQ6", markPx: 2.5, size: { suns: 0.011, plusMinus: 0.002, how: "typical" }, blurb: "A white dwarf" },
        ],
    },
    {
        id: "gj1245",
        name: "GJ 1245",
        sky: { ra: 298.481925902, dec: 44.412906159, epoch: 2016.0, pmRa: 349.363004776, pmDec: -480.322315107, parallax: 214.574503026 } /* Gaia DR3 2079073928612821760 */,
        members: [
            { id: "gj1245A", name: "GJ 1245 A", type: "M5.5 V", markPx: 3, size: { suns: 0.15, plusMinus: 0.03, how: "typical" } },
            { id: "gj1245C", name: "GJ 1245 C", type: "M7 V", markPx: 3, size: { suns: 0.11, plusMinus: 0.03, how: "typical" } },
            { id: "gj1245B", name: "GJ 1245 B", type: "M6 V", markPx: 3, size: { suns: 0.13, plusMinus: 0.03, how: "typical" } },
        ],
        groups: [{ key: "gj1245", name: "GJ 1245 A, B and C", members: ["gj1245A", "gj1245C", "gj1245B"], seenNear: 50, apartText: "A and C close together; B about 30 AU off" }],
    },
    {
        id: "gj876",
        name: "Gliese 876",
        sky: { ra: 343.324111002, dec: -14.266689394, epoch: 2016.0, pmRa: 957.714731289, pmDec: -673.601236481, parallax: 214.037988874 } /* Gaia DR3 2603090003484152064 */,
        members: [
            { id: "gj876", name: "Gliese 876", type: "M4 V", markPx: 3, size: { suns: 0.352, plusMinus: 0.011, how: "brightness" }, blurb: "Four planets, two of them giants" },
        ],
        planets: [{ star: "gj876", name: "Gliese 876 d", a: 0.0208, status: "confirmed" }, { star: "gj876", name: "Gliese 876 c", a: 0.1296, status: "confirmed" }, { star: "gj876", name: "Gliese 876 b", a: 0.2083, status: "confirmed" }, { star: "gj876", name: "Gliese 876 e", a: 0.3343, status: "confirmed" }],
    },
    {
        id: "wise1639",
        name: "WISE 1639-6847",
        sky: { ra: 249.915541667, dec: -68.785191667, epoch: 2000.0, pmRa: 576.94, pmDec: -3108.48, parallax: 211.11 } /* Fontanive et al. 2021 */,
        members: [
            { id: "wise1639", name: "WISE 1639-6847", type: "Y0 pec", markPx: 3, size: { jupiters: 1.0, plusMinus: 0.15, how: "typical" } },
        ],
    },
    {
        id: "lhs288",
        name: "LHS 288",
        sky: { ra: 161.085275513, dec: -61.202638305, epoch: 2016.0, pmRa: -346.207616048, pmDec: 1611.099960078, parallax: 206.969775075 } /* Gaia DR3 5254061535106490112 */,
        members: [
            { id: "lhs288", name: "LHS 288", type: "M5.5 V", markPx: 3, size: { suns: 0.131, plusMinus: 0.004, how: "brightness" } },
        ],
    },
    {
        id: "gj1002",
        name: "GJ 1002",
        sky: { ra: 1.676350426, dec: -7.546475325, epoch: 2016.0, pmRa: -811.565956256, pmDec: -1893.250846655, parallax: 206.350039206 } /* Gaia DR3 2441630500517079808 */,
        members: [
            { id: "gj1002", name: "GJ 1002", type: "M5.5 V", markPx: 3, size: { suns: 0.144, plusMinus: 0.004, how: "brightness" } },
        ],
        planets: [{ star: "gj1002", name: "GJ 1002 b", a: 0.0457, status: "confirmed" }, { star: "gj1002", name: "GJ 1002 c", a: 0.0738, status: "confirmed" }],
    },
];
