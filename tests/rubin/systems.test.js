import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    SYSTEMS, starKind, memberTypeText, systemTypeText, findSystems, centauriOn, places,
    NEIGHBOURS, systemOn, reachOf, roundUp, seenNearOf, seenNearOfPair, SEEN_NEAR, MERCURY_AU, binaryOffset, planetSummary,
} from '../../js/centauri.js';
import { STAR_SIZES } from '../../js/rubinview.js';
import { STAR_TYPE_COLORS, RUBIN_COLORS } from '../../js/rubincolors.js';
import { worstCaseContrast, areDistinguishable, MIN_AGAINST_BACKGROUND } from '../../js/contrast.js';

const names = (list) => list.map((s) => s.name);

describe('the systems "Go to" lists', () => {
    it('lists every place the map has but the view of them all, nearest first', () => {
        const at = places(centauriOn(2026.9), 100);
        const ids = SYSTEMS.map((s) => s.id);
        expect(new Set(ids)).toEqual(new Set(Object.keys(at).filter((id) => id !== 'both')));
        const far = ids.map((id) => Math.hypot(at[id].cx, at[id].cy, at[id].cz));
        expect([...far].sort((a, b) => a - b)).toEqual(far);
    });

    it('gives every member a type the symbols know', () => {
        for (const m of SYSTEMS.flatMap((s) => s.members)) {
            expect(m.key).toMatch(/^body:/);
            expect(STAR_TYPE_COLORS[starKind(m.type).colour]).toBeDefined();
        }
    });
});

describe('star types', () => {
    it('reads the class from the type', () => {
        expect(starKind('G2 V')).toMatchObject({ colour: 'yellow', shape: 'disc' });
        expect(starKind('K1 V').colour).toBe('orange');
        expect(starKind('M5.5 Ve').colour).toBe('red');
        expect(starKind('A1 V').colour).toBe('white');
        expect(starKind('DA2')).toMatchObject({ colour: 'white', shape: 'dot' });
        expect(starKind('T0.5')).toMatchObject({ colour: 'tundr', shape: 'ring' });
        expect(starKind('Y2')).toMatchObject({ colour: 'tundr', shape: 'ring' });
    });

    it('says a member type in full, and a whole system member by member', () => {
        const [sun, centauri, , luhman] = SYSTEMS;
        expect(memberTypeText(sun.members[0])).toBe('G2 V, a yellow dwarf: a star like the Sun');
        expect(systemTypeText(sun)).toBe(memberTypeText(sun.members[0]));
        expect(systemTypeText(centauri)).toBe('Three stars: A, G2 V; B, K1 V; Proxima Centauri, M5.5 Ve');
        expect(systemTypeText(luhman)).toBe('Two Hydrogen Tundrs: A, L7.5; B, T0.5');
    });
});

describe('finding a system by typing', () => {
    it('lists them all for nothing typed', () => {
        expect(findSystems('')).toBe(SYSTEMS);
        expect(findSystems('   ')).toBe(SYSTEMS);
    });

    it('ignores case, spaces and punctuation, and finds members too', () => {
        expect(names(findSystems('barnards'))).toEqual(["Barnard's Star"]);
        expect(names(findSystems('PROXIMA'))).toEqual(['Alpha Centauri']);
        expect(names(findSystems('luhman16'))).toEqual(['Luhman 16']);
        expect(findSystems('vega')).toEqual([]);
    });

    it('puts names that start with what was typed first', () => {
        const systems = [{ name: 'Sol B', members: [] }, { name: 'B Sol', members: [] }];
        expect(names(findSystems('b', systems))).toEqual(['B Sol', 'Sol B']);
    });
});

describe('the star-type colours', () => {
    it.each(Object.entries(STAR_TYPE_COLORS))('%s is legible on the page and on the map', (name, color) => {
        expect(worstCaseContrast(color, RUBIN_COLORS.surface)).toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
        expect(worstCaseContrast(color, RUBIN_COLORS.space)).toBeGreaterThanOrEqual(MIN_AGAINST_BACKGROUND);
    });

    it('can each be told apart', () => {
        const colours = Object.values(STAR_TYPE_COLORS);
        colours.forEach((a, i) => colours.slice(i + 1).forEach((b) => expect(areDistinguishable(a, b)).toBe(true)));
    });
});

