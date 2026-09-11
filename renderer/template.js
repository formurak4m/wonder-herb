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

/* The second load-bearing script, found while proving P5-T1 (docs/FINDINGS.md
 * finding 15). The chrome's .fixed-nav-wrapper is position:fixed, and NOTHING
 * in the CSS reserves room for it - the live pages measure the nav at runtime
 * and set body { padding-top } from JS (產品介紹.html:1963). Lift the chrome
 * markup without that script and the page's own <h1> renders underneath the
 * nav bar: same "passes green, looks broken" class as finding 12.
 *
 * Shipped only when the page actually has chrome. It is a stopgap in the same
 * way `chrome` itself is: the real fix is a known nav height in CSS so a
 * JavaScript-off visitor is correct too, and that comes with the Phase 9
 * decision about how chrome is modelled. */
const NAV_OFFSET_SCRIPT = [
  '(function () {',
  '  var nav = document.querySelector(".fixed-nav-wrapper");',
  '  if (!nav) return;',
  '  var sync = function () {',
  '    document.body.style.paddingTop = nav.getBoundingClientRect().height + "px";',
  '  };',
  '  sync();',
  '  window.addEventListener("resize", sync);',
  '  window.addEventListener("load", sync);',
  '  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sync);',
  '})();'
].join('\n');

const NOSCRIPT_REVEAL =
  '  <noscript><style>\n' +
  '    /* No JavaScript, no IntersectionObserver, so nothing would ever add\n' +
  '       .is-visible. Show the content instead of a blank page. */\n' +
  '    .reveal-on-scroll { opacity: 1 !important; transform: none !important; }\n' +
  '  </style></noscript>';

function baseTemplate({ head, body, lang, bodyClass, chrome, scripts, main }) {
  const htmlLang = HTML_LANG[lang || PRIMARY] || lang || HTML_LANG[PRIMARY];
  const c = chrome || {};
  const content = main === false ? body : '<main>\n' + body + '\n</main>';

  const extra = (scripts || []).map(s => '<script>\n' + s + '\n</script>').join('\n');

  return '<!doctype html>\n' +
    '<html lang="' + htmlLang + '">\n' +
    '<head>\n' +
    head + '\n' +
    NOSCRIPT_REVEAL + '\n' +
    '</head>\n' +
    '<body' + (bodyClass ? ' class="' + bodyClass + '"' : '') + '>\n' +
    (c.header ? c.header + '\n' : '') +
    content + '\n' +
    (c.footer ? c.footer + '\n' : '') +
    '\n<!-- scroll reveal: see docs/FINDINGS.md finding 12. Load-bearing. -->\n' +
    '<script>\n' + REVEAL_SCRIPT + '\n</script>\n' +
    (c.header
      ? '<!-- fixed-nav offset: see docs/FINDINGS.md finding 15. Load-bearing. -->\n' +
        '<script>\n' + NAV_OFFSET_SCRIPT + '\n</script>\n'
      : '') +
    (extra ? extra + '\n' : '') +
    '</body>\n' +
    '</html>\n';
}

module.exports = {
  baseTemplate, REVEAL_SCRIPT, NAV_OFFSET_SCRIPT, NOSCRIPT_REVEAL, HTML_LANG
};
