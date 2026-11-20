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

/* ---- The oldest catalogue a star is in ---------------------------------------------------
 *
 * Owner, 2026-11-19: each star's card says where it was first recorded - the oldest of the
 * catalogues it is in, as far as SIMBAD and Hipparcos know, which is not always who first
 * saw it (a naked-eye star was seen long before any of these). Gaia measured the distance
 * of every one; it first recorded only those in none of the older ones. Codes are what
 * r<path>.first.json holds, { k: code }; a star not in it was first recorded by Gaia.
 * Each line's particulars were checked against sources on 2026-11-19; NOTES.md, "First
 * recorded", lists them. Change none from memory.
 */
export const FIRST_RECORDS = {
    bayer: ["Bayer's star atlas, Uranometria (1603)", "from Tycho Brahe's naked-eye measurements"],
    flam: ["Flamsteed's catalogue (1725)", 'from his observations at Greenwich'],
    lac: ["Lacaille's southern survey (1751-52)", 'through a small telescope at the Cape of Good Hope'],
    bd: ['The Bonner Durchmusterung (1859-62)', 'by eye through a small telescope at Bonn'],
    cd: ['The Córdoba Durchmusterung (1892-1932)', 'by eye through a telescope in Argentina'],
    cpd: ['The Cape Photographic Durchmusterung (1896-1900)', 'from photographic plates taken at the Cape of Good Hope'],
    hd: ['The Henry Draper Catalogue (1918-24)', 'from photographic plates at Harvard'],
    wolf: ["Max Wolf's search for fast-moving stars (1919 on)", 'from photographic plates at Heidelberg'],
    ross: ["Frank Ross's search for fast-moving stars (1925-39)", 'at Yerkes Observatory'],
    lhs: ["Luyten's Half-Second catalogue (1979)", 'of stars moving more than half a second of arc a year'],
    hip: ['The Hipparcos catalogue (ESA 1997)', "from ESA's Hipparcos satellite"],
    gaia: ["Gaia's own catalogue (DR3)", "ESA's Gaia spacecraft"],
};
const ORDER = Object.keys(FIRST_RECORDS);

/* The code of one identifier's catalogue, or null. */
export function recordOf(identifier) {
    const s = String(identifier).trim().replace(/\s+/g, ' ');
    if (s.startsWith('* ')) return nameOf(s)?.rank === 1 ? 'bayer' : nameOf(s) ? 'flam' : null;
    if (/^NAME Lacaille \d/.test(s)) return 'lac';
    if (/^BD[+-]/.test(s)) return 'bd';
    if (/^CD-/.test(s)) return 'cd';
    if (/^CPD-/.test(s)) return 'cpd';
    if (/^HD \d/.test(s)) return 'hd';
    if (/^Wolf \d/.test(s)) return 'wolf';
    if (/^Ross \d/.test(s)) return 'ross';
    if (/^LHS \d/.test(s)) return 'lhs';
    if (/^HIP \d/.test(s)) return 'hip';
    return null;
}

/* The oldest catalogue among a star's identifiers; 'gaia' when none is older. */
export function firstRecord(identifiers) {
    let best = ORDER.length - 1;
    for (const id of identifiers) {
        const code = recordOf(id);
        if (code) best = Math.min(best, ORDER.indexOf(code));
    }
    return ORDER[best];
}

export const firstName = (path) => `r${path}.first.json`;

