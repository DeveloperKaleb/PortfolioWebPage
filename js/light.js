/* Sunlight on the Solar System tab's map: how far light that left the Sun at some moment
 * has got, what it has passed and what is next, and how long it takes to reach an object
 * and come back to Earth. All real numbers at the map's real scale; nothing here is sped
 * up. The tab draws it as a ring leaving the Sun when the page opens, and a second ring
 * for light that left when this browser first opened the tab.
 *
 * Pure: no network, no DOM, no clock. The caller passes the times in.
 */

/* Light crosses one astronomical unit in 499.004784 s (the AU is defined as 149,597,870.7 km
   and the speed of light as 299,792.458 km/s, both exact). */
export const AU_KM = 149597870.7;
export const LIGHT_KM_PER_S = 299792.458;
export const LIGHT_SECONDS_PER_AU = AU_KM / LIGHT_KM_PER_S;

const DAY_S = 86400;
const YEAR_S = 365.25 * DAY_S;

/* How far (AU) light has gone in some milliseconds; nothing before it leaves. */
export const lightTravelledAU = (ms) => Math.max(0, ms) / 1000 / LIGHT_SECONDS_PER_AU;

/* How long (s) light takes to cross a distance in AU. */
export const lightSeconds = (distanceAU) => distanceAU * LIGHT_SECONDS_PER_AU;

const groupThousands = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/* A length of time in the two largest units that matter: "42 s", "8 min 19 s",
   "6 h 33 min", "12 days 3 h", "1.58 years". */
export function durationText(seconds) {
    const s = Math.max(0, Math.round(seconds));
    if (s < 60) return `${s} s`;
    if (s < 3600) return `${Math.floor(s / 60)} min ${s % 60} s`;
    if (s < 2 * DAY_S) {
        const minutes = Math.round(s / 60);
        return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
    }
    if (s < YEAR_S) {
        const hours = Math.round(s / 3600);
        const days = Math.floor(hours / 24);
        return hours % 24 ? `${days} days ${hours % 24} h` : `${days} days`;
    }
    return `${(s / YEAR_S).toFixed(2)} years`;
}

/* A distance light has gone, in the unit that shows it moving: kilometres until it is past
   the Sun's near neighbourhood, then AU. */
export function distanceText(distanceAU) {
    if (distanceAU < 0.1) return `${groupThousands(distanceAU * AU_KM)} km`;
    if (distanceAU < 100) return `${distanceAU.toFixed(2)} AU`;
    return `${groupThousands(distanceAU)} AU`;
}

/* The bodies light meets on its way out, nearest first: [{ name, r }] from anything with a
   name and a distance from the Sun in AU. Light spreads in every direction, so it reaches
   each body when it has gone as far as that body is from the Sun. */
export const milestones = (bodies) => bodies
    .filter((b) => b.name && Number.isFinite(b.r) && b.r > 0)
    .map((b) => ({ name: b.name, r: b.r }))
    .sort((a, b) => a.r - b.r);

/* Where light is among the milestones: the last one it passed and the next one ahead,
   with how long (s) until it gets there. Either may be null. */
export function lightProgress(travelledAU, sorted) {
    let passed = null;
    let next = null;
    for (const m of sorted) {
        if (m.r <= travelledAU) passed = m;
        else { next = m; break; }
    }
    return { passed, next, secondsToNext: next ? lightSeconds(next.r - travelledAU) : null };
}

/* The sentence under the map for one ring of light.
 *
 *   since   what the light is: "as you opened this page" / "when you first opened this
 *           page on 30 October 2026"
 *   elapsedSeconds  how long ago it left, said first when given
 *   edge    { name, r } for the last line of the journey (the page's 100,000 AU limit)
 */
