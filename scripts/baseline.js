/* Record the visual + SEO baseline of the live pages (BUILD_TASKS P0-T2).
 *
 *   node scripts/baseline.js
 *
 * Captures every root .html page at 1280px (desktop) and 390px (phone) into
 * baseline/screens/, and each page's rendered <head> into baseline/head/.
 * These are the regression references the renderer must match later, so they
 * are taken the way production actually serves: static files, NO API. The
 * pages then fall back to ./data/*.json exactly as they do on GitHub Pages.
 *
 * baseline/ is gitignored. It is a local reference, never deployed.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'baseline');
const PORT = 4177;
const WIDTHS = [{ w: 1280, h: 900, tag: '1280' }, { w: 390, h: 844, tag: '390' }];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

/* A static server with no /api, so the pages take their production fallback path. */
function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let rel;
      try { rel = decodeURIComponent(req.url.split('?')[0]); } catch (e) { rel = req.url.split('?')[0]; }
      if (rel.indexOf('/api/') === 0) { res.writeHead(404).end('no api (this is the static baseline)'); return; }
      if (rel === '/') rel = '/index.html';
      const full = path.join(ROOT, rel);
      if (full.indexOf(ROOT) !== 0) { res.writeHead(403).end('nope'); return; }
      fs.readFile(full, (err, buf) => {
        if (err) { res.writeHead(404).end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    server.listen(PORT, () => resolve(server));
  });
}

/* The product images live on Google Drive and the fonts on Google Fonts. Asked
   for them with a localhost Referer, Drive answers 429 as text/html, which
   Chrome then refuses to use as an image (ERR_BLOCKED_BY_ORB), so the capture
   would show broken images and fallback typography instead of the real page.
   Re-request those hosts from Node with the production Referer, which is what
   a visitor's browser actually sends. */
const SITE = 'https://www.wonder-herb.com/';
const PROXY_HOSTS = /^https:\/\/(lh3\.googleusercontent\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

async function proxyExternal(page) {
  await page.route(PROXY_HOSTS, async route => {
    try {
      const r = await fetch(route.request().url(), {
        headers: { Referer: SITE, 'User-Agent': await page.evaluate(() => navigator.userAgent) },
      });
      const body = Buffer.from(await r.arrayBuffer());
      await route.fulfill({
        status: r.status,
        contentType: r.headers.get('content-type') || 'application/octet-stream',
        body: body,
      });
    } catch (e) { await route.abort(); }
  });
}

/* Wait for the client-rendered content to actually be there, not just for load.
   Returns the text length so a blank shell is caught rather than saved. */
async function waitForContent(page) {
  try { await page.waitForLoadState('networkidle', { timeout: 15000 }); }
  catch (e) { /* a .glb or video can keep the network busy; keep going */ }

  // settle: the rendered text must stop growing across two samples
  let last = -1, stable = 0;
  for (let i = 0; i < 40 && stable < 2; i++) {
    const len = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').trim().length);
    if (len === last && len > 0) stable++; else { stable = 0; last = len; }
    await page.waitForTimeout(250);
  }
  return last;
}

/* Scroll-reveal sections start at opacity:0 until IntersectionObserver fires.
   Walk the page so they reveal, then return to the top before capturing. */
async function revealAll(page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.8);
    const end = document.body.scrollHeight;
    for (let y = 0; y < end; y += step) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 400));
  });
}

/* Freeze animation so two captures of the same page are comparable. */
const FREEZE = `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;
  transition-duration:0s!important;transition-delay:0s!important;
  animation-play-state:paused!important;caret-color:transparent!important}
  html{scroll-behavior:auto!important}`;

