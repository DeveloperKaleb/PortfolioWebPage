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
    topOccupant,
    circularDelta,
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

    test('a lap of the board returns to where it started', () => {
        // Follow the track and confirm it is one continuous closed ribbon.
        const { start } = getBoardShape('infinity');
        let position = start.snake[0];
        let direction = start.direction;
        const first = position;
        let steps = 0;

        while (steps < 5000) {
            let next = stepFrom(graph, position, direction);
            if (!next) {
                // At the end of a straight, turn to whichever side continues.
                const turns = [{ x: -direction.y, y: direction.x }, { x: direction.y, y: -direction.x }];
                const options = turns.map((t) => ({ t, n: stepFrom(graph, position, t) })).filter((o) => o.n);
                if (!options.length) break;
                direction = options[0].t;
                next = options[0].n;
            }
            position = next;
            steps++;
            if (position.x === first.x && position.y === first.y && position.strand === first.strand) break;
        }
        expect(steps).toBeGreaterThan(10);
        expect(position).toMatchObject({ x: first.x, y: first.y, strand: first.strand });
    });
});
