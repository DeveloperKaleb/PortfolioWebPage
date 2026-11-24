/* Night mode for the sky-photo page (owner, 2026-11-24; NOTES.md, "Sky photos"): dim red on
 * black, as astronomers use, because white or blue light undoes the eyes' dark adaptation
 * (20-30 minutes to win back) and red barely touches it. On by itself on a phone once the
 * Sun is 6 degrees below the horizon (civil twilight's end); a visitor's own choice wins
 * for 12 hours. The colours are js/nightcolors.js's, held to the contrast rules.
 *
 * It also marks the phone layout (html.phone: a coarse pointer, or ?layout=phone to preview
 * it on a computer; ?layout=wide the other way), for the same reason.
 *
 * A classic script loaded in the head, before the page paints, so a phone at night never
 * flashes the day colours, or the computer layout, first; that is why it is not a module. Tested by running it in
 * a sandbox (tests/rubin/night.test.js). It exposes window.skyNight for the page's toggle.
 */
(function () {
    'use strict';
    var CHOICE = 'skyphoto-night'; // {"on": true, "until": ms since 1970}
    var PLACE = 'skyphoto-place'; // "lat,lon" to 0.1 degree, saved by aim and shoot
    var KEEP_CHOICE_MS = 12 * 3600 * 1000;
    var DUSK = -6;
    var DEG = Math.PI / 180;

    /* The Sun's altitude in degrees at a date for latitude, east longitude (degrees): the
       Astronomical Almanac's low-precision formulae, good to about 0.01 degree, far finer
       than a twilight line needs. */
    function sunAltitude(date, lat, lon) {
        var d = date.getTime() / 86400000 + 2440587.5 - 2451545;
        var g = (357.529 + 0.98560028 * d) * DEG;
        var q = 280.459 + 0.98564736 * d;
        var L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG;
        var e = (23.439 - 0.00000036 * d) * DEG;
        var ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
        var dec = Math.asin(Math.sin(e) * Math.sin(L));
        var gmst = (280.46061837 + 360.98564736629 * d) * DEG;
        var ha = gmst + lon * DEG - ra;
        return Math.asin(Math.sin(lat * DEG) * Math.sin(dec) + Math.cos(lat * DEG) * Math.cos(dec) * Math.cos(ha)) / DEG;
    }

    /* Where the phone is, near enough for dusk: the place aim and shoot saved, else the
       time zone's longitude (15 degrees an hour; getTimezoneOffset counts minutes behind
       UTC) at 40 degrees north, which puts dusk within about an hour for most of the world. */
    function guessPlace(timezoneOffsetMinutes, saved) {
        if (saved) {
            var parts = String(saved).split(',').map(Number);
            if (parts.length === 2 && isFinite(parts[0]) && isFinite(parts[1])) return { lat: parts[0], lon: parts[1], guessed: false };
        }
        return { lat: 40, lon: -timezoneOffsetMinutes / 4, guessed: true };
    }

    /* Whether night mode is on: the visitor's choice while it lasts, else on for a phone
       (a coarse pointer) after dusk, and off on a computer. */
    function decide(now, choice, phone, place) {
        if (choice && typeof choice.on === 'boolean' && choice.until > now.getTime()) return choice.on;
        if (!phone) return false;
        return sunAltitude(now, place.lat, place.lon) < DUSK;
    }

    function store() {
        try { return window.localStorage; } catch (e) { return null; }
    }
    function readChoice() {
        try { return JSON.parse(store().getItem(CHOICE)); } catch (e) { return null; }
    }
    function isPhone() {
        return Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    }
    /* The phone layout: a coarse pointer, unless the address asks otherwise. */
    function phoneLayout(search, coarse) {
        var asked = /[?&]layout=(phone|wide)(?:&|$)/.exec(search || '');
        return asked ? asked[1] === 'phone' : coarse;
    }
    function apply(on) {
        document.documentElement.classList.toggle('night', on);
        // The browser's own bars and pickers follow.
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', on ? '#000000' : '#3b3026');
        return on;
    }
    function current() {
        var saved = null;
        try { saved = store().getItem(PLACE); } catch (e) { /* none */ }
        var phone = document.documentElement.classList.contains('phone');
        return decide(new Date(), readChoice(), phone, guessPlace(new Date().getTimezoneOffset(), saved));
    }
    /* The visitor's own choice, kept for 12 hours, then back to the automatic one. */
    function choose(on) {
        try { store().setItem(CHOICE, JSON.stringify({ on: on, until: Date.now() + KEEP_CHOICE_MS })); } catch (e) { /* private mode */ }
        return apply(on);
    }
    /* The place to 0.1 degree, kept on this phone only, so the next visit knows its dusk. */
    function rememberPlace(lat, lon) {
        try { store().setItem(PLACE, lat.toFixed(1) + ',' + lon.toFixed(1)); } catch (e) { /* private mode */ }
    }

    window.skyNight = {
        sunAltitude: sunAltitude, guessPlace: guessPlace, decide: decide,
        phoneLayout: phoneLayout, apply: apply, current: current, choose: choose, rememberPlace: rememberPlace,
        DUSK: DUSK, KEEP_CHOICE_MS: KEEP_CHOICE_MS,
    };
    if (typeof document !== 'undefined' && document.documentElement) {
        try { document.documentElement.classList.toggle('phone', phoneLayout(window.location && window.location.search, isPhone())); } catch (e) { /* computer layout */ }
        try { apply(current()); } catch (e) { /* day colours */ }
    }
})();
