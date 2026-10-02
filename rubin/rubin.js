/* The Rubin tab: reads the latest digest from the rubin-data repo and puts it on the
 * page - the cards, the map and the chart. What to show and the geometry are worked out
 * in js/rubinview.js; this file only builds the DOM.
 *
 * Data from the digest goes in with textContent, never innerHTML. Every chart mark has a
 * hit target of at least 24px and the same details on keyboard focus as on hover, and
 * every chart has a table view beside it. Colours are RUBIN_COLORS (js/logic.js), held
 * to the site's contrast rules by tests/contrast.
 *
 * Offline, or if the data repo cannot be reached, it shows the last digest this browser
 * saw, and says so.
 */
import {
    DIGEST_URL, CHANGES_URL, LARGE_IF_DARK_SHOWN, summary, sections, displayName, sizeOf, flagsOf,
    whyWatched, changeText, chartData, mapData, percent, kilometres, au, longDate, CHART_RANGE, discoveryText,
    rubinStatus, crossCheckText, offsetText,
} from '../js/rubinview.js';
import { RUBIN_COLORS as C } from '../js/logic.js';

const SVG = 'http://www.w3.org/2000/svg';
const CACHE_KEY = 'rubin-digest';
const tooltip = document.getElementById('rubin-tooltip');

/* ---- Small DOM helpers ----------------------------------------------------------- */

function el(tag, attrs = {}, text) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== undefined) node.textContent = text;
    return node;
}

function svg(tag, attrs = {}, text) {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== undefined) node.textContent = text;
    return node;
}

/* One tooltip for the page: the value leads, the name follows. */
function showTooltip(rows, x, y) {
    tooltip.replaceChildren(...rows.map(([strong, rest, color]) => {
        const row = el('div', { class: 'rubin-tooltip-row' });
        if (color) row.append(el('span', { class: 'rubin-key', style: `background:${color}` }));
        row.append(el('strong', {}, strong));
        if (rest) row.append(el('span', {}, ` ${rest}`));
        return row;
    }));
    tooltip.hidden = false;
    const { innerWidth } = window;
    const width = tooltip.offsetWidth;
    tooltip.style.left = `${Math.min(Math.max(8, x + 14), innerWidth - width - 8)}px`;
    tooltip.style.top = `${y + 14}px`;
}
const hideTooltip = () => { tooltip.hidden = true; };

/* Hover and focus show the same details; a mark can be reached by keyboard. */
function attachDetails(target, rows) {
    target.setAttribute('tabindex', '0');
    target.setAttribute('role', 'img');
    target.setAttribute('aria-label', rows.map((r) => `${r[0]} ${r[1] ?? ''}`.trim()).join('; '));
    target.addEventListener('pointermove', (e) => showTooltip(rows, e.clientX, e.clientY));
    target.addEventListener('pointerleave', hideTooltip);
    target.addEventListener('focus', () => {
        const box = target.getBoundingClientRect();
        showTooltip(rows, box.right, box.top);
    });
    target.addEventListener('blur', hideTooltip);
}

function table(headers, rows) {
    const t = el('table', { class: 'rubin-table' });
    const head = el('tr');
    headers.forEach((h) => head.append(el('th', { scope: 'col' }, h)));
    t.append(el('thead'));
    t.tHead.append(head);
    const body = el('tbody');
    rows.forEach((cells) => {
        const tr = el('tr');
        cells.forEach((c) => tr.append(el('td', {}, c)));
        body.append(tr);
    });
    t.append(body);
    return t;
}

/* ---- Cards ------------------------------------------------------------------------- */

