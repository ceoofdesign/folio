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

  /* Translation lens: the headline shows the other language inside a circle that follows the pointer */
  const stack = $('[data-lens]');
  if (stack && !still) {
    root.classList.add('lens-on');
    const s = { x: 0, y: 0, tx: 0, ty: 0, r: 0, tr: 0 };
    let raf = 0;
    let touched = false;
    const radius = () => Math.max(70, Math.min(140, stack.offsetWidth * 0.14));
    const paint = () => {
      s.x += (s.tx - s.x) * 0.2;
      s.y += (s.ty - s.y) * 0.2;
      s.r += (s.tr - s.r) * 0.16;
      stack.style.setProperty('--lx', `${s.x}px`);
      stack.style.setProperty('--ly', `${s.y}px`);
      stack.style.setProperty('--lr', `${Math.max(0, s.r)}px`);
      const settled = Math.abs(s.tx - s.x) < 0.3 && Math.abs(s.ty - s.y) < 0.3 && Math.abs(s.tr - s.r) < 0.3;
      raf = settled ? 0 : requestAnimationFrame(paint);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(paint); };
    const aim = (e, jump) => {
      const rect = stack.getBoundingClientRect();
      s.tx = e.clientX - rect.left;
      s.ty = e.clientY - rect.top;
      if (jump) { s.x = s.tx; s.y = s.ty; }
      s.tr = radius();
      kick();
    };
    stack.addEventListener('pointerenter', (e) => { touched = true; aim(e, s.r < 2); });
    stack.addEventListener('pointermove', (e) => { touched = true; aim(e, false); });
    stack.addEventListener('pointerdown', (e) => { touched = true; aim(e, true); });
    const hide = () => { s.tr = 0; kick(); };
    stack.addEventListener('pointerleave', hide);
    stack.addEventListener('pointercancel', hide);
    stack.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') setTimeout(hide, 900); });

    // One slow pass on load, so the effect is discovered without instructions
    setTimeout(() => {
      if (touched) return;
      const w = stack.offsetWidth;
      const line = parseFloat(getComputedStyle($('.hero__line', stack)).lineHeight) || 60;
      const start = performance.now();
      const run = (now) => {
        if (touched) return;
        const k = Math.min(1, (now - start) / 2200);
        const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        s.tx = w * (0.08 + 0.6 * ease);
        s.ty = line * (0.55 + 0.9 * ease);
        if (k === 0) { s.x = s.tx; s.y = s.ty; }
        s.tr = k < 0.85 ? radius() * 0.9 : 0;
        kick();
        if (k < 1) requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
    }, 1100);
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
