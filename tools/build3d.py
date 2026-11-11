"""Cała grafika 3D naraz: render (tools/render3d.js) + arkusze (tools/sprites.py) wg tools/render_all.json.

  python tools/build3d.py                 # wszystko, co ma model w models/
  python tools/build3d.py zebra _laka     # tylko wybrane klucze
  python tools/build3d.py --podglad       # zwierzęta: po 1 klatce do sprawdzenia obrotu (models/<x>/podglad3d/)

Wymaga serwera gry (python -m http.server 8765) i Playwrighta (NODE_PATH jak w README).
render_all.json: "zwierzeta" {typ: opcje renderAnimal}, "wybiegi" {"_biom"|typ: {model, fill, pool, block}},
"obiekty" {nazwa_obrazka: {model, fill, ...}}. pool = [x, y, rx, ry], block = [[x, y, rx, ry], ...] w jednostkach gry.
"""
import json, os, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import sprites

CFG = json.loads((ROOT / 'tools' / 'render_all.json').read_text(encoding='utf-8'))
NODE_ENV = {**os.environ, 'NODE_PATH': os.environ.get('NODE_PATH', 'C:/Users/Jacek/Desktop/projects/onko-karta/node_modules')}
args = [a for a in sys.argv[1:] if not a.startswith('--')]
preview = '--podglad' in sys.argv


def has(model):
    return (ROOT / 'models' / model / 'model.glb').exists()


def node(kind, model, opts, out):
    r = subprocess.run(['node', 'tools/render3d.js', kind, model, json.dumps(opts), str(out)], cwd=ROOT, env=NODE_ENV,
                       capture_output=True, text=True, timeout=900)
    if r.returncode or 'ERROR' in r.stderr:
        print('  !', r.stderr.strip()[-400:])
    return r.returncode == 0


def want(k):
    return not args or k in args


idx_changes = []
for typ, o in CFG['zwierzeta'].items():
    if not want(typ) or not has(typ):
        continue
    opts = {'yaw': -1.5708, 'px': 4, **o}
    if preview:
        node('zwierze', typ, {**opts, 'walkN': 1, 'idleN': 1, 'px': 2}, ROOT / 'models' / typ / 'podglad3d')
        print(typ, 'podgląd')
        continue
    out = ROOT / 'models' / typ / 'render'
    if node('zwierze', typ, opts, out):
        entry, f = sprites.animal(typ, out)
        idx_changes.append((typ, 'animal', entry))
        print(typ, f.stat().st_size // 1024, 'kB')

if not preview:
    for key, o in CFG['wybiegi'].items():
        if not want(key) or not has(o['model']):
            continue
        out = ROOT / 'models' / o['model'] / 'render'
        opts = {k: v for k, v in o.items() if k not in ('model', 'pool', 'block')}
        if node('wybieg', o['model'], {'px': 3, 'fill': 1.14, 'squash': 0.55, 'squashFrom': 0.25, **opts}, out):   # squash: niższe drzewa, nie zasłaniają sąsiadów
            entry, fs = sprites.enclosure(key, out)
            if o.get('pool'):
                x, y, rx, ry = o['pool']; entry['pool'] = {'x': x, 'y': y, 'rx': rx, 'ry': ry}
            entry['block'] = o.get('block', [])
            idx_changes.append((key, 'enc', entry))
            print(key, sum(f.stat().st_size for f in fs) // 1024, 'kB')
    for key, o in CFG['obiekty'].items():
        if not want(key) or not has(o['model']):
            continue
        out = ROOT / 'models' / o['model'] / 'render'
        opts = {k: v for k, v in o.items() if k != 'model'}
        if node('wybieg', o['model'], {'px': 3, 'uniform': True, 'noFront': True, 'top': 230, **opts}, out):
            entry, f = sprites.obj(key, out)
            idx_changes.append((key, 'obj', entry))
            print(key, f.stat().st_size // 1024, 'kB')

    idx = sprites.load_index()
    for key, part, entry in idx_changes:
        idx.setdefault(key, {})[part] = entry
    sprites.save_index(idx)
    print('sprites/index.js:', len(idx), 'wpisów')
