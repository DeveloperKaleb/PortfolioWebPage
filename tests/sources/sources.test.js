import { describe, test, expect } from 'vitest';
import {
    packDesignation, provisionalFrom, jplCountUrl, jplPageUrl, parseJplPage, fetchTnos, finkUrl, FINK_COLUMNS,
    unresolvedIn, fetchDetections, abMagnitude, usable, bandH, visualH, H_FLOOR, UNKNOWN_COLOUR_ERR,
} from '../../js/sources.js';
import { GONGGONG_DETECTIONS, JPL_PAGE, JPL_COUNT, FINK_UNRESOLVED, GONGGONG_PUBLISHED_HV } from './fixtures.js';

/* A stand-in for the courtesy layer: answers from a function, logs the URLs. */
function fakePolite(answer) {
    const urls = [];
    const polite = async (url) => {
        urls.push(url);
        const { status = 200, body } = answer(url, urls.length);
        return { status, ok: status >= 200 && status < 300, body };
    };
    return { polite, urls };
}

describe('Packed designations', () => {
    test.each([
        ['90377', '90377'],
        ['15760', '15760'],
        ['136199', 'D6199'],
        ['225088', 'M5088'],
        ['620000', '~0000'],
        ['2007 OR10', 'K07O10R'], // as Fink itself returned it
        ['2003 UB313', 'K03UV3B'],
        ['2010 BK118', 'K10BB8K'],
        ['1992 QB1', 'J92Q01B'],
    ])('%s packs to %s', (plain, packed) => expect(packDesignation(plain)).toBe(packed));

    test('refuses what it cannot pack rather than guessing', () => {
        expect(() => packDesignation('P-L 2040')).toThrow(RangeError);
    });

    test('finds the provisional designation in a JPL full name', () => {
        expect(provisionalFrom(' 225088 Gonggong (2007 OR10)', '225088')).toBe('2007 OR10');
        expect(provisionalFrom('       (2010 BK118)', '2010 BK118')).toBe('2010 BK118');
    });
});

describe('JPL', () => {
    test('asks for full precision, only TNOs, in pages', () => {
        const url = new URL(jplPageUrl({ limit: 2500, from: 5000 }));
        expect(url.searchParams.get('full-prec')).toBe('1');
        expect(url.searchParams.get('sb-class')).toBe('TNO');
        expect(url.searchParams.get('limit-from')).toBe('5000');
        expect(new URL(jplCountUrl()).searchParams.get('fields')).toBeNull();
    });

    test('reads a recorded page, keeping full precision', () => {
        const [albion] = parseJplPage(JPL_PAGE);
        expect(albion).toMatchObject({ designation: '15760', provisional: '1992 QB1', H: 7.18 });
        expect(albion.elements.a).toBe(44.13128015101105);
        expect(albion.elements.epoch).toBe(2461200.5);
    });

    test('a quiet week costs one request: an unchanged count stops there', async () => {
        const { polite, urls } = fakePolite(() => ({ body: JPL_COUNT }));
        expect(await fetchTnos(polite, { previousCount: 7293 })).toBeNull();
        expect(urls).toHaveLength(1);
    });

    test('a changed count fetches every page', async () => {
        const { polite, urls } = fakePolite((url) => (url.includes('fields') ? { body: JPL_PAGE } : { body: JPL_COUNT }));
        const result = await fetchTnos(polite, { previousCount: 7000, pageSize: 2500 });
        expect(result.count).toBe(7293);
        expect(urls).toHaveLength(1 + 3);
    });
});