describe('every neighbour from one list', () => {
    const on = centauriOn(2026.88);
    const P = places(on, 200);

    it('gives the four systems the views they always had', () => {
        expect([P.centauri.radiusAU, P.barnard.radiusAU, P.luhman16.radiusAU]).toEqual([15000, 0.45, 6]);
        expect(P.both.radiusAU).toBe(1080000);
    });

    it('keeps the hatching clearings they always had', () => {
        const [centauri, barnard, luhman] = on.systems;
        expect(centauri.pairs.map((p) => seenNearOfPair(p.pair))).toEqual([SEEN_NEAR.pair]);
        expect(centauri.lone.map((m) => seenNearOf(centauri.system, m))).toEqual([SEEN_NEAR.proxima]);
        expect(seenNearOf(barnard.system, barnard.lone[0])).toBe(SEEN_NEAR.barnard);
        expect(seenNearOfPair(luhman.pairs[0].pair)).toBe(SEEN_NEAR.luhman16);
    });

    it('has a size for every mark the map can draw', () => {
        for (const s of NEIGHBOURS) {
            for (const id of [s.id, ...s.members.map((m) => m.id), ...(s.pairs ?? []).map((p) => p.key)]) {
                expect(STAR_SIZES[`body:${id}`]?.length).toBeGreaterThan(0);
            }
        }
        expect(STAR_SIZES['body:centauri']).toHaveLength(3);
        expect(STAR_SIZES['body:ab']).toHaveLength(2);
    });

    it('works out a new system with no hand-written code: a lone star, a wide pair, planets', () => {
        const lone = systemOn({ id: 'x', name: 'X', sky: NEIGHBOURS[1].sky, members: [{ id: 'x', name: 'X', type: 'M3 V' }] }, 2026.88);
        expect(lone.units).toBe(1);
        expect(lone.forScale).toBe(MERCURY_AU);
        expect(reachOf(lone).radiusAU).toBe(0.45);
        const far = systemOn({ ...lone.system, planets: [{ star: 'x', name: 'X b', a: 2, status: 'confirmed' }] }, 2026.88);
        expect(far.forScale).toBeNull();
        expect(reachOf(far).radiusAU).toBe(2.5);
        expect(seenNearOf(far.system, far.system.members[0])).toBeCloseTo(2.6, 9);
        const pair = NEIGHBOURS[2].pairs[0];
        expect(seenNearOfPair({ ...pair, seenNear: undefined })).toBeCloseTo(pair.orbit.aAU * (1 + pair.orbit.e) * 1.1, 9);
    });

    it('rounds a view up to two figures', () => {
        expect([roundUp(15070), roundUp(0.449), roundUp(6), roundUp(12000)]).toEqual([16000, 0.45, 6, 12000]);
    });

    it('leaves no system drawn by name in the page', () => {
        const page = readFileSync(resolve(__dirname, '../../rubin/rubin.js'), 'utf8');
        expect(page).not.toMatch(/'body:(a|b|ab|proxima|barnard|luhman16|luhmanA|luhmanB)'/);
        expect(page).not.toMatch(/PLACES\.(centauri|barnard|luhman16)/);
    });
});

