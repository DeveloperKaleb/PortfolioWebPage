/* The sky-photo page's matching (js/skysolve.js, js/skyaim.js), off the page's own thread
 * so the page stays usable while it works. Takes { stars, width, height, jd, mm35, aim },
 * aim being { R0, f0 } for a shot taken in the page with the phone's sensors, and answers
 * with the solution's plain numbers and names, or { solved: false, gaveUp }. */
import { skyObjects, solve, GUESS_MM, SOLVE } from '/PortfolioWebPage/js/skysolve.js';
import { solveAimed } from '/PortfolioWebPage/js/skyaim.js';

let objects = null, objectsJd = null;

self.onmessage = ({ data }) => {
    const { stars, width, height, jd, mm35, aim } = data;
    // The planets move about a degree a day at most; one catalogue a day is plenty.
    if (!objects || Math.abs(jd - objectsJd) > 0.5) { objects = skyObjects(jd); objectsJd = jd; }
    const started = performance.now();
    let got = null;
    if (aim) {
        // Enough stars for the pattern alone: that first, as it does not trust the compass.
        // The lens is near the guess, so only the main cameras' lengths, and not for long.
        if (stars.length >= SOLVE.minMatches) {
            const pattern = solve(stars, width, height, objects, { mm: GUESS_MM.slice(0, 8), budgetMs: 5000 });
            if (pattern && !pattern.gaveUp) got = { ...pattern, confidence: 'sure' };
        }
        got ??= solveAimed(stars, width, height, objects, aim);
    } else {
        // The photo's own lens first when it says, then the usual ones.
        const mm = mm35 ? [mm35, mm35 * 1.05, mm35 / 1.05, ...GUESS_MM.filter((g) => Math.abs(g / mm35 - 1) > 0.07)] : GUESS_MM;
        got = solve(stars, width, height, objects, { mm });
        if (got && !got.gaveUp) got.confidence = 'sure';
    }
    const ms = Math.round(performance.now() - started);
    if (!got || got.gaveUp) { self.postMessage({ solved: false, gaveUp: Boolean(got?.gaveUp), ms }); return; }
    self.postMessage({
        solved: true, ms, confidence: got.confidence,
        R: got.R, f: got.f, rmsPixels: got.rms * got.f, centre: got.centre, fov: got.fov,
        matches: got.matches.map((m) => ({ x: m.star.x, y: m.star.y, name: m.object.name, mag: m.object.mag, planet: Boolean(m.object.planet) })),
    });
};
