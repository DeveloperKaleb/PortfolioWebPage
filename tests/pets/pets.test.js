import { describe, test, expect } from 'vitest';
import { PETS_COLORS } from '../../js/logic.js';
import {
    SPRITE_KEYS,
    SPECIES,
    patchRows,
    headOffset,
    RESTING_POSTURE,
    bodyFrame,
    spriteRuns,
    SCENE,
    DOG_Y,
    HOME_X,
    BOWL_SIZE,
    BOWL_LEVELS,
    BOWLS,
    ITEMS,
    bowlRows,
    ITEM_ICONS,
    dogXForBowl,
    stepToward,
    PETTING,
    startStroke,
    moveStroke,
    isRubbing,
    barkDue,
    leanToward,
    BARK,
    barkPitchAt,
    barkSamples,
    emptyBowls,
    fillBowl,
    takeBite,
    acceptsItem,
    bowlToVisit,
    dropTarget,
} from '../../js/pets.js';

const dog = SPECIES.dog;

// Every sprite in the toy, by name.
const allSprites = () => [
    ...Object.entries(dog.head).map(([name, rows]) => [`head ${name}`, rows]),
    ...Object.entries(dog.body).map(([name, rows]) => [`body ${name}`, rows]),
    ...Object.entries(ITEM_ICONS).map(([name, rows]) => [`${name} icon`, rows]),
    ...ITEMS.flatMap((kind) => [0, 1, 2, 3].map((level) => [`${kind} bowl at ${level}`, bowlRows(kind, level)])),
];

describe('The sprites', () => {
    test.each(allSprites())('%s is rectangular and drawn only in known colours', (_name, rows) => {
        expect(rows.length).toBeGreaterThan(0);
        rows.forEach((row) => {
            expect(row.length).toBe(rows[0].length);
            [...row].forEach((key) => {
                if (key !== '.') expect(Object.keys(SPRITE_KEYS)).toContain(key);
            });
        });
    });

    // A key naming a colour that does not exist would draw as nothing, silently.
    test('every sprite key names a colour in the palette', () => {
        Object.values(SPRITE_KEYS).forEach((name) => expect(PETS_COLORS).toHaveProperty(name));
    });

    test('every head is the same size, and so is every body', () => {
        Object.values(dog.head).forEach((rows) => {
            expect([rows[0].length, rows.length]).toEqual([12, 7]);
        });
        Object.values(dog.body).forEach((rows) => {
            expect([rows[0].length, rows.length]).toEqual([dog.size.width, dog.size.height]);
        });
    });

    test('being petted and barking each change the face', () => {
        expect(dog.head.happy).not.toEqual(dog.head.open);
        expect(dog.head.happy).not.toEqual(dog.head.bark);
        expect(dog.head.bark).not.toEqual(dog.head.open);
        expect(dog.body.wag).not.toEqual(dog.body.stand);
        expect(dog.body.sitWag).not.toEqual(dog.body.sit);
    });

    test('patching overwrites pixels without resizing the sprite', () => {
        expect(patchRows(['....', '....'], [[1, 1, 'oo']])).toEqual(['....', '.oo.']);
    });

    test('runs of one colour are merged, and every pixel is covered exactly once', () => {
        expect(spriteRuns(['.oo.f'])).toEqual([
            { x: 1, y: 0, width: 2, key: 'o' },
            { x: 4, y: 0, width: 1, key: 'f' },
        ]);
        allSprites().forEach(([, rows]) => {
            const covered = spriteRuns(rows).reduce((total, run) => total + run.width, 0);
            const pixels = rows.join('').replace(/\./g, '').length;
            expect(covered).toBe(pixels);
        });
    });
});

