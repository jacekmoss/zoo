# blender -b -P tools/blender/inspect.py -- <model.glb>
import bpy, sys, numpy as np
from mathutils import Vector
p = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=p)
print('BLENDER', bpy.app.version_string)
for o in bpy.data.objects:
    print('OBJ', o.type, o.name, 'parent', o.parent and o.parent.name, 'rot', tuple(round(a, 2) for a in o.rotation_euler), 'scale', tuple(round(a, 2) for a in o.scale))
    if o.type == 'MESH':
        m = o.data
        co = np.array([o.matrix_world @ v.co for v in m.vertices])
        print('  verts', len(m.vertices), 'polys', len(m.polygons), 'min', co.min(0).round(3), 'max', co.max(0).round(3))
        print('  mats', [(s.material.name if s.material else None) for s in o.material_slots], 'uv', len(m.uv_layers))
        # connected components
        import bmesh
        bm = bmesh.new(); bm.from_mesh(m); n0 = len(bm.verts)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); print('  after merge', len(bm.verts), 'of', n0)
        seen = set(); comps = []
        for v in bm.verts:
            if v.index in seen: continue
            st = [v]; c = 0; seen.add(v.index)
            while st:
                a = st.pop(); c += 1
                for e in a.link_edges:
                    b = e.other_vert(a)
                    if b.index not in seen: seen.add(b.index); st.append(b)
            comps.append(c)
        print('  components', len(comps), sorted(comps, reverse=True)[:6])
for im in bpy.data.images: print('IMG', im.name, im.size[:])
