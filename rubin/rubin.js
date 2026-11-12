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
    DIGEST_URL, CHANGES_URL, FILTER_FROM, matchesQuery, initialView, zoomAt, panBy, toScreen, toWorld, ringSpacing,
    zoomLevel, MAP_ZOOM, mapSizeFor, PLANET_DRAW_PX, PLANET_LABEL_PX, MOON_DRAW_PX, planeText, summary, sections, displayName, sizeOf, flagsOf,
    whyWatched, changeText, chartData, mapData, percent, kilometres, au, longDate, CHART_RANGE, discoveryText,
    rubinStatus, brightnessText, crossCheckText, offsetText, KIND_LABEL, properName, placeLabels, nasaImages, knownRow, knownWorlds, isKnownShape,
} from '../js/rubinview.js';
import {
    lightTravelledAU, durationText, milestones, lightSentence, sunlightText, rulerFraction, RULER_FROM_AU, firstVisit, hasEarlierVisit, scaleToShow,
} from '../js/light.js';
import { SCOPE_AU } from '../js/orbit.js';
import {
    EXPLANATIONS, PUBLISHED, DIAL, dialRadius, dialXY, yearFraction, bunchingText, thinText, splitNamesText, waitingCountText, evidenceText, publishedText,
} from '../js/faredge.js';
import { RUBIN_COLORS as C } from '../js/logic.js';
import { funFact } from '../js/funfacts.js';
import { observingStatus, nextUpdates, statusText, updateText } from '../js/rubinstatus.js';

const SVG = 'http://www.w3.org/2000/svg';
const CACHE_KEY = 'rubin-digest';
const tooltip = document.getElementById('rubin-tooltip');

/* The light rings on the map (js/light.js) start from two moments: when this page opened,
   and when this browser first opened it. The second is kept in this browser's storage
   and sent nowhere; where storage is blocked there is just the one ring. */
const OPENED = Date.now();
const FIRST_KEY = 'rubin-first-visit';
let firstOpened = OPENED;
let remembersVisits = false;
try {
    firstOpened = firstVisit(localStorage.getItem(FIRST_KEY), OPENED);
    localStorage.setItem(FIRST_KEY, String(firstOpened));
    remembersVisits = true;
} catch { /* storage blocked: fine */ }
/* Earth on the digest's date, for each card's Sunlight line; set once the digest is in. */
let earthNow = null;

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

/* What a tundr is, in a native <dialog>. A click on the backdrop closes it, as Escape
   and the Close button do. */
const tundrDialog = document.getElementById('rubin-tundr');
tundrDialog.addEventListener('click', (e) => { if (e.target === tundrDialog) tundrDialog.close(); });
function openTundr() {
    hideTooltip();
    if (typeof tundrDialog.showModal === 'function' && !tundrDialog.open) tundrDialog.showModal();
}

document.querySelectorAll('[data-tundr]').forEach((word) => word.addEventListener('click', openTundr));

/* The word "tundr" wherever it appears: a button that reads as a word in the sentence. */
function tundrWord(text) {
    const word = el('button', { type: 'button', class: 'rubin-term', 'aria-haspopup': 'dialog' }, text);
    word.addEventListener('click', openTundr);
    return word;
}

/* A Known world's fun fact (js/funfacts.js), with a small link to its source; nothing for a
   body without one. */