describe('Poses', () => {
    // The owner's call: the dog rests sitting, and gets up only for food or water.
    test('the dog rests sitting', () => {
        expect(RESTING_POSTURE).toBe('sit');
        expect(bodyFrame(RESTING_POSTURE)).toBe('sit');
        expect(dog.body.sit).not.toEqual(dog.body.stand);
    });

    test.each([
        ['sit', false, 'sit'],
        ['sit', true, 'sitWag'],
        ['stand', false, 'stand'],
        ['stand', true, 'wag'],
        ['down', false, 'down'],
        ['down', true, 'downWag'],
    ])('%s, wagging %s, draws the %s body', (posture, wag, frame) => {
        expect(bodyFrame(posture, wag)).toBe(frame);
        expect(dog.body).toHaveProperty(frame);
    });

    test('sitting and standing leave the head where it is', () => {
        expect(headOffset('sit')).toEqual({ dx: 0, dy: 0 });
        expect(headOffset('stand')).toEqual({ dx: 0, dy: 0 });
    });

    test('leaning, sitting or standing, raises the head a pixel toward the hand', () => {
        expect(headOffset('sit', { leaning: true, leanDx: -1 })).toEqual({ dx: -1, dy: -1 });
        expect(headOffset('stand', { leaning: true, leanDx: 1 })).toEqual({ dx: 1, dy: -1 });
    });

    test('eating lowers the head, and a mouthful brings it up a pixel', () => {
        expect(headOffset('down').dy).toBe(7);
        expect(headOffset('down', { chompUp: true }).dy).toBe(6);
    });

    test('the head leans toward whichever side the hand is on', () => {
        expect(leanToward(10, 50)).toBe(-1);
        expect(leanToward(90, 50)).toBe(1);
    });
});

describe('The room', () => {
    test('the dog at home fits in the room and stands on the floor', () => {
        expect(HOME_X + dog.size.width).toBeLessThanOrEqual(SCENE.width);
        expect(DOG_Y + dog.size.height).toBeGreaterThan(SCENE.floorY);
        expect(DOG_Y + dog.size.height).toBeLessThanOrEqual(SCENE.height);
    });

    test.each(ITEMS)('the %s bowl sits on the floor, inside the room', (kind) => {
        const { x, y } = BOWLS[kind];
        expect(y).toBeGreaterThanOrEqual(SCENE.floorY);
        expect(x + BOWL_SIZE.width).toBeLessThanOrEqual(SCENE.width);
        expect(y + BOWL_SIZE.height).toBeLessThanOrEqual(SCENE.height);
    });

    test('the bowls do not overlap each other, or the dog at home', () => {
        expect(BOWLS.food.x + BOWL_SIZE.width).toBeLessThanOrEqual(BOWLS.water.x);
        expect(BOWLS.water.x + BOWL_SIZE.width).toBeLessThanOrEqual(HOME_X);
    });

    /* With the head down, the muzzle has to land in the bowl, or the dog eats the floor
       beside it. The muzzle is the head's first six columns. */
    test.each(ITEMS)('eating from the %s bowl puts the muzzle over it', (kind) => {
        const x = dogXForBowl(kind);
        const { dx } = headOffset('down');
        const muzzleLeft = x + dx;
        const muzzleRight = x + dx + 5;
        expect(muzzleLeft).toBeGreaterThanOrEqual(BOWLS[kind].x);
        expect(muzzleRight).toBeLessThanOrEqual(BOWLS[kind].x + BOWL_SIZE.width - 1);
        // ...and at the height of what is in it: the head's bottom row on the contents row.
        expect(DOG_Y + headOffset('down').dy + dog.head.open.length - 1).toBe(BOWLS[kind].y);
    });

    test('walking goes a pixel at a time and stops at the target', () => {
        expect(stepToward(22, 5)).toBe(21);
        expect(stepToward(5, 22)).toBe(6);
        expect(stepToward(5, 5)).toBe(5);
    });

    test('a bowl shows more in it the fuller it is', () => {
        const filled = (level) => bowlRows('food', level)[0].replace(/\./g, '').length;
        expect([0, 1, 2, 3].map(filled)).toEqual([0, 3, 5, 7]);
        expect(bowlRows('water', 9)).toEqual(bowlRows('water', BOWL_LEVELS));
    });
});

