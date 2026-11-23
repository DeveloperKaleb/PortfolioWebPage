/* The sky-photo test page (skyphoto.html). Two ways in:
 * - a photo chosen or taken with the phone's camera app: read in the browser, shrunk
 *   (js/skyphoto.js fitSize), its stars found and ringed, then named by the worker
 *   (skysolve-worker.js, js/skysolve.js) from their pattern alone;
 * - aim and shoot: the camera shown in the page, about a second of frames averaged into
 *   one picture, and the phone's compass, tilt and place read meanwhile, so a few stars
 *   are enough (js/skyaim.js).
 * Nothing is sent anywhere. */
import { toGray, fitSize, photoStats, findStars, judgeSky, readExif, lensTip, NOT_SKY } from '/PortfolioWebPage/js/skyphoto.js';
import { aimedTurn, averageTurn } from '/PortfolioWebPage/js/skyaim.js';
import { jdFromDate } from '/PortfolioWebPage/js/orbit.js';

const input = document.getElementById('skyphoto-file');
const status = document.getElementById('skyphoto-status');
const canvas = document.getElementById('skyphoto-canvas');
const aimButton = document.getElementById('skyphoto-aim');
const live = document.getElementById('skyphoto-live');
const video = document.getElementById('skyphoto-video');
const shootButton = document.getElementById('skyphoto-shoot');
const cancelButton = document.getElementById('skyphoto-cancel');

// The worker carries this page's ?v= stamp, so a push never pairs it with an old page.
const worker = new Worker(new URL(`./skysolve-worker.js${new URL(import.meta.url).search}`, import.meta.url), { type: 'module' });
let asked = 0;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const ask = ++asked;
    stopLive();
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
        const taken = exif.taken ?? new Date(file.lastModified || Date.now());
        await analyse({ ask, ctx, photo, jd: jdFromDate(taken), mm35: exif.mm35 });
    } catch (error) {
        canvas.hidden = true;
        status.textContent = `That file couldn't be read as a picture. (${error.message})`;
    }
});

/* Finds the stars in a picture on the canvas, rings them, and asks the worker to name
   them; aim (from a shot taken here) lets one star be enough. */
