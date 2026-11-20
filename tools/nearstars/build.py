"""Writes js/nearstars.js: every other system within 1,000,000 AU, from the files in this
folder (Gaia DR3, Hipparcos, 2MASS via the Gaia archive; NASA Exoplanet Archive) and the
hand table below. Run once; the output is committed and shipped as static data."""
import csv, math, os, json
here = os.path.dirname(os.path.abspath(__file__))
out_path = os.path.join(here, '..', '..', 'js', 'nearstars.js')
DEG = math.pi / 180
LIMIT = 206.265  # mas: 1,000,000 AU

gaia = {r['source_id']: r for r in csv.DictReader(open(os.path.join(here, 'gaia.csv')))}
hip = {r['hip']: r for r in csv.DictReader(open(os.path.join(here, 'hip.csv')))}
ks = {r['id']: r for r in csv.DictReader(open(os.path.join(here, 'ks2.csv')))}

def g(sid, parallax=None):
    r = gaia[sid]
    return dict(ra=float(r['ra']), dec=float(r['dec']), epoch=2016.0, pmRa=float(r['pmra']), pmDec=float(r['pmdec']), parallax=parallax or float(r['parallax']), src=f'Gaia DR3 {sid}')
def h(hid, parallax=None):
    r = hip[hid]
    return dict(ra=float(r['ra']), dec=float(r['dec']), epoch=1991.25, pmRa=float(r['pm_ra']), pmDec=float(r['pm_de']), parallax=parallax or float(r['plx']), src=f'Hipparcos (van Leeuwen 2007) HIP {hid}')
def hms(h_, m, s): return (h_ + m / 60 + s / 3600) * 15
def dms(d, m, s): sign = -1 if d < 0 or str(d).startswith('-') else 1; return sign * (abs(d) + m / 60 + s / 3600)
def lit(ra, dec, pmra, pmdec, plx, src, epoch=2000.0):
    return dict(ra=ra, dec=dec, epoch=epoch, pmRa=pmra, pmDec=pmdec, parallax=plx, src=src)

# ---- sizes ----
def mann(kid, parallax):
    """Radius in Suns from absolute K (Mann et al. 2015, ApJ 804, 64, table 1), with a
    range: the relation's 2.89% scatter and the magnitude's error. Outside its range
    (M_K 4.6 to 9.8) it is held at the end, with a wider range."""
    r = ks[kid]
    K, err = float(r['ks']), float(r['ks_err'] or 0.05)
    M = K + 5 * math.log10(parallax / 1000) + 5
    inside = 4.6 <= M <= 9.8
    Mc = min(9.8, max(4.6, M))
    R = 1.9515 - 0.3520 * Mc + 0.01680 * Mc * Mc
    spread = math.hypot(0.0289 * R, abs(-0.3520 + 0.0336 * Mc) * err)
    if not inside: spread = max(spread, 0.15 * R)
    return {'suns': round(R, 3), 'plusMinus': round(spread, 3), 'how': 'brightness'}
def typical(suns, pm): return {'suns': suns, 'plusMinus': pm, 'how': 'typical'}
def measured(suns): return {'suns': suns}
def catalogue(suns, pm): return {'suns': suns, 'plusMinus': pm, 'how': 'catalogue'}
def tundr(rj, pm, how='models'): return {'jupiters': rj, 'plusMinus': pm, 'how': how}
WD = typical(0.011, 0.002)
TUNDR = tundr(1.0, 0.15, 'typical')

def mark(t):
    c = t[0]
    if c in 'AF': return 4.5
    if c in 'GK': return 4
    if c == 'D': return 2.5
    if c in 'LTY': return 3
    sub = float(''.join(ch for ch in t[1:4] if ch in '0123456789.') or 5)
    return 3.5 if sub < 3 else 3

def M(id, name, type, size, blurb=None, sky=None):
    m = {'id': id, 'name': name, 'type': type, 'markPx': mark(type), 'size': size}
    if blurb: m['blurb'] = blurb
    if sky: m['sky'] = sky
    return m