function funFactLine(name) {
    const f = funFact(name);
    if (!f) return null;
    const line = el('p', { class: 'rubin-funfact' });
    line.append(el('strong', {}, 'Fun fact: '), f.text, ' ');
    line.append(el('a', { class: 'rubin-source', href: f.url, target: '_blank', rel: 'noopener' }, `Source: ${f.source}`));
    return line;
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

/* A planet's or tundr's card: measured, certain, and nothing from Rubin's data. */
function worldCard(world) {
    const box = el('article', { class: 'rubin-card' });
    box.append(el('h4', {}, world.name));
    const kind = el('p', { class: 'rubin-confirmed' });
    if (world.kind === 'planet') kind.textContent = 'Planet';
    else kind.append(tundrWord(KIND_LABEL[world.kind]));
    box.append(kind);
    const facts = el('dl', { class: 'rubin-facts' });
    const fact = (term, value) => {
        const dd = el('dd');
        dd.append(value);
        facts.append(el('dt', {}, term), dd);
    };
    fact('Size', `${kilometres(world.km)} ${world.across} (measured)`);
    if (world.moon) fact('Orbits', world.parent);
    fact('Now', world.moon ? `${au(world.now.r)} from the Sun, with ${world.parent}` : `${au(world.now.r)} from the Sun`);
    if (Number.isFinite(world.now.x)) fact('Sunlight', sunlightText(world.now, earthNow));
    if (world.found) fact('Found', world.found);
    const images = nasaImages(world);
    fact('Images', el('a', { href: images.url, target: '_blank', rel: 'noopener' }, images.text));
    box.append(facts);
    const fun = funFactLine(world.name);
    if (fun) box.append(fun);
    return box;
}

function card(entry, { extra } = {}) {
    if (entry.world) return worldCard(entry);
    const box = el('article', { class: 'rubin-card' });
    box.append(el('h4', {}, displayName(entry)));
    /* A known shape says what it is, as the planets' cards do. */
    if (isKnownShape(entry)) box.append(el('p', { class: 'rubin-confirmed' }, 'Planet'));
    const status = rubinStatus(entry);
    box.append(el('p', { class: status.confirmed ? 'rubin-confirmed' : 'rubin-unconfirmed' }, status.text));
    if (extra) box.append(el('p', { class: 'rubin-why' }, extra));

    const size = sizeOf(entry);
    const facts = el('dl', { class: 'rubin-facts' });
    const fact = (term, value) => {
        const dd = el('dd');
        dd.append(value);
        facts.append(el('dt', {}, term), dd);
    };
    fact('Size', `${size.text}${size.measured ? ' (measured)' : ' (from brightness)'}`);
    fact('Chance', entry.passes || !entry.flags.includes('largeIfDark')
        ? `${percent(entry.chance)} · ${percent(entry.chanceGrundy)} on Grundy's reading`
        : `${percent(entry.chance)} as typical · ${percent(entry.chanceIfDark)} if dark`);
    fact('Now', `${au(entry.now.r)} from the Sun · magnitude ${entry.now.V.toFixed(1)} · ${entry.now.detectable ? 'within one Rubin exposure' : 'too faint for one Rubin exposure'}`);
    if (Number.isFinite(entry.now.x)) fact('Sunlight', sunlightText(entry.now, earthNow));
    const found = discoveryText(entry);
    if (found) fact('Found', found);
    /* NASA's images: a checked link, or a plain statement that there are none yet. */
    const images = nasaImages(entry);
    fact('Images', images
        ? el('a', { href: images.url, target: '_blank', rel: 'noopener' }, images.text)
        : 'None released by NASA yet');
    const checked = crossCheckText(entry);
    if (checked) fact('Checked', checked);
    fact('Brightness', brightnessText(entry));
    box.append(facts);
    const fun = funFactLine(displayName(entry));
    if (fun) box.append(fun);

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

/* ---- Choosing which cards show ---------------------------------------------------------
 *
 * A card for every object took up the page, so cards show only for objects the reader
 * picks: by name, with a toggle chip in each section, or by clicking the object on the map
 * or its row in the map's table. All of them toggle one shared selection, so they cannot
 * disagree: a chip, its map mark and its table row are always in the same state. */

const selected = new Set();
const pickers = new Map(); // designation -> the section's picker state
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function select(designation, on, { scrollTo = false } = {}) {
    const picker = pickers.get(designation);
    if (!picker) return;
    if (on) selected.add(designation); else selected.delete(designation);
    picker.chips.get(designation)?.setAttribute('aria-pressed', String(on));
    document.querySelectorAll(`[data-object="${CSS.escape(designation)}"]`).forEach((node) => {
        node.classList.toggle('is-selected', on);
        if (node.hasAttribute('aria-pressed')) node.setAttribute('aria-pressed', String(on));
    });
    renderCards(picker);
    if (on && scrollTo) {
        picker.cards.get(designation)?.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
    }
}

const toggle = (designation, options) => select(designation, !selected.has(designation), options);

/* The section's cards: its selected objects, in the section's own order (most promising
   first). Cards are built once and kept, so a flag left open stays open. */
function renderCards(picker) {
    const chosen = picker.entries.filter((e) => selected.has(e.designation));
    for (const e of chosen) if (!picker.cards.has(e.designation)) picker.cards.set(e.designation, card(e, picker.extra?.(e)));
    picker.holder.replaceChildren(...chosen.map((e) => picker.cards.get(e.designation)));
    picker.empty.hidden = chosen.length > 0;
}

/* A picker fills a section, or one group within it (the gravity section has two). */
function buildPicker(sectionId, entries, { extra, onMap = false, group } = {}) {
    const section = document.getElementById(sectionId);
    const scope = group ? section.querySelector(group) : section;
    scope.hidden = entries.length === 0;
    if (!entries.length) return;
    const holder = scope.querySelector('.rubin-cards');
    const box = scope.querySelector('.rubin-picker');
    const picker = { entries, extra, holder, cards: new Map(), chips: new Map(), empty: null };

    const chips = el('div', { class: 'rubin-chips', role: 'group', 'aria-label': 'Choose objects to show' });
    for (const e of entries) {
        const chip = el('button', { type: 'button', class: 'rubin-chip', 'aria-pressed': 'false', 'data-object': e.designation }, displayName(e));
        chip.addEventListener('click', () => toggle(e.designation));
        chips.append(chip);
        picker.chips.set(e.designation, chip);
        pickers.set(e.designation, picker);
    }
    if (entries.length > 12) chips.classList.add('rubin-chips-long');

    /* Select all and Clear act on the chips the filter is showing. */
    const visible = () => entries.filter((e) => !picker.chips.get(e.designation).hidden);
    const tools = el('div', { class: 'rubin-picker-tools' });
    if (entries.length > FILTER_FROM) {
        const filter = el('input', { type: 'search', class: 'rubin-filter', placeholder: 'Filter by name', 'aria-label': `Filter the ${entries.length} names` });
        filter.addEventListener('input', () => {
            for (const e of entries) picker.chips.get(e.designation).hidden = !matchesQuery(e, filter.value);
        });
        tools.append(filter);
    }
    const all = el('button', { type: 'button', class: 'rubin-tool' }, 'Select all');
    all.addEventListener('click', () => visible().forEach((e) => select(e.designation, true)));
    const none = el('button', { type: 'button', class: 'rubin-tool' }, 'Clear');
    none.addEventListener('click', () => visible().forEach((e) => select(e.designation, false)));
    tools.append(all, none);

    picker.empty = el('p', { class: 'rubin-note rubin-empty' }, onMap
        ? 'Choose objects above, or click them on the map, to see their details.'
        : 'Choose objects above to see their details.');
    box.replaceChildren(tools, chips, picker.empty);
    renderCards(picker);
}

/* ---- The map ----------------------------------------------------------------------- */

const MARK_STYLE = {
    passes: { label: 'Passes', color: C.evidence, shape: 'circle', filled: true },
    disputed: { label: 'Passes, disputed', color: C.evidence, shape: 'circle', filled: false },
    watch: { label: 'Worth watching', color: C.watch, shape: 'diamond', filled: true },
};

/* ground: the colour behind the mark - the map's black, or the page's brown for a legend
   swatch - which rings a filled mark and fills a hollow one. */
function mark(style, cx, cy, size = 5, ground = C.surface) {
    const attrs = style.filled
        ? { fill: style.color, stroke: ground, 'stroke-width': 2 }
        : { fill: ground, stroke: style.color, 'stroke-width': 2 };
    if (style.shape === 'diamond') {
        const d = size * 1.35;
        return svg('path', { d: `M${cx},${cy - d}L${cx + d},${cy}L${cx},${cy + d}L${cx - d},${cy}Z`, ...attrs });
    }
    return svg('circle', { cx, cy, r: size, ...attrs });
}

function legend(items) {
    const box = el('div', { class: 'rubin-legend' });
    items.forEach(({ label, swatch, tundr }) => {
        const item = el('span', { class: 'rubin-legend-item' });
        const key = svg('svg', { width: 22, height: 14, viewBox: '0 0 22 14', 'aria-hidden': 'true' });
        key.append(swatch);
        item.append(key, tundr ? tundrWord(label) : document.createTextNode(label));
        box.append(item);
    });
    return box;
}

function drawMap(digest) {
    const section = document.getElementById('rubin-map');
    const data = mapData(digest);
    if (!data.marks.length) { section.hidden = true; return; }
    /* Drawn at the width it is shown (mapSizeFor); the stylesheet sets the same width. */
    const SIZE = mapSizeFor(document.documentElement.clientWidth);
    let view = initialView(data.radius, SIZE);
    const plot = svg('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'rubin-svg rubin-map-svg', role: 'group', 'aria-label': 'Map of the listed objects, the Sun, the planets and the tundrs, seen from above' });
    const layer = svg('g');
    /* The light rings are drawn over the map on their own layer, so they can move without
       the marks being rebuilt under a pointer. Decoration: the words under the map say
       the same, and the layer takes no clicks. */
    const lightLayer = svg('g', { class: 'rubin-light', 'aria-hidden': 'true' });
    plot.append(layer, lightLayer);

    const RULER_HEIGHT = 74;
    const ruler = svg('svg', { viewBox: `0 0 ${SIZE} ${RULER_HEIGHT}`, class: 'rubin-svg rubin-ruler', 'aria-hidden': 'true' });
    const lightNow = el('p', { class: 'rubin-light-text' });
    const lightFirst = el('p', { class: 'rubin-light-text' });
    const rulerNote = el('p', { class: 'rubin-note rubin-light-text' }, 'The light is drawn as a ring on the map, at its true size and speed, and marked on the ruler above with how long ago it left, where each step to the right is ten times further from the Sun.');
    const findLight = el('button', { type: 'button', class: 'rubin-tool' }, 'Find the light');

    const neptune = data.planets.find((p) => p.name === 'Neptune');
    const stops = milestones([
        ...data.planets,
        ...data.marks.map(({ entry }) => ({ name: displayName(entry), r: entry.now.r })),
    ]);
    const edge = { name: "this page's outer limit, 100,000 AU from the Sun", r: SCOPE_AU };
    const firstDay = new Date(firstOpened);
    const firstDate = longDate(`${firstDay.getFullYear()}-${firstDay.getMonth() + 1}-${firstDay.getDate()}`);
    const earlier = hasEarlierVisit(firstOpened, OPENED);
    /* This visit's light is a solid ring; the first visit's is dotted, and its ruler mark
       hollow, so they are told apart without colour. */
    const lights = [
        { since: OPENED, label: 'this visit', short: 'this visit', dash: null },
        ...(earlier ? [{ since: firstOpened, label: `first visit, ${firstDate}`, short: 'first visit', dash: '3 5' }] : []),
    ];

    function drawLight() {
        const now = Date.now();
        const [sx, sy] = toScreen(view, 0, 0);
        const fromCentre = Math.hypot(sx - SIZE / 2, sy - SIZE / 2);
        const rings = [];
        const marks = [];
        const at = (fraction) => 8 + fraction * (SIZE - 16);
        const lineY = 46;
        marks.push(svg('line', { x1: at(0), y1: lineY, x2: at(1), y2: lineY, stroke: C.muted, 'stroke-width': 1 }));
        for (let decade = RULER_FROM_AU; decade <= SCOPE_AU * 1.01; decade *= 10) {
            const x = at(rulerFraction(decade, SCOPE_AU));
            marks.push(svg('line', { x1: x, y1: lineY - 3, x2: x, y2: lineY + 3, stroke: C.muted, 'stroke-width': 1 }));
        }
        marks.push(svg('text', { x: at(0), y: lineY + 20, class: 'rubin-axis' }, `${RULER_FROM_AU} AU`));
        marks.push(svg('text', { x: at(rulerFraction(1, SCOPE_AU)), y: lineY + 20, class: 'rubin-axis', 'text-anchor': 'middle' }, 'Earth'));
        if (neptune) marks.push(svg('text', { x: at(rulerFraction(neptune.r, SCOPE_AU)), y: lineY + 20, class: 'rubin-axis', 'text-anchor': 'middle' }, 'Neptune'));
        marks.push(svg('text', { x: at(1), y: lineY + 20, class: 'rubin-axis', 'text-anchor': 'end' }, '100,000 AU'));

        lights.forEach((light, k) => {
            const travelled = lightTravelledAU(now - light.since);
            const r = travelled * view.scale;
            /* Drawn only where some of the ring crosses the picture. */
            if (r >= 1 && r < 1e6 && Math.abs(fromCentre - r) <= SIZE * 0.71) {
                rings.push(svg('circle', { cx: sx, cy: sy, r, fill: 'none', stroke: C.text, 'stroke-width': 1.5, ...(light.dash ? { 'stroke-dasharray': light.dash } : {}) }));
                const labelY = sy - r - 4;
                if (r > 14 && labelY > 12 && labelY < SIZE && sx > 60 && sx < SIZE) {
                    rings.push(svg('text', { x: sx - 4, y: labelY, class: 'rubin-label', 'text-anchor': 'end' }, `light, ${light.label}`));
                }
            }
            const x = at(rulerFraction(travelled, SCOPE_AU));
            const labelRow = 14 + 14 * k;
            marks.push(svg('line', { x1: x, y1: labelRow + 4, x2: x, y2: lineY, stroke: C.text, 'stroke-width': 1 }));
            marks.push(svg('circle', { cx: x, cy: lineY, r: 4.5, fill: light.dash ? C.space : C.text, stroke: C.text, 'stroke-width': 1.5 }));
            const left = x < SIZE / 2;
            /* On the ruler each light says how long ago it left. */
            marks.push(svg('text', { x: left ? x + 6 : x - 6, y: labelRow, class: 'rubin-label', 'text-anchor': left ? 'start' : 'end' }, `${light.short}, ${durationText((now - light.since) / 1000)} ago`));
        });
        lightLayer.replaceChildren(...rings);
        ruler.replaceChildren(...marks);

        lightNow.textContent = lightSentence({ since: 'as you opened this page', elapsedSeconds: (now - OPENED) / 1000, travelledAU: lightTravelledAU(now - OPENED), sorted: stops, edge });
        if (earlier) {
            lightFirst.textContent = `${lightSentence({ since: `when you first opened this page on ${firstDate}`, elapsedSeconds: (now - firstOpened) / 1000, travelledAU: lightTravelledAU(now - firstOpened), sorted: stops, edge })} (That date is kept in this browser and sent nowhere.)`;
        } else if (remembersVisits) {
            lightFirst.textContent = 'This browser will remember when you first opened this page, so on a later visit you can see how far that light has got. The time is kept on your device and sent nowhere.';
        }
        lightFirst.hidden = !lightFirst.textContent;
    }
    /* The light moves four times a second; for a visitor who asked for less motion it
       steps every ten seconds instead. Nothing runs while the tab is hidden. */
    (function tick() {
        if (!document.hidden) drawLight();
        setTimeout(tick, reducedMotion.matches ? 10000 : 250);
    })();

    const zoomIn = el('button', { type: 'button', class: 'rubin-tool', 'aria-label': 'Zoom in' }, '+');
    const zoomOut = el('button', { type: 'button', class: 'rubin-tool', 'aria-label': 'Zoom out' }, '−');
    const reset = el('button', { type: 'button', class: 'rubin-tool' }, 'Whole map');
    const readout = el('span', { class: 'rubin-zoom-readout', 'aria-live': 'polite' });

    /* Everything is redrawn from the view on each zoom or pan: rings, planets, objects.
       Marks keep their size in pixels at every zoom. */
    function render() {
        const [sx, sy] = toScreen(view, 0, 0);
        const parts = [];
        /* Names to place once every dot is drawn, in priority order (placeLabels). */
        const labels = [];
        const spacing = ringSpacing(view);
        const reach = Math.hypot(Math.abs(view.cx), Math.abs(view.cy)) + SIZE / view.scale;
        for (let r = spacing, n = 0; r <= reach && n < 60; r += spacing, n++) {
            parts.push(svg('circle', { cx: sx, cy: sy, r: r * view.scale, fill: 'none', stroke: C.grid, 'stroke-width': 1 }));
            const labelY = sy - r * view.scale - 4;
            if (labelY > 12 && labelY < SIZE) parts.push(svg('text', { x: sx + 4, y: labelY, class: 'rubin-axis' }, `${r} AU`));
        }

        /* The planets and tundrs, on their real orbits, where they are on the digest's date. */
        for (const p of data.planets) {
            const orbitPx = p.a * view.scale;
            if (orbitPx < PLANET_DRAW_PX) continue;
            const points = p.path.map((q) => toScreen(view, q.x, q.y).map((v) => v.toFixed(1)).join(',')).join(' ');
            parts.push(svg('polygon', { points, fill: 'none', stroke: C.muted, 'stroke-width': 1, opacity: 0.55 }));
            const [px, py] = toScreen(view, p.x, p.y);
            const designation = `world:${p.name}`;
            const chosen = selected.has(designation);
            const g = svg('g', { class: chosen ? 'rubin-mark rubin-mark-pickable is-selected' : 'rubin-mark rubin-mark-pickable', 'data-object': designation });
            g.append(svg('circle', { cx: px, cy: py, r: 12, fill: 'transparent' }));
            g.append(svg('circle', { cx: px, cy: py, r: 3.5, fill: C.muted, stroke: C.space, 'stroke-width': 2 }));
            attachDetails(g, [[p.name, KIND_LABEL[p.kind].toLowerCase()], [au(p.r), 'from the Sun'], ['Click to show or hide its card']]);
            /* Like every object on the map, a click toggles its card; the card's "tundr"
               opens what a tundr is. */
            g.setAttribute('role', 'button');
            g.setAttribute('aria-pressed', String(chosen));
            g.addEventListener('click', () => { hideTooltip(); toggle(designation, { scrollTo: true }); });
            g.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(designation, { scrollTo: true }); }
            });
            g.addEventListener('dblclick', (e) => e.stopPropagation());
            parts.push(g);
            if (orbitPx >= PLANET_LABEL_PX) labels.push({ x: px, y: py, text: p.name, rank: Infinity });
        }
        /* The round moons, once zoomed in far enough to tell each from its parent. A click
           shows its card. */
        for (const m of data.moons) {
            const ringPx = m.a * view.scale;
            if (ringPx < MOON_DRAW_PX) continue;
            const [mx, my] = toScreen(view, m.x, m.y);
            if (mx < -20 || mx > SIZE + 20 || my < -20 || my > SIZE + 20) continue;
            const points = m.path.map((q) => toScreen(view, q.x, q.y).map((v) => v.toFixed(1)).join(',')).join(' ');
            parts.push(svg('polygon', { points, fill: 'none', stroke: C.muted, 'stroke-width': 1, opacity: 0.4 }));
            const designation = `world:${m.name}`;
            const chosen = selected.has(designation);
            const g = svg('g', { class: chosen ? 'rubin-mark rubin-mark-pickable is-selected' : 'rubin-mark rubin-mark-pickable', 'data-object': designation });
            g.append(svg('circle', { cx: mx, cy: my, r: 12, fill: 'transparent' }));
            g.append(svg('circle', { cx: mx, cy: my, r: 2.5, fill: C.muted, stroke: C.space, 'stroke-width': 1.5 }));
            attachDetails(g, [[m.name, `planet, orbiting ${m.parent}`], ['Click to show or hide its card']]);
            g.setAttribute('role', 'button');
            g.setAttribute('aria-pressed', String(chosen));
            g.addEventListener('click', () => { hideTooltip(); toggle(designation, { scrollTo: true }); });
            g.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(designation, { scrollTo: true }); }
            });
            g.addEventListener('dblclick', (e) => e.stopPropagation());
            parts.push(g);
            if (ringPx >= PLANET_LABEL_PX) labels.push({ x: mx, y: my, text: m.name, rank: 1e7 });
        }
        parts.push(svg('circle', { cx: sx, cy: sy, r: 4, fill: C.text }));

        for (const { entry, kind } of data.marks) {
            const [x, y] = toScreen(view, entry.now.x, entry.now.y);
            if (x < -20 || x > SIZE + 20 || y < -20 || y > SIZE + 20) continue;
            const chosen = selected.has(entry.designation);
            const g = svg('g', { class: chosen ? 'rubin-mark rubin-mark-pickable is-selected' : 'rubin-mark rubin-mark-pickable', 'data-object': entry.designation });
            g.append(svg('circle', { cx: x, cy: y, r: 12, fill: 'transparent' }));
            g.append(mark(MARK_STYLE[kind], x, y, 5, C.space));
            attachDetails(g, [
                [displayName(entry), MARK_STYLE[kind].label.toLowerCase(), MARK_STYLE[kind].color],
                [au(entry.now.r), 'from the Sun'],
                ...(planeText(entry) ? [[planeText(entry)]] : []),
                [sizeOf(entry).text, sizeOf(entry).measured ? 'measured' : 'from brightness'],
                ['Click to show or hide its card'],
            ]);
            /* Clicking a mark toggles its card, and scrolls to it when it appears. */
            g.setAttribute('role', 'button');
            g.setAttribute('aria-pressed', String(chosen));
            g.addEventListener('click', () => { hideTooltip(); toggle(entry.designation, { scrollTo: true }); });
            g.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(entry.designation, { scrollTo: true }); }
            });
            /* A double-click on an object is two clicks on it, not a zoom. */
            g.addEventListener('dblclick', (e) => e.stopPropagation());
            parts.push(g);
            const name = properName(entry);
            if (name) labels.push({ x, y, text: name, rank: sizeOf(entry).km });
        }
        /* Planets and tundrs first, then the largest objects; a name with no room is left
           out until zooming in makes some. */
        labels.sort((a, b) => b.rank - a.rank);
        for (const l of placeLabels(labels, SIZE)) {
            parts.push(svg('text', { x: l.x + 7, y: l.y - 7, class: 'rubin-axis rubin-map-label' }, l.text));
        }
        layer.replaceChildren(...parts);

        const level = zoomLevel(view);
        readout.textContent = level < 1.05 ? 'Whole map' : `${level < 10 ? level.toFixed(1) : Math.round(level)}× zoom`;
        zoomIn.disabled = level >= MAP_ZOOM.max - 0.01;
        zoomOut.disabled = level <= 1.0001;
        reset.disabled = level <= 1.0001;
        /* At the whole map a finger drag scrolls the page; zoomed in, it moves the map. */
        plot.style.touchAction = level <= 1.0001 ? 'pan-y' : 'none';
        drawLight();
    }

    const setView = (next) => { view = next; render(); };
    /* The pointer in the drawing's own pixels. */
    const local = (e) => {
        const box = plot.getBoundingClientRect();
        return [(e.clientX - box.left) * (SIZE / box.width), (e.clientY - box.top) * (SIZE / box.height)];
    };

    /* Drag to pan, two fingers to pinch. A press that moves less than a few pixels stays a
       click, so it still toggles a card; one that moves is a drag, and its click is
       swallowed. */
    const pointers = new Map();
    let dragged = false;
    let pinch = null;
    plot.addEventListener('pointerdown', (e) => {
        pointers.set(e.pointerId, local(e));
        dragged = false;
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinch = { distance: Math.hypot(a[0] - b[0], a[1] - b[1]), view };
        }
    });
    plot.addEventListener('pointermove', (e) => {
        if (!pointers.has(e.pointerId)) return;
        const [x, y] = local(e);
        const [px, py] = pointers.get(e.pointerId);
        if (pointers.size === 2 && pinch) {
            pointers.set(e.pointerId, [x, y]);
            const [a, b] = [...pointers.values()];
            const mid = toWorld(pinch.view, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
            setView(zoomAt(pinch.view, Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.distance, mid));
            dragged = true;
            return;
        }
        if (!dragged && Math.hypot(x - px, y - py) < 4) return;
        if (!dragged) { dragged = true; plot.setPointerCapture?.(e.pointerId); hideTooltip(); }
        pointers.set(e.pointerId, [x, y]);
        if (zoomLevel(view) > 1.0001) setView(panBy(view, x - px, y - py));
    });
    const release = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; };
    plot.addEventListener('pointerup', release);
    plot.addEventListener('pointercancel', release);
    plot.addEventListener('click', (e) => { if (dragged) { e.stopPropagation(); dragged = false; } }, true);
    plot.addEventListener('dblclick', (e) => setView(zoomAt(view, MAP_ZOOM.step, toWorld(view, ...local(e)))));
    /* Ctrl + scroll (and a laptop trackpad's pinch, which arrives the same way) zooms;
       plain scrolling stays the page's. */
    plot.addEventListener('wheel', (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        setView(zoomAt(view, Math.exp(-e.deltaY * 0.0025), toWorld(view, ...local(e))));
    }, { passive: false });

    zoomIn.addEventListener('click', () => setView(zoomAt(view, MAP_ZOOM.step)));
    zoomOut.addEventListener('click', () => setView(zoomAt(view, 1 / MAP_ZOOM.step)));
    reset.addEventListener('click', () => setView(initialView(data.radius, SIZE)));
    /* Zooms on the Sun until this visit's light fills about a third of the map. */
    findLight.addEventListener('click', () => {
        const home = initialView(data.radius, SIZE);
        const scale = scaleToShow(lightTravelledAU(Date.now() - OPENED), SIZE, { fitScale: home.fitScale, maxZoom: MAP_ZOOM.max });
        setView(zoomAt(home, scale / home.fitScale, [0, 0]));
    });
    const controls = el('div', { class: 'rubin-map-controls' });
    controls.append(zoomIn, zoomOut, reset, findLight, readout);

    const holder = section.querySelector('.rubin-plot');
    const present = [...new Set(data.marks.map((m) => m.kind))];
    holder.replaceChildren(
        legend([
            ...present.map((k) => ({ label: MARK_STYLE[k].label, swatch: mark(MARK_STYLE[k], 11, 7, 4) })),
            ...['planet', 'hydrogen', 'water'].map((kind) => ({
                label: KIND_LABEL[kind], tundr: kind !== 'planet', swatch: svg('circle', { cx: 11, cy: 7, r: 3.5, fill: C.muted }),
            })),
        ]),
        controls,
        plot,
        ruler,
        lightNow,
        lightFirst,
        rulerNote,
    );
    section.querySelector('figcaption').replaceChildren(
        `Seen from above the plane of Earth's orbit on ${longDate(digest.date)}, with the Sun at the centre and distances to scale. The planets and `,
        tundrWord('tundrs'),
        ` are where they were that day. Distances on the map are along that plane, so an object on a steeply tilted orbit sits closer in than its true distance from the Sun; its details give both. Zoom with the buttons, a pinch, Ctrl and scroll, or a double-click; drag to move around.`,
    );

    const mapTable = table(
        ['Object', 'Listed as', 'From the Sun', 'Along the plane and out of it', 'Size'],
        data.marks.map(({ entry, kind }) => [displayName(entry), MARK_STYLE[kind].label, au(entry.now.r), planeText(entry) ?? 'in the plane', sizeOf(entry).text]),
    );
    /* Each name in the table is a button doing what clicking its map mark does. */
    [...mapTable.tBodies[0].rows].forEach((row, k) => {
        const { entry } = data.marks[k];
        const name = el('button', { type: 'button', class: 'rubin-row-pick', 'aria-pressed': 'false', 'data-object': entry.designation }, displayName(entry));
        name.addEventListener('click', () => toggle(entry.designation, { scrollTo: true }));
        row.cells[0].replaceChildren(name);
    });
    section.querySelector('.rubin-table-wrap').replaceChildren(mapTable);
    section.hidden = false;
    render();
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

