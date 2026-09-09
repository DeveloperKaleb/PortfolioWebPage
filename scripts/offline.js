/* Registers the service worker that lets the site run with no network.
 *
 * Deliberately quiet: no reload when a new worker takes over. The worker fetches
 * documents from the network first, so the next navigation is already the newest build,
 * and reloading underneath someone mid-game to save them one page load is a poor trade.
 *
 * Nothing here is required for the site to work. A browser without service workers, or
 * a page opened over file://, simply skips it and behaves as it always did.
 */
/* Never during local development. tools/dev-server.js sends Cache-Control: no-store so
   that an edit shows up on the next refresh, and a service worker serving assets from
   its own cache would quietly undo that - you would edit style.css, reload, and see the
   previous version with nothing to explain why. Offline play is a production concern;
   local work is not. */
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);

if ('serviceWorker' in navigator && !isLocal) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/PortfolioWebPage/sw.js').catch(() => {
            /* Registration fails on http:// other than localhost, and in private windows
               in some browsers. That costs offline play and nothing else, so there is
               nothing to tell the reader about. */
        });
    });
}
