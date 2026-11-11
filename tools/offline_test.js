// Test działania bez internetu: NODE_PATH=... node tools/offline_test.js [adres]
// Otwiera grę, czeka aż service worker zapisze pliki, odcina sieć, wczytuje ponownie i sprawdza, czy gra rusza z pełną grafiką.
const { chromium } = require('playwright');
const URL0 = process.argv[2] || 'https://jacekmoss.github.io/zoo/';
(async () => {
  const b = await chromium.launch({ channel: 'chromium', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, hasTouch: true });
  const pg = await ctx.newPage();
  await pg.goto(URL0);
  await pg.waitForFunction(() => window.__zoo && window.__zoo.PERF.dt, null, { timeout: 90000 });
  const t0 = Date.now();
  const n = await pg.evaluate(async () => { const reg = await navigator.serviceWorker.ready; for (let i = 0; i < 240; i++) { const ks = await caches.keys(); const k = ks.find((x) => x.startsWith('zoo-')); if (k && reg.active && reg.active.state === 'activated') { const c = await caches.open(k); const n = (await c.keys()).length; if (n > 300) return n; } await new Promise((r) => setTimeout(r, 500)); } const ks = await caches.keys(); return ks.length ? (await (await caches.open(ks[0])).keys()).length : -1; });
  console.log('plików w pamięci:', n, 'po', ((Date.now() - t0) / 1000).toFixed(0), 's');
  await ctx.setOffline(true);
  const failed = []; pg.on('requestfailed', (r) => failed.push(r.url().split('/').slice(-2).join('/')));
  await pg.reload();
  await pg.waitForFunction(() => window.__zoo && window.__zoo.PERF.dt, null, { timeout: 60000 });
  await pg.evaluate(() => {
    const Z = window.__zoo, S = Z.S; Z.openSlot(1); S.scene = 'play'; S.coins = 9999; S.plots.add('1,2');
    for (let i = 0; i < 5; i++) { S.paths.add('7,' + (10 + i)); S.paths.add((5 + i) + ',12'); }
    Object.keys(S.obst).forEach(k => { const [x, y] = k.split(',').map(Number); if (S.plots.has(Math.floor(x / 5) + ',' + Math.floor(y / 5))) delete S.obst[k]; });
    ['zyrafa', 'lody', 'slon', 'krolik'].forEach((t, i) => { Z.build('1,2,' + i, t); S.builds['1,2,' + i].b = 0.01; }); S.starsSeen = 9;
  });
  await pg.waitForTimeout(1500); await pg.evaluate(() => { const S = window.__zoo.S; S.overlay = null; S.panel = null; for (let i = 0; i < 8; i++) window.__zoo.spawnGuest(); });
  await pg.waitForTimeout(8000);
  require('fs').mkdirSync('renders/offline', { recursive: true });
  await pg.screenshot({ path: 'renders/offline/offline.png' });
  console.log('bez sieci: gra działa; nieudane żądania:', JSON.stringify([...new Set(failed)].slice(0, 12)), JSON.stringify(await pg.evaluate(() => window.__zoo.glStats())));
  await pg.evaluate(() => window.__zoo.deleteSlot(1));
  await b.close();
})().catch((e) => { console.error('BŁĄD', e.message); process.exit(1); });
