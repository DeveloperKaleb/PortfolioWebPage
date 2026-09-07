import { describe, test, expect } from 'vitest';
import {
    getBoardShape, BRIDGE_MASK, BRIDGE_LEVELS, BRIDGE_LINK_TOLERANCE,
    buildBridgeMask, isDeckGap, cellKindAt, CELL,
} from '../../js/logic.js';
import {
    stepFrom, strandsAt, isUnderneath, isOverlapCell, overlapCells,
    linkByLevel, nodeAt,
} from '../../js/strands.js';

const shape = getBoardShape('bridge');
const { graph, mask } = shape;

const DOWN = { x: 0, y: 1 };
const UP = { x: 0, y: -1 };
const RIGHT = { x: 1, y: 0 };

const cellsWhere = (predicate) => {
    const found = [];
    for (let y = 1; y <= mask.height; y++) {
        for (let x = 1; x <= mask.width; x++) if (predicate(x, y)) found.push({ x, y });
    }
    return found;
};

const gaps = () => cellsWhere((x, y) => isDeckGap(mask, x, y));

describe('The Bridge arena', () => {
    test('is an open area, not a narrow track', () => {
        // Most of the board is plain ground the snake can wander freely.
        const ground = cellsWhere((x, y) => cellKindAt(mask, x, y) === CELL.TRACK);
        expect(ground.length).toBeGreaterThan(300);
    });

    test('every node is reachable from every other', () => {
        const key = (n) => `${n.x},${n.y},${n.strand}`;
        const start = graph.nodes.values().next().value;
        const seen = new Set([key(start)]);
        const queue = [start];
        while (queue.length) {
            const node = queue.pop();
            Object.values(node.neighbours).forEach((next) => {
                if (!next || seen.has(key(next))) return;
                seen.add(key(next));
                queue.push(graph.nodes.get(key(next)));
            });
        }
        expect(seen.size).toBe(graph.nodes.size);
    });

    test('the deck overlaps the ground down the middle', () => {
        const overlaps = overlapCells(graph);
        expect(overlaps.length).toBeGreaterThan(50);
        // All in one vertical band.
        const columns = new Set(overlaps.map((c) => c.x));
        expect(columns.size).toBeLessThanOrEqual(7);
    });

    test('the board is square, so it needs no transposed twin', () => {
        expect(mask.width).toBe(mask.height);
        expect(getBoardShape('bridge', 'vertical').mask).toBe(getBoardShape('bridge').mask);
    });
});

describe('Getting on and off the deck', () => {
    /* Ground and deck never link directly - the only way up is a ramp. Without this
       the snake could climb onto the bridge from underneath, anywhere along it. */
    test('the ground does not connect to the deck directly', () => {
        const link = linkByLevel(BRIDGE_LINK_TOLERANCE);
        expect(link({ param: BRIDGE_LEVELS.ground }, { param: BRIDGE_LEVELS.deck })).toBe(false);
    });

    test('a ramp connects to both', () => {
        const link = linkByLevel(BRIDGE_LINK_TOLERANCE);
        expect(link({ param: BRIDGE_LEVELS.ground }, { param: BRIDGE_LEVELS.ramp })).toBe(true);
        expect(link({ param: BRIDGE_LEVELS.ramp }, { param: BRIDGE_LEVELS.deck })).toBe(true);
    });

    /* The ramp sits nearer the deck than the ground on purpose. Placed halfway, stepping
       off it would be a tie between climbing onto the deck and dropping underneath, and
       the winner would be whichever strand happened to be listed first. */
    test('stepping off a ramp puts you on the deck, not underneath it', () => {
        const rampCells = cellsWhere((x, y) => {
            const cell = mask.cells[y - 1][x - 1];
            return cell.branches.length === 1 && cell.branches[0] === BRIDGE_LEVELS.ramp;
        });
        expect(rampCells.length).toBeGreaterThan(0);

        const topRamp = rampCells[0];
        const stepped = stepFrom(graph, { x: topRamp.x, y: topRamp.y, strand: 0 }, DOWN);
        expect(stepped).not.toBeNull();
        expect(stepped.param).toBe(BRIDGE_LEVELS.deck);
    });

    test('a ramp can also be crossed along the ground', () => {
        const rampCells = cellsWhere((x, y) => {
            const cell = mask.cells[y - 1][x - 1];
            return cell.branches.length === 1 && cell.branches[0] === BRIDGE_LEVELS.ramp;
        });
        const ramp = rampCells[Math.floor(rampCells.length / 2)];
        expect(stepFrom(graph, { x: ramp.x, y: ramp.y, strand: 0 }, RIGHT)).not.toBeNull();
    });
});

