# Elementy interfejsu renderowane w 3D (ten sam charakter co modele w grze): szyld „MOJE ZOO”, przycisk startu, dłoń podpowiedzi.
#   blender -b -P tools/blender/ui.py -- '<json>'   json: { what: logo|play|hand, out: plik.png, w: szerokość w pikselach, samples }
import bpy, json, math, os, sys
from mathutils import Vector, Euler, Quaternion

O = json.loads(sys.argv[sys.argv.index('--') + 1])
WHAT = O['what']; OUT = os.path.abspath(O['out']); os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = O.get('samples', 96); sc.cycles.use_denoising = True
try: sc.cycles.device = 'CPU'
except Exception: pass
sc.render.film_transparent = True; sc.view_settings.view_transform = 'Standard'
try: sc.view_settings.look = 'None'
except Exception: pass
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'

# świat: łagodny gradient (ciepła góra, ciemniejszy dół) – daje odbicia na złocie i emalii
world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True; nt = world.node_tree
bg = nt.nodes['Background']; tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); ramp = nt.nodes.new('ShaderNodeValToRGB')
mp = nt.nodes.new('ShaderNodeMapRange'); mp.inputs[1].default_value = -1; mp.inputs[2].default_value = 1
nt.links.new(tc.outputs['Generated'], sep.inputs[0]); nt.links.new(sep.outputs[2], mp.inputs[0]); nt.links.new(mp.outputs[0], ramp.inputs[0])
ramp.color_ramp.elements[0].position = 0.25; ramp.color_ramp.elements[0].color = (0.10, 0.08, 0.06, 1)
ramp.color_ramp.elements[1].position = 0.8; ramp.color_ramp.elements[1].color = (1.0, 0.95, 0.85, 1)
nt.links.new(ramp.outputs[0], bg.inputs[0]); bg.inputs[1].default_value = O.get('amb', 0.9)