describe('Petting', () => {
    const at = (x, t, y = 0) => ({ x, y, t });

    // Stroke to the right a pixel at a time, one sample every 10ms.
    const stroked = (pixels, from = 0) => {
        let stroke = startStroke(at(0, from));
        for (let i = 1; i <= pixels; i++) stroke = moveStroke(stroke, at(i, from + i * 10));
        return stroke;
    };

    test('a tap is not a stroke', () => {
        const stroke = moveStroke(startStroke(at(0, 0)), at(0, 50));
        expect(isRubbing(stroke, 60)).toBe(false);
        expect(barkDue(stroke, { now: 5000, ending: true })).toBe(false);
    });

    test(`rubbing starts once the pointer has travelled ${PETTING.strokeStartPx}px`, () => {
        expect(stroked(PETTING.strokeStartPx - 1).rubbingSince).toBeNull();
        expect(stroked(PETTING.strokeStartPx).rubbingSince).not.toBeNull();
    });

    test('a hand held still stops the rubbing', () => {
        const stroke = stroked(40);
        expect(isRubbing(stroke, stroke.lastMoveAt + PETTING.idleStopMs)).toBe(true);
        expect(isRubbing(stroke, stroke.lastMoveAt + PETTING.idleStopMs + 1)).toBe(false);
    });

    test('lifting the hand after a short rub barks, but not after too short a one', () => {
        const brief = stroked(PETTING.strokeStartPx + 5);
        expect(barkDue(brief, { now: brief.lastMoveAt, ending: true })).toBe(false);

        const rubbed = stroked(PETTING.strokeStartPx + PETTING.barkAfterRubMs / 10);
        expect(barkDue(rubbed, { now: rubbed.lastMoveAt, ending: true })).toBe(true);
    });

    test('a long pet barks while still stroking', () => {
        const stroke = stroked(PETTING.strokeStartPx + PETTING.longPetBarkMs / 10);
        expect(barkDue(stroke, { now: stroke.lastMoveAt })).toBe(true);
    });

    test('once per stroke', () => {
        const stroke = { ...stroked(200), barked: true };
        expect(barkDue(stroke, { now: stroke.lastMoveAt, ending: true })).toBe(false);
    });

    test('and never within the cooldown of the last bark', () => {
        const stroke = stroked(200);
        const now = stroke.lastMoveAt;
        expect(barkDue(stroke, { now, ending: true, lastBarkAt: now - PETTING.barkCooldownMs + 1 })).toBe(false);
        expect(barkDue(stroke, { now, ending: true, lastBarkAt: now - PETTING.barkCooldownMs })).toBe(true);
    });

});

/* What can be tested about a bark: its shape. Whether it sounds like a dog is for a
   listener - these pin the properties the first version lacked (it was a toot: a smooth
   note with no onset or rasp) so they cannot quietly go missing again. */
