import { describe, it, expect } from 'vitest';
import { NOTABLE_LIST, notableViewPc } from '../../js/notables.js';
import { SYSTEMS, kindsOf, filterSystems, starKind, GO_KINDS, memberTypeText } from '../../js/centauri.js';
import { holdsNotable, BLOCK_PC, NEIGHBORHOOD_PC, STREET_PC } from '../../js/starview.js';

const byId = Object.fromEntries(NOTABLE_LIST.map((n) => [n.id, n]));

describe('the notable objects', () => {
    it('are the fourteen the owner chose, each with an id of its own', () => {
        expect(NOTABLE_LIST.map((n) => n.id).sort()).toEqual([
            'aldebaran', 'antares', 'arcturus', 'betelgeuse', 'deneb', 'gaiabh1', 'hyades',
            'orionnebula', 'pleiades', 'polaris', 'rigel', 'rxj1856', 'vega', 'velapulsar',
        ]);
        const systemIds = new Set(SYSTEMS.map((s) => s.id));
        for (const n of NOTABLE_LIST) expect(systemIds.has(n.id)).toBe(false);
    });

    it('all lie past the street, and inside the neighborhood', () => {
        for (const n of NOTABLE_LIST) {
            expect(n.pc).toBeGreaterThan(STREET_PC);
            expect(n.pc).toBeLessThanOrEqual(NEIGHBORHOOD_PC);
        }
    });

    it('are marked in the block or only from the neighborhood, by where they are', () => {
        for (const id of ['vega', 'arcturus', 'aldebaran', 'hyades', 'rxj1856', 'polaris', 'pleiades', 'betelgeuse', 'antares']) {
            expect(byId[id].rungPc).toBe(BLOCK_PC);
            expect(holdsNotable(BLOCK_PC, byId[id].pc)).toBe(true);
        }
        for (const id of ['rigel', 'velapulsar', 'orionnebula', 'gaiabh1', 'deneb']) {
            expect(byId[id].rungPc).toBe(NEIGHBORHOOD_PC);
            expect(holdsNotable(BLOCK_PC, byId[id].pc)).toBe(false);
            expect(holdsNotable(NEIGHBORHOOD_PC, byId[id].pc)).toBe(true);
        }
    });

    it("say where their distances disagree, Betelgeuse's above all", () => {
        const text = byId.betelgeuse.rows.flat().join(' ');
        expect(text).toContain('550 to 720 light years');
        expect(text).toContain('Joyce et al. 2020');
        expect(text).toContain('Harper et al. 2017');
        expect(byId.betelgeuse.system.farText).toBe('~550 to 720 ly');
        expect(byId.vega.system.farText).toBe('25 ly');
    });

    it('each have their own view, holding the Sun too when near', () => {
        expect(notableViewPc(byId.vega.pc)).toBeGreaterThan(byId.vega.pc);
        expect(notableViewPc(byId.gaiabh1.pc)).toBe(100);
    });
});

describe('the kinds they bring', () => {
    it('tell giants and supergiants from dwarfs, in their own colours', () => {
        expect(starKind('K1.5 III')).toMatchObject({ colour: 'orange', giant: 'giant' });
        expect(starKind('M2 Iab')).toMatchObject({ colour: 'red', giant: 'supergiant' });
        expect(starKind('B8 Ia').words).toMatch(/^a blue supergiant/);
        expect(starKind('F7 Ib').words).toMatch(/^a yellow supergiant/);
        expect(starKind('K1.5 III').words).toMatch(/^an orange giant/);
        expect(starKind('K1 V').giant).toBeUndefined();
        expect(starKind('M5.5 Ve').giant).toBeUndefined();
        expect(starKind('G2 V').words).toMatch(/yellow dwarf/);
    });

    it('give clusters and nebulae words of their own, without a spectral type', () => {
        expect(memberTypeText({ type: 'CL' })).toMatch(/^a star cluster/);
        expect(memberTypeText({ type: 'NEB' })).toMatch(/^a nebula/);
    });

    it('can each be filtered for in "Go to"', () => {
        const systems = NOTABLE_LIST.map((n) => n.system);
        const ids = (kinds) => filterSystems(systems, { kinds: new Set(kinds) }).map((s) => s.id).sort();
        expect(ids(['supergiant'])).toEqual(['antares', 'betelgeuse', 'deneb', 'polaris', 'rigel']);
        expect(ids(['giant'])).toEqual(['aldebaran', 'arcturus']);
        expect(ids(['cluster'])).toEqual(['hyades', 'pleiades']);
        expect(ids(['nebula'])).toEqual(['orionnebula']);
        expect(ids(['neutronstar'])).toEqual(['rxj1856', 'velapulsar']);
        expect(ids(['blackhole'])).toEqual(['gaiabh1']);
        expect(ids(['white'])).toEqual(['vega']);
        const offered = new Set(GO_KINDS.map((k) => k.id));
        for (const s of systems) for (const k of kindsOf(s)) expect(offered.has(k)).toBe(true);
    });
});