def mat(name, color, rough=0.5, metal=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    for k in ('Coat Weight', 'Clearcoat'):
        if k in b.inputs: b.inputs[k].default_value = coat; break
    return m


def wood(name, dark=(0.10, 0.055, 0.03), light=(0.26, 0.15, 0.075), scale=3.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; t = m.node_tree; b = t.nodes['Principled BSDF']
    tc = t.nodes.new('ShaderNodeTexCoord'); mp = t.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (0.35, 1, 6)
    nz = t.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = 8; nz.inputs['Roughness'].default_value = 0.6
    wv = t.nodes.new('ShaderNodeTexWave'); wv.inputs['Scale'].default_value = 1.6; wv.inputs['Distortion'].default_value = 5; wv.inputs['Detail'].default_value = 3
    try: wv.bands_direction = 'Z'
    except Exception: pass
    mix = t.nodes.new('ShaderNodeMath'); mix.operation = 'MULTIPLY'
    rp = t.nodes.new('ShaderNodeValToRGB'); rp.color_ramp.elements[0].color = (*dark, 1); rp.color_ramp.elements[1].color = (*light, 1)
    rp.color_ramp.elements[0].position = 0.15; rp.color_ramp.elements[1].position = 0.75
    bump = t.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.35; bump.inputs['Distance'].default_value = 0.02
    t.links.new(tc.outputs['Object'], mp.inputs[0]); t.links.new(mp.outputs[0], nz.inputs[0]); t.links.new(mp.outputs[0], wv.inputs[0])
    t.links.new(nz.outputs[0], mix.inputs[0]); t.links.new(wv.outputs[0], mix.inputs[1]); t.links.new(mix.outputs[0], rp.inputs[0])
    t.links.new(rp.outputs[0], b.inputs['Base Color']); t.links.new(mix.outputs[0], bump.inputs['Height']); t.links.new(bump.outputs[0], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = 0.55
    return m


GOLD = mat('gold', (0.95, 0.66, 0.22), 0.3, 0.9)
IVORY = mat('ivory', (0.97, 0.90, 0.72), 0.35, 0.0, 0.4)
GREEN = mat('green', (0.016, 0.055, 0.024), 0.4, 0.0, 0.15)
GLOVE = mat('glove', (0.96, 0.94, 0.88), 0.55)
ROPE = mat('rope', (0.42, 0.30, 0.16), 0.9)
col = sc.collection


def add(ob): col.objects.link(ob); return ob


def box(name, sx, sy, sz, loc, bevel, m, segs=6):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); ob = bpy.context.active_object; ob.name = name; ob.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    if bevel: bv = ob.modifiers.new('b', 'BEVEL'); bv.width = bevel; bv.segments = segs
    bpy.ops.object.shade_smooth(); ob.data.materials.append(m); return ob


def cyl(name, r, depth, loc, rot, m, verts=64, bevel=0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=loc, rotation=rot); ob = bpy.context.active_object; ob.name = name
    if bevel: bv = ob.modifiers.new('b', 'BEVEL'); bv.width = bevel; bv.segments = 5; bv.limit_method = 'ANGLE'
    bpy.ops.object.shade_smooth()
    try: ob.data.use_auto_smooth = True
    except Exception: pass
    ob.data.materials.append(m); return ob


def ell(name, loc, scale, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=48, ring_count=24, location=loc, rotation=rot); ob = bpy.context.active_object; ob.name = name; ob.scale = scale
    bpy.ops.object.shade_smooth(); ob.data.materials.append(m); return ob


def light(kind, loc, energy, size=4, color=(1, 1, 1)):
    d = bpy.data.lights.new('l', kind); d.energy = energy; d.color = color
    if kind == 'AREA': d.size = size
    ob = add(bpy.data.objects.new('l', d)); ob.location = loc
    ob.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); return ob


# kamera: z przodu (patrzy wzdłuż +Y), lekko z góry
def camera(width_units, cx, cz, aspect, elev=10):
    d = bpy.data.cameras.new('c'); d.type = 'ORTHO'; d.ortho_scale = width_units if aspect >= 1 else width_units / aspect
    cam = add(bpy.data.objects.new('c', d)); sc.camera = cam
    e = math.radians(elev); cam.location = (cx, -20 * math.cos(e), cz + 20 * math.sin(e)); cam.rotation_euler = (math.pi / 2 - e, 0, 0)
    W = O.get('w', 1200); sc.render.resolution_x = W; sc.render.resolution_y = int(round(W / aspect)); sc.render.resolution_percentage = 100


if WHAT == 'logo':
    # szyld: deska w złotej ramie, wypukłe litery, dwie liny do góry
    fnt = bpy.data.fonts.load(O.get('font', 'C:/Windows/Fonts/BOOKOSB.TTF'))
    cu = bpy.data.curves.new('t', 'FONT'); cu.body = O.get('text', 'MOJE ZOO'); cu.font = fnt; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    cu.size = 1.0; cu.extrude = 0.09; cu.bevel_depth = 0.022; cu.bevel_resolution = 4; cu.space_character = 1.1; cu.space_word = 0.8
    tx = add(bpy.data.objects.new('t', cu)); tx.rotation_euler = (math.pi / 2, 0, 0); tx.location = (0, -0.2, 0.0); tx.scale = (0.92, 0.92, 1); cu.materials.append(IVORY)
    bpy.context.view_layer.update()
    bw = tx.dimensions.x + 1.0; bh = 1.3
    box('frame', bw + 0.18, 0.16, bh + 0.18, (0, 0.02, 0), 0.3, GOLD, 12)
    box('board', bw, 0.2, bh, (0, -0.02, 0), 0.24, GREEN, 12)
    box('line', bw - 0.16, 0.2, bh - 0.16, (0, -0.03, 0), 0.18, GOLD, 12)
    box('inner', bw - 0.2, 0.2, bh - 0.2, (0, -0.04, 0), 0.165, GREEN, 12)
    for sx in (-1, 1):
        ell('nail', (sx * (bw / 2 - 0.3), -0.15, 0), (0.055, 0.04, 0.055), GOLD)
        x = sx * (bw / 2 - 0.55)
        cyl('ring', 0.09, 0.05, (x, 0, bh / 2 + 0.13), (math.pi / 2, 0, 0), GOLD, bevel=0.01)
        cyl('rope', 0.035, 3.0, (x, 0.03, bh / 2 + 0.16 + 1.5), (0, 0, 0), ROPE, verts=16)
    light('AREA', (-4, -6, 5), 900, 6, (1.0, 0.95, 0.85)); light('AREA', (5, -5, -1), 250, 6, (0.85, 0.9, 1.0)); light('AREA', (0, -3, 6), 300, 8)
    camera(bw + 0.5, 0, 0.55, (bw + 0.5) / (bh + 1.5), elev=8)
elif WHAT == 'play':
    # przycisk: złoty pierścień, zielona emaliowana kopuła, wypukły ślad łapy
    cyl('ring', 1.0, 0.22, (0, 0, 0), (math.pi / 2, 0, 0), GOLD, verts=96, bevel=0.06)
    ell('dome', (0, -0.06, 0), (0.86, 0.16, 0.86), GREEN)
    y = -0.2
    ell('pad', (0, y, -0.2), (0.34, 0.09, 0.27), IVORY)
    ell('padl', (-0.17, y, -0.3), (0.2, 0.085, 0.17), IVORY); ell('padr', (0.17, y, -0.3), (0.2, 0.085, 0.17), IVORY)
    for x, z, a, k in ((-0.41, 0.07, 0.5, 0.9), (-0.15, 0.33, 0.14, 1.0), (0.15, 0.33, -0.14, 1.0), (0.41, 0.07, -0.5, 0.9)):
        ell('toe', (x, y + 0.01, z), (0.125 * k, 0.07, 0.17 * k), IVORY, rot=(0, a, 0))
    light('AREA', (-3, -5, 4), 420, 5, (1.0, 0.95, 0.85)); light('AREA', (4, -4, -2), 120, 5, (0.85, 0.9, 1.0)); light('AREA', (0, -6, 0), 60, 8)
    camera(2.3, 0, 0, 1, elev=6)
else:
    # dłoń w rękawiczce: palec wskazujący do góry, mankiet w kolorach interfejsu
    def caps(a, b, r):
        a, b = Vector(a), Vector(b); d = b - a
        rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
        cyl('f', r, d.length, (a + b) / 2, rot, GLOVE, verts=48); ell('f', a, (r, r, r), GLOVE); ell('f', b, (r, r, r), GLOVE)

    pal = box('palm', 2.05, 0.74, 1.9, (0.15, 0, -0.05), 0.36, GLOVE, 10)
    caps((-0.6, 0, 0.6), (-0.6, 0, 2.5), 0.31)                                    # palec wskazujący
    for x, z in ((-0.06, 1.02), (0.47, 0.96), (0.98, 0.78)):                      # zgięte palce: trzy kostki
        caps((x, -0.1, 0.3), (x, -0.1, z), 0.3)
    caps((-0.72, -0.05, -0.55), (-1.42, -0.12, 0.2), 0.31)                        # kciuk
    cyl('cuff', 0.98, 0.5, (0.15, 0, -1.3), (0, 0, 0), GREEN, bevel=0.08).scale = (1, 0.5, 1)
    cyl('cuffg', 1.02, 0.12, (0.15, 0, -1.05), (0, 0, 0), GOLD, bevel=0.04).scale = (1, 0.52, 1)
    piv = add(bpy.data.objects.new('p', None))
    for o in list(col.objects):
        if o is not piv and o.type == 'MESH': o.parent = piv
    piv.rotation_euler = Euler((math.radians(-8), math.radians(22), math.radians(8)), 'XYZ')
    light('AREA', (-4, -6, 5), 280, 6, (1.0, 0.96, 0.9)); light('AREA', (5, -4, 0), 220, 6, (0.8, 0.88, 1.0)); light('AREA', (0, -6, -3), 80, 8)
    camera(5.0, -0.25, 0.45, 5.0 / 5.6, elev=4)

sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print('OK', OUT)
