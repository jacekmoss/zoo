"""Zamawia wiele modeli naraz (6 równolegle), pomija gotowe (models/<nazwa>/model.glb).
  python tools/meshy_batch.py tools/meshy_jobs.json [nazwa ...]
Każde zadanie: {"name", "prompt", "texture"}. Wynik i błędy w models/<nazwa>/meshy.json / log na ekranie."""
import json, sys, threading, traceback
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import meshy

ANIMAL = ('{what}, full body, standing on the ground in a natural relaxed pose, realistic natural proportions, '
          'single animal, no base, no background, game asset')
ANIMAL_TEX = ('realistic {what} with natural fur, skin or feather colors, subtle hand-painted stylized texture, '
              'small natural eyes, muted natural colors, no cartoon features')
lock = threading.Lock()


def run(job):
    name = job['name']
    if (meshy.OUT / name / 'model.glb').exists():
        return name, 'jest'
    prompt = job.get('prompt') or ANIMAL.format(what=job['what'])
    tex = job.get('texture') or ANIMAL_TEX.format(what=job['what'])
    try:
        pre = meshy.call('POST', '/v2/text-to-3d', {'mode': 'preview', 'prompt': prompt[:800], 'ai_model': 'latest',
                                                     'should_remesh': True, 'target_polycount': job.get('poly', 20000)})['result']
        meshy.wait('text', pre)
        ref = meshy.call('POST', '/v2/text-to-3d', {'mode': 'refine', 'preview_task_id': pre, 'texture_resolution': '2k',
                                                     'texture_prompt': tex[:800]})['result']
        t = meshy.wait('text', ref)
        with lock:
            meshy.save(name, t, {'prompt': prompt, 'texture': tex})
        return name, 'ok'
    except BaseException as e:   # meshy.py kończy błędem przez sys.exit
        return name, 'BŁĄD ' + (str(e) or traceback.format_exc()[-300:])


if __name__ == '__main__':
    jobs = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    only = set(sys.argv[2:])
    if only:
        jobs = [j for j in jobs if j['name'] in only]
    meshy.wait.__globals__['print'] = lambda *a, **k: None      # bez postępu z 6 wątków naraz
    with ThreadPoolExecutor(6) as ex:
        for name, st in ex.map(run, jobs):
            print(name, st, flush=True)
