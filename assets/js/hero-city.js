// City: a merge game on an isometric grid. Three alike merge into the next level of a design system:
// tokens make a component, components a pattern, patterns a screen, screens a product.
// The rule is shown, not written: Yar's cursor plays the first merge, and the dock shows what comes next.
(window.HeroGames = window.HeroGames || {}).city = (kit) => {
  const N = 5;
  const LEVELS = kit.t('city_levels').split(',');
  const PRODUCTS = kit.t('city_products').split(',');
  const HEIGHT = [0.07, 0.16, 0.3, 0.48, 0.78];
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
  let fx = [];
  let ghosts = [];
  let touched = false;
  let demo = null;
  let t = 0;

  const layout = () => {
    Z = kit.zone();
    const dock = 96;
    tw = Math.min((Z.w - 32) / N, ((Z.h - dock - 70) * 1.7) / N, 124);
    th = tw / 2;
    cx = Z.x + Z.w / 2;
    oy = Z.y + 48 + (Z.h - dock - 48 - N * th) / 2 + HEIGHT[4] * tw * 0.4;
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
  const group = (k, lv, board = cells) => {
    const seen = new Set([k]);
    const stack = [k];
    while (stack.length) {
      const c = stack.pop();
      neighbours(c).forEach((n) => { if (!seen.has(n) && board[n] && board[n].lv === lv) { seen.add(n); stack.push(n); } });
    }
    return [...seen];
  };
  const roll = () => { const r = Math.random(); return r < 0.7 ? 0 : r < 0.95 ? 1 : 2; };
  const piece = (lv) => ({ lv, hh: 0, v: 0, shake: 0 });

  const hud = () => kit.hud(kit.t('city_score', products, score), '');

  const reset = () => {
    cells = Array.from({ length: N * N }, () => null);
    score = 0;
    products = 0;
    maxLevel = 0;
    state = 'play';
    fx = [];
    ghosts = [];
    // Two tokens side by side with a free tile next to them: the first merge is one click away
    const a = 2 * N + 1;
    const b = 2 * N + 2;
    const spot = 3 * N + 2;
    cells[a] = piece(0);
    cells[b] = piece(0);
    let placed = 0;
    while (placed < 4) {
      const k = Math.floor(Math.random() * N * N);
      const lv = Math.random() < 0.5 ? 0 : 1;
      if (cells[k] || k === spot || neighbours(spot).includes(k) && lv === 0) continue;
      cells[k] = piece(lv);
      if (group(k, lv).length >= 3) { cells[k] = null; continue; }
      placed += 1;
    }
    next = 0;
    kit.banner(null);
    hud();
    return spot;
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
    c.hh *= 0.3;
    c.v = 0;
    score += g.length * Math.pow(3, c.lv) * 10;
    maxLevel = Math.max(maxLevel, c.lv);
    const p = tileXY(k);
    fx.push({ kind: 'ripple', x: p.x, y: p.y, t: 0 });
    for (let s = 0; s < 10; s += 1) fx.push({ kind: 'bit', x: p.x, y: p.y + th / 2 - HEIGHT[c.lv] * tw, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3 - 1, t: 0, color: [C.comp, C.select, C.signal][s % 3] });
    fx.push({ kind: 'pill', text: kit.t('city_merge', LEVELS[was], LEVELS[c.lv]), x: p.x, y: p.y - HEIGHT[c.lv] * tw - 16, t: 0 });
    if (c.lv === 4) {
      c.name = PRODUCTS[products % PRODUCTS.length];
      products += 1;
      kit.banner(kit.t('city_win'), kit.t('city_win_sub', c.name));
      setTimeout(() => { if (state === 'play') kit.banner(null); }, 2400);
    }
    setTimeout(() => resolve(k), 220);
  };

  const place = (k) => {
    if (state === 'over') { const spot = reset(); return spot; }
    if (k < 0) return null;
    if (cells[k]) { cells[k].shake = 14; return null; }
    cells[k] = piece(next);
    score += 5;
    resolve(k);
    next = roll();
    if (cells.every(Boolean)) {
      state = 'over';
      setTimeout(() => kit.banner(kit.t('city_lose'), kit.t('city_result', score)), 500);
    }
    hud();
    return null;
  };

  kit.onAct((p) => {
    demo = null;
    touched = true;
    if (!p) {
      const free = cells.map((c, k) => (c ? -1 : k)).filter((k) => k >= 0);
      place(state === 'over' ? 0 : free[Math.floor(Math.random() * free.length)]);
      return;
    }
    place(state === 'over' ? 0 : cellAt(p));
  });
  kit.canvas.addEventListener('pointermove', (e) => { if (!demo) hover = cellAt(kit.point(e)); });
  kit.canvas.addEventListener('pointerleave', () => { if (!demo) hover = -1; });
  kit.onTheme(() => { C = kit.colors(); });
  let spot = -1;
  const ctx = kit.fit((w, h) => { const first = !W; W = w; H = h; layout(); if (first) spot = reset(); });

  // Yar's cursor makes the first merge, once
  setTimeout(() => {
    if (touched || kit.still || spot < 0 || cells[spot]) return;
    demo = { phase: 'in', t: 0, x: Z.x + Z.w * 0.9, y: Z.y + Z.h * 0.8, press: 0 };
  }, 1400);
  const runDemo = (dt) => {
    if (!demo) return;
    demo.t += dt;
    const p = tileXY(spot);
    const target = { x: p.x + 4, y: p.y + th / 2 + 2 };
    if (demo.phase === 'in') {
      demo.x += (target.x - demo.x) * 0.07 * dt;
      demo.y += (target.y - demo.y) * 0.07 * dt;
      if (Math.hypot(target.x - demo.x, target.y - demo.y) < 4) hover = spot;
      if (demo.t > 110) { demo.phase = 'press'; demo.t = 0; place(spot); hover = -1; fx.push({ kind: 'tap', x: demo.x, y: demo.y, t: 0 }); }
    } else if (demo.phase === 'press') {
      demo.press = Math.max(0, 1 - Math.abs(demo.t - 6) / 6);
      if (demo.t > 60) { demo.phase = 'out'; demo.t = 0; }
    } else {
      demo.x += 3.5 * dt;
      demo.y += 1.5 * dt;
      if (demo.t > 50) demo = null;
    }
  };

  const diamond = (x, y, s = 1) => {
    ctx.beginPath();
    ctx.moveTo(x, y + (th * (1 - s)) / 2);
    ctx.lineTo(x + (tw / 2) * s, y + th / 2);
    ctx.lineTo(x, y + th - (th * (1 - s)) / 2);
    ctx.lineTo(x - (tw / 2) * s, y + th / 2);
    ctx.closePath();
  };
  const onTop = (x, y, s, w, draw) => {
    ctx.save();
    const a = (w / 2) * s;
    ctx.transform(a, a / 2, -a, a / 2, x, y + ((w / 2) * (1 - s)) / 2);
    draw();
    ctx.restore();
  };
  const topFace = (lv) => {
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    if (lv === 0) { r(0.28, 0.28, 0.44, 0.44, C.comp); }
    else if (lv === 1) { r(0.18, 0.33, 0.64, 0.34, C.signal); r(0.37, 0.47, 0.26, 0.06, C.white); }
    else if (lv === 2) { r(0.12, 0.12, 0.76, 0.42, C.select); r(0.12, 0.62, 0.52, 0.08, C.ink); r(0.12, 0.76, 0.32, 0.08, C.line); }
    else if (lv === 3) { r(0.1, 0.08, 0.8, 0.13, C.ink); r(0.1, 0.29, 0.38, 0.3, C.select); r(0.52, 0.29, 0.38, 0.3, C.comp); r(0.1, 0.68, 0.8, 0.07, C.line); r(0.58, 0.8, 0.32, 0.11, C.signal); }
    else { r(0.08, 0.08, 0.84, 0.84, C.signal); r(0.26, 0.26, 0.48, 0.48, C.white); r(0.37, 0.37, 0.26, 0.26, C.signal); }
  };
  // An extruded block: soft shadow on the floor, two shaded sides and a face with the component's UI
  const box = (x, y, h, lv, s, alpha = 1, w = tw) => {
    const ht = w / 2;
    ctx.globalAlpha = alpha;
    const hw = (w / 2) * s;
    const hh = (ht / 2) * s;
    const top = y + ht / 2 - hh;
    const mid = y + ht / 2;
    const bot = y + ht / 2 + hh;
    ctx.save();
    ctx.shadowColor = C.shadow;
    ctx.shadowBlur = 10 + h * 0.3;
    ctx.shadowOffsetY = 4;
    ctx.beginPath(); ctx.moveTo(x - hw, mid); ctx.lineTo(x, bot); ctx.lineTo(x + hw, mid); ctx.lineTo(x, top); ctx.closePath();
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(x - hw, mid - h); ctx.lineTo(x, bot - h); ctx.lineTo(x, bot); ctx.lineTo(x - hw, mid); ctx.closePath();
    ctx.fillStyle = C.card; ctx.fill(); ctx.fillStyle = C.dark ? 'rgba(0,0,0,.28)' : 'rgba(0,0,0,.07)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + hw, mid - h); ctx.lineTo(x, bot - h); ctx.lineTo(x, bot); ctx.lineTo(x + hw, mid); ctx.closePath();
    ctx.fillStyle = C.card; ctx.fill(); ctx.fillStyle = C.dark ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.14)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, top - h); ctx.lineTo(x + hw, mid - h); ctx.lineTo(x, bot - h); ctx.lineTo(x - hw, mid - h); ctx.closePath();
    ctx.fillStyle = C.card; ctx.fill();
    ctx.strokeStyle = C.edge; ctx.lineWidth = 1; ctx.stroke();
    onTop(x, y - h, s * 0.86, w, () => topFace(lv));
    ctx.globalAlpha = 1;
  };
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const pillAt = (text, x, y, bg, fg) => {
    ctx.font = kit.mono(10);
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = bg;
    rr(x - w / 2, y - 9, w, 18, 4);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
    ctx.textAlign = 'left';
  };

  // The dock under the grid: the next piece, and the chain of levels it can grow into
  const dock = () => {
    const y = Z.y + Z.h - 64;
    const step = Math.min(78, (Z.w - 120) / 5);
    const left = cx - (step * 5 + 84) / 2;
    const bob = Math.sin(t * 2.4) * 2;
    ctx.fillStyle = C.ink2;
    ctx.font = kit.mono(9);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    box(left + 30, y - 18 + bob, HEIGHT[next] * 52, next, 0.8, 1, 52);
    ctx.fillText(LEVELS[next], left + 30, y + 26);
    ctx.fillStyle = C.line;
    ctx.fillRect(left + 72, y - 14, 1, 52);
    LEVELS.forEach((name, k) => {
      const x = left + 84 + step * k + step / 2;
      const reached = k <= maxLevel;
      ctx.globalAlpha = reached ? 1 : 0.35;
      ctx.save();
      ctx.translate(x - 11, y - 4);
      ctx.scale(22, 22);
      ctx.fillStyle = C.card;
      ctx.fillRect(0, 0, 1, 1);
      topFace(k);
      ctx.restore();
      ctx.strokeStyle = k === next ? C.select : C.edge;
      ctx.lineWidth = k === next ? 1.5 : 1;
      rr(x - 11.5, y - 4.5, 23, 23, 4);
      ctx.stroke();
      ctx.fillStyle = k === next ? C.select : C.ink2;
      if (step >= 64 || k === next) ctx.fillText(name, x, y + 26);
      ctx.globalAlpha = 1;
      if (k < LEVELS.length - 1) {
        ctx.fillStyle = C.line;
        ctx.fillRect(x + 16, y + 7, step - 32, 1);
      }
    });
    ctx.textAlign = 'left';
  };

  kit.loop((dt) => {
    if (!cells) return;
    t += dt / 60;
    runDemo(dt);
    cells.forEach((c) => {
      if (!c) return;
      const target = HEIGHT[c.lv] * tw;
      c.v = (c.v + (target - c.hh) * 0.16 * dt) * Math.pow(0.74, dt);
      c.hh += c.v * dt;
      if (c.shake > 0) c.shake -= dt;
    });
    fx.forEach((f) => { f.t += dt; if (f.kind === 'bit') { f.vy += 0.15 * dt; f.x += f.vx * dt; f.y += f.vy * dt; } });
    fx = fx.filter((f) => f.t < (f.kind === 'pill' ? 80 : 40));
    ghosts.forEach((g) => { g.t += dt / 12; });
    ghosts = ghosts.filter((g) => g.t < 1);

    ctx.clearRect(0, 0, W, H);
    kit.dots(ctx, W, H, C);

    let preview = [];
    const showHover = hover >= 0 && !cells[hover] && state === 'play' && (kit.fine || demo);
    if (showHover) {
      const board = cells.slice();
      board[hover] = { lv: next };
      const g = group(hover, next, board);
      if (g.length >= 3 && next < 4) preview = g;
    }

    for (let k = 0; k < N * N; k += 1) {
      const p = tileXY(k);
      diamond(p.x, p.y, 0.96);
      ctx.fillStyle = k === hover && showHover ? (C.dark ? 'rgba(13,153,255,.12)' : 'rgba(13,153,255,.1)') : C.faint;
      ctx.fill();
    }
    fx.filter((f) => f.kind === 'ripple').forEach((f) => {
      const k = f.t / 40;
      ctx.globalAlpha = 1 - k;
      diamond(f.x, f.y, 1 + k * 0.8);
      ctx.strokeStyle = C.comp;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    for (let d = 0; d < N * 2 - 1; d += 1) {
      for (let i = 0; i < N; i += 1) {
        const j = d - i;
        if (j < 0 || j >= N) continue;
        const k = i * N + j;
        const p = tileXY(k);
        const c = cells[k];
        const shake = c && c.shake > 0 ? Math.sin(c.shake * 1.8) * 3 : 0;
        if (c) box(p.x + shake, p.y, Math.max(0, c.hh), c.lv, 0.78);
        else if (k === hover && showHover) box(p.x, p.y, HEIGHT[next] * tw, next, 0.78, 0.5);
        if (preview.includes(k)) {
          const h = c ? Math.max(0, c.hh) : HEIGHT[next] * tw;
          diamond(p.x, p.y - h, 0.86);
          ctx.strokeStyle = C.select;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }
    ghosts.forEach((g) => {
      const e = g.t * g.t;
      box(g.x + (g.tx - g.x) * e, g.y + (g.ty - g.y) * e, HEIGHT[g.lv] * tw * (1 - g.t * 0.5), g.lv, 0.78 * (1 - g.t * 0.5), 1 - g.t);
    });
    cells.forEach((c, k) => {
      if (!c || c.lv !== 4) return;
      const p = tileXY(k);
      pillAt(c.name, p.x, p.y + th * 0.2 - c.hh - 14, C.ink, C.paper);
    });
    fx.forEach((f) => {
      if (f.kind === 'bit') {
        ctx.globalAlpha = 1 - f.t / 40;
        ctx.fillStyle = f.color;
        ctx.fillRect(f.x - 2, f.y - 2, 4, 4);
        ctx.globalAlpha = 1;
      } else if (f.kind === 'pill') {
        const k = f.t / 80;
        ctx.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
        pillAt(f.text, f.x, f.y - Math.min(16, f.t * 0.6), C.comp, C.white);
        ctx.globalAlpha = 1;
      } else if (f.kind === 'tap') {
        const k = f.t / 36;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = C.comp;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 4 + k * 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });
    dock();
    if (demo) {
      ctx.globalAlpha = demo.phase === 'out' ? Math.max(0, 1 - demo.t / 40) : Math.min(1, demo.t / 20);
      kit.cursor(ctx, demo.x, demo.y, 'Yar', C.comp, demo.press);
      ctx.globalAlpha = 1;
    }
  });
};
