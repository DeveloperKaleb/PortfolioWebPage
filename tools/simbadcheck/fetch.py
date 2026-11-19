"""Fetches what check.py compares our stars against, once, gently, and saves it in raw/.

SIMBAD was down on 2026-11-19 (Strasbourg: "page unavailable"; its Harvard mirror: no
answer), so the comparisons are with the catalogues it draws on:
  - Gaia DR3, from ESA's Gaia archive: the tile sample (one upload, one query) and every
    neighbour placed from Gaia (one query by source_id);
  - Hipparcos (van Leeuwen 2007, I/311/hip2; and I/239/hip_main for spectral types), the
    Pleiades and Hyades (Gaia Collaboration, Babusiaux et al. 2018, J/A+A/616/A10), and
    the ATNF pulsar catalogue (B/psr), from VizieR's Harvard mirror.

  python tools/simbadcheck/fetch.py      (skips anything already saved)
"""
import os, re, time, urllib.parse, urllib.request, uuid

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
ROOT = os.path.dirname(os.path.dirname(HERE))
UA = {'User-Agent': 'portfolio-star-check (one-off, gentle)'}
GAIA = 'https://gea.esac.esa.int/tap-server/tap/sync'
VIZIER = 'https://vizier.cfa.harvard.edu/viz-bin/asu-tsv'


def saved(name):
    return os.path.exists(os.path.join(RAW, name))


def save(name, data):
    with open(os.path.join(RAW, name), 'wb') as f:
        f.write(data)
    print('saved', name, len(data), 'bytes')
    time.sleep(3)


def post(url, fields, files=None):
    if files:
        boundary = uuid.uuid4().hex
        body = b''
        for k, v in fields.items():
            body += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
        for k, (fname, data) in files.items():
            body += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"; filename="{fname}"\r\nContent-Type: application/x-votable+xml\r\n\r\n'.encode() + data + b'\r\n'
        body += f'--{boundary}--\r\n'.encode()
        headers = {**UA, 'Content-Type': f'multipart/form-data; boundary={boundary}'}
    else:
        body = urllib.parse.urlencode(fields).encode()
        headers = UA
    with urllib.request.urlopen(urllib.request.Request(url, body, headers), timeout=600) as r:
        return r.read()


def get(url, params):
    with urllib.request.urlopen(urllib.request.Request(url + '?' + urllib.parse.urlencode(params), headers=UA), timeout=120) as r:
        return r.read()


def votable(csv_path):
    """The tile sample as a VOTable, for the archive's upload."""
    lines = open(csv_path, encoding='utf-8').read().strip().split('\n')
    head = lines[0].split(',')
    types = {'tile': 'char', 'k': 'int'}
    star = ' arraysize="*"'
    fields = ''.join(
        f'<FIELD name="{h}" datatype="{types.get(h, "double")}"{star if types.get(h) == "char" else ""}/>' for h in head)
    rows = ''
    for line in lines[1:]:
        cells = line.split(',')
        rows += '<TR>' + ''.join(f'<TD>{c}</TD>' for c in cells) + '</TR>'
    return (f'<?xml version="1.0"?><VOTABLE version="1.3" xmlns="http://www.ivoa.net/xml/VOTable/v1.3">'
            f'<RESOURCE><TABLE name="s">{fields}<DATA><TABLEDATA>{rows}</TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>').encode()


# 1. The tile sample against Gaia DR3: every 1% star within the rounding of each.
if not saved('gaia-tile-matches.csv'):
    query = """SELECT s.tile, s.k, g.source_id, g.ra, g.dec, g.parallax, g.phot_g_mean_mag, g.bp_rp
FROM tap_upload.s AS s JOIN gaiadr3.gaia_source AS g
ON 1 = CONTAINS(POINT('ICRS', g.ra, g.dec), CIRCLE('ICRS', s.ra, s.dec, s.tol_deg))
WHERE g.parallax_over_error > 100 AND ABS(g.phot_g_mean_mag - s.g) < 0.2"""
    data = post(GAIA, {'REQUEST': 'doQuery', 'LANG': 'ADQL', 'FORMAT': 'csv', 'MAXREC': '50000', 'UPLOAD': 's,param:s', 'QUERY': query},
                {'s': ('s.xml', votable(os.path.join(RAW, 'tile-sample.csv')))})
    save('gaia-tile-matches.csv', data)

# 2. The neighbours placed from Gaia DR3, by source_id.
if not saved('gaia-neighbours.csv'):
    text = open(os.path.join(ROOT, 'js', 'nearstars.js'), encoding='utf-8').read() + open(os.path.join(ROOT, 'js', 'centauri.js'), encoding='utf-8').read()
    ids = sorted(set(re.findall(r'Gaia DR3 (\d{6,})', text)))
    query = f"SELECT source_id, ra, dec, pmra, pmdec, parallax, parallax_error FROM gaiadr3.gaia_source WHERE source_id IN ({', '.join(ids)})"
    save('gaia-neighbours.csv', post(GAIA, {'REQUEST': 'doQuery', 'LANG': 'ADQL', 'FORMAT': 'csv', 'QUERY': query}))

# 3. The notable stars in Hipparcos: places, drifts, parallaxes (new reduction) and types.
HIP = {'vega': 91262, 'arcturus': 69673, 'aldebaran': 21421, 'polaris': 11767, 'betelgeuse': 27989,
       'antares': 80763, 'rigel': 24436, 'deneb': 102098}
for name, hip in HIP.items():
    if not saved(f'hip2-{name}.tsv'):
        save(f'hip2-{name}.tsv', get(VIZIER, {'-source': 'I/311/hip2', 'HIP': hip, '-out': 'HIP,RArad,DErad,pmRA,pmDE,Plx,e_Plx'}))
    if not saved(f'hipmain-{name}.tsv'):
        save(f'hipmain-{name}.tsv', get(VIZIER, {'-source': 'I/239/hip_main', 'HIP': hip, '-out': 'HIP,Vmag,SpType'}))

# 4. The two clusters (Babusiaux et al. 2018, table A.1) and the Vela pulsar (ATNF).
for cluster in ('Hyades', 'Pleiades'):
    if not saved(f'members-{cluster}.tsv'):
        save(f'members-{cluster}.tsv', get(VIZIER, {'-source': 'J/A+A/616/A10/tablea1a', 'Cluster': cluster + '*', '-out': 'RAdeg,DEdeg,plx', '-out.max': '5000'}))
if not saved('vela-psr.tsv'):
    save('vela-psr.tsv', get(VIZIER, {'-source': 'B/psr/psr', 'PSRJ': 'J0835-4510', '-out.all': ''}))
print('done')
