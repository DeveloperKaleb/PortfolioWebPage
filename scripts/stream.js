/* Draws the homepage's margins (js/stream.js): the mountain stream down the left and the
 * forest floor down the right.
 *
 * Both canvases have one pixel per cell and are scaled up by BLOCK with
 * image-rendering: pixelated, which gives the chunky look. They are as tall as the page
 * and sit in #landscape, which scrolls with it, so scrolling down is travelling down the
 * stream - done by the browser, with nothing redrawn on scroll. They stay hidden when the
 * margins are too narrow, which covers phones, where the column takes the whole width.
 */
import { createStream, createForestFloor, renderFrame, MIN_COLS, BLOCK } from '/PortfolioWebPage/js/stream.js';

const FPS = 12;

const landscape = document.getElementById('landscape');
const streamCanvas = document.getElementById('stream');
const forestCanvas = document.getElementById('forest');
const streamContext = streamCanvas.getContext('2d');
const forestContext = forestCanvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let stream = null;
let image = null;
let frameHandle = 0;
let lastDraw = -Infinity;
let fitted = '';

/* Only the rows on screen, plus one either side for rows sliding in between frames. */
function visibleRows() {
    const top = Math.floor(window.scrollY / BLOCK) - 1;
    return [top, top + Math.ceil(window.innerHeight / BLOCK) + 2];
}

function draw(seconds, [from, to] = [0, stream.rows]) {
    renderFrame(stream, seconds, image.data, from, to);
    const top = Math.max(0, from);
    const height = Math.min(stream.rows, to) - top;
    if (height > 0) streamContext.putImageData(image, 0, 0, 0, top, stream.cols, height);
}

/* requestAnimationFrame already stops in a background tab, so there is no separate
   visibility handling. */
function tick(now) {
    frameHandle = requestAnimationFrame(tick);
    if (now - lastDraw < 1000 / FPS) return;
    lastDraw = now;
    draw(now / 1000, visibleRows());
}

function stop() {
    cancelAnimationFrame(frameHandle);
    frameHandle = 0;
}

function start() {
    stop();
    if (!stream) return;
    /* The whole stream once, so rows scrolled into view before the next frame are
       never blank; after that only what is on screen. */
    draw(performance.now() / 1000);
    if (!reducedMotion.matches) frameHandle = requestAnimationFrame(tick);
}

function place(canvas, left, cols, rows) {
    canvas.width = cols;
    canvas.height = rows;
    canvas.style.left = `${left}px`;
    canvas.style.width = `${cols * BLOCK}px`;
    canvas.style.height = `${rows * BLOCK}px`;
}

function fit() {
    /* The page column's edges give both margins, scrollbar already accounted for. The
       body is the whole page top to bottom (it has no margin and a min-height of the
       viewport), so its height is how far the stream runs. */
    const column = document.body.getBoundingClientRect();
    const gutter = column.left;
    const height = column.height;
    const cols = Math.ceil(gutter / BLOCK);
    const rows = Math.ceil(height / BLOCK);

    /* Exactly the page's height and clipped to it. The canvases round up to a whole
       block; unclipped, that would lengthen the page, which would refit, and grow again. */
    landscape.style.height = `${height}px`;

    if (cols < MIN_COLS) {
        stop();
        stream = null;
        fitted = '';
        landscape.hidden = true;
        return;
    }

    /* A whole number of blocks, flush against the page column on each side; any
       part-block spills off the screen edge rather than being stretched to fit. */
    const streamLeft = gutter - cols * BLOCK;
    streamCanvas.style.left = `${streamLeft}px`;
    forestCanvas.style.left = `${column.right}px`;

    const key = `${cols} ${rows} ${Math.round(column.right - streamLeft)}`;
    if (key === fitted) return;
    fitted = key;

    stream = createStream({ cols, rows });
    image = streamContext.createImageData(cols, rows);
    place(streamCanvas, streamLeft, cols, rows);

    const forestCols = Math.ceil((window.innerWidth - column.right) / BLOCK);
    const forest = createForestFloor(stream, { cols: forestCols, offset: column.right - streamLeft });
    place(forestCanvas, column.right, forestCols, rows);
    forestContext.putImageData(new ImageData(forest.pixels, forestCols, rows), 0, 0);

    landscape.hidden = false;
    start();
}

let pending = 0;
const refit = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(fit);
};
window.addEventListener('resize', refit);
/* The page changes height after load - the photo arriving, mostly - and the stream has
   to run the full length of it. */
new ResizeObserver(refit).observe(document.body);
reducedMotion.addEventListener('change', start);
fit();
