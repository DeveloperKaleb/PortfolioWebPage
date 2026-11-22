# Fetches, once, what js/skystars.js is built from, saving it in raw/ (NOTES.md, "Sky photos").
# Two requests, a few seconds apart; run again only to refresh.
#
#   raw/hip-bright.tsv  VizieR I/239/hip_main (Hipparcos, ESA 1997), every star brighter
#                       than V 6.5: HIP, ICRS position at J1991.25, proper motion, V, B-V.
#                       Harvard's VizieR mirror, as Strasbourg is down (2026-11).
#   raw/hip-names.csv   SIMBAD (IDIA mirror): the proper ("NAME"), Bayer and Flamsteed ("* ")
#                       and variable-star ("V* ") identifiers of every HIP star.
import time, urllib.parse, urllib.request
from pathlib import Path

RAW = Path(__file__).parent / 'raw'
RAW.mkdir(exist_ok=True)
AGENT = {'User-Agent': 'portfolio-sky-photos'}

vizier = 'https://vizier.cfa.harvard.edu/viz-bin/asu-tsv?' + urllib.parse.urlencode({
    '-source': 'I/239/hip_main', '-out': 'HIP,RAICRS,DEICRS,pmRA,pmDE,Vmag,B-V',
    'Vmag': '<6.5', '-out.max': 'unlimited', '-oc.form': 'dec'})
(RAW / 'hip-bright.tsv').write_bytes(urllib.request.urlopen(urllib.request.Request(vizier, headers=AGENT), timeout=300).read())
print('hip-bright.tsv saved')
time.sleep(5)

# No brightness filter: a first try kept only stars with a V flux in SIMBAD, and lost some
# bright ones filed without one (Algieba, HIP 50583). build.mjs keeps only the HIP numbers
# in hip-bright.tsv.
query = """SELECT h.id AS hip, n.id AS name FROM ident AS h
JOIN ident AS n ON n.oidref = h.oidref
WHERE h.id LIKE 'HIP %'
AND (n.id LIKE 'NAME %' OR n.id LIKE '* %' OR n.id LIKE 'V* %')"""
data = urllib.parse.urlencode({'REQUEST': 'doQuery', 'LANG': 'ADQL', 'FORMAT': 'csv', 'MAXREC': '400000', 'QUERY': query}).encode()
req = urllib.request.Request('https://simbad.idia.ac.za/simbad/sim-tap/sync', data=data, headers=AGENT)
(RAW / 'hip-names.csv').write_bytes(urllib.request.urlopen(req, timeout=300).read())
print('hip-names.csv saved')
