/* The sky-photo test page (skyphoto.html). Two ways in:
 * - a photo chosen or taken with the phone's camera app: read in the browser, shrunk
 *   (js/skyphoto.js fitSize), its stars found and ringed, then named by the worker
 *   (skysolve-worker.js, js/skysolve.js) from their pattern alone;
 * - aim and shoot: the camera shown in the page, about a second of frames averaged into
 *   one picture, and the phone's compass, tilt and place read meanwhile, so a few stars
 *   are enough (js/skyaim.js).
 * Every attempt keeps its details (shotLog). "Help us calibrate" lets the visitor send them
 * by their own email app, after seeing what is in them. The page itself sends nothing.
 * On a phone (pointer: coarse) aim and shoot fills the screen like a camera app, with tilt
 * and steadiness shown live; night mode (rubin/night.js) turns the page red after dusk. */
import { toGray, fitSize, photoStats, findStars, judgeSky, readExif, lensTip, NOT_SKY, nextExposure, shotLog, meanBrightness, REASONS, REPORT_TO, REPORT_SUBJECT, reportBody, reportContents, fitForEmail, reportLink } from '/PortfolioWebPage/js/skyphoto.js';
import { aimedTurn, averageTurn, cameraAltitude, turnRate, steadiness } from '/PortfolioWebPage/js/skyaim.js';
import { jdFromDate } from '/PortfolioWebPage/js/orbit.js';

const input = document.getElementById('skyphoto-file');
const status = document.getElementById('skyphoto-status');
const canvas = document.getElementById('skyphoto-canvas');
const aimButton = document.getElementById('skyphoto-aim');
const live = document.getElementById('skyphoto-live');
const video = document.getElementById('skyphoto-video');
const shootButton = document.getElementById('skyphoto-shoot');
const cancelButton = document.getElementById('skyphoto-cancel');
const liveStatus = document.getElementById('skyphoto-live-status');
const tiltGauge = document.getElementById('skyphoto-tilt');
const steadyGauge = document.getElementById('skyphoto-steady');
const techBox = document.getElementById('skyphoto-tech');
const techText = document.getElementById('skyphoto-tech-text');
const nightButton = document.getElementById('skyphoto-night');
// The phone layout, as rubin/night.js set it before the page painted (a coarse pointer, or
// ?layout=phone); the stylesheet keys on the same class.
const phone = document.documentElement.classList.contains('phone');

/* The status line, and its copy over the full-screen camera view. */
function say(text) {
    status.textContent = text;
    liveStatus.textContent = text;
}
/* The numbers behind an answer, kept out of the way on a phone. */
function technical(text) {
    techText.textContent = text;
    techBox.hidden = !text;
    techBox.open = Boolean(text) && !phone;
}

/* ---- Night mode (rubin/night.js decides; this is the button) ---- */
const isNight = () => document.documentElement.classList.contains('night');
function showNight() {
    nightButton.setAttribute('aria-pressed', String(isNight()));
    nightButton.textContent = isNight() ? 'Night mode: on' : 'Night mode: off';
}
nightButton.addEventListener('click', () => {
    window.skyNight?.choose(!isNight());
    note('night mode chosen', { on: isNight() });
    showNight();
});
showNight();
// Dusk can fall while the page is open; the visitor's choice still wins (night.js).
setInterval(() => {
    if (window.skyNight) window.skyNight.apply(window.skyNight.current());
    showNight();
}, 60000);

// The worker carries this page's ?v= stamp, so a push never pairs it with an old page.
const worker = new Worker(new URL(`./skysolve-worker.js${new URL(import.meta.url).search}`, import.meta.url), { type: 'module' });
let asked = 0;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/* ---- The details of this attempt ----
   Always kept (owner, 2026-11-23), thrown away by the next attempt or by leaving the page:
   what the camera and sensors were asked for and did, frame by frame, and what the
   analysis made of it. See js/skyphoto.js shotLog for what is never in it. */
