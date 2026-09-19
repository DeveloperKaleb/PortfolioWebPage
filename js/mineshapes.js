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
    /* The project owner's first picture, painted 10x10: a heart outline, and a mine in each
       corner. The only 10x10 here. Profile 17/2/0/3 - small, but it asks for the pair rule
       and three steps the solver has to prove outright.

       Two openings, and not for the usual reason: on a 10x10 the cap is 20 squares and
       nothing here reaches it. This one fails at the other end. The outline cuts the board
       into pockets too small to qualify - 68 of its 76 safe squares cascade fewer than the
       nine needed - and of the eight that do reach the two pockets that qualify, 16 squares
       and 12, six leave a board that still needs a guess. Hence two, and hence it opens much
       the same each time. */
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
    /* Octopi, painted 20x20 by the project owner - two of them, one above the other, which is
       why the name is already plural and takes no article: "It was Octopi!". (Early drafts of
       it read as two faces, and the name came later; nothing here is a face.) It took five
       passes to make solvable, and what did it was dotting the top bars - '#.#.#' rather than
       a solid run. A solid bar gave
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
    /* A bear, painted 20x20 by the project owner - the shapes at the top are its ears. Its
       profile is 0/0/0 - the simple rules carry it from the opening to the last square - and
       that is why it is here: the list is meant to lean toward comfortable play, not toward
       boards like Mine Nonsense V1. An earlier version at 23% was harder but unsolvable, its
       mouth drawn as two parallel strokes that made a double coin-flip; this one is sparser
       and the mouth is staggered. */
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
    /* A horse's head, painted 20x20 by the project owner - ears at the top, the eye the
       small block, the muzzle the run across the middle, and the mane the long stroke down
       the right edge. Profile 18/0/1/0: the simple rules carry it, bar one step that needs
       the mine count. That figure is the five-opening sample the tool stores; measuring all
       77 gives 21 rounds and the same 0/1/0.

       The drawing alone was solvable but had only six openings, all in the cheek - the one
       white pocket it left between the nine-square minimum and the twenty-percent cap. The
       ten mines away from the horse are what fixed that, and the order they arrived in is
       the lesson. Twelve scattered dots came first and made it unsolvable: a lone mine in
       open space has no number beside it to pin it, so it can only be settled by counting,
       and twelve at once turned the finish into a guess. Four, one per corner, were safe
       again but bought nothing - at the field's extremities they shaved the background's
       edges rather than cutting it. Four more, beside the ears and temples, did cut it: each
       bridges the drawing to a corner dot, and together they sever the top band into pockets
       of 41 and 36, which took six openings to 39.

       The last two, at (7,19) and (18,19), are the ones worth understanding. The horse has
       no bottom, so its interior drained through the two open rows beneath it and joined the
       background as a single 181-square region no opening could use. Anchored to the jaw
       stroke and to the mane, those two close it - not by filling the corridor but by
       numbering it, the bottom row being one square deep and a cascade only travelling
       through squares that touch no mine at all. That split the region into a 97 interior
       and an 80 background, and took 39 openings to 77.

       Which leaves one thing to know: that 80 is exactly the cap. One more safe square in
       the background tips it to 81, where it is refused whole and takes about 38 openings
       with it. So re-run the tool after any edit near the edges, not only after one that
       moves the horse itself. */
    {
        name: 'horse',
        rows: [
            '....................',
            '.#................#.',
            '....#...#..#...#....',
            '........##.##.......',
            '..#....#.###.#...#..',
            '......#.#.....#.....',
            '.......#.......#....',
            '......#..##.....#...',
            '.....#...##.....#...',
            '....#............#..',
            '...#.............#..',
            '..#.#.......#....#..',
            '..#....#####.....#..',
            '..###.#..........#..',
            '...###...#.......#..',
            '........#........#..',
            '........#........#..',
            '.......#.........#..',
            '.#....#..........##.',
            '....................',
        ],
    },
    /* A ghost, painted 20x20 by the project owner. Profile 34/6/0/0 - pair work, but never
       the mine count or the solver - and 148 openings, more than any other picture here.

       This is the board the cascade standard was written for. As first painted its outline
       was closed, sealing the interior into two pockets of 29 and 24, while the background
       wrapped around the outside as a single 255-square ring: one click out there opened 73%
       of the safe squares and silhouetted the whole ghost at once, which is the one thing
       this mode is meant not to do. It was solvable throughout - solvability was never the
       fault.

       Two passes fixed it, and the difference between them is the lesson. A pair of mines out
       in the middle of the ring, at (3,11) and (18,11), did nothing at all - 262 squares to
       255 - because five squares of clear ground either side let a cascade walk straight
       around them. The four that worked, at (7,4), (14,4), (3,16) and (18,16), sit at the
       ring's narrow points, where the gap between the outline and the board edge is tight
       enough for one mine's numbers to span the whole width. The same principle as the
       horse's bottom corridor. The ring broke into six regions, none above 77, and fifteen
       openings became 148.

       What it cost: as first painted this was the gentlest board in the list at 14/0/0/0, and
       the mines that cut the ring brought six pair steps with them. Still comfortable, with
       nothing needing the count or the solver - but the bear is the pure 0/0/0 now. */
    {
        name: 'ghost',
        rows: [
            '....................',
            '.....#........#.....',
            '....................',
            '...#..#......#..#...',
            '....................',
            '.......######.......',
            '......#......#......',
            '.....#........#.....',
            '..............#.....',
            '.....#...#..#.#.....',
            '..#......#..#.#..#..',
            '.....#........#.....',
            '.......##.....##....',
            '.....#..#......#....',
            '.......#......#.....',
            '..#.#........#...#..',
            '....#########.......',
            '.#................#.',
            '..#..............#..',
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

/* Each picture with its stored solvable openings, as [column, row] pairs, its stored
   difficulty profile, and its cascade profile - the biggest a single click can open. All
   three are for choosing and checking pictures, and none is ever shown to a player. */
export const SHAPE_BOARDS = SHAPES.map((raw) => ({
    ...parseShape(raw),
    openings: (MINE_OPENINGS[raw.name] || { openings: [] }).openings,
    difficulty: (MINE_OPENINGS[raw.name] || {}).difficulty || null,
    cascade: (MINE_OPENINGS[raw.name] || {}).cascade || null,
}));
