/* Pets: a toy with an animal in it, with no DOM and no timers.
 *
 * Nothing to win or lose. A pixel-art pet in a small room - a yellow Labrador retriever
 * first, with the species list there for the animals to come. Stroke it and it leans
 * into the hand and gives a soft bark; drag food or water to its bowls and it walks over
 * to eat or drink.
 *
 * This file holds what can be tested without a browser: the sprites, the layout of the
 * room, what counts as a stroke and when a bark is due, and the bowls. Everything with a
 * clock - the walk, the chomping, the wag, the bark's length and its sound - belongs to
 * the DOM layer, as it does for Sequence. The colours are PETS_COLORS in js/logic.js,
 * where the contrast rules can reach them.
 */

/* --- Sprites ---
 *
 * Rows of palette keys, one character a pixel; '.' is transparent. SPRITE_KEYS names the
 * PETS_COLORS entry each key is drawn in. The dog is two layers, head and body, so a pose
 * moves the head without redrawing the dog. */

export const SPRITE_KEYS = {
    o: 'outline',
    f: 'fur',
    s: 'furShade',
    l: 'furLight',
    n: 'nose',
    c: 'collar',
    a: 'foodBowl',
    q: 'waterBowl',
    k: 'kibble',
    w: 'water',
    h: 'waterHighlight',
    B: 'bag',
    L: 'bagLabel',
    m: 'bagCrimp',
};

// Overwrite runs of pixels: each edit is [row, column, text].
export function patchRows(rows, edits) {
    const grid = rows.map((row) => row.split(''));
    for (const [row, col, text] of edits) {
        [...text].forEach((ch, i) => { grid[row][col + i] = ch; });
    }
    return grid.map((row) => row.join(''));
}

/* The Labrador's head, facing left: a broad skull, a deep muzzle with a single-pixel nose
   at its front, and the drop ear hanging beside the cheek. The first draft had a nose two
   pixels deep, which read as a beak. */
const DOG_HEAD = [
    '.....ooooo..',
    '....offfffo.',
    'oooofffsssfo',
    'nfffffnsssfo',
    'offfffffsssf',
    '.olllllfsssf',
    '..ooooolsss.',
];

/* The body: a thick neck behind the head (so the head can move without leaving a gap), a
   one-pixel collar - a two-pixel one read as a square badge - a straight topline, a deep
   chest, four legs, and the thick "otter" tail a Labrador is known by. */
const DOG_BODY = [
    '............................',
    '............................',
    '............................',
    '............................',
    '..........ffo...............',
    '..........fffo..............',
    '..........fcffooooooooo.....',
    '......olfffcfffffffffffoooo.',
    '......ollffcfffffffffffffffo',
    '......olllfcfffffffffffoooo.',
    '......olllfffffffffffffo....',
    '......ollssssssssssssso.....',
    '.......offsooooooooffso.....',
    '.......ofso.......offso.....',
    '.......ofso.......offso.....',
    '.......ofso.......offso.....',
    '.......ofso.......offso.....',
    '.......oooo.......ooooo.....',
];

// The tail up, for the wag.
const TAIL_UP = [[5, 23, '...oo'], [6, 23, '.oofo'], [7, 23, 'offfo'], [8, 23, 'fffo.'], [9, 23, 'ooo..']];

/* Head down to a bowl. Lowering the head alone left the neck sticking up out of the back,
   so eating has its own body: the neck bump gone and the topline running down to where
   the lowered head meets it. */
const DOG_BODY_DOWN = patchRows(DOG_BODY, [
    [4, 10, '...'],
    [5, 10, '....'],
    [6, 10, '.oooo'],
    [7, 6, '....oc'],
    [8, 6, '...ofc'],
]);

