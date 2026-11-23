/* The sky-photo test page (skyphoto.html): reads the chosen photo in the browser, shrinks
 * it (js/skyphoto.js, fitSize), finds the stars and rings them, then asks the worker
 * (skysolve-worker.js, js/skysolve.js) which stars they are and labels them. Nothing is
 * sent anywhere. */
import { toGray, fitSize, photoStats, findStars, judgeSky, readExif, lensTip, NOT_SKY } from '/PortfolioWebPage/js/skyphoto.js';
import { jdFromDate } from '/PortfolioWebPage/js/orbit.js';

const input = document.getElementById('skyphoto-file');
const status = document.getElementById('skyphoto-status');
const canvas = document.getElementById('skyphoto-canvas');

// The worker carries this page's ?v= stamp, so a push never pairs it with an old page.
const worker = new Worker(new URL(`./skysolve-worker.js${new URL(import.meta.url).search}`, import.meta.url), { type: 'module' });
let asked = 0;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const ask = ++asked;
    status.textContent = 'Looking for stars…';
    canvas.hidden = true;
    try {
        const exif = readExif(new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer()));
        // Turned the way the camera held it (EXIF), as the gallery shows it.
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const { width, height } = fitSize(bitmap.width, bitmap.height);
        // A photo turned on its side by EXIF has its lens's width and height swapped, which
        // the 35 mm figure (a diagonal) does not mind.
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();
        const photo = ctx.getImageData(0, 0, width, height);
        // Let the status paint before the search holds the page for a moment.
        await new Promise((done) => requestAnimationFrame(() => setTimeout(done)));
        const gray = toGray(photo.data, width, height);
        const stars = findStars(gray, width, height);
        const stats = photoStats(gray);
        const verdict = judgeSky(stats, stars);
        ring(ctx, stars, verdict.ok ? '#7fd3ff' : '#ffb04d', width);
        canvas.hidden = false;
        // A daytime picture needs no lens advice; every other failure gets it when it fits.
        const tip = (text) => [text, lensTip(exif.mm35)].filter(Boolean).join(' ');
        if (!verdict.ok) {
            const found = `(${plural(stars.length, 'star')} found.)`;
            status.textContent = verdict.reason === 'bright' ? `${verdict.message} ${found}` : tip(`${verdict.message} ${found}`);
            return;
        }

        status.textContent = `${plural(stars.length, 'star')} found. Working out which part of the sky this is…`;
        const taken = exif.taken ?? new Date(file.lastModified || Date.now());
        worker.onmessage = ({ data }) => {
            if (ask !== asked) return;
            if (!data.solved) {
                status.textContent = tip(data.gaveUp ? NOT_SKY.slow : NOT_SKY.unmatched);
                return;
            }
            ctx.putImageData(photo, 0, 0);
            ring(ctx, stars, 'rgba(127, 211, 255, 0.45)', width);
            label(ctx, data.matches, width);
            const named = data.matches.filter((m) => !/^HIP /.test(m.name)).length;
            status.textContent = `${plural(data.matches.length, 'star')} matched (${named} with names), `
                + `in a field ${data.fov.width.toFixed(0)}° × ${data.fov.height.toFixed(0)}° `
                + `centred at RA ${data.centre.ra.toFixed(1)}°, Dec ${data.centre.dec.toFixed(1)}°. `
                + `(${(data.ms / 1000).toFixed(1)} s, fit to ${data.rmsPixels.toFixed(1)} px.)`;
        };
        worker.postMessage({ stars, width, height, jd: jdFromDate(taken), mm35: exif.mm35 });
    } catch (error) {
        canvas.hidden = true;
        status.textContent = `That file couldn't be read as a picture. (${error.message})`;
    }
});

function ring(ctx, stars, colour, width) {
    ctx.lineWidth = Math.max(1.5, width / 800);
    ctx.strokeStyle = colour;
    for (const s of stars) {
        ctx.beginPath();
        ctx.arc(s.x + 0.5, s.y + 0.5, Math.max(6, s.size * 2.5), 0, 2 * Math.PI);
        ctx.stroke();
    }
}

/* Names beside the matched stars: the brightest first, and a name only where it does not
   land on one already written, so a crowded patch stays readable. */
function label(ctx, matches, width) {
    // About 13 px on a phone showing the photo 380 px wide.
    const size = Math.max(13, Math.round(width / 28));
    ctx.font = `${size}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const boxes = [];
    for (const m of [...matches].sort((a, b) => a.mag - b.mag)) {
        const text = m.name;
        const w = ctx.measureText(text).width;
        const colour = m.planet ? '#ffd27f' : '#ffffff';
        const ring = Math.max(7, size * 0.55);
        ctx.beginPath();
        ctx.lineWidth = Math.max(1.5, width / 800);
        ctx.strokeStyle = colour;
        ctx.arc(m.x + 0.5, m.y + 0.5, ring, 0, 2 * Math.PI);
        ctx.stroke();
        // Every match keeps its ring and every name is drawn on the photo, right of the
        // star, else left, else above, else below; a name with no free place is left out.
        const gap = ring + size * 0.3;
        const places = [[m.x + gap, m.y], [m.x - gap - w, m.y], [m.x - w / 2, m.y - gap - size / 2], [m.x - w / 2, m.y + gap + size / 2]];
        const fits = ([x, y]) => {
            const box = [x - 2, y - size / 2 - 2, x + w + 2, y + size / 2 + 2];
            if (box[0] < 0 || box[2] > width || box[1] < 0 || box[3] > ctx.canvas.height) return null;
            return boxes.some((b) => b[0] < box[2] && box[0] < b[2] && b[1] < box[3] && box[1] < b[3]) ? null : box;
        };
        const place = places.find(fits);
        if (!place) continue;
        boxes.push(fits(place));
        const [x, y] = place;
        ctx.lineWidth = Math.max(3, size / 4);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.strokeText(text, x, y);
        ctx.fillStyle = colour;
        ctx.fillText(text, x, y);
    }
}
