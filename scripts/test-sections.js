/* The section components, checked the way the renderer actually uses them.
 *
 * Runs the real `renderer/build-sections.js`, requires the bundle it produces,
 * and renders through react-dom/server in plain Node - no DOM, no jsdom. If a
 * section reaches for `window` at render time this is where it fails, not in
 * production.
 *
 * Two layers:
 *   1. Contract checks that loop the whole registry, so every section added
 *      later is covered by them automatically.
 *   2. Per-section expectations, including the exact HTML for page-header.
 */
const path = require('path');
const { execFileSync } = require('child_process');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const ROOT = path.join(__dirname, '..');
const BUNDLE = path.join(ROOT, 'renderer', '.build', 'sections.cjs');

let fail = 0;
const check = (label, cond, extra) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '   -> ' + extra : ''));
  if (!cond) fail++;
};
const eq = (label, got, want) =>
  check(label + (got === want ? '' : '\n        expected: ' + want + '\n        got     : ' + got),
        got === want, got === want ? got : undefined);

const render = (Comp, props) => renderToStaticMarkup(React.createElement(Comp, props));

console.log('\n=== the bundle builds ===\n');

// build through the real script, so this tests the published path
execFileSync(process.execPath, [path.join(ROOT, 'renderer', 'build-sections.js')],
             { cwd: ROOT, stdio: 'pipe' });
delete require.cache[BUNDLE];
const bundle = require(BUNDLE);
const components = bundle.default;
const registry = bundle.registry;

check('sections:build produced a bundle', !!bundle, 'ok');
check('it exports a component map and a registry',
      !!components && !!registry, Object.keys(bundle).join(', '));
check('the registry is not empty', Object.keys(registry).length > 0,
      Object.keys(registry).length + ' section(s)');

console.log('\n=== the contract, for every registered section ===\n');

Object.keys(registry).forEach(type => {
  const mod = registry[type];
  const Comp = mod.default;
  const cfg = mod.config;

  check(type + ': default-exports a component', typeof Comp === 'function', typeof Comp);
  check(type + ': named-exports a config', !!cfg && typeof cfg === 'object', typeof cfg);
  check(type + ': config has a label', !!(cfg && cfg.label), cfg && cfg.label);
  check(type + ': config has fields', !!(cfg && cfg.fields && typeof cfg.fields === 'object'),
        cfg && cfg.fields ? Object.keys(cfg.fields).join(', ') : undefined);
  check(type + ': config has defaultProps', !!(cfg && cfg.defaultProps),
        cfg && cfg.defaultProps ? Object.keys(cfg.defaultProps).join(', ') : undefined);

  // every field must have a default, or the editor starts with undefined props
  const missing = Object.keys((cfg && cfg.fields) || {})
    .filter(f => !(cfg.defaultProps && f in cfg.defaultProps));
  check(type + ': every field has a defaultProp', missing.length === 0,
        missing.length ? 'missing: ' + missing.join(', ') : 'all ' + Object.keys(cfg.fields).length);

  /* ONE SOURCE OF TRUTH: the component the renderer gets must be the very same
     object the editor gets. Not an equivalent copy - the same reference. */
  check(type + ': renderer and editor share one component object',
        components[type] === mod.default, 'identical reference');

  // renders with nothing but its defaults, in plain Node, without throwing
  let html = null, err = null;
  try { html = render(Comp, cfg.defaultProps); } catch (e) { err = e.message.split('\n')[0]; }
  check(type + ': renders on the server with its defaults', err === null, err || 'ok');
  /* A section may legitimately render nothing until it has content - an empty
     gallery or an unmatched sku should disappear, not publish a broken shell.
     That has to be a declared decision (`emptyWithoutContent: true`) so it is
     reviewed once, rather than an accidental blank going unnoticed. */
  if (cfg && cfg.emptyWithoutContent) {
    check(type + ': renders nothing without content, and says so in its config',
          html === '', 'declared empty');
  } else {
    check(type + ': produces markup', typeof html === 'string' && html.length > 0,
          html === null ? 'threw' : html.length + ' chars');
  }

  // published output must carry no editor instrumentation (non-negotiable 4)
  check(type + ': no editor-only attributes in the output',
        html !== null && html.indexOf('data-wh-') === -1 && html.indexOf('data-puck') === -1, 'clean');
});

console.log('\n=== purity: no browser at render time ===\n');

check('there is no window in this process', typeof window === 'undefined', 'undefined');
check('there is no document in this process', typeof document === 'undefined', 'undefined');
console.log('  (every render above therefore happened without a DOM)');

console.log('\n=== page-header: the exact HTML ===\n');

const PageHeader = components['page-header'];

