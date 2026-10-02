/* Draws the page margins (js/stream.js) on Home and Entertainment: the mountain stream
 * down the left, and the forest floor down the right with the glacial tributary crossing
 * it near the top. Both have moving water, so both are animated.
 *
 * Both canvases have one pixel per cell and are scaled up by BLOCK with
 * image-rendering: pixelated, which gives the chunky look. They are as tall as the page
 * and sit in #landscape, which scrolls with it, so scrolling down is travelling down the
 * stream - done by the browser, with nothing redrawn on scroll. They stay hidden when the
 * margins are too narrow, which covers phones, where the column takes the whole width.
 */
import { createStream, createForestFloor, renderFrame, MIN_COLS, BLOCK } from '/PortfolioWebPage/js/stream.js';

const FPS = 12;

/* Rows built at a time: 500 rows is 3,000px of page. See fit(). */
const BUILD_CHUNK_ROWS = 500;

/* The water runs on the wall clock, not on how long this page has been open, so moving
   between Home and Entertainment picks the ripples up where they were rather than
   restarting them. Wrapped daily to keep the numbers small; a day is a whole number of
   flow cycles, so the wrap is one frame's jump at midnight UTC. */
const clock = () => (Date.now() % 86400000) / 1000;

const landscape = document.getElementById('landscape');
const streamCanvas = document.getElementById('stream');
const forestCanvas = document.getElementById('forest');
const streamContext = streamCanvas.getContext('2d');
const forestContext = forestCanvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/* The two margins, each a grid from js/stream.js with the canvas it draws into. */
let layers = [];
let frameHandle = 0;
let lastDraw = -Infinity;
let fitted = '';

/* Only the rows on screen, plus one either side for rows sliding in between frames. */
function visibleRows() {
    const top = Math.floor(window.scrollY / BLOCK) - 1;
    return [top, top + Math.ceil(window.innerHeight / BLOCK) + 2];
}

function draw(seconds, [from, to] = [0, Infinity]) {
    for (const { grid, context, image } of layers) {
        renderFrame(grid, seconds, image.data, from, to);
        const top = Math.max(0, from);
        const height = Math.min(grid.rows, to) - top;
        if (height > 0) context.putImageData(image, 0, 0, 0, top, grid.cols, height);
    }
}

/* requestAnimationFrame already stops in a background tab, so there is no separate
   visibility handling. */
function tick(now) {
    frameHandle = requestAnimationFrame(tick);
    if (now - lastDraw < 1000 / FPS) return;
    lastDraw = now;
    draw(clock(), visibleRows());
}

function stop() {
    cancelAnimationFrame(frameHandle);
    frameHandle = 0;
}

function start() {
    stop();
    if (!layers.length) return;
    /* The whole of both once, so rows scrolled into view before the next frame are
       never blank; after that only what is on screen. */
    draw(clock());
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
        layers = [];
        fitted = '';
        landscape.hidden = true;
        return;
    }

    /* A whole number of blocks, flush against the page column on each side; any
       part-block spills off the screen edge rather than being stretched to fit. */
    const streamLeft = gutter - cols * BLOCK;
    streamCanvas.style.left = `${streamLeft}px`;
    forestCanvas.style.left = `${column.right}px`;

    /* Built in chunks, with spare length below, and never shrunk. A page whose height
       changes on every click (the Rubin tab's cards) would otherwise rebuild the whole
       landscape each time: about 250 ms at 7,000px and over a second at 45,000px. No row
       depends on how many there are (js/stream.js), so a longer build is the same picture
       with more below; a shorter page just clips it, as #landscape already does. Only
       growing past the spare, or a change of width, rebuilds. */
    const width = `${cols} ${Math.round(column.right - streamLeft)}`;
    if (width === fitted && layers.length && layers[0].grid.rows >= rows) return;
    fitted = width;
    const built = Math.ceil(rows / BUILD_CHUNK_ROWS) * BUILD_CHUNK_ROWS;

    const stream = createStream({ cols, rows: built });
    place(streamCanvas, streamLeft, cols, built);

    const forestCols = Math.ceil((window.innerWidth - column.right) / BLOCK);
    const forest = createForestFloor(stream, { cols: forestCols, offset: column.right - streamLeft });
    place(forestCanvas, column.right, forestCols, built);

    layers = [
        { grid: stream, context: streamContext, image: streamContext.createImageData(cols, built) },
        { grid: forest, context: forestContext, image: forestContext.createImageData(forestCols, built) },
    ];

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
