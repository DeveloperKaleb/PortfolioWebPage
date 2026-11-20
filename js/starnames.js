/* Star names: the best name a star has, from the identifiers catalogues give it.
 *
 * Owner, 2026-11-19: the stars of a selected star's street should show their friendliest
 * name, not only Gaia's number. In order: a proper name (Fomalhaut, Lacaille 9352), Bayer
 * (Alpha Piscis Austrini), Flamsteed (61 Virginis), the classic nearby-star surveys (Wolf
 * 359, Ross 128), Gliese (GJ 887), a variable star's name (EV Lacertae), HD, LHS; else the
 * Hipparcos number or Gaia's own from the ID files (starview.js, designation).
 *
 * Identifiers come as SIMBAD writes them ("NAME Fomalhaut", "* alf PsA", "V* EV Lac",
 * "LHS    70"); tools/gaiastars/names.mjs turns them into one r<path>.names.json per tile,
 * { k: name } for the stars of that tile that have one. Pure: no DOM, no fetch.
 */

export const namesName = (path) => `r${path}.names.json`;

/* The 88 constellations, IAU abbreviation to genitive. */
export const GENITIVE = {
    And: 'Andromedae', Ant: 'Antliae', Aps: 'Apodis', Aqr: 'Aquarii', Aql: 'Aquilae', Ara: 'Arae',
    Ari: 'Arietis', Aur: 'Aurigae', Boo: 'Bootis', Cae: 'Caeli', Cam: 'Camelopardalis', Cnc: 'Cancri',
    CVn: 'Canum Venaticorum', CMa: 'Canis Majoris', CMi: 'Canis Minoris', Cap: 'Capricorni',
    Car: 'Carinae', Cas: 'Cassiopeiae', Cen: 'Centauri', Cep: 'Cephei', Cet: 'Ceti',
    Cha: 'Chamaeleontis', Cir: 'Circini', Col: 'Columbae', Com: 'Comae Berenices',
    CrA: 'Coronae Australis', CrB: 'Coronae Borealis', Crv: 'Corvi', Crt: 'Crateris', Cru: 'Crucis',
    Cyg: 'Cygni', Del: 'Delphini', Dor: 'Doradus', Dra: 'Draconis', Equ: 'Equulei', Eri: 'Eridani',
    For: 'Fornacis', Gem: 'Geminorum', Gru: 'Gruis', Her: 'Herculis', Hor: 'Horologii', Hya: 'Hydrae',
    Hyi: 'Hydri', Ind: 'Indi', Lac: 'Lacertae', Leo: 'Leonis', LMi: 'Leonis Minoris', Lep: 'Leporis',
    Lib: 'Librae', Lup: 'Lupi', Lyn: 'Lyncis', Lyr: 'Lyrae', Men: 'Mensae', Mic: 'Microscopii',
    Mon: 'Monocerotis', Mus: 'Muscae', Nor: 'Normae', Oct: 'Octantis', Oph: 'Ophiuchi', Ori: 'Orionis',
    Pav: 'Pavonis', Peg: 'Pegasi', Per: 'Persei', Phe: 'Phoenicis', Pic: 'Pictoris', Psc: 'Piscium',
    PsA: 'Piscis Austrini', Pup: 'Puppis', Pyx: 'Pyxidis', Ret: 'Reticuli', Sge: 'Sagittae',
    Sgr: 'Sagittarii', Sco: 'Scorpii', Scl: 'Sculptoris', Sct: 'Scuti', Ser: 'Serpentis',
    Sex: 'Sextantis', Tau: 'Tauri', Tel: 'Telescopii', Tri: 'Trianguli', TrA: 'Trianguli Australis',
    Tuc: 'Tucanae', UMa: 'Ursae Majoris', UMi: 'Ursae Minoris', Vel: 'Velorum', Vir: 'Virginis',
    Vol: 'Volantis', Vul: 'Vulpeculae',
};

