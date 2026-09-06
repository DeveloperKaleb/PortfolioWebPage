/* Generic support for boards whose cells can hold more than one piece of track.
 *
 * A normal board is one grid cell = one place to be. That breaks as soon as a map
 * crosses over itself: the middle of the Infinity board is a cell the snake can
 * occupy on the upper strand or the lower one, and those are different places that
 * happen to share coordinates.
 *
 * So a position is a NODE - (x, y, strand) - not a coordinate pair, and the board is
 * a graph of nodes rather than a grid. Everything here is map-agnostic: give it a
 * mask whose cells list their strands and it produces the graph. The Infinity board
 * derives its strands from a curve parameter, but nothing below knows or cares.
 *
 * Pure, no DOM - see CLAUDE.md on keeping logic testable.
 */

export const CELL = { TRACK: 'track', HOLE: 'hole', WALL: 'wall' };

const TAU = Math.PI * 2;

// Shortest distance between two angles, going either way round the circle.
export const circularDelta = (a, b) => {
    const d = Math.abs(a - b) % TAU;
    return Math.min(d, TAU - d);
};

/* Mean of a set of angles. Averaging them arithmetically is wrong wherever the set
 * straddles the 2pi -> 0 wrap: the mean of 6.2 and 0.1 comes out near pi, pointing at
 * the opposite side of the curve. Summing unit vectors has no such seam. */
export const circularMean = (angles) => {
    const x = angles.reduce((sum, t) => sum + Math.cos(t), 0);
    const y = angles.reduce((sum, t) => sum + Math.sin(t), 0);
    const mean = Math.atan2(y, x);
    return mean < 0 ? mean + TAU : mean;
};

export const nodeKey = (x, y, strand) => `${x},${y},${strand}`;
const dirKey = (direction) => `${direction.x},${direction.y}`;

const STEPS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

/* Decides whether two nodes in neighbouring cells are the same continuous piece of
 * track. The default suits any map whose strands carry a position along a curve:
 * neighbouring points on one strand have almost the same parameter, while the two
 * strands meeting at a crossing are far apart on it.
 *
 * A map that isn't curve-derived can pass its own predicate instead - that is the
 * seam that keeps this tooling general.
 */
export const linkByContinuity = (tolerance = 1) => (from, to) => {
    if (from.param === null || to.param === null) return true; // single-strand map
    return circularDelta(from.param, to.param) <= tolerance;
};

/* Which strand lies on top where several share a cell. The default orders by curve
 * parameter, so the ordering is stable along the whole crossing rather than being
 * decided cell by cell. Returns strand indices, lowest layer first. */
export const layerByParameter = (cellNodes) =>
    [...cellNodes].sort((a, b) => a.param - b.param).map((n) => n.strand);

/**
 * Build the node graph for a mask.
 *
 * @param mask   { width, height, cells: [[{ kind, branches }]] } - `branches` lists
 *               one parameter per strand in that cell; empty means a single plain strand.
 * @param link   (from, to, direction) => boolean - are these the same track?
 * @param order  (cellNodes) => strandIndices, lowest layer first.
 */
export function buildStrandGraph(mask, { link = linkByContinuity(), order = layerByParameter } = {}) {
    const nodes = new Map();

    for (let y = 1; y <= mask.height; y++) {
        for (let x = 1; x <= mask.width; x++) {
            const cell = mask.cells[y - 1][x - 1];
            if (cell.kind !== CELL.TRACK) continue;

            const params = cell.branches && cell.branches.length ? cell.branches : [null];
            const cellNodes = params.map((param, strand) => ({
                x, y, strand, param, layer: 0, neighbours: {},
            }));

            // Only a shared cell needs its strands ranked; a lone strand is layer 0.
            if (cellNodes.length > 1) {
                order(cellNodes).forEach((strand, layer) => { cellNodes[strand].layer = layer; });
            }
            cellNodes.forEach((n) => nodes.set(nodeKey(x, y, n.strand), n));
        }
    }

    // Wire each node to whatever continues it in each direction. No continuation
    // means the edge of the track that way - which is a death, not a blocked move.
    for (const node of nodes.values()) {
        for (const step of STEPS) {
            const candidates = [];
            for (let strand = 0; ; strand++) {
                const found = nodes.get(nodeKey(node.x + step.x, node.y + step.y, strand));
                if (!found) break;
                candidates.push(found);
            }
            const viable = candidates.filter((c) => link(node, c, step));

            // With several continuations, the nearest along the curve is the real one.
            viable.sort((a, b) => (
                (a.param === null ? 0 : circularDelta(node.param, a.param)) -
                (b.param === null ? 0 : circularDelta(node.param, b.param))
            ));
            node.neighbours[dirKey(step)] = viable.length
                ? { x: viable[0].x, y: viable[0].y, strand: viable[0].strand }
                : null;
        }
    }

    return { width: mask.width, height: mask.height, nodes };
}

export const nodeAt = (graph, x, y, strand = 0) => graph.nodes.get(nodeKey(x, y, strand)) || null;

/** Move one step. Returns the node arrived at, or null for stepping off the track. */
export function stepFrom(graph, position, direction) {
    const node = nodeAt(graph, position.x, position.y, position.strand);
    if (!node) return null;
    const next = node.neighbours[dirKey(direction)];
    return next ? nodeAt(graph, next.x, next.y, next.strand) : null;
}

/** Every strand sharing this cell, lowest layer first. */
export function strandsAt(graph, x, y) {
    const found = [];
    for (let strand = 0; ; strand++) {
        const node = nodeAt(graph, x, y, strand);
        if (!node) break;
        found.push(node);
    }
    return found.sort((a, b) => a.layer - b.layer);
}

export const isOverlapCell = (graph, x, y) => strandsAt(graph, x, y).length > 1;

/* Is this position on a strand with another one above it? Worth naming, because it
 * decides two separate things: how the segment is drawn, and how leaving the strand
 * reads - a fall from the top, running into a wall from underneath. */
export function isUnderneath(graph, position) {
    const sharing = strandsAt(graph, position.x, position.y);
    if (sharing.length < 2) return false;

    const node = nodeAt(graph, position.x, position.y, position.strand);
    return Boolean(node) && node.layer < sharing[sharing.length - 1].layer;
}

/** The cells where strands share space - what a map needs to outline visually. */
export function overlapCells(graph) {
    const seen = new Set();
    const cells = [];
    for (const node of graph.nodes.values()) {
        const key = `${node.x},${node.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (isOverlapCell(graph, node.x, node.y)) cells.push({ x: node.x, y: node.y });
    }
    return cells;
}

/* Collision that understands layers: two positions clash only if they are the same
 * node. Sharing a cell on different strands is the snake passing over itself, which
 * is the whole point of a crossing. */
export const isSameNode = (a, b) => a.x === b.x && a.y === b.y && a.strand === b.strand;

export const isLayeredSelfCollision = (head, body) => body.some((segment) => isSameNode(head, segment));

/* Which strand should be drawn in a shared cell - the highest layer present wins, so
 * the strand on top hides the one beneath it. */
export function topOccupant(occupants) {
    return occupants.reduce((best, o) => (best === null || o.layer > best.layer ? o : best), null);
}
