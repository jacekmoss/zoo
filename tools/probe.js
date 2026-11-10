// Test płynności i zrzuty ekranu: NODE_PATH=<node_modules z playwright> node tools/probe.js [katalog zrzutów] [adres]
const { chromium } = require('playwright');
const OUT = process.argv[2] || 'renders/probe', URL0 = process.argv[3] || 'http://localhost:8765/';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ channel: 'chromium', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, hasTouch: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && errs.length < 8) errs.push(m.text().slice(0,200)); });
  await pg.goto(URL0);
  await pg.waitForFunction(() => window.__zoo && window.__zoo.PERF.dt, null, { timeout: 60000 });
  await pg.waitForTimeout(2500);
  await pg.screenshot({ path: OUT + '/01_title.png' });
  const z = () => pg.evaluate(() => 0);
  // slots
  const p = await pg.evaluate(() => window.__zoo.playScreen());
  await pg.mouse.click(p.x, p.y); await pg.waitForTimeout(1200);
  await pg.screenshot({ path: OUT + '/02_slots.png' });
  const fill = async (mapI, frac) => pg.evaluate(([mapI, frac]) => {
    const Z = window.__zoo, S = Z.S;
    if (S.slot == null) Z.openSlot(0);
    S.open = 4; Z.enterMap(mapI); S.scene = 'play'; S.coins = 99999;
    const m = Z.MAPS[mapI]; const types = Object.keys(Z.TYPES);
    let n = 0;
    for (let py = 0; py < m.rows; py++) for (let px = 0; px < m.cols; px++) {
      if (Math.random() > frac && !(px === 1 && py === m.rows - 1)) continue;
      S.plots.add(px + ',' + py);
      for (let i = 0; i < 5; i++) { S.paths.add((px * 5 + 2) + ',' + (py * 5 + i)); S.paths.add((px * 5 + i) + ',' + (py * 5 + 2)); }
    }
    Object.keys(S.obst).forEach(k => { const [x, y] = k.split(',').map(Number); if (S.plots.has(Math.floor(x / 5) + ',' + Math.floor(y / 5))) delete S.obst[k]; });
    S.plots.forEach(pk => { for (let q = 0; q < 4; q++) { const t = types[n++ % types.length]; Z.build(pk + ',' + q, t); const nb = S.builds[pk + ',' + q]; if (nb) nb.b = 0.01; S.found[t] = 1; } }); S.starsSeen = 99;
    Z.enterMap ; Z.recompute();
    
    return { types: types.length, builds: Object.keys(S.builds).length, max: Z.maxGuests && Z.maxGuests() };
  }, [mapI, frac]);
  const perf = async (label, ms = 8000) => {
    const r = await pg.evaluate((ms) => new Promise(res => {
      const d = []; let last = performance.now(), t0 = last;
      const f = (t) => { d.push(t - last); last = t; if (t - t0 < ms) requestAnimationFrame(f); else {
        d.shift(); d.sort((a, b) => a - b); const avg = d.reduce((a, b) => a + b, 0) / d.length;
        const Z = window.__zoo; res({ frames: d.length, fps: +(1000 / avg).toFixed(1), p50: +d[d.length >> 1].toFixed(1), p95: +d[Math.floor(d.length * .95)].toFixed(1), p99: +d[Math.floor(d.length * .99)].toFixed(1), max: +d[d.length - 1].toFixed(1), over33: d.filter(x => x > 33).length, drawWorld: +Z.PERF.w.toFixed(2), drawUI: +Z.PERF.u.toFixed(2), gl: Z.glStats ? Z.glStats() : null, guests: Z.S.guests.length, canvas: document.querySelector('canvas').width + 'x' + document.querySelector('canvas').height });
      } };
      requestAnimationFrame(f);
    }), ms);
    console.log(label, JSON.stringify(r));
  };
  await perf('title/slots');
  console.log('fill0', JSON.stringify(await fill(0, 0.34)));
  await pg.waitForTimeout(1500); await pg.evaluate(() => { const S = window.__zoo.S; S.overlay = null; S.panel = null; S.coins = 99999; });
  await pg.waitForTimeout(600);
  await pg.screenshot({ path: OUT + '/03_small_zoo.png' });
  console.log('fill0full', JSON.stringify(await fill(0, 1)));
  // let guests accumulate
  await pg.evaluate(() => { const Z = window.__zoo; for (let i = 0; i < 40; i++) try { Z.spawnGuest(); } catch (e) {} });
  await pg.waitForTimeout(1000); await pg.evaluate(() => { const S = window.__zoo.S; S.overlay = null; S.panel = null; });
  await pg.waitForTimeout(5000);
  await pg.screenshot({ path: OUT + '/04_full_map0.png' });
  await perf('map0 full, default zoom');
  // zoom in on an enclosure
  await pg.mouse.move(640, 400); for (let i = 0; i < 6; i++) { await pg.mouse.wheel(0, -300); await pg.waitForTimeout(80); }
  await pg.waitForTimeout(800); await pg.screenshot({ path: OUT + '/05_zoom_in.png' });
  await perf('map0 zoom in', 5000);
  for (let i = 0; i < 14; i++) { await pg.mouse.wheel(0, 300); await pg.waitForTimeout(60); }
  await pg.waitForTimeout(800); await pg.screenshot({ path: OUT + '/06_zoom_out.png' });
  await perf('map0 zoom out', 5000);
  // pan while measuring
  const panPerf = (async () => { await pg.mouse.move(700, 300); await pg.mouse.down(); for (let i = 0; i < 120; i++) { await pg.mouse.move(700 + Math.sin(i / 10) * 250, 300 + Math.cos(i / 13) * 120); await pg.waitForTimeout(30); } await pg.mouse.up(); })();
  await perf('map0 panning', 4000); await panPerf;
  // biggest map
  console.log('fill3', JSON.stringify(await fill(3, 1)));
  await pg.evaluate(() => { const Z = window.__zoo; for (let i = 0; i < 80; i++) try { Z.spawnGuest(); } catch (e) {} });
  await pg.waitForTimeout(1000); await pg.evaluate(() => { const S = window.__zoo.S; S.overlay = null; S.panel = null; });
  await pg.waitForTimeout(4000);
  for (let i = 0; i < 14; i++) { await pg.mouse.wheel(0, 300); await pg.waitForTimeout(60); }
  await pg.waitForTimeout(800); await pg.screenshot({ path: OUT + '/07_map3_full.png' });
  await perf('map3 full zoom out');
  // night + rain
  await pg.evaluate(() => { const Z = window.__zoo; Z.S.rain = 40; Z.S.clock = 0.9 * 360; });
  await pg.waitForTimeout(1500); await pg.screenshot({ path: OUT + '/08_night_rain.png' });
  await perf('map3 night+rain', 5000);
  // CPU throttle 4x ≈ budget tablet
  const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await perf('map3 night+rain CPUx4', 6000);
  await pg.evaluate(() => { const Z = window.__zoo; Z.S.rain = 0; Z.S.clock = 0.3 * 360; });
  await perf('map3 day CPUx4', 6000);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  // panel + album
  await pg.evaluate(() => { const Z = window.__zoo; Z.enterMap(0); Z.S.scene = 'play'; });
  await pg.waitForTimeout(500);
  await pg.evaluate(() => { const Z = window.__zoo; Z.S.overlay = null; const k = Object.keys(Z.S.builds)[0]; delete Z.S.builds[k]; delete Z.RT[k]; Z.recompute(); const p = Z.placeScreen(k); Z.tapAt(p.x, p.y); });
  await pg.waitForTimeout(900); await pg.screenshot({ path: OUT + '/09_panel.png' });
  await pg.evaluate(() => { window.__zoo.S.panel = null; window.__zoo.S.scene = 'album'; });
  await pg.waitForTimeout(700); await pg.screenshot({ path: OUT + '/10_album.png' });
  await pg.evaluate(() => { window.__zoo.S.scene = 'maps'; });
  await pg.waitForTimeout(700); await pg.screenshot({ path: OUT + '/11_maps.png' });
  const gpu = await pg.evaluate(() => { const c = document.createElement('canvas').getContext('webgl'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'none'; });
  console.log('gpu', gpu, 'errors', JSON.stringify(errs.slice(0, 5)));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
