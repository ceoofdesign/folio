// Physics: real UI components fall onto the canvas; drag and throw them. Uses Matter.js for collisions.
(window.HeroGames = window.HeroGames || {}).physics = (stage, kit) => {
  const canvas = stage.querySelector('canvas');
  canvas.setAttribute('aria-label', kit.t('physics_hint'));
  const boot = () => {
    const { Engine, Bodies, Body, Composite, Constraint, Query, Vector } = window.Matter;
    let W = 0;
    let H = 0;
    let C = kit.colors();
    const engine = Engine.create({ gravity: { y: 1 } });
    const world = engine.world;
    const walls = [];
    const items = [];
    let grab = null;
    let touched = false;
    let spawned = false;

    const S = () => (W < 520 ? 0.78 : 1);
    const LIB = [
      { kind: 'button', text: 'Book now', w: 132, h: 44, r: 22, name: 'Button / Primary' },
      { kind: 'chip', text: 'Tokyo', name: 'Chip' },
      { kind: 'toggle', w: 60, h: 32, r: 16, name: 'Toggle / On' },
      { kind: 'input', text: 'From  Lisbon', w: 190, h: 44, r: 8, name: 'Input / Filled' },
      { kind: 'avatar', text: 'YL', rad: 26, name: 'Avatar' },
      { kind: 'chip', text: '4M+ users', name: 'Chip' },
      { kind: 'card', w: 150, h: 104, r: 10, name: 'Card / Hotel' },
      { kind: 'check', w: 34, h: 34, r: 8, name: 'Checkbox' },
      { kind: 'button2', text: 'Search', w: 112, h: 40, r: 8, name: 'Button / Secondary' },
      { kind: 'chip', text: 'Belgrade', name: 'Chip' },
      { kind: 'slider', w: 160, h: 30, r: 15, name: 'Slider' },
      { kind: 'badge', text: 'New', w: 52, h: 26, r: 13, name: 'Badge' },
      { kind: 'chip', text: 'Design system', name: 'Chip' },
      { kind: 'radio', rad: 17, name: 'Radio' },
      { kind: 'chip', text: '2,000+ components', name: 'Chip' },
      { kind: 'price', text: '€ 184', w: 96, h: 40, r: 8, name: 'Price' },
    ];

    const ctx = kit.fit(canvas, (w, h) => {
      W = w; H = h;
      walls.forEach((b) => Composite.remove(world, b));
      walls.length = 0;
      const t = 80;
      walls.push(
        Bodies.rectangle(W / 2, H + t / 2, W * 3, t, { isStatic: true }),
        Bodies.rectangle(-t / 2, H / 2 - H, t, H * 4, { isStatic: true }),
        Bodies.rectangle(W + t / 2, H / 2 - H, t, H * 4, { isStatic: true }),
      );
      Composite.add(world, walls);
      items.forEach((b) => { if (b.position.x > W - 10) Body.setPosition(b, { x: W - 40, y: b.position.y }); });
    });

    const make = (spec, x, y) => {
      const s = S();
      const d = { ...spec };
      let body;
      if (d.kind === 'chip') {
        ctx.font = kit.sans(14 * s, 400);
        d.w = (ctx.measureText(d.text).width + 28 * s) / s;
        d.h = 34;
        d.r = 17;
      }
      const opts = { restitution: 0.3, friction: 0.5, frictionAir: 0.012, density: 0.0018 };
      if (d.rad) body = Bodies.circle(x, y, d.rad * s, opts);
      else body = Bodies.rectangle(x, y, d.w * s, d.h * s, { ...opts, chamfer: { radius: Math.min(d.r * s, (d.h * s) / 2 - 0.5) } });
      body.spec = d;
      Body.setAngle(body, (Math.random() - 0.5) * 0.8);
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.06);
      items.push(body);
      Composite.add(world, body);
      if (items.length > 34) Composite.remove(world, items.shift());
      kit.score(kit.t('physics_score', items.length));
      return body;
    };

    const spawnAll = () => {
      if (spawned) return;
      spawned = true;
      LIB.forEach((spec, k) => {
        const delay = kit.still ? 0 : k * 140;
        setTimeout(() => make(spec, W * (0.15 + Math.random() * 0.7), -60 - (kit.still ? k * 50 : 0)), delay);
      });
    };
    new IntersectionObserver(([e]) => { if (e.isIntersecting) spawnAll(); }, { threshold: 0.3 }).observe(canvas);

    const point = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const p = point(e);
      const hit = Query.point(items, p)[0];
      if (!touched) { touched = true; kit.hint(''); }
      if (!hit) {
        // A click on empty canvas drops a new chip right there
        make(LIB[Math.floor(Math.random() * LIB.length)], p.x, Math.max(20, p.y));
        return;
      }
      const local = Vector.rotate(Vector.sub(p, hit.position), -hit.angle);
      grab = Constraint.create({ pointA: p, bodyB: hit, pointB: local, stiffness: 0.18, damping: 0.08, length: 0 });
      Composite.add(world, grab);
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = point(e);
      if (grab) { grab.pointA = p; return; }
      if (kit.fine) canvas.style.cursor = Query.point(items, p).length ? 'grab' : 'copy';
    });
    const drop = () => { if (grab) { Composite.remove(world, grab); grab = null; canvas.style.cursor = 'grab'; } };
    canvas.addEventListener('pointerup', drop);
    canvas.addEventListener('pointercancel', drop);
    canvas.addEventListener('keydown', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      items.forEach((b) => Body.applyForce(b, b.position, { x: (Math.random() - 0.5) * 0.04 * b.mass, y: -0.06 * b.mass }));
    });
    // A quick scroll gives everything a small jolt
    let lastY = scrollY;
    addEventListener('scroll', () => {
      const d = scrollY - lastY;
      lastY = scrollY;
      if (kit.still || Math.abs(d) < 18) return;
      items.forEach((b) => Body.applyForce(b, b.position, { x: 0, y: -Math.min(0.02, Math.abs(d) * 0.0004) * b.mass }));
    }, { passive: true });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { C = kit.colors(); });
    new MutationObserver(() => { C = kit.colors(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    kit.hint(kit.t('physics_hint'));

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

    kit.loop((dt) => {
      if (!W) return;
      Engine.update(engine, (1000 / 60) * Math.min(dt, 2));
      items.forEach((b) => {
        // Keep throws inside the frame: cap speed, and drop anything that escaped back in from the top
        const v = b.velocity;
        const sp = Math.hypot(v.x, v.y);
        if (sp > 28) Body.setVelocity(b, { x: (v.x / sp) * 28, y: (v.y / sp) * 28 });
        const p = b.position;
        if (p.x < -60 || p.x > W + 60 || p.y > H + 120 || p.y < -H * 1.5) {
          Body.setPosition(b, { x: W * (0.2 + Math.random() * 0.6), y: -60 });
          Body.setVelocity(b, { x: 0, y: 0 });
        }
      });
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = C.line;
      for (let y = 9; y < H; y += 18) for (let x = 9; x < W; x += 18) ctx.fillRect(x, y, 1.2, 1.2);
      items.forEach((b) => {
        ctx.save();
        ctx.translate(b.position.x, b.position.y);
        ctx.rotate(b.angle);
        const { w, h } = drawItem(b);
        if (grab && grab.bodyB === b) {
          // Figma selection around the component being dragged
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
