import bpy, sys
p = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=p)
sc = bpy.context.scene
print('FPS', sc.render.fps, 'range', sc.frame_start, sc.frame_end)
for o in bpy.data.objects:
    print('OBJ', o.type, o.name, 'parent', o.parent and o.parent.name, 'loc', tuple(round(a, 2) for a in o.location), 'rot', tuple(round(a, 2) for a in o.rotation_euler), 'scale', tuple(round(a, 3) for a in o.scale), 'dims', tuple(round(a, 2) for a in o.dimensions))
    if o.type == 'ARMATURE':
        print('  bones', [b.name for b in o.data.bones])
        ad = o.animation_data; print('  action', ad and ad.action and (ad.action.name, tuple(ad.action.frame_range)))
for a in bpy.data.actions: print('ACTION', a.name, tuple(a.frame_range))
