"""Tekstury terenu: models/koncept_t_<nazwa>/koncept.png → sprites/tex_<nazwa>.webp (bez szwów, 512 px) + wpis w sprites/index.js.

  python tools/tekstury.py [nazwa ...]      # domyślnie wszystkie koncepty t_*

Szwy: obraz przesunięty o pół kafla i zszyty z oryginałem miękką maską przy krawędziach
(krawędzie wyniku pochodzą ze środka obrazu, więc pasują do siebie po zawinięciu).
"""
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import sprites

SIZE = 512
# wielkość jednego kafla tekstury w jednostkach świata (przed rzutem izometrycznym); pole siatki ma bok ok. 85
TILE = {'wild': 340, 'own': 300, 'free': 260, 'gravel': 190, 'asphalt': 240, 'piach': 300, 'bloto': 300, 'woda': 300}


def seamless(im):
    w, h = im.size
    sh = ImageChops.offset(im, w // 2, h // 2)
    # maska: 1 (oryginał) w środku, 0 (przesunięty) przy krawędziach
    m = Image.new('L', (w, h), 0)
    px = m.load()
    for y in range(h):
        for x in range(w):
            d = min(x, y, w - 1 - x, h - 1 - y) / (w * 0.09)
            px[x, y] = int(255 * max(0.0, min(1.0, d)))
    m = m.filter(ImageFilter.GaussianBlur(3))
    return Image.composite(im, sh, m)


if __name__ == '__main__':
    names = sys.argv[1:] or [p.name[len('koncept_t_'):] for p in (ROOT / 'models').glob('koncept_t_*')]
    idx = sprites.load_index()
    for n in names:
        src = ROOT / 'models' / f'koncept_t_{n}' / 'koncept.png'
        im = Image.open(src).convert('RGB')
        b = 0.04  # odcinamy brzegi (czasem jaśniejsza ramka)
        w, h = im.size
        im = im.crop((int(w * b), int(h * b), int(w * (1 - b)), int(h * (1 - b)))).resize((SIZE, SIZE), Image.LANCZOS)
        im = seamless(im)
        f = ROOT / 'sprites' / f'tex_{n}.webp'
        im.save(f, 'WEBP', quality=86, method=6)
        idx.setdefault('tex_' + n, {})['tex'] = {'file': f'sprites/{f.name}', 'tile': TILE.get(n, 300)}
        print(n, f.stat().st_size // 1024, 'kB')
    sprites.save_index(idx)
