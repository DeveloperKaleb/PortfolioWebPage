"""Compares our stars with the catalogues fetch.py saved in raw/, and prints a report.
Makes no request. Three parts:

  1. A random sample of the published tiles against Gaia DR3: each sampled star must have
     a Gaia star with a parallax error under 1% within the tile's rounding of it, in place,
     distance, G and BP-RP.
  2. Every neighbour placed from Gaia DR3 against Gaia DR3, by source_id: place, drift,
     parallax.
  3. The notable objects against Hipparcos, the clusters' members and the ATNF catalogue.

  python tools/simbadcheck/check.py
"""
import csv, json, math, os, re, statistics, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
ROOT = os.path.dirname(os.path.dirname(HERE))


def tsv(name):
    lines = [l for l in open(os.path.join(RAW, name), encoding='utf-8') if l.strip() and not l.startswith('#')]
    head = [h.strip() for h in lines[0].rstrip('\n').split('\t')]
    return [dict(zip(head, [c.strip() for c in l.rstrip('\n').split('\t')])) for l in lines[3:]]


def sep_arcsec(ra1, de1, ra2, de2):
    # Haversine: the cosine rule cannot tell angles under a few mas from none.
    r = math.radians
    h = math.sin(r(de2 - de1) / 2) ** 2 + math.cos(r(de1)) * math.cos(r(de2)) * math.sin(r(ra2 - ra1) / 2) ** 2
    return math.degrees(2 * math.asin(math.sqrt(min(1, h)))) * 3600


# ---- 1. The tile sample
sample = list(csv.DictReader(open(os.path.join(RAW, 'tile-sample.csv'))))
found = {}
for m in csv.DictReader(open(os.path.join(RAW, 'gaia-tile-matches.csv'))):
    found.setdefault((m['tile'], m['k']), []).append(m)
MAG_HALF, COLOUR_HALF = 1 / 16, 1 / 80
ok, bad, worst = 0, [], {'dist': 0, 'g': 0, 'colour': 0, 'sep': 0}
for s in sample:
    d, tol = float(s['dist_pc']), float(s['tol_pc'])
    best = None
    for m in found.get((s['tile'], s['k']), []):
        dg = 1000 / float(m['parallax'])
        off = {
            'dist': abs(dg - d) / tol,
            'g': abs(float(m['phot_g_mean_mag']) - float(s['g'])) / (MAG_HALF + 5 * math.log10(1 + tol / d) + 1e-4),
            'colour': 0 if (s['bp_rp'] == '' and m['bp_rp'] == '') else (abs(float(m['bp_rp'] or 99) - float(s['bp_rp'] or -99)) / (COLOUR_HALF + 1e-4)),
            'sep': sep_arcsec(float(m['ra']), float(m['dec']), float(s['ra']), float(s['dec'])) / (float(s['tol_deg']) * 3600),
        }
        score = max(off.values())
        if best is None or score < best[0]:
            best = (score, off, m)
    if best and best[0] <= 1.0001:
        ok += 1
        for k in worst: worst[k] = max(worst[k], best[1][k])
    else:
        bad.append((s, best))
n = len(sample)
print(f'1. Tiles: {ok} of {n} sampled stars match a Gaia DR3 star within the rounding.')
print('   Worst agreement as a share of what the rounding allows: ' + ', '.join(f'{k} {v:.2f}' for k, v in worst.items()))
if not bad:
    print(f'   No mismatch: at 95% confidence, under {300 / n:.1f}% of the tiles\' stars are wrong (rule of three).')
for s, best in bad[:10]:
    print('   MISMATCH', s['tile'], s['k'], s['ra'], s['dec'], s['dist_pc'], s['g'], s['bp_rp'], '| nearest:', best and {k: round(v, 2) for k, v in best[1].items()})

# ---- 2. The neighbours from Gaia
text = open(os.path.join(ROOT, 'js', 'nearstars.js'), encoding='utf-8').read()
ours = {}
for m in re.finditer(r'sky: \{ ra: ([-\d.]+), dec: ([-\d.]+), epoch: 2016\.0, pmRa: ([-\d.]+), pmDec: ([-\d.]+), parallax: ([-\d.]+) \} /\* Gaia DR3 (\d+) \*/', text):
    ours[m.group(6)] = [float(v) for v in m.groups()[:5]]
