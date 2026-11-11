# Postać: model Meshy ze szkieletem i animacją chodu (walk.glb) -> klatki chodu i postoju w rzucie gry.
#   blender -b -P tools/blender/person.py -- '<json>'   json: { glb, out, h (wysokość w jednostkach gry), px, walkN }
import bpy, json, math, os, sys
import numpy as np
from mathutils import Vector, Matrix, Euler

O = json.loads(sys.argv[sys.argv.index('--') + 1])
OUT = os.path.abspath(O['out']); os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(O['glb']))
sc = bpy.context.scene
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = [o for o in bpy.data.objects if o.type == 'MESH' and o.parent == arm]
for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.parent != arm]: bpy.data.objects.remove(o)
act = arm.animation_data.action
f0, f1 = act.frame_range
WN = O.get('walkN', 8)

for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try: sc.render.engine = eng; break
    except Exception: pass
sc.render.film_transparent = True; sc.view_settings.view_transform = 'Standard'
try: sc.view_settings.look = 'None'
except Exception: pass
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
try: sc.eevee.taa_render_samples = 24
except Exception: pass
world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']; bg.inputs[0].default_value = (1.0, 0.97, 0.92, 1); bg.inputs[1].default_value = O.get('amb', 0.6)
for mat in bpy.data.materials:
    if mat.use_nodes:
        for nd in mat.node_tree.nodes:
            if nd.type == 'BSDF_PRINCIPLED':
                for l in [l for l in mat.node_tree.links if l.to_node == nd and l.to_socket.name in ('Roughness', 'Metallic')]: mat.node_tree.links.remove(l)
                nd.inputs['Roughness'].default_value = 0.85; nd.inputs['Metallic'].default_value = 0
                for k in ('Specular IOR Level', 'Specular'):
                    if k in nd.inputs: nd.inputs[k].default_value = 0.2

