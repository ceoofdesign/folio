// City: an isometric canvas where every click grows a component of a design system
(window.HeroGames = window.HeroGames || {}).city = (stage, kit) => {
  const canvas = stage.querySelector('canvas');
  canvas.setAttribute('aria-label', kit.t('city_hint'));
  const N = 6;
  // h is the block height relative to the tile width
  const TYPES = [
    { name: 'Button / Primary', h: 0.12, top: 'button' },
    { name: 'Input / Text', h: 0.08, top: 'input' },
    { name: 'Card / Hotel', h: 0.34, top: 'card' },
    { name: 'Toggle', h: 0.1, top: 'toggle' },
    { name: 'Modal / Checkout', h: 0.56, top: 'modal' },
    { name: 'Avatar', h: 0.14, top: 'avatar' },
    { name: 'Token / Color', h: 0.05, top: 'token' },
    { name: 'Chart / Bars', h: 0.22, top: 'chart' },
  ];
  let W = 0;
  let H = 0;
  let C = kit.colors();
  let tw;
  let th;
  let cx;
  let oy;
  const cells = Array.from({ length: N * N }, () => null);
  let hover = -1;
  let labels = [];
  let next = 0;
  let touched = false;
  let autoTimer = 0;
  let count = 0;

  const layout = () => {
    tw = Math.min((W - 24) / N, (H * 1.75) / N, 124);
    th = tw / 2;
    cx = W / 2;
    oy = (H - N * th) / 2 + th * 0.9;
  };
  const tileXY = (i, j) => ({ x: cx + (i - j) * (tw / 2), y: oy + (i + j) * (th / 2) });
  const cellAt = (px, py) => {
    const a = (px - cx) / (tw / 2);
    const b = (py - oy) / (th / 2);
    const i = Math.floor((a + b) / 2);
    const j = Math.floor((b - a) / 2);
    return i >= 0 && j >= 0 && i < N && j < N ? i * N + j : -1;
  };

  const place = (idx, auto) => {
    const old = cells[idx];
    const type = old ? (old.type + 1) % TYPES.length : next;
    if (!old) { next = (next + 1) % TYPES.length; count += 1; }
    cells[idx] = { type, hh: 0, v: 0, tint: [C.signal, C.select, C.comp][idx % 3] };
    const i = Math.floor(idx / N);
    const j = idx % N;
    const p = tileXY(i, j);
    labels.push({ text: TYPES[type].name, x: p.x, y: p.y - TYPES[type].h * tw - 10, t: 0 });
    if (!auto) kit.score(kit.t('city_score', count));
  };

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    hover = cellAt(e.clientX - r.left, e.clientY - r.top);
    canvas.style.cursor = hover >= 0 ? 'pointer' : 'default';
  });
  canvas.addEventListener('pointerleave', () => { hover = -1; });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const r = canvas.getBoundingClientRect();
    const idx = cellAt(e.clientX - r.left, e.clientY - r.top);
    if (idx < 0) return;
    if (!touched) { touched = true; kit.hint(''); }
    place(idx, false);
  });
  canvas.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (!touched) { touched = true; kit.hint(''); }
    const empty = cells.map((c, k) => (c ? -1 : k)).filter((k) => k >= 0);
    place(empty.length ? empty[Math.floor(Math.random() * empty.length)] : Math.floor(Math.random() * N * N), false);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { C = kit.colors(); });
  new MutationObserver(() => { C = kit.colors(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const ctx = kit.fit(canvas, (w, h) => { W = w; H = h; layout(); });
  kit.hint(kit.t('city_hint'));
  kit.score(kit.t('city_score', 0));

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
    const m = ctx.getTransform();
    const a = (tw / 2) * s;
    const b = (th / 2) * s;
    ctx.transform(a, b, -a, b, x, y + (th * (1 - s)) / 2);
    draw();
    ctx.setTransform(m);
    ctx.restore();
  };

  const topFace = (kind, tint) => {
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    if (kind === 'button') { r(0.18, 0.32, 0.64, 0.36, C.signal); r(0.36, 0.47, 0.28, 0.06, C.white); }
    else if (kind === 'input') { r(0.12, 0.3, 0.76, 0.4, C.paper); ctx.strokeStyle = C.line; ctx.lineWidth = 0.02; ctx.strokeRect(0.12, 0.3, 0.76, 0.4); r(0.2, 0.47, 0.3, 0.06, C.ink2); }
    else if (kind === 'card') { r(0.12, 0.12, 0.76, 0.42, C.select); r(0.12, 0.62, 0.5, 0.07, C.ink); r(0.12, 0.76, 0.34, 0.07, C.line); }
    else if (kind === 'toggle') { r(0.22, 0.36, 0.56, 0.28, C.comp); ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(0.64, 0.5, 0.1, 0, 7); ctx.fill(); }
    else if (kind === 'modal') { r(0.1, 0.1, 0.8, 0.12, C.ink); r(0.16, 0.34, 0.68, 0.06, C.line); r(0.16, 0.48, 0.5, 0.06, C.line); r(0.5, 0.7, 0.34, 0.14, C.signal); }
    else if (kind === 'avatar') { ctx.fillStyle = C.comp; ctx.beginPath(); ctx.arc(0.5, 0.5, 0.3, 0, 7); ctx.fill(); }
    else if (kind === 'token') { r(0.1, 0.1, 0.8, 0.8, tint); }
    else if (kind === 'chart') { [0.3, 0.55, 0.42, 0.7].forEach((v, k) => r(0.16 + k * 0.18, 0.86 - v, 0.12, v, k === 3 ? C.signal : C.select)); }
  };

  const box = (x, y, h, kind, tint, s) => {
    const hw = (tw / 2) * s;
    const hh = (th / 2) * s;
    const top = y + th / 2 - hh;
    const mid = y + th / 2;
    const bot = y + th / 2 + hh;
    // left face
    ctx.beginPath(); ctx.moveTo(x - hw, mid - h); ctx.lineTo(x, bot - h); ctx.lineTo(x, bot); ctx.lineTo(x - hw, mid); ctx.closePath();
    ctx.fillStyle = C.paper; ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fill();
    // right face
    ctx.beginPath(); ctx.moveTo(x + hw, mid - h); ctx.lineTo(x, bot - h); ctx.lineTo(x, bot); ctx.lineTo(x + hw, mid); ctx.closePath();
    ctx.fillStyle = C.paper; ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.26)'; ctx.fill();
    // top face
    ctx.beginPath(); ctx.moveTo(x, top - h); ctx.lineTo(x + hw, mid - h); ctx.lineTo(x, bot - h); ctx.lineTo(x - hw, mid - h); ctx.closePath();
    ctx.fillStyle = C.paper; ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
    onTop(x, y - h, s, () => topFace(kind, tint));
  };

  kit.loop((dt) => {
    if (!W) return;
    // Until someone clicks, the system slowly assembles itself
    if (!touched && !kit.still && count < 14) {
      autoTimer += dt;
      if (autoTimer > 40) {
        autoTimer = 0;
        const empty = cells.map((c, k) => (c ? -1 : k)).filter((k) => k >= 0);
        if (empty.length) place(empty[Math.floor(Math.random() * empty.length)], true);
        kit.score(kit.t('city_score', count));
      }
    }
    cells.forEach((c) => {
      if (!c) return;
      const target = TYPES[c.type].h * tw;
      c.v += (target - c.hh) * 0.18 * dt;
      c.v *= Math.pow(0.72, dt);
      c.hh += c.v * dt;
    });
    labels.forEach((l) => { l.t += dt; });
    labels = labels.filter((l) => l.t < 90);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.line;
    for (let y = 9; y < H; y += 18) for (let x = 9; x < W; x += 18) ctx.fillRect(x, y, 1.2, 1.2);

    // Grid
    for (let i = 0; i < N; i += 1) {
      for (let j = 0; j < N; j += 1) {
        const p = tileXY(i, j);
        diamond(p.x, p.y);
        ctx.fillStyle = C.paper;
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    // Components, back to front
    for (let d = 0; d < N * 2 - 1; d += 1) {
      for (let i = 0; i < N; i += 1) {
        const j = d - i;
        if (j < 0 || j >= N) continue;
        const c = cells[i * N + j];
        if (!c) continue;
        const p = tileXY(i, j);
        box(p.x, p.y, Math.max(0, c.hh), TYPES[c.type].top, c.tint, 0.8);
      }
    }
    // Hover selection in Figma blue
    if (hover >= 0) {
      const i = Math.floor(hover / N);
      const j = hover % N;
      const p = tileXY(i, j);
      const c = cells[hover];
      const h = c ? Math.max(0, c.hh) : 0;
      diamond(p.x, p.y - h, 0.86);
      ctx.strokeStyle = C.select;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = kit.mono(10);
      ctx.fillStyle = C.select;
      ctx.textAlign = 'center';
      ctx.fillText(c ? TYPES[c.type].name : `x ${i}  y ${j}`, p.x, p.y - h - 6);
      ctx.textAlign = 'left';
    }
    // Labels that pop up when something is placed
    labels.forEach((l) => {
      ctx.globalAlpha = l.t < 70 ? 1 : 1 - (l.t - 70) / 20;
      ctx.font = kit.mono(10);
      const w = ctx.measureText(l.text).width + 10;
      const y = l.y - Math.min(10, l.t * 0.6);
      ctx.fillStyle = C.comp;
      ctx.beginPath();
      ctx.roundRect(l.x - w / 2, y - 14, w, 16, 3);
      ctx.fill();
      ctx.fillStyle = C.white;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(l.text, l.x, y - 6);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 1;
    });
  });
};