def P(star, name, a, status='confirmed'): return {'star': star, 'name': name, 'a': a, 'status': status}

# ---- Sirius and Procyon: centres of gravity from the orbits (orbits.py) ----
exec(open(os.path.join(here, 'orbits.py')).read().split('# Sirius: from')[0])
def centre_at(t0, ra, dec, k, o):
    n, e = offset(t0, o)
    return ra - k * e / 3600 / math.cos(dec * DEG), dec - k * n / 3600
MS = SIRIUS['mA'] + SIRIUS['mB']
b16 = centre_at(2016.0, 101.28662552099249, -16.720932526023173, SIRIUS['mA'] / MS, SIRIUS)
a91 = centre_at(1991.25, 101.2885410520664, -16.713143062644765, -SIRIUS['mB'] / MS, SIRIUS)
span = 2016.0 - 1991.25
sirius_sky = lit(b16[0], b16[1], (b16[0] - a91[0]) * math.cos(b16[1] * DEG) * 3.6e6 / span, (b16[1] - a91[1]) * 3.6e6 / span, 378.9,
                 'centre of gravity from Gaia DR3 B (2016.0) and Hipparcos A (1991.25) on the orbit; parallax Bond et al. 2017', 2016.0)
MP = PROCYON['mA'] + PROCYON['mB']
pc = centre_from('A', -1, 1991.25, 114.82724201808722, 5.227507577481227, -714.59, -1036.8, PROCYON)
procyon_sky = lit(pc[0], pc[1], pc[2], pc[3], 285.0, 'centre of gravity from Hipparcos A (1991.25) on the orbit; parallax Bond et al. 2015', 1991.25)
def orbit(o, plx, period=None):
    return {'period': o['P'], 'periastron': o['T'], 'e': o['e'], 'aAU': round(o['a'] / (plx / 1000), 4), 'i': o['i'], 'node': o['node'], 'peri': o['w'], 'massA': o['mA'], 'massB': o['mB']}

# Close pairs on published orbits (Wikipedia's infoboxes, read 2026-11-18, with the
# sources they cite; check_pairs.py tests the first two against Gaia). Omega for the orbit
# of B about A; Kruger 60's, published for A, is turned half round.
mjd = lambda m: 2000 + (m - 51544.5) / 365.25
GL65_ORBIT = dict(P=26.38, a=2.0584, i=128.0, node=325.9, T=mjd(41333), e=0.6172, w=103.2, mA=0.122, mB=0.116)  # GRAVITY Collaboration 2024
WOLF424_ORBIT = dict(P=15.811, a=0.910, i=102.8, node=143.2, T=2008.12, e=0.301, w=347.7, mA=0.1379, mB=0.1258)  # Ling et al. 2022; masses Chevalier et al. 2023
KRUGER60_ORBIT = dict(P=45.13, a=2.45, i=165.41, node=152.6, T=mjd(56944), e=0.4131, w=208.2 - 180, mA=0.271, mB=0.176)  # Mann et al. 2019; masses Hillenbrand & White 2004
ROSS614_ORBIT = dict(P=16.586, a=1.1012, i=52.918, node=210.385, T=2000 + (2445226.863 - 2451545.0) / 365.25, e=0.382, w=220.898, mA=0.2228, mB=94.837 * 0.000954588)  # Feng et al. 2022; a and A's mass Gatewood 2003

def gaia_centre(aid, bid, o, plx, src):
    """The centre of gravity of a pair Gaia measured both of, in 2016: between them by
    their masses, drifting at their masses' mean drift."""
    A, B = gaia[aid], gaia[bid]
    k = o['mB'] / (o['mA'] + o['mB'])
    mix = lambda f: float(A[f]) + k * (float(B[f]) - float(A[f]))
    return lit(mix('ra'), mix('dec'), mix('pmra'), mix('pmdec'), plx, src, 2016.0)

