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

/* ------------------------------------------------- D1, finding 15 ---------
   The nav must reserve its own space in CSS. This is the same "passes green,
   looks broken" class as finding 12: drop the rule and every check above still
   passes while the <h1> publishes underneath the nav bar for anyone with
   JavaScript off. Measured before the fix: <h1> at y=55 against y=219. */
console.log('\n=== the nav reserves its space in CSS (docs/FINDINGS.md finding 15, D1) ===\n');

/* At D2 these rules moved out of the template into assets/chrome.css, so the
   page proves D1 by LINKING it - last, or the page sheet outranks it. */
const chromeCss = fs.readFileSync(path.join(ROOT, 'assets', 'chrome.css'), 'utf8');
check('assets/chrome.css holds the sticky rule',
      /\.fixed-nav-wrapper \{ position: sticky; \}/.test(chromeCss));
check('assets/chrome.css neutralises body overflow-x',
      /body \{ overflow-x: clip; \}/.test(chromeCss),
      'body{overflow-x:hidden} makes body a scroll container, and sticky then stops pinning');

const sheets = (html.match(/<link rel="stylesheet" href="([^"]*)"/g) || [])
  .map(l => l.replace(/.*href="/, '').replace(/"$/, ''));
check('a page with chrome links assets/chrome.css',
      sheets.indexOf('assets/chrome.css') !== -1, sheets.join(', '));
check('and links it LAST, after the page sheet',
      sheets[sheets.length - 1] === 'assets/chrome.css',
      'anything after it would outrank the D1 rules');
/* Chrome is more than nav + footer. The floating WhatsApp link sits after
   <footer> on all 18 pages and was silently dropped until P9-T1's visual diff. */
check('the floating WhatsApp contact button is carried with the chrome',
      /<a href="https:\/\/wa\.me\/[^"]+" class="mobile-fixed-contact-btn"/.test(html) &&
      html.indexOf('mobile-fixed-contact-btn') > html.indexOf('</footer>'),
      'after </footer>, as on the live page');
check('no runtime nav-offset script ships any more',
      html.indexOf('paddingTop') === -1,
      'the height is reserved by layout, not measured by JS');

/* The guard bites: a chrome page that forgets the sheet must fail loudly rather
   than publish with the heading under the nav. */
let d1Threw = '';
try {
  const noSheet = JSON.parse(JSON.stringify(tree));
  noSheet.assets.stylesheets = noSheet.assets.stylesheets.filter(s => s !== 'assets/chrome.css');
  renderPage(noSheet, PRIMARY, data, { chrome });
} catch (err) { d1Threw = err.message; }
check('dropping assets/chrome.css from a chrome page throws',
      /does not link assets\/chrome\.css/.test(d1Threw), d1Threw || 'DID NOT THROW');

let d1Order = '';
try {
  const wrongOrder = JSON.parse(JSON.stringify(tree));
  wrongOrder.assets.stylesheets = wrongOrder.assets.stylesheets
    .filter(s => s !== 'assets/chrome.css').concat(['assets/chrome.css', 'assets/late.css']);
  renderPage(wrongOrder, PRIMARY, data, { chrome });
} catch (err) { d1Order = err.message; }
check('a stylesheet AFTER assets/chrome.css throws too',
      /must be the last stylesheet/.test(d1Order), d1Order || 'DID NOT THROW');

/* ------------------------------------------------ behaviour, finding 23 ---- */
console.log('\n=== behaviour scripts are derived from the tree, and cannot be skipped ===\n');