describe('Fink', () => {
    test('asks for only the columns it uses', () => {
        const url = new URL(finkUrl(['M5088', 'D6199']));
        expect(url.searchParams.get('columns').split(',')).toEqual(FINK_COLUMNS);
        expect(url.searchParams.get('n_or_d')).toBe('M5088,D6199');
    });

    test('names the object Fink could not resolve', () => {
        expect(unresolvedIn(FINK_UNRESOLVED)).toBe('50000');
    });

    test('sets aside an object Fink cannot resolve and asks again for the rest', async () => {
        const objects = [
            { packed: '50000', provisional: '2002 LM60', designation: '50000' },
            { packed: 'M5088', provisional: '2007 OR10', designation: '225088' },
        ];
        const { polite, urls } = fakePolite((url) => (url.includes('50000')
            ? { status: 400, body: FINK_UNRESOLVED }
            : { body: JSON.stringify(GONGGONG_DETECTIONS) }));
        const { byProvisional, unresolved } = await fetchDetections(polite, objects);
        expect(unresolved.map((o) => o.designation)).toEqual(['50000']);
        expect(byProvisional.get('2007 OR10')).toHaveLength(GONGGONG_DETECTIONS.length);
        expect(urls).toHaveLength(2);
    });

    test('asks in batches', async () => {
        const objects = Array.from({ length: 250 }, (_, k) => ({ packed: String(10000 + k), provisional: `x${k}`, designation: String(k) }));
        const { polite, urls } = fakePolite(() => ({ body: '[]' }));
        await fetchDetections(polite, objects, { batchSize: 100 });
        expect(urls).toHaveLength(3);
    });

    test('stops on a rejection it cannot explain', async () => {
        const { polite } = fakePolite(() => ({ status: 400, body: 'nope' }));
        await expect(fetchDetections(polite, [{ packed: 'M5088', provisional: '2007 OR10' }])).rejects.toThrow(/without naming/);
    });
});

describe('Photometry', () => {
    test('Rubin fluxes are nanojanskys on the AB scale', () => {
        expect(abMagnitude(3631e9)).toBeCloseTo(0, 2); // 3631 Jy is AB magnitude zero
    });

    test('drops flagged, saturated, withdrawn, unreliable and non-positive detections', () => {
        const good = GONGGONG_DETECTIONS[0];
        expect(usable(good)).toBe(true);
        expect(usable({ ...good, 'r:psfFlux_flag': true })).toBe(false);
        expect(usable({ ...good, 'r:pixelFlags_saturatedCenter': true })).toBe(false);
        expect(usable({ ...good, 'r:timeWithdrawnMjdTai': 61300 })).toBe(false);
        expect(usable({ ...good, 'r:reliability': 0.1 })).toBe(false);
        expect(usable({ ...good, 'r:psfFlux': -5 })).toBe(false);
    });

    test("reduces Gonggong's detections to an H in each band Rubin saw", () => {
        const bands = bandH(GONGGONG_DETECTIONS);
        expect(Object.keys(bands).sort()).toEqual(['i', 'r', 'z']);
        expect(bands.r.n).toBe(2);
        expect(bands.r.errH).toBeGreaterThanOrEqual(H_FLOOR);
        // Redder bands brighter: Gonggong is one of the reddest TNOs.
        expect(bands.z.H).toBeLessThan(bands.i.H);
        expect(bands.i.H).toBeLessThan(bands.r.H);
    });

    test("gives Gonggong a visual H within its uncertainty of the published value", () => {
        const v = visualH(bandH(GONGGONG_DETECTIONS));
        expect(v.from).toMatch(/typical/);
        expect(Math.abs(v.H - GONGGONG_PUBLISHED_HV)).toBeLessThan(1.5 * v.errH);
    });

    test('uses g and r together when it has both', () => {
        const v = visualH({ g: { H: 5.0, errH: 0.05 }, r: { H: 4.4, errH: 0.05 } });
        expect(v.H).toBeCloseTo(5.0 - 0.59 * 0.6 - 0.01, 10);
        expect(v.from).toMatch(/Jester/);
    });

    test('adds the unknown colour to the uncertainty when it has only r', () => {
        const v = visualH({ r: { H: 4.4, errH: 0.05 } });
        expect(v.errH).toBeCloseTo(Math.hypot(0.05, UNKNOWN_COLOUR_ERR), 10);
    });

    test('says so when it cannot convert, so the caller falls back to the catalogue', () => {
        expect(visualH({ i: { H: 4, errH: 0.1 } })).toBeNull();
        expect(visualH({})).toBeNull();
    });
});
