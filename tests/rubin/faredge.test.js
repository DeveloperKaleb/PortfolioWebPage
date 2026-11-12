import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    CUTS, TRUSTED, isTrusted, inCut, longAxis, foundYear, groups, MIN_SAMPLE, bunching, groupBunching, oneMore, split,
    backfill, weekPoint, appendHistory, PASSING_STAR, isPfalznerSednaLike, isBackwards, shares, BIAS_WARNING, shareText,
    chanceText, bunchingText, oneMoreText, splitText, waitingText, PUBLISHED, EXPLANATIONS,
    PLANET_MASS, sunFromCentre, aboutCentre, fromCatalogue, shortName, buildSection, emptyStore, RUBIN_FROM,
    thinText, splitNamesText, waitingCountText, sharesText, evidenceText, publishedText, DIAL, dialRadius, dialXY, yearFraction,
} from '../../js/faredge.js';
import { parseJplPage } from '../../js/sources.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collect, recordedPolite } from '../../tools/rubin-collect.mjs';

const root = resolve(__dirname, '../..');

/* Every object JPL listed on 2026-11-12 with a > 150 au and q > 30 au on its Sun-centred
   orbit (sbdb_query.api, full precision, the collector's own fields), as recorded. */
const CATALOGUE = parseJplPage(readFileSync(resolve(__dirname, 'faredge-jpl.json'), 'utf8'));
const JPL = CATALOGUE.map(fromCatalogue);
const named = (part) => JPL.find((o) => o.name.includes(part));

/* JPL Horizons, 2026-11-12: osculating elements about the Solar System barycentre
   (CENTER 500@0, ecliptic J2000) at JD 2461200.5, a and q turned from km to AU. */
const HORIZONS = {
    Sedna: { a: 506.443, q: 76.192, e: 0.8495557, i: 11.92852, om: 144.40158, w: 311.28476 },
    '2012 VP113': { a: 262.328, q: 80.517, e: 0.6930662, i: 24.05220, om: 90.80236, w: 293.89690 },
    '2023 KQ14': { a: 252.116, q: 65.897, e: 0.7386247, i: 10.98019, om: 72.10407, w: 198.73700 },
    '2015 TG387': { a: 1212.142, q: 64.766, e: 0.9465688, i: 11.67012, om: 300.98063, w: 118.25717 },
    '2013 SY99': { a: 742.004, q: 49.946, e: 0.9326883, i: 4.22553, om: 29.50888, w: 32.19450 },
    '2021 RR205': { a: 988.548, q: 55.546, e: 0.9438110, i: 7.64334, om: 108.34270, w: 208.59107 },
};

describe('Orbits about the centre of mass', () => {
    test.each(Object.entries(HORIZONS))('%s matches JPL Horizons', (name, hz) => {
        const ours = named(name);
        expect(Math.abs(ours.a - hz.a) / hz.a).toBeLessThan(0.0002);
        expect(ours.q).toBeCloseTo(hz.q, 2);
        expect(ours.e).toBeCloseTo(hz.e, 5);
        expect(ours.i).toBeCloseTo(hz.i, 3);
        expect(ours.om).toBeCloseTo(hz.om, 2);
        expect(ours.w).toBeCloseTo(hz.w, 2);
    });

    test("Sedna's long way across: 544 AU by the catalogue, 506 about the centre of mass", () => {
        const sedna = CATALOGUE.find((o) => o.fullName.includes('Sedna'));
        expect(sedna.elements.a).toBeCloseTo(543.7, 1);
        expect(aboutCentre(sedna.elements).a).toBeCloseTo(506.4, 0);
    });

    test('2023 KQ14 is 252 au, as its discoverers give it (Chen et al. 2025: 251.9)', () => {
        expect(named('2023 KQ14').a).toBeCloseTo(252, 0);
    });

    test('the Sun is never far from the centre: about its own width or two', () => {
        const sun = sunFromCentre(2461200.5);
        const offset = Math.hypot(...sun.r);
        expect(offset).toBeGreaterThan(0.001);
        expect(offset).toBeLessThan(0.012);
        expect(Object.keys(PLANET_MASS)).toHaveLength(8);
    });

    test('an object with a missing element, or an unbound orbit, falls outside every cut', () => {
        const blank = fromCatalogue({ fullName: '(2026 XX1)', designation: '2026 XX1', elements: { a: 300, e: 0.8, i: 5, om: 1, w: 2, ma: null, epoch: 2461200.5 }, quality: null });
        expect(Number.isNaN(blank.a)).toBe(true);
        expect(groups([blank]).wide).toHaveLength(0);
        expect(groups([blank]).waiting).toHaveLength(0);
        const unbound = fromCatalogue({ fullName: 'x', designation: 'x', elements: { a: -300, e: 1.2, i: 5, om: 1, w: 2, ma: 3, epoch: 2461200.5 }, quality: { arcDays: 900, conditionCode: 1 } });
        expect(groups([unbound]).wide).toHaveLength(0);
    });
});

