import { describe, test, expect } from 'vitest';
import {
    CELL,
    buildStrandGraph,
    linkByContinuity,
    stepFrom,
    nodeAt,
    strandsAt,
    isOverlapCell,
    overlapCells,
    isLayeredSelfCollision,
    isUnderneath,
    strandEdges,
    topStrandAt,
    topOccupant,
    circularDelta,
    circularMean,
} from '../../js/strands.js';
import { getBoardShape, INFINITY_MASK } from '../../js/logic.js';

/* A hand-built crossing, nothing to do with the lemniscate: a vertical strand and a
   horizontal one sharing the middle cell. If the tooling is general, this works with
   no special-casing.

       . V .          V = vertical strand only
       H X H          H = horizontal strand only
       . V .          X = both, the crossing
*/
const track = (branches) => ({ kind: CELL.TRACK, branches });
const wall = () => ({ kind: CELL.WALL, branches: [] });
const VERTICAL = 0;    // parameter identifying the vertical strand
const HORIZONTAL = 3;  // far enough away that continuity never confuses the two

const crossMask = {
    width: 3,
    height: 3,
    cells: [
        [wall(), track([VERTICAL]), wall()],
        [track([HORIZONTAL]), track([VERTICAL, HORIZONTAL]), track([HORIZONTAL])],
        [wall(), track([VERTICAL]), wall()],
    ],
};

const UP = { x: 0, y: -1 }, DOWN = { x: 0, y: 1 }, LEFT = { x: -1, y: 0 }, RIGHT = { x: 1, y: 0 };

describe('Strand graph on an arbitrary crossing map', () => {
    const graph = buildStrandGraph(crossMask);

    test('the shared cell holds two strands, the others one', () => {
        expect(strandsAt(graph, 2, 2)).toHaveLength(2);
        expect(strandsAt(graph, 2, 1)).toHaveLength(1);
        expect(isOverlapCell(graph, 2, 2)).toBe(true);
        expect(isOverlapCell(graph, 2, 1)).toBe(false);
        expect(overlapCells(graph)).toEqual([{ x: 2, y: 2 }]);
    });

    test('entering the crossing keeps you on the strand you arrived on', () => {
        const entering = stepFrom(graph, { x: 2, y: 1, strand: 0 }, DOWN);
        expect(entering).not.toBeNull();
        expect(entering.param).toBe(VERTICAL);
    });

    test('you leave the crossing on the same strand you entered it', () => {
        const inside = stepFrom(graph, { x: 2, y: 1, strand: 0 }, DOWN);
        const leaving = stepFrom(graph, inside, DOWN);
        expect(leaving).toMatchObject({ x: 2, y: 3 });
    });

    // The rule the whole feature turns on: on the upper strand, the lower strand's
    // territory is not somewhere you can turn into - it is off the edge.
    test('turning off your strand inside the crossing is a dead end', () => {
        const onVertical = stepFrom(graph, { x: 2, y: 1, strand: 0 }, DOWN);
        expect(stepFrom(graph, onVertical, RIGHT)).toBeNull();
        expect(stepFrom(graph, onVertical, LEFT)).toBeNull();
    });

    test('the other strand runs straight through the same cell', () => {
        const onHorizontal = stepFrom(graph, { x: 1, y: 2, strand: 0 }, RIGHT);
        expect(onHorizontal.param).toBe(HORIZONTAL);
        expect(stepFrom(graph, onHorizontal, RIGHT)).toMatchObject({ x: 3, y: 2 });
        expect(stepFrom(graph, onHorizontal, UP)).toBeNull();
    });

    test('one strand sits above the other, consistently', () => {
        const [under, over] = strandsAt(graph, 2, 2);
        expect(under.layer).toBe(0);
        expect(over.layer).toBe(1);
        expect(topOccupant([under, over])).toBe(over);
    });
});

