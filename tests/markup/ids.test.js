import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pages = ['index.html', 'entertainment/entertainment.html'];

const read = (page) => readFileSync(resolve(root, page), 'utf8');
const idsIn = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

/* A duplicated id is silent: the page renders, and getElementById quietly returns the
   first match while the second copy sits there doing nothing. That shipped - two board
   size dropdowns side by side on the Minesweeper page - because a patch script applied
   the same insertion twice and nothing complained.

   These pages are edited by hand and by script, so the check is worth having. */
describe.each(pages)('%s', (page) => {
    const html = read(page);

    test('has no duplicate element ids', () => {
        const ids = idsIn(html);
        const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
        expect(duplicates).toEqual([]);
    });

    test('every label points at an element that exists', () => {
        const ids = new Set(idsIn(html));
        const targets = [...html.matchAll(/<label[^>]*\sfor="([^"]+)"/g)].map((m) => m[1]);
        targets.forEach((target) => expect(ids.has(target)).toBe(true));
    });

    // Both pages cache-bust by hand, so a stale one silently serves an old file.
    test('every versioned asset carries the same stamp', () => {
        const stamps = [...html.matchAll(/\?v=(\d{8}-\d{4})/g)].map((m) => m[1]);
        expect(stamps.length).toBeGreaterThan(0);
        expect([...new Set(stamps)]).toHaveLength(1);
    });
});

test('both pages are cache-busted to the same version', () => {
    // A page left behind keeps loading the previous footer.js, so its "last updated"
    // disagrees with the other page's - which is exactly how this was noticed.
    const stampOf = (page) => read(page).match(/\?v=(\d{8}-\d{4})/)[1];
    expect(stampOf(pages[0])).toBe(stampOf(pages[1]));
});

/* The site loads nothing from anywhere else. It used to pull normalize.css from a CDN,
   which meant every visitor's browser contacted a third party, the bytes could not be
   integrity-checked without pinning a hash, and the page lost its reset with no network
   - the one thing a page of offline games ought to survive. It is vendored now.

   Links in the footer point at GitHub and LinkedIn, which is fine: those are somewhere
   the reader chooses to go, not something the page fetches on their behalf. Only
   subresources matter here. */
describe.each(pages)('%s loads only its own files', (page) => {
    const html = read(page);

    test('no stylesheet comes from another origin', () => {
        const remote = [...html.matchAll(/<link[^>]+href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
        expect(remote).toEqual([]);
    });

    test('no script comes from another origin', () => {
        const remote = [...html.matchAll(/<script[^>]+src="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
        expect(remote).toEqual([]);
    });

    test('no image or media comes from another origin', () => {
        const remote = [...html.matchAll(/<(?:img|video|audio|source)[^>]+src="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
        expect(remote).toEqual([]);
    });
});
