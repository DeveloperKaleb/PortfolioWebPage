import { describe, test, expect } from 'vitest';
import { createPoliteFetch, retryAfterMs, BudgetExceeded, TooLarge, USER_AGENT, COURTESY } from '../../js/polite.js';

/* A fake network and a fake clock: sleeping moves the clock, and every request is logged
   with the time it was made and how many were in flight. */
function harness(reply, options = {}) {
    let clock = 0, inFlight = 0;
    const log = [];
    const sleeps = [];
    const fetch = async (url, init) => {
        inFlight++;
        const entry = { url, at: clock, headers: init.headers, concurrent: inFlight };
        log.push(entry);
        await Promise.resolve();
        try {
            return await reply(url, log.length);
        } finally {
            inFlight--;
        }
    };
    const polite = createPoliteFetch({
        fetch,
        now: () => clock,
        sleep: async (ms) => { sleeps.push(ms); clock += ms; },
        ...options,
    });
    return { polite, log, sleeps };
}

const ok = (body = '[]', headers = {}) => new Response(body, { status: 200, headers });
const status = (code, headers = {}) => new Response(code === 304 ? null : '', { status: code, headers });

describe('Courtesy', () => {
    test('identifies itself, with a contact address and the project', async () => {
        const { polite, log } = harness(() => ok());
        await polite('https://api.example.org/a');
        expect(log[0].headers['User-Agent']).toBe(USER_AGENT);
        expect(USER_AGENT).toMatch(/@/);
        expect(USER_AGENT).toMatch(/github\.com/);
    });

    test('never has two requests in flight, however it is called', async () => {
        const { polite, log } = harness(() => ok());
        await Promise.all([1, 2, 3, 4].map((k) => polite(`https://api.example.org/${k}`)));
        expect(log).toHaveLength(4);
        log.forEach((entry) => expect(entry.concurrent).toBe(1));
    });

    test('leaves the minimum gap between requests to the same host', async () => {
        const { polite, log } = harness(() => ok());
        for (const k of [1, 2, 3]) await polite(`https://api.example.org/${k}`);
        expect(log[1].at - log[0].at).toBeGreaterThanOrEqual(COURTESY.minGapMs);
        expect(log[2].at - log[1].at).toBeGreaterThanOrEqual(COURTESY.minGapMs);
    });

    test('does not hold up a request to a different host', async () => {
        const { polite, log } = harness(() => ok());
        await polite('https://one.example.org/');
        await polite('https://two.example.org/');
        expect(log[1].at).toBe(log[0].at);
    });

    test('waits as long as Retry-After asks on a 429, then tries again', async () => {
        const { polite, log, sleeps } = harness((_, n) => (n === 1 ? status(429, { 'Retry-After': '30' }) : ok('fine')));
        const result = await polite('https://api.example.org/');
        expect(result.body).toBe('fine');
        expect(log).toHaveLength(2);
        expect(sleeps).toContain(30000);
    });

    test('backs off exponentially when no Retry-After is given, and gives up', async () => {
        const { polite, log, sleeps } = harness(() => status(503));
        const result = await polite('https://api.example.org/');
        expect(result.ok).toBe(false);
        expect(result.status).toBe(503);
        expect(log).toHaveLength(COURTESY.maxRetries + 1);
        const backoffs = sleeps.filter((ms) => ms >= COURTESY.backoffMs);
        expect(backoffs).toEqual([COURTESY.backoffMs, COURTESY.backoffMs * 2, COURTESY.backoffMs * 4]);
    });

    test('gives up rather than wait an unreasonable Retry-After', async () => {
        const { polite, log, sleeps } = harness(() => status(429, { 'Retry-After': String(24 * 3600) }));
        const result = await polite('https://api.example.org/');
        expect(result.gaveUp).toMatch(/longer than we wait/);
        expect(log).toHaveLength(1);
        expect(Math.max(0, ...sleeps)).toBeLessThan(COURTESY.maxRetryAfterMs);
    });

    test('does not retry a request the service refused', async () => {
        const { polite, log } = harness(() => status(404));
        expect((await polite('https://api.example.org/')).status).toBe(404);
        expect(log).toHaveLength(1);
    });

    test('retries a network failure, then reports it', async () => {
        const { polite, log } = harness(() => { throw new TypeError('fetch failed'); });
        await expect(polite('https://api.example.org/')).rejects.toThrow('fetch failed');
        expect(log).toHaveLength(COURTESY.maxRetries + 1);
    });

    test('stops at its request budget, retries included', async () => {
        const { polite, log } = harness(() => status(503), { maxRequests: 5 });
        await polite('https://api.example.org/a'); // 4 requests: 1 + 3 retries
        await expect(polite('https://api.example.org/b')).rejects.toThrow(BudgetExceeded);
        expect(log).toHaveLength(5);
        expect(polite.used()).toBe(5);
    });

    test('stops reading a response larger than expected, and does not retry it', async () => {
        const { polite, log } = harness(() => ok('x'.repeat(5000)), { maxBytes: 1000 });
        await expect(polite('https://api.example.org/')).rejects.toThrow(TooLarge);
        expect(log).toHaveLength(1);
    });

    test('passes conditional headers and reports not-modified', async () => {
        const { polite, log } = harness(() => status(304));
        const result = await polite('https://api.example.org/', { headers: { 'If-None-Match': '"v1"' } });
        expect(log[0].headers['If-None-Match']).toBe('"v1"');
        expect(result.notModified).toBe(true);
    });
});

describe('Retry-After', () => {
    test('reads seconds', () => expect(retryAfterMs('120', 0)).toBe(120000));

    test('reads an HTTP date', () => {
        const now = Date.parse('Fri, 02 Oct 2026 12:00:00 GMT');
        expect(retryAfterMs('Fri, 02 Oct 2026 12:01:00 GMT', now)).toBe(60000);
    });

    test('ignores nonsense', () => expect(retryAfterMs('soon', 0)).toBeNull());
});
