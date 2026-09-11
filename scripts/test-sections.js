/* The section components, checked the way the renderer actually uses them.
 *
 * Runs the real `renderer/build-sections.js`, requires the bundle it produces,
 * and renders through react-dom/server in plain Node - no DOM, no jsdom. If a
 * section reaches for `window` at render time this is where it fails, not in
 * production.
 *
 * Three layers:
 *   1. Contract checks that loop the whole registry, so every section added
 *      later is covered by them automatically.
 *   2. Per-section expectations, including the exact HTML for page-header.
 *   3. Structural fidelity: the expected elements are read out of the live
 *      page, not written here, so a section cannot quietly drop markup that
 *      nobody thought to assert on. jsdom is used for that parsing only -
 *      every render above still happens in plain Node with no DOM.
 */
const fs = require('fs');
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

/* ------------------------------------------------- structural fidelity
 *
 * The blind spot this closes: `contact-cards` silently dropped all fifteen
 * <i> icons from the live markup and passed every check above, because those
 * checks look at the contract (does it export a config, does it render, is the
 * output clean) and at hand-written assertions - and a hand-written assertion
 * can only test what its author remembered to look at. The icons were missed
 * precisely because nobody remembered them.
 *
 * So the expectation is not hand-written. For each section below we parse the
 * REAL block out of the REAL page, collect every tag name and class token it
 * contains, render the section, and require the rendered output to contain
 * them all. The source page is the authority; the test author's memory is not.
 *
 * Anything deliberately not emitted goes in `allow` WITH A REASON, so a
 * dropped element is either caught or consciously waived - never silent.
 */
const { JSDOM } = require('jsdom');

/* Some blocks are built by JavaScript rather than sitting in the HTML, so the
   "source" is a template literal. Pull it out with a scanner that understands
   nesting: `${...}` holes are replaced with a placeholder, and any markup
   inside a nested template (a conditional fragment) is kept, because that is
   real markup the section still has to produce. */
function extractTemplate(src, startRe) {
  const m = src.match(startRe);
  if (!m) return null;
  let i = src.indexOf('`', m.index + m[0].length - 1);
  if (i === -1) return null;
  return scan(src, i + 1).text;
}

function scan(s, i) {
  let out = '';
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') { out += s[i] + (s[i + 1] || ''); i += 2; continue; }
    if (c === '`') return { text: out, end: i + 1 };
    if (c === '$' && s[i + 1] === '{') {
      let depth = 1; i += 2;
      while (i < s.length && depth > 0) {
        if (s[i] === '`') { const r = scan(s, i + 1); out += r.text; i = r.end; continue; }
        if (s[i] === '{') depth++;
        else if (s[i] === '}') depth--;
        i++;
      }
      out += 'X';
      continue;
    }
    out += c; i++;
  }
  return { text: out, end: i };
}

/* ------------------------------------------------------------------------
 * The fidelity map. One entry per section (an array where a section has more
 * than one real shape on the site). Each entry names the page and the block,
 * gives props that populate the section fully, and lists in `allow` anything
 * the section deliberately does not emit - WITH A REASON.
 *
 * The props are chosen to exercise the markup, not to be realistic content:
 * where the live block shows three badges and the data has two, the entry
 * passes its own data. This test is about structure, not copy.
 * ------------------------------------------------------------------------ */
const INLINE_COPY = {
  strong: 'inline emphasis inside body copy. Fields are plain text with a constrained ' +
          'formatter (CLAUDE.md conventions); raw HTML from an editor is deliberately not supported',
  em: 'as strong: inline emphasis is copy-level formatting, not section structure',
  br: 'a line break inside a copy string: field content, not section structure',
  span: 'an inline wrapper used only to style part of a sentence',
  ul: 'a bulleted list inside one answer\'s copy; the section renders paragraphs, ' +
      'and lists inside copy await the constrained formatter',
  li: 'as ul: list items live inside answer copy, not in the section shell'
};

