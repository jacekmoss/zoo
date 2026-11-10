"""Meshy API dla Moje Zoo: zamawia modele 3D i pobiera je do models/<nazwa>/.

Klucz: zmienna MESHY_API_KEY albo plik ~/.meshy_key (nigdy w repo).

  python tools/meshy.py saldo
  python tools/meshy.py obraz <plik.png> <nazwa> [--opis "tekstura..."] [--poly 20000]
  python tools/meshy.py tekst "<opis po angielsku>" <nazwa> [--poly 20000]
  python tools/meshy.py lista
  python tools/meshy.py koncept <wzór.png> <nazwa> "<opis>"   # obrazek w stylu wzoru (np. do wybiegów)

Każde zamówienie najpierw wypisuje koszt i czeka na 't' (albo --tak).
"""
import base64, json, mimetypes, os, sys, time, urllib.request, urllib.error
from pathlib import Path

API = 'https://api.meshy.ai/openapi'
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'models'


def key():
    k = os.environ.get('MESHY_API_KEY')
    if not k:
        p = Path.home() / '.meshy_key'
        if p.exists():
            k = p.read_text(encoding='utf-8').strip()
    if not k:
        sys.exit('Brak klucza: zapisz go w ~/.meshy_key albo w MESHY_API_KEY.')
    return k


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={
        'Authorization': 'Bearer ' + key(), 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        sys.exit(f'Meshy {e.code}: {e.read().decode(errors="replace")[:500]}')


def confirm(msg, args):
    print(msg)
    if '--tak' in args:
        return
    if input('Zamawiam? [t/N] ').strip().lower() != 't':
        sys.exit('Anulowane.')


def opt(args, name, default=None):
    if name in args:
        i = args.index(name)
        return args[i + 1]
    return default


def wait(kind, tid):
    path = {'image': '/v1/image-to-3d/', 'text': '/v2/text-to-3d/'}[kind] + tid
    while True:
        t = call('GET', path)
        st = t.get('status')
        print(f'  {st} {t.get("progress", 0)}%', flush=True)
        if st == 'SUCCEEDED':
            return t
        if st in ('FAILED', 'CANCELED'):
            sys.exit('Nie wyszło: ' + json.dumps(t.get('task_error')))
        time.sleep(10)


def fetch(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=300) as r:
        dest.write_bytes(r.read())
    print('  ->', dest.relative_to(ROOT))


def save(name, task, extra=None):
    d = OUT / name
    d.mkdir(parents=True, exist_ok=True)
    fetch(task['model_urls']['glb'], d / 'model.glb')
    if task.get('thumbnail_url'):
        fetch(task['thumbnail_url'], d / 'podglad.png')
    info = {'id': task['id'], 'type': task.get('type'), 'credits': task.get('consumed_credits'), **(extra or {})}
    (d / 'meshy.json').write_text(json.dumps(info, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'Gotowe: {name}, zużyto {task.get("consumed_credits")} kredytów.')


def data_uri(path):
    mime = mimetypes.guess_type(path)[0] or 'image/png'
    return f'data:{mime};base64,' + base64.b64encode(Path(path).read_bytes()).decode()


def cmd_obraz(args):
    img, name = args[0], args[1]
    body = {'image_url': data_uri(img), 'ai_model': 'latest', 'should_texture': True,
            'texture_resolution': '2k', 'should_remesh': True,
            'target_polycount': int(opt(args, '--poly', 20000)), 'target_formats': ['glb']}
    if opt(args, '--opis'):
        body['texture_prompt'] = opt(args, '--opis')
    confirm(f'Obraz -> 3D „{name}” z {img}: ok. 30 kredytów.', args)
    tid = call('POST', '/v1/image-to-3d', body)['result']
    print('Zadanie', tid)
    save(name, wait('image', tid), {'zrodlo': str(img), 'opis': body.get('texture_prompt')})


def cmd_tekst(args):
    prompt, name = args[0], args[1]
    confirm(f'Tekst -> 3D „{name}”: podgląd 20 + tekstura 10 = ok. 30 kredytów.', args)
    pre = call('POST', '/v2/text-to-3d', {'mode': 'preview', 'prompt': prompt, 'ai_model': 'latest',
                                          'should_remesh': True, 'target_polycount': int(opt(args, '--poly', 20000))})['result']
    print('Podgląd', pre)
    wait('text', pre)
    ref = call('POST', '/v2/text-to-3d', {'mode': 'refine', 'preview_task_id': pre, 'texture_resolution': '2k',
                                          'texture_prompt': opt(args, '--opis', prompt)[:800]})['result']
    print('Tekstura', ref)
    save(name, wait('text', ref), {'prompt': prompt})


def cmd_koncept(args):
    # obrazek w stylu wzoru: python tools/meshy.py koncept <wzór.png> <nazwa> "<opis>" [--model nano-banana-pro]
    ref, name, prompt = args[0], args[1], args[2]
    confirm(f'Obrazek „{name}” w stylu {ref}: kilka kredytów.', args)
    tid = call('POST', '/v1/image-to-image', {'ai_model': opt(args, '--model', 'nano-banana-pro'), 'prompt': prompt,
                                              'reference_image_urls': [data_uri(ref)]})['result']
    while True:
        t = call('GET', '/v1/image-to-image/' + tid)
        if t['status'] == 'SUCCEEDED': break
        if t['status'] in ('FAILED', 'CANCELED'): sys.exit('Nie wyszło: ' + json.dumps(t.get('task_error')))
        time.sleep(5)
    fetch(t['image_urls'][0], OUT / name / 'koncept.png')
    print(f'Gotowe: {name}, zużyto {t.get("consumed_credits")} kredytów.')


def cmd_saldo(_):
    print(json.dumps(call('GET', '/v1/balance'), indent=2))


def cmd_lista(_):
    for t in call('GET', '/v1/image-to-3d?page_size=20&sort_by=-created_at'):
        print(t['id'], t['status'], t.get('consumed_credits'))


if __name__ == '__main__':
    a = sys.argv[1:]
    cmds = {'koncept': cmd_koncept, 'obraz': cmd_obraz, 'tekst': cmd_tekst, 'saldo': cmd_saldo, 'lista': cmd_lista}
    if not a or a[0] not in cmds:
        sys.exit(__doc__)
    cmds[a[0]](a[1:])