async function analyse({ ask, ctx, photo, jd, mm35 = null, aim = null }) {
    const { width, height } = photo;
    // Let the status paint before the search holds the page for a moment.
    await new Promise((done) => requestAnimationFrame(() => setTimeout(done)));
    const gray = toGray(photo.data, width, height);
    const stars = findStars(gray, width, height);
    const verdict = judgeSky(photoStats(gray), stars, aim ? { minStars: 1 } : {});
    ring(ctx, stars, verdict.ok ? '#7fd3ff' : '#ffb04d', width);
    canvas.hidden = false;
    // A daytime picture needs no lens advice; every other failure gets it when it fits.
    const tip = (text) => [text, lensTip(mm35)].filter(Boolean).join(' ');
    if (!verdict.ok) {
        const found = `(${plural(stars.length, 'star')} found.)`;
        status.textContent = verdict.reason === 'bright' ? `${verdict.message} ${found}` : tip(`${verdict.message} ${found}`);
        return;
    }
    status.textContent = `${plural(stars.length, 'star')} found. Working out which part of the sky this is…`;
    worker.onmessage = ({ data }) => {
        if (ask !== asked) return;
        if (!data.solved) {
            status.textContent = tip(data.gaveUp ? NOT_SKY.slow : NOT_SKY.unmatched);
            return;
        }
        ctx.putImageData(photo, 0, 0);
        ring(ctx, stars, 'rgba(127, 211, 255, 0.45)', width);
        label(ctx, data.matches, width, data.confidence === 'guess');
        if (aim && data.confidence === 'sure') rememberLens(data.f, width, height);
        const named = data.matches.filter((m) => !/^HIP /.test(m.name)).length;
        const where = `in a field ${data.fov.width.toFixed(0)}° × ${data.fov.height.toFixed(0)}° `
            + `centred at RA ${data.centre.ra.toFixed(1)}°, Dec ${data.centre.dec.toFixed(1)}°. `
            + `(${(data.ms / 1000).toFixed(1)} s, fit to ${data.rmsPixels.toFixed(1)} px.)`;
        if (data.confidence === 'sure') {
            status.textContent = `${plural(data.matches.length, 'star')} matched (${named} with names), ${where}`;
        } else if (data.confidence === 'likely') {
            status.textContent = `Named ${plural(data.matches.length, 'star')} with help from your phone's compass. `
                + `Probably right, but with so few stars it's worth checking one against a sky app. ${where}`;
        } else {
            status.textContent = `A best guess, from your phone's compass and ${plural(data.matches.length, 'star')}: `
                + `it could easily be wrong, so the ${data.matches.length === 1 ? 'name has' : 'names have'} a question mark. ${where}`;
        }
    };
    worker.postMessage({ stars, width, height, jd, mm35, aim });
}

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
function label(ctx, matches, width, unsure = false) {
    // About 13 px on a phone showing the photo 380 px wide.
    const size = Math.max(13, Math.round(width / 28));
    ctx.font = `${size}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const boxes = [];
    for (const m of [...matches].sort((a, b) => a.mag - b.mag)) {
        const text = unsure ? `${m.name}?` : m.name;
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

/* ---- Aim and shoot ---- */

let stream = null, reading = null, place = null, compassSeen = false;

/* The phone's orientation, from north. Chrome on Android sends deviceorientationabsolute;
   Safari sends deviceorientation with webkitCompassHeading (clockwise from north, so
   alpha, which counts the other way, is 360 less it). A plain deviceorientation without
   either is from wherever the phone started, which is no use here. */
function onOrientation(e) {
    if (e.alpha == null || e.beta == null || e.gamma == null) return;
    if (e.type === 'deviceorientationabsolute' || e.absolute) {
        compassSeen = true;
        reading = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
    } else if (typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0) {
        compassSeen = true;
        reading = { alpha: (360 - e.webkitCompassHeading) % 360, beta: e.beta, gamma: e.gamma };
    }
}

aimButton.addEventListener('click', async () => {
    ++asked;
    stopLive();
    reading = null; place = null; compassSeen = false;
    canvas.hidden = true;
    status.textContent = 'Asking for your camera, compass and location…';
    try {
        // Safari asks for the motion sensors on a tap, before anything else waits.
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            if (await DeviceOrientationEvent.requestPermission() !== 'granted') throw new Error('compass');
        }
        window.addEventListener('deviceorientationabsolute', onOrientation);
        window.addEventListener('deviceorientation', onOrientation);
        const where = new Promise((done, fail) => navigator.geolocation
            ? navigator.geolocation.getCurrentPosition((p) => done(p.coords), () => fail(new Error('location')), { maximumAge: 3600000, timeout: 20000 })
            : fail(new Error('location')));
        stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 4096 }, height: { ideal: 3072 } },
        });
        await brighten(stream.getVideoTracks()[0]);
        video.srcObject = stream;
        await video.play();
        live.hidden = false;
        place = await where;
        status.textContent = 'Point at the sky and hold the phone very still (leaning it on something helps), then press Shoot.';
        setTimeout(() => {
            if (stream && !compassSeen) status.textContent = "This phone isn't sharing its compass with the page, so aiming can't help. You can still choose a photo above.";
        }, 2000);
    } catch (error) {
        stopLive();
        const why = { compass: 'the motion sensors', location: 'your location' }[error.message] ?? 'the camera';
        status.textContent = `Aim and shoot needs ${why}, and couldn't get it. You can still choose a photo above. (${error.message})`;
    }
});

/* The longest exposure and highest sensitivity the camera lets a page set, where it lets
   one at all (Chrome on Android, for some cameras). Anything refused is left as it was. */
