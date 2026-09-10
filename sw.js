/* Service worker: makes the site work with no network.
 *
 * Everything here is static and there are no external requests, so "offline" is only a
 * question of holding on to the files. The whole site is 448KB.
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

const VERSION = '20260910-1345';
const CACHE = `portfolio-${VERSION}`;
const BASE = '/PortfolioWebPage';

/* The asset URLs carry the same stamp the pages ask for, so they are cache hits rather
   than near misses. Built from VERSION so there is one number to change, not twelve. */
const PRECACHE = [
    `${BASE}/`,
    `${BASE}/index.html`,
    `${BASE}/entertainment/entertainment.html`,
    `${BASE}/style.css?v=${VERSION}`,
    `${BASE}/vendor/normalize.css?v=${VERSION}`,
    `${BASE}/scripts/nav.js?v=${VERSION}`,
    `${BASE}/scripts/footer.js?v=${VERSION}`,
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
];

/* The family photo is deliberately NOT precached.
 *
 * Caching it would not expose anything a visit does not already - a browser stores it in
 * the ordinary HTTP cache either way, sandboxed to this origin - but a service worker
 * holds it far longer and more deliberately, on the device of everyone who has ever
 * opened the page. It buys nothing for the reason this worker exists: offline play means
 * the games, and the entertainment page does not reference the photo at all.
 *
 * Leaving it out takes the offline payload from 448KB to about 160KB and keeps a picture
 * of the family out of long-lived storage on other people's devices, at no cost to
 * anything anyone actually wanted offline. The home page still works without a network;
 * the picture may or may not be there, and hides itself if it is not.
 */

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => cache.addAll(PRECACHE))
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

    /* Everything else is cache-first. Safe because the stamped URLs change whenever
       their contents do, so a hit is never a stale hit. */
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
