"""Sirius and Procyon: centre of gravity on the sky from one measured component and the
orbit (Bond et al. 2017, 2015), with a check against the other measurement."""
import math
DEG = math.pi / 180

def offset(t, o):
    """B relative to A, north and east in arcsec (as binaryOffset in js/centauri.js)."""
    mean = 2 * math.pi * (((t - o['T']) / o['P']) % 1)
    E = mean
    for _ in range(50):
        E -= (E - o['e'] * math.sin(E) - mean) / (1 - o['e'] * math.cos(E))
    r = o['a'] * (1 - o['e'] * math.cos(E))
    nu = 2 * math.atan2(math.sqrt(1 + o['e']) * math.sin(E / 2), math.sqrt(1 - o['e']) * math.cos(E / 2))
    u = nu + o['w'] * DEG
    node, i = o['node'] * DEG, o['i'] * DEG
    north = r * (math.cos(u) * math.cos(node) - math.sin(u) * math.sin(node) * math.cos(i))
    east = r * (math.cos(u) * math.sin(node) + math.sin(u) * math.cos(node) * math.cos(i))
    return north, east

def centre_from(member, sign, t, ra, dec, pmra, pmdec, o):
    """sign +1: the measured star is B (centre = B - mA/M rel); -1: it is A (centre = A + mB/M rel)."""
    M = o['mA'] + o['mB']
    k = o['mA'] / M if sign > 0 else -o['mB'] / M
    n, e = offset(t, o)
    dt = 0.01
    n2, e2 = offset(t + dt, o)
    cra = ra - k * e / 3600 / math.cos(dec * DEG)
    cdec = dec - k * n / 3600
    cpmra = pmra - k * (e2 - e) / dt * 1000
    cpmdec = pmdec - k * (n2 - n) / dt * 1000
    return cra, cdec, cpmra, cpmdec

SIRIUS = dict(P=50.1284, a=7.4957, i=136.336, node=45.400, T=1994.5715, e=0.59142, w=149.161, mA=2.063, mB=1.018)
PROCYON = dict(P=40.840, a=4.3075, i=31.408, node=100.683, T=1968.076, e=0.39785, w=89.23, mA=1.478, mB=0.592)

# Sirius: from Gaia DR3's B (2016.0).
c = centre_from('B', +1, 2016.0, 101.28662552099249, -16.720932526023173, -461.570505530133, -914.5196209016666, SIRIUS)
print('Sirius centre 2016.0', c)
# Check: A at the Hipparcos epoch, from the centre moved back, against Hipparcos's A.
t = 1991.25
M = SIRIUS['mA'] + SIRIUS['mB']
ra_c = c[0] + c[2] * (t - 2016) / 3.6e6 / math.cos(c[1] * DEG)
dec_c = c[1] + c[3] * (t - 2016) / 3.6e6
n, e = offset(t, SIRIUS)
ra_a = ra_c - SIRIUS['mB'] / M * e / 3600 / math.cos(dec_c * DEG)
dec_a = dec_c - SIRIUS['mB'] / M * n / 3600
hip = (101.2885410520664, -16.713143062644765)
print('Sirius A predicted vs Hipparcos, arcsec:', (ra_a - hip[0]) * 3600 * math.cos(dec_a * DEG), (dec_a - hip[1]) * 3600)
n, e = offset(2016.0, SIRIUS)
print('Sirius 2016 separation', math.hypot(n, e), 'PA', (math.degrees(math.atan2(e, n)) + 360) % 360)

# Procyon: from Hipparcos's A (1991.25).
c2 = centre_from('A', -1, 1991.25, 114.82724201808722, 5.227507577481227, -714.59, -1036.8, PROCYON)
print('Procyon centre 1991.25', c2)
for t in (1991.25, 2016.0):
    n, e = offset(t, PROCYON)
    print('Procyon', t, 'separation', round(math.hypot(n, e), 3), 'PA', round((math.degrees(math.atan2(e, n)) + 360) % 360, 1))
