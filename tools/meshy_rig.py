"""Szkielet i chód dla postaci (Meshy rigging, 5 kredytów): python tools/meshy_rig.py <nazwa> [...]
Zapisuje models/<nazwa>/rig.glb (postać ze szkieletem) i walk.glb (animacja chodu)."""
import json, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import meshy
HEIGHT = {'os_chlopiec': 1.2, 'os_dziewczynka': 1.15, 'os_babcia': 1.6, 'os_kobieta': 1.68, 'os_weterynarz': 1.68}
for name in sys.argv[1:]:
    d = meshy.OUT / name
    if (d / 'walk.glb').exists(): print(name, 'jest'); continue
    info = json.loads((d / 'meshy.json').read_text(encoding='utf-8'))
    try:
        tid = meshy.call('POST', '/v1/rigging', {'input_task_id': info['id'], 'height_meters': HEIGHT.get(name, 1.78)})['result']
        while True:
            t = meshy.call('GET', '/v1/rigging/' + tid)
            if t['status'] == 'SUCCEEDED': break
            if t['status'] in ('FAILED', 'CANCELED'): raise SystemExit('Nie wyszło: ' + json.dumps(t.get('task_error')))
            time.sleep(8)
        (d / 'rig.json').write_text(json.dumps(t, indent=1), encoding='utf-8')
        r = t['result']
        meshy.fetch(r['rigged_character_glb_url'], d / 'rig.glb')
        meshy.fetch(r['basic_animations']['walking_glb_url'], d / 'walk.glb')
        print(name, 'ok')
    except BaseException as e:
        print(name, 'BŁĄD', str(e)[:400])
