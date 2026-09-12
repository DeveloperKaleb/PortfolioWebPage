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
    p: 'tongue',
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
    '..........fcffo.............',
    '......olfffcfffo............',
    '......ollffcffffo...........',
    '......olllfcfffffo..........',
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
            sit: DOG_SIT,
            sitWag: patchRows(DOG_SIT, TAIL_SWISH),
            stand: DOG_BODY,
            wag: patchRows(DOG_BODY, TAIL_UP),
            down: DOG_BODY_DOWN,
            downWag: patchRows(DOG_BODY_DOWN, TAIL_UP),
        },
    },
};

/* The dog rests sitting - the owner's call. It gets up only to go to a bowl; petting and
   barking happen sitting down, and it sits again once it is home. */
export const RESTING_POSTURE = 'sit';

// Which body to draw for a posture - sit, stand or down - with the tail going if wagging.
export const bodyFrame = (posture, wag = false) => ({
    sit: wag ? 'sitWag' : 'sit',
    stand: wag ? 'wag' : 'stand',
    down: wag ? 'downWag' : 'down',
}[posture] ?? (wag ? 'sitWag' : 'sit'));

/* Where the head sits over the body. Sitting and standing share a neck, so the head is in
   the same place on both. Leaning into a stroking hand is one pixel toward it and one up -
   only the head moves, because an earlier draft lifted the whole dog and it read as
   jumping. Down puts the muzzle in the bowl; chompUp is the half of a mouthful where the
   head comes back up a pixel. */
export function headOffset(posture, { leaning = false, leanDx = -1, chompUp = false } = {}) {
    if (posture === 'down') return { dx: -2, dy: chompUp ? 6 : 7 };
    if (leaning) return { dx: leanDx, dy: -1 };
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
 * 60 x 30 pixels. It was 52 x 26 until the owner asked for a little more room: the dog now
 * has more space around it, and on a desktop, where the room may also grow wider, it stays
 * much the same size. On a phone, where the room is already as wide as the page, each
 * pixel is a little smaller - still plainly visible, which was the brief. */

export const SCENE = { width: 60, height: 30, floorY: 21 };
export const DOG_Y = 10;
export const HOME_X = 28;

export const BOWL_SIZE = { width: 9, height: 5 };
export const BOWL_LEVELS = 3;
export const BOWLS = {
    food: { x: 2, y: 23 },
    water: { x: 14, y: 23 },
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

/* The bark: a single "ruff" - gentle, but a bark.
 *
 * The first version was a sawtooth swept through a low-pass, and it came out as a toot: a
 * note rather than a dog. What makes a bark a bark is roughness and shape - a hard onset,
 * a pitch that jumps and then drops away, a rasp of breath at the start, and resonances
 * that give it a throat. So the sound is built sample by sample here, where it can be
 * tested, and the DOM layer only plays the result:
 *
 *   - a sawtooth whose pitch rises to a peak in the first few tens of milliseconds and
 *     then falls away (barkPitchAt);
 *   - a burst of noise at the onset that decays fast - the rasp;
 *   - both driven through a soft clipper, which adds the growl;
 *   - then three band-pass formants, the resonances of a throat and mouth;
 *   - under a fast attack, a short hold and an exponential release.
 *
 * The gentleness is in the playback level and the short length, not in leaving the rasp
 * out - without the rasp it stops being a bark. */
export const BARK = {
    durationMs: 260,
    pitch: { startHz: 380, peakHz: 620, peakMs: 24, endHz: 230 },
    attackMs: 4,
    holdMs: 30,
    drive: 3,
    noise: { level: 0.45, decayMs: 60 },
    formants: [
        { hz: 600, q: 3.5, level: 1 },
        { hz: 1400, q: 4.5, level: 0.55 },
        { hz: 2700, q: 6, level: 0.2 },
    ],
    peak: 0.9,           // the loudest sample, before the playback level
    playbackGain: 0.3,   // how loud it is played
};

// The pitch a moment into the bark: rising to the peak, then falling away to the end.
export function barkPitchAt(ms, bark = BARK) {
    const { startHz, peakHz, peakMs, endHz } = bark.pitch;
    if (ms <= peakMs) return startHz * Math.pow(peakHz / startHz, Math.max(0, ms) / peakMs);
    const progress = Math.min(1, (ms - peakMs) / (bark.durationMs - peakMs));
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

/* The bark as samples at a sample rate, scaled so the loudest is `peak`. `random` is the
   noise source; seeding it gives the same bark every time, which is what makes it
   testable. */
export function barkSamples(sampleRate, bark = BARK, random = Math.random) {
    const length = Math.round((sampleRate * bark.durationMs) / 1000);
    const out = new Float32Array(length);
    const formants = bark.formants.map(({ hz, q, level }) => ({ filter: bandPass(hz, q, sampleRate), level }));
    const fadeSamples = Math.max(1, Math.round(sampleRate * 0.005));
    const releaseMs = bark.durationMs - bark.attackMs - bark.holdMs;
    const driveScale = Math.tanh(bark.drive);
    let phase = 0;
    let loudest = 0;

    for (let i = 0; i < length; i++) {
        const ms = (i * 1000) / sampleRate;
        phase = (phase + barkPitchAt(ms, bark) / sampleRate) % 1;
        const saw = 2 * phase - 1;
        const noise = (random() * 2 - 1) * bark.noise.level * Math.exp(-ms / bark.noise.decayMs);
        const driven = Math.tanh(bark.drive * (saw + noise)) / driveScale;
        const voiced = formants.reduce((sum, { filter, level }) => sum + filter(driven) * level, 0);

        let envelope;
        if (ms < bark.attackMs) envelope = ms / bark.attackMs;
        else if (ms < bark.attackMs + bark.holdMs) envelope = 1;
        else envelope = Math.exp((-5 * (ms - bark.attackMs - bark.holdMs)) / releaseMs);

        // A few milliseconds of fade at the very end, so the last sample is silence rather
        // than a click.
        const tail = Math.min(1, (length - 1 - i) / fadeSamples);
        out[i] = voiced * envelope * tail;
        loudest = Math.max(loudest, Math.abs(out[i]));
    }

    const scale = loudest > 0 ? bark.peak / loudest : 0;
    for (let i = 0; i < length; i++) out[i] *= scale;
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