S = []  # the systems
def system(id, name, sky, members, **kw):
    s = {'id': id, 'name': name, 'sky': sky, 'members': members}
    s.update(kw)
    S.append(s)


system('wolf359', 'Wolf 359', g('3864972938605115520'), [M('wolf359', 'Wolf 359', 'M6 V', mann('3864972938605115520', 415.179), 'A small red dwarf that often flares')])
system('lalande21185', 'Lalande 21185', g('762815470562110464'), [M('lalande21185', 'Lalande 21185', 'M2 V', mann('762815470562110464', 392.753), "The brightest red dwarf in the northern sky, though too faint to see without a telescope")],
       planets=[P('lalande21185', 'Lalande 21185 b', 0.07879), P('lalande21185', 'Lalande 21185 c', 2.94)])
system('sirius', 'Sirius', sirius_sky, [
    M('siriusA', 'Sirius A', 'A1 V', measured(1.7144), 'The brightest star in our night sky'),
    M('siriusB', 'Sirius B', 'DA1.9', measured(0.008098), "The nearest white dwarf: about Earth's size with about the Sun's mass"),
], pairs=[{'key': 'sirius', 'name': 'Sirius A and B', 'a': 'siriusA', 'b': 'siriusB', 'orbit': orbit(SIRIUS, 378.9), 'markPx': 4.5}])
system('luyten7268', 'Luyten 726-8', gaia_centre('5140693571158739840', '5140693571158946048', GL65_ORBIT, 371.92, 'centre of gravity from Gaia DR3 A and B; parallax GRAVITY Collaboration 2024'), [
    M('blCeti', 'BL Ceti (Luyten 726-8 A)', 'M5.5 V', typical(0.15, 0.03)),
    M('uvCeti', 'UV Ceti (Luyten 726-8 B)', 'M6 V', typical(0.14, 0.03), 'The flare star all flare stars of its kind are named after'),
], pairs=[{'key': 'luyten7268', 'name': 'Luyten 726-8 A and B', 'a': 'blCeti', 'b': 'uvCeti', 'orbit': orbit(GL65_ORBIT, 371.92), 'markPx': 3}])
system('ross154', 'Ross 154', g('4075141768785646848'), [M('ross154', 'Ross 154', 'M3.5 Ve', mann('4075141768785646848', 336.027))])
system('ross248', 'Ross 248', g('1926461164913660160'), [M('ross248', 'Ross 248', 'M5.0 V', mann('1926461164913660160', 316.481), 'Coming toward us: in about 36,000 years it will be the nearest star to the Sun')])
system('epsEri', 'Epsilon Eridani', g('5164707970261890560'), [M('epsEri', 'Epsilon Eridani', 'K2 V', measured(0.735), 'A young orange dwarf, ringed by dust')],
       planets=[P('epsEri', 'Epsilon Eridani b', 3.53)])
system('lacaille9352', 'Lacaille 9352', g('6553614253923452800'), [M('lacaille9352', 'Lacaille 9352', 'M2 V', catalogue(0.468, 0.02))],
       planets=[P('lacaille9352', 'Lacaille 9352 e', 0.0417), P('lacaille9352', 'Lacaille 9352 b', 0.0683), P('lacaille9352', 'Lacaille 9352 c', 0.121), P('lacaille9352', 'Lacaille 9352 d', 0.212)])
system('ross128', 'Ross 128', g('3796072592206250624'), [M('ross128', 'Ross 128', 'M4 V', mann('3796072592206250624', 296.305), 'One of the quietest red dwarfs, seldom flaring')],
       planets=[P('ross128', 'Ross 128 b', 0.0496)])
