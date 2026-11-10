# Zwierzę: model Meshy (.glb) -> szkielet liczony w numpy -> klatki chodu / postoju / jedzenia w rzucie gry.
#   blender -b -P tools/blender/animal.py -- '<json>'
# json: { name, glb, out, h (wysokość w jednostkach gry), px (pikseli na jednostkę), kind: quad|biped|slider|hopper,
#         yaw (obrót modelu w stopniach, żeby pysk patrzył w +X; domyślnie 90), walkN, idleN, eatN, gait: walk|pace|trot,
#         stride, lift, neck, tail (false wyłącza), legTop, preview }
# Szkielet nie używa armatury Blendera: wagi i przekształcenia kości liczymy sami (LBS), a do siatki wpisujemy gotowe
# położenia wierzchołków. Dzięki temu nie zależymy od automatycznych wag, które na siatkach z AI często zawodzą.
import bpy, bmesh, json, math, os, sys
import numpy as np
from mathutils import Vector, Matrix

O = json.loads(sys.argv[sys.argv.index('--') + 1])
OUT = os.path.abspath(O['out']); os.makedirs(OUT, exist_ok=True); O['glb'] = os.path.abspath(O['glb'])
KIND = O.get('kind', 'quad')
sm = lambda e0, e1, v: (lambda t: t * t * (3 - 2 * t))(np.clip((np.asarray(v, dtype=float) - e0) / (e1 - e0 + 1e-9), 0, 1))

# ---------- wczytanie i normalizacja ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=O['glb'])
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
ob.parent = None
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = ob.data
bm = bmesh.new(); bm.from_mesh(me)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bm.to_mesh(me); bm.free()
for p in me.polygons: p.use_smooth = True

