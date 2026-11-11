"""Postacie i pojazdy przez Blendera: python tools/build_people.py [nazwy] [--podglad]
os_* -> tools/blender/person.py (walk.glb z Meshy), auto_* -> tools/blender/prop.py. Wynik w models/<n>/r2."""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
BLENDER = os.environ.get('BLENDER', r'C:\Users\Jacek\tools\blender-5.3.0-windows-x64\blender.exe')
# h: wysokość postaci w jednostkach gry; len: długość pojazdu
CFG = {'os_mezczyzna': {'h': 46}, 'os_kobieta': {'h': 43}, 'os_chlopiec': {'h': 31}, 'os_dziewczynka': {'h': 30}, 'os_babcia': {'h': 41},
       'os_opiekun': {'h': 46}, 'os_sprzatacz': {'h': 46}, 'os_dostawca': {'h': 46}, 'os_weterynarz': {'h': 43}, 'os_robotnik': {'h': 46},
       'auto_osobowe': {'len': 84}, 'auto_suv': {'len': 88}, 'auto_autobus': {'len': 165}, 'auto_karetka': {'len': 100}, 'auto_radiowoz': {'len': 90}}
names = [a for a in sys.argv[1:] if not a.startswith('--')] or list(CFG)
def run(n):
    d = ROOT / 'models' / n; out = d / 'r2'
    for f in out.glob('*.png'): f.unlink()
    person = n.startswith('os_')
    o = {'glb': str(d / ('walk.glb' if person else 'model.glb')), 'out': str(out), 'px': 3, **CFG[n]}
    if not person: o.update({'yaw': 180, 'sun': 2.0, 'amb': 0.5})
    if '--podglad' in sys.argv: o['preview'] = True
    r = subprocess.run([BLENDER, '-b', '-P', str(ROOT / 'tools/blender' / ('person.py' if person else 'prop.py')), '--', json.dumps(o)], capture_output=True, text=True, encoding='utf-8', errors='replace')
    ok = 'META' in r.stdout
    if ok: subprocess.run([sys.executable, str(ROOT / 'tools/blender/sheet.py'), str(out), str(ROOT / 'renders/podglad2' / (n + '.png')), '', '9'], capture_output=True)
    return n, ok, [] if ok else r.stdout.splitlines()[-10:]
with ThreadPoolExecutor(3) as ex:
    for n, ok, info in ex.map(run, names):
        print('OK  ' if ok else 'FAIL', n); [print('   ', l[:200]) for l in info]
