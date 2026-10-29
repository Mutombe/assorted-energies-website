"""Ray-marched studio renders of the brand's 3D objects.

Each object is a signed distance function. Rays are marched for every pixel at
2x resolution with numpy, shaded with a fake photo studio (environment
reflections, key/rim/fill lights, Fresnel, AO), tone-mapped, downsampled with
premultiplied alpha and saved as transparent WebP.

Usage: python -P render3d.py <out dir> [name ...]
"""
import sys, os
import numpy as np
from PIL import Image

SIZE = 560          # final canvas before crop
SS = 2              # supersampling factor

# ---------------------------------------------------------------- palette
ORANGE_F0 = np.array([1.00, 0.56, 0.20])     # brand orange as polished metal
NAVY = np.array([0.0, 0.028, 0.17])          # #002A74 in linear-ish space
SILVER_F0 = np.array([0.86, 0.88, 0.92])
WARM = np.array([1.05, 0.96, 0.86])

def norm(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-9)

def rot(x, y, z):
    x, y, z = np.radians([x, y, z])
    Rx = np.array([[1, 0, 0], [0, np.cos(x), -np.sin(x)], [0, np.sin(x), np.cos(x)]])
    Ry = np.array([[np.cos(y), 0, np.sin(y)], [0, 1, 0], [-np.sin(y), 0, np.cos(y)]])
    Rz = np.array([[np.cos(z), -np.sin(z), 0], [np.sin(z), np.cos(z), 0], [0, 0, 1]])
    return Rz @ Ry @ Rx

# ---------------------------------------------------------------- SDF primitives
def sd_round_box(p, b, r):
    q = np.abs(p) - (np.array(b) - r)
    return np.linalg.norm(np.maximum(q, 0), axis=-1) + np.minimum(q.max(-1), 0) - r

def sd_round_cyl(p, ra, h, rr):
    d = np.stack([np.hypot(p[..., 0], p[..., 2]) - ra + rr, np.abs(p[..., 1]) - h + rr], -1)
    return np.minimum(d.max(-1), 0) + np.linalg.norm(np.maximum(d, 0), axis=-1) - rr

def sd_torus(p, R, r):
    return np.hypot(np.hypot(p[..., 0], p[..., 2]) - R, p[..., 1]) - r

def sd_sphere(p, r):
    return np.linalg.norm(p, axis=-1) - r

def sd_mobius(p, R, w, t, rr):
    a = np.arctan2(p[..., 2], p[..., 0])
    qx = np.hypot(p[..., 0], p[..., 2]) - R
    qy = p[..., 1]
    c, s = np.cos(a / 2), np.sin(a / 2)          # half twist per lap
    u, v = c * qx + s * qy, -s * qx + c * qy
    d = np.stack([np.abs(u) - w + rr, np.abs(v) - t + rr], -1)
    return (np.minimum(d.max(-1), 0) + np.linalg.norm(np.maximum(d, 0), axis=-1) - rr) * 0.55

# ---------------------------------------------------------------- objects
# Each returns (distance, material id). Materials:
# 0 orange metal, 1 navy lacquer, 2 pearl, 3 silver metal, 4 panel glass, 5 orange lacquer, 6 white ceramic
def obj_panel(p):
    return sd_round_box(p, (1.05, 0.055, 0.70), 0.03), None

def mat_panel(p, n):
    m = np.full(p.shape[:-1], 3)
    top = n[..., 1] > 0.6
    inner = (np.abs(p[..., 0]) < 0.98) & (np.abs(p[..., 2]) < 0.63)
    m[top & inner] = 4
    return m

def obj_battery(p):
    body = sd_round_cyl(p, 0.62, 0.95, 0.12)
    term = sd_round_cyl(p - np.array([0, 1.0, 0]), 0.22, 0.12, 0.05)
    return np.minimum(body, term), None

def mat_battery(p, n):
    y = p[..., 1]
    m = np.full(p.shape[:-1], 1)
    m[y > 0.58] = 0
    m[(y > 0.40) & (y <= 0.58)] = 6
    m[y > 0.92] = 0
    return m

def obj_sun(p):
    sphere = sd_sphere(p, 0.78)
    pr = p @ rot(-18, 0, 14).T
    ring = sd_torus(pr, 1.22, 0.07)
    return np.minimum(sphere, ring), None

def mat_sun(p, n):
    return np.where(np.linalg.norm(p, axis=-1) < 0.86, 5, 1)

def obj_globe(p):
    return sd_sphere(p, 1.0), None

def mat_globe(p, n):
    q = norm(p)
    lat = np.degrees(np.arcsin(np.clip(q[..., 1], -1, 1)))
    lon = np.degrees(np.arctan2(q[..., 2], q[..., 0]))
    on_lat = np.abs(((lat + 90) % 25.7) - 12.85) > 11.9
    on_lon = (np.abs(((lon + 180) % 30) - 15) > 14.1) & (np.abs(lat) < 72)
    return np.where(on_lat | on_lon, 0, 2)

