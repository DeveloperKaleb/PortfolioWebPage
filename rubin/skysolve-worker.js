/* The sky-photo page's matching (js/skysolve.js), off the page's own thread so the page
 * stays usable while it works. Takes { stars, width, height, jd, mm35 } and answers with
 * the solution's plain numbers and names, or { solved: false, gaveUp }. */
import { skyObjects, solve, GUESS_MM } from '/PortfolioWebPage/js/skysolve.js';

let objects = null, objectsJd = null;

self.onmessage = ({ data }) => {
    const { stars, width, height, jd, mm35 } = data;
    // The planets move about a degree a day at most; one catalogue a day is plenty.
    if (!objects || Math.abs(jd - objectsJd) > 0.5) { objects = skyObjects(jd); objectsJd = jd; }
    // The photo's own lens first when it says, then the usual ones.
    const mm = mm35 ? [mm35, mm35 * 1.05, mm35 / 1.05, ...GUESS_MM.filter((g) => Math.abs(g / mm35 - 1) > 0.07)] : GUESS_MM;
    const started = performance.now();
    const got = solve(stars, width, height, objects, { mm });
    const ms = Math.round(performance.now() - started);
    if (!got || got.gaveUp) { self.postMessage({ solved: false, gaveUp: Boolean(got?.gaveUp), ms }); return; }
    self.postMessage({
        solved: true, ms,
        R: got.R, f: got.f, rmsPixels: got.rms * got.f, centre: got.centre, fov: got.fov,
        matches: got.matches.map((m) => ({ x: m.star.x, y: m.star.y, name: m.object.name, mag: m.object.mag, planet: Boolean(m.object.planet) })),
    });
};
