/* Mine A Shape!: Mine Sweeper boards whose mines draw a picture.
 *
 * Painted by the project owner in Finger Paint. The whole picture is the board: black
 * squares are mines, white squares are safe. Flag every mine and the flags draw the
 * picture; lose and the revealed mines show it. Transcribed here as rows of text - '#' a
 * mine, '.' a safe square - so only the rows ship, never the pictures. Pure: no DOM. See
 * NOTES.md, "Mine A Shape!".
 */

import { MINE_OPENINGS } from './mineopenings.js';

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
    /* Painted 20x20 by the project owner to put every number the game can show on one board.
       The painting first failed the solvability test; this is the version agreed with the
       owner: the 8's ring moved down a row, off the top edge, where some of its mines touched
       only squares logic could never reach, and the mines at (6,4) and (14,4) removed. */
    {
        name: 'Mine Nonsense V1',
        rows: [
            '....................',
            '.....###...###.###..',
            '.###.#.......#.#....',
            '.#.#..##...##..###..',
            '.###................',
            '....#.........#.....',
            '.##....##.###....#..',
            '....#...#.#...#.....',
            '.##...##...##...##..',
            '....#.........#.....',
            '###...##...##...###.',
            '....#.........#.....',
            '...#.#.......#.#....',
            '....#.........#.....',
            '..#...#.....#...#...',
            '....................',
            '.###..###..###..###.',
            '....................',
            '....................',
            '....................',
        ],
    },
    /* A bear, painted 20x20 by the project owner - the shapes at the top are its ears. Its
       profile is 0/0/0 - the simple rules carry it
       from the opening to the last square - and that is why it is here: the list is meant to
       lean toward comfortable play, not toward boards like Mine Nonsense V1. An earlier
       version at 23% was harder but unsolvable, its mouth drawn as two parallel strokes that
       made a double coin-flip; this one is sparser and the mouth is staggered. */
    /* Two faces, painted 20x20 by the project owner. It took five passes to make solvable, and
       what did it was dotting the top bars - '#.#.#' rather than a solid run. A solid bar gave
       the numbers at the corners nothing asymmetric to see, so each corner became a coin flip
       no amount of counting could break; the alternating pattern breaks that symmetry all at
       once, and both corners and both sealed interiors came free together. Earlier passes
       failed the other way: sealed rings no cascade could get into, and once opened, a
       background so large the opening cap refused it. Profile 50/8/0/0 - long, with real
       two-number work, but never a moment that demands counting or a deeper leap. */
    {
        name: 'Octopi',
        article: '',        // already plural: "It was Octopi!"
        rows: [
            '....................',
            '....#.#.#...#....#..',
            '...#.....#..........',
            '..#.......#.........',
            '....#...#.....#.....',
            '....#...#...........',
            '..#.......#.........',
            '...#.....#......#...',
            '..#..#.#..#....#....',
            '....#.#.#...........',
            '....................',
            '...........#.#.#....',
            '......#...#.....#...',
            '..#......#.......#..',
            '...#.......#...#....',
            '...........#...#....',
            '.#.......#.......#..',
            '..........#.....#...',
            '.........#..#.#..#..',
            '..#........#.#.#....',
        ],
    },
    {
        name: 'bear',
        rows: [
            '....................',
            '...####......####...',
            '..#....#....#....#..',
            '.......#....#.......',
            '..#.############.#..',
            '..#..............#..',
            '..##............##..',
            '...#...#....#...#...',
            '...#............#...',
            '...#............#...',
            '...#....####....#...',
            '...#.....##.....#...',
            '...#............#...',
            '....#..#....#..#....',
            '....#...####...#....',
            '.....#........#.....',
            '......#..##..#......',
            '....................',
            '....................',
            '....................',
        ],
    },
];

// The largest board the zoom is built for.
export const MAX_SHAPE_SIZE = 40;

export const articleFor = (name) => (/^[aeiou]/i.test(name) ? 'an' : 'a');

/* How a picture is named once the game is over: "a heart", "an owl", or bare for a plural
   like Octopi. The one place that phrase is built, so nothing assembles it from the parts. */
export const nameWithArticle = (shape) => (shape.article ? `${shape.article} ${shape.name}` : shape.name);

/* `article` overrides the guess for the names it gets wrong ("a unicorn", "an hour"), and an
   empty string means the name takes none at all - a plural like Octopi, which reads "It was
   Octopi!". Only an absent `article` is guessed from the name. */
export function parseShape({ name, article, rows }) {
    const mines = new Set();
    rows.forEach((row, y) => [...row].forEach((mark, x) => { if (mark === '#') mines.add(`${x + 1},${y + 1}`); }));
    return {
        name,
        article: article === undefined ? articleFor(name) : article,
        width: Math.max(...rows.map((row) => row.length)),
        height: rows.length,
        mines,
        mineCount: mines.size,
    };
}

/* A short fingerprint of a picture's rows (32-bit FNV-1a). js/mineopenings.js stores the one
   its openings were worked out from, so a picture changed without re-running the tool is
   caught by the tests rather than dealt from stale openings. */
export function fingerprintRows(rows) {
    let hash = 0x811c9dc5;
    for (const mark of rows.join('/')) hash = Math.imul(hash ^ mark.charCodeAt(0), 0x01000193) >>> 0;
    return hash.toString(16).padStart(8, '0');
}

/* Each picture with its stored solvable openings, as [column, row] pairs, and its stored
   difficulty profile - which is for choosing and checking pictures, never shown to a player. */
export const SHAPE_BOARDS = SHAPES.map((raw) => ({
    ...parseShape(raw),
    openings: (MINE_OPENINGS[raw.name] || { openings: [] }).openings,
    difficulty: (MINE_OPENINGS[raw.name] || {}).difficulty || null,
}));