async function main() {
  const pages = fs.readdirSync(ROOT).filter(f => f.toLowerCase().endsWith('.html')).sort();
  if (!pages.length) throw new Error('no .html pages found at the repo root');

  fs.mkdirSync(path.join(OUT, 'screens'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'head'), { recursive: true });

  const server = await serve();
  const browser = await chromium.launch();
  const report = [];
  let thin = 0;

  console.log('Recording baseline from a static server on :' + PORT + ' (no API, like production)\n');

  for (const file of pages) {
    const slug = file.replace(/\.html$/i, '');
    const url = 'http://localhost:' + PORT + '/' + encodeURIComponent(file);
    const row = { page: file, text: {}, shots: [] };

    for (const size of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width: size.w, height: size.h },
        deviceScaleFactor: 1,
        isMobile: size.w < 500,
        hasTouch: size.w < 500,
        reducedMotion: 'reduce',
      });
      const page = await ctx.newPage();
      await proxyExternal(page);
      const failed = [];
      page.on('requestfailed', r => {
        // /api/ refusals are the point: production has no API and falls back to data/.
        // A proxied host reports ERR_ABORTED because we replaced the request ourselves.
        const aborted = /ERR_ABORTED/.test((r.failure() || {}).errorText || '');
        if (/\/api\//.test(r.url())) return;
        if (aborted && PROXY_HOSTS.test(r.url())) return;
        failed.push(r.url());
      });

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.addStyleTag({ content: FREEZE });
      const len = await waitForContent(page);
      await revealAll(page);
      await page.waitForTimeout(300);

      const shot = path.join(OUT, 'screens', slug + '.' + size.tag + '.png');
      // some pages are very tall; a full-page capture needs longer than the 30s default
      await page.screenshot({ path: shot, fullPage: true, animations: 'disabled',
                              caret: 'hide', timeout: 180000 });

      const bytes = fs.statSync(shot).size;
      row.text[size.tag] = len;
      row.shots.push({ width: size.tag, bytes: bytes });
      if (len < 200) thin++;

      // the <head> as rendered, once, from the desktop pass
      if (size.tag === '1280') {
        const head = await page.evaluate(() => document.head.outerHTML);
        fs.writeFileSync(path.join(OUT, 'head', slug + '.html'), head, 'utf8');
        row.headBytes = Buffer.byteLength(head, 'utf8');
        row.jsonLd = await page.evaluate(() =>
          Array.from(document.querySelectorAll('script[type="application/ld+json"]')).length);
        row.h1 = await page.evaluate(() => document.querySelectorAll('h1').length);
        row.title = await page.title();
        // an image that never decoded has naturalWidth 0; a broken baseline is worse than none
        row.images = await page.evaluate(() => {
          const imgs = Array.from(document.images);
          return { total: imgs.length, broken: imgs.filter(i => !i.naturalWidth).length };
        });
        row.webfonts = await page.evaluate(() =>
          document.fonts && document.fonts.check ? document.fonts.check('16px Inter') : null);
      }
      if (failed.length) {
        row.assetFails = failed.length;
        row.assetFailUrls = Array.from(new Set(failed.map(u => u.replace('http://localhost:' + PORT, ''))));
      }
      row.height = await page.evaluate(() => document.body.scrollHeight);
      await ctx.close();
    }

    console.log('  ' + file.padEnd(26) +
      'text ' + String(row.text['1280']).padStart(6) + '/' + String(row.text['390']).padStart(6) +
      '  ld+json ' + row.jsonLd + '  h1 ' + row.h1 +
      '  img ' + (row.images.total - row.images.broken) + '/' + row.images.total +
      '  Inter ' + (row.webfonts ? 'y' : 'n') +
      (row.assetFails ? '  [' + row.assetFails + ' asset 404]' : '') +
      (row.text['1280'] < 200 ? '  <-- THIN, CHECK THIS' : ''));
    report.push(row);
  }

  await browser.close();
  server.close();

  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

  const shots = fs.readdirSync(path.join(OUT, 'screens')).filter(f => f.endsWith('.png')).length;
  const heads = fs.readdirSync(path.join(OUT, 'head')).filter(f => f.endsWith('.html')).length;
  console.log('\n' + pages.length + ' page(s), ' + shots + ' screenshot(s), ' + heads + ' head snapshot(s)');
  if (thin) console.log('WARNING: ' + thin + ' capture(s) look nearly empty. The baseline is only useful if they are real.');
  return thin;
}

main().then(thin => process.exit(thin ? 1 : 0))
      .catch(err => { console.error('baseline failed:', err); process.exit(1); });
