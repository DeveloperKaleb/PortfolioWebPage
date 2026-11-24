import { describe, it, expect } from 'vitest';
import { toGray, fitSize, photoStats, findStars, judgeSky, readExif, lensTip, MIN_STARS, MAX_SIDE, logValue, logLine, shotLog, meanBrightness, LOG_MAX, REPORT_TO, REPORT_SUBJECT, REPORT_MAX_ENCODED, reportBody, reportContents, fitForEmail, reportLink } from '../../js/skyphoto.js';

// A repeatable made-up night: a seeded random, Gaussian noise, Gaussian stars.
function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
function sky({ width = 400, height = 300, level = 20, noise = 3, gradient = 0, stars = [], hot = [], seed = 1 }) {
    const r = rng(seed);
    const gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
    const gray = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) gray[y * width + x] = level + gradient * (y / height) + noise * gauss();
    }
    for (const { x, y, flux, fwhm = 2.5 } of stars) {
        const s = fwhm / 2.3548;
        for (let dy = -8; dy <= 8; dy++) {
            for (let dx = -8; dx <= 8; dx++) {
                const px = Math.round(x) + dx, py = Math.round(y) + dy;
                if (px < 0 || py < 0 || px >= width || py >= height) continue;
                gray[py * width + px] += flux / (2 * Math.PI * s * s) * Math.exp(-((px - x) ** 2 + (py - y) ** 2) / (2 * s * s));
            }
        }
    }
    for (const [x, y] of hot) gray[y * width + x] = 255;
    return { gray, width, height };
}
const field = (n, seed) => {
    const r = rng(seed);
    return Array.from({ length: n }, () => ({ x: 15 + r() * 370, y: 15 + r() * 270, flux: 300 + r() * 3000 }));
};

describe('sky photos', () => {
    it('shrink a photo to the searched size, keeping its shape', () => {
        expect(fitSize(4000, 3000)).toEqual({ width: MAX_SIDE, height: 1200 });
        expect(fitSize(3000, 4000)).toEqual({ width: 1200, height: MAX_SIDE });
        expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
    });

    it('read brightness from colour', () => {
        const gray = toGray(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]), 2, 1);
        expect(gray[0]).toBeCloseTo(255, 3);
        expect(gray[1]).toBe(0);
    });

    it('find every star to a fraction of a pixel, brightest first', () => {
        const stars = field(25, 7);
        const pic = sky({ stars, gradient: 30 });
        const found = findStars(pic.gray, pic.width, pic.height);
        expect(found.length).toBe(stars.length);
        for (const s of stars) {
            const near = found.find((f) => Math.hypot(f.x - s.x, f.y - s.y) < 0.4);
            expect(near, `star at ${s.x.toFixed(1)}, ${s.y.toFixed(1)}`).toBeTruthy();
        }
        for (let i = 1; i < found.length; i++) expect(found[i].flux).toBeLessThanOrEqual(found[i - 1].flux);
    });

    it('pass over hot pixels, smears and plain noise', () => {
        const pic = sky({ hot: [[50, 50], [200, 120], [333, 222]], stars: [{ x: 100, y: 100, flux: 160000, fwhm: 30 }], seed: 3 });
        expect(findStars(pic.gray, pic.width, pic.height)).toEqual([]);
    });

    // The owner's first real photos (2026-11-22): lit cloud on a sky the phone crushed to
    // near black, whole grey levels only, with three real stars showing through.
    it('pass over cloud texture on a near-black sky and keep the real stars', () => {
        const r = rng(11);
        const clouds = Array.from({ length: 60 }, () => ({ x: 20 + r() * 360, y: 20 + r() * 260, flux: 150 + r() * 900, fwhm: 8 + r() * 10 }));
        const stars = [{ x: 80.3, y: 60.6, flux: 160 }, { x: 300.2, y: 210.4, flux: 220 }, { x: 190.7, y: 140.1, flux: 120 }];
        const pic = sky({ level: 1, noise: 0.4, stars: [...clouds, ...stars], seed: 5 });
        for (let i = 0; i < pic.gray.length; i++) pic.gray[i] = Math.max(0, Math.round(pic.gray[i]));
        const found = findStars(pic.gray, pic.width, pic.height);
        expect(found.length).toBe(stars.length);
        for (const s of stars) expect(found.some((f) => Math.hypot(f.x - s.x, f.y - s.y) < 1)).toBe(true);
        expect(judgeSky(photoStats(pic.gray), found).reason).toBe('few');
    });

    it('suggest the 1x lens only for a photo from the ultra-wide one', () => {
        expect(lensTip(12)).toMatch(/0\.5×.*1×/);
        expect(lensTip(26)).toBe('');
        expect(lensTip(null)).toBe('');
    });

    it('tell a night sky from a day picture or an empty dark one', () => {
        const night = sky({ stars: field(20, 9) });
        const found = findStars(night.gray, night.width, night.height);
        expect(judgeSky(photoStats(night.gray), found)).toEqual({ ok: true });

        const day = sky({ level: 180, noise: 4, stars: field(20, 9) });
        expect(judgeSky(photoStats(day.gray), findStars(day.gray, day.width, day.height)).reason).toBe('bright');

        const cloud = sky({ stars: field(MIN_STARS - 3, 4) });
        const verdict = judgeSky(photoStats(cloud.gray), findStars(cloud.gray, cloud.width, cloud.height));
        expect(verdict.reason).toBe('few');
        expect(verdict.message).toMatch(/outside at night/);
    });
});