export const SPECIES = {
    dog: {
        name: 'Dog',
        description: 'A yellow Labrador retriever',
        size: { width: 28, height: 18 },
        // Where the head is across the sprite, for leaning toward the hand.
        headCentreX: 6,
        head: {
            open: DOG_HEAD,
            closed: patchRows(DOG_HEAD, [[3, 6, 'f'], [4, 5, 'oo']]),
            bark: patchRows(DOG_HEAD, [[5, 1, 'nnnn']]),
        },
        body: {
            stand: DOG_BODY,
            wag: patchRows(DOG_BODY, TAIL_UP),
            down: DOG_BODY_DOWN,
            downWag: patchRows(DOG_BODY_DOWN, TAIL_UP),
        },
    },
};

/* Where the head sits over the body in each pose. Leaning is one pixel toward the hand
   and one up - only the head moves, because an earlier draft lifted the whole dog and it
   read as jumping. Down puts the muzzle in the bowl; chompUp is the half of a mouthful
   where the head comes back up a pixel. */
export function headOffset(pose, { leanDx = -1, chompUp = false } = {}) {
    if (pose === 'lean') return { dx: leanDx, dy: -1 };
    if (pose === 'down') return { dx: -2, dy: chompUp ? 6 : 7 };
    return { dx: 0, dy: 0 };
}

/* Merge each row's runs of one colour into a single rect's worth, so a frame is tens of
   SVG rects rather than hundreds. */
export function spriteRuns(rows) {
    const runs = [];
    rows.forEach((row, y) => {
        let x = 0;
        while (x < row.length) {
            const key = row[x];
            if (key === '.') {
                x += 1;
                continue;
            }
            let end = x + 1;
            while (end < row.length && row[end] === key) end += 1;
            runs.push({ x, y, width: end - x, key });
            x = end;
        }
    });
    return runs;
}

/* --- The room ---
 *
 * 52 x 26 pixels, so on a phone each pixel is six or seven screen pixels across: small
 * enough to be a scene, large enough that the pixels are plainly visible, which was the
 * brief. */

export const SCENE = { width: 52, height: 26, floorY: 18 };
export const DOG_Y = 6;
export const HOME_X = 22;

export const BOWL_SIZE = { width: 9, height: 5 };
export const BOWL_LEVELS = 3;
export const BOWLS = {
    food: { x: 1, y: 19 },
    water: { x: 12, y: 19 },
};
export const ITEMS = ['food', 'water'];

const BOWL_FILL = ['.........', '...xxx...', '..xxxxx..', '.xxxxxxx.'];
const BOWL_BASE = ['ooooooooo', 'oBBBBBBBo', '.oBBBBBo.', '..ooooo..'];

// A bowl at a level from 0 (empty) to BOWL_LEVELS, contents in its top row.
export function bowlRows(kind, level) {
    const content = kind === 'food' ? 'k' : 'w';
    const body = kind === 'food' ? 'a' : 'q';
    const clamped = Math.max(0, Math.min(BOWL_LEVELS, level));
    return [BOWL_FILL[clamped].replace(/x/g, content), ...BOWL_BASE.map((row) => row.replace(/B/g, body))];
}

// The icons in the tray below the room: a bag of kibble, and a drop of water.
export const ITEM_ICONS = {
    food: [
        '.oooooo.', '.ommmmo.', 'oooooooo', 'oBBBBBBo', 'oBLLLLBo',
        'oBLkkLBo', 'oBLkkLBo', 'oBLLLLBo', 'oBBBBBBo', 'oooooooo',
    ],
    water: [
        '...oo...', '...oo...', '..owwo..', '..owwo..', '.owwwwo.',
        '.owhwwo.', 'owwhwwwo', 'owwwwwwo', '.owwwwo.', '..oooo..',
    ],
};

/* Where the dog stands to eat from a bowl. With the head down, the muzzle is two pixels in
   front of the dog's own position, so standing at the bowl's centre column puts it over
   the middle of the bowl. */
export const dogXForBowl = (kind) => BOWLS[kind].x + Math.floor(BOWL_SIZE.width / 2);

// One pixel of walking toward a target.
export const stepToward = (x, target) => x + Math.sign(target - x);

/* --- Petting --- */

