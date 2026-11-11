"""Generuje sw.js z pełną listą plików gry (działanie bez internetu): python tools/make_sw.py
Uruchamiać po każdej zmianie plików gry lub grafiki – wersja pamięci to skrót zawartości plików."""
import hashlib, json
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
files = ['index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']
files += sorted(p.name for p in ROOT.glob('*.js') if p.name != 'sw.js')
for d, pat in (('sprites', '*.webp'), ('sprites', '*.js'), ('sprites2', '*.webp'), ('sprites2', '*.js'), ('fonts', '*.woff2'), ('audio', '*.mp3'), ('audio', '*.json'), ('ui', '*.*')):
    files += sorted(f'{d}/{p.name}' for p in (ROOT / d).glob(pat))
h = hashlib.sha1()
for f in files: h.update(f.encode()); h.update((ROOT / f).read_bytes())
ver = h.hexdigest()[:10]
size = sum((ROOT / f).stat().st_size for f in files)
sw = """'use strict';
/* Moje Zoo – działanie bez internetu. Plik generowany przez tools/make_sw.py, nie edytować ręcznie.
   Przy instalacji zapisujemy w pamięci urządzenia WSZYSTKIE pliki gry (grafika, dźwięk, czcionka).
   Potem gra bierze pliki z pamięci (start bez sieci i bez czekania), a nową wersję pobiera w tle:
   gdy się pobierze cała, zastępuje starą przy następnym uruchomieniu. */
const CACHE = 'zoo-%s';
const FILES = %s;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    // po kilka plików naraz; jeden nieudany plik nie może zablokować całej instalacji
    for (let i = 0; i < FILES.length; i += 8) {
      await Promise.all(FILES.slice(i, i + 8).map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => fetch(f).then((r) => r.ok && c.put(f, r)).catch(() => {}))));
    }
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('zoo-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true }).then((hit) => {
    if (hit) return hit;
    return fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => c.match('./index.html'));
  })));
});
""" % (ver, json.dumps(['./'] + ['./' + f for f in files], indent=1))
(ROOT / 'sw.js').write_text(sw, encoding='utf-8')
print(f'sw.js: {len(files)} plików, {size / 1048576:.1f} MB, wersja {ver}')