// A minimal JPEG with an EXIF block: SOI, APP1 "Exif", a big-endian TIFF with IFD0 pointing
// at an EXIF IFD holding FocalLengthIn35mmFilm, DateTimeOriginal and OffsetTimeOriginal.
function jpegWithExif({ mm = 26, when = '2026:11:21 22:15:30', zone = '-06:00' } = {}) {
    const t = [];
    const u16 = (v) => t.push((v >> 8) & 255, v & 255);
    const u32 = (v) => t.push((v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255);
    t.push(0x4d, 0x4d); u16(42); u32(8);                 // header, IFD0 at 8
    u16(1); u16(0x8769); u16(4); u32(1); u32(26); u32(0); // IFD0: ExifIFD at 26
    const strings = 26 + 2 + 3 * 12 + 4;                  // after the EXIF IFD
    u16(3);
    u16(0xa405); u16(3); u32(1); u16(mm); u16(0);
    u16(0x9003); u16(2); u32(20); u32(strings);
    u16(0x9011); u16(2); u32(7); u32(strings + 20);
    u32(0);
    t.push(...[...when].map((c) => c.charCodeAt(0)), 0);
    t.push(...[...zone].map((c) => c.charCodeAt(0)), 0);
    const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...t];
    return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, ((app1.length + 2) >> 8) & 255, (app1.length + 2) & 255, ...app1, 0xff, 0xd9]);
}