system('ezAqr', 'EZ Aquarii', lit(hms(22, 38, 33.73), dms(-15, 17, 57.3), 2314, 2295, 293.6, 'Wikipedia: 2MASS position, Salim & Gould 2003 drift, Torres 2009 parallax'), [
    M('ezAqrA', 'EZ Aquarii A', 'M5 V', typical(0.15, 0.03)),
    M('ezAqrC', 'EZ Aquarii C', 'M V', typical(0.13, 0.03)),
    M('ezAqrB', 'EZ Aquarii B', 'M V', typical(0.14, 0.03)),
], groups=[{'key': 'ezAqr', 'name': 'EZ Aquarii A, B and C', 'members': ['ezAqrA', 'ezAqrC', 'ezAqrB'], 'seenNear': 2.5, 'apartText': 'A and C round each other in 3.8 days; B rounds both every 2.25 years, about 1.2 AU off'}])
system('61cyg', '61 Cygni', g('1872046609345556480'), [
    M('61cygA', '61 Cygni A', 'K5 V', measured(0.665), 'The first star whose distance was measured, by Bessel in 1838'),
    M('61cygB', '61 Cygni B', 'K7 V', measured(0.595), sky=g('1872046574983497216', 285.99494829578117)),
], centreName='61 Cygni A')
system('procyon', 'Procyon', procyon_sky, [
    M('procyonA', 'Procyon A', 'F5 IV-V', measured(2.043), 'Starting to swell into a giant: about twice the Sun across'),
    M('procyonB', 'Procyon B', 'DQZ', measured(0.01232), 'A white dwarf'),
], pairs=[{'key': 'procyon', 'name': 'Procyon A and B', 'a': 'procyonA', 'b': 'procyonB', 'orbit': orbit(PROCYON, 285.0), 'markPx': 4.5}])
s2398 = 283.8401180184389
system('struve2398', 'Struve 2398', g('2154880616774131840'), [
    M('struve2398A', 'Struve 2398 A', 'M3 V', mann('2154880616774131840', s2398)),
    M('struve2398B', 'Struve 2398 B', 'M3.5 V', mann('2154880616774131712', s2398), sky=g('2154880616774131712', s2398)),
], centreName='Struve 2398 A', planets=[P('struve2398A', 'Struve 2398 A b', 0.068), P('struve2398B', 'Struve 2398 B c', 0.139)])
g34 = 280.706821579123
system('groombridge34', 'Groombridge 34', g('385334230892516480'), [
    M('groombridge34A', 'Groombridge 34 A', 'M2 V', mann('385334230892516480', g34)),
    M('groombridge34B', 'Groombridge 34 B', 'M3.5 V', mann('385334196532776576', g34), sky=g('385334196532776576', g34)),
], centreName='Groombridge 34 A', planets=[P('groombridge34A', 'Groombridge 34 A b', 0.072, 'candidate'), P('groombridge34A', 'Groombridge 34 A c', 5.4)])
system('dxCnc', 'DX Cancri', g('703790044252850688'), [M('dxCnc', 'DX Cancri', 'M6.5 V', mann('703790044252850688', 279.25))])
eps = 274.8431415216296
system('epsInd', 'Epsilon Indi', g('6412595290592307840'), [
    M('epsIndA', 'Epsilon Indi A', 'K5 V', catalogue(0.713, 0.02)),
    M('epsIndBa', 'Epsilon Indi Ba', 'T1', TUNDR),
    M('epsIndBb', 'Epsilon Indi Bb', 'T6', TUNDR),
], centreName='Epsilon Indi A', planets=[P('epsIndA', 'Epsilon Indi A b', 15.76)],
   groups=[{'key': 'epsIndB', 'name': 'Epsilon Indi Ba and Bb', 'members': ['epsIndBa', 'epsIndBb'], 'sky': g('6412596012146801152', eps), 'seenNear': 3.5, 'apartText': 'about 2.4 AU apart, round each other every 11 years'}])
system('tauCet', 'Tau Ceti', g('2452378776434477184'), [M('tauCet', 'Tau Ceti', 'G8 V', measured(0.793), 'The nearest single star like the Sun')],
       planets=[P('tauCet', 'Tau Ceti g', 0.133, 'candidate'), P('tauCet', 'Tau Ceti h', 0.243, 'candidate'), P('tauCet', 'Tau Ceti f', 1.334, 'candidate')])
