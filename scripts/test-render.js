/* The renderer, checked on a real page tree through the real render path.
 *
 * `test:seo` (Phase 6) will assert the <head> of every migrated page. It will
 * not catch the two things that can regress silently HERE:
 *
 *   1. The scroll-reveal guards being dropped from renderer/template.js. The
 *      page would still contain every word, still have a valid head, still
 *      pass an SEO gate - and publish visually blank. docs/FINDINGS.md
 *      finding 12, the "passes green, looks broken" class.
 *   2. A section throwing, or quietly emitting nothing, when handed a real
 *      tree and the real data/ files rather than a test author's sample props.
 *
 * So this renders renderer/sample/products.json - the same fixture `npm run
 * render` uses, carried out of baseline/head/產品介紹.html - plus a small
 * in-test tree that DOES contain .reveal-on-scroll blocks, because the
 * products page does not and cannot prove the guards on its own.
 *
 * Plain Node, no DOM. The bundle is built through the real build script first,
 * exactly as test-sections.js does, so this tests the published path.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

let fail = 0;
const check = (label, cond, extra) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '   -> ' + extra : ''));
  if (!cond) fail++;
};

console.log('\n=== the renderer loads, through the real build path ===\n');

execFileSync(process.execPath, [path.join(ROOT, 'renderer', 'build-sections.js')],
             { cwd: ROOT, stdio: 'pipe' });

const render = require(path.join(ROOT, 'renderer', 'render.js'));
const { renderPage, loadData, loadStyles, loadChrome, loadTree, LANGS_IN_SCOPE, PRIMARY } = render;

check('renderer/render.js exports renderPage', typeof renderPage === 'function');
check('Month 1 renders the primary language only',
      LANGS_IN_SCOPE.length === 1 && LANGS_IN_SCOPE[0] === PRIMARY,
      LANGS_IN_SCOPE.join(', ') + '   (Phase 14 widens this)');

const TREE = path.join(ROOT, 'renderer', 'sample', 'products.json');
check('the sample page tree exists', fs.existsSync(TREE), 'renderer/sample/products.json');

const tree = loadTree(TREE);
const data = loadData();
const styles = loadStyles(tree.assets.stylesFrom);
const chrome = loadChrome(tree.assets.chromeFrom);
const html = renderPage(tree, PRIMARY, data, { styles, chrome });

check('it renders a whole document', /^<!doctype html>/i.test(html),
      Math.round(html.length / 1024) + ' KB');
check('<html lang> is the live pages\' value', html.indexOf('<html lang="zh-Hant">') === 0 + html.indexOf('<html'),
      (html.match(/<html[^>]*>/) || [''])[0]);

/* ------------------------------------------------- (a) + (b) finding 12 ----
   The two guards, and a tree that actually needs them. */
console.log('\n=== the scroll-reveal guards (docs/FINDINGS.md finding 12) ===\n');

check('(a) the IntersectionObserver script is in the output',
      html.indexOf('new IntersectionObserver') !== -1);
check('(a) it adds .is-visible',
      /classList\.add\("is-visible"\)/.test(html));
check('(a) it reveals everything when IntersectionObserver is missing',
      /if \(!\("IntersectionObserver" in window\)\)/.test(html),
      'old browsers get the content, not a blank page');
check('(b) the <noscript> rule forcing .reveal-on-scroll visible is in the output',
      /<noscript><style>[\s\S]*?\.reveal-on-scroll \{ opacity: 1 !important; transform: none !important; \}[\s\S]*?<\/style><\/noscript>/
        .test(html));
check('(b) it is inside <head>, where a style block belongs',
      html.indexOf('<noscript>') !== -1 && html.indexOf('<noscript>') < html.indexOf('</head>'));

/* The products page has no reveal blocks. This one does - hero and text-block
   (glass) both emit .reveal-on-scroll, matching the live homepage markup. If
   the guards were ever dropped, THIS is the page that would publish blank. */
const REVEAL_TREE = {
  slug: 'reveal-guard', path: 'reveal-guard.html',
  title: { zh: 'reveal guard' },
  seo: { description: { zh: 'x' }, breadcrumb: [], jsonld: [] },
  sections: [
    { type: 'text-block', fields: {
      variant: 'glass', heading: { zh: '關於康草堂' },
      paragraphs: [{ text: { zh: '康草堂自成立以來專注雲芝糖肽精華的研發與生產。' } }]
    } }
  ]
};
const revealHtml = renderPage(REVEAL_TREE, PRIMARY, data, {});
const revealCount = (revealHtml.match(/reveal-on-scroll/g) || []).length;
check('a page whose sections emit .reveal-on-scroll still gets both guards',
      revealCount > 1 &&
      revealHtml.indexOf('new IntersectionObserver') !== -1 &&
      revealHtml.indexOf('<noscript>') !== -1,
      revealCount + ' reveal token(s), observer + noscript both present');

/* --------------------------------------------------------- (c) content ---- */
console.log('\n=== (c) the content is IN the HTML, not fetched ===\n');

/* Product titles and descriptions are per-language objects since P9-T1
   (finding 19), so the expected strings come from the data resolved for the
   language being rendered - the same resolveData the renderer applies. Comparing
   against the raw row would compare against "[object Object]". */
