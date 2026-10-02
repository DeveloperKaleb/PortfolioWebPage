/* The courtesy layer every Rubin data request goes through.
 *
 * The services it calls (Fink, JPL) are run by small teams and publish no rate limits,
 * so the limits are ours and deliberately conservative:
 *   - one request at a time, never in parallel;
 *   - a minimum gap between requests to the same host;
 *   - a hard budget of requests per run, after which it refuses rather than carries on;
 *   - on 429 or 5xx, wait as long as Retry-After asks (within reason) or back off
 *     exponentially, and give up after a few tries;
 *   - an identifying User-Agent with a contact address and the project's link;
 *   - a timeout, and a size cap that stops reading a response that is larger than
 *     expected rather than downloading all of it.
 *
 * fetch, sleep and now are passed in, so the tests drive it with a fake network and a
 * fake clock and never touch a real service. No DOM; used by the collector, not the
 * page.
 */

export const USER_AGENT = 'portfolio-rubin/0.1 (+https://github.com/DeveloperKaleb/PortfolioWebPage; kalajholt@gmail.com)';

export const COURTESY = {
    minGapMs: 5000,
    maxRequests: 200,
    maxRetries: 3,
    backoffMs: 10000,
    maxBackoffMs: 300000,
    maxRetryAfterMs: 3600000,
    timeoutMs: 120000,
    maxBytes: 50 * 1024 * 1024,
};

export class BudgetExceeded extends Error {}
export class TooLarge extends Error {}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/* Retry-After as milliseconds: either seconds or an HTTP date. */
export function retryAfterMs(value, nowMs) {
    if (!value) return null;
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const at = Date.parse(value);
    return Number.isFinite(at) ? Math.max(0, at - nowMs) : null;
}

async function readCapped(response, maxBytes) {
    if (!response.body || !response.body.getReader) {
        const text = await response.text();
        if (text.length > maxBytes) throw new TooLarge(`response over ${maxBytes} bytes`);
        return text;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0, text = '';
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBytes) {
            await reader.cancel();
            throw new TooLarge(`response over ${maxBytes} bytes`);
        }
        text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
}

export function createPoliteFetch({
    fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = () => Date.now(),
    userAgent = USER_AGENT,
    ...options
}) {
    const rules = { ...COURTESY, ...options };
    const lastAt = new Map();
    let used = 0;
    let queue = Promise.resolve();

    /* One request, timed out as a whole: headers and body together. */
    async function once(url, headers, maxBytes) {
        if (used >= rules.maxRequests) throw new BudgetExceeded(`request budget of ${rules.maxRequests} used up`);
        const host = new URL(url).host;
        const wait = (lastAt.get(host) ?? -Infinity) + rules.minGapMs - now();
        if (wait > 0) await sleep(wait);
        used++;
        lastAt.set(host, now());
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), rules.timeoutMs);
        try {
            const response = await fetch(url, { headers: { 'User-Agent': userAgent, ...headers }, signal: controller.signal });
            const body = response.status === 304 ? '' : await readCapped(response, maxBytes);
            return { status: response.status, ok: response.ok, notModified: response.status === 304, headers: response.headers, body };
        } finally {
            clearTimeout(timer);
        }
    }

    async function request(url, { headers = {}, maxBytes = rules.maxBytes } = {}) {
        for (let attempt = 0; ; attempt++) {
            let result, failure;
            try {
                result = await once(url, headers, maxBytes);
            } catch (error) {
                /* Over budget or over size: stop, do not retry. */
                if (error instanceof BudgetExceeded || error instanceof TooLarge) throw error;
                failure = error;
            }
            if (result && !RETRYABLE.has(result.status)) return result;
            if (attempt >= rules.maxRetries) {
                if (failure) throw failure;
                return result;
            }
            const asked = result ? retryAfterMs(result.headers.get('retry-after'), now()) : null;
            if (asked !== null && asked > rules.maxRetryAfterMs) {
                return { ...result, gaveUp: `Retry-After of ${Math.round(asked / 1000)} s is longer than we wait` };
            }
            await sleep(asked ?? Math.min(rules.maxBackoffMs, rules.backoffMs * 2 ** attempt));
        }
    }

    /* Requests are queued so that, however they are called, only one is ever in flight. */
    const polite = (url, options) => {
        const result = queue.then(() => request(url, options));
        queue = result.catch(() => {});
        return result;
    };
    polite.used = () => used;
    return polite;
}
