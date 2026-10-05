import { describe, test, expect } from 'vitest';
import { FUN_FACTS, funFact } from '../../js/funfacts.js';
import { knownRow, displayName } from '../../js/rubinview.js';

/* Every Known world, including the Kuiper belt worlds that come from the digest. */
const digest = {
    date: '2026-10-05', counts: {}, entries: ['134340 Pluto (1930 BM)', '136199 Eris (2003 UB313)', '136108 Haumea (2003 EL61)', '136472 Makemake (2005 FY9)', '50000 Quaoar (2002 LM60)']
        .map((name, k) => ({ designation: String(k), name, passes: true, watch: false, flags: [], orbit: { a: 40 + k }, now: { r: 40, x: 30, y: 20, V: 18 } })),
};

describe('Fun facts', () => {
    test('every Known world has one', () => {
        const names = knownRow(digest).map((b) => displayName(b));
        expect(names).toHaveLength(33);
        for (const name of names) expect(funFact(name), name).not.toBeNull();
    });

    test('each is short enough for a card, with a source to check it', () => {
        for (const [name, f] of Object.entries(FUN_FACTS)) {
            expect(f.text.length, name).toBeLessThanOrEqual(170);
            expect(f.url.startsWith('https://'), name).toBe(true);
            expect(f.source.length, name).toBeGreaterThan(2);
        }
    });

    test('no fact uses the term the site does not ("dwarf planet")', () => {
        for (const f of Object.values(FUN_FACTS)) expect(f.text).not.toMatch(/dwarf planet/i);
    });

    test('nothing for a body without one', () => {
        expect(funFact('2012 VP113')).toBeNull();
    });
});
