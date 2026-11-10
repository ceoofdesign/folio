// Physics: real UI components fall into the zone. Stack them so the pile reaches above the fold line
// and stays there for two seconds. Three levels, the fold moves up each time, the clock is running.
(window.HeroGames = window.HeroGames || {}).physics = (kit) => {
  const boot = () => {
    const { Engine, Bodies, Body, Composite, Constraint, Query, Vector } = window.Matter;
    const FOLD = [0.34, 0.48, 0.6];       // height of the fold above the floor, share of the zone
    const TIME = 45;                       // seconds per level
    const HOLD = 2;                        // seconds the pile has to stay above the fold
    let W = 0;
    let H = 0;
    let Z;
    let C = kit.colors();
    const engine = Engine.create({ gravity: { y: 1 } });
    const world = engine.world;
    const walls = [];
    let items = [];
    let grab = null;
    let touched = false;
    let level;
    let clock;
    let hold;
    let state;
    let started;
    let total;
    let pending = [];

    const S = () => (W < 900 ? 0.8 : 1);
    const LIB = [
      { kind: 'button', text: 'Book now', w: 132, h: 44, r: 22, name: 'Button / Primary' },
      { kind: 'card', w: 150, h: 104, r: 10, name: 'Card / Hotel' },
      { kind: 'input', w: 190, h: 44, r: 8, name: 'Input / Filled' },
      { kind: 'chip', text: 'Tokyo', name: 'Chip' },
      { kind: 'toggle', w: 60, h: 32, r: 16, name: 'Toggle / On' },
      { kind: 'avatar', text: 'YL', rad: 26, name: 'Avatar' },
      { kind: 'chip', text: '4M+ users', name: 'Chip' },
      { kind: 'button2', text: 'Search', w: 112, h: 40, r: 8, name: 'Button / Secondary' },
      { kind: 'price', text: '€ 184', w: 96, h: 40, r: 8, name: 'Price' },
      { kind: 'check', w: 34, h: 34, r: 8, name: 'Checkbox' },
      { kind: 'chip', text: 'Belgrade', name: 'Chip' },
      { kind: 'slider', w: 160, h: 30, r: 15, name: 'Slider' },
      { kind: 'badge', text: 'New', w: 52, h: 26, r: 13, name: 'Badge' },
      { kind: 'chip', text: 'Design system', name: 'Chip' },
      { kind: 'radio', rad: 17, name: 'Radio' },
      { kind: 'chip', text: '2,000+ components', name: 'Chip' },
    ];
    const floor = () => Z.y + Z.h - 16;
    const foldY = () => floor() - Z.h * FOLD[Math.min(level, FOLD.length - 1)];

    const ctx = kit.fit((w, h) => {
      W = w; H = h;
      Z = kit.zone();
      walls.forEach((b) => Composite.remove(world, b));
      walls.length = 0;
      const t = 80;
      walls.push(
        Bodies.rectangle(Z.x + Z.w / 2, floor() + t / 2, Z.w + t * 2, t, { isStatic: true, friction: 0.8 }),
        Bodies.rectangle(Z.x - t / 2, floor() - Z.h * 2, t, Z.h * 5, { isStatic: true }),
        Bodies.rectangle(Z.x + Z.w + t / 2, floor() - Z.h * 2, t, Z.h * 5, { isStatic: true }),
      );
      Composite.add(world, walls);
    });

    const make = (spec, x, y) => {
      const s = S();
      const d = { ...spec };
      if (d.kind === 'chip') {
        ctx.font = kit.sans(14 * s, 400);
        d.w = (ctx.measureText(d.text).width + 28 * s) / s;
        d.h = 34;
        d.r = 17;
      }
      const opts = { restitution: 0.15, friction: 0.7, frictionStatic: 0.9, frictionAir: 0.015, density: 0.0018 };
      const body = d.rad
        ? Bodies.circle(x, y, d.rad * s, opts)
        : Bodies.rectangle(x, y, d.w * s, d.h * s, { ...opts, chamfer: { radius: Math.min(d.r * s, (d.h * s) / 2 - 0.5) } });
      body.spec = d;
      Body.setAngle(body, (Math.random() - 0.5) * 0.6);
      items.push(body);
      Composite.add(world, body);
    };
    const pour = (specs) => {
      specs.forEach((spec, k) => {
        pending.push(setTimeout(() => make(spec, Z.x + Z.w * (0.15 + Math.random() * 0.7), Z.y - 60 - (kit.still ? k * 40 : 0)), kit.still ? 0 : k * 120));
      });
    };

    const hud = () => {
      if (state === 'over') return;
      const left = Math.max(0, Math.ceil(clock));
      kit.hud(kit.t('physics_goal', level + 1), started ? kit.t('physics_time', left) : kit.t('physics_hint'));
    };
    const reset = () => {
      pending.forEach(clearTimeout);
      pending = [];
      items.forEach((b) => Composite.remove(world, b));
      items = [];
      level = 0;
      clock = TIME;
      hold = 0;
      total = 0;
      state = 'play';
      started = false;
      kit.banner(null);
      pour(LIB.slice(0, 10));
      hud();
    };

    let seen = false;
    new IntersectionObserver(([e]) => { if (e.isIntersecting && !seen) { seen = true; reset(); } }, { threshold: 0.3 }).observe(kit.canvas);

    kit.canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !items.length) return;
      const p = kit.point(e);
      if (state === 'over') { if (kit.inZone(p)) reset(); return; }
      const hit = Query.point(items, p)[0];
      if (!hit) return;
      if (!touched) touched = true;
      started = true;
      const local = Vector.rotate(Vector.sub(p, hit.position), -hit.angle);
      grab = Constraint.create({ pointA: p, bodyB: hit, pointB: local, stiffness: 0.2, damping: 0.1, length: 0 });
      Composite.add(world, grab);
      kit.canvas.setPointerCapture(e.pointerId);
      kit.canvas.style.cursor = 'grabbing';
    });
    kit.canvas.addEventListener('pointermove', (e) => {
      const p = kit.point(e);
      if (grab) { grab.pointA = p; return; }
      if (kit.fine) kit.canvas.style.cursor = Query.point(items, p).length ? 'grab' : 'default';
    });
    const drop = () => {
      if (!grab) return;
      const b = grab.bodyB;
      // Let go gently, so a component lands where it was placed instead of flying off
      Body.setVelocity(b, { x: b.velocity.x * 0.35, y: b.velocity.y * 0.35 });
      Body.setAngularVelocity(b, b.angularVelocity * 0.3);
      Composite.remove(world, grab);
      grab = null;
      kit.canvas.style.cursor = 'grab';
    };
    kit.canvas.addEventListener('pointerup', drop);
    kit.canvas.addEventListener('pointercancel', drop);
    kit.canvas.addEventListener('keydown', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (state === 'over') { reset(); return; }
      items.forEach((b) => Body.applyForce(b, b.position, { x: (Math.random() - 0.5) * 0.03 * b.mass, y: -0.05 * b.mass }));
    });
    kit.onTheme(() => { C = kit.colors(); });

    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
    const drawItem = (b) => {
      const d = b.spec;
      const s = S();
      const w = (d.w || d.rad * 2) * s;
      const h = (d.h || d.rad * 2) * s;
      const r = (d.r || d.rad) * s;
      const x = -w / 2;
      const y = -h / 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = (text, color, size = 14, weight = 400) => { ctx.fillStyle = color; ctx.font = kit.sans(size * s, weight); ctx.fillText(text, 0, 0.5); };
      switch (d.kind) {
        case 'button': rr(x, y, w, h, r); ctx.fillStyle = C.signal; ctx.fill(); label(d.text, C.white, 14, 500); break;
        case 'button2': rr(x, y, w, h, r); ctx.fillStyle = C.ink; ctx.fill(); label(d.text, C.paper, 14, 500); break;
        case 'chip': rr(x, y, w, h, r); ctx.fillStyle = C.paper; ctx.fill(); ctx.strokeStyle = C.ink2; ctx.lineWidth = 1; ctx.stroke(); label(d.text, C.ink); break;
        case 'badge': rr(x, y, w, h, r); ctx.fillStyle = C.comp; ctx.fill(); label(d.text, C.white, 12, 500); break;
        case 'toggle': rr(x, y, w, h, r); ctx.fillStyle = C.select; ctx.fill(); ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(w / 2 - r, 0, r - 4 * s, 0, 7); ctx.fill(); break;
        case 'check': rr(x, y, w, h, r); ctx.fillStyle = C.ink; ctx.fill(); ctx.strokeStyle = C.paper; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.moveTo(-7 * s, 0); ctx.lineTo(-2 * s, 5 * s); ctx.lineTo(8 * s, -6 * s); ctx.stroke(); break;
        case 'radio': ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fillStyle = C.paper; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, 7); ctx.fillStyle = C.ink; ctx.fill(); break;
        case 'avatar': ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fillStyle = C.comp; ctx.fill(); label(d.text, C.white, 15, 500); break;
        case 'input':
          rr(x, y, w, h, r); ctx.fillStyle = C.paper; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
          ctx.textAlign = 'left'; ctx.fillStyle = C.ink2; ctx.font = kit.mono(10 * s); ctx.fillText('FROM', x + 12 * s, -7 * s);
          ctx.fillStyle = C.ink; ctx.font = kit.sans(14 * s); ctx.fillText('Lisbon', x + 12 * s, 7 * s); break;
        case 'card':
          rr(x, y, w, h, r); ctx.fillStyle = C.paper; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
          rr(x + 8 * s, y + 8 * s, w - 16 * s, h * 0.5, 6 * s); ctx.fillStyle = C.select; ctx.fill();
          ctx.fillStyle = C.ink; ctx.fillRect(x + 8 * s, y + h * 0.66, w * 0.55, 6 * s);
          ctx.fillStyle = C.line; ctx.fillRect(x + 8 * s, y + h * 0.8, w * 0.35, 6 * s);
          ctx.fillStyle = C.signal; ctx.fillRect(x + w - 34 * s, y + h * 0.78, 26 * s, 9 * s); break;
        case 'slider':
          rr(x, -3 * s, w, 6 * s, 3 * s); ctx.fillStyle = C.line; ctx.fill();
          rr(x, -3 * s, w * 0.6, 6 * s, 3 * s); ctx.fillStyle = C.select; ctx.fill();
          ctx.beginPath(); ctx.arc(x + w * 0.6, 0, 10 * s, 0, 7); ctx.fillStyle = C.white; ctx.fill(); ctx.strokeStyle = C.select; ctx.lineWidth = 2; ctx.stroke(); break;
        case 'price': rr(x, y, w, h, r); ctx.fillStyle = C.paper; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.stroke(); label(d.text, C.ink, 15, 500); break;
        default: break;
      }
      return { w, h };
    };

    let lastHud = -1;
    kit.loop((dt) => {
      if (!W || level === undefined) return;
      Engine.update(engine, (1000 / 60) * Math.min(dt, 2));
      items.forEach((b) => {
        const v = b.velocity;
        const sp = Math.hypot(v.x, v.y);
        if (sp > 24) Body.setVelocity(b, { x: (v.x / sp) * 24, y: (v.y / sp) * 24 });
        const p = b.position;
        if (p.x < Z.x - 80 || p.x > Z.x + Z.w + 80 || p.y > floor() + 120 || p.y < Z.y - Z.h * 1.5) {
          Body.setPosition(b, { x: Z.x + Z.w * (0.2 + Math.random() * 0.6), y: Z.y - 60 });
          Body.setVelocity(b, { x: 0, y: 0 });
        }
      });

      // Goal: the highest resting component is above the fold, nothing in hand
      let top = Infinity;
      items.forEach((b) => {
        if (grab && grab.bodyB === b) return;
        if (Math.hypot(b.velocity.x, b.velocity.y) > 0.5 || Math.abs(b.angularVelocity) > 0.05) return;
        top = Math.min(top, b.bounds.min.y);
      });
      if (state === 'play' && started) {
        clock -= dt / 60;
        total += dt / 60;
        if (!grab && top < foldY()) hold += dt / 60; else hold = 0;
        if (hold >= HOLD) {
          hold = 0;
          level += 1;
          if (level >= FOLD.length) {
            state = 'over';
            kit.banner(kit.t('physics_win'), `${kit.t('physics_win_sub', Math.round(total))} · ${kit.t('physics_result')}`);
          } else {
            clock = TIME;
            kit.banner(kit.t('physics_level'), kit.t('physics_level_sub', level));
            setTimeout(() => { if (state === 'play') kit.banner(null); }, 1800);
            pour(LIB.slice(10 + (level - 1) * 3, 13 + (level - 1) * 3));
          }
        } else if (clock <= 0) {
          state = 'over';
          kit.banner(kit.t('physics_lose'), kit.t('physics_result'));
        }
      }
      const sec = Math.ceil(clock);
      if (sec !== lastHud) { lastHud = sec; hud(); }

      ctx.clearRect(0, 0, W, H);
      kit.dots(ctx, W, H, C);

      // The fold line
      const fy = foldY();
      ctx.strokeStyle = C.signal;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(Z.x, fy);
      ctx.lineTo(Z.x + Z.w, fy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = kit.mono(10);
      ctx.fillStyle = C.signal;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(kit.t('physics_fold'), Z.x, fy - 4);
      if (hold > 0) {
        ctx.textAlign = 'right';
        ctx.fillText(kit.t('physics_hold', (HOLD - hold).toFixed(1)), Z.x + Z.w, fy - 4);
        ctx.fillRect(Z.x, fy - 1, Z.w * (hold / HOLD), 2);
      }
      // Floor of the frame
      ctx.fillStyle = C.line;
      ctx.fillRect(Z.x, floor(), Z.w, 1);

      items.forEach((b) => {
        ctx.save();
        ctx.translate(b.position.x, b.position.y);
        ctx.rotate(b.angle);
        const { w, h } = drawItem(b);
        if (grab && grab.bodyB === b) {
          ctx.strokeStyle = C.select;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
          ctx.fillStyle = C.white;
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
            const hx = sx * (w / 2 + 3);
            const hy = sy * (h / 2 + 3);
            ctx.fillRect(hx - 3, hy - 3, 6, 6);
            ctx.strokeRect(hx - 3, hy - 3, 6, 6);
          });
          ctx.fillStyle = C.select;
          ctx.font = kit.mono(10);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(b.spec.name, -w / 2 - 3, -h / 2 - 9);
        }
        ctx.restore();
      });
    });
  };

  if (window.Matter) boot();
  else {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js';
    s.onload = boot;
    document.head.append(s);
  }
};