describe('Layer-aware collision', () => {
    test('sharing a cell on different strands is not a collision', () => {
        const head = { x: 2, y: 2, strand: 0 };
        const body = [{ x: 2, y: 2, strand: 1 }];
        expect(isLayeredSelfCollision(head, body)).toBe(false);
    });

    test('the same node is still a collision', () => {
        const head = { x: 2, y: 2, strand: 1 };
        const body = [{ x: 5, y: 5, strand: 0 }, { x: 2, y: 2, strand: 1 }];
        expect(isLayeredSelfCollision(head, body)).toBe(true);
    });
});

describe('Pluggable linking', () => {
    // A map that isn't curve-derived supplies its own rule for "same piece of track".
    test('a custom link predicate replaces continuity entirely', () => {
        const nothingConnects = buildStrandGraph(crossMask, { link: () => false });
        expect(stepFrom(nothingConnects, { x: 2, y: 1, strand: 0 }, DOWN)).toBeNull();
    });

    test('a loose tolerance merges strands that continuity would separate', () => {
        const loose = buildStrandGraph(crossMask, { link: linkByContinuity(Math.PI) });
        expect(stepFrom(loose, { x: 2, y: 2, strand: 0 }, RIGHT)).not.toBeNull();
    });

    test('circular distance wraps around the ends of the range', () => {
        expect(circularDelta(0.1, 2 * Math.PI - 0.1)).toBeCloseTo(0.2, 5);
    });
});

describe('The Infinity board as a consumer of the tooling', () => {
    const { graph } = getBoardShape('infinity');

    test('its crossing is the only place strands share cells', () => {
        expect(overlapCells(graph).length).toBe(
            INFINITY_MASK.cells.flat().filter((c) => c.branches.length > 1).length
        );
    });

    // If the layer order flipped partway across the crossing, the snake would appear
    // to surface halfway through going underneath.
    test('the same strand is on top across the whole crossing', () => {
        const tops = overlapCells(graph).map((c) => {
            const [under, over] = strandsAt(graph, c.x, c.y);
            return over.param > under.param;
        });
        expect(new Set(tops).size).toBe(1);
    });

    /* A lap-of-the-board walk used to live here. It was a weaker duplicate of the
       reachability check in "Board integrity" below - and it steered by a naive
       "turn whichever way continues" rule, so a wider crossing defeated the walker
       rather than revealing anything about the board. Reachability is the real
       property: every node connected to every other. */
});

/* Regression guards for a bug that shipped: the curve parameter for a cell was the
   arithmetic mean of the t values passing near it, which is wrong wherever a cell
   straddles the 2pi -> 0 wrap at the tip of a lobe. Those cells got a parameter near
   pi - pointing at the far side of the curve - so continuity rejected their genuine
   neighbours and the ribbon was severed at the tip. Driving into it read as stepping
   off the crossing on track that was perfectly good. */
describe('Board integrity', () => {
    const reachableFrom = (graph, node) => {
        const key = (n) => `${n.x},${n.y},${n.strand}`;
        const seen = new Set([key(node)]);
        const queue = [node];
        while (queue.length) {
            const current = queue.pop();
            Object.values(current.neighbours).forEach((next) => {
                if (!next || seen.has(key(next))) return;
                seen.add(key(next));
                queue.push(graph.nodes.get(key(next)));
            });
        }
        return seen.size;
    };

    test.each(['classic', 'donut', 'infinity'])('every node on the %s board is reachable', (mode) => {
        const { graph } = getBoardShape(mode);
        const start = graph.nodes.values().next().value;
        expect(reachableFrom(graph, start)).toBe(graph.nodes.size);
    });

    test('the vertical Infinity board is whole too', () => {
        const { graph } = getBoardShape('infinity', 'vertical');
        const start = graph.nodes.values().next().value;
        expect(reachableFrom(graph, start)).toBe(graph.nodes.size);
    });

    // The direct form of the same fault: linked neighbours must be close on the curve.
    test('linked neighbours are continuous along the curve', () => {
        const { graph } = getBoardShape('infinity');
        graph.nodes.forEach((node) => {
            Object.values(node.neighbours).forEach((next) => {
                if (!next) return;
                const neighbour = nodeAt(graph, next.x, next.y, next.strand);
                expect(circularDelta(node.param, neighbour.param)).toBeLessThanOrEqual(1);
            });
        });
    });

    test('the crossing is a usable band, not a pinhole', () => {
        const cells = overlapCells(getBoardShape('infinity').graph);
        const xs = cells.map((c) => c.x);
        const ys = cells.map((c) => c.y);
        expect(Math.max(...xs) - Math.min(...xs) + 1).toBeGreaterThanOrEqual(7);
        expect(Math.max(...ys) - Math.min(...ys) + 1).toBeGreaterThanOrEqual(5);
    });
});

