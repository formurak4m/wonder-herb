/* buildHead(tree, lang) - the SEO-critical <head> for one page in one language.
 *
 * Everything here is carried over from what the live pages already do. The
 * reference is baseline/head/產品介紹.html, captured at P0-T2 from the site as
 * GitHub Pages actually serves it. Nothing is invented: if the real page does
 * not emit a tag, this does not either.
 *
 * WHAT THE BASELINE HEAD CONTAINS (in this order - the order is reproduced):
 *   charset, viewport, <title>, meta description, meta dateModified,
 *   og:title/description/type/image/locale/site_name,
 *   canonical, hreflang alternates, preconnects + stylesheet links,
 *   one <script type="application/ld+json"> holding an @graph, inline <style>.
 *
 * JSON-LD: DERIVED vs CARRIED
 *   Organization and BreadcrumbList are mechanical - the same site-wide facts
 *   and the page's own crumb trail - so they are built here from SITE and
 *   tree.seo.breadcrumb. Everything else (FAQPage, Product, Review,
 *   AggregateRating) is CONTENT that the hand-written page states and that no
 *   data file holds: data/products.json has no rating, no review text and, per
 *   docs/FINDINGS.md finding 9, a price that disagrees with the schema block.
 *   So those nodes are carried through verbatim from tree.seo.jsonld rather
 *   than guessed at from the catalogue. Deriving them is a Phase 9 decision
 *   that needs the client to reconcile the prices first.
 *
 * HREFLANG: one alternate per language ACTUALLY RENDERED, plus x-default
 *   pointing at the primary. Month 1 renders zh only, so this emits exactly
 *   the two lines the live page has. Do not emit alternates for languages that
 *   have no URL yet - an hreflang pointing at a 404 is worse than none.
 *   Adding languages in Phase 14 means passing a longer `languages` array.
 *
 * STYLESHEETS: the site has NO shared stylesheet. Every page carries ~27 KB of
 *   CSS inline in its own <head>, different per page. `opts.styles` therefore
 *   takes raw CSS blocks that the caller has loaded, and `tree.assets` names
 *   the external sheets. Extracting one shared sheet is a real task and it is
 *   not this one - see the note in render.js.
 */
const { resolveField, PRIMARY } = require('./i18n');

/* Site-wide facts, taken from the JSON-LD Organization node on the live pages. */
const SITE = {
  origin: 'https://www.wonder-herb.com',
  name: '康草堂 Wonder Herb',
  logo: 'https://lh3.googleusercontent.com/d/1mQafHatzw_gwbV_J9Y5AmwIAUS9r8SEi',
  image: 'https://lh3.googleusercontent.com/d/1j4nnDKPYyQ7naWRboMd3fPS8pvrlEtDq',
  telephone: '+85293318571',
  contactType: 'customer service',
  availableLanguage: ['Chinese', 'English', 'German'],
  sameAs: [
    'https://www.facebook.com/wonderherbhealth',
    'https://www.instagram.com/wonderherb_hk/'
  ]
};

/* The site's own 7 languages -> the codes the <head> has to speak.
   zh means Traditional Chinese here; the live pages say zh-Hant. */
const HREFLANG = {
  zh: 'zh-Hant', en: 'en', de: 'de', es: 'es', fr: 'fr', ja: 'ja', ru: 'ru'
};
const OG_LOCALE = {
  zh: 'zh_HK', en: 'en_US', de: 'de_DE', es: 'es_ES',
  fr: 'fr_FR', ja: 'ja_JP', ru: 'ru_RU'
};

const esc = s => String(s === undefined || s === null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Where a page lives. The primary language keeps the canonical path it has
   today (產品介紹.html); other languages get a /<lang>/ prefix. One function,
   so adding languages later is a loop and not a rewrite. */
function pagePath(tree, lang) {
  const file = String(tree.path || ((tree.slug || '') + '.html')).replace(/^\/+/, '');
  return (lang === PRIMARY ? '/' : '/' + lang + '/') + file;
}
function pageUrl(tree, lang) {
  return SITE.origin + pagePath(tree, lang);
}

function organizationNode() {
  return {
    '@type': 'Organization',
    '@id': SITE.origin + '/#organization',
    name: SITE.name,
    url: SITE.origin + '/',
    logo: SITE.logo,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: SITE.telephone,
      contactType: SITE.contactType,
      availableLanguage: SITE.availableLanguage
    },
    sameAs: SITE.sameAs
  };
}

