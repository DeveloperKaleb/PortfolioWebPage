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
 *           page, on 30 October 2026"
 *   edge    { name, r } for the last line of the journey (the page's 100,000 AU limit)
 */
export function lightSentence({ since, travelledAU, sorted, edge }) {
    const { passed, next, secondsToNext } = lightProgress(travelledAU, sorted);
    const parts = [`Light that left the Sun ${since} has travelled ${distanceText(travelledAU)}.`];
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
 * out. So both rings also sit on a ruler under the map whose scale is logarithmic: each
 * step along it is ten times further from the Sun, from a thousandth of an AU to the
 * page's limit. */
export const RULER_FROM_AU = 0.001;

/* Where a distance sits along the ruler, 0 to 1, held to its ends. */
export function rulerFraction(distanceAU, toAU) {
    const span = Math.log10(toAU / RULER_FROM_AU);
    const at = Math.log10(Math.max(distanceAU, RULER_FROM_AU) / RULER_FROM_AU) / span;
    return Math.min(1, Math.max(0, at));
}

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