n = len(me.vertices)
co = np.empty(n * 3); me.vertices.foreach_get('co', co); co = co.reshape(n, 3)
yaw = math.radians(O.get('yaw', 90)); c, s = math.cos(yaw), math.sin(yaw)
co = co @ np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]])
mn, mx = co.min(0), co.max(0); H = mx[2] - mn[2]
co = (co - np.array([(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, mn[2]])) / H
X, Y, Z = co[:, 0], co[:, 1], co[:, 2]
LEN = X.max() - X.min()

# płaska podstawka doklejona przez generator: ściany leżące tuż przy ziemi usuwamy
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
flat = [f for f in bm.faces if all(Z[v.index] < 0.012 for v in f.verts) and f.calc_area() / (H * H) > 0.0015]
if flat: bmesh.ops.delete(bm, geom=flat, context='FACES_ONLY')
bm.to_mesh(me); bm.free()

# ---------- analiza sylwetki ----------
def find_leg_top():
    if 'legTop' in O: return O['legTop']
    NB = 24; x0 = X.min()
    for sl in np.arange(0.04, 0.9, 0.01):
        m = np.abs(Z - sl) < 0.01
        if not m.any(): continue
        b = np.clip(((X[m] - x0) / LEN * NB).astype(int), 0, NB - 1)
        occ = np.zeros(NB, bool); occ[b] = True
        on = np.nonzero(occ)[0]
        if occ[on[0]:on[-1] + 1].all() and on[-1] - on[0] > NB * 0.3: return float(sl)
    return 0.4
legTop = find_leg_top()
low = Z < min(0.06, legTop * 0.2)
fx0, fx1 = X[low].min(), X[low].max(); splitX = (fx0 + fx1) / 2
yFoot = float(np.abs(Y[low]).mean())
BIPED = KIND == 'biped'
LEGS = []            # (nazwa, przód?, strona ±1)
if KIND in ('quad', 'hopper'): LEGS = [('FL', 1, 1), ('FR', 1, -1), ('HL', 0, 1), ('HR', 0, -1)]
elif BIPED: LEGS = [('L', 1, 1), ('R', 1, -1)]
tailCut = O.get('tailY', 0.3) * yFoot      # ogon wisi na osi ciała, nogi są z boków

def quad_mask(front, side):
    m = (Y * side > 0)
    if not BIPED: m &= (X >= splitX) if front else (X < splitX)
    return m
def slice_mean(mask, z, dz=0.03):
    m = mask & (np.abs(Z - z) < dz)
    return (float(X[m].mean()), float(Y[m].mean())) if m.sum() > 3 else None

hipZ = legTop + O.get('hipUp', 0.05)
# nogi jako spójne kawałki siatki poniżej brzucha (pewniejsze niż podział po znaku Y; wiszący ogon nie dotyka ziemi)
ed = np.empty(len(me.edges) * 2, dtype=np.int64); me.edges.foreach_get('vertices', ed); ed = ed.reshape(-1, 2)
cutZ = legTop - O.get('legCut', 0.03)
par = np.arange(n)
def find(a):
    while par[a] != a: par[a] = par[par[a]]; a = par[a]
    return a
for a, b in ed[(Z[ed[:, 0]] < cutZ) & (Z[ed[:, 1]] < cutZ)]:
    ra, rb = find(a), find(b)
    if ra != rb: par[ra] = rb
rootOf = np.array([find(i) for i in range(n)]); rootOf[Z >= cutZ] = -1
comps = []
for r in np.unique(rootOf[rootOf >= 0]):
    m = rootOf == r
    if m.sum() > n * 0.004 and Z[m].min() < 0.05 and Z[m].max() > cutZ - 0.06: comps.append(m)
print('JOINTS', {k: [[round(float(c), 3) for c in p] for p in v] for k, v in J.items()}) if False else None
print('LEGCOMPS', len(comps), [(int(m.sum()), round(float(X[m].mean()), 2), round(float(Y[m].mean()), 2)) for m in comps])
J = {}               # stawy: nazwa -> (biodro, kolano, pęcina, kopyto)
legMask = {}
for name, front, side in LEGS:
    qm = quad_mask(front, side) & (Z < legTop + 0.05)
    mine = [m for m in comps if (BIPED or ((X[m].mean() >= splitX) == bool(front))) and Y[m].mean() * side > 0 and (Y[m] * side > 0).mean() > 0.8]
    if len(mine) == 1 and not O.get('legByY'):
        qm = mine[0] | (qm & (Z >= cutZ) & (np.abs(Y) > tailCut * 0.5))
    elif not front and not BIPED: qm &= ~((np.abs(Y) < tailCut) & (X < fx0 + (splitX - fx0) * 0.5) & (Z > 0.08))
    foot = slice_mean(qm, 0.02, 0.03) or (fx1 if front else fx0, side * yFoot)
    top = slice_mean(qm, legTop - 0.05, 0.03) or foot
    kz = hipZ * O.get('kneeAt', 0.52); az = hipZ * O.get('ankleAt', 0.13)
    knee = slice_mean(qm, kz) or ((foot[0] + top[0]) / 2, foot[1]); ank = slice_mean(qm, az) or foot
    J[name] = [np.array([top[0], top[1], hipZ]), np.array([knee[0], knee[1], kz]), np.array([ank[0], ank[1], az]), np.array([foot[0], foot[1], 0.0])]
    legMask[name] = qm
if LEGS:
    frontX = float(np.mean([J[k][0][0] for k, f, _ in LEGS if f])) if any(f for _, f, _ in LEGS) else fx1
    hindX = float(np.mean([J[k][0][0] for k, f, _ in LEGS if not f])) if any(not f for _, f, _ in LEGS) else frontX - 0.2
else:
    frontX, hindX = X.min() + LEN * 0.7, X.min() + LEN * 0.3
if BIPED: hindX = frontX - 0.05

# szyja i głowa: wszystko przed barkami i nad nasadą szyi
nb = np.array([frontX + O.get('neckX', 0.0), 0.0, legTop + O.get('neckUp', 0.16)])
if BIPED: nb = np.array([frontX, 0.0, O.get('neckZ', 0.62)])
if KIND == 'slider': nb = np.array([X.min() + LEN * O.get('neckAt', 0.68), 0.0, Z[(X > X.min() + LEN * 0.6)].mean() if (X > X.min() + LEN * 0.6).any() else 0.3])
reg = (X > nb[0] - 0.06) & (Z > nb[2] - 0.04) if not BIPED and KIND != 'slider' else ((Z > nb[2] - 0.04) if BIPED else (X > nb[0] - 0.05))
sc = (X - nb[0]) * O.get('tipX', 1.0) + (Z - nb[2]) * O.get('tipZ', 1.0)
tip_i = np.nonzero(reg)[0][np.argmax(sc[reg])]
far = reg & (np.linalg.norm(co - co[tip_i], axis=1) < 0.08)
tip = co[far].mean(0); tip[1] = 0
nAx = tip - nb; nLen = float(np.linalg.norm(nAx)); nAx /= nLen
tN = ((co - nb) @ nAx) / nLen                      # 0 przy nasadzie, 1 przy czubku głowy
if BIPED or KIND == 'slider': regW = sm(-0.12, 0.1, tN)
else: regW = sm(nb[2] - 0.04, nb[2] + 0.12, Z) * sm(nb[0] - 0.06, nb[0] + 0.08, X) * sm(-0.1, 0.12, tN)
regW = regW * reg
NECK_T = O.get('neckT', [0.0, 0.38, 0.72])        # nasady: szyja 1, szyja 2, głowa
neckH = [nb + nAx * nLen * t for t in NECK_T]

# ogon: za zadem
tb = np.array([hindX - O.get('tailX', 0.1), 0.0, legTop + O.get('tailUp', 0.18)])
if KIND == 'slider': tb = np.array([X.min() + LEN * 0.3, 0.0, 0.12])
treg = (X < tb[0] + 0.03) & (np.abs(Y) < max(tailCut, 0.04) * (3 if KIND == 'slider' else 1.6)) & (Z > 0.05 if KIND != 'slider' else Z > -1)
inLeg = np.zeros(n, bool)
for m in comps: inLeg |= m
treg &= ~inLeg
HAS_TAIL = O.get('tail', True) is not False and treg.sum() > 20
if HAS_TAIL:
    sc = -(X - tb[0]) + O.get('tailTipZ', -0.6) * (Z - tb[2])
    ti = np.nonzero(treg)[0][np.argmax(sc[treg])]
    ttip = co[treg & (np.linalg.norm(co - co[ti], axis=1) < 0.05)].mean(0); ttip[1] = 0
    tAx = ttip - tb; tLen = float(np.linalg.norm(tAx)); tAx /= tLen
    tT = ((co - tb) @ tAx) / tLen
    tailW = sm(-0.05, 0.25, tT) * treg * sm(tb[0] + 0.03, tb[0] - 0.02, X)
else:
    tailW = np.zeros(n); tT = np.zeros(n)

# ---------- wagi ----------
BONES = ['pelvis', 'chest', 'neck1', 'neck2', 'head', 'tail1', 'tail2']
for k, _, _ in LEGS: BONES += [k + '_up', k + '_lo', k + '_ft']
BI = {b: i for i, b in enumerate(BONES)}
W = np.zeros((n, len(BONES)))
legW = np.zeros(n); legOf = np.full(n, -1)
for li, (name, front, side) in enumerate(LEGS):
    h, k, a, f = J[name]
    w = legMask[name] * (1 - sm(legTop - O.get('legBlend', 0.10), legTop + 0.04, Z))
    if BIPED: w = legMask[name] * (1 - sm(legTop - 0.06, legTop + 0.03, Z))
    w = w * (1 - np.minimum(1, tailW * 2))
    sk = sm(k[2] + 0.035, k[2] - 0.035, Z); sa = sm(a[2] + 0.02, a[2] - 0.02, Z)   # poniżej kolana / poniżej pęciny
    W[:, BI[name + '_up']] = w * (1 - sk); W[:, BI[name + '_lo']] = w * sk * (1 - sa); W[:, BI[name + '_ft']] = w * sk * sa
    legW += w; legOf[w > 0.3] = li
rest = np.clip(1 - legW, 0, 1)
s1, s2, s3 = [sm(t - 0.1, t + 0.1, tN) * regW for t in NECK_T]
s1 = regW * sm(NECK_T[0] - 0.1, NECK_T[0] + 0.14, tN)
tw2 = sm(0.35, 0.65, tT) * tailW
neckAll = s1 * (1 - tailW)
W[:, BI['head']] = rest * neckAll * np.where(s1 > 0, s3 / np.maximum(s1, 1e-6), 0).clip(0, 1)
W[:, BI['neck2']] = rest * neckAll * np.where(s1 > 0, (s2 - s3).clip(0) / np.maximum(s1, 1e-6), 0).clip(0, 1)
W[:, BI['neck1']] = rest * neckAll - W[:, BI['head']] - W[:, BI['neck2']]
W[:, BI['tail2']] = rest * tw2; W[:, BI['tail1']] = rest * (tailW - tw2)
body = rest * (1 - neckAll) * (1 - tailW)
fb = sm(hindX, frontX, X)
W[:, BI['chest']] = body * fb; W[:, BI['pelvis']] = body * (1 - fb)
W = np.clip(W, 0, None); W /= W.sum(1, keepdims=True)

# błona między lewą i prawą nogą (generator skleja nogi): usuwamy ściany łączące różne nogi
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
bad = [f for f in bm.faces if len({legOf[v.index] for v in f.verts if legOf[v.index] >= 0}) > 1]
if bad: bmesh.ops.delete(bm, geom=bad, context='FACES_ONLY')
bm.to_mesh(me); bm.free()
assert len(me.vertices) == n

# ---------- kinematyka ----------
def T(v): m = np.eye(4); m[:3, 3] = v; return m
def Ry(a): c, s = math.cos(a), math.sin(a); m = np.eye(4); m[0, 0] = c; m[0, 2] = -s; m[2, 0] = s; m[2, 2] = c; return m   # dodatni: dół ku przodowi (+X)
def Rz(a): c, s = math.cos(a), math.sin(a); m = np.eye(4); m[0, 0] = c; m[0, 1] = -s; m[1, 0] = s; m[1, 1] = c; return m
def Rx(a): c, s = math.cos(a), math.sin(a); m = np.eye(4); m[1, 1] = c; m[1, 2] = -s; m[2, 1] = s; m[2, 2] = c; return m
def about(p, R): return T(p) @ R @ T(-np.asarray(p))
def ap(M, p): return (M @ np.append(p, 1))[:3]

GAIT = O.get('gait', 'walk')
PH = {'walk': {'HL': 0, 'FL': 0.25, 'HR': 0.5, 'FR': 0.75}, 'pace': {'HL': 0, 'FL': 0.12, 'HR': 0.5, 'FR': 0.62},
      'trot': {'HL': 0, 'FR': 0.05, 'HR': 0.5, 'FL': 0.55}, 'biped': {'L': 0, 'R': 0.5}}[GAIT if not BIPED else 'biped']
STANCE = O.get('stance', 0.62 if not BIPED else 0.58)
legLen = hipZ
STEP = O.get('stride', 0.42) * legLen           # droga stopy po ziemi w fazie podparcia
LIFT = O.get('lift', 0.09) * legLen
drop = (legLen - math.sqrt(max(1e-6, legLen ** 2 - (STEP / 2) ** 2))) * 0.9 + 0.004
STRIDE = STEP / STANCE                           # droga ciała na pełny cykl (jednostki modelu)

def leg_ik(name, front, hipM, foot_dx, foot_dz, toe):
    h0, k0, a0, f0 = J[name]
    Hh = ap(hipM, h0)
    A = a0 + np.array([foot_dx, 0, foot_dz])
    L1 = math.hypot(k0[0] - h0[0], k0[2] - h0[2]); L2 = math.hypot(a0[0] - k0[0], a0[2] - k0[2])
    dx, dz = A[0] - Hh[0], A[2] - Hh[2]; d = math.hypot(dx, dz)
    d2 = min(max(d, abs(L1 - L2) + 1e-4), L1 + L2 - 1e-4)
    if d2 != d: dx, dz = dx * d2 / d, dz * d2 / d; A = np.array([Hh[0] + dx, A[1], Hh[2] + dz]); d = d2
    al = math.acos(max(-1, min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))))
    base = math.atan2(dx, -dz)
    bend = O.get('kneeF', 1) if front else O.get('kneeH', -1)
    # gdy noga w spoczynku jest już wyraźnie ugięta, zginamy ją w tę samą stronę (inaczej staw "przeskakuje")
    cr = (a0[0] - h0[0]) * (k0[2] - h0[2]) - (a0[2] - h0[2]) * (k0[0] - h0[0])
    if abs(cr) > 0.004 * (L1 + L2) and not O.get('forceKnee'): bend = 1 if cr > 0 else -1
    th1 = base + bend * al
    K = np.array([Hh[0] + L1 * math.sin(th1), k0[1] + (Hh[1] - h0[1]), Hh[2] - L1 * math.cos(th1)])
    th2 = math.atan2(A[0] - K[0], -(A[2] - K[2]))
    r1 = math.atan2(k0[0] - h0[0], -(k0[2] - h0[2])); r2 = math.atan2(a0[0] - k0[0], -(a0[2] - k0[2]))
    M1 = T(Hh) @ Ry(th1 - r1) @ T(-h0)
    M2 = T(K) @ Ry(th2 - r2) @ T(-k0)
    M3 = T(np.array([A[0], a0[1] + (Hh[1] - h0[1]), A[2]])) @ Ry(toe) @ T(-a0)
    if O.get('debug') and abs(foot_dx) < 1e-9 and foot_dz == 0: print('REST', name, 'bend', bend, 'cr', round(cr, 4), 'd', round(d, 3), 'L', round(L1 + L2, 3), 'dth', round(th1 - r1, 3), round(th2 - r2, 3))
    return M1, M2, M3

