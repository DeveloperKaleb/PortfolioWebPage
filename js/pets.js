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
    d: 'collarShade',
    t: 'collarTag',
    p: 'tongue',
    a: 'foodBowl',
    q: 'waterBowl',
    k: 'kibble',
    w: 'water',
    h: 'waterHighlight',
    B: 'bag',
    L: 'bagLabel',
    m: 'bagCrimp',
    // The room's furnishings.
    e: 'sceneLine',
    W: 'trim',
    S: 'sky',
    F: 'fence',
    R: 'grass',
    T: 'grassShade',
    g: 'leaf',
    G: 'leafShade',
    P: 'pot',
    Q: 'potShade',
    // The night sky.
    M: 'moon',
    K: 'star',
    // The fish and its tank.
    y: 'fishBody',
    j: 'fishShade',
    i: 'fishFin',
    U: 'tankWater',
    V: 'tankSurface',
    A: 'tankAir',
    N: 'tankLid',
    X: 'gravel',
    Y: 'gravelShade',
    C: 'flake',
    H: 'bubble',
    D: 'stand',
    E: 'standShade',
    J: 'shaker',
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
   straight topline, a deep chest, four legs, and the thick "otter" tail a Labrador is known
   by. The collar is drawn over it - see COLLAR_UPRIGHT. */
const DOG_BODY = [
    '............................',
    '............................',
    '............................',
    '............................',
    '..........ffo...............',
    '..........fffo..............',
    '..........ffffooooooooo.....',
    '......olfffffffffffffffoooo.',
    '......ollffffffffffffffffffo',
    '......olllfffffffffffffoooo.',
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
    [7, 6, '....of'],
    [8, 6, '...off'],
]);

/* Sitting, the resting pose: front legs straight under the chest, the back sloping down to
   the haunch, the tail along the floor behind. The neck is the standing body's, so the
   head sits in the same place on both. */
const DOG_SIT = [
    '............................',
    '............................',
    '............................',
    '............................',
    '..........ffo...............',
    '..........fffo..............',
    '..........ffffo.............',
    '......olfffffffo............',
    '......ollfffffffo...........',
    '......olllfffffffo..........',
    '......olllffffffffo.........',
    '......ollssfffffffso........',
    '.......ofsoffffffssso.......',
    '.......ofsofffffssssso......',
    '.......ofsoffffsssssso......',
    '.......ofsoffffssssssooooo..',
    '.......ofsofffffffffffffffo.',
    '.......oooooooooooooooooooo.',
];

// The tip of the tail lifting off the floor, for the wag while sitting.
const TAIL_SWISH = [[14, 22, '..oo'], [15, 21, 'ooofo.'], [16, 24, 'fo..'], [17, 24, 'oo..']];

/* The walk's two strides - the legs and feet only, rows 13 to 17; everything above is the
   standing body. Standing, each pair of legs is drawn as one post, the near leg in fur and
   the far leg in shade. A stride splits them: in the first the near front leg reaches
   forward and the near back leg back, with the far legs the other way; the second is the
   opposite. The frames between them are the standing body, the legs passing underneath. */
const STRIDE_A = [
    '.......ofso.......offso.....',
    '......ofooso.....osoffo.....',
    '.....ofo..oso...oso.offo....',
    '.....ofo..oso...oso.offo....',
    '.....ooo..ooo...ooo.oooo....',
].map((text, i) => [13 + i, 0, text]);

const STRIDE_B = [
    '.......ofso.......offso.....',
    '......osoofo.....offoso.....',
    '.....oso..ofo...offo.oso....',
    '.....oso..ofo...offo.oso....',
    '.....ooo..ooo...oooo.ooo....',
].map((text, i) => [13 + i, 0, text]);

/* The collar. It was a one-pixel strip standing up the neck, and the owner could not tell
   what it was meant to be - rightly: a collar seen from the side is a band slanting across
   the neck, from the nape down to the throat. So that is what is drawn, two pixels deep
   with a darker lower edge for the curve round the neck, and a small pale tag at the
   throat. Of four drafts, a one-pixel slant looked broken and a steeper band read as a
   sash. With the head lowered the neck runs the other way, so there the band crosses it
   at the other slant. */
const COLLAR_UPRIGHT = [[6, 12, 'cc'], [7, 10, 'ccd'], [8, 8, 'ccd'], [9, 7, 'cd'], [10, 7, 't']];
const COLLAR_LOWERED = [[7, 12, 'c'], [8, 11, 'cd'], [9, 10, 'cd'], [10, 10, 't']];

/* Asleep: lying down, the body low along the floor, the front paws reaching out under the
   chin and the tail lying behind with its tip curled. The head is the usual one with its eye
   shut, lowered onto the paws (see headOffset); it covers the front of the neck, so the
   collar shows as a band behind it. Collar and tail are drawn in. */
const DOG_SLEEP = [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '...........ooooooooooo......',
    '..........ofcfffffffffoo....',
    '.........offcdfffffffffffo..',
    '.........offcdffffffffffffo.',
    '.........offdffffffffffsffo.',
    '.........offffffffffffsssfo.',
    '.........ossfffffffffsssssoo',
    '..offffffosssssssssssssssffo',
    '..oooooooooooooooooooooooooo',
];

// Breathing in, the back rises a pixel: rows 8 to 11 take the rows below them.
const DOG_SLEEP_BREATH = DOG_SLEEP.map((row, y) => (y >= 8 && y <= 11 ? DOG_SLEEP[y + 1] : row));

