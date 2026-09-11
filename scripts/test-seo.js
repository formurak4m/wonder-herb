/* THE SEO GATE. A page that loses SEO must not be publishable.
 *
 * This is a gate, not a report: any failure exits non-zero, and Phase 7 wires
 * it into the publish step so a failing page cannot deploy. Nothing here
 * "warns".
 *
 * WHAT IT RUNS AGAINST. The real rendered output, produced by running
 * `renderer/render.js` as a subprocess exactly as `npm run render` does, then
 * reading the files it wrote to renderer/.out/. Not a re-implementation of the
 * render path and not a string built in this file - if the publish path
 * breaks, this breaks.
 *
 * WHAT IT ASSERTS. Per page, in two layers:
 *
 *   Intrinsic   things that must be true of any page on its own: exactly one
 *               <h1>, a non-empty title and description, a canonical that
 *               matches the page's own path, a complete and self-consistent
 *               set of hreflang links, and JSON-LD that parses and is typed.
 *
 *   Baseline    things that must not have CHANGED: the canonical host and the
 *               JSON-LD @types must match baseline/head/<page>.html, the
 *               snapshot of the live site taken at P0-T2. This is what catches
 *               a migration quietly dropping a Product or FAQPage block -
 *               intrinsic checks would still pass, because what is left is
 *               valid, just poorer.
 *
 * ON REQUIRING THE BASELINE. baseline/ is gitignored (~13 MB of screenshots),
 * so this suite fails with an instruction rather than skipping if it is
 * missing. A gate that silently drops half its assertions when an input is
 * absent is the "passes for the wrong reason" pattern. Nothing in CI runs the
 * test suite - .github/workflows/static.yml only uploads and deploys - so the
 * only runner is a developer machine, where `node scripts/baseline.js`
 * regenerates it.
 *
 * ON LANGUAGES. Month 1 renders zh only, so the hreflang set is zh-Hant plus
 * x-default and reciprocity is degenerate (a page referring to itself). The
 * check is written over the whole rendered set, so when Phase 14 adds
 * languages it starts doing real cross-language work without being rewritten.
 *
 * ------------------------------------------------------------------------
 * PENDING DECISION - docs/FINDINGS.md finding 3. 購物車.html renders zero <h1>
 * and carries no JSON-LD; account.html has an <h1> but also no JSON-LD. As
 * written, this gate would block both. The choice is between giving those
 * pages an <h1> or exempting utility pages with an explicit allow-list here.
 * It is the project owner's call and is NOT pre-empted in this file: there is
 * deliberately no allow-list yet. Neither page is rendered at Phase 5, so the
 * gate does not hit it today.
 * ------------------------------------------------------------------------
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'renderer', '.out');
const SAMPLE = path.join(ROOT, 'renderer', 'sample');
const BASELINE = path.join(ROOT, 'baseline', 'head');

const { pagePath, SITE, HREFLANG } = require(path.join(ROOT, 'renderer', 'head.js'));
const { LANGS_IN_SCOPE, PRIMARY } = require(path.join(ROOT, 'renderer', 'render.js'));

let fail = 0;
const check = (label, cond, extra) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '   -> ' + extra : ''));
  if (!cond) fail++;
};
const die = msg => { console.error('\n' + msg + '\n'); process.exit(1); };

/* ------------------------------------------------------------- inputs ----- */

if (!fs.existsSync(BASELINE)) {
  die('SEO gate cannot run: baseline/head/ is missing.\n' +
      'It is the reference this gate asserts against, and it is gitignored.\n' +
      'Regenerate it with:  node scripts/baseline.js');
}

const trees = fs.readdirSync(SAMPLE).filter(f => f.endsWith('.json'))
  .map(f => ({ file: path.join(SAMPLE, f), tree: JSON.parse(fs.readFileSync(path.join(SAMPLE, f), 'utf8')) }));

if (!trees.length) die('SEO gate cannot run: no page trees in renderer/sample/.');

console.log('\n=== render the pages the way publish does ===\n');