describe('Circular mean', () => {
    test('averages across the wrap instead of through the middle', () => {
        // The arithmetic mean of these is ~pi, the opposite side of the curve.
        const mean = circularMean([2 * Math.PI - 0.1, 0.1]);
        expect(Math.min(mean, 2 * Math.PI - mean)).toBeCloseTo(0, 5);
    });

    test('behaves normally away from the wrap', () => {
        expect(circularMean([1.0, 1.2])).toBeCloseTo(1.1, 5);
    });
});

describe('Being underneath', () => {
    const graph = buildStrandGraph(crossMask);

    test('the lower strand of a shared cell is underneath', () => {
        const [under, over] = strandsAt(graph, 2, 2);
        expect(isUnderneath(graph, under)).toBe(true);
        expect(isUnderneath(graph, over)).toBe(false);
    });

    test('a cell with only one strand is never underneath', () => {
        expect(isUnderneath(graph, { x: 2, y: 1, strand: 0 })).toBe(false);
    });

    test('an unknown position is not underneath', () => {
        expect(isUnderneath(graph, { x: 99, y: 99, strand: 0 })).toBe(false);
    });
});

describe('The mouths of the crossing', () => {
    /* Where the two strands run alongside each other before their ribbons merge, the
       player is already committed to a strand - so those cells belong to the crossing
       and have to be drawn as part of it. They are found by crossingHalfWidth, which
       reaches further than the ribbon's own halfWidth. */
    test('cells flanking the crossing are part of it', () => {
        const { graph: board } = getBoardShape('infinity');
        [[12, 7], [13, 7], [22, 8], [23, 8]].forEach(([x, y]) => {
            expect(isOverlapCell(board, x, y)).toBe(true);
        });
    });

    test('the far ends of the lobes are not', () => {
        const { graph: board } = getBoardShape('infinity');
        [[2, 7], [33, 7]].forEach(([x, y]) => {
            expect(isOverlapCell(board, x, y)).toBe(false);
        });
    });
});

describe('Strand edges', () => {
    const graph = buildStrandGraph(crossMask);

    test('the top strand of a crossing reports the sides its band ends on', () => {
        // The horizontal strand runs left-right, so its band ends above and below.
        const top = topStrandAt(graph, 2, 2);
        const edges = strandEdges(graph, top).map((d) => `${d.x},${d.y}`).sort();
        expect(edges).toEqual(['0,-1', '0,1']);
    });

    test('a cell with a single strand has no top strand to outline', () => {
        expect(topStrandAt(graph, 2, 1)).toBeNull();
    });

    test('a dead-end reports every direction as an edge', () => {
        const lone = buildStrandGraph({
            width: 1, height: 1, cells: [[{ kind: CELL.TRACK, branches: [] }]],
        });
        expect(strandEdges(lone, { x: 1, y: 1, strand: 0 })).toHaveLength(4);
    });

    // Always drawn, so the crossing is visible before the snake reaches it.
    test('the Infinity crossing carries outlined edges', () => {
        const { graph: board } = getBoardShape('infinity');
        const outlined = overlapCells(board)
            .filter((c) => strandEdges(board, topStrandAt(board, c.x, c.y)).length > 0);
        expect(outlined.length).toBeGreaterThan(8);
    });
});