system('gj1061', 'GJ 1061', g('4848140361962951552'), [M('gj1061', 'GJ 1061', 'M5.5 V', mann('4848140361962951552', 272.162))],
       planets=[P('gj1061', 'GJ 1061 b', 0.021), P('gj1061', 'GJ 1061 c', 0.0342), P('gj1061', 'GJ 1061 d', 0.054)])
system('yzCet', 'YZ Ceti', g('2358524597030794112'), [M('yzCet', 'YZ Ceti', 'M4.0 Ve', mann('2358524597030794112', 269.057))],
       planets=[P('yzCet', 'YZ Ceti b', 0.01634), P('yzCet', 'YZ Ceti c', 0.02156), P('yzCet', 'YZ Ceti d', 0.02851)])
system('luytensStar', "Luyten's Star", g('3139847906307949696'), [M('luytensStar', "Luyten's Star", 'M3.5 V', mann('3139847906307949696', 264.127))],
       planets=[P('luytensStar', "Luyten's Star c", 0.03647), P('luytensStar', "Luyten's Star b", 0.0911)])
system('teegarden', "Teegarden's Star", g('35227046884571776'), [M('teegarden', "Teegarden's Star", 'M6 V', mann('35227046884571776', 260.988), 'So faint it was found only in 2003')],
       planets=[P('teegarden', "Teegarden's Star b", 0.0259), P('teegarden', "Teegarden's Star c", 0.0455), P('teegarden', "Teegarden's Star d", 0.0791)])
system('kapteyn', "Kapteyn's Star", g('4810594479418041856'), [M('kapteyn', "Kapteyn's Star", 'M1 VI', mann('4810594479418041856', 254.199), "An old star of the galaxy's halo, passing through")],
       planets=[P('kapteyn', 'Kapteyn c', 0.311, 'candidate')])
system('lacaille8760', 'Lacaille 8760', g('6583272171336048640'), [M('lacaille8760', 'Lacaille 8760', 'M1 V', mann('6583272171336048640', 251.912), 'The brightest red dwarf in our sky, just visible to the eye')])
system('scr1845', 'SCR 1845-6357', g('6439125097427143808'), [
    M('scr1845A', 'SCR 1845-6357 A', 'M8.5 V', mann('6439125097427143808', 249.665)),
    M('scr1845B', 'SCR 1845-6357 B', 'T6', TUNDR),
], groups=[{'key': 'scr1845', 'name': 'SCR 1845-6357 A and B', 'members': ['scr1845A', 'scr1845B'], 'seenNear': 7, 'apartText': 'about 4.5 AU apart on the sky'}])
# Hipparcos's one place for the pair stands for their centre of gravity: it may be off by
# up to an arcsecond (about 4 AU), which moves the pair together, not apart.
system('kruger60', 'Kruger 60', h('110893'), [
    M('kruger60A', 'Kruger 60 A', 'M3 V', typical(0.35, 0.05)),
    M('kruger60B', 'Kruger 60 B', 'M4 V', typical(0.25, 0.05)),
], pairs=[{'key': 'kruger60', 'name': 'Kruger 60 A and B', 'a': 'kruger60A', 'b': 'kruger60B', 'orbit': orbit(KRUGER60_ORBIT, 249.94), 'markPx': 3.5}])
system('denis1048', 'DENIS J1048-3956', g('5393446658454453632'), [M('denis1048', 'DENIS J1048-3956', 'M8.5 V', mann('5393446658454453632', 247.216), 'Found only in 2000: among the smallest stars known')])
system('ross614', 'Ross 614', h('30920'), [
    M('ross614A', 'Ross 614 A', 'M4.5 V', typical(0.2, 0.04)),
    M('ross614B', 'Ross 614 B', 'M5.5 V', typical(0.15, 0.03)),
], pairs=[{'key': 'ross614', 'name': 'Ross 614 A and B', 'a': 'ross614A', 'b': 'ross614B', 'orbit': orbit(ROSS614_ORBIT, 242.32), 'markPx': 3}])
system('wolf1061', 'Wolf 1061', g('4330690742322011520'), [M('wolf1061', 'Wolf 1061', 'M3 V', mann('4330690742322011520', 232.139))],
       planets=[P('wolf1061', 'Wolf 1061 b', 0.0375), P('wolf1061', 'Wolf 1061 c', 0.089), P('wolf1061', 'Wolf 1061 d', 0.47)])