def pose(mode, ph, extra=None):
    """Zwraca macierze kości dla fazy ph (0..1)."""
    t = 2 * math.pi * ph; M = {}
    walk = mode == 'walk'
    bob = (-math.cos(2 * t) * 0.006 * (1 if walk else 0) + (math.sin(t) * 0.003 if not walk else 0))
    rootZ = -(drop if LEGS else 0) + bob
    hop = 0
    if KIND == 'hopper' and walk:                 # kangur: skok obunóż
        hop = max(0, math.sin(t)) * O.get('hopH', 0.16)
    root = T([0, 0, rootZ + hop])
    if KIND == 'biped' and walk and O.get('waddle'): root = root @ about([0, 0, 0], Rx(math.sin(t) * O['waddle']))
    pitch = (math.sin(2 * t + 0.6) * 0.012 if walk else 0) + (-(0.10 * math.sin(t)) if hop else 0)
    mid = np.array([(frontX + hindX) / 2, 0, legTop + 0.1])
    sway = math.sin(t) * (0.035 if walk else 0.0) * O.get('sway', 1)
    M['pelvis'] = root @ about(mid, Ry(pitch) @ Rz(-sway))
    M['chest'] = root @ about(mid, Ry(pitch) @ Rz(sway))
    if KIND == 'slider' and walk:                 # foka / krokodyl bez nóg: fala wzdłuż ciała
        a = O.get('wave', 0.12)
        M['pelvis'] = root @ about(mid, Ry(math.sin(t + 1.2) * a)); M['chest'] = root @ about(mid, Ry(-math.sin(t) * a) @ T([0, 0, abs(math.sin(t)) * 0.02]))
    # szyja i głowa
    e = extra or {}
    nA = O.get('neckAmp', 1.0)
    nod = (math.sin(2 * t + 1.0) * 0.045 * nA if walk else math.sin(t) * 0.03 * nA) + e.get('neck', 0)
    look = e.get('look', 0)
    n1 = M['chest'] @ about(neckH[0], Rz(look * 0.4) @ Ry(-nod))
    n2 = n1 @ about(neckH[1], Rz(look * 0.3) @ Ry(-(nod * 0.5 + e.get('neck2', 0))))
    hd = n2 @ about(neckH[2], Rz(look * 0.5) @ Ry(-(-nod * 0.8 + e.get('head', 0))))
    M['neck1'], M['neck2'], M['head'] = n1, n2, hd
    # ogon
    tsw = (math.sin(t + 0.5) * 0.22 if walk else math.sin(2 * t) * 0.3 * e.get('tailK', 1)) * O.get('tailAmp', 1)
    if HAS_TAIL:
        ax = Rz if O.get('tailSide', True) else Ry
        t1 = M['pelvis'] @ about(tb, ax(tsw))
        M['tail1'] = t1; M['tail2'] = t1 @ about(tb + tAx * tLen * 0.5, ax(tsw * 1.3 * math.cos(t)))
    else: M['tail1'] = M['tail2'] = M['pelvis']
    # nogi
    for name, front, side in LEGS:
        hipM = M['chest'] if front else M['pelvis']
        if BIPED: hipM = M['pelvis']
        if walk and KIND != 'hopper':
            p = (ph + PH[name]) % 1
            if p < STANCE: dx = STEP / 2 - STEP * p / STANCE; dz = 0; toe = 0
            else:
                s = (p - STANCE) / (1 - STANCE); e2 = s * s * (3 - 2 * s)
                dx = -STEP / 2 + STEP * e2; dz = LIFT * math.sin(math.pi * s) ** 0.8; toe = -0.75 * math.sin(math.pi * min(1, s * 1.6)) * (1 - s)
                if not front: toe = -toe * 0.6 - 0.25 * math.sin(math.pi * s)
        elif walk:                               # skoczek: nogi zbierają się w locie
            air = max(0, math.sin(t)); dx = (-0.10 if not front else 0.03) * math.cos(t) * legLen; dz = hop * (0.75 if not front else 1.0) + air * 0.04; toe = -air * 0.5
        else:
            dx = dz = 0; toe = 0
            if e.get('shift') and name == e.get('shiftLeg'): dz = e['shift'] * LIFT * 0.6; toe = -e['shift'] * 0.35
        M[name + '_up'], M[name + '_lo'], M[name + '_ft'] = leg_ik(name, front, hipM, dx, dz, toe)
    return M

