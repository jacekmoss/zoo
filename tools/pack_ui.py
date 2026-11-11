"""Szyld, przycisk startu i dłoń z renders/ui/*.png (tools/blender/ui.py) -> sprites2/ui_*.webp + sprites2/ui.js (wymiary i punkty zaczepienia).
   Kolejność: blender -b -P tools/blender/ui.py -- '{"what":"logo|play|hand","out":"renders/ui/<what>.png","w":1400|640|440,"samples":160}', potem python tools/pack_ui.py"""
import json
from pathlib import Path
from PIL import Image, ImageFilter, ImageEnhance
ROOT = Path(__file__).resolve().parent.parent
out = {}
for name, shadow in (('logo', (0, 10, 12, 0.45)), ('play', (0, 12, 14, 0.5)), ('hand', (4, 8, 8, 0.45))):
    im = Image.open(ROOT / 'renders' / 'ui' / f'{name}.png').convert('RGBA')
    pad = 40; big = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0)); big.paste(im, (pad, pad))
    dx, dy, blur, op = shadow
    a = big.getchannel('A').filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * op))
    sh = Image.new('RGBA', big.size, (0, 0, 0, 0)); sh.putalpha(a)
    res = Image.new('RGBA', big.size, (0, 0, 0, 0)); res.alpha_composite(sh, (dx, dy)) if (dx or dy) else res.alpha_composite(sh)
    if name == 'hand':   # ciemny obrys: biała rękawiczka musi być czytelna na jasnym tle (piasek, ścieżka)
        ed = big.getchannel('A').filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(1.2))
        ol = Image.new('RGBA', big.size, (28, 39, 23, 0)); ol.putalpha(ed); res.alpha_composite(ol)
    res.alpha_composite(big)
    bb = big.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()      # obrys samego obiektu (bez cienia)
    cb = res.getchannel('A').point(lambda v: 255 if v > 2 else 0).getbbox(); res = res.crop(cb)
    e = {'file': f'sprites2/ui_{name}.webp', 'w': res.width, 'h': res.height,
         'bx': bb[0] - cb[0], 'by': bb[1] - cb[1], 'bw': bb[2] - bb[0], 'bh': bb[3] - bb[1]}
    if name == 'hand':   # czubek palca: środek najwyższych nieprzezroczystych pikseli
        al = big.getchannel('A'); px = al.load(); y0 = bb[1] + 6
        xs = [x for x in range(big.width) if px[x, y0] > 128]; e['tx'] = (xs[0] + xs[-1]) / 2 - cb[0]; e['ty'] = bb[1] - cb[1]
    res.save(ROOT / e['file'], 'WEBP', quality=92, method=6); out[name] = e
for name in ('hedge', 'hedge2', 'bush'):      # pas zieleni (tools/blender/hedge.py): środek obrazka = środek pola, 3 piksele na jednostkę gry
    im = Image.open(ROOT / 'renders' / 'ui' / f'{name}.png').convert('RGBA')
    cb = im.getchannel('A').point(lambda v: 255 if v > 2 else 0).getbbox(); res = im.crop(cb)
    al = res.getchannel('A'); res = ImageEnhance.Brightness(res.convert('RGB')).enhance(0.8).convert('RGBA'); res.putalpha(al)   # ciemniej, jak zieleń wybiegów
    e = {'file': f'sprites2/ui_{name}.webp', 'w': res.width / 3, 'h': res.height / 3, 'cx': (im.width / 2 - cb[0]) / 3, 'cy': (im.height / 2 - cb[1]) / 3}
    res.save(ROOT / e['file'], 'WEBP', quality=90, method=6); out[name] = e
(ROOT / 'sprites2' / 'ui.js').write_text('// Plik generowany przez tools/pack_ui.py, nie edytować ręcznie.\nwindow.ZOO_UI = ' + json.dumps(out, indent=1) + ';\n', encoding='utf-8')
print(json.dumps(out))