el = math.radians(30); az = math.radians(-45)
cdir = np.array([math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)])
right = np.array([-math.sin(az), math.cos(az), 0.0]); up = np.cross(cdir, right)
cam_d = bpy.data.cameras.new('c'); cam_d.type = 'ORTHO'; cam = bpy.data.objects.new('c', cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam.matrix_world = Matrix(((right[0], up[0], cdir[0], 0), (right[1], up[1], cdir[1], 0), (right[2], up[2], cdir[2], 0), (0, 0, 0, 1)))
sdir = -right * 0.75 + np.array([cdir[0], cdir[1], 0]) * 0.45 + np.array([0, 0, 1.0]); sdir /= np.linalg.norm(sdir)
sun_d = bpy.data.lights.new('s', 'SUN'); sun_d.energy = O.get('sun', 2.6); sun_d.color = (1.0, 0.95, 0.86); sun_d.angle = math.radians(8)
sun = bpy.data.objects.new('s', sun_d); sc.collection.objects.link(sun); sun.rotation_euler = Vector(sdir).to_track_quat('Z', 'Y').to_euler()
fill_d = bpy.data.lights.new('f', 'SUN'); fill_d.energy = 0.7; fill_d.color = (0.8, 0.88, 1.0)
try: fill_d.use_shadow = False
except Exception: pass
fill = bpy.data.objects.new('f', fill_d); sc.collection.objects.link(fill); fill.rotation_euler = Vector(right * 0.8 + np.array([0, 0, 0.5])).to_track_quat('Z', 'Y').to_euler()
shd = -right * 0.75 + np.array([cdir[0], cdir[1], 0]) * 0.45; shd = shd / np.linalg.norm(shd) * 0.42

# cień: kopia siatki bez szkieletu, której wierzchołki co klatkę kładziemy na ziemi
sh_mat = bpy.data.materials.new('shadow'); sh_mat.use_nodes = True; nt = sh_mat.node_tree; nt.nodes.clear()
em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = (0, 0, 0, 1); on = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(em.outputs[0], on.inputs[0])
shadows = []
for b in body:
    m2 = b.data.copy(); so = bpy.data.objects.new(b.name + '_sh', m2); sc.collection.objects.link(so)
    m2.materials.clear(); m2.materials.append(sh_mat); shadows.append(so)

def world_verts(b):
    dg = bpy.context.evaluated_depsgraph_get(); e = b.evaluated_get(dg); me = e.to_mesh()
    n = len(me.vertices); co = np.empty(n * 3); me.vertices.foreach_get('co', co); co = co.reshape(n, 3)
    M = np.array(e.matrix_world); co = co @ M[:3, :3].T + M[:3, 3]; e.to_mesh_clear(); return co

def bone_head(name):
    pb = arm.pose.bones.get(name); return np.array(arm.matrix_world @ pb.head) if pb else None

# przód postaci: od pięty do palców
sc.frame_set(int(f0)); bpy.context.view_layer.update()
fwd = None
for a, b in (('LeftFoot', 'LeftToeBase'), ('RightFoot', 'RightToeBase')):
    p, q = bone_head(a), bone_head(b)
    if p is not None and q is not None: d = q - p; d[2] = 0; fwd = d if fwd is None else fwd + d
yaw0 = -math.atan2(fwd[1], fwd[0]) if fwd is not None and np.linalg.norm(fwd) > 1e-4 else math.radians(90)

def set_time(t): sc.frame_set(int(math.floor(t)), subframe=t - math.floor(t)); bpy.context.view_layer.update()
# postój: chwila chodu, w której stopy mijają się (są najbliżej siebie) – wygląda jak spokojne stanie
best_t = None
for k in range(48):
    t = f0 + (f1 - f0) * k / 48; set_time(t)
    L, R = bone_head('LeftFoot'), bone_head('RightFoot'); lh, rh, hp = bone_head('LeftHand'), bone_head('RightHand'), bone_head('Hips')
    if L is None or R is None: break
    sc0 = float(np.linalg.norm((L - R)[:2])) * 2 + abs(L[2] - R[2]) * 3
    if lh is not None and rh is not None and hp is not None: sc0 += 0.3 * (abs(float((lh - hp) @ (fwd / (np.linalg.norm(fwd) + 1e-9)))) + abs(float((rh - hp) @ (fwd / (np.linalg.norm(fwd) + 1e-9)))))
    if best_t is None or sc0 < best_t[0]: best_t = (sc0, t)
STAND_T = best_t[1] if best_t else f0
def set_pose(kind, i):
    set_time(f0 + (f1 - f0) * i / WN if kind == 'walk' else STAND_T)

def frame_verts(kind, i, a):
    set_pose(kind, i)
    arm.rotation_mode = 'XYZ'; arm.rotation_euler = (0, 0, 0); arm.location = (0, 0, 0); bpy.context.view_layer.update()
    vs = [world_verts(b) for b in body]
    allv = np.concatenate(vs); cen = np.array([(allv[:, 0].min() + allv[:, 0].max()) / 2, (allv[:, 1].min() + allv[:, 1].max()) / 2, allv[:, 2].min()])
    hips = bone_head('Hips'); cx, cy = (hips[0], hips[1]) if hips is not None else (cen[0], cen[1])
    ang = yaw0 + a; c, s = math.cos(ang), math.sin(ang)
    # obrót wokół osi przechodzącej przez biodra, stopy na ziemi
    arm.rotation_euler = (0, 0, ang)
    off = np.array([-(cx * c - cy * s), -(cx * s + cy * c), -min(0, cen[2])])
    arm.location = off; bpy.context.view_layer.update()
    return [world_verts(b) for b in body]

DIRS = [('f', 0.0), ('b', math.pi / 2)]
walk_jobs = [(d, a, 'walk', i) for d, a in DIRS for i in range(WN)]
if O.get('preview'): walk_jobs = [j for j in walk_jobs if j[3] in (0, WN // 4)]
jobs = walk_jobs
lo = np.array([1e9, 1e9]); hi = -lo; Hm = 0
for d, a, kind, i in jobs:
    for v in frame_verts(kind, i, a):
        Hm = max(Hm, v[:, 2].max())
        for pts in (v, np.stack([v[:, 0] - v[:, 2] * shd[0], v[:, 1] - v[:, 2] * shd[1], np.zeros(len(v))], 1)):
            uv = np.stack([pts @ right, pts @ up], 1); lo = np.minimum(lo, uv.min(0)); hi = np.maximum(hi, uv.max(0))
PX = O.get('px', 3); ppu = O['h'] * PX / math.cos(el) / O.get('meters', Hm)
pad = 3 / ppu + 0.04 * Hm; lo -= pad; hi += pad
Wp, Hp = int(math.ceil((hi[0] - lo[0]) * ppu)), int(math.ceil((hi[1] - lo[1]) * ppu)); hi = lo + np.array([Wp, Hp]) / ppu
cen = (lo + hi) / 2
cam.location = Vector(right * cen[0] + up * cen[1] + cdir * 10); cam_d.ortho_scale = max(Wp, Hp) / ppu; cam_d.clip_start = 0.1; cam_d.clip_end = 40
sc.render.resolution_x = Wp; sc.render.resolution_y = Hp; sc.render.resolution_percentage = 100

for d, a, kind, i in walk_jobs + [(d, a, 'stand', 0) for d, a in DIRS]:
    vs = frame_verts(kind, i, a)
    for so, v in zip(shadows, vs):
        so.data.vertices.foreach_set('co', np.stack([v[:, 0] - v[:, 2] * shd[0], v[:, 1] - v[:, 2] * shd[1], np.zeros(len(v))], 1).ravel()); so.data.update()
    for so in shadows: so.hide_render = True
    for o in body: o.hide_render = False
    sc.render.filepath = os.path.join(OUT, f'{d}_{kind}{i}.png'); bpy.ops.render.render(write_still=True)
    for so in shadows: so.hide_render = False
    for o in body: o.hide_render = True
    sc.render.filepath = os.path.join(OUT, f'{d}_{kind}{i}_s.png'); bpy.ops.render.render(write_still=True)

meta = {'w': Wp, 'h': Hp, 'px': PX, 'ax': float(-lo[0] * ppu), 'ay': float(hi[1] * ppu), 'walk': WN, 'stand': 1, 'gameH': O['h'], 'kind': 'person'}
json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1); print('META', json.dumps(meta))