const helpRow = document.getElementById('skyphoto-help-row');
let log = null;
function begin(kind) {
    log = shotLog(() => performance.now());
    technical('');
    note(kind, {
        at: `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
        page: new URL(import.meta.url).searchParams.get('v'),
        screen: `${screen.width}x${screen.height}`, pixelRatio: devicePixelRatio,
        turned: screen.orientation?.angle ?? window.orientation,
        phoneLayout: phone, night: isNight(),
    });
    note('browser', { agent: navigator.userAgent });
    note('device', { cores: navigator.hardwareConcurrency, memoryGB: navigator.deviceMemory, touchPoints: navigator.maxTouchPoints });
    // Chrome keeps the phone's model out of the agent line but gives it when asked
    // (Safari never does: an iPhone says only that it is one).
    const mine = log;
    navigator.userAgentData?.getHighEntropyValues?.(['model', 'platform', 'platformVersion', 'fullVersionList'])
        .then((d) => {
            if (log !== mine) return;
            note('device model', {
                model: d.model || 'not given', platform: `${d.platform} ${d.platformVersion}`,
                browsers: d.fullVersionList?.filter((b) => !/Not.A.Brand/i.test(b.brand)).map((b) => `${b.brand} ${b.version}`),
            });
        })
        .catch(() => { /* not given */ });
}
function note(what, fields) {
    if (!log) return;
    log.add(what, fields);
    helpRow.hidden = false;
}

/* ---- Help us calibrate: a two-step dialog (owner, 2026-11-24) ----
   Step 1, why: a problem (with room to describe it) or just to help calibrate. Step 2, what
   is in the report, in plain words and in full, then the visitor's email app opens with it
   (js/skyphoto.js REPORT_TO, REPORT_SUBJECT). */
const dialog = document.getElementById('skyphoto-dialog');
const step1 = document.getElementById('skyphoto-step1');
const step2 = document.getElementById('skyphoto-step2');
const words = document.getElementById('skyphoto-words');
const nextButton = document.getElementById('skyphoto-next');
const contents = document.getElementById('skyphoto-contents');
const logView = document.getElementById('skyphoto-log');
const sendLink = document.getElementById('skyphoto-send');
const sentNote = document.getElementById('skyphoto-sent');
const cutNote = document.getElementById('skyphoto-cut');
const copyButton = document.getElementById('skyphoto-copy');
let reportText = '';
document.getElementById('skyphoto-to').textContent = `${REPORT_TO}, subject "${REPORT_SUBJECT}"`;
const reason = () => step1.querySelector('input[name="why"]:checked')?.value;
function showStep(n) {
    step1.hidden = n !== 1;
    step2.hidden = n !== 2;
}
document.getElementById('skyphoto-help').addEventListener('click', () => {
    showStep(1);
    sentNote.hidden = true;
    dialog.showModal();
});
step1.addEventListener('change', () => {
    words.hidden = reason() !== 'problem';
    nextButton.disabled = !reason();
    if (reason() === 'problem') words.focus();
});
nextButton.addEventListener('click', () => {
    if (!log || !reason()) return;
    const fitted = fitForEmail(log.text());
    reportText = reportBody({ reason: reason(), words: words.value, logText: fitted.text });
    contents.replaceChildren(...reportContents(log.text()).map((line) => {
        const li = document.createElement('li');
        li.textContent = line;
        return li;
    }));
    logView.textContent = reportText;
    cutNote.hidden = !fitted.cut;
    sendLink.href = reportLink(reportText);
    copyButton.textContent = 'Copy the report';
    showStep(2);
});
document.getElementById('skyphoto-back').addEventListener('click', () => showStep(1));
document.querySelectorAll('.skyphoto-close').forEach((b) => b.addEventListener('click', () => dialog.close()));
// A tap on the scrim around the panel closes it, as the site's other dialogs do.
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
sendLink.addEventListener('click', () => { sentNote.hidden = false; });
copyButton.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(`To: ${REPORT_TO}\nSubject: ${REPORT_SUBJECT}\n\n${reportText}`);
        copyButton.textContent = 'Copied';
    } catch {
        // No clipboard (an old browser, or not allowed): select the text for a long-press copy.
        logView.parentElement.open = true;
        getSelection().selectAllChildren(logView);
        copyButton.textContent = 'Selected: copy it from the menu';
    }
});
const failed = (error) => ({ name: error?.name, message: error?.message });

// What could stop an attempt without any step failing: the page hidden (screen locked,
// another app), and errors nothing caught, here or in the star search's worker.
document.addEventListener('visibilitychange', () => note(document.hidden ? 'page hidden (screen off or another app)' : 'page shown again'));
addEventListener('error', (e) => note('unexpected error', { message: e.message, where: `${e.filename?.split('/').pop()}:${e.lineno}` }));
addEventListener('unhandledrejection', (e) => note('unexpected error', failed(e.reason)));

input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const ask = ++asked;
    stopLive();
    begin('photo chosen');
    say('Looking for stars…');
    canvas.hidden = true;
    try {
        const exif = readExif(new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer()));
        note('file', { type: file.type, kilobytes: Math.round(file.size / 1024), lens35mm: exif.mm35, timeInPhoto: Boolean(exif.taken) });
        // Turned the way the camera held it (EXIF), as the gallery shows it.
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const { width, height } = fitSize(bitmap.width, bitmap.height);
        // A photo turned on its side by EXIF has its lens's width and height swapped, which
        // the 35 mm figure (a diagonal) does not mind.
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(bitmap, 0, 0, width, height);
        note('picture', { size: `${bitmap.width}x${bitmap.height}`, searchedAt: `${width}x${height}` });
        bitmap.close();
        const photo = ctx.getImageData(0, 0, width, height);
        const taken = exif.taken ?? new Date(file.lastModified || Date.now());
        await analyse({ ask, ctx, photo, jd: jdFromDate(taken), mm35: exif.mm35 });
    } catch (error) {
        note('could not read the file', failed(error));
        canvas.hidden = true;
        say(`That file couldn't be read as a picture. (${error.message})`);
    }
});