/* SIMBAD's Greek letters. */
const GREEK = {
    alf: 'Alpha', bet: 'Beta', gam: 'Gamma', del: 'Delta', eps: 'Epsilon', zet: 'Zeta', eta: 'Eta',
    tet: 'Theta', iot: 'Iota', kap: 'Kappa', lam: 'Lambda', 'mu.': 'Mu', 'nu.': 'Nu', ksi: 'Xi',
    omi: 'Omicron', 'pi.': 'Pi', rho: 'Rho', sig: 'Sigma', tau: 'Tau', ups: 'Upsilon', phi: 'Phi',
    chi: 'Chi', psi: 'Psi', ome: 'Omega',
};
const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (digits) => String(Number(digits)).split('').map((d) => SUPERSCRIPT[d]).join('');

/* "* alf PsA B" -> { name: 'Alpha Piscis Austrini B', bayer: true }; "* 61 Vir" -> 61 Virginis. */
function starName(tokens) {
    const c = tokens.findIndex((t) => GENITIVE[t]);
    if (c < 0) return null;
    const before = tokens.slice(0, c);
    const after = tokens.slice(c + 1).join(' ');
    const tail = `${GENITIVE[tokens[c]]}${after ? ` ${after}` : ''}`;
    for (const t of before) {
        const m = /^([a-z]{2,3}\.?)(\d*)$/.exec(t);
        if (m && GREEK[m[1]]) return { name: `${GREEK[m[1]]}${m[2] ? sup(m[2]) : ''} ${tail}`, bayer: true };
        const latin = /^([A-Za-z])(\d*)$/.exec(t);
        if (latin) return { name: `${latin[1]}${latin[2] ? sup(latin[2]) : ''} ${tail}`, bayer: true };
    }
    const flamsteed = before.find((t) => /^\d+$/.test(t));
    return flamsteed ? { name: `${flamsteed} ${tail}`, bayer: false } : null;
}

/* One SIMBAD identifier as a name, with its rank (lower is better); null if it is not a
   kind of name the page shows. */
export function nameOf(identifier) {
    const s = String(identifier).trim().replace(/\s+/g, ' ');
    if (s.startsWith('NAME ')) {
        const name = s.slice(5);
        /* Proper names only: not catalogue numbers SIMBAD files as names ("SAO 237920B",
           "G79.29+0.46*"). */
        if (/[+*]/.test(name) || /^[A-Z]{2,}\s?\d/.test(name)) return null;
        return { name, rank: 0 };
    }
    if (s.startsWith('* ')) {
        const n = starName(s.slice(2).split(' '));
        return n && { name: n.name, rank: n.bayer ? 1 : 2 };
    }
    let m = /^(Wolf|Ross) (\d+\S*)$/.exec(s);
    if (m) return { name: `${m[1]} ${m[2]}`, rank: 3 };
    m = /^GJ (\d+(?:\.\d+)?\S*)$/.exec(s);
    if (m) return { name: `GJ ${m[1]}`, rank: 4 };
    if (s.startsWith('V* ')) {
        const tokens = s.slice(3).split(' ');
        const c = tokens.findIndex((t) => GENITIVE[t]);
        if (c > 0) return { name: [...tokens.slice(0, c), GENITIVE[tokens[c]], ...tokens.slice(c + 1)].join(' '), rank: 5 };
        return null;
    }
    m = /^HD (\d+\S*)$/.exec(s);
    if (m) return { name: `HD ${m[1]}`, rank: 6 };
    m = /^LHS (\d+\S*)$/.exec(s);
    if (m) return { name: `LHS ${m[1]}`, rank: 7 };
    return null;
}

/* The best of a star's identifiers, or null. Ties go to a name without digits, then the
   shorter, then the first. */
export function bestName(identifiers) {
    let best = null;
    for (const id of identifiers) {
        const n = nameOf(id);
        if (!n) continue;
        const better = !best || n.rank < best.rank || (n.rank === best.rank && (
            (/\d/.test(best.name) && !/\d/.test(n.name)) ||
            (/\d/.test(best.name) === /\d/.test(n.name) && n.name.length < best.name.length)));
        if (better) best = n;
    }
    return best?.name ?? null;
}
