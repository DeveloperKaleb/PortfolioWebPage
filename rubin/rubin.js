/* The Rubin tab: reads the latest digest from the rubin-data repo and puts it on the
 * page - the cards, the map and the chart. What to show and the geometry are worked out
 * in js/rubinview.js; this file only builds the DOM.
 *
 * Data from the digest goes in with textContent, never innerHTML. Every chart mark has a
 * hit target of at least 24px and the same details on keyboard focus as on hover, and
 * every chart has a table view beside it. Colours are RUBIN_COLORS (js/rubincolors.js), held
 * to the site's contrast rules by tests/contrast.
 *
 * Offline, or if the data repo cannot be reached, it shows the last digest this browser
 * saw, and says so.
 */
import {
    DIGEST_URL, CHANGES_URL, SPACECRAFT_URL, FILTER_FROM, matchesQuery, initialView, zoomAt, panBy, toWorld, ringRadii, ringLabel, ringLabelSpot, glideView, journeyView, unseenHoles,
    projector, FLAT, TILT_3D, turnBy, ringStretch, orbitOnMap, centredOn, atHome,
    zoomLevel, MAP_ZOOM, maxZoomOf, mapSizeFor, fullScreenSizeFor, resizedView, PLANET_DRAW_PX, PLANET_LABEL_PX, MOON_DRAW_PX, planeText, summary, sections, displayName, sizeOf, flagsOf,
    whyWatched, changeText, chartData, mapData, percent, kilometres, au, longDate, CHART_RANGE, discoveryText,
    rubinStatus, brightnessText, crossCheckText, offsetText, KIND_LABEL, properName, placeLabels, nasaImages, knownRow, knownWorlds, isKnownShape,
    sizeRange, STAR_SIZES, sizeLineup, lineupText, lineupSubjects, LINEUP_PX,
} from '../js/rubinview.js';
import {
    lightTravelledAU, durationText, milestones, lightSentence, sunlightText, rulerFraction, fromStarFraction, rulerTicks, unseenStretch, CENTAURI, UNSEEN_TEXT, UNSEEN_FROM_AU, firstVisit, hasEarlierVisit, scaleToShow, lightTickMs,
} from '../js/light.js';
import { SCOPE_AU, jdFromDate } from '../js/orbit.js';
import { itemsOf, groupState, readShown, craftOn, craftPath, clusterMarks, PLACE_WORDS, STATUS_AS_OF } from '../js/spacecraft.js';
import { TRACKS, TRACKS_FETCHED } from '../js/spacecrafttracks.js';
import {
    EXPLANATIONS, PUBLISHED, DIAL, dialRadius, dialXY, yearFraction, bunchingText, thinText, splitNamesText, waitingCountText, evidenceText, publishedText,
} from '../js/faredge.js';
import { RUBIN_COLORS as C, STAR_TYPE_COLORS } from '../js/rubincolors.js';
import { centauriOn, places, proximaOrbit, SYSTEMS, NEIGHBOURS, planetSummary, starKind, memberTypeText, systemTypeText, findSystems, GO_KINDS, kindsOf, filterSystems, AU_PER_LIGHT_YEAR, seenNearOf, seenNearOfPair, SAG_A, towardSagA, farDistanceText, farPlaneText, AU_PER_PARSEC, skyToMap } from '../js/centauri.js';
import { funFact } from '../js/funfacts.js';
import { paintSky, skyBasis } from '../js/milkyway.js';
import { decodeTile, tileName, magOf } from '../js/startiles.js';
import {
    treeOf, tilesToDraw, frontierOf, frontierLimit, glowOf, lookOf, tintOf, magLimitOf, nearestStar, starRows, STREET_PC, BLOCK_PC, NEIGHBORHOOD_PC, GAIA_BH1, GAIA_BH1_ROWS, GAIA_BH1_SYSTEM, GAIA_BH1_VIEW_PC, gaiaBh1Pc,
} from '../js/starview.js';
import { observingStatus, nextUpdates, statusText, updateText } from '../js/rubinstatus.js';

const SVG = 'http://www.w3.org/2000/svg';
const CACHE_KEY = 'rubin-digest';
const tooltip = document.getElementById('rubin-tooltip');

/* The light rings on the map (js/light.js) start from two moments: when this page opened,
   and when this browser first opened it. The second is kept in this browser's storage
   and sent nowhere; where storage is blocked there is just the one ring. The first is kept
   for this tab only (sessionStorage), so a phone that reloads the page while it is locked
   does not start this visit's light again (owner, 2026-11-18). */
const OPENED = (() => {
    const now = Date.now();
    try {
        const opened = firstVisit(sessionStorage.getItem('rubin-visit-opened'), now);
        sessionStorage.setItem('rubin-visit-opened', String(opened));
        return opened;
    } catch { return now; /* storage blocked: this load is the visit */ }
})();
const FIRST_KEY = 'rubin-first-visit';
/* Whether the map draws the Milky Way behind it, its AU rings, its hatching and, in 3D, its
   plane lines: all unless this browser was told otherwise. */
const SHOWN_KEY = 'rubin-map-shown';
const shown = { milkyWay: true, rings: true, hatching: true, planeLines: true };
try {
    const saved = JSON.parse(localStorage.getItem(SHOWN_KEY));
    for (const key of Object.keys(shown)) if (typeof saved?.[key] === 'boolean') shown[key] = saved[key];
} catch { /* none saved, or storage blocked */ }
/* Which human spacecraft the map draws (owner, 2026-11-19): none until asked for, kept
   apart from Show, and remembered in this browser like it. */
const CRAFT_KEY = 'rubin-map-craft';
let craftShown = new Set();
try { craftShown = readShown(JSON.parse(localStorage.getItem(CRAFT_KEY))); } catch { /* none saved, or storage blocked */ }
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

/* The short name of a system's member beside the other: "A" for Alpha Centauri A. */
const shortName = (system, member) => member.name.replace(system.name, '').trim() || member.name;
const apartFrom = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
/* A member's planets for the stars table: the confirmed, how far out; each candidate. */
function planetsText(system, member) {
    const mine = (system.planets ?? []).filter((o) => o.star === member.id);
    const sure = mine.filter((o) => o.status === 'confirmed');
    const words = [];
    if (sure.length) words.push(`${COUNT_WORDS[sure.length] ?? sure.length} planet${sure.length > 1 ? 's' : ''}, ${sure.map((o) => o.a.toFixed(3)).join(', ')} AU out`);
    for (const o of mine.filter((p) => p.status === 'candidate')) words.push(`a candidate planet about ${o.a} AU out, unconfirmed`);
    return words.join('; ');
}

/* Hover alone, for parts of a control that is itself the thing focused and spoken (the
   pieces of a "Go to" symbol): the control's own label carries the same words. */
function hoverDetails(target, rows) {
    target.addEventListener('pointermove', (e) => showTooltip(rows, e.clientX, e.clientY));
    target.addEventListener('pointerleave', hideTooltip);
}

/* The Sun's own, for its row in "Go to". */
const SUN_PLANETS = { confirmed: 8, candidates: 0, rows: [['Eight planets:', 'Mercury out to Neptune']], text: 'Eight planets: Mercury out to Neptune' };
/* A system's planets in "Go to": a ring with a planet on it, solid for confirmed, dashed
   for candidates only, and the counts. */
function planetMark(known) {
    const box = el('span', { class: 'rubin-map-go-planets', 'aria-hidden': 'true' });
    const icon = svg('svg', { width: 14, height: 14, viewBox: '0 0 14 14' });
    icon.append(svg('circle', { cx: 7, cy: 7, r: 5, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2, 'stroke-dasharray': known.confirmed ? 'none' : '2 2' }));
    icon.append(svg('circle', { cx: 10.5, cy: 3.5, r: 1.8, fill: 'currentColor' }));
    box.append(icon, `${known.confirmed || ''}${known.candidates ? `${known.confirmed ? '+' : ''}${known.candidates}?` : ''}`);
    hoverDetails(box, known.rows);
    return box;
}

/* A system's symbol in "Go to" (owner, 2026-11-18): a cap at the left end of its row, as
   tall as the row, cut into one band per member from the top, each with its own hover.
   Each band is coloured for its member's type and textured for it (CAP_TEXTURES): stars
   filled, tundrs and white dwarfs dark with the texture in their colour. */
const CAP_W = 24;
const CAP_H = 34;
/* Textures, from what each kind looks like close up: the Sun's fine granulation, coarser
   on an orange dwarf; a red dwarf's starspots; a tundr's cloud bands, as on Jupiter; a white
   dwarf's dense grain; a hot white star smooth but for a faint sheen. Drawn over the colour,
   so the colour still says the type; the texture says it again for anyone who cannot tell
   the colours apart. Each is [pattern size, its marks]. */
const CAP_TEXTURES = {
    yellow: [4, [['circle', { cx: 1, cy: 1, r: 0.8 }], ['circle', { cx: 3, cy: 3, r: 0.8 }]]],
    orange: [6, [['circle', { cx: 1.5, cy: 1.5, r: 1.3 }], ['circle', { cx: 4.5, cy: 4.5, r: 1.3 }]]],
    red: [10, [['circle', { cx: 3, cy: 3, r: 2 }], ['circle', { cx: 7.5, cy: 7, r: 1.2 }], ['circle', { cx: 8, cy: 2, r: 0.7 }]]],
    tundr: [4, [['rect', { x: 0, y: 0, width: 4, height: 1.6 }]]],
    dwarf: [2, [['circle', { cx: 1, cy: 1, r: 0.55 }]]],
    white: [6, [['path', { d: 'M0,6L6,0', 'stroke-width': 0.8, fill: 'none' }]]],
};
/* The patterns and the cap's outline are drawn once, in a hidden picture every symbol
   refers to. */