describe('photo EXIF', () => {
    it('reads the lens and when the photo was taken', () => {
        const { mm35, taken } = readExif(jpegWithExif());
        expect(mm35).toBe(26);
        expect(taken.toISOString()).toBe('2026-11-22T04:15:30.000Z');
    });
    it('says nothing for a file without it', () => {
        expect(readExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toEqual({ mm35: null, taken: null });
        expect(readExif(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toEqual({ mm35: null, taken: null });
    });
});

describe('the details of an attempt', () => {
    it('writes values short and plain', () => {
        expect(logValue(null)).toBe('none');
        expect(logValue(3)).toBe('3');
        expect(logValue(1 / 3)).toBe('0.3333');
        expect(logValue({ min: 1, max: 2500 })).toBe('1-2500');
        expect(logValue(['manual', 'continuous'])).toBe('[manual, continuous]');
        expect(logValue({ a: 1, b: 'x' })).toBe('{a 1, b x}');
        expect(logValue(true)).toBe('true');
    });

    it('stamps each line with the seconds since the attempt began, leaving out what is undefined', () => {
        expect(logLine(1.234, 'frame', { n: 2, shown: undefined, brightness: 12.345 })).toBe('   1.23 s  frame: n=2, brightness=12.35');
        expect(logLine(0, 'cancelled')).toBe('   0.00 s  cancelled');
    });

    it('keeps at most LOG_MAX lines and says how many it dropped', () => {
        let t = 1000;
        const log = shotLog(() => t);
        for (let i = 0; i < LOG_MAX + 5; i++) { t += 10; log.add('preview', { i }); }
        const lines = log.text().split('\n');
        expect(lines).toHaveLength(LOG_MAX + 1);
        expect(lines[0]).toBe('   0.01 s  preview: i=0');
        expect(lines.at(-1)).toBe('(5 more lines not kept)');
    });

    it('measures mean brightness from a sample of pixels', () => {
        const rgba = new Uint8ClampedArray(4 * 1000).fill(40);
        expect(meanBrightness(rgba)).toBeCloseTo(40, 6);
        expect(meanBrightness(rgba, 1)).toBeCloseTo(40, 6);
        expect(meanBrightness(new Uint8ClampedArray(0))).toBe(0);
    });
});

describe('help us calibrate: the emailed report', () => {
    const line = (t, what, fields) => logLine(t, what, fields);
    const aimLog = [
        line(0, 'aim and shoot', { page: '20261124-0900' }),
        line(0.1, 'camera can do', { exposureTime: { min: 1, max: 30000 } }),
        line(0.4, 'first deviceorientationabsolute', { alpha: 10, beta: 120, gamma: 2 }),
        line(1.2, 'location', { latitude: '43.1', longitude: '-89.4', accuracyM: 12 }),
        ...Array.from({ length: 300 }, (_, i) => line(2 + 2 * i, 'preview', { brightness: 20 + i / 10, exposureTime: 2500, iso: 3200, alpha: 10, beta: 120, gamma: 2, altitude: 30 })),
        ...Array.from({ length: 40 }, (_, i) => line(700 + i / 30, 'frame', { n: i + 1, gapMs: 33, brightness: 21 })),
        line(702, 'stars found (x,y,peak,size)', { spots: ['10.0,20.0,200,3'] }),
        line(703, 'matching', { solved: true, route: 'compass' }),
    ].join('\n');

    it('sends to the address and under the subject it always uses', () => {
        const link = reportLink('hello there');
        expect(link.startsWith(`mailto:${REPORT_TO}?subject=`)).toBe(true);
        expect(decodeURIComponent(link.split('subject=')[1].split('&')[0])).toBe(REPORT_SUBJECT);
        expect(decodeURIComponent(link.split('body=')[1])).toBe('hello there');
    });

    it('puts the reason and the visitor\'s words first', () => {
        const body = reportBody({ reason: 'problem', words: '  It turned white.  ', logText: 'x' });
        expect(body.startsWith('Why: I saw a problem\nWhat they saw: It turned white.\n\n--- Details ---\nx')).toBe(true);
        expect(reportBody({ reason: 'calibration', words: '', logText: 'x' })).not.toMatch(/What they saw/);
    });

    it('says in plain words what is in it, including the 0.1 degree location only when there is one', () => {
        const said = reportContents(aimLog).join('\n');
        expect(said).toMatch(/camera was asked for/);
        expect(said).toMatch(/compass and tilt/);
        expect(said).toMatch(/0\.1°/);
        expect(said).toMatch(/positions only, no picture/);
        expect(said).toMatch(/how sure/);
        expect(reportContents(line(0, 'photo chosen', {}) + '\n' + line(0, 'file', { type: 'image/jpeg' })).join('\n')).not.toMatch(/Your location/);
    });

    it('leaves a short report whole', () => {
        expect(fitForEmail('a\nb')).toEqual({ text: 'a\nb', cut: false });
    });

    it('thins the preview readings first to fit an email, keeping the first and last and saying so', () => {
        const { text, cut } = fitForEmail(aimLog);
        expect(cut).toBe(true);
        expect(encodeURIComponent(text).length).toBeLessThanOrEqual(REPORT_MAX_ENCODED);
        expect(text).toMatch(/\(\d+ preview lines left out to fit in an email\)/);
        expect(text).toMatch(/stars found/);
        expect(text).toMatch(/matching: solved=true/);
        expect(text).toMatch(/ location: latitude=43\.1/);
        expect((text.match(/ preview: /g) ?? []).length).toBe(4);
    });

    it('cuts short at the end only when thinning is not enough', () => {
        const { text, cut } = fitForEmail(aimLog, 600);
        expect(cut).toBe(true);
        expect(encodeURIComponent(text).length).toBeLessThanOrEqual(600);
        expect(text.endsWith('(cut short here: the rest did not fit in an email)')).toBe(true);
    });
});
