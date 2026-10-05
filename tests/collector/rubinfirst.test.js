import { describe, test, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    equatorialToEcliptic, elementsFromState, rubinState, positionAt, KM_S_TO_AU_PER_DAY,
} from '../../js/orbit.js';
import { parseRubinList, seenByRubin, rubinListUrl } from '../../js/sources.js';
import { choosePhotometry, selectForFink, crossCheck, buildDigest, provenance, VALIDATION, catalogueOffset, MIN_FOR_OFFSET } from '../../js/collector.js';
import { rubinStatus, crossCheckText, offsetText } from '../../js/rubinview.js';
import { FLAGS } from '../../js/flags.js';
import { collect, recordedPolite } from '../../tools/rubin-collect.mjs';
import { GONGGONG_DETECTIONS, RUBIN_LIST } from '../sources/fixtures.js';
import { OBJECTS, EPOCH } from '../orbit/fixtures.js';

/* Rubin is the source of truth (the project owner's direction); JPL is the cross-check. */

describe("Rubin's view of an orbit", () => {
    test('round-trips: elements to a state and back give the same elements', () => {
        const el = OBJECTS.Sedna.elements;
        const jd = EPOCH + 100;
        const p = positionAt(el, jd), q = positionAt(el, jd + 0.01);
        const velocity = [(q.x - p.x) / 0.01, (q.y - p.y) / 0.01, (q.z - p.z) / 0.01];
        const back = elementsFromState([p.x, p.y, p.z], velocity, jd);
        expect(back.a).toBeCloseTo(el.a, -1);
        expect(back.e).toBeCloseTo(el.e, 3);
        expect(back.i).toBeCloseTo(el.i, 3);
        expect(back.om).toBeCloseTo(el.om, 2);
    });

    /* Rubin's records are equatorial AU and km/s: checked against JPL on 2026-10-02. */
    test("Gonggong's orbit from Rubin's own records matches JPL's", () => {
        const state = rubinState(GONGGONG_DETECTIONS);
        const jpl = OBJECTS.Gonggong.elements;
        expect(Math.abs(state.elements.a - jpl.a) / jpl.a).toBeLessThan(0.001);
        expect(state.elements.e).toBeCloseTo(jpl.e, 3);
        expect(state.elements.i).toBeCloseTo(jpl.i, 1);
        expect(state.elements.om).toBeCloseTo(jpl.om, 1);
        expect(state.arcDays).toBeCloseTo(15, 0);
    });

    test('places Gonggong where JPL does, from either orbit', () => {
        const state = rubinState(GONGGONG_DETECTIONS);
        const jd = EPOCH + 200;
        expect(Math.abs(positionAt(state.elements, jd).r - positionAt(OBJECTS.Gonggong.elements, jd).r)).toBeLessThan(0.01);
    });

    test('rotates equatorial into ecliptic about the x axis', () => {
        const [x, y, z] = equatorialToEcliptic([1, 0, 1]);
        expect(x).toBe(1);
        expect(Math.hypot(x, y, z)).toBeCloseTo(Math.SQRT2, 12);
        expect(KM_S_TO_AU_PER_DAY).toBeCloseTo(0.000577548, 8);
    });

    test('has no view of an object with no position in its records', () => {
        expect(rubinState([{ 'r:midpointMjdTai': 61000 }])).toBeNull();
    });
});

describe("Rubin's list decides who Fink is asked about", () => {
    const list = parseRubinList(RUBIN_LIST);
    const tno = (designation, provisional, H = 2) => ({ designation, provisional, H, elements: OBJECTS.Gonggong.elements });

    test('reads the list by number and by designation', () => {
        expect(list.size).toBe(1);
        expect(seenByRubin(list, { designation: '225088', provisional: '2007 OR10' })).toBe(true);
        expect(seenByRubin(list, { designation: '136199', provisional: '2003 UB313' })).toBe(false);
        expect(rubinListUrl()).toMatch(/ssoft\?output-format=csv&columns=designation%2Csso_number%2Cn_days$/);
    });

    test('asks only about objects Rubin has seen, and skips names Fink failed on lately', () => {
        const tnos = [tno('225088', '2007 OR10'), tno('136199', '2003 UB313'), tno('15760', '1992 QB1')];
        const everything = selectForFink(tnos).chosen.map((c) => c.designation);
        const seenOnly = selectForFink(tnos, { rubinList: list }).chosen.map((c) => c.designation);
        expect(everything).toHaveLength(3);
        expect(seenOnly).toEqual(['225088']);
        expect(selectForFink(tnos, { rubinList: list, skip: new Set(['225088']) }).chosen).toEqual([]);
    });
});

