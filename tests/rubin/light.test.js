import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    AU_KM, LIGHT_SECONDS_PER_AU, lightTravelledAU, lightSeconds, durationText, distanceText, milestones, lightProgress,
    lightSentence, sunlightText, RULER_FROM_AU, rulerFraction, fromStarFraction, rulerTicks, unseenStretch, CENTAURI, UNSEEN_FROM_AU, UNSEEN_TEXT, firstVisit, hasEarlierVisit, SECOND_RING_AFTER_MS, scaleToShow, lightTickMs,
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

    test('says how long ago the light left, when told', () => {
        expect(lightSentence({ since: 'as you opened this page', elapsedSeconds: 10, travelledAU: lightTravelledAU(10000), sorted, edge }))
            .toMatch(/^Light that left the Sun 10 s ago, as you opened this page, has travelled 2,997,925 km\. It reaches Earth in 8 min 4 s\./);
        expect(lightSentence({ since: 'when you first opened this page on 30 October 2026', elapsedSeconds: 12 * 86400 + 3 * 3600, travelledAU: 2100, sorted, edge }))
            .toMatch(/^Light that left the Sun 12 days 3 h ago, when you first opened this page on 30 October 2026, has travelled 2,100 AU\./);
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

describe('The ruler, from the Sun to Alpha Centauri', () => {
    const D = CENTAURI.distanceAU;

    test('starts a thousandth of an AU from the Sun and ends 1 AU from the centre of Alpha Centauri A and B', () => {
        expect(rulerFraction(RULER_FROM_AU)).toBe(0);
        expect(rulerFraction(D)).toBe(1);
        expect(fromStarFraction(CENTAURI.floorAU)).toBe(1);
    });

    test('is held to its ends', () => {
        expect(rulerFraction(0)).toBe(0);
        expect(rulerFraction(5e6)).toBe(1);
        expect(fromStarFraction(0)).toBe(1);
    });

    test('from the Sun, each step is ten times further', () => {
        const step = rulerFraction(10) - rulerFraction(1);
        expect(step).toBeGreaterThan(0);
        expect(rulerFraction(1000) - rulerFraction(100)).toBeCloseTo(step, 12);
        expect(rulerFraction(0.01) - rulerFraction(RULER_FROM_AU)).toBeCloseTo(step, 12);
    });

    test('from the star, each step is ten times further too, and the same size', () => {
        const step = rulerFraction(10) - rulerFraction(1);
        expect(fromStarFraction(1) - fromStarFraction(10)).toBeCloseTo(step, 12);
        expect(fromStarFraction(1000) - fromStarFraction(10000)).toBeCloseTo(step, 12);
    });

    test('the two scales meet halfway between the stars, with no jump', () => {
        expect(rulerFraction(D / 2)).toBeCloseTo(fromStarFraction(D / 2), 12);
        expect(rulerFraction(D / 2 + 1) - rulerFraction(D / 2 - 1)).toBeLessThan(1e-4);
    });

    test('further from the Sun is never further left', () => {
        let last = -1;
        for (let au = RULER_FROM_AU; au < D; au *= 1.37) {
            const at = rulerFraction(au);
            expect(at).toBeGreaterThanOrEqual(last);
            last = at;
        }
        expect(rulerFraction(D - 2)).toBeGreaterThan(rulerFraction(D - 500));
    });

    test('a place is the same whichever star it is measured from', () => {
        expect(rulerFraction(D - 12050)).toBeCloseTo(fromStarFraction(12050), 12);
    });

    test('light takes 4.34 years to reach the far end', () => {
        const years = D * LIGHT_SECONDS_PER_AU / (365.25 * 86400);
        expect(years).toBeCloseTo(4.344, 2);
        expect(rulerFraction(lightTravelledAU(4.4 * 365.25 * 86400 * 1000))).toBe(1);
        expect(rulerFraction(lightTravelledAU(4.3 * 365.25 * 86400 * 1000))).toBeLessThan(1);
    });

    test('a tick at each power of ten from either end, all on the ruler', () => {
        const ticks = rulerTicks();
        expect(ticks).toHaveLength(9 + 6);
        ticks.forEach((at) => { expect(at).toBeGreaterThanOrEqual(0); expect(at).toBeLessThanOrEqual(1); });
        expect(ticks).toContain(0);
        expect(ticks).toContain(1);
        expect(ticks.some((at) => Math.abs(at - rulerFraction(1)) < 1e-12)).toBe(true);
        expect(ticks.some((at) => Math.abs(at - fromStarFraction(1)) < 1e-12)).toBe(true);
    });

    test('the hatching runs from 1,000 AU to Proxima, the outermost known body of the other system', () => {
        const [from, to] = unseenStretch();
        expect(UNSEEN_FROM_AU).toBe(1000);
        expect(from).toBe(rulerFraction(1000));
        expect(to).toBe(fromStarFraction(CENTAURI.proxima.fromCentreAU));
        expect(to).toBeGreaterThan(from);
        /* Everything named on the ruler is outside it. */
        expect(rulerFraction(30.1)).toBeLessThan(from);
        expect(fromStarFraction(36)).toBeGreaterThan(to);
    });

    test("the hatching's words are the owner's, to the letter", () => {
        expect(UNSEEN_TEXT).toBe('More science needed (MOSTLY BIGGER TELESCOPES)');
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

describe('When the light is next worth drawing', () => {
    const MINUTE = 60000;

    test('four times a second while something is visibly moving', () => {
        expect(lightTickMs({ ages: [10 * MINUTE], pxPerSecond: 3 })).toBe(250);
        expect(lightTickMs({ ages: [10 * MINUTE], pxPerSecond: 0.25 })).toBe(250);
    });

    test('four times a second while a distance is still in kilometres', () => {
        expect(distanceText(lightTravelledAU(40000))).toMatch(/km$/);
        expect(lightTickMs({ ages: [40000], pxPerSecond: 0 })).toBe(250);
        expect(lightTickMs({ ages: [10 * MINUTE, 40000], pxPerSecond: 0 })).toBe(250);
    });

    test('otherwise just after the words next change', () => {
        /* 10 min 0.2 s old reads "10 min 0 s"; it reads "10 min 1 s" from 10 min 0.5 s. */
        const age = 10 * MINUTE + 200;
        const wait = lightTickMs({ ages: [age], pxPerSecond: 0.01 });
        expect(wait).toBe(305);
        expect(durationText((age + wait - 10) / 1000)).toBe('10 min 0 s');
        expect(durationText((age + wait) / 1000)).toBe('10 min 1 s');
    });

    test('every second shown is drawn: no wait skips one', () => {
        for (let age = 5 * MINUTE; age < 5 * MINUTE + 3000; age += 37) {
            const wait = lightTickMs({ ages: [age], pxPerSecond: 0 });
            expect(wait).toBeGreaterThan(0);
            expect(wait).toBeLessThanOrEqual(1005);
            expect(Math.round((age + wait) / 1000) - Math.round(age / 1000)).toBe(1);
        }
    });

    test('with two lights counted in seconds, the sooner change wins', () => {
        expect(lightTickMs({ ages: [10 * MINUTE + 200, 20 * MINUTE + 400], pxPerSecond: 0 })).toBe(105);
    });

    test('a light counted in hours or days does not set the pace', () => {
        const days = 3 * 24 * 60 * MINUTE + 480;
        expect(lightTickMs({ ages: [10 * MINUTE + 200, days], pxPerSecond: 0 })).toBe(305);
        expect(lightTickMs({ ages: [days], pxPerSecond: 0 })).toBe(1000);
    });

    test('ten seconds for a visitor who asked for less motion, whatever is moving', () => {
        expect(lightTickMs({ ages: [1000], pxPerSecond: 50, reduced: true })).toBe(10000);
    });

    test('never faster than before, never slower than a second without that request', () => {
        for (const age of [0, 499, 500, 60000, 3599400, 3600000, 1e9]) {
            const wait = lightTickMs({ ages: [age], pxPerSecond: 0 });
            expect(wait).toBeGreaterThan(0);
            expect(wait).toBeLessThanOrEqual(1005);
        }
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
