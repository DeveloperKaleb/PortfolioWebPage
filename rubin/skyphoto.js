/* The sky-photo test page (skyphoto.html): reads the chosen photo in the browser, shrinks
 * it (js/skyphoto.js, fitSize), finds the stars and rings them. Nothing is sent anywhere. */
import { toGray, fitSize, photoStats, findStars, judgeSky } from '/PortfolioWebPage/js/skyphoto.js';

const input = document.getElementById('skyphoto-file');
const status = document.getElementById('skyphoto-status');
const canvas = document.getElementById('skyphoto-canvas');

input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    status.textContent = 'Looking for stars…';
    canvas.hidden = true;
    try {
        // Turned the way the camera held it (EXIF), as the gallery shows it.
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const { width, height } = fitSize(bitmap.width, bitmap.height);
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();
        // Let the status paint before the search holds the page for a moment.
        await new Promise((done) => requestAnimationFrame(() => setTimeout(done)));
        const started = performance.now();
        const gray = toGray(ctx.getImageData(0, 0, width, height).data, width, height);
        const stars = findStars(gray, width, height);
        const stats = photoStats(gray);
        const verdict = judgeSky(stats, stars);
        const ms = Math.round(performance.now() - started);

        ctx.lineWidth = Math.max(1.5, width / 800);
        ctx.strokeStyle = verdict.ok ? '#7fd3ff' : '#ffb04d';
        for (const s of stars) {
            ctx.beginPath();
            ctx.arc(s.x + 0.5, s.y + 0.5, Math.max(6, s.size * 2.5), 0, 2 * Math.PI);
            ctx.stroke();
        }
        canvas.hidden = false;
        const found = `${stars.length} star${stars.length === 1 ? '' : 's'} found`;
        const detail = `(${width}×${height}, sky level ${Math.round(stats.median)}, ${ms} ms)`;
        status.textContent = verdict.ok ? `${found}. ${detail}` : `${verdict.message} ${found} ${detail}.`;
    } catch (error) {
        canvas.hidden = true;
        status.textContent = `That file couldn't be read as a picture. (${error.message})`;
    }
});
