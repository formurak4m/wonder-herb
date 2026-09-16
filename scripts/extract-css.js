/* D2 (docs/FINDINGS.md finding 15): extract a shared stylesheet.
 *
 * Until this existed, every rendered page inlined a full copy of one of the 18
 * live pages' CSS, lifted verbatim by `renderer/render.js` (`assets.stylesFrom`),
 * and the renderer printed a `!` warning on every lift so the stopgap could not
 * go quiet. Two things needed a real file: a rendered page should link a sheet
 * rather than carry 27 KB of someone else's inline CSS, and Puck's canvas runs
 * in an iframe that has nothing to link (finding 15, D2).
 *
 * WHAT THIS WRITES
 *   assets/site.css          rules that are byte-identical on >= SHARED_MIN of
 *                            the 18 pages AND provably safe to hoist (below)
 *   assets/page-<slug>.css   everything else that page needs, in its own order
 *
 * Linked in that order, so page CSS wins ties against site CSS.
 *
 * THE CASCADE TRAP THIS GUARDS
 * Splitting one ordered stylesheet into two moves EVERY shared rule ahead of
 * EVERY page rule. For two rules with the same selector and the same specificity
 * the winner is whichever comes last, so hoisting can silently flip which one
 * applies. Measured on 產品介紹.html: 29 selectors appear more than once, 7 of
 * them straddle the split, and 2 of those 7 disagree on a property they both set
 * (`.logo img` height, `.footer-social a:hover` color). Hoisting those two would
 * have changed the rendered page.
 *
 * So a unit is only hoisted if its selector does not straddle the split on ANY
 * of the 18 pages - not just on the page being migrated, because site.css is one
 * file shared by all of them. Straddling selectors stay in the page file, where
 * their original relative order survives intact.
 *
 * This check cannot see every possible conflict: two DIFFERENT selectors of equal
 * specificity matching the same element and property also flip when reordered,
 * and no static check short of a full cascade model finds those. The 1280/390
 * visual diff, scripts on and off, is the real gate - this just removes the
 * failures we can find cheaply first.
 *
 * NOT wired into `npm run publish`. Run it deliberately when a page migrates or
 * when a live page's CSS changes, then re-run the visual diff.
 *
 * Uses css-tree, which is present transitively rather than as a declared
 * devDependency. If this script stays (it should), declare it.
 */
const fs = require('fs');
const path = require('path');
const { readOriginalPage } = require(path.join(__dirname, '..', 'renderer', 'source-page.js'));
const csstree = require('css-tree');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets');
const SHARED_MIN = 15;

/* Pages that render from a tree and therefore need a page sheet.
   Grows one entry at a time as pages migrate; keep it a hand-checked literal. */
const MIGRATED = {
  'products': '產品介紹.html',
  'faq': '常見問題.html',
  'contact': '聯絡我們.html',
  'brochure': '小册子.html',
  'testing': '有效成份檢測.html',
  'articles': '微信發表文章.html',
  'research': '研究報告.html',
  'cases': '典型病例.html',
  'product-t3': '產品_T3.html',
  'product-pt3': '產品_PT3.html',
  'product-psp-trial': '產品_雲芝糖肽精華_A.html'
};

/* D1, finding 15. These were meant to live at the end of site.css. They cannot:
   site.css loads FIRST so that page CSS wins ties, and 產品介紹's own `body` rule
   is page-specific (its copy has no `scroll-behavior`), so it lands in
   page-products.css and its `overflow-x: hidden` beats a `clip` in site.css.
   Verified by reading the generated files, before the visual diff ran.

   So they get their own sheet, linked LAST, after the page sheet. That keeps
   them in a stylesheet - linkable by Puck's canvas, which is half the point of
   D2 - while actually outranking the page CSS. Anything that must beat page CSS
   belongs here, and nothing else does. See renderer/template.js for the full
   reasoning on the rules themselves. */