function card(entry, { extra } = {}) {
    const box = el('article', { class: 'rubin-card' });
    box.append(el('h4', {}, displayName(entry)));
    const status = rubinStatus(entry);
    box.append(el('p', { class: status.confirmed ? 'rubin-confirmed' : 'rubin-unconfirmed' }, status.text));
    if (extra) box.append(el('p', { class: 'rubin-why' }, extra));

    const size = sizeOf(entry);
    const facts = el('dl', { class: 'rubin-facts' });
    const fact = (term, value) => { facts.append(el('dt', {}, term), el('dd', {}, value)); };
    fact('Size', `${size.text}${size.measured ? ' (measured)' : ' (from brightness)'}`);
    fact('Chance', entry.passes || !entry.flags.includes('largeIfDark')
        ? `${percent(entry.chance)} · ${percent(entry.chanceGrundy)} on Grundy's reading`
        : `${percent(entry.chance)} as typical · ${percent(entry.chanceIfDark)} if dark`);
    fact('Now', `${au(entry.now.r)} from the Sun · magnitude ${entry.now.V.toFixed(1)} · ${entry.now.detectable ? 'within one Rubin exposure' : 'too faint for one Rubin exposure'}`);
    const found = discoveryText(entry);
    if (found) fact('Found', found);
    const checked = crossCheckText(entry);
    if (checked) fact('Checked', checked);
    fact('Brightness', entry.hSource.startsWith('Rubin')
        ? `from Rubin's own detections (${entry.detections})`
        : 'from the catalogue (JPL)');
    box.append(facts);

    const flags = flagsOf(entry);
    if (flags.length) {
        const row = el('div', { class: 'rubin-flags' });
        const explain = el('p', { class: 'rubin-flag-means', hidden: '' });
        flags.forEach((f) => {
            const chip = el('button', { type: 'button', class: `rubin-flag rubin-flag-${f.kind}`, 'aria-expanded': 'false' }, f.label);
            chip.addEventListener('click', () => {
                const open = explain.hidden || explain.dataset.flag !== f.name;
                row.querySelectorAll('.rubin-flag').forEach((c) => c.setAttribute('aria-expanded', 'false'));
                explain.hidden = !open;
                explain.dataset.flag = f.name;
                explain.textContent = open ? f.means : '';
                chip.setAttribute('aria-expanded', String(open));
            });
            row.append(chip);
        });
        box.append(row, explain);
    }
    return box;
}

function fillCards(sectionId, entries, options) {
    const section = document.getElementById(sectionId);
    const holder = section.querySelector('.rubin-cards');
    holder.replaceChildren(...entries.map((e) => card(e, options?.(e))));
    section.hidden = entries.length === 0;
    return section;
}

/* ---- The map ----------------------------------------------------------------------- */

const MARK_STYLE = {
    passes: { label: 'Passes', color: C.evidence, shape: 'circle', filled: true },
    disputed: { label: 'Passes, disputed', color: C.evidence, shape: 'circle', filled: false },
    watch: { label: 'Worth watching', color: C.watch, shape: 'diamond', filled: true },
};

function mark(style, cx, cy, size = 5) {
    const attrs = style.filled
        ? { fill: style.color, stroke: C.surface, 'stroke-width': 2 }
        : { fill: C.surface, stroke: style.color, 'stroke-width': 2 };
    if (style.shape === 'diamond') {
        const d = size * 1.35;
        return svg('path', { d: `M${cx},${cy - d}L${cx + d},${cy}L${cx},${cy + d}L${cx - d},${cy}Z`, ...attrs });
    }
    return svg('circle', { cx, cy, r: size, ...attrs });
}

function legend(items) {
    const box = el('div', { class: 'rubin-legend' });
    items.forEach(({ label, swatch }) => {
        const item = el('span', { class: 'rubin-legend-item' });
        const key = svg('svg', { width: 22, height: 14, viewBox: '0 0 22 14', 'aria-hidden': 'true' });
        key.append(swatch);
        item.append(key, document.createTextNode(label));
        box.append(item);
    });
    return box;
}

