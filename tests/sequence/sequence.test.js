import { describe, test, expect } from 'vitest';
import {
    STATUS,
    PRESETS,
    createGame,
    extendSequence,
    beginInput,
    pressPad,
    isCorrectPress,
    isRoundComplete,
    isOver,
    remainingInRound,
    expectedPad,
    padIndexes,
    stepDurationMs,
    STEP_MS,
    PAD_TONES,
    toneFor,
    FAILURE_TONE,
} from '../../js/sequence.js';

/* A stand-in for Math.random that always deals the pad given. Aimed at the middle of
   that pad's band rather than its edge, so it cannot land on a neighbour by rounding.
   Every test that cares which pad comes up uses one, so none depends on chance. */
const dealer = (pad, padCount = 4) => () => (pad + 0.5) / padCount;

// Play a whole run through correctly and hand back the resulting game.
const answer = (game, pads) => pads.reduce((g, pad) => pressPad(g, pad), beginInput(game));

describe('Starting a game', () => {
    test('begins with nothing to repeat', () => {
        const game = createGame();
        expect(game.sequence).toEqual([]);
        expect(game.round).toBe(0);
        expect(game.status).toBe(STATUS.READY);
    });

    test('takes its pad count from a preset', () => {
        expect(createGame(PRESETS.four).padCount).toBe(4);
        expect(createGame(PRESETS.six).padCount).toBe(6);
    });

    test('the four-pad game is the first four of the six', () => {
        expect(padIndexes(createGame(PRESETS.four))).toEqual([0, 1, 2, 3]);
        expect(padIndexes(createGame(PRESETS.six))).toEqual([0, 1, 2, 3, 4, 5]);
    });
});

describe('Extending the run', () => {
    test('adds one pad and hands it to the machine to show', () => {
        const game = extendSequence(createGame(), dealer(2));
        expect(game.sequence).toEqual([2]);
        expect(game.round).toBe(1);
        expect(game.status).toBe(STATUS.SHOWING);
    });

    test('keeps everything already in the run', () => {
        let game = extendSequence(createGame(), dealer(1));
        game = answer(game, [1]);
        game = extendSequence(game, dealer(3));
        expect(game.sequence).toEqual([1, 3]);
        expect(game.round).toBe(2);
    });

    test('never draws a pad the game does not have', () => {
        let game = createGame(PRESETS.four);
        for (let i = 0; i < 200; i++) game = { ...extendSequence(game), status: STATUS.READY };
        game.sequence.forEach((pad) => {
            expect(pad).toBeGreaterThanOrEqual(0);
            expect(pad).toBeLessThan(4);
        });
    });

    /* The run is allowed to repeat a pad. A run that never did would leak information -
       after each pad the player could rule that one out for the next. */
    test('can draw the same pad twice running', () => {
        let game = extendSequence(createGame(), dealer(2));
        game = answer(game, [2]);
        game = extendSequence(game, dealer(2));
        expect(game.sequence).toEqual([2, 2]);
    });
});

