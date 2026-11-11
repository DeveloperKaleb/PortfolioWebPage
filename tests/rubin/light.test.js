import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    AU_KM, LIGHT_SECONDS_PER_AU, lightTravelledAU, lightSeconds, durationText, distanceText, milestones, lightProgress,
    lightSentence, sunlightText, RULER_FROM_AU, rulerFraction, firstVisit, hasEarlierVisit, SECOND_RING_AFTER_MS, scaleToShow,
} from '../../js/light.js';
import { SCOPE_AU } from '../../js/orbit.js';

const root = resolve(__dirname, '../..');

describe('How fast light goes', () => {
    test('it crosses one AU in 499 seconds', () => {
        expect(LIGHT_SECONDS_PER_AU).toBeCloseTo(499.004784, 5);
    });

    test('eight minutes and nineteen seconds after leaving, it has gone one AU', () => {
        expect(lightTravelledAU(499004.784)).toBeCloseTo(1, 9);
    });

    test('nothing has travelled before it leaves', () => {
        expect(lightTravelledAU(-5000)).toBe(0);
    });

    test('a second is 299,792 km', () => {
        expect(lightTravelledAU(1000) * AU_KM).toBeCloseTo(299792.458, 3);
    });

    test("the page's limit is 1.58 years away", () => {
        expect(lightSeconds(SCOPE_AU) / (365.25 * 86400)).toBeCloseTo(1.581, 3);
    });

    test('twelve days is about 2,078 AU', () => {
        expect(Math.round(lightTravelledAU(12 * 86400 * 1000))).toBe(2078);
    });
});

describe('Saying a length of time', () => {
    test.each([
        [0, '0 s'],
        [42, '42 s'],
        [59.6, '1 min 0 s'],
        [499, '8 min 19 s'],
        [3600, '1 h 0 min'],
        [23568, '6 h 33 min'],
        [3599.7, '1 h 0 min'],
        [2 * 86400 - 1, '48 h 0 min'],
        [2 * 86400, '2 days'],
        [12 * 86400 + 3 * 3600, '12 days 3 h'],
        [364 * 86400, '364 days'],
        [lightSeconds(SCOPE_AU), '1.58 years'],
    ])('%d seconds is "%s"', (seconds, text) => {
        expect(durationText(seconds)).toBe(text);
    });

    test('never negative', () => {
        expect(durationText(-10)).toBe('0 s');
    });
});

describe('Saying how far', () => {
    test('kilometres near the Sun, where the number visibly climbs', () => {
        expect(distanceText(lightTravelledAU(10000))).toBe('2,997,925 km');
    });

    test('AU from a tenth of one', () => {
        expect(distanceText(0.1234)).toBe('0.12 AU');
        expect(distanceText(47.23)).toBe('47.23 AU');
    });

    test('whole AU, grouped, far out', () => {
        expect(distanceText(2078.4)).toBe('2,078 AU');
    });
});

const BODIES = [
    { name: 'Neptune', r: 29.9 },
    { name: 'Earth', r: 0.99 },
    { name: '2026 ED138', r: 47.23 },
    { name: 'No distance', r: NaN },
    { r: 5 },
];

describe('What the light has passed and what is next', () => {
    const sorted = milestones(BODIES);

    test('milestones are the named bodies with a distance, nearest first', () => {
        expect(sorted.map((m) => m.name)).toEqual(['Earth', 'Neptune', '2026 ED138']);
    });

    test('at the start nothing is passed and Earth is next, 8 min 14 s away', () => {
        const p = lightProgress(0, sorted);
        expect(p.passed).toBeNull();
        expect(p.next.name).toBe('Earth');
        expect(durationText(p.secondsToNext)).toBe('8 min 14 s');
    });

    test('between two bodies', () => {
        const p = lightProgress(10, sorted);
        expect(p.passed.name).toBe('Earth');
        expect(p.next.name).toBe('Neptune');
        expect(p.secondsToNext).toBeCloseTo(19.9 * LIGHT_SECONDS_PER_AU, 6);
    });

    test('a body is passed the moment the light is as far out as it is', () => {
        expect(lightProgress(29.9, sorted).passed.name).toBe('Neptune');
    });

    test('past everything there is no next', () => {
        const p = lightProgress(500, sorted);
        expect(p.passed.name).toBe('2026 ED138');
        expect(p.next).toBeNull();
        expect(p.secondsToNext).toBeNull();
    });

    test('with no bodies at all', () => {
        expect(lightProgress(3, [])).toEqual({ passed: null, next: null, secondsToNext: null });
    });
});