function drawMap(digest) {
    const section = document.getElementById('rubin-map');
    const { marks, radius, rings, planets } = mapData(digest);
    if (!marks.length) { section.hidden = true; return; }
    const size = 440, centre = size / 2, scale = (size / 2 - 24) / radius;
    const plot = svg('svg', { viewBox: `0 0 ${size} ${size}`, class: 'rubin-svg', role: 'group', 'aria-label': 'Map of the listed objects around the Sun, seen from above' });

    rings.forEach((r) => {
        plot.append(svg('circle', { cx: centre, cy: centre, r: r * scale, fill: 'none', stroke: C.grid, 'stroke-width': 1 }));
        plot.append(svg('text', { x: centre + 4, y: centre - r * scale - 4, class: 'rubin-axis' }, `${r} AU`));
    });
    planets.forEach((p) => plot.append(svg('circle', { cx: centre, cy: centre, r: p.au * scale, fill: 'none', stroke: C.muted, 'stroke-width': 1, opacity: 0.6 })));
    const neptune = planets.at(-1);
    plot.append(svg('text', { x: centre + neptune.au * scale * 0.72 + 4, y: centre + neptune.au * scale * 0.72 + 12, class: 'rubin-axis' }, 'Neptune'));
    plot.append(svg('circle', { cx: centre, cy: centre, r: 4, fill: C.text }));

    marks.forEach(({ entry, kind }) => {
        const x = centre + entry.now.x * scale, y = centre - entry.now.y * scale;
        const g = svg('g', { class: 'rubin-mark' });
        g.append(svg('circle', { cx: x, cy: y, r: 12, fill: 'transparent' }));
        g.append(mark(MARK_STYLE[kind], x, y));
        attachDetails(g, [
            [displayName(entry), MARK_STYLE[kind].label.toLowerCase(), MARK_STYLE[kind].color],
            [au(entry.now.r), 'from the Sun'],
            [sizeOf(entry).text, sizeOf(entry).measured ? 'measured' : 'from brightness'],
        ]);
        plot.append(g);
    });

    const holder = section.querySelector('.rubin-plot');
    const present = [...new Set(marks.map((m) => m.kind))];
    holder.replaceChildren(
        legend(present.map((k) => ({ label: MARK_STYLE[k].label, swatch: mark(MARK_STYLE[k], 11, 7, 4) }))),
        plot,
    );
    section.querySelector('figcaption').textContent =
        'Seen from above the plane of the planets, with the Sun at the centre and distances to scale. The planets\' orbits are the small rings in the middle.';
    section.querySelector('.rubin-table-wrap').replaceChildren(table(
        ['Object', 'Listed as', 'From the Sun', 'Size'],
        marks.map(({ entry, kind }) => [displayName(entry), MARK_STYLE[kind].label, au(entry.now.r), sizeOf(entry).text]),
    ));
    section.hidden = false;
}

/* ---- The chart ----------------------------------------------------------------------- */

