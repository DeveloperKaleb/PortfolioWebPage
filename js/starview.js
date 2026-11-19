/* Drawing Gaia's stars on the map (step 2 of "Gaia's stars, if we build toward them",
 * NOTES.md; owner, 2026-11-19): which tiles (js/startiles.js) a view needs, and how each
 * star looks. Pure; the WebGL itself is in rubin/rubin.js.
 *
 * Which tiles: best first. A tile on screen whose cube looks largest comes first; while a
 * tile's cube is wider on screen than DESCEND_PX its children are wanted too, since its
 * own stars, the brightest of that cube, would be thinly spread there. It stops at
 * STAR_BUDGET stars, so a wide view shows the brightest everywhere and a close one fills in
 * the faint ones near.
 *
 * Each place shows its own stars and no others (owner, 2026-11-19): the block, those within
 * BLOCK_PC of the Sun; the neighborhood, those within NEIGHBORHOOD_PC; the street none of
 * Gaia's, only its 48 systems (js/nearstars.js, js/centauri.js), drawn as marks. Past a
 * place's edge the Milky Way picture (js/milkyway.js) stands in for the rest. outerPc,
 * below, is that edge. Stars nearer the Sun than STREET_AU (a million AU) are never drawn
 * from Gaia: they are the street's marks already.
 */
import { AU_PER_PARSEC } from './centauri.js';
import { cubeOf, magOf, colourOf } from './startiles.js';

export const STREET_AU = 1000000;
export const STREET_PC = STREET_AU / AU_PER_PARSEC;
/* The Galactic block, as far as the preview reaches: the Local Bubble's scale. */
export const BLOCK_PC = 250;
/* The Galactic neighborhood, the next rung of the address ladder: far enough to hold
   Gaia BH1. */
export const NEIGHBORHOOD_PC = 1000;
export const DESCEND_PX = 48;
export const STAR_BUDGET = 400000;

/* The faintest stars a view shows, as an absolute G magnitude: those Gaia measured to
   within 1% all the way out to the place's edge (outerPc), and no fainter (2026-11-19). Gaia's 1%
   stars are not spread evenly: near the Sun it caught even dim red dwarfs, far off only
   bright stars, so drawn all together they pile up in a bright ball about the Sun that is
   only how Gaia measures. Cut at this, each part of the picture shows the same kinds of
   star. Gaia DR3's parallax error, roughly: 0.015 mas to G 13, then growing 1.58 times a
   magnitude (0.04 at G 15, 0.1 at 17; Lindegren et al. 2021). A 1% distance at d parsecs
   needs an error under 10/d mas, which none has much past 650 parsecs; so past
   COMPLETE_TO_PC the cut stays where it is there, and the stars thin out as Gaia's do. */
export const COMPLETE_TO_PC = 600;
export function magLimitOf(outerPc) {
    const d = Math.min(outerPc, COMPLETE_TO_PC);
    if (d <= 10) return 99;
    const g = 13 + 5 * Math.log10(Math.max(1, 10 / d / 0.015));
    return g - 5 * Math.log10(d / 10);
}

/* The index's nodes as a tree: path to { path, count, cube, children }. */
export function treeOf(index) {
    const tree = new Map(index.nodes.map(([path, count]) => [path, { path, count, cube: cubeOf(path, index.rootHalf), children: [] }]));
    for (const node of tree.values()) if (node.path) tree.get(node.path.slice(0, -1))?.children.push(node.path);
    return tree;
}

/* How wide a node's cube is on screen (half its side, in pixels), and whether any of it can
   be: its corners all project within a ball of half the cube's diagonal about its centre,
   whatever way the map is turned. project: projector(view, cam), from js/rubinview.js. */
export function nodeOnScreen(node, view, project, outerPc = Infinity) {
    const { cx, cy, cz, half } = node.cube;
    const [sx, sy] = project(cx * AU_PER_PARSEC, cy * AU_PER_PARSEC, cz * AU_PER_PARSEC);
    const halfPx = half * AU_PER_PARSEC * view.scale;
    const reach = halfPx * Math.sqrt(3);
    const edge = view.sizePx / 2;
    /* And whether any of its cube is within the place's edge, about the Sun. */
    const inPlace = Math.hypot(cx, cy, cz) <= outerPc + half * Math.sqrt(3);
    const away = Math.hypot(sx - edge, sy - edge);
    return { halfPx, away, visible: inPlace && Math.abs(sx - edge) <= edge + reach && Math.abs(sy - edge) <= edge + reach };
}