co4 = np.concatenate([co, np.ones((n, 1))], 1)
def deform(M):
    out = np.zeros((n, 3))
    for b, i in BI.items():
        w = W[:, i]
        if w.max() <= 0: continue
        out += (co4 @ M[b].T)[:, :3] * w[:, None]
    return out

# ---------- lista klatek ----------
WN, IN, EN = O.get('walkN', 12), O.get('idleN', 8), O.get('eatN', 8)
if O.get('preview'): WN, IN, EN = 4, 2, 2
eatDeg = math.radians(O.get('eatDeg', 55))
frames = []      # (nazwa, macierze)
for i in range(WN): frames.append((f'walk{i}', pose('walk', i / WN)))
for i in range(IN):
    ph = i / IN; lk = math.sin(2 * math.pi * ph) * O.get('look', 0.45)
    frames.append((f'idle{i}', pose('idle', ph, {'look': lk, 'neck': -abs(lk) * 0.05, 'shift': max(0, math.sin(2 * math.pi * ph - 1.2)) ** 2, 'shiftLeg': LEGS[-1][0] if LEGS else None})))
for i in range(EN):
    ph = i / EN; dn = 0.5 - 0.5 * math.cos(2 * math.pi * ph)        # 0 -> 1 -> 0
    dn = min(1, dn * 1.5); chew = math.sin(8 * math.pi * ph) * 0.05 * (dn > 0.95)
    frames.append((f'eat{i}', pose('idle', 0, {'neck': eatDeg * 0.55 * dn, 'neck2': eatDeg * 0.3 * dn, 'head': eatDeg * 0.25 * dn + chew, 'tailK': 0.5})))