describe('The bark', () => {
    const RATE = 44100;

    // A small seeded generator, so the noise - and so the bark - is the same every run.
    const seeded = (seed) => () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const samples = barkSamples(RATE, BARK, seeded(7));
    const loudestBetween = (fromMs, toMs) => {
        let loudest = 0;
        const end = Math.min(samples.length, Math.round((toMs * RATE) / 1000));
        for (let i = Math.round((fromMs * RATE) / 1000); i < end; i++) loudest = Math.max(loudest, Math.abs(samples[i]));
        return loudest;
    };

    test('is short, and exactly as long as it says', () => {
        expect(BARK.durationMs).toBeLessThan(400);
        expect(samples.length).toBe(Math.round((RATE * BARK.durationMs) / 1000));
    });

    // Compared as magnitudes: the scaling can leave a silent sample as -0, which is silence.
    test('starts and ends in silence, so neither end clicks', () => {
        expect(Math.abs(samples[0])).toBe(0);
        expect(Math.abs(samples[samples.length - 1])).toBe(0);
    });

    test('peaks at its stated level', () => {
        expect(loudestBetween(0, BARK.durationMs)).toBeCloseTo(BARK.peak, 5);
    });

    // A bark hits hard and dies away; a note holds.
    test('is loudest at the start and dies away fast', () => {
        expect(loudestBetween(0, 60)).toBeGreaterThan(loudestBetween(BARK.durationMs - 60, BARK.durationMs) * 5);
    });

    test('jumps up in pitch, then falls below where it began', () => {
        expect(barkPitchAt(0)).toBe(BARK.pitch.startHz);
        expect(barkPitchAt(BARK.pitch.peakMs)).toBeCloseTo(BARK.pitch.peakHz, 5);
        expect(barkPitchAt(BARK.durationMs)).toBeCloseTo(BARK.pitch.endHz, 5);
        expect(BARK.pitch.peakHz).toBeGreaterThan(BARK.pitch.startHz);
        expect(BARK.pitch.endHz).toBeLessThan(BARK.pitch.startHz);
    });

    test('has a rasp and a throat, not a pure tone', () => {
        expect(BARK.noise.level).toBeGreaterThan(0);
        expect(BARK.drive).toBeGreaterThan(1);
        expect(BARK.formants.length).toBeGreaterThanOrEqual(2);
    });

    test('is the same bark for the same noise', () => {
        expect(barkSamples(RATE, BARK, seeded(7))).toEqual(samples);
    });

    // "Gentle and appreciative": played well below full scale.
    test('is played gently', () => {
        expect(BARK.playbackGain).toBeLessThanOrEqual(0.5);
    });
});

describe('The bowls', () => {
    test('start empty and fill to the top', () => {
        const { bowls, filled } = fillBowl(emptyBowls(), 'food');
        expect(filled).toBe(true);
        expect(bowls).toEqual({ food: BOWL_LEVELS, water: 0 });
    });

    test('a full bowl stays as it is, and says so', () => {
        const full = { food: BOWL_LEVELS, water: 0 };
        const result = fillBowl(full, 'food');
        expect(result.filled).toBe(false);
        expect(result.bowls).toBe(full);
    });

    test('each bite takes a level, and never below empty', () => {
        expect(takeBite({ food: 2, water: 1 }, 'food')).toEqual({ food: 1, water: 1 });
        expect(takeBite({ food: 0, water: 1 }, 'food')).toEqual({ food: 0, water: 1 });
    });

    test('food goes in the food bowl and water in the water bowl', () => {
        expect(acceptsItem('food', 'food')).toBe(true);
        expect(acceptsItem('water', 'food')).toBe(false);
    });

    test('the dog goes to the preferred bowl first, then the other, then home', () => {
        expect(bowlToVisit({ food: 2, water: 3 }, 'water')).toBe('water');
        expect(bowlToVisit({ food: 2, water: 0 }, 'water')).toBe('food');
        expect(bowlToVisit(emptyBowls())).toBeNull();
    });
});

describe('Dropping', () => {
    const targets = [
        { kind: 'food', rect: { left: 0, top: 100, right: 60, bottom: 140 } },
        { kind: 'water', rect: { left: 80, top: 100, right: 140, bottom: 140 } },
    ];

    test('lands on the bowl under the pointer', () => {
        expect(dropTarget({ x: 30, y: 120 }, targets)).toBe('food');
        expect(dropTarget({ x: 110, y: 120 }, targets)).toBe('water');
    });

    test('lands nowhere away from the bowls', () => {
        expect(dropTarget({ x: 30, y: 10 }, targets, 16)).toBeNull();
    });

    test('forgives a finger that misses by a little', () => {
        expect(dropTarget({ x: 30, y: 150 }, targets)).toBeNull();
        expect(dropTarget({ x: 30, y: 150 }, targets, 16)).toBe('food');
    });

    // Between the bowls, both slack zones overlap: the nearer bowl takes it.
    test('where the slack overlaps, the nearer bowl wins', () => {
        expect(dropTarget({ x: 68, y: 120 }, targets, 24)).toBe('food');
        expect(dropTarget({ x: 74, y: 120 }, targets, 24)).toBe('water');
    });
});
