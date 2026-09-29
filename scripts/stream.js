/* Draws the mountain stream (js/stream.js) into the homepage's left margin.
 *
 * The canvas has one pixel per cell and is scaled up by BLOCK with image-rendering:
 * pixelated, which gives the chunky look. It is sized to the gutter between the screen
 * edge and the page column, and stays hidden when that gutter is too narrow for a
 * stream - which covers phones, where the column takes the whole width.
 */
import { createStream, renderFrame, MIN_COLS } from '/PortfolioWebPage/js/stream.js';

const BLOCK = 6;
const FPS = 12;

const canvas = document.getElementById('stream');
const context = canvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let stream = null;
let image = null;
let frameHandle = 0;
let lastDraw = -Infinity;

function draw(seconds) {
    renderFrame(stream, seconds, image.data);
    context.putImageData(image, 0, 0);
}

/* requestAnimationFrame already stops in a background tab, so there is no separate
   visibility handling. */
function tick(now) {
    frameHandle = requestAnimationFrame(tick);
    if (now - lastDraw < 1000 / FPS) return;
    lastDraw = now;
    draw(now / 1000);
}

function stop() {
    cancelAnimationFrame(frameHandle);
    frameHandle = 0;
}

function start() {
    stop();
    if (!stream) return;
    if (reducedMotion.matches) draw(0);
    else frameHandle = requestAnimationFrame(tick);
}

function fit() {
    /* The page column's left edge is the gutter's width, scrollbar already accounted for. */
    const gutter = document.body.getBoundingClientRect().left;
    const cols = Math.ceil(gutter / BLOCK);
    const rows = Math.ceil(window.innerHeight / BLOCK);

    if (cols < MIN_COLS) {
        stop();
        stream = null;
        canvas.hidden = true;
        return;
    }
    /* A whole number of blocks, flush against the page column; any part-block spills
       off the left edge of the screen rather than being stretched to fit. */
    canvas.style.left = `${gutter - cols * BLOCK}px`;
    if (stream && stream.cols === cols && stream.rows === rows) return;

    stream = createStream({ cols, rows });
    canvas.width = cols;
    canvas.height = rows;
    image = context.createImageData(cols, rows);
    canvas.style.width = `${cols * BLOCK}px`;
    canvas.style.height = `${rows * BLOCK}px`;
    canvas.hidden = false;
    start();
}

let pending = 0;
window.addEventListener('resize', () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(fit);
});
reducedMotion.addEventListener('change', start);
fit();
