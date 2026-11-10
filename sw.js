'use strict';
/* Moje Zoo – działanie bez internetu.
   Pliki gry: najpierw sieć (zawsze najnowsza wersja z GitHub Pages), a bez sieci kopia z pamięci telefonu.
   Czcionka Archivo Narrow z Google Fonts: najpierw pamięć, bo się nie zmienia. */
const CACHE = 'zoo-v14';
const FILES = ['./', './index.html', './game.js', './assets.js', './look.js', './animals.js', './sprites/index.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  // nagrania lektora (audio/manifest.json) też do pamięci, żeby głos działał bez internetu
  const voice = (c) => fetch('./audio/manifest.json').then((r) => r.json()).then((m) => {
    const files = [...new Set(Object.keys(m).filter((k) => k[0] !== '_').map((k) => './audio/' + m[k]))];
    return c.addAll(['./audio/manifest.json', ...files]);
  }).catch(() => {});
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES).then(() => voice(c))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (font) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
      c.put(req, res.clone());
      return res;
    }))));
    return;
  }
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html')))
  );
});