describe('The sentence under the map', () => {
    const sorted = milestones(BODIES);
    const edge = { name: "this page's outer limit, 100,000 AU from the Sun", r: SCOPE_AU };

    test('just after the page opens', () => {
        expect(lightSentence({ since: 'as you opened this page', travelledAU: lightTravelledAU(10000), sorted, edge }))
            .toBe("Light that left the Sun as you opened this page has travelled 2,997,925 km. It reaches Earth in 8 min 4 s. It will be 1.58 years before it reaches this page's outer limit, 100,000 AU from the Sun.");
    });

    test('part of the way out', () => {
        expect(lightSentence({ since: 'as you opened this page', travelledAU: 10, sorted, edge }))
            .toContain('has travelled 10.00 AU. It has passed Earth and reaches Neptune in 2 h 46 min.');
    });

    test('a first visit twelve days ago is far beyond the map', () => {
        const text = lightSentence({ since: 'when you first opened this page, on 30 October 2026,', travelledAU: lightTravelledAU(12 * 86400 * 1000), sorted, edge });
        expect(text).toContain('on 30 October 2026, has travelled 2,078 AU.');
        expect(text).toContain('It is 44 times further out than 2026 ED138, the furthest thing on the map.');
        expect(text).toContain('It will be 1.55 years before it reaches');
    });

    test('just past the furthest thing it does not claim a multiple', () => {
        expect(lightSentence({ since: 'x', travelledAU: 60, sorted, edge })).toContain('It has passed 2026 ED138, the furthest thing on the map.');
    });

    test('after a year and seven months it has left the page', () => {
        expect(lightSentence({ since: 'x', travelledAU: SCOPE_AU + 1, sorted, edge })).toContain("It has gone beyond this page's outer limit, 100,000 AU from the Sun.");
    });
});

describe("A card's Sunlight line", () => {
    const earth = { x: 1, y: 0, z: 0 };

    test('out to the object, then back to Earth', () => {
        /* 47.23 AU from the Sun; 46.23 AU from Earth on the same side. */
        expect(sunlightText({ x: 47.23, y: 0, z: 0 }, earth))
            .toBe('reaches it in 6 h 33 min, and takes 6 h 24 min more to come back to Earth: we see it as it was 6 h 24 min ago');
    });

    test('the distance is the true one, out of the plane too', () => {
        expect(sunlightText({ x: 3, y: 4, z: 12 }, null)).toBe(`reaches it in ${durationText(13 * LIGHT_SECONDS_PER_AU)}`);
    });

    test('Earth has no way back', () => {
        expect(sunlightText(earth, earth)).toBe('reaches it in 8 min 19 s');
    });

    test('nor has the Moon, a second or so away', () => {
        expect(sunlightText({ x: 1.0026, y: 0, z: 0 }, earth)).toMatch(/^reaches it in 8 min 2\d s$/);
    });
});

describe('The ruler', () => {
    test('runs from a thousandth of an AU to the far end, a decade a step', () => {
        expect(rulerFraction(RULER_FROM_AU, SCOPE_AU)).toBe(0);
        expect(rulerFraction(SCOPE_AU, SCOPE_AU)).toBe(1);
        expect(rulerFraction(1, SCOPE_AU)).toBeCloseTo(3 / 8, 9);
        expect(rulerFraction(10, SCOPE_AU) - rulerFraction(1, SCOPE_AU)).toBeCloseTo(1 / 8, 9);
    });

    test('is held to its ends', () => {
        expect(rulerFraction(0, SCOPE_AU)).toBe(0);
        expect(rulerFraction(5e6, SCOPE_AU)).toBe(1);
    });
});

describe('Remembering the first visit', () => {
    const now = Date.UTC(2026, 10, 11, 12);

    test('nothing stored: the first visit is now', () => {
        expect(firstVisit(null, now)).toBe(now);
    });

    test('a stored time is kept', () => {
        expect(firstVisit(String(now - 86400000), now)).toBe(now - 86400000);
    });

    test.each([['rubbish'], [''], ['-4'], ['0'], [String(now + 5000)]])('"%s" starts again', (stored) => {
        expect(firstVisit(stored, now)).toBe(now);
    });

    test('a second ring appears once the older light has a minute on the new', () => {
        expect(hasEarlierVisit(now, now)).toBe(false);
        expect(hasEarlierVisit(now - SECOND_RING_AFTER_MS + 1, now)).toBe(false);
        expect(hasEarlierVisit(now - SECOND_RING_AFTER_MS, now)).toBe(true);
    });
});

describe('Finding the light', () => {
    const limits = { fitScale: 3.5, maxZoom: 50000 };

    test('the ring fills about a third of the map', () => {
        expect(scaleToShow(1, 750, limits)).toBeCloseTo(225, 9);
    });

    test('never past the closest zoom, even in the first instant', () => {
        expect(scaleToShow(0, 750, limits)).toBe(3.5 * 50000);
    });

    test('never wider than the whole map', () => {
        expect(scaleToShow(5000, 750, limits)).toBe(3.5);
    });
});

describe('The page', () => {
    test('light.js is pure: no DOM, no clock, no network', () => {
        const source = readFileSync(resolve(root, 'js/light.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        expect(source).not.toMatch(/document|window|localStorage|Date\.now|new Date|fetch\(/);
    });

    test('the service worker keeps it for offline visits', () => {
        expect(readFileSync(resolve(root, 'sw.js'), 'utf8')).toContain('/js/light.js');
    });

    test('the first visit stays in the browser: the page sends nothing', () => {
        const page = readFileSync(resolve(root, 'rubin/rubin.js'), 'utf8');
        expect(page).toContain("'rubin-first-visit'");
        expect(page).not.toMatch(/sendBeacon|XMLHttpRequest|method:\s*'POST'/);
    });
});