export function lightSentence({ since, travelledAU, sorted, edge, elapsedSeconds }) {
    const { passed, next, secondsToNext } = lightProgress(travelledAU, sorted);
    const parts = [Number.isFinite(elapsedSeconds)
        ? `Light that left the Sun ${durationText(elapsedSeconds)} ago, ${since}, has travelled ${distanceText(travelledAU)}.`
        : `Light that left the Sun ${since} has travelled ${distanceText(travelledAU)}.`];
    if (next) {
        parts.push(passed
            ? `It has passed ${passed.name} and reaches ${next.name} in ${durationText(secondsToNext)}.`
            : `It reaches ${next.name} in ${durationText(secondsToNext)}.`);
    } else if (passed) {
        const beyond = travelledAU / passed.r;
        parts.push(beyond >= 2
            ? `It is ${beyond >= 10 ? Math.round(beyond) : beyond.toFixed(1)} times further out than ${passed.name}, the furthest thing on the map.`
            : `It has passed ${passed.name}, the furthest thing on the map.`);
    }
    if (edge) {
        parts.push(travelledAU < edge.r
            ? `It will be ${durationText(lightSeconds(edge.r - travelledAU))} before it reaches ${edge.name}.`
            : `It has gone beyond ${edge.name}.`);
    }
    return parts.join(' ');
}

/* A card's Sunlight line: the time out to the object from the Sun, and on from the object
 * to Earth - which is how old the view of it is. Positions are heliocentric, in AU.
 * Earth itself, and anything too close to Earth to matter (the Moon), has only the first half. */
export function sunlightText(position, earth) {
    const out = lightSeconds(Math.hypot(position.x, position.y, position.z));
    const back = earth ? lightSeconds(Math.hypot(position.x - earth.x, position.y - earth.y, position.z - earth.z)) : 0;
    if (back < 5) return `reaches it in ${durationText(out)}`;
    return `reaches it in ${durationText(out)}, and takes ${durationText(back)} more to come back to Earth: we see it as it was ${durationText(back)} ago`;
}

/* ---- The ruler -------------------------------------------------------------------------
 *
 * The map shows about a hundred AU; light from a visit a week ago is over a thousand AU
 * out. So both rings also sit on a ruler under the map, and the ruler runs all the way from
 * the Sun to the nearest star (owner, 2026-11-13).
 *
 * It has two poles, and is logarithmic from each. From the left, each step is ten times
 * further from the Sun; from the right, ten times further from the centre of gravity of
 * Alpha Centauri A and B, the two stars at the middle of that system (the owner's choice
 * of pole: Proxima, though nearer to us, orbits them). The two scales meet halfway, so the
 * ruler spreads out near either pole, where the known things are, and squeezes the gap
 * between, where almost nothing is. It measures distance from a pole and says nothing of
 * direction: Proxima sits where its distance from A and B puts it.
 *
 * Beyond 1,000 AU from the Sun nothing has been seen where it is - bodies whose orbits
 * reach that far are found near the Sun - so from there to Proxima, the outermost known
 * body of the other system, the ruler is hatched, and says why in the owner's words
 * (UNSEEN_TEXT). */
export const RULER_FROM_AU = 0.001;

/* Alpha Centauri A and B: 274,700 AU (4.344 light years), from the orbital parallax of
   750.81 +/- 0.38 mas (Akeson et al. 2021, AJ 162, 14). The two are 11 to 36 AU apart, so
   the ruler's last step, 1 AU from their centre of gravity, is inside the pair. Proxima is
   about 12,050 AU from that centre: the figure js/centauri.js gets from the two positions
   and parallaxes (Akeson's, and Gaia DR3's for Proxima), which the map draws, so ruler and
   map agree. The often-quoted 12,947 +/- 260 AU (Kervella, Thevenin & Lovis 2017) used an
   older, smaller parallax for A and B, which put them some 1,300 AU further off. */
export const CENTAURI = {
    name: 'Alpha Centauri A and B',
    distanceAU: 274700,
    floorAU: 1,
    proxima: { name: 'Proxima Centauri', fromCentreAU: 12050 },
};

export const UNSEEN_FROM_AU = 1000;
export const UNSEEN_TEXT = 'More science needed (MOSTLY BIGGER TELESCOPES)';

const HALFWAY_AU = CENTAURI.distanceAU / 2;
const SUN_DECADES = Math.log10(HALFWAY_AU / RULER_FROM_AU);
const STAR_DECADES = Math.log10(HALFWAY_AU / CENTAURI.floorAU);
const between = (value, low, high) => Math.min(high, Math.max(low, value));