# ---------- scena ----------
sc = bpy.context.scene
for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try: sc.render.engine = eng; break
    except Exception: pass
sc.render.film_transparent = True
sc.view_settings.view_transform = 'Standard'
try: sc.view_settings.look = 'None'
except Exception: pass
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
try: sc.eevee.taa_render_samples = 24
except Exception: pass
world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']; bg.inputs[0].default_value = (1.0, 0.97, 0.92, 1); bg.inputs[1].default_value = O.get('amb', 0.6)
for nme, mat in bpy.data.materials.items():
    if mat.use_nodes:
        for nd in mat.node_tree.nodes:
            if nd.type == 'BSDF_PRINCIPLED':
                nd.inputs['Roughness'].default_value = 0.85; nd.inputs['Metallic'].default_value = 0
                for k in ('Specular IOR Level', 'Specular'):
                    if k in nd.inputs: nd.inputs[k].default_value = 0.2
                rl = [l for l in mat.node_tree.links if l.to_node == nd and l.to_socket.name in ('Roughness', 'Metallic')]
                for l in rl: mat.node_tree.links.remove(l)

# kamera gry: izometria 2:1 (elewacja 30°), zwierzę idące w +X idzie na ekranie w prawo i w dół
el = math.radians(30); az = math.radians(-45)
cdir = np.array([math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)])     # od środka do kamery
right = np.array([-math.sin(az), math.cos(az), 0.0]); up = np.cross(cdir, right)
cam_d = bpy.data.cameras.new('c'); cam_d.type = 'ORTHO'; cam = bpy.data.objects.new('c', cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam.matrix_world = Matrix(((right[0], up[0], cdir[0], 0), (right[1], up[1], cdir[1], 0), (right[2], up[2], cdir[2], 0), (0, 0, 0, 1)))
# słońce: z lewej strony ekranu, od przodu i z góry
sdir = -right * 0.75 + np.array([cdir[0], cdir[1], 0]) * 0.45 + np.array([0, 0, 1.0]); sdir /= np.linalg.norm(sdir)
sun_d = bpy.data.lights.new('s', 'SUN'); sun_d.energy = O.get('sun', 2.6); sun_d.color = (1.0, 0.95, 0.86); sun_d.angle = math.radians(8)
sun = bpy.data.objects.new('s', sun_d); sc.collection.objects.link(sun)
sun.rotation_euler = Vector(sdir).to_track_quat('Z', 'Y').to_euler()
fill_d = bpy.data.lights.new('f', 'SUN'); fill_d.energy = 0.7; fill_d.color = (0.8, 0.88, 1.0)
try: fill_d.use_shadow = False
except Exception: pass
fill = bpy.data.objects.new('f', fill_d); sc.collection.objects.link(fill)
fill.rotation_euler = Vector(right * 0.8 + np.array([0, 0, 0.5])).to_track_quat('Z', 'Y').to_euler()

# cień: ta sama siatka spłaszczona na ziemi wzdłuż promieni słońca, rysowana na czarno w osobnym przebiegu
shadow_mat = bpy.data.materials.new('shadow'); shadow_mat.use_nodes = True
nt = shadow_mat.node_tree; nt.nodes.clear()
em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = (0, 0, 0, 1); outn = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(em.outputs[0], outn.inputs[0])
shd = -right * 0.75 + np.array([cdir[0], cdir[1], 0]) * 0.45; shd = shd / np.linalg.norm(shd) * O.get('shadowLen', 0.42)
def shadow_of(v): return np.stack([v[:, 0] - v[:, 2] * shd[0], v[:, 1] - v[:, 2] * shd[1], np.zeros(len(v))], 1)

DIRS = [('f', 0.0), ('b', math.pi / 2)]          # f: w prawo-dół (ku kamerze), b: w prawo-górę (od kamery)
def rotz(v, a): c, s = math.cos(a), math.sin(a); return v @ np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]])
posed = {}
lo = np.array([1e9, 1e9]); hi = -lo
for dn, a in DIRS:
    for fn, M in frames:
        v = rotz(deform(M), a); posed[(dn, fn)] = v
        for pts in (v, shadow_of(v)):
            uv = np.stack([pts @ right, pts @ up], 1); lo = np.minimum(lo, uv.min(0)); hi = np.maximum(hi, uv.max(0))
