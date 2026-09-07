import { describe, test, expect } from 'vitest';
import {
    getBoardShape, BRIDGE_MASK, BRIDGE_LEVELS, BRIDGE_LINK_TOLERANCE,
    buildBridgeMask, isDeckGap, isBridgeRamp, cellKindAt, CELL, makeBridgeLink, BRIDGE_MASK as MASK,
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

    test('the deck overlaps the ground in one unbroken band down the middle', () => {
        const overlaps = overlapCells(graph);
        expect(overlaps.length).toBeGreaterThan(50);

        // One band, not scattered: the columns it occupies are consecutive.
        const columns = [...new Set(overlaps.map((c) => c.x))].sort((a, b) => a - b);
        expect(columns[columns.length - 1] - columns[0] + 1).toBe(columns.length);
        // And centred on the board.
        const middle = (mask.width + 1) / 2;
        expect((columns[0] + columns[columns.length - 1]) / 2).toBeCloseTo(middle, 1);
    });

    /* An hourglass: broad where the deck meets the ground, drawn in at the waist, so its
       edges read as curves. The pinch sits where the hole is, which is where the deck
       asks something of you. */
    test('the deck is pinched at the waist and broad at its ends', () => {
        const widthAtRow = (y) => overlapCells(graph).filter((c) => c.y === y).length;
        const rows = [...new Set(overlapCells(graph).map((c) => c.y))].sort((a, b) => a - b);

        const waist = widthAtRow(rows[Math.floor(rows.length / 2)]);
        expect(waist).toBeLessThan(widthAtRow(rows[0]));
        expect(waist).toBeLessThan(widthAtRow(rows[rows.length - 1]));
    });

    // Even pinched, there is deck to either side of the hole to get past it on.
    test('the waist is wider than the hole', () => {
        const waistRow = Math.round((mask.height + 1) / 2);
        const deckWidth = overlapCells(graph).filter((c) => c.y === waistRow).length;
        const holeWidth = gaps().filter((c) => c.y === waistRow).length;
        // overlapCells already excludes the hole, so this is the deck either side of it.
        expect(deckWidth).toBeGreaterThanOrEqual(4);
        expect(holeWidth).toBeGreaterThan(0);
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
        // The ramp that actually adjoins the deck, wherever the approach begins.
        const rampCells = cellsWhere((x, y) => {
            const cell = mask.cells[y - 1][x - 1];
            return cell.branches.length === 1 && cell.branches[0] === BRIDGE_LEVELS.ramp;
        });
        expect(rampCells.length).toBeGreaterThan(0);

        const adjoining = rampCells.find(({ x, y }) => isOverlapCell(graph, x, y + 1));
        expect(adjoining).toBeDefined();

        const stepped = stepFrom(graph, { x: adjoining.x, y: adjoining.y, strand: 0 }, DOWN);
        expect(stepped).not.toBeNull();
        expect(stepped.param).toBe(BRIDGE_LEVELS.deck);
    });

    /* Two rows deep at each end, so the approach is somewhere you can steer rather than
       a single square you have to hit exactly. */
    test('the approach at each end is more than one row deep', () => {
        const rampRows = new Set(cellsWhere((x, y) => {
            const cell = mask.cells[y - 1][x - 1];
            return cell.branches.length === 1 && cell.branches[0] === BRIDGE_LEVELS.ramp;
        }).map((c) => c.y));
        expect(rampRows.size).toBeGreaterThanOrEqual(4); // two at the top, two at the bottom
    });

    // The entrance is deliberately narrow, but never narrower than two squares.
    test('there are at least two squares to enter the bridge by', () => {
        const rampCells = cellsWhere((x, y) => {
            const cell = mask.cells[y - 1][x - 1];
            return cell.branches.length === 1 && cell.branches[0] === BRIDGE_LEVELS.ramp;
        });
        const rows = [...new Set(rampCells.map((c) => c.y))].sort((a, b) => a - b);
        const widthOf = (y) => rampCells.filter((c) => c.y === y).length;

        expect(widthOf(rows[0])).toBeGreaterThanOrEqual(2);
        expect(widthOf(rows[rows.length - 1])).toBeGreaterThanOrEqual(2);
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
        const narrow = buildBridgeMask({ halfMid: 2 });
        const wide = buildBridgeMask({ halfMid: 5 });
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

describe('The abutments at the ends of the bridge', () => {
    const rampCells = () => cellsWhere((x, y) => {
        const cell = mask.cells[y - 1][x - 1];
        return cell.branches.length === 1 && cell.branches[0] === BRIDGE_LEVELS.ramp;
    });

    // The first deck row below the top ramp: standing under it, the ramp is the abutment.
    const underTheAbutment = () => {
        const ramps = rampCells().map((c) => c.y);
        const lastTop = Math.max(...ramps.filter((y) => y < mask.height / 2));
        const x = Math.round((mask.width + 1) / 2);
        return { x, y: lastTop + 1 };
    };

    /* Without this the underside of the bridge has no wall at all: a snake could walk
       the length of the underpass, reach the end and simply climb out, and nothing down
       there could kill it but the perimeter. */
    test('walking under the deck into the end of the bridge is blocked', () => {
        const spot = underTheAbutment();
        const onGround = nodeAt(graph, spot.x, spot.y, 0);
        expect(onGround).not.toBeNull();
        expect(onGround.param).toBe(BRIDGE_LEVELS.ground);
        expect(stepFrom(graph, onGround, UP)).toBeNull();
    });

    test('but the same move from up on the deck leaves the bridge normally', () => {
        const spot = underTheAbutment();
        const onDeck = nodeAt(graph, spot.x, spot.y, 1);
        expect(onDeck.param).toBe(BRIDGE_LEVELS.deck);
        expect(stepFrom(graph, onDeck, UP)).not.toBeNull();
    });

    // The approach is from the side, which is what makes it distinguishable.
    test('a ramp is still reached by stepping onto it sideways', () => {
        const ramps = rampCells();
        const row = ramps[0].y;
        const leftmost = Math.min(...ramps.filter((c) => c.y === row).map((c) => c.x));

        const beside = nodeAt(graph, leftmost - 1, row, 0);
        expect(beside).not.toBeNull();
        expect(stepFrom(graph, beside, RIGHT)).not.toBeNull();
    });

    test('the whole board is still reachable with the abutments in place', () => {
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

    /* The same pair of levels either way, so only the geometry separates them: ground
       inside the deck's span is beneath the bridge, ground outside it is past the end. */
    test('the link rule tells the abutment from the approach', () => {
        const link = makeBridgeLink(MASK);
        const ramp = { param: BRIDGE_LEVELS.ramp, y: MASK.deckTop - 1 };
        const under = { param: BRIDGE_LEVELS.ground, y: MASK.deckTop + 2 };
        const beyond = { param: BRIDGE_LEVELS.ground, y: MASK.deckTop - 2 };

        expect(link(under, ramp, { x: 0, y: -1 })).toBe(false);   // abutment
        expect(link(beyond, ramp, { x: 0, y: 1 })).toBe(true);    // walking on from the end
        expect(link(under, ramp, { x: 1, y: 0 })).toBe(true);     // and from the side
        // Ramp to deck runs along the bridge, so it stays vertical.
        expect(link(ramp, { param: BRIDGE_LEVELS.deck, y: MASK.deckTop }, { x: 0, y: 1 })).toBe(true);
    });
});

describe('Telling the abutment apart', () => {
    /* Walking into a ramp is the only move on this map that can fail without the square
       itself being unusable - from the side or from past the end it is a legal approach,
       so a refusal means the snake came at it from underneath. That is what lets the
       Bridge report its own message rather than borrowing the generic one. */
    test('ramps are identifiable, and nothing else is mistaken for one', () => {
        const rampRow = mask.deckTop - 1;
        const middle = Math.round((mask.width + 1) / 2);

        expect(isBridgeRamp(mask, middle, rampRow)).toBe(true);
        expect(isBridgeRamp(mask, middle, mask.deckTop + 1)).toBe(false); // deck
        expect(isBridgeRamp(mask, middle, Math.round((mask.height + 1) / 2))).toBe(false); // the hole
        expect(isBridgeRamp(mask, 1, 1)).toBe(false); // outside the arena
    });

    test('the square a blocked snake is refused is a ramp', () => {
        const middle = Math.round((mask.width + 1) / 2);
        const under = nodeAt(graph, middle, mask.deckTop, 0);

        expect(stepFrom(graph, under, UP)).toBeNull();
        expect(isBridgeRamp(mask, under.x, under.y - 1)).toBe(true);
    });

    // The other maps must not start reporting abutments.
    test.each(['classic', 'donut', 'infinity'])('%s has no ramps to confuse it', (mode) => {
        const other = getBoardShape(mode);
        let found = false;
        for (let y = 1; y <= other.mask.height; y++) {
            for (let x = 1; x <= other.mask.width; x++) {
                if (isBridgeRamp(other.mask, x, y)) found = true;
            }
        }
        expect(found).toBe(false);
    });
});
