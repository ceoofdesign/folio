// Tower: a screen of a booking flow swings on a crane. Release it on time to stack the flow.
// A sloppy landing makes the tower sway; a miss is a bug in production. Three bugs and it's over.
(window.HeroGames = window.HeroGames || {}).tower = (kit) => {
  const SCREENS = ['Search', 'Results', 'Filters', 'Hotel page', 'Rooms', 'Guests', 'Payment', '3-D Secure', 'Confirmation', 'E-ticket'];
  const GOAL = 10;
  let C = kit.colors();
  let W = 0;
  let H = 0;
  let Z = { x: 0, y: 0, w: 0, h: 0 };
  let bw;
  let bh;
  let towerX;
  let groundY;
  let pivot;
  let L;
  let blocks;
  let hang;
  let fall;
  let debris;
  let pops;
  let confetti;
  let sway;
  let t = 0;
  let cam;
  let bugs;
  let state;
  let won;
  let touched = false;
  let best = Number(kit.load('towerBest')) || 0;

  const measure = () => {
    Z = kit.zone();
    const narrow = W < 900;
    bw = Math.round(Math.max(narrow ? 84 : 96, Math.min(Z.w * (narrow ? 0.3 : 0.24), narrow ? 128 : 148)));
    bh = Math.round(bw * 0.42);
    towerX = Z.x + Z.w / 2;
    groundY = Z.y + Z.h - 20;
    pivot = { x: towerX, y: Z.y + (narrow ? 44 : -24) };
    L = Math.max(bh * 2.2, Z.h * (narrow ? 0.2 : 0.24));
  };

  const hud = () => {
    const n = blocks.length;
    kit.hud(n < GOAL && !won ? kit.t('tower_goal', n, GOAL) : kit.t('tower_goal_endless', n, Math.max(best, n)), kit.t('tower_lives', bugs));
  };

  const newHang = () => {
    const n = blocks.length;
    hang = { i: n, name: SCREENS[n % SCREENS.length], tint: [C.select, C.comp, C.signal][n % 3], grow: 0, phase: Math.random() * 6 };
  };

  const reset = () => {
    blocks = [];
    fall = null;
    debris = [];
    pops = [];
    confetti = [];
    sway = 0;
    cam = 0;
    bugs = 0;
    state = 'play';
    won = false;
    kit.banner(null);
    newHang();
    hud();
  };

  // Pendulum: amplitude and speed grow with the height of the tower
  const swing = () => {
    const n = blocks.length;
    const slow = kit.still ? 0.7 : 1;
    const A = Math.min(0.78, 0.42 + n * 0.025);
    const w = (Math.min(2.7, 1.55 + n * 0.06)) * slow;
    const theta = A * Math.sin(t * w + hang.phase);
    const dtheta = A * w * Math.cos(t * w + hang.phase);
    const len = L * (0.55 + 0.45 * hang.grow);
    return { theta, dtheta, len, x: pivot.x + len * Math.sin(theta), y: pivot.y + len * Math.cos(theta) };
  };
  const swayAt = (i) => {
    const n = Math.max(1, blocks.length);
    return Math.sin(t * 1.25) * (sway + n * 0.35) * Math.pow((i + 1) / n, 1.6);
  };
  const topY = () => groundY - blocks.length * bh;           // world y of the tower's top surface

  const release = () => {
    if (!hang || hang.grow < 0.95 || fall) return;
    const s = swing();
    fall = { name: hang.name, tint: hang.tint, x: s.x, y: s.y + bh / 2 - cam, vx: (s.dtheta * s.len * Math.cos(s.theta)) / 60, vy: (-s.dtheta * s.len * Math.sin(s.theta)) / 60, rot: s.theta, vr: 0, miss: false };
    hang = null;
  };

  const pop = (text, x, y, color) => pops.push({ text, x, y, t: 0, color });

  const loseWith = (key) => {
    state = 'over';
    const n = blocks.length;
    if (n > best) { best = n; kit.save('towerBest', best); }
    kit.banner(kit.t(key), kit.t('tower_result', n, best));
    hud();
  };

  const land = () => {
    const n = blocks.length;
    const topX = n ? blocks[n - 1].x + swayAt(n - 1) : towerX;
    const dx = fall.x - topX;
    const reach = n ? bw * 0.72 : bw * 0.95;
    if (Math.abs(dx) > reach) {
      fall.miss = true;
      fall.vr = Math.sign(dx || 1) * 0.07;
      fall.vx += Math.sign(dx || 1) * 1.5;
      bugs += 1;
      pop(kit.t('tower_bug'), fall.x, topY() + cam - bh, C.signal);
      hud();
      return;
    }
    let x = fall.x - swayAt(n);
    if (Math.abs(dx) <= bw * 0.1) {
      x = n ? blocks[n - 1].x : towerX;
      sway *= 0.55;
      pop(kit.t('tower_perfect'), topX, topY() + cam - bh * 1.6, C.comp);
    } else {
      sway += (Math.abs(dx) / bw) * bw * 0.34;
    }
    blocks.push({ x, name: fall.name, tint: fall.tint });
    fall = null;
    // Too far off centre, or swinging too hard: the layout falls apart
    const com = blocks.reduce((s, b) => s + b.x, 0) / blocks.length - towerX;
    if (Math.abs(com) > bw * 0.55 || sway > bw * 0.9) {
      blocks.forEach((b, i) => debris.push({ name: b.name, tint: b.tint, x: b.x + swayAt(i), y: groundY - (i + 0.5) * bh, vx: (Math.random() - 0.5) * 3 + Math.sign(com) * 1.5, vy: -Math.random() * 3, rot: 0, vr: (Math.random() - 0.5) * 0.12 }));
      blocks = [];
      loseWith('tower_lose_fall');
      return;
    }
    if (blocks.length === GOAL && !won) {
      won = true;
      for (let k = 0; k < 70; k += 1) confetti.push({ x: towerX, y: topY() + cam, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 9 - 2, s: 3 + Math.random() * 4, c: [C.select, C.comp, C.signal][k % 3], r: Math.random() * 6 });
      kit.banner(kit.t('tower_win'), kit.t('tower_win_sub', bugs));
      setTimeout(() => { if (state === 'play') kit.banner(null); }, 2600);
    }
    hud();
    newHang();
  };

  kit.onAct(() => {
    if (!touched) touched = true;
    if (state === 'over') { reset(); return; }
    release();
  });
  kit.onTheme(() => { C = kit.colors(); });
  const ctx = kit.fit((w, h) => { const first = !W; W = w; H = h; measure(); if (first) reset(); });

  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

  // One screen of the flow, drawn centred on (0, 0)
  const screen = (b, selected) => {
    const x = -bw / 2;
    const y = -bh / 2;
    rr(x, y, bw, bh, 6);
    ctx.fillStyle = C.paper;
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.stroke();
    const pad = Math.round(bh * 0.22);
    const icon = Math.round(bh * 0.32);
    ctx.fillStyle = b.tint;
    rr(x + pad, y + pad, icon, icon, 3);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.font = kit.sans(Math.max(10, Math.round(bh * 0.27)), 500);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(b.name, x + pad + icon + 6, y + pad + icon / 2 + 0.5, bw - pad * 2 - icon - 6);
    ctx.fillStyle = C.line;
    rr(x + pad, y + bh - pad - 4, bw * 0.55, 4, 2);
    ctx.fill();
    if (b.name === 'Payment') { ctx.fillStyle = C.signal; rr(x + bw - pad - 22, y + bh - pad - 8, 22, 10, 3); ctx.fill(); }
    if (selected) {
      ctx.strokeStyle = C.select;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 2, y - 2, bw + 4, bh + 4);
      ctx.fillStyle = C.white;
      [[x - 2, y - 2], [x + bw + 2, y - 2], [x - 2, y + bh + 2], [x + bw + 2, y + bh + 2]].forEach(([hx, hy]) => { ctx.fillRect(hx - 3, hy - 3, 6, 6); ctx.strokeRect(hx - 3, hy - 3, 6, 6); });
    }
  };
  const drawAt = (b, x, y, rot, selected) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    screen(b, selected);
    ctx.restore();
  };

  kit.loop((dt) => {
    if (!blocks) return;
    t += dt / 60;
    sway *= Math.pow(0.9992, dt);
    if (hang) hang.grow = Math.min(1, hang.grow + 0.05 * dt);

    // Camera keeps the top of the tower a little below the swinging screen
    const want = pivot.y + L + bh * 1.5 + Z.h * 0.2;
    const target = Math.max(-(groundY - Z.y - Z.h * 0.5), want - topY());
    cam += (target - cam) * Math.min(1, 0.06 * dt);

    if (fall) {
      fall.vy += 0.55 * dt;
      fall.x += fall.vx * dt;
      fall.y += fall.vy * dt;
      fall.rot *= Math.pow(0.86, dt);
      fall.rot += fall.vr * dt;
      if (!fall.miss && fall.vy > 0 && fall.y + bh / 2 >= topY()) {
        fall.y = topY() - bh / 2;
        land();
      } else if (fall && fall.miss && fall.y + cam > H + bh * 2) {
        fall = null;
        if (bugs >= 3) loseWith('tower_lose_bugs');
        else newHang();
      }
    }
    debris.forEach((d) => { d.vy += 0.5 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt; });
    debris = debris.filter((d) => d.y + cam < H + bh * 3);
    pops.forEach((p) => { p.t += dt; });
    pops = pops.filter((p) => p.t < 70);
    confetti.forEach((c) => { c.vy += 0.25 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.r += 0.1 * dt; });
    confetti = confetti.filter((c) => c.y < H + 20);

    ctx.clearRect(0, 0, W, H);
    kit.dots(ctx, W, H, C, cam);

    // Base frame the flow stands on
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = C.ink2;
    ctx.lineWidth = 1;
    ctx.strokeRect(towerX - bw * 0.7, groundY + cam, bw * 1.4, 10);
    ctx.setLineDash([]);
    ctx.fillStyle = C.ink2;
    ctx.font = kit.mono(10);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    if (groundY + cam + 14 < H) ctx.fillText('Frame / Booking flow', towerX - bw * 0.7, groundY + cam + 14);

    // Tower
    blocks.forEach((b, i) => {
      const y = groundY - (i + 0.5) * bh + cam;
      if (y < -bh || y > H + bh) return;
      const sx = swayAt(i);
      drawAt(b, b.x + sx, y, sx * 0.0025, false);
    });
    // Layer names beside the top three screens
    ctx.font = kit.mono(10);
    ctx.fillStyle = C.ink2;
    ctx.textBaseline = 'middle';
    blocks.slice(-3).forEach((b, k, arr) => {
      const i = blocks.length - arr.length + k;
      const y = groundY - (i + 0.5) * bh + cam;
      const lx = b.x + swayAt(i) + bw / 2 + 12;
      if (lx + 70 < Z.x + Z.w) ctx.fillText(`${String(i + 1).padStart(2, '0')} ${b.name}`, lx, y);
    });

    // Crane, rope and the swinging screen
    if (hang && state === 'play') {
      const s = swing();
      const hook = { x: s.x - Math.sin(s.theta) * (bh / 2 + 6), y: s.y - Math.cos(s.theta) * (bh / 2 + 6) };
      ctx.strokeStyle = C.ink2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pivot.x, pivot.y);
      ctx.lineTo(hook.x, hook.y);
      ctx.stroke();
      ctx.save();
      ctx.translate(hook.x, hook.y);
      ctx.rotate(Math.PI / 4 + s.theta);
      ctx.fillStyle = C.comp;
      ctx.fillRect(-3.5, -3.5, 7, 7);
      ctx.restore();
      if (pivot.y > -2) { ctx.fillStyle = C.ink; ctx.fillRect(pivot.x - 18, pivot.y - 2, 36, 2); }
      drawAt(hang, s.x, s.y + bh / 2 * 0, s.theta, true);
      if (!touched) {
        ctx.fillStyle = C.ink2;
        ctx.font = kit.mono(11);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(kit.t('tower_hint'), towerX, pivot.y + L + bh + 18);
        ctx.textAlign = 'left';
      }
    }
    if (fall) drawAt(fall, fall.x, fall.y + cam, fall.rot, false);
    debris.forEach((d) => drawAt(d, d.x, d.y + cam, d.rot, false));

    pops.forEach((p) => {
      ctx.globalAlpha = p.t < 50 ? 1 : 1 - (p.t - 50) / 20;
      ctx.font = kit.mono(11);
      const w = ctx.measureText(p.text).width + 12;
      const y = p.y - p.t * 0.4;
      ctx.fillStyle = p.color;
      rr(p.x - w / 2, y - 9, w, 18, 3);
      ctx.fill();
      ctx.fillStyle = C.white;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.text, p.x, y + 0.5);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    });
    confetti.forEach((c) => {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.r);
      ctx.fillStyle = c.c;
      ctx.fillRect(-c.s / 2, -c.s / 2, c.s, c.s);
      ctx.restore();
    });
  });
};
