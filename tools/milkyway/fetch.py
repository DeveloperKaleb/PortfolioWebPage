"""Counts Gaia DR3's stars across the sky, for the Milky Way behind the Solar System map.

One job on the Gaia archive (ESA): a 2% random sample of the catalogue (random_index, the
archive's own way of taking one), stars brighter than G 18, counted in half-degree cells
of galactic longitude and latitude. It is asked for once and waited on gently, a look
every 30 seconds; the answer is kept beside this file (counts.csv.gz), so build.py and
the site never ask again. Run only to refresh it. (MAXREC: the archive stops at 50,000 rows
unless told otherwise, and the sky is 259,200 cells; the first run, 2026-11-18, stopped.)
"""
import gzip
import os
import time
import urllib.parse
import urllib.request

TAP = 'https://gea.esac.esa.int/tap-server/tap/async'
QUERY = """
SELECT li, bi, COUNT(*) AS n
FROM (SELECT FLOOR(l * 2) AS li, FLOOR((b + 90) * 2) AS bi
      FROM gaiadr3.gaia_source
      WHERE random_index < 36000000 AND phot_g_mean_mag < 18) AS cells
GROUP BY li, bi
"""
here = os.path.dirname(os.path.abspath(__file__))
HEADERS = {'User-Agent': 'portfolio-webpage milkyway/1 (one query, for a sky backdrop)'}


def ask(url, data=None):
    req = urllib.request.Request(url, data=urllib.parse.urlencode(data).encode() if data else None, headers=HEADERS)
    return urllib.request.urlopen(req, timeout=120)


start = ask(TAP, {'REQUEST': 'doQuery', 'LANG': 'ADQL', 'FORMAT': 'csv', 'PHASE': 'RUN', 'MAXREC': 400000, 'QUERY': QUERY})
job = start.geturl()
print('job', job, flush=True)
while True:
    phase = ask(job + '/phase').read().decode().strip()
    print(time.strftime('%H:%M:%S'), phase, flush=True)
    if phase == 'COMPLETED':
        break
    if phase in ('ERROR', 'ABORTED'):
        print(ask(job + '/error').read().decode()[:2000])
        raise SystemExit(1)
    time.sleep(30)
body = ask(job + '/results/result').read()
if body[:2] == b'\x1f\x8b':
    body = gzip.decompress(body)
with gzip.open(os.path.join(here, 'counts.csv.gz'), 'wb') as f:
    f.write(body)
print('rows', body.count(b'\n') - 1)
