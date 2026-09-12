import { describe, test, expect } from 'vitest';
import { PETS_COLORS } from '../../js/logic.js';
import {
    SPRITE_KEYS,
    SPECIES,
    patchRows,
    headOffset,
    RESTING_POSTURE,
    bodyFrame,
    WALK_CYCLE,
    PIXELS_PER_WALK_FRAME,
    walkFrame,
    barkMouthTimes,
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
    facingFor,
    FIDGET,
    fidgetDelayMs,
    fidgetTarget,
    PETTING,
    startStroke,
    moveStroke,
    isRubbing,
    barkDue,
    leanToward,
    BARK,
    YIP,
    barkPitchAt,
    barkSamples,
    yipSamples,
    resample,
    seededRandom,
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

    /* The collar was once a one-pixel strip standing up the neck, and did not read as a
       collar at all. A collar from the side is a band slanting across the neck, so in every
       posture it has to span several rows and several columns - never a single column. */
    test.each(['sit', 'stand', 'down'])('the collar slants across the neck when the dog is %s', (posture) => {
        const cells = [];
        dog.body[posture].forEach((row, y) => [...row].forEach((key, x) => {
            if (key === 'c' || key === 'd' || key === 't') cells.push({ x, y });
        }));
        expect(new Set(cells.map((cell) => cell.y)).size).toBeGreaterThanOrEqual(3);
        expect(new Set(cells.map((cell) => cell.x)).size).toBeGreaterThanOrEqual(3);
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

    test('walking cycles stride, passing, other stride, passing - a frame every two pixels', () => {
        expect(WALK_CYCLE).toEqual(['walkA', 'stand', 'walkB', 'stand']);
        expect(PIXELS_PER_WALK_FRAME).toBe(2);
        expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(walkFrame))
            .toEqual(['walkA', 'walkA', 'stand', 'stand', 'walkB', 'walkB', 'stand', 'stand', 'walkA']);
    });

    test('a walking dog draws its walk frame, with the tail up when wagging', () => {
        expect(bodyFrame('walk', false, 0)).toBe('walkA');
        expect(bodyFrame('walk', true, 0)).toBe('walkAWag');
        expect(bodyFrame('walk', true, 2)).toBe('wag');
        expect(bodyFrame('walk', false, 4)).toBe('walkB');
        ['walkA', 'walkAWag', 'walkB', 'walkBWag'].forEach((frame) => expect(dog.body).toHaveProperty(frame));
    });

    // A stride moves the legs, and nothing else - the collar, back and tail stay put.
    test('the strides really move the legs, and leave the body above them alone', () => {
        expect(dog.body.walkA).not.toEqual(dog.body.stand);
        expect(dog.body.walkB).not.toEqual(dog.body.walkA);
        expect(dog.body.walkA.slice(0, 13)).toEqual(dog.body.stand.slice(0, 13));
        expect(dog.body.walkB.slice(0, 13)).toEqual(dog.body.stand.slice(0, 13));
    });

    test('the head dips a pixel on each stride, and not while the legs pass', () => {
        expect(headOffset('walk', { stepsWalked: 0 })).toEqual({ dx: 0, dy: 1 });
        expect(headOffset('walk', { stepsWalked: 2 })).toEqual({ dx: 0, dy: 0 });
        expect(headOffset('walk', { stepsWalked: 4 })).toEqual({ dx: 0, dy: 1 });
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

describe('Fidgeting', () => {
    // Every value an evenly spread random source would give over n draws.
    const spread = (n) => Array.from({ length: n }, (_unused, i) => () => i / n);
    // A random source that hands back exactly these values, in order.
    const scripted = (...values) => {
        let i = 0;
        return () => values[i++];
    };

    /* The owner's brief, revised: a flat 10 to 90 seconds was too long to watch for. Now
       never more than 45 seconds, and mostly short. */
    test('waits in three bands: 70% under 20 seconds, 15% from 20 to 35, 15% from 35 to 45', () => {
        expect(FIDGET.waitBands).toEqual([
            { fromSeconds: 10, toSeconds: 19, share: 0.7 },
            { fromSeconds: 20, toSeconds: 34, share: 0.15 },
            { fromSeconds: 35, toSeconds: 45, share: 0.15 },
        ]);
        const total = FIDGET.waitBands.reduce((sum, band) => sum + band.share, 0);
        expect(total).toBeCloseTo(1, 10);
    });

    test('the first draw picks the band, the second the second within it', () => {
        expect(fidgetDelayMs(scripted(0, 0))).toBe(10000);
        expect(fidgetDelayMs(scripted(0.69, 0.999999))).toBe(19000);
        expect(fidgetDelayMs(scripted(0.7, 0))).toBe(20000);
        expect(fidgetDelayMs(scripted(0.84, 0.999999))).toBe(34000);
        expect(fidgetDelayMs(scripted(0.86, 0))).toBe(35000);
        expect(fidgetDelayMs(scripted(0.999999, 0.999999))).toBe(45000);
    });

    test('never waits longer than 45 seconds, and every whole second from 10 to 45 can come up', () => {
        const random = seededRandom(3);
        const waits = [];
        for (let i = 0; i < 20000; i++) waits.push(fidgetDelayMs(random));
        expect(waits.every((ms) => ms % 1000 === 0)).toBe(true);
        expect(Math.min(...waits)).toBe(10000);
        expect(Math.max(...waits)).toBe(45000);
        expect(new Set(waits).size).toBe(36);
    });

    test('in practice, lands in each band about as often as its share', () => {
        const random = seededRandom(4);
        const trials = 20000;
        const counts = [0, 0, 0];
        for (let i = 0; i < trials; i++) {
            const seconds = fidgetDelayMs(random) / 1000;
            counts[seconds < 20 ? 0 : seconds < 35 ? 1 : 2] += 1;
        }
        [0.7, 0.15, 0.15].forEach((share, band) => {
            expect(counts[band] / trials).toBeGreaterThan(share - 0.02);
            expect(counts[band] / trials).toBeLessThan(share + 0.02);
        });
    });

    test('moves 8 to 24 pixels, either way', () => {
        expect(FIDGET.minStep).toBe(8);
        expect(FIDGET.maxStep).toBe(24);
        expect(fidgetTarget(40, scripted(0, 0))).toBe(32);
        expect(fidgetTarget(40, scripted(0.999999, 0.9))).toBe(64);
    });

    test('turns round when the chosen way would leave its bounds', () => {
        expect(fidgetTarget(FIDGET.maxX, scripted(0, 0.9))).toBe(FIDGET.maxX - 8);
        expect(fidgetTarget(FIDGET.minX, scripted(0, 0))).toBe(FIDGET.minX + 8);
    });

    // In the middle of the bounds, a 24-pixel move can overshoot both ways.
    test('goes as far as it can when a full move fits neither way', () => {
        const middle = Math.floor((FIDGET.minX + FIDGET.maxX) / 2);
        const target = fidgetTarget(middle, scripted(0.999999, 0));
        expect([FIDGET.minX, FIDGET.maxX]).toContain(target);
    });

    test('always ends somewhere new, and never leaves its bounds', () => {
        for (let x = FIDGET.minX; x <= FIDGET.maxX; x++) {
            for (let i = 0; i < 40; i++) {
                const target = fidgetTarget(x, scripted(i / 40, ((i * 7) % 40) / 40));
                expect(target).not.toBe(x);
                expect(target).toBeGreaterThanOrEqual(FIDGET.minX);
                expect(target).toBeLessThanOrEqual(FIDGET.maxX);
            }
        }
    });

    test('the bounds keep the whole dog in the room, clear of the bowls, and include home', () => {
        expect(FIDGET.minX).toBeGreaterThanOrEqual(BOWLS.water.x + BOWL_SIZE.width);
        expect(FIDGET.maxX + dog.size.width).toBeLessThanOrEqual(SCENE.width);
        expect(HOME_X).toBeGreaterThanOrEqual(FIDGET.minX);
        expect(HOME_X).toBeLessThanOrEqual(FIDGET.maxX);
    });

    test('faces the way it walks, and keeps its facing when it does not move', () => {
        expect(facingFor(10, 20)).toBe('right');
        expect(facingFor(20, 10)).toBe('left');
        expect(facingFor(5, 5, 'right')).toBe('right');
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

/* What can be tested about a bark: its shape. Whether it sounds right is for a listener -
   the owner picked this one by ear, over four rounds. These pin the shape of what was
   picked, and the properties the first version lacked (it was a toot: a smooth note with
   no onset or rasp), so neither can quietly change. */
describe('The bark', () => {
    const RATE = 44100;
    const samples = barkSamples(RATE);
    const lengthMs = (samples.length * 1000) / RATE;
    const sampleAt = (ms) => Math.round((ms * RATE) / 1000);
    const loudestBetween = (fromMs, toMs) => {
        let loudest = 0;
        const end = Math.min(samples.length, sampleAt(toMs));
        for (let i = Math.max(0, sampleAt(fromMs)); i < end; i++) loudest = Math.max(loudest, Math.abs(samples[i]));
        return loudest;
    };

    const [first, second] = BARK.yips;
    const secondStartMs = first.durationMs + second.gapMs;
    const secondEndMs = secondStartMs + second.durationMs / second.speed;

    test('is the double yip that was picked: the second higher, and clipped short', () => {
        expect(BARK.yips).toHaveLength(2);
        expect(second.speed).toBeGreaterThan(first.speed);
        expect(second.durationMs).toBeLessThan(first.durationMs);
        expect(BARK.noiseSeeds).toEqual([200, 201]);
    });

    test('each yip is high, and jumps up in pitch before falling below where it began', () => {
        expect(barkPitchAt(0)).toBe(YIP.pitch.startHz);
        expect(barkPitchAt(YIP.pitch.peakMs)).toBeCloseTo(YIP.pitch.peakHz, 5);
        expect(barkPitchAt(YIP.durationMs)).toBeCloseTo(YIP.pitch.endHz, 5);
        expect(YIP.pitch.endHz).toBeLessThan(YIP.pitch.startHz);
        expect(YIP.pitch.startHz).toBeGreaterThan(900);
    });

    test('has a rasp and a throat, not a pure tone', () => {
        expect(YIP.noise.level).toBeGreaterThan(0);
        expect(YIP.drive).toBeGreaterThan(1);
        expect(YIP.formants.length).toBeGreaterThanOrEqual(2);
    });

    // Compared as magnitudes: the scaling can leave a silent sample as -0, which is silence.
    test('starts and ends in silence, so neither end clicks', () => {
        expect(Math.abs(samples[0])).toBe(0);
        expect(Math.abs(samples[samples.length - 1])).toBe(0);
    });

    test('peaks at its stated level', () => {
        expect(loudestBetween(0, lengthMs)).toBeCloseTo(BARK.peak, 5);
    });

    test('is two yips you can hear apart, with a dip between them', () => {
        const firstYip = loudestBetween(0, first.durationMs);
        const secondYip = loudestBetween(secondStartMs, secondEndMs);
        const between = loudestBetween(first.durationMs + 10, secondStartMs - 5);
        expect(secondYip).toBeGreaterThan(firstYip * 0.4);
        expect(between).toBeLessThan(Math.min(firstYip, secondYip) * 0.7);
    });

    test('echoes slightly after the second yip, then trails off into silence', () => {
        const tail = loudestBetween(secondEndMs + 20, secondEndMs + 120);
        expect(tail).toBeGreaterThan(0.005);
        expect(tail).toBeLessThan(BARK.peak * 0.5);
        expect(loudestBetween(lengthMs - 30, lengthMs)).toBeLessThan(0.01);
    });

    test('is the same bark every time - the noise is seeded as it was auditioned', () => {
        expect(barkSamples(RATE)).toEqual(samples);
    });

    test('a single yip starts silent and peaks at its level', () => {
        const yip = yipSamples(RATE, YIP, seededRandom(1));
        expect(yip.length).toBe(Math.round((RATE * YIP.durationMs) / 1000));
        expect(Math.abs(yip[0])).toBe(0);
        let loudest = 0;
        for (const sample of yip) loudest = Math.max(loudest, Math.abs(sample));
        expect(loudest).toBeCloseTo(YIP.peak, 5);
    });

    test('resampling faster makes it shorter', () => {
        expect(Array.from(resample(new Float32Array([0, 1, 2, 3]), 2))).toEqual([0, 2]);
    });

    test('the seeded noise repeats for a seed, and differs between seeds', () => {
        const draw = (random) => [random(), random(), random()];
        const fromA = draw(seededRandom(200));
        expect(draw(seededRandom(200))).toEqual(fromA);
        expect(draw(seededRandom(201))).not.toEqual(fromA);
        fromA.forEach((value) => {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        });
    });

    // The owner's ask: the mouth opens once per yip, not once for the whole bark.
    test('the mouth opens once per yip, and each opening lasts as long as its yip', () => {
        const times = barkMouthTimes();
        expect(times).toHaveLength(BARK.yips.length);
        expect(times[0]).toEqual({ openMs: 0, closeMs: first.durationMs });
        expect(times[1].openMs).toBe(first.durationMs + second.gapMs);
        expect(times[1].closeMs).toBeCloseTo(secondEndMs, 5);
    });

    test('the mouth is open while each yip is loud, and shut in the quieter gap', () => {
        const [yip1, yip2] = barkMouthTimes();
        const gap = loudestBetween(yip1.closeMs + 10, yip2.openMs - 5);
        expect(loudestBetween(yip1.openMs, yip1.closeMs)).toBeGreaterThan(gap);
        expect(loudestBetween(yip2.openMs, yip2.closeMs)).toBeGreaterThan(gap);
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