let capDefs = null;
function ensureCapDefs() {
    if (capDefs) return;
    capDefs = svg('svg', { width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' });
    const defs = svg('defs');
    const clip = svg('clipPath', { id: 'rubin-go-cap' });
    clip.append(svg('rect', { x: 0.5, y: 0.5, width: CAP_W - 1, height: CAP_H - 1, rx: 7 }));
    defs.append(clip);
    for (const [kind, [size, marks]] of Object.entries(CAP_TEXTURES)) {
        /* Stars: dark marks on the colour. Tundrs and white dwarfs: the colour on dark. */
        const onDark = kind === 'tundr' || kind === 'dwarf';
        const ink = onDark ? STAR_TYPE_COLORS[kind === 'dwarf' ? 'white' : kind] : C.space;
        const pattern = svg('pattern', { id: `rubin-go-tex-${kind}`, width: size, height: size, patternUnits: 'userSpaceOnUse' });
        for (const [tag, attrs] of marks) pattern.append(svg(tag, { fill: ink, stroke: ink, 'stroke-width': 0, opacity: onDark ? 0.9 : 0.4, ...attrs }));
        defs.append(pattern);
    }
    capDefs.append(defs);
    document.body.append(capDefs);
}
function starSymbol(system) {
    ensureCapDefs();
    const box = svg('svg', { class: 'rubin-map-go-symbol', width: CAP_W, height: CAP_H, viewBox: `0 0 ${CAP_W} ${CAP_H}`, 'aria-hidden': 'true' });
    const cap = svg('g', { 'clip-path': 'url(#rubin-go-cap)' });
    const n = system.members.length;
    const band = CAP_H / n;
    system.members.forEach((member, k) => {
        const { colour, shape } = starKind(member.type);
        const texture = shape === 'dot' ? 'dwarf' : colour;
        const piece = svg('g', { class: 'rubin-map-go-piece' });
        const at = { x: 0, y: k * band, width: CAP_W, height: band };
        piece.append(svg('rect', { ...at, fill: shape === 'disc' ? STAR_TYPE_COLORS[colour] : C.space }));
        /* A black hole or neutron star: dark, with nothing on it, only its ring (below). */
        if (shape !== 'hole') piece.append(svg('rect', { ...at, fill: `url(#rubin-go-tex-${texture})` }));
        hoverDetails(piece, [[member.name, memberTypeText(member)]]);
        cap.append(piece);
    });
    /* A dark line between bands; and each dark band (a tundr or white dwarf) outlined in its
       own colour, as its ring is on the map, so two dark bands read as two. */
    for (let k = 1; k < n; k++) cap.append(svg('line', { x1: 0, x2: CAP_W, y1: k * band, y2: k * band, stroke: C.space, 'stroke-width': 1.5, 'pointer-events': 'none' }));
    box.append(cap);
    system.members.forEach((member, k) => {
        const { colour, shape } = starKind(member.type);
        if (shape === 'disc') return;
        box.append(svg('rect', {
            x: 0.75, y: k * band + 0.75, width: CAP_W - 1.5, height: band - 1.5, rx: Math.min(6.5, band / 2 - 1),
            fill: 'none', stroke: STAR_TYPE_COLORS[colour], 'stroke-width': 1.5, 'pointer-events': 'none',
        }));
    });
    return box;
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
/* The map redraws on any change, since a picked object's orbit is drawn on it, and the
   sizes under it show the object picked last. */
let onPick = (designation, on) => {};
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
    onPick(designation, on);
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

/* A spacecraft: a body between two panels. Working, filled; no longer working, hollow and
   fainter, so the two are told apart by shape as well as colour. */
function craftGlyph(cx, cy, active) {
    const look = active
        ? { fill: C.text, stroke: C.space, 'stroke-width': 1.5 }
        : { fill: C.space, stroke: C.muted, 'stroke-width': 1.5 };
    const g = svg('g', { 'pointer-events': 'none' });
    g.append(svg('line', { x1: cx - 7, y1: cy, x2: cx + 7, y2: cy, stroke: active ? C.text : C.muted, 'stroke-width': 1.5 }));
    for (const side of [-1, 1]) g.append(svg('rect', { x: cx + side * 6.5 - 2.5, y: cy - 4, width: 5, height: 8, ...look }));
    g.append(svg('rect', { x: cx - 3, y: cy - 3, width: 6, height: 6, ...look }));
    return g;
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

/* Gaia's stars behind the map's marks (step 2 of "Gaia's stars", NOTES.md): WebGL on a
   canvas under the map's SVG, fed tiles (js/startiles.js) as the view needs them
   (tilesToDraw, js/starview.js). base: where index.json and the tiles are. Draws with the
   map's own projection (projector, js/rubinview.js): each tile's centre is placed relative
   to the view's middle in full precision here, and only the stars' small offsets within
   their tile go to the graphics card, whose numbers are 32-bit. Returns null where WebGL
   is not to be had; the map is then as it was. */
function starLayer(canvas, base, redraw) {
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return null;
    const shader = (type, source) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, source);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
    };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, `
        attribute vec3 local;
        attribute vec4 tint;
        attribute float size;
        attribute float mag;
        uniform float magLimit;
        uniform float glow;
        uniform vec3 offset;
        uniform vec4 turn;
        uniform float scale;
        uniform vec3 centrePc;
        uniform float streetPc;
        uniform float outerPc;
        uniform float dpr;
        varying vec4 v;
        void main() {
            vec3 d = offset + local * ${AU_PER_PARSEC.toFixed(4)};
            float across = d.x * turn.x - d.y * turn.y;
            float up = (d.x * turn.y + d.y * turn.x) * turn.z + d.z * turn.w;
            float fromSun = length(centrePc + local);
            bool hidden = fromSun < streetPc || fromSun > outerPc || mag > magLimit;
            gl_Position = hidden ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(across * scale, up * scale, 0.0, 1.0);
            gl_PointSize = size * dpr;
            v = vec4(tint.rgb, tint.a * glow);
        }`));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        varying vec4 v;
        void main() {
            vec2 p = gl_PointCoord * 2.0 - 1.0;
            float r = dot(p, p);
            if (r > 1.0) discard;
            float a = v.a * (1.0 - r * r);
            gl_FragColor = vec4(v.rgb * a, a);
        }`));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    const where = Object.fromEntries(['local', 'tint', 'size', 'mag'].map((n) => [n, gl.getAttribLocation(program, n)]));
    const uniform = Object.fromEntries(['offset', 'turn', 'scale', 'centrePc', 'streetPc', 'outerPc', 'magLimit', 'glow', 'dpr'].map((n) => [n, gl.getUniformLocation(program, n)]));
    /* Each star's look, by its brightness and colour bytes, worked out once. */
    const looks = Array.from({ length: 256 }, (_, k) => lookOf(k));
    const tints = Array.from({ length: 256 }, (_, k) => tintOf(k));

    let tree = null;
    const tiles = new Map();
    let loading = 0;
    const MAX_LOADING = 6;
    let wanted = [];
    let limit = 99;
    let outerPc = 0;
    fetch(`${base}/index.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))).then((index) => {
        tree = treeOf(index);
        redraw();
    }).catch(() => {});
    const load = (path) => {
        const node = tree.get(path);
        tiles.set(path, { state: 'loading' });
        loading++;
        fetch(`${base}/${tileName(path)}`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`)))).then((buffer) => {
            const { count, xyz, mag, colour } = decodeTile(new Uint8Array(buffer), node.cube);
            const { cx, cy, cz } = node.cube;
            /* Per star: x, y, z within the tile (parsecs), size, then absolute magnitude; tint
               as four bytes. */
            const floats = new Float32Array(count * 5);
            const bytes = new Uint8Array(count * 4);
            for (let k = 0; k < count; k++) {
                floats.set([xyz[k * 3] - cx, xyz[k * 3 + 1] - cy, xyz[k * 3 + 2] - cz, looks[mag[k]].size, magOf(mag[k])], k * 5);
                const t = tints[colour[k]];
                bytes.set([t[0] * 255, t[1] * 255, t[2] * 255, looks[mag[k]].alpha * 255], k * 4);
            }
            const position = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, position);
            gl.bufferData(gl.ARRAY_BUFFER, floats, gl.STATIC_DRAW);
            const tint = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, tint);
            gl.bufferData(gl.ARRAY_BUFFER, bytes, gl.STATIC_DRAW);
            /* The stars themselves are kept too, for pointing at one (nearestStar). */
            tiles.set(path, { state: 'ready', count, position, tint, cube: node.cube, xyz, mag, colour, faintest: count ? magOf(Math.max(...mag)) : undefined });
        }).catch(() => tiles.set(path, { state: 'failed' })).finally(() => {
            loading--;
            redraw();
        });
    };
    /* Tiles not wanted for a while are let go once more than this many stars are held. */
    const HOLD_STARS = 1200000;
    const forget = () => {
        let held = 0;
        for (const t of tiles.values()) if (t.state === 'ready') held += t.count;
        if (held <= HOLD_STARS) return;
        const keep = new Set(wanted);
        for (const [path, t] of tiles) {
            if (held <= HOLD_STARS) break;
            if (t.state !== 'ready' || keep.has(path)) continue;
            gl.deleteBuffer(t.position);
            gl.deleteBuffer(t.tint);
            tiles.delete(path);
            held -= t.count;
        }
    };
    return {
        /* The star drawn at a point of the picture, as hover rows; null if none. */
        pick(view, cam, x, y) {
            if (!outerPc) return null;
            const ready = wanted.map((p) => tiles.get(p)).filter((t) => t?.state === 'ready');
            const hit = nearestStar(ready, view, projector(view, cam), x, y, { outerPc, magLimit: limit });
            return hit && starRows(hit, hit.tile.mag[hit.k], hit.tile.colour[hit.k]);
        },
        /* outer: the place's edge in parsecs; 0 draws none (the street and nearer). */
        draw(view, cam, outer) {
            outerPc = outer;
            const dpr = window.devicePixelRatio || 1;
            const w = Math.round(canvas.clientWidth * dpr);
            const h = Math.round(canvas.clientHeight * dpr);
            if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
            gl.viewport(0, 0, w, h);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            if (!tree || !outerPc) { wanted = []; return; }
            const project = projector(view, cam);
            wanted = tilesToDraw(tree, view, project, { outerPc });
            limit = frontierLimit(frontierOf(tree, wanted, view, project, outerPc), (p) => tiles.get(p)?.faintest, magLimitOf(outerPc));
            for (const path of wanted) if (!tiles.has(path) && loading < MAX_LOADING) load(path);
            gl.useProgram(program);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE);
            gl.uniform4f(uniform.turn, Math.cos(cam.turn), Math.sin(cam.turn), Math.cos(cam.tilt), Math.sin(cam.tilt));
            gl.uniform1f(uniform.scale, view.scale / (view.sizePx / 2));
            gl.uniform1f(uniform.streetPc, STREET_PC);
            gl.uniform1f(uniform.outerPc, outerPc);
            gl.uniform1f(uniform.magLimit, limit);
            /* How many stars pass the cut, for dimming them all alike (glowOf). */
            let shown = 0;
            for (const path of wanted) {
                const t = tiles.get(path);
                if (t?.state !== 'ready') continue;
                for (let k = 0; k < t.count; k++) if (magOf(t.mag[k]) <= limit) shown++;
            }
            gl.uniform1f(uniform.glow, glowOf(shown, view, outerPc));
            gl.uniform1f(uniform.dpr, dpr * canvas.clientWidth / view.sizePx);
            for (const path of wanted) {
                const t = tiles.get(path);
                if (t?.state !== 'ready') continue;
                const { cx, cy, cz } = t.cube;
                gl.uniform3f(uniform.offset, cx * AU_PER_PARSEC - view.cx, cy * AU_PER_PARSEC - view.cy, cz * AU_PER_PARSEC - (view.cz ?? 0));
                gl.uniform3f(uniform.centrePc, cx, cy, cz);
                gl.bindBuffer(gl.ARRAY_BUFFER, t.position);
                gl.enableVertexAttribArray(where.local);
                gl.vertexAttribPointer(where.local, 3, gl.FLOAT, false, 20, 0);
                gl.enableVertexAttribArray(where.size);
                gl.vertexAttribPointer(where.size, 1, gl.FLOAT, false, 20, 12);
                gl.enableVertexAttribArray(where.mag);
                gl.vertexAttribPointer(where.mag, 1, gl.FLOAT, false, 20, 16);
                gl.bindBuffer(gl.ARRAY_BUFFER, t.tint);
                gl.enableVertexAttribArray(where.tint);
                gl.vertexAttribPointer(where.tint, 4, gl.UNSIGNED_BYTE, true, 4, 0);
                gl.drawArrays(gl.POINTS, 0, t.count);
            }
            forget();
        },
    };
}

function drawMap(digest) {
    const section = document.getElementById('rubin-map');
    /* The map shows where everything is as the page opens (owner, 2026-11-19), not on the
       digest's date: the planets, moons, stars and spacecraft are worked out for this
       moment, and the digest's objects are moved along their orbits to it (mapEntry). */
    const mapMoment = new Date();
    const MAP_DAY = `${mapMoment.getUTCFullYear()}-${String(mapMoment.getUTCMonth() + 1).padStart(2, '0')}-${String(mapMoment.getUTCDate()).padStart(2, '0')}`;
    const data = mapData(digest, { jd: jdFromDate(mapMoment) });
    if (!data.marks.length) { section.hidden = true; return; }
    /* Drawn at the width it is shown (mapSizeFor); the stylesheet sets the same width. Full
       screen draws it again, larger (resize). */
    let SIZE = mapSizeFor(document.documentElement.clientWidth);
    /* The ruler keeps the size it was made at: full screen leaves it out. */
    const RULER_SIZE = SIZE;
    let view = initialView(data.radius, SIZE);
    /* The nearest star system on the digest's date, in the map's own frame, and the three
       places the map can be: at the Sun, at Alpha Centauri, and far enough back to hold
       both (js/centauri.js). */
    const system = centauriOn(yearFraction(MAP_DAY));
    const PLACES = places(system, data.radius, data.radius3D);
    /* Gaia's stars (NOTES.md, "Gaia's stars"): only in a preview, given ?stars=<folder of
       tiles>, until the tiles have a home (step 3). The preview adds the Galactic block, the
       Local Bubble's scale, so there is room to see them: the street ends where they
       begin. */
    const STARS_URL = params.get('stars');
    if (STARS_URL) {
        const r = BLOCK_PC * AU_PER_PARSEC;
        PLACES.block = { id: 'block', name: 'the galactic block', label: 'Galactic block (preview)', cx: 0, cy: 0, cz: 0, radiusAU: r, radius3D: r, beyondStreet: true, starsPc: BLOCK_PC };
        /* And the neighborhood, the next rung, out to a thousand parsecs: far enough to hold
           Gaia BH1 (owner, 2026-11-19), 477 parsecs out. */
        const n = NEIGHBORHOOD_PC * AU_PER_PARSEC;
        PLACES.neighborhood = { id: 'neighborhood', name: 'the galactic neighborhood', label: 'Galactic neighborhood (preview)', cx: 0, cy: 0, cz: 0, radiusAU: n, radius3D: n, beyondStreet: true, starsPc: NEIGHBORHOOD_PC };
    }
    /* Gaia BH1, the nearest black hole known, where it is on the map; with the stars only. */
    const BH1 = STARS_URL ? (() => { const [x, y, z] = skyToMap(GAIA_BH1.ra, GAIA_BH1.dec, gaiaBh1Pc() * AU_PER_PARSEC); return { x, y, z }; })() : null;
    /* Gaia BH1 is a place "Go to" lists (owner, 2026-11-19: found by searching, not by an
       arrow): its own view, a hundred parsecs about it, with the neighborhood's stars. */
    if (BH1) {
        const r = GAIA_BH1_VIEW_PC * AU_PER_PARSEC;
        PLACES.gaiabh1 = { id: 'gaiabh1', name: 'Gaia BH1', label: 'Gaia BH1', cx: BH1.x, cy: BH1.y, cz: BH1.z, radiusAU: r, radius3D: r, beyondStreet: true, starsPc: NEIGHBORHOOD_PC };
    }
    /* What "Go to" lists: every system, and Gaia BH1 with the stars. */
    const GO_SYSTEMS = BH1 ? [...SYSTEMS, GAIA_BH1_SYSTEM] : SYSTEMS;
    /* Flat, or 3D (owner, 2026-11-16): the camera that turns and tips the map
       (js/rubinview.js). In 3D a drag turns it instead of moving it, zooming keeps to the
       middle, and each place is fitted to its bodies' true distances. */
    let threeD = false;
    let cam = FLAT;
    const homeView = (p) => initialView(threeD ? p.radius3D : p.radiusAU, SIZE, [p.cx, p.cy, p.cz]);
    let place = PLACES.sun;
    /* The animation frame of a journey under way, or 0, and how to finish it at once. */
    let travelling = 0;
    let arrive = () => {};
    /* Whether the map fills the screen. */
    let filling = false;
    /* Picking something on the map centres the map on it and draws its orbit (owner,
       2026-11-16). Objects with cards share the cards' selection; the stars and Luhman 16's
       tundrs, which have none, are kept here. */
    const bodiesPicked = new Set();
    const isPicked = (key) => selected.has(key) || bodiesPicked.has(key);
    /* The animation frame of a glide to centre a picked body, or 0. */
    let centring = 0;
    const orbits = new Map();
    const orbitFor = (entry) => {
        if (!orbits.has(entry.designation)) orbits.set(entry.designation, orbitOnMap(entry));
        return orbits.get(entry.designation);
    };
    /* What can be drawn of each body's orbit without a card: its path or paths, or a note
       saying why not, for every neighbour (NEIGHBOURS in js/centauri.js). A pair's members
       trace their orbit about each other; a lone star orbits only the centre of the galaxy,
       far off this map; Proxima's orbit about A and B is known only roughly. A whole
       system drawn as one dot is its pair, if it has one. */
    const PROXIMA = proximaOrbit(system);
    const PICKABLE = (() => {
        const galaxy = 'orbits the galaxy, far off this map';
        const out = { 'body:sun': { body: { x: 0, y: 0, z: 0 }, note: galaxy } };
        for (const on of system.systems) {
            const s = on.system;
            for (const { pair, centre, a, b, paths } of on.pairs) {
                out[`body:${pair.key}`] = { body: centre, paths: [paths.a, paths.b] };
                out[`body:${pair.a}`] = { body: a, paths: [paths.a] };
                out[`body:${pair.b}`] = { body: b, paths: [paths.b] };
            }
            /* A close group is one mark; picking any of it picks the mark. */
            for (const { group, centre } of on.groups) {
                const pick = { body: centre, note: 'too close together to draw their orbits here' };
                out[`body:${group.key}`] = pick;
                for (const id of group.members) out[`body:${id}`] = pick;
            }
            for (const m of on.lone) {
                const body = on.at.get(m.id);
                /* Roughly known, so dashed. */
                out[`body:${m.id}`] = m.roughOrbit ? { body, paths: [PROXIMA.path], dashed: true }
                    : { body, note: m.sky ? `orbits ${s.centreName}; the orbit is not known` : galaxy };
            }
            out[`body:${s.id}`] ??= on.pairs.length ? { ...out[`body:${on.pairs[0].pair.key}`] } : { body: on.centre, note: galaxy };
        }
        if (BH1) out['body:gaiabh1'] = { body: BH1, note: 'orbits the galaxy, far off this map' };
        return out;
    })();
    /* A neighbour's "Zoom on" step as a view, from its rungs. */
    const rungView = (id, rung) => closeUp(PICKABLE[`body:${rung.on}`].body, rung.radiusAU, PLACES[id]);
    const rungsOf = (id) => system.systems.find((on) => on.system.id === id)?.system.rungs ?? [];
    /* Which way the centre of the galaxy is, along the map's plane. */
    const SAG_A_WAY = towardSagA();
    /* Human spacecraft where they are now (js/spacecraft.js). Picked, a
       free-flying one shows its path - its orbit, or its track as fetched - and one that
       stays with a body is centred on. */
    const mapJd = data.jd;
    let craftTracks = TRACKS;
    let crafts = null;
    const placeCraft = () => {
        crafts = craftOn(mapJd, data.planets, data.moons, craftTracks);
        for (const key of Object.keys(PICKABLE)) if (key.startsWith('craft:')) delete PICKABLE[key];
        for (const c of crafts.shown) {
            const path = c.place ? null : craftPath(c.item.id, mapJd, craftTracks);
            PICKABLE[`craft:${c.item.id}`] = { body: c, paths: path ? [path] : [], open: true };
        }
    };
    placeCraft();
    /* The collector refreshes the tracks monthly into rubin-data (spacecraft.json): fetched
       once, and only once a reader turns a craft on, since most never do. Until it comes,
       or if it cannot, the tracks built into the site stand. */
    let craftTracksAsked = false;
    async function fetchCraftTracks() {
        if (craftTracksAsked) return;
        craftTracksAsked = true;
        try {
            const got = await getJson(params.get('spacecraft') ?? SPACECRAFT_URL);
            const fresh = Object.entries(got?.tracks ?? {}).filter(([id, t]) => Object.hasOwn(TRACKS, id) && (t?.elements || Array.isArray(t?.xyz)));
            if (!fresh.length) return;
            craftTracks = { ...TRACKS, ...Object.fromEntries(fresh) };
            placeCraft();
            syncCraft();
            render();
        } catch { /* offline, or not there yet: the built-in tracks stay */ }
    }
    /* A whole system is drawn as one dot once its map is smaller than this on screen. (At
       14, pulled back to the nearest bodies, Alpha Centauri came out as two dots with one
       name between them.) */
    const SYSTEM_DOT_PX = 20;
    /* How far from the Sun the middle of the map must be to count as in another star system,
       for the arrow toward Earth: well past the Sun's own map, and short of the nearest star. */
    const ELSEWHERE_AU = 10000;
    const plot = svg('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'rubin-svg rubin-map-svg', role: 'group', 'aria-label': 'Map of the listed objects, the Sun, the planets and the tundrs, seen from above, reaching to every star system within a million AU' });
    /* The map's hatching is finer and fainter than the ruler's: it covers far more. */
    const mapHatch = svg('pattern', { id: 'rubin-unseen-map', width: 9, height: 9, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    mapHatch.append(svg('line', { x1: 0, y1: 0, x2: 0, y2: 9, stroke: C.muted, 'stroke-width': 1, opacity: 0.55 }));
    /* The map is the whole square, dark to its edges, and the hatching with it (owner,
       2026-11-18: the round window it had, fading to the page's brown, is gone now the
       Milky Way is behind the map). */
    /* The Milky Way behind the map (js/milkyway.js), as the sky beyond it: its picture,
       once loaded, is painted small and stretched over the map's ground, since it is soft
       anyway, and painted again only when the map turns. */
    const SKY_PX = 160;
    const skyCanvas = el('canvas', { width: SKY_PX, height: SKY_PX });
    let skyTexture = null;
    let skyKey = '';
    const skyPicture = new Image();
    skyPicture.addEventListener('load', () => {
        const page = el('canvas', { width: skyPicture.naturalWidth, height: skyPicture.naturalHeight });
        const pen = page.getContext('2d');
        pen.drawImage(skyPicture, 0, 0);
        skyTexture = pen.getImageData(0, 0, page.width, page.height);
        render();
    });
    skyPicture.src = 'milkyway.png';
    const paintSkyNow = () => {
        const key = shown.milkyWay && skyTexture ? `${cam.turn.toFixed(4)},${cam.tilt.toFixed(4)}` : 'off';
        if (key === skyKey) return;
        skyKey = key;
        if (key === 'off') { frame.style.removeProperty('--map-sky'); return; }
        const pen = skyCanvas.getContext('2d');
        const image = pen.createImageData(SKY_PX, SKY_PX);
        paintSky(image, skyTexture, cam);
        pen.putImageData(image, 0, 0);
        frame.style.setProperty('--map-sky', `url(${skyCanvas.toDataURL()})`);
    };
    const mapDefs = svg('defs');
    mapDefs.append(mapHatch);
    plot.append(mapDefs);
    const layer = svg('g');
    /* The light rings are drawn over the map on their own layer, so they can move without
       the marks being rebuilt under a pointer. Decoration: the words under the map say
       the same, and the layer takes no clicks. */
    const lightLayer = svg('g', { class: 'rubin-light', 'aria-hidden': 'true' });
    plot.append(layer, lightLayer);
    /* The map's picture is three layers in a frame: the Milky Way as the frame's background,
       Gaia's stars on a canvas over it, and the map's SVG on top, clear, taking every click. */
    const frame = el('div', { class: 'rubin-map-frame' });
    const starCanvas = el('canvas', { class: 'rubin-map-stars', 'aria-hidden': 'true' });
    frame.append(starCanvas, plot);
    let stars = null;
    /* Each place its own stars (owner, 2026-11-19): out to the place's edge; none of Gaia's
       at the street or nearer. */
    const starsOut = () => (place.beyondStreet ? place.starsPc : 0);
    if (STARS_URL) {
        try { stars = starLayer(starCanvas, STARS_URL.replace(/\/$/, ''), () => stars?.draw(view, cam, starsOut())); } catch { stars = null; }
    }

    const RULER_HEIGHT = 88;
    const ruler = svg('svg', { viewBox: `0 0 ${RULER_SIZE} ${RULER_HEIGHT}`, class: 'rubin-svg rubin-ruler', role: 'group', 'aria-label': `A ruler from the Sun to ${CENTAURI.name}, the nearest star system` });
    const lightNow = el('p', { class: 'rubin-light-text' });
    const lightFirst = el('p', { class: 'rubin-light-text' });
    const rulerNote = el('p', { class: 'rubin-note rubin-light-text' }, `The light is drawn as a ring on the map, at its true size and speed, and marked on the ruler above with how long ago it left. The ruler runs from the Sun to ${CENTAURI.name}, the pair of stars at the centre of the nearest star system, 4.34 light years away. Each step from the left is ten times further from the Sun, and each step from the right ten times further from that pair's centre of gravity, so the gap between is squeezed into the middle; it shows distance from each end, not direction. The hatched stretch runs from 1,000 AU from the Sun, beyond which nothing has yet been seen where it is, to ${CENTAURI.proxima.name}, the small third star that orbits the pair. ${UNSEEN_TEXT}.`);
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

    /* The ruler's fixed parts are drawn once. Each light then has a ring on the map and a
       mark on the ruler, made once and moved: the light is redrawn up to four times a
       second, and rebuilding all of this each time was most of the page's idle work. */
    const at = (fraction) => 8 + fraction * (RULER_SIZE - 16);
    const lineY = 46;
    /* The stretch where nothing has been seen where it is: hatched, a texture rather than
       a colour, 24px tall so it can be pointed at, and it says why on hover and on focus. */
    const hatch = svg('pattern', { id: 'rubin-unseen', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    hatch.append(svg('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: C.muted, 'stroke-width': 2 }));
    const defs = svg('defs');
    defs.append(hatch);
    const [unseenFrom, unseenTo] = unseenStretch().map(at);
    const unseen = svg('rect', { x: unseenFrom, y: lineY - 12, width: unseenTo - unseenFrom, height: 24, fill: 'url(#rubin-unseen)', class: 'rubin-unseen' });
    attachDetails(unseen, [[UNSEEN_TEXT]]);
    ruler.append(defs, unseen);
    ruler.append(svg('line', { x1: at(0), y1: lineY, x2: at(1), y2: lineY, stroke: C.muted, 'stroke-width': 1 }));
    for (const tick of rulerTicks()) {
        ruler.append(svg('line', { x1: at(tick), y1: lineY - 3, x2: at(tick), y2: lineY + 3, stroke: C.muted, 'stroke-width': 1 }));
    }
    /* Names in two rows, so neighbours do not collide on a phone. */
    const named = (fraction, row, text, anchor = 'middle') => {
        const x = at(fraction);
        ruler.append(svg('line', { x1: x, y1: lineY + 3, x2: x, y2: lineY + 8 + 14 * row, stroke: C.muted, 'stroke-width': 1 }));
        ruler.append(svg('text', { x, y: lineY + 20 + 14 * row, class: 'rubin-axis', 'text-anchor': anchor }, text));
    };
    named(0, 0, 'Sun', 'start');
    named(rulerFraction(1), 1, 'Earth');
    if (neptune) named(rulerFraction(neptune.r), 0, 'Neptune');
    named(unseenStretch()[0], 1, '1,000 AU');
    named(fromStarFraction(CENTAURI.proxima.fromCentreAU), 0, CENTAURI.proxima.name);
    named(1, 1, CENTAURI.name, 'end');
    lights.forEach((light, k) => {
        const labelRow = 14 + 14 * k;
        light.ring = svg('circle', { fill: 'none', stroke: C.text, 'stroke-width': 1.5, ...(light.dash ? { 'stroke-dasharray': light.dash } : {}) });
        light.ringLabel = svg('text', { class: 'rubin-label', 'text-anchor': 'end' }, `light, ${light.label}`);
        light.stem = svg('line', { y1: labelRow + 4, y2: lineY, stroke: C.text, 'stroke-width': 1, 'pointer-events': 'none' });
        light.dot = svg('circle', { cy: lineY, r: 4.5, fill: light.dash ? C.space : C.text, stroke: C.text, 'stroke-width': 1.5, 'pointer-events': 'none' });
        /* On the ruler each light says how long ago it left. */
        light.ago = svg('text', { y: labelRow, class: 'rubin-label', 'pointer-events': 'none' });
        lightLayer.append(light.ring, light.ringLabel);
        ruler.append(light.stem, light.dot, light.ago);
    });
    /* Only what has changed is written, so a redraw that moves nothing touches nothing. */
    const put = (node, attrs) => {
        for (const [name, value] of Object.entries(attrs)) {
            if (value === null) node.removeAttribute(name);
            else if (node.getAttribute(name) !== String(value)) node.setAttribute(name, value);
        }
    };
    const say = (node, text) => { if (node.textContent !== text) node.textContent = text; };

    /* Moves the light, and answers how fast the fastest thing it drew is moving, in pixels
       a second - which is what decides how soon it is worth drawing again. */
    function drawLight() {
        const now = Date.now();
        /* The light fills a ball, so in 3D too its edge is a circle of the same size. */
        const [sx, sy] = projector(view, cam)(0, 0, 0);
        const fromCentre = Math.hypot(sx - SIZE / 2, sy - SIZE / 2);
        let fastest = 0;
        for (const light of lights) {
            const travelled = lightTravelledAU(now - light.since);
            const r = travelled * view.scale;
            /* Drawn only where some of the ring crosses the picture. */
            const shown = r >= 1 && r < 1e6 && Math.abs(fromCentre - r) <= SIZE * 0.71;
            const labelY = sy - r - 4;
            put(light.ring, shown ? { cx: sx, cy: sy, r, display: null } : { display: 'none' });
            put(light.ringLabel, shown && r > 14 && labelY > 12 && labelY < SIZE && sx > 60 && sx < SIZE
                ? { x: sx - 4, y: labelY, display: null }
                : { display: 'none' });
            if (shown) fastest = Math.max(fastest, lightTravelledAU(1000) * view.scale);

            const x = at(rulerFraction(travelled));
            const left = x < RULER_SIZE / 2;
            put(light.stem, { x1: x, x2: x });
            put(light.dot, { cx: x });
            put(light.ago, { x: left ? x + 6 : x - 6, 'text-anchor': left ? 'start' : 'end' });
            say(light.ago, `${light.short}, ${durationText((now - light.since) / 1000)} ago`);
            fastest = Math.max(fastest, at(rulerFraction(travelled + lightTravelledAU(1000))) - x);
        }

        say(lightNow, lightSentence({ since: 'as you opened this page', elapsedSeconds: (now - OPENED) / 1000, travelledAU: lightTravelledAU(now - OPENED), sorted: stops, edge }));
        if (earlier) {
            say(lightFirst, `${lightSentence({ since: `when you first opened this page on ${firstDate}`, elapsedSeconds: (now - firstOpened) / 1000, travelledAU: lightTravelledAU(now - firstOpened), sorted: stops, edge })} (That date is kept in this browser and sent nowhere.)`);
        } else if (remembersVisits) {
            say(lightFirst, 'This browser will remember when you first opened this page, so on a later visit you can see how far that light has got. The time is kept on your device and sent nowhere.');
        }
        lightFirst.hidden = !lightFirst.textContent;
        return fastest;
    }
    /* Draws the light and books the next drawing for when something will have changed
       (lightTickMs): four times a second while anything is visibly moving, otherwise as
       each second turns over, and every ten seconds for a visitor who asked for less
       motion. Nothing runs while the tab is hidden or the map is scrolled out of view;
       coming back draws it at once. */
    let lightTimer = 0;
    let mapOnScreen = true;
    /* A redraw of the map moves the light with it (always), even while its timer is
       stopped: drawn only by the timer, a ring left behind sat beside whatever the map was
       then centred on (owner's phone, 2026-11-18, in full screen, where the section can
       count as off screen - so in full screen it never does). */
    function runLight({ always = false } = {}) {
        clearTimeout(lightTimer);
        if (document.hidden || !(mapOnScreen || filling)) { if (always) drawLight(); return; }
        const pxPerSecond = drawLight();
        const now = Date.now();
        lightTimer = setTimeout(runLight, lightTickMs({ ages: lights.map((light) => now - light.since), pxPerSecond, reduced: reducedMotion.matches }));
    }
    document.addEventListener('visibilitychange', runLight);
    reducedMotion.addEventListener('change', runLight);
    if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => { mapOnScreen = entries.at(-1).isIntersecting; runLight(); }).observe(section);
    }
    runLight();

    const flatButton = el('button', { type: 'button', class: 'rubin-tool', 'aria-pressed': 'true' }, 'Flat');
    /* "Show" (owner, 2026-11-18): what the map draws, as checkboxes in a small menu with
       room for more, each remembered in this browser where it lets us; and, at the Sun,
       Find the light. */
    const showItem = (key, text, title) => {
        const box = el('input', { type: 'checkbox' });
        box.checked = shown[key];
        box.addEventListener('change', () => {
            shown[key] = box.checked;
            try { localStorage.setItem(SHOWN_KEY, JSON.stringify(shown)); } catch { /* storage blocked: fine for this visit */ }
            hideTooltip();
            render();
        });
        const item = el('label', { class: 'rubin-map-show-item', title });
        item.append(box, el('span', {}, text));
        return { item, box };
    };
    const milkyWay = showItem('milkyWay', 'Milky Way', 'The sky beyond the map, as Gaia counts its stars, turning with the map in 3D');
    const rings = showItem('rings', 'AU rings', 'Circles of equal distance about the star nearest the middle, each with its distance');
    const hatching = showItem('hatching', 'Hatching', 'Where nothing has been seen yet');
    const planeLines = showItem('planeLines', 'Plane lines (3D)', "Lines from each body down to the plane of Earth's orbit, in 3D");
    const threeDButton = el('button', { type: 'button', class: 'rubin-tool', 'aria-pressed': 'false' }, '3D');
    const zoomIn = el('button', { type: 'button', class: 'rubin-tool', 'aria-label': 'Zoom in' }, '+');
    const zoomOut = el('button', { type: 'button', class: 'rubin-tool', 'aria-label': 'Zoom out' }, '−');
    const reset = el('button', { type: 'button', class: 'rubin-tool' }, 'Whole map');
    const fullButton = el('button', { type: 'button', class: 'rubin-tool rubin-map-icon', 'aria-pressed': 'false', 'aria-label': 'Full screen', title: 'Full screen' });
    /* Four corners, out to fill the screen, in to leave it. */
    const fullIcon = (on) => {
        const icon = svg('svg', { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': 'true' });
        icon.append(svg('path', { d: on ? 'M6 1v5H1M10 1v5h5M6 15v-5H1M10 15v-5h5' : 'M1 6V1h5M15 6V1h-5M1 10v5h5M15 10v5h-5', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8 }));
        return icon;
    };
    fullButton.append(fullIcon(false));
    const readout = el('span', { class: 'rubin-zoom-readout', 'aria-live': 'polite' });

    /* Everything is redrawn from the view on each zoom or pan: rings, planets, objects.
       Marks keep their size in pixels at every zoom. */
    function render() {
        /* Where each point lands in the picture: flat, the map as it always was. */
        const at3 = projector(view, cam);
        const [sx, sy] = at3(0, 0, 0);
        const parts = [];
        /* Names to place once every dot is drawn, in priority order (placeLabels). */
        const labels = [];
        /* Whether anything of a body, or of its map that far about it, is in the picture. */
        const inPicture = (body, radiusAU) => {
            const [x, y] = at3(body.x, body.y, body.z ?? 0);
            return Math.hypot(x - SIZE / 2, y - SIZE / 2) < SIZE * Math.SQRT1_2 + radiusAU * view.scale;
        };
        paintSkyNow();

        /* Where nothing has been seen: everything beyond 1,000 AU from the Sun, up to the
           other system's bodies. Drawn first, under everything, and it says why on hover
           and on focus, in the owner's words. */
        const holes = unseenHoles(view, [
            { x: 0, y: 0, radiusAU: UNSEEN_FROM_AU },
            ...system.systems.flatMap((on) => [
                ...on.pairs.map((p) => ({ ...p.centre, radiusAU: seenNearOfPair(p.pair) })),
                ...on.groups.map((g) => ({ ...g.centre, radiusAU: g.group.seenNear })),
                ...on.lone.map((m) => ({ ...on.at.get(m.id), radiusAU: seenNearOf(on.system, m) })),
            ]),
        ], undefined, at3);
        if (holes && shown.hatching && !place.beyondStreet) {
            const hole = ({ x, y, r }) => `M${(x - r).toFixed(1)},${y.toFixed(1)}a${r.toFixed(1)},${r.toFixed(1)} 0 1,0 ${(2 * r).toFixed(1)},0a${r.toFixed(1)},${r.toFixed(1)} 0 1,0 ${(-2 * r).toFixed(1)},0Z`;
            const unseen = svg('path', { d: `M0,0H${SIZE}V${SIZE}H0Z${holes.map(hole).join('')}`, fill: 'url(#rubin-unseen-map)', 'fill-rule': 'evenodd', class: 'rubin-unseen' });
            attachDetails(unseen, [[UNSEEN_TEXT]]);
            parts.push(unseen);
        }

        /* Distance rings about the star nearest the middle of the picture: the Sun, A and
           B's centre of gravity, or Proxima. (Rings about a star thousands of AU off cross a
           close-up as a row of straight lines, which says nothing.) Only the rings that
           cross the picture (ringRadii). */
        const fromMiddle = (body) => Math.hypot(view.cx - body.x, view.cy - body.y);
        const ringsAbout = [
            { x: 0, y: 0, z: 0 },
            ...system.systems.flatMap((on) => [...on.pairs.map((p) => p.centre), ...on.groups.map((g) => g.centre), ...on.lone.map((m) => on.at.get(m.id))]),
        ].reduce((a, b) => (fromMiddle(b) < fromMiddle(a) ? b : a));
        /* The rings lie in the plane through that star, parallel to Earth's; in 3D they are
           ellipses, and that plane is the ground each body's drop line reaches down to. */
        const ground = ringsAbout.z;
        const [rx, ry] = at3(ringsAbout.x, ringsAbout.y, ground);
        const ringsFrom = Math.hypot(rx - SIZE / 2, ry - SIZE / 2) / view.scale;
        /* Each ring that crosses the picture is named somewhere on it (ringLabelSpot), the
           names kept clear of each other; "AU rings" in Show turns them all off. Tipped near
           edge-on, dozens of rings crowd the picture, so past 12 only every 2nd, 5th or
           10th is named, counted from the star. */
        const ringNames = [];
        const radii = shown.rings ? ringRadii(view, ringsFrom, 60, ringStretch(at3.squash)) : [];
        const gap = radii.length > 1 ? radii[1] - radii[0] : 1;
        const nameEvery = [1, 2, 5, 10, 20].find((k) => radii.length / k <= 12) ?? 20;
        for (const r of radii) {
            /* Edge-on a ring is a line; an ellipse no taller than nothing is not drawn at all. */
            const [across, tall] = [r * view.scale, Math.max(0.5, r * view.scale * at3.squash)];
            parts.push(svg('ellipse', { cx: rx, cy: ry, rx: across, ry: tall, fill: 'none', stroke: C.grid, 'stroke-width': 1 }));
            if (Math.round(r / gap) % nameEvery) continue;
            const name = ringLabel(r);
            const spot = ringLabelSpot(rx, ry, across, tall, SIZE, name.length * 6.5, ringNames);
            if (spot) parts.push(svg('text', { x: spot.x, y: spot.y, class: 'rubin-axis' }, name));
        }
        /* In 3D, a dashed line from a body to that plane, with a tick where it meets it: how
           far above or below the plane it sits, at a glance. Drawn under the body's mark. */
        const drop = (body, x, y) => {
            if (!threeD || !shown.planeLines) return;
            const [fx, fy] = at3(body.x, body.y, ground);
            if (Math.hypot(fx - x, fy - y) < 3) return;
            parts.push(svg('line', { x1: x, y1: y, x2: fx, y2: fy, stroke: C.muted, 'stroke-width': 1, 'stroke-dasharray': '2 3', opacity: 0.7, 'pointer-events': 'none' }));
            parts.push(svg('line', { x1: fx - 3, y1: fy, x2: fx + 3, y2: fy, stroke: C.muted, 'stroke-width': 1, 'pointer-events': 'none' }));
        };
        /* How far apart two bodies are in the picture. */
        const apartOnScreen = (p, q) => Math.hypot(...at3(p.x, p.y, p.z).map((v, k) => v - at3(q.x, q.y, q.z)[k]));

        /* The Sun's own map is drawn only where it is in the picture, and as a single dot
           once the map is pulled back so far that all of it would land on one spot. */
        const sunShown = inPicture({ x: 0, y: 0, z: 0 }, threeD ? data.radius3D : data.radius);
        const sunAsDot = data.radius * view.scale < SYSTEM_DOT_PX;
        const solar = sunShown && !sunAsDot;

        /* Each picked body's orbit, bright, under the marks; or, where it is not known well
           enough to draw, or too small to see from here, a note beside the body saying so. */
        const traced = (path, closed, stroke = C.text, dashed = false) => {
            const points = path.map((q) => at3(q.x, q.y, q.z ?? 0).map((v) => v.toFixed(1)).join(',')).join(' ');
            parts.push(svg(closed ? 'polygon' : 'polyline', { points, fill: 'none', stroke, 'stroke-width': 1.5, opacity: 0.9, 'pointer-events': 'none', ...(dashed ? { 'stroke-dasharray': '6 5' } : {}) }));
        };
        const noteBeside = (body, text) => {
            const [x, y] = at3(body.x, body.y, body.z ?? 0);
            labels.push({ x, y: y + 14, text, rank: Infinity });
        };
        for (const { entry, kind } of solar ? data.marks : []) {
            if (!selected.has(entry.designation)) continue;
            const orbit = orbitFor(entry);
            if (orbit.path) traced(orbit.path, entry.orbit.e < 1, MARK_STYLE[kind].color);
            else noteBeside(entry.now, orbit.note);
        }
        for (const key of bodiesPicked) {
            if (!PICKABLE[key]) continue;
            const { body, paths, note, dashed, open } = PICKABLE[key];
            /* A spacecraft's path, only while the craft itself is shown, and only about the Sun. */
            if (key.startsWith('craft:') && (!solar || !craftShown.has(key.slice(6)) || !paths.length)) continue;
            if (note) { noteBeside(body, note); continue; }
            if (open) { paths.forEach((path) => traced(path, false, C.text, true)); continue; }
            const across = Math.max(...paths.flat().map((q) => apartOnScreen(q, body)));
            if (across < 3) noteBeside(body, 'orbit too small to see from here');
            else paths.forEach((path) => traced(path, true, C.text, dashed));
        }

        /* The planets and tundrs, on their real orbits, where they are on the digest's date. */
        for (const p of solar ? data.planets : []) {
            const orbitPx = p.a * view.scale;
            if (orbitPx < PLANET_DRAW_PX) continue;
            const designation = `world:${p.name}`;
            const chosen = isPicked(designation);
            const points = p.path.map((q) => at3(q.x, q.y, q.z).map((v) => v.toFixed(1)).join(',')).join(' ');
            parts.push(svg('polygon', { points, fill: 'none', stroke: chosen ? C.text : C.muted, 'stroke-width': chosen ? 1.5 : 1, opacity: chosen ? 0.9 : 0.55 }));
            const [px, py] = at3(p.x, p.y, p.z);
            const g = svg('g', { class: chosen ? 'rubin-mark rubin-mark-pickable is-selected' : 'rubin-mark rubin-mark-pickable', 'data-object': designation });
            g.append(svg('circle', { cx: px, cy: py, r: 12, fill: 'transparent' }));
            g.append(svg('circle', { cx: px, cy: py, r: 3.5, fill: C.muted, stroke: C.space, 'stroke-width': 2 }));
            attachDetails(g, [[p.name, KIND_LABEL[p.kind].toLowerCase()], [au(p.r), 'from the Sun'], CLICK_ROW]);
            /* Like every object on the map, a click picks it (pickable); the card's "tundr"
               opens what a tundr is. */
            pickable(g, designation, p, chosen);
            parts.push(g);
            if (orbitPx >= PLANET_LABEL_PX) labels.push({ x: px, y: py, text: p.name, rank: Infinity });
        }
        /* The round moons, once zoomed in far enough to tell each from its parent. A click
           shows its card. */
        for (const m of solar ? data.moons : []) {
            const ringPx = m.a * view.scale;
            if (ringPx < MOON_DRAW_PX) continue;
            const [mx, my] = at3(m.x, m.y, m.z);
            if (mx < -20 || mx > SIZE + 20 || my < -20 || my > SIZE + 20) continue;
            const designation = `world:${m.name}`;
            const chosen = isPicked(designation);
            const points = m.path.map((q) => at3(q.x, q.y, q.z).map((v) => v.toFixed(1)).join(',')).join(' ');
            parts.push(svg('polygon', { points, fill: 'none', stroke: chosen ? C.text : C.muted, 'stroke-width': chosen ? 1.5 : 1, opacity: chosen ? 0.9 : 0.4 }));
            const g = svg('g', { class: chosen ? 'rubin-mark rubin-mark-pickable is-selected' : 'rubin-mark rubin-mark-pickable', 'data-object': designation });
            g.append(svg('circle', { cx: mx, cy: my, r: 12, fill: 'transparent' }));
            g.append(svg('circle', { cx: mx, cy: my, r: 2.5, fill: C.muted, stroke: C.space, 'stroke-width': 1.5 }));
            attachDetails(g, [[m.name, `planet, orbiting ${m.parent}`], CLICK_ROW]);
            pickable(g, designation, m, chosen);
            parts.push(g);
            if (ringPx >= PLANET_LABEL_PX) labels.push({ x: mx, y: my, text: m.name, rank: 1e7 });
        }
        /* A star as a mark: the Sun, and the three of Alpha Centauri. Luhman 16's two tundrs
           are marked the same way, fainter, and say what they are. A click picks it. */
        const star = (key, name, radius, rows, { kind = 'star', fill = C.text, named = true } = {}) => {
            const { body } = PICKABLE[key];
            const [x, y] = at3(body.x, body.y, body.z ?? 0);
            if (x < -20 || x > SIZE + 20 || y < -20 || y > SIZE + 20) return;
            drop(body, x, y);
            const chosen = bodiesPicked.has(key);
            const g = svg('g', { class: chosen ? 'rubin-mark rubin-mark-pickable is-selected' : 'rubin-mark rubin-mark-pickable' });
            g.append(svg('circle', { cx: x, cy: y, r: 12, fill: 'transparent' }));
            g.append(svg('circle', { cx: x, cy: y, r: radius, fill, stroke: C.space, 'stroke-width': 2 }));
            attachDetails(g, [[name, kind], ...rows, ['Click to centre the map on it', 'and show its orbit']]);
            pickable(g, key, body, chosen);
            parts.push(g);
            if (named) labels.push({ x, y, text: name, rank: Infinity });
        };
        const galaxyRow = ['It orbits the centre of the galaxy,', 'once in about 230 million years'];
        if (solar) star('body:sun', 'The Sun', 4, [galaxyRow], { named: false });
        if (sunShown && sunAsDot) star('body:sun', 'The Sun', 4, [['With everything on its map:', `${ringLabel(data.radius)} out, too small to tell apart from here`]]);

        /* Alpha Centauri: one dot from far off; then Proxima and the pair; then A and B
           apart, on the paths they trace about their centre of gravity. The planets'
           orbits are dashed circles of the right size only - their tilt is not known. */
        const far = (body) => [[farDistanceText(body.r), 'from the Sun'], [farPlaneText(body)]];
        const orbitOf = (body, o) => {
            const r = o.a * view.scale;
            if (r < PLANET_DRAW_PX) return;
            const [x, y] = at3(body.x, body.y, body.z);
            if (Math.hypot(x - SIZE / 2, y - SIZE / 2) > SIZE + r) return;
            parts.push(svg('circle', { cx: x, cy: y, r, fill: 'none', stroke: C.muted, 'stroke-width': 1, 'stroke-dasharray': '4 4' }));
            if (r >= PLANET_LABEL_PX) labels.push({ x: x + r * Math.SQRT1_2, y: y - r * Math.SQRT1_2, text: o.status === 'candidate' ? 'candidate planet (unconfirmed)' : `${o.name}'s orbit`, rank: 1e8 });
        };
        /* Every neighbour the same way (NEIGHBOURS in js/centauri.js): a system of several
           marks is one dot from far off; then each lone member, and each pair as one mark
           until its two are 12 pixels apart, then both, on the paths they trace about their
           centre of gravity. A member's planets' orbits are drawn with it; a single star whose
           planets all lie inside Mercury's orbit has that orbit about it for scale. Tundrs are
           marked fainter, and say what they are. */
        const looks = (members) => {
            const tundr = members.filter((m) => starKind(m.type).colour === 'tundr').length;
            const n = members.length;
            const what = tundr === n ? (n === 1 ? 'Hydrogen Tundr' : 'Hydrogen Tundrs') : tundr ? 'stars and tundrs' : n === 1 ? 'star' : 'stars';
            return { kind: n === 1 ? what : `${COUNT_WORDS[n] ?? n} ${what}`, fill: tundr === n ? C.muted : C.text };
        };
        /* What a member's hover says of it: its own words, or else its type in full and its
           note from the stars table. */
        const about = (m) => m.rows ?? [[m.type, starKind(m.type).words], ...(m.blurb ? [[m.blurb]] : [])];
        for (const on of system.systems) {
            const s = on.system;
            /* The planets known about some of the system's members, as hover rows. */
            const planetRows = (members) => planetSummary((s.planets ?? []).filter((o) => members.some((m) => m.id === o.star)), s.name).rows;
            const home = PLACES[s.id];
            if (!inPicture(on.centre, threeD ? home.radius3D : home.radiusAU)) continue;
            if (on.units > 1 && home.radiusAU * view.scale < SYSTEM_DOT_PX) {
                star(`body:${s.id}`, s.name, s.markPx ?? Math.max(...s.members.map((m) => m.markPx)), [...(s.rows ?? [[systemTypeText(s)]]), ...planetRows(s.members), ...far(on.centre)], looks(s.members));
                continue;
            }
            if (on.forScale) {
                const r = on.forScale * view.scale;
                const [x, y] = at3(on.centre.x, on.centre.y, on.centre.z);
                if (r >= PLANET_DRAW_PX && r < 1e5 && Math.hypot(x - SIZE / 2, y - SIZE / 2) < SIZE + r) {
                    parts.push(svg('circle', { cx: x, cy: y, r, fill: 'none', stroke: C.text, 'stroke-width': 1.5, 'stroke-dasharray': '2 5', opacity: 0.85, 'pointer-events': 'none' }));
                    if (r >= PLANET_LABEL_PX) labels.push({ x: x - r * Math.SQRT1_2, y: y - r * Math.SQRT1_2, text: "Mercury's orbit about the Sun, for scale", rank: 1e8 });
                }
            }
            const planetsOf = (m) => (s.planets ?? []).filter((o) => o.star === m.id).forEach((o) => orbitOf(on.at.get(m.id), o));
            for (const m of on.lone) {
                const body = on.at.get(m.id);
                const wide = m.sky ? [[farDistanceText(apartFrom(body, on.centre)), `from ${s.centreName}`]] : [];
                planetsOf(m);
                star(`body:${m.id}`, m.name, m.markPx, [...about(m), ...planetRows([m]), ...far(body), ...wide], looks([m]));
            }
            for (const { group, centre, members } of on.groups) {
                star(`body:${group.key}`, group.name, Math.max(...members.map((m) => m.markPx)), [
                    ...members.map((m) => [m.name, memberTypeText(m)]),
                    [`${group.apartText.charAt(0).toUpperCase()}${group.apartText.slice(1)};`, 'too close together to draw apart here'],
                    ...planetRows(members),
                    ...far(centre),
                ], looks(members));
            }
            for (const p of on.pairs) {
                const { pair } = p;
                const [ma, mb] = [pair.a, pair.b].map((id) => s.members.find((m) => m.id === id));
                const round = `they round each other every ${pair.orbit.period.toFixed(1)} years`;
                if (apartOnScreen(p.a, p.b) < 12) {
                    star(`body:${pair.key}`, pair.name, pair.markPx, [...(pair.rows ?? []), ...planetRows([ma, mb]), ...far(p.centre), [farDistanceText(p.apart), `apart on this date; ${round}`]], looks([ma, mb]));
                    continue;
                }
                for (const path of [p.paths.a, p.paths.b]) {
                    const points = path.map((q) => at3(q.x, q.y, q.z).map((v) => v.toFixed(1)).join(',')).join(' ');
                    parts.push(svg('polygon', { points, fill: 'none', stroke: C.muted, 'stroke-width': 1, opacity: 0.55 }));
                }
                for (const [m, body, other] of [[ma, p.a, mb], [mb, p.b, ma]]) {
                    planetsOf(m);
                    star(`body:${m.id}`, m.name, m.markPx, [...about(m), ...planetRows([m]), ...far(body), [farDistanceText(p.apart), `from ${shortName(s, other)} on this date; ${round}`]], looks([m]));
                }
            }
        }

        /* Which way things lie that the picture cannot hold. The centre of the galaxy, in the
           view of the nearest bodies (owner, 2026-11-14) and from another star system; and,
           from another star system, Earth (owner, 2026-11-18). Directions, not places, so
           they sit in the corners rather than on the line from the Sun - where SagA's would
           land on Barnard's Star, almost the same way. Flat, each points along the plane; in
           3D it turns with the map, and takes in how far it lies out of the plane. */
        /* Each arrow sits in a small glass globe (owner, 2026-11-18), so in 3D it is plain
           where it points: the ring round the globe's middle is the plane of Earth's orbit,
           its near half solid and its far half dashed; a dashed line drops from the arrow's
           tip to that plane, for how far above or below it the way lies; and an arrow fades
           the more it points away from the reader, into the glass. Pointing straight out of
           the picture it is a dot, straight in a cross. Flat, the globe is seen from above. */
        const GLOBE_R = 30;
        const { forward } = skyBasis(cam);
        const depthOf = (v) => v[0] * forward[0] + v[1] * forward[1] + v[2] * forward[2];
        const arrow = (ax, ay, way, label, rows) => {
            const n = Math.hypot(...way);
            const unit = way.map((v) => v / n);
            const onGlobe = (v, k = GLOBE_R) => {
                const [x, y] = at3.direction(...v);
                return [ax + x * k, ay + y * k];
            };
            const g = svg('g', { class: 'rubin-mark rubin-toward' });
            g.append(svg('circle', { cx: ax, cy: ay, r: GLOBE_R + 12, fill: 'transparent' }));
            /* The glass's back, dark, so the globe reads as a thing over the map. */
            g.append(svg('circle', { cx: ax, cy: ay, r: GLOBE_R, fill: C.space, 'fill-opacity': 0.55 }));
            /* The ring round the middle, in runs that are all near or all far. */
            const ring = { near: [], far: [] };
            let run = null;
            for (let k = 0; k <= 96; k++) {
                const t = (k / 96) * 2 * Math.PI;
                const v = [Math.cos(t), Math.sin(t), 0];
                const side = depthOf(v) > 1e-6 ? 'far' : 'near';
                const [x, y] = onGlobe(v);
                if (!run || run.side !== side) {
                    if (run) run.points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
                    run = { side, points: [] };
                    ring[side].push(run);
                }
                run.points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
            }
            const ringLine = (r, near) => svg('polyline', { points: r.points.join(' '), fill: 'none', stroke: C.muted, 'stroke-width': 1, opacity: near ? 0.9 : 0.5, 'stroke-dasharray': near ? 'none' : '2 3' });
            const [tx, ty] = onGlobe(unit);
            const long = Math.hypot(tx - ax, ty - ay);
            const away = depthOf(unit) > 0;
            const pointer = () => {
                const out = [];
                if (long < 6) {
                    /* Straight at the reader, a dot; straight away, a cross. */
                    if (away) out.push(svg('path', { d: `M${ax - 5},${ay - 5}L${ax + 5},${ay + 5}M${ax - 5},${ay + 5}L${ax + 5},${ay - 5}`, stroke: C.text, 'stroke-width': 1.5 }));
                    else out.push(svg('circle', { cx: ax, cy: ay, r: 3.5, fill: C.text }));
                    return out;
                }
                const [dx, dy] = [(tx - ax) / long, (ty - ay) / long];
                const head = (turn) => {
                    const c = Math.cos(turn), s2 = Math.sin(turn);
                    return `${(tx + (dx * c - dy * s2) * 8).toFixed(1)},${(ty + (dx * s2 + dy * c) * 8).toFixed(1)}`;
                };
                const look = { stroke: C.text, 'stroke-width': 1.5, opacity: (1 - 0.55 * Math.max(0, depthOf(unit))).toFixed(2) };
                out.push(svg('line', { x1: ax, y1: ay, x2: tx, y2: ty, ...look }));
                out.push(svg('polyline', { points: `${head(Math.PI * 5 / 6)} ${tx.toFixed(1)},${ty.toFixed(1)} ${head(-Math.PI * 5 / 6)}`, fill: 'none', ...look }));
                return out;
            };
            for (const r of ring.far) g.append(ringLine(r, false));
            g.append(svg('circle', { cx: ax, cy: ay, r: GLOBE_R, fill: C.space, 'fill-opacity': 0.7, stroke: C.muted, 'stroke-width': 1 }));
            for (const r of ring.near) g.append(ringLine(r, true));
            /* From the tip down (or up) to the plane, and from the middle out to that foot. */
            const flatLength = Math.hypot(unit[0], unit[1]);
            if (flatLength > 0.05 && Math.abs(unit[2]) > 0.02) {
                const [fx, fy] = onGlobe([unit[0], unit[1], 0]);
                g.append(svg('line', { x1: tx, y1: ty, x2: fx, y2: fy, stroke: C.muted, 'stroke-width': 1, 'stroke-dasharray': '2 2' }));
                g.append(svg('line', { x1: ax, y1: ay, x2: fx, y2: fy, stroke: C.muted, 'stroke-width': 1, opacity: 0.6, 'stroke-dasharray': '1 2' }));
            }
            g.append(...pointer());
            g.append(svg('text', { x: ax, y: ay - GLOBE_R - 8, 'text-anchor': 'middle', class: 'rubin-axis' }, label));
            const tilt = Math.asin(Math.max(-1, Math.min(1, unit[2]))) * 180 / Math.PI;
            attachDetails(g, [...rows, [`${Math.abs(tilt).toFixed(0)}° ${tilt < 0 ? 'below' : 'above'} the plane of Earth's orbit,`, 'the ring round the globe']]);
            parts.push(g);
        };
        /* Centred in another star system: far from the Sun, with the Sun out of the picture. */
        const fromSun = [view.cx, view.cy, view.cz ?? 0];
        const away = Math.hypot(...fromSun);
        const [sunX, sunY] = at3(0, 0, 0);
        const elsewhere = away > ELSEWHERE_AU && (sunX < 0 || sunX > SIZE || sunY < 0 || sunY > SIZE);
        if (place.id === 'both' || elsewhere) {
            arrow(SIZE - 48, SIZE - 52, SAG_A_WAY.way, 'Toward SagA', [
                ['Toward SagA:', 'Sagittarius A*, the supermassive black hole at the centre of the Milky Way'],
                [`${SAG_A.lightYears.toLocaleString('en-US')} light years away,`, `about ${SAG_A.millionSuns} million times the Sun's mass`],
                ['The Sun and its neighbours orbit it', 'once in about 230 million years'],
                ["Barnard's Star lies almost the same way", 'on our sky'],
            ]);
        }
        /* Gaia BH1: a ring, dark inside, for a black hole. Out of the picture, nothing: it is
           found in "Go to" (owner, 2026-11-19). */
        if (BH1) {
            const [x, y] = at3(BH1.x, BH1.y, BH1.z);
            if (x > 0 && x < SIZE && y > 0 && y < SIZE) {
                drop(BH1, x, y);
                const chosen = bodiesPicked.has('body:gaiabh1');
                const g = svg('g', { class: chosen ? 'rubin-mark rubin-mark-pickable is-selected' : 'rubin-mark rubin-mark-pickable' });
                g.append(svg('circle', { cx: x, cy: y, r: 12, fill: 'transparent' }));
                g.append(svg('circle', { cx: x, cy: y, r: 5, fill: C.space, stroke: C.text, 'stroke-width': 2 }));
                attachDetails(g, [...GAIA_BH1_ROWS, ['Click to centre the map on it']]);
                pickable(g, 'body:gaiabh1', BH1, chosen);
                parts.push(g);
                labels.push({ x, y, text: GAIA_BH1.name, rank: Infinity });
            }
        }
        if (elsewhere) {
            arrow(48, SIZE - 52, fromSun.map((v) => -v), 'Toward Earth', [
                ['Toward Earth:', `${farDistanceText(away)} from the middle of the map`],
                ['The Sun lies the same way:', 'from this far, Earth and the Sun are one point'],
            ]);
        }

        for (const { entry, kind } of solar ? data.marks : []) {
            const [x, y] = at3(entry.now.x, entry.now.y, entry.now.z ?? 0);
            if (x < -20 || x > SIZE + 20 || y < -20 || y > SIZE + 20) continue;
            drop(entry.now, x, y);
            const chosen = selected.has(entry.designation);
            const g = svg('g', { class: chosen ? 'rubin-mark rubin-mark-pickable is-selected' : 'rubin-mark rubin-mark-pickable', 'data-object': entry.designation });
            g.append(svg('circle', { cx: x, cy: y, r: 12, fill: 'transparent' }));
            g.append(mark(MARK_STYLE[kind], x, y, 5, C.space));
            attachDetails(g, [
                [displayName(entry), MARK_STYLE[kind].label.toLowerCase(), MARK_STYLE[kind].color],
                [au(entry.now.r), 'from the Sun'],
                ...(entry.nowFrom ? [['Shown where it was on', longDate(entry.nowFrom)]] : []),
                ...(planeText(entry) ? [[planeText(entry)]] : []),
                [sizeOf(entry).text, sizeOf(entry).measured ? 'measured' : 'from brightness'],
                ...orbitFor(entry).rows,
                CLICK_ROW,
            ]);
            pickable(g, entry.designation, entry.now, chosen);
            parts.push(g);
            const name = properName(entry);
            if (name) labels.push({ x, y, text: name, rank: sizeOf(entry).km });
        }
        /* Human spacecraft, those turned on under Spacecraft. One that stays with a body is
           drawn a little down and right of it, clear of the body's mark and its name (up and right); marks that
           would overlap become one, which says how many and lists them, and a click zooms in
           until they part. Craft at the same body never part: a click centres on them. */
        if (solar && craftShown.size) {
            const CRAFT_OFFSET = 11;
            const points = [];
            for (const c of crafts.shown) {
                if (!craftShown.has(c.item.id)) continue;
                let [sx, sy] = at3(c.x, c.y, c.z ?? 0);
                if (c.place) { sx += CRAFT_OFFSET; sy += CRAFT_OFFSET; }
                if (sx < -20 || sx > SIZE + 20 || sy < -20 || sy > SIZE + 20) continue;
                points.push({ ...c, sx, sy });
            }
            for (const cl of clusterMarks(points, 16)) {
                const { members } = cl;
                const anyActive = members.some((m) => m.item.active);
                const g = svg('g', { class: 'rubin-mark rubin-mark-pickable' });
                g.append(svg('circle', { cx: cl.x, cy: cl.y, r: 12, fill: 'transparent' }));
                g.append(craftGlyph(cl.x, cl.y, anyActive));
                if (members.length === 1) {
                    const { item } = members[0];
                    const key = `craft:${item.id}`;
                    const chosen = bodiesPicked.has(key);
                    if (chosen) g.classList.add('is-selected');
                    attachDetails(g, [
                        [item.name, item.active ? 'spacecraft, working' : 'spacecraft, no longer working'],
                        [item.blurb],
                        [`${item.agency},`, `launched ${item.launched}`],
                        item.at ? [PLACE_WORDS[item.at]] : [au(Math.hypot(members[0].x, members[0].y, members[0].z ?? 0)), 'from the Sun'],
                        ...(item.at ? [] : [['Path from JPL Horizons,', `fetched ${longDate(craftTracks[item.id]?.fetched ?? TRACKS_FETCHED)}`]]),
                        ...(members[0].lastKnown ? [[`Placed from its last known orbit, of ${members[0].lastKnown.slice(0, 4)};`, 'it may have drifted well off it since']] : []),
                        [item.active ? `Working as of ${longDate(STATUS_AS_OF)}` : `Not working as of ${longDate(STATUS_AS_OF)}`],
                        ['Click to centre the map on it', item.at ? '' : 'and show its path'],
                    ]);
                    pickable(g, key, members[0], chosen);
                    labels.push({ x: cl.x, y: cl.y, text: item.name, rank: -1 });
                } else {
                    const names = members.map((m) => m.item.name);
                    const together = new Set(members.map((m) => m.place)).size === 1 && members[0].place;
                    const head = names.length === 1 ? 'One spacecraft' : `${names.length} spacecraft`;
                    const rows = [
                        [head, together ? PLACE_WORDS[members[0].place] : 'too close together to tell apart from here'],
                        ...names.slice(0, 10).map((n) => [n]),
                        ...(names.length > 10 ? [[`and ${names.length - 10} more`]] : []),
                        [together ? 'Click to centre the map on them' : 'Click to zoom in until they part'],
                    ];
                    attachDetails(g, rows);
                    g.append(svg('text', { x: cl.x + 9, y: cl.y + 14, class: 'rubin-axis', 'pointer-events': 'none' }, String(members.length)));
                    const mean = (pick) => members.reduce((t, m) => t + pick(m), 0) / members.length;
                    const centre = { x: mean((m) => m.x), y: mean((m) => m.y), z: mean((m) => m.z ?? 0) };
                    const spread = Math.max(...members.map((m) => Math.hypot(m.x - centre.x, m.y - centre.y, (m.z ?? 0) - centre.z)));
                    const open = () => {
                        hideTooltip();
                        if (together || spread === 0) { centreOn(centre); return; }
                        const to = centredOn(view, [centre.x, centre.y, centre.z]);
                        setView(zoomAt(to, Math.max(2, (SIZE / 5) / (spread * view.scale))));
                    };
                    g.setAttribute('role', 'button');
                    g.addEventListener('click', open);
                    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
                    g.addEventListener('dblclick', (e) => e.stopPropagation());
                }
                parts.push(g);
            }
        }

        /* Planets and tundrs first, then the largest objects; a name with no room is left
           out until zooming in makes some. */
        labels.sort((a, b) => b.rank - a.rank);
        for (const l of placeLabels(labels, SIZE)) {
            parts.push(svg('text', { x: l.x + 7, y: l.y - 7, class: 'rubin-axis rubin-map-label' }, l.text));
        }
        layer.replaceChildren(...parts);
        stars?.draw(view, cam, starsOut());

        const level = zoomLevel(view);
        const where = place.id === 'sun' ? '' : `${place.label}: `;
        const whole = place.id === 'sun' ? 'Whole map' : 'whole view';
        readout.textContent = travelling ? `Travelling to ${place.name}` : `${where}${level < 1.05 ? whole : `${level < 10 ? level.toFixed(1) : Math.round(level).toLocaleString('en-US')}× zoom`}`;
        zoomIn.disabled = Boolean(travelling) || level >= maxZoomOf(view) - 0.01;
        zoomOut.disabled = Boolean(travelling) || level <= 1.0001;
        /* A pick can move the whole map off its middle, so it can be put back. */
        reset.disabled = Boolean(travelling) || (level <= 1.0001 && atHome(view));
        flatButton.disabled = threeDButton.disabled = Boolean(travelling);
        /* At the whole map a finger drag scrolls the page; zoomed in, it moves the map. In 3D
           it always turns the map, and in full screen, with no page to scroll, every drag
           is the map's. */
        plot.style.touchAction = !threeD && !filling && level <= 1.0001 ? 'pan-y' : 'none';
        runLight({ always: true });
    }

    /* A journey under way is not interrupted by a stray pinch or scroll. Anything else the
       reader does stops a glide to a picked body where it is. */
    const setView = (next) => { if (travelling) return; cancelAnimationFrame(centring); centring = 0; view = next; render(); };

    /* Picking: a click (or Enter) on something on the map picks it, or, picked already, lets
       it go. Picking it centres the map on it, so zooming and turning go about it rather
       than its system's centre of gravity, and draws its orbit; an object with a card shows
       its card too, without leaving the map (the map's table still goes to it). */
    const CLICK_ROW = ['Click to centre the map on it,', 'and show its orbit and its card'];
    function centreOn(body) {
        if (travelling) return;
        cancelAnimationFrame(centring);
        const from = view;
        const to = centredOn(view, [body.x, body.y, body.z ?? 0]);
        if (reducedMotion.matches) { centring = 0; view = to; render(); return; }
        const began = performance.now();
        const frame = (now) => {
            const t = Math.min(1, (now - began) / 600);
            view = glideView(from, to, t);
            centring = t >= 1 ? 0 : requestAnimationFrame(frame);
            render();
        };
        centring = requestAnimationFrame(frame);
    }
    function pickOnMap(key, body, options) {
        hideTooltip();
        const on = !isPicked(key);
        if (pickers.has(key)) select(key, on, options);
        else { if (on) bodiesPicked.add(key); else bodiesPicked.delete(key); notePick(key, on); render(); }
        if (on) centreOn(body);
    }
    const pickable = (g, key, body, chosen) => {
        g.setAttribute('role', 'button');
        g.setAttribute('aria-pressed', String(chosen));
        g.addEventListener('click', () => pickOnMap(key, body));
        g.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickOnMap(key, body); }
        });
        /* A double-click on an object is two clicks on it, not a zoom. */
        g.addEventListener('dblclick', (e) => e.stopPropagation());
    };
    onPick = (key, on) => { notePick(key, on); render(); };

    /* Sizes side by side (owner, 2026-11-18): the two bodies picked last, beside the
       familiar bodies nearest them in size, all to one scale (sizeLineup). Picks are kept in
       order, so letting one go brings back the one before. */
    const pickOrder = [];
    const sizeBox = el('div', { class: 'rubin-size', 'aria-live': 'polite' });
    function subjectsFor(key) {
        if (STAR_SIZES[key]) return STAR_SIZES[key];
        const entry = pickers.get(key)?.entries.find((e) => e.designation === key);
        if (!entry) return null;
        if (entry.world) return Number.isFinite(entry.km) ? [{ designation: key, name: entry.name, km: entry.km, measured: true }] : null;
        return [{ designation: key, name: displayName(entry), ...sizeRange(entry) }];
    }
    function showSize() {
        const subjects = lineupSubjects(pickOrder.filter(isPicked).map(subjectsFor).filter(Boolean));
        if (!subjects.length) {
            sizeBox.replaceChildren(el('p', { class: 'rubin-note rubin-size-hint' }, 'Pick anything on the map to see its size here, beside familiar bodies, all to one scale.'));
            return;
        }
        const lineup = sizeLineup(subjects);
        const { title, lines } = lineupText(subjects, lineup);
        const row = el('div', { class: 'rubin-size-row' });
        const tall = LINEUP_PX + 6;
        for (const b of lineup.bodies) {
            const across = Math.max(b.px, b.outerPx ?? 0) + 6;
            const item = el('figure', { class: b.subject ? 'rubin-size-item is-subject' : 'rubin-size-item' });
            const disc = svg('svg', { width: across, height: tall, viewBox: `0 0 ${across} ${tall}`, 'aria-hidden': 'true' });
            const [cx, cy] = [across / 2, tall / 2];
            disc.append(svg('circle', { cx, cy, r: b.px / 2, fill: b.subject ? C.text : C.muted }));
            if (b.outerPx) disc.append(svg('circle', { cx, cy, r: b.outerPx / 2, fill: 'none', stroke: C.text, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }));
            const caption = el('figcaption');
            caption.append(el('span', { class: 'rubin-size-name' }, b.name), el('span', { class: 'rubin-size-km' }, b.low ? `about ${kilometres(Math.round(b.km / 10) * 10)}` : kilometres(b.km)));
            item.append(disc, caption);
            row.append(item);
        }
        sizeBox.replaceChildren(el('p', { class: 'rubin-size-title' }, title), row, ...lines.map((t) => el('p', { class: 'rubin-note rubin-size-line' }, t)));
    }
    function notePick(key, on) {
        const k = pickOrder.indexOf(key);
        if (k >= 0) pickOrder.splice(k, 1);
        if (on) pickOrder.push(key);
        showSize();
    }
    showSize();

    /* Going somewhere: the map glides there (glideView), by way of the view that holds both
       systems when it is crossing between them (journeyView). For a visitor who asked for
       less motion it is simply there. */
    const nearestButton = el('button', { type: 'button', class: 'rubin-tool', 'aria-pressed': 'false' }, PLACES.both.label);
    const blockButton = PLACES.block ? el('button', { type: 'button', class: 'rubin-tool', 'aria-pressed': 'false' }, PLACES.block.label) : null;
    const hoodButton = PLACES.neighborhood ? el('button', { type: 'button', class: 'rubin-tool', 'aria-pressed': 'false' }, PLACES.neighborhood.label) : null;
    const goInput = el('input', {
        type: 'text', class: 'rubin-tool rubin-map-go-input', role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false',
        'aria-controls': 'rubin-map-go-list', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'go',
        placeholder: `Type a name (${GO_SYSTEMS.length} places)`, 'aria-label': 'Go to a star system: type its name, or choose from the list',
    });
    const goList = el('ul', { id: 'rubin-map-go-list', class: 'rubin-map-go-list', role: 'listbox', 'aria-label': 'Star systems, nearest first' });
    /* "Zoom on" steps for each neighbour that has them, shown while there. */
    const zoomRows = new Map(system.systems.filter((on) => on.system.rungs).map((on) => [on.system.id, el('span', { class: 'rubin-map-zoom-on' })]));
    function showPlace() {
        nearestButton.setAttribute('aria-pressed', String(place.id === 'both'));
        blockButton?.setAttribute('aria-pressed', String(place.id === 'block'));
        hoodButton?.setAttribute('aria-pressed', String(place.id === 'neighborhood'));
        for (const option of goList.children) option.classList.toggle('is-here', option.dataset.place === place.id);
        for (const [id, row] of zoomRows) row.hidden = place.id !== id;
        findLight.hidden = place.id !== 'sun';
        reset.textContent = place.id === 'sun' ? 'Whole map' : 'Whole view';
    }
    function goTo(target, toView = homeView(target)) {
        cancelAnimationFrame(travelling);
        cancelAnimationFrame(centring);
        travelling = centring = 0;
        const from = view;
        const wide = (p) => p.id === 'both' || p.beyondStreet;
        const direct = place === target || wide(place) || wide(target);
        const via = homeView(PLACES.both);
        place = target;
        showPlace();
        hideTooltip();
        arrive = () => { view = toView; };
        if (reducedMotion.matches) { arrive(); render(); return; }
        const ms = direct ? 1800 : 5000;
        const began = performance.now();
        const frame = (now) => {
            const t = Math.min(1, (now - began) / ms);
            view = t >= 1 ? toView : (direct ? glideView(from, toView, t) : journeyView(from, via, toView, t));
            travelling = t >= 1 ? 0 : requestAnimationFrame(frame);
            render();
        };
        travelling = requestAnimationFrame(frame);
    }
    const closeUp = (body, radiusAU, at) => {
        const home = homeView(at);
        return { ...home, scale: Math.min(home.fitScale * maxZoomOf(home), (SIZE / 2 - 24) / radiusAU), cx: body.x, cy: body.y, cz: body.z };
    };

    /* Between flat and 3D the map tips over (or back) in a moment, keeping its zoom about
       the same middle; at the whole view it refits, since 3D fits true distances. Back to
       flat, it turns back to north at the top too. For a visitor who asked for less motion
       it is simply there. */
    let tipping = 0;
    const showDepth = () => {
        flatButton.setAttribute('aria-pressed', String(!threeD));
        threeDButton.setAttribute('aria-pressed', String(threeD));
        /* In 3D the picture itself takes the arrow keys, so it can be reached by them. */
        if (threeD) plot.setAttribute('tabindex', '0');
        else plot.removeAttribute('tabindex');
        plot.setAttribute('aria-label', threeD
            ? 'Map in 3D of the listed objects, the Sun, the planets and the tundrs, reaching to the nearest stars. Drag, or use the arrow keys, to turn it and tip it'
            : 'Map of the listed objects, the Sun, the planets and the tundrs, seen from above, reaching to every star system within a million AU');
        planeLines.box.disabled = !threeD;
        planeLines.item.classList.toggle('is-off', !threeD);
    };
    function setDepth(on) {
        if (on === threeD || travelling) return;
        cancelAnimationFrame(tipping);
        cancelAnimationFrame(centring);
        centring = 0;
        const whole = zoomLevel(view) <= 1.0001;
        threeD = on;
        const home = homeView(place);
        view = whole ? home : { ...view, fitScale: home.fitScale, radiusAU: home.radiusAU, scale: Math.max(view.scale, home.fitScale) };
        showDepth();
        hideTooltip();
        /* The short way round, from wherever the reader left it. */
        const from = { turn: Math.atan2(Math.sin(cam.turn), Math.cos(cam.turn)), tilt: Math.atan2(Math.sin(cam.tilt), Math.cos(cam.tilt)) };
        const to = on ? { turn: from.turn, tilt: TILT_3D } : FLAT;
        if (reducedMotion.matches) { cam = to; render(); return; }
        const began = performance.now();
        const frame = (now) => {
            const t = Math.min(1, (now - began) / 700);
            const k = t * t * (3 - 2 * t);
            cam = { turn: from.turn + (to.turn - from.turn) * k, tilt: from.tilt + (to.tilt - from.tilt) * k };
            tipping = t >= 1 ? 0 : requestAnimationFrame(frame);
            render();
        };
        tipping = requestAnimationFrame(frame);
    }
    const setCam = (next) => { if (travelling) return; cancelAnimationFrame(tipping); tipping = 0; cam = next; render(); };
    flatButton.addEventListener('click', () => setDepth(false));
    threeDButton.addEventListener('click', () => setDepth(true));
    plot.addEventListener('keydown', (e) => {
        if (!threeD || e.target !== plot) return;
        const turns = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[e.key];
        if (!turns) return;
        e.preventDefault();
        setCam(turnBy(cam, ...turns));
    });
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
    /* Every redraw replaces the shapes under the fingers, and a finger whose shape is gone
       can be lifted without the map hearing of it (Android Chrome, owner's Pixel 8 Pro,
       2026-11-16). A finger the map still counted then turned every later touch into half
       a pinch: the map stuck zoomed, and a swipe zoomed instead of scrolling. So the map
       holds on to both fingers of a pinch, hears a finger lifted anywhere on the page, and
       starts its count afresh with the first finger of every new touch. */
    const capture = (id) => { try { plot.setPointerCapture(id); } catch { /* already lifted */ } };
    plot.addEventListener('pointerdown', (e) => {
        if (e.isPrimary) { pointers.clear(); pinch = null; }
        pointers.set(e.pointerId, local(e));
        dragged = false;
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinch = { distance: Math.hypot(a[0] - b[0], a[1] - b[1]), view };
            for (const id of pointers.keys()) capture(id);
        }
    });
    plot.addEventListener('pointermove', (e) => {
        if (!pointers.has(e.pointerId)) return;
        const [x, y] = local(e);
        const [px, py] = pointers.get(e.pointerId);
        if (pointers.size === 2 && pinch) {
            pointers.set(e.pointerId, [x, y]);
            const [a, b] = [...pointers.values()];
            const mid = threeD ? [pinch.view.cx, pinch.view.cy] : toWorld(pinch.view, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
            setView(zoomAt(pinch.view, Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.distance, mid));
            dragged = true;
            return;
        }
        if (!dragged && Math.hypot(x - px, y - py) < 4) return;
        if (!dragged) { dragged = true; capture(e.pointerId); hideTooltip(); }
        pointers.set(e.pointerId, [x, y]);
        if (threeD) setCam(turnBy(cam, x - px, y - py));
        else if (zoomLevel(view) > 1.0001) setView(panBy(view, x - px, y - py));
    });
    const release = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    plot.addEventListener('click', (e) => { if (dragged) { e.stopPropagation(); dragged = false; } }, true);
    /* Gaia's stars, under the marks: pointing at one (a mouse over it, or a tap) shows what
       Gaia's map says of it. A mark under the pointer has its own details, so it wins. */
    if (stars) {
        let starTip = false;
        let asked = null;
        const tipAt = (e) => {
            if (e.target.closest?.('.rubin-mark')) return;
            const rows = stars.pick(view, cam, ...local(e));
            if (rows) { showTooltip(rows, e.clientX, e.clientY); starTip = true; } else if (starTip) { hideTooltip(); starTip = false; }
        };
        plot.addEventListener('pointermove', (e) => {
            if (pointers.size || e.pointerType !== 'mouse') return;
            /* At most once a frame: a busy view can hold 400,000 stars. */
            if (!asked) requestAnimationFrame(() => { tipAt(asked); asked = null; });
            asked = e;
        });
        plot.addEventListener('pointerleave', () => { if (starTip) { hideTooltip(); starTip = false; } });
        plot.addEventListener('click', (e) => { if (e.pointerType !== 'mouse') tipAt(e); });
    }
    /* In 3D a point in the picture is not one place on the map, so zooming keeps to the middle. */
    const anchorAt = (e) => (threeD ? undefined : toWorld(view, ...local(e)));
    plot.addEventListener('dblclick', (e) => setView(zoomAt(view, MAP_ZOOM.step, anchorAt(e))));
    /* Ctrl + scroll (and a laptop trackpad's pinch, which arrives the same way) zooms;
       plain scrolling stays the page's. */
    plot.addEventListener('wheel', (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        setView(zoomAt(view, Math.exp(-e.deltaY * 0.0025), anchorAt(e)));
    }, { passive: false });

    zoomIn.addEventListener('click', () => setView(zoomAt(view, MAP_ZOOM.step)));
    zoomOut.addEventListener('click', () => setView(zoomAt(view, 1 / MAP_ZOOM.step)));
    reset.addEventListener('click', () => setView(homeView(place)));
    /* Zooms on the Sun until this visit's light fills about a third of the map. */
    findLight.addEventListener('click', () => {
        if (travelling) return;
        const home = homeView(PLACES.sun);
        const scale = scaleToShow(lightTravelledAU(Date.now() - OPENED), SIZE, { fitScale: home.fitScale, maxZoom: MAP_ZOOM.max });
        setView(zoomAt(home, scale / home.fitScale, [0, 0]));
    });
    /* One bar above the map (owner, 2026-11-18), in three groups: where to go, how near,
       and how it looks. It wraps on a narrow screen, a group at a time. */
    const depth = el('span', { class: 'rubin-map-depth', role: 'group', 'aria-label': 'Flat map or 3D' });
    depth.append(flatButton, threeDButton);
    /* A button that opens a small menu over the map: Escape, a click elsewhere or focus
       leaving it closes it. */
    const dropdown = (text, id, label, extraClass = '') => {
        const button = el('button', { type: 'button', class: 'rubin-tool', 'aria-expanded': 'false', 'aria-controls': id }, text);
        const menu = el('div', { class: `rubin-map-show-menu ${extraClass}`.trim(), id, role: 'group', 'aria-label': label });
        menu.hidden = true;
        const box = el('span', { class: 'rubin-map-show' });
        box.append(button, menu);
        const open = (on) => {
            menu.hidden = !on;
            button.setAttribute('aria-expanded', String(on));
        };
        button.addEventListener('click', () => open(menu.hidden));
        box.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || menu.hidden) return;
            e.preventDefault();
            e.stopPropagation();
            open(false);
            button.focus();
        });
        box.addEventListener('focusout', (e) => { if (!box.contains(e.relatedTarget)) open(false); });
        document.addEventListener('pointerdown', (e) => { if (!box.contains(e.target)) open(false); });
        return { box, menu, open };
    };
    const show = dropdown('Show ▾', 'rubin-map-show-menu', 'What the map shows');
    show.menu.append(milkyWay.item, rings.item, hatching.item, planeLines.item, findLight);
    const showBox = show.box;
    findLight.addEventListener('click', () => show.open(false));

    /* "Spacecraft" (owner, 2026-11-19): human-made things, apart from how the map looks.
       Two branches, Active and Inactive, each a box for the lot and a list to open for
       each craft; all off until turned on. A craft the digest's date does not reach (not
       yet launched, or past its fetched track) is listed, greyed. */
    const craft = dropdown('Spacecraft ▾', 'rubin-map-craft-menu', 'Human spacecraft on the map', 'rubin-map-craft-menu');
    const unplaced = () => new Set(crafts.missing.map((s) => s.id));
    const saveCraft = () => {
        try { localStorage.setItem(CRAFT_KEY, JSON.stringify([...craftShown])); } catch { /* storage blocked: fine for this visit */ }
        hideTooltip();
        render();
        if (craftShown.size) fetchCraftTracks();
    };
    const branches = [];
    for (const [active, title] of [[true, 'Active'], [false, 'Inactive']]) {
        const items = itemsOf(active);
        const all = el('input', { type: 'checkbox' });
        const head = el('div', { class: 'rubin-map-craft-head' });
        const headLabel = el('label', { class: 'rubin-map-show-item' });
        headLabel.append(all, el('span', {}, `${title} (${items.length})`));
        const listId = `rubin-map-craft-${active ? 'active' : 'inactive'}`;
        const twist = el('button', { type: 'button', class: 'rubin-map-craft-twist', 'aria-expanded': 'false', 'aria-controls': listId, 'aria-label': `List each ${title.toLowerCase()} craft` }, '▸');
        head.append(headLabel, twist);
        const list = el('div', { class: 'rubin-map-craft-list', id: listId, role: 'group', 'aria-label': `${title} spacecraft` });
        list.hidden = true;
        const boxes = items.map((s) => {
            const box = el('input', { type: 'checkbox' });
            const where = s.name;
            const label = el('label', { class: 'rubin-map-show-item' });
            label.append(box, el('span', {}, where));
            box.addEventListener('change', () => {
                if (box.checked) craftShown.add(s.id); else craftShown.delete(s.id);
                syncCraft();
                saveCraft();
            });
            list.append(label);
            return { s, box, label };
        });
        const placeable = () => { const out = unplaced(); return items.filter((s) => !out.has(s.id)); };
        all.addEventListener('change', () => {
            const on = groupState(placeable(), craftShown) !== 'all';
            for (const s of placeable()) { if (on) craftShown.add(s.id); else craftShown.delete(s.id); }
            syncCraft();
            saveCraft();
        });
        twist.addEventListener('click', () => {
            list.hidden = !list.hidden;
            twist.textContent = list.hidden ? '▸' : '▾';
            twist.setAttribute('aria-expanded', String(!list.hidden));
        });
        craft.menu.append(head, list);
        branches.push({ all, boxes, placeable });
    }
    /* Also run when fresher tracks arrive, which can place a craft the built-in ones could not. */
    function syncCraft() {
        const out = unplaced();
        for (const { all, boxes, placeable } of branches) {
            const state = groupState(placeable(), craftShown);
            all.checked = state === 'all';
            all.indeterminate = state === 'some';
            for (const { s, box, label } of boxes) {
                const missing = out.has(s.id);
                box.checked = craftShown.has(s.id);
                box.disabled = missing;
                label.classList.toggle('is-off', missing);
                label.title = missing ? 'Not placed on this date: not yet launched, or past where its track was fetched' : s.blurb ?? '';
            }
        }
    }
    syncCraft();
    if (craftShown.size) fetchCraftTracks();
    craft.menu.append(el('p', { class: 'rubin-note rubin-map-craft-note' }, `Working or not as of ${longDate(STATUS_AS_OF)}. Only craft sent out to do science; those that landed, or were destroyed, and satellites about Earth, are left out.`));
    const zooming = el('span', { class: 'rubin-map-group', role: 'group', 'aria-label': 'Zoom' });
    zooming.append(zoomOut, zoomIn, reset);
    const looking = el('span', { class: 'rubin-map-group', role: 'group', 'aria-label': 'How the map looks' });
    looking.append(depth, showBox, craft.box, fullButton);
    showDepth();

    /* Where the map can go: a list of the systems, nearest first, marking the one the map is
       at, and a button for the view that holds them all, pressed while there (owner,
       2026-11-14). Both are always there, so a keyboard's
       focus is never left on a control that has gone; the two close-ups appear on arriving
       at Alpha Centauri. */
    const travel = el('span', { class: 'rubin-map-group rubin-map-travel', role: 'group', 'aria-label': 'Go to another place on the map' });
    travel.append(el('span', { class: 'rubin-map-travel-label' }, 'Go to:'));
    /* Every system (SYSTEMS), found by typing (owner, 2026-11-18): a text box with the list
       under it, nearest first, narrowed as you type (findSystems). Each has a symbol for its
       stars' types (starSymbol), its name, whose hover gives the whole system's type, and
       how far it is. Arrow keys move through the list, Enter goes, Escape closes it. */
    const goBox = el('span', { class: 'rubin-map-go' });
    goBox.append(goInput, goList);
    goList.hidden = true;
    const goOptions = new Map(GO_SYSTEMS.map((s) => {
        const option = el('li', { id: `rubin-go-${s.id}`, class: 'rubin-map-go-option', role: 'option', 'aria-selected': 'false', 'data-place': s.id });
        const at = PLACES[s.id];
        const far = s.id === 'sun' ? 'home' : s.farText ?? `${(Math.hypot(at.cx, at.cy, at.cz ?? 0) / AU_PER_LIGHT_YEAR).toFixed(1)} ly`;
        const name = el('span', { class: 'rubin-map-go-name' }, s.name);
        hoverDetails(name, [[s.name, systemTypeText(s)]]);
        /* Its planets, if any: a ring with a dot and how many are confirmed, and "+n?" for
           candidates; the hover says which. */
        const known = s.id === 'sun' ? SUN_PLANETS : planetSummary(NEIGHBOURS.find((n) => n.id === s.id)?.planets ?? [], s.name);
        option.append(starSymbol(s), name);
        if (known.confirmed || known.candidates) option.append(planetMark(known));
        option.append(el('span', { class: 'rubin-map-go-far' }, far));
        /* The option's spoken name says its types, for anyone not hovering. */
        option.setAttribute('aria-label', `${s.name}, ${far.replace('ly', 'light years')}: ${systemTypeText(s)}. ${known.text}`);
        /* Pressing keeps the box's focus, so the list is not closed before the click lands. */
        option.addEventListener('pointerdown', (e) => e.preventDefault());
        option.addEventListener('click', () => chooseSystem(s));
        goList.append(option);
        return [s.id, option];
    }));
    /* "Go to"'s filter (owner, 2026-11-19), from its menu beside the box: kinds ticked, and
       whether to keep only those with confirmed planets (filterSystems). */
    const goFilter = { kinds: new Set(), planets: false };
    const goNone = el('li', { class: 'rubin-map-go-none', role: 'presentation' }, 'Nothing here matches the filter.');
    goNone.hidden = true;
    goList.append(goNone);
    let goShown = [];
    let goActive = -1;
    function setGoActive(k) {
        goActive = k;
        goShown.forEach((s, j) => goOptions.get(s.id).setAttribute('aria-selected', String(j === k)));
        const active = goShown[k];
        if (active) {
            goInput.setAttribute('aria-activedescendant', `rubin-go-${active.id}`);
            goOptions.get(active.id).scrollIntoView({ block: 'nearest' });
        } else goInput.removeAttribute('aria-activedescendant');
    }
    function openGo() {
        goShown = findSystems(goInput.value, filterSystems(GO_SYSTEMS, goFilter));
        for (const [id, option] of goOptions) option.hidden = !goShown.some((s) => s.id === id);
        goNone.hidden = goShown.length > 0;
        goList.hidden = false;
        goInput.setAttribute('aria-expanded', 'true');
        setGoActive(goInput.value.trim() && goShown.length ? 0 : -1);
    }
    function closeGo() {
        goList.hidden = true;
        goInput.setAttribute('aria-expanded', 'false');
        setGoActive(-1);
        hideTooltip();
    }
    function chooseSystem(s) {
        goInput.value = '';
        closeGo();
        goInput.blur();
        if (PLACES[s.id]) goTo(PLACES[s.id]);
    }
    goInput.addEventListener('focus', openGo);
    goInput.addEventListener('click', () => { if (goList.hidden) openGo(); });
    goInput.addEventListener('input', openGo);
    goInput.addEventListener('blur', closeGo);
    goInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (goList.hidden) openGo();
            if (!goShown.length) return;
            const step = e.key === 'ArrowDown' ? 1 : -1;
            setGoActive(goActive < 0 ? (step > 0 ? 0 : goShown.length - 1) : (goActive + step + goShown.length) % goShown.length);
        } else if (e.key === 'Enter') {
            const s = goShown[goActive] ?? (goInput.value.trim() ? goShown[0] : undefined);
            if (s) { e.preventDefault(); chooseSystem(s); }
        } else if (e.key === 'Escape') {
            if (!goList.hidden) { e.preventDefault(); e.stopPropagation(); goInput.value = ''; closeGo(); }
        }
    });
    /* The filter's menu: the kinds, in their groups, each with how many places hold it, and
       confirmed planets. A kind none holds is listed, greyed, so the list says what is not
       here too (no neutron star is known this near). */
    const filter = dropdown('Filter ▾', 'rubin-map-go-filter', 'Narrow the places Go to lists', 'rubin-map-go-filter');
    const filterCount = el('p', { class: 'rubin-note rubin-map-go-count', 'aria-live': 'polite' });
    const applyFilter = () => {
        const n = filterSystems(GO_SYSTEMS, goFilter).length;
        const on = goFilter.kinds.size || goFilter.planets;
        filterCount.textContent = on ? `${n} of ${GO_SYSTEMS.length} places shown` : `All ${GO_SYSTEMS.length} places shown`;
        goInput.placeholder = on ? `Type a name (${n} of ${GO_SYSTEMS.length} places)` : `Type a name (${GO_SYSTEMS.length} places)`;
        filter.box.querySelector('button').textContent = on ? 'Filter (on) ▾' : 'Filter ▾';
        if (!goList.hidden) openGo();
    };
    const tick = (label, count, onChange) => {
        const box = el('input', { type: 'checkbox' });
        const item = el('label', { class: 'rubin-map-show-item' });
        item.append(box, el('span', {}, `${label} (${count})`));
        if (!count) { box.disabled = true; item.classList.add('is-off'); }
        box.addEventListener('change', () => onChange(box.checked));
        return item;
    };
    let group = null;
    for (const kind of GO_KINDS) {
        if (kind.group !== group) {
            group = kind.group;
            filter.menu.append(el('p', { class: 'rubin-map-go-filter-head' }, group));
        }
        const count = GO_SYSTEMS.filter((s) => kindsOf(s).has(kind.id)).length;
        filter.menu.append(tick(kind.label, count, (on) => { if (on) goFilter.kinds.add(kind.id); else goFilter.kinds.delete(kind.id); applyFilter(); }));
    }
    filter.menu.append(el('p', { class: 'rubin-map-go-filter-head' }, 'Planets'));
    filter.menu.append(tick('Has confirmed planets', GO_SYSTEMS.filter((s) => s.confirmedPlanets > 0).length, (on) => { goFilter.planets = on; applyFilter(); }));
    filter.menu.append(filterCount);
    applyFilter();
    nearestButton.addEventListener('click', () => goTo(PLACES.both));
    travel.append(goBox, filter.box, nearestButton);
    if (PLACES.block) {
        blockButton.addEventListener('click', () => goTo(PLACES.block));
        hoodButton.addEventListener('click', () => goTo(PLACES.neighborhood));
        travel.append(blockButton, hoodButton);
    }
    /* Under the bar: where the map is and how near, and the steps in where it has some. */
    const under = el('div', { class: 'rubin-map-controls rubin-map-under' });
    under.append(readout);
    /* Each neighbour's steps in (its rungs): at Alpha Centauri, Proxima and the pair; at
       Barnard's Star, whose whole view holds Mercury's orbit for scale with the four planets
       bunched at its middle, those planets, then the innermost (owner, 2026-11-18: "to
       really show the degree to which those planets are CLOSE"). */
    for (const [id, row] of zoomRows) {
        row.append(el('span', { class: 'rubin-map-travel-label' }, 'Zoom on:'));
        for (const rung of rungsOf(id)) {
            const button = el('button', { type: 'button', class: 'rubin-tool' }, rung.label);
            button.addEventListener('click', () => goTo(PLACES[id], rungView(id, rung)));
            row.append(button);
        }
        under.append(row);
    }
    showPlace();

    /* Full screen (owner, 2026-11-18): the map and its controls fill the screen, drawn
       again as large as fits (fullScreenSizeFor), keeping the zoom, the place, the turn and
       what is picked. Where a browser cannot put a page's part in full screen (an
       iPhone's Safari), it fills the window instead. Esc, the button, or leaving full
       screen the browser's own way brings it back. */
    const stage = el('div', { class: 'rubin-map-stage' });
    const panel = el('div', { class: 'rubin-map-panel' });
    const controls = el('div', { class: 'rubin-map-controls rubin-map-bar' });
    controls.append(travel, zooming, looking);
    panel.append(controls, under);
    stage.append(panel, frame, sizeBox);
    const tooltipHome = tooltip.parentNode;
    function resize(next) {
        if (next === SIZE) return;
        if (travelling) { cancelAnimationFrame(travelling); travelling = 0; arrive(); showPlace(); }
        cancelAnimationFrame(centring);
        centring = 0;
        view = resizedView(view, next);
        SIZE = next;
        plot.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
        frame.style.width = filling ? `${SIZE}px` : '';
        render();
    }
    /* The controls go above the map, or beside it on a wide screen, whichever leaves the
       map larger (fullScreenSizeFor); the panel beside it is a fixed width. */
    /* The sizes go under the map, or at the foot of the controls beside it. */
    const fit = () => {
        stage.classList.remove('is-side');
        stage.append(sizeBox);
        if (!filling) { frame.style.width = ''; resize(mapSizeFor(document.documentElement.clientWidth)); return; }
        const [w, h] = [stage.clientWidth || innerWidth, stage.clientHeight || innerHeight];
        const aboveSize = fullScreenSizeFor(w, h, { above: panel.offsetHeight + sizeBox.offsetHeight + 32 });
        stage.classList.add('is-side');
        panel.append(sizeBox);
        const sideSize = fullScreenSizeFor(w, h, { above: 16, beside: panel.offsetWidth + 16 });
        const side = sideSize > aboveSize;
        stage.classList.toggle('is-side', side);
        if (!side) stage.append(sizeBox);
        resize(Math.max(aboveSize, sideSize));
        frame.style.width = `${SIZE}px`;
    };
    function setFilling(on) {
        if (on === filling) return;
        filling = on;
        hideTooltip();
        stage.classList.toggle('is-filling', on);
        /* The tooltip must be inside what is in full screen to be seen there. */
        (on ? stage : tooltipHome).append(tooltip);
        document.documentElement.classList.toggle('rubin-filling', on);
        fullButton.replaceChildren(fullIcon(on));
        fullButton.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
        fullButton.setAttribute('title', on ? 'Exit full screen' : 'Full screen');
        fullButton.setAttribute('aria-pressed', String(on));
        fit();
    }
    fullButton.addEventListener('click', () => {
        if (!filling) {
            if (stage.requestFullscreen) stage.requestFullscreen().catch(() => setFilling(true));
            else setFilling(true);
        } else if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            setFilling(false);
        }
    });
    document.addEventListener('fullscreenchange', () => setFilling(document.fullscreenElement === stage));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && filling && !document.fullscreenElement) setFilling(false); });
    /* Turning a phone, or resizing the window, fits it again once the size settles. */
    let fitting = 0;
    addEventListener('resize', () => { if (!filling) return; cancelAnimationFrame(fitting); fitting = requestAnimationFrame(fit); });

    const holder = section.querySelector('.rubin-plot');
    const present = [...new Set(data.marks.map((m) => m.kind))];
    holder.replaceChildren(
        legend([
            ...present.map((k) => ({ label: MARK_STYLE[k].label, swatch: mark(MARK_STYLE[k], 11, 7, 4) })),
            ...['planet', 'hydrogen', 'water'].map((kind) => ({
                label: KIND_LABEL[kind], tundr: kind !== 'planet', swatch: svg('circle', { cx: 11, cy: 7, r: 3.5, fill: C.muted }),
            })),
        ]),
        stage,
        ruler,
        lightNow,
        lightFirst,
        rulerNote,
    );
    section.querySelector('figcaption').replaceChildren(
        `Seen from above the plane of Earth's orbit as you opened this page, on ${longDate(MAP_DAY)}, with the Sun at the centre and distances to scale. The planets and `,
        tundrWord('tundrs'),
        ` are where they were at that moment. Distances on the map are along that plane, so an object on a steeply tilted orbit sits closer in than its true distance from the Sun; its details give both. Zoom with the buttons, a pinch, Ctrl and scroll, or a double-click; drag to move around. Click anything on the map to centre the map on it and draw its orbit; an orbit not yet known well enough is not drawn, and the map says so beside the object. Under the map, the two bodies picked last are drawn beside the familiar bodies nearest them in size, all to one scale, since the map itself cannot show size: at the whole map, even Jupiter would be far smaller than a pixel. Where a size is estimated from brightness, the solid disc is its size if its surface is bright and the dashed ring its size if it is dark. "Go to" takes the same map to any of the ${system.systems.length} star systems within a million AU (15.8 light years) of the Sun, each where it is on that date, and "Galactic street" pulls back to hold them all. Alpha Centauri, the nearest, is ${farDistanceText(system.centre.r)} away and well below the plane, so it too sits closer in than its true distance; A and B follow the paths drawn. A pair whose orbit is known is drawn on it once there is room; pairs and triples whose orbits are not in hand stay one mark. The fainter marks are Hydrogen Tundrs, usually called brown dwarfs. The dashed circles about stars are planets' orbits at their right size; how they are tilted is not known, and those still disputed are marked as candidates. About a single star whose planets all lie close in, Mercury's orbit about the Sun is drawn for scale: Barnard's Star's four planets would fit inside it ten times over. Picking Proxima draws its orbit about A and B, dashed, since it is known only roughly. The arrow in that view points toward SagA (Sagittarius A*), the supermassive black hole at the centre of the Milky Way, ${SAG_A.lightYears.toLocaleString('en-US')} light years away; centred on another star system, a second arrow points toward Earth. The hatching covers everything beyond 1,000 AU from the Sun short of these systems, where nothing has yet been seen in place. "3D" tips the map over to show depth: drag it, or use the arrow keys, to turn it and tip it. There a dashed line drops from each body to the plane of the rings, showing how far above or below it the body is, and the map shows true distances rather than distances along the plane. Behind the map is the sky beyond it, as if seen through a lens 90 degrees wide: the Milky Way, drawn from how crowded Gaia found the sky with stars. Seen from above, that is the sky toward the south pole of Earth's orbit, with the Milky Way's band along one side; in 3D it turns with the map. Everything on the map lies deep inside the galaxy's disk, which is about 1,000 light years thick, so the galaxy cannot be drawn to scale; the sky is the truest picture of it from here. "Show" turns it, the AU rings, the hatching and the plane lines on or off. "Spacecraft" adds the spacecraft sent out to do science, working and not, each where it is: those flying free on the paths JPL's Horizons gives, those orbiting a planet or the Moon, or looping about the points 1.5 million km from Earth where the Sun's and Earth's pulls balance, beside that body. Satellites in orbit about Earth are left out: most are commercial.`,
    );

    const mapTable = table(
        ['Object', 'Listed as', 'From the Sun', 'Along the plane and out of it', 'Size'],
        data.marks.map(({ entry, kind }) => [displayName(entry), MARK_STYLE[kind].label, au(entry.now.r), planeText(entry) ?? 'in the plane', sizeOf(entry).text]),
    );
    /* Each name in the table is a button doing what clicking its map mark does, and then
       goes to the card. */
    [...mapTable.tBodies[0].rows].forEach((row, k) => {
        const { entry } = data.marks[k];
        const name = el('button', { type: 'button', class: 'rubin-row-pick', 'aria-pressed': 'false', 'data-object': entry.designation }, displayName(entry));
        name.addEventListener('click', () => pickOnMap(entry.designation, entry.now, { scrollTo: true }));
        row.cells[0].replaceChildren(name);
    });
    /* One row per star and tundr of every neighbour, its note put together from the list:
       what it is (blurb), how far from its pair's other member or from its system's centre,
       and its planets. */
    const starsTable = table(
        ['Body', 'From the Sun', 'Along the plane and out of it', 'Note'],
        system.systems.flatMap((on) => {
            const s = on.system;
            return s.members.map((m) => {
                const body = on.at.get(m.id);
                const notes = [m.blurb];
                const p = on.pairs.find(({ pair }) => pair.a === m.id || pair.b === m.id);
                const g = on.groups.find(({ group }) => group.members.includes(m.id));
                if (g) {
                    notes.push(`with ${g.members.filter((o) => o !== m).map((o) => shortName(s, o)).join(' and ')}: ${g.group.apartText}`);
                    if (g.group.sky) notes.push(`${farDistanceText(apartFrom(g.centre, on.centre))} from ${s.centreName}`);
                } else if (p) {
                    const { pair } = p;
                    const other = s.members.find((o) => o.id === (pair.a === m.id ? pair.b : pair.a));
                    const { aAU, e, period } = pair.orbit;
                    notes.push(pair.a === m.id ? `${farDistanceText(p.apart)} from ${shortName(s, other)} on ${longDate(MAP_DAY)}`
                        : `orbits ${shortName(s, other)} every ${period.toFixed(1)} years, between ${(aAU * (1 - e)).toFixed(1)} and ${(aAU * (1 + e)).toFixed(1)} AU apart`);
                } else if (m.sky) notes.push(`${farDistanceText(apartFrom(body, on.centre))} from ${s.centreName}`);
                notes.push(planetsText(s, m));
                const note = notes.filter(Boolean).join('; ');
                return [m.name, farDistanceText(body.r), farPlaneText(body), note.charAt(0).toUpperCase() + note.slice(1)];
            });
        }),
    );
    section.querySelector('.rubin-table-wrap').replaceChildren(mapTable, el('p', { class: 'rubin-note' }, `Every star and tundr within a million AU of the Sun, where "Go to" takes the map: sizes of orbit for their planets, from NASA's Exoplanet Archive. Between 1,000 AU from the Sun and these: ${UNSEEN_TEXT}.`), starsTable);
    section.hidden = false;
    /* A link or a preview can open the map somewhere else: ?place=both, or a neighbour's
       id, and &zoom= one of its rungs (centauri: proxima or pair; barnard: planets or
       innermost). */
    /* &view=3d opens it in 3D, and &turn= and &tilt= turn and tip it that many degrees. */
    if (params.get('view') === '3d') {
        threeD = true;
        const degrees = (name, fallback) => (Number.isFinite(Number(params.get(name))) && params.has(name) ? Number(params.get(name)) * Math.PI / 180 : fallback);
        cam = { turn: degrees('turn', 0), tilt: degrees('tilt', TILT_3D) };
        view = homeView(place);
        showDepth();
    }
    const startAt = Object.hasOwn(PLACES, params.get('place') ?? '') ? PLACES[params.get('place')] : null;
    if (startAt) {
        place = startAt;
        const rung = rungsOf(startAt.id).find((r) => r.id === params.get('zoom'));
        view = rung ? rungView(startAt.id, rung) : homeView(startAt);
        showPlace();
    }
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
        /* The page's head has usually asked for it already (see rubin.html), so the
           digest travels while this file and its modules do; without that, ask now. */
        const url = params.get('digest') ?? DIGEST_URL;
        const early = window.rubinEarly;
        const digest = await (early?.url === url ? early.digest : getJson(url));
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