PX = O.get('px', 2); ppu = O['h'] * PX / math.cos(el) * O.get('scale', 1.0)       # pikseli na jednostkę modelu
pad = 3 / ppu; lo -= pad; hi += pad
Wp, Hp = int(math.ceil((hi[0] - lo[0]) * ppu)), int(math.ceil((hi[1] - lo[1]) * ppu))
hi = lo + np.array([Wp, Hp]) / ppu
cen = (lo + hi) / 2
cam.location = Vector(right * cen[0] + up * cen[1] + cdir * 10)
cam_d.ortho_scale = max(Wp, Hp) / ppu; cam_d.clip_start = 0.1; cam_d.clip_end = 40
sc.render.resolution_x = Wp; sc.render.resolution_y = Hp; sc.render.resolution_percentage = 100
real_mats = [s.material for s in ob.material_slots]

def render(v, path, shadow=False):
    me.vertices.foreach_set('co', (shadow_of(v) if shadow else v).ravel()); me.update()
    for i, s in enumerate(ob.material_slots): s.material = shadow_mat if shadow else real_mats[i]
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)

only = O.get('only')
for (dn, fn), v in posed.items():
    if only and not any(fn.startswith(x) for x in only): continue
    render(v, os.path.join(OUT, f'{dn}_{fn}.png'))
    render(v, os.path.join(OUT, f'{dn}_{fn}_s.png'), True)

meta = {'w': Wp, 'h': Hp, 'px': PX, 'ax': float(-lo[0] * ppu), 'ay': float(hi[1] * ppu), 'walk': WN, 'idle': IN, 'eat': EN,
        'stride': float(STRIDE * ppu / PX * math.hypot(math.cos(math.radians(45)), math.sin(math.radians(45)) * math.sin(el))),
        'legTop': legTop, 'kind': KIND, 'len': float(LEN), 'gameH': O['h']}
json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)
print('META', json.dumps(meta))
