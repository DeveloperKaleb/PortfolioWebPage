/* Color contrast rules for anything a player has to see or tell apart.
 *
 * Why this file exists: the original Tetris palette had pieces at 1.07:1 against the
 * empty cell - visually invisible - and the red Z piece sat on top of the olive empty
 * cell, which is exactly the pair red/green color blindness collapses. Picking colors
 * by eye is what produced that, so the rules are computed here and asserted in tests
 * instead of being a note somebody remembers to follow.
 *
 * Pure math, no DOM - see the note in CLAUDE.md about keeping logic testable.
 */

const channels = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// sRGB -> linear light. Contrast math only works on linear values, not raw hex.
const linear = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

export const relativeLuminance = (hexColor) => {
    const [r, g, b] = channels(hexColor).map(linear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// The WCAG ratio, 1:1 (identical) through 21:1 (black on white).
export const contrastRatio = (a, b) => {
    const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

/* Simulate how a color lands for the two common forms of red/green color blindness,
   by converting to LMS cone response and collapsing the missing cone onto the others.
   'deuter' is a missing/shifted M cone, 'prot' the L cone. */
export function simulateCVD(hexColor, type) {
    const [r, g, b] = channels(hexColor).map(linear);
    const L = 0.31399 * r + 0.63951 * g + 0.04649 * b;
    const M = 0.15537 * r + 0.75789 * g + 0.08670 * b;
    const S = 0.01775 * r + 0.10944 * g + 0.87262 * b;

    let l = L, m = M;
    if (type === 'deuter') m = 0.9513092 * L + 0.0473533 * S;
    if (type === 'prot')   l = 1.0512286 * M - 0.0512286 * S;

    const r2 =  5.47221206 * l - 4.6419601  * m + 0.16963708 * S;
    const g2 = -1.1252419  * l + 2.29317094 * m - 0.1678952  * S;
    const b2 =  0.02980165 * l - 0.19318073 * m + 1.16364789 * S;

    const encode = (c) => {
        c = Math.max(0, Math.min(1, c));
        return c <= 0.00304 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    };
    const toHex = (c) => Math.round(encode(c) * 255).toString(16).padStart(2, '0');
    return '#' + toHex(r2) + toHex(g2) + toHex(b2);
}

/* CIELAB b*: the blue(negative) to yellow(positive) axis. This is the one color axis
   red/green color blindness leaves intact, so two colors of the same lightness are
   still tellable apart if they sit far enough apart on it. */
export function blueYellowAxis(hexColor) {
    const [r, g, b] = channels(hexColor).map(linear);
    const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
    const Y =  0.2126 * r + 0.7152 * g + 0.0722 * b;
    const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return 200 * (f(Y) - f(Z));
}

/* --- THE RULES --- */

// A game tile has to clear this against the surface behind it, for normal vision and
// for both simulations. 4.5:1 is the WCAG AA text threshold; tiles get held to it
// rather than the looser 3:1 for graphics because reading the board *is* the game.
export const MIN_AGAINST_BACKGROUND = 4.5;

// Two colors a player must tell apart need either a clear lightness gap or a clear
// blue-yellow gap. Hue alone is not enough - that assumption is what broke the old palette.
export const MIN_PAIR_LIGHTNESS = 1.35;
export const MIN_PAIR_BLUE_YELLOW = 22;

// Worst-case contrast against a background across normal, deuteranopic, protanopic vision.
export const worstCaseContrast = (color, background) => Math.min(
    contrastRatio(color, background),
    contrastRatio(simulateCVD(color, 'deuter'), simulateCVD(background, 'deuter')),
    contrastRatio(simulateCVD(color, 'prot'), simulateCVD(background, 'prot')),
);

// Can these two be told apart by someone with red/green color blindness?
export function areDistinguishable(a, b) {
    const lightness = Math.min(
        contrastRatio(simulateCVD(a, 'deuter'), simulateCVD(b, 'deuter')),
        contrastRatio(simulateCVD(a, 'prot'), simulateCVD(b, 'prot')),
    );
    const blueYellow = Math.abs(blueYellowAxis(a) - blueYellowAxis(b));
    return lightness >= MIN_PAIR_LIGHTNESS || blueYellow >= MIN_PAIR_BLUE_YELLOW;
}
