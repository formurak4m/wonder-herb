/* Page tree + content data + language  ->  one complete static HTML document.
 *
 *   const { renderPage } = require('./renderer/render');
 *   renderPage(tree, 'zh', data)   // -> '<!doctype html>...'
 *
 * The components come from renderer/.build/sections.cjs, the esbuild bundle of
 * the SAME sections/ the Puck editor imports. One source of truth, so the
 * canvas cannot drift from the published page.
 *
 * LANGUAGES. Month 1 renders zh only, to the canonical paths the site already
 * uses. Everything language-dependent goes through `lang`: resolveField picks
 * the text, head.pageUrl picks the URL. Phase 14 turns LANGS_IN_SCOPE into the
 * full list and P5-T2's buildSite loops it - a loop, not a rewrite. Nothing
 * here assumes there is exactly one language.
 *
 * SCOPE. This renders a page to a string. Its CLI writes every tree into
 * renderer/.out/ (gitignored) and, since P9-T1, writes a tree whose hand-coded
 * original has been retired to legacy/ over that page's root file - the page
 * GitHub Pages serves. It never writes over a page that has not been retired.
 *
 * --------------------------------------------------------------------------
 * TWO THINGS ABOUT THIS SITE THAT THE RENDERER HAS TO WORK AROUND
 *
 * 1. There is no shared stylesheet. Each of the 18 pages carries ~27 KB of
 *    its own CSS inline in <head>, and the rules differ page to page. Until
 *    one sheet is extracted, a tree names the page whose CSS it needs
 *    (`assets.stylesFrom`) and `loadStyles` lifts the <style> blocks out of
 *    it verbatim. This is a stopgap and it is deliberately noisy: see the
 *    console warning below.
 *
 * 2. Site chrome (top bar, language switcher, nav, announcement bar, footer)
 *    is hand-copied into every page and is not modelled as sections yet.
 *    `assets.chromeFrom` lifts it the same way so a rendered page looks like a
 *    real page. Whether chrome becomes sections or a shared partial is a
 *    Phase 9 decision; the renderer only needs a seam for it, and this is it.
 *
 * Both seams take a source page name, so when the real answer arrives it
 * replaces two small functions here and nothing else.
 * --------------------------------------------------------------------------
 */
const fs = require('fs');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { resolveField, LANGS, PRIMARY } = require('./i18n');
const { buildHead, pageUrl, pagePath, HREFLANG } = require('./head');
const { baseTemplate } = require('./template');
const { PRICE_HOLD } = require('../assets/site.js');
const { readOriginalPage, isRetired } = require('./source-page');

const ROOT = path.join(__dirname, '..');
const BUNDLE = path.join(__dirname, '.build', 'sections.cjs');

/* Month 1: zh only, to the canonical paths. Phase 14 widens this to LANGS. */
const LANGS_IN_SCOPE = [PRIMARY];

function sectionRegistry() {
  if (!fs.existsSync(BUNDLE)) {
    throw new Error('renderer/.build/sections.cjs is missing. Run `npm run sections:build` first.');
  }
  return require(BUNDLE).default;
}

/* One node of the tree -> its HTML.
 *
 * `data` and `lang` are passed to every section: the data-backed ones
 * (product-grid, product-detail, related-products, faq-accordion) read their
 * list out of `data`, and the rest ignore both. */
function renderSection(node, lang, data, registry) {
  const sections = registry || sectionRegistry();
  const Comp = sections[node.type];
  if (!Comp) throw new Error('Unknown section type: ' + node.type);
  const props = resolveField(node.fields || {}, lang);
  const html = renderToStaticMarkup(React.createElement(Comp, Object.assign({}, props, { data, lang })));
  // the live pages wrap most inner-page blocks in <div class="container">;
  // a node says so rather than every component hard-coding it
  return wrapOf(node).container ? '<div class="container">' + html + '</div>' : html;
}

/* A node's wrapper, in one shape whichever way the tree writes it:
 *
 *   "wrap": "container"                                 -> <div class="container">
 *   "wrap": { "section": "contact-section",             -> <section class="...">
 *             "container": true, "label": "…" }            <div class="container">
 *
 * WHY SECTIONS MATTER (found on 聯絡我們, P9 batch). The live pages put their
 * blocks inside <section class="contact-section"> / .faq-section /
 * .reports-section, and those classes carry PADDING - 5px top and bottom on
 * 聯絡我們. Rendering the blocks without the section drops that padding, which
 * moves everything below it and shows up as a whole-page pixel difference that
 * has nothing to do with content. 常見問題 got away with it only because
 * .faq-section happens to set padding 0.
 *
 * CONSECUTIVE NODES THAT NAME THE SAME SECTION SHARE ONE. The live page has
 * one <section> around its grid, map and caption, and one .container inside
 * it. Three separate sections would apply the padding three times, so
 * renderBody groups a run of adjacent nodes with the same wrapper and emits it
 * once. The tree stays flat (no nesting for Puck to model): each node carries
 * its own wrap, and moving a node out of the run in the editor simply moves it
 * out of that section.
 */
