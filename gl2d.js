'use strict';
/* Moje Zoo – rysowanie świata na karcie graficznej (WebGL 2).
   Obiekt zwracany przez ZooGL.create(canvas) udaje ten kawałek CanvasRenderingContext2D, którego używa gra do rysowania
   świata: przekształcenia, obrazki (drawImage), wypełnienia i obrysy prostych kształtów, wzory (tekstury terenu),
   przycinanie prostokątem, mieszanie „lighter”. Wszystko trafia do jednego bufora trójkątów i jest wysyłane paczkami,
   więc klatka kosztuje kilkadziesiąt wywołań karty zamiast tysięcy operacji na procesorze.
   Tekstu ten kontekst nie rysuje – napisy i interfejs zostają na zwykłym płótnie 2D leżącym nad światem. */
(function () {
  const VS = `#version 300 es
in vec2 aPos; in vec2 aUv; in vec4 aCol; uniform vec2 uRes; out vec2 vUv; out vec4 vCol;
void main(){ vUv=aUv; vCol=aCol; gl_Position=vec4(aPos.x/uRes.x*2.0-1.0, 1.0-aPos.y/uRes.y*2.0, 0.0, 1.0); }`;
  const FS = `#version 300 es
precision mediump float; in vec2 vUv; in vec4 vCol; uniform sampler2D uTex; out vec4 o;
void main(){ o = texture(uTex, vUv) * vCol; }`;
  const MAXV = 6 * 4096, STRIDE = 8;
  const colCache = new Map();
  function parseColor(s) {
    let c = colCache.get(s); if (c) return c;
    c = [0, 0, 0, 1];
    if (s[0] === '#') {
      if (s.length === 4) c = [parseInt(s[1] + s[1], 16) / 255, parseInt(s[2] + s[2], 16) / 255, parseInt(s[3] + s[3], 16) / 255, 1];
      else c = [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255, s.length >= 9 ? parseInt(s.slice(7, 9), 16) / 255 : 1];
    } else if (s.startsWith('rgb')) {
      const p = s.slice(s.indexOf('(') + 1, s.lastIndexOf(')')).split(',').map(Number);
      c = [p[0] / 255, p[1] / 255, p[2] / 255, p.length > 3 ? p[3] : 1];
    } else if (s === 'transparent') c = [0, 0, 0, 0];
    else if (s === 'white') c = [1, 1, 1, 1];
    if (colCache.size > 4000) colCache.clear();
    colCache.set(s, c); return c;
  }

  function create(canvas, opts = {}) {
    let gl = null;
    try { gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: 'high-performance' }); } catch (e) {}
    if (!gl) return null;
    let prog, vbo, vao, uRes, white, glow, texMap, maxTex = 4096;
    const buf = new Float32Array(MAXV * STRIDE);
    let nv = 0, curTex = null, curBlend = 0, lost = false;
    const stats = { draws: 0, verts: 0, texBytes: 0, texCount: 0 };
    const G = { canvas, isGL: true, stats, texScale: opts.texScale || 1 };

    function init() {
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      gl.useProgram(prog);
      vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, buf.byteLength, gl.DYNAMIC_DRAW);
      const at = (name, n, off) => { const l = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, STRIDE * 4, off * 4); };
      at('aPos', 2, 0); at('aUv', 2, 2); at('aCol', 4, 4);
      uRes = gl.getUniformLocation(prog, 'uRes');
      gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      maxTex = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE));
      texMap = new Map(); stats.texBytes = 0; stats.texCount = 0;
      white = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, white);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      const gc = document.createElement('canvas'); gc.width = gc.height = 64; const gg = gc.getContext('2d');
      const rg = gg.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); gg.fillStyle = rg; gg.fillRect(0, 0, 64, 64);
      glow = upload(gc, false).tex;
      curTex = null; curBlend = 0; nv = 0;
    }
    function upload(src, repeat) {
      let w = src.naturalWidth || src.videoWidth || src.width, h = src.naturalHeight || src.videoHeight || src.height, s = src;
      let k = Math.min(1, maxTex / Math.max(w, h));
      if (!repeat && G.texScale < 1 && w * h > 128 * 128) k = Math.min(k, G.texScale);
      if (k < 1) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k)); const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, c.width, c.height); s = c; }
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      const bytes = Math.round(s.width * s.height * 4 * 1.33);
      stats.texBytes += bytes; stats.texCount++;
      curTex = null;
      return { tex, w, h, ver: src.__ver || 0, bytes };
    }
    function texOf(src, repeat) {
      let t = texMap.get(src);
      if (t && t.ver !== (src.__ver || 0)) { gl.deleteTexture(t.tex); stats.texBytes -= t.bytes; stats.texCount--; t = null; }
      if (!t) { flush(); t = upload(src, repeat); texMap.set(src, t); }
      return t;
    }
    G.touch = (c) => { c.__ver = (c.__ver || 0) + 1; };
    G.drop = (src) => { const t = texMap.get(src); if (t) { gl.deleteTexture(t.tex); stats.texBytes -= t.bytes; stats.texCount--; texMap.delete(src); } };
    G.preload = (src) => { if (!lost) texOf(src, false); };

    function flush() {
      if (!nv) return;
      gl.bindTexture(gl.TEXTURE_2D, curTex || white);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, buf.subarray(0, nv * STRIDE));
      gl.drawArrays(gl.TRIANGLES, 0, nv);
      stats.draws++; stats.verts += nv; nv = 0;
    }
    function setTex(t) { if (t !== curTex) { flush(); curTex = t; } }
    function need(n) { if (nv + n > MAXV) flush(); }
    function vert(x, y, u, v, r, g, b, a) { const o = nv * STRIDE; buf[o] = x; buf[o + 1] = y; buf[o + 2] = u; buf[o + 3] = v; buf[o + 4] = r; buf[o + 5] = g; buf[o + 6] = b; buf[o + 7] = a; nv++; }

    // ---------- stan jak w płótnie 2D ----------
    let m = [1, 0, 0, 1, 0, 0], alpha = 1, clip = null;
    const stack = [];
    G.fillStyle = '#000'; G.strokeStyle = '#000'; G.lineWidth = 1; G.lineCap = 'butt'; G.lineJoin = 'miter';
    G.font = ''; G.textAlign = 'left'; G.textBaseline = 'alphabetic'; G.imageSmoothingQuality = 'low'; G.imageSmoothingEnabled = true;
    let dash = null, comp = 'source-over';
    Object.defineProperty(G, 'globalAlpha', { get: () => alpha, set: (v) => { alpha = v; } });
    Object.defineProperty(G, 'globalCompositeOperation', { get: () => comp, set: (v) => { if (v === comp) return; flush(); comp = v; if (v === 'lighter') gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); } });
    G.save = () => { stack.push({ m: m.slice(), alpha, clip, fs: G.fillStyle, ss: G.strokeStyle, lw: G.lineWidth, dash, comp }); };
    G.restore = () => {
      const s = stack.pop(); if (!s) return;
      m = s.m; alpha = s.alpha; G.fillStyle = s.fs; G.strokeStyle = s.ss; G.lineWidth = s.lw; dash = s.dash;
      if (s.comp !== comp) G.globalCompositeOperation = s.comp;
      if (s.clip !== clip) { flush(); clip = s.clip; applyClip(); }
    };
    G.setTransform = (a, b, c, d, e, f) => { m = [a, b, c, d, e, f]; };
    G.resetTransform = () => { m = [1, 0, 0, 1, 0, 0]; };
    G.getTransform = () => ({ a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] });
    G.transform = (a, b, c, d, e, f) => { m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]]; };
    G.translate = (x, y) => { m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; };
    G.scale = (x, y) => { m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; };
    G.rotate = (t) => { const c = Math.cos(t), s = Math.sin(t); G.transform(c, s, -s, c, 0, 0); };
    G.setLineDash = (d) => { dash = d && d.length ? d : null; };
    G.fillText = () => {}; G.strokeText = () => {}; G.measureText = () => ({ width: 0 }); G.clearRect = () => {};
    const tx = (x, y) => m[0] * x + m[2] * y + m[4], ty = (x, y) => m[1] * x + m[3] * y + m[5];
    const scaleOf = () => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

    function applyClip() {
      if (!clip) { gl.disable(gl.SCISSOR_TEST); return; }
      gl.enable(gl.SCISSOR_TEST);
      const x0 = Math.max(0, Math.floor(clip[0])), y0 = Math.max(0, Math.floor(clip[1])), x1 = Math.min(canvas.width, Math.ceil(clip[2])), y1 = Math.min(canvas.height, Math.ceil(clip[3]));
      gl.scissor(x0, canvas.height - y1, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
    }

    // ---------- ścieżki ----------
    let subs = [], cur = null;
    G.beginPath = () => { subs = []; cur = null; };
    G.moveTo = (x, y) => { cur = { p: [tx(x, y), ty(x, y)], closed: false }; subs.push(cur); };
    G.lineTo = (x, y) => { if (!cur) return G.moveTo(x, y); cur.p.push(tx(x, y), ty(x, y)); };
    G.closePath = () => { if (cur) { cur.closed = true; const p = cur.p; cur = { p: [p[0], p[1]], closed: false }; subs.push(cur); } };
    G.rect = (x, y, w, h) => { G.moveTo(x, y); G.lineTo(x + w, y); G.lineTo(x + w, y + h); G.lineTo(x, y + h); G.closePath(); };
    G.ellipse = (x, y, rx, ry, rot, a0, a1, ccw) => {
      let sw = a1 - a0; if (ccw) { if (sw > 0) sw -= Math.PI * 2; if (sw < -Math.PI * 2) sw = -Math.PI * 2; } else if (sw > Math.PI * 2) sw = Math.PI * 2;
      const n = Math.max(6, Math.min(40, Math.ceil(Math.abs(sw) * Math.sqrt(Math.max(rx, ry) * scaleOf()) * 0.9)));
      const cr = Math.cos(rot), sr = Math.sin(rot);
      for (let i = 0; i <= n; i++) { const a = a0 + sw * i / n, px = Math.cos(a) * rx, py = Math.sin(a) * ry; const X = x + px * cr - py * sr, Y = y + px * sr + py * cr; if (i === 0 && !cur) G.moveTo(X, Y); else G.lineTo(X, Y); }
    };
    G.arc = (x, y, r, a0, a1, ccw) => G.ellipse(x, y, r, r, 0, a0, a1, ccw);
    G.arcTo = (x1, y1) => G.lineTo(x1, y1);
    G.quadraticCurveTo = (cx, cy, x, y) => {
      if (!cur) G.moveTo(cx, cy);
      const p = cur.p, n = 8, ax = p[p.length - 2], ay = p[p.length - 1], bx = tx(cx, cy), by = ty(cx, cy), ex = tx(x, y), ey = ty(x, y);
      for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; p.push(u * u * ax + 2 * u * t * bx + t * t * ex, u * u * ay + 2 * u * t * by + t * t * ey); }
    };
    G.bezierCurveTo = (c1x, c1y, c2x, c2y, x, y) => {
      if (!cur) G.moveTo(c1x, c1y);
      const p = cur.p, n = 10, ax = p[p.length - 2], ay = p[p.length - 1], bx = tx(c1x, c1y), by = ty(c1x, c1y), cx = tx(c2x, c2y), cy = ty(c2x, c2y), ex = tx(x, y), ey = ty(x, y);
      for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; p.push(u * u * u * ax + 3 * u * u * t * bx + 3 * u * t * t * cx + t * t * t * ex, u * u * u * ay + 3 * u * u * t * by + 3 * u * t * t * cy + t * t * t * ey); }
    };
    G.clip = () => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      subs.forEach((s) => { for (let i = 0; i < s.p.length; i += 2) { x0 = Math.min(x0, s.p[i]); x1 = Math.max(x1, s.p[i]); y0 = Math.min(y0, s.p[i + 1]); y1 = Math.max(y1, s.p[i + 1]); } });
      flush();
      clip = clip ? [Math.max(clip[0], x0), Math.max(clip[1], y0), Math.min(clip[2], x1), Math.min(clip[3], y1)] : [x0, y0, x1, y1];
      applyClip();
    };

    // wzór: { tex (obrazek), m: [a,b,c,d] przekształcenie wzoru w układzie użytkownika }
    G.createPattern = (img) => ({ isPattern: true, img, m: [1, 0, 0, 1], setTransform(M) { this.m = [M.a, M.b, M.c, M.d]; } });
    G.createLinearGradient = (x0, y0, x1, y1) => ({ isGrad: true, lin: [x0, y0, x1, y1], stops: [], addColorStop(t, c) { this.stops.push([t, parseColor(c)]); } });
    G.createRadialGradient = (x0, y0, r0, x1, y1, r1) => ({ isGrad: true, rad: [x1, y1, r1], stops: [], addColorStop(t, c) { this.stops.push([t, parseColor(c)]); } });
    function gradAt(g, t) {
      const s = g.stops; if (!s.length) return [0, 0, 0, 0];
      if (t <= s[0][0]) return s[0][1];
      for (let i = 1; i < s.length; i++) if (t <= s[i][0]) { const k = (t - s[i - 1][0]) / (s[i][0] - s[i - 1][0] || 1), a = s[i - 1][1], b = s[i][1]; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k]; }
      return s[s.length - 1][1];
    }
    function inv() { const d = m[0] * m[3] - m[1] * m[2] || 1e-9; return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d]; }

    G.fill = () => {
      const st = G.fillStyle; if (!st) return;
      let col = null, pat = null, grad = null, I = null, pw = 1, ph = 1, pi = null;
      if (typeof st === 'string') { col = parseColor(st); if (col[3] * alpha <= 0.002) return; setTex(null); }
      else if (st.isPattern) { const t = texOf(st.img, true); setTex(t.tex); pat = st; pw = t.w; ph = t.h; I = inv(); const d = pat.m[0] * pat.m[3] - pat.m[1] * pat.m[2] || 1e-9; pi = [pat.m[3] / d, -pat.m[1] / d, -pat.m[2] / d, pat.m[0] / d]; }
      else if (st.isGrad) { grad = st; I = inv(); setTex(null); if (grad.rad) { col = grad.stops.length ? grad.stops[0][1] : [0, 0, 0, 0]; grad = null; } }
      else return;
      for (const s of subs) {
        const p = s.p, n = p.length / 2; if (n < 3) continue;
        need((n - 2) * 3);
        const emit = (i) => {
          const x = p[i * 2], y = p[i * 2 + 1];
          if (pat) { const ux = I[0] * x + I[2] * y + I[4], uy = I[1] * x + I[3] * y + I[5]; vert(x, y, (pi[0] * ux + pi[2] * uy) / pw, (pi[1] * ux + pi[3] * uy) / ph, alpha, alpha, alpha, alpha); }
          else if (grad) { const ux = I[0] * x + I[2] * y + I[4], uy = I[1] * x + I[3] * y + I[5], L = grad.lin, dx = L[2] - L[0], dy = L[3] - L[1]; const c = gradAt(grad, Math.max(0, Math.min(1, ((ux - L[0]) * dx + (uy - L[1]) * dy) / (dx * dx + dy * dy || 1)))), a = c[3] * alpha; vert(x, y, 0, 0, c[0] * a, c[1] * a, c[2] * a, a); }
          else { const a = col[3] * alpha; vert(x, y, 0, 0, col[0] * a, col[1] * a, col[2] * a, a); }
        };
        for (let i = 1; i < n - 1; i++) { if (nv + 3 > MAXV) flush(); emit(0); emit(i); emit(i + 1); }
      }
    };
    G.fillRect = (x, y, w, h) => {
      const st = G.fillStyle;
      if (st && st.isGrad && st.rad) {          // poświata: gotowa tekstura rozmywającego się koła
        const c = st.stops.length ? st.stops[0][1] : [1, 1, 1, 1], a = c[3] * alpha, R = st.rad[2];
        setTex(glow); quad(st.rad[0] - R, st.rad[1] - R, R * 2, R * 2, 0, 0, 1, 1, c[0] * a, c[1] * a, c[2] * a, a); return;
      }
      const s0 = subs, c0 = cur; subs = []; cur = null; G.rect(x, y, w, h); G.fill(); subs = s0; cur = c0;
    };
    G.strokeRect = (x, y, w, h) => { const s0 = subs, c0 = cur; subs = []; cur = null; G.rect(x, y, w, h); G.stroke(); subs = s0; cur = c0; };
    function seg(x0, y0, x1, y1, hw, r, g, b, a, cap) {
      let dx = x1 - x0, dy = y1 - y0; const L = Math.hypot(dx, dy); if (L < 1e-4) return;
      dx /= L; dy /= L; const nx = -dy * hw, ny = dx * hw;
      if (cap) { x0 -= dx * hw * 0.7; y0 -= dy * hw * 0.7; x1 += dx * hw * 0.7; y1 += dy * hw * 0.7; }
      need(6);
      vert(x0 + nx, y0 + ny, 0, 0, r, g, b, a); vert(x1 + nx, y1 + ny, 0, 0, r, g, b, a); vert(x1 - nx, y1 - ny, 0, 0, r, g, b, a);
      vert(x0 + nx, y0 + ny, 0, 0, r, g, b, a); vert(x1 - nx, y1 - ny, 0, 0, r, g, b, a); vert(x0 - nx, y0 - ny, 0, 0, r, g, b, a);
    }
    G.stroke = () => {
      const st = G.strokeStyle; if (typeof st !== 'string') return;
      const c = parseColor(st), a = c[3] * alpha; if (a <= 0.002) return;
      setTex(null);
      const sc = scaleOf(), hw = Math.max(0.35, G.lineWidth * sc / 2), r = c[0] * a, g = c[1] * a, b = c[2] * a, cap = G.lineCap === 'round' || G.lineCap === 'square';
      const d = dash ? dash.map((v) => Math.max(0.5, v * sc)) : null;
      for (const s of subs) {
        const p = s.p, n = p.length / 2; if (n < 2) continue;
        let di = 0, left = d ? d[0] : 0, on = true;
        const joint = hw > 1.2 && !d;      // szerokie linie: zaokrąglone łączenia, żeby łuki nie miały szczelin
        for (let i = 0; i < n - 1; i++) {
          let x0 = p[i * 2], y0 = p[i * 2 + 1]; const x1 = p[i * 2 + 2], y1 = p[i * 2 + 3];
          if (!d) { seg(x0, y0, x1, y1, hw, r, g, b, a, cap && (i === 0 || i === n - 2) && n === 2); if (joint && i > 0) dot(x0, y0, hw, r, g, b, a); continue; }
          let L = Math.hypot(x1 - x0, y1 - y0); const ux = (x1 - x0) / (L || 1), uy = (y1 - y0) / (L || 1);
          while (L > 0) {
            const step = Math.min(L, left);
            if (on) seg(x0, y0, x0 + ux * step, y0 + uy * step, hw, r, g, b, a, false);
            x0 += ux * step; y0 += uy * step; L -= step; left -= step;
            if (left <= 0.001) { di = (di + 1) % d.length; left = d[di]; on = !on; }
          }
        }
      }
    };
    function dot(x, y, hw, r, g, b, a) {
      const n = hw > 4 ? 8 : 6; need(n * 3);
      for (let i = 0; i < n; i++) { const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832; vert(x, y, 0, 0, r, g, b, a); vert(x + Math.cos(a0) * hw, y + Math.sin(a0) * hw, 0, 0, r, g, b, a); vert(x + Math.cos(a1) * hw, y + Math.sin(a1) * hw, 0, 0, r, g, b, a); }
    }
    // prostokąt z teksturą w układzie użytkownika
    function quad(x, y, w, h, u0, v0, u1, v1, r, g, b, a) {
      need(6);
      const ax = tx(x, y), ay = ty(x, y), bx = tx(x + w, y), by = ty(x + w, y), cx = tx(x + w, y + h), cy = ty(x + w, y + h), dx = tx(x, y + h), dy = ty(x, y + h);
      vert(ax, ay, u0, v0, r, g, b, a); vert(bx, by, u1, v0, r, g, b, a); vert(cx, cy, u1, v1, r, g, b, a);
      vert(ax, ay, u0, v0, r, g, b, a); vert(cx, cy, u1, v1, r, g, b, a); vert(dx, dy, u0, v1, r, g, b, a);
    }
    G.drawImage = (img, a1, a2, a3, a4, a5, a6, a7, a8) => {
      if (!img || lost) return;
      const t = texOf(img, false); setTex(t.tex);
      let sx = 0, sy = 0, sw = t.w, sh = t.h, dx, dy, dw, dh;
      if (a5 !== undefined) { sx = a1; sy = a2; sw = a3; sh = a4; dx = a5; dy = a6; dw = a7; dh = a8; }
      else if (a3 !== undefined) { dx = a1; dy = a2; dw = a3; dh = a4; }
      else { dx = a1; dy = a2; dw = t.w; dh = t.h; }
      quad(dx, dy, dw, dh, sx / t.w, sy / t.h, (sx + sw) / t.w, (sy + sh) / t.h, G.tint ? G.tint[0] * alpha : alpha, G.tint ? G.tint[1] * alpha : alpha, G.tint ? G.tint[2] * alpha : alpha, alpha);
    };
    G.tint = null;      // [r,g,b] mnożnik koloru obrazków (np. przyciemnienie)

    // ---------- klatka ----------
    G.begin = (r, g, b) => {
      if (lost) return;
      stats.draws = 0; stats.verts = 0;
      gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform2f(uRes, canvas.width, canvas.height);
      clip = null; gl.disable(gl.SCISSOR_TEST); stack.length = 0; m = [1, 0, 0, 1, 0, 0]; alpha = 1; dash = null; G.tint = null;
      if (comp !== 'source-over') G.globalCompositeOperation = 'source-over';
      gl.clearColor(r, g, b, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    };
    G.end = () => { if (!lost) flush(); };
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { lost = false; init(); if (G.onRestore) G.onRestore(); });
    G.lost = () => lost;
    init();
    return G;
  }
  window.ZooGL = { create };
})();