/* Finds the stars in a picture on the canvas, rings them, and asks the worker to name
   them; aim (from a shot taken here) lets one star be enough. */
async function analyse({ ask, ctx, photo, jd, mm35 = null, aim = null }) {
    const { width, height } = photo;
    // Let the status paint before the search holds the page for a moment.
    await new Promise((done) => requestAnimationFrame(() => setTimeout(done)));
    const searching = performance.now();
    const gray = toGray(photo.data, width, height);
    const stars = findStars(gray, width, height);
    const stats = photoStats(gray);
    const verdict = judgeSky(stats, stars, aim ? { minStars: 1 } : {});
    note('stars searched', { size: `${width}x${height}`, median: stats.median, white: stats.white, stars: stars.length, ms: Math.round(performance.now() - searching) });
    if (stars.length) {
        // Enough to run the search again away from the phone: the brightest 60 spots'
        // places, peaks and sizes. Positions in a picture only; no picture.
        note('stars found (x,y,peak,size)', { spots: [...stars].sort((a, b) => b.peak - a.peak).slice(0, 60).map((st) => `${st.x.toFixed(1)},${st.y.toFixed(1)},${Math.round(st.peak)},${Math.round(st.size)}`) });
    }
    if (aim) note('aimed', { jd: jd.toFixed(6), focalPx: aim.f0.toFixed(1), turn: aim.R0.map((v) => v.toFixed(5)) });
    else note('time', { jd: jd.toFixed(6), lens35mm: mm35 });
    note('verdict', { ok: verdict.ok, reason: verdict.reason });
    ring(ctx, stars, verdict.ok ? '#7fd3ff' : '#ffb04d', width);
    canvas.hidden = false;
    // A daytime picture needs no lens advice; every other failure gets it when it fits.
    const tip = (text) => [text, lensTip(mm35)].filter(Boolean).join(' ');
    if (!verdict.ok) {
        const found = `(${plural(stars.length, 'star')} found.)`;
        if (verdict.reason === 'bright') say(`${aim ? NOT_SKY.glare : verdict.message} ${found}`);
        else say(tip(`${verdict.message} ${found}`));
        return;
    }
    say(`${plural(stars.length, 'star')} found. Working out which part of the sky this is…`);
    worker.onmessage = ({ data }) => {
        if (ask !== asked) return;
        note('matching', {
            solved: data.solved, route: data.route, ms: data.ms, gaveUp: data.gaveUp, confidence: data.confidence,
            matched: data.matches?.length, fieldDeg: data.fov && [data.fov.width, data.fov.height],
            fitPx: data.rmsPixels, compassOffByDeg: data.offBy, lensVsGuess: data.lensVsGuess,
        });
        if (data.matches) {
            note('named (name@x,y)', { stars: data.matches.map((m) => `${m.name}@${m.x.toFixed(1)},${m.y.toFixed(1)}`) });
            note('answer', { focalPx: data.f.toFixed(1), turn: data.R.map((v) => v.toFixed(5)) });
        }
        if (!data.solved) {
            say(tip(data.gaveUp ? NOT_SKY.slow : NOT_SKY.unmatched));
            return;
        }
        ctx.putImageData(photo, 0, 0);
        ring(ctx, stars, 'rgba(127, 211, 255, 0.45)', width);
        label(ctx, data.matches, width, data.confidence === 'guess');
        if (aim && data.confidence === 'sure') rememberLens(data.f, width, height);
        const unsure = data.confidence === 'guess';
        const list = namedList(data.matches, unsure);
        if (data.confidence === 'sure') {
            say(`Named ${plural(data.matches.length, 'star')}: ${list}.`);
        } else if (data.confidence === 'likely') {
            say(`Probably ${list}, with help from your phone's compass. With so few stars, it's worth checking one against a sky app.`);
        } else {
            say(`A best guess from your phone's compass: ${list}. It could easily be wrong, hence the question ${data.matches.length === 1 ? 'mark' : 'marks'}.`);
        }
        technical(`${plural(data.matches.length, 'star')} matched (${data.matches.filter((m) => !/^HIP /.test(m.name)).length} with names, `
            + `${data.confidence}), in a field ${data.fov.width.toFixed(0)}° × ${data.fov.height.toFixed(0)}° `
            + `centred at RA ${data.centre.ra.toFixed(1)}°, Dec ${data.centre.dec.toFixed(1)}°. `
            + `${(data.ms / 1000).toFixed(1)} s, fit to ${data.rmsPixels.toFixed(1)} px.`);
        if (phone) status.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
    worker.onerror = (e) => {
        note('star search crashed', { message: e.message, where: `${e.filename?.split('/').pop()}:${e.lineno}` });
        if (ask === asked) say('The star search stopped with an error. "Help us calibrate" below sends the details of where.');
    };
    worker.postMessage({ stars, width, height, jd, mm35, aim });
}

/* The named stars in words, brightest first, at most LIST_NAMES of them (a rich photo
   names seventy, a wall of text on a phone; the photo shows every name); catalogue numbers
   only counted, since "HIP 26199" tells a visitor nothing. */
const LIST_NAMES = 8;
function namedList(matches, unsure) {
    const mark = unsure ? '?' : '';
    const names = [...matches].sort((a, b) => a.mag - b.mag).filter((m) => !/^HIP /.test(m.name)).map((m) => `${m.name}${mark}`);
    if (!names.length) return `${matches.length === 1 ? 'a faint catalogue star' : `${matches.length} faint catalogue stars`}${mark}`;
    const shown = names.slice(0, LIST_NAMES);
    const rest = matches.length - shown.length;
    if (rest) return `${shown.join(', ')}, and ${rest} ${shown.length < names.length ? 'more' : `fainter ${rest === 1 ? 'one' : 'ones'}`}`;
    return shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}`;
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

let stream = null, reading = null, place = null, compassSeen = false, sensorEvents = {};
let samples = [], wakeLock = null, gaugesDue = false;

/* The phone's orientation, from north. Chrome on Android sends deviceorientationabsolute;
   Safari sends deviceorientation with webkitCompassHeading (clockwise from north, so
   alpha, which counts the other way, is 360 less it). A plain deviceorientation without
   either is from wherever the phone started, which is no use here. */
function onOrientation(e) {
    sensorEvents[e.type] = (sensorEvents[e.type] ?? 0) + 1;
    if (sensorEvents[e.type] === 1) {
        note(`first ${e.type}`, {
            absolute: e.absolute, alpha: e.alpha, beta: e.beta, gamma: e.gamma,
            compassHeading: e.webkitCompassHeading, compassAccuracy: e.webkitCompassAccuracy,
        });
    }
    if (e.alpha == null || e.beta == null || e.gamma == null) return;
    if (e.type === 'deviceorientationabsolute' || e.absolute) {
        compassSeen = true;
        reading = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
    } else if (typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0) {
        compassSeen = true;
        reading = { alpha: (360 - e.webkitCompassHeading) % 360, beta: e.beta, gamma: e.gamma };
    } else return;
    const t = performance.now();
    samples.push({ t, ...reading });
    while (samples.length && samples[0].t < t - 2000) samples.shift();
    if (!gaugesDue) { gaugesDue = true; requestAnimationFrame(showGauges); }
}

/* Over the camera's view: how high it points (and which way to tilt), and how still the
   phone is (js/skyaim.js turnRate, steadiness). */
const STEADY_WORDS = { still: 'Steady', nearly: 'Nearly steady', moving: 'Hold still' };
function showGauges() {
    gaugesDue = false;
    if (!stream || !reading) return;
    const altitude = cameraAltitude(reading.beta, reading.gamma);
    tiltGauge.textContent = altitude < MIN_ALTITUDE ? `Tilt up ${Math.ceil(MIN_ALTITUDE - altitude)}°` : `Aimed ${Math.round(altitude)}° up`;
    tiltGauge.dataset.state = altitude < MIN_ALTITUDE ? 'warn' : 'ok';
    const state = steadiness(turnRate(samples, performance.now()));
    steadyGauge.textContent = state ? STEADY_WORDS[state] : '';
    steadyGauge.dataset.state = state === 'still' ? 'ok' : 'warn';
}

aimButton.addEventListener('click', async () => {
    ++asked;
    stopLive();
    begin('aim and shoot');
    reading = null; place = null; compassSeen = false; sensorEvents = {}; samples = [];
    canvas.hidden = true;
    if (phone) {
        // The camera screen at once, inside the tap (a browser allows full screen only
        // then); it shows the questions' progress until the camera starts.
        live.hidden = false;
        document.documentElement.classList.add('skyphoto-shooting');
        live.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => { /* the fixed layer covers the page anyway */ });
    }
    say('Asking for your camera, compass and location…');
    try {
        // Safari asks for the motion sensors on a tap, before anything else waits.
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            const answer = await DeviceOrientationEvent.requestPermission();
            note('motion sensors asked', { answer });
            if (answer !== 'granted') throw new Error('compass');
        }
        window.addEventListener('deviceorientationabsolute', onOrientation);
        window.addEventListener('deviceorientation', onOrientation);
        const where = new Promise((done, fail) => navigator.geolocation
            ? navigator.geolocation.getCurrentPosition(done, (e) => {
                note('location refused or failed', { code: e.code, message: e.message });
                fail(new Error('location'));
            }, { maximumAge: 3600000, timeout: 20000 })
            : fail(new Error('location')));
        stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 4096 }, height: { ideal: 3072 } },
        });
        const track = stream.getVideoTracks()[0];
        // The browser can take the camera away (another app, the phone saving power).
        track.addEventListener('mute', () => note('camera paused by the phone'));
        track.addEventListener('unmute', () => note('camera resumed'));
        track.addEventListener('ended', () => note('camera stopped by the phone'));
        note('camera opened', { label: track.label, ...cameraFigures(track.getSettings?.()) });
        await brighten(track);
        video.srcObject = stream;
        await video.play();
        note('preview playing', { video: `${video.videoWidth}x${video.videoHeight}` });
        live.hidden = false;
        watch();
        level();
        keepAwake();
        const fix = await where;
        place = fix.coords;
        // Kept on this phone, so night mode knows its dusk next time (rubin/night.js).
        window.skyNight?.rememberPlace(place.latitude, place.longitude);
        window.skyNight?.apply(window.skyNight.current());
        showNight();
        // Never the place itself: to 0.1 degree (about 11 km) is all a re-run needs, well
        // inside what the compass leaves (owner, 2026-11-24).
        note('location', { latitude: place.latitude.toFixed(1), longitude: place.longitude.toFixed(1), accuracyM: Math.round(place.accuracy), ageS: Math.round((Date.now() - fix.timestamp) / 1000) });
        say(phone ? 'Point at the sky, hold still (leaning on something helps), then Shoot.'
            : 'Point at the sky and hold the phone very still (leaning it on something helps), then press Shoot.');
        setTimeout(() => {
            if (stream && !compassSeen) {
                note('no compass after 2 s', { events: sensorEvents });
                say("This phone isn't sharing its compass with the page, so aiming can't help. You can still choose a photo instead.");
            }
        }, 2000);
    } catch (error) {
        note('could not start', failed(error));
        stopLive();
        const why = { compass: 'the motion sensors', location: 'your location' }[error.message] ?? 'the camera';
        say(`Aim and shoot needs ${why}, and couldn't get it. You can still choose a photo instead. (${error.message})`);
    }
});