describe('Rubin first, JPL as the check', () => {
    const tnos = [
        { designation: '225088', provisional: '2007 OR10', fullName: '225088 Gonggong (2007 OR10)', H: 1.82, elements: OBJECTS.Gonggong.elements },
        { designation: '136199', provisional: '2003 UB313', fullName: '136199 Eris (2003 UB313)', H: -1.26, elements: OBJECTS.Eris.elements },
    ];
    const { objects } = choosePhotometry(tnos, { '2007 OR10': GONGGONG_DETECTIONS }, { rubinList: parseRubinList(RUBIN_LIST) });
    const [gonggong, eris] = objects;

    test('takes brightness and orbit from Rubin where it has them', () => {
        expect(gonggong.hSource).toMatch(/^Rubin/);
        expect(gonggong.orbitFrom).toBe('Rubin');
        expect(gonggong.rubin).toMatchObject({ seen: true, confirmed: true, detections: 7 });
        expect(gonggong.jpl.H).toBe(1.82);
    });

    test('keeps an object Rubin has not measured, from the catalogue, labelled', () => {
        expect(eris.hSource).toBe('catalogue (JPL)');
        expect(eris.orbitFrom).toBe('JPL');
        expect(eris.rubin).toMatchObject({ seen: false, confirmed: false });
        expect(rubinStatus({ rubin: eris.rubin }).text).toBe('Not yet confirmed by Rubin');
    });

    test('checks Rubin against JPL: Gonggong agrees, within the margins', () => {
        const check = crossCheck(gonggong, EPOCH + 100);
        expect(check.agrees).toBe(true);
        expect(Math.abs(check.dH)).toBeLessThan(VALIDATION.H);
        expect(Math.abs(check.dR)).toBeLessThan(VALIDATION.rAu);
        expect(crossCheck(eris, EPOCH)).toBeNull();
    });

    test('flags a real disagreement, and says what it is', () => {
        const off = { ...gonggong, Hv: gonggong.jpl.H + 1.2 };
        const check = crossCheck(off, EPOCH + 100);
        expect(check.agrees).toBe(false);
        expect(crossCheckText({ crossCheck: check })).toMatch(/^Differs from JPL: brightness by 1\.2 mag/);
        expect(FLAGS.jplDisagrees.kind).toBe('validation');
    });

    test('the digest counts what Rubin has confirmed, and where it disagrees', () => {
        const date = new Date('2026-10-05T06:00:00Z');
        const off = { ...gonggong, Hv: gonggong.jpl.H + 1.2 };
        const digest = buildDigest({ objects: [off, eris], date, jd: 2461318.75, provenance: provenance({ siteCommit: 'x', sources: {} }) });
        expect(digest.counts).toMatchObject({ confirmedByRubin: 1, seenByRubin: 1, orbitFromRubin: 1, jplDisagrees: 1 });
        const entry = digest.entries.find((e) => e.designation === '225088');
        expect(entry.flags).toContain('jplDisagrees');
        expect(entry.rubin).toMatchObject({ confirmed: true, detections: 7 });
        expect(entry.orbitFrom).toBe('Rubin');
    });

    test('the tab words a confirmation with its detections and span', () => {
        expect(rubinStatus({ rubin: { confirmed: true, detections: 7, arcDays: 15, lastSeen: '2026-07-11' } }).text)
            .toBe('Confirmed by Rubin: 7 detections over 15 days, last 11 July 2026');
    });
});