const D1_CHROME_CSS = `
/* ------------------------------------------------------------------------- */
/* D1, docs/FINDINGS.md finding 15. The fixed nav reserves its own space in    */
/* CSS so a page lays out correctly with ZERO JavaScript. Measured before this */
/* rule: <h1> at y=55 instead of y=219, i.e. underneath the nav bar.           */
/*                                                                            */
/* Not a hardcoded height on purpose - .header-inner wraps, so the bar is 190, */
/* 164, 141, 139 or 136px depending on width, and is not even stable between   */
/* runs (webfont timing). Sticky keeps it pinned while leaving it in flow, so  */
/* it reserves exactly its own height, whatever that is.                       */
/*                                                                            */
/* overflow-x:clip is load-bearing. Every page sets overflow-x:hidden on html  */
/* AND body; html's value propagates to the viewport, leaving body's own       */
/* 'hidden' making body a scroll container - and a sticky box sticks to its    */
/* nearest scrollport. With 'hidden' the heading lands correctly AND the nav   */
/* scrolls off the screen. 'clip' clips identically without creating one.      */
/*                                                                            */
/* These MUST stay last in this file: they override .fixed-nav-wrapper and     */
/* body rules hoisted from the pages above.                                    */
/* NOTE: the 18 live hand-coded pages keep position:fixed and their own inline */
/* offset script. That is correct for them - they are not pre-rendered.        */
/* ------------------------------------------------------------------------- */
body { overflow-x: clip; }
.fixed-nav-wrapper { position: sticky; }
`;

const norm = s => s.replace(/\s+/g, ' ').trim();

/* One page's inline CSS, flattened to an ordered list of rules, each carrying
   its @media context so a rule inside a media query never merges with the
   top-level rule of the same selector. */
function unitsOf(html) {
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [])
    .map(b => b.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, '')).join('\n');
  const ast = csstree.parse(css);
  const out = [];
  (function walk(node, media) {
    node.children.forEach(child => {
      if (child.type === 'Rule') {
        out.push({ media, sel: norm(csstree.generate(child.prelude)),
                   decls: norm(csstree.generate(child.block)) });
      } else if (child.type === 'Atrule') {
        const at = norm('@' + child.name + ' ' +
                        (child.prelude ? csstree.generate(child.prelude) : ''));
        if (child.block && (child.name === 'media' || child.name === 'supports')) {
          walk(child.block, at);
        } else {
          out.push({ media, sel: at, decls: child.block ? norm(csstree.generate(child.block)) : '',
                     atomic: true });
        }
      }
    });
  })(ast, '');
  return out;
}

const key = u => u.media + '||' + u.sel + '||' + u.decls;
const selKey = u => u.media + '||' + u.sel;

/* Specificity of a selector list, as the highest of its parts. Rough but
   sufficient: we only need to know whether two rules tie, because a tie is what
   makes document order decide the winner. */
