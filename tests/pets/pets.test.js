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
    SKIRTING_TOP,
    FLOOR_SEAMS,
    WINDOW,
    PLANT,
    TIMES_OF_DAY,
    DAY_STARTS,
    timeOfDay,
    DUSK_WAIT_SCALE,
    SLEEP,
    restDelayMs,
    Z_RISE,
    zzzFrame,
    NIGHT_SKY,
    TANK,
    TANK_SURFACE_Y,
    STAND,
    FISH_SWIM,
    FISH_HOME,
    FISH_FIDGET,
    FIDGET_RULES,
    swimStep,
    fishFrame,
    fishMouth,
    fishPositionFor,
    fishSwimTarget,
    FLAKE,
    FLAKES,
    FLAKE_FLOOR_Y,
    dropFlakes,
    sinkFlakes,
    nearestFlake,
    canEat,
    fishApproach,
    BUBBLE,
    bubblesFrom,
    riseBubbles,
    SPECIES_ITEMS,
    SPECIES_TARGETS,
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
const fish = SPECIES.fish;

// Every sprite in the toy, by name.
const allSprites = () => [
    ...Object.entries(dog.head).map(([name, rows]) => [`head ${name}`, rows]),
    ...Object.entries(dog.body).map(([name, rows]) => [`body ${name}`, rows]),
    ...Object.entries(fish.frames).map(([name, rows]) => [`fish ${name}`, rows]),
    ['the tank', TANK.rows],
    ['the stand', STAND.rows],
    ['a bubble', BUBBLE],
    ['a flake', FLAKE],
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

describe('The furnishings', () => {
    const furnishings = [['the window', WINDOW], ['the plant', PLANT]];
    const bottomOf = ({ y, rows }) => y + rows.length - 1;
    const rightOf = ({ x, rows }) => x + rows[0].length - 1;

    test.each(furnishings)('%s is a rectangle of known palette keys, inside the room', (_name, item) => {
        const { x, y, rows } = item;
        rows.forEach((row) => {
            expect(row).toHaveLength(rows[0].length);
            [...row].forEach((key) => {
                if (key !== '.') expect(Object.keys(SPRITE_KEYS)).toContain(key);
            });
        });
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(rightOf(item)).toBeLessThan(SCENE.width);
        expect(bottomOf(item)).toBeLessThan(SCENE.height);
    });

    /* The dog never walks in front of the window, so its colours need not clear the text
       floor against the outline. That holds only while the sill stays above the highest
       the head goes: raised a pixel into a stroking hand. */
    test('the window stays above the highest the dog\'s head goes', () => {
        const highestHead = DOG_Y + Math.min(0, headOffset('sit', { leaning: true }).dy);
        expect(bottomOf(WINDOW)).toBeLessThan(highestHead);
    });

    test('the plant stands on the floor in the back right corner, clear of the window', () => {
        expect(bottomOf(PLANT)).toBeGreaterThan(SCENE.floorY);
        expect(SCENE.width - 1 - rightOf(PLANT)).toBeLessThanOrEqual(3);
        expect(PLANT.x).toBeGreaterThan(rightOf(WINDOW));
    });

    test('the skirting board and the floor seams sit where the wall meets the floor', () => {
        expect(SKIRTING_TOP).toBeLessThan(SCENE.floorY);
        expect(SKIRTING_TOP).toBeGreaterThan(bottomOf(WINDOW));
        FLOOR_SEAMS.forEach((y) => {
            expect(y).toBeGreaterThan(SCENE.floorY);
            expect(y).toBeLessThan(SCENE.height);
        });
    });
});

describe('Time of day', () => {
    const at = (hour, minute = 0) => new Date(2026, 8, 12, hour, minute);

    // Fixed local hours, the owner's pick: dawn 6-8, day 8-18, dusk 18-20, night 20-6.
    test('the hours fall into dawn, day, dusk and night', () => {
        expect(TIMES_OF_DAY).toEqual(['dawn', 'day', 'dusk', 'night']);
        expect(DAY_STARTS).toEqual({ dawn: 6, day: 8, dusk: 18, night: 20 });
        expect(timeOfDay(at(0))).toBe('night');
        expect(timeOfDay(at(5, 59))).toBe('night');
        expect(timeOfDay(at(6))).toBe('dawn');
        expect(timeOfDay(at(7, 59))).toBe('dawn');
        expect(timeOfDay(at(8))).toBe('day');
        expect(timeOfDay(at(17, 59))).toBe('day');
        expect(timeOfDay(at(18))).toBe('dusk');
        expect(timeOfDay(at(19, 59))).toBe('dusk');
        expect(timeOfDay(at(20))).toBe('night');
        expect(timeOfDay(at(23, 59))).toBe('night');
    });

    test('the dog rests twice as long between fidgets at dusk, and dozes off at night', () => {
        const scripted = () => { const values = [0.3, 0.5]; let i = 0; return () => values[i++]; };
        const day = restDelayMs('day', scripted());
        expect(restDelayMs('dawn', scripted())).toBe(day);
        expect(restDelayMs('dusk', scripted())).toBe(day * DUSK_WAIT_SCALE);
        expect(DUSK_WAIT_SCALE).toBe(2);
        expect(restDelayMs('night')).toBe(SLEEP.dozeAfterMs);
    });

    test('asleep, it lies down with its eyes shut and its chin on its paws', () => {
        expect(bodyFrame('sleep')).toBe('sleep');
        expect(bodyFrame('sleep', true, 0, true)).toBe('sleepBreath');
        const { dy } = headOffset('sleep');
        expect(dy + dog.head.asleep.length).toBeLessThanOrEqual(dog.size.height);
        // Only the eye changes: shut, a line where it was open.
        const changed = dog.head.asleep.flatMap((row, y) => [...row].map((key, x) => [x, y, key]))
            .filter(([x, y, key]) => dog.head.open[y][x] !== key);
        expect(changed.length).toBeGreaterThan(0);
        expect(changed.every(([, y]) => y === 3)).toBe(true);
    });

    test('a sleeping breath lifts only the back, never the paws or the floor line', () => {
        expect(dog.body.sleepBreath).not.toEqual(dog.body.sleep);
        expect(dog.body.sleepBreath.slice(12)).toEqual(dog.body.sleep.slice(12));
    });

    /* The Z's are drawn over the wall and must never reach the window, whose colours are
       only held apart from each other, nor leave the room, wherever the dog sleeps. */
    test('the Z\'s stay in the room and below the window, wherever the dog sleeps', () => {
        const windowBottom = WINDOW.y + WINDOW.rows.length - 1;
        for (const dogX of [FIDGET.minX, FIDGET.maxX]) {
            for (let step = 0; step < Z_RISE; step++) {
                zzzFrame(step).forEach(({ x, y, rows }) => {
                    expect(DOG_Y + y).toBeGreaterThan(windowBottom);
                    expect(dogX + x + rows[0].length).toBeLessThanOrEqual(SCENE.width);
                    rows.join('').split('').forEach((key) => {
                        if (key !== '.') expect(Object.keys(SPRITE_KEYS)).toContain(key);
                    });
                });
            }
        }
    });

    test('the Z\'s rise a step at a time, grow as they go, and loop', () => {
        const [first] = zzzFrame(0);
        const [later] = zzzFrame(Z_RISE / 2);
        expect(later.y).toBeLessThan(first.y);
        expect(later.rows.length).toBeGreaterThan(first.rows.length);
        expect(zzzFrame(Z_RISE)).toEqual(zzzFrame(0));
        expect(zzzFrame(0)).toHaveLength(2);
    });

    test('the moon and stars land on sky, never on the frame, the fence or the grass', () => {
        NIGHT_SKY.forEach(([row, col, text]) => {
            [...text].forEach((key, i) => {
                expect(WINDOW.rows[row][col + i]).toBe('S');
                expect(['S', 'M', 'K']).toContain(key);
            });
        });
    });
});

describe('The fish', () => {
    const scripted = (...values) => {
        let i = 0;
        return () => values[i++];
    };
    const tankKeyAt = (x, y) => TANK.rows[y - TANK.y]?.[x - TANK.x];
    const pixelsOf = (rows, x0, y0) => rows.flatMap((row, y) => [...row].map((key, x) => [x0 + x, y0 + y, key]))
        .filter(([, , key]) => key !== '.');

    test('every frame of the fish is its size, and swimming, eating and sleeping each look different', () => {
        Object.values(fish.frames).forEach((rows) => {
            expect([rows[0].length, rows.length]).toEqual([fish.size.width, fish.size.height]);
        });
        expect(fish.frames.swimB).not.toEqual(fish.frames.swimA);
        expect(fish.frames.asleep).not.toEqual(fish.frames.swimA);
        // Eating, the mouth is open: no pixel where it is shut.
        expect(fish.frames.eat[fish.mouth.y][fish.mouth.x]).toBe('.');
        expect(fish.frames.swimA[fish.mouth.y][fish.mouth.x]).not.toBe('.');
        expect(fish.habitat).toBe('tank');
        expect(dog.habitat).toBe('room');
    });

    test('fishFrame picks sleeping, then eating, then the tail flick every second step', () => {
        expect(fishFrame({ asleep: true, eating: true })).toBe('asleep');
        expect(fishFrame({ eating: true })).toBe('eat');
        expect([0, 1, 2, 3, 4].map((finStep) => fishFrame({ finStep }))).toEqual(['swimA', 'swimA', 'swimB', 'swimB', 'swimA']);
    });

    // The tank sits below the window, so the sky stays in view, and clear of the plant.
    test('the tank stands on its stand, in the room, below the window and clear of the plant', () => {
        const tankBottom = TANK.y + TANK.rows.length - 1;
        expect(TANK.y).toBeGreaterThan(WINDOW.y + WINDOW.rows.length - 1);
        expect(STAND.y).toBe(tankBottom + 1);
        expect(STAND.x).toBeLessThanOrEqual(TANK.x);
        expect(STAND.x + STAND.rows[0].length).toBeGreaterThanOrEqual(TANK.x + TANK.rows[0].length);
        expect(STAND.y + STAND.rows.length).toBeLessThanOrEqual(SCENE.height);
        expect(STAND.x + STAND.rows[0].length - 1).toBeLessThan(PLANT.x);
        expect(TANK_SURFACE_Y).toBe(TANK.y + 4);
        expect(TANK.rows[4]).toMatch(/^oV+o$/);
    });

    test('wherever the fish swims, every pixel of it is inside the tank, in water, weeds or gravel', () => {
        for (const x of [FISH_SWIM.minX, FISH_SWIM.maxX]) {
            for (const y of [FISH_SWIM.minY, FISH_SWIM.maxY]) {
                pixelsOf(fish.frames.swimA, x, y).forEach(([px, py]) => {
                    expect(['U', 'g', 'G', 'X', 'Y']).toContain(tankKeyAt(px, py));
                });
            }
        }
        // At its lowest, where it sleeps, its belly is on the gravel.
        const belly = FISH_SWIM.maxY + fish.size.height - 1;
        expect(['X', 'Y']).toContain(tankKeyAt(FISH_SWIM.minX + 5, belly));
        expect(FISH_HOME.x).toBeGreaterThanOrEqual(FISH_SWIM.minX);
        expect(FISH_HOME.x).toBeLessThanOrEqual(FISH_SWIM.maxX);
    });

    /* The owner's ask: fidgets "even more heavily biased towards shorter" than the dog's. */
    test('its waits are shorter than the dog\'s, and more heavily weighted to the short end', () => {
        expect(FISH_FIDGET.waitBands).toEqual([
            { fromSeconds: 2, toSeconds: 4, share: 0.7 },
            { fromSeconds: 5, toSeconds: 9, share: 0.2 },
            { fromSeconds: 10, toSeconds: 15, share: 0.1 },
        ]);
        expect(FISH_FIDGET.waitBands.reduce((sum, band) => sum + band.share, 0)).toBeCloseTo(1, 10);
        const random = seededRandom(5);
        const waits = Array.from({ length: 20000 }, () => fidgetDelayMs(random, FISH_FIDGET) / 1000);
        expect(Math.max(...waits)).toBe(15);
        expect(Math.min(...waits)).toBe(2);
        const short = waits.filter((s) => s < 5).length / waits.length;
        expect(short).toBeGreaterThan(0.68);
        expect(short).toBeLessThan(0.72);
        expect(FIDGET_RULES).toEqual({ dog: FIDGET, fish: FISH_FIDGET });
    });

    test('dusk and night work on the fish as on the dog', () => {
        const day = restDelayMs('day', scripted(0.1, 0.5), FISH_FIDGET);
        expect(day).toBe(3000);
        expect(restDelayMs('dusk', scripted(0.1, 0.5), FISH_FIDGET)).toBe(day * 2);
        expect(restDelayMs('night', Math.random, FISH_FIDGET)).toBe(SLEEP.dozeAfterMs);
    });

    test('a fidget swims somewhere new across, at a height inside the water', () => {
        const random = seededRandom(9);
        let pos = FISH_HOME;
        for (let i = 0; i < 200; i++) {
            const next = fishSwimTarget(pos, random);
            expect(next.x).not.toBe(pos.x);
            expect(next.x).toBeGreaterThanOrEqual(FISH_SWIM.minX);
            expect(next.x).toBeLessThanOrEqual(FISH_SWIM.maxX);
            expect(next.y).toBeGreaterThanOrEqual(FISH_SWIM.minY);
            expect(next.y).toBeLessThanOrEqual(FISH_SWIM.maxY - 2);
            pos = next;
        }
        expect(swimStep({ x: 5, y: 5 }, { x: 9, y: 2 })).toEqual({ x: 6, y: 4 });
    });

    test('its mouth is at the front whichever way it faces, and a tap brings the mouth to it', () => {
        const pos = { x: 40, y: 32 };
        expect(fishMouth(pos, 'left')).toEqual({ x: 40, y: 35 });
        expect(fishMouth(pos, 'right')).toEqual({ x: 52, y: 35 });
        const point = { x: 50, y: 35 };
        expect(fishMouth(fishPositionFor(point, 'left'), 'left')).toEqual(point);
        expect(fishMouth(fishPositionFor(point, 'right'), 'right')).toEqual(point);
        // A tap on the lid or the glass edge still keeps it in the water.
        const far = fishPositionFor({ x: 0, y: 0 }, 'left');
        expect(far).toEqual({ x: FISH_SWIM.minX, y: FISH_SWIM.minY });
    });

    test('a shake drops three flakes on the water, never more than six in the tank', () => {
        const random = seededRandom(1);
        let { flakes, added } = dropFlakes([], 50, random);
        expect(added).toBe(FLAKES.perShake);
        flakes.forEach((flake) => {
            expect(flake.y).toBe(TANK.y + 5);
            expect(Math.abs(flake.x - 50)).toBeLessThanOrEqual(FLAKES.spread);
        });
        ({ flakes, added } = dropFlakes(flakes, 30, random));
        expect(flakes).toHaveLength(FLAKES.most);
        const full = dropFlakes(flakes, 30, random);
        expect(full.added).toBe(0);
        expect(full.flakes).toBe(flakes);
        // Dropped at the very edge, they still land inside the glass.
        dropFlakes([], 0, () => 0).flakes.forEach((flake) => expect(tankKeyAt(flake.x, flake.y)).toBe('U'));
        dropFlakes([], 999, () => 0.999).flakes.forEach((flake) => expect(tankKeyAt(flake.x + 1, flake.y)).toBe('U'));
    });

    test('flakes sink to where the fish can reach them, and stop there', () => {
        let flakes = [{ x: 40, y: TANK.y + 5 }];
        for (let i = 0; i < 30; i++) flakes = sinkFlakes(flakes);
        expect(flakes[0].y).toBe(FLAKE_FLOOR_Y);
        expect(['U', 'g', 'G']).toContain(tankKeyAt(40, FLAKE_FLOOR_Y));
        expect(FLAKE_FLOOR_Y).toBe(FISH_SWIM.maxY + fish.mouth.y);
    });

    test('the nearest flake is the one it goes for', () => {
        const flakes = [{ x: 60, y: 38 }, { x: 35, y: 33 }, { x: 45, y: 39 }];
        expect(nearestFlake({ x: 36, y: 34 }, flakes)).toBe(1);
        expect(nearestFlake({ x: 58, y: 38 }, flakes)).toBe(0);
        expect(nearestFlake({ x: 0, y: 0 }, [])).toBe(-1);
    });

    // Every flake, wherever it can land, can be eaten from one side or the other.
    test('every flake that has sunk can be reached, mouth first', () => {
        const xs = dropFlakes([], 0, () => 0).flakes[0].x;
        const xe = dropFlakes([], 999, () => 0.999).flakes[0].x;
        for (let x = xs; x <= xe; x++) {
            for (const from of [FISH_SWIM.minX, FISH_SWIM.maxX]) {
                const flake = { x, y: FLAKE_FLOOR_Y };
                const { target, facing } = fishApproach({ x: from, y: FISH_HOME.y }, flake);
                expect(canEat(target, facing, flake)).toBe(true);
            }
        }
    });

    test('it comes at a flake from the side it is on, and waits beneath one too high to reach', () => {
        const flake = { x: 45, y: TANK.y + 5 };
        const fromRight = fishApproach({ x: 58, y: 33 }, flake);
        expect(fromRight.facing).toBe('left');
        const fromLeft = fishApproach({ x: 27, y: 33 }, flake);
        expect(fromLeft.facing).toBe('right');
        // Still at the top, the flake is out of reach: the target is as high as the fish can go.
        expect(fromRight.target.y).toBe(FISH_SWIM.minY);
        expect(canEat(fromRight.target, 'left', flake)).toBe(false);
    });

    test('bubbles start in front of the mouth, rise, and pop at the surface', () => {
        const mouth = { x: 40, y: 38 };
        const bubbles = bubblesFrom(mouth, 3, 'left');
        expect(bubbles).toHaveLength(3);
        bubbles.forEach((bubble) => expect(bubble.x).toBeLessThan(mouth.x));
        expect(bubblesFrom(mouth, 1, 'right')[0].x).toBeGreaterThan(mouth.x);
        let rising = bubbles;
        for (let step = 0; step < 20; step++) {
            rising.forEach(({ x, y }) => pixelsOf(BUBBLE, x - 1, y - 1).forEach(([px, py]) => {
                expect(['U', 'g', 'G']).toContain(tankKeyAt(px, py));
            }));
            rising = riseBubbles(rising);
        }
        expect(rising).toEqual([]);
    });

    // The Z's of a sleeping fish rise out of the tank past its lid, and must stay below the window.
    test('a sleeping fish\'s Z\'s stay in the room and below the window', () => {
        const windowBottom = WINDOW.y + WINDOW.rows.length - 1;
        for (const x of [FISH_SWIM.minX, FISH_SWIM.maxX]) {
            for (let step = 0; step < Z_RISE; step++) {
                zzzFrame(step, fish.zzzOrigin).forEach(({ x: zx, y: zy, rows }) => {
                    expect(FISH_SWIM.maxY + zy).toBeGreaterThan(windowBottom);
                    expect(x + zx + rows[0].length).toBeLessThanOrEqual(SCENE.width);
                });
            }
        }
        expect(zzzFrame(0)).toEqual(zzzFrame(0, dog.zzzOrigin));
    });

    test('the fish is given flakes, in the tank; the dog food and water, in its bowls', () => {
        expect(SPECIES_ITEMS).toEqual({ dog: ['food', 'water'], fish: ['flakes'] });
        expect(SPECIES_TARGETS).toEqual({ dog: ['food', 'water'], fish: ['tank'] });
        expect(acceptsItem('tank', 'flakes')).toBe(true);
        expect(acceptsItem('food', 'flakes')).toBe(false);
        expect(acceptsItem('tank', 'food')).toBe(false);
        Object.values(SPECIES_ITEMS).flat().forEach((item) => expect(ITEM_ICONS).toHaveProperty(item));
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

    /* The owner's brief, revised twice: a flat 10 to 90 seconds was too long to watch for,
       then the 10-second floor came down to 5. Never more than 45 seconds, mostly short. */
    test('waits in four bands: 50% 5-10 seconds, 25% 10-25, 15% 25-35, 10% 35-45', () => {
        expect(FIDGET.waitBands).toEqual([
            { fromSeconds: 5, toSeconds: 9, share: 0.5 },
            { fromSeconds: 10, toSeconds: 24, share: 0.25 },
            { fromSeconds: 25, toSeconds: 34, share: 0.15 },
            { fromSeconds: 35, toSeconds: 45, share: 0.1 },
        ]);
        const total = FIDGET.waitBands.reduce((sum, band) => sum + band.share, 0);
        expect(total).toBeCloseTo(1, 10);
    });

    test('the first draw picks the band, the second the second within it', () => {
        expect(fidgetDelayMs(scripted(0, 0))).toBe(5000);
        expect(fidgetDelayMs(scripted(0.49, 0.999999))).toBe(9000);
        expect(fidgetDelayMs(scripted(0.5, 0))).toBe(10000);
        expect(fidgetDelayMs(scripted(0.74, 0.999999))).toBe(24000);
        expect(fidgetDelayMs(scripted(0.75, 0))).toBe(25000);
        expect(fidgetDelayMs(scripted(0.89, 0.999999))).toBe(34000);
        expect(fidgetDelayMs(scripted(0.91, 0))).toBe(35000);
        expect(fidgetDelayMs(scripted(0.999999, 0.999999))).toBe(45000);
    });

    test('never waits longer than 45 seconds, and every whole second from 5 to 45 can come up', () => {
        const random = seededRandom(3);
        const waits = [];
        for (let i = 0; i < 20000; i++) waits.push(fidgetDelayMs(random));
        expect(waits.every((ms) => ms % 1000 === 0)).toBe(true);
        expect(Math.min(...waits)).toBe(5000);
        expect(Math.max(...waits)).toBe(45000);
        expect(new Set(waits).size).toBe(41);
    });

    test('in practice, lands in each band about as often as its share', () => {
        const random = seededRandom(4);
        const trials = 20000;
        const counts = [0, 0, 0, 0];
        for (let i = 0; i < trials; i++) {
            const seconds = fidgetDelayMs(random) / 1000;
            counts[seconds < 10 ? 0 : seconds < 25 ? 1 : seconds < 35 ? 2 : 3] += 1;
        }
        [0.5, 0.25, 0.15, 0.1].forEach((share, band) => {
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
