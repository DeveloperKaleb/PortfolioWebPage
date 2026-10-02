/* Recorded from JPL on 2026-10-02, so the tests never call JPL themselves.
 *
 * Elements: JPL Small-Body Database API, full precision
 *   https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=<number>&full-prec=1&phys-par=1
 * Observations: JPL Horizons API, observer table from Earth's centre (500@399),
 * quantities 9 (APmag), 19 (r), 20 (delta), 24 (S-T-O phase angle)
 *   https://ssd.jpl.nasa.gov/api/horizons.api
 *
 * Horizons integrates the planets' pull; js/orbit.js does not, so this measures how far
 * two-body motion drifts from the real thing. */
export const EPOCH = 2461200.5; // the elements' epoch, JD TDB

export const OBJECTS = {
    Eris: {
        H: -1.26,
        elements: { a: 67.93394687853566, e: 0.4382385347971672, i: 43.9258279471791, om: 36.00477044417249, w: 150.7949235840312, ma: 211.774434275007, epoch: EPOCH },
        horizons: {
            '2026-10-02': { r: 95.45781394557, delta: 94.5146577392615, V: 18.573, phase: 0.2071 },
            '2030-01-01': { r: 95.15746260129, delta: 94.9026526255005, V: 18.627, phase: 0.5709 },
        },
    },
    Sedna: {
        H: 1.50,
        elements: { a: 543.7195289104732, e: 0.8598824585187618, i: 11.92527582847476, om: 144.5061662673739, w: 311.0987725939751, ma: 358.5956944005428, epoch: EPOCH },
        horizons: {
            '2026-10-02': { r: 82.83698979669, delta: 82.2516483036391, V: 20.774, phase: 0.5678 },
            '2030-01-01': { r: 82.02773054182, delta: 81.2573849857572, V: 20.710, phase: 0.4239 },
        },
    },
    Gonggong: {
        H: 1.82,
        elements: { a: 66.86666567773766, e: 0.5042510000302973, i: 30.89906721170288, om: 336.8383156185827, w: 206.6232839773693, ma: 111.664541568459, epoch: EPOCH },
        horizons: {
            '2026-10-02': { r: 89.86230411599, delta: 89.0227713786935, V: 21.415, phase: 0.3442 },
            '2030-01-01': { r: 90.54289192638, delta: 91.0919295869317, V: 21.503, phase: 0.5176 },
        },
    },
};
