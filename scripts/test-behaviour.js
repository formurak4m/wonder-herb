/* test:behaviour - a migrated page's interactive behaviour, verified BY EFFECT.
 *
 * docs/FINDINGS.md finding 23 and BUILD_TASKS Appendix A: 產品介紹 passed SEO,
 * fidelity and the visual diff while its cart, phone menu, quick view and
 * language switcher were all dead - and it threw no errors, because nothing was
 * bound. "No errors" is not verification. So every check here asserts an
 * outcome a visitor would notice (the menu opened, the cart holds the right
 * product at the right price), and a NEGATIVE CONTROL re-runs the same checks
 * with the behaviour files missing and requires them to FAIL. A check that
 * still passes without the code behind it is not testing that code.
 *
 *   PART 1  the SKU -> cart id table, cross-checked against
 *           independent sources (no browser)
 *   PART 2  the published page in Chromium, like production: a static server,
 *           no API, a production-like hostname (finding 21), 1280 and 390
 *   PART 3  scripts off
 *   PART 4  negative controls
 *   PART 5  every OTHER published tree: the shared site.js behaviour (badge,
 *           phone menu, language switch), scripts off, and a no-site.js
 *           negative control per page - found from data/pages/, never named
 *
 * The page is rendered in memory from the REAL tree. Most checks use a copy of
 * the real product data with stock states set by the test, so the happy path
 * and every refusal are exercised whatever the database says today; one pass
 * uses the real data unchanged. Nothing is written to data/ or renderer/.out/.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const HOST = 'wonder-herb.test';
const PAGE = '產品介紹.html';

let fail = 0;
const check = (label, cond, extra) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '   -> ' + extra : ''));
  if (!cond) fail++;
};

const site = require(path.join(ROOT, 'assets', 'site.js'));
const { CART_IDS, PRICE_HOLD, CART_KEY, LANG_KEY } = site;

/* The ORIGINAL hand-coded page: legacy/<name> once retired, else the root.
   Never the pre-rendered output that replaces it (renderer/source-page.js). */
const { originalPagePath, isRetired } = require(path.join(ROOT, 'renderer', 'source-page.js'));

/* A page still hand-coded, with its own client-side language switch - the
   "a live page follows the choice" half of languageSwitch. It cannot be a page
   this batch has migrated: a pre-rendered page is Chinese only by design
   (finding 24), so it would never follow the choice and the check would fail
   for the wrong reason. So the probe is found, not named: a root page with no
   tree in data/pages/ and nothing in legacy/. It was 常見問題 until that page
   migrated, and 聯絡我們 until this one did. */
const LIVE_PAGE = (() => {
  const migrated = new Set(fs.readdirSync(path.join(ROOT, 'data', 'pages'))
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'pages', f), 'utf8')).path));
  const page = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'))
    .filter(f => !migrated.has(f) && !isRetired(f))
    .filter(f => /const translations/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')))
    .sort()[0];
  if (!page) throw new Error('no hand-coded page left to prove the language choice carries');
  return page;
})();
function livePage(name) {
  const f = originalPagePath(name);
  return f ? fs.readFileSync(f, 'utf8') : null;
}

/* Evaluate an object literal lifted out of a repo file (the same technique
   scripts/migrate-products.js uses on productData). */
function literal(src, re, what) {
  const m = src && src.match(re);
  if (!m) throw new Error('could not find ' + what);
  return eval('(' + m[1] + ')');
}

/* ================================================================ PART 1 */

console.log('\n=== PART 1: SKU -> cart id, against three independent sources ===\n');

const migrate = fs.readFileSync(path.join(ROOT, 'scripts', 'migrate-products.js'), 'utf8');
const MATCH = literal(migrate, /const MATCH = (\{[\s\S]*?\});/, 'MATCH in scripts/migrate-products.js');
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8').replace(/^﻿/, ''));
const bySku = Object.fromEntries(products.map(p => [p.sku, p]));
const same = (a, b) => JSON.stringify(Object.keys(a).sort()) === JSON.stringify(Object.keys(b).sort());

check('the table names exactly the SKUs in data/products.json',
      same(CART_IDS, bySku), Object.keys(CART_IDS).length + ' SKUs');

// source 1: the hand-checked migration table
check('source 1, scripts/migrate-products.js MATCH: every SKU maps to the same cart id',
      same(CART_IDS, MATCH) && Object.keys(CART_IDS).every(s => CART_IDS[s] === MATCH[s]),
      Object.keys(CART_IDS).map(s => s + '=' + CART_IDS[s]).join(' '));

// the trap this table exists to avoid: the database's own ids must NOT pass source 1
const dbIds = Object.fromEntries(products.map(p => [p.sku, p.id]));
const wrong = Object.keys(dbIds).filter(s => dbIds[s] !== MATCH[s]);
check('negative control: binding by the DATABASE id would fail source 1',
      wrong.length > 0, wrong.length + ' of 6 database ids name a different product, e.g. ' +
      wrong.slice(0, 2).map(s => s + ' db ' + dbIds[s] + ' vs cart ' + MATCH[s]).join(', '));

