import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

/* rubin/night.js is a classic script (it runs in the page's head, before the page paints),
   so it is run here in a sandbox and its window.skyNight tested. */
function load({ coarse = true, stored = {}, search = '' } = {}) {
    const store = { ...stored };
    const classes = new Set();
    const window = {
        localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
        matchMedia: () => ({ matches: coarse }),
        location: { search },
    };
    const document = {
        documentElement: { classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) } },
        querySelector: () => null,
    };
    vm.runInNewContext(readFileSync(resolve(__dirname, '../../rubin/night.js'), 'utf8'), { window, document, Date, Math, JSON, String, Number, Boolean, isFinite });
    return { night: window.skyNight, classes, store };
}

const MADISON = { lat: 43.07, lon: -89.40 };
const highest = (night, day) => {
    let best = -90;
    for (let m = 0; m < 24 * 60; m += 2) best = Math.max(best, night.sunAltitude(new Date(Date.parse(`${day}T00:00:00Z`) + m * 60000), MADISON.lat, MADISON.lon));
    return best;
};

describe('night mode: when it is dark', () => {
    const { night } = load();

    it("puts the Sun's noon height where the latitude and season do", () => {
        // 90 - latitude + the Sun's declination: +23.44 at the June solstice, about -20.6 on 24 November.
        expect(highest(night, '2026-06-21')).toBeCloseTo(90 - 43.07 + 23.44, 0);
        expect(highest(night, '2026-11-24')).toBeCloseTo(90 - 43.07 - 20.6, 0);
    });

    it('has Madison light at 3:30 pm and past dusk by 5:30 pm in late November', () => {
        expect(night.sunAltitude(new Date('2026-11-24T21:30:00Z'), MADISON.lat, MADISON.lon)).toBeGreaterThan(0);
        expect(night.sunAltitude(new Date('2026-11-24T23:30:00Z'), MADISON.lat, MADISON.lon)).toBeLessThan(night.DUSK);
    });

    it('guesses the place from the time zone until aim and shoot has saved one', () => {
        expect(night.guessPlace(360, null)).toEqual({ lat: 40, lon: -90, guessed: true }); // US Central, standard time
        expect(night.guessPlace(360, '43.1,-89.4')).toEqual({ lat: 43.1, lon: -89.4, guessed: false });
        expect(night.guessPlace(-60, 'junk')).toEqual({ lat: 40, lon: 15, guessed: true });
    });

    it('turns on by itself on a phone after dusk, never by itself on a computer, and a choice wins for its 12 hours', () => {
        const dark = new Date('2026-11-25T03:00:00Z'), light = new Date('2026-11-24T18:00:00Z');
        expect(night.decide(dark, null, true, MADISON)).toBe(true);
        expect(night.decide(light, null, true, MADISON)).toBe(false);
        expect(night.decide(dark, null, false, MADISON)).toBe(false);
        expect(night.decide(dark, { on: false, until: dark.getTime() + 1 }, true, MADISON)).toBe(false);
        expect(night.decide(light, { on: true, until: light.getTime() + 1 }, false, MADISON)).toBe(true);
        expect(night.decide(dark, { on: false, until: dark.getTime() - 1 }, true, MADISON)).toBe(true); // expired
    });

    it('remembers a choice and the place (to 0.1 degree) on the phone, and applies the class', () => {
        const { night: n, classes, store } = load({ coarse: false });
        n.choose(true);
        expect(classes.has('night')).toBe(true);
        expect(JSON.parse(store['skyphoto-night']).on).toBe(true);
        n.rememberPlace(43.0731, -89.4012);
        expect(store['skyphoto-place']).toBe('43.1,-89.4');
        n.choose(false);
        expect(classes.has('night')).toBe(false);
    });

    it('marks the phone layout for a touch screen, or as the address asks', () => {
        expect(load({ coarse: true }).classes.has('phone')).toBe(true);
        expect(load({ coarse: false }).classes.has('phone')).toBe(false);
        expect(load({ coarse: false, search: '?layout=phone' }).classes.has('phone')).toBe(true);
        expect(load({ coarse: true, search: '?x=1&layout=wide' }).classes.has('phone')).toBe(false);
    });
});