/* The screen kept on while the camera is up, so it cannot dim or lock partway through a
   shot (the page hidden stops the camera). Asked for again if the page comes back. */
async function keepAwake() {
    if (!navigator.wakeLock || wakeLock) return;
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
        note('screen kept on');
    } catch (error) {
        note('screen could not be kept on', failed(error));
    }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && stream) keepAwake(); });

/* A longer exposure and the highest sensitivity the camera lets a page set, where it lets
   one at all (Chrome on Android, for some cameras). Anything refused is left as it was.
   The exposure is held to MAX_EXPOSURE (exposureTime counts 100 microseconds): a camera's
   own maximum can be seconds a frame: the likely cause of a shot that never finished, and
   a preview gone white, on the owner's phone (NOTES.md, "Aim and shoot"). */
const MAX_EXPOSURE = 2500;
const MIN_ALTITUDE = 10;
let camCaps = {};
async function brighten(track) {
    const caps = track.getCapabilities?.() ?? {};
    camCaps = caps;
    const want = {};
    if (caps.exposureMode?.includes('manual') && caps.exposureTime) {
        want.exposureMode = 'manual';
        want.exposureTime = Math.max(caps.exposureTime.min ?? 0, Math.min(caps.exposureTime.max, MAX_EXPOSURE));
    }
    if (caps.iso) want.iso = caps.iso.max;
    note('camera can do', cameraFigures(caps));
    if (!Object.keys(want).length) { note('camera settings: none a page can set'); return; }
    note('camera asked for', want);
    try { await track.applyConstraints({ advanced: [want] }); } catch (error) { note('camera refused', failed(error)); }
    note('camera settings now', cameraFigures(track.getSettings?.()));
}