// source 2: WH_SKU_PAGES, which every original hand-coded page carries
const pageFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const skuMaps = pageFiles.map(f => [f, livePage(f)])
  .filter(([, h]) => /const WH_SKU_PAGES = \{/.test(h))
  .map(([f, h]) => [f, literal(h, /const WH_SKU_PAGES = (\{[\s\S]*?\});/, 'WH_SKU_PAGES in ' + f)]);
const SKU_PAGES = skuMaps.length ? skuMaps[0][1] : {};
check('source 2, WH_SKU_PAGES: present and identical on every page that carries it',
      skuMaps.length > 0 && skuMaps.every(([, m]) => JSON.stringify(m) === JSON.stringify(SKU_PAGES)),
      skuMaps.length + ' page(s)');
check('WH_SKU_PAGES names the same SKUs, and the data links each SKU to that page',
      same(SKU_PAGES, CART_IDS) && Object.keys(CART_IDS).every(s => bySku[s].link === SKU_PAGES[s]),
      'data link == WH_SKU_PAGES for all');

// source 3: each detail page's own cart id, and the old catalogue's id for that page
const catalogueSrc = livePage(PAGE);
const catalogue = literal(catalogueSrc, /const productData = (\{[\s\S]*?\n    \});/, 'productData in ' + PAGE).zh;
const detail = {};
Object.keys(CART_IDS).forEach(sku => {
  const html = livePage(SKU_PAGES[sku]);
  const m = html && html.match(/currentProduct\s*=\s*\{\s*id:\s*(\d+),[^}]*?price:\s*([\d.]+)/);
  detail[sku] = m ? { id: Number(m[1]), price: Number(m[2]) } : null;
});
const withCart = Object.keys(detail).filter(s => detail[s]);
check('source 3, detail pages: each page that sells writes the same cart id',
      withCart.length >= 5 && withCart.every(s => detail[s].id === CART_IDS[s]),
      withCart.map(s => SKU_PAGES[s].replace('.html', '') + '=' + detail[s].id).join(' ') +
      '   (' + Object.keys(detail).filter(s => !detail[s]).join(', ') + ' has no cart on its page)');
check('and the old catalogue\'s card for that id links to that SKU\'s page',
      Object.keys(CART_IDS).every(s => { const c = catalogue.find(x => x.id === CART_IDS[s]); return c && c.link === SKU_PAGES[s]; }),
      'productData.zh, all ' + Object.keys(CART_IDS).length);

console.log('\n=== PART 1: prices come from data/products.json ===\n');

/* OWNER DECISION, 15 Sep 2026: the site content is not authoritative, so the
   database price is THE price and nothing is held. The old pages' own numbers
   are printed for the record only - a difference is background (findings 9,
   23), not a failure. The hold MECHANISM is still tested in PART 2. */
check('no SKU is on price hold (owner decision: data/products.json is the price)',
      Object.keys(PRICE_HOLD).length === 0, Object.keys(PRICE_HOLD).join(', ') || 'none held');
check('every SKU has a usable price in the data (a card with no price would be refused as no-price)',
      Object.keys(CART_IDS).every(s => parseFloat(bySku[s].price) > 0),
      Object.keys(CART_IDS).map(s => s + ' ' + bySku[s].price).join(', '));
Object.keys(CART_IDS).forEach(sku => {
  const old = [];
  const card = catalogue.find(x => x.id === CART_IDS[sku]);
  if (card && card.price !== parseFloat(bySku[sku].price)) old.push('old catalogue ' + card.price);
  if (detail[sku] && detail[sku].price !== parseFloat(bySku[sku].price)) old.push('old detail page ' + detail[sku].price);
  if (old.length) console.log('        note: ' + sku + ' sells at ' + bySku[sku].price + ' from the data; ' + old.join(', ') + ' (background, not a blocker)');
});

/* ================================================================ render */

execFileSync(process.execPath, [path.join(ROOT, 'renderer', 'build-sections.js')], { cwd: ROOT, stdio: 'pipe' });
const render = require(path.join(ROOT, 'renderer', 'render.js'));
const tree = render.loadTree(path.join(ROOT, 'data', 'pages', 'products.json'));
const chrome = render.loadChrome(tree.assets.chromeFrom);
const styles = render.loadStyles(tree.assets.stylesFrom);
const realData = render.loadData();

/* The controlled catalogue: real products, stock states set here. */
const OUT_SKU = 'WH-T3-120', CLINIC_SKU = 'WH-HB-180', BUY_SKU = 'WH-PSP-500', BUY2_SKU = 'WH-PSP-060';
const fixture = JSON.parse(JSON.stringify(realData));
fixture.products.forEach(p => {
  p.status = p.sku === OUT_SKU ? 'Out of Stock' : 'In Stock';
  if (p.sku === CLINIC_SKU) p.clinicOnly = true;
});
const html = {
  fixture: render.renderPage(tree, 'zh', fixture, { chrome, styles }),
  real: render.renderPage(tree, 'zh', realData, { chrome, styles })
};

/* Scripts off, for measuring: every script removed and each <noscript> style
   unwrapped - what a browser with JavaScript disabled applies. (Playwright
   cannot measure a page in a context with JavaScript disabled.) */
html.nojs = html.fixture
  .replace(/<script\b(?![^>]*application\/ld\+json)[\s\S]*?<\/script>/gi, '')
  .replace(/<noscript>([\s\S]*?)<\/noscript>/gi, '$1');
/* ...and its negative control: the same, but without the template's
   scripts-off rules (the reveal rule is kept, so only the controls differ). */
html.nojsUnguarded = html.fixture
  .replace(/<script\b(?![^>]*application\/ld\+json)[\s\S]*?<\/script>/gi, '')
  .replace(/<noscript><style>\s*\/\* controls that need JavaScript[\s\S]*?<\/noscript>/i, '')
  .replace(/<noscript>([\s\S]*?)<\/noscript>/gi, '$1');

const NAME = Object.fromEntries(fixture.products.map(p => [p.sku, typeof p.title === 'object' ? p.title.zh : p.title]));

/* ================================================================ server */

const SCENARIOS = {
  fixture:       { html: html.fixture },
  real:          { html: html.real },
  nojs:          { html: html.nojs },
  'nojs-unguarded': { html: html.nojsUnguarded },
  'no-site':     { html: html.fixture, block: ['assets/site.js'] },
  'no-quickview':{ html: html.fixture, block: ['assets/behaviour/quick-view.js'] }
};

/* EVERY OTHER PUBLISHED PAGE (P9, from page two on). The product checks above
   are 產品介紹's own; what every pre-rendered page shares is assets/site.js -
   the badge, the phone menu, the language switch - and the scripts-off rules.
   Each other tree in data/pages/ is rendered from the real data and gets those
   checks, plus a no-site.js negative control of its own. A new page is covered
   by adding its tree; nothing here names it. */
const stripScripts = h => h.replace(/<script\b(?![^>]*application\/ld\+json)[\s\S]*?<\/script>/gi, '');
const OTHER_PAGES = render.publishedTrees().map(render.loadTree).filter(t => t.path !== PAGE).map(t => {
  const page = render.renderPage(t, 'zh', realData,
    { chrome: render.loadChrome(t.assets.chromeFrom), styles: render.loadStyles(t.assets.stylesFrom) });
  const key = 'p-' + t.slug;
  SCENARIOS[key] = { html: page, page: t.path };
  SCENARIOS[key + '-no-site'] = { html: page, page: t.path, block: ['assets/site.js'] };
  /* every per-section behaviour file this page links, for its own control */
  SCENARIOS[key + '-no-behaviour'] = { html: page, page: t.path,
    block: (page.match(/assets\/behaviour\/[^"]+/g) || []) };
  SCENARIOS[key + '-nojs'] = { page: t.path,
    html: stripScripts(page).replace(/<noscript>([\s\S]*?)<\/noscript>/gi, '$1') };
  SCENARIOS[key + '-nojs-unguarded'] = { page: t.path,
    html: stripScripts(page).replace(/<noscript><style>\s*\/\* controls that need JavaScript[\s\S]*?<\/noscript>/i, '')
                            .replace(/<noscript>([\s\S]*?)<\/noscript>/gi, '$1') };
  const h1 = (page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '';
  return { key, file: t.path, h1: h1.replace(/<[^>]+>/g, '').trim(), sections: t.sections.map(n => n.type) };
});

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8' };

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let rel;
      try { rel = decodeURIComponent(req.url.split('?')[0]); } catch (e) { rel = req.url.split('?')[0]; }
      if (rel.indexOf('/api/') === 0) { res.writeHead(404).end('no api - production has none'); return; }
      const m = rel.match(/^\/s\/([^/]+)\/(.*)$/);
      const sc = m && SCENARIOS[m[1]];
      const file = m ? m[2] : rel.replace(/^\//, '');
      if (sc && sc.block && sc.block.indexOf(file) !== -1) { res.writeHead(404).end('blocked by the negative control'); return; }
      if (sc && file === (sc.page || PAGE)) {
        res.writeHead(200, { 'Content-Type': MIME['.html'] }).end(sc.html);
        return;
      }
      const full = path.join(ROOT, file);
      if (full.indexOf(ROOT) !== 0) { res.writeHead(403).end(); return; }
      fs.readFile(full, (err, buf) => {
        if (err) { res.writeHead(404).end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream' }).end(buf);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));   // any free port: never collides with the API or a baseline run
  });
}

/* ================================================================ browser */

let browser, port;
const WIDTHS = { 1280: { width: 1280, height: 900 }, 390: { width: 390, height: 844 } };
const url = (scenario, file) => 'http://' + HOST + ':' + port + '/s/' + scenario + '/' + encodeURIComponent(file || PAGE);

async function newPage(ctx) {
  const page = await ctx.newPage();
  page._dialogs = []; page._errors = []; page._consoleErrors = [];
  page.on('dialog', d => { page._dialogs.push(d.message()); d.accept().catch(() => {}); });
  page.on('pageerror', e => page._errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') page._consoleErrors.push(m.text()); });
  return page;
}

async function context(width) {
  const ctx = await browser.newContext({ viewport: WIDTHS[width], isMobile: width < 500, hasTouch: width < 500 });
  // this host only: fonts, icons and Drive photos are not what is under test
  await ctx.route('**/*', r => new URL(r.request().url()).hostname === HOST ? r.continue() : r.abort());
  return ctx;
}

const cart = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '[]'), CART_KEY);
const badges = page => page.evaluate(() => Array.from(document.querySelectorAll('.cart-count')).map(e => e.textContent));
const modalOpen = page => page.evaluate(() => getComputedStyle(document.getElementById('quickViewModal')).display !== 'none');
const until = async (fn, ms) => {
  const end = Date.now() + (ms || 2000);
  while (Date.now() < end) {
    if (await fn().catch(() => false)) return true;
    await new Promise(r => setTimeout(r, 50));
  }
  return false;
};

async function quickView(page, sku) {
  await page.click('.product-card[data-sku="' + sku + '"] .btn-quickview', { timeout: 2000 });
  return until(() => modalOpen(page), 1500);
}

/* Add through the UI. Returns what the visitor was SHOWN, in the page (never a
   dialog): { where: 'modal' | 'notice', text, modalStayedOpen } or null.
   A refusal leaves the modal open by design; the helper closes it afterwards
   so the next card can be clicked. */
async function addViaModal(page, sku, qty) {
  if (!(await quickView(page, sku))) return null;
  await page.evaluate(() => { const n = document.getElementById('cartNotice'); if (n) n.remove(); });
  await page.fill('#modalQty', String(qty || 1));
  await page.click('#modalAddToCart', { timeout: 2000 });
  let shown = null;
  await until(async () => {
    shown = await page.evaluate(() => {
      const m = document.getElementById('modalMessage');
      if (m && !m.hidden && m.textContent) return { where: 'modal', text: m.textContent };
      const n = document.getElementById('cartNotice');
      if (n) return { where: 'notice', text: n.firstChild.textContent };
      return null;
    });
    return Boolean(shown);
  }, 1500);
  if (!shown) return null;
  shown.modalStayedOpen = await modalOpen(page);
  if (shown.modalStayedOpen) {
    await page.click('#quickViewModal .close-modal');
    await until(async () => !(await modalOpen(page)), 1000);
  }
  return shown;
}

/* Each effect returns true/false, never throws: the negative controls need
   an honest false from a missing behaviour, not a crash. */
const safely = fn => fn().then(v => Boolean(v), () => false);

const EFFECTS = {
  async menuOpens(width) {
    if (width !== 390) return true;
    const ctx = await context(390); const page = await newPage(ctx);
    try {
      await page.goto(url(this.scenario, this.file), { waitUntil: 'load' });
      await page.click('#menuToggle', { timeout: 2000 });
      const opened = await until(() => page.evaluate(() => {
        const p = document.getElementById('headerNavPanel');
        return p.classList.contains('is-open') && p.getBoundingClientRect().height > 100 &&
               document.getElementById('menuToggle').getAttribute('aria-expanded') === 'true';
      }), 1500);
      await page.keyboard.press('Escape');
      const closed = await until(() => page.evaluate(() => !document.getElementById('headerNavPanel').classList.contains('is-open')), 1000);
      return opened && closed;
    } finally { await ctx.close(); }
  },

  async quickViewAllSix(width) {
    const ctx = await context(width); const page = await newPage(ctx);
    try {
      await page.goto(url(this.scenario, this.file), { waitUntil: 'load' });
      for (const sku of Object.keys(CART_IDS)) {
        if (!(await quickView(page, sku))) return false;
        const shown = await page.evaluate(() => ({ sku: document.getElementById('quickViewModal').getAttribute('data-sku'),
                                                   title: document.getElementById('modalTitle').textContent }));
        if (shown.sku !== sku || shown.title !== NAME[sku]) return false;
        await page.click('#quickViewModal .close-modal');
        if (!(await until(async () => !(await modalOpen(page)), 1000))) return false;
      }
      return true;
    } finally { await ctx.close(); }
  },

  async addStandardPack(width) {
    const ctx = await context(width); const page = await newPage(ctx);
    try {
      await page.goto(url(this.scenario, this.file), { waitUntil: 'load' });
      const said = await addViaModal(page, BUY_SKU, 2);
      const items = await cart(page);
      const it = items[0] || {};
      const b = await badges(page);
      this.detail = JSON.stringify(it.product || {}) + ' x' + it.quantity + ', badges ' + b.join('/') +
                    ', shown ' + (said ? said.where + ' "' + said.text + '"' : 'nothing') + ', dialogs ' + page._dialogs.length;
      // confirmed inline, in a status bar, with the modal closed - and no browser dialog
      if (!(said && said.where === 'notice' && !said.modalStayedOpen && said.text.indexOf('已將 2 件') === 0 &&
            said.text.indexOf(NAME[BUY_SKU]) !== -1 && page._dialogs.length === 0)) return false;
      if (!(items.length === 1 && it.productId === 2 && it.product.id === 2 && it.product.sku === BUY_SKU &&
            it.product.price === 3800 && it.quantity === 2 && it.product.name === NAME[BUY_SKU])) return false;
      if (!(b.length >= 2 && b.every(x => x === '2'))) return false;
      // the EXISTING cart page must name it correctly: this is where a database id would show the wrong product
      await page.goto(url(this.scenario, '購物車.html'), { waitUntil: 'load' });
      const rows = await until(() => page.evaluate(() => document.querySelectorAll('#cartItemsList .cart-item').length === 1), 3000);
      const row = rows ? await page.evaluate(() => {
        const r = document.querySelector('#cartItemsList .cart-item');
        return { name: r.querySelector('.item-details h3').textContent, price: r.querySelector('.item-price').textContent };
      }) : {};
      this.detail += ', 購物車.html row: ' + row.name + ' ' + row.price;
      return row.name === '雲芝糖肽精華 (PSP) – 標準裝' && row.price === 'HK$3800.00';
    } finally { await ctx.close(); }
  },

  async mergesWithLegacyCart(width) {
    const ctx = await context(width); const page = await newPage(ctx);
    try {
      await page.goto(url(this.scenario, this.file), { waitUntil: 'load' });
      // one item as a detail page writes it, one as 購物車.html re-saves it (no productId)
      await page.evaluate(k => localStorage.setItem(k, JSON.stringify([
        { productId: 2, quantity: 1, product: { id: 2, name: '雲芝糖肽精華 (PSP) – 標準裝', price: 3800, image: '' } },
        { product: { id: 1, name: '雲芝糖肽精華 (PSP) - 試用裝', price: 680, image: '' }, quantity: 1 }
      ])), CART_KEY);
      await page.reload({ waitUntil: 'load' });
      const onLoad = (await badges(page)).every(x => x === '2');
      await addViaModal(page, BUY_SKU, 1);
      await addViaModal(page, BUY2_SKU, 1);
      const items = await cart(page);
      const std = items.filter(i => (i.productId === 2) || (i.product && i.product.id === 2));
      const trial = items.filter(i => (i.productId === 1) || (i.product && i.product.id === 1));
      this.detail = 'badge on load ' + onLoad + ', items ' + items.length + ', quantities ' + items.map(i => i.quantity).join('/');
      return onLoad && items.length === 2 && std.length === 1 && std[0].quantity === 2 &&
             trial.length === 1 && trial[0].quantity === 2 && (await badges(page)).every(x => x === '4');
    } finally { await ctx.close(); }
  },

  async refusals(width) {
    const ctx = await context(width); const page = await newPage(ctx);
    try {
      await page.goto(url(this.scenario, this.file), { waitUntil: 'load' });
      const M = site.MSG;
      /* No SKU is on hold in the shipped table (owner decision), so the hold
         mechanism is exercised by holding one at runtime in this page only. */
      const HELD_SKU = 'WH-MB-060';
      await page.evaluate(sku => { window.WonderHerb.PRICE_HOLD[sku] = 'held by test:behaviour'; }, HELD_SKU);
      const cases = [[OUT_SKU, M.outOfStock, 'out-of-stock'], [CLINIC_SKU, M.clinicOnly, 'clinic-only'],
                     [HELD_SKU, M.priceHold, 'price-hold']];
      const seen = [];
      for (const [sku, words, reason] of cases) {
        const said = await addViaModal(page, sku, 1);
        const logged = page._consoleErrors.some(e => e.indexOf(sku) !== -1 && e.indexOf(reason) !== -1);
        // inside the modal, which stays open, exact approved wording, logged
        const ok = said && said.where === 'modal' && said.modalStayedOpen && said.text === words && logged;
        seen.push(sku + ':' + (ok ? 'refused' : 'NOT refused (' + JSON.stringify(said) + ')'));
      }
      this.detail = seen.join(' ') + ', cart ' + (await cart(page)).length + ', dialogs ' + page._dialogs.length;
      return seen.every(s => s.endsWith(':refused')) && (await cart(page)).length === 0 &&
             (await badges(page)).every(x => x === '0') && page._dialogs.length === 0;
    } finally { await ctx.close(); }
  },

  async crossTabBadge(width) {
    const ctx = await context(width); const a = await newPage(ctx); const b = await newPage(ctx);
    try {
      await a.goto(url(this.scenario, this.file), { waitUntil: 'load' });
      await b.goto(url(this.scenario, this.file), { waitUntil: 'load' });
      await addViaModal(a, BUY2_SKU, 3);
      return await until(async () => (await badges(b)).every(x => x === '3'), 2500);
    } finally { await ctx.close(); }
  },

  /* 典型病例's case list: the cards, chips and count are all pre-rendered, so
     these prove the behaviour only FILTERS what is already in the HTML. */
  async caseFilter(width) {
    const ctx = await context(width); const page = await newPage(ctx);
    try {
      await page.goto(url(this.scenario, this.file), { waitUntil: 'load' });
      const before = await page.evaluate(() => ({
        cards: document.querySelectorAll('.case-card').length,
        shown: [...document.querySelectorAll('.case-card')].filter(c => !c.hidden).length,
        count: document.getElementById('caseCount').textContent
      }));
      const disease = await page.evaluate(() => document.querySelectorAll('.filter-chip')[1].getAttribute('data-disease'));
      await page.click('.filter-chip[data-disease="' + disease + '"]', { timeout: 2000 });
      const after = await until(async () => {
        const s = await page.evaluate(d => ({
          shown: [...document.querySelectorAll('.case-card')].filter(c => !c.hidden).length,
          all: document.querySelectorAll('.case-card[data-disease="' + d + '"]').length,
          count: document.getElementById('caseCount').textContent,
          pressed: document.querySelector('.filter-chip[data-disease="' + d + '"]').getAttribute('aria-pressed')
        }), disease);
        return s.shown === s.all && s.shown < before.cards && s.count.indexOf(String(s.shown)) !== -1 && s.pressed === 'true';
      }, 2000);
      await page.click('#caseReset', { timeout: 2000 });
      const back = await until(() => page.evaluate(n =>
        [...document.querySelectorAll('.case-card')].filter(c => !c.hidden).length === n, before.cards), 2000);
      this.detail = before.cards + ' cards, filtered to "' + disease + '", count "' + before.count + '" -> reset';
      return before.cards === 15 && before.shown === 15 && after && back;
    } finally { await ctx.close(); }
  },

  async caseSearch(width) {
    const ctx = await context(width); const page = await newPage(ctx);
    try {
      await page.goto(url(this.scenario, this.file), { waitUntil: 'load' });
      const term = await page.evaluate(() => document.querySelector('.case-title').textContent.trim().slice(0, 3));
      await page.fill('#caseSearch', term);
      const narrowed = await until(() => page.evaluate(() =>
        [...document.querySelectorAll('.case-card')].filter(c => !c.hidden).length < 15), 2000);
      await page.fill('#caseSearch', 'zzzzz-no-such-case');
      const none = await until(() => page.evaluate(() =>
        [...document.querySelectorAll('.case-card')].filter(c => !c.hidden).length === 0 &&
        !!document.querySelector('.cases-empty')), 2000);
      this.detail = 'searched "' + term + '", then a term that matches nothing';
      return narrowed && none;
    } finally { await ctx.close(); }
  },

  async caseReadMore(width) {
    const ctx = await context(width); const page = await newPage(ctx);
    try {
      await page.goto(url(this.scenario, this.file), { waitUntil: 'load' });
      const shut = await page.evaluate(() => {
        const f = document.querySelector('.case-full');
        return { visible: getComputedStyle(f).display !== 'none', label: document.querySelector('.read-more-text').textContent };
      });
      await page.click('.read-more-btn', { timeout: 2000 });
      const open = await until(() => page.evaluate(() => {
        const f = document.querySelector('.case-full'), b = document.querySelector('.read-more-btn');
        return getComputedStyle(f).display !== 'none' && b.getAttribute('aria-expanded') === 'true' &&
               document.querySelector('.read-more-text').textContent !== b.getAttribute('data-more');
      }), 2000);
      this.detail = 'full text hidden at rest: ' + !shut.visible + ', expands on click: ' + open;
      return !shut.visible && open;
    } finally { await ctx.close(); }
  },

  /* The next two need no product grid: any page with the site chrome. */
  async badgeFromStoredCart(width) {
    const ctx = await context(width); const page = await newPage(ctx);
    try {
      await page.goto(url(this.scenario, this.file), { waitUntil: 'load' });
      // a cart as the old pages and 購物車.html write it: 1 + 2 items
      await page.evaluate(k => localStorage.setItem(k, JSON.stringify([
        { productId: 2, quantity: 1, product: { id: 2, name: 'x', price: 1, image: '' } },
        { product: { id: 1, name: 'y', price: 1, image: '' }, quantity: 2 }
      ])), CART_KEY);
      await page.reload({ waitUntil: 'load' });
      const b = await badges(page);
      this.detail = 'badges ' + b.join('/');
      return b.length >= 2 && b.every(x => x === '3');
    } finally { await ctx.close(); }
  },

  async crossTabStorage(width) {
    const ctx = await context(width); const a = await newPage(ctx); const b = await newPage(ctx);
    try {
      await a.goto(url(this.scenario, this.file), { waitUntil: 'load' });
      await b.goto(url(this.scenario, this.file), { waitUntil: 'load' });
      await b.evaluate(k => localStorage.setItem(k, JSON.stringify([
        { productId: 3, quantity: 4, product: { id: 3, name: 'z', price: 1, image: '' } }])), CART_KEY);
      return await until(async () => { const x = await badges(a); return x.length >= 2 && x.every(v => v === '4'); }, 2500);
    } finally { await ctx.close(); }
  },

  async languageSwitch(width) {
    const code = width === 390 ? 'ja' : 'en';
    const ctx = await context(width); const page = await newPage(ctx);
    try {
      await page.goto(url(this.scenario, this.file), { waitUntil: 'load' });
      if (width === 390) {
        await page.click('#langCurrentBtn', { timeout: 2000 });
        if (!(await until(() => page.evaluate(() => document.getElementById('langDropdown').classList.contains('show')), 1000))) return false;
        await page.click('#langDropdown [data-lang="ja"]', { timeout: 2000 });
      } else {
        await page.click('#langEnBtn', { timeout: 2000 });
      }
      const expected = site.UNAVAILABLE[code];
      const state = await page.evaluate(k => {
        const n = document.getElementById('langNotice');
        const b = n && n.querySelector('button');
        return {
          saved: localStorage.getItem(k),
          notice: n ? n.firstChild.textContent : '',
          noticeLang: n ? n.getAttribute('lang') : '',
          closeLabel: b ? b.getAttribute('aria-label') : '',
          h1: document.querySelector('h1').textContent, lang: document.documentElement.lang
        };
      }, LANG_KEY);
      const noticeOk = await until(() => page.evaluate(() => { const n = document.getElementById('langNotice'); return n && n.getBoundingClientRect().height > 0; }), 1000);
      // the choice carries: a live page opened next is in that language
      await page.goto(url(this.scenario, LIVE_PAGE), { waitUntil: 'load' });
      const liveLang = await until(() => page.evaluate(c => document.documentElement.lang === c, code), 3000);
      // and coming back, the migrated page says so instead of looking broken
      await page.goto(url(this.scenario, this.file), { waitUntil: 'load' });
      const onReturn = await page.evaluate(() => { const n = document.getElementById('langNotice'); return n ? n.firstChild.textContent : ''; });
      this.detail = 'saved ' + state.saved + ', notice "' + state.notice + '" (lang ' + state.noticeLang +
                    ', close label "' + state.closeLabel + '"), page still ' + state.lang +
                    ', ' + LIVE_PAGE + ' in ' + code + ': ' + liveLang + ', notice on return: ' + Boolean(onReturn);
      return state.saved === code && noticeOk && state.notice === expected &&
             state.noticeLang === code && state.closeLabel === site.CLOSE[code] &&
             state.h1 === (this.h1 || '產品系列') && state.lang === 'zh-Hant' && liveLang && onReturn === expected;
    } finally { await ctx.close(); }
  }
};

async function runEffect(name, scenario, width, page) {
  const holder = Object.assign({ scenario, detail: undefined }, page || {});
  const ok = await safely(() => EFFECTS[name].call(holder, width));
  return { ok, detail: holder.detail };
}

(async () => {
  const server = await serve();
  port = server.address().port;
  browser = await chromium.launch({ args: ['--host-resolver-rules=MAP ' + HOST + ' 127.0.0.1'] });
  try {
    /* ============================================================ PART 2 */
    for (const width of [1280, 390]) {
      console.log('\n=== PART 2: effects at ' + width + ' (static server, no API, host ' + HOST + ') ===\n');
      const LABEL = {
        menuOpens: 'phone menu opens (panel shown, aria-expanded) and Escape closes it',
        quickViewAllSix: 'quick view opens the RIGHT product for all 6 cards, by SKU, and closes',
        addStandardPack: '標準裝 x2 lands in the cart as cart id 2 / ' + BUY_SKU + ' / 3800, badges read 2, and 購物車.html names it',
        mergesWithLegacyCart: 'adds merge with items written by the old detail pages and by 購物車.html',
        refusals: 'out-of-stock, clinic-only and a price hold (set at runtime) are refused - visibly and logged - and the cart stays empty',
        crossTabBadge: 'a second tab\'s badge follows the cart',
        badgeFromStoredCart: 'the badge shows a cart stored by the old pages, on load',
        crossTabStorage: 'a cart written in another tab (no quick view involved) reaches the badge',
        languageSwitch: 'language switch is not dead: saves the choice, says this page is Chinese only, a live page follows it'
      };
      for (const name of Object.keys(EFFECTS)) {
        /* LABEL is the list of effects that apply to THIS page. Effects for a
           section 產品介紹 does not have (the case list's filter, search and
           read more) belong to PART 5, which runs them on the page whose tree
           has that section. */
        if (!(name in LABEL)) continue;
        if (name === 'menuOpens' && width !== 390) continue;
        const r = await runEffect(name, 'fixture', width);
        check(LABEL[name], r.ok, r.detail);
      }
      const ctx = await context(width); const page = await newPage(ctx);
      await page.goto(url('fixture'), { waitUntil: 'load' });
      await quickView(page, BUY_SKU).catch(() => {});
      check('no page errors while doing all that', page._errors.length === 0, page._errors.join(' | ') || 'none');
      await ctx.close();
    }

    console.log('\n=== PART 2: the real data, unchanged ===\n');
    {
      const ctx = await context(1280); const page = await newPage(ctx);
      await page.goto(url('real'), { waitUntil: 'load' });
      const rows = [];
      const M = site.MSG;
      for (const p of realData.products) {
        const said = await addViaModal(page, p.sku, 1);
        const [label, words] = p.sku in PRICE_HOLD ? ['price hold', M.priceHold]
          : /^out/i.test(p.status || '') ? ['out of stock', M.outOfStock]
          : p.clinicOnly ? ['clinic only', M.clinicOnly] : ['added', '已將'];
        rows.push({ sku: p.sku, label, ok: Boolean(said && said.text.indexOf(words) === 0) });
      }
      check('every product is accepted or refused exactly as its data says, and no dialog ever opens',
            rows.every(r => r.ok) && page._dialogs.length === 0,
            rows.map(r => r.sku + ' ' + r.label + (r.ok ? '' : ' MISMATCH')).join(', ') + ', dialogs ' + page._dialogs.length);
      /* owner decision: the cart charges exactly the data price, 憶活素 and PT3 included */
      const inCart = await cart(page);
      const priced = inCart.map(i => ({ sku: i.product.sku, got: i.product.price, want: parseFloat(bySku[i.product.sku].price) }));
      check('every added item carries exactly its data/products.json price',
            priced.length > 0 && priced.every(x => x.got === x.want),
            priced.map(x => x.sku + ' ' + x.got + (x.got === x.want ? '' : ' (want ' + x.want + ')')).join(', '));
      await ctx.close();
    }

    /* ============================================================ PART 3 */
    async function scriptsOff(scenario, width, file) {
      const ctx = await browser.newContext({ viewport: WIDTHS[width] });
      await ctx.route('**/*', r => new URL(r.request().url()).hostname === HOST ? r.continue() : r.abort());
      const page = await ctx.newPage();
      await page.goto(url(scenario, file), { waitUntil: 'load' });
      const s = await page.evaluate(() => {
        const visible = el => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
          return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
        const controls = Array.from(document.querySelectorAll('button, [role="button"], [role="option"]')).filter(visible);
        return { dead: controls.map(c => (c.id || c.className || c.tagName) + ''),
                 quick: document.querySelectorAll('.btn-quickview').length,
                 text: document.querySelectorAll('.product-card .product-title').length,
                 links: Array.from(document.querySelectorAll('.btn-detail')).filter(visible).length,
                 h1: Math.round(document.querySelector('h1').getBoundingClientRect().top) };
      });
      await ctx.close();
      return s;
    }

    for (const width of [1280, 390]) {
      console.log('\n=== PART 3: scripts off at ' + width + ' ===\n');
      const s = await scriptsOff('nojs', width);
      check('no visible control that needs JavaScript (buttons, menu toggle, language switcher, quick view)',
            s.dead.length === 0, s.dead.length ? 'VISIBLE: ' + s.dead.join(', ') : 'none of ' + s.quick + ' quick view buttons, no toggle, no switcher');
      check('the content and the plain links are all still there', s.text === 6 && s.links === 6, s.text + ' titles, ' + s.links + ' detail links');
      const on = await browser.newContext({ viewport: WIDTHS[width] });
      await on.route('**/*', r => new URL(r.request().url()).hostname === HOST ? r.continue() : r.abort());
      const p2 = await on.newPage();
      await p2.goto(url('fixture'), { waitUntil: 'load' });
      const h1On = await p2.evaluate(() => Math.round(document.querySelector('h1').getBoundingClientRect().top));
      check('hiding them did not move the page: <h1> at the same y scripts on and off (D1)', h1On === s.h1, 'on ' + h1On + ', off ' + s.h1);
      await on.close();
    }

    /* ============================================================ PART 5 */
    for (const p of OTHER_PAGES) {
      const ctxPage = { file: p.file, h1: p.h1 };
      console.log('\n=== PART 5: ' + p.file + ' (' + p.sections.join(', ') + ') - the shared behaviour ===\n');
      const SHARED = {
        'menuOpens@390': 'phone menu opens and Escape closes it',
        'badgeFromStoredCart@1280': 'the badge shows the stored cart on load (1280)',
        'badgeFromStoredCart@390': 'the badge shows the stored cart on load (390)',
        'crossTabStorage@1280': 'a second tab\'s cart change reaches this page\'s badge',
        'languageSwitch@1280': 'language switch (en): saves, says Chinese only, ' + LIVE_PAGE + ' follows, notice on return',
        'languageSwitch@390': 'language switch (ja, from the phone dropdown): the same'
      };
      for (const [k, label] of Object.entries(SHARED)) {
        const [name, w] = k.split('@');
        const r = await runEffect(name, p.key, Number(w), ctxPage);
        check(label, r.ok, r.detail);
      }
      {
        const ctx = await context(390); const page = await newPage(ctx);
        await page.goto(url(p.key, p.file), { waitUntil: 'load' });
        await page.click('#menuToggle').catch(() => {});
        check('no page errors, no dialogs', page._errors.length === 0 && page._dialogs.length === 0,
              (page._errors.concat(page._dialogs).join(' | ')) || 'none');
        await ctx.close();
      }
      for (const width of [1280, 390]) {
        const off = await scriptsOff(p.key + '-nojs', width, p.file);
        check('scripts off at ' + width + ': no visible control that needs JavaScript', off.dead.length === 0,
              off.dead.length ? 'VISIBLE: ' + off.dead.join(', ') : 'none');
        const on = await browser.newContext({ viewport: WIDTHS[width] });
        await on.route('**/*', r => new URL(r.request().url()).hostname === HOST ? r.continue() : r.abort());
        const p2 = await on.newPage();
        await p2.goto(url(p.key, p.file), { waitUntil: 'load' });
        const h1On = await p2.evaluate(() => Math.round(document.querySelector('h1').getBoundingClientRect().top));
        await on.close();
        check('  ...and <h1> at the same y scripts on and off (D1)', h1On === off.h1, 'on ' + h1On + ', off ' + off.h1);
        const u = await scriptsOff(p.key + '-nojs-unguarded', width, p.file);
        check('  negative control: without the scripts-off rules the dead controls ARE found', u.dead.length > 0,
              u.dead.length + ' visible');
      }
      /* per-section behaviour this page has, and its own negative control */
      const EXTRA = p.sections.indexOf('case-list') !== -1 ? {
        'caseFilter@1280': 'a diagnosis chip filters the pre-rendered cards, the count follows, reset restores all 15',
        'caseSearch@1280': 'search narrows the same cards, and a term matching nothing says so',
        'caseReadMore@390': 'a case\'s full text is hidden at rest and expands on click'
      } : {};
      for (const [k, label] of Object.entries(EXTRA)) {
        const [name, w] = k.split('@');
        const r = await runEffect(name, p.key, Number(w), ctxPage);
        check(label, r.ok, r.detail);
      }
      if (Object.keys(EXTRA).length) {
        const still = [];
        for (const k of Object.keys(EXTRA)) {
          const [name, w] = k.split('@');
          if ((await runEffect(name, p.key + '-no-behaviour', Number(w), ctxPage)).ok) still.push(k);
        }
        check('negative control: without its behaviour file every one of those fails', still.length === 0,
              still.length ? 'STILL PASSING: ' + still.join(', ') : Object.keys(EXTRA).length + ' of ' + Object.keys(EXTRA).length + ' fail');
      }

      const failed = [];
      for (const k of Object.keys(SHARED)) {
        const [name, w] = k.split('@');
        if ((await runEffect(name, p.key + '-no-site', Number(w), ctxPage)).ok) failed.push(k);
      }
      check('negative control: without assets/site.js every one of those fails', failed.length === 0,
            failed.length ? 'STILL PASSING: ' + failed.join(', ') : Object.keys(SHARED).length + ' of ' + Object.keys(SHARED).length + ' fail');
    }

    /* ============================================================ PART 4 */
    console.log('\n=== PART 4: negative controls - the same checks must FAIL without the code ===\n');
    const CONTROLS = {
      'no-site': { missing: 'assets/site.js',
                   mustFail: ['menuOpens@390', 'addStandardPack@1280', 'mergesWithLegacyCart@1280', 'crossTabBadge@1280', 'languageSwitch@1280', 'languageSwitch@390'],
                   mustPass: ['quickViewAllSix@1280'] },
      'no-quickview': { missing: 'assets/behaviour/quick-view.js',
                        mustFail: ['quickViewAllSix@1280', 'quickViewAllSix@390', 'addStandardPack@1280', 'refusals@1280'],
                        mustPass: ['menuOpens@390', 'languageSwitch@1280'] }
    };
    for (const width of [1280, 390]) {
      const u = await scriptsOff('nojs-unguarded', width);
      check('without the template\'s scripts-off rules at ' + width + ': the dead controls ARE found',
            u.dead.length > 0, u.dead.length + ' visible: ' + u.dead.slice(0, 4).join(', ') + (u.dead.length > 4 ? ', ...' : ''));
    }
    for (const [scenario, c] of Object.entries(CONTROLS)) {
      const results = {};
      for (const key of c.mustFail.concat(c.mustPass)) {
        const [name, w] = key.split('@');
        results[key] = (await runEffect(name, scenario, Number(w))).ok;
      }
      const stillPassing = c.mustFail.filter(k => results[k]);
      check('without ' + c.missing + ': every check that depends on it fails',
            stillPassing.length === 0,
            stillPassing.length ? 'STILL PASSING: ' + stillPassing.join(', ') : c.mustFail.length + ' of ' + c.mustFail.length + ' fail');
      const wronglyFailing = c.mustPass.filter(k => !results[k]);
      check('  ...and only those: checks that do not depend on it still pass (the control is not just a broken page)',
            wronglyFailing.length === 0, wronglyFailing.length ? 'ALSO FAILING: ' + wronglyFailing.join(', ') : c.mustPass.join(', '));
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n' + (fail ? '=== ' + fail + ' CHECK(S) FAILED ===' : '=== ALL CHECKS PASSED ===') + '\n');
  process.exit(fail ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
