/* Mine A Shape!: Mine Sweeper boards that are pictures rather than rectangles.
 *
 * Drawn by the project owner in Finger Paint at the size the board should be, shared as
 * pictures, and transcribed here as rows of text: '#' is a square on the board and '.' is
 * empty space. Only the rows ship - never the pictures - so a shape costs a few hundred
 * bytes. Pure: no DOM. See NOTES.md, "Mine A Shape!".
 */

export const SHAPES = [
    /* The project owner's first drawing, painted 10x10 in Finger Paint. The board is exactly
       the painted squares: a one-square-wide heart outline, and a lone square in each
       corner. Chosen over a filled heart knowing it has no room for a nine-square opening -
       see createShapeGame in js/minesweeper.js for what opens instead. */
    {
        name: 'heart',
        rows: [
            '#........#',
            '..........',
            '.###..###.',
            '.#..##..#.',
            '.#......#.',
            '.#......#.',
            '..#....#..',
            '...#..#...',
            '....##....',
            '#........#',
        ],
    },
];

// The largest board the zoom is built for.
export const MAX_SHAPE_SIZE = 40;

/* Density climbs with size, as it does for the rectangular boards - 12% up to the Standard
   board's 100 squares, 15% up to Large's 400, 18% beyond - so a bigger picture is harder,
   not only longer. */
export const shapeDensity = (area) => (area <= 100 ? 0.12 : area <= 400 ? 0.15 : 0.18);

export const articleFor = (name) => (/^[aeiou]/i.test(name) ? 'an' : 'a');

// `article` overrides the guess for the names it gets wrong ("a unicorn", "an hour").
export function parseShape({ name, article, rows }) {
    const cells = new Set();
    rows.forEach((row, y) => [...row].forEach((mark, x) => { if (mark === '#') cells.add(`${x + 1},${y + 1}`); }));
    return {
        name,
        article: article || articleFor(name),
        width: Math.max(...rows.map((row) => row.length)),
        height: rows.length,
        cells,
        area: cells.size,
        mineCount: Math.round(cells.size * shapeDensity(cells.size)),
    };
}

const OFFSETS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const squaresOf = (shape) => [...shape.cells].map((key) => key.split(',').map(Number));

// Squares with all eight neighbours on the board: an opening there shows at least nine.
export const openingSquares = (shape) => squaresOf(shape)
    .filter(([x, y]) => OFFSETS.every(([dx, dy]) => shape.cells.has(`${x + dx},${y + dy}`)))
    .map(([x, y]) => ({ x, y }));

export const SHAPE_BOARDS = SHAPES.map(parseShape);
