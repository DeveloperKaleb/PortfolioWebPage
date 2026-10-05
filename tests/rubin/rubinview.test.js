import { describe, test, expect } from 'vitest';
import {
    DIGEST_URL, CHANGES_URL, summary, sections, displayName, sizeOf, flagsOf, whyWatched, changeText,
    chartData, mapData, percent, kilometres, au, longDate, matchesQuery, FILTER_FROM, planeParts, planeText,
    KIND_LABEL, bodyKind, properName, placeLabels, NASA_IMAGES, nasaImages, knownWorlds, WORLD_PREFIX,
    KNOWN_SHAPES, isKnownShape, knownRow, worldsOn, CERES_ELEMENTS, KNOWN_MOONS, knownMoons, MOON_DRAW_PX, initialView, MAP_ZOOM,
} from '../../js/rubinview.js';
import { FLAGS } from '../../js/flags.js';
import { MOON_ORBITS } from '../../js/moons.js';
const MOON_ORBITS_CHARON_A = MOON_ORBITS.Charon.a;

/* A small digest in the collector's format, with one of each kind of entry. */
const entry = (over) => ({
    designation: '1', name: '1 Test (2000 AA1)', H: 3, errH: 0.3, hSource: 'catalogue (JPL)', detections: 0,
    sizeFrom: 'brightness', chance: 0.9, chanceGrundy: 0.6, chanceIfDark: 1, passes: true, flags: [], watch: false,
    orbit: { a: 45, e: 0.1, i: 5, q: 40.5 }, orbitQuality: null,
    now: { r: 44, x: 30, y: -32.2, V: 20.1, detectable: true },
    ...over,
});
const digest = {
    format: 1, date: '2026-10-05',
    counts: { assessed: 7294, passes: 2, watch: 1, withRubinH: 41 },
    entries: [
        entry({ designation: '136199', name: '136199 Eris (2003 UB313)', H: -1.26, chance: 1, flags: ['highlyInclined'], now: { r: 95.5, x: 80, y: 52, V: 18.6, detectable: true } }),
        entry({ designation: '120347', name: '120347 Salacia (2004 SB60)', sizeFrom: 'measured', diameterKm: 984, flags: ['disputed'] }),
        entry({ designation: '2012 VP113', name: '(2012 VP113)', passes: false, watch: true, chance: 0.75, chanceIfDark: 1, flags: ['largeIfDark', 'extremeOrbit', 'detached'], now: { r: 85.1, x: -60, y: 60, V: 23.4, detectable: true } }),
        entry({ designation: '2', name: '(2001 KA77)', passes: false, chance: 0.6, chanceIfDark: 0.95, flags: ['largeIfDark'] }),
        entry({ designation: '3', name: '(2002 XX1)', passes: false, chance: 0.6, chanceIfDark: 0.99, flags: ['largeIfDark'] }),
    ],
};

