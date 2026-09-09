/* Sequence: the rules, with no DOM and no timers.
 *
 * The game shows a growing run of pads and asks for it back. Everything here is
 * immutable - every function returns a new game - matching js/minesweeper.js, so a
 * test can hold a position and play several continuations from it.
 *
 * What is deliberately NOT here: playback timing. The machine only knows which pads
 * are in the run and how far the player has got through repeating it; how long a pad
 * stays lit, and the gap between two of them, belong to the layer that owns the clock.
 * That is what keeps this file testable without a browser.
 */

export const STATUS = {
    READY: 'ready',       // between rounds - the run is not being shown or answered
    SHOWING: 'showing',   // the machine is playing the run back
    AWAITING: 'awaiting', // the player's turn
    LOST: 'lost',
};

/* Four pads or six. The pad list is ordered, and a preset takes the first n of it, so
   the four-pad game is a strict subset of the six-pad one - same colours, same tones,
   same positions. Learning one is learning the other. */
export const PRESETS = {
    four: { padCount: 4 },
    six: { padCount: 6 },
};

export const DEFAULTS = PRESETS.four;

export function createGame(options = {}) {
    const { padCount } = { ...DEFAULTS, ...options };
    return {
        padCount,
        sequence: [],
        round: 0,
        inputIndex: 0, // how far into the sequence the player has correctly got
        status: STATUS.READY,
    };
}

export const padIndexes = (game) => Array.from({ length: game.padCount }, (_, i) => i);

/* Add one pad to the run and hand it back to the machine to show.
 *
 * The new pad is drawn with no regard for what came before, repeats included. A run
 * that never repeats a pad is a different, easier game: after a while the player could
 * rule out the pad they just saw. Simon repeats, and so does this. */
export function extendSequence(game, random = Math.random) {
    if (game.status === STATUS.LOST) return game;
    const next = Math.floor(random() * game.padCount);
    return {
        ...game,
        sequence: [...game.sequence, next],
        round: game.round + 1,
        inputIndex: 0,
        status: STATUS.SHOWING,
    };
}

// The machine has finished showing the run; the player's turn starts.
export function beginInput(game) {
    if (game.status !== STATUS.SHOWING) return game;
    return { ...game, inputIndex: 0, status: STATUS.AWAITING };
}

export const expectedPad = (game) => game.sequence[game.inputIndex];

export const isCorrectPress = (game, pad) => pad === expectedPad(game);

/* A press only counts while the game is waiting for one. Presses during playback are
   ignored rather than punished: a pad hit while the machine is still talking is the
   player being early, not wrong, and losing a run to that would be reading the
   interface rather than the sequence. */
export function pressPad(game, pad) {
    if (game.status !== STATUS.AWAITING) return game;
    if (!isCorrectPress(game, pad)) return { ...game, status: STATUS.LOST };

    const inputIndex = game.inputIndex + 1;
    const finished = inputIndex >= game.sequence.length;
    return {
        ...game,
        inputIndex,
        // A completed round goes back to READY, which is where extendSequence picks up.
        status: finished ? STATUS.READY : STATUS.AWAITING,
    };
}

// The whole run has just been repeated correctly.
export const isRoundComplete = (game) =>
    game.status === STATUS.READY && game.round > 0 && game.inputIndex === game.sequence.length;

export const isOver = (game) => game.status === STATUS.LOST;

// How many pads are still owed in this round. Drives the on-screen progress readout.
export const remainingInRound = (game) => game.sequence.length - game.inputIndex;

/* The run is shown faster as it gets longer, which is the difficulty ramp: the pads
 * are never hidden, only given less time to be committed to memory.
 *
 * It flattens rather than falling away, because the two things being asked of the
 * player pull in opposite directions. The run gets longer every round on its own; if
 * the pace also kept climbing, the round that ends the game would end it on reaction
 * speed, not on memory. Past the floor the run keeps growing and the tempo does not,
 * so what fails is recall - which is the game.
 */
export const STEP_MS = { start: 620, floor: 300, easedOverRounds: 14 };

export function stepDurationMs(round, timing = STEP_MS) {
    const progress = Math.min(round / timing.easedOverRounds, 1);
    return Math.round(timing.start + (timing.floor - timing.start) * progress);
}

/* Pad tones: a minor pentatonic run, low to high, one per pad.
 *
 * Ascending pitch matched to pad order means the run can be followed by ear alone -
 * the audio is a second full channel, not decoration on the lights. Pentatonic because
 * no two of these clash however they land next to each other, and a run of them stays
 * bearable through the twentieth repeat.
 *
 * Held here beside the pad indexes rather than in logic.js with the colours: this is
 * the one file that knows what a pad IS, and a tone is no more presentational than a
 * pad's position. The colours live in logic.js only because the contrast rules have to
 * reach them. */
export const PAD_TONES = [196.00, 233.08, 261.63, 349.23, 392.00, 466.16]; // G3 A#3 C4 F4 G4 A#4

export const toneFor = (pad) => PAD_TONES[pad % PAD_TONES.length];

/* The buzz on a wrong press: below every pad tone and not in the scale, so it cannot be
   mistaken for part of the run. */
export const FAILURE_TONE = 92.5;