const FIDELITY = {
  'page-header': [
    { label: 'centered', page: '產品介紹.html', selector: '.page-header',
      props: { heading: '產品系列', sub: '加拿大GMP藥廠 · 有效成份 >90%', headingId: 'products-heading' } },
    { label: 'video', page: '研究報告.html', selector: '.page-header',
      props: { heading: '研究報告', sub: '國際權威期刊', headingId: 'research-heading',
               variant: 'video', videoUrl: 'https://cdn.example.com/hero.mp4' } }
  ],

  hero: {
    page: 'index.html', selector: '.hero',
    props: {
      badge: '臨床驗證 · 加拿大GMP藥廠', heading: '雲芝糖肽精華 PSP', headingAccent: '+T3',
      headingLine2: '天然輔助方案', body: '超過20年經驗', headingId: 'hero-heading',
      stats: [{ number: '90%+', label: '有效成份含量' }],
      primaryLabel: '立即查詢', primaryHref: 'https://wa.me/85293318571/',
      primaryIcon: 'fab fa-whatsapp',
      secondaryLabel: '了解產品系列', secondaryHref: '#products',
      showCarousel: true
    }
  },

  'text-block': [
    { label: 'glass', page: 'index.html', selector: '.company-glass-card',
      props: { heading: '康草堂', sub: '結合中西醫學理論',
               paragraphs: [{ text: '第一段' }, { text: '第二段' }] } },
    { label: 'card', page: '產品_T3.html', selector: '.product-details-card',
      allow: { strong: INLINE_COPY.strong, em: INLINE_COPY.em, br: INLINE_COPY.br, span: INLINE_COPY.span },
      props: { heading: '產品介紹', sub: '副標題', variant: 'card',
               paragraphs: [{ text: '第一段' }], bullets: [{ text: '超強抗氧化' }] } }
  ],

  'product-grid': {
    page: '產品介紹.html',
    // built by renderProducts(); the markup is a template literal, not static HTML
    template: /grid\.innerHTML = products\.map\(p => /,
    props: {
      source: 'products.json',
      data: { products: [{ id: 1, title: '雲芝糖肽精華', price: '3800.00', desc: '說明',
                           image: 'https://example.com/a.png', link: '產品_A.html',
                           ribbon: '只在指定中西醫診所出售' }] },
      quickViewLabel: '快速瀏覽', detailLabel: '詳細介紹'
    }
  },

  'product-detail': {
    page: '產品_T3.html', selector: '.product-info',
    props: {
      source: 'products.json', sku: 'WH-T3-120',
      // its own data: the live panel shows three trust badges, the real row has two
      data: { products: [{ id: 3, title: 'T3 複合配方', sku: 'WH-T3-120', price: '1900.00',
                           desc: '60倍高活性', badges: 'GMP認證, 60倍吸收力, 大學臨床研究' }] },
      quantityLabel: '數量：', addLabel: '加入購物車', addIcon: 'fas fa-cart-plus',
      detailLabel: '詳細介紹', detailIcon: 'fas fa-chevron-down',
      descIcon: 'fas fa-flask', unit: '/ 120粒軟膠囊', headingId: 'product-title',
      badgeIcons: [{ icon: 'fas fa-certificate' }, { icon: 'fas fa-chart-line' },
                   { icon: 'fas fa-university' }]
    }
  },

  gallery: {
    page: '產品_T3.html', selector: '.product-gallery',
    props: { mainAlt: 'T3', images: [{ src: 'a.png', alt: '正面' }, { src: 'b.png', alt: '側面' }] }
  },

  'related-products': {
    page: '產品_T3.html', selector: '.related-products',
    props: {
      heading: '你可能也感興趣', source: 'products.json',
      data: { products: [{ sku: 'A', title: '雲芝糖肽精華', price: '3800.00', desc: 'x' }] },
      items: [
        { sku: 'A', href: '產品_A.html', icon: 'fas fa-seedling' },
        { sku: 'B', href: '產品_B.html', label: '乙肝清', desc: '護肝', icon: 'fas fa-heartbeat' },
        { sku: 'C', href: '產品_C.html', label: 'PT3', desc: '強化', icon: 'fas fa-box' }
      ]
    }
  },

  'contact-cards': {
    page: '聯絡我們.html', selector: '.contact-grid',
    allow: { br: INLINE_COPY.br },
    props: {
      cards: [
        { flag: 'https://flagcdn.com/hk.svg', flagAlt: 'Hong Kong Flag', title: '亞洲總部',
          company: '康草堂有限公司',
          details: [
            { icon: 'fas fa-map-marker-alt', text: '香港九龍彌敦道301-309号', href: 'https://maps.app.goo.gl/x' },
            { icon: 'fas fa-phone-alt', text: '+852 2757 3112' },
            { icon: 'fab fa-whatsapp', text: '+852 9331 8571', href: 'https://wa.me/85293318571/' },
            { icon: 'fab fa-envelope', text: 'info@wonder-herb.com', href: 'mailto:info@wonder-herb.com' },
            { icon: 'fas fa-user', text: '聯絡: 陳小姐' }
          ] }
      ]
    }
  },

  'cta-band': [
    { label: 'banner', page: '聯絡我們.html', selector: '.cta-banner',
      props: { heading: '需要專業諮詢？', body: '我們的健康顧問團隊', label: '立即 WhatsApp 諮詢',
               href: 'https://wa.me/85293318571/', icon: 'fab fa-whatsapp' } },
    { label: 'button', page: '常見問題.html', selector: '.cta-button',
      props: { variant: 'button', label: '探索產品系列', href: '產品介紹.html' } }
  ],

  'faq-accordion': {
    page: '常見問題.html', selector: '.faq-list',
    allow: { ul: INLINE_COPY.ul, li: INLINE_COPY.li, strong: INLINE_COPY.strong },
    props: {
      source: 'faq.json', defaultIcon: 'fas fa-question-circle',
      data: { faq: [
        { id: 1, q: 'Q1', a: 'A1' },
        { id: 2, q: 'Q2', a: 'A2', icon: 'fas fa-flask' },
        { id: 3, q: 'Q3', a: 'A3', icon: 'fas fa-leaf' },
        { id: 4, q: 'Q4', a: 'A4', icon: 'fas fa-shield-alt' },
        { id: 5, q: 'Q5', a: 'A5', icon: 'fas fa-chart-line' }
      ] }
    }
  }
};

/* every tag name and class token inside a block, as one set */
function fingerprint(el) {
  const out = new Set();
  const walk = node => {
    out.add(node.tagName.toLowerCase());
    node.classList.forEach(c => out.add('.' + c));
    Array.prototype.forEach.call(node.children, walk);
  };
  Array.prototype.forEach.call(el.children, walk);
  el.classList.forEach(c => out.add('.' + c));
  out.add(el.tagName.toLowerCase());
  return out;
}

console.log('\n=== structural fidelity against the live markup ===\n');

Object.keys(FIDELITY).forEach(type => {
  const specs = [].concat(FIDELITY[type]);
  specs.forEach(spec => {
    const name = type + (spec.label ? ' (' + spec.label + ')' : '');
    const src = fs.readFileSync(path.join(ROOT, spec.page), 'utf8');

    let block;
    if (spec.template) {
      const tpl = extractTemplate(src, spec.template);
      if (!tpl) { check(name + ': found its template in ' + spec.page, false, 'NOT MATCHED'); return; }
      block = new JSDOM('<body><div id="w">' + tpl + '</div></body>')
        .window.document.getElementById('w');
    } else {
      block = new JSDOM(src).window.document.querySelector(spec.selector);
      if (!block) { check(name + ': found ' + spec.selector + ' in ' + spec.page, false, 'NOT FOUND'); return; }
    }

    const want = fingerprint(block);
    const html = render(components[type], spec.props);
    const got = fingerprint(new JSDOM('<body>' + html + '</body>').window.document.body);

    const allow = spec.allow || {};
    const missing = Array.from(want).filter(t =>
      !got.has(t) && !(t.replace(/^\./, '') in allow) && !(t in allow));

    check(name + ': emits everything ' + (spec.template ? 'its template' : spec.selector) + ' has',
          missing.length === 0,
          missing.length ? 'MISSING ' + missing.join(', ') : want.size + ' tokens, all present');
    Object.keys(allow).forEach(t => console.log('         waived <' + t + '> — ' + allow[t]));
  });
});

const unmapped = Object.keys(registry).filter(t => !(t in FIDELITY));
check('every registered section has a fidelity map', unmapped.length === 0,
      unmapped.length ? 'UNMAPPED: ' + unmapped.join(', ') : Object.keys(registry).length + '/' +
      Object.keys(registry).length + ' mapped');

console.log('\n' + (fail ? '=== ' + fail + ' CHECK(S) FAILED ===' : '=== ALL CHECKS PASSED ==='));
process.exit(fail ? 1 : 0);
