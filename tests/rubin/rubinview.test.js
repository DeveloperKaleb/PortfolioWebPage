import { describe, test, expect } from 'vitest';
import {
    DIGEST_URL, CHANGES_URL, summary, sections, displayName, sizeOf, flagsOf, whyWatched, changeText,
    chartData, mapData, percent, kilometres, au, longDate,
} from '../../js/rubinview.js';
import { FLAGS } from '../../js/flags.js';

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
        expect(passes.map((e) => e.designation)).toEqual(['136199', '120347']);
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

    test('is sized to the furthest object, in rings of 50 AU', () => {
        expect(map.radius).toBe(100);
        expect(map.rings).toEqual([50, 100]);
    });

    test('leaves out an object with no position rather than placing it at the Sun', () => {
        const without = { ...digest, entries: [entry({ now: { r: 44, V: 20, detectable: true } })] };
        expect(mapData(without).marks).toEqual([]);
    });
});
