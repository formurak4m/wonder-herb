/* baseTemplate({ head, body, lang }) - the document shell around a rendered page.
 *
 * ============================================================================
 * THE SCROLL-REVEAL SCRIPT IS LOAD-BEARING. DO NOT REMOVE IT.
 * docs/FINDINGS.md finding 12.
 * ============================================================================
 *
 * The live CSS ships `.reveal-on-scroll { opacity: 0 }` (index.html:359) and an
 * IntersectionObserver adds `.is-visible` as each block scrolls in
 * (index.html:4310). Several section components emit `reveal-on-scroll` on
 * purpose, to match that markup. A pre-rendered page served WITHOUT the
 * observer therefore contains every word of its content at opacity 0 - it
 * looks completely blank to a human while passing every automated gate,
 * because the text really is in the HTML. That is the dangerous class of bug:
 * green build, blank page.
 *
 * So this template ships three things, belt and braces:
 *
 *   1. REVEAL_SCRIPT   the observer itself, inline at the end of <body> (the
 *                      elements already exist by then, so no load event is
 *                      needed). If IntersectionObserver is missing it reveals
 *                      everything immediately rather than hiding the page.
 *   2. NOSCRIPT_REVEAL a <noscript> style block forcing .reveal-on-scroll
 *                      visible, so a visitor with JavaScript off - or a
 *                      renderer that does not run scripts - sees the content.
 *                      The live site does NOT do this today; pre-rendering
 *                      makes it both cheap and correct.
 *   3. the two-run check at Phase 9: diff against the baseline with scripts on
 *                      AND with scripts off. The second run is what catches a
 *                      regression here.
 *
 * Anything else that goes in here must be a SMALL enhancement: the published
 * site stays static HTML that works with the API off (CLAUDE.md, hard rule 1).
 * The language switcher is plain links to the per-language URLs, never
 * client-side i18n - that is the whole point of pre-rendering.
 *
 * `chrome` is the site furniture (top bar, nav, footer) that today is
 * hand-copied into all 18 pages. It is passed in as raw HTML rather than
 * modelled, because deciding whether it becomes sections or a shared partial
 * is a Phase 9 question. The template just has to have a place to put it.
 */
const { PRIMARY } = require('./i18n');

/* zh means Traditional Chinese; the live pages all say <html lang="zh-Hant">. */
const HTML_LANG = {
  zh: 'zh-Hant', en: 'en', de: 'de', es: 'es', fr: 'fr', ja: 'ja', ru: 'ru'
};

const REVEAL_SCRIPT = [
  '(function () {',
  '  var els = document.querySelectorAll(".reveal-on-scroll");',
  '  if (!els.length) return;',
  '  var show = function (el) { el.classList.add("is-visible"); };',
  '  if (!("IntersectionObserver" in window)) {',
  '    // never leave the page hidden because the browser is old',
  '    Array.prototype.forEach.call(els, show);',
  '    return;',
  '  }',
  '  var obs = new IntersectionObserver(function (entries) {',
  '    entries.forEach(function (e) {',
  '      if (e.isIntersecting) { show(e.target); obs.unobserve(e.target); }',
  '    });',
  '  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });',
  '  Array.prototype.forEach.call(els, function (el) { obs.observe(el); });',
  '})();'
].join('\n');

