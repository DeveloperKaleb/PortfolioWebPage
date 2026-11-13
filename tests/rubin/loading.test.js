import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { DIGEST_URL } from '../../js/rubinview.js';

/* How the Solar System tab loads. Left to itself the browser finds the page's modules a
   round at a time and asks for the digest last; rubin.html tells it about all of them at
   once. These tests keep what the page says it needs equal to what it really imports,
   because a hint for a file nobody imports is a wasted download and a missing one is a
   round trip back. */
const root = resolve(__dirname, '../..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const html = read('rubin/rubin.html');

/* Every module reachable from a file's static imports, as paths from the repo's root. */
function imported(entry, seen = new Set()) {
    const source = read(entry);
    for (const [, specifier] of source.matchAll(/^(?:import|export)\b[^'"]*?from\s+'([^']+)'/gms)) {
        const file = specifier.startsWith('/PortfolioWebPage/')
            ? specifier.slice('/PortfolioWebPage/'.length)
            : relative(root, resolve(root, dirname(entry), specifier)).replaceAll('\\', '/');
        if (!seen.has(file)) {
            seen.add(file);
            imported(file, seen);
        }
    }
    return seen;
}

describe('The modules are fetched together', () => {
    const entries = [...html.matchAll(/<script type="module"[^>]*src="([^"?]+)/g)]
        .map(([, src]) => (src.startsWith('/PortfolioWebPage/') ? src.slice('/PortfolioWebPage/'.length) : `rubin/${src.replace('./', '')}`));
    const needed = new Set(entries.flatMap((entry) => [...imported(entry)]));
    const hinted = [...html.matchAll(/<link rel="modulepreload" href="\/PortfolioWebPage\/([^"]+)"/g)].map(([, file]) => file);

    test('the page has its two module scripts', () => {
        expect(entries.sort()).toEqual(['rubin/rubin.js', 'scripts/stream.js']);
    });

    test('every module the page imports is preloaded, and nothing else is', () => {
        expect([...hinted].sort()).toEqual([...needed].sort());
        expect(new Set(hinted).size).toBe(hinted.length);
    });

    test('at the address the import asks for: no stamp', () => {
        hinted.forEach((file) => expect(file).toMatch(/^js\/[a-z]+\.js$/));
    });

    test("the tab does not load the games' code", () => {
        expect(needed.has('js/logic.js')).toBe(false);
        expect(needed.has('js/strands.js')).toBe(false);
        expect(needed.has('js/rubincolors.js')).toBe(true);
    });

    test('the service worker keeps every one of them for offline visits', () => {
        const worker = read('sw.js');
        needed.forEach((file) => expect(worker).toContain(`/${file}\``));
    });
});

describe('The digest is asked for first', () => {
    const inline = html.match(/<script>([\s\S]*?)<\/script>/);

    test('by the one inline script, ahead of the stylesheets it would otherwise wait for', () => {
        expect(html.match(/<script>/g)).toHaveLength(1);
        expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('rel="stylesheet"'));
    });

    test('at the same address, with the same patience, as rubin.js', () => {
        const page = read('rubin/rubin.js');
        expect(inline[1]).toContain(`'${DIGEST_URL}'`);
        expect(inline[1]).toContain("cache: 'no-cache'");
        expect(inline[1]).toContain("get('digest')");
        const timeout = page.match(/const LOAD_TIMEOUT_MS = (\d+);/)[1];
        expect(inline[1]).toContain(`AbortSignal.timeout(${timeout})`);
    });

    test('rubin.js takes that answer only for the address it wants, and can ask itself', () => {
        const page = read('rubin/rubin.js');
        expect(page).toContain('early?.url === url ? early.digest : getJson(url)');
    });

    test('it sends nothing and reads nothing but the digest', () => {
        expect(inline[1]).not.toMatch(/localStorage|cookie|sendBeacon|POST|https?:/);
    });
});