function specificity(sel) {
  let best = -1;
  sel.split(',').forEach(part => {
    const s = part.trim();
    const ids = (s.match(/#[\w-]+/g) || []).length;
    const cls = (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length;
    const els = (s.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) || []).length +
                (s.match(/::[\w-]+/g) || []).length;
    best = Math.max(best, ids * 10000 + cls * 100 + els);
  });
  return best;
}

/* Properties a declaration block sets. */
function propsOf(decls) {
  return new Set((decls.replace(/^\{|\}$/g, '').match(/(^|;)\s*([-\w]+)\s*:/g) || [])
    .map(m => m.replace(/[;:]/g, '').trim().toLowerCase()));
}

function main() {
  const pages = fs.readdirSync(ROOT).filter(f => f.toLowerCase().endsWith('.html')).sort();
  const per = {};
  // the ORIGINAL page: a migrated page's root file is renderer output with no inline CSS (legacy/ first)
  pages.forEach(p => { per[p] = unitsOf(readOriginalPage(p)); });

  /* How many of the 18 pages carry this exact rule? */
  const seenOn = new Map();
  pages.forEach(p => new Set(per[p].map(key))
    .forEach(k => seenOn.set(k, (seenOn.get(k) || 0) + 1)));
  let candidates = new Set([...seenOn].filter(([, n]) => n >= SHARED_MIN).map(([k]) => k));

  /* Hoisting moves every shared rule ahead of every page rule. That is safe only
     if no page rule that ORIGINALLY came first could have been beating a shared
     rule on a tie. So: for each page, for every pair (p before s) where p stays
     and s is hoisted, if they tie on specificity, share a media context and set
     any property in common, hoisting s could flip the winner - demote s.
     Repeat until stable, because demoting s can expose a new pair.

     Deliberately conservative: it does not check whether the two selectors can
     actually match the same element, which needs a DOM. It over-demotes rather
     than risk a silent cascade change. An earlier version compared only rules
     with the SAME selector and missed `.container` vs `.header-inner` - equal
     specificity, both setting padding, same element - which shifted the nav by
     32px and the whole page by 96px. */
  const before = candidates.size;
  for (let pass = 0; pass < 12; pass++) {
    const demote = new Set();
    pages.forEach(p => {
      const list = per[p];
      const marks = list.map(u => ({ u, hoisted: candidates.has(key(u)),
                                     spec: specificity(u.sel), props: propsOf(u.decls) }));
      marks.forEach((s, j) => {
        if (!s.hoisted) return;
        for (let i = 0; i < j; i++) {
          const p2 = marks[i];
          if (p2.hoisted || p2.u.media !== s.u.media || p2.spec !== s.spec) continue;
          for (const prop of p2.props) if (s.props.has(prop)) { demote.add(key(s.u)); return; }
        }
      });
    });
    if (!demote.size) break;
    demote.forEach(k => candidates.delete(k));
  }
  const dropped = new Array(before - candidates.size);

  console.log('Extracting a shared stylesheet (D2, docs/FINDINGS.md finding 15)\n');
  console.log('  pages surveyed:                      ' + pages.length);
  console.log('  distinct rule units:                 ' + seenOn.size);
  console.log('  identical on >= ' + SHARED_MIN + ' pages:              ' +
              (candidates.size + dropped.length));
  console.log('  held back, unsafe to reorder:        ' + dropped.length);
  console.log('  still safely shareable:              ' + candidates.size +
              '   -> too few to be worth a shared sheet, see the header\n');

  fs.mkdirSync(OUT, { recursive: true });
  const header = (what, extra) =>
    '/* ' + what + '\n' +
    '   GENERATED by scripts/extract-css.js - do not hand-edit, your change will\n' +
    '   be overwritten. Source of truth is the inline CSS in the live pages.\n' +
    '   ' + extra + ' */\n\n';

  /* NO site.css. See the header: what survives the reorder check is 24 rules,
     and a 3 KB shared sheet against a 28 KB page sheet does not pay for the
     cascade risk. Each page gets its whole stylesheet in its own original order,
     which is reorder-proof by construction. */

  /* Linked last, after the page sheet - see the D1_CHROME_CSS comment. */
  writeIfChanged(path.join(OUT, 'chrome.css'),
    header('assets/chrome.css - D1 chrome layout, must outrank page CSS.',
           'Load LAST, after the page sheet.') +
    D1_CHROME_CSS);

  Object.entries(MIGRATED).forEach(([slug, page]) => {
    const mine = per[page];
    writeIfChanged(path.join(OUT, 'page-' + slug + '.css'),
      header('assets/page-' + slug + '.css - the whole stylesheet for ' + page + '.',
             mine.length + ' rules, in the page\'s own order, so the cascade is ' +
             'identical to the inline original. Load before assets/chrome.css.') +
      render(mine));
    console.log('  ' + page + ': all ' + mine.length + ' rules in original order  (' +
                mine.filter(u => candidates.has(key(u))).length +
                ' would have been safely shareable)');
  });
}

/* Re-emit units, restoring @media wrappers and grouping consecutive rules that
   share one media query so the output reads like a stylesheet. */
function render(units) {
  let out = '', open = '';
  units.forEach(u => {
    if (u.media !== open) {
      if (open) out += '}\n\n';
      open = u.media;
      if (open) out += open + ' {\n';
    }
    const pad = open ? '  ' : '';
    out += pad + u.sel + ' ' + u.decls.replace(/^\{\s*/, '{\n' + pad + '  ')
             .replace(/;\s*/g, ';\n' + pad + '  ').replace(/\s*\}$/, '\n' + pad + '}') + '\n\n';
  });
  if (open) out += '}\n';
  return out;
}

/* Same rule as scripts/export.js and renderer/render.js: an unchanged run must
   leave the working tree clean. */
function writeIfChanged(file, content) {
  let before = null;
  try { before = fs.readFileSync(file, 'utf8'); } catch (e) { /* new file */ }
  if (before === content) { console.log('  ' + path.basename(file) + '  unchanged'); return false; }
  fs.writeFileSync(file, content, 'utf8');
  console.log('  ' + path.basename(file) + '  written  (' +
              Math.round(content.length / 1024) + ' KB)');
  return true;
}

if (require.main === module) {
  try { main(); }
  catch (err) { console.error('\nExtract failed: ' + err.message); process.exit(1); }
}

module.exports = { unitsOf, SHARED_MIN, MIGRATED, D1_CHROME_CSS };