/* D1, the chrome layout fix (docs/FINDINGS.md finding 15).
 *
 * The chrome's .fixed-nav-wrapper is position:fixed and NOTHING in the page CSS
 * reserves room for it - the live pages measure the nav at runtime and set
 * body { padding-top } from JS (產品介紹.html:1963). That fixes the scripts-ON
 * case only. With JavaScript off the page's own <h1> renders underneath the nav
 * bar (measured: y=55 against y=219), so a pre-rendered page stays secretly
 * JavaScript-dependent for its layout - which defeats part of why we pre-render
 * at all. Same "passes green, looks broken" class as finding 12.
 *
 * The fix is CSS, and deliberately NOT a hardcoded nav height. The height is
 * genuinely variable: .header-inner is `flex-wrap: wrap`, so the bar measures
 * 164px at 1280 and 139px at 390, and it re-wraps again at intermediate widths
 * and at the larger root font sizes the page sets under 768/480/380px.
 * `position: sticky` pins the bar the way `fixed` did but leaves it IN FLOW, so
 * it reserves exactly its own height whatever that turns out to be. No
 * measurement, no magic number, no JavaScript.
 *
 * `body { overflow-x: clip }` is load-bearing here, not tidying. Every one of
 * the 18 pages sets `overflow-x: hidden` on BOTH html and body. The root
 * element's value propagates to the viewport, which leaves body's own `hidden`
 * making BODY a scroll container - and a sticky box sticks to its nearest
 * scrollport, which would then be a box that never scrolls. Measured: with
 * sticky alone the <h1> clears the nav correctly at both widths AND the bar
 * scrolls off the screen (nav y=-1085 after scrolling 1085px). `clip` clips
 * identically without creating a scroll container, so the bar pins again.
 * Worth stating plainly: fixing only the heading position passes D1's stated
 * acceptance test and ships a nav that no longer stays put.
 *
 * NAV_OFFSET_SCRIPT is deleted, not demoted to a progressive enhancement. With
 * the nav in flow, setting body padding-top is pure double-counting - it would
 * push the heading down by a second nav height. A thing that is wrong when it
 * runs cannot be kept "as an enhancement".
 *
 * AT D2 these two rules MOVED OUT of this file into assets/chrome.css, so that
 * Puck's canvas can link them like any other stylesheet. They could not go into
 * assets/site.css: that loads first so page CSS wins ties, and 產品介紹's own
 * `body` rule is page-specific, so its `overflow-x: hidden` would beat the
 * `clip`. chrome.css is therefore linked LAST, after the page sheet.
 *
 * Which leaves one way to lose D1 silently: a page tree that has chrome but
 * forgets to link chrome.css would render with the nav overlapping the heading
 * again, and every gate would still pass. CHROME_SHEET below is that guard. */
const CHROME_SHEET = 'assets/chrome.css';

const NOSCRIPT_REVEAL =
  '  <noscript><style>\n' +
  '    /* No JavaScript, no IntersectionObserver, so nothing would ever add\n' +
  '       .is-visible. Show the content instead of a blank page. */\n' +
  '    .reveal-on-scroll { opacity: 1 !important; transform: none !important; }\n' +
  '  </style></noscript>';

/* BEHAVIOUR (P9-T1, docs/FINDINGS.md finding 23). A pre-rendered page passed
 * SEO, fidelity and the visual diff while its cart, phone menu, quick view and
 * language switcher were all dead - with zero errors, because nothing was bound.
 *
 * Behaviour lives in static files, not here and not in the sections:
 *   - not in section components: that means React in the visitor's browser
 *     (hydration), and the same code would run inside Puck's canvas;
 *   - not inline in this template: copied into every page, uncacheable, and
 *     untestable on its own.
 *
 * SITE_SCRIPT is shared by every page with chrome (cart store, badge, phone
 * menu, language switcher). BEHAVIOURS maps a section type to the file that
 * gives it life, loaded only when the tree contains that section.
 *
 * The guard, like CHROME_SHEET's: the scripts are DERIVED here from the section
 * types, never listed by hand in a tree (a list is a second place to forget),
 * and baseTemplate refuses to render a body without being told its section
 * types - so a caller cannot skip the derivation and ship a dead page.
 *
 * `noscript` is each behaviour's scripts-off rule: a control that needs
 * JavaScript is not shown without it. `visibility` rather than `display` where
 * the control sits in the chrome, so the header keeps its height and the D1
 * scripts-on/off heading position still matches. */
const SITE_SCRIPT = {
  src: 'assets/site.js',
  noscript: '.menu-toggle, .lang-selector, .lang-selector-mobile { visibility: hidden !important; }'
};
const BEHAVIOURS = {
  'product-grid': {
    src: 'assets/behaviour/quick-view.js',
    noscript: '.btn-quickview { display: none !important; }'
  },
  /* The filter panel needs JavaScript, so it is not shown without it - but the
     cases are all in the HTML, so instead of leaving summaries nobody can
     expand, every case's full text is shown and the read-more buttons go. The
     old page rendered NO cases at all without JavaScript. */
  'case-list': {
    src: 'assets/behaviour/case-list.js',
    noscript: '.filter-panel, .read-more-btn { display: none !important; }\n    ' +
              '.case-full { display: block !important; }'
  }
};