describe('Who counts', () => {
    test('the cuts are the published ones, dated', () => {
        expect(CUTS.set).toBe('2026-11-12');
        /* Brown & Batygin 2021: 150 < a < 1000 AU, q > 42 AU. */
        expect(CUTS.extreme).toEqual({ aMin: 150, aMax: 1000, qMin: 42 });
        /* Chen et al. 2025: a > 200 au, q > 60 au. */
        expect(CUTS.sednaLike).toMatchObject({ aMin: 200, qMin: 60 });
        /* Shankman et al. 2017: a > 150 au, q > 30 au. */
        expect(CUTS.wide).toMatchObject({ aMin: 150, qMin: 30 });
    });

    test('a trusted orbit has a year of observations and a usable fit', () => {
        expect(isTrusted({ arcDays: TRUSTED.minArcDays, conditionCode: TRUSTED.maxConditionCode })).toBe(true);
        expect(isTrusted({ arcDays: 364, conditionCode: 2 })).toBe(false);
        expect(isTrusted({ arcDays: 4000, conditionCode: 7 })).toBe(false);
        expect(isTrusted({ arcDays: 4000, conditionCode: null })).toBe(false);
        expect(isTrusted({ arcDays: null, conditionCode: 2 })).toBe(false);
    });

    test('Sedna is extreme and Sedna-like', () => {
        const sedna = named('Sedna');
        expect(inCut(sedna, CUTS.extreme)).toBe(true);
        expect(inCut(sedna, CUTS.sednaLike)).toBe(true);
    });

    test('Leleakuhonua is Sedna-like but too large an orbit for the extreme group, as in the 2021 paper', () => {
        const lele = named('Leleakuhonua');
        expect(lele.a).toBeGreaterThan(1000);
        expect(inCut(lele, CUTS.extreme)).toBe(false);
        expect(inCut(lele, CUTS.sednaLike)).toBe(true);
    });

    test('the groups on the trial date', () => {
        const g = groups(JPL);
        expect(g.extreme).toHaveLength(18);
        expect(g.sednaLike.map((o) => foundYear(o.name)).sort()).toEqual([2003, 2012, 2015, 2023]);
        expect(g.wide).toHaveLength(58);
        expect(g.waiting).toHaveLength(52);
        expect(g.waitingExtreme).toHaveLength(9);
    });

    test('nothing waiting is ever in a group that is drawn', () => {
        const g = groups(JPL);
        [...g.extreme, ...g.sednaLike, ...g.wide].forEach((o) => expect(isTrusted(o)).toBe(true));
        g.waiting.forEach((o) => expect(isTrusted(o)).toBe(false));
    });
});

