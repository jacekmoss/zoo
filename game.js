'use strict';
/* Moje Zoo – budowanie zoo dla czterolatka. Canvas + czysty JS, bez bibliotek.
   Świat to siatka izometryczna: 4×3 działki po 5×5 pól. Na każdej działce są 4 miejsca 2×2 (wybieg lub kiosk),
   a między nimi krzyż pól, na których dziecko układa żwirową ścieżkę (1 moneta za pole, przy zerze monet za darmo).
   Ekonomia: gość płaci tylko bilet przy bramie (+ napiwek, gdy na ścieżkach nie ma śmieci) i w kioskach.
   Wybiegi nie płacą, ale przyciągają gości: im więcej nakarmionych i różnych zwierząt, tym częściej ktoś przychodzi.
   Zadania dziecka: karmić głodne zwierzęta, uzupełniać puste kioski, sprzątać śmieci, spełniać życzenia gości.
   Gwiazdki za różne zwierzęta i kioski odblokowują nowe; album pokazuje odkryte. Nie da się przegrać ani utknąć. */
(() => {
  const TW = 120, TH = 60, PLOT = 5;
  let COLS = 4, ROWS = 3, BY = ROWS * PLOT, START = '1,' + (ROWS - 1);   // zależą od mapy (setMap)
  const GATE_TILE = { x: 7, y: BY - 1 };     // pierwsze pole ścieżki za bramą
  const KEY = 'zoo.save.v2', KEY_OLD = 'zoo.save.v1', KEY_SOUND = 'zoo.sound', KEY_SLOT = 'zoo.slot.v3.', SLOTS = 4;
  const PLOT_PRICES = [10, 25, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220];
  const START_COINS = 20;
  const MAX_GUESTS = 14, MAX_TRASH = 8, STOCK = 6, BUY = 0.35;   // BUY: szansa, że gość coś kupi w kiosku
  const STAR_AT = [2, 4, 6, 8, 10, 12, 14, 16, 18];   // ile różnych zwierząt i kiosków daje kolejną gwiazdkę
  // Choroby: po tylu sekundach głodu zwierzę choruje; po tylu sekundach bez leczenia zabiera je policja; tyle trwa leczenie.
  const SICK_HUNGER = 90, POLICE_AFTER = 75, CURE_T = 40, VET_CAP = 2;
  const VEH_V = 5.5, DEM_BACK = 0.5, DEM_BACK_SITE = 0.8;   // zwrot przy burzeniu: gotowy budynek / jeszcze w budowie
  const BIN_PRICE = 5, BIN_T = 5, BIN_R = 2, PARK_BUILD = 12, PARK_T = 16, PARK_CAP = 8;
  // Nowości: parking (więcej gości), pracownicy, młode, pokazy, ucieczki, ulepszanie wybiegów, doba, deszcz, wycieczki.
  const PARK_GUESTS = 5, PARK_RATE = 0.15;     // każdy gotowy parking: +5 do limitu gości i o 15% częściej
  const WAGE = 2, WAGE_EVERY = 90, STAFF_WAIT = 6, STAFF_V = 2.4;   // pensja co 90 s; pracownik rusza, gdy dziecko nie zdąży w 6 s
  const BABY_T = 200, UP_T = 10, SHOW_DUR = 8;
  const DAY_LEN = 360;                         // pełna doba w sekundach (noc to mniej więcej 1/5)
  const SHOWERS = ['foka', 'malpa', 'slon', 'pingwin', 'kangur', 'niedzwiedz', 'zyrafa', 'lew'];
  const RUNNERS = ['malpa', 'pingwin', 'krolik', 'kangur', 'zolw', 'flaming', 'zebra', 'panda'];
  const CLEAR_T = { drzewo: 9, skala: 10, piach: 6, bloto: 9, woda: 14 }, CLEAR_COST = { drzewo: 2, skala: 2, piach: 1, bloto: 2, woda: 3 }, MANUAL_K = 0.4;
  // Mapy: każda następna jest większa, ma inny teren i odblokowuje się po osiągnięciu celu na poprzedniej (kinds: różne zwierzęta i kioski, rate: zadowolenie).
  const MAPS = [
    { say: 'Zielona Dolina', cols: 4, rows: 3, seed: 11, start: 20, goal: { kinds: 10, rate: 60 }, mix: { drzewo: 0.18, woda: 0.05, bloto: 0.05, piach: 0.05, skala: 0.02 }, tint: null, col: '#7fa35a' },
    { say: 'Kraina Jezior', cols: 5, rows: 3, seed: 29, start: 40, goal: { kinds: 14, rate: 65 }, mix: { drzewo: 0.12, woda: 0.2, bloto: 0.14, piach: 0.04, skala: 0.02 }, tint: 'rgba(90,150,170,.12)', col: '#5f9db4' },
    { say: 'Złote Piaski', cols: 5, rows: 4, seed: 47, start: 60, goal: { kinds: 18, rate: 70 }, mix: { drzewo: 0.05, woda: 0.03, bloto: 0.02, piach: 0.3, skala: 0.1 }, tint: 'rgba(214,180,110,.24)', col: '#d6bd87' },
    { say: 'Wielka Puszcza', cols: 6, rows: 4, seed: 71, start: 80, goal: null, mix: { drzewo: 0.36, woda: 0.06, bloto: 0.1, piach: 0.02, skala: 0.05 }, tint: 'rgba(20,50,30,.2)', col: '#3f6a4a' },
  ];
  const FONT = '"Archivo Narrow", "Arial Narrow", Arial, sans-serif';
  const C = { panel: '#24301f', panelEdge: '#4d5f43', card: '#efe7d4', cardOff: '#48533f', ink: '#1d2618', cream: '#f4eedd',
    light: '#fff8e6', gold: '#d3a43a', goldDark: '#a97f22', accent: '#a7524a', wood: '#a07c52', woodLight: '#bd9a6c', post: '#5a4530', dark: '#2f3f2c' };

  // att = ile przyciąga gości, star = przy której gwiazdce się odblokowuje
  const A = (say, price, att, star, biome, s, count = 1) => ({ kind: 'animal', say, price, att, star, biome, s, count });
  const K = (say, price, pay, star) => ({ kind: 'kiosk', say, price, pay, star });
  const V = (say, price) => ({ kind: 'vet', say, price, star: 0, biome: 'kiosk' });
  const W = (say, price, star) => ({ kind: 'staff', say, price, star, biome: 'kiosk' });
  const F = (say, price, att, star, pay, joy) => ({ kind: 'fun', say, price, att, star, pay, joy, biome: 'laka' });
  const TYPES = {
    krolik: A('Królik', 5, 1, 0, 'laka', 0.5, 2),
    pingwin: A('Pingwin', 10, 1.2, 0, 'lod', 0.3, 2),
    flaming: A('Flaming', 12, 1.3, 1, 'staw', 0.42, 2),
    zolw: A('Żółw', 14, 1.3, 1, 'laka', 0.45, 2),
    malpa: A('Małpa', 15, 1.5, 2, 'bambusy', 0.44),
    foka: A('Foka', 18, 1.6, 2, 'lod', 0.42, 2),
    zebra: A('Zebra', 20, 1.8, 3, 'laka', 0.42),
    kangur: A('Kangur', 24, 2, 3, 'pustynia', 0.5),
    lew: A('Lew', 30, 2.4, 4, 'sawanna', 0.42),
    wielblad: A('Wielbłąd', 34, 2.5, 4, 'pustynia', 0.36),
    krokodyl: A('Krokodyl', 38, 2.7, 5, 'staw', 0.66),
    zyrafa: A('Żyrafa', 40, 2.8, 5, 'sawanna', 0.42),
    niedzwiedz: A('Niedźwiedź', 45, 3, 6, 'las', 0.44),
    tygrys: A('Tygrys', 50, 3.2, 6, 'las', 0.42),
    slon: A('Słoń', 50, 3.2, 7, 'sawanna', 0.38),
    hipopotam: A('Hipopotam', 55, 3.4, 7, 'staw', 0.42),
    nosorozec: A('Nosorożec', 60, 3.6, 8, 'sawanna', 0.42),
    panda: A('Panda', 60, 3.6, 8, 'bambusy', 0.42),
    koala: A('Koala', 65, 3.8, 9, 'las', 0.5),
    lody: K('Lody', 8, 2, 0),
    woda: K('Woda', 6, 1, 1),
    frytki: K('Frytki', 12, 3, 2),
    popcorn: K('Popcorn', 14, 3, 3),
    sok: K('Sok', 16, 4, 4),
    hotdog: K('Hot dog', 20, 4, 5),
    wata: K('Wata cukrowa', 22, 5, 6),
    pizza: K('Pizza', 26, 6, 7),
    wet: V('Weterynarz', 30),
    // pracownicy: sami karmią, sprzątają i uzupełniają w pobliżu (swoja działka i sąsiednie), biorą małą pensję
    opiekun: W('Opiekun zwierząt', 25, 1),
    sprzatacz: W('Sprzątacz', 20, 2),
    dostawca: W('Dostawca', 30, 3),
    // atrakcje: przyciągają gości i podnoszą zadowolenie; karuzela i akwarium biorą też monety
    ogrod: F('Ogród', 10, 0.4, 0, 0, 3),
    fontanna: F('Fontanna', 18, 0.7, 1, 0, 4),
    plac: F('Plac zabaw', 25, 1.2, 2, 0, 4),
    karuzela: F('Karuzela', 35, 1.5, 4, 2, 4),
    akwarium: F('Akwarium', 50, 2.5, 6, 3, 5),
  };
  const ANIMALS = Object.keys(TYPES).filter((t) => TYPES[t].kind === 'animal');
  const KIOSKS = Object.keys(TYPES).filter((t) => TYPES[t].kind === 'kiosk');
  const STAFF = Object.keys(TYPES).filter((t) => TYPES[t].kind === 'staff');
  const FUN = Object.keys(TYPES).filter((t) => TYPES[t].kind === 'fun');
  const ALL = [...ANIMALS, ...KIOSKS];
  const EVERY = [...ALL, ...STAFF, ...FUN];   // wszystko, co odblokowują gwiazdki
  const QUADS = [[0, 0], [3, 0], [0, 3], [3, 3]];
  const sprName = (t) => TYPES[t].kind === 'kiosk' ? 'kiosk_' + t : t;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  // DPR_CAP: gdy klatki są wolne (słabszy tablet), gra sama obniża rozdzielczość rysowania (zob. frame).
  let DPR_CAP = 2, slowT = 0;
  let DPR = 1, cw = 1280, ch = 800, u = 1, UW = 1280, UH = 800;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2, DPR_CAP);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * DPR); canvas.height = Math.round(ch * DPR);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    u = Math.min(cw / 1280, ch / 800); UW = cw / u; UH = ch / u;
    camSnap = true; TBG = null; TFG = null;
    if (window.ZOO_LOOK) VIGN = window.ZOO_LOOK.makeVignette(cw, ch);
  }

  // ---------- pomocnicze ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeOut = (k) => 1 - Math.pow(1 - k, 3);
  const tkey = (x, y) => x + ',' + y;
  const g2w = (gx, gy) => ({ x: (gx - gy) * TW / 2, y: (gx + gy) * TH / 2 });
  const w2g = (wx, wy) => ({ x: (wx / (TW / 2) + wy / (TH / 2)) / 2, y: (wy / (TH / 2) - wx / (TW / 2)) / 2 });
  function diamond(x0, y0, x1, y1) {
    const a = g2w(x0, y0), b = g2w(x1, y0), c = g2w(x1, y1), d = g2w(x0, y1);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function txt(s, x, y, size, color, align = 'center') {
    ctx.font = `700 ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }

  // ---------- grafika ----------
  const SPR = {}, SIL = {};
  function loadSprites() {
    const art = window.ZOO_ART, ZA = window.ZOO_ANIMALS;
    // zwierzęta: portret (klatka spoczynku) w wysokiej rozdzielczości – karty, album, dymki
    ZA.list.forEach((t) => {
      const [x0, y0, x1, y1] = ZA.A[t].box, k = Math.min(6, 420 / Math.max(x1 - x0, y1 - y0));
      let f = ZA.render(t, 'idle', 0, k);
      // przycięcie do widocznych pikseli: w kartach i albumie zwierzę wypełnia miejsce
      if (!window.ZOO_ANIMALS.A[t] || !window.ZOO_3D || !window.ZOO_3D[t] || !window.ZOO_3D[t].animal || /[?&]stary/.test(location.search)) try { const d = f.c.getContext('2d').getImageData(0, 0, f.c.width, f.c.height).data, W = f.c.width, H = f.c.height;
        let a = W, b2 = H, c = -1, e = -1;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8) { if (x < a) a = x; if (x > c) c = x; if (y < b2) b2 = y; if (y > e) e = y; }
        if (c >= a) { const n = document.createElement('canvas'); n.width = c - a + 1; n.height = e - b2 + 1; n.getContext('2d').drawImage(f.c, -a, -b2);
          f = { c: n, x: f.x + a / k, y: f.y + b2 / k, w: n.width / k, h: n.height / k }; } } catch (err) { /* plik z dysku: bez przycinania */ }
      SPR[t] = f;
      const sc = document.createElement('canvas'); sc.width = f.c.width; sc.height = f.c.height;
      const g = sc.getContext('2d'); g.drawImage(f.c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#1c2618'; g.fillRect(0, 0, sc.width, sc.height);
      SIL[t] = { c: sc, x: f.x, y: f.y, w: f.w, h: f.h };
    });
    const drawn = (name, vt) => { SPR[name] = vt; const sc = document.createElement('canvas'); sc.width = vt.c.width; sc.height = vt.c.height; const g = sc.getContext('2d'); g.drawImage(vt.c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#1c2618'; g.fillRect(0, 0, sc.width, sc.height); SIL[name] = { c: sc, x: vt.x, y: vt.y, w: vt.w, h: vt.h }; };
    drawn('wet', window.ZOO_LOOK.makeVet());
    STAFF.forEach((t) => drawn(t, window.ZOO_LOOK.makeHouse(t)));
    FUN.forEach((t) => drawn(t, window.ZOO_LOOK.makeFun(t)));
    return Promise.all(Object.keys(art).map((name) => new Promise((resolve) => {
      const a = art[name], [x, y, w, h] = a.vb, res = Math.min(3.2, (a.res || 1) * 1.8);   // wyższa rozdzielczość: ostro także w zbliżeniu
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * res}" height="${h * res}" viewBox="${x} ${y} ${w} ${h}">${a.svg}</svg>`;
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = Math.ceil(w * res); c.height = Math.ceil(h * res);
        const cg = c.getContext('2d'); cg.drawImage(img, 0, 0, c.width, c.height);
        if (!FLAT.has(name) && !name.startsWith('enc_')) shadeSprite(cg, c.width, c.height);
        SPR[name] = { c, x, y, w, h };
        // sylwetka do albumu i zablokowanych kart
        const s = document.createElement('canvas'); s.width = c.width; s.height = c.height;
        const g = s.getContext('2d'); g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#1c2618'; g.fillRect(0, 0, s.width, s.height);
        SIL[name] = { c: s, x, y, w, h };
        resolve();
      };
      img.onerror = () => { console.error('Nie wczytano obrazka', name); resolve(); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    })));
  }
  // Bryłowość płaskich obrazków: światło z lewej góry, cień z prawej i u dołu (tylko na pikselach obrazka).
  const FLAT = new Set(['moneta', 'dlon', 'miska', 'skrzynka', 'smiec']);
  function shadeSprite(g, w, h) {
    g.save(); g.globalCompositeOperation = 'source-atop';
    const d = g.createLinearGradient(0, 0, w, h);
    d.addColorStop(0, 'rgba(255,244,214,.22)'); d.addColorStop(0.45, 'rgba(255,244,214,0)'); d.addColorStop(1, 'rgba(18,24,34,.26)');
    g.fillStyle = d; g.fillRect(0, 0, w, h);
    const v = g.createLinearGradient(0, h * 0.62, 0, h);
    v.addColorStop(0, 'rgba(15,20,10,0)'); v.addColorStop(1, 'rgba(15,20,10,.22)');
    g.fillStyle = v; g.fillRect(0, h * 0.62, w, h * 0.38);
    g.restore();
  }
  // Wersje pomniejszone (mipmapy): duże płótno rysowane w małej skali jest drogie i ziarniste, więc bierzemy kopię
  // o rozdzielczości zbliżonej do tej na ekranie. Kopie powstają raz, przy pierwszej potrzebie.
  function mip(p, s) {
    const m = ctx.getTransform(), need = Math.hypot(m.a, m.b) * s;
    if (!p.mips) p.mips = [p.c];
    let i = 0, k = p.c.width / p.w;
    while (k / 2 >= need * 1.15 && i < 5) {
      i++;
      if (!p.mips[i]) { const prev = p.mips[i - 1], n = document.createElement('canvas'); n.width = Math.max(1, prev.width >> 1); n.height = Math.max(1, prev.height >> 1); const g = n.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(prev, 0, 0, n.width, n.height); p.mips[i] = n; }
      k /= 2;
    }
    return p.mips[i];
  }
  function spr(name, x, y, s = 1, flip = false) {
    const p = SPR[name]; if (!p) return;
    if (flip) { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(mip(p, s), p.x * s, p.y * s, p.w * s, p.h * s); ctx.restore(); return; }
    ctx.drawImage(mip(p, s), x + p.x * s, y + p.y * s, p.w * s, p.h * s);
  }
  function sprFit(name, bx, by, bw, bh, sil = false) {
    const p = (sil ? SIL : SPR)[name]; if (!p) return;
    const s = Math.min(bw / p.w, bh / p.h), w = p.w * s, h = p.h * s;
    ctx.drawImage(p.c, bx + (bw - w) / 2, by + (bh - h) / 2, w, h);
  }
  const LOOK = window.ZOO_LOOK;
  let PAT = {}, MOTTLE = null, VIGN = null, PATIO = null, CLOUD = null;
  const ENC = {}, TREE_C = {};
  const encOf = (b) => ENC[b] || (ENC[b] = LOOK.makeEnclosure(b));
  // Grafika 3D (sprites/index.js przez animals.js): wybieg zwierzęcia, wybieg biomu, obrazki budynków.
  const OBJ3D = () => window.ZOO_ANIMALS.OBJ3D;
  const enc3d = (type) => { const E = window.ZOO_ANIMALS.ENC3D; return E[type] || E['_' + TYPES[type].biome] || null; };
  function kioskSpr(type, hop) { if (OBJ3D()['kiosk_' + type]) spr('kiosk_' + type, 0, -hop, 1); else spr('kiosk_' + type, 0, 8 - hop, 1.08); }
  // Tekstury terenu 3D (tex_wild, tex_gravel…): obraz widziany z góry kładziony w rzucie izometrycznym (obrót 45°, spłaszczenie ½).
  function applyTex() {
    const T = window.ZOO_ANIMALS && window.ZOO_ANIMALS.TEX3D; if (!T || !window.DOMMatrix) return;
    Object.entries(T).forEach(([k, t]) => {
      const p = ctx.createPattern(t.im, 'repeat'), q = t.tile / t.im.width / Math.SQRT2;
      p.setTransform(new DOMMatrix([q, q / 2, -q, q / 2, 0, 0])); PAT[k.slice(4)] = p;
    });
    terrainDirty = true;
  }
  function apply3D() {
    applyTex();
    const BIN = OBJ3D().smietnik;
    if (BIN) LOOK.drawBin = (g, x, y, k = 1) => g.drawImage(BIN.c, x + BIN.x * k * 1.2, y + BIN.y * k * 1.2, BIN.w * k * 1.2, BIN.h * k * 1.2);
    Object.keys(TREE_C).forEach((k) => delete TREE_C[k]);
    Object.entries(OBJ3D()).forEach(([name, p]) => {
      SPR[name] = p;
      const sc = document.createElement('canvas'); sc.width = p.c.width; sc.height = p.c.height;
      const g = sc.getContext('2d'); g.drawImage(p.c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#1c2618'; g.fillRect(0, 0, sc.width, sc.height);
      SIL[name] = { c: sc, x: p.x, y: p.y, w: p.w, h: p.h };
    });
    // woda w wybiegach 3D: położenie stawu z opisu wybiegu (sprites/index.js), żeby pływanie zgadzało się z obrazkiem
    Object.entries(window.ZOO_ANIMALS.ENC3D).forEach(([k, E]) => { if (k[0] === '_' && E.pool) LOOK.POOL[k.slice(1)] = E.pool; });
  }
  const treeOf = (kind, i) => { const k = kind + (i % 3); return TREE_C[k] || (TREE_C[k] = OBJ3D()[kind] || LOOK.makeTree(kind, i % 3 + 1)); };
  function makePatterns() {
    PAT = LOOK.makePatterns(ctx); applyTex(); MOTTLE = LOOK.makeMottle(4); PATIO = LOOK.makePatio(); CLOUD = LOOK.makeCloudShadow(3);
  }
  function blit(p, x, y, s = 1) { ctx.drawImage(mip(p, s), x + p.x * s, y + p.y * s, p.w * s, p.h * s); }
  const CLOUDS = [{ x: -900, y: 200, s: 2.6, v: 14 }, { x: 300, y: 650, s: 3.2, v: 11 }, { x: 1300, y: 50, s: 2.2, v: 16 }];

  // ---------- dźwięk i lektor ----------
  let soundOn = true, AC = null;
  try { soundOn = localStorage.getItem(KEY_SOUND) !== '0'; } catch (e) {}
  function audio() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (AC.state === 'suspended') AC.resume().catch(() => {});
    return AC;
  }
  function tone(freq, dur, vol = 0.08, when = 0, type = 'triangle') {
    if (!soundOn) return; const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + when;
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  let lastCoinSound = 0;
  const sfx = {
    coin() { const n = performance.now(); if (n - lastCoinSound < 180) return; lastCoinSound = n; tone(1040, 0.09, 0.05); tone(1560, 0.14, 0.04, 0.06); },
    gravel() { tone(190, 0.06, 0.1, 0, 'square'); tone(120, 0.08, 0.08, 0.02, 'square'); },
    build() { tone(220, 0.12, 0.12); tone(330, 0.14, 0.1, 0.1); tone(440, 0.2, 0.09, 0.2); },
    no() { tone(170, 0.18, 0.09); tone(130, 0.22, 0.08, 0.12); },
    joy() { tone(523, 0.12, 0.08); tone(659, 0.12, 0.08, 0.11); tone(784, 0.22, 0.08, 0.22); },
    tap() { tone(600, 0.05, 0.04); },
    sweep() { tone(900, 0.05, 0.05); tone(1300, 0.08, 0.04, 0.04); },
    hungry() { tone(880, 0.1, 0.04); tone(740, 0.12, 0.035, 0.1); },
    star() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.22, 0.07, i * 0.1)); },
  };
  let voice = null;
  function findVoice() {
    let v = []; try { v = window.speechSynthesis.getVoices() || []; } catch (e) {}
    voice = v.find((x) => /^pl/i.test(x.lang) && /natural|online|google/i.test(x.name)) || v.find((x) => /^pl/i.test(x.lang)) || null;
  }
  if (window.speechSynthesis) { findVoice(); window.speechSynthesis.onvoiceschanged = findVoice; }
  // Lektor: nagrania ElevenLabs z audio/manifest.json (tools/glos.py), a gdy czegoś brak – głos przeglądarki.
  let VOICE = null, vq = [], vEl = null;
  try { fetch('audio/manifest.json').then((r) => r.ok ? r.json() : null).then((m) => { VOICE = m; }).catch(() => {}); } catch (e) {}
  const vNorm = (x) => x.replace(/\s+/g, ' ').trim();
  function clipsFor(t) {
    if (!VOICE) return null;
    const out = [];
    for (const sen of vNorm(t).split(/(?<=[.!?:])\s+/)) {
      if (!sen) continue;
      if (VOICE[sen]) { out.push(VOICE[sen]); continue; }
      // zdanie składane w kodzie, np. lista nowości: „Flaming, Żółw.”
      for (const part of sen.split(/,\s+/)) {
        const p = part.replace(/[.!?:]$/, '');
        const f = VOICE[part] || VOICE[p] || VOICE[p + '.'];
        if (!f) return null;
        out.push(f);
      }
    }
    return out;
  }
  function playNext() {
    if (!vq.length) return;
    if (!vEl) vEl = new Audio();
    vEl.onended = playNext; vEl.onerror = playNext;
    vEl.src = 'audio/' + vq.shift();
    const pr = vEl.play(); if (pr) pr.catch(() => { vq = []; });
  }
  function stopVoice() {
    vq = []; if (vEl) { try { vEl.pause(); } catch (e) {} }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
  }
  function say(t) {
    if (!soundOn) return;
    stopVoice();
    const clips = clipsFor(t);
    if (clips && clips.length) { vq = clips; playNext(); return; }
    if (!window.speechSynthesis) return;
    try {
      const z = new SpeechSynthesisUtterance(t); z.lang = 'pl-PL'; z.rate = 0.95; if (voice) z.voice = voice;
      window.speechSynthesis.speak(z);
    } catch (e) {}
  }
  // rodzaj żeński: Foka, Małpa, Zebra, Żyrafa, Panda, Koala
  const fem = (t) => /a$/.test(TYPES[t].say);
  const gwiazdki = (n) => n === 1 ? 'gwiazdkę' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? 'gwiazdki' : 'gwiazdek';
  let lastHint = 0;
  function sayHint(t, gap = 5) { const n = performance.now() / 1000; if (n - lastHint < gap) return; lastHint = n; say(t); }
  // pierwszy raz: dłuższe wyjaśnienie lektora, potem już tylko dźwięk
  function sayOnce(flag, t) { if (S.seen[flag]) return false; S.seen[flag] = 1; dirty = true; say(t); lastHint = performance.now() / 1000; return true; }

  // ---------- stan gry ----------
  const S = {
    scene: 'title', slot: null, map: 0, open: 1, allMaps: {},       // slot: numer zapisu, open: ile map odblokowano
    coins: START_COINS, plots: new Set(), paths: new Set(), builds: {}, seen: {}, found: {}, trash: [],
    obst: {}, clear: {}, bins: {}, parks: {}, rate: 60, angry: 0, tool: null, cars: [], veh: [],   // obst: przeszkody terenu, clear: trwające karczowanie
    wish: null, starsSeen: 0, overlay: null, earn: {},   // earn: licznik zarobku z tej sesji (bilety, kioski, życzenia)
    panel: null, network: new Set(), connected: [], guests: [],
    // chwilowe (bez zapisu): pora dnia, deszcz, pokaz, uciekinier, radość po pokazie/wycieczce
    clock: 0, rain: 0, show: null, esc: null, cheer: 0,
  };
  const RT = {};                         // dane chwilowe budynków (ruch zwierząt, dymki); nie są zapisywane
  let dirty = false, lastSave = 0, slotCache = null, saveFlash = 0;
  function mapData() {
    return { coins: S.coins, plots: [...S.plots], paths: [...S.paths], builds: S.builds, trash: S.trash, wish: S.wish, obst: S.obst, clear: S.clear,
      bins: S.bins, parks: S.parks, rate: Math.round(S.rate), angry: Math.round(S.angry) };
  }
  function saveNow() {
    dirty = false; lastSave = performance.now();
    if (S.slot == null) return;
    S.allMaps[S.map] = mapData();
    try {
      localStorage.setItem(KEY_SLOT + S.slot, JSON.stringify({ v: 3, map: S.map, open: S.open, found: S.found, seen: S.seen, starsSeen: S.starsSeen, maps: S.allMaps, at: Date.now() }));
    } catch (e) {}
    slotCache = null;
  }
  function cleanBuild(b) {
    const t = b && b.type, T = TYPES[t]; if (!T) return null;
    const o = { type: t }; if (b.b > 0) o.b = +b.b;
    if (T.kind === 'animal') {
      o.h = b.h ? 1 : 0; if (b.hs) o.hs = +b.hs || 0;
      if (b.sick) { o.sick = 1; o.wt = +b.wt || 0; }
      if (b.vet && b.vet.at) o.vet = { at: String(b.vet.at), t: +b.vet.t || 1 };
      if (b.pol != null) o.pol = +b.pol || 0.1;
      if (b.lv) o.lv = clamp(Math.floor(+b.lv) || 0, 0, 2);
      if (b.kids) o.kids = clamp(Math.floor(+b.kids) || 0, 0, 3);
      if (b.hp) o.hp = +b.hp || 0;
      if (b.up > 0) o.up = +b.up;
    } else if (T.kind === 'kiosk') o.st = clamp(Math.floor(b.st == null ? STOCK : +b.st) || 0, 0, STOCK);
    return o;
  }
  // Teren: gładki szum, z którego każdy rodzaj przeszkody zabiera najwyżej punktowane pola, więc powstają kępy drzew i całe jeziora.
  function noise(seed, x, y) {
    const h = (i, j) => { let n = (i * 374761393 + j * 668265263 + seed * 1442695) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = (t) => t * t * (3 - 2 * t);
    return lerp(lerp(h(xi, yi), h(xi + 1, yi), s(xf)), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), s(xf)), s(yf));
  }
  function genTerrain(m) {
    const out = {}, W = m.cols * PLOT, H = m.rows * PLOT, tiles = [];
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) tiles.push([x, y]);
    Object.keys(m.mix).forEach((kind, i) => {
      const sc = kind === 'drzewo' ? 2.2 : kind === 'skala' ? 1.6 : 3.4;
      tiles.filter(([x, y]) => !out[tkey(x, y)]).map(([x, y]) => [x, y, noise(m.seed + i * 101, x / sc, y / sc)]).sort((a, b) => b[2] - a[2])
        .slice(0, Math.round(tiles.length * m.mix[kind])).forEach(([x, y]) => { out[tkey(x, y)] = kind; });
    });
    // działka startowa prawie czysta: jedna kępa drzew w tylnym miejscu, żeby od razu było widać karczowanie
    const sy = (m.rows - 1) * PLOT;
    for (let x = PLOT; x < PLOT * 2; x++) for (let y = sy; y < sy + PLOT; y++) delete out[tkey(x, y)];
    [[3, 0], [4, 0], [3, 1]].forEach(([a, b]) => { out[tkey(PLOT + a, sy + b)] = 'drzewo'; });
    return out;
  }
  function applySave(d) {
    S.coins = Math.max(0, Math.floor(+d.coins) || 0);
    S.plots = new Set((d.plots || []).filter(validPlotKey));
    S.paths = new Set((d.paths || []).filter((k) => { const [x, y] = k.split(',').map(Number); return isPathTile(x, y); }));
    S.builds = {};
    Object.keys(d.builds || {}).forEach((k) => {
      const b = cleanBuild(d.builds[k]), [px, py, q] = k.split(',').map(Number);
      if (b && q >= 0 && q < 4 && S.plots.has(tkey(px, py))) S.builds[k] = b;
    });
    Object.values(S.builds).forEach((b) => { if (b.vet && !(S.builds[b.vet.at] && S.builds[b.vet.at].type === 'wet')) { delete b.vet; b.h = 0; } if (!b.b) S.found[b.type] = 1; });
    S.trash = (d.trash || []).filter((k) => S.paths.has(k)).slice(0, MAX_TRASH);
    S.wish = TYPES[d.wish] && !builtTypes().has(d.wish) ? d.wish : null;
    if (d.obst) S.obst = d.obst;
    else {                                   // stary zapis: kupione działki są już uprzątnięte
      S.obst = genTerrain(MAPS[S.map]);
      Object.keys(S.obst).forEach((k) => { const [x, y] = k.split(',').map(Number); if (S.plots.has(plotOf(x, y))) delete S.obst[k]; });
    }
    S.paths.forEach((k) => delete S.obst[k]);
    S.clear = {}; Object.keys(d.clear || {}).forEach((k) => { const j = d.clear[k]; if (S.obst[k] && j && j.t > 0 && j.T > 0) S.clear[k] = { t: +j.t, T: +j.T, m: j.m ? 1 : 0 }; });
    S.bins = {}; Object.keys(d.bins || {}).forEach((k) => { if (S.paths.has(k)) S.bins[k] = Math.max(0, +d.bins[k] || 0); });
    S.parks = {}; Object.keys(d.parks || {}).forEach((i) => { const v = d.parks[i]; if (+i >= 0 && +i < COLS && v) S.parks[i] = { st: clamp(+v.st || 0, 0, 2), b: +v.b || 0 }; });
    S.rate = d.rate == null ? 60 : clamp(+d.rate || 0, 0, 100);
    S.angry = clamp(+d.angry || 0, 0, 60);
  }
  function blankMap(i) {
    S.coins = MAPS[i].start; S.plots = new Set(); S.paths = new Set(); S.builds = {}; S.trash = []; S.wish = null;
    S.obst = genTerrain(MAPS[i]); S.clear = {}; S.bins = {}; S.parks = {}; S.rate = 60; S.angry = 0;
  }
  // Mapy mają różne wymiary: wszystko, co od nich zależy, ustawiamy tutaj.
  function setMap(i) {
    const m = MAPS[i]; S.map = i; COLS = m.cols; ROWS = m.rows; BY = ROWS * PLOT; START = '1,' + (ROWS - 1); GATE_TILE.y = BY - 1;
    ROAD = BY + 2.5; PY = ROAD + 1; WISH_POS.y = BY + 1.2; buildDecor();
    TL = null; terrainDirty = true; camSnap = true; view.x = null; view.y = null; view.z = 0;
  }
  function enterMap(i) {
    setMap(i);
    S.overlay = null; S.panel = null; S.tool = null; demSel = null; S.guests = []; S.cars = []; S.veh = [];
    S.clock = DAY_LEN * 0.1; S.rain = 0; S.show = null; S.esc = null; S.cheer = 0; upSel = null; rangeSel = null;
    Object.keys(CREW).forEach((k) => delete CREW[k]);
    showTimer = rand(70, 110); escTimer = rand(160, 240); rainTimer = rand(150, 260); busTimer = rand(120, 200); wageTimer = WAGE_EVERY;
    Object.keys(RT).forEach((k) => delete RT[k]);
    const d = S.allMaps[i];
    if (d) applySave(d); else blankMap(i);
    wishTimer = 40; hungerTimer = 25; sickTimer = rand(150, 240); spawnTimer = 0;
    Object.keys(S.builds).forEach((k) => { if (!S.builds[k].b) makeRT(k).pop = 1; });
    recompute();
  }
  // Zapisy: stary zapis (v1, v2) trafia jednorazowo do pierwszego slotu.
  function migrateOld() {
    try {
      if (localStorage.getItem(KEY_SLOT + 0)) return;
      let d = JSON.parse(localStorage.getItem(KEY));
      if (!(d && d.v === 2)) { const o = JSON.parse(localStorage.getItem(KEY_OLD)); d = o && o.v === 1 ? migrateV1(o) : null; }
      if (!d) return;
      localStorage.setItem(KEY_SLOT + 0, JSON.stringify({ v: 3, map: 0, open: 1, found: d.found || {}, seen: d.seen || {}, starsSeen: d.starsSeen || 0, maps: { 0: d }, at: Date.now() }));
    } catch (e) {}
  }
  function migrateV1(d) {
    const shift = (k, dy) => { const p = String(k).split(','); p[1] = String(+p[1] + dy); return p.join(','); };
    const builds = {};
    Object.keys(d.builds || {}).forEach((k) => { builds[shift(k, 1)] = { type: d.builds[k] && d.builds[k].type }; });
    return { coins: d.coins, plots: (d.plots || []).map((k) => shift(k, 1)), paths: (d.paths || []).map((k) => shift(k, PLOT)), builds, seen: Object.assign({}, d.seen || {}, { all: 0 }), starsSeen: 0 };
  }
  function slotInfo() {
    if (slotCache) return slotCache;
    slotCache = [];
    for (let i = 0; i < SLOTS; i++) { let d = null; try { d = JSON.parse(localStorage.getItem(KEY_SLOT + i)); } catch (e) {} slotCache.push(d && d.v === 3 ? d : null); }
    return slotCache;
  }
  function openSlot(n) {
    const d = slotInfo()[n];
    S.slot = n; S.found = d ? d.found || {} : {}; S.seen = d ? d.seen || {} : {}; S.starsSeen = d ? clamp(+d.starsSeen || 0, 0, STAR_AT.length) : 0;
    S.open = d ? clamp(+d.open || 1, 1, MAPS.length) : 1; S.allMaps = d ? d.maps || {} : {};
    enterMap(d ? clamp(+d.map || 0, 0, S.open - 1) : 0);
    rescueCoins(); saveNow();
  }
  function deleteSlot(n) { try { localStorage.removeItem(KEY_SLOT + n); } catch (e) {} slotCache = null; }
  function validPlotKey(k) { const [x, y] = String(k).split(',').map(Number); return x >= 0 && x < COLS && y >= 0 && y < ROWS; }
  // Zabezpieczenie: bez żadnego zwierzęcia nie ma gości, więc gra dosypuje monety na zwierzę (albo działkę i zwierzę).
  function rescueCoins() {
    if (Object.values(S.builds).some((b) => TYPES[b.type].kind === 'animal')) return false;
    const cheapest = Math.min(...unlocked().filter((t) => TYPES[t].kind === 'animal').map((t) => TYPES[t].price));
    const need = !S.plots.size ? PLOT_PRICES[0] + cheapest : freePlaces().length ? cheapest : plotPrice() + cheapest;
    if (S.coins < need) { S.coins = need; dirty = true; return true; }
    return false;
  }

  // ---------- postęp: gwiazdki, odblokowanie ----------
  const builtTypes = () => new Set(Object.values(S.builds).map((b) => b.type));
  const doneTypes = () => new Set(Object.values(S.builds).filter((b) => !b.b && (TYPES[b.type].kind === 'animal' || TYPES[b.type].kind === 'kiosk')).map((b) => b.type));
  const starCount = () => { const n = doneTypes().size; return STAR_AT.filter((x) => n >= x).length; };
  const unlocked = () => EVERY.filter((t) => TYPES[t].star <= S.starsSeen);
  const nextStarTypes = () => EVERY.filter((t) => TYPES[t].star === S.starsSeen + 1);
  function checkStars() {
    const n = starCount();
    if (n > S.starsSeen) {
      S.starsSeen = n; dirty = true; saveNow();
      const fresh = EVERY.filter((t) => TYPES[t].star === n);
      S.overlay = { kind: 'star', t: 0, n, items: fresh };
      S.panel = null; sfx.star();
      const an = fresh.filter((t) => TYPES[t].kind === 'animal').map((t) => TYPES[t].say);
      const ki = fresh.filter((t) => TYPES[t].kind === 'kiosk').map((t) => TYPES[t].say);
      const ot = fresh.filter((t) => TYPES[t].kind === 'staff' || TYPES[t].kind === 'fun').map((t) => TYPES[t].say);
      say('Nowa gwiazdka! ' + (an.length ? 'Nowe zwierzęta: ' + an.join(', ') + '. ' : '') + (ki.length ? 'Nowy kiosk: ' + ki.join(', ') + '. ' : '') + (ot.length ? 'Nowe budynki: ' + ot.join(', ') + '.' : ''));
    }
  }

  const plotBase = (k) => { const [px, py] = k.split(',').map(Number); return { x: px * PLOT, y: py * PLOT, px, py }; };
  const plotOf = (gx, gy) => tkey(Math.floor(gx / PLOT), Math.floor(gy / PLOT));
  const canPave = (gx, gy) => isPathTile(gx, gy) && !S.obst[tkey(gx, gy)];
  function isPathTile(gx, gy) {
    if (gx < 0 || gy < 0) return false;
    if (!S.plots.has(plotOf(gx, gy))) return false;
    return ((gx % PLOT) === 2 || (gy % PLOT) === 2);
  }
  const quadOf = (gx, gy) => {
    const lx = gx - Math.floor(gx / PLOT) * PLOT, ly = gy - Math.floor(gy / PLOT) * PLOT;
    if (lx === 2 || ly === 2) return -1;
    return (lx > 2 ? 1 : 0) + (ly > 2 ? 2 : 0);
  };
  const placeKey = (plot, q) => plot + ',' + q;
  function placeCenter(key) {
    const [px, py, q] = key.split(',').map(Number), [qx, qy] = QUADS[q];
    return { x: px * PLOT + qx + 1, y: py * PLOT + qy + 1 };
  }
  // Pola krzyża stykające się z miejscem.
  function placeTiles(key) {
    const [px, py, q] = key.split(',').map(Number), [qx, qy] = QUADS[q], bx = px * PLOT, by = py * PLOT;
    return [[bx + qx, by + 2], [bx + qx + 1, by + 2], [bx + 2, by + qy], [bx + 2, by + qy + 1]];
  }
  function buyablePlots() {
    if (!S.plots.size) return [START];
    const out = [];
    for (let py = 0; py < ROWS; py++) for (let px = 0; px < COLS; px++) {
      const k = tkey(px, py); if (S.plots.has(k)) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => S.plots.has(tkey(px + a, py + b)))) out.push(k);
    }
    return out;
  }
  const plotPrice = () => PLOT_PRICES[Math.min(S.plots.size, PLOT_PRICES.length - 1)] + Math.max(0, S.plots.size - PLOT_PRICES.length + 1) * 20;
  const NEI = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function recompute() {
    const net = new Set(), gk = tkey(GATE_TILE.x, GATE_TILE.y);
    if (S.paths.has(gk)) {
      const st = [gk]; net.add(gk);
      while (st.length) {
        const [x, y] = st.pop().split(',').map(Number);
        NEI.forEach(([a, b]) => { const k = tkey(x + a, y + b); if (S.paths.has(k) && !net.has(k)) { net.add(k); st.push(k); } });
      }
    }
    S.network = net;
    S.connected = Object.keys(S.builds).filter((k) => !S.builds[k].b && placeTiles(k).some(([x, y]) => net.has(tkey(x, y))));
  }
  const isConnected = (k) => S.connected.includes(k);
  const isAnimal = (k) => TYPES[S.builds[k].type].kind === 'animal';
  const isKiosk = (k) => TYPES[S.builds[k].type].kind === 'kiosk';
  const away = (b) => !!b.vet || b.pol != null;                // zwierzę poza wybiegiem
  const animalOk = (b) => !b.h && !b.sick && !away(b);
  const kindOf = (k) => TYPES[S.builds[k].type].kind;
  const isFun = (k) => kindOf(k) === 'fun';
  const isOpen = (k) => isConnected(k) && (isAnimal(k) ? animalOk(S.builds[k]) && !(S.esc && S.esc.k === k && RT[k] && RT[k].animals.length < 2) : isKiosk(k) ? S.builds[k].st > 0 : isFun(k));
  // Co dzieje się z miejscem (dymek): cut – brak ścieżki, h – głodne, sick – chore, st – pusty kiosk, show – zwierzę chce dać pokaz.
  function needOf(k) {
    const b = S.builds[k]; if (b.b || TYPES[b.type].kind === 'vet') return null;
    if (!isConnected(k)) return 'cut';
    if (isAnimal(k)) return b.sick ? 'sick' : b.h ? 'h' : S.show && S.show.k === k && !S.show.on ? 'show' : null;
    if (isKiosk(k)) return b.st <= 0 ? 'st' : null;
    return null;
  }
  // Siła przyciągania gości: nakarmione, połączone zwierzęta (ulepszony wybieg i młode – więcej), różnorodność i atrakcje.
  function attraction() {
    const open = S.connected.filter((k) => isAnimal(k) && animalOk(S.builds[k]));
    const kinds = new Set(open.map((k) => S.builds[k].type));
    const an = open.reduce((s, k) => { const b = S.builds[k], a = TYPES[b.type].att; return s + a * (1 + 0.35 * (b.lv || 0)) + a * 0.3 * (b.kids || 0); }, 0);
    const fun = S.connected.filter(isFun).reduce((s, k) => s + TYPES[S.builds[k].type].att, 0);
    return an > 0 ? an + 0.3 * kinds.size + fun : 0;
  }
  const parksDone = () => Object.values(S.parks).filter((P) => P.st === 2).length;
  const maxGuests = () => MAX_GUESTS + PARK_GUESTS * parksDone();
  const rateFactor = () => 0.45 + S.rate / 100 * 1.1;              // zadowolenie: 0 → 0,45 raza gości, 50 → 1, 100 → 1,55
  // pogoda i pora dnia: w nocy i w deszczu przychodzi mniej gości
  const weatherFactor = () => (1 - 0.6 * nightK()) * (S.rain > 0 ? 0.6 : 1);
  const spawnEvery = () => { const a = attraction(); return a <= 0 ? Infinity : clamp(26 / a, 6, 26) / rateFactor() / (1 + PARK_RATE * parksDone()) / weatherFactor(); };
  const ticket = () => 1 + (!S.trash.length && Math.random() < 0.3 ? 1 : 0);   // napiwek tylko czasem i tylko w czystym zoo
  function bfsPath(from, targets) {            // po istniejącej ścieżce
    const fk = tkey(from.x, from.y), goal = new Set(targets), prev = { [fk]: null }, q = [fk];
    while (q.length) {
      const k = q.shift();
      if (goal.has(k)) { const out = []; let c = k; while (c) { const [x, y] = c.split(',').map(Number); out.unshift({ x, y }); c = prev[c]; } return out; }
      const [x, y] = k.split(',').map(Number);
      NEI.forEach(([a, b]) => { const n = tkey(x + a, y + b); if (S.paths.has(n) && !(n in prev)) { prev[n] = k; q.push(n); } });
    }
    return null;
  }
  // Najkrótsza brakująca trasa od istniejącej sieci (lub bramy) do miejsca, tylko po polach kupionych działek.
  function missingRoute(key) {
    const goal = new Set(placeTiles(key).map(([x, y]) => tkey(x, y)));
    const starts = S.network.size ? [...S.network] : [tkey(GATE_TILE.x, GATE_TILE.y)];
    const prev = {}, q = [];
    starts.forEach((k) => { prev[k] = null; q.push(k); });
    while (q.length) {
      const k = q.shift();
      if (goal.has(k)) { const out = []; let c = k; while (c) { if (!S.network.has(c)) out.unshift(c); c = prev[c]; } return out; }
      const [x, y] = k.split(',').map(Number);
      NEI.forEach(([a, b]) => { const nx = x + a, ny = y + b, n = tkey(nx, ny); if (canPave(nx, ny) && !(n in prev)) { prev[n] = k; q.push(n); } });
    }
    return [];
  }

  // ---------- budowanie ----------
  // Zanurzenie w wodzie (0 = wcale, 1 = całe) i zwierzęta, które skaczą lub kicają.
  const SINK = { pingwin: 0.9, foka: 0.45, hipopotam: 0.42, krokodyl: 0.38, flaming: 0.14 };
  const HOPPERS = { krolik: [9, 0.3], kangur: [18, 0.45] };          // kicanie w marszu: [wysokość, czas]
  const JUMPERS = { malpa: [30, 0.6], koala: [8, 0.5], pingwin: [6, 0.3] };   // podskok w miejscu od czasu do czasu
  const BOWL = { x: -34, y: 30 };
  const inPool = (pool, x, y, m = 0.75) => pool && ((x - pool.x) / pool.rx) ** 2 + ((y - pool.y) / pool.ry) ** 2 < m;
  function makeRT(key) {
    const t = TYPES[S.builds[key].type];
    const rt = { pop: 0, hop: 0, shake: 0, fed: 0, animals: [] };
    if (t.kind === 'animal') {
      for (let i = 0; i < t.count; i++) {
        const p = spotFor(S.builds[key].type); rt.animals.push({ x: p.x, y: p.y, tx: p.x, ty: p.y, flip: Math.random() < 0.5, wait: rand(0, 3), step: 0, seed: rand(0, 6), sink: 0, jump: 0 });
      }
      for (let i = 0; i < (S.builds[key].kids || 0); i++) addBaby(rt);
    }
    RT[key] = rt; return rt;
  }
  // Młode chodzi blisko mamy (pierwszego zwierzęcia w wybiegu) i jest o połowę mniejsze.
  function addBaby(rt) {
    const m = rt.animals[0]; if (!m) return;
    rt.animals.push({ x: m.x + rand(-14, 14), y: m.y + rand(4, 10), tx: m.x, ty: m.y, flip: m.flip, wait: rand(0, 2), step: 0, seed: rand(0, 6), sink: 0, jump: 0, baby: 1 });
  }
  function randSpot() {
    for (;;) { const x = rand(-58, 58), y = rand(-22, 30); if (Math.abs(x) / 90 + Math.abs(y - 4) / 42 < 1) return { x, y }; }
  }
  // Miejsce docelowe: zwierzęta wodne często idą do wody, reszta omija sadzawkę.
  function spotFor(type) {
    const pool = LOOK.POOL[TYPES[type].biome];
    if (pool && SINK[type] && Math.random() < 0.4) { const an = rand(0, 7), d = rand(0, 0.5); return { x: pool.x + Math.cos(an) * pool.rx * d, y: pool.y + Math.sin(an) * pool.ry * d }; }
    const E3 = enc3d(type), blocked = (p) => E3 && E3.block.some(([bx, by, rx, ry]) => ((p.x - bx) / rx) ** 2 + ((p.y - by) / ry) ** 2 < 1);   // drzewa, paśniki z wybiegu 3D
    for (let i = 0; i < 30; i++) { const p = randSpot(); if (!inPool(pool, p.x, p.y, 1.25) && !blocked(p)) return p; }
    return randSpot();
  }
  const minusCoin = (val, wx, wy) => minus.push({ wx, wy, t: 0, val });
  function buyPlot(k) {
    const p = plotPrice();
    if (S.coins < p) { sfx.no(); signShake[k] = 0.5; sayHint('Za mało monet. Goście przyniosą więcej.'); return false; }
    S.coins -= p; S.plots.add(k); sfx.build(); recompute(); saveNow(); idle = 0;
    if (!S.seen.plot) { S.seen.plot = 1; say('Masz działkę! Dotknij plusa i wybierz zwierzę.'); } else say(plotHasObstacles(k) ? 'Nowa działka! Dotknij drzew, piachu, wody i błota, żeby uprzątnąć teren.' : 'Nowa działka!');
    return true;
  }
  const buildTime = (type) => { const t = TYPES[type]; return t.kind === 'vet' ? 22 : t.kind === 'animal' ? clamp(14 + t.price * 0.3, 14, 30) : 12 + t.price * 0.2; };
  function build(key, type) {
    const t = TYPES[type];
    if (S.coins < t.price) { sfx.no(); sayHint('Za mało monet. Goście przyniosą więcej.'); return false; }
    S.coins -= t.price; const nb = cleanBuild({ type }); nb.b = buildTime(type); S.builds[key] = nb; makeRT(key); sfx.build(); recompute(); S.panel = null; idle = 0;
    say('Budujemy! Trochę to potrwa.');
    saveNow();
    return true;
  }
  // Koniec budowy: dopiero teraz miejsce działa, liczy się do gwiazdek i spełnia życzenie gościa.
  function finishBuild(key) {
    const b = S.builds[key], type = b.type, t = TYPES[type]; delete b.b;
    const rt = RT[key] || makeRT(key); rt.pop = 0; recompute(); sfx.build(); idle = Math.min(idle, 1);
    if (t.kind === 'vet') { S.found[type] = 1; say('Weterynarz gotowy! Chore zwierzęta będą leczone.'); saveNow(); return; }
    if (t.kind === 'staff') {
      S.found[type] = 1; rangeSel = { k: key, t: 5 }; saveNow();
      const job = { opiekun: 'Opiekun sam nakarmi głodne zwierzęta w pobliżu.', sprzatacz: 'Sprzątacz sam posprząta śmieci w pobliżu.', dostawca: 'Dostawca sam uzupełni kioski w pobliżu.' }[type];
      say(isConnected(key) ? job + ' Co jakiś czas dostaje pensję.' : t.say + '! Zrób ścieżkę do domku, żeby mógł chodzić do pracy.');
      return;
    }
    if (t.kind === 'fun') { S.found[type] = 1; saveNow(); say(t.say + '! ' + (isConnected(key) ? 'Goście to lubią.' : 'Dołóż ścieżkę, żeby goście doszli.')); return; }
    const isNew = !S.found[type]; S.found[type] = 1;
    if (S.wish === type) {
      const bonus = 6 + Math.round(t.price * 0.3);
      S.wish = null; wishTimer = rand(60, 90); wishJoy = 2.5;
      addCoins(bonus, WISH_POS.x, WISH_POS.y, 120, 'zyczenie'); sfx.joy();
      say('Hura! ' + t.say + '! Gość bardzo się cieszy i daje dużo monet.');
    } else if (!isConnected(key)) {
      if (!S.seen.path) { S.seen.path = 1; say(t.say + '! Teraz zrób ścieżkę od bramy. Bez ścieżki goście nie dojdą.'); }
      else say(t.say + '! Dołóż ścieżkę, żeby goście doszli.');
    } else say(t.say + (isNew ? '! Nowe w albumie.' : '!'));
    saveNow();
    checkStars();
  }
  const pathAnim = {};
  function layPath(gx, gy) {
    const k = tkey(gx, gy);
    if (!canPave(gx, gy) || S.paths.has(k)) return false;
    // pole kosztuje monetę; bez monet jest darmowe, żeby dziecko nigdy nie utknęło
    if (S.coins >= 1) { S.coins -= 1; const w = g2w(gx + 0.5, gy + 0.5); minusCoin(1, w.x, w.y - 20); }
    const before = new Set(S.connected);
    S.paths.add(k); pathAnim[k] = 0.25; sfx.gravel(); recompute(); dirty = true; saveNow(); idle = 0;
    const fresh = S.connected.filter((b) => !before.has(b));
    if (fresh.length) {
      sfx.joy(); spawnTimer = Math.min(spawnTimer, 0.3);
      fresh.forEach((b) => { RT[b].hop = 0.5; });
      if (!S.seen.link) { S.seen.link = 1; say('Brawo! Ścieżka gotowa. Goście już idą.'); } else say('Goście mogą dojść!');
    }
    return true;
  }
  // ---------- teren: karczowanie, osuszanie, usuwanie piachu ----------
  const plotHasObstacles = (k) => { const b = plotBase(k); for (let x = b.x; x < b.x + PLOT; x++) for (let y = b.y; y < b.y + PLOT; y++) if (S.obst[tkey(x, y)]) return true; return false; };
  function quadTiles(key) { const [px, py, q] = key.split(',').map(Number), [qx, qy] = QUADS[q], bx = px * PLOT + qx, by = py * PLOT + qy; return [[bx, by], [bx + 1, by], [bx, by + 1], [bx + 1, by + 1]]; }
  const quadBlocked = (key) => quadTiles(key).some(([x, y]) => S.obst[tkey(x, y)]);
  // Dotknięcie przeszkody: robotnik zaczyna od razu i pracuje szybciej. Bez monet też działa.
  function orderClear(tk) {
    const kind = S.obst[tk]; if (!kind) return false;
    const old = S.clear[tk]; if (old && old.m) return false;
    const [x, y] = tk.split(',').map(Number); if (!S.plots.has(plotOf(x, y))) return false;
    const cost = CLEAR_COST[kind];
    if (S.coins >= cost) { S.coins -= cost; const w = g2w(x + 0.5, y + 0.5); minusCoin(cost, w.x, w.y - 20); }
    const T = CLEAR_T[kind] * MANUAL_K; S.clear[tk] = { t: old ? T * old.t / old.T : T, T, m: 1 };
    terrainDirty = true; sfx.tap(); dirty = true; idle = 0;
    sayOnce('clear', 'Robotnik już pracuje. Dotykaj kolejnych drzew, piachu, wody i błota.');
    return true;
  }
  function finishClear(tk) {
    delete S.obst[tk]; delete S.clear[tk]; terrainDirty = true; dirty = true; hintTimer = 0;
    const [x, y] = tk.split(',').map(Number), w = g2w(x + 0.5, y + 0.5); sparkles.push({ wx: w.x, wy: w.y, t: 0 }); tone(760, 0.08, 0.035);
  }
  function tickClear(dt) {
    Object.keys(S.clear).forEach((tk) => {
      const j = S.clear[tk]; j.t -= dt; j.dust = (j.dust || 0) - dt;
      if (j.dust <= 0) { j.dust = 0.32; const [x, y] = tk.split(',').map(Number), w = g2w(x + 0.5, y + 0.5); dust.push({ wx: w.x + rand(-26, 26), wy: w.y + rand(-12, 8), t: 0 }); }
      if (j.t <= 0) finishClear(tk);
    });
  }
  // ---------- parking ----------
  let PY = BY + 3.5;
  const parkX = (i) => i * PLOT;
  const parkPrice = () => 5 + Object.keys(S.parks).length * 4;           // dużo taniej niż działki pod zoo
  function parkBuyable() {
    const out = [];
    for (let i = 0; i < COLS; i++) if (!S.parks[i] && (S.parks[i - 1] || S.parks[i + 1] || (!Object.keys(S.parks).length && i === 1))) out.push(i);
    return out;
  }
  const parkAt = (gx, gy) => (gy >= PY && gy <= PY + 3 && gx >= 0 && gx < COLS * PLOT) ? Math.floor(gx / PLOT) : -1;
  function parkSignPos(i) { const w = g2w(parkX(i) + 2.5, PY + 1.5); return { x: w.x, y: w.y + 30 }; }
  function buyPark(i) {
    const p = parkPrice();
    if (S.coins < p) { sfx.no(); signShake['p' + i] = 0.5; sayHint('Za mało monet. Goście przyniosą więcej.'); return; }
    S.coins -= p; S.parks[i] = { st: 0, b: 0 }; sfx.build(); dirty = true; idle = 0; saveNow();
    say('Działka pod parking! Dotknij plusa i zbuduj.');
  }
  function buildPark(i) {
    if (S.coins < PARK_BUILD) { sfx.no(); sayHint('Za mało monet. Goście przyniosą więcej.'); return; }
    S.coins -= PARK_BUILD; S.parks[i] = { st: 1, b: PARK_T }; sfx.build(); idle = 0; saveNow(); say('Budujemy parking!');
  }
  function parkSlots() {
    const out = [[1.6, 0], [3.4, 0], [10.2, 0], [13.6, 0]].map(([x]) => ({ x, y: BY + 1.5, k: 'r' + x }));   // przy drodze jest kilka miejsc od początku
    Object.keys(S.parks).forEach((i) => {
      if (S.parks[i].st !== 2) return;
      for (let j = 0; j < PARK_CAP; j++) out.push({ x: parkX(+i) + 0.75 + (j % 4) * 1.17, y: PY + (j < 4 ? 0.75 : 2.3), k: 'p' + i + j });
    });
    return out.sort((a, b) => Math.abs(a.x - 7.5) - Math.abs(b.x - 7.5));
  }
  function freeSlot() { const used = new Set(S.cars.filter((c) => c.slot).map((c) => c.slot.k)); return parkSlots().find((s) => !used.has(s.k)) || null; }
  const CAR_COLS = ['#a7524a', '#4f7a96', '#d2a64c', '#6d8a5a', '#8b6a9b', '#c7804e', '#d8d3c6'];
  function carFar(left) { return left ? -8 : COLS * PLOT + 8; }
  function tickCars(dt) {
    S.cars.forEach((c) => {
      if (c.st === 'park') return;
      let move = 7 * dt;
      while (move > 0 && c.q.length) {
        const n = c.q[0], dx = n.x - c.x, dy = n.y - c.y, d = Math.hypot(dx, dy);
        if (d > 0.001) { c.dx = dx / d; c.dy = dy / d; }
        if (d <= move) { c.x = n.x; c.y = n.y; c.q.shift(); move -= d; } else { c.x += dx / d * move; c.y += dy / d * move; move = 0; }
      }
      if (c.q.length) return;
      if (c.st === 'in') { c.st = 'park'; guestFromCar(c); } else c.dead = true;
    });
    S.cars = S.cars.filter((c) => !c.dead);
  }
  function carLeave(c) { c.st = 'out'; const left = Math.random() < 0.5; c.q = [{ x: c.slot.x, y: ROAD }, { x: carFar(left), y: ROAD }]; c.slot = null; }
  // ---------- zdrowie: choroby, weterynarz, policja ----------
  let sickTimer = 200;
  const vets = () => Object.keys(S.builds).filter((k) => S.builds[k].type === 'wet' && !S.builds[k].b);
  const patients = (vk) => Object.values(S.builds).filter((b) => b.vet && b.vet.at === vk).length;
  const freeVet = () => vets().find((v) => patients(v) < VET_CAP) || null;
  function makeSick(k, why) {
    const b = S.builds[k]; b.sick = 1; b.h = 0; b.hs = 0; b.wt = 0; dirty = true; sfx.hungry();
    const name = TYPES[b.type].say, ill = fem(b.type) ? ' jest chora.' : ' jest chory.';
    if (freeVet()) { if (why === 'glod') say(name + ill + ' Za długo było głodne.'); return; }
    if (!sayOnce('sick', name + ill + ' Zbuduj weterynarza, bo inaczej zabierze je policja.')) sayHint(name + ill + ' Potrzebny weterynarz.', 4);
  }
  function addVeh(kind, pts) { S.veh.push({ kind, pts: pts.slice(1), x: pts[0].x, y: pts[0].y, dx: 1, dy: 0 }); }
  function sendToVet(k, vk) {
    const b = S.builds[k]; b.sick = 0; b.wt = 0; b.vet = { at: vk, t: CURE_T }; dirty = true;
    addVeh('amb', [placeCenter(vk), placeCenter(k), placeCenter(vk)]);
    sayHint(TYPES[b.type].say + ' jedzie do weterynarza.', 4);
  }
  function discharge(k) {
    const b = S.builds[k]; delete b.vet; b.h = 0; b.hs = 0; const rt = RT[k] || makeRT(k); rt.hop = 0.7; sfx.joy(); dirty = true;
    sayHint(TYPES[b.type].say + (fem(b.type) ? ' jest zdrowa!' : ' jest zdrowy!'), 3);
  }
  function callPolice(k) {
    const b = S.builds[k], c = placeCenter(k), from = { x: 7.5, y: ROAD }, d = Math.hypot(c.x - from.x, c.y - from.y);
    b.pol = d / VEH_V; b.sick = 0; dirty = true; addVeh('pol', [from, c, from]); tone(660, 0.3, 0.06); tone(520, 0.3, 0.06, 0.32);
    say('Jedzie policja! Zwierzę długo chorowało i nikt go nie leczył.');
  }
  function policeTake(k) {
    if (S.esc && S.esc.k === k) endEsc();
    delete S.builds[k]; delete RT[k]; S.rate = Math.max(0, S.rate - 20); recompute(); sfx.no(); saveNow(); hintTimer = 0;
    say('Policja zabrała zwierzę. Goście są smutni.');
  }
  function tickHealth(dt) {
    Object.keys(S.builds).forEach((k) => {
      const b = S.builds[k]; if (TYPES[b.type].kind !== 'animal' || b.b) return;
      if (b.pol != null) { b.pol -= dt; if (b.pol <= 0) policeTake(k); return; }
      if (b.vet) { b.vet.t -= dt; if (b.vet.t <= 0) discharge(k); return; }
      if (b.sick) {
        b.wt = (b.wt || 0) + dt;
        const v = freeVet();
        if (v) sendToVet(k, v); else if (b.wt >= POLICE_AFTER) callPolice(k);
        return;
      }
      if (b.h) { b.hs = (b.hs || 0) + dt; if (b.hs >= SICK_HUNGER) makeSick(k, 'glod'); }
    });
    // rzadko któreś ze zwierząt choruje samo z siebie (dopiero gdy w zoo są co najmniej 3 wybiegi)
    sickTimer -= dt;
    if (sickTimer <= 0) {
      sickTimer = rand(150, 240);
      const list = S.connected.filter((k) => isAnimal(k) && animalOk(S.builds[k]));
      if (list.length >= 3) makeSick(pick(list), 'traf');
    }
  }
  // ---------- zadowolenie z zoo (0–100) ----------
  function rateTarget() {
    const an = Object.values(S.builds).filter((b) => TYPES[b.type].kind === 'animal' && !b.b), ki = Object.values(S.builds).filter((b) => TYPES[b.type].kind === 'kiosk' && !b.b);
    if (!an.length) return 50;
    let r = 50 + 18 - an.filter((b) => b.h).length / an.length * 40;
    r -= an.filter((b) => b.sick).length * 10;
    r += 12 - S.trash.length * 4;
    if (ki.length) r += 8 - ki.filter((b) => b.st <= 0).length / ki.length * 16;
    r += Math.min(12, doneTypes().size * 1.2) - S.angry;
    r += Math.min(14, S.connected.filter(isFun).reduce((s, k) => s + TYPES[S.builds[k].type].joy, 0));   // atrakcje
    r += Math.min(6, an.reduce((s, b) => s + (b.lv || 0) * 1.5, 0));                                     // ulepszone wybiegi
    if (S.esc) r -= 8;                                                                                    // zwierzę uciekło
    r += S.cheer;                                                                                         // po pokazie i wycieczce
    return clamp(r, 0, 100);
  }
  function tickRate(dt) {
    S.angry = Math.max(0, S.angry - dt * 0.5); S.cheer = Math.max(0, S.cheer - dt * 0.15);
    S.rate = clamp(S.rate + (rateTarget() - S.rate) * Math.min(1, dt * 0.06), 0, 100);
  }
  // Cel mapy: po jego osiągnięciu odblokowuje się następna mapa.
  const goalOf = (i) => MAPS[i].goal;
  const goalDone = () => { const g = goalOf(S.map); return g && doneTypes().size >= g.kinds && S.rate >= g.rate; };
  function checkGoal() {
    if (S.map + 2 > MAPS.length || S.open > S.map + 1 || S.overlay || !goalDone()) return;
    S.open = S.map + 2; S.overlay = { kind: 'map', t: 0, n: S.map + 1 }; S.panel = null; sfx.star(); saveNow();
    say('Nowa mapa! ' + MAPS[S.map + 1].say + '. Dotknij mapy, żeby tam pojechać.');
  }
  // Burzenie: pierwsze dotknięcie zaznacza budynek (widać zwrot), drugie burzy. Działka zostaje, wraca część monet.
  let demSel = null;
  function refundOf(k) {
    if (k[0] === 'p') { const P = S.parks[k.slice(1)]; return Math.ceil(PARK_BUILD * (P.st === 1 ? DEM_BACK_SITE : DEM_BACK)); }
    const b = S.builds[k]; return Math.ceil(TYPES[b.type].price * (b.b > 0 ? DEM_BACK_SITE : DEM_BACK));
  }
  function demCenter(k) { if (k[0] === 'p') return { x: parkX(+k.slice(1)) + 2.5, y: PY + 1.5 }; return placeCenter(k); }
  function demolishAt(g) {
    const gx = Math.floor(g.x), gy = Math.floor(g.y), pi = parkAt(g.x, g.y); let key = null;
    if (pi >= 0) { if (S.parks[pi] && S.parks[pi].st >= 1) key = 'p' + pi; }
    else if (S.plots.has(plotOf(gx, gy))) { const q = quadOf(gx, gy); if (q >= 0 && S.builds[placeKey(plotOf(gx, gy), q)]) key = placeKey(plotOf(gx, gy), q); }
    if (!key) { demSel = null; sfx.no(); sayHint('Dotknij budynku, który chcesz zburzyć.', 3); return; }
    if (key[0] !== 'p') {
      const b = S.builds[key];
      if (b.pol != null) { sfx.no(); return; }
      if (b.type === 'wet' && patients(key) > 0) { sfx.no(); sayHint('Tu leczą się zwierzęta. Poczekaj, aż wyzdrowieją.', 3); return; }
    }
    if (demSel !== key) { demSel = key; sfx.tap(); idle = 0; say('Dotknij jeszcze raz, żeby zburzyć. Część monet wróci.'); return; }
    const val = refundOf(key), c = demCenter(key), w = g2w(c.x, c.y);
    for (let i = 0; i < 14; i++) dust.push({ wx: w.x + rand(-90, 90), wy: w.y + rand(-40, 36), t: rand(0, 0.25) });
    tone(120, 0.25, 0.12, 0, 'square'); tone(80, 0.3, 0.1, 0.1, 'square');
    if (key[0] === 'p') S.parks[key.slice(1)] = { st: 0, b: 0 };
    else { if (S.esc && S.esc.k === key) endEsc(); if (S.show && S.show.k === key) S.show = null; if (upSel && upSel.k === key) upSel = null; delete S.builds[key]; delete RT[key]; recompute(); }
    addCoins(val, c.x, c.y, 90, 'zwrot'); demSel = null; S.tool = null; idle = 0; hintTimer = 0; saveNow();
    say('Zburzone. Część monet wróciła.');
  }
  function drawDemMarks() {
    const mark = (k) => {
      const sel = k === demSel;
      if (k[0] === 'p') { const x0 = parkX(+k.slice(1)); diamond(x0, PY, x0 + PLOT, PY + 3); }
      else { const [px, py, q] = k.split(',').map(Number), [qx, qy] = QUADS[q], bx = px * PLOT + qx, by = py * PLOT + qy; diamond(bx + 0.04, by + 0.04, bx + 1.96, by + 1.96); }
      if (sel) { ctx.fillStyle = 'rgba(198,74,66,.3)'; ctx.fill(); }
      ctx.strokeStyle = sel ? '#e0584d' : 'rgba(224,88,77,.65)'; ctx.lineWidth = sel ? 8 : 4; ctx.setLineDash(sel ? [] : [14, 10]); ctx.stroke(); ctx.setLineDash([]);
    };
    Object.keys(S.builds).forEach(mark);
    Object.keys(S.parks).forEach((i) => { if (S.parks[i].st >= 1) mark('p' + i); });
    if (demSel && (demSel[0] === 'p' ? S.parks[demSel.slice(1)] && S.parks[demSel.slice(1)].st >= 1 : S.builds[demSel])) { const c = demCenter(demSel), w = g2w(c.x, c.y); pricePill(w.x, w.y, refundOf(demSel), 1); }
  }
  // Śmietniki: stoją na ścieżce, w pobliżu nikt nie śmieci.
  const binNear = (x, y) => Object.keys(S.bins).some((k) => { if (S.bins[k] > 0) return false; const [a, b] = k.split(',').map(Number); return Math.abs(a - x) + Math.abs(b - y) <= BIN_R; });
  function toggleBin(x, y) {
    const k = tkey(x, y);
    if (!S.paths.has(k)) { sfx.no(); sayHint('Śmietnik stawiamy na ścieżce.', 3); return; }
    if (S.bins[k] != null) { delete S.bins[k]; sfx.tap(); dirty = true; return; }
    if (S.coins < BIN_PRICE) { sfx.no(); sayHint('Za mało monet. Goście przyniosą więcej.'); return; }
    S.coins -= BIN_PRICE; S.bins[k] = BIN_T; const w = g2w(x + 0.5, y + 0.5); minusCoin(BIN_PRICE, w.x, w.y - 20); sfx.build(); dirty = true; idle = 0;
    const ti = S.trash.indexOf(k); if (ti >= 0) S.trash.splice(ti, 1);
  }
  function coinFly(val, gx, gy, up = 80) {
    const w = g2w(gx, gy);
    flyers.push({ wx: w.x, wy: w.y - up, val, t: 0 }); sfx.coin();
  }
  function addCoins(val, gx, gy, up, why) { S.coins += val; S.earn[why] = (S.earn[why] || 0) + val; dirty = true; coinFly(val, gx, gy, up); }
  // by = kto to zrobił: dziecko (bez parametru) albo pracownik ('staff' – ciszej, bez lektora)
  function feed(k, by) {
    const b = S.builds[k]; if (!b.h) return false;
    b.h = 0; b.hs = 0; RT[k].hop = 0.7; sfx.joy(); dirty = true; saveNow(); if (!by) idle = 0;
    const rt = RT[k]; rt.fed = 6;              // najedzone zwierzęta podbiegają do pełnej miski
    rt.animals.forEach((a, i) => { a.tx = BOWL.x + 16 + i * 14; a.ty = BOWL.y - 4 - i * 6; a.wait = 0; a.fast = 1; a.flip = a.tx > a.x; });
    if (!by) sayHint('Mniam! ' + TYPES[b.type].say + (fem(b.type) ? ' jest najedzona.' : ' jest najedzony.'), 4);
    else sayOnce('crewfeed', 'Opiekun nakarmił zwierzę!');
    return true;
  }
  function refill(k, by) {
    const b = S.builds[k]; if (b.st >= STOCK) return false;
    b.st = STOCK; RT[k].hop = 0.5; sfx.build(); dirty = true; saveNow(); if (!by) idle = 0;
    if (!by) sayHint('Kiosk znowu pełny!', 4); else sayOnce('crewfill', 'Dostawca uzupełnił kiosk!');
    return true;
  }
  function sweep(tk, by) {
    const i = S.trash.indexOf(tk); if (i < 0) return false;
    S.trash.splice(i, 1); sfx.sweep(); dirty = true; if (!by) idle = 0;
    const [x, y] = tk.split(',').map(Number), w = g2w(x + 0.5, y + 0.5); sparkles.push({ wx: w.x, wy: w.y, t: 0 });
    if (!S.trash.length && !by) { sfx.joy(); sayHint('Czysto! Goście się cieszą.', 6); }
    return true;
  }

  // ---------- pracownicy: opiekun, sprzątacz, dostawca ----------
  // Każdy domek ma jednego pracownika. Pracuje na swojej działce i na sąsiednich (także po skosie).
  // Najpierw daje dziecku chwilę (STAFF_WAIT), potem idzie ścieżką, robi swoje i wraca. Bez ścieżki do domku – nie pracuje.
  const CREW = {};
  let wageTimer = WAGE_EVERY, rangeSel = null;
  const crewHouses = () => Object.keys(S.builds).filter((k) => kindOf(k) === 'staff' && !S.builds[k].b && isConnected(k));
  function inRange(hk, plot) { const [hx, hy] = hk.split(',').map(Number), [px, py] = plot.split(',').map(Number); return Math.abs(hx - px) <= 1 && Math.abs(hy - py) <= 1; }
  const plotOfKey = (k) => k.split(',').slice(0, 2).join(',');
  function homeTile(hk) { const t = placeTiles(hk).find(([x, y]) => S.network.has(tkey(x, y))); return t ? { x: t[0], y: t[1] } : null; }
  const claimed = (what) => Object.values(CREW).some((c) => c.job && c.job.what === what);
  function findJob(hk, type, c) {
    if (type === 'opiekun') {
      if (S.esc && inRange(hk, plotOfKey(S.esc.k)) && S.esc.t > 12 && !claimed('esc')) return { what: 'esc', tiles: [tkey(Math.round(S.esc.gx - 0.5), Math.round(S.esc.gy - 0.5))] };
      const k = S.connected.find((k) => isAnimal(k) && S.builds[k].h && !S.builds[k].sick && (S.builds[k].hs || 0) >= STAFF_WAIT && inRange(hk, plotOfKey(k)) && !claimed(k));
      if (k) return { what: k, tiles: placeTiles(k).map(([x, y]) => tkey(x, y)).filter((t) => S.network.has(t)) };
    }
    if (type === 'dostawca') {
      const k = S.connected.find((k) => isKiosk(k) && S.builds[k].st <= 0 && (RT[k].empty || 0) >= STAFF_WAIT && inRange(hk, plotOfKey(k)) && !claimed(k));
      if (k) return { what: k, tiles: placeTiles(k).map(([x, y]) => tkey(x, y)).filter((t) => S.network.has(t)) };
    }
    if (type === 'sprzatacz') {
      const tk = S.trash.find((tk) => { const [x, y] = tk.split(',').map(Number); return S.network.has(tk) && inRange(hk, plotOf(x, y)) && !claimed('t' + tk) && (trashAge[tk] || 0) >= STAFF_WAIT; });
      if (tk) return { what: 't' + tk, tiles: [tk] };
    }
    return null;
  }
  const trashAge = {};
  function tickCrew(dt) {
    S.trash.forEach((tk) => { trashAge[tk] = (trashAge[tk] || 0) + dt; });
    Object.keys(trashAge).forEach((tk) => { if (!S.trash.includes(tk)) delete trashAge[tk]; });
    Object.keys(S.builds).forEach((k) => { const b = S.builds[k]; if (isKiosk(k) && RT[k]) RT[k].empty = b.st <= 0 ? (RT[k].empty || 0) + dt : 0; });
    const houses = crewHouses();
    Object.keys(CREW).forEach((hk) => { if (!houses.includes(hk)) delete CREW[hk]; });
    houses.forEach((hk) => {
      const type = S.builds[hk].type, home = homeTile(hk); if (!home) return;
      const c = CREW[hk] || (CREW[hk] = { kind: type, x: home.x + 0.5, y: home.y + 0.5, q: [], st: 'home', wait: rand(0, 2), phase: 0, at: home, job: null });
      c.phase += dt * 9;
      if (c.wait > 0) { c.wait -= dt; return; }
      if (c.q.length) {
        let move = STAFF_V * dt;
        while (move > 0 && c.q.length) {
          const n = c.q[0], dx = n.x - c.x, dy = n.y - c.y, d = Math.hypot(dx, dy);
          if (Math.abs((n.x - n.y) - (c.x - c.y)) > 0.01) c.dir = (n.x - n.y) < (c.x - c.y) ? -1 : 1;
          if (d <= move) { c.x = n.x; c.y = n.y; c.q.shift(); move -= d; } else { c.x += dx / d * move; c.y += dy / d * move; move = 0; }
        }
        if (c.q.length) return;
      }
      if (c.st === 'go') {            // na miejscu: robota
        const j = c.job; let ok = false;
        if (j.what === 'esc') ok = S.esc && Math.hypot(S.esc.gx - c.x, S.esc.gy - c.y) < 1.6 && catchEsc('crew');
        else if (j.what[0] === 't') ok = sweep(j.what.slice(1), 'staff');
        else if (S.builds[j.what] && type === 'opiekun') ok = feed(j.what, 'staff');
        else if (S.builds[j.what] && type === 'dostawca') ok = refill(j.what, 'staff');
        if (j.what === 'esc' && !ok && S.esc) { c.job = null; c.st = 'home'; c.wait = 0.5; return; }   // uciekinier się przesunął: szukamy go od nowa
        c.job = null; c.st = 'back'; c.wait = ok ? 1.4 : 0.3;
        const r = bfsPath(c.at, [tkey(home.x, home.y)]); c.q = r ? r.map((t) => ({ x: t.x + 0.5, y: t.y + 0.5 })) : []; c.at = home;
        if (!r) { c.x = home.x + 0.5; c.y = home.y + 0.5; }
        return;
      }
      if (c.st === 'back') { c.st = 'home'; c.wait = 1; return; }
      // w domu: szukamy pracy
      const job = findJob(hk, type, c);
      if (!job || !job.tiles.length) { c.wait = 0.8; return; }
      const r = bfsPath(home, job.tiles);
      if (!r) { c.wait = 2; return; }
      c.job = job; c.st = 'go'; c.q = r.map((t) => ({ x: t.x + 0.5, y: t.y + 0.5 })); c.at = r[r.length - 1];
    });
    // pensja: co 90 s każdy pracujący domek zabiera 2 monety (bez monet – pracuje za darmo, gra się nie zacina)
    wageTimer -= dt;
    if (wageTimer <= 0) {
      wageTimer = WAGE_EVERY;
      houses.forEach((hk) => { if (S.coins >= WAGE) { S.coins -= WAGE; const c = placeCenter(hk), w = g2w(c.x, c.y); minusCoin(WAGE, w.x, w.y - 120); dirty = true; } });
      if (houses.length) sayOnce('wage', 'Pracownicy dostali pensję. Dzięki nim zoo działa samo.');
    }
  }
  function drawRange() {
    if (!rangeSel || !S.builds[rangeSel.k]) return;
    const [hx, hy] = rangeSel.k.split(',').map(Number), al = Math.min(1, rangeSel.t) * (0.22 + 0.08 * Math.sin(time * 5));
    for (let x = hx - 1; x <= hx + 1; x++) for (let y = hy - 1; y <= hy + 1; y++) {
      if (!S.plots.has(tkey(x, y))) continue;
      diamond(x * PLOT + 0.1, y * PLOT + 0.1, (x + 1) * PLOT - 0.1, (y + 1) * PLOT - 0.1);
      ctx.fillStyle = `rgba(240,210,122,${al})`; ctx.fill(); ctx.strokeStyle = `rgba(240,210,122,${al * 3})`; ctx.lineWidth = 4; ctx.stroke();
    }
  }

  // ---------- młode, ulepszanie wybiegów ----------
  // Zadbane zwierzę (najedzone, zdrowe, z gośćmi) po pewnym czasie ma młode; ulepszony wybieg – szybciej i więcej młodych.
  function tickBabies(dt) {
    S.connected.forEach((k) => {
      if (!isAnimal(k)) return;
      const b = S.builds[k]; if (!animalOk(b) || (b.kids || 0) >= 1 + (b.lv || 0)) return;
      b.hp = (b.hp || 0) + dt * (1 + 0.5 * (b.lv || 0)) * (S.rate >= 40 ? 1 : 0.5);
      if (b.hp < BABY_T) return;
      b.hp = 0; b.kids = (b.kids || 0) + 1; addBaby(RT[k] || makeRT(k)); dirty = true; saveNow();
      const c = placeCenter(k), w = g2w(c.x, c.y);
      for (let i = 0; i < 4; i++) sparkles.push({ wx: w.x + rand(-50, 50), wy: w.y + rand(-30, 20), t: -i * 0.15 });
      RT[k].hop = 0.8; sfx.star(); S.cheer = Math.min(12, S.cheer + 4);
      say('Urodziło się małe! ' + TYPES[b.type].say + ' ma dziecko.');
    });
  }
  let upSel = null;                         // wybieg z przyciskiem ulepszenia: { k, t }
  const upPrice = (k) => { const b = S.builds[k]; return Math.ceil(TYPES[b.type].price * 0.6 * ((b.lv || 0) + 1)); };
  function upPos(k) { const c = placeCenter(k), w = g2w(c.x, c.y); return { x: w.x + 74, y: bubbleY(k, w.y) + 20 }; }
  function upgrade(k) {
    const b = S.builds[k]; if (!b || b.up > 0 || (b.lv || 0) >= 2) return;
    const p = upPrice(k);
    if (S.coins < p) { sfx.no(); sayHint('Za mało monet. Goście przyniosą więcej.', 3); return; }
    S.coins -= p; b.up = UP_T; upSel = null; sfx.build(); dirty = true; saveNow(); idle = 0;
    say('Ulepszamy wybieg! Będzie basen i zabawki.');
  }
  function tickUpgrades(dt) {
    Object.keys(S.builds).forEach((k) => {
      const b = S.builds[k]; if (!(b.up > 0)) return;
      b.up -= dt;
      const rt = RT[k]; if (rt) { rt.dust = (rt.dust || 0) - dt; if (rt.dust <= 0) { rt.dust = 0.4; const c = placeCenter(k), w = g2w(c.x, c.y); dust.push({ wx: w.x + rand(-70, 70), wy: w.y + rand(-22, 30), t: 0 }); } }
      if (b.up <= 0) { delete b.up; b.lv = Math.min(2, (b.lv || 0) + 1); if (rt) rt.hop = 0.8; sfx.star(); saveNow(); say('Wybieg jest piękniejszy! Zwierzęta są szczęśliwsze i przychodzi więcej gości.'); }
    });
    if (upSel) { upSel.t -= dt; if (upSel.t <= 0 || !S.builds[upSel.k]) upSel = null; }
    if (rangeSel) { rangeSel.t -= dt; if (rangeSel.t <= 0) rangeSel = null; }
  }
  // Ozdoby ulepszonego wybiegu (w lokalnych współrzędnych miejsca): poziom 1 – piłka i pień, poziom 2 – platforma i flaga.
  function drawUpgrades(b) {
    const lv = b.lv || 0; if (!lv) return;
    ctx.fillStyle = 'rgba(25,30,15,.25)'; ctx.beginPath(); ctx.ellipse(52, 26, 10, 4, 0, 0, 7); ctx.fill();
    const g1 = ctx.createRadialGradient(47, 15, 1, 50, 18, 10); g1.addColorStop(0, '#f4d06a'); g1.addColorStop(1, '#c0503f');
    ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(50, 18, 8, 0, 7); ctx.fill();
    ctx.fillStyle = '#7a5530'; ctx.beginPath(); ctx.ellipse(-62, 22, 14, 6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#a07c52'; ctx.beginPath(); ctx.ellipse(-70, 20, 5, 5, 0, 0, 7); ctx.fill();
    if (lv < 2) return;
    ctx.fillStyle = '#6b4f33'; ctx.fillRect(58, -30, 3, 28); ctx.fillRect(80, -38, 3, 30);
    ctx.fillStyle = '#a07c52'; ctx.beginPath(); ctx.moveTo(52, -30); ctx.lineTo(70, -40); ctx.lineTo(90, -38); ctx.lineTo(72, -28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a3a28'; ctx.fillRect(14, -66, 2.5, 40);
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(16.5, -66); ctx.lineTo(16.5 + 18, -61 + Math.sin(time * 4) * 2); ctx.lineTo(16.5, -54); ctx.closePath(); ctx.fill();
  }
  function drawUpBtn() {
    if (!upSel || !S.builds[upSel.k]) return;
    const p = upPos(upSel.k), pr = upPrice(upSel.k), ok = S.coins >= pr, k = Math.min(1, upSel.t * 2), y = p.y + Math.sin(time * 3) * 3;
    ctx.save(); ctx.globalAlpha = k;
    ctx.beginPath(); ctx.arc(p.x + 1, y + 5, 37, 0, 7); ctx.fillStyle = 'rgba(10,16,6,.3)'; ctx.fill();
    const g = ctx.createLinearGradient(0, y - 36, 0, y + 36); g.addColorStop(0, ok ? '#f2d585' : '#9a9a88'); g.addColorStop(1, ok ? '#b4862a' : '#6a6a5c');
    ctx.beginPath(); ctx.arc(p.x, y, 36, 0, 7); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#2b2208'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(p.x - 15, y + 2); ctx.lineTo(p.x, y - 14); ctx.lineTo(p.x + 15, y + 2); ctx.moveTo(p.x, y - 13); ctx.lineTo(p.x, y + 16); ctx.stroke(); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
    pricePill(p.x, y + 58, pr, clamp(S.coins / pr, 0, 1));
    ctx.restore();
  }
  function upHit(sx, sy) {
    if (!upSel || !S.builds[upSel.k]) return false;
    const p = upPos(upSel.k), s = w2s(p.x, p.y + 20);
    return Math.hypot(sx - s.x, sy - s.y) <= Math.max(64 * cam.s, 40);
  }

  // ---------- pokazy zwierząt ----------
  // Co jakiś czas nad wybiegiem pojawia się dzwonek. Dotknięcie: pokaz – zwierzęta skaczą, goście się zbierają i dają monety.
  let showTimer = 90;
  function tickShow(dt) {
    if (S.show) {
      const sh = S.show;
      if (!S.builds[sh.k] || !animalOk(S.builds[sh.k])) { S.show = null; showTimer = rand(60, 100); return; }
      sh.t -= dt;
      if (sh.on) {
        const rt = RT[sh.k]; if (rt) rt.animals.forEach((a) => { if (a.jump <= 0 && Math.random() < dt * 2.5) { a.jump = 0.5; a.jumpDur = 0.5; a.jumpH = 26; a.flip = !a.flip; } a.wait = Math.max(a.wait, 0.3); });
        sh.coin -= dt;
        if (sh.coin <= 0) { sh.coin = 1.2; const c = placeCenter(sh.k); addCoins(1 + Math.floor(TYPES[S.builds[sh.k].type].att / 1.2), c.x + rand(-0.4, 0.4), c.y + rand(-0.4, 0.4), 130, 'pokaz'); }
        if (sh.t <= 0) { S.show = null; showTimer = rand(100, 160); S.cheer = Math.min(12, S.cheer + 6); sfx.joy(); sayHint('Brawo! Goście klaszczą.', 3); }
      } else if (sh.t <= 0) { S.show = null; showTimer = rand(60, 100); }   // nikt nie dotknął – dzwonek znika, bez kary
      return;
    }
    if (nightK() > 0.3) return;
    showTimer -= dt;
    if (showTimer > 0) return;
    showTimer = 20;
    const list = S.connected.filter((k) => isAnimal(k) && SHOWERS.includes(S.builds[k].type) && animalOk(S.builds[k]));
    if (!list.length) return;
    S.show = { k: pick(list), t: 30, on: false, coin: 0 }; tone(988, 0.15, 0.06); tone(1318, 0.25, 0.05, 0.15);
    if (!sayOnce('show', 'Dzwonek! ' + TYPES[S.builds[S.show.k].type].say + ' chce dać pokaz. Dotknij dzwonka.')) sayHint('Pokaz! Dotknij dzwonka.', 6);
  }
  function startShow(k) {
    if (!S.show || S.show.k !== k) return;
    S.show.on = true; S.show.t = SHOW_DUR; S.show.coin = 0.5; sfx.star(); idle = 0;
    say('Pokaz! ' + TYPES[S.builds[k].type].say + ' skacze, a goście patrzą.');
  }
  function drawBell(x, y) {
    y += Math.sin(time * 4) * 3;
    ctx.beginPath(); ctx.arc(x, y, 38 + Math.sin(time * 6) * 3, 0, 7); ctx.strokeStyle = 'rgba(211,164,58,.9)'; ctx.lineWidth = 5; ctx.stroke();
    bubble(x, y, 34);
    ctx.save(); ctx.translate(x, y + 2); ctx.rotate(Math.sin(time * 9) * 0.3);
    const g = ctx.createLinearGradient(-14, -18, 14, 14); g.addColorStop(0, '#f7df92'); g.addColorStop(1, '#b0821f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-15, 10); ctx.quadraticCurveTo(-14, -18, 0, -18); ctx.quadraticCurveTo(14, -18, 15, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a6418'; ctx.fillRect(-17, 9, 34, 4); ctx.beginPath(); ctx.arc(0, 15, 4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(0, -19, 3, 0, 7); ctx.fill();
    ctx.restore();
  }
  // Widzowie pokazu: kilku gości przed wybiegiem, podskakują i klaszczą.
  function drawCrowd(k) {
    const c = placeCenter(k);
    [[1.25, 0.2], [1.3, -0.5], [0.2, 1.3], [-0.5, 1.25], [1.15, 0.85]].forEach(([dx, dy], i) => {
      const w = g2w(c.x + dx, c.y + dy), jump = Math.abs(Math.sin(time * 6 + i)) * 6;
      LOOK.drawPerson(ctx, w.x, w.y - jump, i + 2, time * 9, false, i % 2 ? -1 : 1, 1.05);
    });
  }

  // ---------- ucieczka zwierzęcia ----------
  // Rzadko małe zwierzę wychodzi z wybiegu i chodzi po ścieżkach. Dziecko łapie je dotknięciem;
  // opiekun w pobliżu złapie je sam, a po 75 s zwierzę i tak wraca. Bez przegranej.
  let escTimer = 200;
  function tickEsc(dt) {
    if (S.esc) {
      const e = S.esc, b = S.builds[e.k];
      if (!b || !animalOk(b)) { endEsc(); return; }
      e.t += dt; e.phase = (e.phase || 0) + dt * 7;
      if (!e.q.length) {           // kolejne pole ścieżki obok
        const cx = Math.floor(e.gx), cy = Math.floor(e.gy), opts = NEI.map(([a, c]) => tkey(cx + a, cy + c)).filter((t) => S.network.has(t) && t !== e.prev);
        const n = opts.length ? pick(opts) : e.prev; e.prev = tkey(cx, cy);
        if (n) { const [x, y] = n.split(',').map(Number); e.q.push({ x: x + 0.5 + rand(-0.2, 0.2), y: y + 0.5 + rand(-0.2, 0.2) }); e.wait = Math.random() < 0.3 ? rand(0.6, 1.6) : 0; }
      }
      if (e.wait > 0) { e.wait -= dt; return; }
      const n = e.q[0];
      if (n) { const dx = n.x - e.gx, dy = n.y - e.gy, d = Math.hypot(dx, dy), v = 1.5 * dt; if (Math.abs((n.x - n.y) - (e.gx - e.gy)) > 0.01) e.flip = (n.x - n.y) > (e.gx - e.gy); e.step += v * 3; if (d <= v) { e.gx = n.x; e.gy = n.y; e.q.shift(); } else { e.gx += dx / d * v; e.gy += dy / d * v; } }
      if (e.t >= 75) { catchEsc('self'); }
      return;
    }
    if (nightK() > 0.3) return;
    escTimer -= dt;
    if (escTimer > 0) return;
    escTimer = 30;
    const list = S.connected.filter((k) => isAnimal(k) && RUNNERS.includes(S.builds[k].type) && animalOk(S.builds[k]) && !(S.show && S.show.k === k));
    if (list.length < 3 || S.network.size < 4) return;
    const k = pick(list), t = placeTiles(k).find(([x, y]) => S.network.has(tkey(x, y))); if (!t) return;
    const rt = RT[k] || makeRT(k), a = rt.animals[0]; a.gone = 1;
    S.esc = { k, type: S.builds[k].type, gx: t[0] + 0.5, gy: t[1] + 0.5, q: [], t: 0, step: 0, flip: false, prev: null, wait: 0 };
    tone(700, 0.12, 0.06); tone(520, 0.16, 0.06, 0.14);
    const nm = TYPES[S.esc.type].say;
    if (!sayOnce('esc', 'Ojej! ' + nm + (fem(S.esc.type) ? ' uciekła' : ' uciekł') + ' z wybiegu. Dotknij zwierzęcia, żeby je złapać.')) sayHint(nm + (fem(S.esc.type) ? ' uciekła! Złap ją.' : ' uciekł! Złap go.'), 4);
  }
  function endEsc() {
    if (!S.esc) return;
    const rt = RT[S.esc.k]; if (rt && rt.animals[0]) { rt.animals[0].gone = 0; rt.hop = 0.7; }
    S.esc = null; escTimer = rand(200, 320);
  }
  function catchEsc(by) {
    if (!S.esc) return false;
    const e = S.esc, w = g2w(e.gx, e.gy);
    sparkles.push({ wx: w.x, wy: w.y - 20, t: 0 }); sfx.joy();
    if (by === 'kid') { addCoins(3, e.gx, e.gy, 60, 'ucieczka'); idle = 0; say('Złapane! ' + TYPES[e.type].say + ' wraca do domu.'); }
    else if (by === 'crew') sayHint('Opiekun złapał zwierzę!', 3);
    else sayHint(TYPES[e.type].say + ' sam' + (fem(e.type) ? 'a' : '') + ' wrócił' + (fem(e.type) ? 'a' : '') + ' do wybiegu.', 3);
    endEsc(); return true;
  }
  function escHit(sx, sy) {
    if (!S.esc) return false;
    const w = g2w(S.esc.gx, S.esc.gy), p = w2s(w.x, w.y - 30);
    return Math.hypot(sx - p.x, sy - p.y) <= Math.max(70 * cam.s, 44);
  }

  // ---------- pora dnia i pogoda ----------
  // Doba trwa DAY_LEN s; noc (0–1) narasta o zmierzchu i słabnie o świcie. Deszcz przychodzi co kilka minut na ~45 s.
  let rainTimer = 200, rainbow = 0;
  function nightK() {
    const p = (S.clock % DAY_LEN) / DAY_LEN;
    if (p < 0.68) return 0; if (p < 0.76) return (p - 0.68) / 0.08; if (p < 0.9) return 1; if (p < 0.98) return 1 - (p - 0.9) / 0.08; return 0;
  }
  function tickWeather(dt) {
    const before = nightK(); S.clock += dt; const nk = nightK();
    if (before < 0.5 && nk >= 0.5) sayOnce('night', 'Zapada noc. Zwierzęta idą spać, a gości jest mniej.');
    if (before > 0.5 && nk <= 0.5) sayHint('Dzień dobry! Zoo się budzi.', 3);
    rainbow = Math.max(0, rainbow - dt);
    if (S.rain > 0) { S.rain -= dt; if (S.rain <= 0) { S.rain = 0; rainbow = 12; rainTimer = rand(180, 300); sayHint('Przestało padać. Jest tęcza!', 3); } return; }
    rainTimer -= dt;
    if (rainTimer <= 0) { S.rain = rand(35, 55); S.rainLen = S.rain; if (!sayOnce('rain', 'Pada deszcz. Goście chodzą z parasolami i przychodzi ich mniej.')) sayHint('Pada deszcz.', 4); }
  }
  const RAIN = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), v: rand(0.8, 1.3), l: rand(10, 20) }));
  // Noc, deszcz i tęcza rysowane na ekranie (już po świecie, przed winietą).
  function drawSky() {
    const nk = nightK(), rk = S.rain > 0 ? clamp(Math.min(S.rain / 3, ((S.rainLen || S.rain) - S.rain) / 3 + 0.05), 0, 1) : 0;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (nk > 0 || rk > 0) { ctx.fillStyle = `rgba(16,24,58,${0.46 * nk + 0.14 * rk})`; ctx.fillRect(0, 0, cw, ch); }
    if (nk > 0.05) {           // światła: brama, kioski i atrakcje świecą ciepło
      ctx.globalCompositeOperation = 'lighter';
      const lamp = (wx, wy, r) => { const p = w2s(wx, wy), R = r * cam.s, g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, R); g.addColorStop(0, `rgba(255,200,120,${0.38 * nk})`); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.fillRect(p.x - R, p.y - R, R * 2, R * 2); };
      { const w = g2w(7.5, BY + 0.6); lamp(w.x, w.y - 60, 170); }
      S.connected.forEach((k) => { if (isAnimal(k)) return; const c = placeCenter(k), w = g2w(c.x, c.y); lamp(w.x, w.y - 40, 150); });
      ctx.globalCompositeOperation = 'source-over';
      // gwiazdy na górze ekranu
      ctx.fillStyle = `rgba(255,250,230,${0.7 * nk})`;
      for (let i = 0; i < 40; i++) { const x = (i * 97.3 % 1) * cw, y = (i * 53.7 % 1) * ch * 0.25, tw = 0.5 + 0.5 * Math.sin(time * 2 + i); ctx.globalAlpha = nk * tw; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    if (rk > 0) {
      ctx.strokeStyle = 'rgba(210,225,240,.55)'; ctx.lineWidth = 1.4; ctx.beginPath();
      RAIN.forEach((d) => { const y = ((d.y + time * d.v * 0.9) % 1) * (ch + 40) - 20, x = ((d.x - time * 0.05 * d.v) % 1 + 1) % 1 * cw; ctx.moveTo(x, y); ctx.lineTo(x - d.l * 0.25, y + d.l); });
      ctx.globalAlpha = rk; ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (rainbow > 0) {
      const a = Math.min(1, rainbow / 3, (12 - rainbow) / 2) * 0.45, cx = cw * 0.72, cy = ch * 0.62, R = Math.min(cw, ch) * 0.7;
      ['#e26d5c', '#e89a3c', '#f2c14e', '#7fb35a', '#5f9db4', '#8b6a9b'].forEach((col, i) => { ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, R - i * 10, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); });
      ctx.globalAlpha = 1;
    }
  }

  // ---------- wycieczka szkolna ----------
  // Co kilka minut przyjeżdża autobus z dziećmi i panią. Każde dziecko płaci bilet; gdy wszyscy wrócą, wycieczka daje premię.
  let busTimer = 160;
  const BUS_SPOT = () => ({ x: 5.0, y: ROAD - 0.95 });
  function tickBus(dt) {
    if (S.cars.some((c) => c.kind === 'bus')) return;
    if (nightK() > 0.2 || S.rain > 0) return;
    busTimer -= dt;
    if (busTimer > 0) return;
    busTimer = 30;
    const animals = S.connected.filter((k) => isAnimal(k) && animalOk(S.builds[k]));
    if (animals.length < 4 || S.rate < 35) return;
    busTimer = rand(240, 360);
    const sp = BUS_SPOT(), left = Math.random() < 0.5;
    S.cars.push({ st: 'in', kind: 'bus', x: carFar(left), y: ROAD, q: [{ x: sp.x, y: ROAD }, { x: sp.x, y: sp.y }], dx: left ? 1 : -1, dy: 0, col: '#d9a83a', slot: { x: sp.x, y: sp.y, k: 'bus' }, n: 0 });
    tone(392, 0.2, 0.06); tone(523, 0.3, 0.06, 0.2);
    if (!sayOnce('bus', 'Przyjechała wycieczka szkolna! Dzieci chcą zobaczyć zwierzęta. Gdy wrócą zadowolone, dostaniesz dużo monet.')) sayHint('Wycieczka szkolna!', 4);
  }
  function busArrive(c) {
    const n = 6;
    for (let i = 0; i < n; i++) {
      addGuest(c.slot.x + 0.25 * (i % 3) - 0.25, c.slot.y + 0.3 * Math.floor(i / 3), c);
      const g = S.guests[S.guests.length - 1]; g.look = i === 0 ? 6 : (i % 2 ? 2 : 4); g.visits = 3; g.wait = i * 0.35;
    }
    c.n = n;
  }
  function busLeave(c) {
    c.n--; if (c.n > 0) return;
    const sp = c.slot; addCoins(10 + Math.round(S.rate / 10), sp.x, sp.y, 90, 'wycieczka'); S.cheer = Math.min(12, S.cheer + 5); sfx.star();
    say('Wycieczka dziękuje! Dzieci były zachwycone.');
    carLeave(c);
  }

  // ---------- goście ----------
  let spawnTimer = 0, hungerTimer = 25, wishTimer = 40, wishJoy = 0, guestSeq = 0, rescueTimer = 0;
  let ROAD = BY + 2.5;
  function spawnGuest() {
    if (Math.random() < 0.72) {             // większość przyjeżdża samochodem
      const left = Math.random() < 0.5, c0 = CAR_COLS[guestSeq % CAR_COLS.length], sl = freeSlot(); guestSeq++;
      if (!sl) {                             // parking pełny: kierowca przejeżdża, trąbi i się denerwuje
        S.angry = Math.min(60, S.angry + 6); tone(300, 0.12, 0.05, 0, 'square'); tone(300, 0.14, 0.05, 0.16, 'square');
        S.cars.push({ st: 'pass', x: carFar(left), y: ROAD, q: [{ x: carFar(!left), y: ROAD }], dx: left ? 1 : -1, dy: 0, col: c0, mad: 1 });
        sayOnce('park', 'Parking jest pełny i kierowcy się denerwują. Kup działkę pod parking za drogą.');
        return;
      }
      S.cars.push({ st: 'in', x: carFar(left), y: ROAD, q: [{ x: sl.x, y: ROAD }, { x: sl.x, y: sl.y }], dx: left ? 1 : -1, dy: 0, col: c0, slot: sl });
      return;
    }
    const fromLeft = Math.random() < 0.5;
    addGuest(fromLeft ? 3 : 12.5, ROAD, null);
  }
  function addGuest(x, y, car) {
    const g = { id: ++guestSeq, x, y, car, color: guestSeq % 5, ox: rand(-0.24, 0.24), oy: rand(-0.24, 0.24), q: [], st: 'in',
      visits: 2 + (Math.random() < 0.5 ? 1 : 0), seen: [], wait: 0, last: null, phase: rand(0, 6), fade: 0, at: null };
    g.q = [{ x: 7.5, y: ROAD }, { x: 7.5, y: BY + 1.5 }, { x: 7.5, y: BY + 0.5 }, { x: 7.5, y: BY - 0.5 }];
    if (car) g.q.unshift({ x, y: ROAD });
    S.guests.push(g);
  }
  function guestFromCar(c) { if (c.kind === 'bus') busArrive(c); else addGuest(c.slot.x, c.slot.y, c); }
  function nextTarget(g) {
    const open = S.connected.filter((k) => isOpen(k) && !g.seen.includes(k));
    if (!open.length || g.visits <= 0) return goHome(g);
    const key = pick(open);
    const from = g.at || GATE_TILE;
    const tiles = placeTiles(key).map(([x, y]) => tkey(x, y)).filter((t) => S.network.has(t));
    const route = bfsPath(from, tiles);
    if (!route) return goHome(g);
    g.q = route.map((t) => ({ x: t.x + 0.5 + g.ox, y: t.y + 0.5 + g.oy })); g.st = 'to'; g.target = key;
    g.at = route[route.length - 1]; g.visits--; g.seen.push(key);
  }
  function goHome(g) {
    const route = bfsPath(g.at || GATE_TILE, [tkey(GATE_TILE.x, GATE_TILE.y)]) || [];
    g.q = route.map((t) => ({ x: t.x + 0.5 + g.ox, y: t.y + 0.5 + g.oy }));
    g.q.push({ x: 7.5, y: BY + 0.5 }, { x: 7.5, y: BY + 1.5 }, { x: 7.5, y: ROAD });
    if (g.car) g.q.push({ x: g.car.slot.x, y: ROAD }, { x: g.car.slot.x, y: g.car.slot.y });
    else g.q.push({ x: Math.random() < 0.5 ? 3 : 12.5, y: ROAD });
    g.st = 'out';
  }
  function dropTrash(g, chance) {
    if (!g.at || S.trash.length >= MAX_TRASH || Math.random() > chance) return;
    if (binNear(g.at.x, g.at.y)) return;             // przy śmietniku nikt nie śmieci
    const k = tkey(g.at.x, g.at.y);
    if (!S.paths.has(k) || S.trash.includes(k) || k === tkey(GATE_TILE.x, GATE_TILE.y)) return;
    S.trash.push(k); dirty = true;
    if (!S.seen.trash) sayOnce('trash', 'Ktoś nabałaganił. Dotknij śmieci, żeby posprzątać. W czystym zoo goście dają napiwek.');
  }
  function stepGuest(g, dt) {
    g.fade = Math.min(1, g.fade + dt * 2.5); g.phase += dt * 9;
    if (g.wait > 0) { g.wait -= dt; if (g.wait <= 0 && g.st === 'look') nextTarget(g); return; }
    let move = 2 * dt;
    while (move > 0 && g.q.length) {
      const n = g.q[0], dx = n.x - g.x, dy = n.y - g.y, d = Math.hypot(dx, dy);
      if (d <= move) { g.x = n.x; g.y = n.y; g.q.shift(); move -= d; } else { g.x += dx / d * move; g.y += dy / d * move; move = 0; }
    }
    if (g.q.length) return;
    if (g.st === 'in') { addCoins(ticket(), 7.5, BY - 0.2, 70, 'bilet'); g.at = { x: GATE_TILE.x, y: GATE_TILE.y }; nextTarget(g); }
    else if (g.st === 'to') {
      const b = S.builds[g.target];
      if (b && TYPES[b.type].kind === 'kiosk' && isConnected(g.target) && b.st > 0 && Math.random() < BUY) {
        const c = placeCenter(g.target);
        addCoins(TYPES[b.type].pay, c.x, c.y, 140, 'kiosk'); b.st--; dirty = true;
        if (b.st === 0) { tone(330, 0.15, 0.05); if (!S.seen.empty) sayOnce('empty', 'Kiosk jest pusty. Dotknij skrzynki, żeby go uzupełnić.'); }
        dropTrash(g, 0.35);
      } else if (b && TYPES[b.type].kind === 'fun' && TYPES[b.type].pay && isConnected(g.target) && Math.random() < 0.55) {
        const c = placeCenter(g.target); addCoins(TYPES[b.type].pay, c.x, c.y, 140, 'atrakcja'); dropTrash(g, 0.15);
      } else dropTrash(g, 0.08);
      g.last = g.target; g.st = 'look'; g.wait = rand(2, 3.5);
    } else if (g.st === 'out') { g.dead = true; if (g.car) { if (g.car.kind === 'bus') busLeave(g.car); else carLeave(g.car); } }
  }

  // ---------- kamera ----------
  const cam = { x: 0, y: 150, s: 1 };
  let camSnap = true;
  // Widok: na małym zoo cała mapa (jak dawniej). Gdy zoo urośnie, kamera nie oddala się bardziej niż do ZMIN,
  // a resztę mapy pokazuje się przesuwając palcem (albo szczypiąc dwoma palcami / kółkiem myszy).
  const view = { x: null, y: null, z: 0 };   // z: przybliżenie wybrane przez gracza (0 = automatyczne)
  const TOP_BAR = () => 96 * u;
  function contentBox() {
    const list = [...S.plots, ...buyablePlots()];
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const addp = (gx, gy) => { const w = g2w(gx, gy); x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x); y0 = Math.min(y0, w.y); y1 = Math.max(y1, w.y); };
    list.forEach((k) => { const b = plotBase(k); addp(b.x, b.y); addp(b.x + PLOT, b.y); addp(b.x, b.y + PLOT); addp(b.x + PLOT, b.y + PLOT); });
    addp(7.5, BY + 3.4);                     // brama i droga
    addp(0, PY + 3.6); addp(COLS * PLOT, PY + 3.6);   // pas parkingów za drogą
    addp(WISH_POS.x, WISH_POS.y);                   // gość z życzeniem
    y0 -= 70;                                // tabliczki i korony drzew z tyłu
    return { x0, x1, y0, y1 };
  }
  const ZMAX = () => 2.1 * u;                // największe przybliżenie
  const ZMIN = () => 0.86 * u;               // domyślnie nie oddalamy bardziej (zwierzęta zostają wyraźne)
  function fitScale(B) { const pad = 20 * u; return Math.min((cw - pad * 2) / (B.x1 - B.x0), (ch - TOP_BAR() - pad) / (B.y1 - B.y0), 1.45 * u * 1.25); }
  // Pilnuje, żeby widok nie uciekł poza zoo; gdy w danym kierunku wszystko się mieści – środkuje.
  function clampView(x, y, s, B) {
    const m = 60, halfW = cw / 2 / s, up = (ch / 2 - TOP_BAR()) / s, down = ch / 2 / s;
    x = (2 * halfW >= B.x1 - B.x0) ? (B.x0 + B.x1) / 2 : clamp(x, B.x0 - m + halfW, B.x1 + m - halfW);
    y = (up + down >= B.y1 - B.y0) ? (B.y0 + B.y1) / 2 - TOP_BAR() / 2 / s : clamp(y, B.y0 - m + up, B.y1 + m - down);
    return { x, y };
  }
  function viewScale(B) {
    const fit = fitScale(B);
    if (view.z) return clamp(view.z, Math.min(fit, ZMIN()), ZMAX());
    return Math.max(fit, Math.min(ZMIN(), 1.45 * u * 1.25));
  }
  function camTarget() {
    if (S.panel) {
      const c = placeCenter(S.panel), w = g2w(c.x, c.y), s = Math.min(1.1 * u * 1.25, (ch - PANEL_H * u) / 420);
      return { x: w.x, y: w.y - 40 + (PANEL_H * u / 2) / s, s };
    }
    const B = contentBox(), s = viewScale(B);
    if (view.x == null) { view.x = (B.x0 + B.x1) / 2; view.y = (B.y0 + B.y1) / 2; }
    // dłoń z podpowiedzią poza ekranem: kamera płynnie jedzie do niej
    if (hint && S.scene === 'play' && !S.overlay && idle >= hint.wait && !ptr) {
      const p = { x: (hint.x - cam.x) * cam.s + cw / 2, y: (hint.y - cam.y) * cam.s + ch / 2 };
      if (!hint.ui && (p.x < 70 || p.x > cw - 70 || p.y < TOP_BAR() + 50 || p.y > ch - 60)) { view.x = hint.x; view.y = hint.y + 40; }
    }
    const c = clampView(view.x, view.y, s, B);
    view.x = c.x; view.y = c.y;
    return { x: c.x, y: c.y, s };
  }
  // Przesunięcie widoku o piksele ekranu (palec) – natychmiast, bez opóźnienia.
  function panBy(dx, dy) {
    const B = contentBox(), s = viewScale(B);
    if (view.x == null) { view.x = cam.x; view.y = cam.y; }
    const c = clampView(view.x - dx / cam.s, view.y - dy / cam.s, s, B);
    view.x = c.x; view.y = c.y; cam.x = c.x; cam.y = c.y;
  }
  // Przybliżenie wokół punktu ekranu (szczypanie, kółko myszy).
  function zoomAt(sx, sy, ns) {
    const B = contentBox(), fit = fitScale(B);
    ns = clamp(ns, Math.min(fit, ZMIN()), ZMAX());
    const wx = (sx - cw / 2) / cam.s + cam.x, wy = (sy - ch / 2) / cam.s + cam.y;
    view.z = ns; cam.s = ns;
    const c = clampView(wx - (sx - cw / 2) / ns, wy - (sy - ch / 2) / ns, viewScale(B), B);
    view.x = c.x; view.y = c.y; cam.x = c.x; cam.y = c.y;
  }
  const w2s = (wx, wy) => ({ x: (wx - cam.x) * cam.s + cw / 2, y: (wy - cam.y) * cam.s + ch / 2 });
  const s2w = (sx, sy) => ({ x: (sx - cw / 2) / cam.s + cam.x, y: (sy - ch / 2) / cam.s + cam.y });

  // ---------- wskazówki ----------
  let idle = 0, hint = null, hintTimer = 0;
  function computeHint() {
    if (S.panel || S.scene !== 'play' || S.overlay) return null;
    if (!S.plots.size) { const b = g2w(7.5, BY - 2.5); return { x: b.x, y: b.y - 60, wait: 1.5 }; }
    const builds = Object.keys(S.builds);
    const cut = builds.filter((k) => needOf(k) === 'cut');
    if (cut.length) {
      const route = missingRoute(cut[0]);
      if (route.length) { const [x, y] = route[0].split(',').map(Number), w = g2w(x + 0.5, y + 0.5); return { x: w.x, y: w.y, route, wait: 2 }; }
    }
    const needy = S.connected.filter((k) => needOf(k) === 'h' || needOf(k) === 'st' || needOf(k) === 'show');
    if (needy.length) { const k = needy[0], c = placeCenter(k), w = g2w(c.x, c.y); return { x: w.x, y: bubbleY(k, w.y), wait: 4 }; }
    if (S.trash.length >= 3 && !Object.keys(S.bins).length && S.coins >= BIN_PRICE && S.tool !== 'bin') { const r = btnBin(); return { ui: true, x: r.x + r.w / 2, y: r.y + 10, wait: 3 }; }
    if (S.trash.length >= 3) { const [x, y] = S.trash[0].split(',').map(Number), w = g2w(x + 0.5, y + 0.5); return { x: w.x, y: w.y - 10, wait: 5 }; }
    const free = freePlaces();
    if (builds.some((k) => needOf(k) === 'sick') && !freeVet() && free.length && S.coins >= TYPES.wet.price && !builds.some((k) => S.builds[k].type === 'wet' && S.builds[k].b)) { const c = placeCenter(free[0]), w = g2w(c.x, c.y); return { x: w.x, y: w.y, wait: 3 }; }
    { const ob = Object.keys(S.obst).find((k) => { if (S.clear[k]) return false; const [x, y] = k.split(',').map(Number); return S.plots.has(plotOf(x, y)); });
      if (ob && (!free.length || builds.some((k) => needOf(k) === 'cut'))) { const [x, y] = ob.split(',').map(Number), w = g2w(x + 0.5, y + 0.5); return { x: w.x, y: w.y - 10, wait: 3 }; } }
    if (!builds.length && free.length) { const c = placeCenter(free[0]), w = g2w(c.x, c.y); return { x: w.x, y: w.y, wait: 1.5 }; }
    const cheapest = Math.min(...unlocked().map((t) => TYPES[t].price));
    if (free.length && S.coins >= cheapest) { const c = placeCenter(free[0]), w = g2w(c.x, c.y); return { x: w.x, y: w.y, wait: 9 }; }
    const buy = buyablePlots();
    if (buy.length && S.coins >= plotPrice()) { const b = plotBase(buy[0]), w = g2w(b.x + 2.5, b.y + 2.5); return { x: w.x, y: w.y - 60, wait: 9 }; }
    return null;
  }
  function freePlaces() {
    const out = [];
    S.plots.forEach((p) => QUADS.forEach((_, q) => { const k = placeKey(p, q); if (!S.builds[k] && !quadBlocked(k)) out.push(k); }));
    return out;
  }

  // ---------- pętla ----------
  const flyers = [], minus = [], sparkles = [], splashes = [], dust = [], signShake = {};
  let time = 0, cardShake = {}, resetHold = 0;
  let goalTimer = 2;
  function tick(dt) {
    time += dt; idle += dt;
    Object.keys(pathAnim).forEach((k) => { pathAnim[k] -= dt; if (pathAnim[k] <= 0) delete pathAnim[k]; });
    Object.keys(signShake).forEach((k) => { signShake[k] -= dt; if (signShake[k] <= 0) delete signShake[k]; });
    Object.keys(cardShake).forEach((k) => { cardShake[k] -= dt; if (cardShake[k] <= 0) delete cardShake[k]; });
    for (let i = flyers.length - 1; i >= 0; i--) { flyers[i].t += dt; if (flyers[i].t > 1.1) flyers.splice(i, 1); }
    for (let i = minus.length - 1; i >= 0; i--) { minus[i].t += dt; if (minus[i].t > 0.9) minus.splice(i, 1); }
    for (let i = sparkles.length - 1; i >= 0; i--) { sparkles[i].t += dt; if (sparkles[i].t > 0.6) sparkles.splice(i, 1); }
    for (let i = splashes.length - 1; i >= 0; i--) { splashes[i].t += dt; if (splashes[i].t > 0.9) splashes.splice(i, 1); }
    for (let i = dust.length - 1; i >= 0; i--) { dust[i].t += dt; if (dust[i].t > 0.8) dust.splice(i, 1); }
    saveFlash = Math.max(0, saveFlash - dt);
    if (S.overlay) S.overlay.t += dt;
    wishJoy = Math.max(0, wishJoy - dt);
    if (S.scene === 'title' || S.scene === 'slots' || S.slot == null) return;
    Object.keys(S.builds).forEach((k) => {
      const rt = RT[k] || makeRT(k), hungry = S.builds[k].h, B0 = S.builds[k];
      if (B0.b > 0) { rt.shake = Math.max(0, rt.shake - dt); B0.b -= dt; rt.dust = (rt.dust || 0) - dt; if (rt.dust <= 0) { rt.dust = 0.3; const c = placeCenter(k), w = g2w(c.x, c.y); dust.push({ wx: w.x + rand(-70, 70), wy: w.y + rand(-22, 30), t: 0 }); tone(rand(240, 320), 0.05, 0.022, 0, 'square'); } if (B0.b <= 0) finishBuild(k); return; }
      rt.pop = Math.min(1, rt.pop + dt * 3); rt.hop = Math.max(0, rt.hop - dt); rt.shake = Math.max(0, rt.shake - dt);
      rt.fed = Math.max(0, rt.fed - dt);
      const type = S.builds[k].type, pool = TYPES[type].kind === 'animal' ? LOOK.POOL[TYPES[type].biome] : null;
      rt.animals.forEach((a) => {
        a.jump = Math.max(0, a.jump - dt);
        const wet = inPool(pool, a.x, a.y);
        a.sink = lerp(a.sink, wet ? (SINK[type] || 0) : 0, 1 - Math.pow(0.03, dt));
        if (wet && !a.wet && (SINK[type] || 0) > 0.3) { const c = placeCenter(k), w = g2w(c.x, c.y); splashes.push({ wx: w.x + a.x, wy: w.y + a.y, t: 0 }); }
        a.wet = wet;
        if (a.gone) return;                                                               // uciekło z wybiegu
        if (hungry || B0.sick || away(B0)) { a.wait = Math.max(a.wait, 0.5); return; }   // głodne zwierzę stoi przy misce
        if (nightK() > 0.6 && !(S.show && S.show.k === k)) { a.wait = Math.max(a.wait, 0.5); return; }   // noc: śpi
        if (a.wait > 0) {
          a.wait -= dt;
          const J = JUMPERS[type]; if (J && !wet && a.jump <= 0 && Math.random() < dt * 0.3) { a.jump = J[1]; a.jumpDur = J[1]; a.jumpH = J[0]; }
          if (a.wait <= 0) { const m = rt.animals[0], p = a.baby && m && !m.gone ? { x: m.tx + rand(-20, 20), y: m.ty + rand(4, 12) } : spotFor(type); a.tx = p.x; a.ty = p.y; a.flip = p.x > a.x; }
          return;
        }
        const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy), v = (a.fast ? 34 : 12) * dt;
        a.step += (a.fast ? 34 : 12) * dt / (window.ZOO_ANIMALS.A[type].stride || window.ZOO_ANIMALS.A[type].h * 0.36 + 6) * Math.PI * 2;
        const H = HOPPERS[type]; if (H && a.jump <= 0 && !wet) { a.jump = H[1]; a.jumpDur = H[1]; a.jumpH = H[0]; }
        if (d <= v) { a.x = a.tx; a.y = a.ty; a.wait = a.fast ? rand(3, 5) : wet && type === 'pingwin' ? rand(1.2, 2.5) : rand(2, 6); a.fast = 0; } else { a.x += dx / d * v; a.y += dy / d * v; }
      });
    });
    spawnTimer -= dt;
    const every = spawnEvery();
    if (spawnTimer <= 0 && every < Infinity && S.guests.length + S.cars.filter((c) => c.st === 'in').length < maxGuests()) { spawnGuest(); spawnTimer = every * rand(0.85, 1.15); }
    if (every === Infinity) spawnTimer = Math.min(spawnTimer, 1);
    S.guests.forEach((g) => stepGuest(g, dt));
    S.guests = S.guests.filter((g) => !g.dead);
    tickCars(dt); tickClear(dt); tickHealth(dt); tickRate(dt);
    tickCrew(dt); tickBabies(dt); tickUpgrades(dt); tickShow(dt); tickEsc(dt); tickWeather(dt); tickBus(dt);
    Object.keys(S.bins).forEach((k) => { if (S.bins[k] > 0) { S.bins[k] = Math.max(0, S.bins[k] - dt); if (S.bins[k] === 0) { sfx.build(); dirty = true; } } });
    Object.keys(S.parks).forEach((i) => { const P = S.parks[i]; if (P.st !== 1) return; P.b -= dt; if (P.b <= 0) { P.st = 2; P.b = 0; sfx.joy(); saveNow(); say('Parking gotowy! Jest więcej miejsc na samochody.'); } });
    for (let i = S.veh.length - 1; i >= 0; i--) {
      const V0 = S.veh[i]; let m = VEH_V * dt;
      while (m > 0 && V0.pts.length) { const n = V0.pts[0], dx = n.x - V0.x, dy = n.y - V0.y, d = Math.hypot(dx, dy); if (d > 0.001) { V0.dx = dx / d; V0.dy = dy / d; } if (d <= m) { V0.x = n.x; V0.y = n.y; V0.pts.shift(); m -= d; } else { V0.x += dx / d * m; V0.y += dy / d * m; m = 0; } }
      if (!V0.pts.length) S.veh.splice(i, 1);
    }
    goalTimer -= dt; if (goalTimer <= 0) { goalTimer = 1.5; checkGoal(); }
    // głód: co jakiś czas jedno połączone, najedzone zwierzę robi się głodne
    hungerTimer -= nightK() > 0.5 ? 0 : dt;              // w nocy zwierzęta śpią i nie głodnieją
    if (hungerTimer <= 0) {
      hungerTimer = rand(20, 32);
      const list = S.connected.filter((k) => isAnimal(k) && animalOk(S.builds[k]));
      if (list.length) {
        const k = pick(list); S.builds[k].h = 1; dirty = true; sfx.hungry();
        if (!S.seen.hungry) sayOnce('hungry', TYPES[S.builds[k].type].say + (fem(S.builds[k].type) ? ' jest głodna.' : ' jest głodny.') + ' Dotknij miski i nakarm zwierzę. Głodne zwierzę nie przyciąga gości.');
      }
    }
    // życzenie gościa
    if (!S.wish) {
      wishTimer -= dt;
      if (wishTimer <= 0) {
        wishTimer = 15;
        const have = builtTypes(), cand = unlocked().filter((t) => ALL.includes(t) && !have.has(t)).sort((a, b) => TYPES[a].price - TYPES[b].price).slice(0, 3);
        if (S.connected.some(isAnimal) && cand.length) {
          S.wish = pick(cand); dirty = true; sfx.joy();
          if (!sayOnce('wish', 'Gość ma marzenie! Chce zobaczyć: ' + TYPES[S.wish].say + '. Postaw to w zoo, a dostaniesz dużo monet.')) sayHint('Gość chce: ' + TYPES[S.wish].say, 3);
        }
      }
    }
    rescueTimer -= dt;
    if (rescueTimer <= 0) { rescueTimer = 2; if (rescueCoins()) sfx.coin(); }
    hintTimer -= dt;
    if (hintTimer <= 0) { hint = computeHint(); hintTimer = 0.3; }
    const filled = S.plots.size === COLS * ROWS && Object.keys(S.builds).length === S.plots.size * 4 && !Object.values(S.builds).some((b) => b.b);
    if (filled && !S.seen.all) { S.seen.all = 1; dirty = true; sfx.joy(); say('Brawo! Masz całe, wielkie zoo!'); }
    if (dirty && performance.now() - lastSave > 2000) saveNow();
  }

  // Działka jako bryła: trawnik na wierzchu i ziemia na przednich ściankach (tam, gdzie nie styka się z inną działką).
  function drawPlotSlab(k) {
    const p = plotBase(k), H = 16;
    const A0 = g2w(p.x, p.y), B0 = g2w(p.x + PLOT, p.y), C0 = g2w(p.x + PLOT, p.y + PLOT), D0 = g2w(p.x, p.y + PLOT);
    const openL = !S.plots.has(tkey(p.px, p.py + 1)), openR = !S.plots.has(tkey(p.px + 1, p.py));
    ctx.fillStyle = 'rgba(20,30,10,.22)';
    if (openL) { ctx.beginPath(); ctx.moveTo(D0.x, D0.y); ctx.lineTo(C0.x, C0.y); ctx.lineTo(C0.x + 14, C0.y + H + 8); ctx.lineTo(D0.x + 14, D0.y + H + 8); ctx.closePath(); ctx.fill(); }
    if (openR) { ctx.beginPath(); ctx.moveTo(C0.x, C0.y); ctx.lineTo(B0.x, B0.y); ctx.lineTo(B0.x + 14, B0.y + H + 8); ctx.lineTo(C0.x + 14, C0.y + H + 8); ctx.closePath(); ctx.fill(); }
    const face = (P, Q, col, dark) => {
      ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(Q.x, Q.y); ctx.lineTo(Q.x, Q.y + H); ctx.lineTo(P.x, P.y + H); ctx.closePath();
      const g = ctx.createLinearGradient(0, Math.min(P.y, Q.y), 0, Math.max(P.y, Q.y) + H); g.addColorStop(0, col); g.addColorStop(1, dark); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(40,28,15,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P.x, P.y + H * 0.55); ctx.lineTo(Q.x, Q.y + H * 0.55); ctx.stroke();
      ctx.strokeStyle = '#6f8f45'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(P.x, P.y + 1); ctx.lineTo(Q.x, Q.y + 1); ctx.stroke();
    };
    if (openL) face(D0, C0, '#8a6a45', '#5e4730');
    if (openR) face(C0, B0, '#6e5236', '#45331f');
    diamond(p.x, p.y, p.x + PLOT, p.y + PLOT); ctx.fillStyle = PAT.own; ctx.fill();
    ctx.strokeStyle = 'rgba(255,250,220,.16)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(D0.x, D0.y); ctx.lineTo(A0.x, A0.y); ctx.lineTo(B0.x, B0.y); ctx.stroke();
  }
  let edgeBuf = [];
  function edgeLine(x1, y1, x2, y2) { edgeBuf.push(g2w(x1, y1), g2w(x2, y2)); }
  function flushEdges() {
    if (!edgeBuf.length) return;
    const run = (dy) => { ctx.beginPath(); for (let i = 0; i < edgeBuf.length; i += 2) { ctx.moveTo(edgeBuf[i].x, edgeBuf[i].y + dy); ctx.lineTo(edgeBuf[i + 1].x, edgeBuf[i + 1].y + dy); } ctx.stroke(); };
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#8b7d60'; ctx.lineWidth = 5; run(1);
    ctx.strokeStyle = '#e3d9c0'; ctx.lineWidth = 2.2; run(-1.2);
    ctx.lineCap = 'butt'; edgeBuf = [];
  }
  function drawTree(t, i) {
    const w = g2w(t[1], t[2]), p = treeOf(t[0], i), sway = t[0] === 'skala' ? 0 : Math.sin(time * 1.1 + i * 1.7) * 0.03 + Math.sin(time * 2.7 + i) * 0.008;
    ctx.save(); ctx.translate(w.x, w.y); ctx.scale(t[3] * 0.9, t[3] * 0.9); ctx.transform(1, 0, sway, 1, 0, 0); blit(p, 0, 0); ctx.restore();
  }
  function guestDir(g) {
    const n = g.q[0]; if (n) { const d = (n.x - n.y) - (g.x - g.y); if (Math.abs(d) > 0.01) g.dir = d < 0 ? -1 : 1; }
    return g.dir || 1;
  }
  function drawWorld() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#5a7a3f'; ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(DPR * cam.s, 0, 0, DPR * cam.s, DPR * (cw / 2 - cam.x * cam.s), DPR * (ch / 2 - cam.y * cam.s));
    const a = s2w(0, 0), b = s2w(cw, ch);
    ctx.fillStyle = PAT.wild; ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    if (MAPS[S.map].tint) { ctx.fillStyle = MAPS[S.map].tint; ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); }
    { const MX = -2800, MY = -1000, MW = 5600, MH = 3150, kx = MOTTLE.width / MW, ky = MOTTLE.height / MH;
      const x0 = clamp(a.x, MX, MX + MW), y0 = clamp(a.y, MY, MY + MH), x1 = clamp(b.x, MX, MX + MW), y1 = clamp(b.y, MY, MY + MH);
      if (x1 > x0 && y1 > y0) { ctx.globalAlpha = 0.5; ctx.drawImage(MOTTLE, (x0 - MX) * kx, (y0 - MY) * ky, (x1 - x0) * kx, (y1 - y0) * ky, x0, y0, x1 - x0, y1 - y0); ctx.globalAlpha = 1; } }
    // droga z krawężnikami
    diamond(-40, ROAD - 0.6, 60, ROAD + 0.6); ctx.fillStyle = PAT.asphalt; ctx.fill();
    { const t1 = g2w(-40, ROAD - 0.6), t2 = g2w(60, ROAD - 0.6), b1 = g2w(-40, ROAD + 0.6), b2 = g2w(60, ROAD + 0.6);
      ctx.strokeStyle = '#c9c2b0'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.stroke();
      ctx.strokeStyle = '#9b9585'; ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(30,30,25,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b1.x, b1.y + 4); ctx.lineTo(b2.x, b2.y + 4); ctx.stroke(); }
    { const s0 = g2w(-40, ROAD), e0 = g2w(60, ROAD); ctx.strokeStyle = 'rgba(236,228,206,.8)'; ctx.lineWidth = 3; ctx.setLineDash([26, 24]); ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(e0.x, e0.y); ctx.stroke(); ctx.setLineDash([]); }
    drawParks();
    // działki na sprzedaż
    const buy = buyablePlots();
    buy.forEach((k) => {
      const p = plotBase(k);
      diamond(p.x, p.y, p.x + PLOT, p.y + PLOT); ctx.fillStyle = 'rgba(150,180,110,.16)'; ctx.fill();
      ctx.strokeStyle = 'rgba(244,236,214,.75)'; ctx.lineWidth = 3; ctx.setLineDash([16, 12]); ctx.stroke(); ctx.setLineDash([]);
    });
    // kupione działki (od tyłu do przodu, żeby ścianki ziemi się dobrze nakładały)
    [...S.plots].sort((p, q) => { const A1 = p.split(',').map(Number), B1 = q.split(',').map(Number); return A1[0] + A1[1] - B1[0] - B1[1]; }).forEach(drawPlotSlab);
    drawTerrainLayer(a, b);
    S.plots.forEach((k) => {
      const p = plotBase(k);
      QUADS.forEach(([qx, qy], q) => {
        if (S.builds[placeKey(k, q)] || quadBlocked(placeKey(k, q))) return;
        diamond(p.x + qx + 0.08, p.y + qy + 0.08, p.x + qx + 1.92, p.y + qy + 1.92);
        ctx.fillStyle = PAT.free; ctx.fill(); ctx.strokeStyle = 'rgba(244,238,221,.85)'; ctx.lineWidth = 3; ctx.setLineDash([12, 10]); ctx.stroke(); ctx.setLineDash([]);
      });
      // pola, na których można ułożyć ścieżkę
      for (let i = 0; i < PLOT; i++) for (let j = 0; j < PLOT; j++) {
        if (i !== 2 && j !== 2) continue;
        const x = p.x + i, y = p.y + j, tk = tkey(x, y);
        if (S.paths.has(tk) || S.obst[tk]) continue;
        const next = S.paths.size ? NEI.some(([u1, v]) => S.paths.has(tkey(x + u1, y + v))) : tk === tkey(GATE_TILE.x, GATE_TILE.y);
        diamond(x + 0.06, y + 0.06, x + 0.94, y + 0.94);
        ctx.fillStyle = next ? 'rgba(239,231,212,.22)' : 'rgba(239,231,212,.08)'; ctx.fill();
        ctx.strokeStyle = next ? 'rgba(244,238,221,.75)' : 'rgba(244,238,221,.28)'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.stroke(); ctx.setLineDash([]);
      }
    });
    // wjazd od drogi do bramy
    diamond(7, BY, 8, BY + 1.95); ctx.fillStyle = PAT.gravel; ctx.fill();
    edgeLine(7, BY, 7, BY + 1.95); edgeLine(8, BY, 8, BY + 1.95); flushEdges();
    // ścieżki: żwir z kamiennym obrzeżem
    S.paths.forEach((tk) => {
      const [x, y] = tk.split(',').map(Number);
      const k = pathAnim[tk] ? 1 - pathAnim[tk] / 0.25 : 1, m = (1 - k) * 0.35;
      diamond(x + m, y + m, x + 1 - m, y + 1 - m); ctx.fillStyle = PAT.gravel; ctx.fill();
    });
    ctx.lineCap = 'round';
    S.paths.forEach((tk) => {
      const [x, y] = tk.split(',').map(Number);
      if (!S.paths.has(tkey(x, y - 1))) edgeLine(x, y, x + 1, y);
      if (!S.paths.has(tkey(x + 1, y))) edgeLine(x + 1, y, x + 1, y + 1);
      if (!S.paths.has(tkey(x, y + 1)) && !(x === GATE_TILE.x && y === GATE_TILE.y)) edgeLine(x, y + 1, x + 1, y + 1);
      if (!S.paths.has(tkey(x - 1, y))) edgeLine(x, y, x, y + 1);
    });
    flushEdges();
    // podpowiedź trasy
    if (hint && hint.route && idle >= hint.wait) {
      const al = 0.3 + 0.25 * Math.sin(time * 5);
      hint.route.forEach((tk) => { const [x, y] = tk.split(',').map(Number); diamond(x + 0.05, y + 0.05, x + 0.95, y + 0.95); ctx.fillStyle = `rgba(205,189,155,${al + 0.25})`; ctx.fill(); });
    }
    // śmieci
    if (S.tool === 'bin') S.paths.forEach((tk) => { const [x, y] = tk.split(',').map(Number); if (binNear(x, y)) { diamond(x + 0.06, y + 0.06, x + 0.94, y + 0.94); ctx.fillStyle = 'rgba(110,170,110,.42)'; ctx.fill(); } else { diamond(x + 0.06, y + 0.06, x + 0.94, y + 0.94); ctx.strokeStyle = 'rgba(244,238,221,.7)'; ctx.lineWidth = 2; ctx.stroke(); } });
    S.trash.forEach((tk, i) => { const [x, y] = tk.split(',').map(Number), w = g2w(x + 0.5 + (i % 2 ? 0.12 : -0.1), y + 0.5); spr('smiec', w.x, w.y + 8, 1.5); });
    sparkles.forEach((s) => {
      const k = s.t / 0.6; ctx.globalAlpha = 1 - k; ctx.strokeStyle = C.light; ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) { const an = i * Math.PI / 3, r0 = 10 + k * 30, r1 = 18 + k * 40; ctx.beginPath(); ctx.moveTo(s.wx + Math.cos(an) * r0, s.wy - 10 + Math.sin(an) * r0 * 0.6); ctx.lineTo(s.wx + Math.cos(an) * r1, s.wy - 10 + Math.sin(an) * r1 * 0.6); ctx.stroke(); }
      ctx.globalAlpha = 1;
    });
    // obiekty sortowane po głębokości
    const objs = [];
    TREES.forEach((t, i) => objs.push({ d: t[1] + t[2], f: () => drawTree(t, i) }));
    Object.keys(S.obst).forEach((tk) => {
      const kind = S.obst[tk]; if (kind !== 'drzewo' && kind !== 'skala') return;
      const [x, y] = tk.split(',').map(Number), w = g2w(x + 0.5, y + 0.5);
      if (w.x < a.x - 110 || w.x > b.x + 110 || w.y < a.y - 30 || w.y > b.y + 170) return;
      objs.push({ d: x + y + 1, f: () => drawObstacleTree(tk, kind, x, y, w) });
    });
    Object.keys(S.clear).forEach((tk) => { const [x, y] = tk.split(',').map(Number), w = g2w(x + 0.5, y + 0.5); objs.push({ d: x + y + 1.05, f: () => LOOK.drawWorker(ctx, w.x - 40, w.y + 8, time * 9 + x, 1, 1) }); });
    Object.keys(S.bins).forEach((tk) => { const [x, y] = tk.split(',').map(Number), w = g2w(x + 0.28, y + 0.28), rem = S.bins[tk]; objs.push({ d: x + y + 0.6, f: () => { if (rem > 0) LOOK.drawWorker(ctx, w.x - 26, w.y + 6, time * 9, 1, 0.9); LOOK.drawBin(ctx, w.x, w.y, 1 - 0.6 * rem / BIN_T); } }); });
    S.cars.forEach((c) => objs.push({ d: c.x + c.y, f: () => drawVehicle(c, c.kind || '', c.col) }));
    Object.values(CREW).forEach((c) => objs.push({ d: c.x + c.y, f: () => { const w = g2w(c.x, c.y); LOOK.drawStaff(ctx, w.x, w.y, c.kind, c.phase, c.q.length > 0 && c.wait <= 0, c.dir || 1, 1.1); } }));
    if (S.esc) { const e = S.esc; objs.push({ d: e.gx + e.gy, f: () => { const w = g2w(e.gx, e.gy); ctx.save(); ctx.translate(w.x, w.y); drawAnimal(e.type, { x: 0, y: 0, wait: e.wait > 0 || !e.q.length ? 1 : 0, step: e.step, seed: 1, sink: 0, jump: 0, flip: e.flip }, ANIM_K * 0.8, 0); ctx.restore(); } }); }
    if (S.show && S.show.on) { const k = S.show.k, c = placeCenter(k); objs.push({ d: c.x + c.y + 1.4, f: () => drawCrowd(k) }); }
    S.veh.forEach((v) => objs.push({ d: v.x + v.y + 0.2, f: () => drawVehicle(v, v.kind, '#fff') }));
    objs.push({ d: 7.5 + BY + 0.9, f: drawGate });
    Object.keys(S.builds).forEach((k) => { const c = placeCenter(k); objs.push({ d: c.x + c.y, f: () => drawBuilding(k, c) }); });
    S.guests.forEach((g) => objs.push({ d: g.x + g.y, f: () => {
      const w = g2w(g.x, g.y), walking = g.q.length && g.wait <= 0;
      ctx.globalAlpha = g.fade; LOOK.drawPerson(ctx, w.x, w.y, g.look != null ? g.look : g.id % 7, g.phase, walking, guestDir(g), 1.1);
      if (S.rain > 0) LOOK.drawUmbrella(ctx, w.x, w.y, CAR_COLS[g.id % CAR_COLS.length], 1.1);
      ctx.globalAlpha = 1;
    } }));
    if (!S.connected.length && S.plots.size) WAITING.forEach((p, i) => objs.push({ d: p[0] + p[1], f: () => { const w = g2w(p[0], p[1]); LOOK.drawPerson(ctx, w.x, w.y, i + 1, 0, false, i % 2 ? 1 : -1, 1.1); } }));
    if (S.wish || wishJoy > 0) objs.push({ d: WISH_POS.x + WISH_POS.y, f: () => {
      const w = g2w(WISH_POS.x, WISH_POS.y), jump = wishJoy > 0 ? Math.abs(Math.sin(wishJoy * 10)) * 14 : 0;
      LOOK.drawPerson(ctx, w.x, w.y - jump, 6, 0, false, -1, 1.3);
    } });
    objs.sort((p, q) => p.d - q.d).forEach((o) => o.f());
    // plusk wody
    splashes.forEach((sp) => {
      const k = sp.t / 0.9; ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#f4fbff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sp.wx, sp.wy, 10 + k * 34, (10 + k * 34) * 0.35, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = '#e8f6fb';
      for (let i = 0; i < 6; i++) { const an = i / 6 * Math.PI * 2, d = 6 + k * 22; ctx.beginPath(); ctx.arc(sp.wx + Math.cos(an) * d, sp.wy - Math.sin(Math.PI * k) * 18 + Math.sin(an) * d * 0.35, 2.2 * (1 - k) + 0.4, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    });
    // cienie chmur sunące po zoo
    ctx.globalAlpha = 0.32;
    CLOUDS.forEach((c) => { const x = ((c.x + time * c.v) % 5200 + 5200) % 5200 - 2600; ctx.drawImage(CLOUD, x, c.y, 420 * c.s, 210 * c.s); });
    ctx.globalAlpha = 1;
    // warstwa wierzchnia
    S.plots.forEach((k) => QUADS.forEach((_, q) => { const key = placeKey(k, q); if (!S.builds[key] && !quadBlocked(key)) drawPlus(key); }));
    Object.keys(S.clear).forEach((tk) => { const j = S.clear[tk], [x, y] = tk.split(',').map(Number), w = g2w(x + 0.5, y + 0.5); ringProgress(w.x, w.y - 44, 15, 1 - j.t / j.T, j.m ? C.gold : '#efe7d4'); });
    dust.forEach((d) => { const k = d.t / 0.8; ctx.globalAlpha = 0.5 * (1 - k); ctx.fillStyle = '#d8ccae'; ctx.beginPath(); ctx.arc(d.wx, d.wy - k * 34, 7 + k * 16, 0, 7); ctx.fill(); ctx.globalAlpha = 1; });
    buy.forEach(drawSign);
    parkBuyable().forEach((i) => drawSignAt(parkSignPos(i), parkPrice(), 'p' + i));
    Object.keys(S.parks).forEach((i) => { if (S.parks[i].st === 0) { const w = g2w(parkX(+i) + 2.5, PY + 1.5); drawPlusAt(w.x, w.y); } });
    if (S.panel) {
      const [px, py, q] = S.panel.split(',').map(Number), [qx, qy] = QUADS[q], bx = px * PLOT + qx, by = py * PLOT + qy;
      diamond(bx + 0.04, by + 0.04, bx + 1.96, by + 1.96); ctx.strokeStyle = C.gold; ctx.lineWidth = 7; ctx.stroke();
    }
    Object.keys(S.builds).forEach((k) => {
      const c = placeCenter(k), w = g2w(c.x, c.y), rt = RT[k], top = bubbleY(k, w.y), b = S.builds[k], need = needOf(k);
      const sh = rt && rt.shake ? Math.sin(time * 40) * 6 : 0;
      if (b.b > 0) { const T = buildTime(b.type); progressBar(w.x, w.y - 118, 1 - b.b / T); return; }
      if (need === 'cut') drawNoPath(w.x + sh, top);
      else if (need === 'h') drawNeed(w.x, top, 'miska', b.hs > SICK_HUNGER * 0.6);
      else if (need === 'st') drawNeed(w.x, top, 'skrzynka');
      else if (need === 'sick') drawSick(w.x + sh, top, (b.wt || 0) / POLICE_AFTER);
      else if (need === 'show') drawBell(w.x, top);
      else if (b.up > 0) progressBar(w.x, top + 20, 1 - b.up / UP_T);
      else if (isAnimal(k) && b.vet) drawAway(w.x, top, 1 - b.vet.t / CURE_T);
      else if (b.type === 'wet') drawVetPips(w.x, w.y - 148, patients(k));
    });
    S.cars.forEach((c) => { if (c.mad) { const w = g2w(c.x, c.y); drawMad(w.x, w.y - 74); } });
    if (!S.connected.length && S.plots.size) { const w = g2w(7.5, BY + 2.3); drawNoPath(w.x + 110, w.y - 66); }
    if (S.tool === 'dem') drawDemMarks();
    drawRange(); drawUpBtn();
    if (S.esc) { const w = g2w(S.esc.gx, S.esc.gy), y = w.y - 92 + Math.sin(time * 6) * 4; bubble(w.x, y, 24); ctx.fillStyle = '#c64a42'; ctx.fillRect(w.x - 3.5, y - 15, 7, 19); ctx.beginPath(); ctx.arc(w.x, y + 11, 4.2, 0, 7); ctx.fill(); }
    if (S.wish) { const p = wishBubble(); drawWish(p.x, p.y, S.wish); }
    minus.forEach((m) => { const k = m.t / 0.9; ctx.globalAlpha = 1 - k; txt('−' + (m.val || 1), m.wx, m.wy - k * 30, 30, C.light); ctx.globalAlpha = 1; });
    drawSky();
    if (VIGN) { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.drawImage(VIGN, 0, 0, cw, ch); }
  }
  function drawGate() {
    if (OBJ3D().brama) { const m = g2w(7.5, BY + 0.9); spr('brama', m.x, m.y, 0.85); return; }
    const L0 = g2w(6.92, BY + 0.9), R0 = g2w(8.08, BY + 0.9), H = 66, back = g2w(0, -1), bk = { x: back.x * 0.13, y: back.y * 0.13 };
    const poly = (pts, col) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, p[0], p[1])); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
    const hedge = (x, y) => {
      ctx.fillStyle = 'rgba(20,30,10,.3)'; ctx.beginPath(); ctx.ellipse(x + 8, y + 2, 24, 7, 0, 0, 7); ctx.fill();
      [[-10, -10, 13], [8, -11, 13], [0, -18, 13]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, 7); ctx.fillStyle = '#4c7536'; ctx.fill(); ctx.beginPath(); ctx.arc(x + dx - 3, y + dy - 4, r * 0.55, 0, 7); ctx.fillStyle = '#6e9a4a'; ctx.fill(); });
    };
    hedge(L0.x - 34, L0.y - 4); hedge(R0.x + 30, R0.y + 22);
    const pillar = (P) => {
      ctx.fillStyle = 'rgba(20,28,12,.3)'; ctx.beginPath(); ctx.ellipse(P.x + 10, P.y + 3, 20, 6, 0, 0, 7); ctx.fill();
      poly([[P.x - 10, P.y], [P.x, P.y + 5], [P.x, P.y + 5 - H], [P.x - 10, P.y - H]], '#c2b494');
      poly([[P.x, P.y + 5], [P.x + 10, P.y], [P.x + 10, P.y - H], [P.x, P.y + 5 - H]], '#968868');
      ctx.strokeStyle = 'rgba(60,50,35,.35)'; ctx.lineWidth = 1;
      for (let k = 14; k < H; k += 14) { ctx.beginPath(); ctx.moveTo(P.x - 10, P.y - k); ctx.lineTo(P.x, P.y + 5 - k); ctx.lineTo(P.x + 10, P.y - k); ctx.stroke(); }
      poly([[P.x - 13, P.y - H], [P.x, P.y + 6.5 - H], [P.x + 13, P.y - H], [P.x, P.y - 6.5 - H]], '#ddd2b6');
    };
    pillar(L0); pillar(R0);
    // belka z napisem
    const y0 = -H + 6, hb = 30, ex = 18, A = [L0.x - ex, L0.y - ex * 0.5 + y0], B = [R0.x + ex, R0.y + ex * 0.5 + y0];
    poly([A, B, [B[0], B[1] - hb], [A[0], A[1] - hb]], '#2f4029');
    poly([[A[0], A[1] - hb], [B[0], B[1] - hb], [B[0] + bk.x, B[1] - hb + bk.y], [A[0] + bk.x, A[1] - hb + bk.y]], '#4d6243');
    ctx.strokeStyle = 'rgba(211,164,58,.8)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(A[0] + 4, A[1] - 3); ctx.lineTo(B[0] - 4, B[1] - 3); ctx.lineTo(B[0] - 4, B[1] - hb + 3); ctx.lineTo(A[0] + 4, A[1] - hb + 3); ctx.closePath(); ctx.stroke();
    ctx.save(); ctx.translate((A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - hb / 2); ctx.transform(1, 0.5, 0, 1, 0, 0);
    txt('Z O O', 0, 1, 21, '#f1e6c6'); ctx.restore();
  }
  const WISH_POS = { x: 11.2, y: ROAD + 1.2 };          // gość z życzeniem stoi po drugiej stronie drogi, obok wejścia
  function wishBubble() { const w = g2w(WISH_POS.x, WISH_POS.y); return { x: w.x, y: w.y - 104 }; }
  function bubbleY(k, wy) {
    const t = S.builds[k].type, T = TYPES[t];
    if (T.kind !== 'animal') return wy - 150;
    const h = window.ZOO_ANIMALS.A[t].h * ANIM_K;
    return wy - Math.max(95, h + 30);
  }
  // Zwierzęta (animals.js): klatki marszu i spoczynku; tempo kroku zależy od prędkości i długości kroku gatunku.
  const ANIM_K = 1;
  const IDLE_T = { krokodyl: 7, hipopotam: 8, slon: 5, flaming: 6 };
  function drawAnimal(name, a, s, hop) {
    const ZA = window.ZOO_ANIMALS, def = ZA.A[name]; if (!def) return;
    const moving = a.wait <= 0;
    let lift = hop;
    if (a.jump > 0 && a.jumpDur) lift += Math.sin(Math.PI * (1 - a.jump / a.jumpDur)) * a.jumpH;
    let mode = 'idle', idx;
    if (HOPPERS[name] && moving) { mode = 'walk'; idx = a.jump > 0 && a.jumpDur ? Math.floor((1 - a.jump / a.jumpDur) * ZA.WALK_N) : 0; }
    else if (moving) { mode = 'walk'; idx = Math.floor(((a.step / (Math.PI * 2)) % 1) * ZA.WALK_N); }
    else idx = Math.floor((((time + a.seed * 3) / (IDLE_T[name] || 4)) % 1) * ZA.IDLE_N);
    idx = clamp(idx, 0, (mode === 'walk' ? ZA.WALK_N : ZA.IDLE_N) - 1);
    const m = ctx.getTransform(), f = ZA.frame(name, mode, idx, Math.hypot(m.a, m.b) * s);
    const breathe = moving ? 1 : 1 + 0.012 * Math.sin(time * 2.2 + a.seed);
    const depth = a.sink * def.h * s * 0.9;
    if (a.sink < 0.08) {             // cień na ziemi
      const rx = (def.box[2] - def.box[0]) * s * 0.3, sh = 1 / (1 + lift * 0.04);
      ctx.fillStyle = 'rgba(22,30,12,.26)'; ctx.beginPath(); ctx.ellipse(a.x, a.y + 1, rx * sh, rx * 0.26 * sh, 0, 0, 7); ctx.fill();
    }
    ctx.save(); ctx.translate(a.x, a.y);
    if (a.sink > 0.01) { ctx.beginPath(); ctx.rect(-500, -700, 1000, 700); ctx.clip(); }
    ctx.translate(0, depth - lift); ctx.scale(a.flip ? -1 : 1, breathe);
    ctx.drawImage(mip(f, s), f.x * s, f.y * s, f.w * s, f.h * s);      // mipmapa: duże klatki 3D bez skalowania w każdej klatce
    ctx.restore();
    if (a.sink > 0.06) {
      const rx = (def.box[2] - def.box[0]) * s * 0.22 * (1 + 0.06 * Math.sin(time * 3 + a.seed));
      ctx.strokeStyle = 'rgba(240,250,255,.55)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(a.x, a.y - 1, rx, rx * 0.3, 0, 0, 7); ctx.stroke();
    }
  }
  function drawWater(pool) {
    ctx.save(); ctx.beginPath(); ctx.ellipse(pool.x, pool.y, pool.rx * 0.95, pool.ry * 0.92, 0, 0, 7); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const ph = time * 0.5 + i * 1.9, x = pool.x + Math.sin(ph * 0.9 + i * 2) * pool.rx * 0.6, y = pool.y + Math.cos(ph * 0.7 + i) * pool.ry * 0.5;
      const l = 6 + 4 * Math.sin(time * 1.3 + i); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 1.7 + i * 2.3);
      ctx.beginPath(); ctx.moveTo(x - l, y); ctx.quadraticCurveTo(x, y - 2, x + l, y); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.lineCap = 'butt'; ctx.restore();
  }
  function drawBuilding(k, c) {
    if (S.builds[k].b > 0) { const w0 = g2w(c.x, c.y); drawSite(k, c, w0, TYPES[S.builds[k].type], S.builds[k]); return; }
    const w = g2w(c.x, c.y), b = S.builds[k], t = TYPES[b.type], rt = RT[k] || makeRT(k);
    const pop = easeOut(rt.pop), sc = 0.55 + 0.45 * pop;
    ctx.save(); ctx.translate(w.x, w.y); ctx.scale(sc, sc);
    if (t.kind === 'vet') { if (!OBJ3D().wet) blit(PATIO, 0, 0); spr('wet', 0, 0, 1); }
    else if (t.kind === 'staff') { if (!OBJ3D()[b.type]) blit(PATIO, 0, 0); const hop = rt.hop > 0 ? Math.abs(Math.sin(rt.hop * 12)) * 6 : 0; spr(b.type, 0, -hop, 1); }
    else if (t.kind === 'fun') { if (OBJ3D()[b.type]) spr(b.type, 0, 0, 1); else { if (b.type !== 'ogrod' && b.type !== 'plac') blit(PATIO, 0, 0); LOOK.drawFun(ctx, b.type, time); } }
    else if (t.kind === 'kiosk') {
      if (!OBJ3D()['kiosk_' + b.type]) blit(PATIO, 0, 0);
      const hop = rt.hop > 0 ? Math.abs(Math.sin(rt.hop * 12)) * 6 : 0;
      if (b.st <= 0) ctx.globalAlpha = 0.8;
      kioskSpr(b.type, hop); ctx.globalAlpha = 1;
    } else {
      const E3 = enc3d(b.type), E = E3 || encOf(t.biome), pool = E3 ? null : LOOK.POOL[t.biome];
      blit(E.back, 0, 0);
      if (pool) drawWater(pool);
      if (b.h || rt.fed > 0) {
        spr('miska', BOWL.x, BOWL.y, 1.05);
        if (rt.fed > 0) { ctx.fillStyle = '#8a5a2e'; [[-6, -6], [0, -8], [6, -6], [-2, -5], [3, -4]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(BOWL.x + dx, BOWL.y + dy, 2.4, 0, 7); ctx.fill(); }); }
      }
      const hop = rt.hop > 0 ? Math.abs(Math.sin(rt.hop * 12)) * 10 : 0;
      drawUpgrades(b);
      if (!away(b)) rt.animals.filter((a) => !a.gone).sort((p, q) => p.y - q.y).forEach((a) => drawAnimal(b.type, a, ANIM_K * (a.baby ? 0.55 : 1), hop * (a.baby ? 0.6 : 1)));
      blit(E.front, 0, 0);
      if (nightK() > 0.6 && !away(b)) { ctx.globalAlpha = Math.min(1, (nightK() - 0.6) * 3); [0, 1, 2].forEach((i) => { const k = (time * 0.4 + i / 3) % 1; ctx.globalAlpha *= 1; txt('z', 30 + k * 26 + i * 4, -60 - k * 40, 18 + i * 5, `rgba(240,236,220,${(1 - k) * 0.9})`); }); ctx.globalAlpha = 1; }
    }
    ctx.restore();
  }
  function diamond2() { ctx.beginPath(); ctx.moveTo(-112, 0); ctx.lineTo(0, -56); ctx.lineTo(112, 0); ctx.lineTo(0, 56); ctx.closePath(); }
  function drawPlus(key) {
    const c = placeCenter(key), w = g2w(c.x, c.y), r = 36 * (1 + (S.plots.size === 1 && !Object.keys(S.builds).length ? 0.06 * Math.sin(time * 4) : 0));
    drawPlusAt(w.x, w.y, r);
  }
  function drawPlusAt(x, y, r = 36) {
    ctx.save(); ctx.beginPath(); ctx.arc(x + 1, y + 5, r + 1, 0, 7); ctx.fillStyle = 'rgba(10,16,6,.3)'; ctx.fill();
    const g = ctx.createLinearGradient(0, y - r, 0, y + r); g.addColorStop(0, '#3f5236'); g.addColorStop(1, '#1f2a1a');
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(244,236,214,.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r - 1.5, 0, 7); ctx.stroke();
    ctx.strokeStyle = C.light; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x, y + 18); ctx.moveTo(x - 18, y); ctx.lineTo(x + 18, y); ctx.stroke(); ctx.lineCap = 'butt';
  }
  function signPos(k) { const b = plotBase(k), w = g2w(b.x + 2.5, b.y + 2.5); return { x: w.x, y: w.y + 40 }; }
  function drawSign(k) { drawSignAt(signPos(k), plotPrice(), k); }
  function drawSignAt(p, price, sk) {
    const ok = S.coins >= price, sh = signShake[sk] ? Math.sin(time * 40) * 6 : 0;
    ctx.save(); ctx.translate(p.x + sh, p.y);
    if (OBJ3D().tabliczka) {   // tabliczka 3D: moneta i cena leżą na desce (deska skośnie, nachylenie 0,43), pod nimi pasek
      if (ok) { ctx.beginPath(); ctx.arc(-3, -62, 78 + Math.sin(time * 4) * 4, 0, 7); ctx.fillStyle = 'rgba(240,210,122,.3)'; ctx.fill(); }
      spr('tabliczka', 0, 0, 1);
      ctx.save(); ctx.translate(-3, -60); ctx.transform(1, 0.43, 0, 1, 0, 0);
      spr('moneta', -17, 0, 0.82); txt(String(price), 13, 1, 27, ok ? '#3d2a16' : '#5c4630');
      ctx.fillStyle = 'rgba(58,40,22,.75)'; ctx.fillRect(-30, 15, 60, 6); ctx.fillStyle = C.gold; ctx.fillRect(-30, 15, 60 * clamp(S.coins / price, 0, 1), 6);
      ctx.restore(); ctx.restore(); return;
    }
    ctx.scale(1.55, 1.55);
    if (ok) { ctx.beginPath(); ctx.arc(0, -69, 52 + Math.sin(time * 4) * 3, 0, 7); ctx.fillStyle = 'rgba(240,210,122,.3)'; ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 5, 0, 0, 7); ctx.fillStyle = 'rgba(34,48,26,.35)'; ctx.fill();
    ctx.fillStyle = C.post; ctx.fillRect(-4, -54, 8, 54);
    rr(-38, -92, 76, 46, 3); ctx.fillStyle = ok ? C.woodLight : C.wood; ctx.fill();
    rr(-38, -92, 76, 6, 3); ctx.fillStyle = ok ? '#d6b78a' : C.woodLight; ctx.fill();
    spr('moneta', -17, -69, 0.9);
    txt(String(price), 15, -67, 30, C.light);
    ctx.fillStyle = '#3a2f22'; ctx.fillRect(-38, -46, 76, 6);
    ctx.fillStyle = C.gold; ctx.fillRect(-38, -46, 76 * clamp(S.coins / price, 0, 1), 6);
    ctx.restore();
  }
  // ---------- rysowanie: teren, parking, budowa, pojazdy ----------
  let TL = null, terrainDirty = true;
  const TR = 1.2, TERR = { piach: '#bda56f', bloto: '#55532f', woda: '#7d8a62' };
  const GROUND_KINDS = ['piach', 'bloto', 'woda'];
  const tHash = (x, y) => { let n = Math.imul(x * 73856093 ^ y * 19349663, 16777619); n ^= n >>> 11; return ((n >>> 0) % 1000) / 1000; };
  function blobsPath(g, list, rx, ry, k = 1) { g.beginPath(); list.forEach(([x, y]) => { const w = g2w(x + 0.5, y + 0.5); g.moveTo(w.x + rx * k, w.y); g.ellipse(w.x, w.y, rx * k, ry * k, 0, 0, 7); }); }
  function renderTerrain() {
    const x0 = g2w(0, ROWS * PLOT).x - 110, x1 = g2w(COLS * PLOT, 0).x + 110, y0 = -60, y1 = g2w(COLS * PLOT, ROWS * PLOT).y + 60;
    if (!TL) { const c = document.createElement('canvas'); c.width = Math.ceil((x1 - x0) * TR); c.height = Math.ceil((y1 - y0) * TR); TL = { c, g: c.getContext('2d'), x0, y0, w: x1 - x0, h: y1 - y0 }; }
    const g = TL.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, TL.c.width, TL.c.height); g.setTransform(TR, 0, 0, TR, -x0 * TR, -y0 * TR);
    GROUND_KINDS.forEach((kind) => {
      const list = Object.keys(S.obst).filter((k) => S.obst[k] === kind && !S.clear[k]).map((k) => k.split(',').map(Number));
      if (!list.length) return;
      blobsPath(g, list, 86, 44); g.fillStyle = TERR[kind]; g.fill();
      blobsPath(g, list, 74, 38); g.fillStyle = PAT[kind]; g.fill();
      list.forEach(([x, y]) => {
        const w = g2w(x + 0.5, y + 0.5), h = tHash(x, y);
        if (kind === 'bloto') { g.strokeStyle = '#a3a35a'; g.lineWidth = 1.6; for (let i = 0; i < 7; i++) { const a = (h * 100 + i * 2.4) % 6.28, px = w.x + Math.cos(a) * (12 + i * 5), py = w.y + Math.sin(a) * (6 + i * 2.4); g.beginPath(); g.moveTo(px, py); g.lineTo(px + (i % 3 - 1) * 2, py - 12 - h * 8); g.stroke(); } }
        if (kind === 'woda') { g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.4; for (let i = 0; i < 3; i++) { const px = w.x - 30 + h * 40 + i * 12, py = w.y - 12 + i * 11; g.beginPath(); g.moveTo(px - 11, py); g.quadraticCurveTo(px, py - 3, px + 11, py); g.stroke(); } }
        if (kind === 'piach') { g.strokeStyle = 'rgba(140,110,60,.35)'; g.lineWidth = 1.3; for (let i = 0; i < 2; i++) { const py = w.y - 8 + i * 13; g.beginPath(); g.moveTo(w.x - 32, py + h * 6); g.quadraticCurveTo(w.x, py - 7, w.x + 32, py + h * 3); g.stroke(); } }
      });
    });
    terrainDirty = false;
  }
  function drawTerrainLayer() {
    if (terrainDirty || !TL) renderTerrain();
    ctx.drawImage(TL.c, TL.x0, TL.y0, TL.w, TL.h);
    Object.keys(S.clear).forEach((tk) => {
      const kind = S.obst[tk]; if (!GROUND_KINDS.includes(kind)) return;
      const j = S.clear[tk], [x, y] = tk.split(',').map(Number), k = clamp(j.t / j.T, 0.08, 1);
      blobsPath(ctx, [[x, y]], 74, 38, k); ctx.fillStyle = PAT[kind]; ctx.fill();
    });
  }
  function drawObstacleTree(tk, kind, x, y, w) {
    const j = S.clear[tk], k = j ? clamp(j.t / j.T, 0, 1) : 1;
    const name = kind === 'skala' ? 'skala' : ['sosna', 'drzewo', 'akacja'][Math.floor(tHash(x, y) * 3)], p = treeOf(name, Math.floor(tHash(y, x) * 3));
    ctx.save(); ctx.translate(w.x, w.y + 8);
    if (j && kind === 'drzewo') ctx.rotate((1 - k) * 1.35);                 // drzewo się przewraca
    const s = (kind === 'skala' ? 0.5 : 0.66) * (kind === 'skala' ? k : Math.min(1, 0.4 + k)); ctx.scale(s, s);
    blit(p, 0, 0); ctx.restore();
  }
  function drawParks() {
    for (let i = 0; i < COLS; i++) {
      const P = S.parks[i], x0 = parkX(i), buyable = parkBuyable().includes(i);
      if (!P) { if (buyable) { diamond(x0, PY, x0 + PLOT, PY + 3); ctx.fillStyle = 'rgba(150,180,110,.16)'; ctx.fill(); ctx.strokeStyle = 'rgba(244,236,214,.75)'; ctx.lineWidth = 3; ctx.setLineDash([16, 12]); ctx.stroke(); ctx.setLineDash([]); } continue; }
      diamond(x0, PY, x0 + PLOT, PY + 3); ctx.fillStyle = '#8f7a57'; ctx.fill();
      if (P.st >= 1) {
        const k = P.st === 2 ? 1 : 1 - P.b / PARK_T;
        diamond(x0, PY, x0 + PLOT * k, PY + 3); ctx.fillStyle = PAT.asphalt; ctx.fill();
        if (P.st === 2) {
          ctx.strokeStyle = 'rgba(236,228,206,.85)'; ctx.lineWidth = 3;
          for (let j = 0; j <= 4; j++) { const lx = x0 + 0.17 + j * 1.17, a0 = g2w(lx, PY + 0.15), b0 = g2w(lx, PY + 1.25), a1 = g2w(lx, PY + 1.75), b1 = g2w(lx, PY + 2.85); ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(b0.x, b0.y); ctx.moveTo(a1.x, a1.y); ctx.lineTo(b1.x, b1.y); ctx.stroke(); }
        } else {
          const w = g2w(x0 + PLOT * k, PY + 1.5); LOOK.drawWorker(ctx, w.x, w.y + 6, time * 9, -1, 1.1);
          if (Math.random() < 0.3) dust.push({ wx: w.x + rand(-30, 30), wy: w.y + rand(-18, 18), t: 0 });
          const c0 = g2w(x0 + 2.5, PY + 1.5); progressBar(c0.x, c0.y - 74, k);
        }
      }
    }
  }
  function ringProgress(x, y, r, k, col) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = 'rgba(20,26,16,.72)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r - 3, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.stroke();
  }
  function progressBar(x, y, k) {
    const w = 120, h = 16; rr(x - w / 2, y - h / 2, w, h, 8); ctx.fillStyle = 'rgba(20,26,16,.8)'; ctx.fill();
    if (k > 0.02) { rr(x - w / 2 + 3, y - h / 2 + 3, (w - 6) * clamp(k, 0, 1), h - 6, 5); ctx.fillStyle = C.gold; ctx.fill(); }
  }
  function drawVehicle(v, kind, col) {
    const w = g2w(v.x, v.y), alongX = Math.abs(v.dx) >= Math.abs(v.dy);
    LOOK.drawCar(ctx, w.x, w.y, col, alongX ? v.dx < 0 : v.dy > 0, alongX ? 1 : -1, kind, time);
  }
  // Plac budowy: fundament, obiekt wyrastający od dołu, rusztowanie i robotnicy.
  function drawSite(k, c, w, t, b) {
    const prog = 1 - b.b / buildTime(b.type), rt = RT[k] || makeRT(k), sh = rt.shake ? Math.sin(time * 40) * 3 : 0;
    ctx.save(); ctx.translate(w.x + sh, w.y);
    const site3d = !!OBJ3D().budowa;
    if (!site3d) { diamond2(); ctx.fillStyle = '#8f7a57'; ctx.fill(); ctx.strokeStyle = 'rgba(60,44,24,.5)'; ctx.lineWidth = 2; ctx.stroke(); }
    else { ctx.globalAlpha = clamp(1.25 - prog, 0, 1); spr('budowa', 0, 0, 1); ctx.globalAlpha = 1; }
    if (prog > 0.12) {
      const p = clamp((prog - 0.12) / 0.8, 0, 1), top = 70 - 240 * p;
      ctx.save(); ctx.beginPath(); ctx.rect(-135, top, 270, 240 * p + 4); ctx.clip();
      if (t.kind === 'animal') { const E = enc3d(b.type) || encOf(t.biome); blit(E.back, 0, 0); blit(E.front, 0, 0); }
      else { if (!OBJ3D()[t.kind === 'kiosk' ? 'kiosk_' + b.type : b.type]) blit(PATIO, 0, 0); if (t.kind === 'kiosk') kioskSpr(b.type, 0); else spr(b.type === 'wet' ? 'wet' : b.type, 0, 0, 1); }
      ctx.restore();
    }
    if (prog < 0.94 && !site3d) {
      const h = 40 + prog * 90;
      ctx.strokeStyle = '#a57f4f'; ctx.lineWidth = 4;
      [[-74, 22], [74, 22], [0, 52], [0, -30]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke(); });
      ctx.strokeStyle = '#c7a06a'; ctx.lineWidth = 3;
      for (let l = 30; l < h; l += 34) { ctx.beginPath(); ctx.moveTo(-74, 22 - l); ctx.lineTo(0, 52 - l); ctx.lineTo(74, 22 - l); ctx.stroke(); }
    }
    LOOK.drawWorker(ctx, -56, 30, time * 9, 1, 1.1); LOOK.drawWorker(ctx, 52, 34, time * 8 + 2, -1, 1.1);
    ctx.restore();
  }
  function bubble(x, y, r = 32) {
    ctx.save(); ctx.beginPath(); ctx.arc(x + 1, y + 4, r + 1, 0, 7); ctx.fillStyle = 'rgba(10,16,6,.25)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y + r + 16); ctx.lineTo(x - 12, y + r - 6); ctx.lineTo(x + 12, y + r - 6); ctx.closePath();
    ctx.fillStyle = C.cream; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore();
  }
  // Odcięte miejsce: dymek z człowiekiem na żwirze i czerwonym przekreśleniem.
  function drawNoPath(x, y) {
    const bob = Math.sin(time * 3) * 3; y += bob;
    bubble(x, y);
    ctx.beginPath(); ctx.moveTo(x - 22, y + 13); ctx.lineTo(x, y + 2); ctx.lineTo(x + 22, y + 13); ctx.lineTo(x, y + 24); ctx.closePath(); ctx.fillStyle = '#cdbd9b'; ctx.fill();
    spr('gosc1', x, y + 15, 0.8);
    ctx.strokeStyle = C.accent; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 20, y - 20); ctx.lineTo(x + 20, y + 22); ctx.stroke(); ctx.lineCap = 'butt';
  }
  // Głodne zwierzę: pusta miska; pusty kiosk: pusta skrzynka. Dymek pulsuje złotą obwódką.
  function drawNeed(x, y, icon, urgent) {
    y += Math.sin(time * 3) * 3;
    ctx.beginPath(); ctx.arc(x, y, 38 + Math.sin(time * (urgent ? 12 : 5)) * 3, 0, 7); ctx.strokeStyle = urgent ? 'rgba(198,74,66,.95)' : 'rgba(211,164,58,.85)'; ctx.lineWidth = 5; ctx.stroke();
    bubble(x, y, 34);
    spr(icon, x, y + (icon === 'miska' ? 12 : 14), icon === 'miska' ? 1.25 : 1.05);
  }
  function crossIcon(x, y, s, col = '#c64a42') { ctx.fillStyle = col; ctx.fillRect(x - s * 0.3, y - s, s * 0.6, s * 2); ctx.fillRect(x - s, y - s * 0.3, s * 2, s * 0.6); }
  // Chore zwierzę: czerwony krzyż; czerwony pierścień pokazuje, ile czasu zostało do przyjazdu policji.
  function drawSick(x, y, k) {
    y += Math.sin(time * 5) * 3;
    bubble(x, y, 34); crossIcon(x, y, 19);
    ctx.beginPath(); ctx.arc(x, y, 41, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(1 - k, 0, 1)); ctx.strokeStyle = 'rgba(198,74,66,.95)'; ctx.lineWidth = 6; ctx.stroke();
  }
  function drawAway(x, y, k) { bubble(x, y, 26); crossIcon(x, y, 12, '#5c8a6d'); ctx.beginPath(); ctx.arc(x, y, 31, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.strokeStyle = '#5c8a6d'; ctx.lineWidth = 5; ctx.stroke(); }
  function drawVetPips(x, y, n) { for (let i = 0; i < VET_CAP; i++) { const px = x + (i - (VET_CAP - 1) / 2) * 34; ctx.beginPath(); ctx.arc(px, y, 13, 0, 7); ctx.fillStyle = i < n ? '#c64a42' : '#efe7d4'; ctx.fill(); ctx.strokeStyle = 'rgba(30,36,24,.6)'; ctx.lineWidth = 2; ctx.stroke(); } }
  function drawMad(x, y) { bubble(x, y, 22); ctx.fillStyle = '#c64a42'; ctx.fillRect(x - 3.5, y - 14, 7, 18); ctx.beginPath(); ctx.arc(x, y + 11, 4.2, 0, 7); ctx.fill(); }
  function drawWish(x, y, type) {
    const r = 46; y += Math.sin(time * 2.5) * 4;
    ctx.beginPath(); ctx.arc(x, y, r + 6 + Math.sin(time * 4) * 3, 0, 7); ctx.fillStyle = 'rgba(240,210,122,.35)'; ctx.fill();
    bubble(x, y, r);
    sprFit(sprName(type), x - r * 0.72, y - r * 0.72, r * 1.44, r * 1.44);
    // mała gwiazdka: to życzenie
    star(x + r * 0.78, y - r * 0.78, 13, C.gold);
  }
  function star(x, y, r, col) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(an) * rr2, y + Math.sin(an) * rr2); }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  }

  // ---------- interfejs ----------
  const PANEL_H = 374, CARD_W = 178, CARD_H = 162, CARD_GAP = 12, STRIP_X = 128;
  const BTN = { back: { x: 18, y: 18, w: 76, h: 76 } };
  const btnSound = () => ({ x: UW - 94, y: 18, w: 76, h: 76 });
  const btnAlbum = () => ({ x: UW - 182, y: 18, w: 76, h: 76 });
  const hudBox = () => ({ x: UW / 2 - 118, y: 14, w: 236, h: 78 });
  const starBox = () => ({ x: UW / 2 - 118 - 12 - 132, y: 14, w: 132, h: 78 });
  const rateBox = () => ({ x: UW / 2 - 118 - 12 - 132 - 12 - 150, y: 14, w: 150, h: 78 });
  const btnSave = () => ({ x: UW - 270, y: 18, w: 76, h: 76 });
  const btnMaps = () => ({ x: UW - 358, y: 18, w: 76, h: 76 });
  const btnBin = () => ({ x: 18, y: UH - 96, w: 78, h: 78 });
  const btnDem = () => ({ x: 108, y: UH - 96, w: 78, h: 78 });
  const inR = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  function dropShadow(x, y, w, h, r) {
    rr(x - 1, y + 6, w + 2, h, r + 2); ctx.fillStyle = 'rgba(6,10,4,.16)'; ctx.fill();
    rr(x, y + 3, w, h, r); ctx.fillStyle = 'rgba(6,10,4,.22)'; ctx.fill();
  }
  // Okienka: ciemne „szkło” w kolorze lasu ze złotym obrzeżem.
  function uiBox(r, draw, rad = 20) {
    ctx.save(); dropShadow(r.x, r.y, r.w, r.h, rad);
    rr(r.x, r.y, r.w, r.h, rad);
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, '#34442d'); g.addColorStop(1, '#19221a');
    ctx.fillStyle = g; ctx.fill(); ctx.restore();
    rr(r.x + 1, r.y + 1, r.w - 2, r.h - 2, rad - 1); ctx.strokeStyle = 'rgba(214,174,82,.42)'; ctx.lineWidth = 1.5; ctx.stroke();
    rr(r.x + 4, r.y + 4, r.w - 8, r.h - 8, rad - 4); ctx.strokeStyle = 'rgba(255,246,222,.07)'; ctx.lineWidth = 1; ctx.stroke();
    const hl = ctx.createLinearGradient(0, r.y, 0, r.y + r.h * 0.5); hl.addColorStop(0, 'rgba(255,246,222,.10)'); hl.addColorStop(1, 'rgba(255,246,222,0)');
    rr(r.x + 2, r.y + 2, r.w - 4, r.h * 0.5, rad - 2); ctx.fillStyle = hl; ctx.fill();
    draw();
  }
  function glassCircle(x, y, r) {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y + 4, r + 1, 0, 7); ctx.fillStyle = 'rgba(6,10,4,.3)'; ctx.fill();
    const g = ctx.createLinearGradient(0, y - r, 0, y + r); g.addColorStop(0, '#36462f'); g.addColorStop(1, '#19221a');
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r - 1, 0, 7); ctx.strokeStyle = 'rgba(214,174,82,.5)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  }
  // Tło karty (dla starszych miejsc): kremowy papier, przygaszona albo ciemna.
  function cardBg(x, y, w, h, kind) {
    ctx.save(); dropShadow(x, y, w, h, 16);
    rr(x, y, w, h, 16);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (kind === 'ok') { g.addColorStop(0, '#fbf6ea'); g.addColorStop(1, '#ebe0c6'); }
    else if (kind === 'off') { g.addColorStop(0, '#e9e1cd'); g.addColorStop(1, '#d6cab0'); }
    else { g.addColorStop(0, '#2f3b2a'); g.addColorStop(1, '#222b1e'); }
    ctx.fillStyle = g; ctx.fill(); ctx.restore();
    rr(x + 1, y + 1, w - 2, h - 2, 15); ctx.strokeStyle = kind === 'locked' ? 'rgba(214,174,82,.22)' : 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // Okno karty: mały krajobraz w kolorach wybiegu (niebo, horyzont, ziemia), na nim zwierzę lub kiosk.
  const BIOME_BG = {
    laka: ['#e8edd3', '#b4c487', '#97ab69'], lod: ['#e8f1f3', '#bcd3db', '#9dbcc8'], staw: ['#e2ece0', '#a6c3b2', '#86a995'],
    bambusy: ['#e6eed2', '#a6bd7e', '#88a362'], pustynia: ['#f5ead0', '#dcc08a', '#c7a66c'], sawanna: ['#f5e8c6', '#d3b874', '#bb9d58'],
    las: ['#e0e8d4', '#9bb07e', '#7d955f'], kiosk: ['#f5ece0', '#dcc6a6', '#c8ad88'], locked: ['#3c4936', '#323d2d', '#2a3427'],
  };
  function cardWindow(type, x, y, w, h, r, locked) {
    const T = TYPES[type], pal = BIOME_BG[locked ? 'locked' : T.kind === 'kiosk' ? 'kiosk' : T.biome] || BIOME_BG.laka;
    ctx.save(); rr(x, y, w, h, r); ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, pal[0]); g.addColorStop(0.62, pal[1]); g.addColorStop(1, pal[2]);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    if (!locked) {   // miękkie światło z lewej góry i delikatny horyzont
      const l = ctx.createRadialGradient(x + w * 0.25, y + h * 0.15, 4, x + w * 0.25, y + h * 0.15, w * 0.9);
      l.addColorStop(0, 'rgba(255,252,240,.55)'); l.addColorStop(1, 'rgba(255,252,240,0)'); ctx.fillStyle = l; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x, y + h * 0.6, w, 1.5);
    }
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h - 12, w * 0.34, 7, 0, 0, 7); ctx.fillStyle = locked ? 'rgba(0,0,0,.18)' : 'rgba(40,46,20,.18)'; ctx.fill();
    ctx.restore();
    ctx.save(); rr(x + 0.5, y + 0.5, w - 1, h - 1, r); ctx.strokeStyle = locked ? 'rgba(255,246,222,.08)' : 'rgba(60,50,30,.18)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  }
  function sprFitB(name, bx, by, bw, bh, sil = false) {   // jak sprFit, ale „stoi” na dolnej krawędzi
    const p = (sil ? SIL : SPR)[name]; if (!p) return;
    const s = Math.min(bw / p.w, bh / p.h), w = p.w * s, h = p.h * s;
    ctx.drawImage(p.c, bx + (bw - w) / 2, by + bh - h, w, h);
  }
  // Karta kolekcjonerska: rama z papieru, okno z krajobrazem, zwierzę, a pod spodem cena / gwiazdka.
  function itemCard(type, x, y, w, h, o = {}) {
    const locked = !!o.locked, foot = o.foot || 0;
    cardBg(x, y, w, h, locked ? 'locked' : o.dim ? 'off' : 'ok');
    const pad = Math.max(6, Math.round(w * 0.045)), wx = x + pad, wy = y + pad, ww = w - pad * 2, wh = h - pad * 2 - foot;
    cardWindow(type, wx, wy, ww, wh, 11, locked);
    ctx.globalAlpha *= locked ? 0.95 : o.dim ? 0.6 : 1;
    const kiosk = TYPES[type].kind === 'kiosk';
    sprFitB(sprName(type), wx + ww * 0.08, wy + wh * (kiosk ? 0.08 : 0.1) - (o.hop || 0), ww * 0.84, wh * (kiosk ? 0.86 : 0.84), locked);
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    if (o.dim) { ctx.save(); rr(wx, wy, ww, wh, 11); ctx.fillStyle = 'rgba(232,224,204,.28)'; ctx.fill(); ctx.restore(); }
    return { wx, wy, ww, wh };
  }
  // Cena: ciemna pigułka z monetą; gdy brakuje monet, złoto wypełnia ją w miarę zbierania.
  function pricePill(cx, cy, price, progress) {
    const w = 96, h = 34, x = cx - w / 2, y = cy - h / 2;
    rr(x, y, w, h, h / 2); ctx.fillStyle = '#26321f'; ctx.fill();
    if (progress < 1 && progress > 0.02) {
      ctx.save(); rr(x, y, w, h, h / 2); ctx.clip();
      ctx.fillStyle = 'rgba(214,170,70,.55)'; ctx.fillRect(x, y, w * progress, h); ctx.restore();
    }
    rr(x + 0.75, y + 0.75, w - 1.5, h - 1.5, h / 2); ctx.strokeStyle = progress >= 1 ? 'rgba(214,174,82,.7)' : 'rgba(255,246,222,.18)'; ctx.lineWidth = 1.5; ctx.stroke();
    coinIcon(x + 19, cy, 12);
    txt(String(price), cx + 13, cy + 1.5, 28, progress >= 1 ? C.light : 'rgba(255,248,230,.75)');
  }
  function lockIcon(x, y, s, col) {
    ctx.strokeStyle = col; ctx.lineWidth = s * 0.16; ctx.beginPath(); ctx.arc(x, y - s * 0.12, s * 0.3, Math.PI, 0); ctx.lineTo(x + s * 0.3, y + s * 0.05); ctx.moveTo(x - s * 0.3, y + s * 0.05); ctx.lineTo(x - s * 0.3, y - s * 0.12); ctx.stroke();
    rr(x - s * 0.44, y, s * 0.88, s * 0.62, s * 0.12); ctx.fillStyle = col; ctx.fill();
  }
  function sparkle(x, y, r, col, rot = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, q = i % 2 ? r * 0.28 : r; ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q); }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.restore();
  }
  function coinIcon(x, y, r) {
    ctx.beginPath(); ctx.arc(x, y + r * 0.12, r, 0, 7); ctx.fillStyle = '#7d5b17'; ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r);
    g.addColorStop(0, '#f6dc8a'); g.addColorStop(0.55, '#d6a73c'); g.addColorStop(1, '#a87b1f');
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, 7); ctx.strokeStyle = 'rgba(120,86,20,.65)'; ctx.lineWidth = Math.max(1.2, r * 0.09); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.7, Math.PI * 1.1, Math.PI * 1.6); ctx.strokeStyle = 'rgba(255,245,200,.7)'; ctx.stroke();
  }
  function goldStar(x, y, r) {   // gwiazdka z bryłą: ciemniejszy brzeg, jaśniejszy środek
    star(x, y + r * 0.06, r, '#8a6418');
    ctx.save(); ctx.beginPath();
    for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(an) * q, y + Math.sin(an) * q); }
    ctx.closePath(); const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r); g.addColorStop(0, '#f7df92'); g.addColorStop(0.55, '#d8a83e'); g.addColorStop(1, '#b0821f');
    ctx.fillStyle = g; ctx.fill(); ctx.restore();
  }
  function backArrow(b) {
    ctx.strokeStyle = '#efe7d4'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const x = b.x + b.w / 2, y = b.y + b.h / 2;
    ctx.beginPath(); ctx.moveTo(x + 8, y - 18); ctx.lineTo(x - 10, y); ctx.lineTo(x + 8, y + 18); ctx.stroke(); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  }
  function bookIcon(x, y, k = 1, paw = C.panel) {
    ctx.fillStyle = '#efe7d4';
    ctx.beginPath(); ctx.moveTo(x - 2 * k, y - 16 * k); ctx.quadraticCurveTo(x - 14 * k, y - 22 * k, x - 26 * k, y - 18 * k); ctx.lineTo(x - 26 * k, y + 16 * k); ctx.quadraticCurveTo(x - 14 * k, y + 12 * k, x - 2 * k, y + 18 * k); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 2 * k, y - 16 * k); ctx.quadraticCurveTo(x + 14 * k, y - 22 * k, x + 26 * k, y - 18 * k); ctx.lineTo(x + 26 * k, y + 16 * k); ctx.quadraticCurveTo(x + 14 * k, y + 12 * k, x + 2 * k, y + 18 * k); ctx.closePath(); ctx.fill();
    ctx.fillStyle = paw; ctx.beginPath(); ctx.arc(x + 14 * k, y + 3 * k, 4.5 * k, 0, 7); ctx.fill();
    [[-4, -6], [0, -9], [4, -6]].forEach(([a, b2]) => { ctx.beginPath(); ctx.arc(x + 14 * k + a * 1.3 * k, y + 3 * k + b2 * k, 2.2 * k, 0, 7); ctx.fill(); });
  }
  function drawSoundBtn() {
    const sb = btnSound();
    uiBox(sb, () => {
      const x = sb.x + 18, y = sb.y + 20;
      ctx.fillStyle = '#efe7d4'; ctx.beginPath(); ctx.moveTo(x, y + 12); ctx.lineTo(x + 9, y + 12); ctx.lineTo(x + 20, y + 2); ctx.lineTo(x + 20, y + 34); ctx.lineTo(x + 9, y + 24); ctx.lineTo(x, y + 24); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = soundOn ? '#efe7d4' : '#d07a6e'; ctx.lineCap = 'round'; ctx.beginPath();
      if (soundOn) { ctx.arc(x + 22, y + 18, 9, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 22, y + 18, 17, -0.9, 0.9); ctx.stroke(); }
      else { ctx.moveTo(x + 27, y + 10); ctx.lineTo(x + 41, y + 26); ctx.moveTo(x + 41, y + 10); ctx.lineTo(x + 27, y + 26); ctx.stroke(); }
      ctx.lineCap = 'butt';
    });
  }
  // Karty panelu: najpierw odblokowane zwierzęta, potem kioski, na końcu (wyszarzone) to, co da następna gwiazdka.
  let panelScroll = 0;
  function panelItems() {
    const un = unlocked();
    const items = ['wet', ...STAFF.filter((t) => un.includes(t)), ...ANIMALS.filter((t) => un.includes(t)), ...KIOSKS.filter((t) => un.includes(t)), ...FUN.filter((t) => un.includes(t))].map((t) => ({ type: t, locked: false }));
    nextStarTypes().forEach((t) => items.push({ type: t, locked: true }));
    return items;
  }
  function panelCards() {
    const y0 = UH - PANEL_H + 18;
    return panelItems().map((it, i) => ({ i, ...it, x: STRIP_X + Math.floor(i / 2) * (CARD_W + CARD_GAP) - panelScroll, y: y0 + (i % 2) * (CARD_H + CARD_GAP), w: CARD_W, h: CARD_H }));
  }
  const panelMaxScroll = () => Math.max(0, STRIP_X + Math.ceil(panelItems().length / 2) * (CARD_W + CARD_GAP) - (UW - 20));
  const closeBtn = () => ({ x: 18, y: UH - PANEL_H + 18, w: 94, h: CARD_H * 2 + CARD_GAP });
  function drawUI() {
    ctx.setTransform(DPR * u, 0, 0, DPR * u, 0, 0);
    if (S.scene === 'title' && titleOut <= 0) { drawTitle(1); drawSoundBtn(); return; }
    if (S.scene === 'slots') { drawTitle(1, true); drawSlots(); drawSoundBtn(); return; }
    // monety i gwiazdki
    const hud = hudBox();
    uiBox(hud, () => { coinIcon(hud.x + 56, hud.y + 39, 25); txt(String(S.coins), hud.x + 146, hud.y + 41, 54, C.light); });
    const sb = starBox();
    uiBox(sb, () => { goldStar(sb.x + 40, sb.y + 39, 25); txt(String(S.starsSeen), sb.x + 94, sb.y + 41, 50, C.light); });
    uiBox(BTN.back, () => backArrow(BTN.back));
    const ab = btnAlbum();
    uiBox(ab, () => bookIcon(ab.x + 38, ab.y + 40, 1, '#26321f'));
    drawSoundBtn();
    const rb = rateBox();
    uiBox(rb, () => { rateFace(rb.x + 40, rb.y + 39, 24, S.rate); rr(rb.x + 74, rb.y + 33, 62, 12, 6); ctx.fillStyle = 'rgba(255,246,222,.14)'; ctx.fill(); if (S.rate > 2) { rr(rb.x + 74, rb.y + 33, 62 * S.rate / 100, 12, 6); ctx.fillStyle = rateCol(S.rate); ctx.fill(); } });
    const svb = btnSave();
    uiBox(svb, () => { saveIcon(svb.x + 38, svb.y + 38); if (saveFlash > 0) { ctx.globalAlpha = Math.min(1, saveFlash * 2); ctx.strokeStyle = '#a3d27c'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(svb.x + 25, svb.y + 40); ctx.lineTo(svb.x + 35, svb.y + 50); ctx.lineTo(svb.x + 54, svb.y + 27); ctx.stroke(); ctx.lineCap = 'butt'; ctx.globalAlpha = 1; } });
    const mpb = btnMaps();
    uiBox(mpb, () => mapIcon(mpb.x + 38, mpb.y + 38));
    const bnb = btnBin();
    if (S.trash.length >= 2 && !Object.keys(S.bins).length && S.tool !== 'bin') { ctx.save(); ctx.shadowColor = 'rgba(240,200,90,.95)'; ctx.shadowBlur = 16 + Math.sin(time * 5) * 8; rr(bnb.x, bnb.y, bnb.w, bnb.h, 20); ctx.fillStyle = C.gold; ctx.fill(); ctx.restore(); }
    uiBox(bnb, () => { if (S.tool === 'bin') { rr(bnb.x + 3, bnb.y + 3, bnb.w - 6, bnb.h - 6, 16); ctx.strokeStyle = C.gold; ctx.lineWidth = 4; ctx.stroke(); } LOOK.drawBin(ctx, bnb.x + 39, bnb.y + 60, 1.25); });
    const dmb = btnDem();
    uiBox(dmb, () => {
      if (S.tool === 'dem') { rr(dmb.x + 3, dmb.y + 3, dmb.w - 6, dmb.h - 6, 16); ctx.strokeStyle = '#e0584d'; ctx.lineWidth = 4; ctx.stroke(); }
      ctx.save(); ctx.translate(dmb.x + 39, dmb.y + 40); ctx.rotate(-0.7);
      ctx.fillStyle = '#b08a5c'; rr(-4, -10, 8, 40, 3); ctx.fill();
      ctx.fillStyle = '#d9d4c5'; rr(-19, -24, 38, 17, 3); ctx.fill(); ctx.fillStyle = '#9b9c95'; ctx.fillRect(-19, -13, 38, 6);
      ctx.restore();
    });
    // lecące monety
    flyers.forEach((f) => {
      const st = w2s(f.wx, f.wy), rise = Math.min(1, f.t / 0.35), fly = clamp((f.t - 0.35) / 0.7, 0, 1), e = easeOut(fly);
      const sx = st.x / u, sy = st.y / u - rise * 26;
      const x = lerp(sx, hud.x + 56, e), y = lerp(sy, hud.y + 39, e);
      ctx.globalAlpha = 1 - fly * 0.3;
      coinIcon(x, y, 15 - e * 3);
      if (fly < 0.35) txt('+' + f.val, x + 30, y, 30, C.light);
      ctx.globalAlpha = 1;
    });
    if (S.panel) drawPanel();
    // dłoń
    if (hint && S.scene === 'play' && !S.panel && !S.overlay && idle >= hint.wait) {
      const p = hint.ui ? { x: hint.x * u, y: hint.y * u } : w2s(hint.x, hint.y), bob = Math.abs(Math.sin(time * 3.5)) * 16;
      spr('dlon', p.x / u - 47, p.y / u - 6 + bob, 1.05);
    }
    if (S.scene === 'album') drawAlbum();
    if (S.scene === 'maps') drawMaps();
    if (S.overlay) { if (S.overlay.kind === 'map') drawMapOverlay(); else drawStarOverlay(); }
    if (S.scene === 'title' || titleOut > 0) { drawTitle(S.scene === 'title' ? 1 : clamp(titleOut / 0.55, 0, 1)); drawSoundBtn(); }
  }
  function drawPanel() {
    const y = UH - PANEL_H, R = 26;
    // cień nad panelem i arkusz z zaokrąglonymi górnymi rogami
    { const s2 = ctx.createLinearGradient(0, y - 34, 0, y + 4); s2.addColorStop(0, 'rgba(8,12,6,0)'); s2.addColorStop(1, 'rgba(8,12,6,.38)'); ctx.fillStyle = s2; ctx.fillRect(0, y - 34, UW, 38); }
    const sheet = () => { ctx.beginPath(); ctx.moveTo(0, UH + 2); ctx.lineTo(0, y + R); ctx.arcTo(0, y, R, y, R); ctx.lineTo(UW - R, y); ctx.arcTo(UW, y, UW, y + R, R); ctx.lineTo(UW, UH + 2); ctx.closePath(); };
    sheet(); { const g = ctx.createLinearGradient(0, y, 0, UH); g.addColorStop(0, '#2f3d29'); g.addColorStop(1, '#151d12'); ctx.fillStyle = g; ctx.fill(); }
    { const l = ctx.createRadialGradient(UW / 2, y - 40, 20, UW / 2, y - 40, UW * 0.6); l.addColorStop(0, 'rgba(255,240,200,.07)'); l.addColorStop(1, 'rgba(255,240,200,0)'); sheet(); ctx.fillStyle = l; ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(0, y + R + 0.75); ctx.arcTo(0.75, y + 0.75, R, y + 0.75, R); ctx.lineTo(UW - R, y + 0.75); ctx.arcTo(UW - 0.75, y + 0.75, UW - 0.75, y + R, R);
    ctx.strokeStyle = 'rgba(214,174,82,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.rect(STRIP_X - 6, y + 2, UW - STRIP_X + 6, PANEL_H); ctx.clip();
    panelCards().forEach((c) => {
      if (c.x > UW || c.x + c.w < STRIP_X - 6) return;
      const sh = cardShake[c.type] ? Math.sin(time * 40) * 5 : 0, x = c.x + sh, t = TYPES[c.type];
      if (c.locked) {
        itemCard(c.type, x, c.y, c.w, c.h, { locked: true, foot: 40 });
        goldStar(x + c.w / 2 - 20, c.y + c.h - 25, 15); txt(String(t.star), x + c.w / 2 + 12, c.y + c.h - 23, 30, C.cream);
        lockIcon(x + c.w - 26, c.y + 24, 22, 'rgba(239,231,212,.55)');
        return;
      }
      const ok = S.coins >= t.price, wished = S.wish === c.type;
      if (wished) { ctx.save(); ctx.shadowColor = 'rgba(240,200,90,.9)'; ctx.shadowBlur = 18 + Math.sin(time * 4) * 6; rr(x, c.y, c.w, c.h, 16); ctx.fillStyle = C.gold; ctx.fill(); ctx.restore(); }
      itemCard(c.type, x, c.y, c.w, c.h, { dim: !ok, foot: 40 });
      if (wished) { rr(x + 1.5, c.y + 1.5, c.w - 3, c.h - 3, 15); ctx.strokeStyle = C.gold; ctx.lineWidth = 4; ctx.stroke(); goldStar(x + c.w - 22, c.y + 22, 14); }
      if (!S.found[c.type]) { ctx.save(); ctx.shadowColor = 'rgba(80,50,0,.55)'; ctx.shadowBlur = 4; sparkle(x + 24, c.y + 24, 12 + Math.sin(time * 3 + c.i) * 2, C.gold, time * 0.6); ctx.restore(); }   // jeszcze nieodkryte
      pricePill(x + c.w / 2, c.y + c.h - 24, t.price, clamp(S.coins / t.price, 0, 1));
    });
    ctx.restore();
    // przewijanie: zanikanie przy krawędzi i okrągła strzałka, gdy dalej są karty
    const max = panelMaxScroll();
    const arrowBtn = (x, dir) => {
      const cy = y + PANEL_H / 2 + 9, b = Math.sin(time * 4) * 3 * dir;
      ctx.save(); ctx.beginPath(); ctx.arc(x + b, cy + 3, 27, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x + b, cy, 26, 0, 7); ctx.fillStyle = '#efe7d4'; ctx.fill(); ctx.restore();
      ctx.strokeStyle = '#26321f'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x + b - 5 * dir, cy - 11); ctx.lineTo(x + b + 6 * dir, cy); ctx.lineTo(x + b - 5 * dir, cy + 11); ctx.stroke(); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
    };
    if (panelScroll < max - 4) {
      const g = ctx.createLinearGradient(UW - 110, 0, UW, 0); g.addColorStop(0, 'rgba(26,34,22,0)'); g.addColorStop(1, 'rgba(26,34,22,.96)');
      ctx.fillStyle = g; ctx.fillRect(UW - 110, y + 2, 110, PANEL_H); arrowBtn(UW - 42, 1);
    }
    if (panelScroll > 4) {
      const g = ctx.createLinearGradient(STRIP_X - 6, 0, STRIP_X + 84, 0); g.addColorStop(0, 'rgba(26,34,22,.96)'); g.addColorStop(1, 'rgba(26,34,22,0)');
      ctx.fillStyle = g; ctx.fillRect(STRIP_X - 6, y + 2, 90, PANEL_H); arrowBtn(STRIP_X + 34, -1);
    }
    // zamknij: okrągły przycisk po lewej, oddzielony cienką linią od kart
    const cb = closeBtn(), mx = cb.x + cb.w / 2, my = cb.y + cb.h / 2;
    ctx.fillStyle = 'rgba(214,174,82,.18)'; ctx.fillRect(STRIP_X - 12, y + 30, 1.5, PANEL_H - 60);
    glassCircle(mx, my, 40);
    ctx.strokeStyle = '#efe7d4'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(mx - 14, my - 14); ctx.lineTo(mx + 14, my + 14); ctx.moveTo(mx + 14, my - 14); ctx.lineTo(mx - 14, my + 14); ctx.stroke(); ctx.lineCap = 'butt';
  }
  // ---------- album ----------
  const albumHop = {};
  const ALBUM_TOP = 122, ALBUM_DIV = 26;
  function albumCards() {
    const cols = 8, gap = 12, w = Math.min(146, (UW - 60 - gap * (cols - 1)) / cols), h = Math.min(146, (UH - ALBUM_TOP - 24 - ALBUM_DIV - gap * 3) / 4);
    const x0 = (UW - (w * cols + gap * (cols - 1))) / 2, aRows = Math.ceil(ANIMALS.length / cols);
    const rowX = (n) => (UW - (w * n + gap * (n - 1))) / 2;
    return ALL.map((t, i) => {
      if (i < ANIMALS.length) {
        const row = Math.floor(i / cols), n = Math.min(cols, ANIMALS.length - row * cols);
        return { type: t, x: (n < cols ? rowX(n) : x0) + (i % cols) * (w + gap), y: ALBUM_TOP + row * (h + gap), w, h };
      }
      const j = i - ANIMALS.length;
      return { type: t, x: rowX(Math.min(cols, KIOSKS.length)) + j * (w + gap), y: ALBUM_TOP + aRows * (h + gap) + ALBUM_DIV, w, h };
    });
  }
  function drawAlbum() {
    const g = ctx.createRadialGradient(UW / 2, -80, 40, UW / 2, UH * 0.3, UW * 0.85);
    g.addColorStop(0, '#3a4b31'); g.addColorStop(0.55, '#202b1c'); g.addColorStop(1, '#121810');
    ctx.fillStyle = g; ctx.fillRect(0, 0, UW, UH);
    // nagłówek: książka + licznik z paskiem postępu
    const n = ALL.filter((t) => S.found[t]).length, hb = { x: UW / 2 - 160, y: 14, w: 320, h: 82 };
    uiBox(hb, () => {
      bookIcon(hb.x + 52, hb.y + 38, 0.95, '#26321f');
      txt(n + ' / ' + ALL.length, hb.x + 196, hb.y + 36, 46, C.light);
      const bx = hb.x + 118, bw = 156, by = hb.y + 62;
      rr(bx, by, bw, 7, 3.5); ctx.fillStyle = 'rgba(255,246,222,.12)'; ctx.fill();
      if (n) { rr(bx, by, Math.max(7, bw * n / ALL.length), 7, 3.5); ctx.fillStyle = C.gold; ctx.fill(); }
    });
    uiBox(BTN.back, () => backArrow(BTN.back));
    const cards = albumCards();
    // linia oddzielająca kioski
    const k0 = cards[ANIMALS.length], ly = k0.y - ALBUM_DIV / 2 - 6;
    { const lg = ctx.createLinearGradient(60, 0, UW - 60, 0); lg.addColorStop(0, 'rgba(214,174,82,0)'); lg.addColorStop(0.5, 'rgba(214,174,82,.45)'); lg.addColorStop(1, 'rgba(214,174,82,0)');
      ctx.fillStyle = lg; ctx.fillRect(60, ly, UW - 120, 1.5); }
    cards.forEach((c) => {
      const f = S.found[c.type], hop = albumHop[c.type] ? Math.abs(Math.sin(albumHop[c.type] * 12)) * 10 : 0;
      itemCard(c.type, c.x, c.y, c.w, c.h, { locked: !f, hop });
    });
  }
  const rateCol = (v) => v >= 66 ? '#8cbf6a' : v >= 36 ? '#d7ac42' : '#c64a42';
  function rateFace(x, y, r, v) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = rateCol(v); ctx.fill();
    ctx.fillStyle = '#2b2a18'; ctx.beginPath(); ctx.arc(x - r * 0.36, y - r * 0.22, r * 0.12, 0, 7); ctx.arc(x + r * 0.36, y - r * 0.22, r * 0.12, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2b2a18'; ctx.lineWidth = r * 0.13; ctx.lineCap = 'round'; const m = (v - 50) / 50 * r * 0.42;
    ctx.beginPath(); ctx.moveTo(x - r * 0.42, y + r * 0.34 - m * 0.3); ctx.quadraticCurveTo(x, y + r * 0.34 + m, x + r * 0.42, y + r * 0.34 - m * 0.3); ctx.stroke(); ctx.lineCap = 'butt';
  }
  function saveIcon(x, y) {
    rr(x - 20, y - 20, 40, 40, 5); ctx.fillStyle = '#efe7d4'; ctx.fill();
    ctx.fillStyle = '#26321f'; ctx.fillRect(x - 11, y - 20, 20, 13); ctx.fillStyle = '#efe7d4'; ctx.fillRect(x + 1, y - 18, 5, 9);
    ctx.fillStyle = '#26321f'; ctx.fillRect(x - 12, y + 3, 24, 13);
  }
  function mapIcon(x, y) {
    ctx.fillStyle = '#efe7d4'; ctx.beginPath(); ctx.moveTo(x - 24, y - 14); ctx.lineTo(x - 8, y - 20); ctx.lineTo(x + 8, y - 14); ctx.lineTo(x + 24, y - 20); ctx.lineTo(x + 24, y + 14); ctx.lineTo(x + 8, y + 20); ctx.lineTo(x - 8, y + 14); ctx.lineTo(x - 24, y + 20); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7d8a62'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 8, y - 20); ctx.lineTo(x - 8, y + 14); ctx.moveTo(x + 8, y - 14); ctx.lineTo(x + 8, y + 20); ctx.stroke();
    ctx.fillStyle = '#c64a42'; ctx.beginPath(); ctx.arc(x + 1, y - 3, 7, 0, 7); ctx.fill();
  }
  // ---------- zapisy i mapy ----------
  function slotCards() {
    const gap = 22, w = Math.min(270, (UW - 60 - gap * (SLOTS - 1)) / SLOTS), h = 300, x0 = (UW - (SLOTS * w + (SLOTS - 1) * gap)) / 2, y = Math.max(150, UH * 0.32);
    return Array.from({ length: SLOTS }, (_, i) => ({ i, x: x0 + i * (w + gap), y, w, h, del: { x: x0 + i * (w + gap) + w - 40, y: y + 40, r: 30 } }));
  }
  function drawSlots() {
    ctx.fillStyle = 'rgba(10,15,8,.55)'; ctx.fillRect(0, 0, UW, UH);
    uiBox(BTN.back, () => backArrow(BTN.back));
    const info = slotInfo();
    slotCards().forEach((c) => {
      const d = info[c.i];
      cardBg(c.x, c.y, c.w, c.h, d ? 'ok' : 'locked');
      txt(String(c.i + 1), c.x + 34, c.y + 38, 42, d ? C.ink : C.cream);
      if (!d) { ctx.strokeStyle = C.cream; ctx.lineWidth = 12; ctx.lineCap = 'round'; const mx = c.x + c.w / 2, my = c.y + c.h / 2 + 14; ctx.beginPath(); ctx.moveTo(mx, my - 42); ctx.lineTo(mx, my + 42); ctx.moveTo(mx - 42, my); ctx.lineTo(mx + 42, my); ctx.stroke(); ctx.lineCap = 'butt'; return; }
      const m = d.maps && d.maps[d.map] || {}, M = MAPS[clamp(+d.map || 0, 0, MAPS.length - 1)], mx = c.x + c.w / 2;
      rr(c.x + 16, c.y + 74, c.w - 32, 92, 12); ctx.fillStyle = M.col; ctx.fill();
      txt(M.say, mx, c.y + 120, Math.min(34, c.w / 7.5), '#fbf6ea');
      goldStar(mx - 58, c.y + 200, 20); txt(String(d.starsSeen || 0), mx - 22, c.y + 202, 34, C.ink);
      coinIcon(mx + 18, c.y + 200, 18); txt(String(m.coins || 0), mx + 62, c.y + 202, 32, C.ink);
      rateFace(mx, c.y + 256, 24, m.rate == null ? 60 : m.rate);
      glassCircle(c.del.x, c.del.y, 24);
      ctx.strokeStyle = '#efe7d4'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(c.del.x - 9, c.del.y - 9); ctx.lineTo(c.del.x + 9, c.del.y + 9); ctx.moveTo(c.del.x + 9, c.del.y - 9); ctx.lineTo(c.del.x - 9, c.del.y + 9); ctx.stroke(); ctx.lineCap = 'butt';
      if (resetHold > 0 && ptr && ptr.slot === c.i) { ctx.strokeStyle = C.gold; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(c.del.x, c.del.y, 30, -Math.PI / 2, -Math.PI / 2 + resetHold / 2.5 * Math.PI * 2); ctx.stroke(); }
    });
  }
  function mapCards() {
    const gap = 22, n = MAPS.length, w = Math.min(280, (UW - 60 - gap * (n - 1)) / n), h = 380, x0 = (UW - (n * w + (n - 1) * gap)) / 2, y = Math.max(130, UH / 2 - 190);
    return MAPS.map((m, i) => ({ i, x: x0 + i * (w + gap), y, w, h }));
  }
  function drawMaps() {
    const bg = ctx.createRadialGradient(UW / 2, -80, 40, UW / 2, UH * 0.3, UW * 0.85); bg.addColorStop(0, '#3a4b31'); bg.addColorStop(1, '#121810');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, UW, UH);
    uiBox(BTN.back, () => backArrow(BTN.back));
    txt('Mapy', UW / 2, 56, 56, C.light);
    mapCards().forEach((c) => {
      const m = MAPS[c.i], open = c.i < S.open, cur = c.i === S.map, mx = c.x + c.w / 2;
      cardBg(c.x, c.y, c.w, c.h, open ? 'ok' : 'locked');
      if (cur) { rr(c.x + 2, c.y + 2, c.w - 4, c.h - 4, 15); ctx.strokeStyle = C.gold; ctx.lineWidth = 5; ctx.stroke(); }
      rr(c.x + 16, c.y + 16, c.w - 32, 180, 12); ctx.fillStyle = open ? m.col : '#3c4936'; ctx.fill();
      mapGlyph(mx, c.y + 106, c.i, open);
      txt(open ? m.say : '?', mx, c.y + 232, Math.min(32, c.w / 8), open ? C.ink : C.cream);
      if (!open) { lockIcon(mx, c.y + 92, 62, 'rgba(239,231,212,.7)'); }
      // cel poprzedniej mapy: pasek odblokowania
      const g = c.i > 0 ? MAPS[c.i - 1].goal : null;
      if (g && !open) { goalRow(c, g, c.i - 1 === S.map); }
      else if (m.goal && open) { goalRow(c, m.goal, cur); }
    });
  }
  function goalRow(c, g, live) {
    const mx = c.x + c.w / 2, kinds = live ? doneTypes().size : 0, rate = live ? Math.round(S.rate) : 0, col = c.i < S.open ? C.ink : C.cream;
    goldStar(mx - 80, c.y + 290, 16); txt((live ? kinds + ' / ' : '') + g.kinds, mx - 26, c.y + 292, 30, col);
    rateFace(mx + 34, c.y + 290, 16, g.rate); txt((live ? rate + ' / ' : '') + g.rate, mx + 88, c.y + 292, 30, col);
  }
  function mapGlyph(x, y, i, open) {
    if (!open) return;
    const P = (px, py, kind, s) => { const p = treeOf(kind, 0); ctx.save(); ctx.translate(px, py); ctx.scale(s, s); blit(p, 0, 0); ctx.restore(); };
    if (i === 0) { P(x - 50, y + 44, 'drzewo', 0.52); P(x + 50, y + 54, 'sosna', 0.56); }
    if (i === 1) { ctx.fillStyle = '#3f7a94'; ctx.beginPath(); ctx.ellipse(x, y + 20, 72, 26, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 30, y + 18); ctx.lineTo(x + 8, y + 18); ctx.stroke(); }
    if (i === 2) { P(x + 60, y + 54, 'skala', 0.8); P(x - 58, y + 54, 'akacja', 0.5); }
    if (i === 3) { [[-72, 48], [-22, 58], [28, 48], [76, 58]].forEach(([a, b], j) => P(x + a, y + b, j % 2 ? 'drzewo' : 'sosna', 0.56)); }
  }
  function drawMapOverlay() {
    const o = S.overlay, k = easeOut(clamp(o.t / 0.5, 0, 1)), cx = UW / 2, cy = UH / 2, M = MAPS[o.n];
    ctx.fillStyle = `rgba(12,18,10,${0.86 * k})`; ctx.fillRect(0, 0, UW, UH);
    ctx.save(); ctx.globalAlpha = k;
    rr(cx - 230, cy - 170, 460, 340, 26); ctx.fillStyle = M.col; ctx.fill();
    mapGlyph(cx, cy - 56, o.n, true);
    txt(M.say, cx, cy + 96, 52, C.light);
    mapIcon(cx, cy - 136);
    ctx.restore();
  }
  // ---------- nowa gwiazdka ----------
  const backOut = (k) => 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);
  function drawStarOverlay() {
    const o = S.overlay, k = easeOut(clamp(o.t / 0.5, 0, 1)), cx = UW / 2, cy = Math.min(250, UH * 0.3);
    ctx.fillStyle = `rgba(12,18,10,${0.86 * k})`; ctx.fillRect(0, 0, UW, UH);
    { const l = ctx.createRadialGradient(cx, cy, 10, cx, cy, 420); l.addColorStop(0, `rgba(240,200,110,${0.32 * k})`); l.addColorStop(1, 'rgba(240,200,110,0)'); ctx.fillStyle = l; ctx.fillRect(0, 0, UW, UH); }
    // promienie obracają się powoli
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(time * 0.12); ctx.globalAlpha = k;
    for (let i = 0; i < 16; i++) {
      ctx.rotate(Math.PI / 8);
      const rg = ctx.createLinearGradient(0, 0, 0, -330); rg.addColorStop(0, 'rgba(246,214,130,.30)'); rg.addColorStop(1, 'rgba(246,214,130,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(i % 2 ? -14 : -26, -330); ctx.lineTo(i % 2 ? 14 : 26, -330); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // medal: złota gwiazda z liczbą
    const sk = backOut(clamp(o.t / 0.7, 0, 1));
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sk, sk); ctx.rotate((1 - clamp(o.t / 0.7, 0, 1)) * 0.8);
    ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8; goldStar(0, 0, 112); ctx.shadowColor = 'transparent';
    star(0, 4, 68, 'rgba(138,100,24,.5)'); goldStar(0, 0, 66);
    txt(String(o.n), 0, 10, 70, '#3b2c0c');
    ctx.restore();
    // iskierki wokół gwiazdy
    for (let i = 0; i < 10; i++) {
      const a = i * 0.628 + time * 0.25, d = 150 + (i % 3) * 26, tw = 0.5 + 0.5 * Math.sin(time * 3 + i * 1.7);
      ctx.globalAlpha = k * tw; sparkle(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, 6 + (i % 3) * 3, '#fff2c8', time + i);
    }
    ctx.globalAlpha = 1;
    // nowe zwierzęta i kioski
    const n = o.items.length, w = 200, h = 216, gap = 24, x0 = cx - (n * w + (n - 1) * gap) / 2, top = Math.min(UH - h - 120, cy + 175);
    o.items.forEach((t, i) => {
      const a = clamp((o.t - 0.55 - i * 0.3) / 0.45, 0, 1); if (a <= 0) return;
      const e = backOut(a), x = x0 + i * (w + gap);
      ctx.save(); ctx.globalAlpha = Math.min(1, a * 1.6); ctx.translate(x + w / 2, top + h / 2); ctx.scale(e, e); ctx.translate(-(x + w / 2), -(top + h / 2));
      itemCard(t, x, top, w, h, { alpha: Math.min(1, a * 1.6) });
      sparkle(x + 26, top + 26, 12, C.gold, time * 0.6);
      ctx.restore();
    });
    // dalej: złoty przycisk z ptaszkiem (dotknięcie gdziekolwiek też zamyka)
    const ca = clamp((o.t - 1.2) / 0.4, 0, 1);
    if (ca > 0) {
      const bx = cx, by = Math.min(UH - 62, top + h + 70), pr = 40 + Math.sin(time * 3.5) * 2.5;
      ctx.globalAlpha = ca;
      ctx.beginPath(); ctx.arc(bx, by + 4, pr + 1, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
      const g = ctx.createLinearGradient(0, by - pr, 0, by + pr); g.addColorStop(0, '#f2d585'); g.addColorStop(1, '#b4862a');
      ctx.beginPath(); ctx.arc(bx, by, pr, 0, 7); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#2b2208'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(bx - 15, by + 1); ctx.lineTo(bx - 4, by + 12); ctx.lineTo(bx + 16, by - 11); ctx.stroke(); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
      ctx.globalAlpha = 1;
    }
  }
  // ---------- ekran startowy ----------
  // Sawanna o złotej godzinie: niebo, wzgórza i akacje (gotowe tło), przez trawę idzie korowód zwierząt, nad nimi znak i duży przycisk.
  let TBG = null, TFG = null, titleOut = 0;
  const PARADE = ['slon', 'zyrafa', 'zebra', 'lew', 'nosorozec', 'wielblad', 'flaming'], PARADE_S = 1.7, PARADE_V = 15;
  const playBtn = () => ({ x: UW / 2, y: UH * 0.47, r: 86 });
  
  function seeded(n) { let s = n; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function titleLayer(draw) {
    const c = document.createElement('canvas'); c.width = Math.round(cw * DPR); c.height = Math.round(ch * DPR);
    const g = c.getContext('2d'); g.setTransform(DPR * u, 0, 0, DPR * u, 0, 0); draw(g); return c;
  }
  function acacia(g, x, y, s, col) {
    g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round';
    g.lineWidth = 7 * s; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 4 * s, y - 50 * s, x - 6 * s, y - 92 * s); g.stroke();
    g.lineWidth = 4 * s; g.beginPath(); g.moveTo(x + 1 * s, y - 50 * s); g.quadraticCurveTo(x + 24 * s, y - 70 * s, x + 40 * s, y - 92 * s); g.stroke();
    g.beginPath(); g.moveTo(x - 3 * s, y - 70 * s); g.quadraticCurveTo(x - 26 * s, y - 80 * s, x - 44 * s, y - 94 * s); g.stroke();
    [[-46, -100, 52, 13], [0, -108, 62, 15], [42, -100, 46, 12], [-14, -96, 70, 10]].forEach(([a, b, rx, ry]) => { g.beginPath(); g.ellipse(x + a * s, y + b * s, rx * s, ry * s, 0, 0, 7); g.fill(); });
    g.lineCap = 'butt';
  }
  function hills(g, base, amp, col, seed, step = 40) {
    const r = seeded(seed); g.beginPath(); g.moveTo(-10, UH);
    const pts = []; for (let x = -40; x <= UW + 80; x += step) pts.push([x, base - amp * (0.4 + 0.6 * r())]);
    g.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) { const [px, py] = pts[i - 1], [x, y] = pts[i]; g.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2); }
    g.lineTo(UW + 10, UH); g.closePath(); g.fillStyle = col; g.fill();
  }
  function makeTitleArt() {
    const hy = UH * 0.64;
    TBG = titleLayer((g) => {
      const sky = g.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, '#1b2c31'); sky.addColorStop(0.38, '#3d5650'); sky.addColorStop(0.72, '#a39a68'); sky.addColorStop(1, '#ecc983');
      g.fillStyle = sky; g.fillRect(0, 0, UW, hy + 2);
      const sx = UW * 0.73, sy = hy - 46;
      const glow = g.createRadialGradient(sx, sy, 10, sx, sy, 420); glow.addColorStop(0, 'rgba(255,226,160,.55)'); glow.addColorStop(0.35, 'rgba(255,214,140,.18)'); glow.addColorStop(1, 'rgba(255,214,140,0)');
      g.fillStyle = glow; g.fillRect(0, 0, UW, UH);
      g.beginPath(); g.arc(sx, sy, 44, 0, 7); g.fillStyle = 'rgba(255,240,200,.95)'; g.fill();
      // smugi chmur
      const r = seeded(7);
      for (let i = 0; i < 5; i++) { const cx = r() * UW, cy = hy * (0.62 + r() * 0.24), w = 120 + r() * 200; g.beginPath(); g.ellipse(cx, cy, w, 3 + r() * 4, 0, 0, 7); g.fillStyle = `rgba(255,236,196,${0.08 + r() * 0.1})`; g.fill(); }
      hills(g, hy - 10, 46, '#8c8d68', 3, 70);
      [[0.22, 0.55], [0.58, 0.45], [0.88, 0.5]].forEach(([fx, k]) => acacia(g, UW * fx, hy - 22, k, '#6f7455'));
      hills(g, hy + 8, 26, '#6d7449', 11, 55);
      const ground = g.createLinearGradient(0, hy, 0, UH);
      ground.addColorStop(0, '#8f8a50'); ground.addColorStop(0.4, '#6f7238'); ground.addColorStop(1, '#3d4a24');
      g.fillStyle = ground; g.fillRect(0, hy + 14, UW, UH - hy);
      hills(g, hy + 22, 12, '#7c7c42', 19, 90);
      g.fillStyle = ground; g.fillRect(0, hy + 30, UW, UH - hy);
      // mgiełka przy horyzoncie
      const hz = g.createLinearGradient(0, hy - 60, 0, hy + 60); hz.addColorStop(0, 'rgba(240,210,150,0)'); hz.addColorStop(0.5, 'rgba(240,210,150,.22)'); hz.addColorStop(1, 'rgba(240,210,150,0)');
      g.fillStyle = hz; g.fillRect(0, hy - 60, UW, 120);
      // trawa: pociągnięcia w kilku odcieniach
      const r2 = seeded(23);
      for (let i = 0; i < 900; i++) {
        const y = hy + 30 + Math.pow(r2(), 0.8) * (UH - hy - 30), x = r2() * UW, d = (y - hy) / (UH - hy), l = 3 + d * 14;
        g.strokeStyle = r2() < 0.5 ? `rgba(40,52,20,${0.18 + d * 0.2})` : `rgba(214,196,120,${0.1 + d * 0.12})`;
        g.lineWidth = 0.8 + d * 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r2() - 0.5) * l * 0.6, y - l); g.stroke();
      }
      // duże akacje bliżej, po bokach
      acacia(g, UW * 0.08, hy + 120, 2.3, '#2c3820');
      acacia(g, UW * 0.95, hy + 70, 1.5, '#3a4529');
      // winieta
      const v = g.createRadialGradient(UW / 2, UH * 0.45, UH * 0.35, UW / 2, UH * 0.5, UW * 0.75);
      v.addColorStop(0, 'rgba(8,12,6,0)'); v.addColorStop(1, 'rgba(8,12,6,.5)'); g.fillStyle = v; g.fillRect(0, 0, UW, UH);
    });
    TFG = titleLayer((g) => {
      const r = seeded(41), base = UH;
      const sh = g.createLinearGradient(0, UH - 120, 0, UH); sh.addColorStop(0, 'rgba(10,14,6,0)'); sh.addColorStop(1, 'rgba(10,14,6,.55)');
      g.fillStyle = sh; g.fillRect(0, UH - 120, UW, 120);
      for (let i = 0; i < 260; i++) {
        const x = r() * UW, h = 18 + r() * 46, lean = (r() - 0.5) * 24;
        g.fillStyle = r() < 0.5 ? '#26311a' : '#33401f';
        g.beginPath(); g.moveTo(x - 3.5, base + 2); g.quadraticCurveTo(x + lean * 0.3, base - h * 0.6, x + lean, base - h); g.quadraticCurveTo(x + lean * 0.3 + 1.5, base - h * 0.5, x + 3.5, base + 2); g.closePath(); g.fill();
      }
    });
  }
  function drawTitle(alpha, plain) {
    if (!TBG) makeTitleArt();
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(TBG, 0, 0); ctx.setTransform(DPR * u, 0, 0, DPR * u, 0, 0);
    const hy = UH * 0.64;
    // ptaki
    ctx.strokeStyle = 'rgba(30,38,28,.75)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    [[0, 0.32, 1], [260, 0.27, 0.8], [520, 0.38, 0.9]].forEach(([off, fy, k]) => {
      const x = ((time * 22 * k + off) % (UW + 240)) - 120, y = hy * fy + Math.sin(time * 0.7 + off) * 10, f = Math.sin(time * 7 * k + off) * 5 * k;
      ctx.beginPath(); ctx.moveTo(x - 10 * k, y - f); ctx.quadraticCurveTo(x - 4 * k, y - 4 * k - f * 0.5, x, y); ctx.quadraticCurveTo(x + 4 * k, y - 4 * k - f * 0.5, x + 10 * k, y - f); ctx.stroke();
    });
    ctx.lineCap = 'butt';
    // korowód zwierząt (idą w lewo)
    const ZA = window.ZOO_ANIMALS, s = PARADE_S, gy = UH - 58;
    if (ZA) {
      const widths = PARADE.map((t) => (ZA.A[t].box[2] - ZA.A[t].box[0]) * s + 90), L = Math.max(widths.reduce((a, b) => a + b, 0), UW + 700);
      let off = 0;
      PARADE.forEach((t, i) => {
        const def = ZA.A[t], dist = time * PARADE_V;
        let x = UW * 0.62 + off - ((dist * s) % L); if (x < -400) x += L;
        off += widths[i];
        if (x < -400 || x > UW + 400) return;
        const stride = def.stride || def.h * 0.36 + 6, idx = Math.floor(((dist / stride) % 1) * ZA.WALK_N) % ZA.WALK_N;
        const f = ZA.frame(t, 'walk', idx, DPR * u * s);
        const rx = (def.box[2] - def.box[0]) * s * 0.32;
        ctx.fillStyle = 'rgba(20,26,10,.3)'; ctx.beginPath(); ctx.ellipse(x, gy + 2, rx, rx * 0.16, 0, 0, 7); ctx.fill();
        ctx.drawImage(mip(f, s), x + f.x * s, gy + f.y * s, f.w * s, f.h * s);
      });
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(TFG, 0, 0); ctx.setTransform(DPR * u, 0, 0, DPR * u, 0, 0);
    // znak „Moje Zoo”
    const ly = UH * 0.17, cx = UW / 2;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '10px';
    txt('MOJE ZOO', cx + 5, ly, 112, '#fbf3df');
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();
    { const rw = 210, ry = ly + 74;
      const lg = (a, b) => { const g = ctx.createLinearGradient(a, 0, b, 0); g.addColorStop(0, 'rgba(214,174,82,0)'); g.addColorStop(1, 'rgba(214,174,82,.9)'); return g; };
      ctx.fillStyle = lg(cx - rw - 30, cx - 30); ctx.fillRect(cx - rw - 30, ry, rw, 2);
      ctx.fillStyle = lg(cx + rw + 30, cx + 30); ctx.fillRect(cx + 30, ry, rw, 2);
      // ślad łapy pośrodku
      ctx.fillStyle = C.gold; ctx.beginPath(); ctx.ellipse(cx, ry + 5, 9, 7.5, 0, 0, 7); ctx.fill();
      [[-11, -7], [-4, -13], [4, -13], [11, -7]].forEach(([a, b]) => { ctx.beginPath(); ctx.ellipse(cx + a, ry + 5 + b, 3.6, 4.4, a * 0.04, 0, 7); ctx.fill(); });
    }
    if (plain) { ctx.restore(); return; }
    // przycisk „graj”: złoty pierścień, ciemny środek, fala światła
    const b = playBtn();
    for (let i = 0; i < 2; i++) {
      const ph = (time * 0.55 + i * 0.5) % 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 6 + ph * 70, 0, 7); ctx.strokeStyle = `rgba(246,214,130,${0.45 * (1 - ph)})`; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    const rg = ctx.createLinearGradient(b.x - b.r, b.y - b.r, b.x + b.r, b.y + b.r); rg.addColorStop(0, '#f6dd92'); rg.addColorStop(0.5, '#d4a443'); rg.addColorStop(1, '#9c731f');
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fillStyle = rg; ctx.fill(); ctx.restore();
    const ig = ctx.createRadialGradient(b.x - 20, b.y - 26, 8, b.x, b.y, b.r - 9); ig.addColorStop(0, '#47603c'); ig.addColorStop(1, '#1c2717');
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 9, 0, 7); ctx.fillStyle = ig; ctx.fill();
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 9, 0, 7); ctx.strokeStyle = 'rgba(60,40,8,.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#fbf3df'; ctx.beginPath(); ctx.moveTo(b.x - 24, b.y - 38); ctx.lineTo(b.x + 42, b.y); ctx.lineTo(b.x - 24, b.y + 38); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = '#fbf3df'; ctx.stroke(); ctx.fill(); ctx.lineJoin = 'miter'; ctx.restore();
    ctx.restore();
  }

  // ---------- dotyk ----------
  let ptr = null;
  const pickCrossAt = (g) => {
    const x = Math.floor(g.x), y = Math.floor(g.y);
    if (isPathTile(x, y)) return { x, y };
    return null;
  };
  // Tolerancja palca: dotknięcie tuż obok pola ścieżki też je trafia.
  function nearCross(g) {
    const hit = pickCrossAt(g); if (hit) return hit;
    for (const [a, b] of [[0.28, 0], [-0.28, 0], [0, 0.28], [0, -0.28]]) { const h = pickCrossAt({ x: g.x + a, y: g.y + b }); if (h) return h; }
    return null;
  }
  function pointer(e) { return { x: e.clientX, y: e.clientY }; }
  // Czy pod palcem jest pole, na którym można teraz ułożyć ścieżkę (wtedy dymki „brak ścieżki” i życzenia nie przeszkadzają).
  function freeTileAt(sx, sy) {
    const w = s2w(sx, sy), t = nearCross(w2g(w.x, w.y));
    return t && !S.paths.has(tkey(t.x, t.y)) && !S.obst[tkey(t.x, t.y)] ? t : null;
  }
  function bubbleHit(sx, sy) {
    for (const k of Object.keys(S.builds)) {
      const need = needOf(k); if (!need) continue;
      const c = placeCenter(k), w = g2w(c.x, c.y), p = w2s(w.x, bubbleY(k, w.y));
      if (Math.hypot(sx - p.x, sy - p.y) > Math.max((need === 'cut' ? 58 : 40) * cam.s, need === 'cut' ? 34 : 28)) continue;
      if (need === 'cut' && freeTileAt(sx, sy)) continue;   // chmurka „brak ścieżki” nigdy nie zasłania pola ścieżki
      return k;
    }
    return null;
  }
  function wishHit(sx, sy) {
    if (!S.wish || freeTileAt(sx, sy)) return false;
    const b = wishBubble(), p = w2s(b.x, b.y);
    return Math.hypot(sx - p.x, sy - p.y) <= Math.max(60 * cam.s, 40);
  }
  function trashAt(sx, sy) {
    const w = s2w(sx, sy);
    let best = null, bd = Math.max(46, 30 / cam.s);
    S.trash.forEach((tk) => { const [x, y] = tk.split(',').map(Number), c = g2w(x + 0.5, y + 0.5), d = Math.hypot(w.x - c.x, (w.y - c.y + 6) * 1.4); if (d < bd) { bd = d; best = tk; } });
    return best;
  }
  function signHit(sx, sy) {
    for (const k of buyablePlots()) {
      const p = signPos(k), a = w2s(p.x - 70, p.y - 160), b = w2s(p.x + 70, p.y + 20);
      if (sx >= a.x && sx <= b.x && sy >= a.y && sy <= b.y) return k;
    }
    return null;
  }
  const touches = new Map();   // aktywne palce (do szczypania)
  let pinch = null;
  const canMoveMap = () => S.scene === 'play' && !S.panel && !S.overlay;
  function onDown(e) {
    touches.set(e.pointerId, pointer(e));
    if (ptr || pinch) {
      // drugi palec: szczypanie (przybliżanie) – tylko na mapie
      if (!pinch && touches.size === 2 && canMoveMap()) {
        const [a, b] = [...touches.values()];
        pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: cam.s, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        ptr = null; idle = 0;
      }
      return;
    }
    e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
    audio(); idle = 0;
    const p = pointer(e); ptr = { id: e.pointerId, x0: p.x, y0: p.y, moved: 0, mode: 'tap', last: null, sx: panelScroll };
    const ui = { x: p.x / u, y: p.y / u };
    if (S.scene === 'title') return;
    if (S.scene === 'slots') {
      for (const c of slotCards()) if (slotInfo()[c.i] && Math.hypot(ui.x - c.del.x, ui.y - c.del.y) <= c.del.r + 8) { ptr.mode = 'reset'; ptr.slot = c.i; resetHold = 0.001; return; }
      return;
    }
    if (S.scene === 'album' || S.scene === 'maps' || S.overlay) return;
    if (S.panel) { if (ui.y >= UH - PANEL_H && ui.x >= STRIP_X - 6) ptr.mode = 'scroll'; return; }
    if (inR(ui, BTN.back) || inR(ui, btnSound()) || inR(ui, btnAlbum()) || inR(ui, starBox()) || inR(ui, rateBox()) || inR(ui, btnSave()) || inR(ui, btnMaps()) || inR(ui, btnBin()) || inR(ui, btnDem())) return;
    if (escHit(p.x, p.y) || upHit(p.x, p.y) || bubbleHit(p.x, p.y) || signHit(p.x, p.y) || wishHit(p.x, p.y)) return;
    if (S.tool) { ptr.mode = 'pan'; ptr.lx = p.x; ptr.ly = p.y; return; }
    const tr = trashAt(p.x, p.y);
    if (tr) { ptr.mode = 'trash'; sweep(tr); return; }
    // Przeszkoda na kupionej działce: robotnik; palcem można zaznaczać kolejne pola.
    const w = s2w(p.x, p.y), g = w2g(w.x, w.y), ot = tkey(Math.floor(g.x), Math.floor(g.y));
    if (S.obst[ot] && S.plots.has(plotOf(Math.floor(g.x), Math.floor(g.y)))) { ptr.mode = 'clear'; orderClear(ot); return; }
    // Pole ścieżki bez ścieżki: rysujemy ścieżkę (palcem można ciągnąć dalej). Wszędzie indziej palec przesuwa mapę.
    const t = nearCross(g);
    if (t && !S.paths.has(tkey(t.x, t.y)) && !S.obst[tkey(t.x, t.y)]) { ptr.mode = 'paint'; ptr.last = g; layPath(t.x, t.y); return; }
    ptr.mode = 'pan'; ptr.lx = p.x; ptr.ly = p.y;
  }
  function onMove(e) {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, pointer(e));
    if (pinch) {
      e.preventDefault();
      if (touches.size >= 2) {
        const [a, b] = [...touches.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        panBy(mx - pinch.mx, my - pinch.my); pinch.mx = mx; pinch.my = my;
        zoomAt(mx, my, pinch.s0 * d / pinch.d0); idle = 0;
      }
      return;
    }
    if (!ptr || e.pointerId !== ptr.id) return;
    e.preventDefault();
    const p = pointer(e); ptr.moved = Math.max(ptr.moved, Math.hypot(p.x - ptr.x0, p.y - ptr.y0));
    if (ptr.mode === 'pan') {
      if (canMoveMap()) panBy(p.x - ptr.lx, p.y - ptr.ly);
      ptr.lx = p.x; ptr.ly = p.y; idle = 0;
    } else if (ptr.mode === 'paint') {
      const w = s2w(p.x, p.y), g = w2g(w.x, w.y), d = Math.hypot(g.x - ptr.last.x, g.y - ptr.last.y), n = Math.max(1, Math.ceil(d / 0.2));
      for (let i = 1; i <= n; i++) { const t = pickCrossAt({ x: lerp(ptr.last.x, g.x, i / n), y: lerp(ptr.last.y, g.y, i / n) }); if (t) layPath(t.x, t.y); }
      ptr.last = g; idle = 0;
    } else if (ptr.mode === 'clear') {
      const w = s2w(p.x, p.y), g = w2g(w.x, w.y); orderClear(tkey(Math.floor(g.x), Math.floor(g.y)));
    } else if (ptr.mode === 'trash') {
      const tr = trashAt(p.x, p.y); if (tr) sweep(tr);
    } else if (ptr.mode === 'scroll') {
      panelScroll = clamp(ptr.sx - (p.x - ptr.x0) / u, 0, panelMaxScroll());
    }
  }
  function onUp(e) {
    touches.delete(e.pointerId);
    if (pinch) { if (touches.size < 2) pinch = null; return; }
    if (!ptr || e.pointerId !== ptr.id) return;
    const p = ptr; ptr = null; const mode = p.mode;
    if (mode === 'reset') { resetHold = 0; return; }
    if ((mode === 'tap' || mode === 'scroll' || mode === 'pan') && p.moved < 26 * Math.max(u, 0.7)) tap(p.x0, p.y0);
  }
  function tap(sx, sy) {
    const ui = { x: sx / u, y: sy / u };
    if (inR(ui, btnSound())) {
      soundOn = !soundOn; try { localStorage.setItem(KEY_SOUND, soundOn ? '1' : '0'); } catch (e) {}
      if (!soundOn) stopVoice(); else sfx.tap();
      return;
    }
    if (S.scene === 'title') {
      const b = playBtn();
      if (Math.hypot(ui.x - b.x, ui.y - b.y) <= b.r + 30) { S.scene = 'slots'; sfx.joy(); slotCache = null; say('Wybierz swoje zoo.'); }
      return;
    }
    if (S.scene === 'slots') {
      if (inR(ui, BTN.back)) { sfx.tap(); S.scene = 'title'; return; }
      for (const c of slotCards()) if (inR(ui, c)) {
        openSlot(c.i); S.scene = 'play'; titleOut = 0.55; idle = 0; hint = computeHint(); sfx.joy();
        if (!S.plots.size) say('To twoje zoo. Dotknij tabliczki i kup działkę.');
        else if (Object.keys(S.builds).some((k) => needOf(k) === 'cut')) say('Goście nie mogą dojść. Dołóż ścieżkę.');
        return;
      }
      return;
    }
    if (S.scene === 'maps') {
      if (inR(ui, BTN.back)) { sfx.tap(); S.scene = 'play'; return; }
      for (const c of mapCards()) if (inR(ui, c)) {
        if (c.i >= S.open) { sfx.no(); sayHint('Ta mapa jest jeszcze zamknięta. Rozbuduj zoo i zadbaj o gości.', 3); return; }
        if (c.i !== S.map) { saveNow(); enterMap(c.i); saveNow(); sfx.joy(); say(MAPS[c.i].say + '!'); } else sfx.tap();
        S.scene = 'play'; return;
      }
      return;
    }
    if (S.overlay) { if (S.overlay.t > 1) { S.overlay = null; sfx.tap(); } return; }
    if (S.scene === 'album') {
      if (inR(ui, BTN.back)) { sfx.tap(); S.scene = 'play'; return; }
      for (const c of albumCards()) if (inR(ui, c)) {
        if (S.found[c.type]) { albumHop[c.type] = 0.5; say(TYPES[c.type].say); } else { sfx.no(); sayHint('Tego jeszcze nie masz.', 2); }
        return;
      }
      return;
    }
    if (S.panel) {
      if (inR(ui, closeBtn())) { sfx.tap(); S.panel = null; return; }
      for (const c of panelCards()) {
        if (c.x + c.w < STRIP_X - 6) continue;
        if (inR(ui, c)) {
          if (c.locked) { cardShake[c.type] = 0.45; sfx.no(); sayHint('To będzie z następną gwiazdką. Stawiaj nowe zwierzęta i kioski.', 3); return; }
          if (S.coins >= TYPES[c.type].price) { build(S.panel, c.type); return; }
          cardShake[c.type] = 0.45; sfx.no(); sayHint('Za mało monet. Goście przyniosą więcej.', 3); return;
        }
      }
      if (ui.y < UH - PANEL_H) { sfx.tap(); S.panel = null; }
      return;
    }
    if (inR(ui, BTN.back)) { sfx.tap(); S.tool = null; saveNow(); S.scene = 'title'; titleOut = 0; S.slot = null; return; }
    if (inR(ui, btnAlbum())) { sfx.tap(); S.scene = 'album'; say('Album. Tu są twoje zwierzęta.'); return; }
    if (inR(ui, btnSave())) { saveNow(); saveFlash = 1.4; sfx.joy(); say('Zapisano!'); return; }
    if (inR(ui, btnMaps())) { sfx.tap(); S.tool = null; S.scene = 'maps'; say('Mapy.'); return; }
    if (inR(ui, btnBin())) { sfx.tap(); demSel = null; S.tool = S.tool === 'bin' ? null : 'bin'; if (S.tool) say('Dotknij ścieżki, żeby postawić śmietnik.'); return; }
    if (inR(ui, btnDem())) { sfx.tap(); demSel = null; S.tool = S.tool === 'dem' ? null : 'dem'; if (S.tool) say('Dotknij budynku, który chcesz zburzyć.'); return; }
    if (inR(ui, rateBox())) { sfx.tap(); say(S.rate >= 66 ? 'Goście są zadowoleni.' : S.rate >= 36 ? 'Goście są tak sobie zadowoleni.' : 'Goście są niezadowoleni. Karm zwierzęta i sprzątaj.'); return; }
    if (inR(ui, starBox())) { sfx.tap(); say('Masz ' + S.starsSeen + ' ' + gwiazdki(S.starsSeen) + '. Nowe zwierzęta i kioski dają gwiazdki.'); return; }
    if (S.tool === 'dem') { const w0 = s2w(sx, sy); demolishAt(w2g(w0.x, w0.y)); return; }
    if (S.tool === 'bin') { const w0 = s2w(sx, sy), g0 = w2g(w0.x, w0.y); toggleBin(Math.floor(g0.x), Math.floor(g0.y)); return; }
    if (escHit(sx, sy)) { catchEsc('kid'); return; }
    if (upHit(sx, sy)) { upgrade(upSel.k); return; }
    if (wishHit(sx, sy)) { sfx.tap(); say('Gość chce zobaczyć: ' + TYPES[S.wish].say); return; }
    const bk = bubbleHit(sx, sy);
    if (bk) { tapBuilding(bk); return; }
    const sh = signHit(sx, sy);
    if (sh) { buyPlot(sh); return; }
    for (const i of parkBuyable()) { const ps = parkSignPos(i), a0 = w2s(ps.x - 70, ps.y - 160), b0 = w2s(ps.x + 70, ps.y + 20); if (sx >= a0.x && sx <= b0.x && sy >= a0.y && sy <= b0.y) { buyPark(i); return; } }
    const w = s2w(sx, sy), g = w2g(w.x, w.y), gx = Math.floor(g.x), gy = Math.floor(g.y), pk = plotOf(gx, gy);
    { const pi = parkAt(g.x, g.y); if (pi >= 0) { const P = S.parks[pi]; if (!P && parkBuyable().includes(pi)) buyPark(pi); else if (P && P.st === 0) buildPark(pi); return; } }
    if (S.plots.has(pk)) {
      const q = quadOf(gx, gy);
      if (q >= 0) {
        const key = placeKey(pk, q);
        if (S.builds[key]) tapBuilding(key);
        else if (quadBlocked(key)) { quadTiles(key).forEach(([x, y]) => orderClear(tkey(x, y))); }
        else { sfx.tap(); S.panel = key; panelScroll = 0; say('Wybierz, co tu postawić.'); }
      }
      return;
    }
    if (buyablePlots().includes(pk)) buyPlot(pk);
  }
  function tapBuilding(k) {
    const rt = RT[k] || makeRT(k), b = S.builds[k], t = TYPES[b.type];
    if (b.b > 0) { b.b = Math.max(0.05, b.b - 0.35); rt.shake = 0.2; sfx.tap(); idle = 0; return; }   // dotykanie budowy trochę ją przyspiesza
    if (t.kind === 'vet') { rt.hop = 0.5; sfx.tap(); say(t.say); return; }
    if (t.kind === 'staff') { rt.hop = 0.5; sfx.tap(); rangeSel = { k, t: 4 }; if (needOf(k) === 'cut') { sayHint('Zrób ścieżkę do domku, żeby mógł chodzić do pracy.', 3); return; } say(t.say + '. Pracuje na świecących działkach.'); return; }
    if (t.kind === 'fun') { if (needOf(k) === 'cut') { rt.shake = 0.5; sfx.no(); sayHint('Tu nie ma ścieżki. Goście nie dojdą.', 3); return; } rt.hop = 0.5; sfx.tap(); say(t.say); return; }
    if (b.vet) { sfx.tap(); sayHint(t.say + ' jest u weterynarza.', 3); return; }
    if (b.pol != null) return;
    if (needOf(k) === 'cut') { rt.shake = 0.5; sfx.no(); idle = 99; hintTimer = 0; sayHint('Tu nie ma ścieżki. Goście nie dojdą.', 3); return; }
    if (b.sick) { rt.shake = 0.5; sfx.no(); idle = 99; hintTimer = 0; sayHint(vets().length ? 'U weterynarza nie ma miejsca. Zbuduj następnego.' : 'To zwierzę jest chore. Zbuduj weterynarza.', 3); return; }
    if (t.kind === 'animal' && b.h) { feed(k); return; }
    if (needOf(k) === 'show') { startShow(k); return; }
    if (t.kind === 'animal' && !(b.up > 0) && (b.lv || 0) < 2 && !(S.show && S.show.on && S.show.k === k)) {   // zdrowy, najedzony wybieg: przycisk ulepszenia
      rt.hop = 0.5; sfx.tap(); upSel = { k, t: 6 };
      if (!sayOnce('upgrade', t.say + '. Złota strzałka ulepsza wybieg: basen i zabawki. Zwierzęta są szczęśliwsze, przychodzi więcej gości i rodzą się młode.')) say(t.say + ((b.kids || 0) ? '. Ma ' + (b.kids === 1 ? 'jedno młode.' : 'młode.') : ''));
      return;
    }
    if (t.kind === 'kiosk' && b.st <= 0) { refill(k); return; }
    rt.hop = 0.5; sfx.tap(); say(t.say);
  }

  // ---------- rysowanie i start ----------
  let TREES = [];
  function buildDecor() {
    const MAXX = COLS * PLOT, Y = BY, out = [];
    for (let y = 2; y < Y; y += 3.2) out.push([out.length % 2 ? 'drzewo' : 'sosna', -1.6 - (out.length % 3) * 0.7, y, 1]);
    for (let x = 2; x < MAXX; x += 3.3) out.push([out.length % 2 ? 'drzewo' : 'sosna', x, -1.4 - (out.length % 3) * 0.3, 1]);
    for (let y = 1.4; y < Y; y += 3) out.push([out.length % 2 ? 'sosna' : 'drzewo', MAXX + 1.4 + (out.length % 2) * 0.7, y, 1]);
    for (let x = 1.4; x < MAXX + 3; x += 4) out.push([out.length % 3 ? 'drzewo' : 'sosna', x, PY + 5, 1.1]);
    TREES = out;
    WAITING = [[6.5, ROAD - 0.2], [7.3, ROAD + 0.1], [8.3, ROAD - 0.3]];
  }
  let WAITING = [];
  let prev = 0;
  const PERF = { w: 0, u: 0 };   // średni czas rysowania świata i interfejsu (ms), do testów wydajności
  function frame(now) {
    requestAnimationFrame(frame);           // najpierw kolejna klatka: błąd w jednej klatce nie zatrzymuje gry
    try { step(now); } catch (e) { console.error(e); }
  }
  function step(now) {
    const dt = Math.min(0.05, (now - prev) / 1000 || 0.016); prev = now;
    Object.keys(albumHop).forEach((k) => { albumHop[k] -= dt; if (albumHop[k] <= 0) delete albumHop[k]; });
    tick(dt);
    if (ptr && ptr.mode === 'reset') {
      resetHold += dt;
      if (resetHold >= 2.5) { resetHold = 0; deleteSlot(ptr.slot); ptr.mode = 'done'; sfx.build(); }
    }
    const tg = camTarget();
    if (camSnap) { cam.x = tg.x; cam.y = tg.y; cam.s = tg.s; camSnap = false; }
    else { const k = 1 - Math.pow(0.002, dt); cam.x = lerp(cam.x, tg.x, k); cam.y = lerp(cam.y, tg.y, k); cam.s = lerp(cam.s, tg.s, k); }
    ctx.imageSmoothingQuality = 'low';   // ostrość zapewniają mipmapy; tryb 'high' był bardzo kosztowny
    if (titleOut > 0) titleOut -= dt;
    const t0 = performance.now(); if ((S.scene !== 'title' && S.scene !== 'slots') || titleOut > 0) drawWorld(); const t1 = performance.now(); drawUI(); const t2 = performance.now();
    PERF.w = PERF.w * 0.95 + (t1 - t0) * 0.05; PERF.u = PERF.u * 0.95 + (t2 - t1) * 0.05;
    // płynność: średnio wolniej niż ~40 kl./s przez 2 s → rysujemy w niższej rozdzielczości (najniżej 1 piksel na punkt)
    PERF.dt = (PERF.dt || 16) * 0.95 + Math.min(200, dt * 1000) * 0.05;
    if (PERF.dt > 25 && DPR > 1) { slowT += dt; if (slowT > 2) { slowT = 0; DPR_CAP = Math.max(1, DPR - 0.25); PERF.dt = 16; resize(); } } else slowT = 0;
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', (e) => { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; if (ptr && e.pointerId === ptr.id) { resetHold = 0; ptr = null; } });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (!canMoveMap()) return; zoomAt(e.clientX, e.clientY, cam.s * Math.exp(-e.deltaY * 0.0015)); idle = 0; }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('resize', resize);
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

  window.__zoo = {
    S, RT, tick, MAPS, openSlot, enterMap, makeSick, callPolice, freeVet, rateTarget, spawnGuest, parkSlots, buyPark, buildPark, orderClear, build, toggleBin, slotInfo, deleteSlot, slotCards, bubbleHit, freeTileAt, TYPES, g2w, w2s, tkey, placeCenter, plotPrice, buyablePlots, missingRoute, attraction, spawnEvery, ticket, unlocked, saveNow, recompute,
    hint: () => hint, idle: () => idle, cam, PERF, view, contentBox,
    timers(v) {
      if (v) { if ('hunger' in v) hungerTimer = v.hunger; if ('wish' in v) wishTimer = v.wish; if ('show' in v) showTimer = v.show; if ('esc' in v) escTimer = v.esc; if ('rain' in v) rainTimer = v.rain; if ('bus' in v) busTimer = v.bus; }
      return { hunger: hungerTimer, wish: wishTimer, show: showTimer, esc: escTimer, rain: rainTimer, bus: busTimer };
    },
    CREW, nightK, catchEsc, startShow, upgrade, maxGuests, tapAt: (x, y) => tap(x, y), escScreen() { const w = g2w(S.esc.gx, S.esc.gy); return w2s(w.x, w.y - 30); },
    tileScreen(x, y) { const w = g2w(x + 0.5, y + 0.5); return w2s(w.x, w.y); },
    placeScreen(k) { const c = placeCenter(k), w = g2w(c.x, c.y); return w2s(w.x, w.y); },
    signScreen(k) { const p = signPos(k); return w2s(p.x, p.y - 70); },
    cardScreen(type) {    // przewija pasek kart tak, żeby karta była widoczna
      const items = panelItems(), i = items.findIndex((x) => x.type === type); if (i < 0) return null;
      const cx = STRIP_X + Math.floor(i / 2) * (CARD_W + CARD_GAP);
      if (cx - panelScroll + CARD_W > UW - 100 || cx - panelScroll < STRIP_X) panelScroll = clamp(cx - STRIP_X, 0, panelMaxScroll());
      const c = panelCards()[i]; return { x: (c.x + c.w / 2) * u, y: (c.y + c.h / 2) * u };
    },
    panelScroll: () => panelScroll,
    playScreen() { const b = playBtn(); return { x: b.x * u, y: b.y * u }; },
    backScreen() { return { x: 56 * u, y: 56 * u }; },
    albumScreen() { const r = btnAlbum(); return { x: (r.x + r.w / 2) * u, y: (r.y + r.h / 2) * u }; },
    albumCardScreen(t) { const c = albumCards().find((x) => x.type === t); return { x: (c.x + c.w / 2) * u, y: (c.y + c.h / 2) * u }; },
    uiU: () => u,
    bubbleScreen(k) { const c = placeCenter(k), w = g2w(c.x, c.y); return w2s(w.x, bubbleY(k, w.y)); },
    wishScreen() { const b = wishBubble(); return w2s(b.x, b.y); },
    trashScreen(tk) { const [x, y] = tk.split(',').map(Number), w = g2w(x + 0.5, y + 0.5); return w2s(w.x, w.y); },
  };

  resize();
  makePatterns();
  setMap(0); blankMap(0); migrateOld(); recompute();
  (document.fonts && document.fonts.load ? document.fonts.load(`700 40px "Archivo Narrow"`).catch(() => {}) : Promise.resolve())
    .then(() => window.ZOO_ANIMALS.ready)
    .then(loadSprites)
    .then(apply3D)
    .then(() => { requestAnimationFrame(frame); });
})();
