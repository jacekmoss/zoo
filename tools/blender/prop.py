# Pojazd / przedmiot: model .glb -> nieruchome klatki w dwóch kierunkach jazdy (f: prawo-dół, b: prawo-góra) z cieniem.
#   blender -b -P tools/blender/prop.py -- '<json>'   json: { glb, out, len (długość w jednostkach gry), px, yaw }
import bpy, json, math, os, sys
import numpy as np
from mathutils import Vector, Matrix
O = json.loads(sys.argv[sys.argv.index('--') + 1])
OUT = os.path.abspath(O['out']); os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(O['glb']))
sc = bpy.context.scene
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active; ob.parent = None
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = ob.data
for p in me.polygons: p.use_smooth = True
n = len(me.vertices); co = np.empty(n * 3); me.vertices.foreach_get('co', co); co = co.reshape(n, 3)
yaw = math.radians(O.get('yaw', 90)); c, s = math.cos(yaw), math.sin(yaw)
co = co @ np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]])
mn, mx = co.min(0), co.max(0); L = mx[0] - mn[0]
co = (co - np.array([(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, mn[2]])) / L

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
sh_mat = bpy.data.materials.new('shadow'); sh_mat.use_nodes = True; nt = sh_mat.node_tree; nt.nodes.clear()
em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = (0, 0, 0, 1); on = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(em.outputs[0], on.inputs[0])
real = [s.material for s in ob.material_slots]
def rotz(v, a): c, s = math.cos(a), math.sin(a); return v @ np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]])
def shadow_of(v): return np.stack([v[:, 0] - v[:, 2] * shd[0], v[:, 1] - v[:, 2] * shd[1], np.zeros(len(v))], 1)
DIRS = [('f', 0.0), ('b', math.pi / 2)]
posed = {d: rotz(co, a) for d, a in DIRS}
lo = np.array([1e9, 1e9]); hi = -lo
for v in posed.values():
    for pts in (v, shadow_of(v)):
        uv = np.stack([pts @ right, pts @ up], 1); lo = np.minimum(lo, uv.min(0)); hi = np.maximum(hi, uv.max(0))
PX = O.get('px', 3); ppu = O['len'] * PX / 0.79            # długość wzdłuż przekątnej ekranu
pad = 3 / ppu; lo -= pad; hi += pad
Wp, Hp = int(math.ceil((hi[0] - lo[0]) * ppu)), int(math.ceil((hi[1] - lo[1]) * ppu)); hi = lo + np.array([Wp, Hp]) / ppu
cen = (lo + hi) / 2
cam.location = Vector(right * cen[0] + up * cen[1] + cdir * 10); cam_d.ortho_scale = max(Wp, Hp) / ppu; cam_d.clip_start = 0.1; cam_d.clip_end = 40
sc.render.resolution_x = Wp; sc.render.resolution_y = Hp; sc.render.resolution_percentage = 100
for d, v in posed.items():
    for sh in (False, True):
        me.vertices.foreach_set('co', (shadow_of(v) if sh else v).ravel()); me.update()
        for i, sl in enumerate(ob.material_slots): sl.material = sh_mat if sh else real[i]
        sc.render.filepath = os.path.join(OUT, f'{d}_stand0' + ('_s' if sh else '') + '.png'); bpy.ops.render.render(write_still=True)
meta = {'w': Wp, 'h': Hp, 'px': PX, 'ax': float(-lo[0] * ppu), 'ay': float(hi[1] * ppu), 'stand': 1, 'kind': 'prop'}
json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1); print('META', json.dumps(meta))