/* While aiming, the exposure follows the preview (js/skyphoto.js nextExposure): down from
   the top when the sky or the scene reads too bright, back up when too dark. Every
   LEVEL_MS, so a step has had a few frames to take hold; held still during the shot. Only
   where the camera lets a page set ISO and exposure (Chrome on Android, some cameras). */
const LEVEL_MS = 900;
let levelTimer = null;
let levelling = false;
function level() {
    if (!camCaps.iso || !camCaps.exposureTime || !camCaps.exposureMode?.includes('manual')) return;
    const small = document.createElement('canvas');
    small.width = 64;
    small.height = 48;
    const sctx = small.getContext('2d', { willReadFrequently: true });
    const step = async () => {
        if (!stream) return;
        if (!levelling) {
            const track = stream.getVideoTracks()[0];
            const s = track?.getSettings?.() ?? {};
            sctx.drawImage(video, 0, 0, 64, 48);
            const median = photoStats(toGray(sctx.getImageData(0, 0, 64, 48).data, 64, 48)).median;
            const next = s.iso && s.exposureTime ? nextExposure({ median, iso: s.iso, exposureTime: s.exposureTime }, camCaps, MAX_EXPOSURE) : null;
            if (next) {
                try {
                    await track.applyConstraints({ advanced: [{ exposureMode: 'manual', ...next }] });
                    note('exposure set', { median, ...next });
                } catch (error) {
                    note('exposure refused', { median, ...next, ...failed(error) });
                }
            }
        }
        if (stream) levelTimer = setTimeout(step, LEVEL_MS);
    };
    levelTimer = setTimeout(step, LEVEL_MS);
}