function drawChart() {
    const section = document.getElementById('rubin-method');
    const data = chartData();
    const W = 640, H = 340, m = { left: 52, right: 16, top: 16, bottom: 44 };
    const logMin = Math.log10(CHART_RANGE.minKm), logMax = Math.log10(CHART_RANGE.maxKm);
    const x = (km) => m.left + (Math.log10(km) - logMin) / (logMax - logMin) * (W - m.left - m.right);
    const y = (chance) => m.top + (1 - chance) * (H - m.top - m.bottom);
    const plot = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'rubin-svg', role: 'group', 'aria-label': 'Chance of having been shaped by its own gravity, against diameter' });

    [0, 0.25, 0.5, 0.75, 1].forEach((c) => {
        plot.append(svg('line', { x1: m.left, x2: W - m.right, y1: y(c), y2: y(c), stroke: C.grid, 'stroke-width': 1 }));
        plot.append(svg('text', { x: m.left - 8, y: y(c) + 4, 'text-anchor': 'end', class: 'rubin-axis' }, `${c * 100}%`));
    });
    [100, 200, 500, 1000, 2000, 5000].forEach((km) => {
        plot.append(svg('line', { x1: x(km), x2: x(km), y1: H - m.bottom, y2: H - m.bottom + 5, stroke: C.muted, 'stroke-width': 1 }));
        plot.append(svg('text', { x: x(km), y: H - m.bottom + 18, 'text-anchor': 'middle', class: 'rubin-axis' }, km >= 1000 ? `${km / 1000},000` : String(km)));
    });
    plot.append(svg('text', { x: (m.left + W - m.right) / 2, y: H - 6, 'text-anchor': 'middle', class: 'rubin-axis' }, 'Diameter (km, log scale)'));

    /* The 80% line and the two cutoffs, labelled directly. */
    plot.append(svg('line', { x1: m.left, x2: W - m.right, y1: y(0.8), y2: y(0.8), stroke: C.muted, 'stroke-width': 1 }));
    plot.append(svg('text', { x: W - m.right, y: y(0.8) - 6, 'text-anchor': 'end', class: 'rubin-axis' }, '80% - the pass mark'));
    [['evidence', C.evidence], ['grundy', C.grundy]].forEach(([key, color]) => {
        const km = data.cutoffs[key];
        plot.append(svg('line', { x1: x(km), x2: x(km), y1: y(0.8), y2: H - m.bottom, stroke: color, 'stroke-width': 1 }));
        plot.append(svg('text', { x: x(km) + 4, y: H - m.bottom - 8, class: 'rubin-label' }, kilometres(Math.round(km))));
    });

    const path = (points) => points.map((p, k) => `${k ? 'L' : 'M'}${x(p.km).toFixed(1)},${y(p.chance).toFixed(1)}`).join('');
    plot.append(svg('path', { d: path(data.grundy), fill: 'none', stroke: C.grundy, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    plot.append(svg('path', { d: path(data.evidence), fill: 'none', stroke: C.evidence, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

    /* The crosshair finds the diameter: both readings at the pointer. */
    const crosshair = svg('line', { y1: m.top, y2: H - m.bottom, stroke: C.muted, 'stroke-width': 1, visibility: 'hidden' });
    const zone = svg('rect', { x: m.left, y: m.top, width: W - m.left - m.right, height: H - m.top - m.bottom, fill: 'transparent' });
    plot.append(crosshair, zone);
    zone.addEventListener('pointermove', (e) => {
        const box = plot.getBoundingClientRect();
        const px = (e.clientX - box.left) * (W / box.width);
        const km = 10 ** (logMin + (px - m.left) / (W - m.left - m.right) * (logMax - logMin));
        crosshair.setAttribute('x1', px);
        crosshair.setAttribute('x2', px);
        crosshair.setAttribute('visibility', 'visible');
        const at = data.chanceAt(km);
        showTooltip([[kilometres(Math.round(km))], [percent(at.evidence), 'evidence reading', C.evidence], [percent(at.grundy), "Grundy's reading", C.grundy]], e.clientX, e.clientY);
    });
    zone.addEventListener('pointerleave', () => { crosshair.setAttribute('visibility', 'hidden'); hideTooltip(); });

    /* The calibration bodies: rounded ones along the top, irregular along the bottom. */
    data.bodies.forEach((b) => {
        const cy = b.shaped ? y(1) : y(0);
        const g = svg('g', { class: 'rubin-mark' });
        g.append(svg('circle', { cx: x(b.km), cy, r: 12, fill: 'transparent' }));
        g.append(svg('circle', b.shaped
            ? { cx: x(b.km), cy, r: 4, fill: C.text, stroke: C.surface, 'stroke-width': 2 }
            : { cx: x(b.km), cy, r: 4, fill: C.surface, stroke: C.text, 'stroke-width': 2 }));
        attachDetails(g, [[b.name, b.shaped ? 'rounded by gravity' : 'irregular'], [kilometres(b.km)], [b.basis]]);
        plot.append(g);
    });

    const line = (color) => svg('line', { x1: 2, x2: 20, y1: 7, y2: 7, stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round' });
    section.querySelector('.rubin-plot').replaceChildren(
        legend([
            { label: 'Evidence reading', swatch: line(C.evidence) },
            { label: "Grundy's reading", swatch: line(C.grundy) },
            { label: 'Rounded body', swatch: svg('circle', { cx: 11, cy: 7, r: 4, fill: C.text }) },
            { label: 'Irregular body', swatch: svg('circle', { cx: 11, cy: 7, r: 4, fill: C.surface, stroke: C.text, 'stroke-width': 2 }) },
        ]),
        plot,
    );
    section.querySelector('figcaption').textContent =
        `Each dot is an icy body whose shape is known, at its size: rounded ones along the top, irregular ones along the bottom. The blue curve is fitted to them, and crosses 80% at ${kilometres(Math.round(data.cutoffs.evidence))}. The orange curve also counts five low-density mid-sized bodies as never compacted, as Grundy et al. (2019) argue, and crosses 80% at ${kilometres(Math.round(data.cutoffs.grundy))}. ${data.uncertainCount} bodies whose state is unknown are left out.`;
    section.querySelector('.rubin-table-wrap').replaceChildren(table(
        ['Body', 'Diameter', 'Shaped by gravity', 'Evidence'],
        data.bodies.map((b) => [b.name, kilometres(b.km), b.shaped ? 'Yes' : 'No', b.basis]),
    ));
}

/* ---- Loading ------------------------------------------------------------------------ */

/* A fetch that hangs rather than fails would leave the page saying "Loading" for ever,
   so each gives up after LOAD_TIMEOUT_MS and the page falls back to its saved copy. */
const LOAD_TIMEOUT_MS = 15000;

async function getJson(url) {
    const response = await fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(LOAD_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

/* A preview can point the page at a local digest: ?digest=path (and ?changes=path). */
const params = new URLSearchParams(location.search);

async function loadDigest() {
    try {
        const digest = await getJson(params.get('digest') ?? DIGEST_URL);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(digest)); } catch { /* storage full or blocked: fine */ }
        return { digest, stale: false };
    } catch {
        try {
            const saved = localStorage.getItem(CACHE_KEY);
            if (saved) return { digest: JSON.parse(saved), stale: true };
        } catch { /* nothing saved */ }
        return { digest: null, stale: false };
    }
}

async function render() {
    drawChart();
    const status = document.getElementById('rubin-status');
    const { digest, stale } = await loadDigest();
    if (!digest) {
        status.textContent = 'The latest digest could not be loaded. The first one may not have been collected yet - try again later.';
        return;
    }
    status.replaceChildren(...summary(digest).flatMap((part, k) => (k ? [el('span', { class: 'rubin-dot', 'aria-hidden': 'true' }, ' · '), el('span', {}, part)] : [el('span', {}, part)])));
    if (stale) status.append(el('span', { class: 'rubin-stale' }, ` (offline - showing the digest of ${longDate(digest.date)})`));

    const offset = offsetText(digest);
    const offsetLine = document.getElementById('rubin-offset');
    if (offset) { offsetLine.textContent = offset; offsetLine.hidden = false; }

    const { passes, watch, largeIfDark } = sections(digest);
    fillCards('rubin-passes', passes);
    fillCards('rubin-watch', watch, (e) => ({ extra: whyWatched(e) }));
    drawMap(digest);

    const darkSection = fillCards('rubin-dark', largeIfDark.slice(0, LARGE_IF_DARK_SHOWN));
    const more = darkSection.querySelector('.rubin-show-all');
    if (largeIfDark.length > LARGE_IF_DARK_SHOWN) {
        more.hidden = false;
        more.textContent = `Show all ${largeIfDark.length}`;
        more.addEventListener('click', () => { fillCards('rubin-dark', largeIfDark); more.hidden = true; }, { once: true });
    }

    try {
        const month = digest.date.slice(0, 7);
        const changes = await getJson(params.get('changes') ?? CHANGES_URL(month));
        const byDesignation = new Map(digest.entries.map((e) => [e.designation, e]));
        const list = document.querySelector('#rubin-changes .rubin-changes');
        const first = changes.from === null;
        list.replaceChildren(...(first
            ? [el('li', {}, `This is the first digest, so everything in it is new: ${digest.entries.length} objects listed.`)]
            : changes.entries.map((c) => el('li', {}, changeText(c, byDesignation)))));
        if (!first && changes.entries.length === 0) list.replaceChildren(el('li', {}, 'Nothing changed since last month.'));
        document.getElementById('rubin-changes').hidden = false;
    } catch {
        /* No changes file reachable: the section stays hidden. */
    }
}

render();