/* tree.seo.breadcrumb: [{ name, path }] - path '' is the home page. */
function breadcrumbNode(crumbs) {
  if (!Array.isArray(crumbs) || !crumbs.length) return null;
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: SITE.origin + '/' + String(c.path || '').replace(/^\/+/, '')
    }))
  };
}

/* A JSON-LD payload must never contain a literal "</script>". */
const ldSafe = json => json.replace(/</g, '\\u003c');

function buildHead(tree, lang, opts) {
  const o = opts || {};
  const l = lang || PRIMARY;
  const languages = (o.languages && o.languages.length) ? o.languages : [PRIMARY];
  const seo = resolveField(tree.seo || {}, l);

  const title = seo.title || resolveField(tree.title || '', l);
  const url = pageUrl(tree, l);
  const assets = tree.assets || {};
  const out = [];

  out.push('  <meta charset="UTF-8">');
  out.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">');
  out.push('  <title>' + esc(title) + '</title>');
  if (seo.description) {
    out.push('  <meta name="description" content="' + esc(seo.description) + '">');
  }
  if (seo.dateModified) {
    out.push('');
    out.push('  <meta name="dateModified" content="' + esc(seo.dateModified) + '">');
  }

  out.push('');
  out.push('  <!-- Open Graph -->');
  out.push('  <meta property="og:title" content="' + esc(seo.ogTitle || title) + '">');
  if (seo.description || seo.ogDescription) {
    out.push('  <meta property="og:description" content="' + esc(seo.ogDescription || seo.description) + '">');
  }
  out.push('  <meta property="og:type" content="' + esc(seo.ogType || 'website') + '">');
  out.push('  <meta property="og:image" content="' + esc(seo.image || SITE.image) + '">');
  out.push('  <meta property="og:locale" content="' + esc(OG_LOCALE[l] || l) + '">');
  out.push('  <meta property="og:site_name" content="' + esc(SITE.name) + '">');

  out.push('');
  out.push('  <link rel="canonical" href="' + esc(url) + '">');
  languages.forEach(code => {
    out.push('  <link rel="alternate" hreflang="' + esc(HREFLANG[code] || code) +
             '" href="' + esc(pageUrl(tree, code)) + '">');
  });
  out.push('  <link rel="alternate" hreflang="x-default" href="' +
           esc(pageUrl(tree, PRIMARY)) + '">');

  if (assets.preconnect || assets.stylesheets) {
    out.push('');
    (assets.preconnect || []).forEach(p => {
      const href = typeof p === 'string' ? p : p.href;
      const cors = (p && p.crossorigin) ? ' crossorigin=""' : '';
      out.push('  <link rel="preconnect" href="' + esc(href) + '"' + cors + '>');
    });
    (assets.stylesheets || []).forEach(href => {
      out.push('  <link rel="stylesheet" href="' + esc(href) + '">');
    });
  }

  /* Derived nodes first, then whatever the page itself states. The live
     head orders them Organization, BreadcrumbList, FAQPage, Product... */
  const graph = [organizationNode(), breadcrumbNode(seo.breadcrumb)]
    .concat(Array.isArray(seo.jsonld) ? seo.jsonld : [])
    .filter(Boolean);
  if (graph.length) {
    const payload = { '@context': 'https://schema.org', '@graph': graph };
    out.push('');
    out.push('  <script type="application/ld+json">');
    out.push(ldSafe(JSON.stringify(payload, null, 2)).split('\n').map(x => '  ' + x).join('\n'));
    out.push('  </script>');
  }

  /* Inline CSS, because there is no shared stylesheet yet. */
  (o.styles || []).forEach(css => {
    out.push('  <style>');
    out.push(css);
    out.push('  </style>');
  });

  return out.join('\n');
}

module.exports = { buildHead, pageUrl, pagePath, SITE, HREFLANG, OG_LOCALE };
