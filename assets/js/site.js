// Every effect here is an enhancement: without JavaScript the site still reads as plain pages.
(() => {
  const root = document.documentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => [...el.querySelectorAll(q)];

  /* Local time in the header */
  const clock = $('[data-clock]');
  if (clock) {
    const city = clock.textContent.trim();
    const format = new Intl.DateTimeFormat(clock.dataset.lang === 'ja' ? 'ja-JP' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: clock.dataset.tz });
    const tick = () => { clock.textContent = `${city} ${format.format(new Date())}`; };
    tick();
    setInterval(tick, 20000);
  }

  /* Colour theme, switched without every colour transition firing at once */
  const themeButton = $('[data-theme-toggle]');
  if (themeButton) {
    themeButton.addEventListener('click', () => {
      const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      const next = dark ? 'light' : 'dark';
      root.classList.add('no-trans');
      root.dataset.theme = next;
      void root.offsetWidth;
      requestAnimationFrame(() => root.classList.remove('no-trans'));
      try { localStorage.setItem('theme', next); } catch (e) { /* the choice just won't persist */ }
    });
  }

  /* Copy the email address */
  $$('[data-copy]').forEach((button) => {
    const label = button.textContent;
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        button.textContent = button.dataset.copied || 'Copied';
      } catch (e) {
        button.textContent = button.dataset.copy;
      }
      setTimeout(() => { button.textContent = label; }, 1800);
    });
  });

  /* 3D ring of product screens: spins slowly, follows drag and scroll, a click opens the case */
  const hero = $('.hero[data-hero]');
  const variants = ['ring', 'tower', 'city', 'physics'];
  let variant = hero ? hero.dataset.hero : 'ring';
  try {
    const asked = new URLSearchParams(location.search).get('hero');
    if (variants.includes(asked)) { variant = asked; localStorage.setItem('hero', asked); }
    else if ($('.picker') && variants.includes(localStorage.getItem('hero'))) variant = localStorage.getItem('hero');
  } catch (e) { /* storage blocked: use the configured variant */ }
  $$('[data-pick]').forEach((a) => a.setAttribute('aria-current', a.dataset.pick === variant ? 'true' : 'false'));

  /* Games in the hero. The whole first screen becomes a Figma-like canvas; the game plays
     in a zone beside the text (or below it on phones), so the headline stays readable. */
  const stage = $('[data-stage]');
  if (hero && stage && variant !== 'ring') {
    hero.classList.add('hero--game', `hero--${variant}`);
    stage.hidden = false;
    const ringEl = $('[data-orbit]');
    if (ringEl) ringEl.hidden = true;
    let strings = {};
    try { strings = JSON.parse(stage.dataset.strings || '{}'); } catch (e) { /* fall back to keys */ }
    const touch = matchMedia('(hover: none)').matches;
    const canvas = $('canvas', stage);
    const text = $('.hero__text', hero);
    const hud = { goal: $('[data-hud-goal]', stage), meta: $('[data-hud-meta]', stage), box: $('.stage__hud', stage) };
    const banner = { box: $('.stage__banner', stage), title: $('[data-banner-title]', stage), sub: $('[data-banner-sub]', stage) };
    let zone = { x: 0, y: 0, w: 0, h: 0 };
    let hudPos = 'top';
    const placeHud = () => {
      const y = hudPos === 'bottom' ? zone.y + zone.h - 30 : zone.y + 16;
      hud.box.style.cssText = `left:${zone.x}px; top:${y}px; width:${zone.w}px`;
    };
    const kit = {
      still,
      fine,
      touch,
      canvas,
      t: (key, n, m) => {
        const k = touch && strings[`${key}_touch`] ? `${key}_touch` : key;
        return (strings[k] || key).replace('{n}', n).replace('{m}', m);
      },
      colors: () => {
        const cs = getComputedStyle(root);
        const v = (name) => cs.getPropertyValue(name).trim();
        const hex = v('--paper').replace('#', '');
        const dark = hex.length === 6 && parseInt(hex.slice(0, 2), 16) < 90;
        return {
          dark,
          paper: v('--paper'), plate: v('--plate'), ink: v('--ink'), ink2: v('--ink-2'), line: v('--line'), signal: v('--signal'),
          select: '#0d99ff', comp: '#9747ff', white: '#ffffff',
          card: dark ? '#1d1f22' : '#ffffff',
          edge: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)',
          shadow: dark ? 'rgba(0,0,0,.55)' : 'rgba(20,22,26,.16)',
          faint: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)',
        };
      },
      // A multiplayer cursor, as in a shared Figma file. Used once per game to show the first move.
      cursor: (ctx, x, y, label, color, press = 0) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1 - press * 0.12, 1 - press * 0.12);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, 17); ctx.lineTo(4.6, 12.6); ctx.lineTo(7.8, 19.4); ctx.lineTo(10.6, 18.1); ctx.lineTo(7.5, 11.5); ctx.lineTo(13.4, 11.5);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.font = '500 11px Geologica, system-ui, sans-serif';
        const w = ctx.measureText(label).width + 12;
        ctx.beginPath();
        ctx.roundRect(12, 19, w, 19, [2, 6, 6, 6]);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(label, 18, 29);
        ctx.restore();
      },
      load: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
      save: (k, val) => { try { localStorage.setItem(k, val); } catch (e) { /* not saved */ } },
      mono: (px) => `400 ${px}px "IBM Plex Mono", "IBM Plex Sans JP", ui-monospace, monospace`,
      sans: (px, w = 400) => `${w} ${px}px Geologica, "IBM Plex Sans JP", system-ui, sans-serif`,
      zone: () => zone,
      hud: (goal, meta, pos) => {
        hud.goal.textContent = goal;
        hud.meta.textContent = meta;
        if (pos && pos !== hudPos) { hudPos = pos; placeHud(); }
      },
      banner: (title, sub) => {
        banner.box.hidden = !title;
        if (title) { banner.title.textContent = title; banner.sub.textContent = sub || ''; }
      },
      // Click or tap inside the game zone, or Space and Enter on the focused canvas
      onAct: (fn) => {
        hero.addEventListener('click', (e) => {
          if (e.target.closest('a, button')) return;
          const r = canvas.getBoundingClientRect();
          const p = { x: e.clientX - r.left, y: e.clientY - r.top };
          if (p.x >= zone.x && p.x <= zone.x + zone.w && p.y >= zone.y && p.y <= zone.y + zone.h) fn(p);
        });
        canvas.addEventListener('keydown', (e) => {
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fn(null); }
        });
      },
      point: (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; },
      inZone: (p) => p.x >= zone.x && p.x <= zone.x + zone.w && p.y >= zone.y && p.y <= zone.y + zone.h,
      // Keeps the canvas sharp, measures the play zone and calls back on every resize
      fit: (cb) => {
        const ctx = canvas.getContext('2d');
        const apply = () => {
          const r = canvas.getBoundingClientRect();
          const dpr = Math.min(2, devicePixelRatio || 1);
          canvas.width = Math.round(r.width * dpr);
          canvas.height = Math.round(r.height * dpr);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const tr = text.getBoundingClientRect();
          const gutter = parseFloat(getComputedStyle(hero).paddingInlineEnd) || 16;
          if (r.width >= 900) {
            const x = tr.right - r.left + Math.max(24, r.width * 0.03);
            zone = { x, y: 0, w: r.width - x - gutter, h: r.height };
          } else {
            const y = tr.bottom - r.top + 16;
            zone = { x: gutter, y, w: r.width - gutter * 2, h: r.height - y };
          }
          placeHud();
          banner.box.style.cssText = `left:${zone.x}px; top:${zone.y}px; width:${zone.w}px; height:${zone.h}px`;
          cb(r.width, r.height);
        };
        new ResizeObserver(apply).observe(canvas);
        apply();
        return ctx;
      },
      // A faint dot grid across the whole first screen, like an empty Figma canvas
      dots: (ctx, W, H, C, offY = 0) => {
        ctx.fillStyle = C.line;
        const o = ((offY % 20) + 20) % 20;
        for (let y = o; y < H; y += 20) for (let x = 10; x < W; x += 20) ctx.fillRect(x, y, 1, 1);
      },
      // Runs the frame callback only while the hero is on screen
      loop: (fn) => {
        let on = true;
        let raf = 0;
        let last = performance.now();
        const tick = (now) => {
          const dt = Math.min(48, now - last) / 16.67;
          last = now;
          fn(dt, now);
          raf = on ? requestAnimationFrame(tick) : 0;
        };
        new IntersectionObserver(([e]) => {
          on = e.isIntersecting;
          if (on && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
        }).observe(stage);
        raf = requestAnimationFrame(tick);
      },
      onTheme: (fn) => {
        matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fn);
        new MutationObserver(fn).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
      },
    };
    canvas.setAttribute('aria-label', kit.t(`${variant}_aria`));
    const start = () => window.HeroGames && window.HeroGames[variant] && window.HeroGames[variant](kit);
    const script = document.createElement('script');
    script.src = `${stage.dataset.base}hero-${variant}.js`;
    script.onload = start;
    document.head.append(script);
  }

  const orbit = variant === 'ring' ? $('[data-orbit]') : null;
  if (orbit) {
    const ring = $('.orbit__ring', orbit);
    const cards = $$('.orbit__card', orbit);
    const cap = { no: $('[data-cap="no"]', orbit), name: $('[data-cap="name"]', orbit), meta: $('[data-cap="meta"]', orbit) };
    const n = cards.length;
    const step = 360 / n;
    root.classList.add('orbit-on');
    orbit.style.setProperty('--step', `${step}deg`);

    const cruise = still ? 0 : -0.06;          // degrees per frame when left alone
    let rot = still ? 0 : 140;                  // starts turned away and spins in
    let vel = still ? 0 : -2.6;
    let auto = cruise;
    let tilt = -7;
    let tiltTo = -7;
    let snap = null;
    let drag = null;
    let front = -1;
    let visible = true;
    let raf = 0;
    let last = performance.now();
    let lastScroll = scrollY;

    const layout = () => {
      const w = cards[0].offsetWidth;
      orbit.style.setProperty('--r', `${Math.round(w / 2 / Math.tan(Math.PI / n) + w * 0.16)}px`);
    };
    layout();
    addEventListener('resize', layout);

    const frame = (now) => {
      const dt = Math.min(48, now - last) / 16.67;
      last = now;
      if (snap !== null) {
        rot += (snap - rot) * Math.min(1, 0.12 * dt);
        vel = 0;
        if (Math.abs(snap - rot) < 0.05) { rot = snap; snap = null; }
      } else if (!drag) {
        vel += (auto - vel) * Math.min(1, 0.035 * dt);
        rot += vel * dt;
      }
      tilt += (tiltTo - tilt) * Math.min(1, 0.08 * dt);
      ring.style.transform = `translateZ(calc(var(--r) * -1)) rotateX(${tilt.toFixed(2)}deg) rotateY(${rot.toFixed(2)}deg)`;

      let best = 0;
      let bestCos = -2;
      cards.forEach((card, i) => {
        const cos = Math.cos(((i * step + rot) * Math.PI) / 180);
        card.style.setProperty('--fade', ((1 - cos) * 0.42).toFixed(3));
        if (cos > bestCos) { bestCos = cos; best = i; }
      });
      if (best !== front) {
        front = best;
        const card = cards[best];
        cap.no.textContent = card.dataset.no;
        cap.name.textContent = card.dataset.name;
        cap.meta.textContent = card.dataset.meta;
        cards.forEach((c, i) => c.classList.toggle('is-front', i === best));
      }
      raf = visible ? requestAnimationFrame(frame) : 0;
    };
    raf = requestAnimationFrame(frame);

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    }).observe(orbit);

    // Drag with mouse, pen or finger. Vertical swipes still scroll the page.
    orbit.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, rot, t: performance.now(), moved: false, id: e.pointerId };
      snap = null;
    });
    addEventListener('pointermove', (e) => {
      if (fine && !drag) {
        const r = orbit.getBoundingClientRect();
        if (e.clientY > r.top && e.clientY < r.bottom) {
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          auto = still ? 0 : cruise - x * 0.5;
          tiltTo = -7 + y * 6;
        } else { auto = cruise; tiltTo = -7; }
      }
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 6) { drag.moved = true; orbit.classList.add('is-dragging'); orbit.setPointerCapture(e.pointerId); }
      if (!drag.moved) return;
      const next = drag.rot + dx * 0.22;
      const t = performance.now();
      vel = (next - rot) / Math.max(1, (t - drag.t) / 16.67);
      drag.t = t;
      rot = next;
    });
    const release = (e) => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const moved = drag.moved;
      drag = null;
      orbit.classList.remove('is-dragging');
      if (moved) {
        vel = Math.max(-3.5, Math.min(3.5, vel));
        orbit.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); }, { capture: true, once: true });
      }
    };
    addEventListener('pointerup', release);
    addEventListener('pointercancel', release);

    // Scrolling the page nudges the ring
    if (!still) {
      addEventListener('scroll', () => {
        const d = scrollY - lastScroll;
        lastScroll = scrollY;
        if (visible && !drag) vel -= Math.max(-3, Math.min(3, d * 0.03));
      }, { passive: true });
    }

    // Keyboard: the focused card turns to the front
    cards.forEach((card, i) => card.addEventListener('focus', () => {
      const target = -i * step;
      snap = target + Math.round((rot - target) / 360) * 360;
    }));
    orbit.addEventListener('mouseleave', () => { auto = cruise; tiltTo = -7; });
  }

  /* Image preview that follows the cursor over index rows */
  const peek = $('.peek');
  if (peek && fine && !still) {
    const image = $('img', peek);
    const pos = { x: 0, y: 0, tx: 0, ty: 0 };
    let raf = 0;
    const move = () => {
      pos.x += (pos.tx - pos.x) * 0.16;
      pos.y += (pos.ty - pos.y) * 0.16;
      peek.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      raf = peek.classList.contains('is-on') || Math.abs(pos.tx - pos.x) > 0.5 ? requestAnimationFrame(move) : 0;
    };
    const target = (e) => {
      const w = peek.offsetWidth;
      const h = peek.offsetHeight || w * 0.66;
      pos.tx = Math.min(innerWidth - w - 16, e.clientX + 24);
      pos.ty = Math.max(70, Math.min(innerHeight - h - 16, e.clientY - h / 2));
    };
    $$('[data-peek]').forEach((row) => {
      row.addEventListener('mouseenter', (e) => {
        image.src = row.dataset.peek;
        target(e);
        if (!peek.classList.contains('is-on')) { pos.x = pos.tx; pos.y = pos.ty; }
        peek.classList.add('is-on');
        if (!raf) raf = requestAnimationFrame(move);
      });
      row.addEventListener('mousemove', target);
      row.addEventListener('mouseleave', () => peek.classList.remove('is-on'));
    });
  }

  /* Reveal case blocks just before they enter the viewport */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px 12% 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* Swipe counter for the image carousels on phones */
  $$('[data-slides]').forEach((track) => {
    const now = $('[data-slide-now]', track.parentElement);
    if (!now) return;
    track.addEventListener('scroll', () => {
      const first = track.firstElementChild;
      const step = first ? first.getBoundingClientRect().width + 8 : track.clientWidth;
      now.textContent = Math.min(track.children.length, Math.round(track.scrollLeft / step) + 1);
    }, { passive: true });
  });

  /* Case study images: captions from alt text, two images in a paragraph sit side by side */
  $$('.cs__body > p').forEach((p) => {
    const images = $$(':scope > img', p);
    const onlyImages = images.length && [...p.childNodes].every((n) => n.nodeName === 'IMG' || (n.nodeType === 3 && !n.textContent.trim()));
    if (!onlyImages) return;
    const figures = images.map((img) => {
      const figure = document.createElement('figure');
      img.loading = 'lazy';
      img.dataset.zoom = '';
      figure.append(img);
      if (img.alt) {
        const caption = document.createElement('figcaption');
        caption.textContent = img.alt;
        figure.append(caption);
      }
      return figure;
    });
    if (figures.length === 1) {
      p.replaceWith(figures[0]);
    } else {
      const pair = document.createElement('div');
      pair.className = 'pair';
      pair.append(...figures);
      p.replaceWith(pair);
    }
  });

  /* Enlarge an image on click */
  const zoom = $('.zoom');
  if (zoom && zoom.showModal) {
    const large = $('img', zoom);
    document.addEventListener('click', (e) => {
      const img = e.target.closest('[data-zoom]');
      if (!img) return;
      large.src = img.currentSrc || img.src;
      large.alt = img.alt;
      zoom.showModal();
    });
    zoom.addEventListener('click', () => zoom.close());
  }

  /* Reading progress on case studies */
  if ($('.cs')) {
    const bar = $('.top__progress');
    const update = () => {
      const max = root.scrollHeight - innerHeight;
      bar.style.setProperty('--progress', max > 0 ? Math.min(1, scrollY / max) : 0);
    };
    addEventListener('scroll', update, { passive: true });
    update();
  }
})();
