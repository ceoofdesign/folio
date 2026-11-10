// Tower: a screen of a booking flow swings from a crane. Release it on time to stack the flow.
// Off-centre landings make the tower sway; a screen that hangs over the edge tips off — a bug.
// Three bugs or a collapse end the run. Ten screens ship the flow.
(window.HeroGames = window.HeroGames || {}).tower = (kit) => {
  const SCREENS = ['Search', 'Results', 'Filters', 'Hotel', 'Rooms', 'Guests', 'Payment', '3-D Secure', 'Confirm', 'E-ticket'];
  const TINTS = ['select', 'comp', 'signal'];
  const GOAL = 10;
  const G = 0.62;                                   // gravity, px per frame²
  let C = kit.colors();
  let W = 0;
  let H = 0;
  let Z;
  let bw;
  let bh;
  let cx;
  let groundY;
  let jibY;
  let rope;
  let blocks;
  let hang;
  let fall;
  let debris;
  let fx;
  let amp;
  let t = 0;
  let cam;
  const base = { dip: 0, v: 0 };
  let bugs;
  let state;
  let won;
  let touched = false;
  let demo = null;
  let best = Number(kit.load('towerBest')) || 0;

  const easeOut = (k) => 1 - Math.pow(1 - k, 3);
  const spring = (o, key, velKey, target, k, damp, dt) => {
    o[velKey] = (o[velKey] + (target - o[key]) * k * dt) * Math.pow(damp, dt);
    o[key] += o[velKey] * dt;
  };

  const measure = () => {
    Z = kit.zone();
    const narrow = W < 900;
    bw = Math.round(Math.max(104, Math.min(Z.w * (narrow ? 0.36 : 0.26), 156)));
    bh = Math.round(bw * 0.4);
    cx = Z.x + Z.w / 2;
    groundY = Z.y + Z.h - 60;
    jibY = Z.y + (narrow ? 54 : 40);
    rope = Math.max(bh * 2.2, Math.min(Z.h * 0.2, 190));
  };

  const hud = () => {
    const n = blocks.length;
    const goal = n < GOAL && !won ? kit.t('tower_goal', n, GOAL) : kit.t('tower_goal_endless', n, Math.max(best, n));
    kit.hud(goal, kit.t('tower_lives', bugs), 'bottom');
  };
  const tint = (k) => C[TINTS[k % 3]];

  const newHang = () => {
    const n = blocks.length;
    hang = { k: n, name: SCREENS[n % SCREENS.length], drop: 0, phase: Math.random() * Math.PI * 2 };
  };
  const reset = () => {
    blocks = [];
    fall = null;
    debris = [];
    fx = [];
    amp = 0;
    cam = 0;
    base.dip = 0;
    base.v = 0;
    bugs = 0;
    state = 'play';
    won = false;
    kit.banner(null);
    newHang();
    hud();
  };

  // The pendulum swings wider and faster as the tower grows
  const swing = () => {
    const n = blocks.length;
    const slow = kit.still ? 0.7 : 1;
    const A = Math.min(0.66, 0.36 + n * 0.028);
    const w = Math.min(2.9, 1.7 + n * 0.08) * slow;
    const theta = A * Math.sin(t * w + hang.phase);
    const dtheta = A * w * Math.cos(t * w + hang.phase);
    const len = rope * (0.7 + 0.3 * easeOut(hang.drop));
    const R = len + bh / 2;
    return { theta, dtheta, len, R, x: cx + R * Math.sin(theta), y: jibY + R * Math.cos(theta) };
  };
  // Horizontal sway of block i: the top moves most, the base stays put
  const swayAt = (i, n = blocks.length) => Math.sin(t * 1.4) * amp * Math.pow((i + 1) / Math.max(1, n), 1.5);
  const surface = () => groundY - blocks.length * bh;

  const release = (forced) => {
    if (!hang || hang.drop < 1 || fall || state !== 'play') return;
    const s = swing();
    fall = {
      k: hang.k, name: hang.name, x: s.x, y: s.y - cam,
      vx: forced ? 0 : (s.R * Math.cos(s.theta) * s.dtheta) / 60,
      vy: forced ? 0 : (-s.R * Math.sin(s.theta) * s.dtheta) / 60,
      rot: -s.theta, av: forced ? 0 : -s.dtheta / 60, mode: 'fall', tip: 0, dir: 0,
    };
    hang = null;
  };

  const burst = (x, y, color) => fx.push({ kind: 'ring', x, y, t: 0, color });
  const pill = (text, x, y, color) => fx.push({ kind: 'pill', text, x, y, t: 0, color });

  const endRun = (key) => {
    state = 'over';
    const n = blocks.length;
    if (n > best) { best = n; kit.save('towerBest', best); }
    setTimeout(() => kit.banner(kit.t(key), kit.t('tower_result', n, best)), 500);
    hud();
  };

  const land = () => {
    const n = blocks.length;
    const topX = n ? blocks[n - 1].x + swayAt(n - 1) : cx;
    const support = n ? bw / 2 : bw * 0.62;
    const dx = fall.x - topX;
    const y = surface();
    if (Math.abs(dx) > support) {
      // More than half hangs over the edge: it tips off around the corner
      fall.mode = 'tip';
      fall.dir = Math.sign(dx) || 1;
      fall.pivot = topX + fall.dir * support;
      fall.y = y - bh / 2;
      return;
    }
    const perfect = Math.abs(dx) <= bw * 0.06;
    const x = perfect ? (n ? blocks[n - 1].x : cx) : fall.x - swayAt(n, n + 1);
    blocks.push({ k: fall.k, name: fall.name, x, r: perfect ? 0 : Math.max(-0.3, Math.min(0.3, fall.rot)), rv: 0, sq: 0.84, sqv: 0 });
    base.v += 2.2 + Math.abs(fall.vy) * 0.2;
    if (perfect) {
      amp *= 0.55;
      burst(topX, y - bh / 2, C.comp);
      pill(kit.t('tower_perfect'), topX, y - bh * 1.5, C.comp);
    } else {
      amp += (Math.abs(dx) / bw) * bw * 0.5;
    }
    fall = null;
    const com = blocks.reduce((s, b) => s + b.x, 0) / blocks.length - cx;
    if (Math.abs(com) > bw * 0.42 || amp > bw * 0.66) {
      const dir = Math.sign(com || swayAt(blocks.length - 1) || 1);
      blocks.forEach((b, i) => debris.push({ k: b.k, name: b.name, x: b.x + swayAt(i), y: groundY - (i + 0.5) * bh, vx: dir * (0.6 + i * 0.35) + (Math.random() - 0.5), vy: -Math.random() * 2, rot: 0, av: dir * (0.01 + i * 0.006) }));
      blocks = [];
      endRun('tower_lose_fall');
      return;
    }
    if (blocks.length === GOAL && !won) {
      won = true;
      for (let k = 0; k < 64; k += 1) fx.push({ kind: 'bit', x: cx + (Math.random() - 0.5) * bw, y: y - bh, vx: (Math.random() - 0.5) * 8, vy: -Math.random() * 8 - 3, s: 3 + Math.random() * 3, color: tint(k), r: Math.random() * 6, t: 0 });
      kit.banner(kit.t('tower_win'), kit.t('tower_win_sub', bugs));
      setTimeout(() => { if (state === 'play') kit.banner(null); }, 2600);
    }
    hud();
    newHang();
  };

  kit.onAct(() => {
    demo = null;
    touched = true;
    if (state === 'over') { reset(); return; }
    release(false);
  });
  kit.onTheme(() => { C = kit.colors(); });
  const ctx = kit.fit((w, h) => { const first = !W; W = w; H = h; measure(); if (first) reset(); });

  // The first move is played by Yar's cursor, once
  setTimeout(() => {
    if (touched || kit.still) return;
    demo = { phase: 'in', t: 0, x: Z.x + Z.w * 0.92, y: Z.y + Z.h * 0.78, press: 0 };
  }, 1200);
  const runDemo = (dt) => {
    if (!demo) return;
    demo.t += dt;
    const target = { x: cx + bw * 0.8, y: jibY + rope + bh * 1.5 };
    if (demo.phase === 'in') {
      demo.x += (target.x - demo.x) * 0.06 * dt;
      demo.y += (target.y - demo.y) * 0.06 * dt;
      if (demo.t > 60 && hang && hang.drop >= 1 && Math.abs(swing().theta) < 0.04) {
        demo.phase = 'press';
        demo.t = 0;
        release(true);
        fx.push({ kind: 'tap', x: demo.x, y: demo.y, t: 0 });
      }
    } else if (demo.phase === 'press') {
      demo.press = Math.max(0, 1 - Math.abs(demo.t - 6) / 6);
      if (demo.t > 40) { demo.phase = 'out'; demo.t = 0; }
    } else {
      demo.x += 4 * dt;
      demo.y += 1.2 * dt;
      if (demo.t > 50) demo = null;
    }
  };

  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

  // One screen of the flow, centred on (0, 0)
  const card = (b, opts) => {
    const x = -bw / 2;
    const y = -bh / 2;
    ctx.save();
    if (opts.lift) { ctx.shadowColor = C.shadow; ctx.shadowBlur = opts.lift; ctx.shadowOffsetY = opts.lift * 0.4; }
    rr(x, y, bw, bh, 8);
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = opts.danger ? C.signal : C.edge;
    ctx.lineWidth = 1;
    rr(x + 0.5, y + 0.5, bw - 1, bh - 1, 7.5);
    ctx.stroke();
    const pad = Math.round(bh * 0.24);
    const icon = Math.round(bh * 0.4);
    ctx.fillStyle = tint(b.k);
    rr(x + pad, y + (bh - icon) / 2, icon, icon, 5);
    ctx.fill();
    ctx.fillStyle = C.white;
    ctx.globalAlpha = 0.9;
    rr(x + pad + icon * 0.28, y + (bh - icon) / 2 + icon * 0.28, icon * 0.44, icon * 0.44, 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    const tx = x + pad + icon + 8;
    ctx.fillStyle = C.ink;
    ctx.font = kit.sans(Math.max(11, Math.round(bh * 0.25)), 500);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(b.name, tx, y + bh * 0.47, bw - (tx - x) - pad - 14);
    ctx.fillStyle = C.faint;
    rr(tx, y + bh * 0.6, bw * 0.4, 4, 2);
    ctx.fill();
    ctx.fillStyle = C.ink2;
    ctx.font = kit.mono(9);
    ctx.textAlign = 'right';
    ctx.fillText(String(b.k + 1).padStart(2, '0'), x + bw - pad + 2, y + bh * 0.47);
    ctx.textAlign = 'left';
    if (opts.selected) {
      ctx.strokeStyle = C.select;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 3, y - 3, bw + 6, bh + 6);
      ctx.fillStyle = C.white;
      ctx.lineWidth = 1;
      [[x - 3, y - 3], [x + bw + 3, y - 3], [x - 3, y + bh + 3], [x + bw + 3, y + bh + 3]].forEach(([hx, hy]) => { ctx.fillRect(hx - 3, hy - 3, 6, 6); ctx.strokeRect(hx - 3, hy - 3, 6, 6); });
      const dim = `${bw} × ${bh}`;
      ctx.font = kit.mono(9);
      const w = ctx.measureText(dim).width + 10;
      ctx.fillStyle = C.select;
      rr(-w / 2, y + bh + 9, w, 15, 3);
      ctx.fill();
      ctx.fillStyle = C.white;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dim, 0, y + bh + 16.5);
      ctx.textAlign = 'left';
    }
  };
  const draw = (b, x, y, rot, opts = {}) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (opts.sq) { ctx.translate(0, bh / 2); ctx.scale(1 + (1 - opts.sq) * 0.6, opts.sq); ctx.translate(0, -bh / 2); }
    card(b, opts);
    ctx.restore();
  };

  // A Figma ruler as the crane's jib, with the trolley the rope hangs from
  const jib = () => {
    const x0 = Z.x;
    const x1 = Z.x + Z.w;
    ctx.fillStyle = C.line;
    ctx.fillRect(x0, jibY, x1 - x0, 1);
    ctx.font = kit.mono(9);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    for (let x = Math.ceil((x0 - cx) / 10) * 10; x + cx <= x1; x += 10) {
      const major = x % 100 === 0;
      const h = major ? 8 : x % 50 === 0 ? 5 : 3;
      ctx.fillStyle = major ? C.ink2 : C.line;
      ctx.fillRect(cx + x, jibY - h, 1, h);
      if (major && x !== 0) ctx.fillText(String(Math.abs(x)), cx + x + 3, jibY - 4);
    }
    rr(cx - 16, jibY - 4, 32, 9, 4.5);
    ctx.fillStyle = C.ink;
    ctx.fill();
  };

  kit.loop((dt) => {
    if (!blocks) return;
    t += dt / 60;
    amp *= Math.pow(0.9985, dt);
    if (hang) hang.drop = Math.min(1, hang.drop + 0.035 * dt);
    runDemo(dt);
    blocks.forEach((b) => { spring(b, 'sq', 'sqv', 1, 0.3, 0.6, dt); spring(b, 'r', 'rv', 0, 0.2, 0.7, dt); });
    spring(base, 'dip', 'v', 0, 0.25, 0.7, dt);

    // Camera keeps the top of the tower a steady distance below the crane
    const want = jibY + rope + bh * 2.4 + Z.h * 0.12;
    const target = Math.max(-(groundY - Z.y - Z.h * 0.5), want - surface());
    cam += (target - cam) * Math.min(1, 0.05 * dt);

    if (fall) {
      if (fall.mode === 'fall') {
        fall.vy += G * dt;
        fall.x += fall.vx * dt;
        fall.y += fall.vy * dt;
        fall.rot += fall.av * dt;
        fall.av *= Math.pow(0.97, dt);
        fall.rot *= Math.pow(0.975, dt);
        if (fall.vy > 0 && fall.y + bh / 2 >= surface()) land();
        else if (fall.y + cam > H + bh * 2) fall = null;
      } else if (fall.mode === 'tip') {
        // Rotate around the corner of the screen below, then fall away
        fall.tip += dt;
        fall.rot += fall.dir * (0.01 + fall.tip * 0.004) * dt;
        fall.x += fall.dir * (0.4 + fall.tip * 0.05) * dt;
        if (Math.abs(fall.rot) > 0.7) {
          fall.mode = 'gone';
          fall.vx = fall.dir * 2.4;
          fall.vy = 0;
          fall.av = fall.dir * 0.05;
          bugs += 1;
          pill(kit.t('tower_bug'), fall.pivot, surface() - bh * 0.8, C.signal);
          hud();
          if (bugs >= 3) endRun('tower_lose_bugs');
        }
      } else {
        fall.vy += G * dt;
        fall.x += fall.vx * dt;
        fall.y += fall.vy * dt;
        fall.rot += fall.av * dt;
        if (fall.y + cam > H + bh * 2) fall = null;
      }
      if (!fall && !hang && state === 'play') newHang();
    }
    debris.forEach((d) => { d.vy += G * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.av * dt; });
    debris = debris.filter((d) => d.y + cam < H + bh * 3);
    fx.forEach((f) => {
      f.t += dt;
      if (f.kind === 'bit') { f.vy += 0.3 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.r += 0.12 * dt; }
    });
    fx = fx.filter((f) => (f.kind === 'bit' ? f.y < H + 20 : f.t < 60));

    ctx.clearRect(0, 0, W, H);
    kit.dots(ctx, W, H, C, cam);
    jib();

    // The frame the flow stands on
    const gy = groundY + cam + base.dip;
    if (gy < H + 20) {
      ctx.strokeStyle = C.ink2;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      rr(cx - bw * 0.62, gy + 0.5, bw * 1.24, 12, 3);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.ink2;
      ctx.font = kit.mono(9);
      ctx.textBaseline = 'top';
      ctx.fillText('Frame / Booking flow', cx - bw * 0.62, gy + 18);
    }

    // The tower
    const n = blocks.length;
    const danger = amp / (bw * 0.66);
    blocks.forEach((b, i) => {
      const y = groundY - (i + 0.5) * bh + cam + base.dip * ((i + 1) / Math.max(1, n));
      if (y < -bh || y > H + bh) return;
      const slope = (Math.cos(t * 1.4) * amp * 1.5) / Math.max(1, n * bh * 3);
      draw(b, b.x + swayAt(i), y, b.r + slope, { sq: b.sq, lift: i === n - 1 ? 8 : 3, danger: i === n - 1 && danger > 0.7 });
    });

    // Crane rope and the swinging screen
    if (hang && state === 'play') {
      const s = swing();
      const top = { x: cx + s.len * Math.sin(s.theta), y: jibY + s.len * Math.cos(s.theta) };
      ctx.strokeStyle = C.ink2;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, jibY + 4);
      ctx.lineTo(top.x, top.y - 5);
      ctx.stroke();
      ctx.save();
      ctx.translate(top.x, top.y - 3);
      ctx.rotate(-s.theta + Math.PI / 4);
      ctx.fillStyle = C.comp;
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
      draw(hang, s.x, s.y, -s.theta, { selected: true, lift: 18 });
    }
    if (fall) draw(fall, fall.x, fall.y + cam, fall.rot, { lift: 16 });
    debris.forEach((d) => draw(d, d.x, d.y + cam, d.rot, { lift: 6 }));

    // Feedback
    fx.forEach((f) => {
      const k = f.t / 60;
      if (f.kind === 'ring' || f.kind === 'tap') {
        const p = f.t / 36;
        if (p > 1) return;
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = C.comp;
        ctx.lineWidth = 1.5;
        if (f.kind === 'ring') rr(f.x - bw / 2 - p * 18, f.y + cam - bh / 2 - p * 12, bw + p * 36, bh + p * 24, 10 + p * 6);
        else { ctx.beginPath(); ctx.arc(f.x, f.y, 4 + p * 22, 0, Math.PI * 2); }
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.kind === 'pill') {
        ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        ctx.font = kit.mono(10);
        const w = ctx.measureText(f.text).width + 12;
        const y = f.y + cam - easeOut(Math.min(1, k * 2)) * 14;
        ctx.fillStyle = f.color;
        rr(f.x - w / 2, y - 9, w, 18, 4);
        ctx.fill();
        ctx.fillStyle = C.white;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.text, f.x, y + 0.5);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      } else {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.r);
        ctx.fillStyle = f.color;
        ctx.fillRect(-f.s / 2, -f.s / 2, f.s, f.s);
        ctx.restore();
      }
    });
    if (demo) {
      ctx.globalAlpha = demo.phase === 'out' ? Math.max(0, 1 - demo.t / 40) : Math.min(1, demo.t / 20);
      kit.cursor(ctx, demo.x, demo.y, 'Yar', C.comp, demo.press);
      ctx.globalAlpha = 1;
    }
  });
};
