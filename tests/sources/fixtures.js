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

/* Rubin's forum News category (https://www.rubin.community/c/news/7.json), recorded
   2026-10-02 and trimmed to the first 8 topics and the fields used. */
export const RUBIN_NEWS = "{\"topic_list\":{\"topics\":[{\"id\":15,\"slug\":\"about-the-news-category\",\"title\":\"About the News category\",\"created_at\":\"2015-08-06T05:30:29.487Z\",\"pinned\":true},{\"id\":12796,\"slug\":\"rtn-011-v9-1-rubin-early-science-program\",\"title\":\"RTN-011 v9.1: Rubin Early Science Program\",\"created_at\":\"2026-10-01T14:38:07.297Z\",\"pinned\":false},{\"id\":12773,\"slug\":\"summit-technical-progress-week-ending-2026-09-25\",\"title\":\"Summit technical progress (week ending 2026-09-25)\",\"created_at\":\"2026-09-25T20:48:56.315Z\",\"pinned\":false},{\"id\":12763,\"slug\":\"welcome-to-rubin-community\",\"title\":\"Welcome to rubin.community!\",\"created_at\":\"2026-09-24T23:14:50.246Z\",\"pinned\":false},{\"id\":12761,\"slug\":\"proposal-public-release-of-rubin-data-in-the-euclid-deep-field-south-edf-s\",\"title\":\"Proposal: Public release of Rubin data in the Euclid Deep Field South (EDF-S)\",\"created_at\":\"2026-09-24T20:55:57.003Z\",\"pinned\":false},{\"id\":12718,\"slug\":\"summit-technical-progress-week-ending-2026-09-18\",\"title\":\"Summit technical progress (week ending 2026-09-18)\",\"created_at\":\"2026-09-18T22:48:53.655Z\",\"pinned\":false},{\"id\":12695,\"slug\":\"community-forum-migration-coming-september-24th-2026\",\"title\":\"Community forum migration coming @ September 24th 2026\",\"created_at\":\"2026-09-15T22:17:20.743Z\",\"pinned\":false},{\"id\":12676,\"slug\":\"summit-technical-progress-week-ending-2026-09-11\",\"title\":\"Summit technical progress (week ending 2026-09-11)\",\"created_at\":\"2026-09-11T20:23:49.262Z\",\"pinned\":false}]}}";

/* The MPC's answer for 2026 ED138, which Rubin discovered: recorded 2026-11-11 (OBS80 and
   ADES_DF), trimmed to the discovery line, two other 80-column lines, all 30 of Rubin's
   observations and two from other observatories, with only the fields used. Rubin's
   alerts never carried it (no template images there yet), so no broker has it. */