/* The camera figures worth knowing, out of the many a browser may list. */
const CAMERA_KEYS = ['width', 'height', 'frameRate', 'resizeMode', 'exposureMode', 'exposureTime', 'exposureCompensation',
    'iso', 'focusMode', 'focusDistance', 'whiteBalanceMode', 'colorTemperature', 'zoom'];
function cameraFigures(figures) {
    return Object.fromEntries(CAMERA_KEYS.filter((k) => figures?.[k] !== undefined).map((k) => [k, figures[k]]));
}

/* While the preview is up: its brightness, the camera's exposure and the phone's aim,
   every 2 s for a minute, then every 10 s (a preview drifting white shows here). */
let watchTimer = null;
function watch() {
    const small = document.createElement('canvas');
    small.width = 64;
    small.height = 48;
    const sctx = small.getContext('2d', { willReadFrequently: true });
    let looks = 0;
    const look = () => {
        if (!stream) return;
        const s = stream.getVideoTracks()[0]?.getSettings?.() ?? {};
        sctx.drawImage(video, 0, 0, 64, 48);
        note('preview', { brightness: meanBrightness(sctx.getImageData(0, 0, 64, 48).data, 1), exposureTime: s.exposureTime, iso: s.iso, frameRate: s.frameRate, ...aimFigures() });
        watchTimer = setTimeout(look, ++looks < 30 ? 2000 : 10000);
    };
    watchTimer = setTimeout(look, 500);
}
function aimFigures() {
    if (!reading) return { compass: 'none yet' };
    return { alpha: reading.alpha, beta: reading.beta, gamma: reading.gamma, altitude: cameraAltitude(reading.beta, reading.gamma) };
}