const centered = render(PageHeader, {
  heading: '產品系列',
  sub: '加拿大GMP藥廠 · 有效成份 >90% · 大學研究證實',
  headingId: 'products-heading',
  variant: 'centered'
});
eq('centered, with a heading id',
   centered,
   '<section class="page-header" aria-labelledby="products-heading">' +
   '<div class="container"><h1 id="products-heading">產品系列</h1>' +
   '<p>加拿大GMP藥廠 · 有效成份 &gt;90% · 大學研究證實</p></div></section>');

check('the CJK survives unescaped', centered.indexOf('產品系列') !== -1, '產品系列');
check('the live class names are used', centered.indexOf('class="page-header"') !== -1
      && centered.indexOf('class="container"') !== -1, 'page-header, container');
check('> is escaped, so the markup is valid', centered.indexOf('&gt;90%') !== -1, '&gt;90%');

const noId = render(PageHeader, { heading: '典型病例', sub: '真實康復見證' });
eq('no heading id: no id and no aria-labelledby, like 典型病例.html',
   noId,
   '<section class="page-header"><div class="container"><h1>典型病例</h1>' +
   '<p>真實康復見證</p></div></section>');

const noSub = render(PageHeader, { heading: '會員帳戶' });
eq('no subtitle: the <p> is omitted entirely, not left empty',
   noSub,
   '<section class="page-header"><div class="container"><h1>會員帳戶</h1></div></section>');

const video = render(PageHeader, {
  heading: '研究報告', sub: '國際權威期刊', headingId: 'research-heading',
  variant: 'video', videoUrl: 'https://cdn.example.com/hero.mp4'
});
check('video variant emits the background video', video.indexOf('class="video-background"') !== -1, 'ok');
/* React 19 emits `autoPlay=""` and `playsInline=""` in camelCase rather than
   lowercasing them. HTML attribute names are case-insensitive, so a browser
   parses them identically - verified: hasAttribute('autoplay') is true and
   video.autoplay is true. Asserted case-insensitively for that reason. */
const videoLower = video.toLowerCase();
check('with the attributes the live markup has',
      videoLower.indexOf('autoplay') !== -1 && videoLower.indexOf('muted') !== -1 &&
      videoLower.indexOf('loop') !== -1 && videoLower.indexOf('playsinline') !== -1 &&
      videoLower.indexOf('aria-hidden="true"') !== -1, 'autoplay muted loop playsinline aria-hidden');
check('and the source url', video.indexOf('https://cdn.example.com/hero.mp4') !== -1, 'ok');
check('the video sits before the container, as on the live page',
      video.indexOf('<video') < video.indexOf('<div class="container"'), 'ordered');

const videoNoUrl = render(PageHeader, { heading: 'x', variant: 'video', videoUrl: '' });
check('video variant with no url emits no empty <video>',
      videoNoUrl.indexOf('<video') === -1, 'omitted');

console.log('\n=== defaults are safe ===\n');

const empty = render(PageHeader, config().defaultProps);
function config() { return registry['page-header'].config; }
eq('defaults render an empty but valid header',
   empty, '<section class="page-header"><div class="container"><h1></h1></div></section>');

/* ------------------------------------------------------------------ the
   data-backed sections, fed the REAL data files. If a section reads a key
   that data/products.json or data/faq.json does not have, it fails here. */
const realProducts = require(path.join(ROOT, 'data', 'products.json'));
const realFaq = require(path.join(ROOT, 'data', 'faq.json'));
const DATA = { products: realProducts, faq: realFaq };

console.log('\n=== the real data files, as the sections expect them ===\n');

const PRODUCT_KEYS = ['id', 'title', 'sku', 'price', 'status', 'cat', 'badges', 'model', 'desc'];
PRODUCT_KEYS.forEach(k =>
  check('products.json has "' + k + '"', realProducts.every(p => k in p), 'all ' + realProducts.length));
check('products.json has NO "image" key (the grid must cope)',
      !realProducts.some(p => 'image' in p), 'confirmed absent');
check('products.json has NO "link" key (the grid must cope)',
      !realProducts.some(p => 'link' in p), 'confirmed absent');
['id', 'cat', 'q', 'a'].forEach(k =>
  check('faq.json has "' + k + '"', realFaq.every(f => k in f), 'all ' + realFaq.length));

console.log('\n=== product-grid, against data/products.json ===\n');

const grid = render(components['product-grid'],
  { source: 'products.json', data: DATA, quickViewLabel: '快速瀏覽', detailLabel: '詳細介紹' });
check('one card per product', (grid.match(/class="product-card"/g) || []).length === realProducts.length,
      realProducts.length + ' cards');