/* The site's rule: a visitor's browser contacts nothing but the site's own host. */
test('reads the digest from the same origin, never a third party', () => {
    expect(DIGEST_URL.startsWith('/')).toBe(true);
    expect(DIGEST_URL).not.toMatch(/^\/\//);
    expect(CHANGES_URL('2026-10')).toBe('/rubin-data/changes/2026-10.json');
});

describe('Words', () => {
    test('percentages never round a near-certainty up to 100%', () => {
        expect(percent(0.99999)).toBe('>99.9%');
        expect(percent(0.996)).toBe('99.6%');
        expect(percent(0.8)).toBe('80%');
    });

    test('distances and sizes read naturally', () => {
        expect(kilometres(1234)).toBe('1,234 km');
        expect(au(95.46)).toBe('95.5 AU');
        expect(au(123.9)).toBe('124 AU');
        expect(longDate('2026-10-05')).toBe('5 October 2026');
    });

    test('names an object by its name, or its designation when it has none', () => {
        expect(displayName(digest.entries[0])).toBe('Eris');
        expect(displayName(digest.entries[2])).toBe('2012 VP113');
        expect(displayName({ name: '612911 (2004 XR190)' })).toBe('2004 XR190');
    });

    test('the status line says when, how many and how much is Rubin\'s own', () => {
        expect(summary(digest)).toEqual([
            'Updated 5 October 2026', '7,294 distant objects checked', '2 likely shaped by their own gravity',
            '1 worth watching', '41 confirmed by Rubin',
        ]);
    });
});

describe('Sizes', () => {
    test('a measured size is given as measured', () => {
        expect(sizeOf(digest.entries[1])).toMatchObject({ km: 984, measured: true });
    });

    test('a size from brightness is an estimate, rounded and marked "about"', () => {
        const size = sizeOf(digest.entries[0]);
        expect(size.measured).toBe(false);
        expect(size.text).toMatch(/^about [\d,]+0 km$/);
        // Eris, from H alone: it should come out in the right range.
        expect(size.km).toBeGreaterThan(1500);
        expect(size.km).toBeLessThan(4000);
    });
});

describe('Sections', () => {
    const { passes, watch, largeIfDark } = sections(digest);

    test('passes, watched and large-if-dark are separate, with nothing in two', () => {
        expect(passes.map((e) => e.designation)).toEqual(['120347']);
        expect(watch.map((e) => e.designation)).toEqual(['2012 VP113']);
        expect(largeIfDark.map((e) => e.designation)).toEqual(['3', '2']); // most likely large first
    });

    test('flags come with their words', () => {
        flagsOf(digest.entries[2]).forEach((f) => {
            expect(f.label).toBe(FLAGS[f.name].label);
            expect(f.means).toBe(FLAGS[f.name].means);
        });
    });

    test('says why a watched object is watched, naming its orbit flags', () => {
        expect(whyWatched(digest.entries[2])).toMatch(/extreme orbit and detached\.$/);
    });
});

describe('Changes in words', () => {
    const byDesignation = new Map(digest.entries.map((e) => [e.designation, e]));

    test.each([
        [{ designation: '136199', what: 'new in digest' }, 'Eris appears for the first time.'],
        [{ designation: '120347', what: 'now passes', chance: 0.99 }, 'Salacia now passes (99.0%).'],
        [{ designation: '2012 VP113', what: 'flags gained', flags: ['extremeOrbit'] }, '2012 VP113 is now extreme orbit.'],
        [{ designation: '9', what: 'left digest' }, '9 no longer qualifies for the list.'],
    ])('%o', (change, words) => expect(changeText(change, byDesignation)).toBe(words));

    test('says when Rubin revised a brightness', () => {
        expect(changeText({ designation: '136199', what: 'H changed', from: 1.82, to: 2.17, hSource: 'Rubin' }, byDesignation))
            .toMatch(/from H 1.82 to H 2.17/);
    });
});

describe('The chart', () => {
    const data = chartData();

    test('draws both readings, rising with size', () => {
        expect(data.evidence.at(-1).chance).toBeGreaterThan(data.evidence[0].chance);
        expect(data.grundy.at(-1).chance).toBeGreaterThan(data.grundy[0].chance);
    });

    test('marks the two cutoffs the filter uses', () => {
        expect(data.cutoffs.evidence).toBeCloseTo(445, -1);
        expect(data.cutoffs.grundy).toBeCloseTo(939, -1);
    });

    test('plots only bodies with a known state, and counts the rest', () => {
        expect(data.bodies.length).toBeGreaterThan(20);
        expect(data.uncertainCount).toBeGreaterThan(0);
        expect(data.bodies.some((b) => b.name === 'Mimas' && b.shaped)).toBe(true);
        expect(data.bodies.some((b) => b.name === 'Proteus' && !b.shaped)).toBe(true);
    });

    test('gives both readings at any diameter, for the crosshair', () => {
        const at = data.chanceAt(1000);
        expect(at.evidence).toBeGreaterThan(at.grundy);
    });
});

describe('The map', () => {
    const map = mapData(digest);

    test('shows passes, disputed passes and watched objects, and nothing else', () => {
        expect(map.marks.map((m) => [m.entry.designation, m.kind])).toEqual([
            ['136199', 'passes'], ['120347', 'disputed'], ['2012 VP113', 'watch'],
        ]);
    });

    test('is sized to the furthest object, rounded up to 50 AU', () => {
        expect(map.radius).toBe(100);
    });

    test("carries the planets, the tundrs and Ceres, placed on the digest's date", () => {
        expect(map.planets.map((p) => p.name)).toEqual(['Mercury', 'Venus', 'Earth', 'Mars', 'Ceres', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']);
        map.planets.forEach((p) => expect(p.path.length).toBeGreaterThan(50));
    });

    test('leaves out an object with no position rather than placing it at the Sun', () => {
        const without = { ...digest, entries: [entry({ now: { r: 44, V: 20, detectable: true } })] };
        expect(mapData(without).marks).toEqual([]);
    });
});

/* Cards show only for objects the reader picks; long sections get a filter over the names. */
describe('Filtering names', () => {
    const eris = digest.entries[0];
    const vp113 = digest.entries[2];

    test('matches by name, ignoring case', () => {
        expect(matchesQuery(eris, 'eri')).toBe(true);
        expect(matchesQuery(eris, 'ERIS')).toBe(true);
        expect(matchesQuery(eris, 'sedna')).toBe(false);
    });

    test('matches by designation, ignoring spaces', () => {
        expect(matchesQuery(vp113, '2012vp')).toBe(true);
        expect(matchesQuery(eris, '136199')).toBe(true);
        expect(matchesQuery(eris, '2003 ub313')).toBe(true);
    });

    test('an empty filter shows everything', () => {
        expect(matchesQuery(eris, '')).toBe(true);
        expect(matchesQuery(eris, '   ')).toBe(true);
    });

    test('only long sections get a filter box', () => {
        expect(FILTER_FROM).toBeGreaterThan(10);
    });
});

/* The map is seen from above the plane of Earth's orbit, so it shows distance along that
   plane. 2014 UN225, tilted 53 degrees, is 43.7 AU from the Sun but was drawn between
   the 20 and 30 AU rings: the details now give both. */
describe('Along the plane, and out of it', () => {
    /* Its position as the collector recorded it on 2026-10-02 (rubin-data 846fd9b). */
    const un225 = { now: { r: 43.7, x: 23.59, y: -11.55, z: -34.92 } };

    test('gives the distance along the plane and the height below it', () => {
        const parts = planeParts(un225);
        expect(parts.along).toBeCloseTo(26.3, 1);
        expect(planeText(un225)).toBe('26.3 AU along the plane, 34.9 AU below it');
    });

    test('says above for an object over the plane', () => {
        expect(planeText({ now: { r: 43.7, x: 23.59, y: -11.55, z: 34.92 } })).toMatch(/34\.9 AU above it$/);
    });

    test('works out the height without a side for a digest from before z was recorded', () => {
        expect(planeText({ now: { r: 43.7, x: 20.3, y: -16.72 } })).toBe('26.3 AU along the plane, 34.9 AU out of it');
    });

    test('says nothing extra for an object near the plane, where the map tells the truth', () => {
        expect(planeText({ now: { r: 44, x: 30, y: 32.18, z: 0.4 } })).toBeNull();
    });
});

/* The site's stance: rounded, a surface, no core fusion. The giants have no surface. */
describe('Planets and tundrs', () => {
    test('the four giants are tundrs, named by what they are made of', () => {
        const kinds = Object.fromEntries(mapData(digest).planets.map((p) => [p.name, p.kind]));
        expect(kinds).toEqual({
            Mercury: 'planet', Venus: 'planet', Earth: 'planet', Mars: 'planet', Ceres: 'planet',
            Jupiter: 'hydrogen', Saturn: 'hydrogen', Uranus: 'water', Neptune: 'water',
        });
    });

    test('every kind has its words', () => {
        expect(KIND_LABEL[bodyKind('Saturn')]).toBe('Hydrogen Tundr');
        expect(KIND_LABEL[bodyKind('Neptune')]).toBe('Water Tundr');
        expect(KIND_LABEL[bodyKind('Earth')]).toBe('Planet');
    });
});

/* Pluto is a planet here, so the map names it, and every other named object, when there
   is room. */
describe('Labels on the map', () => {
    test('names an object only when it has a proper name', () => {
        expect(properName({ name: '134340 Pluto (1930 BM)' })).toBe('Pluto');
        expect(properName({ name: '(2012 VP113)' })).toBeNull();
        expect(properName({ name: '612911 (2004 XR190)' })).toBeNull();
    });

    test('keeps labels in priority order, leaving out one that would overlap', () => {
        const kept = placeLabels([
            { x: 100, y: 100, text: 'Neptune' },
            { x: 105, y: 102, text: 'Pluto' },
            { x: 300, y: 300, text: 'Eris' },
        ], 440);
        expect(kept.map((l) => l.text)).toEqual(['Neptune', 'Eris']);
    });

    test('a label that would run off the map is left out', () => {
        expect(placeLabels([{ x: 420, y: 100, text: 'Gonggong' }, { x: 100, y: 5, text: 'Sedna' }], 440)).toEqual([]);
    });

    test('zooming in, which spreads the dots, makes room for both', () => {
        const kept = placeLabels([{ x: 100, y: 100, text: 'Neptune' }, { x: 160, y: 140, text: 'Pluto' }], 440);
        expect(kept).toHaveLength(2);
    });
});

/* A checked list of NASA's real images, never a search that could turn up a painting. */
describe("NASA's images", () => {
    test('links an object NASA has imaged, to a NASA page', () => {
        expect(nasaImages(digest.entries[0]).url).toMatch(/^https:\/\/science\.nasa\.gov\//);
    });

    test('has nothing for an object NASA has released no images of', () => {
        expect(nasaImages(digest.entries[2])).toBeNull();
    });

    test('every link is a NASA page, keyed by a designation', () => {
        for (const [designation, { url, text }] of Object.entries(NASA_IMAGES)) {
            expect(designation).toMatch(/^\d+$/);
            expect(url).toMatch(/^https:\/\/science\.nasa\.gov\//);
            expect(text.length).toBeGreaterThan(10);
        }
    });
});

/* The planets and tundrs have cards too: measured sizes, where they are on the day. */
describe('The known worlds', () => {
    const worlds = knownWorlds(digest);

    test('all eight, in order from the Sun, planets and tundrs alike', () => {
        expect(worlds.map((w) => w.name)).toEqual(['Mercury', 'Venus', 'Earth', 'Mars', 'Ceres', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']);
        expect(worlds.map((w) => w.kind)).toEqual(['planet', 'planet', 'planet', 'planet', 'planet', 'hydrogen', 'hydrogen', 'water', 'water']);
    });

    test("each is where it is on the digest's date", () => {
        const earth = worlds.find((w) => w.name === 'Earth');
        expect(earth.now.r).toBeGreaterThan(0.98);
        expect(earth.now.r).toBeLessThan(1.02);
        expect(worlds.find((w) => w.name === 'Neptune').now.r).toBeCloseTo(29.9, 0);
    });

    test("keys never clash with a minor planet's designation", () => {
        worlds.forEach((w) => expect(w.designation.startsWith(WORLD_PREFIX)).toBe(true));
    });

    test("links each to NASA's page for it", () => {
        expect(nasaImages(worlds[3]).url).toBe('https://science.nasa.gov/mars/');
    });
});

/* "Known worlds" read literally: every body whose gravity-made shape has been seen. */
describe('Known shapes', () => {
    test('are the calibration list\'s shaped bodies other than moons', () => {
        expect([...KNOWN_SHAPES].sort()).toEqual(['Ceres', 'Eris', 'Haumea', 'Makemake', 'Pluto', 'Quaoar']);
    });

    test('move from the likely row to the known row, and stay on the map', () => {
        expect(sections(digest).known.map((e) => e.designation)).toEqual(['136199']);
        expect(mapData(digest).marks.some((m) => m.entry.designation === '136199')).toBe(true);
    });

    test('the known row runs outward from the Sun, Eris after Neptune', () => {
        const names = knownRow(digest).map((w) => displayName(w));
        expect(names).toEqual([
            'Mercury', 'Venus', 'Earth', 'Moon', 'Mars', 'Ceres',
            'Jupiter', 'Io', 'Europa', 'Ganymede', 'Callisto',
            'Saturn', 'Mimas', 'Enceladus', 'Tethys', 'Dione', 'Rhea', 'Titan', 'Iapetus',
            'Uranus', 'Miranda', 'Ariel', 'Umbriel', 'Titania', 'Oberon',
            'Neptune', 'Triton', 'Eris',
        ]);
    });

    test('an uncertain shape stays likely', () => {
        expect(isKnownShape({ name: '225088 Gonggong (2007 OR10)' })).toBe(false);
    });

    test("Ceres sits where JPL's orbit puts it, inside Jupiter's", () => {
        const ceres = worldsOn(2461200.5).find((w) => w.name === 'Ceres');
        expect(ceres.r).toBeGreaterThan(2.5);
        expect(ceres.r).toBeLessThan(3.0);
    });
});

/* The round moons are planets by the site's definition: cards in the known row. */
describe('Round moons', () => {
    test("are the calibration list's shaped moons, plus the Moon and Io", async () => {
        const { CALIBRATION } = await import('../../js/equilibrium.js');
        const shaped = CALIBRATION.filter((b) => b.shaped === 'yes' && b.population === 'moon').map((b) => b.name);
        expect(KNOWN_MOONS.map((m) => m.name).sort()).toEqual([...shaped, 'Moon', 'Io'].sort());
    });

    test('every moon has a size, a discovery and a NASA page', () => {
        const moons = knownMoons(knownRow({ ...digest, entries: [] }).filter((b) => !b.moon).concat([{ name: '134340 Pluto (1930 BM)', now: { r: 35.6 } }]));
        expect(moons).toHaveLength(KNOWN_MOONS.length);
        for (const m of moons) {
            expect(m.km).toBeGreaterThan(300);
            expect(m.found).toBeTruthy();
            expect(m.images.url).toMatch(/^https:\/\/science\.nasa\.gov\//);
        }
    });

    test('a moon is as far from the Sun as its parent', () => {
        const row = knownRow(digest);
        const titan = row.find((b) => b.name === 'Titan');
        const saturn = row.find((b) => b.name === 'Saturn');
        expect(titan.now.r).toBe(saturn.now.r);
    });

    test('Charon follows Pluto when Pluto is in the digest', () => {
        const withPluto = { ...digest, entries: [...digest.entries, { ...digest.entries[0], designation: '134340', name: '134340 Pluto (1930 BM)', orbit: { a: 39.5 }, now: { r: 35.6, x: 20, y: -29, V: 15 } }] };
        const names = knownRow(withPluto).map((b) => displayName(b));
        expect(names.slice(names.indexOf('Pluto'), names.indexOf('Pluto') + 2)).toEqual(['Pluto', 'Charon']);
    });
});

/* Each round moon on the map, around its parent, once there is room to tell them apart. */
describe('Moons on the map', () => {
    const map = mapData(digest);

    test('every moon of a body on the map is placed around it', () => {
        const titan = map.moons.find((m) => m.name === 'Titan');
        const saturn = map.planets.find((p) => p.name === 'Saturn');
        expect(Math.hypot(titan.x - saturn.x, titan.y - saturn.y)).toBeLessThan(titan.a * 1.01);
        expect(titan.path.length).toBeGreaterThan(50);
    });

    test("Charon waits for Pluto: with no Pluto in the digest, it is not drawn", () => {
        expect(map.moons.some((m) => m.name === 'Charon')).toBe(false);
    });

    test('zoomed all the way in, even Charon clears its parent', () => {
        const view = initialView(map.radius, 440);
        expect(MOON_ORBITS_CHARON_A * view.scale * MAP_ZOOM.max).toBeGreaterThan(MOON_DRAW_PX);
    });
});
