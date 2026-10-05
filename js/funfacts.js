/* One fun fact for each of the Known worlds on the Solar System tab, each with the page it
 * comes from (owner, 2026-10-05: unusual enough to surprise someone who knows these bodies
 * well, with a small source link so they can check). Each was checked against its source
 * on 2026-10-05; where a first choice could not be confirmed on a good page, a different fact
 * was used. Keyed by the name the card shows. Facts state things plainly - no asides
 * defending the site's terms (NOTES.md).
 *
 * Pure: no network, no DOM. */

const NASA = 'NASA';

export const FUN_FACTS = {
    Mercury: {
        text: 'On average, Mercury - not Venus - is the closest planet to Earth, and to every other planet too, because it never strays far from the Sun.',
        url: 'https://physicstoday.aip.org/opinion/venus-is-not-earths-closest-neighbor', source: 'Physics Today',
    },
    Venus: {
        text: 'Venus takes 243 days to turn once, but its cloud tops race all the way round it in about four.',
        url: 'https://sci.esa.int/web/venus-express/-/54065-4-super-rotation-is-speeding-up', source: 'ESA',
    },
    Earth: {
        text: "Earth's highest point, measured from its centre, is not Everest: Chimborazo in Ecuador sits on the equatorial bulge, over 2 km farther out.",
        url: 'https://oceanservice.noaa.gov/facts/highestpoint.html', source: 'NOAA',
    },
    Luna: {
        text: 'Apollo astronauts agreed that the dust they tracked into their cabin smelled like spent gunpowder.',
        url: 'https://www.acs.org/pressroom/reactions/library/what-does-the-moon-smell-like.html', source: 'American Chemical Society',
    },
    Mars: {
        text: 'Sunsets on Mars are blue: its fine dust lets blue light through best, so a blue glow gathers around the setting Sun.',
        url: 'https://svs.gsfc.nasa.gov/11875', source: NASA,
    },
    Ceres: {
        text: 'Ceres has a lone mountain, Ahuna Mons, about 4 km tall, built not from lava but from salty mud that welled up and froze.',
        url: 'https://www.nasa.gov/missions/nasa-discovers-lonely-mountain-on-ceres-likely-a-salty-mud-cryovolcano/', source: NASA,
    },
    Jupiter: {
        text: "Jupiter is massive enough that it and the Sun circle a shared point just outside the Sun's surface.",
        url: 'https://spaceplace.nasa.gov/barycenter/en/', source: NASA,
    },
    Io: {
        text: "Jupiter raises tides in Io's solid rock: its ground rises and falls by as much as 100 metres.",
        url: 'https://spaceplace.nasa.gov/io-tides/en/', source: NASA,
    },
    Europa: {
        text: "Europa's hidden ocean may hold more than twice as much water as all of Earth's oceans combined.",
        url: 'https://science.nasa.gov/missions/europa-clipper/europa-clipper-resources/europa-water-world-infographic/', source: NASA,
    },
    Ganymede: {
        text: 'Ganymede is the only moon known to make its own magnetic field - enough to light auroras around its poles.',
        url: 'https://science.nasa.gov/jupiter/jupiter-moons/ganymede/facts/', source: NASA,
    },
    Callisto: {
        text: "Callisto's surface is about 4 billion years old and the most heavily cratered in the Solar System.",
        url: 'https://science.nasa.gov/jupiter/jupiter-moons/callisto/facts/', source: NASA,
    },
    Saturn: {
        text: "Saturn's day was only pinned down in 2019, from waves its interior raises in its rings: 10 hours, 33 minutes and 38 seconds.",
        url: 'https://science.nasa.gov/solar-system/scientists-finally-know-what-time-it-is-on-saturn/', source: NASA,
    },
    Mimas: {
        text: 'Mimas, the moon that looks like the Death Star, hides a global ocean 20-30 km down that formed only 5-15 million years ago.',
        url: 'https://observatoiredeparis.psl.eu/presence-of-a-young-ocean.html?lang=en', source: 'Paris Observatory',
    },
    Enceladus: {
        text: 'Enceladus reflects almost all the sunlight that falls on it, making it the most reflective body in the Solar System.',
        url: 'https://science.nasa.gov/saturn/moons/enceladus/', source: NASA,
    },
    Tethys: {
        text: 'Tethys is so nearly pure water ice that, at 0.98 grams per cubic centimetre, it is less dense than liquid water.',
        url: 'https://en.wikipedia.org/wiki/Tethys_(moon)', source: 'Wikipedia',
    },
    Dione: {
        text: 'Dione shares its orbit with two tiny moons, Helene and Polydeuces: one travels 60 degrees ahead of it, the other 60 degrees behind.',
        url: 'https://science.nasa.gov/resource/moons-that-share/', source: NASA,
    },
    Rhea: {
        text: 'Rhea has an atmosphere of oxygen and carbon dioxide - so thin that, at Earth-like pressure, all of it would fit in a medium-sized building.',
        url: 'https://www.jpl.nasa.gov/news/thin-air-cassini-finds-ethereal-atmosphere-at-rhea/', source: NASA,
    },
    Titan: {
        text: "Titan's air is thick and its gravity weak: a person could, in principle, strap wings to their spacesuit and fly by flapping.",
        url: 'https://www.planetary.org/articles/what-would-it-be-like-to-stand-on-the-surface-of-titan', source: 'The Planetary Society',
    },
    Iapetus: {
        text: "A ridge up to 20 km tall runs along most of Iapetus's equator, giving it the look of a walnut.",
        url: 'https://www.planetary.org/articles/3389', source: 'The Planetary Society',
    },
    Uranus: {
        text: 'John Flamsteed saw Uranus in 1690, nearly a century before its discovery, and catalogued it as a star: 34 Tauri.',
        url: 'https://en.wikipedia.org/wiki/John_Flamsteed', source: 'Wikipedia',
    },
    Miranda: {
        text: "Miranda's cliff Verona Rupes is about 20 km tall; in Miranda's weak gravity, a fall from the top would take about 12 minutes.",
        url: 'https://apod.nasa.gov/apod/ap201129.html', source: NASA,
    },
    Ariel: {
        text: "Uranus's moons are named from Shakespeare and Pope rather than myth, and Ariel is in both: The Tempest and The Rape of the Lock.",
        url: 'https://www.folger.edu/podcasts/shakespeare-unlimited/shakespearean-moons-uranus/', source: 'Folger Shakespeare Library',
    },
    Umbriel: {
        text: "Umbriel is the darkest of Uranus's large moons, yet the floor of its crater Wunda holds a bright ring about 140 km across.",
        url: 'https://science.nasa.gov/photojournal/umbriel-at-closest-approach/', source: NASA,
    },
    Titania: {
        text: 'A canyon system on Titania, Messina Chasmata, runs for about 1,500 km - almost a third of the way around the moon.',
        url: 'https://en.wikipedia.org/wiki/Messina_Chasmata', source: 'Wikipedia',
    },
    Oberon: {
        text: "Voyager 2's only close look at Oberon, in 1986, caught a mountain about 11 km high standing on its edge.",
        url: 'https://www.jpl.nasa.gov/images/pia00034-oberon-at-voyager-closest-approach/', source: NASA,
    },
    Neptune: {
        text: 'Neptune completed its first full orbit since its discovery only on 11 July 2011, 165 years after it was found.',
        url: 'https://science.nasa.gov/asset/hubble/neptunes-165-year-long-orbit/', source: NASA,
    },
    Triton: {
        text: 'Triton is probably a Kuiper belt world captured by Neptune - and at -235 degrees Celsius, one of the coldest surfaces measured, it still erupts geysers.',
        url: 'https://science.nasa.gov/neptune/moons/triton/', source: NASA,
    },
    Pluto: {
        text: 'Pluto has blue skies: haze high in its thin atmosphere scatters blue light, much as Earth\'s air does.',
        url: 'https://www.nasa.gov/image-article/plutos-blue-sky/', source: NASA,
    },
    Charon: {
        text: "Charon's reddish north pole is painted by Pluto: methane escaping Pluto freezes there, and sunlight turns it into red compounds.",
        url: 'https://phys.org/news/2016-09-pluto-largest-moon-charon-red.html', source: 'Phys.org',
    },
    Haumea: {
        text: 'Haumea has a ring, found in 2017 when it passed in front of a star: the first ring seen around a world beyond Neptune.',
        url: 'https://www.nature.com/articles/nature24051', source: 'Nature',
    },
    Quaoar: {
        text: "Quaoar's ring circles more than seven Quaoar radii out, far beyond where theory said a ring should clump together into a moon.",
        url: 'https://www.esa.int/Science_Exploration/Space_Science/Cheops/ESA_s_Cheops_finds_an_unexpected_ring_around_dwarf_planet_Quaoar', source: 'ESA',
    },
    Makemake: {
        text: "Its discoverers nicknamed Makemake 'Easterbunny', found days after Easter; its name, the creator god of Easter Island, keeps the link.",
        url: 'https://science.nasa.gov/dwarf-planets/makemake/', source: NASA,
    },
    Eris: {
        text: "Eris and its moon were first nicknamed Xena and Gabrielle; the moon's official name, Dysnomia ('lawlessness'), nods to Xena actor Lucy Lawless.",
        url: 'https://www.astronomy.com/science/dwarf-planet-gets-new-name/', source: 'Astronomy',
    },
};

/* The fun fact for a body by the name its card shows, or null. */
export const funFact = (name) => FUN_FACTS[name] ?? null;