system('vanMaanen', "van Maanen's Star", g('2552928187080872832'), [M('vanMaanen', "van Maanen's Star", 'DZ7.5', WD, 'The nearest lone white dwarf')])
system('gj1', 'Gliese 1', g('2306965202564744064'), [M('gj1', 'Gliese 1', 'M2 V', mann('2306965202564744064', 230.097))])
system('wolf424', 'Wolf 424', gaia_centre('3902874650601954816', '3902874650602495232', WOLF424_ORBIT, 227.041, 'centre of gravity from Gaia DR3 A and B; parallax Chevalier et al. 2023'), [
    M('wolf424A', 'Wolf 424 A', 'M5.5 V', typical(0.15, 0.03)),
    M('wolf424B', 'Wolf 424 B', 'M7 V', typical(0.12, 0.03)),
], pairs=[{'key': 'wolf424', 'name': 'Wolf 424 A and B', 'a': 'wolf424A', 'b': 'wolf424B', 'orbit': orbit(WOLF424_ORBIT, 227.041), 'markPx': 3}])
system('tzAri', 'TZ Arietis', g('76868614540049408'), [M('tzAri', 'TZ Arietis', 'M4.5 V', mann('76868614540049408', 223.732))],
       planets=[P('tzAri', 'TZ Arietis c', 0.88)])
system('gj687', 'Gliese 687', g('1637645127018395776'), [M('gj687', 'Gliese 687', 'M3 V', mann('1637645127018395776', 219.790))],
       planets=[P('gj687', 'Gliese 687 b', 0.163), P('gj687', 'Gliese 687 c', 1.165)])
system('lhs292', 'LHS 292', g('3757613049856225792'), [M('lhs292', 'LHS 292', 'M6.5 V', mann('3757613049856225792', 219.330))])
system('gj674', 'Gliese 674', g('5951824121022278144'), [M('gj674', 'Gliese 674', 'M3 V', mann('5951824121022278144', 219.646))],
       planets=[P('gj674', 'Gliese 674 b', 0.039)])
system('gj440', 'GJ 440', g('5332606522595645952'), [M('gj440', 'GJ 440', 'DQ6', WD, 'A white dwarf')])
system('gj1245', 'GJ 1245', g('2079073928612821760'), [
    M('gj1245A', 'GJ 1245 A', 'M5.5 V', typical(0.15, 0.03)),
    M('gj1245C', 'GJ 1245 C', 'M7 V', typical(0.11, 0.03)),
    M('gj1245B', 'GJ 1245 B', 'M6 V', typical(0.13, 0.03)),
], groups=[{'key': 'gj1245', 'name': 'GJ 1245 A, B and C', 'members': ['gj1245A', 'gj1245C', 'gj1245B'], 'seenNear': 50, 'apartText': 'A and C close together; B about 30 AU off'}])
system('gj876', 'Gliese 876', g('2603090003484152064'), [M('gj876', 'Gliese 876', 'M3.5 V', mann('2603090003484152064', 214.038), 'Four planets, two of them giants')],
       planets=[P('gj876', 'Gliese 876 d', 0.0208), P('gj876', 'Gliese 876 c', 0.1296), P('gj876', 'Gliese 876 b', 0.2083), P('gj876', 'Gliese 876 e', 0.3343)])
system('lhs288', 'LHS 288', g('5254061535106490112'), [M('lhs288', 'LHS 288', 'M5.5 V', mann('5254061535106490112', 206.970))])
system('gj1002', 'GJ 1002', g('2441630500517079808'), [M('gj1002', 'GJ 1002', 'M5.5 V', mann('2441630500517079808', 206.350))],
       planets=[P('gj1002', 'GJ 1002 b', 0.0457), P('gj1002', 'GJ 1002 c', 0.0738)])