shootButton.addEventListener('click', async () => {
    if (!stream || !reading || !place) {
        note('shoot pressed too early', { compass: Boolean(reading), location: Boolean(place), events: sensorEvents });
        say(!reading ? "Still waiting for the phone's compass…" : 'Still waiting for your location…');
        return;
    }
    const altitude = cameraAltitude(reading.beta, reading.gamma);
    note('shoot pressed', { ...aimFigures(), turnRateDegS: turnRate(samples, performance.now()), events: sensorEvents });
    if (altitude < MIN_ALTITUDE) {
        note('not taken: pointing too low');
        say(altitude < 0
            ? `The camera is pointing ${Math.round(-altitude)}° below the horizon. Tilt the phone up toward the sky, then press Shoot.`
            : 'The camera is pointing at the horizon, where buildings, trees and haze hide the stars. Tilt the phone up a little more, then press Shoot.');
        return;
    }
    const ask = ++asked;
    shootButton.disabled = true;
    clearTimeout(watchTimer);
    // The exposure is held as it is for the shot.
    levelling = true;
    clearTimeout(levelTimer);
    say('Hold still…');
    try {
        const { photo, R0, f0, jd } = await stack();
        // Done: a short buzz, so the shot need not be watched (Android; iPhones have none).
        navigator.vibrate?.(60);
        stopLive();
        canvas.width = photo.width;
        canvas.height = photo.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.putImageData(photo, 0, 0);
        say('Looking for stars…');
        await analyse({ ask, ctx, photo, jd, aim: { R0, f0 } });
    } catch (error) {
        note('shot failed', failed(error));
        stopLive();
        say(`The shot didn't work. (${error.message})`);
    } finally {
        shootButton.disabled = false;
        levelling = false;
    }
});
cancelButton.addEventListener('click', () => { note('cancelled'); stopLive(); say(''); });

