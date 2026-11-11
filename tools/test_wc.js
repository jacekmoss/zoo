// Test toalety: goście dostają potrzebę, spada zadowolenie, po zbudowaniu toalety idą do niej.
// NODE_PATH=<node_modules z playwright> node tools/test_wc.js [adres]
const { chromium } = require('playwright');
const URL0 = process.argv[2] || 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch({ channel: 'chromium', headless: true });
  const pg = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(URL0);
  await pg.waitForFunction(() => window.__zoo && window.__zoo.PERF.dt, null, { timeout: 60000 });
  await pg.evaluate(() => { const Z = window.__zoo, S = Z.S; Z.deleteSlot(5); Z.openSlot(5); S.scene = 'play'; S.coins = 200; S.starsSeen = 1; S.found.krolik = 1; S.found.lody = 1;
    const P = Z.PLOT, py = Z.MAPS[S.map].rows - 1; S.plots.add('1,' + py);
    Object.keys(S.obst).forEach((k) => { const [x, y] = k.split(',').map(Number); if (x >= P && x < 2 * P && y >= py * P) delete S.obst[k]; });
    for (let i = 0; i < P; i++) { S.paths.add((P + 2) + ',' + (py * P + i)); S.paths.add((P + i) + ',' + (py * P + 2)); }
    Z.build('1,' + py + ',2', 'krolik'); Z.build('1,' + py + ',3', 'lody'); Object.values(S.builds).forEach((x) => { x.b = 0.01; }); Z.recompute(); setInterval(() => { if (S.guests.length < 8) Z.spawnGuest(); Object.values(S.builds).forEach((x) => { x.h = 0; x.hs = 0; if (x.st != null) x.st = 4; }); S.overlay = null; S.wish = null; }, 500); });
  const st = () => pg.evaluate(() => { const Z = window.__zoo, S = Z.S; return { guests: S.guests.length, wc: Z.wcWaiting(), pen: +Z.wcPenalty().toFixed(1), rate: Math.round(S.rate), ok: Z.wcOk(), earnWc: S.earn.toaleta || 0 }; });
  for (let i = 0; i < 6; i++) { await pg.waitForTimeout(8000); console.log('bez toalety', (i + 1) * 8 + ' s', await st()); }
  await pg.screenshot({ path: 'renders/test_wc_need.png' });
  await pg.evaluate(() => { const Z = window.__zoo, S = Z.S, k = '1,' + (Z.MAPS[S.map].rows - 1) + ',0'; Z.build(k, 'toaleta'); S.builds[k].b = 0.01; });
  for (let i = 0; i < 4; i++) { await pg.waitForTimeout(8000); console.log('z toaletą', (i + 1) * 8 + ' s', await st()); }
  await pg.screenshot({ path: 'renders/test_wc_built.png' });
  await pg.evaluate(() => { const Z = window.__zoo, S = Z.S; S.panel = Z.freePlaces()[0]; });
  await pg.waitForTimeout(300);
  const tabs = await pg.evaluate(() => 0);
  await pg.mouse.click(65, 615); await pg.waitForTimeout(700);
  await pg.screenshot({ path: 'renders/test_wc_panel.png' });
  console.log(errs);
  await b.close();
})();