gaia = {r['source_id']: r for r in csv.DictReader(open(os.path.join(RAW, 'gaia-neighbours.csv')))}
diffs = []
for sid, (ra, dec, pmra, pmdec, plx) in ours.items():
    g = gaia.get(sid)
    if not g:
        diffs.append((sid, 'not in Gaia DR3')); continue
    d = {'place_mas': sep_arcsec(ra, dec, float(g['ra']), float(g['dec'])) * 1000,
         'pmra': abs(pmra - float(g['pmra'])), 'pmdec': abs(pmdec - float(g['pmdec'])), 'plx': abs(plx - float(g['parallax']))}
    if max(d.values()) > 0.01: diffs.append((sid, d))
print(f'\n2. Neighbours placed from Gaia DR3: {len(ours)} checked by source_id; {len(ours) - len(diffs)} agree to 0.01 mas and mas/yr.')
for sid, d in diffs: print('   DIFFERS', sid, d)
other = len(re.findall(r'sky: \{', text)) - len(ours)
print(f'   {other} more are placed from Hipparcos, orbits or papers (their comments name each); not re-checked here.')

# ---- 3. The notable objects
node = subprocess.run(['node', '-e', "import('./js/notables.js').then(({NOTABLE_LIST})=>console.log(JSON.stringify(NOTABLE_LIST)))"],
                      cwd=ROOT, capture_output=True, text=True)
notables = {n['id']: n for n in json.loads(node.stdout)}
print('\n3. Notable objects (ours | catalogue):')
for name in ['vega', 'arcturus', 'aldebaran', 'polaris', 'betelgeuse', 'antares', 'rigel', 'deneb']:
    h = tsv(f'hip2-{name}.tsv')[0]
    t = tsv(f'hipmain-{name}.tsv')[0]
    n = notables[name]
    # Hipparcos places are for 1991.25: moved to 2000 by the drift.
    dt = 2000 - 1991.25
    de = float(h['DErad']) + float(h['pmDE']) * dt / 3.6e6
    ra = float(h['RArad']) + float(h['pmRA']) * dt / 3.6e6 / math.cos(math.radians(de))
    plx, e = float(h['Plx']), float(h['e_Plx'])
    print(f"   {n['name']:<11} place off {sep_arcsec(ra, de, n['ra'], n['dec']):5.2f}\" | {n['pc']:7.2f} pc vs Hipparcos {1000 / plx:7.2f} pc "
          f"(+-{1000 / plx * e / plx:5.1f}) | type {n['type']:<9} vs {t['SpType']}")
for cluster, id in (('Hyades', 'hyades'), ('Pleiades', 'pleiades')):
    rows = tsv(f'members-{cluster}.tsv')
    plx = statistics.fmean(float(r['plx']) for r in rows)
    ra = math.degrees(math.atan2(statistics.fmean(math.sin(math.radians(float(r['RAdeg']))) for r in rows), statistics.fmean(math.cos(math.radians(float(r['RAdeg']))) for r in rows))) % 360
    de = statistics.fmean(float(r['DEdeg']) for r in rows)
    n = notables[id]
    print(f"   {cluster:<11} centre off {sep_arcsec(ra, de, n['ra'], n['dec']) / 3600:4.2f} deg from the members' mean | {n['pc']:6.1f} pc vs {1000 / plx:6.1f} pc ({len(rows)} members, mean parallax {plx:.3f} mas)")
p = tsv('vela-psr.tsv')[0]
h, m_, s_ = (float(v) for v in p['RAJ2000'].split()); ra = 15 * (h + m_ / 60 + s_ / 3600)
d_, m_, s_ = (float(v) for v in p['DEJ2000'].split()); de = -(abs(d_) + m_ / 60 + s_ / 3600) if p['DEJ2000'].startswith('-') else d_ + m_ / 60 + s_ / 3600
n = notables['velapulsar']
print(f"   Vela pulsar place off {sep_arcsec(ra, de, n['ra'], n['dec']):5.2f}\" | {n['pc']} pc vs ATNF parallax {p['Plx']} +- {p['e_Plx']} mas = {1000 / float(p['Plx']):.0f} pc")
n = notables['gaiabh1']
print(f"   Gaia BH1    {n['pc']:.1f} pc (El-Badry 2023) vs Gaia DR3 parallax 2.070 +- 0.117 mas = 483 pc")