/* ---- What shaped the far edge? ---------------------------------------------------------
 *
 * The most distant orbits' directions, from the section the digest carries (js/faredge.js,
 * built by the collector). A dial, the numbers in words, the history, and the explanations
 * side by side. The words carry everything the pictures show, and nothing here states the
 * odds of any explanation: see NOTES.md for the rules this section is held to. */

/* Sedna-like objects are diamonds, hollow when outside the extreme group; the rest dots. */
function farMark(o, cx, cy, ground) {
    if (o.sednaLike) {
        const d = 6;
        return svg('path', {
            d: `M${cx},${cy - d} L${cx + d},${cy} L${cx},${cy + d} L${cx - d},${cy} Z`,
            fill: o.extreme ? C.watch : ground, stroke: o.extreme ? ground : C.watch, 'stroke-width': 2,
        });
    }
    return svg('circle', { cx, cy, r: 5, fill: C.evidence, stroke: ground, 'stroke-width': 2 });
}

function drawFarEdge(digest) {
    const section = document.getElementById('rubin-faredge');
    const far = digest.farEdge;
    if (!far || !far.objects?.length) { section.hidden = true; return; }
    const cuts = far.cuts;

    /* The dial. */
    const SIZE = 420, R = 170, cx = SIZE / 2, cy = SIZE / 2;
    const dial = svg('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'rubin-svg rubin-dial', role: 'group', 'aria-label': 'Which way the long axis of each extreme orbit points, seen from above' });
    dial.append(svg('circle', { cx, cy, r: R, fill: C.space, stroke: C.grid, 'stroke-width': 1 }));
    DIAL.rings.forEach((au) => {
        const r = dialRadius(au) * R;
        dial.append(svg('circle', { cx, cy, r, fill: 'none', stroke: C.grid, 'stroke-width': 1 }));
        /* Labelled down to the left, the emptiest part of the dial. */
        const [lx, ly] = dialXY(225, dialRadius(au), R);
        dial.append(svg('text', { x: cx + lx - 4, y: cy + ly + 12, 'text-anchor': 'end', class: 'rubin-axis' }, `${groupAU(au)} AU`));
    });
    [[0, 'start', 6, 4], [90, 'middle', 0, -8], [180, 'end', -6, 4], [270, 'middle', 0, 18]].forEach(([deg, anchor, dx, dy]) => {
        const [tx, ty] = dialXY(deg, 1, R);
        const [ix, iy] = dialXY(deg, 0.97, R);
        dial.append(svg('line', { x1: cx + ix, y1: cy + iy, x2: cx + tx, y2: cy + ty, stroke: C.muted, 'stroke-width': 1 }));
        dial.append(svg('text', { x: cx + tx + dx, y: cy + ty + dy, 'text-anchor': anchor, class: 'rubin-axis' }, `${deg}°`));
    });
    /* A faint spoke to each object, so its direction reads from the centre. */
    far.objects.forEach((o) => {
        const [x, y] = dialXY(o.axis, dialRadius(o.a), R);
        dial.append(svg('line', { x1: cx, y1: cy, x2: cx + x, y2: cy + y, stroke: C.grid, 'stroke-width': 1 }));
    });
    /* The average direction of the extreme group: an arrow whose length is the bunching,
       reaching the rim only if every orbit pointed the same way. */
    if (far.axes.toward !== null && far.axes.r !== null) {
        const [ax, ay] = dialXY(far.axes.toward, far.axes.r, R);
        dial.append(svg('line', { x1: cx, y1: cy, x2: cx + ax, y2: cy + ay, stroke: C.text, 'stroke-width': 2, 'stroke-linecap': 'round' }));
        const [hx, hy] = dialXY(far.axes.toward + 150, 0.05, R);
        const [kx, ky] = dialXY(far.axes.toward - 150, 0.05, R);
        dial.append(svg('path', { d: `M${cx + ax + hx},${cy + ay + hy} L${cx + ax},${cy + ay} L${cx + ax + kx},${cy + ay + ky}`, fill: 'none', stroke: C.text, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    }
    dial.append(svg('circle', { cx, cy, r: 3, fill: C.text }));
    far.objects.forEach((o) => {
        const [x, y] = dialXY(o.axis, dialRadius(o.a), R);
        const g = svg('g', { class: 'rubin-mark' });
        g.append(svg('circle', { cx: cx + x, cy: cy + y, r: 12, fill: 'transparent' }));
        g.append(farMark(o, cx + x, cy + y, C.space));
        attachDetails(g, [
            [o.name, o.sednaLike ? (o.extreme ? 'Sedna-like, in the extreme group' : 'Sedna-like, outside the extreme group') : 'extreme', o.sednaLike ? C.watch : C.evidence],
            [`${Math.round(o.axis)}°`, 'long axis'],
            [`${groupAU(o.a)} AU`, 'average distance'],
            [`${o.q} AU`, 'closest approach'],
            ...(o.found ? [[String(o.found), 'found']] : []),
        ]);
        dial.append(g);
        /* The Sedna-like objects are few enough to name on the dial. */
        if (o.sednaLike) {
            const right = x >= 0;
            dial.append(svg('text', { x: cx + x + (right ? 9 : -9), y: cy + y - 8, 'text-anchor': right ? 'start' : 'end', class: 'rubin-axis rubin-map-label' }, o.name));
        }
    });
    const sample = (o) => { const key = svg('g'); key.append(farMark(o, 11, 7, C.surface)); return key; };
    const arrow = svg('line', { x1: 2, x2: 20, y1: 7, y2: 7, stroke: C.text, 'stroke-width': 2, 'stroke-linecap': 'round' });
    const [dialFigure, historyFigure] = section.querySelectorAll('.rubin-figure');
    dialFigure.querySelector('.rubin-plot').replaceChildren(
        legend([
            { label: 'Extreme orbit', swatch: sample({ extreme: true }) },
            { label: 'Sedna-like', swatch: sample({ sednaLike: true, extreme: true }) },
            ...(far.objects.some((o) => o.sednaLike && !o.extreme) ? [{ label: 'Sedna-like, outside the extreme group', swatch: sample({ sednaLike: true, extreme: false }) }] : []),
            { label: 'Average direction', swatch: arrow },
        ]),
        dial,
    );
    dialFigure.querySelector('figcaption').textContent =
        `Each mark is one orbit, placed in the direction its long axis points, turned the same way as the map above; further from the centre is a larger orbit. The arrow is the extreme group's average direction, and its length is how bunched they are: it would reach the rim if every orbit pointed the same way. Extreme means an average distance between ${cuts.extreme.aMin} and ${groupAU(cuts.extreme.aMax)} AU and a closest approach beyond ${cuts.extreme.qMin} AU; Sedna-like, beyond ${cuts.sednaLike.aMin} AU and ${cuts.sednaLike.qMin} AU. Those rules were fixed on ${longDate(cuts.set)} and are other people's (see the sources). Orbits are measured about the Solar System's centre of mass.`;
    const [dialTable, historyTable] = section.querySelectorAll('.rubin-table-wrap');
    dialTable.replaceChildren(table(
        ['Object', 'Group', 'Long axis points', 'Average distance', 'Closest approach', 'Tilt', 'Found'],
        far.objects.map((o) => [o.name, o.sednaLike ? (o.extreme ? 'Extreme, Sedna-like' : 'Sedna-like only') : 'Extreme', `${Math.round(o.axis)}°`, `${groupAU(o.a)} AU`, `${o.q} AU`, `${o.i}°`, o.found ? String(o.found) : '']),
    ));

    /* The numbers, in words. */
    const words = section.querySelector('.rubin-far-numbers');
    const lines = [
        bunchingText(far.axes, 'long axes', 'extreme'),
        far.tilts.p !== null ? bunchingText(far.tilts, 'tilts', 'extreme') : null,
        thinText(far.axes.n, far.oneMore),
        splitNamesText(far.sednaLike),
        waitingCountText(far.waiting),
    ].filter(Boolean);
    words.replaceChildren(...lines.map((text) => el('p', {}, text)));

    /* The history: hindsight by year, then the weeks as they are recorded. */
    const hind = far.backfill.filter((p) => p.r !== null);
    const weeks = far.history.filter((p) => p.extreme?.r !== null && p.extreme?.r !== undefined);
    const W = 640, H = 310, m = { left: 44, right: 20, top: 16, bottom: 50 };
    const firstYear = (hind[0]?.year ?? Number(digest.date.slice(0, 4))) - 1;
    const lastYear = Number(digest.date.slice(0, 4)) + 1;
    const hx = (year) => m.left + (year - firstYear) / (lastYear - firstYear) * (W - m.left - m.right);
    const hy = (r) => m.top + (1 - r) * (H - m.top - m.bottom);
    const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'rubin-svg', role: 'group', 'aria-label': 'How bunched the extreme orbits have been, year by year' });
    [0, 0.25, 0.5, 0.75, 1].forEach((r) => {
        chart.append(svg('line', { x1: m.left, x2: W - m.right, y1: hy(r), y2: hy(r), stroke: C.grid, 'stroke-width': 1 }));
        chart.append(svg('text', { x: m.left - 8, y: hy(r) + 4, 'text-anchor': 'end', class: 'rubin-axis' }, r.toFixed(2).replace(/\.?0+$/, '') || '0'));
    });
    for (let year = Math.ceil(firstYear / 2) * 2; year <= lastYear; year += 2) {
        chart.append(svg('line', { x1: hx(year), x2: hx(year), y1: H - m.bottom, y2: H - m.bottom + 5, stroke: C.muted, 'stroke-width': 1 }));
        chart.append(svg('text', { x: hx(year), y: H - m.bottom + 18, 'text-anchor': 'middle', class: 'rubin-axis' }, String(year)));
    }
    chart.append(svg('text', { x: (m.left + W - m.right) / 2, y: H - 12, 'text-anchor': 'middle', class: 'rubin-axis' }, 'Bunching of the long axes (0 none, 1 all the same), by year'));
    /* 2016: Batygin & Brown propose the planet. */
    if (firstYear < 2016 && lastYear > 2016) {
        chart.append(svg('line', { x1: hx(2016), x2: hx(2016), y1: m.top, y2: H - m.bottom, stroke: C.muted, 'stroke-width': 1, 'stroke-dasharray': '3 4' }));
        chart.append(svg('text', { x: hx(2016) + 5, y: m.top + 10, class: 'rubin-axis' }, '2016: a hidden planet is proposed'));
    }
    /* Each year's point sits at the year's end, where its count was reached. */
    const hindX = (p) => hx(Math.min(p.year + 1, yearFraction(digest.date)));
    if (hind.length > 1) {
        chart.append(svg('path', { d: hind.map((p, k) => `${k ? 'L' : 'M'}${hindX(p).toFixed(1)},${hy(p.r).toFixed(1)}`).join(''), fill: 'none', stroke: C.muted, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    }
    hind.forEach((p) => {
        const g = svg('g', { class: 'rubin-mark' });
        g.append(svg('circle', { cx: hindX(p), cy: hy(p.r), r: 12, fill: 'transparent' }));
        g.append(svg('circle', { cx: hindX(p), cy: hy(p.r), r: 4, fill: C.surface, stroke: C.muted, 'stroke-width': 2 }));
        attachDetails(g, [[p.r.toFixed(2), `in hindsight, end of ${p.year}`, C.muted], [String(p.n), 'extreme objects found by then']]);
        chart.append(g);
    });
    if (weeks.length > 1) {
        chart.append(svg('path', { d: weeks.map((p, k) => `${k ? 'L' : 'M'}${hx(yearFraction(p.date)).toFixed(1)},${hy(p.extreme.r).toFixed(1)}`).join(''), fill: 'none', stroke: C.evidence, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    }
    /* Weeks crowd together at this scale; the newest takes the hover. */
    weeks.forEach((p, k) => {
        const x = hx(yearFraction(p.date)), y = hy(p.extreme.r);
        const g = svg('g', { class: 'rubin-mark' });
        if (k === weeks.length - 1) g.append(svg('circle', { cx: x, cy: y, r: 12, fill: 'transparent' }));
        g.append(svg('circle', { cx: x, cy: y, r: 4, fill: C.evidence, stroke: C.surface, 'stroke-width': 2 }));
        if (k === weeks.length - 1) attachDetails(g, [[p.extreme.r.toFixed(2), `recorded ${longDate(p.date)}`, C.evidence], [String(p.extreme.n), 'extreme objects']]);
        chart.append(g);
    });
    const hollow = svg('g');
    hollow.append(svg('line', { x1: 2, x2: 20, y1: 7, y2: 7, stroke: C.muted, 'stroke-width': 2 }), svg('circle', { cx: 11, cy: 7, r: 4, fill: C.surface, stroke: C.muted, 'stroke-width': 2 }));
    historyFigure.querySelector('.rubin-plot').replaceChildren(
        legend([
            { label: 'In hindsight, with today\'s orbits', swatch: hollow },
            { label: 'Recorded each week', swatch: svg('circle', { cx: 11, cy: 7, r: 4, fill: C.evidence }) },
        ]),
        chart,
    );
    const peak = hind.reduce((best, p) => (p.r > (best?.r ?? 0) && p.n >= 10 ? p : best), null);
    const now = hind.at(-1);
    historyFigure.querySelector('figcaption').textContent =
        `The pale line is hindsight: what the dial would have shown at the end of each year, using today's orbits and counting only the objects found by then. Nobody had these orbits at the time, and no figure is given for fewer than five objects.${peak && now && peak.year !== now.year ? ` On that reckoning the bunching was strongest in ${peak.year}, at ${peak.r.toFixed(2)} with ${peak.n} objects, and is ${now.r.toFixed(2)} with ${now.n} now.` : ''} The blue points are this page's own record, one a week since ${longDate(far.history[0].date)}, and are never recalculated.`;
    const joined = far.history.filter((p) => p.joined?.length);
    historyTable.replaceChildren(table(
        ['When', 'Extreme objects', 'Bunching', 'Kind'],
        [
            ...hind.map((p) => [`End of ${p.year}`, String(p.n), p.r.toFixed(2), 'Hindsight']),
            ...far.history.map((p) => [longDate(p.date), String(p.extreme.n), p.extreme.r === null ? 'too few' : p.extreme.r.toFixed(2), p.joined?.length ? `Recorded; joined: ${p.joined.join(', ')}` : 'Recorded']),
        ],
    ));
    const joinedLine = section.querySelector('.rubin-far-joined');
    joinedLine.hidden = joined.length === 0;
    if (joined.length) joinedLine.textContent = `Joined the extreme group since this record began: ${joined.map((p) => `${p.joined.join(', ')} (${longDate(p.date)})`).join('; ')}.`;

    /* The explanations, side by side, each with its paper and the measurement beside it. */
    const explain = table(
        ['Explanation', 'What it predicts', 'What this page measures'],
        EXPLANATIONS.map((e) => [e.name, e.predicts, evidenceText(e.evidence, far)]),
    );
    [...explain.tBodies[0].rows].forEach((row, k) => {
        const e = EXPLANATIONS[k];
        row.cells[1].append(' ', el('a', { class: 'rubin-source', href: e.url, target: '_blank', rel: 'noopener' }, `Source: ${e.source}`));
    });
    section.querySelector('.rubin-far-explain').replaceChildren(explain);

    const published = el('ul', { class: 'rubin-far-published' });
    PUBLISHED.forEach((p) => {
        const item = el('li');
        item.append(el('a', { href: p.url, target: '_blank', rel: 'noopener' }, `${p.who} (${p.year})`), publishedText(p).slice(`${p.who} (${p.year})`.length));
        published.append(item);
    });
    section.querySelector('.rubin-far-published-wrap').replaceChildren(published);
    section.hidden = false;
}

const groupAU = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/* ---- Is Rubin observing, and when does this page next change ------------------------ */

/* Worked out now, from the digest's record of Rubin's alerts and the announced windows,
   so the count of quiet nights and the next run are current whenever the page is viewed. */
function showNotice(digest) {
    const obs = digest.observing;
    const box = document.getElementById('rubin-notice');
    if (!obs) return;
    const now = new Date();
    const status = observingStatus({ lastNight: obs.lastAlertNight, today: now, windows: obs.windows ?? [] });
    const lines = statusText(status) ?? [];
    const parts = lines.map((line) => el('p', { class: 'rubin-notice-status' }, line));
    /* The newest status post on Rubin's forum, found by the collector; else the link the
       announced window carries. */
    const post = obs.latestPost;
    const link = post?.url ?? (status.window ?? status.returned)?.link;
    if (link && (status.offSky || status.returned || status.window)) {
        const more = el('p', { class: 'rubin-notice-link' });
        more.append(el('a', { href: link, target: '_blank', rel: 'noopener' }, post ? `Rubin's latest status post: ${post.title} (${longDate(post.date)})` : "Rubin's latest announcement"));
        parts.push(more);
    }
    for (const line of updateText(nextUpdates({ now, status, finkFetchedMonth: obs.finkFetchedMonth }))) {
        parts.push(el('p', { class: 'rubin-notice-update' }, line));
    }
    box.classList.toggle('rubin-notice-off-sky', status.offSky);
    box.replaceChildren(...parts);
    box.hidden = false;
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

    showNotice(digest);

    const offset = offsetText(digest);
    const offsetLine = document.getElementById('rubin-offset');
    if (offset) { offsetLine.textContent = offset; offsetLine.hidden = false; }

    earthNow = knownWorlds(digest).find((w) => w.name === 'Earth')?.now ?? null;
    const { passes, watch, largeIfDark } = sections(digest);
    document.getElementById('rubin-passes').hidden = false;
    buildPicker('rubin-passes', knownRow(digest), { onMap: true, group: '.rubin-known' });
    buildPicker('rubin-passes', passes, { onMap: true, group: '.rubin-likely' });
    buildPicker('rubin-watch', watch, { onMap: true, extra: (e) => ({ extra: whyWatched(e) }) });
    buildPicker('rubin-dark', largeIfDark);
    drawMap(digest);
    drawFarEdge(digest);

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
