// Every effect here is an enhancement: without JavaScript the site still reads as plain pages.
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => [...el.querySelectorAll(q)];

  /* Local time in the header */
  const clock = $('[data-clock]');
  if (clock) {
    const city = clock.textContent.trim();
    const format = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: clock.dataset.tz });
    const tick = () => { clock.textContent = `${city} ${format.format(new Date())}`; };
    tick();
    setInterval(tick, 20000);
  }

  /* Colour theme */
  const themeButton = $('[data-theme-toggle]');
  if (themeButton) {
    themeButton.addEventListener('click', () => {
      const root = document.documentElement;
      const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      const next = dark ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) { /* the choice just won't persist */ }
    });
  }

  /* Copy the email address */
  $$('[data-copy]').forEach((button) => {
    const label = button.textContent;
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        button.textContent = 'Copied';
      } catch (e) {
        button.textContent = button.dataset.copy;
      }
      setTimeout(() => { button.textContent = label; }, 1800);
    });
  });

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

  /* Reveal case blocks as they enter the viewport */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !still) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px 12% 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

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
  const article = $('.cs');
  if (article) {
    const header = $('.top__progress');
    const update = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      header.style.setProperty('--progress', max > 0 ? Math.min(1, scrollY / max) : 0);
    };
    addEventListener('scroll', update, { passive: true });
    update();
  }

  /* One button, four languages */
  const lab = $('[data-lab]');
  if (lab) {
    const copy = {
      en: { from: 'From', to: 'To', date: 'Date', a: 'Lisbon', b: 'Porto', d: '14 Mar', go: 'Show trains' },
      ru: { from: 'Откуда', to: 'Куда', date: 'Дата', a: 'Лиссабон', b: 'Порту', d: '14 марта', go: 'Показать поезда' },
      de: { from: 'Von', to: 'Nach', date: 'Datum', a: 'Lissabon', b: 'Porto', d: '14. März', go: 'Verbindungen anzeigen' },
      ja: { from: '出発', to: '到着', date: '日付', a: 'リスボン', b: 'ポルト', d: '3月14日', go: '列車を表示' },
    };
    const button = $('[data-lab-button]', lab);
    const label = $('span', button);
    const state = $('[data-lab-state]', lab);
    const status = $('.lab__status', lab);
    const count = $('[data-lab-count]', lab);
    let lang = 'en';
    let width = 'fixed';

    const measure = () => {
      const cut = width === 'fixed' && label.scrollWidth > label.clientWidth + 1;
      status.classList.toggle('is-bad', cut);
      state.textContent = cut ? 'The label is cut off.' : 'The label fits.';
      count.textContent = copy[lang].go.length;
    };
    const render = () => {
      $$('[data-lab-t]', lab).forEach((el) => { el.textContent = copy[lang][el.dataset.labT]; });
      lab.lang = lang;
      button.classList.toggle('is-fixed', width === 'fixed');
      $$('[data-lang]', lab).forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === lang));
      $$('[data-width]', lab).forEach((b) => b.setAttribute('aria-pressed', b.dataset.width === width));
      measure();
      setTimeout(measure, 380);
    };
    lab.addEventListener('click', (e) => {
      const b = e.target.closest('[data-lang], [data-width]');
      if (!b) return;
      if (b.dataset.lang) lang = b.dataset.lang;
      if (b.dataset.width) width = b.dataset.width;
      render();
    });
    render();
  }
})();