export function tilesToDraw(tree, view, project, { outerPc = Infinity, descendPx = DESCEND_PX, budget = STAR_BUDGET } = {}) {
    const root = tree.get('');
    if (!root) return [];
    const chosen = [];
    let stars = 0;
    const queue = [{ node: root, ...nodeOnScreen(root, view, project, outerPc) }];
    while (queue.length) {
        /* The largest on screen next, and of those alike the nearest the view's middle: so a
           budget run out part way down a level fills a round patch about the middle, not
           scattered squares. Queues stay short (a few hundred), so a sort will do. */
        queue.sort((a, b) => b.halfPx - a.halfPx || a.away - b.away);
        const { node, halfPx, visible } = queue.shift();
        if (!visible) continue;
        if (stars + node.count > budget) continue;
        chosen.push(node.path);
        stars += node.count;
        if (halfPx > descendPx) for (const p of node.children) { const child = tree.get(p); queue.push({ node: child, ...nodeOnScreen(child, view, project, outerPc) }); }
    }
    return chosen;
}

/* How much to dim every star, so that a picture of many reads as a field of stars and not
   a white glare that hides the map's marks: by how many stars share each pixel, over the
   disc they fill (out to the place's edge, or to as far as Gaia's 1% stars go). Added
   light: past about one star in eight pixels, on average over that disc (the middle is
   much fuller), everything is dimmed alike. Set by eye, 2026-11-19. */
export const STARS_PER_PIXEL = 0.12;
export function glowOf(count, view, outerPc) {
    const r = Math.min(outerPc, COMPLETE_TO_PC * 1.1) * AU_PER_PARSEC * view.scale;
    const area = Math.min(Math.PI * r * r, view.sizePx * view.sizePx);
    return area > 0 ? Math.min(1, (STARS_PER_PIXEL * area) / Math.max(1, count)) : 1;
}

/* The tiles drawn whose stars stop short: those with a child in the picture that is not
   drawn. A tile holds the brightest of its cube, so where its children are missing the
   stars fainter than its faintest are missing too; cutting the whole picture at the
   faintest of these (frontierLimit) shows the same kinds of star everywhere, however the
   budget fell. */
export function frontierOf(tree, chosen, view, project, outerPc = Infinity) {
    const drawn = new Set(chosen);
    return chosen.filter((path) => tree.get(path).children.some((c) => !drawn.has(c) && nodeOnScreen(tree.get(c), view, project, outerPc).visible));
}
/* faintest: a tile's faintest absolute magnitude, or undefined until it has loaded. */
export function frontierLimit(frontier, faintest, limit) {
    for (const path of frontier) {
        const f = faintest(path);
        if (f !== undefined) limit = Math.min(limit, f);
    }
    return limit;
}

/* How a star looks, from its tile's brightness and colour bytes: its size in CSS pixels,
   its opacity, and its colour. Brighter (lower absolute magnitude) is larger and more
   opaque; the colour follows Gaia's BP-RP, from blue-white hot stars through the Sun's
   pale yellow to the orange and red of the cool ones. These are the stars' own colours,
   roughly, not a palette carrying meaning. */
const RAMP = [
    [-0.4, [0.62, 0.72, 1.0]],
    [0.3, [0.86, 0.9, 1.0]],
    [0.82, [1.0, 0.96, 0.86]],
    [1.5, [1.0, 0.83, 0.62]],
    [2.5, [1.0, 0.68, 0.45]],
    [3.5, [1.0, 0.55, 0.35]],
];
const NO_COLOUR_TINT = [0.9, 0.9, 0.9];
export function tintOf(colourByte) {
    const c = colourOf(colourByte);
    if (c === null) return NO_COLOUR_TINT;
    if (c <= RAMP[0][0]) return RAMP[0][1];
    for (let k = 1; k < RAMP.length; k++) {
        const [c1, t1] = RAMP[k];
        if (c <= c1) {
            const [c0, t0] = RAMP[k - 1];
            const f = (c - c0) / (c1 - c0);
            return t0.map((v, d) => v + (t1[d] - v) * f);
        }
    }
    return RAMP.at(-1)[1];
}
export function lookOf(magByte) {
    const m = magOf(magByte);
    return {
        size: Math.min(3, Math.max(1, 1 + (4 - m) * 0.25)),
        alpha: Math.min(1, Math.max(0.05, 0.1 + (8 - m) * 0.06)),
    };
}

/* ---- Pointing at a star ------------------------------------------------------------------
 *
 * The star under the pointer: the nearest drawn within maxPx of it, among the tiles drawn
 * (each { cube, count, xyz } as decodeTile gives, xyz in parsecs). The same stars the
 * picture shows: not inside the street, not past the place's edge (outerPc). A tile whose cube
 * cannot come within maxPx of the pointer is skipped whole, so this is quick. Null if none.
 */
