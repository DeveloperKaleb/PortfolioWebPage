/* Service worker: makes the site work with no network.
 *
 * Everything here is static and there are no external requests, so "offline" is only a
 * question of holding on to the files. The precached files come to about 260KB (2026-09-11).
 *
 * THE VERSION BELOW MUST BE BUMPED WITH EVERY PUSH, alongside LAST_UPDATED in
 * scripts/footer.js and the ?v= stamps in the two HTML files. A test in
 * tests/markup/ids.test.js fails if it drifts out of step with them.
 *
 * Why that matters more here than anywhere else: a service worker caches until it is
 * told not to. Get this wrong and a phone keeps serving an old build with no obvious way
 * for its owner to clear it - a permanent version of the ten-minute staleness that has
 * already caused confusion once. See NOTES.md.
 */

const VERSION = '20261119-1400';
const CACHE = `portfolio-${VERSION}`;
const BASE = '/PortfolioWebPage';

/* The asset URLs carry the same stamp the pages ask for, so they are cache hits rather
   than near misses. Built from VERSION so there is one number to change, not twelve. */
const PRECACHE = [
    `${BASE}/`,
    `${BASE}/index.html`,
    `${BASE}/entertainment/entertainment.html`,
    `${BASE}/rubin/rubin.html`,
    `${BASE}/rubin/rubin.js?v=${VERSION}`,
    `${BASE}/style.css?v=${VERSION}`,
    `${BASE}/vendor/normalize.css?v=${VERSION}`,
    `${BASE}/scripts/nav.js?v=${VERSION}`,
    `${BASE}/scripts/footer.js?v=${VERSION}`,
    `${BASE}/scripts/stream.js?v=${VERSION}`,
    `${BASE}/entertainment/entertainment.js?v=${VERSION}`,

    /* The pure modules are imported by entertainment.js without a stamp - a static
       import specifier cannot carry one without being rewritten on every push - so they
       are cached under their plain URLs. The versioned cache name is what retires them:
       a new VERSION means a new cache, and these are fetched again. */
    `${BASE}/js/logic.js`,
    `${BASE}/js/contrast.js`,
    `${BASE}/js/strands.js`,
    `${BASE}/js/minesweeper.js`,
    `${BASE}/js/sequence.js`,
    `${BASE}/js/tictactoe.js`,
    `${BASE}/js/ternilapilli.js`,
    `${BASE}/js/routes.js`,
    `${BASE}/js/pets.js`,
    `${BASE}/js/boardzoom.js`,
    `${BASE}/js/minesolver.js`,
    `${BASE}/js/mineshapes.js`,
    `${BASE}/js/mineopenings.js`,
    `${BASE}/js/stream.js`,
    /* The Rubin tab's modules. The digest itself comes from another site and is not
       cached here; rubin.js keeps the last one it saw for offline visits. */
    `${BASE}/js/rubinview.js`,
    `${BASE}/js/equilibrium.js`,
    `${BASE}/js/brightness.js`,
    `${BASE}/js/tnoalbedos.js`,
    `${BASE}/js/flags.js`,
    `${BASE}/js/orbit.js`,
    `${BASE}/js/planets.js`,
    `${BASE}/js/moons.js`,
    `${BASE}/js/funfacts.js`,
    `${BASE}/js/rubinstatus.js`,
    `${BASE}/js/light.js`,
    `${BASE}/js/faredge.js`,
    `${BASE}/js/rubincolors.js`,
    `${BASE}/js/centauri.js`,
    `${BASE}/js/nearstars.js`,
    `${BASE}/js/milkyway.js`,
    `${BASE}/js/spacecraft.js`,
    `${BASE}/js/spacecrafttracks.js`,
    `${BASE}/js/startiles.js`,
    `${BASE}/js/starview.js`,
    /* The picture of the sky behind the Solar System map is left to the browser's
       own cache with every other picture (see below). */
];

/* The family photo is deliberately NOT precached.
 *
 * Caching it would not expose anything a visit does not already - a browser stores it in
 * the ordinary HTTP cache either way, sandboxed to this origin - but a service worker
 * holds it far longer and more deliberately, on the device of everyone who has ever
 * opened the page. It buys nothing for the reason this worker exists: offline play means
 * the games, and the entertainment page does not reference the photo at all.
 *
 * Leaving it out keeps the offline payload to about 260KB rather than about 550KB, and keeps a picture
 * of the family out of long-lived storage on other people's devices, at no cost to
 * anything anyone actually wanted offline. The home page still works without a network;
 * the picture may or may not be there, and hides itself if it is not.
 */

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            /* Fetched past the browser's own cache. GitHub Pages lets a browser keep a file
               for 10 minutes, so a worker installed within 10 minutes of a visit filled its
               new cache with the unstamped modules (above) from before the push, and kept
               them until the next one: on 2026-11-18 a computer showed the new footer with
               the old js/rubinview.js, while a phone, not visited in between, was right. */
            .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
            // Take over straight away rather than waiting for every tab to close. A
            // worker that lingers is how a stale build gets pinned.
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(
                names.filter((name) => name !== CACHE).map((name) => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    /* Gaia's star tiles (gaia-stars, published at /gaia-stars/ on the same origin): left to
       the browser's own cache. Cache-first here would keep every tile a visitor ever saw,
       up to 47 MB, until the next push. */
    if (url.pathname.startsWith('/gaia-stars/')) return;

    /* Documents go to the network first. The HTML is what names the current ?v= stamps,
       so a visitor with a connection always lands on the newest build - which is the
       safety valve against this worker ever pinning an old one. The cache is the
       fallback, which is the offline case. */
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE).then((cache) => cache.put(request, copy));
                    return response;
                })
                .catch(() => caches.match(request).then((hit) => hit || caches.match(`${BASE}/index.html`)))
        );
        return;
    }

    /* Network first, keeping a copy; the copy is the offline case. For what changes under
       the same URL, with no ?v= stamp:
       - The Rubin digest (rubin-data, published at /rubin-data/ on the same origin), every
         week; cache-first would pin an old one.
       - The pure modules under js/. On the first visit after a push the old worker still
         answers: the page and its stamped script came new from the network, but cache-first
         handed that new script the old modules it imports. On 2026-11-18 the new rubin.js
         called the old js/milkyway.js without the window it then needed, and the Milky Way
         drew invisible until a reload. */
    if (url.pathname.startsWith('/rubin-data/') || url.pathname.startsWith(`${BASE}/js/`)) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => caches.match(request).then((hit) => hit || Response.error()))
        );
        return;
    }

    /* Everything else is cache-first. Safe because the stamped URLs change whenever
       their contents do, so a hit is never a stale hit; and the pictures, which carry no
       stamp, are kept only until the next push (a new VERSION is a new cache). */
    event.respondWith(
        caches.match(request).then((hit) => hit || fetch(request).then((response) => {
            if (response.ok) {
                const copy = response.clone();
                caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
        }))
    );
});
