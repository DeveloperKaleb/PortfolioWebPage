"""Checks the close pairs' published orbits against Gaia DR3, which measured both stars of
Luyten 726-8 and of Wolf 424 in 2016: B's place relative to A from the orbit, against
Gaia's. Prints both; no request is made. (First run, 2026-11-18, every one came out
half a turn wrong: A and B had been taken the wrong way round in Gaia. Luyten 726-8 A,
BL Ceti, is the brighter, G 10.51; Wolf 424's two are near equal, so the orbit decides.)"""
import csv, math, os
here = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(here, 'orbits.py')).read().split('SIRIUS =')[0])
gaia = {r['source_id']: r for r in csv.DictReader(open(os.path.join(here, 'gaia.csv')))}
def rel(a, b):
    A, B = gaia[a], gaia[b]
    dec = float(A['dec'])
    return (float(B['dec']) - dec) * 3600, (float(B['ra']) - float(A['ra'])) * math.cos(dec * DEG) * 3600
mjd = lambda m: 2000 + (m - 51544.5) / 365.25
PAIRS = {
    'Luyten 726-8': (dict(P=26.38, a=2.0584, i=128.0, node=325.9, T=mjd(41333), e=0.6172, w=103.2, mA=0.122, mB=0.116), '5140693571158739840', '5140693571158946048'),
    'Wolf 424': (dict(P=15.811, a=0.910, i=102.8, node=143.2, T=2008.12, e=0.301, w=347.7, mA=0.1379, mB=0.1258), '3902874650601954816', '3902874650602495232'),
}
for name, (o, a, b) in PAIRS.items():
    n, e = offset(2016.0, o)
    gn, ge = rel(a, b)
    print(f"{name}: orbit B-A north {n:+.3f} east {e:+.3f}; Gaia {gn:+.3f} {ge:+.3f}; sep {math.hypot(n, e):.3f} vs {math.hypot(gn, ge):.3f}; PA {math.degrees(math.atan2(e, n)) % 360:.1f} vs {math.degrees(math.atan2(ge, gn)) % 360:.1f}")
