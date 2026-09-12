import { describe, test, expect } from 'vitest';
import { PETS_COLORS } from '../../js/logic.js';
import {
    SPRITE_KEYS,
    SPECIES,
    patchRows,
    headOffset,
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

    test('closing the eyes and barking each change the face', () => {
        expect(dog.head.closed).not.toEqual(dog.head.open);
        expect(dog.head.bark).not.toEqual(dog.head.open);
        expect(dog.body.wag).not.toEqual(dog.body.stand);
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
    test('standing leaves the head where it is', () => {
        expect(headOffset('stand')).toEqual({ dx: 0, dy: 0 });
    });

    test('leaning raises the head a pixel toward the hand', () => {
        expect(headOffset('lean', { leanDx: -1 })).toEqual({ dx: -1, dy: -1 });
        expect(headOffset('lean', { leanDx: 1 })).toEqual({ dx: 1, dy: -1 });
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

    // "Gentle and appreciative": a short, low, soft wuf rather than a yap.
    test('the bark is short, low and soft', () => {
        expect(BARK.peakHz).toBeGreaterThan(BARK.startHz);
        expect(BARK.endHz).toBeLessThan(BARK.startHz);
        expect(BARK.peakHz).toBeLessThan(600);
        expect(BARK.durationMs).toBeLessThan(400);
        expect(BARK.gain).toBeLessThanOrEqual(0.2);
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
