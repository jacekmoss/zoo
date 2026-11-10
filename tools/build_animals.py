"""Zwierzęta przez Blendera: python tools/build_animals.py [nazwy] [--podglad] [--bez-renderu]
Render klatek (tools/blender/animal.py) wg tools/blender/animals.json -> models/<n>/r2, podgląd -> renders/podglad2/<n>.png."""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
BLENDER = os.environ.get('BLENDER', r'C:\Users\Jacek\tools\blender-5.3.0-windows-x64\blender.exe')
CFG = json.loads((ROOT / 'tools/blender/animals.json').read_text(encoding='utf-8'))
names = [a for a in sys.argv[1:] if not a.startswith('--')] or list(CFG)
preview = '--podglad' in sys.argv

def run(n):
    out = ROOT / 'models' / n / 'r2'
    for f in out.glob('*.png'): f.unlink()
    o = {'name': n, 'glb': str(ROOT / 'models' / n / 'model.glb'), 'out': str(out), 'px': 2, **CFG[n]}
    if preview: o['preview'] = True
    r = subprocess.run([BLENDER, '-b', '-P', str(ROOT / 'tools/blender/animal.py'), '--', json.dumps(o)], capture_output=True, text=True, encoding='utf-8', errors='replace')
    info = [l for l in r.stdout.splitlines() if l.startswith(('META', 'LEGCOMPS')) or 'Error' in l or 'Traceback' in l]
    ok = (out / 'meta.json').exists() and any(l.startswith('META') for l in info)
    if not ok: info += r.stdout.splitlines()[-12:]
    (ROOT / 'renders/podglad2').mkdir(parents=True, exist_ok=True)
    if ok: subprocess.run([sys.executable, str(ROOT / 'tools/blender/sheet.py'), str(out), str(ROOT / 'renders/podglad2' / (n + '.png')), '', '8' if preview else '12'], capture_output=True)
    return n, ok, info

with ThreadPoolExecutor(3) as ex:
    for n, ok, info in ex.map(run, names):
        print(('OK  ' if ok else 'FAIL'), n); [print('    ', l[:230]) for l in info]
