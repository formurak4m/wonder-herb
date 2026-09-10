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
  check(type + ': produces markup', typeof html === 'string' && html.length > 0,
        html === null ? 'threw' : html.length + ' chars');

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

console.log('\n' + (fail ? '=== ' + fail + ' CHECK(S) FAILED ===' : '=== ALL CHECKS PASSED ==='));
process.exit(fail ? 1 : 0);