function wrapOf(node) {
  const w = node.wrap;
  if (!w) return {};
  if (typeof w === 'string') return { container: w === 'container' };
  return { section: w.section, label: w.label, container: w.container !== false };
}

/* '' is a real section class: 聯絡我們's CTA sits in a bare <section class="">,
   so an empty string still means "wrap these in a section", and only an absent
   `section` means "no section". */
const wrapKey = node => {
  const w = wrapOf(node);
  return w.section === undefined ? '' : JSON.stringify([w.section, w.label || '', w.container]);
};

function renderBody(tree, lang, data, registry) {
  const nodes = tree.sections || [];
  const out = [];
  for (let i = 0; i < nodes.length;) {
    const key = wrapKey(nodes[i]);
    if (!key) { out.push(renderSection(nodes[i], lang, data, registry)); i++; continue; }
    /* a run of adjacent nodes inside the same live <section> */
    const run = [];
    while (i < nodes.length && wrapKey(nodes[i]) === key) { run.push(nodes[i]); i++; }
    const w = wrapOf(run[0]);
    const inner = run.map(n =>
      renderSection(Object.assign({}, n, { wrap: undefined }), lang, data, registry)).join('\n');
    const body = w.container ? '<div class="container">' + inner + '</div>' : inner;
    out.push('<section class="' + w.section + '"' +
             (w.label ? ' aria-label="' + w.label.replace(/"/g, '&quot;') + '"' : '') + '>' +
             body + '</section>');
  }
  return out.join('\n');
}

/* Content data, resolved for one language.
 *
 * A section's own `fields` go through resolveField in renderSection. The
 * CONTENT a data-backed section reads (data/products.json, data/faq.json) did
 * not - it was handed over raw. That was fine while every product title was a
 * plain string, and stopped being fine at P9-T1 when the catalogue became
 * per-language (finding 19): `<h2>{p.title}</h2>` with an object is not
 * something React can render.
 *
 * Resolving here rather than in each section keeps the rule in one place - a
 * section should never have to know about languages - and means the four
 * data-backed sections needed no change at all. resolveField walks arrays and
 * plain objects, so a whole content bundle can go through it at once. */
function resolveData(data, lang) {
  return data ? resolveField(data, lang) : data;
}

/* A whole document. opts.styles / opts.chrome are resolved by the caller
   (loadStyles / loadChrome below) so this function stays free of file IO. */
function renderPage(tree, lang, data, opts) {
  const o = opts || {};
  const l = lang || PRIMARY;
  assertOneModalGrid(tree);
  const registry = o.registry || sectionRegistry();
  const resolved = resolveData(data, l);
  const body = renderBody(tree, l, resolved, registry);
  const head = buildHead(tree, l, {
    languages: o.languages || LANGS_IN_SCOPE,
    styles: o.styles || [],
    derived: [faqPageNode(tree, l, resolved)].filter(Boolean)
  });
  return baseTemplate({
    head: head,
    body: body,
    lang: l,
    bodyClass: tree.bodyClass,
    chrome: o.chrome,
    main: tree.main,
    // the template derives the behaviour scripts from these (finding 23)
    sectionTypes: (tree.sections || []).map(node => node.type)
  });
}

/* FAQPage JSON-LD, DERIVED from the questions the page actually shows.
 *
 * Structured data has to describe the visible page. A carried FAQPage (the
 * rest of tree.seo.jsonld is carried verbatim, see head.js) goes stale the
 * moment the client edits data/faq.json in the admin - and on 常見問題 it was
 * stale from the start: the hand-coded page and data/faq.json hold different
 * questions. So a page with a faq-accordion gets its FAQPage built from the
 * same data, with the same category filter, the section renders.
 *
 * A tree that has a faq-accordion AND carries its own FAQPage is refused: one
 * of the two would be wrong, and two FAQPage nodes is invalid besides. */
function faqPageNode(tree, lang, data) {
  const lists = (tree.sections || []).filter(n => n.type === 'faq-accordion');
  if (!lists.length) return null;
  const carried = ((tree.seo && tree.seo.jsonld) || []).some(n => n && n['@type'] === 'FAQPage');
  if (carried) {
    throw new Error(tree.path + ' has a faq-accordion and also carries a FAQPage in seo.jsonld; ' +
                    'the FAQPage is derived from the section\'s data, remove the carried one');
  }
  const text = item => (item && typeof item === 'object')
    ? (Array.isArray(item.bullets) ? item.bullets.map(text).join('\n') : String(item.label || '') + String(item.text || ''))
    : String(item || '');
  const answer = a => Array.isArray(a) ? a.map(text).join('\n') : String(a || '');
  const questions = [];
  lists.forEach(node => {
    const f = resolveField(node.fields || {}, lang);
    const key = String(f.source || 'faq.json').replace(/\.json$/, '');
    const all = (data && Array.isArray(data[key])) ? data[key] : [];
    (f.category ? all.filter(x => x && x.cat === f.category) : all).forEach(x => {
      if (x && x.q) questions.push({ '@type': 'Question', name: String(x.q),
        acceptedAnswer: { '@type': 'Answer', text: answer(x.a) } });
    });
  });
  if (!questions.length) return null;
  return { '@type': 'FAQPage', inLanguage: HREFLANG[lang] || lang, mainEntity: questions };
}

/* A page's quick view modal has fixed ids (#quickViewModal, #modalAddToCart),
   so two product grids on one page would emit duplicate ids and the second
   grid's buttons would drive the first one's modal. Refuse rather than ship it. */
function assertOneModalGrid(tree) {
  const grids = (tree.sections || []).filter(n => n.type === 'product-grid').length;
  if (grids > 1) {
    throw new Error('A page can hold one product-grid (its quick view uses fixed ids); ' +
      (tree.path || tree.slug || 'this tree') + ' has ' + grids + '.');
  }
}

/* ------------------------------------------------------------------ content */

/* data/*.json keyed by file stem, which is what a section's `source` names:
   source: 'products.json' -> data.products. */
function loadData(dir) {
  const d = dir || path.join(ROOT, 'data');
  const out = {};
  fs.readdirSync(d)
    .filter(f => f.endsWith('.json'))
    .forEach(f => {
      out[f.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
    });
  return out;
}

/* STOPGAP (see the header). Lift the inline <style> blocks out of a live page
   so the rendered document is actually styled. Returns raw CSS blocks. */
function loadStyles(sourcePage) {
  if (!sourcePage) return [];
  // the ORIGINAL page: once retired it is legacy/<name>, and the root file is our own output
  const html = readOriginalPage(sourcePage);
  return (html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [])
    .map(block => block.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, ''));
}

/* STOPGAP (see the header). Lift the site furniture out of a live page: the
   fixed nav wrapper above <main> and the <footer> below it. */
function loadChrome(sourcePage) {
  if (!sourcePage) return {};
  /* The ORIGINAL page (renderer/source-page.js). After P9-T1 retires a page,
     the root file is the pre-rendered output: lifting chrome from it would
     copy our own output back into itself on every render. */
  const html = readOriginalPage(sourcePage);
  const header = html.match(/<div class="fixed-nav-wrapper">[\s\S]*?<\/div><!-- \/\.fixed-nav-wrapper -->/i);
  const footer = html.match(/<footer[\s\S]*?<\/footer>/i);
  /* The floating WhatsApp button sits OUTSIDE both, after <footer>, so lifting
     only header + footer silently dropped it - a contact channel, most visible
     on phones. Found at P9-T1 by the full visual diff. It is a plain wa.me link
     with no script behind it, identical on all 18 pages. */
  const floating = html.match(/<a[^>]*class="mobile-fixed-contact-btn"[\s\S]*?<\/a>/i);
  return { header: header ? header[0] : '', footer: footer ? footer[0] : '',
           floating: floating ? floating[0] : '' };
}

function loadTree(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/* Write only if the content actually changed - the same rule scripts/export.js
 * applies to data/. An unchanged publish must leave the working tree clean, or
 * `git diff` stops being a useful description of what a publish did.
 *
 * Since P9-T1 the renderer also writes retired pages to the repo root (see
 * main), and this is what keeps an unchanged publish from dirtying git.
 */
function writeIfChanged(file, content) {
  let before = null;
  try { before = fs.readFileSync(file, 'utf8'); } catch (e) { /* new file */ }
  if (before === content) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  return true;
}

/* ---------------------------------------------------------------------- CLI

   node renderer/render.js [tree.json ...]

   Renders each tree for every language in scope into renderer/.out/
   (gitignored, always), and - for a page whose original has been retired to
   legacy/ - to the page's own path in the repo root, which is what GitHub
   Pages serves. Pages not yet retired are never written over. */
const OUT = path.join(__dirname, '.out');

/* The published page trees. Until P9-T1 the default here was the P5-T1
   fixture in renderer/sample/, which meant `npm run publish` and `test:seo`
   gated a hand-made sample while the tree the editor actually saves - the one
   that ships - was never rendered or checked. That is how an editor demo
   section sat in data/pages/products.json unnoticed. The fixture stays, but
   only test:render uses it, by explicit path. */
function publishedTrees() {
  const dir = path.join(__dirname, '..', 'data', 'pages');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()
    .map(f => path.join(dir, f));
}

function main(argv) {
  const files = argv.length ? argv : publishedTrees();
  if (!files.length) {
    console.log('No page trees in data/pages/ - nothing to render.');
    return;
  }
  const data = loadData();
  const registry = sectionRegistry();
  fs.mkdirSync(OUT, { recursive: true });

  console.log('Rendering ' + files.length + ' page tree(s), languages: ' +
              LANGS_IN_SCOPE.join(', ') + '\n');

  files.forEach(f => {
    const tree = loadTree(path.isAbsolute(f) ? f : path.join(process.cwd(), f));
    const assets = tree.assets || {};
    const styles = loadStyles(assets.stylesFrom);
    const chrome = loadChrome(assets.chromeFrom);
    if (assets.stylesFrom) {
      console.log('  ! CSS lifted from ' + assets.stylesFrom +
                  ' (' + styles.length + ' block(s), ' +
                  Math.round(styles.join('').length / 1024) + ' KB) — ' +
                  'this site has no shared stylesheet yet.');
    }

    LANGS_IN_SCOPE.forEach(lang => {
      const html = renderPage(tree, lang, data, { styles, chrome, registry });
      /* every behaviour script the page links must exist, or the page ships dead */
      (html.match(/<script src="assets\/[^"]+"/g) || []).forEach(tag => {
        const src = tag.replace(/^<script src="/, '').replace(/"$/, '');
        if (!fs.existsSync(path.join(ROOT, src))) throw new Error(tree.path + ' links ' + src + ', which does not exist');
      });
      const rel = pagePath(tree, lang).replace(/^\//, '');
      const dest = path.join(OUT, rel);
      const changed = writeIfChanged(dest, html);
      console.log('    ' + lang + '  ' + rel + '  ' +
                  Math.round(html.length / 1024) + ' KB  ' +
                  (changed ? 'written  ' : 'unchanged') + '  -> ' + pageUrl(tree, lang));
      /* THE PUBLIC SITE (P9-T1). A page whose hand-coded original has been
         retired to legacy/ is served from the pre-rendered file at its own URL,
         so the render is written to the repo root as well - only if it changed,
         so an unchanged publish leaves `git status` clean. A page that has NOT
         been retired is never written over: the original stays the live page
         until the migration is finished and it is moved to legacy/. */
      if (isRetired(tree.path)) {
        const live = path.join(ROOT, rel);
        const liveChanged = writeIfChanged(live, html);
        console.log('        -> site root  ' + rel + '  ' + (liveChanged ? 'written' : 'unchanged') +
                    '   (original retired to legacy/' + tree.path + ')');
      }
      /* Disputed prices are refused at the cart, never picked. Say so on every
         render, so a publish cannot look finished while a product is unsellable. */
      const held = Object.keys(PRICE_HOLD).filter(sku => html.indexOf('data-sku="' + sku + '"') !== -1);
      if (held.length) {
        console.log('  ! PRICE HOLD: ' + held.join(', ') + ' cannot be added to the cart on ' + rel +
                    ' until the client confirms the price (assets/site.js PRICE_HOLD).');
      }
    });
  });

  console.log('\nWritten to renderer/.out/ (gitignored); retired pages also to the repo root. Pages not retired are untouched.');
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (err) { console.error('\nRender failed: ' + err.message); process.exit(1); }
}

module.exports = {
  renderSection, renderBody, renderPage,
  loadData, loadStyles, loadChrome, loadTree, writeIfChanged, resolveData, publishedTrees,
  LANGS_IN_SCOPE, LANGS, PRIMARY
};