describe('A gentle collector run', () => {
    test('asks Fink only about what Rubin has seen, and keeps the list for quiet weeks', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rubin-data-'));
        try {
            await collect({ dataDir: dir, date: new Date('2026-10-05T06:00:00Z'), polite: await recordedPolite() });
            const detections = JSON.parse(readFileSync(join(dir, 'inputs/2026-10/detections.json'), 'utf8'));
            expect(detections.asked).toBe(1);
            const seen = JSON.parse(readFileSync(join(dir, 'inputs/2026-10/rubin-seen.json'), 'utf8'));
            expect(seen.seen).toEqual(['225088']);
            const { digest } = await collect({ dataDir: dir, date: new Date('2026-10-12T06:00:00Z'), polite: await recordedPolite() });
            expect(digest.entries.find((e) => e.designation === '225088').rubin.seen).toBe(true);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test('does not ask Fink again about a name it failed on in the last three months', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rubin-data-'));
        try {
            writeFileSync(join(dir, 'fink-unresolved.json'), JSON.stringify({ 225088: '2026-09' }));
            const { digest } = await collect({ dataDir: dir, date: new Date('2026-10-05T06:00:00Z'), polite: await recordedPolite() });
            const detections = JSON.parse(readFileSync(join(dir, 'inputs/2026-10/detections.json'), 'utf8'));
            expect(detections.asked).toBe(0);
            expect(digest.entries.find((e) => e.designation === '225088').hSource).toBe('catalogue (JPL)');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

/* Rubin measured the first live run's 50 objects 0.35 mag fainter than the catalogue,
   systematically. The check is against that offset, or it would flag the catalogue's
   bias rather than real anomalies. */
describe('The catalogue offset', () => {
    const measured = (dH) => ({ Hv: 5 + dH, jpl: { H: 5 }, rubin: { confirmed: true } });

    test('is the median difference, once there are enough objects to trust it', () => {
        const many = [0.1, 0.3, 0.35, 0.35, 0.4, 0.5, 0.2, 0.3, 0.45, 0.35, 0.8].map(measured);
        const offset = catalogueOffset(many);
        expect(offset.median).toBeCloseTo(0.35, 10);
        expect(offset).toMatchObject({ n: 11, used: true });
        expect(catalogueOffset(many.slice(0, MIN_FOR_OFFSET - 1)).used).toBe(false);
    });

    test('an object at the usual offset agrees; one well beyond it does not', () => {
        const usual = { ...measured(0.81), orbitFrom: 'JPL' };
        expect(crossCheck(usual, EPOCH, { hOffset: 0.35 }).agrees).toBe(true);
        expect(crossCheck(usual, EPOCH, { hOffset: 0 }).agrees).toBe(false);
        const odd = { ...measured(1.2), orbitFrom: 'JPL' };
        expect(crossCheck(odd, EPOCH, { hOffset: 0.35 }).agrees).toBe(false);
    });

    test('the tab states the offset and what it means', () => {
        expect(offsetText({ catalogue: { offsetH: 0.347, from: 50, used: true } }))
            .toMatch(/^Rubin measures these objects 0.35 magnitudes fainter than JPL's catalogue, as a median over the 50/);
        expect(offsetText({ catalogue: { used: false } })).toBeNull();
    });
});

/* Rubin saturates brighter than about r 16, so its brightness for such an object is clipped
   and never used: the catalogue's H stays, and the card says why there is no Rubin value. */
describe('Too bright for Rubin', () => {
    const jd = 2461318.5; // 2026-10-05
    const asBright = (H) => ({ designation: '225088', provisional: '2007 OR10', fullName: '225088 Gonggong (2007 OR10)', H, elements: OBJECTS.Gonggong.elements });

    test('keeps the catalogue H, even with Rubin detections', () => {
        const [o] = choosePhotometry([asBright(-4)], { '2007 OR10': GONGGONG_DETECTIONS }, { jd }).objects;
        expect(o.hSource).toBe('catalogue (JPL)');
        expect(o.rubin.tooBright).toBe(true);
        expect(o.rubin.confirmed).toBe(false);
    });

    test('an object Rubin can measure still uses Rubin', () => {
        const [o] = choosePhotometry([asBright(1.82)], { '2007 OR10': GONGGONG_DETECTIONS }, { jd }).objects;
        expect(o.hSource).toMatch(/^Rubin/);
        expect(o.rubin.tooBright).toBeUndefined();
    });

    test('the card says so, from the entry or from its brightness alone', () => {
        expect(rubinStatus({ rubin: { tooBright: true }, now: { V: 15.2 } }).text).toBe('Too bright for Rubin to measure');
        expect(rubinStatus({ rubin: { confirmed: false }, now: { V: 15.15 } }).text).toBe('Too bright for Rubin to measure');
        expect(rubinStatus({ rubin: { confirmed: false }, now: { V: 17.11 } }).text).toBe('Not yet confirmed by Rubin');
    });
});