export function nearestStar(tiles, view, project, px, py, { outerPc = Infinity, maxPx = 6, magLimit = magLimitOf(outerPc) } = {}) {
    let best = null;
    let bestPx = maxPx;
    for (const tile of tiles) {
        const { cx, cy, cz, half } = tile.cube;
        const [tx, ty] = project(cx * AU_PER_PARSEC, cy * AU_PER_PARSEC, cz * AU_PER_PARSEC);
        if (Math.hypot(tx - px, ty - py) > half * AU_PER_PARSEC * view.scale * Math.sqrt(3) + maxPx) continue;
        const { xyz } = tile;
        for (let k = 0; k < tile.count; k++) {
            const [x, y, z] = [xyz[k * 3], xyz[k * 3 + 1], xyz[k * 3 + 2]];
            const [sx, sy] = project(x * AU_PER_PARSEC, y * AU_PER_PARSEC, z * AU_PER_PARSEC);
            const off = Math.hypot(sx - px, sy - py);
            if (off >= bestPx) continue;
            if (Math.hypot(x, y, z) < STREET_PC) continue;
            if (tile.mag && magOf(tile.mag[k]) > magLimit) continue;
            if (Math.hypot(x, y, z) > outerPc) continue;
            best = { tile, k, x, y, z };
            bestPx = off;
        }
    }
    return best;
}

/* ---- What a star is, in words -------------------------------------------------------------
 *
 * From the little a tile keeps: where it is, its absolute brightness in Gaia's light (G)
 * and its colour (BP-RP). Rough on purpose: a tile keeps brightness to an eighth of a
 * magnitude. The Sun's absolute G is 4.67 (Casagrande & VandenBerg 2018).
 */
export const SUN_ABS_G = 4.67;
export const LY_PER_PARSEC = 3.261564;
const twoFigures = (n) => Number(n.toPrecision(2)).toLocaleString('en-US');
export function lightText(absMag) {
    const times = 10 ** ((SUN_ABS_G - absMag) / 2.5);
    if (times >= 1.5) return [`${twoFigures(times)} times the Sun's light,`, 'given off in all'];
    if (times > 0.67) return ["About the Sun's light,", 'given off in all'];
    if (times >= 0.01) return [`${twoFigures(times * 100)}% of the Sun's light,`, 'given off in all'];
    return [`1/${twoFigures(1 / times)} of the Sun's light,`, 'given off in all'];
}
export function colourText(bpRp) {
    if (bpRp === null) return null;
    if (bpRp < 0.2) return ['Blue-white:', 'far hotter than the Sun'];
    if (bpRp < 0.65) return ['White:', 'hotter than the Sun'];
    if (bpRp < 1.0) return ['Yellow-white:', "about the Sun's colour and heat"];
    if (bpRp < 2.0) return ['Orange:', 'cooler than the Sun'];
    return ['Red:', 'much cooler than the Sun'];
}
/* Where colour and brightness put a star off the main run of stars like the Sun: giants,
   bright for how cool they are; white dwarfs, faint for how hot. Rough lines drawn on
   Gaia's own chart of colour against brightness. */
export function kindText(absMag, bpRp) {
    if (bpRp === null) return null;
    if (absMag < 2.5 && bpRp > 0.9) return ['A giant:', 'a star that has used up the hydrogen at its core and swollen'];
    if (absMag > 10 + 2.5 * bpRp && bpRp < 1.2) return ['A white dwarf:', "the cooling core of a star that has died, about Earth's size"];
    return null;
}
export const lightYearsText = (pc) => `${Number((pc * LY_PER_PARSEC).toPrecision(3)).toLocaleString("en-US")} light years`;
export function starRows({ x, y, z }, magByte, colourByte) {
    const absMag = magOf(magByte);
    const bpRp = colourOf(colourByte);
    return [
        ['A star', "from Gaia's map, its distance known to within 1%"],
        [lightYearsText(Math.hypot(x, y, z)), 'from the Sun'],
        lightText(absMag),
        colourText(bpRp),
        kindText(absMag, bpRp),
    ].filter(Boolean);
}

/* ---- Gaia BH1 -----------------------------------------------------------------------------
 *
 * The nearest black hole known (owner, 2026-11-19: "Where is Gaia BH1?" is the test this
 * tab should pass). El-Badry et al. 2023, MNRAS 518, 1057: a black hole of about 9.6 Suns
 * with a Sun-like star circling it every 185.6 days, found from the wobble Gaia measured in
 * that star's path. Its sky place and parallax are the star's, Gaia DR3 4373465352415301632.
 */
export const GAIA_BH1 = {
    id: 'gaiabh1',
    name: 'Gaia BH1',
    ra: 262.17120816,
    dec: -0.58109202,
    parallaxMas: 2.0955,
};
export const gaiaBh1Pc = () => 1000 / GAIA_BH1.parallaxMas;
export const GAIA_BH1_ROWS = [
    ['Gaia BH1', 'the nearest black hole known'],
    [`About ${lightYearsText(gaiaBh1Pc())}`, 'from the Sun, in the constellation Ophiuchus'],
    ["About 9.6 times the Sun's mass,", 'and dark: it gives off no light of its own'],
    ['A star like the Sun circles it', 'every 186 days, about as far out as Mars is from the Sun'],
    ['Found in 2022', "from the wobble Gaia measured in that star's path"],
];
