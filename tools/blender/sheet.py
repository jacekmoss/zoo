"""Podgląd klatek: python tools/blender/sheet.py <katalog r2> <wyjście.png> [wzorzec] — skleja klatki z cieniem na tle trawy."""
import sys, glob, os
from PIL import Image, ImageFilter
d, out = sys.argv[1], sys.argv[2]; pat = sys.argv[3] if len(sys.argv) > 3 else ''
fs = sorted([f for f in glob.glob(os.path.join(d, '*.png')) if not f.endswith('_s.png') and pat in os.path.basename(f)],
            key=lambda f: (os.path.basename(f).split('_')[0], ''.join(c for c in os.path.basename(f).split('_')[1] if c.isalpha()), int(''.join(c for c in os.path.basename(f) if c.isdigit()) or 0)))
def comp(f):
    a = Image.open(f).convert('RGBA'); s = Image.open(f[:-4] + '_s.png').convert('RGBA')
    sh = s.split()[3].filter(ImageFilter.GaussianBlur(2.5)).point(lambda v: int(v * 0.32))
    bg = Image.new('RGBA', a.size, (122, 158, 86, 255)); bg.paste(Image.new('RGBA', a.size, (20, 30, 15, 255)), (0, 0), sh); bg.alpha_composite(a); return bg
ims = [comp(f) for f in fs]; w, h = ims[0].size; cols = min(len(ims), int(sys.argv[4]) if len(sys.argv) > 4 else 6); rows = -(-len(ims) // cols)
S = Image.new('RGB', (cols * w, rows * h), (122, 158, 86))
for i, im in enumerate(ims): S.paste(im.convert('RGB'), ((i % cols) * w, (i // cols) * h))
S.save(out); print(out, S.size, len(ims))
