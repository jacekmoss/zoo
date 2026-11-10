// Render modeli 3D do klatek gry: node tools/render3d.js <zwierze|wybieg> <nazwa> [json z opcjami] [katalog_wyjścia]
// Wymaga serwera gry (python -m http.server 8765) i Playwrighta (NODE_PATH).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [kind, name, optsJson, outArg] = process.argv.slice(2);
const opts = optsJson ? JSON.parse(optsJson) : {};
const out = outArg || path.join(__dirname, '..', 'models', name, 'render');
fs.mkdirSync(out, { recursive: true });
const save = (file, uri) => fs.writeFileSync(path.join(out, file), Buffer.from(uri.split(',')[1], 'base64'));
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage();
  pg.on('pageerror', (e) => console.error('PAGEERROR', e.message));
  pg.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await pg.goto('http://localhost:8765/tools/render3d.html');
  await pg.waitForFunction(() => window.ready, null, { timeout: 60000 });
  const url = '/models/' + name + '/model.glb';
  if (kind === 'zwierze') {
    const r = await pg.evaluate((o) => window.renderAnimal(o), { url, ...opts });
    r.frames.walk.forEach((u, i) => save(`walk${i}.png`, u));
    r.frames.idle.forEach((u, i) => save(`idle${i}.png`, u));
    fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify({ ...r.meta, opts }, null, 1));
    console.log(JSON.stringify(r.meta));
  } else {
    const r = await pg.evaluate((o) => window.renderEnclosure(o), { url, ...opts });
    save('back.png', r.back); if (r.front) save('front.png', r.front);
    fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify({ ...r.meta, opts }, null, 1));
    console.log(JSON.stringify(r.meta));
  }
  await b.close();
})();