describe('Answering', () => {
    test('a correct press advances through the run', () => {
        let game = extendSequence(createGame(), dealer(0));
        game = extendSequence({ ...game, status: STATUS.READY }, dealer(3));
        game = beginInput(game);

        expect(expectedPad(game)).toBe(0);
        game = pressPad(game, 0);
        expect(game.status).toBe(STATUS.AWAITING);
        expect(expectedPad(game)).toBe(3);
        expect(remainingInRound(game)).toBe(1);
    });

    test('finishing the run completes the round', () => {
        let game = extendSequence(createGame(), dealer(1));
        game = answer(game, [1]);
        expect(isRoundComplete(game)).toBe(true);
        expect(game.status).toBe(STATUS.READY);
        expect(isOver(game)).toBe(false);
    });

    test('a wrong press ends the game', () => {
        let game = extendSequence(createGame(), dealer(1));
        game = beginInput(game);
        expect(isCorrectPress(game, 2)).toBe(false);
        game = pressPad(game, 2);
        expect(game.status).toBe(STATUS.LOST);
        expect(isOver(game)).toBe(true);
    });

    test('a wrong press part way through a long run still ends it', () => {
        let game = extendSequence(createGame(), dealer(0));
        game = extendSequence({ ...game, status: STATUS.READY }, dealer(2));
        game = extendSequence({ ...game, status: STATUS.READY }, dealer(1));
        game = beginInput(game);
        game = pressPad(game, 0);
        game = pressPad(game, 2);
        game = pressPad(game, 3); // should have been 1
        expect(isOver(game)).toBe(true);
    });

    /* Pressing while the machine is still showing the run is being early, not being
       wrong. Losing a round to that would be reading the interface, not the sequence. */
    test('presses during playback are ignored, not punished', () => {
        const showing = extendSequence(createGame(), dealer(1));
        expect(showing.status).toBe(STATUS.SHOWING);
        const after = pressPad(showing, 3); // the wrong pad, at the wrong time
        expect(after.status).toBe(STATUS.SHOWING);
        expect(after.inputIndex).toBe(0);
    });

    test('presses after the game is lost change nothing', () => {
        let game = beginInput(extendSequence(createGame(), dealer(1)));
        game = pressPad(game, 2);
        expect(pressPad(game, 1)).toEqual(game);
    });

    test('beginInput only applies while the machine is showing', () => {
        const fresh = createGame();
        expect(beginInput(fresh)).toEqual(fresh);
    });
});

describe('Games are immutable', () => {
    test('extending does not touch the game it came from', () => {
        const before = extendSequence(createGame(), dealer(1));
        const snapshot = JSON.parse(JSON.stringify(before));
        extendSequence({ ...before, status: STATUS.READY }, dealer(2));
        expect(JSON.parse(JSON.stringify(before))).toEqual(snapshot);
    });

    test('pressing does not touch the game it came from', () => {
        const before = beginInput(extendSequence(createGame(), dealer(1)));
        pressPad(before, 1);
        expect(before.inputIndex).toBe(0);
        expect(before.status).toBe(STATUS.AWAITING);
    });
});

describe('The difficulty ramp', () => {
    test('starts at the opening pace', () => {
        expect(stepDurationMs(0)).toBe(STEP_MS.start);
    });

    test('gets faster as the rounds go up', () => {
        expect(stepDurationMs(5)).toBeLessThan(stepDurationMs(1));
        expect(stepDurationMs(10)).toBeLessThan(stepDurationMs(5));
    });

    /* The floor is the point of the ramp: past it the run keeps growing and the tempo
       does not, so what beats the player is recall rather than reaction speed. */
    test('flattens at the floor and never goes below it', () => {
        expect(stepDurationMs(STEP_MS.easedOverRounds)).toBe(STEP_MS.floor);
        expect(stepDurationMs(500)).toBe(STEP_MS.floor);
    });
});

describe('Pad tones', () => {
    test('every pad has one', () => {
        expect(PAD_TONES).toHaveLength(6);
        padIndexes(createGame(PRESETS.six)).forEach((pad) => {
            expect(toneFor(pad)).toBeGreaterThan(0);
        });
    });

    /* Pitch rises with pad order, so the run can be followed by ear alone - the audio
       is a second full channel rather than decoration on the lights. */
    test('pitch rises with pad order', () => {
        const rising = PAD_TONES.every((tone, i) => i === 0 || tone > PAD_TONES[i - 1]);
        expect(rising).toBe(true);
    });

    test('no two pads sound the same', () => {
        expect(new Set(PAD_TONES).size).toBe(PAD_TONES.length);
    });

    // It has to be unmistakable, so it sits below the run and outside its scale.
    test('the failure buzz is below every pad', () => {
        expect(FAILURE_TONE).toBeLessThan(Math.min(...PAD_TONES));
        expect(PAD_TONES).not.toContain(FAILURE_TONE);
    });
});
