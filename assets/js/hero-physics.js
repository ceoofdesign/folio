// Physics: UI components fall into a Figma frame. Stack them as high as you can; a ruler beside
// the frame measures the stack in pixels and keeps the best height. Yar's cursor shows the first drag.
(window.HeroGames = window.HeroGames || {}).physics = (kit) => {
  const boot = () => {
    const { Engine, Bodies, Body, Composite, Constraint, Query, Vector, Sleeping } = window.Matter;
    let W = 0;
    let H = 0;
    let Z;
    let F;
    let C = kit.colors();
    const engine = Engine.create({ enableSleeping: true, positionIterations: 12, velocityIterations: 10, constraintIterations: 4 });
    const world = engine.world;
    const walls = [];
    let items = [];
    let grab = null;
    let touched = false;
    let demo = null;
    let height = 0;
    let shown = 0;
    let stableFor = 0;
    let best = Number(kit.load('physicsBest')) || 0;
    let fx = [];
    let lastHud = '';

    const S = () => Math.max(0.56, Math.min(1, F.w / 620));
    const LIB = [
      { kind: 'card', w: 150, h: 104, r: 10, name: 'Card / Hotel' },
      { kind: 'input', w: 190, h: 44, r: 8, name: 'Input / Filled' },
      { kind: 'button', text: 'Book now', w: 132, h: 44, r: 22, name: 'Button / Primary' },
      { kind: 'price', text: '€ 184', w: 96, h: 40, r: 8, name: 'Price' },
      { kind: 'button2', text: 'Search', w: 112, h: 40, r: 8, name: 'Button / Secondary' },
      { kind: 'chip', text: 'Tokyo', name: 'Chip' },
      { kind: 'toggle', w: 60, h: 32, r: 16, name: 'Toggle / On' },
      { kind: 'chip', text: '4M+ users', name: 'Chip' },
      { kind: 'avatar', text: 'YL', rad: 26, name: 'Avatar' },
      { kind: 'check', w: 34, h: 34, r: 8, name: 'Checkbox' },
      { kind: 'chip', text: 'Belgrade', name: 'Chip' },
      { kind: 'slider', w: 150, h: 30, r: 15, name: 'Slider' },
      { kind: 'badge', text: 'New', w: 52, h: 26, r: 13, name: 'Badge' },
      { kind: 'chip', text: 'Design system', name: 'Chip' },
    ];
    const floorY = () => F.y + F.h;

    const ctx = kit.fit((w, h) => {
      W = w; H = h;
      Z = kit.zone();
      const ruler = 34;
      F = { x: Z.x + ruler, y: Z.y + 34, w: Z.w - ruler, h: Z.h - 34 - 48 };
      walls.forEach((b) => Composite.remove(world, b));
      walls.length = 0;
      const t = 200;
      const opts = { isStatic: true, friction: 1, restitution: 0 };
      walls.push(
        Bodies.rectangle(F.x + F.w / 2, floorY() + t / 2, F.w + t * 2, t, opts),
        Bodies.rectangle(F.x - t / 2, F.y + F.h / 2 - F.h, t, F.h * 3, opts),
        Bodies.rectangle(F.x + F.w + t / 2, F.y + F.h / 2 - F.h, t, F.h * 3, opts),
      );
      Composite.add(world, walls);
      items.forEach((b) => { Sleeping.set(b, false); if (b.position.x > F.x + F.w - 20) Body.setPosition(b, { x: F.x + F.w - 60, y: b.position.y }); });
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
      const opts = { restitution: 0.02, friction: 0.9, frictionStatic: 1, frictionAir: 0.02, slop: 0.02, density: 0.0016, sleepThreshold: 40 };
      const body = d.rad
        ? Bodies.circle(x, y, d.rad * s, opts)
        : Bodies.rectangle(x, y, d.w * s, d.h * s, { ...opts, chamfer: { radius: Math.min(d.r * s, (d.h * s) / 2 - 0.5) } });
      body.spec = d;
      Body.setAngle(body, (Math.random() - 0.5) * 0.4);
      items.push(body);
      Composite.add(world, body);
    };
    let seen = false;
    const pour = () => {
      LIB.forEach((spec, k) => setTimeout(() => make(spec, F.x + F.w * (0.2 + Math.random() * 0.6), F.y - 40 - (kit.still ? k * 30 : 0)), kit.still ? 0 : 160 + k * 110));
    };
    new IntersectionObserver(([e]) => { if (e.isIntersecting && !seen) { seen = true; pour(); } }, { threshold: 0.3 }).observe(kit.canvas);

    const take = (body, p) => {
      Sleeping.set(body, false);
      const local = Vector.rotate(Vector.sub(p, body.position), -body.angle);
      grab = Constraint.create({ pointA: { ...p }, bodyB: body, pointB: local, stiffness: 0.07, damping: 0.3, length: 0 });
      Composite.add(world, grab);
    };
    const letGo = () => {
      if (!grab) return;
      const b = grab.bodyB;
      Body.setVelocity(b, { x: b.velocity.x * 0.4, y: b.velocity.y * 0.4 });
      Body.setAngularVelocity(b, b.angularVelocity * 0.3);
      Composite.remove(world, grab);
      grab = null;
    };

    kit.canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const p = kit.point(e);
      const hit = Query.point(items, p)[0];
      if (!hit) return;
      demo = null;
      touched = true;
      if (grab) letGo();
      take(hit, p);
      kit.canvas.setPointerCapture(e.pointerId);
      kit.canvas.style.cursor = 'grabbing';
    });
    kit.canvas.addEventListener('pointermove', (e) => {
      const p = kit.point(e);
      if (grab && !demo) { grab.pointA = p; return; }
      if (kit.fine && !grab) kit.canvas.style.cursor = Query.point(items, p).length ? 'grab' : 'default';
    });
    const up = () => { if (!demo) { letGo(); kit.canvas.style.cursor = 'grab'; } };
    kit.canvas.addEventListener('pointerup', up);
    kit.canvas.addEventListener('pointercancel', up);
    kit.onTheme(() => { C = kit.colors(); });

    // Yar's cursor picks up the card and puts it on the pile, once
    setTimeout(() => {
      if (touched || kit.still || !items.length) return;
      const body = items.find((b) => b.spec.kind === 'card') || items[0];
      demo = { phase: 'in', t: 0, x: F.x + F.w * 0.95, y: F.y + F.h * 0.2, press: 0, body };
    }, 3600);
    const runDemo = (dt) => {
      if (!demo) return;
      demo.t += dt;
      const b = demo.body;
      if (demo.phase === 'in') {
        demo.x += (b.position.x - demo.x) * 0.08 * dt;
        demo.y += (b.position.y - demo.y) * 0.08 * dt;
        if (Math.hypot(b.position.x - demo.x, b.position.y - demo.y) < 3 && demo.t > 40) {
          demo.phase = 'carry'; demo.t = 0; demo.press = 1;
          take(b, { x: demo.x, y: demo.y });
          const top = items.reduce((m, o) => (o === b ? m : Math.min(m, o.bounds.min.y)), floorY());
          demo.to = { x: F.x + F.w * 0.5, y: top - 70 };
        }
      } else if (demo.phase === 'carry') {
        demo.x += (demo.to.x - demo.x) * 0.05 * dt;
        demo.y += (demo.to.y - demo.y) * 0.05 * dt;
        if (grab) grab.pointA = { x: demo.x, y: demo.y };
        if (demo.t > 80) { letGo(); demo.phase = 'out'; demo.t = 0; demo.press = 0; }
      } else {
        demo.x += 3 * dt;
        demo.y -= 1 * dt;
        if (demo.t > 50) demo = null;
      }
    };

    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
    const shape = (d, s) => {
      const w = (d.w || d.rad * 2) * s;
      const h = (d.h || d.rad * 2) * s;
      const r = (d.r || d.rad) * s;
      if (d.rad) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); } else rr(-w / 2, -h / 2, w, h, r);
      return { w, h, r };
    };
    const drawItem = (b, lifted) => {
      const d = b.spec;
      const s = S();
      ctx.save();
      ctx.shadowColor = C.shadow;
      ctx.shadowBlur = lifted ? 22 : 6;
      ctx.shadowOffsetY = lifted ? 10 : 2;
      const { w, h, r } = shape(d, s);
      const fill = { button: C.signal, button2: C.ink, badge: C.comp, toggle: C.select, check: C.ink, avatar: C.comp }[d.kind] || C.card;
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
      if (fill === C.card) { shape(d, s); ctx.strokeStyle = C.edge; ctx.lineWidth = 1; ctx.stroke(); }
      const x = -w / 2;
      const y = -h / 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = (text, color, size = 14, weight = 400) => { ctx.fillStyle = color; ctx.font = kit.sans(size * s, weight); ctx.fillText(text, 0, 0.5); };
      switch (d.kind) {
        case 'button': label(d.text, C.white, 14, 500); break;
        case 'button2': label(d.text, C.paper, 14, 500); break;
        case 'chip': label(d.text, C.ink); break;
        case 'badge': label(d.text, C.white, 12, 500); break;
        case 'avatar': label(d.text, C.white, 15, 500); break;
        case 'price': label(d.text, C.ink, 15, 500); break;
        case 'toggle': ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(w / 2 - r, 0, r - 4 * s, 0, Math.PI * 2); ctx.fill(); break;
        case 'check': ctx.strokeStyle = C.paper; ctx.lineWidth = 2.5 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-7 * s, 0); ctx.lineTo(-2 * s, 5 * s); ctx.lineTo(8 * s, -6 * s); ctx.stroke(); break;
        case 'input':
          ctx.textAlign = 'left';
          ctx.fillStyle = C.ink2; ctx.font = kit.mono(9 * s); ctx.fillText('FROM', x + 12 * s, -7 * s);
          ctx.fillStyle = C.ink; ctx.font = kit.sans(14 * s); ctx.fillText('Lisbon', x + 12 * s, 8 * s); break;
        case 'card':
          rr(x + 8 * s, y + 8 * s, w - 16 * s, h * 0.5, 6 * s); ctx.fillStyle = C.select; ctx.fill();
          ctx.fillStyle = C.ink; rr(x + 8 * s, y + h * 0.66, w * 0.5, 6 * s, 3 * s); ctx.fill();
          ctx.fillStyle = C.faint; rr(x + 8 * s, y + h * 0.8, w * 0.34, 6 * s, 3 * s); ctx.fill();
          ctx.fillStyle = C.signal; rr(x + w - 36 * s, y + h * 0.77, 28 * s, 11 * s, 3 * s); ctx.fill(); break;
        case 'slider':
          ctx.fillStyle = C.faint; rr(x + 12 * s, -2 * s, w - 24 * s, 4 * s, 2 * s); ctx.fill();
          ctx.fillStyle = C.select; rr(x + 12 * s, -2 * s, (w - 24 * s) * 0.6, 4 * s, 2 * s); ctx.fill();
          ctx.beginPath(); ctx.arc(x + 12 * s + (w - 24 * s) * 0.6, 0, 8 * s, 0, Math.PI * 2); ctx.fillStyle = C.white; ctx.fill(); ctx.strokeStyle = C.select; ctx.lineWidth = 2; ctx.stroke(); break;
        default: break;
      }
      ctx.textAlign = 'left';
      return { w, h };
    };

    const selection = (b, w, h) => {
      ctx.strokeStyle = C.select;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
      ctx.fillStyle = C.white;
      ctx.lineWidth = 1;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
        const hx = sx * (w / 2 + 4);
        const hy = sy * (h / 2 + 4);
        ctx.fillRect(hx - 3, hy - 3, 6, 6);
        ctx.strokeRect(hx - 3, hy - 3, 6, 6);
      });
      ctx.fillStyle = C.select;
      ctx.font = kit.mono(9);
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(b.spec.name, -w / 2 - 4, -h / 2 - 10);
    };

    kit.loop((dt) => {
      if (!W) return;
      runDemo(dt);
      const steps = 2;
      for (let s = 0; s < steps; s += 1) Engine.update(engine, (1000 / 60 / steps) * Math.min(dt, 2));
      items.forEach((b) => {
        if (grab && grab.bodyB === b) Body.setAngularVelocity(b, b.angularVelocity * 0.85);
        const v = b.velocity;
        const sp = Math.hypot(v.x, v.y);
        if (sp > 16) Body.setVelocity(b, { x: (v.x / sp) * 16, y: (v.y / sp) * 16 });
        if (b.position.y > floorY() + 80 || b.position.y < F.y - F.h || b.position.x < F.x - 40 || b.position.x > F.x + F.w + 40) {
          Body.setPosition(b, { x: F.x + F.w * (0.3 + Math.random() * 0.4), y: F.y - 30 });
          Body.setVelocity(b, { x: 0, y: 0 });
        }
      });

      // Height of the stack: the highest component that is at rest and not in hand
      let top = floorY();
      items.forEach((b) => {
        if (grab && grab.bodyB === b) return;
        const still = b.isSleeping || (Math.hypot(b.velocity.x, b.velocity.y) < 0.2 && Math.abs(b.angularVelocity) < 0.01);
        if (still && b.bounds.min.y > F.y - 20) top = Math.min(top, b.bounds.min.y);
      });
      const h = Math.max(0, Math.round(floorY() - top));
      if (Math.abs(h - height) > 1) { height = h; stableFor = 0; } else stableFor += dt;
      shown += (height - shown) * Math.min(1, 0.12 * dt);
      if (touched && stableFor > 40 && height > best + 2 && !grab) {
        best = height;
        kit.save('physicsBest', best);
        fx.push({ kind: 'best', t: 0, y: floorY() - best });
      }
      const line = kit.t('physics_height', Math.round(shown), best);
      if (line !== lastHud) { lastHud = line; kit.hud(kit.t('physics_goal'), line, 'bottom'); }
      fx.forEach((f) => { f.t += dt; });
      fx = fx.filter((f) => f.t < 70);

      ctx.clearRect(0, 0, W, H);
      kit.dots(ctx, W, H, C);

      // The frame
      ctx.save();
      ctx.shadowColor = C.shadow;
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 10;
      rr(F.x, F.y, F.w, F.h, 12);
      ctx.fillStyle = C.dark ? '#17191b' : '#f7f8f5';
      ctx.fill();
      ctx.restore();
      rr(F.x + 0.5, F.y + 0.5, F.w - 1, F.h - 1, 11.5);
      ctx.strokeStyle = C.edge;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = kit.mono(9);
      ctx.fillStyle = C.ink2;
      ctx.textBaseline = 'bottom';
      ctx.fillText('Frame / Components', F.x, F.y - 6);

      // Ruler: pixels from the floor of the frame
      const rx = F.x - 8;
      ctx.fillStyle = C.line;
      ctx.fillRect(rx, F.y + 8, 1, F.h - 8);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let v = 0; v <= F.h - 16; v += 20) {
        const y = floorY() - v;
        const major = v % 100 === 0;
        ctx.fillStyle = major ? C.ink2 : C.line;
        ctx.fillRect(rx - (major ? 8 : 4), y, major ? 8 : 4, 1);
        if (major && v > 0) ctx.fillText(String(v), rx - 11, y);
      }
      // Best height and the current height
      if (best > 0) {
        const by = floorY() - best;
        ctx.fillStyle = C.comp;
        ctx.fillRect(rx - 10, by, 10, 1.5);
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = C.comp;
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(F.x + 6, by); ctx.lineTo(F.x + F.w - 6, by); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      }
      if (shown > 4) {
        const hy = floorY() - shown;
        ctx.strokeStyle = C.select;
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(F.x + 6, hy); ctx.lineTo(F.x + F.w - 6, hy); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = kit.mono(9);
        const label = String(Math.round(shown));
        const w = ctx.measureText(label).width + 8;
        ctx.fillStyle = C.select;
        rr(rx - w - 2, hy - 8, w, 16, 3);
        ctx.fill();
        ctx.fillStyle = C.white;
        ctx.textAlign = 'center';
        ctx.fillText(label, rx - 2 - w / 2, hy + 0.5);
      }
      ctx.textAlign = 'left';

      // Components: clip to the frame so nothing draws over the frame edge
      ctx.save();
      rr(F.x, F.y - F.h, F.w, F.h * 2, 12);
      ctx.clip();
      items.forEach((b) => {
        if (grab && grab.bodyB === b) return;
        ctx.save();
        ctx.translate(b.position.x, b.position.y);
        ctx.rotate(b.angle);
        drawItem(b, false);
        ctx.restore();
      });
      ctx.restore();
      if (grab) {
        const b = grab.bodyB;
        ctx.save();
        ctx.translate(b.position.x, b.position.y);
        ctx.rotate(b.angle);
        const { w, h: bh } = drawItem(b, true);
        selection(b, w, bh);
        ctx.restore();
      }
      fx.forEach((f) => {
        const k = f.t / 70;
        ctx.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
        ctx.font = kit.mono(10);
        const text = kit.t('physics_best');
        const w = ctx.measureText(text).width + 12;
        const y = f.y - 14 - Math.min(10, f.t * 0.4);
        ctx.fillStyle = C.comp;
        rr(F.x + F.w / 2 - w / 2, y - 9, w, 18, 4);
        ctx.fill();
        ctx.fillStyle = C.white;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, F.x + F.w / 2, y + 0.5);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      });
      if (demo) {
        ctx.globalAlpha = demo.phase === 'out' ? Math.max(0, 1 - demo.t / 40) : Math.min(1, demo.t / 20);
        kit.cursor(ctx, demo.x, demo.y, 'Yar', C.comp, demo.press ? 1 : 0);
        ctx.globalAlpha = 1;
      }
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