# Tundrs too faint for Gaia: Wikipedia's infoboxes, read 2026-11-18, with their sources.
system('wise0855', 'WISE 0855-0714', lit(hms(8, 55, 10.83168), dms(-7, 14, 42.5256), -8123.7, 673.2, 439.0, 'SIMBAD position via Wikipedia; drift and parallax Kirkpatrick et al. 2021'),
       [M('wise0855', 'WISE 0855-0714', 'Y2', tundr(1.045, 0.072, 'light'), 'The coldest known object outside the Solar System: about 3 degrees C')])
system('ugps0722', 'UGPS 0722-0540', lit(hms(7, 22, 27.29), dms(-5, 40, 30.0), -904.14, 352.025, 242.8, 'Lucas et al. 2010 and Cushing et al. 2011 position; Leggett et al. 2012 drift and parallax'),
       [M('ugps0722', 'UGPS 0722-0540', 'T9', tundr(1.02, 0.10), 'A cold tundr, about 230 degrees C')])
system('wise1639', 'WISE 1639-6847', lit(hms(16, 39, 39.730), dms(-68, 47, 6.69), 576.94, -3108.48, 211.11, 'Fontanive et al. 2021'),
       [M('wise1639', 'WISE 1639-6847', 'Y0 pec', TUNDR)])
system('wise1741', 'WISE 1741+2553', lit(hms(17, 41, 24.22), dms(25, 53, 18.96), -512.2, -1478.8, 216.93, 'Kirkpatrick et al. 2011 position (2010.7); Vrba 2026 drift and parallax', 2010.7),
       [M('wise1741', 'WISE 1741+2553', 'T9', tundr(0.851, 0.05))])

assert all(s['sky']['parallax'] > LIMIT for s in S), [s['id'] for s in S if s['sky']['parallax'] <= LIMIT]
S.sort(key=lambda s: -s['sky']['parallax'])
ids = [m['id'] for s in S for m in s['members']] + [s['id'] for s in S]
dups = {i for i in ids if ids.count(i) > 1}
for s in S:
    for m in s['members']:
        if m['id'] == s['id']: dups.discard(m['id'])
assert not dups, dups

def js(v, indent=0):
    if isinstance(v, dict):
        if set(v) >= {'ra', 'dec', 'epoch'}:
            src = v['src']
            body = ', '.join(f"{k}: {json.dumps(round(v[k], 9) if isinstance(v[k], float) else v[k])}" for k in ('ra', 'dec', 'epoch', 'pmRa', 'pmDec', 'parallax'))
            return '{ ' + body + ' } /* ' + src + ' */'
        return '{ ' + ', '.join(f"{k}: {js(x)}" for k, x in v.items()) + ' }'
    if isinstance(v, list): return '[' + ', '.join(js(x) for x in v) + ']'
    if isinstance(v, float): return json.dumps(round(v, 9))
    return json.dumps(v, ensure_ascii=False)

lines = []
for s in S:
    lines.append('    {')
    for k, v in s.items():
        if k == 'members':
            lines.append('        members: [')
            for m in v: lines.append(f'            {js(m)},')
            lines.append('        ],')
        else:
            lines.append(f'        {k}: {js(v)},')
    lines.append('    },')