/* The goldfish, the second animal (2026-09-12), facing left like the dog: the mouth at the
   left, an eye, a dorsal fin, a side fin, and a fanned tail. It is one layer - nothing on a
   fish moves separately enough to need a head of its own. Swimming, the tail folds and
   fans; eating, the mouth opens; asleep, the eye shuts to a line. */
const FISH = [
    '....oooo.....',
    '..ooyyyyoo.oo',
    '.oynyyyyyyoio',
    'oyyyyyyyyyiio',
    '.ojjyiiyyjoio',
    '..oojjjjoo.oo',
    '....oooo.....',
];
const FISH_TAIL_FOLDED = [[1, 10, '...'], [2, 10, 'ooo'], [4, 10, 'ooo'], [5, 10, '...']];

export const SPECIES = {
    dog: {
        name: 'Dog',
        description: 'A yellow Labrador retriever',
        size: { width: 28, height: 18 },
        // Where the head is across the sprite, for leaning toward the hand.
        headCentreX: 6,
        habitat: 'room',
        // Where the Z's start while it sleeps, relative to the sprite: just above the head.
        zzzOrigin: { x: 10, y: 6 },
        head: {
            open: DOG_HEAD,
            /* Being petted: the eyes squinted shut in upturned arcs, the mouth hanging open,
               and a pixel or two of tongue over the jaw - a panting smile. It replaced a
               single closed-eye line when the owner asked for more detail. Of three drafts,
               one also lifted the brow and swept the ear back; the brow read as a crack in
               the skull, so it went. */
            happy: patchRows(DOG_HEAD, [[2, 6, 'o'], [3, 5, 'ofo'], [5, 2, 'nnno'], [6, 2, 'pp']]),
            bark: patchRows(DOG_HEAD, [[5, 1, 'nnnn']]),
            // Asleep: the eye shut to a short line.
            asleep: patchRows(DOG_HEAD, [[3, 5, 'oo']]),
        },
        body: {
            sit: patchRows(DOG_SIT, COLLAR_UPRIGHT),
            sitWag: patchRows(DOG_SIT, [...COLLAR_UPRIGHT, ...TAIL_SWISH]),
            stand: patchRows(DOG_BODY, COLLAR_UPRIGHT),
            wag: patchRows(DOG_BODY, [...COLLAR_UPRIGHT, ...TAIL_UP]),
            down: patchRows(DOG_BODY_DOWN, COLLAR_LOWERED),
            downWag: patchRows(DOG_BODY_DOWN, [...COLLAR_LOWERED, ...TAIL_UP]),
            walkA: patchRows(DOG_BODY, [...COLLAR_UPRIGHT, ...STRIDE_A]),
            walkAWag: patchRows(DOG_BODY, [...COLLAR_UPRIGHT, ...STRIDE_A, ...TAIL_UP]),
            walkB: patchRows(DOG_BODY, [...COLLAR_UPRIGHT, ...STRIDE_B]),
            walkBWag: patchRows(DOG_BODY, [...COLLAR_UPRIGHT, ...STRIDE_B, ...TAIL_UP]),
            sleep: DOG_SLEEP,
            sleepBreath: DOG_SLEEP_BREATH,
        },
    },
    fish: {
        name: 'Fish',
        description: 'A goldfish',
        habitat: 'tank',
        size: { width: 13, height: 7 },
        zzzOrigin: { x: 3, y: -3 },
        // The mouth, in the sprite as drawn facing left.
        mouth: { x: 0, y: 3 },
        frames: {
            swimA: FISH,
            swimB: patchRows(FISH, FISH_TAIL_FOLDED),
            eat: patchRows(FISH, [[3, 0, '.n']]),
            asleep: patchRows(FISH, [[2, 2, 'jj']]),
        },
    },
};

/* The dog rests sitting - the owner's call. It gets up only to go to a bowl; petting and
   barking happen sitting down, and it sits again once it is home. */
export const RESTING_POSTURE = 'sit';

/* The walk: four frames - a stride, the legs passing under the body, the opposite stride,
   passing again - advancing a frame for every two pixels walked, so the legs keep pace
   with the ground however far the dog goes. Before this the dog slid along on still legs,
   and the owner wanted to close the gap between what the player sees and what they are
   asked to believe. The passing frames are simply the standing body. */
export const WALK_CYCLE = ['walkA', 'stand', 'walkB', 'stand'];
export const PIXELS_PER_WALK_FRAME = 2;

export const walkFrame = (stepsWalked) =>
    WALK_CYCLE[Math.floor(stepsWalked / PIXELS_PER_WALK_FRAME) % WALK_CYCLE.length];

/* Which body to draw for a posture - sit, stand, down, walk or sleep - with the tail going
   if wagging. Asleep, the tail is still; breath is the half of each slow breath where the
   back rises a pixel. */
export function bodyFrame(posture, wag = false, stepsWalked = 0, breath = false) {
    if (posture === 'sleep') return breath ? 'sleepBreath' : 'sleep';
    if (posture === 'walk') {
        const frame = walkFrame(stepsWalked);
        if (frame === 'stand') return wag ? 'wag' : 'stand';
        return wag ? `${frame}Wag` : frame;
    }
    return {
        sit: wag ? 'sitWag' : 'sit',
        stand: wag ? 'wag' : 'stand',
        down: wag ? 'downWag' : 'down',
    }[posture] ?? (wag ? 'sitWag' : 'sit');
}

