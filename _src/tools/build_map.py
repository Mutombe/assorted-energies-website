"""Builds assets/js/map-data.js from Natural Earth (world-atlas countries-50m topojson).

Produces two maps, each with country outlines, a hexagonal dot matrix clipped to
land, and named city nodes:
  africa - the continent, Zimbabwe highlighted, regional network
  zim    - Zimbabwe close-up, service coverage
Usage: python -P build_map.py <countries-50m.json> <out.js>
"""
import sys, json
import numpy as np

AFRICA = {12, 24, 72, 108, 120, 132, 140, 148, 174, 178, 180, 204, 226, 231, 232, 262, 266, 270, 288,
          324, 384, 404, 426, 430, 434, 450, 454, 466, 478, 504, 508, 516, 562, 566, 624, 646, 686, 694,
          706, 710, 716, 728, 729, 732, 748, 768, 788, 800, 818, 834, 854, 894}

topo = json.load(open(sys.argv[1]))
sx, sy = topo['transform']['scale']
tx, ty = topo['transform']['translate']

arcs = []
for arc in topo['arcs']:
    x = y = 0; pts = []
    for dx, dy in arc:
        x += dx; y += dy
        pts.append((x * sx + tx, y * sy + ty))
    arcs.append(pts)

def ring(idx):
    out = []
    for i in idx:
        a = arcs[i] if i >= 0 else arcs[~i][::-1]
        out.extend(a if not out else a[1:])
    return out

def polygons(g):
    if g['type'] == 'Polygon': return [[ring(r) for r in g['arcs']]]
    if g['type'] == 'MultiPolygon': return [[ring(r) for r in p] for p in g['arcs']]
    return []

countries = []
for g in topo['objects']['countries']['geometries']:
    cid = int(g['id']) if g.get('id', '').isdigit() else None
    name = g['properties']['name']
    if cid in AFRICA or name in ('Somaliland',):
        countries.append((cid, name, polygons(g)))

def inside(px, py, poly):
    """Even-odd ray casting for many points against one ring."""
    r = np.array(poly); x1, y1 = r[:, 0], r[:, 1]; x2, y2 = np.roll(x1, -1), np.roll(y1, -1)
    res = np.zeros(len(px), bool)
    for a, b, c, d in zip(x1, y1, x2, y2):
        cond = ((b > py) != (d > py)) & (px < (c - a) * (py - b) / (d - b + 1e-12) + a)
        res ^= cond
    return res

def build(sel, bbox, width, spacing, cities, highlight=None):
    lon0, lat0, lon1, lat1 = bbox
    k = width / (lon1 - lon0)
    height = (lat1 - lat0) * k
    P = lambda lon, lat: ((lon - lon0) * k, (lat1 - lat) * k)

    outs = []
    for cid, name, polys in sel:
        d = []
        for poly in polys:
            for r in poly:
                if len(r) < 4: continue
                pts = [P(*p) for p in r]
                # drop near-duplicate points for compactness
                keep = [pts[0]]
                for q in pts[1:]:
                    if abs(q[0] - keep[-1][0]) + abs(q[1] - keep[-1][1]) > 0.9: keep.append(q)
                if len(keep) < 3: continue
                d.append('M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in keep) + 'Z')
        if d: outs.append({'id': cid, 'name': name, 'd': ''.join(d)})

    # hex dot grid in degrees, assigned to the country containing it
    dots = []
    row = 0
    lat = lat1
    while lat > lat0:
        off = spacing / 2 if row % 2 else 0
        lons = np.arange(lon0 + off, lon1, spacing)
        lats = np.full(len(lons), lat)
        owner = np.full(len(lons), -1)
        for ci, (cid, name, polys) in enumerate(sel):
            for poly in polys:
                m = inside(lons, lats, poly[0])
                for hole in poly[1:]: m &= ~inside(lons, lats, hole)
                owner[m & (owner < 0)] = ci
        for lo, la, o in zip(lons, lats, owner):
            if o >= 0:
                x, y = P(lo, la)
                dots.append([round(x, 1), round(y, 1), 1 if sel[o][0] == highlight else 0])
        lat -= spacing * 0.866; row += 1

    cs = [{'name': n, 'x': round(P(lo, la)[0], 1), 'y': round(P(lo, la)[1], 1), 'tier': t} for n, lo, la, t in cities]
    return {'w': round(width), 'h': round(height), 'countries': outs, 'dots': dots, 'cities': cs, 'highlight': highlight}

AFRICA_CITIES = [  # name, lon, lat, tier (0 = HQ, 1 = regional, 2 = continental)
    ('Harare', 31.05, -17.83, 0), ('Lusaka', 28.28, -15.42, 1), ('Maputo', 32.57, -25.97, 1),
    ('Johannesburg', 28.05, -26.20, 1), ('Gaborone', 25.91, -24.65, 1), ('Lilongwe', 33.79, -13.96, 1),
    ('Windhoek', 17.08, -22.56, 1), ('Dar es Salaam', 39.21, -6.79, 1), ('Luanda', 13.23, -8.84, 2),
    ('Kinshasa', 15.27, -4.44, 2), ('Nairobi', 36.82, -1.29, 2), ('Addis Ababa', 38.75, 9.03, 2),
    ('Lagos', 3.38, 6.52, 2), ('Accra', -0.19, 5.60, 2), ('Dakar', -17.45, 14.69, 2), ('Cairo', 31.24, 30.04, 2),
    ('Casablanca', -7.59, 33.57, 2), ('Antananarivo', 47.52, -18.88, 2), ('Kigali', 30.06, -1.94, 2),
]
ZIM_CITIES = [
    ('Harare', 31.05, -17.83, 0), ('Bulawayo', 28.58, -20.15, 1), ('Mutare', 32.67, -18.97, 1),
    ('Gweru', 29.82, -19.45, 1), ('Masvingo', 30.83, -20.07, 1), ('Kwekwe', 29.81, -18.93, 2),
    ('Chinhoyi', 30.20, -17.36, 2), ('Victoria Falls', 25.83, -17.93, 2), ('Kariba', 28.80, -16.52, 2),
    ('Hwange', 26.50, -18.36, 2), ('Bindura', 31.33, -17.30, 2), ('Marondera', 31.55, -18.19, 2),
    ('Chiredzi', 31.67, -21.05, 2), ('Beitbridge', 30.00, -22.22, 2), ('Kadoma', 29.92, -18.33, 2),
]

africa = build(countries, (-19, -36, 53, 38.5), 900, 1.15, AFRICA_CITIES, highlight=716)
zim_sel = [c for c in countries if c[0] in (716, 894, 508, 710, 72)]
zim_only = [c for c in countries if c[0] == 716]
zim = build(zim_only, (25.0, -22.6, 33.3, -15.4), 900, 0.155, ZIM_CITIES, highlight=716)
# context outlines for neighbours
nb = build(zim_sel, (25.0, -22.6, 33.3, -15.4), 900, 99, [], highlight=716)
zim['neighbours'] = [c for c in nb['countries'] if c['id'] != 716]

with open(sys.argv[2], 'w') as f:
    f.write('/* Generated by _src/tools/build_map.py from Natural Earth 1:50m. Do not edit. */\n')
    f.write('window.AEI_MAPS=' + json.dumps({'africa': africa, 'zim': zim}, separators=(',', ':')) + ';\n')
print('africa dots', len(africa['dots']), 'zim dots', len(zim['dots']))
