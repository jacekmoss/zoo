'use strict';
/* Moje Zoo – oprawa graficzna rysowana kodem (Canvas 2D).
   Wszystko, co się nie rusza (faktury terenu, wybiegi, drzewa, bruk pod kioskami), jest renderowane RAZ do osobnych płócien,
   a w każdej klatce tylko kopiowane. Światło pada z lewej góry: ściany zwrócone w lewo są jaśniejsze, w prawo ciemniejsze,
   cienie padają w prawo w dół. Współrzędne lokalne wybiegu: środek miejsca 2×2 to (0,0), romb ma połowy 112 × 56. */
window.ZOO_LOOK = (() => {
  const R = 2;                                   // gęstość renderowania płócien (piksele na jednostkę świata)
  const rng = (seed) => () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const canvasFor = (x, y, w, h, res = R) => {
    const c = document.createElement('canvas'); c.width = Math.ceil(w * res); c.height = Math.ceil(h * res);
    const g = c.getContext('2d'); g.scale(res, res); g.translate(-x, -y);
    return { c, g, x, y, w, h };
  };
  const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const shade = (h, k) => {                      // k>0 rozjaśnia, k<0 przyciemnia
    const [r, g, b] = hexToRgb(h), f = (v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  };
  const rgba = (h, a) => { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; };

  // ---------- faktury (wzory powtarzalne, rysowane w podwójnej rozdzielczości) ----------
  function pattern(ctx, w, h, draw, res = 2) {
    const c = document.createElement('canvas'); c.width = w * res; c.height = h * res;
    const g = c.getContext('2d'); g.scale(res, res);
    // rysujemy z zawinięciem: każdy element także przesunięty o szerokość/wysokość kafla
    const wrap = (fn) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { g.save(); g.translate(dx, dy); fn(g); g.restore(); } };
    draw(g, wrap, w, h);
    const p = ctx.createPattern(c, 'repeat');
    if (p.setTransform && window.DOMMatrix) p.setTransform(new DOMMatrix([1 / res, 0, 0, 1 / res, 0, 0]));
    return p;
  }
  function grassTexture(g, wrap, w, h, base, seed, opt = {}) {
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const blobs = [];
    for (let i = 0; i < 70; i++) blobs.push([r() * w, r() * h, 6 + r() * 16, r() < 0.5 ? shade(base, 0.08 + r() * 0.06) : shade(base, -0.06 - r() * 0.06)]);
    wrap((q) => blobs.forEach(([x, y, s, col]) => { q.fillStyle = col; q.globalAlpha = 0.35; q.beginPath(); q.ellipse(x, y, s, s * 0.5, 0, 0, 7); q.fill(); q.globalAlpha = 1; }));
    const blades = [];
    for (let i = 0; i < (opt.blades || 260); i++) blades.push([r() * w, r() * h, 2 + r() * 3.5, (r() - 0.5) * 2, r() < 0.55]);
    wrap((q) => blades.forEach(([x, y, l, lean, dark]) => {
      q.strokeStyle = dark ? shade(base, -0.16) : shade(base, opt.soft ? 0.08 : 0.16); q.lineWidth = 0.8;
      q.beginPath(); q.moveTo(x, y); q.lineTo(x + lean, y - l); q.stroke();
    }));
    if (opt.flowers) {
      const fl = [];
      for (let i = 0; i < opt.flowers; i++) fl.push([r() * w, r() * h, ['#f1ecdf', '#e8d27a', '#c9a7d4', '#e9b7a4'][Math.floor(r() * 4)]]);
      wrap((q) => fl.forEach(([x, y, col]) => { q.fillStyle = col; q.beginPath(); q.arc(x, y, 1.1, 0, 7); q.fill(); }));
    }
    if (opt.stripes) {                            // koszony trawnik: pasy wzdłuż osi izometrycznej
      g.globalAlpha = 0.06; g.fillStyle = '#ffffff';
      for (let k = -h * 2; k < w + h * 2; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 16, 0); g.lineTo(k + 16 - h * 2, h); g.lineTo(k - h * 2, h); g.closePath(); g.fill(); }
      g.globalAlpha = 1;
    }
  }
  function gravelTexture(g, wrap, w, h, base, seed) {
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const st = [];
    for (let i = 0; i < 420; i++) st.push([r() * w, r() * h, 0.7 + r() * 1.5, r()]);
    wrap((q) => st.forEach(([x, y, s, t]) => {
      q.fillStyle = t < 0.35 ? shade(base, -0.16) : t < 0.7 ? shade(base, -0.07) : shade(base, 0.12);
      q.beginPath(); q.ellipse(x, y, s, s * 0.65, 0, 0, 7); q.fill();
      if (t > 0.8) { q.fillStyle = 'rgba(255,255,255,.35)'; q.beginPath(); q.arc(x - s * 0.3, y - s * 0.25, s * 0.35, 0, 7); q.fill(); }
    }));
  }
  function asphaltTexture(g, wrap, w, h, seed) {
    const r = rng(seed);
    g.fillStyle = '#62615c'; g.fillRect(0, 0, w, h);
    const st = []; for (let i = 0; i < 500; i++) st.push([r() * w, r() * h, r()]);
    wrap((q) => st.forEach(([x, y, t]) => { q.fillStyle = t < 0.5 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.07)'; q.fillRect(x, y, 1, 1); }));
  }
  function makePatterns(ctx) {
    return {
      wild: pattern(ctx, 256, 128, (g, wrap, w, h) => grassTexture(g, wrap, w, h, '#5a7a3f', 11, { blades: 200, soft: true })),
      own: pattern(ctx, 256, 128, (g, wrap, w, h) => grassTexture(g, wrap, w, h, '#77984f', 23, { blades: 240, stripes: true })),
      free: pattern(ctx, 128, 64, (g, wrap, w, h) => grassTexture(g, wrap, w, h, '#86a65d', 37, { blades: 90 })),
      gravel: pattern(ctx, 128, 64, (g, wrap, w, h) => gravelTexture(g, wrap, w, h, '#cdbf9f', 5)),
      asphalt: pattern(ctx, 128, 64, (g, wrap, w, h) => asphaltTexture(g, wrap, w, h, 9)),
      piach: pattern(ctx, 128, 64, (g, wrap, w, h) => gravelTexture(g, wrap, w, h, '#dcc791', 15)),
      bloto: pattern(ctx, 128, 64, (g, wrap, w, h) => grassTexture(g, wrap, w, h, '#6d6f3f', 41, { blades: 120, soft: true })),
      woda: pattern(ctx, 128, 64, (g, wrap, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#5f9db4'); gr.addColorStop(1, '#3f7a94'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }),
    };
  }
  // Duże plamy jasności na trawie (renderowane w niskiej rozdzielczości, rozmyte z natury), żeby łąka nie była jednolita.
  function makeMottle(seed) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 180;
    const g = c.getContext('2d'), r = rng(seed);
    for (let i = 0; i < 90; i++) {
      const x = r() * 320, y = r() * 180, s = 10 + r() * 34, light = r() < 0.5;
      const gr = g.createRadialGradient(x, y, 0, x, y, s);
      gr.addColorStop(0, light ? 'rgba(190,210,120,.55)' : 'rgba(25,45,20,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2);
    }
    return c;
  }

  // ---------- pomocnicze kształty ----------
  const T = [0, -56], RR = [112, 0], B = [0, 56], L = [-112, 0];
  function diamondPath(g, inset = 0) {
    const k = 1 - inset;
    g.beginPath(); g.moveTo(0, -56 * k); g.lineTo(112 * k, 0); g.lineTo(0, 56 * k); g.lineTo(-112 * k, 0); g.closePath();
  }
  const inside = (x, y, m = 1) => Math.abs(x) / (112 * m) + Math.abs(y) / (56 * m) <= 1;
  function blob(g, x, y, rx, ry, light, dark) {
    const gr = g.createRadialGradient(x - rx * 0.35, y - ry * 0.45, 1, x, y, Math.max(rx, ry) * 1.1);
    gr.addColorStop(0, light); gr.addColorStop(1, dark);
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill();
  }
  function bush(g, x, y, s, base, r) {
    g.fillStyle = 'rgba(30,40,20,.25)'; g.beginPath(); g.ellipse(x + 6 * s, y + 2, 20 * s, 6 * s, 0, 0, 7); g.fill();
    const parts = [[-10, -8, 12], [9, -9, 12], [0, -16, 13], [-3, -6, 11], [6, -4, 10]];
    parts.forEach(([dx, dy, rr2]) => blob(g, x + dx * s, y + dy * s, rr2 * s * (0.9 + r() * 0.2), rr2 * s * 0.85, shade(base, 0.28), shade(base, -0.28)));
  }
  function rock(g, x, y, s, base) {
    g.fillStyle = 'rgba(30,35,25,.28)'; g.beginPath(); g.ellipse(x + 5 * s, y + 1, 17 * s, 5 * s, 0, 0, 7); g.fill();
    const P = (a, b) => [x + a * s, y + b * s];
    const poly = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo : g.moveTo).call(g, p[0], p[1])); g.closePath(); g.fill(); };
    poly([P(-16, 0), P(-12, -12), P(-2, -19), P(2, -8), P(-4, 2)], shade(base, 0.22));        // ściana od światła
    poly([P(-2, -19), P(10, -16), P(16, -6), P(14, 1), P(-4, 2), P(2, -8)], shade(base, -0.18)); // ściana w cieniu
    poly([P(-12, -12), P(-2, -19), P(10, -16), P(2, -8)], shade(base, 0.38));                   // wierzch
  }
  function tuft(g, x, y, s, col) {
    g.strokeStyle = col; g.lineWidth = 1.1; g.lineCap = 'round';
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(x + i * 0.8 * s, y); g.quadraticCurveTo(x + i * 1.6 * s, y - 5 * s, x + i * 2.6 * s, y - (7 - Math.abs(i)) * s); g.stroke(); }
  }

  // ---------- ogrodzenia ----------
  function fenceEdge(g, P, Q, type, back) {
    const len = Math.hypot(Q[0] - P[0], Q[1] - P[1]), n = Math.max(2, Math.round(len / 22));
    const at = (k) => [P[0] + (Q[0] - P[0]) * k, P[1] + (Q[1] - P[1]) * k];
    const facesLight = (Q[1] - P[1]) * (Q[0] - P[0]) > 0 ? !back : back;   // krawędź „\” od strony widza dostaje światło
    if (type === 'stone') {
      const h = 11;
      g.fillStyle = facesLight ? '#a39c8b' : '#857f70';
      g.beginPath(); g.moveTo(P[0], P[1]); g.lineTo(Q[0], Q[1]); g.lineTo(Q[0], Q[1] - h); g.lineTo(P[0], P[1] - h); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(40,36,28,.35)'; g.lineWidth = 0.8;
      for (let i = 0; i <= n * 2; i++) { const a = at(i / (n * 2)), off = i % 2 ? 0 : 5.5; g.beginPath(); g.moveTo(a[0], a[1] - off); g.lineTo(a[0], a[1] - off - 5.5); g.stroke(); }
      g.beginPath(); g.moveTo(P[0], P[1] - 5.5); g.lineTo(Q[0], Q[1] - 5.5); g.stroke();
      g.fillStyle = '#c4bdab'; g.beginPath(); g.moveTo(P[0], P[1] - h); g.lineTo(Q[0], Q[1] - h); g.lineTo(Q[0], Q[1] - h - 3); g.lineTo(P[0], P[1] - h - 3); g.closePath(); g.fill();
      return;
    }
    if (type === 'glass') {
      const h = 16;
      g.fillStyle = 'rgba(200,228,238,.32)';
      g.beginPath(); g.moveTo(P[0], P[1]); g.lineTo(Q[0], Q[1]); g.lineTo(Q[0], Q[1] - h); g.lineTo(P[0], P[1] - h); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 0.8;
      for (let i = 0; i < n; i++) { const a = at((i + 0.3) / n), b = at((i + 0.55) / n); g.beginPath(); g.moveTo(a[0], a[1] - h + 3); g.lineTo(b[0], b[1] - 3); g.stroke(); }
      for (let i = 0; i <= n; i++) { const a = at(i / n); g.fillStyle = '#e4e9ea'; g.fillRect(a[0] - 1.2, a[1] - h - 1, 2.4, h + 1); g.fillStyle = '#9aa6aa'; g.fillRect(a[0], a[1] - h - 1, 1.2, h + 1); }
      g.strokeStyle = '#f2f5f5'; g.lineWidth = 2; g.beginPath(); g.moveTo(P[0], P[1] - h); g.lineTo(Q[0], Q[1] - h); g.stroke();
      return;
    }
    // drewno (domyślne)
    const h = 15;
    const rail = (y, w) => {
      g.strokeStyle = facesLight ? '#93704a' : '#7a5b3b'; g.lineWidth = w;
      g.beginPath(); g.moveTo(P[0], P[1] - y); g.lineTo(Q[0], Q[1] - y); g.stroke();
      g.strokeStyle = 'rgba(232,205,160,.45)'; g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(P[0], P[1] - y - w / 2 + 0.3); g.lineTo(Q[0], Q[1] - y - w / 2 + 0.3); g.stroke();
    };
    rail(5.5, 2.4); rail(11.5, 2.4);
    for (let i = 0; i <= n; i++) {
      const a = at(i / n);
      g.fillStyle = '#9b774e'; g.fillRect(a[0] - 2, a[1] - h, 2, h + 1);
      g.fillStyle = '#6e5133'; g.fillRect(a[0], a[1] - h, 2, h + 1);
      g.fillStyle = '#c29d6c'; g.beginPath(); g.ellipse(a[0], a[1] - h, 2, 1, 0, 0, 7); g.fill();
    }
  }

  // ---------- wybiegi ----------
  const BIOME = {
    laka: { base: '#86a457', fence: 'wood' },
    sawanna: { base: '#c4ac6c', fence: 'wood' },
    pustynia: { base: '#d6bd87', fence: 'wood' },
    bambusy: { base: '#6c8c47', fence: 'wood' },
    lod: { base: '#e3eaec', fence: 'glass' },
    staw: { base: '#7c9d57', fence: 'glass' },
    las: { base: '#5f6c3d', fence: 'stone' },
  };
  // Woda w wybiegu (w lokalnych współrzędnych): zwierzęta wodne wchodzą do niej i się zanurzają.
  const POOL = { lod: { x: -24, y: 4, rx: 50, ry: 21 }, staw: { x: -8, y: 6, rx: 64, ry: 27 } };
  function water(g, p, deep, light) {
    g.save();
    g.fillStyle = 'rgba(40,40,30,.35)'; g.beginPath(); g.ellipse(p.x, p.y + 2, p.rx + 3, p.ry + 2.5, 0, 0, 7); g.fill();
    const gr = g.createLinearGradient(p.x - p.rx, p.y - p.ry, p.x + p.rx, p.y + p.ry);
    gr.addColorStop(0, light); gr.addColorStop(1, deep);
    g.fillStyle = gr; g.beginPath(); g.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, 7); g.fill();
    g.clip();
    // odbicie nieba i ciemniejszy brzeg od strony światła (brzeg rzuca cień na wodę)
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(p.x + p.rx * 0.25, p.y + p.ry * 0.3, p.rx * 0.55, p.ry * 0.35, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,30,40,.25)'; g.lineWidth = 6; g.beginPath(); g.ellipse(p.x + 2, p.y + 3, p.rx, p.ry, 0, Math.PI, Math.PI * 2); g.stroke();
    g.restore();
  }
  function bamboo(g, x, y, r, n = 6) {
    for (let i = 0; i < n; i++) {
      const bx = x + (r() - 0.5) * 26, by = y + (r() - 0.5) * 8, hgt = 52 + r() * 36, lean = (r() - 0.5) * 6;
      g.strokeStyle = i % 2 ? '#7f9c4a' : '#94b158'; g.lineWidth = 3.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + lean, by - hgt); g.stroke();
      g.strokeStyle = 'rgba(40,60,20,.6)'; g.lineWidth = 1;
      for (let k = 12; k < hgt; k += 13) { const t = k / hgt; g.beginPath(); g.moveTo(bx + lean * t - 1.8, by - k); g.lineTo(bx + lean * t + 1.8, by - k); g.stroke(); }
      for (let k = 0; k < 4; k++) {
        const t = 0.45 + r() * 0.55, lx = bx + lean * t, ly = by - hgt * t, dir = r() < 0.5 ? -1 : 1;
        g.fillStyle = r() < 0.5 ? '#6f9a3e' : '#9cbf5e';
        g.beginPath(); g.moveTo(lx, ly); g.quadraticCurveTo(lx + dir * 9, ly - 6, lx + dir * 17, ly + 1); g.quadraticCurveTo(lx + dir * 8, ly + 1, lx, ly); g.fill();
      }
    }
  }
  function smallAcacia(g, x, y) {
    g.fillStyle = 'rgba(30,30,20,.25)'; g.beginPath(); g.ellipse(x + 10, y + 1, 26, 6, 0, 0, 7); g.fill();
    g.strokeStyle = '#6b5236'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - 1, y - 22); g.lineTo(x - 10, y - 34); g.moveTo(x - 1, y - 22); g.lineTo(x + 9, y - 36); g.stroke();
    blob(g, x, y - 40, 30, 8, '#94a85a', '#5b6f33');
    blob(g, x - 4, y - 45, 22, 6, '#a9bb6c', '#6c8040');
  }
  function smallPine(g, x, y, s = 1) {
    g.fillStyle = 'rgba(25,30,20,.28)'; g.beginPath(); g.ellipse(x + 8 * s, y + 1, 16 * s, 5 * s, 0, 0, 7); g.fill();
    g.fillStyle = '#5b4330'; g.fillRect(x - 2 * s, y - 10 * s, 4 * s, 10 * s);
    for (let i = 0; i < 4; i++) {
      const by = y - 8 * s - i * 13 * s, w = (22 - i * 4.5) * s, top = by - 20 * s;
      g.fillStyle = shade('#3c6844', 0.12 - i * 0.02); g.beginPath(); g.moveTo(x - w, by); g.lineTo(x, top); g.lineTo(x, by + 3 * s); g.closePath(); g.fill();
      g.fillStyle = shade('#2c5236', -0.05); g.beginPath(); g.moveTo(x + w, by); g.lineTo(x, top); g.lineTo(x, by + 3 * s); g.closePath(); g.fill();
    }
  }
  function log(g, x, y) {
    g.fillStyle = 'rgba(25,25,15,.3)'; g.beginPath(); g.ellipse(x + 4, y + 3, 30, 6, 0, 0, 7); g.fill();
    g.save(); g.translate(x, y); g.rotate(-0.42);
    const gr = g.createLinearGradient(0, -7, 0, 7); gr.addColorStop(0, '#8e6a45'); gr.addColorStop(1, '#4e3826');
    g.fillStyle = gr; g.fillRect(-28, -7, 52, 14);
    g.fillStyle = '#c7a477'; g.beginPath(); g.ellipse(24, 0, 4, 7, 0, 0, 7); g.fill();
    g.strokeStyle = '#8e6a45'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(24, 0, 2, 4, 0, 0, 7); g.stroke();
    g.restore();
  }
  function fern(g, x, y, col) {
    g.strokeStyle = col; g.lineWidth = 1.2; g.lineCap = 'round';
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.38; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 10, x + Math.cos(a) * 15, y + Math.sin(a) * 9 + 4); g.stroke(); }
  }
  function iceBlock(g, x, y, s) {
    const P = (a, b) => [x + a * s, y + b * s];
    const poly = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo : g.moveTo).call(g, p[0], p[1])); g.closePath(); g.fill(); };
    poly([P(-14, 0), P(0, 7), P(0, -9), P(-14, -16)], '#dbeef5');
    poly([P(0, 7), P(14, 0), P(14, -16), P(0, -9)], '#a7cddd');
    poly([P(-14, -16), P(0, -9), P(14, -16), P(0, -23)], '#f7fcfd');
  }
  function makeEnclosure(biome) {
    const B0 = BIOME[biome] || BIOME.laka, r = rng(biome.length * 977 + biome.charCodeAt(0));
    const back = canvasFor(-130, -150, 260, 240), front = canvasFor(-130, -150, 260, 240);
    let g = back.g;
    // podniesiona grządka: ścianki z przodu
    g.fillStyle = shade(B0.base, -0.42); g.beginPath(); g.moveTo(-112, 0); g.lineTo(0, 56); g.lineTo(0, 61); g.lineTo(-112, 5); g.closePath(); g.fill();
    g.fillStyle = shade(B0.base, -0.55); g.beginPath(); g.moveTo(0, 56); g.lineTo(112, 0); g.lineTo(112, 5); g.lineTo(0, 61); g.closePath(); g.fill();
    // podłoże z delikatnym światłem z lewej góry
    g.save(); diamondPath(g); g.clip();
    const gr = g.createLinearGradient(-100, -50, 100, 50); gr.addColorStop(0, shade(B0.base, 0.1)); gr.addColorStop(1, shade(B0.base, -0.1));
    g.fillStyle = gr; g.fillRect(-120, -60, 240, 120);
    for (let i = 0; i < 700; i++) {
      const x = (r() - 0.5) * 224, y = (r() - 0.5) * 112; if (!inside(x, y)) continue;
      g.fillStyle = r() < 0.5 ? shade(B0.base, 0.14) : shade(B0.base, -0.14); g.globalAlpha = 0.6;
      g.beginPath(); g.ellipse(x, y, 0.8 + r() * 1.8, 0.5 + r() * 0.9, 0, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
    // cechy biomu leżące na ziemi
    if (biome === 'laka') {
      for (let i = 0; i < 70; i++) { const x = (r() - 0.5) * 210, y = (r() - 0.5) * 100; if (inside(x, y, 0.92)) { g.fillStyle = ['#f3efe2', '#ecd47b', '#c9a9d6'][i % 3]; g.beginPath(); g.arc(x, y, 1.3, 0, 7); g.fill(); } }
      for (let i = 0; i < 26; i++) { const x = (r() - 0.5) * 200, y = (r() - 0.5) * 96; if (inside(x, y, 0.9)) tuft(g, x, y, 0.8, shade(B0.base, -0.25)); }
    } else if (biome === 'sawanna') {
      g.fillStyle = 'rgba(160,110,70,.35)'; g.beginPath(); g.ellipse(22, 12, 46, 16, 0, 0, 7); g.fill();
      for (let i = 0; i < 60; i++) { const x = (r() - 0.5) * 210, y = (r() - 0.5) * 100; if (inside(x, y, 0.9)) tuft(g, x, y, 0.9, i % 2 ? '#a58d4c' : '#d8c387'); }
    } else if (biome === 'pustynia') {
      g.strokeStyle = 'rgba(150,115,70,.35)'; g.lineWidth = 1.2;
      for (let i = 0; i < 12; i++) { const y = -40 + i * 8; g.beginPath(); for (let x = -110; x <= 110; x += 10) g.lineTo(x, y + Math.sin(x / 16 + i) * 3 + x * 0.12); g.stroke(); }
      for (let i = 0; i < 10; i++) { const x = (r() - 0.5) * 200, y = (r() - 0.5) * 90; if (inside(x, y, 0.85)) tuft(g, x, y, 0.8, '#8f8a55'); }
    } else if (biome === 'lod') {
      for (let i = 0; i < 9; i++) { const x = (r() - 0.5) * 190, y = (r() - 0.5) * 90; if (inside(x, y, 0.85)) { g.fillStyle = 'rgba(160,190,205,.35)'; g.beginPath(); g.ellipse(x + 3, y + 2, 16, 5, 0, 0, 7); g.fill(); g.fillStyle = '#f6fafb'; g.beginPath(); g.ellipse(x, y, 14, 5, 0, 0, 7); g.fill(); } }
      g.strokeStyle = '#f7fbfc'; g.lineWidth = 5; g.beginPath(); g.ellipse(POOL.lod.x, POOL.lod.y, POOL.lod.rx + 3, POOL.lod.ry + 2, 0, 0, 7); g.stroke();
      water(g, POOL.lod, '#2f6a86', '#7fb7cf');
    } else if (biome === 'staw') {
      const p = POOL.staw;
      g.fillStyle = '#8b7a52'; g.beginPath(); g.ellipse(p.x, p.y, p.rx + 6, p.ry + 4, 0, 0, 7); g.fill();
      water(g, p, '#35624f', '#7da890');
      for (let i = 0; i < 6; i++) { const a = r() * 7, x = p.x + Math.cos(a) * p.rx * 0.6, y = p.y + Math.sin(a) * p.ry * 0.55; g.fillStyle = '#5d8a3e'; g.beginPath(); g.ellipse(x, y, 6, 2.6, 0, 0.3, 6.0); g.lineTo(x, y); g.fill(); }
    } else if (biome === 'bambusy') {
      for (let i = 0; i < 40; i++) { const x = (r() - 0.5) * 200, y = (r() - 0.5) * 96; if (inside(x, y, 0.9)) { g.fillStyle = r() < 0.5 ? '#9cb35d' : '#5e7c3a'; g.beginPath(); g.ellipse(x, y, 3, 1.2, r() * 3, 0, 7); g.fill(); } }
    } else if (biome === 'las') {
      for (let i = 0; i < 120; i++) { const x = (r() - 0.5) * 210, y = (r() - 0.5) * 100; if (inside(x, y, 0.95)) { g.fillStyle = ['#a8673a', '#c4924a', '#7c5a32', '#8f8a4a'][i % 4]; g.beginPath(); g.ellipse(x, y, 2.2, 1.1, r() * 3, 0, 7); g.fill(); } }
    }
    // cień od tylnych krawędzi (ambient occlusion)
    const ao = (P, Q, nx, ny) => {
      const gg = g.createLinearGradient((P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2, (P[0] + Q[0]) / 2 + nx * 18, (P[1] + Q[1]) / 2 + ny * 18);
      gg.addColorStop(0, 'rgba(20,25,10,.28)'); gg.addColorStop(1, 'rgba(20,25,10,0)');
      g.fillStyle = gg; g.beginPath(); g.moveTo(P[0], P[1]); g.lineTo(Q[0], Q[1]); g.lineTo(Q[0] + nx * 18, Q[1] + ny * 18); g.lineTo(P[0] + nx * 18, P[1] + ny * 18); g.closePath(); g.fill();
    };
    ao(L, T, 0.45, 0.9); ao(T, RR, -0.45, 0.9);
    g.restore();
    // rzeczy stojące z tyłu wybiegu (za zwierzętami)
    if (biome === 'laka') { bush(g, 6, -34, 0.9, '#5f8a3c', r); rock(g, -66, -6, 0.8, '#8d8a7e'); }
    if (biome === 'sawanna') { rock(g, -62, -10, 1.15, '#a08a6a'); smallAcacia(g, 46, -24); }
    if (biome === 'pustynia') { rock(g, 40, -26, 1.2, '#b0764e'); rock(g, 58, -16, 0.7, '#a26a44'); bush(g, -58, -12, 0.55, '#8a8a52', r); }
    if (biome === 'lod') { iceBlock(g, 48, -20, 1.1); iceBlock(g, 66, -8, 0.7); iceBlock(g, 30, -30, 0.6); }
    if (biome === 'staw') { for (let i = 0; i < 3; i++) bamboo(g, 54 + i * 9, -18 + i * 6, r, 2); }
    if (biome === 'bambusy') { bamboo(g, -56, -16, r, 7); bamboo(g, 40, -26, r, 8); rock(g, 64, 4, 0.7, '#7f8576'); }
    if (biome === 'las') { smallPine(g, 34, -26, 1.1); smallPine(g, 58, -12, 0.8); log(g, -46, -14); fern(g, -14, -30, '#7b9a4a'); fern(g, 70, 8, '#6d8c42'); }
    fenceEdge(g, L, T, B0.fence, true); fenceEdge(g, T, RR, B0.fence, true);
    // przód: niska roślinność i przednie ogrodzenie (rysowane po zwierzętach)
    g = front.g;
    if (biome === 'staw') { for (let i = 0; i < 2; i++) bamboo(g, -78 + i * 10, 14 + i * 4, r, 2); }
    if (biome === 'las') fern(g, -40, 26, '#7b9a4a');
    if (biome === 'laka' || biome === 'sawanna') tuft(g, 30, 36, 1, biome === 'laka' ? '#5c7d38' : '#a58d4c');
    fenceEdge(g, L, B, B0.fence, false); fenceEdge(g, B, RR, B0.fence, false);
    return { back, front };
  }
  // Bruk pod kioskiem: kamienne płyty w siatce izometrycznej.
  function makePatio() {
    const p = canvasFor(-120, -64, 240, 136), g = p.g, r = rng(77);
    g.fillStyle = '#8a8170'; g.beginPath(); g.moveTo(-108, 0); g.lineTo(0, 54); g.lineTo(0, 58); g.lineTo(-108, 4); g.closePath(); g.fill();
    g.fillStyle = '#726a5c'; g.beginPath(); g.moveTo(0, 54); g.lineTo(108, 0); g.lineTo(108, 4); g.lineTo(0, 58); g.closePath(); g.fill();
    const N = 5;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const a = (u, v) => [(u - v) * 108 / N, (u + v) * 54 / N - 54];
      const p0 = a(i, j), p1 = a(i + 1, j), p2 = a(i + 1, j + 1), p3 = a(i, j + 1);
      const t = r();
      g.fillStyle = t < 0.33 ? '#c3b79c' : t < 0.66 ? '#b8ac90' : '#cdc2a8';
      g.beginPath(); g.moveTo(p0[0], p0[1] + 0.8); g.lineTo(p1[0] - 1.4, p1[1]); g.lineTo(p2[0], p2[1] - 0.8); g.lineTo(p3[0] + 1.4, p3[1]); g.closePath(); g.fill();
    }
    return p;
  }

  // ---------- lecznica, śmietnik, samochody, robotnicy ----------
  function makeVet() {
    const p = canvasFor(-120, -150, 240, 215), g = p.g, H = 74;
    const poly = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo : g.moveTo).call(g, q[0], q[1])); g.closePath(); g.fill(); };
    g.fillStyle = 'rgba(25,30,18,.3)'; g.beginPath(); g.ellipse(14, 14, 84, 34, 0, 0, 7); g.fill();
    const L0 = [-78, 2], F = [0, 41], R0 = [78, 2], Bk = [0, -37], up = (q, h) => [q[0], q[1] - h];
    poly([L0, F, up(F, H), up(L0, H)], '#f1ece0');
    poly([F, R0, up(R0, H), up(F, H)], '#c9c3b4');
    // dach z okapem
    const e = 1.12, roof = (q) => [q[0] * e, (q[1] - 2) * e + 2 - H];
    poly([roof(L0), roof(F), [roof(F)[0], roof(F)[1] - 8], [roof(L0)[0], roof(L0)[1] - 8]], '#3f6a55');
    poly([roof(F), roof(R0), [roof(R0)[0], roof(R0)[1] - 8], [roof(F)[0], roof(F)[1] - 8]], '#2f5243');
    poly([[roof(L0)[0], roof(L0)[1] - 8], [roof(F)[0], roof(F)[1] - 8], [roof(R0)[0], roof(R0)[1] - 8], [roof(Bk)[0], roof(Bk)[1] - 8]], '#5a8a70');
    // drzwi i okno na lewej ścianie, krzyż na prawej
    g.save(); g.transform(1, 0.5, 0, 1, -39, 22);
    g.fillStyle = '#5b7f94'; g.fillRect(-16, -44, 32, 44); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-13, -41, 12, 24);
    g.restore();
    g.save(); g.transform(1, -0.5, 0, 1, 39, 22);
    g.fillStyle = '#c64a42'; g.fillRect(-7, -56, 14, 38); g.fillRect(-19, -44, 38, 14);
    g.restore();
    return p;
  }
  function drawBin(g, x, y, k = 1) {
    g.save(); g.translate(x, y); g.scale(k, k);
    g.fillStyle = 'rgba(25,30,15,.3)'; g.beginPath(); g.ellipse(4, 1, 14, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#3f5f49'; g.beginPath(); g.moveTo(-11, -30); g.lineTo(11, -30); g.lineTo(8, 0); g.lineTo(-8, 0); g.closePath(); g.fill();
    g.fillStyle = '#2d4636'; g.beginPath(); g.moveTo(2, -30); g.lineTo(11, -30); g.lineTo(8, 0); g.lineTo(2, 0); g.closePath(); g.fill();
    g.fillStyle = '#6d8a72'; g.beginPath(); g.ellipse(0, -31, 13, 5, 0, 0, 7); g.fill();
    g.strokeStyle = '#e8e2d0'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-4, -22); g.lineTo(-3, -6); g.moveTo(0, -22); g.lineTo(0, -6); g.moveTo(4, -22); g.lineTo(3, -6); g.stroke();
    g.restore();
  }
  // Samochód bokiem, ustawiony wzdłuż osi siatki: axis 1 = wzdłuż x, -1 = wzdłuż y.
  function drawCar(g, x, y, col, flip, axis = 1, kind = '', time = 0) {
    g.save(); g.translate(x, y); g.transform(1, 0.5 * axis, 0, 1, 0, 0); g.scale(flip ? -1 : 1, 1);
    g.fillStyle = 'rgba(20,25,15,.32)'; g.beginPath(); g.ellipse(2, 3, 34, 9, 0, 0, 7); g.fill();
    if (kind === 'bus') {             // autobus wycieczki: długi, żółty, z rzędem okien
      g.fillStyle = 'rgba(20,25,15,.32)'; g.beginPath(); g.ellipse(2, 3, 62, 11, 0, 0, 7); g.fill();
      g.fillStyle = '#d9a83a'; g.beginPath(); g.moveTo(-60, 0); g.lineTo(-60, -40); g.quadraticCurveTo(-60, -44, -56, -44); g.lineTo(54, -44); g.quadraticCurveTo(60, -44, 60, -36); g.lineTo(60, 0); g.closePath(); g.fill();
      g.fillStyle = 'rgba(205,228,238,.92)'; for (let i = 0; i < 6; i++) g.fillRect(-54 + i * 17, -38, 13, 14);
      g.fillStyle = '#2f3a2c'; g.fillRect(-60, -18, 120, 4);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(-60, -5, 120, 5);
      [[-40, 1], [40, 1]].forEach(([a, b]) => { g.fillStyle = '#20241f'; g.beginPath(); g.arc(a, b, 8, 0, 7); g.fill(); g.fillStyle = '#9b9c95'; g.beginPath(); g.arc(a, b, 3.4, 0, 7); g.fill(); });
      g.restore(); return;
    }
    const body = kind === 'amb' ? '#f2efe6' : kind === 'pol' ? '#2f4f86' : col;
    g.fillStyle = body; g.beginPath(); g.moveTo(-32, 0); g.lineTo(-32, -13); g.lineTo(-20, -15); g.lineTo(-9, -29); g.lineTo(15, -29); g.lineTo(26, -15); g.lineTo(32, -12); g.lineTo(32, 0); g.closePath(); g.fill();
    g.fillStyle = 'rgba(205,228,238,.9)'; g.beginPath(); g.moveTo(-16, -15); g.lineTo(-7, -26); g.lineTo(2, -26); g.lineTo(2, -15); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(5, -15); g.lineTo(5, -26); g.lineTo(14, -26); g.lineTo(21, -15); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(-32, -5, 64, 5);
    if (kind === 'amb') { g.fillStyle = '#c64a42'; g.fillRect(-4, -13, 8, 11); g.fillRect(-8, -10, 16, 5); }
    if (kind === 'pol') { g.fillStyle = '#f2efe6'; g.fillRect(-32, -11, 64, 4); }
    if (kind) { const on = Math.sin(time * 14) > 0; g.fillStyle = kind === 'amb' ? (on ? '#ff5a4d' : '#a33') : (on ? '#4d8dff' : '#ff4d4d'); g.fillRect(-6, -35, 12, 6); }
    [[-19, 1], [19, 1]].forEach(([a, b]) => { g.fillStyle = '#20241f'; g.beginPath(); g.arc(a, b, 7, 0, 7); g.fill(); g.fillStyle = '#9b9c95'; g.beginPath(); g.arc(a, b, 3, 0, 7); g.fill(); });
    g.restore();
  }
  // Robotnik: zwykła postać z żółtym kaskiem i narzędziem, którym macha.
  function drawWorker(g, x, y, phase, dir, scale = 1, tool = '#6b4f33') {
    drawPerson(g, x, y, 5, phase, false, dir, scale);
    const hy = y - 44.5 * scale;
    g.fillStyle = '#e0b432'; g.beginPath(); g.arc(x, hy - 1 * scale, 6.4 * scale, Math.PI, 0); g.fill(); g.fillRect(x - 8 * scale, hy - 1.2 * scale, 16 * scale, 2 * scale);
    const a = -0.5 + Math.sin(phase) * 0.8, sx = x + 6 * scale * dir, sy = y - 30 * scale;
    g.strokeStyle = tool; g.lineWidth = 3 * scale; g.lineCap = 'round';
    const ex = sx + Math.cos(a) * 20 * scale * dir, ey = sy + Math.sin(a) * 20 * scale;
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
    g.strokeStyle = '#8c9297'; g.lineWidth = 5 * scale; g.beginPath(); g.moveTo(ex - 3 * scale, ey - 4 * scale); g.lineTo(ex + 3 * scale, ey + 4 * scale); g.stroke();
    g.lineCap = 'butt';
  }

  // ---------- drzewa i skały (renderowane raz, w klatce tylko kołysane) ----------
  function makeTree(kind, seed) {
    const p = canvasFor(-80, -190, 160, 212), g = p.g, r = rng(seed);
    const shadowE = (rx, ry, dx = 14) => { g.fillStyle = 'rgba(28,38,18,.3)'; g.beginPath(); g.ellipse(dx, 3, rx, ry, 0, 0, 7); g.fill(); };
    if (kind === 'drzewo') {
      shadowE(46, 12);
      const tg = g.createLinearGradient(-6, 0, 6, 0); tg.addColorStop(0, '#866447'); tg.addColorStop(1, '#4f3a29');
      g.fillStyle = tg; g.beginPath(); g.moveTo(-6, 2); g.lineTo(-3, -58); g.lineTo(3, -58); g.lineTo(6, 2); g.closePath(); g.fill();
      g.strokeStyle = '#5a422d'; g.lineWidth = 3; g.beginPath(); g.moveTo(-1, -40); g.lineTo(-16, -62); g.moveTo(1, -46); g.lineTo(14, -68); g.stroke();
      const base = ['#4f7a35', '#5a7f36', '#47703a'][seed % 3];
      const parts = [[0, -96, 34], [-24, -78, 26], [24, -80, 27], [-12, -112, 26], [16, -108, 25], [0, -74, 26], [-28, -98, 20], [28, -98, 21]];
      parts.sort((a, b) => a[1] - b[1]).forEach(([x, y, s]) => blob(g, x + (r() - 0.5) * 4, y, s, s * 0.88, shade(base, -0.05), shade(base, -0.42)));
      parts.forEach(([x, y, s]) => blob(g, x - s * 0.22, y - s * 0.28, s * 0.62, s * 0.5, shade(base, 0.32), rgba(base, 0)));
      for (let i = 0; i < 40; i++) { const a = r() * 7, d = r() * 40; g.fillStyle = r() < 0.5 ? shade(base, 0.4) : shade(base, -0.35); g.globalAlpha = 0.5; g.beginPath(); g.arc(Math.cos(a) * d, -94 + Math.sin(a) * d * 0.7, 1.6, 0, 7); g.fill(); }
      g.globalAlpha = 1;
    } else if (kind === 'sosna') {
      shadowE(30, 9, 12);
      g.fillStyle = '#5b4330'; g.fillRect(-3, -22, 6, 24);
      const L0 = '#4b7a51', D0 = '#2a4c33';
      for (let i = 0; i < 5; i++) {
        const by = -16 - i * 22, w = 34 - i * 6, top = by - 34;
        g.fillStyle = shade(L0, -i * 0.02); g.beginPath(); g.moveTo(-w, by); g.lineTo(0, top); g.lineTo(2, by + 5); g.closePath(); g.fill();
        g.fillStyle = shade(D0, i * 0.03); g.beginPath(); g.moveTo(w, by); g.lineTo(0, top); g.lineTo(2, by + 5); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.moveTo(-w, by); g.lineTo(w, by); g.lineTo(w * 0.8, by + 3); g.lineTo(-w * 0.8, by + 3); g.closePath(); g.fill();
      }
    } else if (kind === 'akacja') {
      shadowE(52, 10, 16);
      g.strokeStyle = '#6a5136'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 2); g.lineTo(-2, -44); g.lineTo(-22, -70); g.moveTo(-2, -44); g.lineTo(20, -74); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.moveTo(-12, -58); g.lineTo(-34, -72); g.stroke();
      blob(g, 0, -78, 62, 14, '#8a9e52', '#4e6030');
      blob(g, -6, -86, 46, 11, '#9fb262', '#61753a');
      blob(g, -10, -92, 28, 7, '#b2c374', '#7a8c48');
    } else if (kind === 'skala') {
      rock(g, 0, 0, 2, '#8b897f'); rock(g, 26, 6, 1.1, '#7d7b72');
    }
    return p;
  }

  // ---------- chmury (ich cienie przesuwają się po mapie) i winieta ----------
  function makeCloudShadow(seed) {
    const c = document.createElement('canvas'); c.width = 420; c.height = 210;
    const g = c.getContext('2d'), r = rng(seed);
    for (let i = 0; i < 9; i++) {
      const x = 90 + r() * 240, y = 70 + r() * 70, s = 40 + r() * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(15,25,10,.55)'); gr.addColorStop(1, 'rgba(15,25,10,0)');
      g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2);
    }
    return c;
  }
  function makeVignette(w, h) {
    const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(w / 4)); c.height = Math.max(2, Math.round(h / 4));
    const g = c.getContext('2d'), cw = c.width, ch = c.height;
    const warm = g.createLinearGradient(0, 0, cw, ch); warm.addColorStop(0, 'rgba(255,236,190,.16)'); warm.addColorStop(0.5, 'rgba(255,236,190,0)'); warm.addColorStop(1, 'rgba(30,40,70,.10)');
    g.fillStyle = warm; g.fillRect(0, 0, cw, ch);
    const v = g.createRadialGradient(cw / 2, ch * 0.55, Math.min(cw, ch) * 0.35, cw / 2, ch * 0.55, Math.hypot(cw, ch) * 0.62);
    v.addColorStop(0, 'rgba(15,22,12,0)'); v.addColorStop(1, 'rgba(15,22,12,.42)');
    g.fillStyle = v; g.fillRect(0, 0, cw, ch);
    return c;
  }

  // ---------- goście: ludziki z prawdziwym krokiem (nogi i ręce się ruszają) ----------
  const PEOPLE = [
    { shirt: '#b5604f', pants: '#3e4b5e', skin: '#e9c3a0', hair: '#3a2a1e' },
    { shirt: '#4f7a96', pants: '#d8cfb8', skin: '#c79a76', hair: '#1f1a17' },
    { shirt: '#d2a64c', pants: '#4a3d33', skin: '#f0cfb0', hair: '#b8894a', kid: true },
    { shirt: '#6d8a5a', pants: '#2f3a44', skin: '#8d5f43', hair: '#151311' },
    { shirt: '#8b6a9b', pants: '#5c6a7a', skin: '#e5bc98', hair: '#6b4a2a', kid: true },
    { shirt: '#e2ddd0', pants: '#4f5f45', skin: '#d7a982', hair: '#2b211b' },
    { shirt: '#c7804e', pants: '#394a5a', skin: '#f1d2b4', hair: '#c9a36a' },
    // pracownicy zoo (7-9): opiekun, sprzątacz, dostawca
    { shirt: '#6d8a4a', pants: '#4a5a3a', skin: '#e2b896', hair: '#4a3626' },
    { shirt: '#e08a3c', pants: '#3e4b5e', skin: '#c99a76', hair: '#2a211b' },
    { shirt: '#4f7a96', pants: '#2f3a44', skin: '#f0cfb0', hair: '#8a5a32' },
  ];
  function drawPerson(g, x, y, idx, phase, walking, dir, scale = 1) {
    const P = PEOPLE[idx % PEOPLE.length], k = (P.kid ? 0.74 : 1) * scale;
    const sw = walking ? Math.sin(phase) : 0;
    g.fillStyle = 'rgba(25,35,15,.3)'; g.beginPath(); g.ellipse(x + 4 * k, y + 1, 9 * k, 3.4 * k, 0, 0, 7); g.fill();
    const hipY = y - 22 * k - (walking ? Math.abs(Math.cos(phase)) * 1.4 * k : 0);
    g.lineCap = 'round';
    // nogi: tylna ciemniejsza
    const leg = (a, col) => { g.strokeStyle = col; g.lineWidth = 5.2 * k; g.beginPath(); g.moveTo(x, hipY); g.lineTo(x + Math.sin(a) * 21 * k * dir, hipY + Math.cos(a) * 21 * k); g.stroke(); };
    leg(-sw * 0.45, P.pantsD || (P.pantsD = shade(P.pants, -0.3))); leg(sw * 0.45, P.pants);
    // ręka z tyłu
    const sh = hipY - 15 * k;
    const arm = (a, col) => { g.strokeStyle = col; g.lineWidth = 3.8 * k; g.beginPath(); g.moveTo(x, sh + 1 * k); const ex = x + Math.sin(a) * 14 * k * dir, ey = sh + Math.cos(a) * 14 * k; g.lineTo(ex, ey); g.stroke(); g.fillStyle = P.skin; g.beginPath(); g.arc(ex, ey + 1 * k, 2 * k, 0, 7); g.fill(); };
    arm(sw * 0.5, P.shirtA || (P.shirtA = shade(P.shirt, -0.3)));
    // tułów z cieniowaniem
    g.fillStyle = P.shirtD || (P.shirtD = shade(P.shirt, -0.22)); g.beginPath();
    g.moveTo(x - 5.5 * k, hipY + 2 * k); g.lineTo(x - 6.5 * k, sh + 2 * k); g.quadraticCurveTo(x, sh - 3 * k, x + 6.5 * k, sh + 2 * k); g.lineTo(x + 5.5 * k, hipY + 2 * k); g.closePath(); g.fill();
    g.fillStyle = P.shirtL || (P.shirtL = shade(P.shirt, 0.12)); g.beginPath();
    g.moveTo(x - 5.5 * k, hipY + 2 * k); g.lineTo(x - 6.5 * k, sh + 2 * k); g.quadraticCurveTo(x - 2 * k, sh - 2.4 * k, x + 1 * k, sh - 0.6 * k); g.lineTo(x + 0.5 * k, hipY + 2 * k); g.closePath(); g.fill();
    arm(-sw * 0.5, P.shirt);
    // głowa i włosy
    const hy = sh - 7.5 * k;
    g.fillStyle = P.skinD || (P.skinD = shade(P.skin, -0.15)); g.beginPath(); g.arc(x, hy, 5.6 * k, 0, 7); g.fill();
    g.fillStyle = P.skin; g.beginPath(); g.arc(x - 0.9 * k, hy - 0.9 * k, 4.5 * k, 0, 7); g.fill();
    g.fillStyle = P.hair; g.beginPath(); g.arc(x - 0.8 * k * dir, hy - 1 * k, 5.8 * k, Math.PI * 0.95, Math.PI * 2.05); g.fill();
    g.beginPath(); g.ellipse(x - 3.2 * k * dir, hy + 0.5 * k, 2.6 * k, 4 * k, 0, 0, 7); g.fill();
    g.lineCap = 'butt';
  }


  // ---------- nowe budynki: domki pracowników i atrakcje ----------
  // Ten sam układ co lecznica: romb miejsca 2×2, środek (0,0), połowy 112 × 56, światło z lewej góry.
  const polyG = (g, pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo : g.moveTo).call(g, q[0], q[1])); g.closePath(); g.fill(); };
  // Prostopadłościan o podstawie rombu (połowy a × a/2), wysokości H, przesunięty o (ox, oy).
  function box(g, ox, oy, a, H, wallL, wallR, top) {
    const L0 = [ox - a, oy], F = [ox, oy + a / 2], R0 = [ox + a, oy], Bk = [ox, oy - a / 2], up = (q) => [q[0], q[1] - H];
    polyG(g, [L0, F, up(F), up(L0)], wallL); polyG(g, [F, R0, up(R0), up(F)], wallR);
    if (top) polyG(g, [up(L0), up(F), up(R0), up(Bk)], top);
  }
  // Dach dwuspadowy nad prostopadłościanem.
  function gable(g, ox, oy, a, H, rh, light, dark, end) {
    const e = 1.14, L0 = [ox - a * e, oy - H], F = [ox, oy + a / 2 * e - H], R0 = [ox + a * e, oy - H], Bk = [ox, oy - a / 2 * e - H];
    const mL = [(L0[0] + Bk[0]) / 2, (L0[1] + Bk[1]) / 2 - rh], mF = [(F[0] + R0[0]) / 2, (F[1] + R0[1]) / 2 - rh];
    polyG(g, [mL, mF, R0, Bk], dark);
    polyG(g, [L0, F, mF, mL], light);
    polyG(g, [F, R0, mF], end);
  }
  const HOUSE = {
    opiekun: { wall: '#e9dfc8', roof: '#5c7d46', sign: '#5c7d46' },
    sprzatacz: { wall: '#e9dfc8', roof: '#c47a3c', sign: '#c47a3c' },
    dostawca: { wall: '#b08a5c', roof: '#6b4a33', sign: '#4f6f8f' },
  };
  function drawHouse(g, type) {
    const H = HOUSE[type];
    g.fillStyle = 'rgba(25,30,18,.3)'; g.beginPath(); g.ellipse(14, 12, 80, 30, 0, 0, 7); g.fill();
    box(g, -6, 0, 66, 56, H.wall, shade(H.wall, -0.2));
    if (type === 'dostawca') {   // deski na ścianie magazynu
      g.strokeStyle = 'rgba(60,40,20,.35)'; g.lineWidth = 1.2;
      for (let i = 1; i < 6; i++) { const x = -72 + i * 11, y = i * 5.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 56); g.stroke(); }
    }
    gable(g, -6, 0, 66, 56, 30, H.roof, shade(H.roof, -0.25), shade(H.wall, -0.28));
    // drzwi na lewej ścianie
    g.save(); g.transform(1, 0.5, 0, 1, -39, 16);
    g.fillStyle = shade(H.wall, -0.5); g.fillRect(-11, -36, 22, 36); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-9, -34, 8, 30);
    g.restore();
    // tabliczka z obrazkiem na prawej ścianie
    g.save(); g.transform(1, -0.5, 0, 1, 26, 12);
    g.fillStyle = '#f4eedd'; g.fillRect(-15, -46, 30, 28); g.fillStyle = H.sign; g.fillRect(-15, -46, 30, 4);
    g.translate(0, -31);
    if (type === 'opiekun') { g.fillStyle = '#7a5530'; g.beginPath(); g.arc(0, 2, 9, 0, Math.PI); g.fill(); g.fillStyle = '#c28d4a'; [[-4, 1], [0, 0], [4, 1]].forEach(([a, b]) => { g.beginPath(); g.arc(a, b, 2.4, 0, 7); g.fill(); }); }
    if (type === 'sprzatacz') { g.strokeStyle = '#7a5530'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-6, -9); g.lineTo(3, 5); g.stroke(); polyG(g, [[0, 3], [9, 1], [10, 8], [2, 10]], '#c9a14a'); }
    if (type === 'dostawca') { g.fillStyle = '#b08a5c'; g.fillRect(-8, -6, 16, 13); g.strokeStyle = '#6b4a33'; g.lineWidth = 1.5; g.strokeRect(-8, -6, 16, 13); g.beginPath(); g.moveTo(-8, 0); g.lineTo(8, 0); g.stroke(); }
    g.restore();
    // przed domkiem: wiadro z paszą, śmietnik albo skrzynki
    if (type === 'dostawca') { box(g, 58, 26, 10, 14, '#c49a62', '#9a7444', '#d8b47c'); box(g, 76, 18, 9, 12, '#c49a62', '#9a7444', '#d8b47c'); box(g, 62, 10, 8, 11, '#c49a62', '#9a7444', '#d8b47c'); }
    if (type === 'opiekun') { g.fillStyle = '#8c9297'; g.beginPath(); g.moveTo(54, 14); g.lineTo(68, 14); g.lineTo(66, 30); g.lineTo(56, 30); g.closePath(); g.fill(); g.fillStyle = '#6aa04a'; g.beginPath(); g.ellipse(61, 14, 7, 2.5, 0, 0, 7); g.fill(); }
    if (type === 'sprzatacz') drawBin(g, 62, 28, 0.9);
  }
  function makeHouse(type) { const p = canvasFor(-120, -150, 240, 215); drawHouse(p.g, type); return p; }

  // Atrakcje rysowane co klatkę (fontanna tryska, karuzela się kręci, ryby pływają); t = czas.
  function flowerBed(g, x, y, s, r) {
    bush(g, x, y, s, '#5d8a3e', r);
    const cols = ['#e26d5c', '#f2c14e', '#f4eedd', '#c77dba', '#e89a3c'];
    for (let i = 0; i < 9; i++) { g.fillStyle = cols[(i + Math.floor(Math.abs(x))) % cols.length]; g.beginPath(); g.arc(x + (r() - 0.5) * 30 * s, y - 6 * s - r() * 14 * s, 2.6 * s, 0, 7); g.fill(); }
  }
  function bench(g, x, y) {
    polyG(g, [[x - 16, y - 8], [x + 4, y + 2], [x + 4, y - 2], [x - 16, y - 12]], '#8a6a45');
    polyG(g, [[x - 16, y - 12], [x + 4, y - 2], [x + 4, y - 14], [x - 16, y - 24]], '#a07c52');
    g.fillStyle = '#4a3a28'; g.fillRect(x - 15, y - 8, 2, 8); g.fillRect(x + 2, y + 1, 2, 7);
  }
  function drawFun(g, type, t) {
    const r = rng(type.length * 31);
    if (type === 'ogrod') {
      g.fillStyle = '#7fa35a'; diamondPath(g, 0.04); g.fill();
      g.strokeStyle = '#cdbd9b'; g.lineWidth = 9; g.beginPath(); g.moveTo(-70, 0); g.lineTo(70, 0); g.moveTo(0, -35); g.lineTo(0, 35); g.stroke();
      [[-50, -14], [-26, 22], [32, -22], [52, 16], [-62, 10], [62, -6], [-12, -34], [14, 36]].forEach(([x, y], i) => flowerBed(g, x, y, 0.7 + (i % 3) * 0.12, r));
      bench(g, -22, 4); bench(g, 30, 10);
      g.fillStyle = '#e8e2d0'; g.beginPath(); g.ellipse(0, 0, 12, 6, 0, 0, 7); g.fill(); flowerBed(g, 0, 2, 0.5, r);
      return;
    }
    if (type === 'fontanna') {
      g.fillStyle = 'rgba(25,30,18,.25)'; g.beginPath(); g.ellipse(8, 8, 74, 30, 0, 0, 7); g.fill();
      g.fillStyle = '#9a917c'; g.beginPath(); g.ellipse(0, 4, 70, 30, 0, 0, 7); g.fill();
      g.fillStyle = '#c8bfa6'; g.beginPath(); g.ellipse(0, -2, 70, 30, 0, 0, 7); g.fill();
      g.fillStyle = '#5f9db4'; g.beginPath(); g.ellipse(0, -2, 60, 24, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) { const k = ((t * 0.6 + i / 3) % 1); g.globalAlpha = 1 - k; g.beginPath(); g.ellipse(0, -2, 10 + k * 46, (10 + k * 46) * 0.4, 0, 0, 7); g.stroke(); }
      g.globalAlpha = 1;
      g.fillStyle = '#b3a98f'; g.fillRect(-6, -40, 12, 38); g.fillStyle = '#d6cdb4'; g.beginPath(); g.ellipse(0, -40, 20, 8, 0, 0, 7); g.fill();
      g.fillStyle = '#7fb6cc'; g.beginPath(); g.ellipse(0, -41, 15, 5.5, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(220,240,250,.85)'; g.lineWidth = 2.4; g.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2 + t * 0.3, dx = Math.cos(a) * 34, dy = Math.sin(a) * 14, h = 34 + Math.sin(t * 5 + i) * 4;
        g.beginPath(); g.moveTo(0, -44); g.quadraticCurveTo(dx * 0.5, -44 - h, dx, -2 + dy); g.stroke();
      }
      g.fillStyle = 'rgba(235,248,255,.9)';
      for (let i = 0; i < 10; i++) { const k = (t * 1.3 + i * 0.1) % 1, a = i * 0.63; g.beginPath(); g.arc(Math.cos(a) * 10 * k, -46 - Math.sin(Math.PI * k) * 30, 1.8, 0, 7); g.fill(); }
      g.lineCap = 'butt';
      return;
    }
    if (type === 'plac') {
      g.fillStyle = '#d8c48f'; diamondPath(g, 0.05); g.fill();
      g.fillStyle = '#c9b47c'; g.beginPath(); g.ellipse(-6, 26, 26, 11, 0, 0, 7); g.fill();
      // zjeżdżalnia
      polyG(g, [[-62, -6], [-56, -6], [-56, -54], [-62, -54]], '#4f7a96');
      polyG(g, [[-38, -16], [-32, -16], [-32, -60], [-38, -60]], '#4f7a96');
      polyG(g, [[-64, -54], [-30, -64], [-30, -58], [-64, -48]], '#a7524a');
      polyG(g, [[-34, -60], [-26, -60], [12, 4], [4, 4]], '#d2a64c');
      g.strokeStyle = '#8b8b80'; g.lineWidth = 2; for (let y = -12; y > -52; y -= 9) { g.beginPath(); g.moveTo(-62, y); g.lineTo(-56, y - 2); g.stroke(); }
      // huśtawka
      g.strokeStyle = '#6b4f33'; g.lineWidth = 4; g.beginPath(); g.moveTo(30, -2); g.lineTo(42, -58); g.lineTo(54, -2); g.moveTo(70, -14); g.lineTo(82, -66); g.lineTo(94, -14); g.moveTo(42, -58); g.lineTo(82, -66); g.stroke();
      const sw = Math.sin(t * 2.2) * 0.45;
      [[52, -60], [72, -64]].forEach(([x, y], i) => {
        const a = sw * (i ? -1 : 1), ex = x + Math.sin(a) * 40, ey = y + Math.cos(a) * 40;
        g.strokeStyle = '#3a3a34'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
        g.fillStyle = i ? '#4f7a96' : '#a7524a'; g.fillRect(ex - 7, ey - 2, 14, 4);
      });
      return;
    }
    if (type === 'karuzela') {
      g.fillStyle = 'rgba(25,30,18,.28)'; g.beginPath(); g.ellipse(10, 8, 78, 30, 0, 0, 7); g.fill();
      g.fillStyle = '#7a5f45'; g.beginPath(); g.ellipse(0, 6, 72, 28, 0, 0, 7); g.fill();
      g.fillStyle = '#c9a26a'; g.beginPath(); g.ellipse(0, 0, 72, 28, 0, 0, 7); g.fill();
      const horses = [];
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + t * 0.9; horses.push({ i, a, x: Math.cos(a) * 54, y: Math.sin(a) * 20, b: Math.sin(t * 3 + i * 1.3) * 6 }); }
      const pole = (h) => { g.strokeStyle = '#e8d9a8'; g.lineWidth = 2; g.beginPath(); g.moveTo(h.x, h.y); g.lineTo(h.x, -86 + h.y * 0.5); g.stroke(); };
      const horse = (h) => {
        const cols = ['#f4eedd', '#a7524a', '#4f7a96', '#d2a64c', '#6d8a5a', '#8b6a9b'], dir = Math.sin(h.a) > 0 ? -1 : 1, y = h.y - 26 + h.b, c = cols[h.i];
        g.fillStyle = c; g.beginPath(); g.ellipse(h.x, y, 12, 6, 0, 0, 7); g.fill();
        g.beginPath(); g.ellipse(h.x + 11 * dir, y - 7, 4, 6, 0.5 * dir, 0, 7); g.fill();
        g.strokeStyle = c; g.lineWidth = 2.5; g.beginPath(); g.moveTo(h.x - 7, y + 3); g.lineTo(h.x - 9, y + 12); g.moveTo(h.x + 7, y + 3); g.lineTo(h.x + 9, y + 12); g.stroke();
      };
      horses.filter((h) => Math.sin(h.a) < 0).forEach((h) => { pole(h); horse(h); });
      g.fillStyle = '#e8d9a8'; g.fillRect(-5, -92, 10, 92); g.fillStyle = '#a7524a'; g.fillRect(-9, -40, 18, 26);
      horses.filter((h) => Math.sin(h.a) >= 0).forEach((h) => { pole(h); horse(h); });
      // dach w pasy
      for (let i = 0; i < 12; i++) {
        const a0 = i / 12 * Math.PI * 2 + t * 0.9, a1 = (i + 1) / 12 * Math.PI * 2 + t * 0.9;
        if (Math.sin((a0 + a1) / 2) < -0.2) continue;
        polyG(g, [[0, -122], [Math.cos(a0) * 76, -86 + Math.sin(a0) * 28], [Math.cos(a1) * 76, -86 + Math.sin(a1) * 28]], i % 2 ? '#f4eedd' : '#a7524a');
      }
      g.fillStyle = '#d3a43a'; g.beginPath(); g.arc(0, -124, 5, 0, 7); g.fill();
      g.strokeStyle = '#d3a43a'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -86, 76, 28, 0, 0, Math.PI); g.stroke();
      return;
    }
    if (type === 'akwarium') {
      g.fillStyle = 'rgba(25,30,18,.3)'; g.beginPath(); g.ellipse(14, 12, 86, 32, 0, 0, 7); g.fill();
      box(g, 0, 0, 78, 70, '#dfe7ea', '#aebdc2', '#c7d4d8');
      // szyba z rybami na lewej ścianie
      g.save(); g.transform(1, 0.5, 0, 1, -39, 19.5);
      g.beginPath(); g.rect(-30, -58, 60, 44); g.fillStyle = '#2f6f8c'; g.fill(); g.clip();
      const gr = g.createLinearGradient(0, -58, 0, -14); gr.addColorStop(0, 'rgba(160,220,240,.6)'); gr.addColorStop(1, 'rgba(20,60,80,0)'); g.fillStyle = gr; g.fillRect(-30, -58, 60, 44);
      for (let i = 0; i < 5; i++) {
        const x = ((t * (12 + i * 4) + i * 23) % 80) - 40, y = -48 + i * 7 + Math.sin(t * 2 + i) * 2, cols = ['#f2a03c', '#f4eedd', '#e26d5c', '#f2c14e', '#7fc4d6'];
        g.fillStyle = cols[i]; g.beginPath(); g.ellipse(x, y, 5, 2.6, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x - 9, y - 3); g.lineTo(x - 9, y + 3); g.closePath(); g.fill();
      }
      g.fillStyle = '#5d8a3e'; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(-24 + i * 16, -16, 3, 9 + Math.sin(t * 1.5 + i) * 2, Math.sin(t + i) * 0.2, 0, 7); g.fill(); }
      g.restore();
      // drzwi i fala na dachu
      g.save(); g.transform(1, -0.5, 0, 1, 39, 19.5);
      g.fillStyle = '#5b7f94'; g.fillRect(-12, -40, 24, 40); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(-10, -38, 8, 24);
      g.restore();
      g.strokeStyle = '#4f8fb0'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-40, -96); g.quadraticCurveTo(-26, -108, -12, -96); g.quadraticCurveTo(2, -84, 16, -96); g.quadraticCurveTo(30, -108, 44, -96); g.stroke(); g.lineCap = 'butt';
      return;
    }
  }
  function makeFun(type) { const p = canvasFor(-120, -150, 240, 215); drawFun(p.g, type, 0.6); return p; }
  // Pracownik: postać w koszulce swojego koloru, z czapką i rzeczą w ręce (wiadro, miotła, skrzynka).
  function drawStaff(g, x, y, kind, phase, walking, dir, scale = 1) {
    const idx = { opiekun: 7, sprzatacz: 8, dostawca: 9 }[kind] || 7;
    drawPerson(g, x, y, idx, phase, walking, dir, scale);
    const hy = y - 44.5 * scale, col = { opiekun: '#3f5f2c', sprzatacz: '#b0602a', dostawca: '#2f4f6f' }[kind];
    g.fillStyle = col; g.beginPath(); g.ellipse(x, hy - 1.5 * scale, 8.5 * scale, 2.4 * scale, 0, 0, 7); g.fill();
    g.beginPath(); g.arc(x, hy - 2 * scale, 5.6 * scale, Math.PI, 0); g.fill();
    const hx = x + 9 * scale * dir, hyy = y - 22 * scale;
    if (kind === 'opiekun') { g.fillStyle = '#8c9297'; g.beginPath(); g.moveTo(hx - 5 * scale, hyy - 6 * scale); g.lineTo(hx + 5 * scale, hyy - 6 * scale); g.lineTo(hx + 4 * scale, hyy + 4 * scale); g.lineTo(hx - 4 * scale, hyy + 4 * scale); g.closePath(); g.fill(); }
    if (kind === 'sprzatacz') { const a = walking ? Math.sin(phase) * 0.3 : 0.2; g.strokeStyle = '#7a5530'; g.lineWidth = 2.2 * scale; g.beginPath(); g.moveTo(hx, y - 34 * scale); g.lineTo(hx + Math.sin(a) * 30 * scale * dir, y - 2 * scale); g.stroke(); g.fillStyle = '#c9a14a'; g.fillRect(hx + Math.sin(a) * 30 * scale * dir - 6 * scale, y - 4 * scale, 12 * scale, 4 * scale); }
    if (kind === 'dostawca') { g.fillStyle = '#c49a62'; g.fillRect(x - 8 * scale, y - 40 * scale, 16 * scale, 12 * scale); g.strokeStyle = '#7a5530'; g.lineWidth = 1.2 * scale; g.strokeRect(x - 8 * scale, y - 40 * scale, 16 * scale, 12 * scale); }
  }
  // Parasol nad gościem w deszczu.
  function drawUmbrella(g, x, y, col, scale = 1) {
    g.strokeStyle = '#3a3a34'; g.lineWidth = 1.6 * scale; g.beginPath(); g.moveTo(x + 4 * scale, y - 24 * scale); g.lineTo(x + 4 * scale, y - 58 * scale); g.stroke();
    g.fillStyle = col; g.beginPath(); g.moveTo(x - 14 * scale, y - 52 * scale); g.quadraticCurveTo(x + 4 * scale, y - 76 * scale, x + 22 * scale, y - 52 * scale); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.moveTo(x + 4 * scale, y - 64 * scale); g.quadraticCurveTo(x + 14 * scale, y - 62 * scale, x + 22 * scale, y - 52 * scale); g.lineTo(x + 4 * scale, y - 52 * scale); g.closePath(); g.fill();
  }

  return { R, makePatterns, makeMottle, makeEnclosure, makePatio, makeTree, makeCloudShadow, makeVignette, drawPerson, drawWorker, drawCar, drawBin, makeVet, makeHouse, makeFun, drawFun, drawStaff, drawUmbrella, POOL, PEOPLE, shade, BIOME };
})();
