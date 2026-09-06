// Bump this manually with every push to origin/main. Include the time to the minute.
// Also bump the matching ?v=YYYYMMDD-HHmm query string on the style.css/nav.js/
// footer.js/entertainment.js tags in index.html and entertainment.html - that's
// what actually cache-busts those files; this constant can't do it by itself
// since the browser has to fetch this very file before it can read this value.
const LAST_UPDATED = 'September 6, 2026, 4:36 PM';

document.addEventListener('DOMContentLoaded', () => {
    const lastUpdatedElement = document.getElementById('last-updated');
    if (lastUpdatedElement) {
        lastUpdatedElement.textContent = `Last updated: ${LAST_UPDATED}`;
    }
});