header = '''/* Every other star system within 1,000,000 AU of the Sun (parallax over 206.265 mas),
 * for the Solar System tab's map: stage 3 of taking it out to a million AU (owner,
 * 2026-11-18; NOTES.md). Written once by a script from the sources below, read 2026-11-18,
 * and shipped as it is: the page asks no one for it. Alpha Centauri, Barnard's Star and
 * Luhman 16 stay in js/centauri.js, where they began.
 *
 * Pure data, in NEIGHBOURS's form (js/centauri.js), nearest first. Sources:
 *   - Places, drifts and parallaxes: Gaia DR3 where it has the star; Hipparcos (van
 *     Leeuwen 2007) for the bright ones it lacks; and, for EZ Aquarii and four tundrs too
 *     faint for Gaia, the published values named beside each. Each place's source is noted
 *     beside it. A wide companion shares its primary's parallax; a close pair takes the
 *     parallax published with its orbit, as Gaia measures such pairs badly.
 *   - Sirius and Procyon: their orbits from Bond et al. 2017 (ApJ 840, 70) and 2015 (ApJ
 *     813, 106), with those papers' parallaxes and masses. Sirius's centre of gravity is
 *     tied to Gaia's B in 2016 and Hipparcos's A in 1991, which fixes its drift; Procyon's
 *     to Hipparcos's A alone. As for Luhman 16, which node is which is assumed: if wrong,
 *     a pair is mirrored front to back by a few AU.
 *   - Planets: NASA Exoplanet Archive (pscomppars), sizes of orbit only; those it flags as
 *     disputed are drawn as candidates.
 *   - Spectral types: SIMBAD's (Wenger et al. 2000; its IDIA mirror, data to 2026-10-14),
 *     checked 2026-11-20 against tools/nearstars/simbad-types-near.csv. Thirteen first given
 *     "as usually given" differed by about a subclass and now take SIMBAD's, with its
 *     reference: Sirius B DA1.9 (2011ApJ...743..138G), Ross 248 M5.0 V (2015A&A...577A.128A),
 *     Lacaille 9352 M2 V and Gliese 674 M3 V (2006A&A...460..695T), Groombridge 34 A M2 V and
 *     Lacaille 8760 M1 V (1989ApJS...71..245K), YZ Ceti M4.0 Ve (2015AJ....149..106D),
 *     Teegarden's Star M6 V (dM6, 2019AJ....157...63K), van Maanen's Star DZ7.5
 *     (1993PASP..105..761W), Gliese 1 M2 V (1982MSS...C03....0H), Gliese 876 M3.5 V
 *     (1983SAAOC...7..106W), WISE 0855-0714 Y2 (2015ApJ...799...37L). To do (owner): check
 *     these by hand against recent papers; SIMBAD shows one study, some from the 1980s.
 *     SIMBAD has no type of its own for Wolf 424 A and B, Ross 614 B or EZ Aquarii B and
 *     C, so theirs are unchecked.
 *   - Sizes: measured (interferometry, or for white dwarfs their light and gravity) where
 *     the source says so; for red dwarfs, worked out from their infrared brightness (2MASS
 *     K, Mann et al. 2015's relation; how: 'brightness'); otherwise the size usual for the
 *     type ('typical'), a catalogue's adopted value ('catalogue'), or from models or light
 *     for tundrs. Each unmeasured size carries its range.
 *   - Luyten 726-8, Wolf 424, Kruger 60 and Ross 614 are pairs on published orbits:
 *     GRAVITY Collaboration 2024, Ling et al. 2022, Mann et al. 2019 and Feng et al. 2022,
 *     as Wikipedia's infoboxes give them (read 2026-11-18). The first two agree with where
 *     Gaia saw both stars in 2016 to 0.02 arcseconds (tools/nearstars/check_pairs.py).
 *   - Close pairs and triples whose orbits are not in hand (groups) are one mark: EZ
 *     Aquarii (A is itself a 3.8-day pair), Epsilon Indi Ba and Bb (no periastron date
 *     published beside the orbit), SCR 1845-6357 and GJ 1245 (B's orbit about A and C is
 *     known only loosely).
 */

export const NEARSTARS = [
'''
open(out_path, 'w', encoding='utf-8', newline='\n').write(header + '\n'.join(lines) + '\n];\n')
print(len(S), 'systems;', sum(len(s['members']) for s in S), 'members;', sum(len(s.get('planets', [])) for s in S), 'planets')
for s in S: print(f"{s['sky']['parallax']:8.2f} {s['name']}")