describe('Which way an orbit points', () => {
    test('the long axis is the node plus the argument of perihelion, within a turn', () => {
        expect(longAxis({ om: 300.98, w: 118.2 })).toBeCloseTo(59.18, 2);
        expect(shortName(' 90377 Sedna (2003 VB12)')).toBe('Sedna');
        expect(shortName('       (2012 VP113)')).toBe('2012 VP113');
        expect(shortName('148209 (2000 CR105)')).toBe('2000 CR105');
        expect(shortName('541132 Leleakuhonua (2015 TG387)')).toBe('Leleakuhonua');
        expect(longAxis({ om: 10, w: 20 })).toBe(30);
    });

    test("2023 KQ14 points about 271 degrees, opposite the other Sedna-like objects (Chen et al. 2025)", () => {
        expect(longAxis(named('2023 KQ14'))).toBeCloseTo(271, 0);
    });

    test.each([
        ['90377 Sedna (2003 VB12)', 2003],
        ['(2012 VP113)', 2012],
        ['541132 Leleakuhonua (2015 TG387)', 2015],
        ['148209 (2000 CR105)', 2000],
        ['(1999 DE9)', 1999],
        ['Pluto', null],
    ])('%s was found in %s', (name, year) => {
        expect(foundYear(name)).toBe(year);
    });
});

