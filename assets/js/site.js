// Every effect here is an enhancement: without JavaScript the site still reads as plain pages.
(() => {
  const root = document.documentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => [...el.querySelectorAll(q)];
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* not saved */ } },
  };

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
    const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
    // The pressed state for screen readers, and the browser bar on phones in the same colour as the page
    const mark = () => {
      themeButton.setAttribute('aria-pressed', String(isDark()));
      $$('meta[name="theme-color"]').forEach((m) => { m.content = isDark() ? '#121315' : '#eff0ec'; });
    };
    mark();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', mark);
    themeButton.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      root.classList.add('no-trans');
      root.dataset.theme = next;
      void root.offsetWidth;
      requestAnimationFrame(() => root.classList.remove('no-trans'));
      store.set('theme', next);
      mark();
    });
  }

  /* Mail links with a subject line. Encoded here, so spaces never turn into "+" in the mail app */
  $$('a[data-subject]').forEach((a) => { a.href = `${a.href.split('?')[0]}?subject=${encodeURIComponent(a.dataset.subject)}`; });

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

  /* The hero is a small game: screens of a booking flow are stacked from a crane. The first screen
     becomes a Figma-like canvas; the game plays in a zone beside the text (below it on phones), so
     the headline stays readable. A finished run can be saved to a public board of records. */
  const hero = $('.hero[data-hero]');
  const stage = $('[data-stage]');
  if (hero && stage && window.ResizeObserver && window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype.roundRect) {
    hero.classList.add('hero--game');
    stage.hidden = false;
    let strings = {};
    try { strings = JSON.parse(stage.dataset.strings || '{}'); } catch (e) { /* fall back to keys */ }
    const lang = root.lang || 'en';
    const touch = matchMedia('(hover: none)').matches;
    const canvas = $('canvas', stage);
    const text = $('.hero__text', hero);
    const fmt = (s, v = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
    const say = (key, v) => {
      const k = touch && strings[`${key}_touch`] ? `${key}_touch` : key;
      return fmt(strings[k] || key, v);
    };
    const hudEl = {
      box: $('.stage__hud', stage),
      n: $('[data-hud-n]', stage),
      label: $('[data-hud-label]', stage),
      bugs: $('[data-hud-bugs]', stage),
    };
    let zone = { x: 0, y: 0, w: 0, h: 0 };
    let lastN = 0;
    let dotTile = null;

    /* Records: a Google Sheet behind a small web app (see tools/leaderboard.gs). Until its address is
       set in _config.yml, runs are kept on this device only. */
    const boardUrl = stage.dataset.board || '';
    const email = stage.dataset.email || '';
    const mine = () => ({ name: store.get('towerName') || '', company: store.get('towerCompany') || '' });
    const localRuns = () => { try { return JSON.parse(store.get('towerRuns') || '[]'); } catch (e) { return []; } };
    const sortRuns = (list) => list.slice().sort((a, b) => b.score - a.score);
    // The web app takes a second or more to answer, so the last board seen is kept on the device:
    // it shows at once and is refreshed in the background
    const remember = (data) => { store.set('towerBoard', JSON.stringify({ total: data.total, board: data.board })); return data; };
    const recalled = () => {
      if (!boardUrl) return { local: true, board: sortRuns(localRuns()) };
      try { return JSON.parse(store.get('towerBoard') || 'null'); } catch (e) { return null; }
    };
    let pending = null;
    const fetchBoard = () => {
      if (!boardUrl) return Promise.resolve(recalled());
      if (!pending) {
        pending = fetch(boardUrl).then((r) => r.json()).then((data) => {
          if (!data || !data.ok) throw new Error('board');
          return remember(data);
        }).finally(() => { setTimeout(() => { pending = null; }, 10000); });
      }
      return pending;
    };
    const postRun = (run) => {
      if (!boardUrl) return Promise.reject(new Error('local'));
      // A plain text body keeps this a simple request, so the browser sends it without a preflight
      return fetch(boardUrl, { method: 'POST', body: JSON.stringify(run) }).then((r) => r.json()).then((data) => {
        if (!data || !data.ok) throw new Error('board');
        return remember(data);
      });
    };
    // The board as it will look with this run in it, so the result shows before the server answers
    const withRun = (board, me, score) => {
      const same = (r) => r.name.toLowerCase() === me.name.toLowerCase() && (r.company || '').toLowerCase() === (me.company || '').toLowerCase();
      const old = board.find(same);
      const rest = board.filter((r) => !same(r));
      const entry = { name: me.name, company: me.company, score: Math.max(score, old ? old.score : 0) };
      const list = rest.concat(entry).sort((a, b) => b.score - a.score);
      return { list, rank: list.indexOf(entry) + 1, total: board.length + (old ? 0 : 1) };
    };
    // Warm the board up while the visitor reads the first screen
    if (boardUrl) setTimeout(() => fetchBoard().catch(() => { /* tried again on demand */ }), 2500);
    const keepLocal = (run) => {
      const list = sortRuns(localRuns().concat({ name: run.name, company: run.company, score: run.score, date: new Date().toISOString().slice(0, 10) })).slice(0, 20);
      store.set('towerRuns', JSON.stringify(list));
      return list;
    };
    const isMine = (r, me) => me.name && r.name === me.name && (r.company || '') === (me.company || '');
    const mailto = (run) => {
      const me = mine();
      let body = say('mail_body');
      if (run && me.name) {
        const who = me.company ? say('who_company', { name: me.name, company: me.company }) : me.name;
        body = say('mail_body_named', { who, n: run.score });
      }
      return `mailto:${email}?subject=${encodeURIComponent(say('mail_subject'))}&body=${encodeURIComponent(body)}`;
    };
    const rowsInto = (list, board, me, limit) => {
      list.textContent = '';
      let shown = board.slice(0, limit);
      const at = board.findIndex((r) => isMine(r, me));
      if (at >= limit) shown = board.slice(0, limit - 1).concat(board[at]);
      shown.forEach((r) => {
        const li = document.createElement('li');
        const rank = board.indexOf(r) + 1;
        if (isMine(r, me)) li.className = 'is-me';
        [String(rank).padStart(2, '0'), r.name, r.company || '—', r.score].forEach((v, i) => {
          const span = document.createElement('span');
          span.textContent = v;
          if (i === 2 && !r.company) span.className = 'is-empty';
          li.append(span);
        });
        list.append(li);
      });
    };

    // Dialog with the full board, opened from the HUD and from the game-over panel
    const dialog = $('[data-records]');
    const openRecords = () => {
      if (!dialog || !dialog.showModal) return;
      const list = $('[data-records-list]', dialog);
      const note = $('[data-records-note]', dialog);
      const render = (data) => {
        const board = data.board || [];
        note.textContent = !board.length ? say('board_empty') : data.local ? say('board_local') : '';
        note.hidden = !note.textContent;
        rowsInto(list, board, mine(), 50);
      };
      const seen = recalled();
      list.textContent = '';
      if (seen) render(seen);
      else { note.hidden = false; note.textContent = say('board_loading'); }
      $('[data-records-mail]', dialog).href = mailto(null);
      dialog.showModal();
      fetchBoard().then(render).catch(() => { if (!seen) { note.hidden = false; note.textContent = say('board_error'); } });
    };
    $$('[data-records-open]').forEach((b) => b.addEventListener('click', openRecords));
    if (dialog) {
      $('[data-records-close]', dialog).addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    }

    // Panel shown when a run ends: the result, a form to save it and a way to get in touch
    const ov = {
      box: $('[data-over]', stage),
      title: $('[data-over-title]', stage),
      sub: $('[data-over-sub]', stage),
      rank: $('[data-over-rank]', stage),
      form: $('[data-over-form]', stage),
      saved: $('[data-over-saved]', stage),
      list: $('[data-over-list]', stage),
      status: $('[data-over-status]', stage),
      cta: $('[data-over-cta]', stage),
      mail: $('[data-over-mail]', stage),
    };
    let run = null;
    let again = null;
    let overTimer = 0;
    const showSaved = (board, me, message) => {
      ov.form.hidden = true;
      ov.rank.hidden = true;
      ov.saved.hidden = false;
      ov.status.textContent = message;
      rowsInto(ov.list, board, me, 5);
      ov.cta.textContent = me.company ? say('cta_company', { company: me.company }) : say('cta');
      ov.mail.href = mailto(run);
    };
    ov.form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!run) return;
      const data = new FormData(ov.form);
      const me = { name: String(data.get('name') || '').trim().slice(0, 40), company: String(data.get('company') || '').trim().slice(0, 60) };
      if (!me.name) { ov.form.elements.name.focus(); return; }
      store.set('towerName', me.name);
      store.set('towerCompany', me.company);
      const entry = { name: me.name, company: me.company, score: run.score, seconds: run.seconds, lang };
      if (!boardUrl) { showSaved(keepLocal(entry), me, say('saved_local')); return; }
      // Show the place on the board right away; the server's answer only confirms or corrects it
      const thisRun = run;
      const guess = withRun((recalled() || { board: [] }).board || [], me, run.score);
      showSaved(guess.list, me, say('saving_rank', { n: guess.rank, m: guess.total }));
      postRun(entry).then((res) => {
        if (run !== thisRun) return;
        const board = res.board || [];
        showSaved(board, me, say('saved', { n: res.rank || board.findIndex((r) => isMine(r, me)) + 1, m: res.total || board.length }));
      }).catch(() => {
        keepLocal(entry);
        if (run === thisRun) ov.status.textContent = say('error');
      });
    });
    $$('[data-again]', stage).forEach((b) => b.addEventListener('click', () => { if (again) again(); }));

    const showOver = (r) => {
      clearTimeout(overTimer);
      run = r;
      if (!r) { ov.box.hidden = true; return; }
      overTimer = setTimeout(() => {
        ov.title.textContent = say(r.reason);
        ov.sub.textContent = say('result', { n: r.score, m: r.best }) + (r.newBest && r.score > 0 ? ` · ${say('new_best')}` : '');
        ov.rank.hidden = true;
        ov.saved.hidden = true;
        ov.form.hidden = r.score < 1;
        ov.cta.textContent = say('cta');
        ov.mail.href = mailto(null);
        const me = mine();
        if (!ov.form.elements.name.value) ov.form.elements.name.value = me.name;
        if (!ov.form.elements.company.value) ov.form.elements.company.value = me.company;
        ov.box.hidden = false;
        if (document.activeElement === canvas && r.score > 0) ov.form.elements.name.focus({ preventScroll: true });
        if (r.score > 0 && boardUrl) {
          const place = (data) => {
            if (run !== r || !data) return;
            // An equal score that is already on the board stays above, as it does on the server
            const ahead = (data.board || []).filter((x) => x.score >= r.score && !isMine(x, me)).length;
            if (ahead < 50) { ov.rank.textContent = say('rank', { n: ahead + 1 }); ov.rank.hidden = !ov.saved.hidden; }
          };
          place(recalled());
          fetchBoard().then(place).catch(() => { /* the panel works without it */ });
        }
      }, 450);
    };

    const kit = {
      still,
      fine,
      touch,
      canvas,
      t: say,
      list: (key) => say(key).split(',').map((s) => s.trim()),
      colors: () => {
        const cs = getComputedStyle(root);
        const v = (name) => cs.getPropertyValue(name).trim();
        const hex = v('--paper').replace('#', '');
        const dark = hex.length === 6 && parseInt(hex.slice(0, 2), 16) < 90;
        return {
          dark,
          paper: v('--paper'), plate: v('--plate'), ink: v('--ink'), ink2: v('--ink-2'), line: v('--line'), signal: v('--signal'),
          select: '#0d99ff', comp: '#9747ff', green: '#14ae5c', white: '#ffffff',
          card: dark ? '#1d1f22' : '#ffffff',
          edge: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)',
          shadow: dark ? 'rgba(0,0,0,.55)' : 'rgba(20,22,26,.16)',
          faint: dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)',
        };
      },
      // A multiplayer cursor, as in a shared Figma file. Shows the first move once.
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
        ctx.font = '500 11px Geologica, "IBM Plex Sans JP", system-ui, sans-serif';
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
      load: store.get,
      save: store.set,
      mono: (px) => `400 ${px}px "IBM Plex Mono", "IBM Plex Sans JP", ui-monospace, monospace`,
      sans: (px, w = 400) => `${w} ${px}px Geologica, "IBM Plex Sans JP", system-ui, sans-serif`,
      zone: () => zone,
      // Space the HUD takes at the top of the zone
      top: () => (hudEl.box.offsetHeight || 48) + 12,
      hud: ({ n, best, bugs, hint }) => {
        hudEl.n.textContent = n;
        if (n > lastN && !still) {
          hudEl.n.classList.remove('is-bump');
          void hudEl.n.offsetWidth;
          hudEl.n.classList.add('is-bump');
        }
        lastN = n;
        hudEl.label.textContent = hint ? say('hint') : say('label', { m: best });
        $$('i', hudEl.bugs).forEach((i, k) => i.classList.toggle('is-on', k < bugs));
        hudEl.bugs.setAttribute('aria-label', say('lives', { n: bugs }));
      },
      over: showOver,
      onAgain: (fn) => { again = fn; },
      // Click or tap inside the game zone, or Space and Enter on the focused canvas
      onAct: (fn) => {
        hero.addEventListener('click', (e) => {
          if (e.target.closest('a, button, input, label, form, [data-over]')) return;
          const r = canvas.getBoundingClientRect();
          const p = { x: e.clientX - r.left, y: e.clientY - r.top };
          if (p.x >= zone.x && p.x <= zone.x + zone.w && p.y >= zone.y && p.y <= zone.y + zone.h) fn(p, false);
        });
        canvas.addEventListener('keydown', (e) => {
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fn(null, true); }
        });
      },
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
            const y = tr.bottom - r.top + 24;
            zone = { x: gutter, y, w: r.width - gutter * 2, h: r.height - y };
          }
          hudEl.box.style.cssText = `left:${zone.x}px; top:${zone.y + 12}px; width:${zone.w}px`;
          ov.box.style.cssText = `left:${zone.x}px; top:${zone.y}px; width:${zone.w}px; height:${zone.h}px`;
          cb(r.width, r.height);
        };
        new ResizeObserver(apply).observe(canvas);
        apply();
        return ctx;
      },
      // A faint dot grid across the whole first screen, like an empty Figma canvas
      // Drawn from one cached 20 px tile instead of thousands of tiny rectangles every frame
      dots: (ctx, W, H, C, offY = 0) => {
        if (!dotTile || dotTile.color !== C.line) {
          const tile = document.createElement('canvas');
          tile.width = 20;
          tile.height = 20;
          const t = tile.getContext('2d');
          t.fillStyle = C.line;
          t.fillRect(10, 0, 1, 1);
          dotTile = { color: C.line, pattern: ctx.createPattern(tile, 'repeat') };
        }
        const o = ((offY % 20) + 20) % 20;
        ctx.save();
        ctx.translate(0, o);
        ctx.fillStyle = dotTile.pattern;
        ctx.fillRect(0, -o, W, H);
        ctx.restore();
      },
      // Runs the frame callback only while the hero is on screen and the tab is visible
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
    canvas.setAttribute('aria-label', say('aria'));
    const script = document.createElement('script');
    script.src = `${stage.dataset.base}hero-tower.js`;
    script.onload = () => window.HeroTower && window.HeroTower(kit);
    // Start once the fonts are in, so the text doesn't reflow and the play zone doesn't jump after the first frames
    const fontsIn = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
    fontsIn.then(() => document.head.append(script));
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
