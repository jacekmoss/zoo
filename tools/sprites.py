"""Składa klatki z tools/render3d.js w arkusze gry (sprites/*.webp) i dopisuje je do sprites/index.js.

  python tools/sprites.py zwierze <typ> <katalog_renderu>     # np. zwierze zyrafa models/zyrafa/render
  python tools/sprites.py wybieg  <typ> <katalog_renderu>     # typ = zwierzę albo biom (_laka, _lod…)
  python tools/sprites.py obiekt  <klucz> <katalog_renderu>   # klucz jak w grze: kiosk_lody, opiekun, wet, ogrod…

Zwierzę: wszystkie klatki przycięte do wspólnego prostokąta, siatka 8 kolumn, punkt stóp (ax, ay) w pikselach klatki.
Wybieg: warstwy back i front przycięte osobno, położenie w jednostkach gry względem środka miejsca.
"""
import json, re, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'sprites'
IDX = OUT / 'index.js'
COLS = 8


def load_index():
    if IDX.exists():
        t = IDX.read_text(encoding='utf-8')
        m = re.search(r'window\.ZOO_3D = (\{.*\});', t, re.S)
        if m:
            return json.loads(m.group(1))
    return {}


def save_index(d):
    IDX.write_text('// Grafika 3D (Meshy → tools/render3d.js → tools/sprites.py). Plik generowany, nie edytować ręcznie.\n'
                   'window.ZOO_3D = ' + json.dumps(d, indent=1, ensure_ascii=False) + ';\n', encoding='utf-8')


def bbox_union(ims):
    box = None
    for im in ims:
        b = im.getchannel('A').point(lambda a: 255 if a > 6 else 0).getbbox()
        if not b:
            continue
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    return box


def animal(typ, src):
    meta = json.loads((src / 'meta.json').read_text())
    num = lambda p: int(re.findall(r'(\d+)\.png', p.name)[0])
    walk = sorted(src.glob('walk*.png'), key=num)
    idle = sorted(src.glob('idle*.png'), key=num)
    ims = [Image.open(p).convert('RGBA') for p in walk + idle]
    x0, y0, x1, y1 = bbox_union(ims)
    x0, y0, x1, y1 = max(0, x0 - 2), max(0, y0 - 2), x1 + 2, y1 + 2
    fw, fh = x1 - x0, y1 - y0
    rows = (len(ims) + COLS - 1) // COLS
    sheet = Image.new('RGBA', (fw * COLS, fh * rows), (0, 0, 0, 0))
    for i, im in enumerate(ims):
        sheet.paste(im.crop((x0, y0, x1, y1)), ((i % COLS) * fw, (i // COLS) * fh))
    OUT.mkdir(exist_ok=True)
    f = OUT / f'{typ}.webp'
    sheet.save(f, 'WEBP', quality=88, method=6)
    px = meta['px']
    return {'kind': 'animal', 'file': f'sprites/{typ}.webp', 'fw': fw, 'fh': fh, 'cols': COLS,
            'walk': len(walk), 'idle': len(idle), 'px': px,
            'ax': round(meta['fx'] - x0, 2), 'ay': round(meta['fy'] - y0, 2)}, f


def obj(key, src):
    meta = json.loads((src / 'meta.json').read_text())
    px, gx0, gy0 = meta['px'], meta['x0'], meta['y0']
    im = Image.open(src / 'back.png').convert('RGBA')
    b = bbox_union([im]) or (0, 0, 1, 1)
    OUT.mkdir(exist_ok=True)
    f = OUT / f'{key}.webp'
    im.crop(b).save(f, 'WEBP', quality=88, method=6)
    return {'kind': 'obj', 'file': f'sprites/{f.name}', 'x': round(gx0 + b[0] / px, 2), 'y': round(gy0 + b[1] / px, 2),
            'w': round((b[2] - b[0]) / px, 2), 'h': round((b[3] - b[1]) / px, 2)}, f


def enclosure(typ, src):
    meta = json.loads((src / 'meta.json').read_text())
    px, gx0, gy0 = meta['px'], meta['x0'], meta['y0']
    out, files = {'kind': 'enc', 'px': px}, []
    for layer in ('back', 'front'):
        im = Image.open(src / f'{layer}.png').convert('RGBA')
        b = bbox_union([im]) or (0, 0, 1, 1)
        f = OUT / f'wybieg_{typ}_{layer}.webp'
        OUT.mkdir(exist_ok=True)
        im.crop(b).save(f, 'WEBP', quality=88, method=6)
        out[layer] = {'file': f'sprites/{f.name}', 'x': round(gx0 + b[0] / px, 2), 'y': round(gy0 + b[1] / px, 2),
                      'w': round((b[2] - b[0]) / px, 2), 'h': round((b[3] - b[1]) / px, 2)}
        files.append(f)
    return out, files


if __name__ == '__main__':
    kind, typ, src = sys.argv[1], sys.argv[2], Path(sys.argv[3])
    idx = load_index()
    if kind == 'zwierze':
        entry, f = animal(typ, src)
        idx.setdefault(typ, {})['animal'] = entry
        print(f.name, f.stat().st_size // 1024, 'kB', entry)
    elif kind == 'obiekt':
        entry, f = obj(typ, src)
        idx.setdefault(typ, {})['obj'] = entry
        print(f.name, f.stat().st_size // 1024, 'kB')
    else:
        entry, fs = enclosure(typ, src)
        idx.setdefault(typ, {})['enc'] = entry
        for f in fs:
            print(f.name, f.stat().st_size // 1024, 'kB')
    save_index(idx)
