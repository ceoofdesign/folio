// Stack: drop UI components of a booking page onto each other. What hangs over the edge is cut off.
(window.HeroGames = window.HeroGames || {}).stack = (stage, kit) => {
  const canvas = stage.querySelector('canvas');
  canvas.setAttribute('aria-label', kit.t('stack_hint'));
  const NAMES = ['Nav bar', 'Search field', 'Date picker', 'Filter chips', 'Result card', 'Seat map', 'Price summary', 'Button / Pay', 'Toast', 'Footer'];
  let W = 0;
  let H = 0;
  let C = kit.colors();
  let blocks;
  let cur;
  let falling;
  let camY;
  let speed;
  let state;
  let score;
  let flash;
  let touched = false;
  let autoLeft = 3;
  let best = Number(kit.load('stackBest')) || 0;

  const BH = () => (W < 520 ? 30 : 36);       // block pitch
  const GAP = 4;                               // auto-layout gap between components
  const baseY = () => H - 28;                  // bottom of the base frame on screen
  const topOf = (i) => baseY() - (i + 1) * BH() + camY;

  const reset = () => {
    const w = Math.min(W * 0.62, 340);
    blocks = [{ x: (W - w) / 2, w, name: 'Frame / Page', kind: -1 }];
    falling = [];
    camY = 0;
    speed = W < 520 ? 2 : 2.5;
    score = 0;
    state = 'play';
    flash = null;
    spawn();
    kit.score(kit.t('stack_score', 0) + (best ? ` · ${kit.t('stack_best', best)}` : ''));
  };
  const spawn = () => {
    const top = blocks[blocks.length - 1];
    const dir = blocks.length % 2 ? 1 : -1;
    const kind = (blocks.length - 1) % NAMES.length;
    cur = { w: top.w, x: dir > 0 ? -top.w * 0.3 : W - top.w * 0.7, dir, name: NAMES[kind], kind };
  };

  const drop = () => {
    if (state === 'over') { reset(); return; }
    const top = blocks[blocks.length - 1];
    const i = blocks.length;
    const left = Math.max(cur.x, top.x);
    const right = Math.min(cur.x + cur.w, top.x + top.w);
    const overlap = right - left;
    if (overlap <= 2) {
      falling.push({ ...cur, y: topOf(i) - camY, vy: 0, vx: cur.dir * 1.2, rot: 0, vr: cur.dir * 0.04 });
      state = 'over';
      if (score > best) { best = score; kit.save('stackBest', best); }
      kit.hint(kit.t('stack_retry'));
      kit.score(kit.t('stack_over', score) + ` · ${kit.t('stack_best', best)}`);
      return;
    }
    if (Math.abs(cur.x - top.x) <= 5) {
      cur.x = top.x;
      flash = { i, t: 0 };
    } else {
      const piece = cur.x < top.x
        ? { x: cur.x, w: top.x - cur.x, side: -1 }
        : { x: top.x + top.w, w: cur.x + cur.w - (top.x + top.w), side: 1 };
      falling.push({ ...cur, x: piece.x, w: piece.w, y: topOf(i) - camY, vy: 0, vx: piece.side * 0.8, rot: 0, vr: piece.side * 0.05 });
      cur.x = left;
      cur.w = overlap;
    }
    blocks.push({ x: cur.x, w: cur.w, name: cur.name, kind: cur.kind });
    score += 1;
    speed = Math.min(speed + 0.14, W < 520 ? 5 : 6.5);
    kit.score(kit.t('stack_score', score) + (best ? ` · ${kit.t('stack_best', best)}` : ''));
    spawn();
  };

  const act = (e) => {
    if (e) e.preventDefault();
    if (!touched) { touched = true; kit.hint(''); }
    drop();
  };
  canvas.addEventListener('pointerdown', (e) => { if (e.button === 0) act(); });
  canvas.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') act(e); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { C = kit.colors(); });
  new MutationObserver(() => { C = kit.colors(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const ctx = kit.fit(canvas, (w, h) => { const first = !W; W = w; H = h; if (first) reset(); });
  kit.hint(kit.t('stack_hint'));

  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, Math.max(0, h), Math.min(r, w / 2, h / 2)); };
  const bar = (x, y, w, h, color, r = h / 2) => { if (w <= 0) return; ctx.fillStyle = color; rr(x, y, w, h, r); ctx.fill(); };

  // A small wireframe of each component, scaled to the block
  const decor = (b, x, y, w, h) => {
    const m = 8;
    const cy = y + h / 2;
    const k = b.kind;
    if (k === -1) {
      ctx.fillStyle = C.ink2; ctx.font = kit.mono(10); ctx.textBaseline = 'middle';
      ctx.fillText('1440 × auto', x + m, cy);
      return;
    }
    if (k === 0) { bar(x + m, cy - 5, 10, 10, C.ink, 2); for (let j = 0; j < 3; j += 1) bar(x + w - m - 22 - j * 30, cy - 2, 22, 4, C.line); }
    else if (k === 1) { rr(x + m, y + 6, w - m * 2, h - 12, 6); ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke(); ctx.beginPath(); ctx.arc(x + m + 10, cy, 3.5, 0, 7); ctx.strokeStyle = C.ink2; ctx.stroke(); bar(x + m + 20, cy - 2, Math.min(80, w * 0.3), 4, C.line); }
    else if (k === 2) { const n = 7; const s = Math.min(14, (w - m * 2 - (n - 1) * 4) / n); for (let j = 0; j < n; j += 1) bar(x + m + j * (s + 4), cy - s / 2, s, s, j === 3 ? C.select : C.line, 3); }
    else if (k === 3) { let px = x + m; [36, 48, 30, 42].forEach((cw, j) => { if (px + cw < x + w - m) { ctx.strokeStyle = j === 0 ? C.ink : C.line; rr(px, cy - 8, cw, 16, 8); ctx.stroke(); } px += cw + 6; }); }
    else if (k === 4) { bar(x + m, y + 5, Math.min(36, h + 8), h - 10, C.select, 4); bar(x + m + 44, cy - 6, Math.min(90, w * 0.35), 4, C.ink); bar(x + m + 44, cy + 3, Math.min(60, w * 0.25), 4, C.line); }
    else if (k === 5) { for (let j = 0; j * 10 < w - m * 2 - 6; j += 1) { bar(x + m + j * 10, cy - 7, 7, 6, j % 5 === 2 ? C.signal : C.line, 2); bar(x + m + j * 10, cy + 1, 7, 6, C.line, 2); } }
    else if (k === 6) { bar(x + m, cy - 2, Math.min(70, w * 0.3), 4, C.line); ctx.fillStyle = C.ink; ctx.font = kit.sans(12, 500); ctx.textBaseline = 'middle'; ctx.textAlign = 'right'; if (w > 90) ctx.fillText('€ 184', x + w - m, cy); ctx.textAlign = 'left'; }
    else if (k === 7) { ctx.fillStyle = C.white; ctx.font = kit.sans(12, 500); ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; if (w > 40) ctx.fillText('Pay', x + w / 2, cy); ctx.textAlign = 'left'; }
    else if (k === 8) { bar(x + m, cy - 2, Math.min(110, w * 0.45), 4, C.paper); }
    else if (k === 9) { for (let j = 0; j < 4; j += 1) if (m + j * 46 + 34 < w) bar(x + m + j * 46, cy - 2, 34, 4, C.line); }
  };

  const drawBlock = (b, y, selected) => {
    const h = BH() - GAP;
    const fill = b.kind === 7 ? C.signal : b.kind === 8 ? C.ink : b.kind === -1 ? C.plate : C.paper;
    ctx.save();
    rr(b.x, y, b.w, h, 6);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = b.kind === -1 ? C.ink2 : C.line;
    ctx.setLineDash(b.kind === -1 ? [4, 3] : []);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.clip();
    decor(b, b.x, y, b.w, h);
    ctx.restore();
    if (selected) {
      ctx.strokeStyle = C.select;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x - 0.5, y - 0.5, b.w + 1, h + 1);
      ctx.fillStyle = C.white;
      [[b.x, y], [b.x + b.w, y], [b.x, y + h], [b.x + b.w, y + h]].forEach(([hx, hy]) => { ctx.fillRect(hx - 3, hy - 3, 6, 6); ctx.strokeRect(hx - 3, hy - 3, 6, 6); });
      ctx.font = kit.mono(10);
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = C.select;
      ctx.fillText(b.name, b.x, y - 7);
      const label = `${Math.round(b.w)}`;
      const lw = ctx.measureText(label).width + 10;
      const lx = Math.min(W - lw - 4, b.x + b.w + 8);
      rr(lx, y + h / 2 - 8, lw, 16, 3);
      ctx.fill();
      ctx.fillStyle = C.white;
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lx + 5, y + h / 2 + 0.5);
    } else if (b.kind >= 0 && b.x + b.w + 90 < W) {
      ctx.font = kit.mono(10);
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.ink2;
      ctx.fillText(b.name, b.x + b.w + 10, y + h / 2);
    }
  };

  const dots = () => {
    ctx.fillStyle = C.line;
    const off = camY % 18;
    for (let y = off; y < H; y += 18) for (let x = 9; x < W; x += 18) ctx.fillRect(x, y, 1.2, 1.2);
  };

  kit.loop((dt) => {
    if (!blocks) return;
    // Move the active component back and forth
    if (state === 'play') {
      cur.x += cur.dir * speed * dt * (kit.still ? 0.6 : 1);
      const min = -cur.w * 0.3;
      const max = W - cur.w * 0.7;
      if (cur.x < min) { cur.x = min; cur.dir = 1; }
      if (cur.x > max) { cur.x = max; cur.dir = -1; }
      // Before anyone plays, the page builds its first floors by itself
      const top = blocks[blocks.length - 1];
      if (!touched && !kit.still && autoLeft > 0 && Math.abs(cur.x - top.x) < speed * dt + 0.5) { cur.x = top.x; autoLeft -= 1; drop(); }
    }
    const target = Math.max(0, (blocks.length + 1) * BH() - H * 0.58);
    camY += (target - camY) * Math.min(1, 0.08 * dt);
    falling.forEach((f) => { f.vy += 0.5 * dt; f.y += f.vy * dt; f.x += f.vx * dt; f.rot += f.vr * dt; });
    falling = falling.filter((f) => f.y + camY < H + 80);
    if (flash) flash.t += dt;

    ctx.clearRect(0, 0, W, H);
    dots();
    blocks.forEach((b, i) => { const y = topOf(i); if (y > -BH() && y < H) drawBlock(b, y, false); });
    if (state === 'play') drawBlock(cur, topOf(blocks.length), true);
    falling.forEach((f) => {
      ctx.save();
      ctx.translate(f.x + f.w / 2, f.y + camY + (BH() - GAP) / 2);
      ctx.rotate(f.rot);
      ctx.globalAlpha = 0.85;
      drawBlock({ ...f, x: -f.w / 2 }, -(BH() - GAP) / 2, false);
      ctx.restore();
    });
    if (flash && flash.t < 50) {
      const b = blocks[flash.i];
      const y = topOf(flash.i);
      ctx.globalAlpha = 1 - flash.t / 50;
      ctx.strokeStyle = C.comp;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(b.x - 4, y - 4, b.w + 8, BH() - GAP + 8);
      ctx.setLineDash([]);
      ctx.fillStyle = C.comp;
      ctx.font = kit.mono(10);
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(kit.t('stack_perfect'), b.x, y - 8);
      ctx.globalAlpha = 1;
    }
    if (state === 'over') {
      ctx.fillStyle = C.ink;
      ctx.font = kit.sans(W < 520 ? 18 : 22, 400);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(kit.t('stack_over', score), W / 2, H * 0.3);
      ctx.fillStyle = C.ink2;
      ctx.font = kit.mono(11);
      ctx.fillText(kit.t('stack_retry'), W / 2, H * 0.3 + 28);
      ctx.textAlign = 'left';
    }
  });
};
