/* Recorded 2026-10-02 from the live services, so the tests never call them.
 *
 * GONGGONG_DETECTIONS: Fink/LSST /api/v1/sso for packed designations
 * D6199,90377,M5088,D6472,D6108 (Eris, Sedna, Gonggong, Makemake, Haumea). Only Gonggong
 * had Rubin detections. Trimmed to the columns js/sources.js asks for. The position and
 * velocity columns (helio_*) come from a second recording of the same seven detections
 * that day, matched by time and band.
 *
 * JPL_PAGE: SBDB Query API, sb-class=TNO, full-prec=1, limit=3, with the orbit-quality
 * fields (data_arc, condition_code, n_obs_used), as returned. JPL_COUNT is the count-only
 * query's answer that day. */
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
  "r:timeWithdrawnMjdTai": null,
  "r:helio_x": 81.76543,
  "r:helio_y": -33.60471,
  "r:helio_z": -15.866673,
  "r:helio_vx": 1.7581875,
  "r:helio_vy": 0.8192555,
  "r:helio_vz": 1.6510803
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
  "r:timeWithdrawnMjdTai": null,
  "r:helio_x": 81.76543,
  "r:helio_y": -33.604713,
  "r:helio_z": -15.866674,
  "r:helio_vx": 1.7581877,
  "r:helio_vy": 0.8192555,
  "r:helio_vz": 1.6510803
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
  "r:timeWithdrawnMjdTai": null,
  "r:helio_x": 81.76145,
  "r:helio_y": -33.606594,
  "r:helio_z": -15.870442,
  "r:helio_vx": 1.7583897,
  "r:helio_vy": 0.81920415,
  "r:helio_vz": 1.651061
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
  "r:timeWithdrawnMjdTai": null,
  "r:helio_x": 81.75428,
  "r:helio_y": -33.609936,
  "r:helio_z": -15.877175,
  "r:helio_vx": 1.7587419,
  "r:helio_vy": 0.81911767,
  "r:helio_vz": 1.6510277
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
  "r:timeWithdrawnMjdTai": null,
  "r:helio_x": 81.75425,
  "r:helio_y": -33.609947,
  "r:helio_z": -15.877203,
  "r:helio_vx": 1.7587435,
  "r:helio_vy": 0.8191174,
  "r:helio_vz": 1.6510278
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
  "r:timeWithdrawnMjdTai": null,
  "r:helio_x": 81.750305,
  "r:helio_y": -33.6118,
  "r:helio_z": -15.880924,
  "r:helio_vx": 1.7589397,
  "r:helio_vy": 0.81906784,
  "r:helio_vz": 1.6510069
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
  "r:timeWithdrawnMjdTai": null,
  "r:helio_x": 81.75028,
  "r:helio_y": -33.611813,
  "r:helio_z": -15.880948,
  "r:helio_vx": 1.7589412,
  "r:helio_vy": 0.81906766,
  "r:helio_vz": 1.651007
 }
];

export const JPL_PAGE = "{\"signature\":{\"version\":\"1.0\",\"source\":\"NASA/JPL SBDB (Small-Body DataBase) Query API\"},\"fields\":[\"pdes\",\"full_name\",\"H\",\"a\",\"e\",\"i\",\"om\",\"w\",\"ma\",\"epoch\",\"data_arc\",\"condition_code\",\"n_obs_used\"],\"data\":[[\"15760\",\" 15760 Albion (1992 QB1)\",\"7.18\",\"44.13128015101105\",\".07115576064918994\",\"2.187986421529304\",\"359.5024198402141\",\"6.378968694221481\",\"36.25803194638895\",\"2461200.5\",\"11075\",\"3\",96],[\"15788\",\" 15788 (1993 SB)\",\"7.96\",\"39.69309386030809\",\".3259380307335113\",\"1.936813975459916\",\"354.9257866080662\",\"79.38882497810187\",\"4.903821038813498\",\"2461200.5\",\"11458\",\"2\",129],[\"15789\",\" 15789 (1993 SC)\",\"7.09\",\"39.68327981437692\",\".1835286651099575\",\"5.159874843339515\",\"354.7265728778696\",\"318.200319852755\",\"79.34412839501447\",\"2461200.5\",\"9614\",\"2\",146]],\"count\":7296}";

export const JPL_COUNT = '{"signature":{"source":"NASA/JPL SBDB (Small-Body DataBase) Query API","version":"1.0"},"count":7293}';

/* Fink's rejection of a batch containing Quaoar, as returned. */
export const FINK_UNRESOLVED = "{'status': 'error', 'text': 'We have found 0 packed designation in the aliases for the object 50000 according to quaero.\n'}";

/* Fink's other wording, from the first live run, which the first parser could not read
   and which cost that run all its Fink data. */
export const FINK_INVALID = "{'status': 'error', 'text': 'K11Uf3H is not a valid name or number according to quaero.\n'}";

/* Published visual H for Gonggong (Johnston's compilation, js/tnoalbedos.js). */
export const GONGGONG_PUBLISHED_HV = 2.34;

/* MPC get-obs for 2007 OR10 (Gonggong), output_format OBS80, recorded 2026-10-02 and
   trimmed to the asterisked discovery line and the next two. The full record had 557
   observations: discovered at Palomar (675) on 2007-07-17. */
export const MPC_GONGGONG = "[{\"OBS80\":\"M5088K07O10R*_C2007 07 17.39416 22 16 18.15 -15 02 01.3          21.4 Rc~033v675\\nM5088K07O10R 4 1985 08 19.19084 21 52 39.47 -21 37 43.0                o~08Uf262\\nM5088K07O10R 4 1991 10 01.47296 21 57 30.24 -19 52 51.6                o~08Uf260\"}]";

/* MPC obscodes for X05, recorded 2026-10-02, trimmed to the fields used. */
export const MPC_X05 = "{\"obscode\":\"X05\",\"name\":\"Simonyi Survey Telescope, Rubin Observatory\",\"short_name\":\"Simonyi Survey Telescope, Rubin Observatory\",\"longitude\":\"289.25058\",\"observations_type\":\"optical\"}";

/* Fink's Rubin list (ssoft, columns designation,sso_number,n_days), recorded 2026-10-02
   for Gonggong alone; the real list is about 750 KB. */
export const RUBIN_LIST = "designation,sso_number,n_days\n2007 OR10,225088,14.959546812810004\n";

/* Fink statistics (f:night, f:alerts) for 2026, recorded 2026-10-02 and trimmed to the
   last 12 nights with alerts. The last is 14 July: the winter storm that closed Cerro
   Pachon, then planned maintenance from 14 September. */
export const NIGHTLY_ALERTS = "[{\"f:alerts\":\"19172\",\"f:night\":\"20260628\"},{\"f:alerts\":\"62794\",\"f:night\":\"20260629\"},{\"f:alerts\":\"254984\",\"f:night\":\"20260630\"},{\"f:alerts\":\"36224\",\"f:night\":\"20260701\"},{\"f:alerts\":\"543950\",\"f:night\":\"20260706\"},{\"f:alerts\":\"623292\",\"f:night\":\"20260707\"},{\"f:alerts\":\"664612\",\"f:night\":\"20260709\"},{\"f:alerts\":\"227916\",\"f:night\":\"20260710\"},{\"f:alerts\":\"125442\",\"f:night\":\"20260711\"},{\"f:alerts\":\"71683\",\"f:night\":\"20260712\"},{\"f:alerts\":\"744559\",\"f:night\":\"20260713\"},{\"f:alerts\":\"473344\",\"f:night\":\"20260714\"}]";
