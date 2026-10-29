// Browser QA for one page. Run through the browser-automation runner:
//   node browser.mjs http://127.0.0.1:8642/index.html --script _src/tools/qa.mjs
export default async function run(page) {
  const url = page.url();
  const out = { page: url.split('/').pop() };
  const settle = ms => page.waitForTimeout(ms);
  const skipPre = () => page.evaluate(() => sessionStorage.setItem('aei-seen', '1'));
  await skipPre();

  // Small text to measure (headings excluded: wrapping there is correct typography)
  const SEL = 'main p, main li, main .chip, main .btn > span:first-child, main h3, main .eyebrow, main figcaption b, main label, main .tab b, main summary';
  const measure = () => page.evaluate(SEL => [...document.querySelectorAll(SEL)].map(el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || el.closest('[hidden]') || !el.offsetParent) return null;
    const inner = el.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    return { t: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 60), n: Math.max(1, Math.round(inner / lh)), chars: el.textContent.trim().length };
  }), SEL);

  const sizes = [[1280, 800], [390, 844]];
  const lines = {};
  out.overflow = {};
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.reload({ waitUntil: 'load' }); await settle(1200);
    out.overflow[w] = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    lines[w] = await measure();
  }
  out.wrapsOnMobile = []; out.longOnMobile = [];
  lines[1280].forEach((d, i) => {
    const m = lines[390][i];
    if (!d || !m) return;
    if (d.n === 1 && m.n >= 2 && d.chars < 60) out.wrapsOnMobile.push(`${m.n}L ${d.t}`);
    if (m.n >= 5) out.longOnMobile.push(`${m.n}L ${m.t}`);
  });

  // Hero fits one screen at real sizes
  if (await page.$('.hero')) {
    out.heroFit = {};
    for (const [w, h] of [[1440, 900], [1366, 768], [1280, 720], [1280, 640], [1440, 1080], [390, 844]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.reload({ waitUntil: 'load' }); await settle(2400); // let the entrance transition finish
      out.heroFit[`${w}x${h}`] = await page.evaluate(() => {
        const els = [...document.querySelectorAll('.hero .notch, .hero__content, .hero__title')];
        const bottom = Math.max(...els.map(e => e.getBoundingClientRect().bottom));
        const t = document.querySelector('.hero__title').getBoundingClientRect().top;
        return bottom <= innerHeight + 1 && t > 60 ? 'ok' : `FAIL bottom ${Math.round(bottom)} / ${innerHeight}, title top ${Math.round(t)}`;
      });
    }
  }

  // Stretched images
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload({ waitUntil: 'load' }); await settle(800);
  out.stretched = await page.evaluate(() => [...document.images].filter(i => {
    const cs = getComputedStyle(i);
    if (cs.objectFit !== 'fill' || !i.naturalWidth || !i.clientWidth) return false;
    return Math.abs(i.clientWidth / i.clientHeight - i.naturalWidth / i.naturalHeight) > 0.03;
  }).map(i => i.src.split('/').pop()));

  // Mobile navigation opens, locks scroll, closes
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'load' }); await settle(800);
  await page.click('[data-menu-toggle]'); await settle(900);
  const opened = await page.evaluate(() => ({
    open: document.documentElement.classList.contains('menu-open'),
    locked: getComputedStyle(document.documentElement).overflow === 'hidden',
    visible: getComputedStyle(document.querySelector('[data-mobile-menu]')).visibility === 'visible',
  }));
  await page.keyboard.press('Escape'); await settle(900);
  const closed = await page.evaluate(() => !document.documentElement.classList.contains('menu-open'));
  out.mobileNav = opened.open && opened.locked && opened.visible && closed ? 'ok' : JSON.stringify({ ...opened, closed });

  // Renders without JavaScript: serve the page with every script stripped
  const htmlText = await (await page.request.get(url)).text();
  await page.route(url, r => r.fulfill({ status: 200, contentType: 'text/html', body: htmlText.replace(/<script[\s\S]*?<\/script>/g, '') }));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(url, { waitUntil: 'load' }); await settle(600);
  out.noJs = await page.evaluate(() => {
    const hidden = [...document.querySelectorAll('[data-reveal], [data-hero], [data-reveal="clip"] > img, .strips figure')]
      .filter(e => getComputedStyle(e).opacity === '0' || getComputedStyle(e).clipPath.startsWith('inset(100%'));
    const pre = document.querySelector('.preloader');
    return { hiddenEls: hidden.length, preloaderShown: pre ? getComputedStyle(pre).display !== 'none' : false, textChars: document.body.innerText.length };
  });
  await page.unroute(url);
  return out;
}
