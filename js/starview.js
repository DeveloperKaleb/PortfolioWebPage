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
 * Only the stars within a ball about the view's middle are drawn (reachOf): as far as the
 * picture's corners, in every direction, so looking down on the map is not looking down a
 * column thousands of parsecs deep. Zooming in shrinks the ball with the picture.
 *
 * Stars nearer the Sun than STREET_AU (a million AU) are not drawn: the street's 48 systems
 * (js/nearstars.js, js/centauri.js) are drawn there already, as marks.
 */
import { AU_PER_PARSEC } from './centauri.js';
import { cubeOf, magOf, colourOf } from './startiles.js';

export const STREET_AU = 1000000;
export const STREET_PC = STREET_AU / AU_PER_PARSEC;
/* The Galactic block, as far as the preview reaches: the Local Bubble's scale. */
export const BLOCK_PC = 250;
export const DESCEND_PX = 48;
export const STAR_BUDGET = 400000;

/* How far from the view's middle stars are drawn, in AU: to the picture's corners. */
export const reachOf = (view) => (view.sizePx / 2) / view.scale * Math.SQRT2;

/* The index's nodes as a tree: path to { path, count, cube, children }. */
export function treeOf(index) {
    const tree = new Map(index.nodes.map(([path, count]) => [path, { path, count, cube: cubeOf(path, index.rootHalf), children: [] }]));
    for (const node of tree.values()) if (node.path) tree.get(node.path.slice(0, -1))?.children.push(node.path);
    return tree;
}

/* How wide a node's cube is on screen (half its side, in pixels), and whether any of it can
   be: its corners all project within a ball of half the cube's diagonal about its centre,
   whatever way the map is turned. project: projector(view, cam), from js/rubinview.js. */
export function nodeOnScreen(node, view, project) {
    const { cx, cy, cz, half } = node.cube;
    const [sx, sy] = project(cx * AU_PER_PARSEC, cy * AU_PER_PARSEC, cz * AU_PER_PARSEC);
    const halfPx = half * AU_PER_PARSEC * view.scale;
    const reach = halfPx * Math.sqrt(3);
    const edge = view.sizePx / 2;
    /* And whether any of its cube is within the ball that is drawn. */
    const away = Math.hypot(cx * AU_PER_PARSEC - view.cx, cy * AU_PER_PARSEC - view.cy, cz * AU_PER_PARSEC - (view.cz ?? 0));
    const inBall = away <= reachOf(view) + half * AU_PER_PARSEC * Math.sqrt(3);
    return { halfPx, visible: inBall && Math.abs(sx - edge) <= edge + reach && Math.abs(sy - edge) <= edge + reach };
}

export function tilesToDraw(tree, view, project, { descendPx = DESCEND_PX, budget = STAR_BUDGET } = {}) {
    const root = tree.get('');
    if (!root) return [];
    const chosen = [];
    let stars = 0;
    const queue = [{ node: root, ...nodeOnScreen(root, view, project) }];
    while (queue.length) {
        /* The largest on screen next; queues stay short (a few hundred), so a sort will do. */
        queue.sort((a, b) => b.halfPx - a.halfPx);
        const { node, halfPx, visible } = queue.shift();
        if (!visible) continue;
        if (stars + node.count > budget) continue;
        chosen.push(node.path);
        stars += node.count;
        if (halfPx > descendPx) for (const p of node.children) { const child = tree.get(p); queue.push({ node: child, ...nodeOnScreen(child, view, project) }); }
    }
    return chosen;
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
