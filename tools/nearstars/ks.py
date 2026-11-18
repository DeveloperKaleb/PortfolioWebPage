"""2MASS Ks for each nearby star: its Gaia (or Hipparcos) position moved back to 2000.0,
then the brightest 2MASS source within 8 arcsec. Writes ks2.csv."""
import csv, math, urllib.request, urllib.parse, io, sys, os
here = os.path.dirname(os.path.abspath(__file__))
G = 'https://gea.esac.esa.int/tap-server/tap/sync'

def tap(q):
    data = urllib.parse.urlencode({'REQUEST': 'doQuery', 'LANG': 'ADQL', 'FORMAT': 'csv', 'QUERY': q}).encode()
    with urllib.request.urlopen(G, data, timeout=120) as r:
        return list(csv.DictReader(io.StringIO(r.read().decode())))

rows = []
for r in csv.DictReader(open(os.path.join(here, 'gaia.csv'))):
    if float(r['parallax']) > 206.265:
        rows.append(('gaia', r['source_id'], float(r['ra']), float(r['dec']), float(r['pmra']), float(r['pmdec']), 2016.0, float(r['parallax'])))
for r in csv.DictReader(open(os.path.join(here, 'hip.csv'))):
    if r['hip'] in ('32349', '37279', '110893', '30920'):
        rows.append(('hip', r['hip'], float(r['ra']), float(r['dec']), float(r['pm_ra']), float(r['pm_de']), 1991.25, float(r['plx'])))

out = []
for kind, ident, ra, dec, pmra, pmdec, epoch, plx in rows:
    dt = 2000.0 - epoch
    ra0 = ra + pmra * dt / 3.6e6 / math.cos(math.radians(dec))
    dec0 = dec + pmdec * dt / 3.6e6
    q = f"SELECT ra, dec, ks_m, ks_msigcom, ph_qual, j_m FROM gaiadr1.tmass_original_valid WHERE 1=CONTAINS(POINT('ICRS',ra,dec), CIRCLE('ICRS',{ra0},{dec0},{8/3600}))"
    found = tap(q)
    found = [f for f in found if f['ks_m']]
    best = min(found, key=lambda f: float(f['ks_m'])) if found else None
    sep = math.hypot((float(best['ra']) - ra0) * math.cos(math.radians(dec0)), float(best['dec']) - dec0) * 3600 if best else None
    out.append([kind, ident, plx, best and best['ks_m'], best and best['ks_msigcom'], best and best['ph_qual'], sep and round(sep, 2), len(found)])
    print(out[-1], flush=True)

with open(os.path.join(here, 'ks2.csv'), 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['kind', 'id', 'plx', 'ks', 'ks_err', 'qual', 'sep', 'n']); w.writerows(out)