/* About STACK_MS of the camera's frames averaged into one picture (fainter stars stand
   out of the noise, as in a phone's night mode, though nothing here lines the frames up:
   hence holding still), and the sensors' readings over the same time. */
const STACK_MS = 1200;
const STACK_GIVE_UP = 6000;
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
    // A frame that never comes (a stalled camera) must not hold the shot for ever: after
    // STACK_GIVE_UP the frames so far are used, and with none the shot fails and says so.
    // The frame's metadata where the browser gives it (presentedFrames counts every frame
    // shown, so a jump of more than one is frames missed while one was being added).
    const nextFrame = (wait) => new Promise((done) => {
        const timer = setTimeout(() => done(null), Math.max(0, wait));
        const got = (_, meta) => { clearTimeout(timer); done(meta ?? {}); };
        if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(got); else requestAnimationFrame(got);
    });
    note('stacking', { size: `${width}x${height}`, from: `${video.videoWidth}x${video.videoHeight}`, screenAngle });
    let last = started;
    do {
        const meta = await nextFrame(started + STACK_GIVE_UP - performance.now());
        if (!meta) { note('gave up waiting for frames', { waitedMs: Math.round(performance.now() - started) }); break; }
        sctx.drawImage(video, 0, 0, width, height);
        const data = sctx.getImageData(0, 0, width, height).data;
        for (let i = 0; i < data.length; i++) sum[i] += data[i];
        turns.push(aimedTurn({ ...reading, screenAngle, jd, lat: place.latitude, lon: place.longitude }));
        frames++;
        const t = performance.now();
        note('frame', { n: frames, gapMs: Math.round(t - last), shown: meta.presentedFrames, brightness: meanBrightness(data), alpha: reading.alpha, beta: reading.beta, gamma: reading.gamma });
        last = t;
        say(`Hold still… (${plural(frames, 'frame')})`);
    } while ((performance.now() - started < STACK_MS || frames < 2) && frames < 250);
    const now = stream?.getVideoTracks()[0]?.getSettings?.() ?? {};
    note('stacked', { frames, ms: Math.round(performance.now() - started), exposureTime: now.exposureTime, iso: now.iso, turnRateDegS: turnRate(samples, performance.now()) });
    if (!frames) throw new Error("the camera sent no pictures; try Aim and shoot again");
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
    const f = measured ? measured * long : 26 * long * 1.25 / 43.27;
    note('lens guess', { focalPx: f, from: measured ? 'an earlier sure match' : '26 mm' });
    return f;
}
function rememberLens(f, width, height) {
    note('lens remembered', { focalPx: f });
    try { localStorage.setItem(LENS_KEY, String(f / Math.max(width, height))); } catch { /* private mode */ }
}

function stopLive() {
    if (stream) note('camera closed');
    clearTimeout(watchTimer);
    clearTimeout(levelTimer);
    document.documentElement.classList.remove('skyphoto-shooting');
    if (document.fullscreenElement === live) document.exitFullscreen?.().catch(() => { /* already out */ });
    wakeLock?.release().catch(() => { /* already released */ });
    wakeLock = null;
    tiltGauge.textContent = '';
    steadyGauge.textContent = '';
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    live.hidden = true;
    window.removeEventListener('deviceorientationabsolute', onOrientation);
    window.removeEventListener('deviceorientation', onOrientation);
}