/* Where something sits along the ruler, 0 (the Sun) to 1 (the far pole), by its distance
   from the far pole: for the other system's own bodies. Held to that pole's half. */
export const fromStarFraction = (fromStarAU) => 1
    - Math.log10(between(fromStarAU, CENTAURI.floorAU, HALFWAY_AU) / CENTAURI.floorAU) / (SUN_DECADES + STAR_DECADES);

/* The same by distance from the Sun, on the straight line to the far pole: for everything
   of ours, and for the light. Held to the ruler's ends. */
export function rulerFraction(fromSunAU) {
    if (fromSunAU > HALFWAY_AU) return fromStarFraction(CENTAURI.distanceAU - fromSunAU);
    return Math.log10(between(fromSunAU, RULER_FROM_AU, HALFWAY_AU) / RULER_FROM_AU) / (SUN_DECADES + STAR_DECADES);
}

/* The ruler's tick marks: each power of ten from either end, as fractions along it. */
export function rulerTicks() {
    const ticks = [];
    for (let k = 0; k <= Math.floor(SUN_DECADES + 1e-9); k++) ticks.push(k / (SUN_DECADES + STAR_DECADES));
    for (let k = 0; k <= Math.floor(STAR_DECADES + 1e-9); k++) ticks.push(1 - k / (SUN_DECADES + STAR_DECADES));
    return ticks;
}

/* The hatched stretch, as fractions along the ruler. */
export const unseenStretch = () => [rulerFraction(UNSEEN_FROM_AU), fromStarFraction(CENTAURI.proxima.fromCentreAU)];

/* ---- The first visit ---------------------------------------------------------------------
 *
 * The moment this browser first opened the tab, kept in its own storage and nowhere else.
 * Anything unreadable, or a time in the future (a clock that was wrong), starts again. */
export function firstVisit(stored, now) {
    const then = Number(stored);
    return stored !== null && stored !== '' && Number.isFinite(then) && then > 0 && then <= now ? then : now;
}

/* The two rings are worth telling apart once the older light has a minute's lead. */
export const SECOND_RING_AFTER_MS = 60000;
export const hasEarlierVisit = (first, opened) => opened - first >= SECOND_RING_AFTER_MS;

/* Zoom so a ring of this radius fills about a third of the map, within the map's limits:
   the scale (px per AU) to draw at. */
export function scaleToShow(radiusAU, sizePx, { fitScale, maxZoom }) {
    const wanted = (sizePx * 0.3) / Math.max(radiusAU, 1e-9);
    return Math.min(fitScale * maxZoom, Math.max(fitScale, wanted));
}

/* How long until the light is worth drawing again, in milliseconds. The picture is only
   redrawn when a visitor could see a difference:
   - four times a second while anything drawn moves a quarter of a pixel a second or more
     (the ring when zoomed in on the Sun, the ruler's mark in a visit's first minutes), or
     while a light's distance is still given in kilometres, which change faster than that;
   - otherwise at the moment the next whole second shows in the words, for each light
     young enough to be counted in seconds (durationText), and once a second after that;
   - every ten seconds for a visitor who has asked for less motion.
   ages: how long ago each light left, in milliseconds. */
export const LIGHT_TICK = { movingMs: 250, reducedMs: 10000, movingFrom: 0.25, kmBelowAU: 0.1, secondsBelow: 3600 };

export function lightTickMs({ ages, pxPerSecond = 0, reduced = false }) {
    if (reduced) return LIGHT_TICK.reducedMs;
    if (pxPerSecond >= LIGHT_TICK.movingFrom) return LIGHT_TICK.movingMs;
    if (ages.some((ms) => lightTravelledAU(ms) < LIGHT_TICK.kmBelowAU)) return LIGHT_TICK.movingMs;
    /* durationText rounds to the nearest second, so the words change on each half second
       of a light's age; a few milliseconds past it, so the timer cannot land just short. */
    const waits = ages
        .filter((ms) => Math.round(ms / 1000) < LIGHT_TICK.secondsBelow)
        .map((ms) => 1000 - ((Math.max(0, ms) + 500) % 1000) + 5);
    return waits.length ? Math.min(...waits) : 1000;
}
