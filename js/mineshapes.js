/* Mine A Shape!: Mine Sweeper boards whose mines draw a picture.
 *
 * Painted by the project owner in Finger Paint. The whole picture is the board: black
 * squares are mines, white squares are safe. Flag every mine and the flags draw the
 * picture; lose and the revealed mines show it. Transcribed here as rows of text - '#' a
 * mine, '.' a safe square - so only the rows ship, never the pictures. Pure: no DOM. See
 * NOTES.md, "Mine A Shape!".
 */

export const SHAPES = [
    // The project owner's first picture, painted 10x10: a heart outline, and a mine in each corner.
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

export const articleFor = (name) => (/^[aeiou]/i.test(name) ? 'an' : 'a');

// `article` overrides the guess for the names it gets wrong ("a unicorn", "an hour").
export function parseShape({ name, article, rows }) {
    const mines = new Set();
    rows.forEach((row, y) => [...row].forEach((mark, x) => { if (mark === '#') mines.add(`${x + 1},${y + 1}`); }));
    return {
        name,
        article: article || articleFor(name),
        width: Math.max(...rows.map((row) => row.length)),
        height: rows.length,
        mines,
        mineCount: mines.size,
    };
}

export const SHAPE_BOARDS = SHAPES.map(parseShape);
