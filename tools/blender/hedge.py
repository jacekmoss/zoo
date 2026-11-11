# Żywopłot i krzak do pasa zieleni między działkami, w rzucie gry (izometria 2:1), z cieniem na ziemi.
#   blender -b -P tools/blender/hedge.py -- '{"what":"hedge|bush","out":"renders/ui/<what>.png","px":3}'
# Obrazek jest wyśrodkowany na środku pola (1 pole = 1 jednostka świata = 84.85 jednostek gry na jednostkę kamery).
import bpy, json, math, os, sys
from mathutils import Vector, Matrix
O = json.loads(sys.argv[sys.argv.index('--') + 1]); WHAT = O['what']; OUT = os.path.abspath(O['out'])
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = O.get('samples', 96); sc.cycles.use_denoising = True
sc.render.film_transparent = True; sc.view_settings.view_transform = 'Standard'
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']; bg.inputs[0].default_value = (1.0, 0.97, 0.92, 1); bg.inputs[1].default_value = 0.7

m = bpy.data.materials.new('leaf'); m.use_nodes = True; t = m.node_tree; b = t.nodes['Principled BSDF']
nz = t.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 38; nz.inputs['Detail'].default_value = 3
vo = t.nodes.new('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 26
mx = t.nodes.new('ShaderNodeMath'); mx.operation = 'MULTIPLY'; t.links.new(nz.outputs[0], mx.inputs[0]); t.links.new(vo.outputs[0], mx.inputs[1])
rp = t.nodes.new('ShaderNodeValToRGB'); rp.color_ramp.elements[0].color = (0.035, 0.11, 0.02, 1); rp.color_ramp.elements[1].color = (0.20, 0.36, 0.07, 1)
rp.color_ramp.elements[0].position = 0.05; rp.color_ramp.elements[1].position = 0.45
t.links.new(mx.outputs[0], rp.inputs[0]); t.links.new(rp.outputs[0], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.8
bump = t.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.8; bump.inputs['Distance'].default_value = 0.02
t.links.new(vo.outputs[0], bump.inputs['Height']); t.links.new(bump.outputs[0], b.inputs['Normal'])

tex = bpy.data.textures.new('d', 'CLOUDS'); tex.noise_scale = 0.09
def leafy(ob, strength):
    sub = ob.modifiers.new('s', 'SUBSURF'); sub.levels = 4; sub.render_levels = 4
    d = ob.modifiers.new('d', 'DISPLACE'); d.texture = tex; d.strength = strength; d.mid_level = 0.5
    bpy.ops.object.shade_smooth(); ob.data.materials.append(m)

if WHAT.startswith('hedge'):          # wzdłuż osi X świata: długość 1 pole, niski i wąski
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.14)); ob = bpy.context.active_object; ob.scale = (1.04, 0.3, 0.28)
    bpy.ops.object.transform_apply(scale=True)
    bv = ob.modifiers.new('b', 'BEVEL'); bv.width = 0.07; bv.segments = 3
    bpy.ops.object.modifier_apply(modifier='b')
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.subdivide(number_cuts=6); bpy.ops.object.mode_set(mode='OBJECT')
    leafy(ob, 0.07)
    if O.get('rot'): ob.rotation_euler = (0, 0, math.pi / 2)     # druga orientacja (wzdłuż drugiej osi gry)
else:                        # okrągły krzak na skrzyżowanie pasów
    for loc, r in (((0, 0, 0.2), 0.27), ((0.2, 0.08, 0.14), 0.18), ((-0.17, -0.1, 0.13), 0.17)):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=r, location=loc); ob = bpy.context.active_object; ob.scale = (1, 1, 0.85); leafy(ob, 0.08)
bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0)); pl = bpy.context.active_object; pl.is_shadow_catcher = True

# kamera gry: świat X -> prawo-dół ekranu, świat Y -> lewo-dół; elewacja atan(0.5)
el = math.atan(0.5); az = math.radians(-135)
cdir = Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))     # od celu do kamery
right = Vector((0, 0, 1)).cross(cdir).normalized() * -1; right = cdir.cross(Vector((0, 0, 1))).normalized() * -1
up = cdir.cross(right).normalized() * 1
if up.z < 0: up = -up
right = up.cross(cdir).normalized()
cam_d = bpy.data.cameras.new('c'); cam_d.type = 'ORTHO'; cam = bpy.data.objects.new('c', cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam.matrix_world = Matrix(((right.x, up.x, cdir.x, 0), (right.y, up.y, cdir.y, 0), (right.z, up.z, cdir.z, 0), (0, 0, 0, 1)))
cam.location = cdir * 10
PX = O.get('px', 3); W, H = 150 * PX, 110 * PX                      # kadr 150 × 110 jednostek gry, środek = środek pola
cam_d.ortho_scale = 150 / 84.853; sc.render.resolution_x = W; sc.render.resolution_y = H
sd = bpy.data.lights.new('s', 'SUN'); sd.energy = 3.2; sd.color = (1.0, 0.95, 0.86); sd.angle = math.radians(6)
sun = bpy.data.objects.new('s', sd); sc.collection.objects.link(sun)
sdir = (-right * 0.75 + Vector((cdir.x, cdir.y, 0)) * 0.45 + Vector((0, 0, 1.0))).normalized(); sun.rotation_euler = sdir.to_track_quat('Z', 'Y').to_euler()
sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
print('OK', OUT, 'right', tuple(round(v, 3) for v in right), 'xdir', round(Vector((1, 0, 0)).dot(right), 3), round(Vector((1, 0, 0)).dot(up), 3))