describe('The hole in the deck', () => {
    test('there is one, in the middle', () => {
        const holes = gaps();
        expect(holes.length).toBeGreaterThan(0);
        holes.forEach(({ x, y }) => {
            expect(Math.abs(x - (mask.width + 1) / 2)).toBeLessThanOrEqual(2);
            expect(Math.abs(y - (mask.height + 1) / 2)).toBeLessThanOrEqual(2);
        });
    });

    // A hole in the deck is simply a deck cell with no deck strand.
    test('a gap has ground but no deck', () => {
        gaps().forEach(({ x, y }) => {
            const strands = strandsAt(graph, x, y);
            expect(strands).toHaveLength(1);
            expect(strands[0].param).toBe(BRIDGE_LEVELS.ground);
        });
    });

    test('walking off the deck into it finds nothing to stand on', () => {
        const hole = gaps()[0];
        const above = nodeAt(graph, hole.x, hole.y - 1, 1);
        expect(above).not.toBeNull();
        expect(above.param).toBe(BRIDGE_LEVELS.deck);
        expect(stepFrom(graph, above, DOWN)).toBeNull();
    });

    test('the ground below is unaffected - you walk straight through', () => {
        const hole = gaps()[0];
        const onGround = nodeAt(graph, hole.x, hole.y, 0);
        expect(onGround).not.toBeNull();
        expect(stepFrom(graph, onGround, DOWN)).not.toBeNull();
    });

    /* The lighting falls out of the model rather than being drawn as a special case:
       under the deck the cell has two strands so the snake reads as underneath, and in
       the gap it has one, so the snake reads as lit. Daylight through the hole. */
    test('a snake underneath is lit as it passes through the gap', () => {
        const hole = gaps()[0];
        const inGap = nodeAt(graph, hole.x, hole.y, 0);
        const underDeck = nodeAt(graph, hole.x, hole.y - 1, 0);

        expect(isUnderneath(graph, underDeck)).toBe(true);   // shaded
        expect(isUnderneath(graph, inGap)).toBe(false);      // lit through the hole
        expect(isOverlapCell(graph, hole.x, hole.y)).toBe(false);
    });

    test('and is shaded again on the far side', () => {
        const holes = gaps();
        const lowest = holes.reduce((a, b) => (b.y > a.y ? b : a));
        const beyond = nodeAt(graph, lowest.x, lowest.y + 1, 0);
        expect(beyond).not.toBeNull();
        expect(isUnderneath(graph, beyond)).toBe(true);
    });
});

describe('Mask construction', () => {
    test('a wider band makes a wider deck', () => {
        const narrow = buildBridgeMask({ bandHalf: 2 });
        const wide = buildBridgeMask({ bandHalf: 4 });
        const decks = (m) => m.cells.flat().filter((c) => c.branches.length > 1).length;
        expect(decks(narrow)).toBeLessThan(decks(wide));
    });

    test('a bigger hole leaves less deck', () => {
        const small = buildBridgeMask({ holeHalfW: 1, holeHalfH: 1 });
        const big = buildBridgeMask({ holeHalfW: 2, holeHalfH: 3 });
        const decks = (m) => m.cells.flat().filter((c) => c.branches.length > 1).length;
        expect(decks(big)).toBeLessThan(decks(small));
    });

    test('the arena has bowed sides - corners reach further than edge midpoints', () => {
        const mid = (mask.width + 1) / 2;
        const isGround = (x, y) => cellKindAt(mask, x, y) === CELL.TRACK;
        // Straight up from the centre runs out of board sooner than the diagonal does.
        let vertical = 0;
        while (isGround(Math.round(mid), Math.round(mid) - vertical - 1)) vertical++;
        let diagonal = 0;
        while (isGround(Math.round(mid) - diagonal - 1, Math.round(mid) - diagonal - 1)) diagonal++;
        expect(diagonal * Math.SQRT2).toBeGreaterThan(vertical);
    });
});
