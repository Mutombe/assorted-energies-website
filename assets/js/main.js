/* Assorted Energies International: site interactions.
   No dependencies. Every module checks for its own markup, so one file serves all pages. */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none)').matches;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs = {}, parent) => {
    const el = document.createElementNS(SVGNS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  };
  const fmt = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
  };

  /* Preloader: plays once per session ------------------------------------------ */
  const pre = $('[data-preloader]');
  const markLoaded = () => root.classList.add('is-loaded');
  if (pre) {
    if (store.get('aei-seen') || reduced) {
      pre.classList.add('is-skipped');
      requestAnimationFrame(markLoaded);
    } else {
      store.set('aei-seen', '1');
      const finish = () => {
        pre.classList.add('is-done');
        setTimeout(markLoaded, 250);
        setTimeout(() => pre.classList.add('is-skipped'), 1100);
      };
      window.addEventListener('load', () => setTimeout(finish, 900), { once: true });
      setTimeout(finish, 3200); // never hold the page hostage on a slow image
    }
  } else markLoaded();

  $$('[data-year]').forEach(el => (el.textContent = new Date().getFullYear()));

  /* Header: glass on scroll, hide on scroll down ---------------------------------- */
  const header = $('[data-header]');
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY;
    header.classList.toggle('is-scrolled', y > 40);
    header.classList.toggle('is-hidden', y > 400 && y > lastY && !root.classList.contains('menu-open'));
    lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Nav indicator slides to the hovered / active link ------------------------------- */
  const navList = $('[data-nav-list]');
  const indicator = $('[data-nav-indicator]');
  if (navList && indicator) {
    const moveTo = a => {
      if (!a) { indicator.style.opacity = 0; return; }
      indicator.style.opacity = 1;
      // transform only: the pill is 100px wide and scaled to the link
      indicator.style.transform = `translateX(${a.offsetLeft + 5}px) scaleX(${(a.offsetWidth / 100).toFixed(3)})`;
    };
    const active = () => $('a.is-active', navList);
    $$('a', navList).forEach(a => a.addEventListener('mouseenter', () => moveTo(a)));
    navList.addEventListener('mouseleave', () => moveTo(active()));
    addEventListener('load', () => moveTo(active()));
    document.fonts && document.fonts.ready.then(() => moveTo(active()));
  }

  /* Mobile menu ---------------------------------------------------------------------- */
  const toggle = $('[data-menu-toggle]');
  const menu = $('[data-mobile-menu]');
  if (toggle && menu) {
    const set = open => {
      root.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', open);
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (open) menu.hidden = false;
    };
    toggle.addEventListener('click', () => set(!root.classList.contains('menu-open')));
    addEventListener('keydown', e => e.key === 'Escape' && set(false));
    $$('a', menu).forEach(a => a.addEventListener('click', () => set(false)));
  }

  /* Split headings into lines for the line-by-line reveal ---------------------------- */
  const splitLines = el => {
    const html = el.innerHTML;
    const words = [];
    const walk = (node, wrap) => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { words.push(' '); return; }
            words.push(wrap ? wrap(part) : part);
          });
        } else if (n.nodeName === 'BR') words.push('<br>');
        else {
          const tag = n.cloneNode(false);
          walk(n, t => { tag.textContent = t; const o = tag.outerHTML; return o; });
        }
      });
    };
    walk(el);
    el.innerHTML = words.map(w => (w === ' ' || w === '<br>') ? w : `<span class="w">${w}</span>`).join('');
    const lines = [];
    let top = null;
    $$('.w', el).forEach(w => {
      const t = w.offsetTop;
      if (top === null || Math.abs(t - top) > 4) { lines.push([]); top = t; }
      lines[lines.length - 1].push(w.innerHTML);
    });
    if (!lines.length) { el.innerHTML = html; return; }
    el.innerHTML = lines.map((l, i) => `<span class="line"><span style="--i:${i}">${l.join(' ')}</span></span>`).join('');
  };
  const splitEls = $$('[data-split]');
  const doSplit = () => splitEls.forEach(el => { if (!el.dataset.src) el.dataset.src = el.innerHTML; el.innerHTML = el.dataset.src; splitLines(el); });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(doSplit);
  let rw;
  addEventListener('resize', () => { clearTimeout(rw); rw = setTimeout(() => { const on = splitEls.filter(e => e.classList.contains('is-revealed')); doSplit(); on.forEach(e => e.classList.add('is-revealed')); }, 250); });

  /* Reveal on scroll ---------------------------------------------------------------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) reveal(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  const pending = new Set($$('[data-reveal], [data-split], [data-count], .chart, [data-map]'));
  pending.forEach(el => io.observe(el));
  const reveal = el => {
    if (!pending.has(el)) return;
    pending.delete(el);
    io.unobserve(el);
    el.classList.add('is-revealed');
    el.dispatchEvent(new CustomEvent('reveal'));
  };
  // Observers can drop entries on a fast flick or the End key; sweep anything already passed.
  let sweeping = false;
  addEventListener('scroll', () => {
    if (sweeping || !pending.size) return;
    sweeping = true;
    requestAnimationFrame(() => {
      pending.forEach(el => { if (el.getBoundingClientRect().top < innerHeight * .9) reveal(el); });
      sweeping = false;
    });
  }, { passive: true });

  /* Counters -------------------------------------------------------------------------- */
  $$('[data-count]').forEach(el => {
    const to = parseFloat(el.dataset.count);
    const dec = +(el.dataset.decimals || 0);
    const dur = 1800;
    el.textContent = fmt(0, dec);
    el.addEventListener('reveal', () => {
      if (reduced) { el.textContent = fmt(to, dec); return; }
      const t0 = performance.now();
      const tick = t => {
        const p = Math.min((t - t0) / dur, 1);
        el.textContent = fmt(to * (1 - Math.pow(1 - p, 4)), dec);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { once: true });
  });

  /* Word rotator in the hero ----------------------------------------------------------- */
  $$('[data-rotator]').forEach(r => {
    const items = $$('span', r);
    let i = 0;
    items[0].classList.add('is-in');
    if (reduced || items.length < 2) return;
    setInterval(() => {
      const cur = items[i];
      cur.classList.remove('is-in'); cur.classList.add('is-out');
      setTimeout(() => cur.classList.remove('is-out'), 1000);
      i = (i + 1) % items.length;
      items[i].classList.add('is-in');
    }, 2600);
  });

  /* Parallax ---------------------------------------------------------------------------- */
  const para = $$('[data-parallax]');
  if (para.length && !reduced) {
    let ticking = false;
    const run = () => {
      const vh = innerHeight;
      para.forEach(el => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        const s = parseFloat(el.dataset.parallax) || 0.15;
        const off = (r.top + r.height / 2 - vh / 2) * -s;
        el.style.translate = `0 ${off.toFixed(1)}px`;
      });
      ticking = false;
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
    run();
  }

  /* Magnetic buttons -------------------------------------------------------------------- */
  if (!touch && !reduced) {
    $$('[data-magnetic]').forEach(b => {
      b.addEventListener('mousemove', e => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .18}px, ${(e.clientY - r.top - r.height / 2) * .3}px)`;
      });
      b.addEventListener('mouseleave', () => (b.style.transform = ''));
    });
  }

  /* Touch: mirror hover on cards while they cross the middle of the screen ---------------- */
  if (touch) {
    const mid = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('is-inview', e.isIntersecting)),
      { rootMargin: '-38% 0px -38% 0px' });
    $$('.service-item').forEach(el => mid.observe(el));
  }

  /* Live sun over Harare ----------------------------------------------------------------- */
  const sunWidget = $('[data-sun]');
  if (sunWidget) {
    const LAT = -17.83, LON = 31.05, rad = Math.PI / 180;
    const solar = d => {
      const start = Date.UTC(d.getUTCFullYear(), 0, 0);
      const N = (d - start) / 864e5;
      const g = 2 * Math.PI / 365 * (N - 1);
      const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
      const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
      const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
      const tst = utcMin + eot + 4 * LON;
      const ha = (tst / 4 - 180) * rad;
      const el = Math.asin(Math.sin(LAT * rad) * Math.sin(decl) + Math.cos(LAT * rad) * Math.cos(decl) * Math.cos(ha)) / rad;
      // -0.833° accounts for refraction and the sun's radius, matching published rise/set times
      const h0 = Math.acos(Math.max(-1, Math.min(1, (Math.sin(-0.833 * rad) - Math.sin(LAT * rad) * Math.sin(decl)) / (Math.cos(LAT * rad) * Math.cos(decl))))) / rad;
      const noon = 720 - 4 * LON - eot; // UTC minutes
      return { el, rise: noon - 4 * h0, set: noon + 4 * h0, utcMin };
    };
    const clock = m => {
      const t = ((Math.round(m) + 120) % 1440 + 1440) % 1440; // CAT = UTC+2
      return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    };
    const sunDot = $('.sun', sunWidget);
    const update = () => {
      const s = solar(new Date());
      const p = Math.max(0, Math.min(1, (s.utcMin - s.rise) / (s.set - s.rise)));
      const x = 10 + 180 * p, y = 70 - Math.sin(Math.PI * p) * 56;
      sunDot.setAttribute('cx', x.toFixed(1));
      sunDot.setAttribute('cy', (s.el > 0 ? y : 78).toFixed(1));
      sunDot.style.opacity = s.el > 0 ? 1 : .35;
      $('[data-sun-el]', sunWidget).textContent = s.el > 0 ? `${Math.round(s.el)}°` : 'Night';
      $('[data-sun-state]', sunWidget).textContent = s.el > 25 ? 'Panels at strong output' : s.el > 0 ? 'Panels generating' : 'Batteries carrying the load';
      $('[data-sun-times]', sunWidget).textContent = `Rise ${clock(s.rise)} · Set ${clock(s.set)} CAT`;
      $('[data-sun-now]', sunWidget).textContent = `Harare ${clock(s.utcMin)}`;
    };
    update();
    setInterval(update, 30000);
  }

  /* Process rail fills as you scroll past it ---------------------------------------------- */
  const proc = $('[data-process]');
  if (proc) {
    const rail = $('.process__rail', proc);
    const steps = $$('.step', proc);
    const run = () => {
      const r = proc.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (innerHeight * .75 - r.top) / (r.height + innerHeight * .2)));
      rail && rail.style.setProperty('--p', p.toFixed(3));
      steps.forEach((s, i) => s.classList.toggle('is-lit', p >= i / steps.length + .02));
    };
    addEventListener('scroll', () => requestAnimationFrame(run), { passive: true });
    run();
  }

  /* Tabs ------------------------------------------------------------------------------- */
  $$('[data-tabs]').forEach(t => {
    const tabs = $$('[role="tab"]', t);
    const select = tab => {
      tabs.forEach(b => {
        const on = b === tab;
        b.setAttribute('aria-selected', on);
        b.tabIndex = on ? 0 : -1;
        $('#' + b.getAttribute('aria-controls')).hidden = !on;
      });
    };
    tabs.forEach((b, i) => {
      b.addEventListener('click', () => select(b));
      b.addEventListener('keydown', e => {
        const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        const n = tabs[(i + d + tabs.length) % tabs.length];
        n.focus(); select(n);
      });
    });
  });

  /* Gallery filters ------------------------------------------------------------------------ */
  $$('[data-filters]').forEach(f => {
    const grid = $(f.dataset.filters);
    $$('button', f).forEach(b => b.addEventListener('click', () => {
      $$('button', f).forEach(x => x.setAttribute('aria-pressed', x === b));
      const k = b.dataset.filter;
      $$('[data-cat]', grid).forEach(item => {
        const show = k === 'all' || item.dataset.cat.split(' ').includes(k);
        item.classList.toggle('is-hidden', !show);
      });
    }));
  });

  /* Carousel buttons ----------------------------------------------------------------------- */
  $$('[data-carousel]').forEach(c => {
    const track = $(c.dataset.carousel);
    $$('button', c).forEach(b => b.addEventListener('click', () => {
      const slide = track.firstElementChild;
      track.scrollBy({ left: (+b.dataset.dir) * (slide.offsetWidth + 14), behavior: reduced ? 'auto' : 'smooth' });
    }));
  });

  /* Opening hours: highlight today ------------------------------------------------------------ */
  $$('[data-hours] tr').forEach(tr => {
    const harareDay = new Date(Date.now() + 2 * 3600e3).getUTCDay();
    if (+tr.dataset.day === harareDay) tr.classList.add('is-today');
  });

  /* Contact form: compose an email (no server needed) ---------------------------------------- */
  const form = $('[data-contact-form]');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const d = Object.fromEntries(new FormData(form));
      const body = [
        `Name: ${d.name}`, `Email: ${d.email}`, `Phone: ${d.phone || '-'}`,
        `Property: ${d.type}`, `Monthly power bill: ${d.bill || '-'}`, '', d.message,
      ].join('\n');
      const subject = `Solar enquiry: ${d.type}, ${d.name}`;
      location.href = `mailto:assortedenergies@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      $('[data-form-status]', form).textContent = 'Your email app should open with your message ready to send. Prefer WhatsApp? Use the green button.';
    });
  }

  /* =============================== MAPS ===================================== */
  const tipEl = (host, cls) => { const t = document.createElement('div'); t.className = cls; host.appendChild(t); return t; };
  const curve = (a, b, bend = .22) => {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    return `M${a.x},${a.y} Q${mx - dy * bend},${my + dx * bend} ${b.x},${b.y}`;
  };

  const drawMap = host => {
    const data = window.AEI_MAPS && window.AEI_MAPS[host.dataset.map];
    if (!data) return;
    const isZim = host.dataset.map === 'zim';
    const s = svg('svg', { viewBox: `-20 -20 ${data.w + 40} ${data.h + 40}`, role: 'img', 'aria-label': host.dataset.label || 'Map' });
    const defs = svg('defs', {}, s);
    const lg = svg('linearGradient', { id: 'linkGrad', x1: 0, x2: 1 }, defs);
    svg('stop', { offset: 0, 'stop-color': '#f07a1a' }, lg);
    svg('stop', { offset: 1, 'stop-color': '#8fb0e6' }, lg);
    const glow = svg('radialGradient', { id: 'hqGlow' }, defs);
    svg('stop', { offset: 0, 'stop-color': 'rgba(240,122,26,.45)' }, glow);
    svg('stop', { offset: 1, 'stop-color': 'rgba(240,122,26,0)' }, glow);

    const hq = data.cities.find(c => c.tier === 0);
    (data.neighbours || []).forEach(c => svg('path', { d: c.d, class: 'm-neigh' }, s));
    const gc = svg('g', {}, s);
    data.countries.forEach(c => {
      const p = svg('path', { d: c.d, class: 'm-country' + (c.id === data.highlight && !isZim ? ' is-home' : '') }, gc);
      if (isZim) p.classList.add('is-home');
    });
    svg('circle', { cx: hq.x, cy: hq.y, r: isZim ? 260 : 170, fill: 'url(#hqGlow)' }, s);

    // dot matrix, revealed as a wave radiating out from Harare
    const gd = svg('g', {}, s);
    const maxD = Math.hypot(data.w, data.h);
    data.dots.forEach(([x, y, home]) => {
      const c = svg('circle', { cx: x, cy: y, r: isZim ? 2.6 : 2.4, class: 'm-dot' + (home && !isZim ? ' is-home' : '') }, gd);
      const dist = Math.hypot(x - hq.x, y - hq.y) / maxD;
      c.style.opacity = 0;
      c.style.transition = `opacity .6s ${(dist * 2.2).toFixed(2)}s`;
    });

    // coverage rings on the Zimbabwe map (km -> px)
    const pxPerKm = isZim ? data.w / 8.3 / 111 : 0;
    if (isZim) {
      [[100, '100 km'], [250, '250 km'], [450, '450 km']].forEach(([km, label]) => {
        const r = km * pxPerKm;
        svg('circle', { cx: hq.x, cy: hq.y, r, fill: 'none', stroke: 'rgba(255,181,116,.35)', 'stroke-dasharray': '3 6' }, s);
        const t = svg('text', { x: hq.x + r * .7071 + 6, y: hq.y - r * .7071, class: 'm-label' }, s);
        t.textContent = label;
      });
    }

    // links from HQ
    const gl = svg('g', {}, s);
    const links = [];
    data.cities.filter(c => c.tier > 0).forEach((c, i) => {
      const soft = !isZim && c.tier === 2;
      const p = svg('path', { d: curve(hq, c, isZim ? .16 : .2), class: 'm-link' + (soft ? ' m-link--soft' : '') }, gl);
      links.push({ p, c, soft, i });
    });
    // regional mesh between tier-1/2 nodes (the polygonal network look)
    if (!isZim) {
      const others = data.cities.filter(c => c.tier > 0);
      others.forEach(a => {
        others.map(b => ({ b, d: Math.hypot(a.x - b.x, a.y - b.y) })).filter(o => o.d > 0)
          .sort((m, n) => m.d - n.d).slice(0, 2)
          .forEach(({ b }) => svg('path', { d: `M${a.x},${a.y} L${b.x},${b.y}`, class: 'm-link m-link--soft' }, gl));
      });
    }

    // nodes
    const gn = svg('g', {}, s);
    const tip = tipEl(host, 'map-tip glass glass--dark');
    const nodes = {};
    data.cities.forEach(c => {
      const g = svg('g', { class: 'm-node' + (c.tier === 0 ? ' is-hq' : ''), tabindex: 0, role: 'button', 'aria-label': c.name }, gn);
      if (c.tier === 0) { svg('circle', { cx: c.x, cy: c.y, r: 14, class: 'halo' }, g); svg('circle', { cx: c.x, cy: c.y, r: 14, class: 'halo' }, g); }
      svg('circle', { cx: c.x, cy: c.y, r: 14, fill: 'transparent' }, g);
      svg('circle', { cx: c.x, cy: c.y, r: c.tier === 0 ? 7 : c.tier === 1 ? 5 : 3.6, class: 'core' }, g);
      const showLabel = c.tier < 2 || isZim;
      if (showLabel) {
        const left = c.x > hq.x + 10 || (isZim && c.x > data.w * .7);
        const t = svg('text', { x: c.x + (left ? -12 : 12), y: c.y + 4, class: 'm-label', 'text-anchor': left && c.tier !== 0 ? 'end' : 'start' }, g);
        t.textContent = c.tier === 0 ? `${c.name} · HQ` : c.name;
      }
      const km = Math.round(Math.hypot((c.x - hq.x) * .95, c.y - hq.y) / (isZim ? pxPerKm : (data.w / 72 / 111)));
      const info = c.tier === 0 ? 'Head office · Hungwe House' : `≈ ${fmt(km)} km from Harare`;
      const show = () => {
        tip.innerHTML = `<b>${c.name}</b>${info}`;
        tip.style.left = (c.x + 20) / (data.w + 40) * 100 + '%';
        tip.style.top = (c.y + 20) / (data.h + 40) * 100 + '%';
        tip.classList.add('is-on');
        g.classList.add('is-active');
      };
      const hide = () => { tip.classList.remove('is-on'); g.classList.remove('is-active'); };
      g.addEventListener('mouseenter', show); g.addEventListener('focus', show);
      g.addEventListener('mouseleave', hide); g.addEventListener('blur', hide);
      nodes[c.name] = { show, hide };
    });

    host.appendChild(s);

    // city list drives the map
    const list = host.dataset.list && $(host.dataset.list);
    if (list) {
      $$('button', list).forEach(b => {
        b.addEventListener('mouseenter', () => nodes[b.dataset.city] && nodes[b.dataset.city].show());
        b.addEventListener('focus', () => nodes[b.dataset.city] && nodes[b.dataset.city].show());
        b.addEventListener('mouseleave', () => nodes[b.dataset.city] && nodes[b.dataset.city].hide());
        b.addEventListener('blur', () => nodes[b.dataset.city] && nodes[b.dataset.city].hide());
      });
    }

    const play = () => {
      $$('.m-dot', gd).forEach(d => (d.style.opacity = 1));
      links.forEach(({ p, soft, i }) => {
        const len = p.getTotalLength();
        p.style.strokeDasharray = soft ? '' : len;
        p.style.strokeDashoffset = soft ? '' : len;
        if (!soft) {
          p.style.transition = `stroke-dashoffset 1.6s cubic-bezier(.65,0,.35,1) ${(1 + i * .12).toFixed(2)}s`;
          requestAnimationFrame(() => requestAnimationFrame(() => (p.style.strokeDashoffset = 0)));
        }
        if (!reduced && !soft) {
          // a travelling pulse of energy along every primary link
          const dot = svg('circle', { r: 3, class: 'm-pulse' }, gl);
          const am = svg('animateMotion', { dur: `${(3 + (i % 4) * .6).toFixed(1)}s`, repeatCount: 'indefinite', begin: `${(2.4 + i * .2).toFixed(1)}s`, path: p.getAttribute('d') }, dot);
          dot.setAttribute('opacity', 0);
          svg('set', { attributeName: 'opacity', to: 1, begin: am.getAttribute('begin') }, dot);
        }
      });
    };
    host.addEventListener('reveal', play, { once: true });
    if (host.classList.contains('is-revealed')) play();
  };
  $$('[data-map]').forEach(drawMap);

  /* =============================== CHARTS ===================================== */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Indicative specific yield, kWh per kWp per month, for a well-oriented array in Harare.
  const YIELD_PER_KWP = [132, 124, 140, 138, 136, 124, 134, 152, 162, 167, 150, 140];

  const chartBase = (host, W0, H0, m) => {
    // Draw at the element's real width so type stays at its true size on any screen
    const W = Math.max(300, Math.round(host.clientWidth || W0));
    const H = W < 520 ? 250 : H0;
    host.innerHTML = '';
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': host.dataset.label || '' });
    host.appendChild(s);
    const tip = tipEl(host, 'chart-tip');
    return { s, tip, iw: W - m.l - m.r, ih: H - m.t - m.b, W, H, m };
  };
  const yAxis = (c, max, ticks, f = v => v) => {
    const g = svg('g', { class: 'grid' }, c.s);
    const a = svg('g', { class: 'axis' }, c.s);
    for (let i = 0; i <= ticks; i++) {
      const v = max / ticks * i;
      const y = c.m.t + c.ih - c.ih * (v / max);
      svg('line', { x1: c.m.l, x2: c.m.l + c.iw, y1: y, y2: y }, g);
      const t = svg('text', { x: c.m.l - 10, y: y + 4, 'text-anchor': 'end' }, a);
      t.textContent = f(v);
    }
    return a;
  };
  const place = (c, tip, x, y) => {
    tip.style.left = (x / c.W * 100) + '%';
    tip.style.top = (y / c.H * 100) + '%';
  };

  const charts = {
    yield(host) {
      const kwp = 5;
      const data = YIELD_PER_KWP.map(v => v * kwp);
      const c = chartBase(host, 640, 300, { t: 16, r: 10, b: 30, l: 46 });
      const max = 1000;
      const a = yAxis(c, max, 4, v => fmt(v));
      const bw = c.iw / 12;
      const best = data.indexOf(Math.max(...data));
      data.forEach((v, i) => {
        const h = c.ih * v / max, x = c.m.l + i * bw + bw * .2, w = bw * .6, y = c.m.t + c.ih - h, r = 4;
        const bar = svg('path', { d: `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`, class: 'bar grow' + (i === best ? ' is-hot' : '') }, c.s);
        bar.style.transitionDelay = (i * .05) + 's';
        const t = svg('text', { x: x + w / 2, y: c.m.t + c.ih + 20, 'text-anchor': 'middle' }, a);
        t.textContent = MONTHS[i];
        const hit = svg('rect', { x: c.m.l + i * bw, y: c.m.t, width: bw, height: c.ih, class: 'hit' }, c.s);
        const on = () => { bar.classList.add('is-hover'); c.tip.innerHTML = `<b>${MONTHS[i]}</b> · ${fmt(v)} kWh`; place(c, c.tip, x + w / 2, y); c.tip.classList.add('is-on'); };
        const off = () => { bar.classList.remove('is-hover'); c.tip.classList.remove('is-on'); };
        hit.addEventListener('mouseenter', on); hit.addEventListener('mouseleave', off);
        hit.addEventListener('touchstart', on, { passive: true });
      });
      const bx = c.m.l + best * bw + bw / 2;
      const lab = svg('text', { x: bx, y: c.m.t + c.ih - c.ih * data[best] / max - 10, 'text-anchor': 'middle', class: 'direct fade' }, c.s);
      lab.textContent = `${MONTHS[best]} peak · ${fmt(data[best])} kWh`;
      return { head: ['Month', 'kWh'], rows: data.map((v, i) => [MONTHS[i], fmt(v)]) };
    },

    daily(host) {
      const load = [.4, .35, .3, .3, .35, .6, 1.2, 1.6, 1.1, .9, .9, 1.0, 1.1, 1.0, .9, .9, 1.1, 1.6, 2.3, 2.4, 2.0, 1.4, .8, .5];
      const solar = Array.from({ length: 25 }, (_, h) => h < 6 || h > 18 ? 0 : +(4.1 * Math.pow(Math.sin(Math.PI * (h - 6) / 12), 1.25)).toFixed(2));
      load.push(load[0]);
      const c = chartBase(host, 640, 300, { t: 16, r: 14, b: 30, l: 40 });
      const max = 5;
      const a = yAxis(c, max, 5, v => v + ' kW');
      const X = h => c.m.l + c.iw * h / 24, Y = v => c.m.t + c.ih - c.ih * v / max;
      [0, 6, 12, 18, 24].forEach(h => { const t = svg('text', { x: X(h), y: c.m.t + c.ih + 20, 'text-anchor': 'middle' }, a); t.textContent = String(h % 24).padStart(2, '0') + ':00'; });
      const defs = svg('defs', {}, c.s);
      const g = svg('linearGradient', { id: 'solarFill', x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
      svg('stop', { offset: 0, 'stop-color': 'rgba(240,122,26,.35)' }, g);
      svg('stop', { offset: 1, 'stop-color': 'rgba(240,122,26,0)' }, g);
      const line = arr => arr.map((v, h) => `${h ? 'L' : 'M'}${X(h).toFixed(1)},${Y(v).toFixed(1)}`).join('');
      svg('path', { d: line(solar) + `L${X(24)},${Y(0)} L${X(0)},${Y(0)}Z`, class: 'area-solar fade' }, c.s);
      const ps = svg('path', { d: line(solar), class: 'series-solar draw' }, c.s);
      const pl = svg('path', { d: line(load), class: 'series-load draw' }, c.s);
      [ps, pl].forEach(p => p.style.setProperty('--len', p.getTotalLength()));
      const l1 = svg('text', { x: X(12), y: Y(solar[12]) - 12, 'text-anchor': 'middle', class: 'direct fade' }, c.s); l1.textContent = 'Solar generation';
      const l2 = svg('text', { x: X(19.5), y: Y(2.4) - 12, 'text-anchor': 'middle', class: 'direct fade' }, c.s); l2.textContent = 'Household load';
      const l3 = svg('text', { x: X(12), y: Y(2.1), 'text-anchor': 'middle', class: 'direct direct--muted fade' }, c.s); l3.textContent = 'Surplus → battery';
      const ch = svg('line', { y1: c.m.t, y2: c.m.t + c.ih, class: 'crosshair' }, c.s);
      const m1 = svg('circle', { r: 5, class: 'marker', fill: '#db6a12' }, c.s);
      const m2 = svg('circle', { r: 5, class: 'marker', fill: '#1d4fa8' }, c.s);
      const hit = svg('rect', { x: c.m.l, y: c.m.t, width: c.iw, height: c.ih, class: 'hit' }, c.s);
      const move = e => {
        const pt = e.touches ? e.touches[0] : e;
        const r = c.s.getBoundingClientRect();
        const h = Math.max(0, Math.min(24, Math.round(((pt.clientX - r.left) / r.width * c.W - c.m.l) / c.iw * 24)));
        ch.setAttribute('x1', X(h)); ch.setAttribute('x2', X(h));
        m1.setAttribute('cx', X(h)); m1.setAttribute('cy', Y(solar[h]));
        m2.setAttribute('cx', X(h)); m2.setAttribute('cy', Y(load[h]));
        host.classList.add('is-hovering');
        c.tip.innerHTML = `<b>${String(h % 24).padStart(2, '0')}:00</b><br><i style="background:#db6a12"></i>Solar ${solar[h].toFixed(1)} kW<br><i style="background:#1d4fa8"></i>Load ${load[h].toFixed(1)} kW`;
        place(c, c.tip, X(h), Y(Math.max(solar[h], load[h])));
        c.tip.classList.add('is-on');
      };
      hit.addEventListener('mousemove', move);
      hit.addEventListener('touchmove', move, { passive: true });
      hit.addEventListener('mouseleave', () => { host.classList.remove('is-hovering'); c.tip.classList.remove('is-on'); });
      return { head: ['Hour', 'Solar kW', 'Load kW'], rows: load.slice(0, 24).map((v, h) => [String(h).padStart(2, '0') + ':00', solar[h].toFixed(1), v.toFixed(1)]) };
    },

    payback(host) {
      const cost = 5600, first = 1080, esc = .05, years = 15;
      const cum = [0];
      for (let y = 1; y <= years; y++) cum.push(cum[y - 1] + first * Math.pow(1 + esc, y - 1));
      const c = chartBase(host, 640, 300, { t: 20, r: 16, b: 30, l: 54 });
      const max = 25000;
      const a = yAxis(c, max, 5, v => '$' + fmt(v / 1000) + 'k');
      const X = y => c.m.l + c.iw * y / years, Y = v => c.m.t + c.ih - c.ih * v / max;
      [0, 3, 6, 9, 12, 15].forEach(y => { const t = svg('text', { x: X(y), y: c.m.t + c.ih + 20, 'text-anchor': 'middle' }, a); t.textContent = 'Yr ' + y; });
      const defs = svg('defs', {}, c.s);
      const g = svg('linearGradient', { id: 'saveFill', x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
      svg('stop', { offset: 0, 'stop-color': 'rgba(0,42,116,.22)' }, g);
      svg('stop', { offset: 1, 'stop-color': 'rgba(0,42,116,0)' }, g);
      const d = cum.map((v, y) => `${y ? 'L' : 'M'}${X(y).toFixed(1)},${Y(v).toFixed(1)}`).join('');
      svg('path', { d: d + `L${X(years)},${Y(0)} L${X(0)},${Y(0)}Z`, class: 'area-save fade' }, c.s);
      const p = svg('path', { d, class: 'series-save draw' }, c.s);
      p.style.setProperty('--len', p.getTotalLength());
      svg('line', { x1: c.m.l, x2: c.m.l + c.iw, y1: Y(cost), y2: Y(cost), class: 'ref' }, c.s);
      const rl = svg('text', { x: c.m.l + 6, y: Y(cost) - 8, class: 'ref-label fade' }, c.s); rl.textContent = `System cost · $${fmt(cost)}`;
      const pb = cum.findIndex(v => v >= cost);
      const frac = pb - 1 + (cost - cum[pb - 1]) / (cum[pb] - cum[pb - 1]);
      svg('circle', { cx: X(frac), cy: Y(cost), r: 6, fill: '#f07a1a', stroke: '#fff', 'stroke-width': 2, class: 'fade' }, c.s);
      const pl = svg('text', { x: X(frac) + 10, y: Y(cost) + 22, class: 'direct fade' }, c.s); pl.textContent = `Paid back in ≈ ${frac.toFixed(1)} years`;
      const el = svg('text', { x: X(years) - 4, y: Y(cum[years]) - 10, 'text-anchor': 'end', class: 'direct fade' }, c.s); el.textContent = `$${fmt(Math.round(cum[years] / 100) * 100)} saved`;
      const ch = svg('line', { y1: c.m.t, y2: c.m.t + c.ih, class: 'crosshair' }, c.s);
      const mk = svg('circle', { r: 5, class: 'marker', fill: '#002a74' }, c.s);
      const hit = svg('rect', { x: c.m.l, y: c.m.t, width: c.iw, height: c.ih, class: 'hit' }, c.s);
      const move = e => {
        const pt = e.touches ? e.touches[0] : e;
        const r = c.s.getBoundingClientRect();
        const y = Math.max(0, Math.min(years, Math.round(((pt.clientX - r.left) / r.width * c.W - c.m.l) / c.iw * years)));
        ch.setAttribute('x1', X(y)); ch.setAttribute('x2', X(y));
        mk.setAttribute('cx', X(y)); mk.setAttribute('cy', Y(cum[y]));
        host.classList.add('is-hovering');
        c.tip.innerHTML = `<b>Year ${y}</b><br>Cumulative savings $${fmt(Math.round(cum[y]))}<br>${cum[y] >= cost ? 'Net gain $' + fmt(Math.round(cum[y] - cost)) : 'Still paying back'}`;
        place(c, c.tip, X(y), Y(cum[y]));
        c.tip.classList.add('is-on');
      };
      hit.addEventListener('mousemove', move);
      hit.addEventListener('touchmove', move, { passive: true });
      hit.addEventListener('mouseleave', () => { host.classList.remove('is-hovering'); c.tip.classList.remove('is-on'); });
      return { head: ['Year', 'Cumulative saving', 'Net position'], rows: cum.map((v, y) => [y, '$' + fmt(Math.round(v)), (v - cost < 0 ? '−$' : '$') + fmt(Math.abs(Math.round(v - cost)))]) };
    },
  };
  const chartHosts = $$('[data-chart]');
  let lastChartW = 0, rc;
  addEventListener('resize', () => {
    clearTimeout(rc);
    rc = setTimeout(() => {
      const w = chartHosts[0] && chartHosts[0].clientWidth;
      if (!w || Math.abs(w - lastChartW) < 40) return;
      lastChartW = w;
      chartHosts.forEach(h => charts[h.dataset.chart] && charts[h.dataset.chart](h));
    }, 200);
  });
  chartHosts.forEach(h => {
    lastChartW = h.clientWidth;
    const t = charts[h.dataset.chart] && charts[h.dataset.chart](h);
    const slot = t && $(`[data-table="${h.dataset.chart}"]`);
    if (slot) slot.innerHTML = `<table><thead><tr>${t.head.map(x => `<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    h.addEventListener('reveal', () => h.classList.add('is-drawn'), { once: true });
    if (reduced) h.classList.add('is-drawn');
  });

  /* =============================== CALCULATOR ===================================== */
  const calc = $('[data-calc]');
  if (calc) {
    const out = k => $(`[data-out="${k}"]`);
    const YIELD = YIELD_PER_KWP.reduce((a, b) => a + b, 0); // kWh per kWp per year
    const PANEL_W = 550, COST_KWP = 850, COST_KWH = 420;
    const fill = r => r.style.setProperty('--fill', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
    const run = () => {
      const bill = +calc.bill.value, tariff = +calc.tariff.value / 100, backup = +calc.backup.value;
      const type = calc.querySelector('input[name="type"]:checked').value;
      const share = { home: .85, business: .9, farm: .8 }[type];
      calc.querySelector('[for="bill"] output').textContent = '$' + fmt(bill);
      calc.querySelector('[for="tariff"] output').textContent = '$' + tariff.toFixed(2) + ' /kWh';
      calc.querySelector('[for="backup"] output').textContent = backup + ' hrs';
      $$('input[type="range"]', calc).forEach(fill);
      const monthlyKwh = bill / tariff;
      const kwp = Math.max(1, Math.ceil(monthlyKwh * 12 * share / YIELD * 2) / 2);
      const panels = Math.ceil(kwp * 1000 / PANEL_W);
      const avgLoadKw = monthlyKwh / 30 / 24 * 1.6; // evening load runs above the daily average
      const battery = Math.max(2.5, Math.ceil(avgLoadKw * backup / .9 / 2.5) * 2.5);
      const capex = kwp * COST_KWP + battery * COST_KWH;
      const saving = Math.min(bill * share, kwp * YIELD / 12 * tariff);
      const payback = capex / (saving * 12);
      out('kwp').textContent = kwp.toFixed(1);
      out('panels').textContent = panels;
      out('battery').textContent = battery.toFixed(1) + ' kWh';
      out('saving').textContent = '$' + fmt(Math.round(saving));
      out('capex').textContent = '$' + fmt(Math.round(capex / 100) * 100);
      out('payback').textContent = payback.toFixed(1) + ' yrs';
    };
    calc.addEventListener('input', run);
    run();
  }
})();