execFileSync(process.execPath, [path.join(ROOT, 'renderer', 'build-sections.js')], { cwd: ROOT, stdio: 'pipe' });
execFileSync(process.execPath, [path.join(ROOT, 'renderer', 'render.js')].concat(trees.map(t => t.file)),
             { cwd: ROOT, stdio: 'pipe' });

check('renderer/render.js produced output for every tree',
      trees.every(t => LANGS_IN_SCOPE.every(l =>
        fs.existsSync(path.join(OUT, pagePath(t.tree, l).replace(/^\//, ''))))),
      trees.length + ' tree(s) x ' + LANGS_IN_SCOPE.length + ' language(s)');

/* Every rendered variant, keyed by its canonical URL so reciprocity can look
   the other side of an hreflang up. */
const rendered = new Map();
trees.forEach(({ tree }) => {
  LANGS_IN_SCOPE.forEach(lang => {
    const rel = pagePath(tree, lang).replace(/^\//, '');
    const file = path.join(OUT, rel);
    if (!fs.existsSync(file)) return;
    const html = fs.readFileSync(file, 'utf8');
    rendered.set(SITE.origin + pagePath(tree, lang), {
      tree, lang, rel, html, doc: new JSDOM(html).window.document
    });
  });
});

const attr = (doc, sel, name) => {
  const el = doc.querySelector(sel);
  return el ? el.getAttribute(name) : null;
};
const ldNodes = doc => {
  const out = [];
  doc.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
    let parsed;
    try { parsed = JSON.parse(s.textContent); }
    catch (err) { out.push({ bad: err.message }); return; }
    (parsed['@graph'] || [parsed]).forEach(n => out.push(n));
  });
  return out;
};
const typesOf = doc => ldNodes(doc).map(n => (n.bad ? 'BAD_JSON' : n['@type'])).sort();

/* ------------------------------------------------------- intrinsic ------- */

rendered.forEach((page, url) => {
  const { doc, rel, lang, tree } = page;
  const name = rel + ' [' + lang + ']';
  console.log('\n=== ' + name + ' ===\n');

  // 1. exactly one <h1>
  const h1s = doc.querySelectorAll('h1');
  check(name + ': exactly one <h1>', h1s.length === 1,
        h1s.length + (h1s.length === 1 ? ' — "' + h1s[0].textContent.trim() + '"' : ''));

  // 2. non-empty title and description
  const title = (doc.querySelector('title') || {}).textContent || '';
  check(name + ': non-empty <title>', title.trim().length > 0, JSON.stringify(title.slice(0, 50)));
  const desc = attr(doc, 'meta[name="description"]', 'content') || '';
  check(name + ': non-empty meta description', desc.trim().length > 0, desc.length + ' chars');

  // 3. canonical matches this page's own path
  const canonical = attr(doc, 'link[rel="canonical"]', 'href');
  check(name + ': has a canonical', !!canonical, canonical || 'MISSING');
  check(name + ': canonical matches the page path', canonical === url, canonical === url ? canonical : 'expected ' + url);

  // 4. hreflang: one per in-scope language, plus x-default
  const alts = [...doc.querySelectorAll('link[rel="alternate"][hreflang]')]
    .map(l => ({ lang: l.getAttribute('hreflang'), href: l.getAttribute('href') }));
  const want = LANGS_IN_SCOPE.map(l => HREFLANG[l]).concat(['x-default']);
  check(name + ': one hreflang per in-scope language, plus x-default',
        alts.map(a => a.lang).sort().join(',') === want.slice().sort().join(','),
        alts.map(a => a.lang).join(', ') + '   (want ' + want.join(', ') + ')');
  check(name + ': x-default points at the primary language',
        (alts.find(a => a.lang === 'x-default') || {}).href === SITE.origin + pagePath(tree, PRIMARY),
        (alts.find(a => a.lang === 'x-default') || {}).href || 'MISSING');
  check(name + ': its own hreflang points at itself',
        (alts.find(a => a.lang === HREFLANG[lang]) || {}).href === url,
        (alts.find(a => a.lang === HREFLANG[lang]) || {}).href || 'MISSING');

  // 5. every JSON-LD block parses and is typed
  const nodes = ldNodes(doc);
  check(name + ': every JSON-LD block is valid JSON',
        nodes.every(n => !n.bad), nodes.filter(n => n.bad).map(n => n.bad).join('; ') || nodes.length + ' node(s)');
  check(name + ': every JSON-LD node has an @type',
        nodes.length > 0 && nodes.every(n => n.bad || (typeof n['@type'] === 'string' && n['@type'])),
        nodes.length ? typesOf(doc).join(', ') : 'NO JSON-LD AT ALL');
});

/* ------------------------------------------------------ reciprocity ------ */
console.log('\n=== hreflang reciprocity across language variants ===\n');

rendered.forEach((page, url) => {
  const mine = [...page.doc.querySelectorAll('link[rel="alternate"][hreflang]')]
    .map(l => l.getAttribute('hreflang') + ' ' + l.getAttribute('href')).sort().join(' | ');
  [...page.doc.querySelectorAll('link[rel="alternate"][hreflang]')]
    .filter(l => l.getAttribute('hreflang') !== 'x-default')
    .forEach(l => {
      const href = l.getAttribute('href');
      const other = rendered.get(href);
      if (!other) {
        check(page.rel + ' [' + page.lang + ']: hreflang ' + l.getAttribute('hreflang') + ' points at a page that was rendered',
              false, href + ' — NOT RENDERED (an hreflang pointing at a 404 is worse than none)');
        return;
      }
      const theirs = [...other.doc.querySelectorAll('link[rel="alternate"][hreflang]')]
        .map(x => x.getAttribute('hreflang') + ' ' + x.getAttribute('href')).sort().join(' | ');
      check(page.rel + ' [' + page.lang + '] <-> ' + other.rel + ' [' + other.lang + ']: hreflang sets are reciprocal',
            mine === theirs,
            mine === theirs ? LANGS_IN_SCOPE.length + ' language(s) + x-default, both sides identical' : 'DIFFER');
    });
});

/* --------------------------------------------------------- baseline ------ */
console.log('\n=== against the P0-T2 baseline (nothing silently lost) ===\n');

rendered.forEach((page, url) => {
  if (page.lang !== PRIMARY) return;            // the baseline only has the zh site
  const base = path.join(BASELINE, page.rel);
  if (!fs.existsSync(base)) {
    check(page.rel + ': has a baseline head to compare against', false,
          'baseline/head/' + page.rel + ' missing — re-run node scripts/baseline.js');
    return;
  }
  const bdoc = new JSDOM(fs.readFileSync(base, 'utf8')).window.document;

  const bCanonical = attr(bdoc, 'link[rel="canonical"]', 'href');
  const host = u => { try { return new URL(u).host; } catch (e) { return '(unparseable)'; } };
  check(page.rel + ': canonical host matches the baseline',
        host(attr(page.doc, 'link[rel="canonical"]', 'href')) === host(bCanonical),
        host(bCanonical));
  check(page.rel + ': canonical path matches the baseline',
        attr(page.doc, 'link[rel="canonical"]', 'href') === bCanonical,
        bCanonical);

  const got = typesOf(page.doc), want = typesOf(bdoc);
  check(page.rel + ': JSON-LD @types match the baseline',
        got.join(',') === want.join(','),
        got.join(',') === want.join(',')
          ? want.length + ' node(s): ' + want.join(', ')
          : '\n        baseline: ' + want.join(', ') + '\n        rendered: ' + got.join(', '));

  const bTitle = ((bdoc.querySelector('title') || {}).textContent || '').trim();
  check(page.rel + ': <title> matches the baseline',
        ((page.doc.querySelector('title') || {}).textContent || '').trim() === bTitle, bTitle);
  check(page.rel + ': meta description matches the baseline',
        attr(page.doc, 'meta[name="description"]', 'content') ===
        attr(bdoc, 'meta[name="description"]', 'content'), 'identical');
});

console.log('\n' + (fail ? '=== ' + fail + ' CHECK(S) FAILED — THIS BLOCKS PUBLISH ===' : '=== ALL CHECKS PASSED ==='));
process.exit(fail ? 1 : 0);