def obj_ribbon(p):
    return sd_mobius(p, 1.0, 0.36, 0.045, 0.03), None

def mat_ribbon(p, n):
    a = np.arctan2(p[..., 2], p[..., 0])
    qx = np.hypot(p[..., 0], p[..., 2]) - 1.0
    c, s = np.cos(a / 2), np.sin(a / 2)
    v = -s * qx + c * p[..., 1]
    return np.where(v > 0, 0, 1)

def obj_ring(p):
    q = np.stack([np.hypot(p[..., 0], p[..., 2]) - 1.0, p[..., 1]], -1)
    d = np.abs(q) - np.array([0.20 - 0.08, 0.30 - 0.08])
    return np.linalg.norm(np.maximum(d, 0), axis=-1) + np.minimum(d.max(-1), 0) - 0.08, None

def mat_ring(p, n):
    r = np.hypot(p[..., 0], p[..., 2])
    return np.where(r < 0.86, 1, 0)

OBJECTS = {
    # name: (sdf, material fn, pose (x,y,z), scale)
    'panel':   (obj_panel, mat_panel, (58, -28, -12), 1.12),
    'battery': (obj_battery, mat_battery, (16, 0, -14), 0.92),
    'sun':     (obj_sun, mat_sun, (8, -20, 0), 1.02),
    'globe':   (obj_globe, mat_globe, (18, -28, -14), 0.95),
    'ribbon':  (obj_ribbon, mat_ribbon, (64, 18, -30), 1.05),
    'ring':    (obj_ring, mat_ring, (52, 20, -24), 1.05),
}

# ---------------------------------------------------------------- studio
LIGHTS = [  # direction, sharpness, strength, colour
    (norm(np.array([-0.55, 0.75, 0.65])), 22, 4.2, np.array([1, 0.98, 0.95])),
    (norm(np.array([0.85, 0.25, -0.45])), 10, 1.6, np.array([0.75, 0.88, 1.0])),
    (norm(np.array([0, 1, 0.1])), 6, 0.6, np.array([1, 1, 1])),
    (norm(np.array([0.6, -0.4, 0.7])), 9, 0.5, np.array([1.0, 0.8, 0.55])),
]
KEY = LIGHTS[0][0]

def env(d):
    y = d[..., 1:2]
    sky, hor, floor = np.array([0.95, 0.97, 1.0]), np.array([0.30, 0.34, 0.42]), np.array([0.16, 0.10, 0.04])
    up = np.clip(y, 0, 1) ** 0.6
    c = np.where(y > 0, hor + (sky - hor) * up, hor + (floor - hor) * np.clip(-y * 3, 0, 1))
    c = c * (0.75 + 0.25 * np.clip(d[..., 2:3] * -1 + 0.5, 0, 1)) * (0.85 + 0.15 * np.clip(d[..., 0:1] + 0.5, 0, 1))
    c = c + 1.6 * np.exp(-((y - 0.18) / 0.06) ** 2)                         # horizontal softbox
    c = c + 1.1 * np.exp(-((d[..., 0:1] - 0.75) / 0.08) ** 2) * (y > -0.2)   # vertical strip
    for L, sharp, k, col in LIGHTS:
        c = c + k * np.clip((d * L).sum(-1, keepdims=True), 0, 1) ** sharp * col
    return c

def fresnel(f0, ndv):
    return f0 + (1 - f0) * (1 - ndv) ** 5