/* Where the head sits over the body. Sitting and standing share a neck, so the head is in
   the same place on both. Leaning into a stroking hand is one pixel toward it and one up -
   only the head moves, because an earlier draft lifted the whole dog and it read as
   jumping. Down puts the muzzle in the bowl; chompUp is the half of a mouthful where the
   head comes back up a pixel. */
// Asleep, the chin rests on the front paws, nine pixels below where it sits upright.
const SLEEP_HEAD_DY = 9;

export function headOffset(posture, { leaning = false, leanDx = -1, chompUp = false, stepsWalked = 0 } = {}) {
    if (posture === 'sleep') return { dx: 0, dy: SLEEP_HEAD_DY };
    if (posture === 'down') return { dx: -2, dy: chompUp ? 6 : 7 };
    if (leaning) return { dx: leanDx, dy: -1 };
    // Walking, the head dips a pixel on each stride: the bob of a real gait.
    if (posture === 'walk' && walkFrame(stepsWalked) !== 'stand') return { dx: 0, dy: 1 };
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
 * 100 x 50 pixels. It began at 52 x 26, grew to 60 x 30, and grew again to give the dog
 * room to wander when fidgeting arrived. The last time, the room's size on screen stayed
 * where it was, so the dog shrank on screen while keeping every pixel of its drawing - the
 * owner's call. On a phone a room pixel is now about three screen pixels across, where the
 * pixel look begins to soften; that was offered as the cost, and chosen. */

export const SCENE = { width: 100, height: 50, floorY: 35 };
export const DOG_Y = 27;
export const HOME_X = 48;

export const BOWL_SIZE = { width: 9, height: 5 };
export const BOWL_LEVELS = 3;
export const BOWLS = {
    food: { x: 4, y: 40 },
    water: { x: 16, y: 40 },
};
export const ITEMS = ['food', 'water'];

/* The furnishings, so the room looks lived in (2026-09-12): a skirting board where the
 * wall meets the floor, floorboard seams, a window onto the yard and a plant in the back
 * right corner. All drawn behind the dog. The window sits above the highest the dog's head
 * goes, so the dog never walks in front of it; the plant stands on the floor, and the dog
 * walks in front of it when it fidgets that far right. */
export const SKIRTING_TOP = SCENE.floorY - 4;     // an edge line, three rows of board, an edge line
export const FLOOR_SEAMS = [SCENE.floorY + 1, SCENE.floorY + 6, SCENE.floorY + 11];

// Two panes - a crossbar cut the fence into dashes - over sky, a picket fence and grass.
export const WINDOW = {
    x: 34,
    y: 5,
    rows: [
        '..eeeeeeeeeeeeeeeeeeeeeeeeeee..',
        '..eWWWWWWWWWWWWWWWWWWWWWWWWWe..',
        '..eWSSSSSSSSSSSWSSSSSSSSSSSWe..',
        '..eWSSSSSSSSSSSWSSSSSSSSSSSWe..',
        '..eWSSSSSSSSSSSWSSSSSSSSSSSWe..',
        '..eWSSSSSSSSSSSWSSSSSSSSSSSWe..',
        '..eWSSSSSSSSSSSWSSSSSSSSSSSWe..',
        '..eWSFSSFSSFSSFWSFSSFSSFSSFWe..',
        '..eWFFFFFFFFFFFWFFFFFFFFFFFWe..',
        '..eWSFSSFSSFSSFWSFSSFSSFSSFWe..',
        '..eWFFFFFFFFFFFWFFFFFFFFFFFWe..',
        '..eWSFSSFSSFSSFWSFSSFSSFSSFWe..',
        '..eWTTTTTTTTTTTWTTTTTTTTTTTWe..',
        '..eWRRTRRRRTRRRWTRRRRTRRRRTWe..',
        '..eWRRRTRRRRTRRWRTRRRRTRRRRWe..',
        '..eWRRRRRRRRRRRWRRRRRRRRRRRWe..',
        '..eWWWWWWWWWWWWWWWWWWWWWWWWWe..',
        'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        'eWWWWWWWWWWWWWWWWWWWWWWWWWWWWWe',
        'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    ],
};

// A leafy houseplant in a blue pot. A first draft of upright leaves read as a cactus.
export const PLANT = {
    x: 84,
    y: 16,
    rows: [
        '.....eeeee....',
        '....egggge....',
        '....egggge....',
        '..eeGggggGeee.',
        '.egggGggGGggge',
        '.eggggGGGgggge',
        '.eggGGgggGGgge',
        '..eGgGgggGgGe.',
        '..eggGgggGgge.',
        '.eggggGGGggge.',
        '..egggGegggge.',
        '..eegee.eegee.',
        '....e.eGe.e...',
        '......eGe.....',
        '......eGe.....',
        '......eGe.....',
        '.eeeeeeeeeeee.',
        '.ePPPPPPPPPQe.',
        '.eeeeeeeeeeee.',
        '..ePPPPPPPQe..',
        '..ePPPPPPPQe..',
        '..ePPPPPPPQe..',
        '...ePPPPPQe...',
        '...eeeeeeee...',
    ],
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/* --- The fish's tank ---
 *
 * The fish lives in a tank on a low wooden stand in the middle of the room: below the
 * window, so the sky and the time of day stay in view, and clear of the plant. Inside, from
 * the top: a light lid, a strip of air, the surface, ten rows of water with two weeds in
 * each corner, and gravel. The lid is light so the Z's of a sleeping fish still show as
 * they rise past it. */
export const TANK = {
    x: 26,
    y: 26,
    rows: [
        'oooooooooooooooooooooooooooooooooooooooooooooooo',
        'oNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNo',
        'oooooooooooooooooooooooooooooooooooooooooooooooo',
        'oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo',
        'oVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVo',
        'oUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUo',
        'oUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUo',
        'oUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUgGUUo',
        'oUUUUGGUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUGGUUUo',
        'oUUUUUgGUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUgGUgGUUo',
        'oUUUUgGUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUgGUgGUUUo',
        'oUUUUUGGUGGUUUUUUUUUUUUUUUUUUUUUUUUUUUUUGGUGGUUo',
        'oUUUUgGUgGUUUUUUUUUUUUUUUUUUUUUUUUUUUUUgGUgGUUUo',
        'oUUUUUgGUgGUUUUUUUUUUUUUUUUUUUUUUUUUUUUUgGUgGUUo',
        'oUUUUGGUGGUUUUUUUUUUUUUUUUUUUUUUUUUUUUUGGUGGUUUo',
        'oXYXXXXYXXXXYXXXXYXXXXYXXXXYXXXXYXXXXYXXXXYXXXXo',
        'oXYXXXYXXXYXXXYXXXYXXXYXXXYXXXYXXXYXXXYXXXYXXXYo',
        'oooooooooooooooooooooooooooooooooooooooooooooooo',
    ],
};
const TANK_WIDTH = TANK.rows[0].length;
export const TANK_SURFACE_Y = TANK.y + 4;

export const STAND = {
    x: 24,
    y: 44,
    rows: [
        'oooooooooooooooooooooooooooooooooooooooooooooooooooo',
        'oDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDo',
        'oEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEo',
        '.oDo............................................oDo.',
        '.ooo............................................ooo.',
    ],
};

/* Where the fish can be - the top-left of its sprite. Its top fin keeps below the surface
   and its sides inside the glass. At maxY its belly rests on the gravel, which is where it
   sleeps; awake it keeps a little higher (see FISH_FIDGET). */
export const FISH_SWIM = {
    minX: TANK.x + 1,
    maxX: TANK.x + TANK_WIDTH - 1 - SPECIES.fish.size.width,
    minY: TANK.y + 5,
    maxY: TANK.y + TANK.rows.length - 1 - SPECIES.fish.size.height,
};
export const FISH_HOME = {
    x: Math.floor((FISH_SWIM.minX + FISH_SWIM.maxX) / 2),
    y: FISH_SWIM.minY + 2,
};

// One pixel of swimming toward a target: across and up or down together.
export const swimStep = (pos, target) => ({ x: stepToward(pos.x, target.x), y: stepToward(pos.y, target.y) });

// The swimming, eating or sleeping frame. The tail flicks every second step.
export function fishFrame({ asleep = false, eating = false, finStep = 0 } = {}) {
    if (asleep) return 'asleep';
    if (eating) return 'eat';
    return Math.floor(finStep / 2) % 2 === 1 ? 'swimB' : 'swimA';
}

// Where the mouth is, in the room, for a fish at pos facing either way.
export function fishMouth(pos, facing, species = SPECIES.fish) {
    const { mouth, size } = species;
    return {
        x: pos.x + (facing === 'right' ? size.width - 1 - mouth.x : mouth.x),
        y: pos.y + mouth.y,
    };
}

// Where the fish goes to put its mouth at a point - a tap on the glass - kept in the water.
export function fishPositionFor(point, facing, bounds = FISH_SWIM, species = SPECIES.fish) {
    const { mouth, size } = species;
    return {
        x: clamp(point.x - (facing === 'right' ? size.width - 1 - mouth.x : mouth.x), bounds.minX, bounds.maxX),
        y: clamp(point.y - mouth.y, bounds.minY, bounds.maxY),
    };
}

/* --- Flakes ---
 *
 * The fish's food: a shake drops three flakes on the water around where the shaker was
 * dropped, and they sink. Never more than six in the tank at once. A flake stops sinking
 * where the fish's mouth can reach it at its lowest, a pixel above the gravel. */
export const FLAKE = ['CC'];
export const FLAKES = { perShake: 3, most: 6, spread: 8 };
export const FLAKE_FLOOR_Y = FISH_SWIM.maxY + SPECIES.fish.mouth.y;
const FLAKE_MIN_X = TANK.x + 3;
const FLAKE_MAX_X = TANK.x + TANK_WIDTH - 4;

export function dropFlakes(flakes, x, random = Math.random, rules = FLAKES) {
    const room = rules.most - flakes.length;
    if (room <= 0) return { flakes, added: 0 };
    const count = Math.min(rules.perShake, room);
    const added = Array.from({ length: count }, () => ({
        x: clamp(Math.round(x - rules.spread + random() * rules.spread * 2), FLAKE_MIN_X, FLAKE_MAX_X),
        y: TANK.y + 5,
    }));
    return { flakes: [...flakes, ...added], added: count };
}

export const sinkFlakes = (flakes) => flakes.map((flake) => ({ ...flake, y: Math.min(FLAKE_FLOOR_Y, flake.y + 1) }));

// The index of the flake nearest a point - the fish's mouth.
export function nearestFlake(point, flakes) {
    let best = -1;
    let bestDistance = Infinity;
    flakes.forEach((flake, i) => {
        const distance = Math.hypot(point.x - (flake.x + 0.5), point.y - flake.y);
        if (distance < bestDistance) {
            best = i;
            bestDistance = distance;
        }
    });
    return best;
}

// Where the fish must be to take a flake: its mouth a pixel beside it, on its level.
function eatingPosition(flake, facing, species = SPECIES.fish) {
    const { mouth, size } = species;
    return {
        x: facing === 'right' ? flake.x - 1 - (size.width - 1 - mouth.x) : flake.x + FLAKE[0].length - mouth.x,
        y: flake.y - mouth.y,
    };
}

export function canEat(pos, facing, flake) {
    const at = eatingPosition(flake, facing);
    return pos.x === at.x && pos.y === at.y;
}

/* How the fish goes for a flake: from the side it is already on, mouth first - so it never
   has to swim through the flake to turn round - unless the glass is in the way on that
   side, when it comes from the other. The target is kept in the water; a flake still too
   high to reach is waited for beneath it. */
export function fishApproach(pos, flake, bounds = FISH_SWIM, species = SPECIES.fish) {
    const fits = (facing) => {
        const { x } = eatingPosition(flake, facing, species);
        return x >= bounds.minX && x <= bounds.maxX;
    };
    const fromRight = pos.x + species.size.width / 2 >= flake.x + 1;
    const preferred = fromRight ? 'left' : 'right';
    const facing = fits(preferred) ? preferred : (preferred === 'left' ? 'right' : 'left');
    const at = eatingPosition(flake, facing, species);
    return {
        facing,
        target: { x: clamp(at.x, bounds.minX, bounds.maxX), y: clamp(at.y, bounds.minY, bounds.maxY) },
    };
}

/* --- Bubbles ---
 *
 * The fish's voice: two when it comes to the glass to say hello, three to say thank you
 * after eating. They start in front of the mouth, one above another, rise a pixel a step,
 * and pop when they reach the surface. */
export const BUBBLE = ['.e.', 'eHe', '.e.'];
const BUBBLE_LOWEST_Y = TANK_SURFACE_Y + 2; // a bubble's centre; its ring stays under the surface

export function bubblesFrom(mouth, count, facing = 'left') {
    return Array.from({ length: count }, (_, i) => ({
        x: clamp(mouth.x + (facing === 'right' ? 2 : -2) + (i % 2), TANK.x + 2, TANK.x + TANK_WIDTH - 3),
        y: Math.max(BUBBLE_LOWEST_Y, mouth.y - 1 - i * 3),
    }));
}

export const riseBubbles = (bubbles) => bubbles
    .map((bubble) => ({ ...bubble, y: bubble.y - 1 }))
    .filter((bubble) => bubble.y >= BUBBLE_LOWEST_Y);

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
    // The fish's: a shaker of flakes, with a picture of the flakes on its label.
    flakes: [
        '..oooo..', '.oNNNNo.', '.oooooo.', 'oJJJJJJo', 'oJLLLLJo',
        'oJLCCLJo', 'oJLCCLJo', 'oJLLLLJo', 'oJJJJJJo', 'oooooooo',
    ],
};

// What each animal is given, and where each thing goes.
export const SPECIES_ITEMS = { dog: ['food', 'water'], fish: ['flakes'] };
export const SPECIES_TARGETS = { dog: ['food', 'water'], fish: ['tank'] };
export const ITEM_TARGETS = { food: 'food', water: 'water', flakes: 'tank' };

/* Where the dog stands to eat from a bowl. With the head down, the muzzle is two pixels in
   front of the dog's own position, so standing at the bowl's centre column puts it over
   the middle of the bowl. */
export const dogXForBowl = (kind) => BOWLS[kind].x + Math.floor(BOWL_SIZE.width / 2);

// One pixel of walking toward a target.
export const stepToward = (x, target) => x + Math.sign(target - x);

/* Which way the dog faces while walking: the way it is going. The sprites face left, so
   facing right is the same drawing mirrored. It turns back to face left when it sits, so
   the bowls, the petting lean and eating all keep working as drawn. */
export const facingFor = (fromX, toX, current = 'left') => {
    if (toX > fromX) return 'right';
    if (toX < fromX) return 'left';
    return current;
};

/* --- Fidgeting ---
 *
 * Left alone, the dog gets up now and then and resettles nearby - the owner's brief. It
 * waits a random whole number of seconds; then gets up, walks a random whole number of
 * pixels from minStep to maxStep, left or right at random, sits, and waits again.
 *
 * The wait is heavily weighted toward the short end: half of all waits are 5 to 10
 * seconds, a quarter 10 up to 25, 15% 25 up to 35, and 10% 35 to 45 - never longer. It was
 * a flat 10 to 90 seconds at first, far too long to watch for; then three bands from a
 * 10-second floor; then, at the owner's ask, the floor came down to 5 and a fourth band was
 * added. The bands are whole seconds that meet without overlapping - 5-9, 10-24, 25-34 and
 * 35-45 - so each second belongs to exactly one, and within a band every second is equally
 * likely.
 *
 * Every move stays inside minX..maxX: clear of the bowls on the left, and with the whole
 * dog - tail included - inside the right wall. */
export const FIDGET = {
    waitBands: [
        { fromSeconds: 5, toSeconds: 9, share: 0.5 },
        { fromSeconds: 10, toSeconds: 24, share: 0.25 },
        { fromSeconds: 25, toSeconds: 34, share: 0.15 },
        { fromSeconds: 35, toSeconds: 45, share: 0.1 },
    ],
    minStep: 8,
    maxStep: 24,
    minX: BOWLS.water.x + BOWL_SIZE.width + 3,
    maxX: SCENE.width - SPECIES.dog.size.width - 2,
};

/* The fish is restless - the owner asked for its fidgets to be "even more heavily biased
 * towards shorter" than the dog's. 70% of its waits are 2 to 4 seconds, 20% 5 to 9, and
 * 10% 10 to 15, never longer; the dog's shortest wait is 5. It swims 6 to 20 pixels across
 * and to any height in its water, short of the gravel it sleeps on. Dusk and night work on
 * it exactly as on the dog. */
export const FISH_FIDGET = {
    waitBands: [
        { fromSeconds: 2, toSeconds: 4, share: 0.7 },
        { fromSeconds: 5, toSeconds: 9, share: 0.2 },
        { fromSeconds: 10, toSeconds: 15, share: 0.1 },
    ],
    minStep: 6,
    maxStep: 20,
    minX: FISH_SWIM.minX,
    maxX: FISH_SWIM.maxX,
    minY: FISH_SWIM.minY,
    maxY: FISH_SWIM.maxY - 2,
};

export const FIDGET_RULES = { dog: FIDGET, fish: FISH_FIDGET };

/* A wait in milliseconds: the first draw picks a band by its share, the second a whole
   second within that band. */
export function fidgetDelayMs(random = Math.random, rules = FIDGET) {
    const roll = random();
    let reached = 0;
    const band = rules.waitBands.find(({ share }) => (reached += share) > roll)
        ?? rules.waitBands[rules.waitBands.length - 1];
    const seconds = band.fromSeconds + Math.floor(random() * (band.toSeconds - band.fromSeconds + 1));
    return seconds * 1000;
}

/* --- Time of day ---
 *
 * The room follows the device's local clock (2026-09-12, the owner's ask). Fixed hours,
 * the owner's pick over hours that shift with the season: those would need a guess at the
 * hemisphere, or the visitor's location. The time of day changes the sky through the
 * window and the dog: drowsy at dusk - the waits between fidgets double - and asleep at
 * night. The clock itself is read in the DOM layer; everything here takes the time as an
 * argument, so it can be tested at any hour. */
export const TIMES_OF_DAY = ['dawn', 'day', 'dusk', 'night'];
export const DAY_STARTS = { dawn: 6, day: 8, dusk: 18, night: 20 }; // local hours

export function timeOfDay(date) {
    const hour = date.getHours();
    if (hour >= DAY_STARTS.night || hour < DAY_STARTS.dawn) return 'night';
    if (hour >= DAY_STARTS.dusk) return 'dusk';
    if (hour >= DAY_STARTS.day) return 'day';
    return 'dawn';
}

export const DUSK_WAIT_SCALE = 2;

/* Night. Left alone, the dog lies down to sleep - on opening the room at night, it is
 * already asleep. Petting wakes it; food and water do not (the owner's call): a bowl
 * filled in the night waits until petting has woken it, and then it goes to eat. Awake at
 * night, it dozes off again once it has settled and been left alone for dozeAfterMs. Its
 * back rises and falls, and Z's drift up from its head, a step every zzzStepMs. */
export const SLEEP = { dozeAfterMs: 20000, zzzStepMs: 350, stepsPerBreath: 4 };

/* How long a pet rests before its next move: a fidget by day, by its own rules - see
   FIDGET_RULES - and dozing off at night. Dusk and night are the same for every animal. */
export function restDelayMs(period, random = Math.random, rules = FIDGET) {
    if (period === 'night') return SLEEP.dozeAfterMs;
    return fidgetDelayMs(random, rules) * (period === 'dusk' ? DUSK_WAIT_SCALE : 1);
}

/* The Z's: two at a time, each rising a pixel a step from just above the head and drifting
 * right, starting as a small z and growing to a big one for the second half of its rise.
 * The small z has a diagonal stroke - a first draft with a straight middle read as an I.
 * Positions are relative to the dog's sprite, which always faces left while asleep. */
const Z_SMALL = ['oo.', '.o.', '.oo'];
const Z_BIG = ['oooo', '..o.', '.o..', 'oooo'];
export const Z_RISE = 8;

// `origin` is where the Z's start for this animal - its species' zzzOrigin.
export function zzzFrame(step, origin = SPECIES.dog.zzzOrigin) {
    return [0, Z_RISE / 2].map((lag) => {
        const k = (((step - lag) % Z_RISE) + Z_RISE) % Z_RISE;
        return {
            x: origin.x + Math.floor(k / 2),
            y: origin.y - k,
            rows: k < Z_RISE / 2 ? Z_SMALL : Z_BIG,
        };
    });
}

/* The night sky: a moon and a few stars, patched over the window's sky. The moon sits in
 * open sky - against the frame, a first draft read as a notch in it. Its corners are sky. */
export const NIGHT_SKY = [
    [3, 19, 'SMMS'], [4, 19, 'MMMM'], [5, 19, 'MMMM'], [6, 19, 'SMMS'],
    [3, 6, 'K'], [5, 10, 'K'], [2, 13, 'K'], [4, 17, 'K'], [6, 25, 'K'],
];

/* Where one fidget takes the dog. A move that would leave the bounds goes the other way
   instead; if a full move fits neither way, the dog goes as far as it can toward the
   side with more room. It always ends somewhere new. */
export function fidgetTarget(x, random = Math.random, rules = FIDGET) {
    const { minStep, maxStep, minX, maxX } = rules;
    const step = minStep + Math.floor(random() * (maxStep - minStep + 1));
    const direction = random() < 0.5 ? -1 : 1;
    const fits = (target) => target >= minX && target <= maxX;

    if (fits(x + direction * step)) return x + direction * step;
    if (fits(x - direction * step)) return x - direction * step;
    return x - minX >= maxX - x ? minX : maxX;
}

// Where one fidget takes the fish: across by the same rules as the dog, and to any height.
export function fishSwimTarget(pos, random = Math.random, rules = FISH_FIDGET) {
    return {
        x: fidgetTarget(pos.x, random, rules),
        y: rules.minY + Math.floor(random() * (rules.maxY - rules.minY + 1)),
    };
}

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

/* The bark: a clipped, rising double yip - picked by ear by the owner.
 *
 * It took two tries in code and four rounds of listening. The first bark was a sawtooth
 * swept through a low-pass and came out as a toot. The second was built sample by sample
 * - a hard onset, a pitch that jumps and falls, a rasp of noise, growl from a soft clipper,
 * band-pass formants for a throat - and was a bark, but a big dog's. Online pet dogs almost
 * all have high, raspy barks with a slight echo, so drafts along those lines were rendered
 * to WAV files and auditioned ten at a time, and narrowed round by round: the highest short
 * yip; that yip doubled; the double higher, with a rising second; the second clipped
 * short; and, of the clips, the harder one. See NOTES.md.
 *
 * So a bark is a call of yips, each a copy of YIP played at its own speed, length and
 * level, with a slight echo over the whole call. The noise is seeded with the values the
 * pick was auditioned with, so the page plays the sound that was chosen rather than a
 * near relation of it.
 *
 * The gentleness is in the playback level and the brevity, not in leaving out the rasp -
 * without the rasp it stops being a bark. */

// One yip: high, short and raspy. Every yip in the call is this, at its own speed and length.
export const YIP = {
    durationMs: 140,
    pitch: { startHz: 1008, peakHz: 1568, peakMs: 20, endHz: 784 },
    attackMs: 3,
    holdMs: 20,
    drive: 4,
    noise: { level: 0.6, decayMs: 40 },
    formants: [
        { hz: 1456, q: 4, level: 1 },
        { hz: 3136, q: 5, level: 0.6 },
        { hz: 4704, q: 6, level: 0.3 },
    ],
    peak: 0.9,
};

/* The call. The second yip comes 60ms after the first, a touch higher - played 8% faster -
   and clipped to 75ms. Clipping shortens a yip's release along with its length, which is
   why the second one snaps off. */
export const BARK = {
    yips: [
        { speed: 1, level: 1, gapMs: 0, durationMs: 140, holdMs: 20 },
        { speed: 1.08, level: 1, gapMs: 60, durationMs: 75, holdMs: 6 },
    ],
    // A slight room echo: a repeat every 70ms, each a fifth as loud and a little duller.
    echo: { delayMs: 70, feedback: 0.2, mix: 0.25, dampHz: 4200 },
    // The noise each yip was auditioned with.
    noiseSeeds: [200, 201],
    peak: 0.9,           // the loudest sample, before the playback level
    playbackGain: 0.3,   // how loud it is played
};

/* When the mouth is open during a bark: once per yip, from the moment it starts to the
   moment it ends. Worked out from BARK, so the mouth follows the sound if the bark ever
   changes. A yip played faster is shorter: its length is its duration over its speed. */
export function barkMouthTimes(bark = BARK) {
    let at = 0;
    return bark.yips.map((step) => {
        const openMs = at + step.gapMs;
        const closeMs = openMs + step.durationMs / step.speed;
        at = closeMs;
        return { openMs, closeMs };
    });
}

// A small seeded random source (mulberry32): a given seed always makes the same noise.
export function seededRandom(seed) {
    let state = seed | 0;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// The pitch a moment into a yip: rising to the peak, then falling away to the end.
export function barkPitchAt(ms, yip = YIP) {
    const { startHz, peakHz, peakMs, endHz } = yip.pitch;
    if (ms <= peakMs) return startHz * Math.pow(peakHz / startHz, Math.max(0, ms) / peakMs);
    const progress = Math.min(1, (ms - peakMs) / (yip.durationMs - peakMs));
    return peakHz * Math.pow(endHz / peakHz, progress);
}

// A band-pass filter - the RBJ cookbook's, unity gain at its peak - one sample at a time.
function bandPass(hz, q, sampleRate) {
    const w0 = (2 * Math.PI * hz) / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    const b0 = alpha / a0;
    const b2 = -alpha / a0;
    const a1 = (-2 * Math.cos(w0)) / a0;
    const a2 = (1 - alpha) / a0;
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    return (x) => {
        const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        return y;
    };
}

/* One yip as samples, scaled so the loudest is yip.peak: a sawtooth following
   barkPitchAt, plus a burst of noise at the onset, through a soft clipper and the
   formants, under a fast attack, a short hold and an exponential release. */
export function yipSamples(sampleRate, yip = YIP, random = Math.random) {
    const length = Math.round((sampleRate * yip.durationMs) / 1000);
    const out = new Float32Array(length);
    const formants = yip.formants.map(({ hz, q, level }) => ({ filter: bandPass(hz, q, sampleRate), level }));
    const fadeSamples = Math.max(1, Math.round(sampleRate * 0.005));
    const releaseMs = yip.durationMs - yip.attackMs - yip.holdMs;
    const driveScale = Math.tanh(yip.drive);
    let phase = 0;
    let loudest = 0;

    for (let i = 0; i < length; i++) {
        const ms = (i * 1000) / sampleRate;
        phase = (phase + barkPitchAt(ms, yip) / sampleRate) % 1;
        const saw = 2 * phase - 1;
        const noise = (random() * 2 - 1) * yip.noise.level * Math.exp(-ms / yip.noise.decayMs);
        const driven = Math.tanh(yip.drive * (saw + noise)) / driveScale;
        const voiced = formants.reduce((sum, { filter, level }) => sum + filter(driven) * level, 0);

        let envelope;
        if (ms < yip.attackMs) envelope = ms / yip.attackMs;
        else if (ms < yip.attackMs + yip.holdMs) envelope = 1;
        else envelope = Math.exp((-5 * (ms - yip.attackMs - yip.holdMs)) / releaseMs);

        // A few milliseconds of fade at the very end, so the last sample is silence rather
        // than a click.
        const tail = Math.min(1, (length - 1 - i) / fadeSamples);
        out[i] = voiced * envelope * tail;
        loudest = Math.max(loudest, Math.abs(out[i]));
    }

    const scale = loudest > 0 ? yip.peak / loudest : 0;
    for (let i = 0; i < length; i++) out[i] *= scale;
    return out;
}

// Play samples at a speed, by linear interpolation: faster is higher, and shorter.
export function resample(samples, speed) {
    const out = new Float32Array(Math.floor(samples.length / speed));
    for (let i = 0; i < out.length; i++) {
        const position = i * speed;
        const j = Math.floor(position);
        const fraction = position - j;
        out[i] = (samples[j] ?? 0) * (1 - fraction) + (samples[j + 1] ?? 0) * fraction;
    }
    return out;
}

/* The slight echo: a feedback delay whose repeats a one-pole low-pass softens, the way a
   room dulls each reflection. It runs on until the repeats are inaudible. The damping is
   set as a frequency rather than a per-sample constant, so it sounds the same at the
   browser's sample rate as it did in the 44.1kHz audition files. */
export function withEcho(samples, { delayMs, feedback, mix, dampHz }, sampleRate) {
    const delay = Math.round((sampleRate * delayMs) / 1000);
    const repeats = Math.ceil(Math.log(0.001) / Math.log(feedback));
    const out = new Float32Array(samples.length + delay * repeats);
    const echo = new Float32Array(out.length);
    const damping = 1 - Math.exp((-2 * Math.PI * dampHz) / sampleRate);
    let damped = 0;
    for (let n = 0; n < out.length; n++) {
        const input = n >= delay ? (samples[n - delay] ?? 0) + feedback * echo[n - delay] : 0;
        damped += damping * (input - damped);
        echo[n] = damped;
        out[n] = (samples[n] ?? 0) + mix * echo[n];
    }
    return out;
}

/* The whole bark as samples: the yips in order with their gaps, the echo over them, the
   last few milliseconds faded so it ends in silence, and the loudest sample scaled to
   bark.peak. `randomFor(i)` is the noise for yip i - seeded, by default, as auditioned. */
export function barkSamples(sampleRate, bark = BARK, randomFor = (i) => seededRandom(bark.noiseSeeds[i] ?? i)) {
    const pieces = bark.yips.map((step, i) => {
        const yip = { ...YIP, durationMs: step.durationMs, holdMs: step.holdMs };
        return {
            samples: resample(yipSamples(sampleRate, yip, randomFor(i)), step.speed),
            level: step.level,
            gap: Math.round((sampleRate * step.gapMs) / 1000),
        };
    });

    const dry = new Float32Array(pieces.reduce((total, piece) => total + piece.gap + piece.samples.length, 0));
    let at = 0;
    for (const piece of pieces) {
        at += piece.gap;
        piece.samples.forEach((sample, i) => { dry[at + i] = sample * piece.level; });
        at += piece.samples.length;
    }

    const out = withEcho(dry, bark.echo, sampleRate);
    const fade = Math.max(1, Math.round(sampleRate * 0.005));
    for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;

    let loudest = 0;
    for (const sample of out) loudest = Math.max(loudest, Math.abs(sample));
    const scale = loudest > 0 ? bark.peak / loudest : 0;
    for (let i = 0; i < out.length; i++) out[i] *= scale;
    return out;
}

/* --- The bowls --- */

export const emptyBowls = () => ({ food: 0, water: 0 });

// Fill a bowl to the top. A full bowl stays as it is, and says so.
export function fillBowl(bowls, kind) {
    if (bowls[kind] >= BOWL_LEVELS) return { bowls, filled: false };
    return { bowls: { ...bowls, [kind]: BOWL_LEVELS }, filled: true };
}

export const takeBite = (bowls, kind) => ({ ...bowls, [kind]: Math.max(0, bowls[kind] - 1) });

export const acceptsItem = (target, item) => ITEM_TARGETS[item] === target;

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
