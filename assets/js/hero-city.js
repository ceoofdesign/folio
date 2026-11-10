// City: a merge game on an isometric grid. Three alike merge into the next level of a design system:
// tokens make a component, components a pattern, patterns a screen, screens a product.
(window.HeroGames = window.HeroGames || {}).city = (kit) => {
  const N = 5;
  const LEVELS = kit.t('city_levels').split(',');
  const PRODUCTS = kit.t('city_products').split(',');
  const HEIGHT = [0.06, 0.15, 0.3, 0.5, 0.82];
  let C = kit.colors();
  let W = 0;
  let H = 0;
  let Z;
  let tw;
  let th;
  let cx;
  let oy;
  let cells;
  let next;
  let score;
  let products;
  let maxLevel;
  let state;
  let hover = -1;
  let labels = [];
  let ghosts = [];
  let touched = false;

  const layout = () => {
    Z = kit.zone();
    tw = Math.min((Z.w - 24) / N, ((Z.h - 120) * 1.6) / N, 128);
    th = tw / 2;
    cx = Z.x + Z.w / 2;
    oy = Z.y + (Z.h - N * th) / 2 + th * 0.6;
  };
  const tileXY = (k) => {
    const i = Math.floor(k / N);
    const j = k % N;
    return { x: cx + (i - j) * (tw / 2), y: oy + (i + j) * (th / 2) };
  };
  const cellAt = (p) => {
    const a = (p.x - cx) / (tw / 2);
    const b = (p.y - oy) / (th / 2);
    const i = Math.floor((a + b) / 2);
    const j = Math.floor((b - a) / 2);
    return i >= 0 && j >= 0 && i < N && j < N ? i * N + j : -1;
  };
  const neighbours = (k) => {
    const i = Math.floor(k / N);
    const j = k % N;
    return [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N).map(([a, b]) => a * N + b);
  };
  // All connected cells of one level, as if `lv` stood at k
  const group = (k, lv, board = cells) => {
    const seen = new Set([k]);
    const stack = [k];
    while (stack.length) {
      const c = stack.pop();
      neighbours(c).forEach((n) => { if (!seen.has(n) && board[n] && board[n].lv === lv) { seen.add(n); stack.push(n); } });
    }
    return [...seen];
  };
  const roll = () => { const r = Math.random(); return r < 0.72 ? 0 : r < 0.95 ? 1 : 2; };

  const hud = () => kit.hud(kit.t('city_next', LEVELS[next]), kit.t('city_score', products, score));

  const reset = () => {
    cells = Array.from({ length: N * N }, () => null);
    score = 0;
    products = 0;
    maxLevel = 0;
    state = 'play';
    labels = [];
    ghosts = [];
    // A few pieces to start with, never three alike in a row
    let placed = 0;
    while (placed < 6) {
      const k = Math.floor(Math.random() * N * N);
      const lv = Math.random() < 0.6 ? 0 : 1;
      if (cells[k]) continue;
      cells[k] = { lv, hh: 0, v: 0 };
      if (group(k, lv).length >= 3) { cells[k] = null; continue; }
      placed += 1;
    }
    next = roll();
    kit.banner(null);
    hud();
  };

  const label = (text, k, color) => {
    const p = tileXY(k);
    labels.push({ text, x: p.x, y: p.y - HEIGHT[cells[k] ? cells[k].lv : 0] * tw - 14, t: 0, color });
  };

  const resolve = (k) => {
    const c = cells[k];
    if (c.lv >= 4) return;
    const g = group(k, c.lv);
    if (g.length < 3) return;
    g.filter((n) => n !== k).forEach((n) => {
      const from = tileXY(n);
      const to = tileXY(k);
      ghosts.push({ lv: cells[n].lv, x: from.x, y: from.y, tx: to.x, ty: to.y, t: 0 });
      cells[n] = null;
    });
    const was = c.lv;
    c.lv += 1;
    c.hh *= 0.4;
    score += g.length * Math.pow(3, c.lv) * 10;
    maxLevel = Math.max(maxLevel, c.lv);
    label(kit.t('city_merge', LEVELS[was], LEVELS[c.lv]), k, kit.colors().comp);
    if (c.lv === 4) {
      c.name = PRODUCTS[products % PRODUCTS.length];
      products += 1;
      kit.banner(kit.t('city_win'), kit.t('city_win_sub', c.name));
      setTimeout(() => { if (state === 'play') kit.banner(null); }, 2400);
    }
    resolve(k);
  };

  const place = (k) => {
    if (state === 'over') { reset(); return; }
    if (k < 0) return;
    if (cells[k]) { const p = tileXY(k); labels.push({ text: '×', x: p.x, y: p.y - 10, t: 40, color: C.signal }); return; }
    cells[k] = { lv: next, hh: 0, v: 0 };
    score += 5;
    resolve(k);
    next = roll();
    if (cells.every(Boolean)) {
      state = 'over';
      kit.banner(kit.t('city_lose'), kit.t('city_result', score));
    }
    hud();
  };

  kit.onAct((p) => {
    if (!touched) touched = true;
    if (!p) {
      // Keyboard: place on a random free tile
      const free = cells.map((c, k) => (c ? -1 : k)).filter((k) => k >= 0);
      place(state === 'over' ? 0 : free[Math.floor(Math.random() * free.length)]);
      return;
    }
    place(state === 'over' ? 0 : cellAt(p));
  });
  kit.canvas.addEventListener('pointermove', (e) => { hover = cellAt(kit.point(e)); });
  kit.canvas.addEventListener('pointerleave', () => { hover = -1; });
  kit.onTheme(() => { C = kit.colors(); });
  const ctx = kit.fit((w, h) => { const first = !W; W = w; H = h; layout(); if (first) reset(); });

  const diamond = (x, y, s = 1) => {
    ctx.beginPath();
    ctx.moveTo(x, y + (th * (1 - s)) / 2);
    ctx.lineTo(x + (tw / 2) * s, y + th / 2);
    ctx.lineTo(x, y + th - (th * (1 - s)) / 2);
    ctx.lineTo(x - (tw / 2) * s, y + th / 2);
    ctx.closePath();
  };
  // Draws in the plane of a tile's top face: u and v run from 0 to 1 across the diamond
  const onTop = (x, y, s, draw) => {
    ctx.save();
    const a = (tw / 2) * s;
    const b = (th / 2) * s;
    ctx.transform(a, b, -a, b, x, y + (th * (1 - s)) / 2);
    draw();
    ctx.restore();
  };
  const topFace = (lv) => {
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    if (lv === 0) { r(0.3, 0.3, 0.4, 0.4, C.comp); }
    else if (lv === 1) { r(0.18, 0.34, 0.64, 0.32, C.signal); r(0.36, 0.47, 0.28, 0.06, C.white); }
    else if (lv === 2) { r(0.12, 0.12, 0.76, 0.42, C.select); r(0.12, 0.62, 0.5, 0.08, C.ink); r(0.12, 0.76, 0.34, 0.08, C.line); }
    else if (lv === 3) { r(0.1, 0.08, 0.8, 0.14, C.ink); r(0.1, 0.3, 0.38, 0.3, C.select); r(0.54, 0.3, 0.36, 0.3, C.select); r(0.1, 0.7, 0.8, 0.07, C.line); r(0.58, 0.82, 0.32, 0.1, C.signal); }
    else { r(0.08, 0.08, 0.84, 0.84, C.signal); r(0.26, 0.26, 0.48, 0.48, C.white); r(0.36, 0.36, 0.28, 0.28, C.signal); }
  };
  const box = (x, y, h, lv, s, alpha = 1) => {
    ctx.globalAlpha = alpha;
    const hw = (tw / 2) * s;
    const hh = (th / 2) * s;
    const top = y + th / 2 - hh;
    const mid = y + th / 2;
    const bot = y + th / 2 + hh;
    ctx.beginPath(); ctx.moveTo(x - hw, mid - h); ctx.lineTo(x, bot - h); ctx.lineTo(x, bot); ctx.lineTo(x - hw, mid); ctx.closePath();
    ctx.fillStyle = C.paper; ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + hw, mid - h); ctx.lineTo(x, bot - h); ctx.lineTo(x, bot); ctx.lineTo(x + hw, mid); ctx.closePath();
    ctx.fillStyle = C.paper; ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.26)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, top - h); ctx.lineTo(x + hw, mid - h); ctx.lineTo(x, bot - h); ctx.lineTo(x - hw, mid - h); ctx.closePath();
    ctx.fillStyle = C.paper; ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
    onTop(x, y - h, s, () => topFace(lv));
    ctx.globalAlpha = 1;
  };
  const pill = (text, x, y, bg, fg) => {
    ctx.font = kit.mono(10);
    const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 9, w, 17, 3);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
    ctx.textAlign = 'left';
  };

  kit.loop((dt) => {
    if (!cells) return;
    cells.forEach((c) => {
      if (!c) return;
      const target = HEIGHT[c.lv] * tw;
      c.v += (target - c.hh) * 0.2 * dt;
      c.v *= Math.pow(0.7, dt);
      c.hh += c.v * dt;
    });
    labels.forEach((l) => { l.t += dt; });
    labels = labels.filter((l) => l.t < 80);
    ghosts.forEach((g) => { g.t += dt / 14; });
    ghosts = ghosts.filter((g) => g.t < 1);

    ctx.clearRect(0, 0, W, H);
    kit.dots(ctx, W, H, C);

    // Which tiles would merge if the next piece went where the pointer is
    let preview = [];
    if (hover >= 0 && !cells[hover] && state === 'play' && kit.fine) {
      const board = cells.slice();
      board[hover] = { lv: next };
      const g = group(hover, next, board);
      if (g.length >= 3 && next < 4) preview = g;
    }

    for (let k = 0; k < N * N; k += 1) {
      const p = tileXY(k);
      diamond(p.x, p.y);
      ctx.fillStyle = C.paper;
      ctx.globalAlpha = 0.45;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (let d = 0; d < N * 2 - 1; d += 1) {
      for (let i = 0; i < N; i += 1) {
        const j = d - i;
        if (j < 0 || j >= N) continue;
        const k = i * N + j;
        const p = tileXY(k);
        const c = cells[k];
        if (c) box(p.x, p.y, Math.max(0, c.hh), c.lv, 0.8);
        else if (k === hover && state === 'play' && kit.fine) box(p.x, p.y, HEIGHT[next] * tw, next, 0.8, 0.45);
        if (preview.includes(k)) {
          const h = c ? Math.max(0, c.hh) : HEIGHT[next] * tw;
          diamond(p.x, p.y - h, 0.9);
          ctx.strokeStyle = C.select;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }
    ghosts.forEach((g) => {
      const e = g.t * g.t;
      box(g.x + (g.tx - g.x) * e, g.y + (g.ty - g.y) * e, HEIGHT[g.lv] * tw * (1 - g.t), g.lv, 0.8 * (1 - g.t * 0.6), 1 - g.t);
    });
    // Products keep their name above them
    cells.forEach((c, k) => {
      if (!c || c.lv !== 4) return;
      const p = tileXY(k);
      pill(c.name, p.x, p.y - c.hh - 12, C.ink, C.paper);
    });
    labels.forEach((l) => {
      ctx.globalAlpha = l.t < 60 ? 1 : 1 - (l.t - 60) / 20;
      pill(l.text, l.x, l.y - Math.min(14, l.t * 0.5), l.color, C.white);
      ctx.globalAlpha = 1;
    });

    // The chain of levels, so the rule reads at a glance
    ctx.font = kit.mono(10);
    const parts = LEVELS.map((name, k) => ({ name, k }));
    const gap = ' → ';
    const total = parts.reduce((s, p) => s + ctx.measureText(p.name).width, 0) + ctx.measureText(gap).width * (parts.length - 1);
    let x = cx - total / 2;
    const y = Z.y + 56;
    ctx.textBaseline = 'middle';
    parts.forEach((p, k) => {
      ctx.fillStyle = p.k === next ? C.select : p.k <= maxLevel ? C.ink : C.ink2;
      ctx.fillText(p.name, x, y);
      if (p.k === next) ctx.fillRect(x, y + 8, ctx.measureText(p.name).width, 1);
      x += ctx.measureText(p.name).width;
      if (k < parts.length - 1) { ctx.fillStyle = C.ink2; ctx.fillText(gap, x, y); x += ctx.measureText(gap).width; }
    });
    if (!touched) {
      ctx.fillStyle = C.ink2;
      ctx.textAlign = 'center';
      ctx.fillText(kit.t('city_hint'), cx, y + 20);
      ctx.textAlign = 'left';
    }
  });
};
