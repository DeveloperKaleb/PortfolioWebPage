// Bump this manually with every push to origin/main. Include the time to the minute.
const LAST_UPDATED = 'August 31, 2026, 10:44 PM';

document.addEventListener('DOMContentLoaded', () => {
    const lastUpdatedElement = document.getElementById('last-updated');
    if (lastUpdatedElement) {
        lastUpdatedElement.textContent = `Last updated: ${LAST_UPDATED}`;
    }
});
