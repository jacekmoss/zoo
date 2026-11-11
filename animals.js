'use strict';
/* Moje Zoo – zwierzęta rysowane kodem, z osobnymi częściami ciała (nogi, głowa, ogon), żeby ruch był prawdziwy.
   Układ: zwierzę patrzy w lewo, (0,0) to ziemia pod środkiem ciała, jednostki = jednostki świata gry.
   Światło z lewej góry. Klatki (marsz i spoczynek) renderują się raz do małych płócien i są potem tylko kopiowane. */
(function () {
  // ---------- kolory ----------
  const hx = (c) => { c = c.replace('#', ''); if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]; return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; };
  const toHex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, k) => { const A = hx(a), B = hx(b); return toHex(A.map((v, i) => v + (B[i] - v) * k)); };
  const LI = (c, k) => mix(c, '#fff4dc', k);          // jaśniej (ciepłe światło)
  const DK = (c, k) => mix(c, '#121722', k);          // ciemniej (chłodny cień)
  const rgba = (c, a) => { const A = hx(c); return `rgba(${A[0]},${A[1]},${A[2]},${a})`; };

  // ---------- pomocnicze ----------
  const TAU = Math.PI * 2;
  let RS = 1;
  const rnd = () => { RS = (RS * 16807) % 2147483647; return (RS - 1) / 2147483646; };
  const seed = (s) => { RS = s; };
  // Gładka zamknięta (lub otwarta) ścieżka przez punkty; punkt [x, y, 1] = ostry narożnik.
  function path(g, pts, closed = true, ten = 1) {
    const n = pts.length; g.beginPath();
    const P = (i) => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    const tan = (i) => { const p = P(i); if (p[2]) return [0, 0]; const a = P(i - 1), b = P(i + 1); return [(b[0] - a[0]) / 6 * ten, (b[1] - a[1]) / 6 * ten]; };
    g.moveTo(pts[0][0], pts[0][1]);
    const m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const p1 = P(i), p2 = P(i + 1), t1 = tan(i), t2 = tan(i + 1);
      g.bezierCurveTo(p1[0] + t1[0], p1[1] + t1[1], p2[0] - t2[0], p2[1] - t2[1], p2[0], p2[1]);
    }
    if (closed) g.closePath();
  }
  function bbox(pts) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    pts.forEach((p) => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    return [x0, y0, x1, y1];
  }
  // Bryła: gradient z lewej góry (światło) do prawego dołu (cień) + przyciemniony spód. inside(b) rysuje wzór w obrysie.
  function part(g, pts, base, o = {}) {
    const b = bbox(pts);
    path(g, pts, true, o.ten || 1);
    const gr = g.createLinearGradient(b[0], b[1], b[0] + (b[2] - b[0]) * (o.dx == null ? 0.4 : o.dx), b[3]);
    gr.addColorStop(0, LI(base, o.hi == null ? 0.2 : o.hi)); gr.addColorStop(0.5, base); gr.addColorStop(1, DK(base, o.lo == null ? 0.3 : o.lo));
    g.fillStyle = gr; g.fill();
    if (o.inside || o.belly !== 0) {
      g.save(); path(g, pts, true, o.ten || 1); g.clip();
      if (o.inside) o.inside(b);
      if (o.belly !== 0) {
        const k = o.belly == null ? 0.22 : o.belly, v = g.createLinearGradient(0, b[1] + (b[3] - b[1]) * 0.55, 0, b[3]);
        v.addColorStop(0, 'rgba(14,18,26,0)'); v.addColorStop(1, `rgba(14,18,26,${k})`);
        g.fillStyle = v; g.fillRect(b[0] - 2, b[1], b[2] - b[0] + 4, b[3] - b[1] + 2);
      }
      g.restore();
    }
    return b;
  }
  // Miękki połysk (światło na grzbiecie, policzku itp.).
  function glow(g, x, y, rx, ry, a = 0.18, col = '#fff4dc') {
    const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
    g.save(); g.translate(x, y); g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); g.translate(-x, -y);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, Math.max(rx, ry), 0, TAU); g.fill(); g.restore();
  }
  function ell(g, x, y, rx, ry, col, rot = 0) { g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU); g.fillStyle = col; g.fill(); }
  function eye(g, x, y, r = 1.3) {
    ell(g, x, y, r, r * 1.05, '#16130f');
    ell(g, x - r * 0.35, y - r * 0.35, r * 0.32, r * 0.32, 'rgba(255,255,255,.75)');
  }
  // Noga z dwóch odcinków; kąt 0 = pionowo w dół, dodatni = do przodu (w lewo). Zwraca stopę.
  function limb(g, x, y, a1, l1, a2, l2, w0, w1, w2, col, o = {}) {
    const k = [x - Math.sin(a1) * l1, y + Math.cos(a1) * l1], a = a1 + a2, f = [k[0] - Math.sin(a) * l2, k[1] + Math.cos(a) * l2];
    const n1 = [Math.cos(a1), Math.sin(a1)], n2 = [Math.cos(a), Math.sin(a)], nk = [(n1[0] + n2[0]) / 2, (n1[1] + n2[1]) / 2];
    const pts = [[x - n1[0] * w0, y - n1[1] * w0], [k[0] - nk[0] * w1, k[1] - nk[1] * w1], [f[0] - n2[0] * w2, f[1] - n2[1] * w2],
      [f[0] - Math.sin(a) * w2 * 0.8, f[1] + Math.cos(a) * w2 * 0.8], [f[0] + n2[0] * w2, f[1] + n2[1] * w2], [k[0] + nk[0] * w1 * 1.05, k[1] + nk[1] * w1 * 1.05], [x + n1[0] * w0, y + n1[1] * w0]];
    const b = bbox(pts); path(g, pts);
    const gr = g.createLinearGradient(b[0], 0, b[2], 0);
    gr.addColorStop(0, LI(col, 0.16)); gr.addColorStop(0.45, col); gr.addColorStop(1, DK(col, 0.34));
    g.fillStyle = gr; g.fill();
    if (o.inside) { g.save(); path(g, pts); g.clip(); o.inside(b, k, f); g.restore(); }
    if (o.foot) { g.save(); g.translate(f[0], f[1]); g.rotate(a * 0.5); o.foot(g, w2); g.restore(); }
    return f;
  }
  const hoof = (col) => (g, w) => { g.beginPath(); g.moveTo(-w * 1.05, -w * 0.9); g.lineTo(w * 1.05, -w * 0.9); g.lineTo(w * 1.2, w * 0.25); g.lineTo(-w * 1.25, w * 0.25); g.closePath(); g.fillStyle = col; g.fill(); };
  const paw = (col) => (g, w) => { ell(g, -w * 0.35, -w * 0.05, w * 1.35, w * 0.7, col); };
  const pad = (col) => (g, w) => { ell(g, 0, 0, w * 1.12, w * 0.45, col); };
  // Krzywa linia (np. pręgi, sierść).
  function stroke(g, pts, col, w, cap = 'round') { path(g, pts, false); g.strokeStyle = col; g.lineWidth = w; g.lineCap = cap; g.lineJoin = 'round'; g.stroke(); }
  // Ogon: łańcuch odcinków falujący z fazą.
  function tail(g, x, y, segs, len, w0, w1, col, ang, wave, ph, o = {}) {
    const pts = [[x, y]]; let a = ang, px = x, py = y;
    for (let i = 1; i <= segs; i++) { a += wave * Math.sin(ph + i * 0.9) / segs; px += Math.sin(a) * len / segs; py += Math.cos(a) * len / segs; pts.push([px, py]); }
    for (let i = 0; i < pts.length - 1; i++) {
      const t = i / (pts.length - 1);
      g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[i + 1][0], pts[i + 1][1]);
      g.strokeStyle = i < pts.length * 0.5 ? col : DK(col, 0.12); g.lineWidth = w0 + (w1 - w0) * t; g.lineCap = 'round'; g.stroke();
    }
    if (o.tuft) { const e = pts[pts.length - 1]; g.save(); g.translate(e[0], e[1]); g.rotate(-a); part(g, [[-o.tuft * 0.5, -o.tuft * 0.4], [o.tuft * 0.5, -o.tuft * 0.4], [o.tuft * 0.35, o.tuft * 0.9], [0, o.tuft * 1.5], [-o.tuft * 0.35, o.tuft * 0.9]], o.tuftCol, { belly: 0 }); g.restore(); }
    return pts[pts.length - 1];
  }
  // Futro: krótkie, miękkie kreski w obrysie (widać je w zbliżeniu).
  function fur(g, b, col, n, len, s, a = 0.22, ang = 0.4) {
    seed(s); g.strokeStyle = rgba(col, a); g.lineWidth = Math.max(0.5, len * 0.18); g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i < n; i++) { const x = b[0] + rnd() * (b[2] - b[0]), y = b[1] + rnd() * (b[3] - b[1]), d = ang + (rnd() - 0.5) * 0.6; g.moveTo(x, y); g.lineTo(x + Math.sin(d) * len, y + Math.cos(d) * len); }
    g.stroke();
  }

  // ---------- czworonogi: wspólny szkielet ----------
  // P: body(bob)->punkty tułowia, fx/hx: x barku/biodra, legY: y nasady nóg, nogi przednie fl=[l1,l2,w0,w1,w2], tylne hl,
  // h1/h2: spoczynkowe zgięcie tylnej nogi, A: zamach, bend: zgięcie w kroku, foot, leg (kolor), farDX/farDY: przesunięcie dalszych nóg.
  function quad(g, P, pose) {
    const walk = pose.mode === 'walk', th = TAU * pose.p, sp = P.speedA || 1;
    const bob = walk ? -Math.abs(Math.sin(th)) * (P.bob || 1.2) : 0;
    const legs = [
      { x: P.fx, off: 0.5, front: 1, near: 0 }, { x: P.hx, off: 0, front: 0, near: 0 },
      { x: P.fx, off: 0, front: 1, near: 1 }, { x: P.hx, off: 0.5, front: 0, near: 1 }];
    if (P.tailBehind !== false && P.tail) P.tail(g, bob, pose);
    legs.forEach((L) => {
      const t = th + L.off * TAU, sw = walk ? Math.sin(t) : 0, lift = walk ? Math.max(0, Math.cos(t)) : 0;
      const d = L.front ? P.fl : P.hl;
      let a1, a2;
      if (L.front) { a1 = (P.fa1 || 0) + P.A * sp * sw; a2 = (P.fa2 || 0) - lift * P.bend; }
      else { a1 = P.h1 + P.A * sp * sw + lift * 0.15; a2 = P.h2 - lift * P.bend * 0.8; }
      const ox = L.near ? 0 : P.farDX, oy = L.near ? 0 : P.farDY;
      const col = L.near ? P.leg : DK(P.leg, 0.24);
      const ly = (!L.front && P.legYh != null) ? P.legYh : P.legY;
      limb(g, L.x + ox, ly + bob + oy - (lift * (P.lift || 0)), a1, d[0], a2, d[1], d[2], d[3], d[4], col,
        { foot: P.foot, inside: P.legInside ? (b, k, f) => P.legInside(g, b, k, f, L) : null });
    });
    const body = P.body(bob, pose);
    part(g, body, P.col, { inside: (b) => { if (P.bodyInside) P.bodyInside(g, b, bob, pose); }, belly: P.belly, hi: P.hi, lo: P.lo });
    if (P.tailBehind === false && P.tail) P.tail(g, bob, pose);
    if (P.front) P.front(g, bob, pose);
  }
  // Szyja: gruba, gładka bryła od tułowia do głowy.
  function neck(g, x0, y0, x1, y1, w0, w1, col, o = {}) {
    const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a), bx = o.bow || 0;
    const mx = (x0 + x1) / 2 + nx * bx, my = (y0 + y1) / 2 + ny * bx;
    const pts = [[x0 + nx * w0, y0 + ny * w0], [mx + nx * (w0 + w1) / 2, my + ny * (w0 + w1) / 2], [x1 + nx * w1, y1 + ny * w1],
      [x1 - nx * w1, y1 - ny * w1], [mx - nx * (w0 + w1) / 2, my - ny * (w0 + w1) / 2], [x0 - nx * w0, y0 - ny * w0]];
    part(g, pts, col, { belly: 0, inside: o.inside, hi: 0.18, dx: 0.8 });
    return pts;
  }

  // ---------- gatunki ----------
  const A = {};

  // ZEBRA
  A.zebra = { box: [-62, -84, 50, 6], h: 74, draw(g, pose) {
    const C = '#ebe5d4', S = '#22201e';
    const idle = pose.mode === 'idle', ph = TAU * pose.p, nod = idle ? Math.sin(ph) * 0.05 : Math.sin(ph * 2) * 0.03;
    const stripesV = (b, x0, x1, step, curve, w) => { for (let x = x0; x < x1; x += step) stroke(g, [[x, b[1] - 2], [x + curve, (b[1] + b[3]) / 2], [x - curve * 0.3, b[3] + 2]], S, w); };
    quad(g, {
      col: C, leg: C, fx: -21, hx: 21, legY: -34, fl: [17, 17, 5.2, 3.4, 2.2], hl: [16, 18, 6.5, 3.4, 2.2], h1: 0.32, h2: -0.48, A: 0.42, bend: 0.85, farDX: 3, farDY: -2.5, bob: 1.1,
      foot: hoof('#262321'), belly: 0.2,
      legInside: (g, b) => { for (let y = b[1] + 3; y < b[3] - 3; y += 3.6) stroke(g, [[b[0] - 1, y], [b[2] + 1, y + 0.8]], S, 1.5); },
      tail: (g, bob, pose) => tail(g, 29, -50 + bob, 5, 18, 2, 1.1, C, 0.25, idle ? 0.9 : 0.4, ph * (idle ? 1 : 2), { tuft: 4, tuftCol: S }),
      body: (bob) => [[-30, -48 + bob], [-22, -54 + bob], [0, -52 + bob], [22, -54 + bob], [32, -48 + bob], [33, -38 + bob], [26, -30 + bob], [0, -29 + bob], [-24, -31 + bob], [-32, -38 + bob]],
      bodyInside: (g, b) => {
        stripesV(b, -24, 26, 5.4, 2.5, 2.2);
        stroke(g, [[18, -52], [26, -44], [30, -36]], S, 2); stroke(g, [[23, -54], [30, -47], [33, -40]], S, 2);
        glow(g, -10, -50, 22, 6, 0.22);
      },
      front: (g, bob) => {
        const n = nod * 14;
        neck(g, -22, -47 + bob, -37, -66 + bob + n * 0.5, 8, 5.5, C, { bow: 1.2, inside: (b) => { for (let i = 0; i < 6; i++) stroke(g, [[-40 + i * 3.4, b[1] - 2], [-31 + i * 3.4, b[3] + 2]], S, 1.8); } });
        // grzywa
        g.save(); g.translate(0, bob); const mn = [[-19, -53], [-27, -62], [-35, -71 + n * 0.6]]; stroke(g, mn, S, 3.4); stroke(g, mn.map((q) => [q[0] - 0.4, q[1] - 0.8]), '#e9e2d0', 1); g.restore();
        g.save(); g.translate(-38, -68 + bob + n * 0.6); g.rotate(nod);
        // uszy
        part(g, [[3, -2], [5, -11], [8, -3]], DK(C, 0.12), { belly: 0 }); part(g, [[0, -2], [1, -10], [4, -2]], C, { belly: 0, inside: () => ell(g, 1.8, -5, 0.7, 2.6, '#2a2624') });
        // głowa: długa, ku przodowi i w dół
        part(g, [[3, -3], [6, 2], [2, 8], [-7, 14], [-16, 19], [-21, 19], [-22, 14], [-14, 6], [-5, -2]], C, { belly: 0, dx: 0.9, inside: () => {
          for (let k = 0; k < 4; k++) stroke(g, [[-2 - k * 3.4, -3 + k * 3.2], [4 - k * 3.6, 5 + k * 3.2]], S, 1.3);
          part(g, [[-14, 11], [-18, 13], [-24, 21], [-15, 23], [-10, 16]], '#2c2826', { belly: 0, hi: 0.15 });
          glow(g, -6, 1, 6, 3, 0.25);
        } });
        ell(g, -20.5, 16, 0.9, 0.7, '#101010');
        eye(g, -6, 3, 1.25);
        g.restore();
      },
    }, pose);
  } };

  // LEW
  A.lew = { box: [-62, -66, 64, 6], h: 58, draw(g, pose) {
    const C = '#c49a5e', M = '#7e5330';
    const idle = pose.mode === 'idle', ph = TAU * pose.p;
    quad(g, {
      col: C, leg: C, fx: -21, hx: 22, legY: -27, fl: [13, 14, 6.5, 4.4, 3.4], hl: [13, 14, 7.5, 4.2, 3.4], h1: 0.28, h2: -0.42, A: 0.4, bend: 0.8, farDX: 3, farDY: -2.5, bob: 1,
      foot: paw(LI(C, 0.1)), belly: 0.25,
      tail: (g, bob) => tail(g, 31, -38 + bob, 7, 30, 2.4, 1.6, C, 1.4, idle ? 1.6 : 0.7, ph * (idle ? 1 : 2) + 1, { tuft: 3.8, tuftCol: '#5d3c22' }),
      body: (bob) => [[-30, -38 + bob], [-20, -45 + bob], [4, -42 + bob], [24, -44 + bob], [33, -38 + bob], [33, -28 + bob], [24, -22 + bob], [0, -21 + bob], [-22, -23 + bob], [-31, -30 + bob]],
      bodyInside: (g, b) => { glow(g, 2, -42, 26, 6, 0.24); ell(g, -6, -22, 22, 4, rgba('#efd8a8', 0.45)); fur(g, b, '#7d5a32', 60, 2.6, 7, 0.16); },
      front: (g, bob) => {
        const nod = idle ? Math.sin(ph) * 1.4 : Math.sin(ph * 2) * 0.8, hx = -33, hy = -44 + bob + nod;
        // grzywa
        part(g, [[hx + 18, hy - 12], [hx + 10, hy - 20], [hx - 2, hy - 20], [hx - 12, hy - 12], [hx - 14, hy + 2], [hx - 8, hy + 16], [hx + 6, hy + 21], [hx + 18, hy + 12], [hx + 22, hy]], M,
          { belly: 0.15, inside: (b) => { fur(g, b, '#3e2614', 90, 4, 3, 0.35, 0.2); glow(g, hx - 4, hy - 12, 12, 8, 0.25); } });
        g.save(); g.translate(hx - 4, hy + 1);
        part(g, [[-9, -9], [3, -11], [8, -4], [7, 6], [0, 11], [-8, 11], [-14, 6], [-15, -1]], C, { belly: 0.1 });
        part(g, [[-15, 1], [-9, -1], [-6, 5], [-9, 9], [-15, 8]], '#e3c99a', { belly: 0 });
        part(g, [[-16, 1], [-13, 0], [-13, 3], [-16, 3]], '#3b2a22', { belly: 0 });
        eye(g, -7.5, -3.5, 1.3); stroke(g, [[-10, -5.6], [-6, -6]], DK(C, 0.4), 0.8);
        g.restore();
      },
    }, pose);
  } };

  // TYGRYS
  A.tygrys = { box: [-62, -60, 70, 6], h: 54, draw(g, pose) {
    const C = '#c77634', S = '#211a15', W = '#efe4cf';
    const idle = pose.mode === 'idle', ph = TAU * pose.p;
    quad(g, {
      col: C, leg: C, fx: -24, hx: 24, legY: -24, fl: [12, 12.5, 6, 4.2, 3.4], hl: [12, 13, 7, 4, 3.4], h1: 0.3, h2: -0.45, A: 0.42, bend: 0.85, farDX: 3, farDY: -2.5, bob: 0.9,
      foot: paw(LI(C, 0.25)), belly: 0.15,
      legInside: (g, b) => { for (let y = b[1] + 3; y < b[3] - 5; y += 4.5) stroke(g, [[b[0] - 1, y], [(b[0] + b[2]) / 2, y + 1.2]], S, 1.4); },
      tail: (g, bob) => tail(g, 34, -34 + bob, 7, 34, 3, 2, C, 1.25, idle ? 1.4 : 0.6, ph * (idle ? 1 : 2) + 2, { tuft: 2.6, tuftCol: S }),
      body: (bob) => [[-33, -34 + bob], [-24, -40 + bob], [4, -38 + bob], [27, -40 + bob], [36, -34 + bob], [36, -25 + bob], [28, -19 + bob], [0, -19 + bob], [-25, -20 + bob], [-34, -27 + bob]],
      bodyInside: (g, b) => {
        ell(g, -4, -19, 28, 5, rgba(W, 0.85));
        for (let x = -26; x < 34; x += 5.5) { stroke(g, [[x, b[1] - 1], [x + 2, b[1] + 6], [x - 0.5, b[1] + 11]], S, 1.9); if (x % 11 < 5) stroke(g, [[x + 2.5, b[1] + 13], [x + 3.5, b[1] + 16]], S, 1.2); }
        glow(g, 0, -38, 26, 5, 0.22); fur(g, b, '#6e3a12', 50, 2.4, 11, 0.14);
      },
      front: (g, bob) => {
        const nod = idle ? Math.sin(ph) * 1.2 : Math.sin(ph * 2) * 0.7;
        g.save(); g.translate(-37, -38 + bob + nod);
        part(g, [[-8, -8], [5, -9], [10, -3], [9, 6], [1, 10], [-8, 10], [-13, 5], [-13, -2]], C, { belly: 0.1, inside: () => {
          stroke(g, [[-2, -9], [-1, -4]], S, 1.4); stroke(g, [[2, -9], [2, -5]], S, 1.4); stroke(g, [[6, 0], [9, 2]], S, 1.3); stroke(g, [[6, 4], [9, 6]], S, 1.3);
        } });
        part(g, [[-14, 1], [-7, -1], [-2, 4], [-5, 10], [-12, 9]], W, { belly: 0 });
        part(g, [[-15, 1.5], [-12, 0.5], [-12, 3.5], [-15, 3.5]], '#3d2620', { belly: 0 });
        part(g, [[1, -8], [3, -13], [7, -8]], C, { belly: 0 }); ell(g, 3.6, -9.5, 1.3, 1.6, W);
        eye(g, -6.5, -3, 1.25);
        g.restore();
      },
    }, pose);
  } };

  // ŻYRAFA
  A.zyrafa = { box: [-64, -148, 50, 6], h: 140, draw(g, pose) {
    const C = '#e2c48e', P = '#a9622f';
    const idle = pose.mode === 'idle', ph = TAU * pose.p, sway = idle ? Math.sin(ph) * 0.06 : Math.sin(ph * 2) * 0.03;
    const patches = (b, s, sz) => { seed(s); for (let y = b[1]; y < b[3] + sz; y += sz * 0.95) for (let x = b[0] - sz + (Math.round(y) % 2) * sz * 0.5; x < b[2] + sz; x += sz * 1.02) {
      const r = sz * (0.4 + rnd() * 0.08), pts = []; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + rnd() * 0.4; pts.push([x + Math.cos(a) * r * (0.85 + rnd() * 0.3), y + Math.sin(a) * r * (0.85 + rnd() * 0.3), 0]); }
      path(g, pts); g.fillStyle = P; g.fill(); } };
    quad(g, {
      col: C, leg: C, fx: -16, hx: 17, legY: -58, fl: [27, 30, 4.5, 2.8, 2], hl: [26, 31, 5.5, 2.8, 2], h1: 0.3, h2: -0.38, A: 0.36, bend: 0.85, farDX: 3, farDY: -2.5, bob: 1.4,
      foot: hoof('#3a2b22'), belly: 0.18,
      legInside: (g, b) => { g.save(); g.beginPath(); g.rect(b[0] - 2, b[1] - 2, b[2] - b[0] + 4, (b[3] - b[1]) * 0.42); g.clip(); patches(b, 3, 6); g.restore(); },
      tail: (g, bob) => tail(g, 24, -66 + bob, 5, 24, 1.6, 1, C, 0.15, idle ? 0.8 : 0.4, ph * 2, { tuft: 3.2, tuftCol: '#2c221c' }),
      body: (bob) => [[-24, -70 + bob], [-14, -78 + bob], [6, -73 + bob], [22, -68 + bob], [27, -63 + bob], [26, -53 + bob], [18, -48 + bob], [0, -47 + bob], [-18, -49 + bob], [-26, -57 + bob]],
      bodyInside: (g, b) => { patches(b, 9, 10); glow(g, -6, -74, 18, 6, 0.24); },
      front: (g, bob) => {
        g.save(); g.translate(-18, -70 + bob); g.rotate(sway);
        neck(g, 0, 2, -22, -58, 7.5, 3.6, C, { bow: -1.5, inside: (b) => patches(b, 21, 8) });
        stroke(g, [[3, -2], [-6, -26], [-18, -58]], '#6d4528', 2.2); // grzywa
        g.save(); g.translate(-23, -62); g.rotate(-0.35 + (idle ? Math.sin(ph * 2) * 0.05 : 0));
        part(g, [[-2, -5], [5, -4], [6, 1], [3, 4], [-6, 13], [-11, 13], [-12, 9], [-6, 2]], C, { belly: 0 });
        part(g, [[-6, 9], [-6, 13], [-11, 14], [-13, 10], [-10, 8]], '#b79a74', { belly: 0 });
        stroke(g, [[0, -4], [0, -10]], '#5b3c26', 1.6); stroke(g, [[3, -4], [4, -9]], '#5b3c26', 1.6); ell(g, 0, -10.5, 1.4, 1.3, '#3b2a20'); ell(g, 4, -9.5, 1.4, 1.3, '#3b2a20');
        part(g, [[4, -2], [10, -4], [6, 1]], C, { belly: 0 });
        eye(g, -2.5, 1.2, 1.2);
        g.restore(); g.restore();
      },
    }, pose);
  } };

  // SŁOŃ
  A.slon = { box: [-74, -100, 56, 6], h: 96, draw(g, pose) {
    const C = '#8c8a85';
    const idle = pose.mode === 'idle', ph = TAU * pose.p;
    const trunk = idle ? Math.sin(ph) * 0.45 : Math.sin(ph * 2) * 0.15, ear = idle ? 1 + Math.sin(ph * 2) * 0.12 : 1;
    quad(g, {
      col: C, leg: C, fx: -20, hx: 24, legY: -38, fl: [19, 19, 8.5, 7.5, 7.5], hl: [19, 19, 9.5, 7.4, 7.5], h1: 0.08, h2: -0.1, A: 0.26, bend: 0.5, farDX: 4, farDY: -3, bob: 1.4,
      foot: (g, w) => { ell(g, 0, -0.5, w * 1.15, w * 0.35, DK(C, 0.2)); [-0.6, 0, 0.6].forEach((k) => ell(g, k * w - w * 0.2, -1.8, w * 0.22, w * 0.18, '#d8d2c2')); },
      belly: 0.24,
      tail: (g, bob) => tail(g, 37, -62 + bob, 5, 22, 2.2, 1.4, C, 0.12, idle ? 0.7 : 0.4, ph * 2, { tuft: 2.5, tuftCol: '#3b3835' }),
      body: (bob) => [[-28, -60 + bob], [-18, -80 + bob], [6, -86 + bob], [28, -78 + bob], [40, -62 + bob], [38, -44 + bob], [26, -34 + bob], [0, -32 + bob], [-22, -36 + bob], [-30, -46 + bob]],
      bodyInside: (g, b) => {
        glow(g, 0, -80, 30, 10, 0.24);
        g.strokeStyle = rgba('#3f3d39', 0.3); g.lineWidth = 0.8;
        for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(28, -56, 10 + i * 2.6, 2.3, 3.6); g.stroke(); }
        fur(g, b, '#55524d', 70, 3, 5, 0.12, 0.1);
      },
      front: (g, bob) => {
        g.save(); g.translate(-30, -66 + bob);
        // ucho (za głową)
        g.save(); g.translate(6, 0); g.scale(ear, 1);
        part(g, [[-2, -18], [10, -20], [18, -10], [16, 8], [8, 18], [0, 14], [-4, 2]], DK(C, 0.06), { belly: 0.2, inside: () => { stroke(g, [[2, -12], [10, -6], [8, 10]], rgba('#3d3a36', 0.35), 1); glow(g, 4, -12, 8, 6, 0.2); } });
        g.restore();
        part(g, [[-6, -20], [4, -22], [8, -12], [6, 6], [-4, 14], [-14, 10], [-18, -2], [-14, -14]], C, { belly: 0.15, inside: () => glow(g, -8, -14, 10, 7, 0.25) });
        // trąba
        const segs = 8, pts = []; let a = 0.25 + trunk * 0.4, x = -14, y = 4;
        for (let i = 0; i <= segs; i++) { pts.push([x, y]); a += (i < segs * 0.6 ? 0.02 : -0.16 - trunk * 0.12); x -= Math.sin(a) * 4.4; y += Math.cos(a) * 4.4; }
        for (let i = 0; i < pts.length - 1; i++) { g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[i + 1][0], pts[i + 1][1]); g.strokeStyle = i % 2 ? DK(C, 0.06) : C; g.lineWidth = 7.5 - i * 0.55; g.lineCap = 'round'; g.stroke(); }
        g.strokeStyle = rgba('#3a3733', 0.35); g.lineWidth = 0.7; for (let i = 1; i < pts.length - 1; i++) { g.beginPath(); g.moveTo(pts[i][0] - 2.5, pts[i][1] - 0.5); g.lineTo(pts[i][0] + 2, pts[i][1] + 0.5); g.stroke(); }
        // kieł
        stroke(g, [[-11, 8], [-17, 12], [-21, 10]], '#eee6d2', 2.4);
        eye(g, -10, -6, 1.3); stroke(g, [[-13, -8.5], [-8, -9]], DK(C, 0.35), 0.8);
        g.restore();
      },
    }, pose);
  } };

  // NOSOROŻEC
  A.nosorozec = { box: [-74, -66, 58, 6], h: 62, draw(g, pose) {
    const C = '#8e877b';
    const idle = pose.mode === 'idle', ph = TAU * pose.p;
    quad(g, {
      col: C, leg: C, fx: -22, hx: 24, legY: -27, fl: [14, 13.5, 7.5, 6, 5.6], hl: [14, 13.5, 8.5, 6, 5.6], h1: 0.12, h2: -0.16, A: 0.32, bend: 0.6, farDX: 4, farDY: -3, bob: 1.2,
      foot: (g, w) => { ell(g, 0, 0, w * 1.1, w * 0.35, DK(C, 0.25)); },
      belly: 0.26,
      tail: (g, bob) => tail(g, 37, -44 + bob, 4, 14, 2, 1.2, C, 0.15, idle ? 0.9 : 0.4, ph * 2, { tuft: 2, tuftCol: '#3d3833' }),
      body: (bob) => [[-30, -44 + bob], [-20, -56 + bob], [0, -54 + bob], [26, -56 + bob], [38, -46 + bob], [38, -32 + bob], [26, -24 + bob], [0, -22 + bob], [-24, -24 + bob], [-31, -32 + bob]],
      bodyInside: (g, b) => {
        glow(g, 0, -54, 30, 6, 0.24);
        g.strokeStyle = rgba('#3c372f', 0.35); g.lineWidth = 1.1;
        [[-16, -55, -18, -26], [18, -56, 15, -24]].forEach(([x0, y0, x1, y1]) => { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 4, (y0 + y1) / 2, x1, y1); g.stroke(); });
        fur(g, b, '#4b453d', 50, 2.5, 13, 0.12, 0.1);
      },
      front: (g, bob) => {
        const nod = idle ? Math.sin(ph) * 2 : Math.sin(ph * 2) * 0.8;
        g.save(); g.translate(-32, -42 + bob + nod);
        part(g, [[6, -14], [10, -8], [8, 4], [-6, 12], [-22, 14], [-27, 10], [-26, 4], [-14, -2], [-4, -10]], C, { belly: 0.2, inside: () => glow(g, -4, -8, 10, 5, 0.2) });
        part(g, [[-22, 6], [-25, -2], [-29, -14], [-24, -4], [-18, 3]], '#d8cdb6', { belly: 0, hi: 0.1 });
        part(g, [[-13, -1], [-14, -6], [-15, -10], [-11, -3]], '#cfc3aa', { belly: 0 });
        part(g, [[4, -12], [6, -20], [9, -12]], C, { belly: 0 });
        eye(g, -6, -3, 1.1);
        stroke(g, [[-24, 10], [-19, 11]], DK(C, 0.4), 0.8);
        g.restore();
      },
    }, pose);
  } };

  // HIPOPOTAM
  A.hipopotam = { box: [-72, -66, 56, 6], h: 56, draw(g, pose) {
    const C = '#83706d', Pk = '#b8877c';
    const idle = pose.mode === 'idle', ph = TAU * pose.p;
    const yawn = idle ? Math.max(0, Math.sin(ph) - 0.35) / 0.65 : 0;
    quad(g, {
      col: C, leg: C, fx: -20, hx: 22, legY: -18, fl: [9, 9, 7.5, 6.5, 6.4], hl: [9, 9, 8, 6.5, 6.4], h1: 0.06, h2: -0.08, A: 0.3, bend: 0.5, farDX: 4, farDY: -3, bob: 0.9,
      foot: (g, w) => ell(g, 0, 0, w * 1.05, w * 0.33, DK(C, 0.25)), belly: 0.2,
      tail: (g, bob) => tail(g, 36, -36 + bob, 3, 8, 2.4, 1.4, C, 0.4, 0.9, ph * 3),
      body: (bob) => [[-28, -38 + bob], [-16, -50 + bob], [6, -52 + bob], [28, -48 + bob], [38, -38 + bob], [37, -24 + bob], [26, -14 + bob], [0, -12 + bob], [-22, -14 + bob], [-30, -24 + bob]],
      bodyInside: (g, b) => { ell(g, 0, -13, 30, 6, rgba(Pk, 0.6)); glow(g, 2, -48, 28, 6, 0.25); fur(g, b, '#4a3b39', 40, 2, 17, 0.1, 0.1); },
      front: (g, bob) => {
        g.save(); g.translate(-30, -34 + bob);
        const op = yawn * 0.9;
        // żuchwa
        g.save(); g.translate(-8, 4); g.rotate(op * 0.75);
        part(g, [[6, -2], [-14, -1], [-20, 4], [-16, 9], [4, 8]], DK(C, 0.05), { belly: 0.2 });
        if (op > 0.05) { part(g, [[4, -2], [-14, -1], [-16, 2], [-12, 4], [2, 4]], '#c96f72', { belly: 0 }); ell(g, -12, -1, 1, 2.2, '#f1ead8'); }
        g.restore();
        g.save(); g.translate(-8, 2); g.rotate(-op * 0.55);
        if (op > 0.05) { part(g, [[6, 0], [-14, 0], [-18, -2], [-12, -5], [4, -4]], '#b8585d', { belly: 0 }); ell(g, -13, 1, 1, 2.4, '#f1ead8'); }
        part(g, [[10, -14], [2, -16], [-10, -12], [-20, -9], [-24, -4], [-21, 2], [-8, 3], [8, 2]], C, { belly: 0.15, inside: () => glow(g, -10, -11, 10, 4, 0.25) });
        ell(g, -21, -8, 1.6, 1.2, '#3e302e'); ell(g, -17, -9, 1.4, 1.1, '#3e302e');
        g.restore();
        part(g, [[4, -16], [10, -20], [12, -16]], C, { belly: 0 }); ell(g, 9.5, -17.5, 1, 1.4, Pk);
        part(g, [[-4, -17], [0, -20], [3, -16]], C, { belly: 0 });
        eye(g, -1, -13, 1.15);
        g.restore();
      },
    }, pose);
  } };

  // WIELBŁĄD
  A.wielblad = { box: [-70, -106, 52, 6], h: 98, draw(g, pose) {
    const C = '#c39e68';
    const idle = pose.mode === 'idle', ph = TAU * pose.p, chew = idle ? Math.sin(ph * 6) * 0.8 : 0;
    quad(g, {
      col: C, leg: C, fx: -17, hx: 18, legY: -54, fl: [25, 28, 5, 3.2, 3.6], hl: [24, 28, 6.4, 3.2, 3.6], h1: 0.3, h2: -0.4, A: 0.38, bend: 0.85, farDX: 3, farDY: -2.5, bob: 1.6,
      foot: (g, w) => { ell(g, -0.5, -0.2, w * 1.3, w * 0.5, DK(C, 0.18)); }, belly: 0.2,
      tail: (g, bob) => tail(g, 26, -68 + bob, 4, 18, 1.6, 1, C, 0.12, idle ? 0.8 : 0.4, ph * 2, { tuft: 2.6, tuftCol: '#6b4f30' }),
      body: (bob) => [[-24, -64 + bob], [-14, -72 + bob], [-6, -88 + bob], [6, -92 + bob], [16, -84 + bob], [24, -72 + bob], [29, -62 + bob], [24, -50 + bob], [0, -48 + bob], [-20, -50 + bob], [-26, -56 + bob]],
      bodyInside: (g, b) => { glow(g, 0, -88, 12, 8, 0.28); fur(g, b, '#8a6a3e', 60, 2.6, 23, 0.16); },
      front: (g, bob) => {
        // szyja w kształcie U
        neck(g, -18, -66 + bob, -38, -62 + bob, 8, 5.5, C, { bow: 2.5 });
        neck(g, -38, -62 + bob, -47, -82 + bob, 5.6, 4.4, C, { bow: -1 });
        ell(g, -38.5, -62 + bob, 5.4, 5.4, C);
        stroke(g, [[-25, -60 + bob], [-34, -57 + bob], [-41, -59 + bob]], rgba('#6b4f30', 0.5), 2.4);
        g.save(); g.translate(-48, -84 + bob); g.rotate(-0.15);
        part(g, [[-1, -6], [6, -5], [7, 1], [2, 4], [-10, 6], [-14, 4 + chew * 0.3], [-14, 0], [-6, -4]], C, { belly: 0 });
        part(g, [[-14, 3], [-10, 5], [-10, 8 + chew], [-14, 7 + chew]], DK(C, 0.12), { belly: 0 });
        part(g, [[2, -5], [5, -9], [6, -4]], C, { belly: 0 });
        eye(g, -3, -1.5, 1.1); stroke(g, [[-5, -3.6], [-1.5, -3.8]], DK(C, 0.4), 0.8);
        g.restore();
      },
    }, pose);
  } };

  // NIEDŹWIEDŹ i PANDA – wspólna sylwetka
  function bear(g, pose, o) {
    const idle = pose.mode === 'idle', ph = TAU * pose.p;
    quad(g, {
      col: o.C, leg: o.L, fx: -20, hx: 21, legY: -25, fl: [12, 12, 7, 5.4, 4.8], hl: [12, 12.5, 8, 5.2, 4.8], h1: 0.18, h2: -0.3, A: 0.34, bend: 0.75, farDX: 3.5, farDY: -2.5, bob: 1.3,
      foot: paw(DK(o.L, 0.15)), belly: 0.22,
      tail: (g, bob) => ell(g, 32, -38 + bob, 4, 3.5, o.C),
      body: (bob) => [[-28, -38 + bob], [-20, -50 + bob], [-6, -52 + bob], [14, -46 + bob], [28, -46 + bob], [34, -38 + bob], [33, -26 + bob], [22, -20 + bob], [0, -19 + bob], [-22, -21 + bob], [-30, -28 + bob]],
      bodyInside: (g, b) => { if (o.band) o.band(g, b); glow(g, -6, -48, 24, 6, 0.22); fur(g, b, DK(o.C, 0.5), 110, 3, 29, 0.2, 0.25); },
      front: (g, bob) => {
        const nod = idle ? Math.sin(ph) * 2.2 : Math.sin(ph * 2) * 0.8, chew = o.chew && idle ? Math.sin(ph * 8) * 0.8 : 0;
        g.save(); g.translate(-31, -40 + bob + nod);
        part(g, [[-6, -10], [6, -10], [11, -2], [9, 7], [0, 11], [-10, 10], [-17, 6 + chew * 0.4], [-19, 2], [-13, -4]], o.H, { belly: 0.12, inside: () => { if (o.mask) o.mask(g); glow(g, -4, -6, 8, 5, 0.22); } });
        part(g, [[-19, 0], [-17, -2], [-14, 0], [-16, 3]], '#1d1915', { belly: 0 });
        part(g, [[1, -9], [3, -15], [9, -12], [7, -6]], o.E, { belly: 0 });
        part(g, [[-4, -9], [-4, -14], [1, -12], [0, -8]], DK(o.E, 0.2), { belly: 0 });
        eye(g, -6, -2.5, 1.2);
        g.restore();
      },
    }, pose);
  }
  A.niedzwiedz = { box: [-62, -64, 52, 6], h: 58, draw(g, pose) {
    bear(g, pose, { C: '#6c4a2f', L: '#5b3d26', H: '#6c4a2f', E: '#5a3c24' });
  } };
  A.panda = { box: [-62, -64, 52, 6], h: 54, draw(g, pose) {
    bear(g, pose, { C: '#ece8dc', L: '#262422', H: '#f0ece2', E: '#262422', chew: 1,
      band: (g, b) => { part(g, [[-24, -48], [-12, -52], [-6, -40], [-10, -24], [-20, -24], [-26, -34]], '#262422', { belly: 0 }); },
      mask: (g) => { part(g, [[-11, -5], [-6, -7.5], [-2, -5], [-3, 0], [-7, 2], [-11, 0.5]], '#2a2724', { belly: 0, hi: 0.05 }); } });
  } };

  // KRÓLIK
  A.krolik = { box: [-28, -40, 26, 5], h: 34, draw(g, pose) {
    const C = '#9b8468', idle = pose.mode === 'idle', ph = TAU * pose.p;
    // marsz = kicanie: 0..0.5 wybicie, 0.5..1 lądowanie
    const k = idle ? 0 : Math.sin(ph * 0.5 * TAU / TAU * Math.PI), stretch = idle ? 0 : Math.sin(pose.p * Math.PI);
    const ear = idle ? Math.sin(ph * 2) * 0.12 : -stretch * 0.25, sniff = idle ? Math.sin(ph * 9) * 0.3 : 0;
    g.save(); g.translate(0, -stretch * 1.5);
    // tylna noga (duża, złożona)
    const hl = stretch;
    limb(g, 7, -7, 0.8 - hl * 1.7, 6, -2.2 + hl * 1.7, 9, 5.5, 3.2, 2.2, DK(C, 0.1), { foot: (g, w) => ell(g, -w, 0, w * 1.8, w * 0.6, DK(C, 0.18)) });
    part(g, [[-9, -12], [-3, -19 - stretch * 1.5], [8, -18 - stretch], [15, -12], [15, -4], [8, 0], [-4, 0], [-10, -4]], C,
      { belly: 0.15, inside: (b) => { glow(g, 2, -17, 10, 4, 0.25); fur(g, b, '#5d4b37', 40, 1.8, 41, 0.2); } });
    ell(g, 15, -10, 2.6, 2.5, '#efe9dc');
    // przednie łapki
    limb(g, -6, -5, -0.2 + stretch * 0.9, 3, 0.1, 3, 2, 1.6, 1.4, LI(C, 0.05));
    // głowa
    g.save(); g.translate(-9, -17 - stretch);
    g.save(); g.translate(2, -4); g.rotate(-0.25 + ear); part(g, [[-1.5, 0], [-2.5, -10], [-1, -16], [1.5, -10], [1.5, 0]], C, { belly: 0, inside: () => ell(g, -0.6, -8, 0.8, 5, '#c79c8e') }); g.restore();
    g.save(); g.translate(5, -4); g.rotate(0.05 + ear * 0.8); part(g, [[-1.5, 0], [-2.2, -10], [-0.5, -15], [1.8, -10], [1.5, 0]], DK(C, 0.12), { belly: 0 }); g.restore();
    part(g, [[-2, -5], [5, -5], [8, 0], [5, 5], [-3, 6], [-7, 3], [-7, -1]], C, { belly: 0.1 });
    ell(g, -6.8, 1 + sniff * 0.3, 1.1, 0.9, '#6e4c43'); eye(g, -2.4, -1.5, 1.05);
    g.restore(); g.restore();
  } };

  // PINGWIN (królewski)
  A.pingwin = { box: [-16, -48, 16, 4], h: 44, draw(g, pose) {
    const idle = pose.mode === 'idle', ph = TAU * pose.p;
    const wad = idle ? 0 : Math.sin(ph) * 0.12, flap = idle ? Math.max(0, Math.sin(ph * 2)) * 0.6 : 0.1, look = idle ? Math.sin(ph) * 1.2 : 0;
    // stopy
    const fA = idle ? 0 : Math.max(0, Math.sin(ph)) * 2.2, fB = idle ? 0 : Math.max(0, -Math.sin(ph)) * 2.2;
    ell(g, -4, -0.6 - fA, 4.2, 1.4, '#3a3532'); ell(g, 3, -0.8 - fB, 4.2, 1.4, '#2d2926');
    g.save(); g.translate(0, -1); g.rotate(wad);
    // skrzydło dalsze
    g.save(); g.translate(3, -26); g.rotate(-0.25 - flap * 0.6); part(g, [[-1, 0], [2, 0], [3, 12], [1, 17], [-1, 12]], '#1e2226', { belly: 0 }); g.restore();
    part(g, [[-5, -40], [3, -42], [8, -34], [10, -18], [8, -4], [0, 0], [-7, -2], [-10, -14], [-9, -28]], '#262b31',
      { belly: 0.1, hi: 0.3, inside: (b) => { glow(g, 2, -36, 6, 5, 0.25, '#9fb3c8'); } });
    // biały brzuch
    part(g, [[-7, -30], [-1, -32], [3, -24], [4, -10], [1, -2], [-6, -3], [-9, -14]], '#efece4', { belly: 0.18, hi: 0.1 });
    part(g, [[-6, -34], [-1, -35], [1, -30], [-6, -28]], '#f0ad44', { belly: 0 }); // złota plama
    // głowa
    g.save(); g.translate(-3 + look * 0.3, -40);
    part(g, [[-5, -3], [2, -6], [6, -1], [4, 4], [-4, 5], [-7, 2]], '#22272d', { belly: 0, hi: 0.25 });
    part(g, [[2, 0], [5, -2], [6, 2], [3, 4]], '#e79c3a', { belly: 0 });
    part(g, [[-6, 0], [-14, 1.5], [-6, 2.5]], '#2b2b2b', { belly: 0 }); stroke(g, [[-7, 1.6], [-12, 1.8]], '#d4793a', 0.9);
    eye(g, -2.2, -1.2, 0.9);
    g.restore();
    // skrzydło bliższe
    g.save(); g.translate(-1, -27); g.rotate(-0.15 - flap); part(g, [[-1.5, 0], [2.5, 0], [3, 13], [0.5, 18], [-2, 12]], '#2c3238', { belly: 0, hi: 0.25 }); g.restore();
    g.restore();
  } };

  // FLAMING
  A.flaming = { box: [-24, -82, 20, 4], h: 76, draw(g, pose) {
    const C = '#e79a92', idle = pose.mode === 'idle', ph = TAU * pose.p, L = '#d5776f';
    const sw = idle ? 0 : Math.sin(ph) * 0.45, lift = idle ? 0 : Math.max(0, Math.cos(ph));
    const sw2 = idle ? 0 : Math.sin(ph + Math.PI) * 0.45, lift2 = idle ? 0 : Math.max(0, Math.cos(ph + Math.PI));
    const legW = [1.2, 1, 0.9];
    // dalsza noga (w spoczynku podkulona – stoi na jednej nodze)
    if (idle) limb(g, 3, -40, 0.9, 13, -2.4, 12, 1.3, 1.2, 1, DK(L, 0.2));
    else limb(g, 3, -40 - lift2 * 2, 0.15 + sw2, 20, -0.1 - lift2 * 1.2, 20, ...legW, DK(L, 0.2), { foot: (g, w) => ell(g, -2, 0, 3.5, 0.9, DK(L, 0.3)) });
    limb(g, 0, -40 - lift * 2, sw * (idle ? 0 : 1), 20, -lift * 1.2, 20, ...legW, L, { foot: (g, w) => ell(g, -2, 0, 3.5, 0.9, DK(L, 0.2)) });
    const bob = idle ? Math.sin(ph) * 0.6 : -Math.abs(Math.sin(ph)) * 0.8;
    g.save(); g.translate(0, bob);
    part(g, [[-9, -48], [0, -52], [12, -50], [19, -45], [14, -41], [4, -38], [-6, -39], [-11, -43]], C, { belly: 0.15, inside: (b) => { glow(g, 0, -50, 10, 3, 0.3); fur(g, b, '#b8564e', 30, 2.4, 51, 0.25, 1.3); } });
    part(g, [[0, -47], [10, -48], [19, -45], [12, -43]], '#c9615e', { belly: 0 });
    stroke(g, [[17, -46], [21, -44]], '#2a2524', 1.4);
    // szyja w kształcie S i głowa
    const hb = idle ? Math.sin(ph * 2) * 1.5 : Math.sin(ph * 2) * 0.8;
    const nk = [[-7, -46], [-12, -54], [-8, -62], [-6, -70 + hb], [-10, -75 + hb]];
    stroke(g, nk, C, 3.4); stroke(g, nk.map((p) => [p[0] - 0.6, p[1] - 0.4]), LI(C, 0.2), 1.2);
    g.save(); g.translate(-11, -76 + hb);
    part(g, [[-3, -2], [2, -3], [4, 0], [1, 2.5], [-3, 2]], C, { belly: 0 });
    part(g, [[-3, -1], [-8, 0], [-11, 3.5], [-10, 5.5], [-7, 3], [-3, 2]], '#efe6d6', { belly: 0 });
    part(g, [[-9, 2], [-11, 3.5], [-10, 5.5], [-8, 3.6]], '#222', { belly: 0 });
    eye(g, -0.5, -0.5, 0.75);
    g.restore(); g.restore();
  } };

  // ŻÓŁW (lądowy)
  A.zolw = { box: [-32, -26, 28, 4], h: 22, draw(g, pose) {
    const C = '#7a7454', S = '#6a5636', idle = pose.mode === 'idle', ph = TAU * pose.p;
    const head = idle ? (Math.sin(ph) + 1) / 2 : 1;
    const legs = [[-10, 0.5, 0], [10, 0, 0], [-10, 0, 1], [10, 0.5, 1]];
    legs.forEach(([x, off, near]) => {
      const t = ph + off * TAU, sw = idle ? 0 : Math.sin(t) * 0.35, lift = idle ? 0 : Math.max(0, Math.cos(t)) * 1.2;
      limb(g, x + (near ? 0 : 3), -7 - lift + (near ? 0 : -2), sw, 4, 0, 4, 3.4, 3, 2.8, near ? C : DK(C, 0.22), { foot: (g, w) => ell(g, -0.5, 0, w * 1.2, w * 0.5, DK(C, 0.3)) });
    });
    g.save(); g.translate(-16 - head * 5, -9);
    part(g, [[4, -3], [-3, -4], [-7, -1], [-6, 3], [0, 4], [5, 2]], C, { belly: 0.1 });
    eye(g, -3, -1, 0.9); stroke(g, [[-6.5, 1.5], [-3, 2]], DK(C, 0.4), 0.6);
    g.restore();
    ell(g, 16, -5, 3, 1.5, C);
    const bob = idle ? 0 : Math.abs(Math.sin(ph)) * 0.6;
    part(g, [[-17, -7 - bob], [-12, -17 - bob], [0, -21 - bob], [12, -17 - bob], [18, -8 - bob], [14, -5], [0, -4.5], [-14, -5]], S, {
      belly: 0.25, inside: (b) => {
        g.strokeStyle = rgba('#e3cf9a', 0.55); g.lineWidth = 1;
        const cells = [[-8, -15], [1, -17], [10, -14], [-12, -9], [-3, -10], [6, -10], [14, -9]];
        cells.forEach(([x, y]) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.5; g.lineTo(x + Math.cos(a) * 4.6, y - bob + Math.sin(a) * 3.2); } g.closePath(); g.stroke(); ell(g, x - 0.8, y - bob - 0.6, 2.2, 1.4, rgba('#c8a868', 0.35)); });
        glow(g, -2, -18, 10, 4, 0.3);
      } });
    stroke(g, [[-16, -6.5], [0, -5], [17, -6.5]], '#4d3f28', 1.6);
  } };

  // MAŁPA
  A.malpa = { box: [-34, -50, 40, 5], h: 46, draw(g, pose) {
    const C = '#6c4b30', F = '#d2b08c', idle = pose.mode === 'idle', ph = TAU * pose.p;
    quad(g, {
      col: C, leg: C, fx: -10, hx: 10, legY: -25, legYh: -19, fl: [12, 13, 3.4, 2.6, 2.4], hl: [9, 10, 4.6, 3, 2.6], fa1: 0.05, h1: 0.75, h2: -1.15, A: 0.42, bend: 0.9, farDX: 2.5, farDY: -2, bob: 1.6,
      foot: paw('#3d2a1b'), belly: 0.2,
      tail: (g, bob) => {
        const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10, a = -0.6 + t * 3.3 + (idle ? Math.sin(ph + t * 2) * 0.35 : Math.sin(ph * 2 + t) * 0.2); pts.push([14 + t * 10 + Math.sin(a) * 4, -22 + bob - t * 20 - Math.cos(a) * 3]); }
        stroke(g, pts, DK(C, 0.1), 2);
      },
      body: (bob) => [[-16, -32 + bob], [-10, -38 + bob], [2, -35 + bob], [13, -28 + bob], [16, -21 + bob], [11, -15 + bob], [0, -16 + bob], [-11, -21 + bob], [-17, -26 + bob]],
      bodyInside: (g, b) => { fur(g, b, '#2f1f12', 40, 2, 61, 0.12, 0.7); glow(g, -6, -35, 10, 4, 0.22); },
      front: (g, bob) => {
        const tilt = idle ? Math.sin(ph) * 0.2 : 0;
        g.save(); g.translate(-17, -39 + bob); g.rotate(tilt);
        part(g, [[-6, -7], [3, -8], [7, -2], [5, 5], [-2, 7], [-8, 4], [-9, -2]], C, { belly: 0.1 });
        ell(g, 5, -1, 3, 3.5, '#c3967a'); ell(g, 5, -1, 1.6, 2, '#8e6750');
        part(g, [[-7, -4], [-1, -5], [1, -1], [0, 4], [-4, 6], [-9, 4], [-10, 0]], F, { belly: 0.1 });
        eye(g, -6, -2, 0.95); eye(g, -2.5, -2.2, 0.9);
        ell(g, -8.5, 2, 1, 0.6, '#4a3326');
        g.restore();
      },
    }, pose);
  } };

  // FOKA
  A.foka = { box: [-38, -30, 40, 4], h: 26, draw(g, pose) {
    const C = '#8e9192', idle = pose.mode === 'idle', ph = TAU * pose.p;
    const und = idle ? 0 : Math.sin(ph), head = idle ? Math.sin(ph) * 0.3 : -0.1;
    // ciało jak gąsienica: przód podnosi się, tył dociąga
    const y1 = idle ? 0 : Math.max(0, und) * 3, y2 = idle ? 0 : Math.max(0, -und) * 3;
    const body = [[-22, -14 - y1], [-14, -20 - y1], [0, -15 - (y1 + y2) * 0.8], [14, -10 - y2], [26, -6], [33, -4], [30, -1], [14, 0], [0, 0], [-16, 0], [-22, -4]];
    part(g, body, C, { belly: 0.25, inside: (b) => { seed(71); for (let i = 0; i < 26; i++) ell(g, b[0] + rnd() * (b[2] - b[0]), b[1] + rnd() * (b[3] - b[1]) * 0.7, 0.9 + rnd(), 0.6 + rnd() * 0.6, rgba('#3d4146', 0.35)); glow(g, -6, -18, 14, 4, 0.3, '#eef5fa'); } });
    // płetwy
    part(g, [[30, -4], [38, -8], [37, 0], [31, 0]], DK(C, 0.2), { belly: 0 });
    g.save(); g.translate(-11, -4 - y1 * 0.5); g.rotate(0.4 + und * 0.3); part(g, [[-2, -1], [3, 0], [1, 7], [-3, 6]], DK(C, 0.15), { belly: 0 }); g.restore();
    g.save(); g.translate(-22, -17 - y1); g.rotate(head);
    part(g, [[-2, -7], [5, -5], [6, 1], [0, 5], [-8, 4], [-12, 1], [-11, -3]], C, { belly: 0.15, inside: () => glow(g, -3, -5, 6, 3, 0.3, '#eef5fa') });
    ell(g, -11.4, -0.5, 1.2, 1, '#2a2b2d'); eye(g, -5, -2.5, 1.35);
    g.strokeStyle = 'rgba(240,240,235,.5)'; g.lineWidth = 0.4; [[-10, 1, -15, 0], [-10, 1.5, -15, 2.5]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
    g.restore();
  } };

  // KANGUR
  A.kangur = { box: [-30, -74, 44, 5], h: 66, draw(g, pose) {
    const C = '#a77b52', B = '#d8b88f', idle = pose.mode === 'idle', p = pose.p, ph = TAU * p;
    // skok: 0–0.25 przysiad, 0.25–0.75 lot (nogi do tyłu), 0.75–1 lądowanie
    const air = idle ? 0 : Math.sin(Math.min(1, Math.max(0, (p - 0.15) / 0.7)) * Math.PI);
    const crouch = idle ? 0 : (p < 0.15 ? p / 0.15 : p > 0.85 ? (1 - p) / 0.15 : 0);
    const lean = idle ? 0 : air * 0.5;
    g.save(); g.translate(0, crouch * 4);
    // ogon (podpora)
    tail(g, 8, -17, 6, 34, 6.5, 2.6, C, 1.2 - air * 0.35, idle ? 0.25 : 0.15, ph);
    // dalsza noga
    const legA = 0.9 - air * 1.4 + crouch * 0.4;
    limb(g, 6, -22, legA, 13, -2.3 + air * 1.1 - crouch * 0.4, 12, 6, 3, 2.4, DK(C, 0.22), { foot: (g, w) => ell(g, -6, 0, 8, 1.6, DK(C, 0.35)) });
    g.save(); g.translate(2, -24); g.rotate(-0.25 - lean);
    part(g, [[-8, -30], [0, -36], [8, -26], [10, -10], [6, 2], [-4, 4], [-10, -6], [-11, -20]], C, { belly: 0.2, inside: (b) => { part(g, [[-9, -24], [-3, -26], [-1, -12], [-3, 2], [-9, -4]], B, { belly: 0 }); glow(g, 2, -30, 6, 6, 0.24); fur(g, b, '#5d3f22', 40, 2, 81, 0.18, 0.2); } });
    // łapki
    limb(g, -7, -24, -0.6 + (idle ? Math.sin(ph * 2) * 0.15 : 0), 5, -0.4, 5, 1.6, 1.3, 1.2, DK(C, 0.05));
    // głowa
    const look = idle ? Math.sin(ph) * 0.12 : 0;
    g.save(); g.translate(-3, -38); g.rotate(look + lean * 0.5);
    part(g, [[0, -9], [3, -15], [5, -9]], C, { belly: 0, inside: () => ell(g, 3, -11, 0.8, 2.5, '#d3a088') });
    part(g, [[3, -8], [7, -14], [8, -7]], DK(C, 0.15), { belly: 0 });
    part(g, [[-4, -6], [5, -7], [8, -2], [4, 3], [-6, 4], [-12, 2], [-11, -2]], C, { belly: 0.1 });
    ell(g, -11.5, 0, 1.2, 1, '#2c211b'); eye(g, -3, -2, 1.05);
    g.restore(); g.restore();
    // bliższa noga
    limb(g, 2, -21, legA, 13, -2.3 + air * 1.1 - crouch * 0.4, 12, 6.5, 3.2, 2.5, C, { foot: (g, w) => ell(g, -6, 0, 8.5, 1.7, DK(C, 0.3)) });
    g.restore();
  } };

  // KROKODYL
  A.krokodyl = { box: [-88, -31, 88, 6], h: 24, draw(g, pose) {
    g.save(); g.scale(1.32, 1.32);
    const C = '#5e6a3a', B = '#bcb58a', idle = pose.mode === 'idle', ph = TAU * pose.p;
    const jaw = idle ? Math.max(0, Math.sin(ph) - 0.3) / 0.7 : 0, sway = idle ? Math.sin(ph) * 0.15 : Math.sin(ph) * 0.3;
    // ogon
    const tl = []; for (let i = 0; i <= 8; i++) { const t = i / 8; tl.push([20 + t * 42, -6 + t * 3 + Math.sin(ph + t * 3) * sway * t * 8]); }
    for (let i = 0; i < tl.length - 1; i++) { g.beginPath(); g.moveTo(tl[i][0], tl[i][1]); g.lineTo(tl[i + 1][0], tl[i + 1][1]); g.strokeStyle = i % 2 ? DK(C, 0.08) : C; g.lineWidth = 9 - i; g.lineCap = 'round'; g.stroke(); }
    for (let i = 1; i < tl.length - 1; i++) part(g, [[tl[i][0] - 2, tl[i][1] - 5 + i * 0.4], [tl[i][0], tl[i][1] - 8 + i * 0.5], [tl[i][0] + 2, tl[i][1] - 5 + i * 0.4]], DK(C, 0.15), { belly: 0 });
    const legs = [[-14, 0.5, 0], [14, 0, 0], [-14, 0, 1], [14, 0.5, 1]];
    legs.forEach(([x, off, near]) => {
      const t = ph + off * TAU, sw = idle ? 0 : Math.sin(t) * 0.5, lift = idle ? 0 : Math.max(0, Math.cos(t)) * 1.5;
      limb(g, x + (near ? 0 : 3), -6 - lift + (near ? 1 : -2), 0.9 + sw, 5, -1.5, 4, 2.6, 2, 1.8, near ? C : DK(C, 0.25), { foot: (g, w) => ell(g, -1.5, 0, w * 1.6, w * 0.6, DK(C, 0.3)) });
    });
    part(g, [[-24, -8], [-14, -13], [0, -14], [16, -12], [26, -8], [24, -2], [0, -1], [-22, -2]], C, { belly: 0.25, inside: (b) => {
      ell(g, 0, -1.5, 22, 2.5, rgba(B, 0.6));
      for (let x = -20; x < 24; x += 4.4) { part(g, [[x - 1.6, -12], [x, -15.5], [x + 1.6, -12]], DK(C, 0.2), { belly: 0 }); ell(g, x, -10, 1.6, 1.1, rgba('#2c341a', 0.4)); }
      glow(g, -4, -13, 18, 3, 0.25);
    } });
    // głowa z ruchomą szczęką
    g.save(); g.translate(-24, -6);
    g.save(); g.rotate(-jaw * 0.08); part(g, [[2, 0], [-20, 1], [-30, 2], [-30, 4], [-16, 5], [2, 5]], DK(C, 0.08), { belly: 0.2 }); g.restore();
    g.save(); g.rotate(jaw * 0.4);
    if (jaw > 0.05) { part(g, [[2, -1], [-28, -1], [-28, 1], [2, 2]], '#d9b6a0', { belly: 0 }); g.fillStyle = '#f2ecdc'; for (let x = -26; x < 0; x += 3) { g.beginPath(); g.moveTo(x, -1); g.lineTo(x + 1, 1); g.lineTo(x + 2, -1); g.fill(); } }
    part(g, [[4, -8], [-4, -9], [-18, -6], [-30, -3], [-31, 0], [-14, 0], [4, 0]], C, { belly: 0.15, inside: () => { glow(g, -10, -7, 10, 2, 0.25); ell(g, -29, -2.5, 1, 0.7, '#2c331b'); } });
    ell(g, -1, -9, 3, 2.2, C); eye(g, -1.5, -9.3, 1);
    g.fillStyle = '#efe8d5'; for (let x = -26; x < -4; x += 4) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 1, 2); g.lineTo(x + 2, 0); g.fill(); }
    g.restore(); g.restore();
    g.restore();
  } };

  // KOALA
  A.koala = { box: [-30, -44, 28, 5], h: 40, draw(g, pose) {
    const C = '#8f8d8a', idle = pose.mode === 'idle', ph = TAU * pose.p;
    quad(g, {
      col: C, leg: DK(C, 0.08), fx: -10, hx: 10, legY: -14, fl: [7, 7, 3.6, 3, 2.8], hl: [7, 7.5, 4.2, 3, 2.8], h1: 0.2, h2: -0.3, A: 0.36, bend: 0.8, farDX: 2.5, farDY: -2, bob: 1,
      foot: paw('#4c4a48'), belly: 0.2,
      body: (bob) => [[-16, -22 + bob], [-10, -28 + bob], [4, -27 + bob], [15, -22 + bob], [16, -14 + bob], [8, -10 + bob], [-6, -10 + bob], [-16, -14 + bob]],
      bodyInside: (g, b) => { ell(g, -6, -11, 9, 3, rgba('#ece6da', 0.6)); fur(g, b, '#ece8e0', 50, 1.8, 91, 0.25); glow(g, 0, -27, 10, 3, 0.25); },
      front: (g, bob) => {
        const nod = idle ? Math.sin(ph) * 1.5 : 0, chew = idle ? Math.sin(ph * 7) * 0.4 : 0;
        g.save(); g.translate(-15, -29 + bob + nod);
        // uszy
        [[3, -8, DK(C, 0.12)], [-8, -7, C]].forEach(([x, y, col]) => part(g, [[x - 5, y], [x - 4, y - 5], [x + 1, y - 7], [x + 5, y - 3], [x + 4, y + 2], [x - 2, y + 2]], col, { belly: 0, inside: (b) => fur(g, b, '#f4f0e8', 30, 1.6, 7, 0.5) }));
        part(g, [[-6, -7], [4, -7], [8, -1], [5, 6], [-3, 8], [-9, 5], [-10, -1]], C, { belly: 0.12, inside: () => glow(g, -3, -4, 6, 3, 0.25) });
        part(g, [[-7, -2], [-3, -3], [-2, 3 + chew], [-5, 5 + chew], [-8, 3]], '#2b2826', { belly: 0, hi: 0.3 });
        eye(g, -8.5, -3.5, 0.8); eye(g, -1.5, -3.8, 0.8);
        g.restore();
      },
    }, pose);
  } };

  // ---------- klatki ----------
  const WALK_N = 12, IDLE_N = 16;
  const FR = {};
  function render(type, mode, i, k) {
    const a = A[type], [x0, y0, x1, y1] = a.box, pad = 2;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil((x1 - x0 + pad * 2) * k)); c.height = Math.max(1, Math.ceil((y1 - y0 + pad * 2) * k));
    const g = c.getContext('2d'); g.scale(k, k); g.translate(-x0 + pad, -y0 + pad);
    a.draw(g, { mode, p: i / (mode === 'walk' ? WALK_N : IDLE_N) });
    return { c, x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
  }
  // k = piksele na jednostkę świata; zaokrąglamy do potęgi dwójki (mniej wariantów w pamięci).
  function bucket(k) { return Math.pow(2, Math.max(-2, Math.min(3, Math.ceil(Math.log2(Math.max(0.01, k)) * 2) / 2))); }
  function frame(type, mode, i, k) {
    if (SH[type]) return sheetFrame(type, mode, i);
    const b = bucket(k), key = type + mode + i + '@' + b;
    return FR[key] || (FR[key] = render(type, mode, i, b));
  }

  // ---------- grafika 3D (sprites/index.js): klatki z modeli Meshy zamiast rysowania kodem ----------
  // ?stary w adresie wyłącza grafikę 3D (porównanie). Wybiegi 3D: ENC3D[typ zwierzęcia albo '_'+biom] = { back, front, pool, block };
  // budynki i atrakcje: OBJ3D[nazwa obrazka w grze] (kiosk_lody, opiekun, wet, ogrod…).
  const SH = {}, ENC3D = {}, OBJ3D = {}, TEX3D = {};
  const OFF3D = new URLSearchParams(location.search).has('stary');
  const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => { console.error('Nie wczytano', src); res(null); }; im.src = src; });
  const cut = (im, sx, sy, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(im, sx, sy, w, h, 0, 0, w, h); return c; };
  function sheetFrame(type, mode, i) {
    const s = SH[type], walk = mode === 'walk', list = walk ? s.walk : s.idle;
    // gra liczy klatki dla WALK_N/IDLE_N – przeliczamy na liczbę klatek w arkuszu
    const n = walk ? WALK_N : IDLE_N, j = Math.min(list.length - 1, Math.floor(i / n * list.length));
    return list[j] || (list[j] = s.fr(walk ? j : s.m.walk + j));   // klatkę wycinamy dopiero przy pierwszym użyciu (mniej pamięci)
  }
  const ready = OFF3D || !window.ZOO_3D ? Promise.resolve() : Promise.all(Object.entries(window.ZOO_3D).map(async ([type, d]) => {
    if (d.animal && A[type] && !(window.ZOO_S2 && window.ZOO_S2[type])) {   // zwierzęta mają już klatki z Blendera (sprites2)
      const m = d.animal, im = await loadImg(m.file); if (!im) return;
      const fr = (n) => { const c = cut(im, (n % m.cols) * m.fw, Math.floor(n / m.cols) * m.fh, m.fw, m.fh); return { c, x: -m.ax / m.px, y: -m.ay / m.px, w: m.fw / m.px, h: m.fh / m.px }; };
      SH[type] = { m, fr, walk: new Array(m.walk).fill(null), idle: new Array(m.idle).fill(null) };
    }
    if (d.enc) {
      const L = { pool: d.enc.pool || null, block: d.enc.block || [] };
      for (const k of ['back', 'front']) { const e = d.enc[k], im = await loadImg(e.file); if (!im) return; L[k] = { c: cut(im, 0, 0, im.width, im.height), x: e.x, y: e.y, w: e.w, h: e.h }; }
      ENC3D[type] = L;
    }
    if (d.tex) { const im = await loadImg(d.tex.file); if (im) TEX3D[type] = { im, tile: d.tex.tile }; }
    if (d.obj) { const e = d.obj, im = await loadImg(e.file); if (im) OBJ3D[type] = { c: cut(im, 0, 0, im.width, im.height), x: e.x, y: e.y, w: e.w, h: e.h }; }
  }));
  const render2 = (type, mode, i, k) => SH[type] ? sheetFrame(type, mode, i) : render(type, mode, i, k);
  window.ZOO_ANIMALS = { A, frame, render: render2, WALK_N, IDLE_N, list: Object.keys(A), ready, ENC3D, OBJ3D, TEX3D,
    stats() { let n = 0, b = 0; Object.values(SH).forEach((s) => [...s.walk, ...s.idle].forEach((f) => { if (f) { n++; b += f.c.width * f.c.height * 4; } })); return { klatki: n, MB: Math.round(b / 1048576) }; }, clear() { Object.keys(FR).forEach((k) => delete FR[k]); } };
})();