export const PETTING = {
    strokeStartPx: 24,   // pointer travel over the dog before a press counts as a stroke
    idleStopMs: 450,     // a hand held still this long has stopped stroking
    barkAfterRubMs: 600, // rubbing at least this long earns a bark when the hand lifts
    longPetBarkMs: 2200, // ...or while still stroking, after this long
    barkCooldownMs: 2500, // never two barks closer than this
};

export const startStroke = (point) => ({
    last: point,
    travel: 0,
    lastMoveAt: point.t,
    rubbingSince: null,
    barked: false,
});

/* Add a pointer sample. A stroke is travel, not a tap: rubbing begins once the pointer has
   moved strokeStartPx in total while pressed. */
export function moveStroke(stroke, point, rules = PETTING) {
    const distance = Math.hypot(point.x - stroke.last.x, point.y - stroke.last.y);
    const travel = stroke.travel + distance;
    const rubbingSince = stroke.rubbingSince ?? (travel >= rules.strokeStartPx ? point.t : null);
    return {
        ...stroke,
        last: point,
        travel,
        lastMoveAt: distance > 0 ? point.t : stroke.lastMoveAt,
        rubbingSince,
    };
}

export const isRubbing = (stroke, now, rules = PETTING) =>
    Boolean(stroke) && stroke.rubbingSince !== null && now - stroke.lastMoveAt <= rules.idleStopMs;

/* Whether this stroke has earned its bark. Once per stroke, never within the cooldown of
   the last one - so the dog cannot be made to yap - and never for a tap. `ending` is the
   hand lifting: that barks after a short rub. While still stroking, it takes a long one. */
export function barkDue(stroke, { now, ending = false, lastBarkAt = -Infinity }, rules = PETTING) {
    if (!stroke || stroke.barked || stroke.rubbingSince === null) return false;
    if (now - lastBarkAt < rules.barkCooldownMs) return false;
    if (ending) return stroke.lastMoveAt - stroke.rubbingSince >= rules.barkAfterRubMs;
    return isRubbing(stroke, now, rules) && now - stroke.rubbingSince >= rules.longPetBarkMs;
}

// Which way the head leans: toward the hand.
export const leanToward = (pointerX, headCentreX) => (pointerX < headCentreX ? -1 : 1);

/* The bark: a "wuf", not a yap. Pitch jumps from start to peak and falls away to end
   over the duration; the DOM layer plays it through a low-pass, which is most of what
   makes it gentle. */
export const BARK = { startHz: 300, peakHz: 440, endHz: 210, durationMs: 220, gain: 0.14 };

/* --- The bowls --- */

export const emptyBowls = () => ({ food: 0, water: 0 });

// Fill a bowl to the top. A full bowl stays as it is, and says so.
export function fillBowl(bowls, kind) {
    if (bowls[kind] >= BOWL_LEVELS) return { bowls, filled: false };
    return { bowls: { ...bowls, [kind]: BOWL_LEVELS }, filled: true };
}

export const takeBite = (bowls, kind) => ({ ...bowls, [kind]: Math.max(0, bowls[kind] - 1) });

export const acceptsItem = (bowlKind, item) => bowlKind === item;

// The bowl to go to next: the preferred one if it has anything in it, else the other.
export function bowlToVisit(bowls, preferred = 'food') {
    const order = preferred === 'water' ? ['water', 'food'] : ['food', 'water'];
    return order.find((kind) => bowls[kind] > 0) ?? null;
}

/* Which target a dropped item lands on. Each target is { kind, rect } in screen pixels;
   `pad` is slack around each, because a finger is not a cursor. Where the slack around
   two bowls overlaps, the nearer centre wins. */
export function dropTarget(point, targets, pad = 0) {
    const hits = targets.filter(({ rect }) =>
        point.x >= rect.left - pad && point.x <= rect.right + pad
        && point.y >= rect.top - pad && point.y <= rect.bottom + pad);
    if (!hits.length) return null;

    const distance = ({ rect }) => Math.hypot(
        point.x - (rect.left + rect.right) / 2,
        point.y - (rect.top + rect.bottom) / 2,
    );
    return hits.reduce((best, hit) => (distance(hit) < distance(best) ? hit : best)).kind;
}