check('the real wrapper class', grid.indexOf('class="products-grid"') !== -1, 'products-grid');
check('a real product title from the data', grid.indexOf(realProducts[0].title) !== -1, realProducts[0].title);
check('price formatted like the live page', grid.indexOf('HK$3,800.00') !== -1, 'HK$3,800.00');
check('the real description from the data', grid.indexOf(realProducts[0].desc.slice(0, 12)) !== -1, 'present');
check('no broken <img> when the data has no image', grid.indexOf('<img') === -1, 'no img emitted');
check('no dead detail link when the data has no link', grid.indexOf('btn-detail') === -1, 'omitted');
check('quick view button still renders', grid.indexOf('class="btn-quickview"') !== -1, 'present');
const gridWithImg = render(components['product-grid'],
  { source: 'products.json', data: { products: [{ id: 9, title: 'T', price: '10.00', image: 'x.png', link: 'p.html' }] },
    detailLabel: '詳細介紹' });
check('and it DOES render them once the data has them',
      gridWithImg.indexOf('<img src="x.png"') !== -1 && gridWithImg.indexOf('href="p.html"') !== -1, 'forward-compatible');

console.log('\n=== product-detail, against data/products.json ===\n');

const detail = render(components['product-detail'],
  { source: 'products.json', data: DATA, sku: 'WH-T3-120', quantityLabel: '數量：',
    addLabel: '加入購物車', unit: '/ 120粒軟膠囊' });
check('the real title for that sku', detail.indexOf('T3 複合配方 (120粒)') !== -1, 'matched by sku');
check('the real price', detail.indexOf('HK$1,900.00') !== -1, 'HK$1,900.00');
check('the live classes', detail.indexOf('class="product-info"') !== -1
      && detail.indexOf('class="product-title"') !== -1
      && detail.indexOf('class="product-price"') !== -1, 'product-info/title/price');
check('badges split into badge-item, from the real badges string',
      (detail.match(/class="badge-item"/g) || []).length === 2, '專利配方 + 大學證實功效倍增');
check('an unknown sku renders nothing rather than an empty panel',
      render(components['product-detail'], { source: 'products.json', data: DATA, sku: 'NOPE' }) === '', '""');

console.log('\n=== faq-accordion, against data/faq.json ===\n');

const faq = render(components['faq-accordion'], { source: 'faq.json', data: DATA });
check('one item per question', (faq.match(/class="faq-item"/g) || []).length === realFaq.length,
      realFaq.length + ' items');
check('the live classes', faq.indexOf('class="faq-list"') !== -1
      && faq.indexOf('class="faq-question"') !== -1
      && faq.indexOf('class="faq-answer"') !== -1, 'faq-list/question/answer');
check('the real question text', faq.indexOf(realFaq[0].q) !== -1, realFaq[0].q);
const faqCat = render(components['faq-accordion'], { source: 'faq.json', data: DATA, category: 'General' });
const generalCount = realFaq.filter(f => f.cat === 'General').length;
check('category filters by the real cat values',
      (faqCat.match(/class="faq-item"/g) || []).length === generalCount, generalCount + ' in General');
check('a paragraph per blank-line-separated block',
      render(components['faq-accordion'], { data: { faq: [{ id: 1, q: 'Q', a: 'one\n\ntwo' }] } })
        .indexOf('<p>one</p><p>two</p>') !== -1, 'split');

console.log('\n=== related-products ===\n');

const rel = render(components['related-products'],
  { heading: '你可能也感興趣', source: 'products.json', data: DATA,
    items: [{ sku: 'WH-PSP-500', href: '產品_雲芝糖肽精華_B.html' }] });
check('the live classes', rel.indexOf('class="related-products"') !== -1
      && rel.indexOf('class="related-grid"') !== -1
      && rel.indexOf('class="related-card"') !== -1, 'related-products/grid/card');
check('pulls title and price from the real data',
      rel.indexOf('雲芝糖肽精華 PSP (標準裝 500粒)') !== -1 && rel.indexOf('HK$3,800.00') !== -1, 'ok');
check('empty items renders nothing',
      render(components['related-products'], { items: [], data: DATA }) === '', '""');

console.log('\n=== the presentational sections ===\n');

const hero = render(components.hero, {
  badge: '臨床驗證 · 加拿大GMP藥廠', heading: '雲芝糖肽精華 PSP', headingAccent: '+T3',
  headingLine2: '天然輔助方案', body: '超過20年經驗', headingId: 'hero-heading',
  stats: [{ number: '90%+', label: '有效成份含量' }],
  primaryLabel: '立即查詢', primaryHref: 'https://wa.me/85293318571/'
});
check('hero: the live classes', hero.indexOf('class="hero"') !== -1
      && hero.indexOf('class="container hero-grid"') !== -1
      && hero.indexOf('class="hero-content reveal-on-scroll reveal-left"') !== -1, 'hero/hero-grid/hero-content');
