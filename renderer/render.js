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
 * SCOPE OF P5-T1. This renders a page to a string, and its CLI writes a proof
 * page into renderer/.out/ (gitignored). It does NOT write over any of the 18
 * hand-coded pages - page migration is Phase 9 and the full-site build is
 * P5-T2.
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
const { buildHead, pageUrl, pagePath } = require('./head');
const { baseTemplate } = require('./template');

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
  return node.wrap === 'container' ? '<div class="container">' + html + '</div>' : html;
}

function renderBody(tree, lang, data, registry) {
  return (tree.sections || [])
    .map(node => renderSection(node, lang, data, registry))
    .join('\n');
}

/* A whole document. opts.styles / opts.chrome are resolved by the caller
   (loadStyles / loadChrome below) so this function stays free of file IO. */
function renderPage(tree, lang, data, opts) {
  const o = opts || {};
  const l = lang || PRIMARY;
  const registry = o.registry || sectionRegistry();
  const body = renderBody(tree, l, data, registry);
  const head = buildHead(tree, l, {
    languages: o.languages || LANGS_IN_SCOPE,
    styles: o.styles || []
  });
  return baseTemplate({
    head: head,
    body: body,
    lang: l,
    bodyClass: tree.bodyClass,
    chrome: o.chrome,
    main: tree.main
  });
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
  const html = fs.readFileSync(path.join(ROOT, sourcePage), 'utf8');
  return (html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [])
    .map(block => block.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, ''));
}

/* STOPGAP (see the header). Lift the site furniture out of a live page: the
   fixed nav wrapper above <main> and the <footer> below it. */
function loadChrome(sourcePage) {
  if (!sourcePage) return {};
  const html = fs.readFileSync(path.join(ROOT, sourcePage), 'utf8');
  const header = html.match(/<div class="fixed-nav-wrapper">[\s\S]*?<\/div><!-- \/\.fixed-nav-wrapper -->/i);
  const footer = html.match(/<footer[\s\S]*?<\/footer>/i);
  return { header: header ? header[0] : '', footer: footer ? footer[0] : '' };
}

function loadTree(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/* ---------------------------------------------------------------------- CLI

   node renderer/render.js [tree.json ...]

   Renders each tree for every language in scope into renderer/.out/. That
   folder is gitignored and is NOT the public site: P5-T1 proves the renderer
   works on one page, it does not migrate anything. */
const OUT = path.join(__dirname, '.out');

function main(argv) {
  const files = argv.length ? argv : [path.join(__dirname, 'sample', 'products.json')];
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
      const rel = pagePath(tree, lang).replace(/^\//, '');
      const dest = path.join(OUT, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, html, 'utf8');
      console.log('    ' + lang + '  ' + rel + '  ' +
                  Math.round(html.length / 1024) + ' KB  -> ' + pageUrl(tree, lang));
    });
  });

  console.log('\nWritten to renderer/.out/ (gitignored). The 18 live pages are untouched.');
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (err) { console.error('\nRender failed: ' + err.message); process.exit(1); }
}

module.exports = {
  renderSection, renderBody, renderPage,
  loadData, loadStyles, loadChrome, loadTree,
  LANGS_IN_SCOPE, LANGS, PRIMARY
};
