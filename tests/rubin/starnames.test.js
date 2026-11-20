import { describe, it, expect } from 'vitest';
import { GENITIVE, nameOf, bestName, namesName, recordOf, firstRecord, FIRST_RECORDS } from '../../js/starnames.js';

describe('star names', () => {
    it('know all 88 constellations', () => {
        expect(Object.keys(GENITIVE)).toHaveLength(88);
    });

    it('read Bayer and Flamsteed names as words', () => {
        expect(nameOf('* alf PsA')).toEqual({ name: 'Alpha Piscis Austrini', rank: 1 });
        expect(nameOf('* alf PsA B').name).toBe('Alpha Piscis Austrini B');
        expect(nameOf('* nu.01 Lup').name).toBe('Nu¹ Lupi');
        expect(nameOf('* psi10 Aur').name).toBe('Psi¹⁰ Aurigae');
        expect(nameOf('* L01 Pup').name).toBe('L¹ Puppis');
        expect(nameOf('* g Car').name).toBe('g Carinae');
        expect(nameOf('* 61 Vir')).toEqual({ name: '61 Virginis', rank: 2 });
        expect(nameOf('* 61 Cyg A').name).toBe('61 Cygni A');
        expect(nameOf('* 26 alf Cen').rank).toBe(1);
    });

    it('keep proper names and drop catalogue numbers filed as names', () => {
        expect(nameOf('NAME Fomalhaut B')).toEqual({ name: 'Fomalhaut B', rank: 0 });
        expect(nameOf('NAME Lacaille 9352').name).toBe('Lacaille 9352');
        expect(nameOf('NAME SAO 237920B')).toBeNull();
        expect(nameOf('NAME G79.29+0.46*')).toBeNull();
    });

    it('read the catalogues, squeezing SIMBAD\'s spaces', () => {
        expect(nameOf('Wolf 359').rank).toBe(3);
        expect(nameOf('GJ 887')).toEqual({ name: 'GJ 887', rank: 4 });
        expect(nameOf('V* EV Lac')).toEqual({ name: 'EV Lacertae', rank: 5 });
        expect(nameOf('HD 217987').rank).toBe(6);
        expect(nameOf('LHS    70')).toEqual({ name: 'LHS 70', rank: 7 });
        expect(nameOf('TIC 47552789')).toBeNull();
    });

    it('pick the friendliest a star has', () => {
        expect(bestName(['GJ 887', 'HD 217987', 'LHS    70', 'NAME Lacaille 9352'])).toBe('Lacaille 9352');
        expect(bestName(['HD 1', '* 61 Vir', '* alf Vir'])).toBe('Alpha Virginis');
        expect(bestName(['NAME Fomalhaut', 'NAME Fomalhaut A 2'])).toBe('Fomalhaut');
        expect(bestName(['TIC 1'])).toBeNull();
        expect(bestName([])).toBeNull();
    });

    it('find the oldest catalogue a star is in, else Gaia', () => {
        expect(recordOf('BD+14   622')).toBe('bd');
        expect(recordOf('CD-36 15693')).toBe('cd');
        expect(recordOf('* alf PsA')).toBe('bayer');
        expect(recordOf('* 61 Cyg A')).toBe('flam');
        expect(recordOf('NAME Lacaille 9352')).toBe('lac');
        expect(recordOf('GJ 887')).toBeNull();
        expect(firstRecord(['GJ 887', 'HD 217987', 'CD-36 15693', 'NAME Lacaille 9352', 'HIP 114046'])).toBe('lac');
        expect(firstRecord(['HIP 1', 'HD 2', 'BD+1 3'])).toBe('bd');
        expect(firstRecord(['GJ 1'])).toBe('gaia');
        expect(firstRecord([])).toBe('gaia');
        for (const [title, how] of Object.values(FIRST_RECORDS)) expect(title && how).toBeTruthy();
    });

    it('live beside each tile', () => {
        expect(namesName('07')).toBe('r07.names.json');
    });
});