describe('everything within 1,000,000 AU (js/nearstars.js)', () => {
    const on = centauriOn(2026.88);
    const LIMIT_MAS = 206.265;

    it('holds every system nearer than a million AU, and only those', () => {
        expect(NEIGHBOURS.length).toBe(47);
        for (const s of NEIGHBOURS) expect(s.sky.parallax).toBeGreaterThan(LIMIT_MAS);
        for (const s of on.systems) expect(s.centre.r).toBeLessThan(1e6);
    });

    it('gives every id once, every member a type the symbols know and a size', () => {
        const ids = NEIGHBOURS.flatMap((s) => s.members.map((m) => m.id));
        expect(new Set(ids).size).toBe(ids.length);
        for (const m of NEIGHBOURS.flatMap((s) => s.members)) {
            expect(STAR_TYPE_COLORS[starKind(m.type).colour]).toBeDefined();
            expect(m.size.suns ?? m.size.jupiters).toBeGreaterThan(0);
            if (m.size.plusMinus) expect(m.size.plusMinus).toBeLessThan(m.size.suns ?? m.size.jupiters);
        }
    });

    it('says the type right for stars, white dwarfs and tundrs', () => {
        const type = (id) => NEIGHBOURS.flatMap((s) => s.members).find((m) => m.id === id).type;
        expect(starKind(type('siriusA')).colour).toBe('white');
        expect(starKind(type('siriusB')).shape).toBe('dot');
        expect(starKind(type('tauCet')).colour).toBe('yellow');
        expect(starKind(type('epsEri')).colour).toBe('orange');
        expect(starKind(type('wise0855')).shape).toBe('ring');
    });

    it('puts every member of a group or pair in its system, and each group one mark', () => {
        for (const s of NEIGHBOURS) {
            const mine = new Set(s.members.map((m) => m.id));
            for (const g of s.groups ?? []) {
                g.members.forEach((id) => expect(mine.has(id)).toBe(true));
                expect(g.seenNear).toBeGreaterThan(0);
                expect(STAR_SIZES[`body:${g.key}`]).toHaveLength(g.members.length);
            }
            for (const p of s.pairs ?? []) [p.a, p.b].forEach((id) => expect(mine.has(id)).toBe(true));
        }
        const ez = on.systems.find((s) => s.system.id === 'ezAqr');
        expect(ez.units).toBe(1);
        expect(ez.at.get('ezAqrA')).toBe(ez.at.get('ezAqrB'));
    });

    it('puts Luyten 726-8 and Wolf 424 where Gaia saw them in 2016: B 2.26 and 1.15 arcseconds from A', () => {
        const orbitOf = (id) => NEIGHBOURS.find((s) => s.id === id).pairs[0].orbit;
        for (const [id, arcsec, parallax] of [['luyten7268', 2.259, 371.92], ['wolf424', 1.149, 227.041]]) {
            const { north, east } = binaryOffset(2016.0, orbitOf(id));
            expect(Math.hypot(north, east) * parallax / 1000).toBeCloseTo(arcsec, 1);
        }
    });

    it('draws Kruger 60 and Ross 614 on their orbits too, apart once zoomed in', () => {
        for (const id of ['kruger60', 'ross614', 'luyten7268', 'wolf424']) {
            const s = on.systems.find((x) => x.system.id === id);
            expect(s.pairs).toHaveLength(1);
            expect(s.pairs[0].apart).toBeGreaterThan(1);
            expect(s.pairs[0].paths.a).toHaveLength(96);
        }
    });

    it('draws Sirius B where its orbit puts it: 7.5 arcseconds out on average, 19.8 AU', () => {
        const sirius = on.systems.find((s) => s.system.id === 'sirius');
        expect(sirius.pairs[0].pair.orbit.aAU).toBeCloseTo(19.78, 1);
        expect(sirius.pairs[0].apart).toBeGreaterThan(8);
        expect(sirius.pairs[0].apart).toBeLessThan(32);
    });

    it("sets a wide companion its own place: 61 Cygni B about 110 AU from A (31 arcseconds), Epsilon Indi B about 1,460", () => {
        const from = (sys, id) => {
            const s = on.systems.find((x) => x.system.id === sys);
            const [a, b] = [s.centre, s.at.get(id)];
            return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        };
        expect(from('61cyg', '61cygB')).toBeGreaterThan(100);
        expect(from('61cyg', '61cygB')).toBeLessThan(125);
        expect(from('epsInd', 'epsIndBa')).toBeGreaterThan(1300);
        expect(from('epsInd', 'epsIndBa')).toBeLessThan(1600);
    });

    it('labels disputed planets candidates', () => {
        const status = (name) => NEIGHBOURS.flatMap((s) => s.planets ?? []).find((p) => p.name === name).status;
        expect(status('Tau Ceti f')).toBe('candidate');
        expect(status('Kapteyn c')).toBe('candidate');
        expect(status('Epsilon Eridani b')).toBe('confirmed');
    });

    it('lets the size panel say how each unmeasured size was had', () => {
        const wolf = STAR_SIZES['body:wolf359'][0];
        expect(wolf.measured).toBe(false);
        expect(wolf.estimatedBy).toBe('brightness');
        expect(STAR_SIZES['body:siriusA'][0].measured).toBe(true);
    });
});

describe('whether a system has planets, in words (owner, 2026-11-18)', () => {
    const planetsOf = (id) => NEIGHBOURS.find((s) => s.id === id).planets ?? [];

    it('counts the confirmed and names each by its letter', () => {
        const barnard = planetSummary(planetsOf('barnard'), "Barnard's Star");
        expect(barnard).toMatchObject({ confirmed: 4, candidates: 0 });
        expect(barnard.text).toBe('Four planets known: d, b, c and e');
    });

    it('keeps candidates apart, unconfirmed', () => {
        expect(planetSummary(planetsOf('tauCet'), 'Tau Ceti').text).toBe('No planets confirmed; three candidates, about 0.133 AU, 0.243 AU and 1.334 AU out, unconfirmed');
        expect(planetSummary(planetsOf('groombridge34'), 'Groombridge 34').text).toBe('One planet known: A c; and one candidate, about 0.072 AU out, unconfirmed');
    });

    it('names a planet by its star where a system has several', () => {
        expect(planetSummary(planetsOf('struve2398'), 'Struve 2398').text).toBe('Two planets known: A b and B c');
    });

    it('says so when none are known', () => {
        expect(planetSummary(planetsOf('wolf359'), 'Wolf 359')).toMatchObject({ confirmed: 0, candidates: 0, text: 'No planets known yet' });
    });
});