const { baseTemplate } = require(path.join(ROOT, 'renderer', 'template.js'));
const scriptSrcs = h => (h.match(/<script src="([^"]+)" defer><\/script>/g) || []).map(t => t.replace(/.*src="/, '').replace(/".*/, ''));
check('a chrome page with a product-grid links site.js then quick-view.js, deferred, after the reveal script',
      JSON.stringify(scriptSrcs(html)) === JSON.stringify(['assets/site.js', 'assets/behaviour/quick-view.js']) &&
      html.indexOf('src="assets/site.js"') > html.indexOf('scroll reveal'),
      scriptSrcs(html).join(', '));
check('both files exist', scriptSrcs(html).every(s => fs.existsSync(path.join(ROOT, s))), 'on disk');
check('a page with neither chrome nor a behaviour section loads no behaviour script',
      scriptSrcs(renderPage({ slug: 'plain', path: 'plain.html', sections: [] }, PRIMARY, data, {})).length === 0, 'none');
const draftGrid = renderPage({ slug: 'draft', path: 'draft.html',
  sections: [{ type: 'product-grid', fields: { source: 'products.json', quickViewLabel: 'q', addLabel: 'a' } }] }, PRIMARY, data, {});
check('a chrome-less draft with a product-grid (the editor preview) still gets site.js for the cart',
      JSON.stringify(scriptSrcs(draftGrid)) === JSON.stringify(['assets/site.js', 'assets/behaviour/quick-view.js']),
      scriptSrcs(draftGrid).join(', '));
check('scripts-off rules ship with them: no quick view button, menu toggle or switcher without JavaScript',
      /<noscript><style>[\s\S]*\.btn-quickview \{ display: none !important; \}[\s\S]*<\/noscript>/.test(html) &&
      /<noscript><style>[\s\S]*\.menu-toggle, \.lang-selector, \.lang-selector-mobile \{ visibility: hidden !important; \}/.test(html),
      'in <head>');
let noTypes = '';
try { baseTemplate({ head: '', body: '<p>x</p>', lang: PRIMARY }); } catch (err) { noTypes = err.message; }
check('the template refuses to render a body it was not given section types for',
      /needs sectionTypes/.test(noTypes), noTypes || 'DID NOT THROW');
let twoGrids = '';
try {
  renderPage({ slug: 'two', path: 'two.html', sections: [{ type: 'product-grid', fields: {} }, { type: 'product-grid', fields: {} }] }, PRIMARY, data, {});
} catch (err) { twoGrids = err.message; }
check('two product grids on one page throw (the quick view modal ids would collide)',
      /one product-grid/.test(twoGrids), twoGrids || 'DID NOT THROW');

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

/* ------------------------------------------- the public site (P9-T1) ----- */
console.log('\n=== retired pages are served from the render; the rest are never touched ===\n');
{
  const { originalPagePath, readOriginalPage, isRetired } = require(path.join(ROOT, 'renderer', 'source-page.js'));
  const NAME = 'zz-render-root-test.html';                  // a throwaway page, cleaned up below
  const rootFile = path.join(ROOT, NAME);
  const legacyFile = path.join(ROOT, 'legacy', NAME);
  const treeFile = path.join(ROOT, 'renderer', '.build', 'zz-render-root-test.tree.json');
  const legacyExisted = fs.existsSync(path.join(ROOT, 'legacy'));
  const cli = () => execFileSync(process.execPath, [path.join(ROOT, 'renderer', 'render.js'), treeFile],
                                 { cwd: ROOT, stdio: 'pipe' }).toString('utf8');
  try {
    fs.mkdirSync(path.dirname(treeFile), { recursive: true });
    fs.writeFileSync(treeFile, JSON.stringify({ slug: 'zz-render-root-test', path: NAME,
      title: { zh: '測試' }, sections: [{ type: 'page-header', fields: { heading: { zh: '測試' } } }] }));

    // 1. NOT retired: an original sits at the root and must survive a render untouched
    fs.writeFileSync(rootFile, '<!-- hand-coded original -->');
    const out1 = cli();
    check('a page NOT retired to legacy/ is never written over by the renderer',
          fs.readFileSync(rootFile, 'utf8') === '<!-- hand-coded original -->' && out1.indexOf('site root') === -1,
          'root file byte-identical');
    check('and its original is read from the root', originalPagePath(NAME) === rootFile && !isRetired(NAME), 'root');

    // 2. retired: the original moves to legacy/, the render takes the root
    fs.mkdirSync(path.dirname(legacyFile), { recursive: true });
    fs.renameSync(rootFile, legacyFile);
    const out2 = cli();
    const written = fs.existsSync(rootFile) ? fs.readFileSync(rootFile, 'utf8') : '';
    check('once retired, the render is written to the page\'s own root path',
          /^<!doctype html>/i.test(written) && written.indexOf('測試') !== -1 && /site root\s+zz-render-root-test\.html\s+written/.test(out2),
          Math.round(written.length / 1024) + ' KB');
    check('the original is now read from legacy/, never from the render at the root',
          originalPagePath(NAME) === legacyFile && readOriginalPage(NAME) === '<!-- hand-coded original -->', 'legacy/' + NAME);
    const mtime = fs.statSync(rootFile).mtimeMs;
    const out3 = cli();
    check('an unchanged render leaves the root file alone (git stays clean)',
          fs.statSync(rootFile).mtimeMs === mtime && /site root\s+zz-render-root-test\.html\s+unchanged/.test(out3), 'unchanged');
    check('a name with a directory in it is refused (the preview route\'s traversal guard)',
          originalPagePath('../.env') === null && originalPagePath('legacy/' + NAME) === null, 'null');
  } finally {
    [rootFile, legacyFile, treeFile, path.join(ROOT, 'renderer', '.out', NAME)].forEach(f => { try { fs.unlinkSync(f); } catch (e) {} });
    if (!legacyExisted) { try { fs.rmdirSync(path.join(ROOT, 'legacy')); } catch (e) {} }
  }
  check('the throwaway page left nothing behind', !fs.existsSync(rootFile) && !fs.existsSync(legacyFile), 'clean');
}

/* ------------------------------------------------------------- failure ----- */
console.log('\n=== it fails loudly rather than silently ===\n');

let threw = '';
try { renderPage({ sections: [{ type: 'no-such-section', fields: {} }] }, PRIMARY, data, {}); }
catch (err) { threw = err.message; }
check('an unknown section type throws', /Unknown section type: no-such-section/.test(threw), threw || 'DID NOT THROW');

/* FAQPage is derived from the faq-accordion's data (renderer/render.js
   faqPageNode). A tree that also carries one would ship two, one stale. */
const faqData = { faq: [{ id: 1, cat: 'A', q: '問一', a: '答一' }, { id: 2, cat: 'B', q: '問二', a: [{ label: '標', text: '文' }] }] };
const faqTree = extra => Object.assign({ slug: 'f', path: 'f.html',
  sections: [{ type: 'faq-accordion', fields: { source: 'faq.json' } }] }, extra);
threw = '';
try { renderPage(faqTree({ seo: { jsonld: [{ '@type': 'FAQPage', mainEntity: [] }] } }), PRIMARY, faqData, {}); }
catch (err) { threw = err.message; }
check('a faq-accordion tree that also carries a FAQPage is refused', /also carries a FAQPage/.test(threw), threw || 'DID NOT THROW');
{
  const ld = html => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  const faqNode = html => ld(html).find(n => n['@type'] === 'FAQPage');
  const all = faqNode(renderPage(faqTree(), PRIMARY, faqData, {}));
  check('FAQPage is derived from the data the section renders',
        !!all && all.mainEntity.map(q => q.name).join('|') === '問一|問二' &&
        all.mainEntity[1].acceptedAnswer.text === '標文' && all.inLanguage === 'zh-Hant',
        all ? all.mainEntity.map(q => q.name + '=' + q.acceptedAnswer.text).join(', ') : 'NO FAQPage');
  const cat = faqNode(renderPage(Object.assign(faqTree(), { sections: [{ type: 'faq-accordion', fields: { source: 'faq.json', category: 'B' } }] }), PRIMARY, faqData, {}));
  check('...with the same category filter', !!cat && cat.mainEntity.length === 1 && cat.mainEntity[0].name === '問二',
        cat ? cat.mainEntity.length + ' question(s)' : 'NO FAQPage');
  check('a page without a faq-accordion gets no derived FAQPage',
        !faqNode(renderPage({ slug: 'n', path: 'n.html', sections: [] }, PRIMARY, faqData, {})), 'none');
}

check('a tree with no sections still renders a valid document',
      /^<!doctype html>/i.test(renderPage({ slug: 'empty', path: 'empty.html', sections: [] }, PRIMARY, data, {})));

console.log('\n' + (fail ? '=== ' + fail + ' CHECK(S) FAILED ===' : '=== ALL CHECKS PASSED ==='));
process.exit(fail ? 1 : 0);
