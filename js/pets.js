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

export const SPECIES = {
    dog: {
        name: 'Dog',
        description: 'A yellow Labrador retriever',
        size: { width: 28, height: 18 },
        // Where the head is across the sprite, for leaning toward the hand.
        headCentreX: 6,
        head: {
            open: DOG_HEAD,
            /* Being petted: the eyes squinted shut in upturned arcs, the mouth hanging open,
               and a pixel or two of tongue over the jaw - a panting smile. It replaced a
               single closed-eye line when the owner asked for more detail. Of three drafts,
               one also lifted the brow and swept the ear back; the brow read as a crack in
               the skull, so it went. */
            happy: patchRows(DOG_HEAD, [[2, 6, 'o'], [3, 5, 'ofo'], [5, 2, 'nnno'], [6, 2, 'pp']]),
            bark: patchRows(DOG_HEAD, [[5, 1, 'nnnn']]),
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

// Which body to draw for a posture - sit, stand, down or walk - with the tail going if wagging.
export function bodyFrame(posture, wag = false, stepsWalked = 0) {
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
export function headOffset(posture, { leaning = false, leanDx = -1, chompUp = false, stepsWalked = 0 } = {}) {
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
