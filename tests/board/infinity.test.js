import { describe, test, expect } from 'vitest';
import {
    INFINITY_MASK,
    INFINITY_MASK_VERTICAL,
    CELL,
    cellKindAt,
    transposeMask,
    buildLemniscateMask,
    findStartingPosition,
    getBoardShape,
    isWallCollision,
} from '../../js/logic.js';
import { stepFrom } from '../../js/strands.js';

const countKinds = (mask) => {
    const counts = { track: 0, hole: 0, wall: 0 };
    mask.cells.forEach((row) => row.forEach((c) => { counts[c.kind]++; }));
    return counts;
};

// Walk the track 4-directionally from one cell and see how much of it is reachable.
const reachableTrack = (mask) => {
    let start = null;
    for (let y = 1; y <= mask.height && !start; y++) {
        for (let x = 1; x <= mask.width && !start; x++) {
            if (cellKindAt(mask, x, y) === CELL.TRACK) start = [x, y];
        }
    }
    const seen = new Set([start.join(',')]);
    const queue = [start];
    while (queue.length) {
        const [x, y] = queue.pop();
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
            const key = `${x + dx},${y + dy}`;
            if (cellKindAt(mask, x + dx, y + dy) === CELL.TRACK && !seen.has(key)) {
                seen.add(key);
                queue.push([x + dx, y + dy]);
            }
        });
    }
    return seen.size;
};

describe('Infinity board geometry', () => {
    test('is roughly the same play area as the other boards', () => {
        // Classic is 400 playable, Donut 336. This should land between them.
        const { track } = countKinds(INFINITY_MASK);
        expect(track).toBeGreaterThan(320);
        expect(track).toBeLessThan(400);
    });

    // A track split into two pieces would be an unplayable board - the snake could
    // be stranded in a section with no route back to the food.
    test('the whole track is reachable from any point on it', () => {
        expect(reachableTrack(INFINITY_MASK)).toBe(countKinds(INFINITY_MASK).track);
    });

    test('has enclosed holes as well as outer wall', () => {
        const { hole, wall } = countKinds(INFINITY_MASK);
        expect(hole).toBeGreaterThan(0); // the two lobe interiors
        expect(wall).toBeGreaterThan(0); // outside the ribbon
    });

    // The lemniscate crosses itself exactly once, so some cells sit under two
    // separate stretches of curve. The over/under layering will key off these.
    test('records a self-crossing region', () => {
        const crossing = INFINITY_MASK.cells.flat().filter((c) => c.branches.length > 1);
        expect(crossing.length).toBeGreaterThan(0);
        crossing.forEach((c) => expect(c.branches).toHaveLength(2));
    });

    test('the two strands at the crossing are far apart on the curve', () => {
        // Well-separated branches are what makes "which strand am I on" answerable.
        const crossing = INFINITY_MASK.cells.flat().filter((c) => c.branches.length > 1);
        const gaps = crossing.map((c) => Math.abs(c.branches[0] - c.branches[1]));
        expect(Math.min(...gaps)).toBeGreaterThan(1);
    });
});

describe('Board orientation', () => {
    test('the vertical board is the horizontal one transposed', () => {
        expect(INFINITY_MASK_VERTICAL.width).toBe(INFINITY_MASK.height);
        expect(INFINITY_MASK_VERTICAL.height).toBe(INFINITY_MASK.width);
    });

    test('both orientations have identical play area', () => {
        expect(countKinds(INFINITY_MASK_VERTICAL)).toEqual(countKinds(INFINITY_MASK));
    });

    test('transposing twice returns the original', () => {
        const twice = transposeMask(transposeMask(INFINITY_MASK));
        expect(twice.width).toBe(INFINITY_MASK.width);
        expect(twice.cells).toEqual(INFINITY_MASK.cells);
    });
});

describe('Starting position', () => {
    test.each([['horizontal'], ['vertical']])(
        'the %s board starts the snake on track with room to move',
        (orientation) => {
            const shape = getBoardShape('infinity', orientation);
            const start = findStartingPosition(shape.graph);
            start.snake.forEach(({ x, y }) => {
                expect(cellKindAt(shape.mask, x, y)).toBe(CELL.TRACK);
            });
            // Enough clear cells ahead that the player has time to react.
            expect(start.runway).toBeGreaterThanOrEqual(5);
        }
    );

    test('the opening moves stay on the track', () => {
        const { start, graph } = getBoardShape('infinity');
        let position = start.snake[0];
        for (let i = 0; i < 5; i++) {
            position = stepFrom(graph, position, start.direction);
            expect(position).not.toBeNull();
        }
    });
});

describe('Board shapes', () => {
    test('classic and donut keep their 20x20 grid', () => {
        ['classic', 'donut'].forEach((mode) => {
            const shape = getBoardShape(mode);
            expect(shape.width).toBe(20);
            expect(shape.height).toBe(20);
        });
    });

    // Donut's hole is 8x8, so it has 64 fewer places to be than Classic.
    test('every board exposes a graph, sized to its playable space', () => {
        expect(getBoardShape('classic').graph.nodes.size).toBe(400);
        expect(getBoardShape('donut').graph.nodes.size).toBe(336);
    });

    test('infinity reports a non-square board', () => {
        const shape = getBoardShape('infinity');
        expect(shape.width).not.toBe(shape.height);
        expect(shape.mask).not.toBeNull();
    });

    test('wall collision respects a non-square board', () => {
        const { width, height } = getBoardShape('infinity');
        expect(isWallCollision([width, height], width, height)).toBe(false);
        expect(isWallCollision([width + 1, 1], width, height)).toBe(true);
        expect(isWallCollision([1, height + 1], width, height)).toBe(true);
    });

    // The default stays square so the existing Snake logic and tests are untouched.
    test('wall collision still defaults to the 20x20 board', () => {
        expect(isWallCollision([20, 20])).toBe(false);
        expect(isWallCollision([21, 20])).toBe(true);
    });
});

describe('Mask construction', () => {
    test('a thinner ribbon yields less track', () => {
        const thin = buildLemniscateMask({ halfWidth: 1.5 });
        const thick = buildLemniscateMask({ halfWidth: 2.6 });
        expect(countKinds(thin).track).toBeLessThan(countKinds(thick).track);
    });
});