check('hero: the canvas the client script enhances', hero.indexOf('<canvas id="heroCanvas"') !== -1, 'present');
check('hero: stats render as stat-item/stat-number',
      hero.indexOf('class="stat-item"') !== -1 && hero.indexOf('90%+') !== -1, 'ok');
check('hero: the accent span keeps the brand red', hero.indexOf('color:#9b2e2e') !== -1, 'ok');
check('hero: carousel can be turned off',
      render(components.hero, { showCarousel: false }).indexOf('carousel-container') === -1, 'omitted');

const tbGlass = render(components['text-block'],
  { heading: '康草堂', sub: '結合中西醫學理論', paragraphs: [{ text: '第一段' }, { text: '第二段' }] });
check('text-block glass: the homepage classes',
      tbGlass.indexOf('class="section-title reveal-on-scroll"') !== -1
      && tbGlass.indexOf('class="company-glass-card reveal-on-scroll reveal-delay-2"') !== -1, 'ok');
check('text-block glass: a <p> per paragraph',
      tbGlass.indexOf('<p>第一段</p><p>第二段</p>') !== -1, 'ok');
const tbCard = render(components['text-block'],
  { heading: '產品介紹', variant: 'card', paragraphs: [{ text: 'x' }], bullets: [{ text: '超強抗氧化' }] });
check('text-block card: the product-page class',
      tbCard.indexOf('class="product-details-card"') !== -1, 'product-details-card');
check('text-block card: bullets become a <ul>',
      tbCard.indexOf('<ul><li>超強抗氧化</li></ul>') !== -1, 'ok');

const gal = render(components.gallery,
  { images: [{ src: 'a.png', alt: '正面' }, { src: 'b.png', alt: '側面' }], mainAlt: 'T3' });
check('gallery: the live classes', gal.indexOf('class="product-gallery"') !== -1
      && gal.indexOf('class="main-image"') !== -1
      && gal.indexOf('class="thumbnail-list"') !== -1, 'ok');
check('gallery: first thumbnail is active', gal.indexOf('class="thumbnail active"') !== -1, 'active');
check('gallery: data-img hook for the client script', gal.indexOf('data-img="a.png"') !== -1, 'present');
check('gallery: no images renders nothing', render(components.gallery, { images: [] }) === '', '""');

const cc = render(components['contact-cards'], {
  cards: [{ flag: 'https://flagcdn.com/hk.svg', flagAlt: 'Hong Kong Flag', title: '亞洲總部',
            company: '康草堂有限公司',
            details: [{ text: '+852 2757 3112' }, { text: 'info@wonder-herb.com', href: 'mailto:info@wonder-herb.com' }] }]
});
check('contact-cards: the live classes', cc.indexOf('class="contact-grid"') !== -1
      && cc.indexOf('class="contact-card"') !== -1
      && cc.indexOf('class="contact-icon"') !== -1
      && cc.indexOf('class="contact-detail"') !== -1, 'ok');
check('contact-cards: a detail with href becomes a link, one without stays text',
      cc.indexOf('<a href="mailto:info@wonder-herb.com">') !== -1
      && cc.indexOf('<span>+852 2757 3112</span>') !== -1, 'both shapes');
check('contact-cards: the company line is optional',
      render(components['contact-cards'], { cards: [{ title: '中國辦事處' }] }).indexOf('<h4>') === -1, 'omitted');

const ctaBanner = render(components['cta-band'],
  { heading: '需要專業諮詢？', body: '我們的健康顧問團隊', label: '立即 WhatsApp 諮詢', href: 'https://wa.me/85293318571/' });
eq('cta-band banner: the live markup', ctaBanner,
   '<div class="cta-banner"><h2>需要專業諮詢？</h2><p style="margin-bottom:24px">我們的健康顧問團隊</p>' +
   '<a href="https://wa.me/85293318571/" class="btn-primary">立即 WhatsApp 諮詢</a></div>');
eq('cta-band button: the 常見問題 shape',
   render(components['cta-band'], { variant: 'button', label: '探索產品系列', href: '產品介紹.html' }),
   '<div class="cta-button"><a href="產品介紹.html" class="btn-primary">探索產品系列</a></div>');

console.log('\n' + (fail ? '=== ' + fail + ' CHECK(S) FAILED ===' : '=== ALL CHECKS PASSED ==='));
process.exit(fail ? 1 : 0);
