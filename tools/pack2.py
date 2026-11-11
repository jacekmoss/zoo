"""Arkusze klatek z renderów Blendera: python tools/pack2.py [nazwy]
models/<n>/r2/*.png (+ cień *_s.png) -> sprites2/<n>.webp i sprites2/index.js (window.ZOO_S2).
Kolejność klatek: kierunek f (prawo-dół), potem b (prawo-góra); w kierunku: walk, idle, eat (zwierzę) / walk, stand (postać) / stand (pojazd).
Portrety zwierząt do kart i albumu: pierwsza klatka postoju ze starych arkuszy (widok z boku) -> sprites2/p_<n>.webp."""
import json, math, re, sys
from pathlib import Path
from PIL import Image, ImageFilter
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'sprites2'; OUT.mkdir(exist_ok=True)
IDX = OUT / 'index.json'
index = json.loads(IDX.read_text(encoding='utf-8')) if IDX.exists() else {}
names = sys.argv[1:] or sorted(p.parent.parent.name for p in (ROOT / 'models').glob('*/r2/meta.json'))

def comp(d, name, px):
    a = Image.open(d / f'{name}.png').convert('RGBA')
    sp = d / f'{name}_s.png'
    if not sp.exists(): return a
    sh = Image.open(sp).convert('RGBA').split()[3].filter(ImageFilter.GaussianBlur(px * 0.9)).point(lambda v: int(v * 0.30))
    out = Image.new('RGBA', a.size, (16, 24, 12, 0)); out.putalpha(sh); out.alpha_composite(a); return out

total = 0
for n in names:
    d = ROOT / 'models' / n / 'r2'; m = json.loads((d / 'meta.json').read_text())
    kinds = [k for k in ('walk', 'idle', 'eat', 'stand') if m.get(k)]
    order = [f'{dr}_{k}{i}' for dr in 'fb' for k in kinds for i in range(m[k])]
    if not all((d / f'{f}.png').exists() for f in order): print('BRAK KLATEK', n); continue
    fr = [comp(d, f, m['px']) for f in order]
    box = None
    for f in fr:
        b = f.split()[3].point(lambda v: 255 if v > 6 else 0).getbbox()
        if b: box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    box = (max(0, box[0] - 1), max(0, box[1] - 1), min(m['w'], box[2] + 1), min(m['h'], box[3] + 1))
    fw, fh = box[2] - box[0], box[3] - box[1]; N = len(fr)
    cols = max(1, min(N, round(math.sqrt(N * fh / fw)))); 
    while cols * fw > 4096: cols -= 1
    rows = -(-N // cols)
    assert rows * fh <= 4096, (n, rows * fh)
    S = Image.new('RGBA', (cols * fw, rows * fh), (0, 0, 0, 0))
    for i, f in enumerate(fr): S.paste(f.crop(box), ((i % cols) * fw, (i // cols) * fh))
    S.save(OUT / f'{n}.webp', quality=90, method=6)
    e = {'file': f'sprites2/{n}.webp', 'fw': fw, 'fh': fh, 'cols': cols, 'px': m['px'], 'ax': round(m['ax'] - box[0], 2), 'ay': round(m['ay'] - box[1], 2),
         'n': {k: m[k] for k in kinds}, 'per': len(order) // 2, 'kind': m.get('kind', 'animal')}
    if 'stride' in m: e['stride'] = round(m['stride'], 2)
    if 'gameH' in m: e['h'] = m['gameH']
    index[n] = e; mb = S.width * S.height * 4 * 1.33 / 1048576; total += mb
    print(f'{n:16s} {S.width}x{S.height} {N} klatek, {(OUT / (n + ".webp")).stat().st_size // 1024} kB, GPU {mb:.1f} MB')

# portrety ze starych arkuszy
old = (ROOT / 'sprites/index.js').read_text(encoding='utf-8'); old = json.loads(old[old.index('{'):old.rindex('}') + 1])
for t, dd in old.items():
    a = dd.get('animal')
    if not a or (OUT / f'p_{t}.webp').exists(): continue
    im = Image.open(ROOT / a['file']).convert('RGBA'); i = a['walk']
    f = im.crop(((i % a['cols']) * a['fw'], (i // a['cols']) * a['fh'], (i % a['cols'] + 1) * a['fw'], (i // a['cols'] + 1) * a['fh']))
    f = f.crop(f.getbbox()); f.thumbnail((300, 300), Image.LANCZOS); f.save(OUT / f'p_{t}.webp', quality=92, method=6)
    index['p_' + t] = {'file': f'sprites2/p_{t}.webp', 'w': f.width, 'h': f.height, 'kind': 'portrait'}
IDX.write_text(json.dumps(index, indent=1), encoding='utf-8')
(OUT / 'index.js').write_text('// Klatki z Blendera (tools/pack2.py). Plik generowany, nie edytować ręcznie.\nwindow.ZOO_S2 = ' + json.dumps(index, indent=1) + ';\n', encoding='utf-8')
print(f'razem GPU dla spakowanych teraz: {total:.0f} MB; w indeksie {len(index)} pozycji')
