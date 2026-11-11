// Zrzuty wybranych ekranów: NODE_PATH=... node tools/shot.js <katalog> [szer] [wys] [dpr]
const { chromium } = require('playwright');
const OUT = process.argv[2] || 'renders/shot', W = +process.argv[3] || 1280, H = +process.argv[4] || 800, D = +process.argv[5] || 2;
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ channel: 'chromium', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: D, hasTouch: true, serviceWorkers: 'block' });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && errs.length < 8) errs.push(m.text().slice(0, 200)); });
  await pg.goto('http://localhost:8765/' + (process.argv[6] || ''));
  await pg.waitForFunction(() => window.__zoo && window.__zoo.PERF.dt, null, { timeout: 60000 });
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => {
    const Z = window.__zoo, S = Z.S; Z.openSlot(0); S.open = 4; Z.enterMap(0); S.scene = 'play'; S.coins = 500;
    const types = Object.keys(Z.TYPES); let n = 0;
    ['1,2', '2,2', '1,1'].forEach((pk) => { S.plots.add(pk); const [px, py] = pk.split(',').map(Number); for (let i = 0; i < 5; i++) { S.paths.add((px * 5 + 2) + ',' + (py * 5 + i)); S.paths.add((px * 5 + i) + ',' + (py * 5 + 2)); } });
    Object.keys(S.obst).forEach(k => { const [x, y] = k.split(',').map(Number); if (S.plots.has(Math.floor(x / 5) + ',' + Math.floor(y / 5))) delete S.obst[k]; });
    ['zyrafa', 'lody', 'slon', 'krolik', 'lew', 'karuzela', 'opiekun', 'zebra', 'pingwin', 'wet'].forEach((t, i) => { const pk = [...S.plots][Math.floor(i / 4)]; Z.build(pk + ',' + (i % 4), t); S.builds[pk + ',' + (i % 4)].b = 0.01; S.coins = 500; });
    S.starsSeen = 5;
  });
  await pg.waitForTimeout(1500); await pg.evaluate(() => { const S = window.__zoo.S; S.overlay = null; S.panel = null; S.coins = 137; for (let i = 0; i < 12; i++) window.__zoo.spawnGuest(); });
  await pg.waitForTimeout(9000); await pg.screenshot({ path: OUT + '/play.png' });
  await pg.evaluate(() => { const Z = window.__zoo; const k = '1,1,2'; const p = Z.placeScreen(k); Z.tapAt(p.x, p.y); });
  await pg.waitForTimeout(1200); await pg.screenshot({ path: OUT + '/panel.png' });
  await pg.evaluate(() => { const Z = window.__zoo; const c = Z.cardScreen('frytki'); });
  await pg.waitForTimeout(600); await pg.screenshot({ path: OUT + '/panel_kiosk.png' });
  await pg.evaluate(() => { window.__zoo.S.panel = null; window.__zoo.S.scene = 'album'; }); await pg.waitForTimeout(600); await pg.screenshot({ path: OUT + '/album.png' });
  await pg.evaluate(() => { window.__zoo.saveNow(); window.__zoo.S.scene = 'slots'; }); await pg.waitForTimeout(600); await pg.screenshot({ path: OUT + '/slots.png' });
  console.log('errors', JSON.stringify(errs), JSON.stringify(await pg.evaluate(() => window.__zoo.glStats())));
  await b.close();
})();