async function brighten(track) {
    const caps = track.getCapabilities?.() ?? {};
    const want = {};
    if (caps.exposureMode?.includes('manual') && caps.exposureTime) { want.exposureMode = 'manual'; want.exposureTime = caps.exposureTime.max; }
    if (caps.iso) want.iso = caps.iso.max;
    if (!Object.keys(want).length) return;
    try { await track.applyConstraints({ advanced: [want] }); } catch { /* left as it was */ }
}

shootButton.addEventListener('click', async () => {
    if (!stream || !reading || !place) {
        status.textContent = !reading ? "Still waiting for the phone's compass…" : 'Still waiting for your location…';
        return;
    }
    const ask = ++asked;
    shootButton.disabled = true;
    status.textContent = 'Hold still…';
    try {
        const { photo, R0, f0, jd } = await stack();
        stopLive();
        canvas.width = photo.width;
        canvas.height = photo.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.putImageData(photo, 0, 0);
        status.textContent = 'Looking for stars…';
        await analyse({ ask, ctx, photo, jd, aim: { R0, f0 } });
    } catch (error) {
        stopLive();
        status.textContent = `The shot didn't work. (${error.message})`;
    } finally {
        shootButton.disabled = false;
    }
});
cancelButton.addEventListener('click', () => { stopLive(); status.textContent = ''; });

/* About STACK_MS of the camera's frames averaged into one picture (fainter stars stand
   out of the noise, as in a phone's night mode, though nothing here lines the frames up:
   hence holding still), and the sensors' readings over the same time. */
const STACK_MS = 1200;
async function stack() {
    const { width, height } = fitSize(video.videoWidth, video.videoHeight);
    const scratch = document.createElement('canvas');
    scratch.width = width;
    scratch.height = height;
    const sctx = scratch.getContext('2d', { willReadFrequently: true });
    const sum = new Uint16Array(width * height * 4);
    const turns = [];
    const started = performance.now();
    const middle = new Date(Date.now() + STACK_MS / 2);
    const jd = jdFromDate(middle);
    const screenAngle = screen.orientation?.angle ?? window.orientation ?? 0;
    let frames = 0;
    const nextFrame = () => new Promise((done) => (video.requestVideoFrameCallback ? video.requestVideoFrameCallback(() => done()) : requestAnimationFrame(() => done())));
    do {
        await nextFrame();
        sctx.drawImage(video, 0, 0, width, height);
        const data = sctx.getImageData(0, 0, width, height).data;
        for (let i = 0; i < data.length; i++) sum[i] += data[i];
        turns.push(aimedTurn({ ...reading, screenAngle, jd, lat: place.latitude, lon: place.longitude }));
        frames++;
    } while ((performance.now() - started < STACK_MS || frames < 2) && frames < 250);
    const photo = new ImageData(width, height);
    for (let i = 0; i < sum.length; i++) photo.data[i] = (i & 3) === 3 ? 255 : Math.round(sum[i] / frames);
    return { photo, R0: averageTurn(turns), f0: lensGuess(width, height), jd };
}

/* The camera's focal length in pixels: 26 mm equivalent across the long side of a 4:3
   sensor (a 16:9 video keeps the width), until a sure match on this phone has measured
   it; then that, kept in this browser. */
const LENS_KEY = 'skyphoto-lens';
function lensGuess(width, height) {
    const long = Math.max(width, height);
    let measured = null;
    try { measured = Number(localStorage.getItem(LENS_KEY)) || null; } catch { /* private mode */ }
    return measured ? measured * long : 26 * long * 1.25 / 43.27;
}
function rememberLens(f, width, height) {
    try { localStorage.setItem(LENS_KEY, String(f / Math.max(width, height))); } catch { /* private mode */ }
}

function stopLive() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    live.hidden = true;
    window.removeEventListener('deviceorientationabsolute', onOrientation);
    window.removeEventListener('deviceorientation', onOrientation);
}
