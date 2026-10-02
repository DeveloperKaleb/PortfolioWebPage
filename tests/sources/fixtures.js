/* Recorded 2026-10-02 from the live services, so the tests never call them.
 *
 * GONGGONG_DETECTIONS: Fink/LSST /api/v1/sso for packed designations
 * D6199,90377,M5088,D6472,D6108 (Eris, Sedna, Gonggong, Makemake, Haumea). Only Gonggong
 * had Rubin detections. Trimmed to the columns js/sources.js asks for.
 *
 * JPL_PAGE: SBDB Query API, sb-class=TNO, full-prec=1, limit=3, as returned. JPL_COUNT is
 * the count-only query's answer that day. */
export const GONGGONG_DETECTIONS = [
 {
  "r:designation": "2007 OR10",
  "r:band": "r",
  "r:midpointMjdTai": 61232.3331130094,
  "r:psfFlux": 10213.047,
  "r:psfFluxErr": 240.91484,
  "r:helioRange": 89.81432,
  "r:topoRange": 89.12259,
  "r:phaseAngle": 0.4771061,
  "r:psfFlux_flag": false,
  "r:pixelFlags_saturatedCenter": false,
  "r:reliability": 0.99959105,
  "r:timeWithdrawnMjdTai": null
 },
 {
  "r:designation": "2007 OR10",
  "r:band": "r",
  "r:midpointMjdTai": 61232.3316509242,
  "r:psfFlux": 10139.729,
  "r:psfFluxErr": 313.0414,
  "r:helioRange": 89.81432,
  "r:topoRange": 89.122604,
  "r:phaseAngle": 0.4771171,
  "r:psfFlux_flag": false,
  "r:pixelFlags_saturatedCenter": false,
  "r:reliability": 0.99821424,
  "r:timeWithdrawnMjdTai": null
 },
 {
  "r:designation": "2007 OR10",
  "r:band": "z",
  "r:midpointMjdTai": 61228.3863242727,
  "r:psfFlux": 20648.957,
  "r:psfFluxErr": 374.34113,
  "r:helioRange": 89.81207,
  "r:topoRange": 89.17085,
  "r:phaseAngle": 0.505121,
  "r:psfFlux_flag": false,
  "r:pixelFlags_saturatedCenter": false,
  "r:reliability": 1,
  "r:timeWithdrawnMjdTai": null
 },
 {
  "r:designation": "2007 OR10",
  "r:band": "i",
  "r:midpointMjdTai": 61221.3258668244,
  "r:psfFlux": 15884.717,
  "r:psfFluxErr": 312.28897,
  "r:helioRange": 89.80799,
  "r:topoRange": 89.26393,
  "r:phaseAngle": 0.5495427,
  "r:psfFlux_flag": false,
  "r:pixelFlags_saturatedCenter": false,
  "r:reliability": 0.9999999,
  "r:timeWithdrawnMjdTai": null
 },
 {
  "r:designation": "2007 OR10",
  "r:band": "z",
  "r:midpointMjdTai": 61221.2963406199,
  "r:psfFlux": 19808.865,
  "r:psfFluxErr": 363.89337,
  "r:helioRange": 89.80797,
  "r:topoRange": 89.26434,
  "r:phaseAngle": 0.54971635,
  "r:psfFlux_flag": false,
  "r:pixelFlags_saturatedCenter": false,
  "r:reliability": 1,
  "r:timeWithdrawnMjdTai": null
 },
 {
  "r:designation": "2007 OR10",
  "r:band": "i",
  "r:midpointMjdTai": 61217.3982924545,
  "r:psfFlux": 14999.805,
  "r:psfFluxErr": 219.27367,
  "r:helioRange": 89.80573,
  "r:topoRange": 89.31909,
  "r:phaseAngle": 0.57089734,
  "r:psfFlux_flag": false,
  "r:pixelFlags_saturatedCenter": false,
  "r:reliability": 0.9999995,
  "r:timeWithdrawnMjdTai": null
 },
 {
  "r:designation": "2007 OR10",
  "r:band": "z",
  "r:midpointMjdTai": 61217.3735661969,
  "r:psfFlux": 21471.838,
  "r:psfFluxErr": 358.0115,
  "r:helioRange": 89.80572,
  "r:topoRange": 89.31945,
  "r:phaseAngle": 0.5710274,
  "r:psfFlux_flag": false,
  "r:pixelFlags_saturatedCenter": false,
  "r:reliability": 1,
  "r:timeWithdrawnMjdTai": null
 }
];

export const JPL_PAGE = "{\"signature\":{\"source\":\"NASA/JPL SBDB (Small-Body DataBase) Query API\",\"version\":\"1.0\"},\"fields\":[\"pdes\",\"full_name\",\"H\",\"a\",\"e\",\"i\",\"om\",\"w\",\"ma\",\"epoch\"],\"data\":[[\"15760\",\" 15760 Albion (1992 QB1)\",\"7.18\",\"44.13128015101105\",\".07115576064918994\",\"2.187986421529304\",\"359.5024198402141\",\"6.378968694221481\",\"36.25803194638895\",\"2461200.5\"],[\"15788\",\" 15788 (1993 SB)\",\"7.96\",\"39.69309386030809\",\".3259380307335113\",\"1.936813975459916\",\"354.9257866080662\",\"79.38882497810187\",\"4.903821038813498\",\"2461200.5\"],[\"15789\",\" 15789 (1993 SC)\",\"7.09\",\"39.68327981437692\",\".1835286651099575\",\"5.159874843339515\",\"354.7265728778696\",\"318.200319852755\",\"79.34412839501447\",\"2461200.5\"]],\"count\":7293}";

export const JPL_COUNT = '{"signature":{"source":"NASA/JPL SBDB (Small-Body DataBase) Query API","version":"1.0"},"count":7293}';

/* Fink's rejection of a batch containing Quaoar, as returned. */
export const FINK_UNRESOLVED = "{'status': 'error', 'text': 'We have found 0 packed designation in the aliases for the object 50000 according to quaero.\n'}";

/* Published visual H for Gonggong (Johnston's compilation, js/tnoalbedos.js). */
export const GONGGONG_PUBLISHED_HV = 2.34;
