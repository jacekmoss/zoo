// Test parkingu i śmietników prawdziwymi dotknięciami: NODE_PATH=<node_modules z playwright> node tools/test_park_bin.js [adres]
const { chromium } = require('playwright');
const URL0 = process.argv[2] || 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch({ channel: 'chromium', headless: true });
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 }, hasTouch: true, isMobile: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(URL0);
  await pg.waitForFunction(() => window.__zoo && window.__zoo.PERF && window.__zoo.PERF.dt, null, { timeout: 60000 });
  await pg.evaluate(() => { const Z = window.__zoo, S = Z.S; Z.deleteSlot(5); Z.openSlot(5); S.scene = 'play'; S.coins = 999; });
  await pg.waitForTimeout(800);
  const tap = async (x, y) => { await pg.touchscreen.tap(x, y); await pg.waitForTimeout(350); };
  const st = () => pg.evaluate(() => ({ parks: JSON.stringify(window.__zoo.S.parks), bins: JSON.stringify(window.__zoo.S.bins), coins: window.__zoo.S.coins, tool: window.__zoo.S.tool }));
  let pos = await pg.evaluate(() => { const Z = window.__zoo; const ps = Z.parkSignPos(1); return Z.w2s(ps.x, ps.y - 60); });
  await tap(pos.x, pos.y); console.log('parking kup:', await st());
  pos = await pg.evaluate(() => { const Z = window.__zoo; const ps = Z.parkSignPos(1); return Z.w2s(ps.x, ps.y - 30); });
  await tap(pos.x, pos.y); console.log('parking buduj:', await st());
  // działka przy bramie + ścieżka
  await pg.evaluate(() => { const Z = window.__zoo, S = Z.S, m = Z.MAPS[S.map], py = m.rows - 1, P = Z.PLOT;
    S.plots.add('1,' + py); for (let i = 0; i < P; i++) { S.paths.add((P + 2) + ',' + (py * P + i)); } Z.recompute(); });
  await pg.waitForTimeout(300);
  // przycisk śmietnika (lewy dolny róg)
  await tap(56, 742); console.log('narzędzie:', await st());
  const tk = await pg.evaluate(() => { const Z = window.__zoo, S = Z.S; const k = [...S.paths][2]; const [x, y] = k.split(',').map(Number); const w = Z.g2w(x + 0.5, y + 0.5); return { k, s: Z.w2s(w.x, w.y) }; });
  console.log('ścieżka', tk);
  await tap(tk.s.x, tk.s.y); console.log('po dotknięciu ścieżki:', await st());
  await pg.screenshot({ path: 'renders/test_bin.png' });
  await pg.waitForTimeout(18000); console.log('po 18 s:', await st());
  await pg.evaluate(() => { const Z = window.__zoo; Z.S.tool = null; const w = Z.g2w(8.3, 14.3); Z.cam.s = 2; Z.cam.x = w.x; Z.cam.y = w.y; });
  await pg.waitForTimeout(500); await pg.screenshot({ path: 'renders/test_after.png', clip: { x: 440, y: 200, width: 400, height: 400 } }); console.log(await pg.evaluate(() => { const Z = window.__zoo; return { cam: JSON.stringify(Z.cam), spr: !!(window.ZOO_ANIMALS && 1) }; }));
  errs.length && console.log('BŁĘDY:', errs);
  await b.close();
})();