/* site.js whenever there is chrome OR any section behaviour (quick view adds to
   the cart through it); it tolerates a page without the chrome's elements, so a
   chrome-less preview draft still works. */
function behavioursFor(sectionTypes, hasChrome) {
  const own = Array.from(new Set(sectionTypes)).sort().filter(t => BEHAVIOURS[t]).map(t => BEHAVIOURS[t]);
  return (hasChrome || own.length) ? [SITE_SCRIPT].concat(own) : [];
}

function baseTemplate({ head, body, lang, bodyClass, chrome, scripts, main, sectionTypes }) {
  const htmlLang = HTML_LANG[lang || PRIMARY] || lang || HTML_LANG[PRIMARY];
  const c = chrome || {};
  const content = main === false ? body : '<main>\n' + body + '\n</main>';

  if (!Array.isArray(sectionTypes)) {
    throw new Error('baseTemplate needs sectionTypes (the tree\'s section types) to derive the ' +
      'behaviour scripts. Without them the page would publish with a dead cart, menu and quick view ' +
      '(docs/FINDINGS.md finding 23).');
  }
  const behaviours = behavioursFor(sectionTypes, Boolean(c.header));
  const noscriptCss = behaviours.map(b => '    ' + b.noscript).join('\n');
  const behaviourTags = behaviours.map(b => '<script src="' + b.src + '" defer></script>').join('\n');

  /* D1 is only in force if the page actually links assets/chrome.css, and it
     must be the LAST stylesheet or the page sheet outranks it. Fail loudly:
     without this the page renders with the heading under the nav and every
     other gate still passes. */
  if (c.header) {
    const links = (head.match(/<link rel="stylesheet" href="([^"]*)"/g) || [])
      .map(l => l.replace(/.*href="/, '').replace(/"$/, ''));
    const at = links.indexOf(CHROME_SHEET);
    if (at === -1) {
      throw new Error('This page has chrome but does not link ' + CHROME_SHEET +
        ' - the nav would overlap the heading with JavaScript off ' +
        '(docs/FINDINGS.md finding 15, D1). Add it to the tree\'s assets.stylesheets.');
    }
    if (at !== links.length - 1) {
      throw new Error(CHROME_SHEET + ' must be the last stylesheet, it is ' +
        (at + 1) + ' of ' + links.length + ' - anything after it outranks the D1 ' +
        'chrome rules (docs/FINDINGS.md finding 15, D1).');
    }
  }

  const extra = (scripts || []).map(s => '<script>\n' + s + '\n</script>').join('\n');

  return '<!doctype html>\n' +
    '<html lang="' + htmlLang + '">\n' +
    '<head>\n' +
    head + '\n' +
    NOSCRIPT_REVEAL + '\n' +
    (noscriptCss ? '  <noscript><style>\n    /* controls that need JavaScript: not shown without it */\n' +
                   noscriptCss + '\n  </style></noscript>\n' : '') +
    '</head>\n' +
    '<body' + (bodyClass ? ' class="' + bodyClass + '"' : '') + '>\n' +
    (c.header ? c.header + '\n' : '') +
    content + '\n' +
    (c.footer ? c.footer + '\n' : '') +
    (c.floating ? c.floating + '\n' : '') +
    '\n<!-- scroll reveal: see docs/FINDINGS.md finding 12. Load-bearing. -->\n' +
    '<script>\n' + REVEAL_SCRIPT + '\n</script>\n' +
    (behaviourTags ? '<!-- behaviour: see docs/FINDINGS.md finding 23. Load-bearing. -->\n' + behaviourTags + '\n' : '') +
    (extra ? extra + '\n' : '') +
    '</body>\n' +
    '</html>\n';
}

module.exports = {
  baseTemplate, REVEAL_SCRIPT, CHROME_SHEET, NOSCRIPT_REVEAL, HTML_LANG,
  SITE_SCRIPT, BEHAVIOURS, behavioursFor
};