/* A small seeded generator, so the random checks are the same on every run. */
function seeded(seed) {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

describe('How bunched', () => {
    test('all the same way is 1', () => {
        const b = bunching([40, 40, 40, 40, 40]);
        expect(b.r).toBeCloseTo(1, 12);
        expect(b.toward).toBeCloseTo(40, 9);
    });

    test('evenly spread is 0 and points nowhere', () => {
        const b = bunching([0, 72, 144, 216, 288]);
        expect(b.r).toBeCloseTo(0, 12);
        expect(b.toward).toBeNull();
        expect(b.p).toBeCloseTo(1, 6);
    });

    test('the mean direction crosses north correctly', () => {
        expect(bunching([350, 10, 355, 5, 0]).toward % 360).toBeCloseTo(0, 6);
    });

    test('two opposite pairs cancel', () => {
        expect(bunching([10, 190, 100, 280, 55, 235]).r).toBeCloseTo(0, 12);
    });

    test('nothing in, nothing out', () => {
        expect(bunching([])).toEqual({ n: 0, r: null, toward: null, p: null });
    });

    test(`under ${MIN_SAMPLE} directions there is a figure but no chance`, () => {
        const b = bunching([10, 20, 30, 40]);
        expect(b.r).toBeGreaterThan(0.9);
        expect(b.p).toBeNull();
    });

    /* The chance figure against brute force: random directions, counted. */
    test.each([[6, 0.6], [11, 0.5], [18, 0.38], [18, 0.2], [40, 0.3]])('the chance for %d directions bunched at %d matches random draws', (n, r) => {
        const random = seeded(n * 1000 + Math.round(r * 100));
        const trials = 40000;
        let asBunched = 0;
        for (let t = 0; t < trials; t++) {
            let c = 0;
            let s = 0;
            for (let k = 0; k < n; k++) { const a = random() * 2 * Math.PI; c += Math.cos(a); s += Math.sin(a); }
            if (Math.hypot(c, s) / n >= r) asBunched++;
        }
        const R = n * r;
        const formula = Math.exp(Math.sqrt(1 + 4 * n + 4 * (n * n - R * R)) - (1 + 2 * n));
        expect(formula).toBeGreaterThan(asBunched / trials - 0.012);
        expect(formula).toBeLessThan(asBunched / trials + 0.012);
    });

    test('the extreme group on the trial date: 0.38 toward 38 degrees, about 7% by chance', () => {
        const { axes, tilts } = groupBunching(groups(JPL).extreme);
        expect(axes.n).toBe(18);
        expect(axes.r).toBeCloseTo(0.383, 3);
        expect(axes.toward).toBeCloseTo(38.1, 0);
        expect(axes.p).toBeCloseTo(0.07, 2);
        expect(tilts.r).toBeCloseTo(0.357, 3);
        expect(tilts.p).toBeCloseTo(0.100, 3);
    });
});

describe('How thin the sample is', () => {
    test('one more with the group raises it, one against lowers it', () => {
        const angles = groups(JPL).extreme.map(longAxis);
        const next = oneMore(angles);
        expect(next.withGroup.n).toBe(19);
        expect(next.withGroup.r).toBeCloseTo(0.416, 3);
        expect(next.against.r).toBeCloseTo(0.310, 3);
    });

    test('the arithmetic, by hand: n objects at r, plus one along the mean, is (nr + 1) / (n + 1)', () => {
        const angles = [0, 30, 60, 200, 310, 20];
        const now = bunching(angles);
        const next = oneMore(angles);
        expect(next.withGroup.r).toBeCloseTo((now.n * now.r + 1) / (now.n + 1), 12);
        expect(next.against.r).toBeCloseTo(Math.abs(now.n * now.r - 1) / (now.n + 1), 12);
    });

    test('a sample with no direction has nothing to add to', () => {
        expect(oneMore([0, 72, 144, 216, 288])).toBeNull();
        expect(oneMoreText([0, 72, 144, 216, 288])).toBeNull();
    });
});

describe('The Sedna-like objects', () => {
    test('three point together and 2023 KQ14 away', () => {
        const s = split(groups(JPL).sednaLike);
        expect(s.together).toHaveLength(3);
        expect(s.apart).toEqual(['(2023 KQ14)']);
    });

    test('the page can give them their display names', () => {
        const labels = { 2003: 'Sedna', 2012: '2012 VP113', 2015: 'Leleakuhonua', 2023: '2023 KQ14' };
        const members = groups(JPL).sednaLike.map((o) => ({ ...o, label: labels[foundYear(o.name)] }));
        expect(splitText(members)).toBe('Of the 4 Sedna-like objects, 3 point roughly the same way (Sedna, Leleakuhonua and 2012 VP113) and 1 points away from them (2023 KQ14).');
    });

    test('none yet, and all agreeing', () => {
        expect(splitText([])).toBe('No Sedna-like object has a trusted orbit yet.');
        expect(splitText([{ name: 'A', om: 10, w: 0 }, { name: 'B', om: 30, w: 0 }])).toBe('All 2 Sedna-like objects point roughly the same way (A and B).');
    });
});

describe('The history', () => {
    const extreme = groups(JPL).extreme;

    test('hindsight: a point a year, counting only what had been found', () => {
        const points = backfill(extreme, 2003, 2026);
        expect(points).toHaveLength(24);
        expect(points[0]).toEqual({ year: 2003, n: 2, r: null, p: null });
        expect(points.at(-1).n).toBe(18);
        expect(points.at(-1).r).toBeCloseTo(0.383, 3);
        points.forEach((p, k) => { if (k) expect(p.n).toBeGreaterThanOrEqual(points[k - 1].n); });
    });

    test('no figure until there are enough objects', () => {
        backfill(extreme, 2003, 2026).forEach((p) => expect(p.r === null).toBe(p.n < MIN_SAMPLE));
    });

    /* The year the hidden planet was proposed, the 13 extreme objects then known were
       bunched at 0.66; the five found since have brought it to 0.38. */
    test('the bunching was strongest in 2016 and has fallen as objects were added', () => {
        const points = backfill(extreme, 2003, 2026);
        const peak = points.reduce((best, p) => ((p.r ?? 0) > (best.r ?? 0) && p.n >= 10 ? p : best), { r: 0 });
        expect(peak.year).toBe(2016);
        expect(peak.n).toBe(13);
        expect(peak.r).toBeCloseTo(0.66, 2);
    });

    test("one week's point", () => {
        expect(weekPoint('2026-11-11', JPL)).toEqual({
            date: '2026-11-11',
            cuts: '2026-11-12',
            extreme: { n: 18, r: 0.383, toward: 38, p: 0.07, tiltR: 0.357, tiltP: 0.1 },
            wide: { n: 58, r: 0.243 },
            sednaLike: { together: 3, apart: 1 },
            waiting: 52,
        });
    });

    test('the history only grows', () => {
        const first = weekPoint('2026-11-16', JPL);
        const second = weekPoint('2026-11-23', JPL);
        const one = appendHistory([], first);
        expect(one).toEqual({ history: [first], restarted: false });
        const two = appendHistory(one.history, second);
        expect(two.history).toEqual([first, second]);
    });

    test('a week already recorded is never rewritten', () => {
        const first = weekPoint('2026-11-16', JPL);
        const later = { ...first, extreme: { ...first.extreme, r: 0.9 } };
        expect(appendHistory([first], later).history).toEqual([first]);
        expect(appendHistory([first], { ...later, date: '2026-11-09' }).history).toEqual([first]);
    });

    test('new cuts restart it, and say so', () => {
        const first = weekPoint('2026-11-16', JPL);
        const recut = { ...weekPoint('2026-11-23', JPL), cuts: '2027-03-01' };
        expect(appendHistory([first], recut)).toEqual({ history: [recut], restarted: true });
    });
});

describe("The passing star's number", () => {
    test('the published prediction', () => {
        expect(PASSING_STAR).toEqual({ sednaLike: { now: 0.001, afterRubin: 0.07 }, backwards: { now: 0.0015, afterRubin: 0.05 } });
    });

    test('Sedna-like by their definition, and backwards', () => {
        expect(isPfalznerSednaLike({ q: 76, e: 0.86 })).toBe(true);
        expect(isPfalznerSednaLike({ q: 76, e: 0.3 })).toBe(false);
        expect(isPfalznerSednaLike({ q: 45, e: 0.86 })).toBe(false);
        expect(isBackwards({ i: 110 })).toBe(true);
        expect(isBackwards({ i: 24 })).toBe(false);
    });

    test('shares of everything asked about', () => {
        const s = shares([{ q: 76, e: 0.86, i: 12 }, { q: 35, e: 0.1, i: 110 }, { q: 40, e: 0.2, i: 5 }, { q: 39, e: 0.2, i: 3 }]);
        expect(s).toEqual({ total: 4, sednaLike: { count: 1, share: 0.25 }, backwards: { count: 1, share: 0.25 } });
        expect(shares([])).toEqual({ total: 0, sednaLike: null, backwards: null });
    });

    test.each([[0, 'none'], [0.00005, 'under 0.01%'], [0.001, '0.10%'], [0.0015, '0.15%'], [0.045, '4.5%'], [0.07, '7.0%'], [0.25, '25%']])('%d reads "%s"', (share, text) => {
        expect(shareText(share)).toBe(text);
    });
});

describe('The words, and the rules they are held to', () => {
    const g = groups(JPL);
    const axes = groupBunching(g.extreme).axes;

    test('the sentence for the extreme group', () => {
        expect(bunchingText(axes, 'long axes', 'extreme')).toBe(
            'The long axes of the 18 extreme objects are bunched at 0.38 on a scale from 0 (none) to 1 (all the same), toward 38°. Directions drawn at random would look at least this bunched about 7% of the time. This simple test ignores where and when telescopes looked, which the published analyses allow for.',
        );
    });

    test('a bunching figure never appears without its count, nor a chance without the warning', () => {
        const random = seeded(7);
        for (let k = 0; k < 50; k++) {
            const n = MIN_SAMPLE + Math.floor(random() * 40);
            const text = bunchingText(bunching(Array.from({ length: n }, () => random() * 360)), 'long axes', 'extreme');
            expect(text).toContain(`the ${n} extreme objects`);
            expect(text).toContain('of the time');
            expect(text).toContain(BIAS_WARNING);
        }
    });

    test('too few objects get no figure at all', () => {
        const text = bunchingText(bunching([10, 20, 30]), 'long axes', 'Sedna-like');
        expect(text).toBe('Only 3 Sedna-like objects have a trusted orbit: too few to measure how bunched their long axes are.');
        expect(text).not.toMatch(/\d\.\d\d/);
    });

    test.each([[0.0683, 'about 7% of the time'], [0.004, 'about 0.4% of the time'], [0.0002, 'less than 0.1% of the time'], [0.37, 'about 37% of the time']])('a chance of %d reads "%s"', (p, text) => {
        expect(chanceText(p)).toBe(text);
    });

    test('how thin the sample is', () => {
        expect(oneMoreText(g.extreme.map(longAxis))).toBe('With 18 objects the sample is thin: one more pointing with the group would make it 0.42, one pointing the opposite way 0.31.');
    });

    test('the waiting room', () => {
        expect(waitingText(g.waiting)).toBe("52 more objects are waiting: on a distant orbit, but watched for under a year or with an orbit too uncertain to place on the dial. 42 of them were found since 2025, the years of Rubin's first data. As they mature, the dial will change.");
        expect(waitingText([])).toBe('No object is waiting for a longer run of observations.');
    });

    test('every explanation says what it predicts and links its paper', () => {
        expect(EXPLANATIONS).toHaveLength(4);
        EXPLANATIONS.forEach((e) => {
            expect(e.predicts.length).toBeGreaterThan(40);
            expect(e.url).toMatch(/^https:\/\/arxiv\.org\/abs\/\d{4}\.\d{5}$/);
            expect(['axes', 'split', 'shares', 'chance']).toContain(e.evidence);
        });
    });

    /* The only percentages in an explanation are the passing-star paper's own prediction. */
    test('no explanation is given odds', () => {
        EXPLANATIONS.forEach((e) => {
            expect(`${e.name} ${e.predicts}`).not.toMatch(/likel|probab|odds|chance/i);
            if (e.evidence !== 'shares') expect(e.predicts).not.toMatch(/%/);
        });
        const source = readFileSync(resolve(root, 'js/faredge.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        expect(source).not.toMatch(/odds|likelihood|probability that/i);
    });

    test('the published figures sit beside ours, with their papers', () => {
        expect(PUBLISHED.map((p) => [p.year, p.objects, p.chance])).toEqual([[2016, 6, 0.00007], [2017, 8, null], [2019, 14, 0.002], [2021, 14, null], [2021, 11, 0.004]]);
        PUBLISHED.forEach((p) => expect(p.url).toMatch(/^https:\/\/arxiv\.org\/abs\//));
    });

    test('pure: no DOM, no clock, no network', () => {
        const source = readFileSync(resolve(root, 'js/faredge.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        expect(source).not.toMatch(/document|window|localStorage|Date\.now|new Date|fetch\(/);
    });
});

describe('The section, as the digest carries it', () => {
    const first = buildSection({ tnos: CATALOGUE, date: '2026-11-16' });

    test('the dial has every extreme object, and Leleakuhonua marked as outside the group', () => {
        const { objects } = first.section;
        expect(objects.filter((o) => o.extreme)).toHaveLength(18);
        expect(objects.filter((o) => !o.extreme).map((o) => o.name)).toEqual(['Leleakuhonua']);
        expect(objects.filter((o) => o.sednaLike).map((o) => o.name).sort()).toEqual(['2012 VP113', '2023 KQ14', 'Leleakuhonua', 'Sedna']);
        expect(objects.map((o) => o.axis)).toEqual([...objects.map((o) => o.axis)].sort((a, b) => a - b));
        expect(objects.find((o) => o.name === 'Sedna')).toEqual({ designation: '90377', name: 'Sedna', found: 2003, a: 506.4, q: 76.2, i: 11.9, axis: 95.7, node: 144.4, extreme: true, sednaLike: true });
    });

    test('the numbers', () => {
        const s = first.section;
        expect(s.axes).toEqual({ n: 18, r: 0.383, toward: 38, p: 0.0695 });
        expect(s.oneMore).toEqual({ withGroup: 0.416, against: 0.31 });
        expect(s.sednaLike).toEqual({ together: ['Sedna', 'Leleakuhonua', '2012 VP113'], apart: ['2023 KQ14'] });
        expect(s.waiting).toEqual({ count: 52, extreme: 9, recent: 42, since: RUBIN_FROM });
        expect(s.cuts.set).toBe('2026-11-12');
        expect(s.backfill[0]).toEqual({ year: 2003, n: 2, r: null });
        expect(s.backfill.at(-1)).toEqual({ year: 2026, n: 18, r: 0.383 });
    });

    test('the first run starts the history and remembers who was in the group', () => {
        expect(first.restarted).toBe(false);
        expect(first.section.history).toHaveLength(1);
        expect(first.section.history[0].joined).toBeUndefined();
        expect(first.store.members).toHaveLength(18);
        expect(first.store.points).toEqual(first.section.history);
    });

    test('a later run adds a point; the same day again does not', () => {
        const again = buildSection({ tnos: CATALOGUE, date: '2026-11-16', store: first.store });
        expect(again.section.history).toHaveLength(1);
        const next = buildSection({ tnos: CATALOGUE, date: '2026-11-23', store: first.store });
        expect(next.section.history.map((p) => p.date)).toEqual(['2026-11-16', '2026-11-23']);
        expect(next.section.history[0]).toEqual(first.section.history[0]);
    });

    /* A waiting object whose orbit matures: here one is given a long run of observations. */
    test('an object that joins the extreme group is named in that week', () => {
        const waitingOne = CATALOGUE.find((o) => { const c = fromCatalogue(o); return !isTrusted(c) && inCut(c, CUTS.extreme); });
        const matured = CATALOGUE.map((o) => (o === waitingOne ? { ...o, quality: { arcDays: 800, conditionCode: 3, nObs: 40 } } : o));
        const next = buildSection({ tnos: matured, date: '2026-11-23', store: first.store });
        expect(next.section.axes.n).toBe(19);
        expect(next.section.history[1].joined).toEqual([shortName(waitingOne.fullName)]);
        expect(next.section.waiting.count).toBe(51);
    });

    test('history kept under other cuts is not continued', () => {
        const old = { cuts: '2025-01-01', members: ['90377'], points: [{ date: '2026-11-09', cuts: '2025-01-01', extreme: { n: 3 } }] };
        const next = buildSection({ tnos: CATALOGUE, date: '2026-11-16', store: old });
        expect(next.restarted).toBe(true);
        expect(next.section.history).toHaveLength(1);
        expect(next.section.history[0].joined).toBeUndefined();
    });

    test('an empty store is the same as none', () => {
        expect(buildSection({ tnos: CATALOGUE, date: '2026-11-16', store: emptyStore() }).section).toEqual(first.section);
    });
});

describe('The collector', () => {
    const fresh = () => mkdtempSync(join(tmpdir(), 'faredge-'));

    test('a run puts the section in the digest and keeps its history, with no request of its own', async () => {
        const dir = fresh();
        try {
            const before = await recordedPolite();
            const { digest } = await collect({ dataDir: dir, date: new Date('2026-11-16T06:00:00Z'), polite: before });
            expect(digest.farEdge.cuts.set).toBe('2026-11-12');
            expect(digest.farEdge.history).toHaveLength(1);
            const kept = JSON.parse(readFileSync(join(dir, 'far-edge.json'), 'utf8'));
            expect(kept.points).toEqual(digest.farEdge.history);
            expect(digest.notes.join(' ')).not.toMatch(/far-edge/);

            const { digest: later } = await collect({ dataDir: dir, date: new Date('2026-11-23T06:00:00Z'), polite: await recordedPolite() });
            expect(later.farEdge.history.map((p) => p.date)).toEqual(['2026-11-16', '2026-11-23']);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test('the tool asks no service for it', () => {
        const tool = readFileSync(resolve(root, 'tools/rubin-collect.mjs'), 'utf8');
        const block = tool.slice(tool.indexOf('What shaped the far edge?'), tool.indexOf('digest.provenance.sources.requests'));
        expect(block).toContain('buildFarEdge');
        expect(block).not.toMatch(/polite\(|fetch/);
    });
});

describe("The page's words and geometry", () => {
    const { section } = buildSection({ tnos: CATALOGUE, date: '2026-11-16' });

    test('the same sentences from the digest as from the orbits', () => {
        const g = groups(JPL.map((o) => ({ ...o, label: shortName(o.name) })));
        expect(thinText(section.axes.n, section.oneMore)).toBe(oneMoreText(g.extreme.map(longAxis)));
        expect(splitNamesText(section.sednaLike)).toBe(splitText(g.sednaLike));
        expect(waitingCountText(section.waiting)).toBe(waitingText(g.waiting));
        expect(bunchingText(section.axes, 'long axes', 'extreme')).toContain('bunched at 0.38');
    });

    test('too few objects: no thin-sample sentence', () => {
        expect(thinText(3, { withGroup: 0.9, against: 0.4 })).toBeNull();
        expect(thinText(18, null)).toBeNull();
    });

    test("the passing star's count says how it was counted", () => {
        const text = sharesText({ total: 3892, sednaLike: { count: 4, share: 4 / 3892 }, backwards: { count: 39, share: 39 / 3892 } });
        expect(text).toBe("Of the 3,892 objects beyond Neptune with trusted orbits in JPL's list, 4 are Sedna-like (0.10%) and 39 orbit backwards (1.0%). The paper counts differently, so what matters here is whether these shares rise.");
        expect(sharesText({ total: 0 })).toBe('No trusted orbits to count yet.');
    });

    test('every explanation has a measurement beside it, and none a verdict', () => {
        EXPLANATIONS.forEach((e) => {
            const text = evidenceText(e.evidence, section);
            expect(text.length).toBeGreaterThan(20);
            expect(text).not.toMatch(/likel|odds|probab|support|favou?r|rules out/i);
        });
        expect(evidenceText('axes', section)).toBe('Long axes of 18 extreme objects bunched at 0.38; tilts at 0.36.');
        expect(evidenceText('split', section)).toMatch(/^3 of 4 Sedna-like objects point together today, 1 away\./);
    });

    test('the published results, each in a line', () => {
        expect(publishedText(PUBLISHED[0])).toBe('Batygin & Brown (2016), 6 objects: bunched; chance of a fluke under 0.01%');
        expect(publishedText(PUBLISHED[1])).toBe('Shankman et al. (OSSOS) (2017), 8 objects: consistent with random directions');
        expect(publishedText(PUBLISHED[4])).toBe('Brown & Batygin (2021), 11 objects: bunched; chance of a fluke 0.40%');
    });

    test('the dial: larger orbits further out, all within the rim', () => {
        expect(dialRadius(DIAL.fromAU)).toBeCloseTo(DIAL.inner, 12);
        expect(dialRadius(DIAL.toAU)).toBe(1);
        expect(dialRadius(50000)).toBe(1);
        expect(dialRadius(10)).toBe(DIAL.inner);
        expect(dialRadius(506)).toBeGreaterThan(dialRadius(262));
        section.objects.forEach((o) => expect(dialRadius(o.a)).toBeLessThanOrEqual(1));
    });

    test('the dial turns the way the map does: 0 to the right, 90 up', () => {
        const [x0, y0] = dialXY(0, 1, 100);
        expect([x0, Math.abs(y0)]).toEqual([100, 0]);
        const [x90, y90] = dialXY(90, 1, 100);
        expect(x90).toBeCloseTo(0, 9);
        expect(y90).toBeCloseTo(-100, 9);
    });

    test('a date along the time axis', () => {
        expect(yearFraction('2026-01-01')).toBe(2026);
        expect(yearFraction('2026-11-16')).toBeCloseTo(2026.874, 2);
    });
});
