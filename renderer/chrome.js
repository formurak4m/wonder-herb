/* The shared site chrome: top bar, nav, footer, floating contact button, and
 * the homepage's SVG filter defs.
 *
 * WHAT THIS REPLACED, and why it stopped being optional (P10). Until now the
 * renderer LIFTED chrome out of whichever hand-coded page a tree named
 * (`assets.chromeFrom`), because every one of the 18 pages carries its own
 * hand-copied copy. That was a deliberate stopgap and it worked for all of
 * Phase 9. Two things ended it:
 *
 *   1. Phase 10 re-hosts the nav logo and the seven flag icons. Under the lift
 *      those URLs live inside 15 RETIRED pages in legacy/, so "move the media"
 *      would have meant editing 15 files nobody is supposed to touch - and the
 *      standing rule is that re-hosting an asset is a data edit. Here the URLs
 *      are `{{media.*}}` tokens filled from data/site.json, so it is one.
 *   2. Phase 13's add-page-from-template needs chrome for a page that has no
 *      original to lift from.
 *
 * WHY ONE TEMPLATE IS SAFE, measured rather than assumed. The 15 retired pages
 * hold 9 byte-distinct headers. Normalising the active nav class, whitespace
 * and comments collapses all 15 to ONE: the only real difference is which nav
 * link carries `class="active"`, and the two odd ones out differ by a stray
 * space before a `>` (小册子) and an HTML comment (微信發表文章). So the
 * template carries no active link at all and `siteChrome(page)` adds it for
 * whichever page is being rendered - which is exactly the shape Phase 13 needs.
 *
 * The proof that this is faithful is not this comment: it is the full visual
 * diff of all 15 pages at 1280 and 390, scripts on and off, re-run after the
 * switch.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'chrome');
const SITE = path.join(__dirname, '..', 'data', 'site.json');

/* Strip the generated-file banner: it is for a human reading the partial, not
   for the published page. */
const stripComment = html => html.replace(/^<!--[\s\S]*?-->\s*/, '');

function readPart(name) {
  const file = path.join(DIR, name);
  return fs.existsSync(file) ? stripComment(fs.readFileSync(file, 'utf8')).trim() : '';
}

/* data/site.json holds the chrome's own media. Kept in data/ rather than in
   the template so re-hosting the logo or a flag is the same kind of edit as
   re-hosting a product photo. */
function siteData() {
  try {
    return JSON.parse(fs.readFileSync(SITE, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    return { chrome: {} };
  }
}

/* {{media.logo}} / {{media.flags.en}} -> the URL. An UNKNOWN token is left
   alone rather than replaced with "undefined": a visibly broken token in the
   output is a bug someone notices, an empty src is one nobody does. */
function fill(html, media) {
  return html.replace(/\{\{media\.([\w.]+)\}\}/g, (whole, keyPath) => {
    const value = keyPath.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), media);
    return typeof value === 'string' ? value : whole;
  });
}

const PRIMARY_LANG = 'zh';

/* {{chat.*}} -> the chat widget's wording (P13-T5).
 *
 * Kept separate from `fill` above because these are STRINGS chosen by page
 * language, not URLs: `site.chat.strings[lang]` with the standard zh fallback,
 * plus `handoffHref`, which is the same in every language.
 *
 * ESCAPED, unlike the media filler. A media value is a URL we wrote; these are
 * sentences an admin will eventually edit, they land in `aria-label` and
 * `placeholder` attributes as well as in text, and they already contain
 * apostrophes ("isn't", "can't"). An unescaped `&` or `"` would break the
 * attribute it sits in, so every value is escaped for both positions.
 *
 * An unknown token is left alone rather than replaced with "undefined", the
 * same rule as `fill`: a visible broken token is a bug someone notices. */
const escapeValue = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function chatStrings(site, lang) {
  const chat = site.chat || {};
  const byLang = chat.strings || {};
  const picked = byLang[lang] || byLang[PRIMARY_LANG] || {};
  return Object.assign({}, picked, { handoffHref: chat.handoffHref || '' });
}

function fillChat(html, site, lang) {
  const values = chatStrings(site, lang);
  return html.replace(/\{\{chat\.([\w.]+)\}\}/g, (whole, key) =>
    typeof values[key] === 'string' ? escapeValue(values[key]) : whole);
}

/* Mark the nav link for the page being rendered.
   ONLY INSIDE <nav class="nav-menu">. The header holds other links to the same
   pages - the logo links to index.html, and the phone bar links to 產品介紹 -
   so matching on href alone highlighted the LOGO on the homepage instead of
   its nav item. The live markup puts `active` on exactly one <a>, and it is
   always in the nav menu. */
function markActive(header, page) {
  if (!page) return header;
  const nav = header.match(/<nav class="nav-menu"[\s\S]*?<\/nav>/i);
  if (!nav) return header;
  const esc = page.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('<a([^>]*?)href="' + esc + '"([^>]*?)>');
  const marked = nav[0].replace(re, (whole, before, after) => {
    if (/class="/.test(before + after)) {
      return whole.replace(/class="([^"]*)"/, (c, v) => 'class="' + (v ? v + ' active' : 'active') + '"');
    }
    return '<a' + before + 'href="' + page + '"' + after + ' class="active">';
  });
  return header.replace(nav[0], marked);
}

/* { header, footer, floating, filters, chat } for one page.
   `filters` (the SVG filter defs five of index.html's CSS rules apply, finding
   33) is emitted only for the page that asks for it.
   `chat` (P13-T5) is emitted only while data/site.json says `chat.enabled`, so
   turning the widget off is a data edit and leaves no markup behind. It is its
   own partial rather than part of floating.html so that switching it off does
   not mean editing around the WhatsApp button, which it must never disturb. */
function siteChrome(page, opts) {
  const o = opts || {};
  const site = siteData();
  const media = site.chrome || {};
  const lang = o.lang || PRIMARY_LANG;
  const chatOn = Boolean(site.chat && site.chat.enabled);
  return {
    header: fill(markActive(readPart('header.html'), page), media),
    footer: fill(readPart('footer.html'), media),
    floating: fill(readPart('floating.html'), media),
    filters: o.filters ? fill(readPart('filters.html'), media) : '',
    chat: chatOn ? fillChat(readPart('chat.html'), site, lang) : ''
  };
}

module.exports = { siteChrome, fill, fillChat, chatStrings, markActive, siteData };