def render(name, out_dir):
    sdf, matfn, pose, scale = OBJECTS[name]
    R = rot(*pose)
    N = SIZE * SS

    def field(p):
        return sdf((p @ R) / scale)[0] * scale     # p @ R == R^T p : rotate point into object space

    ys, xs = np.mgrid[0:N, 0:N]
    u = (xs + 0.5) / N * 2 - 1
    v = 1 - (ys + 0.5) / N * 2
    ro = np.array([0, 0, 5.0])
    rd = norm(np.stack([u * 0.33 * 1.0, v * 0.33, -np.ones_like(u)], -1)).reshape(-1, 3)
    t = np.full(len(rd), 2.5)
    hit = np.zeros(len(rd), bool)
    alive = np.ones(len(rd), bool)
    step = 0.9 if name == 'ribbon' else 1.0
    for _ in range(260):
        idx = np.nonzero(alive)[0]
        if not len(idx): break
        p = ro + rd[idx] * t[idx, None]
        d = field(p)
        h = d < 0.0008
        hit[idx[h]] = True
        t[idx] += d * step
        dead = h | (t[idx] > 7.5)
        alive[idx[dead]] = False

    hi = np.nonzero(hit)[0]
    P = ro + rd[hi] * t[hi, None]
    e = 0.0015
    k = np.array([[1, -1, -1], [-1, -1, 1], [-1, 1, -1], [1, 1, 1]])
    Nn = norm(sum(kk * field(P + kk * e)[:, None] for kk in k))
    V = -rd[hi]
    ndv = np.clip((Nn * V).sum(-1), 0, 1)[:, None]
    ndl = np.clip((Nn * KEY).sum(-1), 0, 1)[:, None]
    H = norm(KEY + V)
    ndh = np.clip((Nn * H).sum(-1), 0, 1)[:, None]
    refl = env(norm(rd[hi] - 2 * (rd[hi] * Nn).sum(-1, keepdims=True) * Nn))

    ao = np.ones(len(hi))
    for i in range(1, 6):
        h_ = 0.06 * i
        ao -= (h_ - field(P + Nn * h_)) * 0.5 ** i * 2.4
    ao = np.clip(ao, 0.35, 1)[:, None]

    Pl = (P @ R) / scale
    Nl = Nn @ R
    mat = matfn(Pl, Nl)
    col = np.zeros((len(hi), 3))

    def metal(f0):
        F = fresnel(f0, ndv)
        return (refl * F * 0.95 + 0.12 * f0 * ndl + 2.2 * ndh ** 120 * np.array([1, .96, .88])) * WARM

    def lacquer(base, glow, coat=0.75, spec=1.4):
        F = fresnel(0.04, ndv)
        return base * (0.35 + 0.9 * ndl) + refl * F * coat + spec * ndh ** 90 + glow * (1 - ndv) ** 3 * 0.35

    m = mat[:, None]
    col = np.where(m == 0, metal(ORANGE_F0), col)
    col = np.where(m == 3, metal(SILVER_F0) * np.array([0.92, 0.96, 1.05]), col)
    col = np.where(m == 1, lacquer(NAVY, np.array([0, 0.15, 0.45])), col)
    col = np.where(m == 5, lacquer(np.array([0.95, 0.36, 0.06]), np.array([1.0, 0.55, 0.15]), 0.6, 1.6)
                   + np.array([0.25, 0.08, 0]) * (1 - ndv) ** 2, col)
    col = np.where(m == 6, lacquer(np.array([0.82, 0.85, 0.9]), np.array([0.3, 0.4, 0.6]), 0.5, 1.0), col)
    # pearl: navy-to-sky body with cyan rim
    up = (Nn[:, 1:2] + 1) / 2
    pearl = (np.array([0.0, 0.16, 0.48]) * (1 - up) + np.array([0.2, 0.62, 1.0]) * up) * (0.35 + 0.85 * ndl)
    pearl += np.array([0.3, 0.8, 1.0]) * (1 - ndv) ** 2.5 * 0.5 + refl * fresnel(0.04, ndv) * 0.9
    pearl += 2.0 * ndh ** 220 + 0.18 * ndh ** 10
    col = np.where(m == 2, pearl, col)
    # panel glass: navy cells with fine silver busbars, mirror-like coat
    gx = np.abs(((Pl[:, 0] + 0.98) % (1.96 / 6)) - 0.98 / 6) > 0.98 / 6 - 0.012
    gz = np.abs(((Pl[:, 2] + 0.63) % (1.26 / 4)) - 0.63 / 4) > 0.63 / 4 - 0.010
    bus = (np.abs(((Pl[:, 0] + 0.98) % (1.96 / 18)) - 0.98 / 18) > 0.98 / 18 - 0.003)
    glass = lacquer(np.array([0.0, 0.035, 0.16]), np.array([0.1, 0.3, 0.8]), 1.05, 1.8)
    glass = np.where((gx | gz)[:, None], metal(SILVER_F0) * 0.85, glass)
    glass = np.where((bus & ~(gx | gz))[:, None], glass * 0.7 + 0.12, glass)
    col = np.where(m == 4, glass, col)

    col = col * ao
    col = 1 - np.exp(-1.75 * col)

    img = np.zeros((N * N, 4))
    img[hi, :3] = col
    img[hi, 3] = 1
    img = img.reshape(N, N, 4)
    # premultiplied downsample
    pm = img.copy(); pm[..., :3] *= pm[..., 3:4]
    pm = pm.reshape(SIZE, SS, SIZE, SS, 4).mean((1, 3))
    a = pm[..., 3:4]
    rgb = np.where(a > 0, pm[..., :3] / np.maximum(a, 1e-6), 0)
    out = np.concatenate([rgb, a], -1)
    im = Image.fromarray((np.clip(out, 0, 1) ** (1 / 1.0) * 255).astype(np.uint8), 'RGBA')
    bb = im.getbbox()
    im = im.crop(bb)
    side = max(im.size) + 32
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    sq = sq.resize((440, 440), Image.LANCZOS)
    path = os.path.join(out_dir, f'obj-{name}.webp')
    sq.save(path, 'WEBP', quality=90, method=6)
    print(path, os.path.getsize(path) // 1024, 'KB')

if __name__ == '__main__':
    out_dir = sys.argv[1]
    for n in (sys.argv[2:] or OBJECTS):
        render(n, out_dir)