export const MPC_ED138 = "[{\"OBS80\":\"     K26ED8D*2C2026 03 04.39808718 19 09.751-42 27 15.71         19.31yWEU085X05\\n     K26ED8D 0 1937 12 30.03599510 09 20.105+07 33 17.21               W     074\\n     K26ED8D : 1954 04 03.25685211 17 54.982-10 48 12.41         18.14RW     261\",\"ADES_DF\":[{\"stn\":\"261\",\"obstime\":\"1954-04-03T06:09:52.000Z\",\"band\":\"R\",\"mag\":\"18.14\",\"rmsmag\":\"0.13\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"261\",\"obstime\":\"1954-04-03T06:41:04.000Z\",\"band\":\"B\",\"mag\":\"19.35\",\"rmsmag\":\"0.25\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-03-04T09:33:14.740Z\",\"band\":\"Ly\",\"mag\":\"19.319\",\"rmsmag\":\"0.0218\",\"deprecated\":null,\"disc\":\"*\",\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-03-04T09:35:07.430Z\",\"band\":\"Ly\",\"mag\":\"19.286\",\"rmsmag\":\"0.0221\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-03-31T08:28:06.437Z\",\"band\":\"Lz\",\"mag\":\"19.414\",\"rmsmag\":\"0.0142\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-03-31T09:00:12.636Z\",\"band\":\"Lz\",\"mag\":\"19.411\",\"rmsmag\":\"0.0134\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-04-16T07:56:43.520Z\",\"band\":\"Lu\",\"mag\":\"21.941\",\"rmsmag\":\"0.0565\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-05-01T06:13:30.864Z\",\"band\":\"Lz\",\"mag\":\"19.328\",\"rmsmag\":\"0.0127\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-05-02T06:03:12.753Z\",\"band\":\"Lz\",\"mag\":\"19.350\",\"rmsmag\":\"0.0146\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-05-12T10:00:13.800Z\",\"band\":\"Li\",\"mag\":\"19.450\",\"rmsmag\":\"0.0119\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-05-13T08:44:09.855Z\",\"band\":\"Lz\",\"mag\":\"19.285\",\"rmsmag\":\"0.0121\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-05-13T08:44:49.694Z\",\"band\":\"Lz\",\"mag\":\"19.281\",\"rmsmag\":\"0.0120\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-05-17T09:15:23.458Z\",\"band\":\"Lu\",\"mag\":\"21.920\",\"rmsmag\":\"0.0571\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-05-18T09:19:25.007Z\",\"band\":\"Lu\",\"mag\":\"21.774\",\"rmsmag\":\"0.0360\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-05-22T08:59:35.799Z\",\"band\":\"Lg\",\"mag\":\"20.265\",\"rmsmag\":\"0.0120\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-05-22T09:00:22.411Z\",\"band\":\"Lg\",\"mag\":\"20.230\",\"rmsmag\":\"0.0123\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-05-23T07:29:07.215Z\",\"band\":\"Lr\",\"mag\":\"19.580\",\"rmsmag\":\"0.0123\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-05-23T08:10:34.593Z\",\"band\":\"Li\",\"mag\":\"19.368\",\"rmsmag\":\"0.0145\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-05-25T08:11:42.945Z\",\"band\":\"Li\",\"mag\":\"19.432\",\"rmsmag\":\"0.0123\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-05-25T08:16:21.493Z\",\"band\":\"Lr\",\"mag\":\"19.677\",\"rmsmag\":\"0.0125\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-05-27T05:48:28.054Z\",\"band\":\"Lz\",\"mag\":\"19.248\",\"rmsmag\":\"0.0135\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-05-27T05:49:20.707Z\",\"band\":\"Lz\",\"mag\":\"19.259\",\"rmsmag\":\"0.0139\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-05-30T04:31:31.162Z\",\"band\":\"Ly\",\"mag\":\"19.059\",\"rmsmag\":\"0.0330\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-05-31T05:09:15.433Z\",\"band\":\"Lz\",\"mag\":\"19.266\",\"rmsmag\":\"0.0186\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-06-05T04:09:17.783Z\",\"band\":\"Ly\",\"mag\":\"19.236\",\"rmsmag\":\"0.0254\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-06-05T04:09:59.858Z\",\"band\":\"Ly\",\"mag\":\"19.234\",\"rmsmag\":\"0.0200\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-06-12T07:03:52.137Z\",\"band\":\"Li\",\"mag\":\"19.373\",\"rmsmag\":\"0.0115\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-06-27T05:23:48.332Z\",\"band\":\"Li\",\"mag\":\"19.310\",\"rmsmag\":\"0.0114\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-07-09T04:04:54.331Z\",\"band\":\"Li\",\"mag\":\"19.396\",\"rmsmag\":\"0.0113\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-07-09T04:49:07.024Z\",\"band\":\"Lr\",\"mag\":\"19.635\",\"rmsmag\":\"0.0124\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-07-11T06:43:24.161Z\",\"band\":\"Lr\",\"mag\":\"19.680\",\"rmsmag\":\"0.0120\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"},{\"stn\":\"X05\",\"obstime\":\"2026-07-11T07:21:14.542Z\",\"band\":\"Lg\",\"mag\":\"20.358\",\"rmsmag\":\"0.0178\",\"deprecated\":null,\"disc\":null,\"provid\":\"2026 ED138\"}]}]";

/* 2026 ED138 in JPL's list, recorded 2026-11-09. Its discovery paper gives H_V = 3.19 +- 0.04
   (arXiv:2610.38693); the MPC's announcement, MPEC 2026-U85, gives 2.93. */
export const ED138 = {"designation":"2026 ED138","fullName":"(2026 ED138)","provisional":"2026 ED138","H":2.8533,"elements":{"a":42.94869526572302,"e":0.1417448328770402,"i":24.47104038674766,"om":322.5008984905298,"w":167.9532328404424,"ma":128.3342024098231,"epoch":2461200.5},"quality":{"arcDays":32335,"conditionCode":2,"nObs":115}};
export const ED138_PAPER_HV = 3.19;