const products = render.resolveData(data, PRIMARY).products;
check('every product title from data/products.json is in the output',
      products.every(p => typeof p.title === 'string' && html.indexOf(p.title) !== -1),
      products.length + ' product(s), resolved to ' + PRIMARY);
/* Compare against the ESCAPED text. One description contains ">90%", which
   React correctly emits as "&gt;90%" - searching for the raw string would fail
   on the one product whose copy has a special character in it, and would look
   like missing content rather than working escaping. */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
check('every product description is too',
      products.every(p => p.desc && html.indexOf(esc(p.desc)) !== -1),
      products.length + ' description(s), HTML-escaped');
check('the seven-language catalogue reaches the page as text, not as objects',
      html.indexOf('[object Object]') === -1, 'no language map leaked into the HTML');
check('the grid is filled, not an empty shell',
      (html.match(/class="product-card"/g) || []).length === products.length,
      (html.match(/class="product-card"/g) || []).length + ' card(s) — the live page ships this empty');
check('the page-header <h1> is rendered',
      /<h1 id="products-heading">產品系列<\/h1>/.test(html));
check('prices are formatted, not raw',
      html.indexOf('HK$3,800.00') !== -1, 'HK$3,800.00');

/* ------------------------------------------------------------ (d) JSON-LD -- */
console.log('\n=== (d) JSON-LD ===\n');

const WANT_TYPES = ['Organization', 'BreadcrumbList', 'FAQPage',
                    'Product', 'Product', 'Product', 'Product', 'Product', 'Product'];
const ldBlocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
check('the output has exactly one JSON-LD block', ldBlocks.length === 1, ldBlocks.length);

let ld = null;
try {
  const raw = ldBlocks[0].replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
  ld = JSON.parse(raw.replace(/\\u003c/g, '<'));
} catch (err) {
  check('it parses as JSON', false, err.message);
}
if (ld) {
  check('it parses as JSON', true, 'ok');
  check('it is a schema.org @graph', ld['@context'] === 'https://schema.org' && Array.isArray(ld['@graph']),
        ld['@graph'] ? ld['@graph'].length + ' node(s)' : '');
  const types = (ld['@graph'] || []).map(n => n['@type']);
  check('the @types match the live page', types.join(',') === WANT_TYPES.join(','), types.join(', '));
  check('the payload contains no literal </script>', ldBlocks[0].indexOf('</script>') === ldBlocks[0].length - 9,
        'escaped as \\u003c');
}

/* ----------------------------------------------------------- head basics --- */
console.log('\n=== the SEO-critical head ===\n');

const one = re => { const m = html.match(re); return m ? m[1] : '(none)'; };
check('<title> is the page\'s own', one(/<title>([\s\S]*?)<\/title>/) === tree.title.zh, one(/<title>([\s\S]*?)<\/title>/));
check('canonical points at the canonical path',
      one(/<link rel="canonical" href="([^"]*)"/) === 'https://www.wonder-herb.com/產品介紹.html',
      one(/<link rel="canonical" href="([^"]*)"/));
check('meta description is present', /<meta name="description" content="[^"]+">/.test(html));
check('Open Graph is present',
      /og:title/.test(html) && /og:description/.test(html) && /og:image/.test(html) && /og:site_name/.test(html));
const alts = html.match(/<link rel="alternate" hreflang="([^"]*)"/g) || [];
check('one hreflang per rendered language, plus x-default',
      alts.length === LANGS_IN_SCOPE.length + 1,
      alts.map(a => a.replace(/.*hreflang="/, '').replace(/"$/, '')).join(', ') +
      '   (no alternate for a language with no URL yet)');

/* --------------------------------------------- (e) nothing editor-only ----- */
console.log('\n=== (e) no editor instrumentation reaches the output ===\n');

// CLAUDE.md non-negotiable 4: data-wh-* selection attributes are editor and
// preview only; published output is clean.
const LEAKS = [
  ['data-wh-', /data-wh-/g],
  ['data-puck', /data-puck/g],
  ['puck-', /\bpuck-/gi],
  ['data-rfd-', /data-rfd-/g]          // the drag-and-drop library Puck uses
];
LEAKS.forEach(([name, re]) => {
  const hits = html.match(re) || [];
  check('no ' + name + ' in the published output', hits.length === 0,
        hits.length ? hits.length + ' occurrence(s)' : 'clean');
});
check('no React dev attributes leak either',
      html.indexOf('data-reactroot') === -1 && html.indexOf('<!-- -->') === -1,
      'renderToStaticMarkup, not hydrate');

/* ------------------------------------------------------------- failure ----- */
console.log('\n=== it fails loudly rather than silently ===\n');

let threw = '';
try { renderPage({ sections: [{ type: 'no-such-section', fields: {} }] }, PRIMARY, data, {}); }
catch (err) { threw = err.message; }
check('an unknown section type throws', /Unknown section type: no-such-section/.test(threw), threw || 'DID NOT THROW');

check('a tree with no sections still renders a valid document',
      /^<!doctype html>/i.test(renderPage({ slug: 'empty', path: 'empty.html', sections: [] }, PRIMARY, data, {})));

console.log('\n' + (fail ? '=== ' + fail + ' CHECK(S) FAILED ===' : '=== ALL CHECKS PASSED ==='));
process.exit(fail ? 1 : 0);
