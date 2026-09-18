/* test:media - where the site is allowed to fetch anything from, offline.
 *
 * ===================================================================
 * THE GOVERNING RULE: THE DECLARED-HOST LIST, NOT THE URL PATTERN.
 * ===================================================================
 *
 * EVERY absolute URL in data/ must be on a host DECLARED in data/site.json,
 * with a kind and a written reason - as a media host in `media.hosts`, or as
 * something else in `externalHosts` (a link, an embed, a vocabulary, a runtime
 * dependency). Nothing external may appear anywhere in the site's data without
 * someone writing down what it is and why it is there.
 *
 * WHY THAT IS THE RULE, and not "find the things that look like assets".
 * Recognising media by the SHAPE of its URL has now failed three times, each
 * time on an asset that did not look like one:
 *
 *   - finding 28: 小册子 swaps its brochure scan per language. Structurally
 *     perfect, and it would have published the German brochure to Chinese
 *     visitors. Only the visual diff saw it.
 *   - finding 1, Phase 10: two research PDFs served from
 *     `www.wonder-herb.com/_files/ugd/` - Wix's file store on the CLIENT'S OWN
 *     DOMAIN. They read as internal links. The first inventory missed them.
 *   - P10-T3: five links to Drive DOCUMENTS, `drive.google.com/file/d/<id>/
 *     view`, with no extension and no media word in the path. The scanner in
 *     this very file could not see them.
 *
 * A pattern can only catch what someone already thought of. A declared-host
 * list inverts the burden: an UNDECLARED host is a failure by default, whatever
 * its URL looks like. The shape heuristic below still exists, but it has been
 * demoted - it decides WHICH contract applies to a URL, never WHETHER the URL
 * is accounted for.
 *
 * And the inverse catches the rest: a URL on a declared MEDIA host that the
 * shape heuristic did NOT flag is reported, because that is precisely the
 * Drive-document miss, and it is caught there without the heuristic having to
 * be right.
 *
 * ===================================================================
 *
 * WHY THIS SUITE EXISTS AT ALL. A media URL is the one kind of content no
 * other gate looks at. SEO checks that an og:image EXISTS, never where it
 * points; the fidelity maps compare tags and classes; test:behaviour asserts
 * effects. A photo moved to a bucket nobody can read, a model left on a host
 * that dies at cutover, or a fourth-party CDN quietly added to the page passes
 * every one of them.
 *
 * WHAT IT ASSERTS, in three layers:
 *
 *   0. ALWAYS. Every absolute URL in data/ is on a declared host (the rule
 *      above), and every media reference is https.
 *
 *   1. ALWAYS. Every MEDIA reference is on a host declared in `media.hosts`
 *      specifically - a link host is not a licence to serve an asset from it.
 *
 *   2. ONCE `media.base` IS SET (Phase 10, when the assets move to R2). Every
 *      media reference must start with that base; must be content-addressed
 *      (`-<8 hex>.<ext>`), which is what makes `immutable` caching safe and
 *      let finding 34's cache-buster be deleted rather than replaced; and no
 *      reference may remain on a host listed as retired.
 *
 * Layer 2 is data-driven on purpose: the move flips it on by editing
 * data/site.json, not this file.
 *
 * THIS SUITE IS OFFLINE. Whether those URLs actually RESOLVE, with the right
 * content type, CORS and cache headers, is `npm run check:media`, which talks
 * to the real host and is not part of test:all.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let fail = 0;
const check = (label, cond, extra) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '   -> ' + extra : ''));
  if (!cond) fail++;
};

/* Anything that looks like a fetched asset rather than a page link. A link to
   another site (wa.me, facebook, a PubMed citation) is not media and is not
   this suite's business. */
const MEDIA_EXT = /\.(jpe?g|png|webp|avif|gif|svg|mp4|webm|glb|gltf|pdf)(\?|#|$)/i;
/* `drive.google.com/file/d/<id>/view` is in here because it is a DOCUMENT the
   site links for download - a brochure scan, a lab report - with no extension
   and no media word in its path. It read as an ordinary outbound link, so the
   first version of this scanner could not see five of them, on a host we are
   retiring. Same blind spot, same class, as the two _files/ugd PDFs. */
const MEDIA_HINT = /(googleusercontent|wixstatic|drive\.google\.com\/(thumbnail|uc|file\/d\/)|\/media\/|\/img\/|\/video\/)/i;
const looksLikeMedia = v => typeof v === 'string' && /^https?:\/\//.test(v) &&
  (MEDIA_EXT.test(v) || MEDIA_HINT.test(v));

/* Every media URL in data/, with where it came from. */
function references() {
  const out = [];
  const walk = (o, where, at) => {
    if (typeof o === 'string') { if (looksLikeMedia(o)) out.push({ url: o, where: where + at }); return; }
    if (Array.isArray(o)) return o.forEach((v, i) => walk(v, where, at + '[' + i + ']'));
    if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => walk(v, where, at + '.' + k));
  };
  const read = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
  fs.readdirSync(path.join(ROOT, 'data/pages')).filter(f => f.endsWith('.json')).forEach(f =>
    walk(read(path.join(ROOT, 'data/pages', f)), 'data/pages/' + f, ''));
  ['products.json', 'cases.json', 'faq.json', 'homepage.json', 'site.json'].forEach(f => {
    const p = path.join(ROOT, 'data', f);
    if (fs.existsSync(p)) walk(read(p), 'data/' + f, '');
  });
  return out;
}

/* EVERY absolute URL in data/, media-shaped or not. This is what the governing
   rule is checked against: the shape heuristic above chooses which contract
   applies, this one decides whether the URL is accounted for at all. */
function everyUrl() {
  const out = [];
  const walk = (o, where, at) => {
    if (typeof o === 'string') {
      const m = o.match(/^https?:\/\/[^\s"'<>]+/);
      if (m) out.push({ url: m[0], where: where + at });
      return;
    }
    if (Array.isArray(o)) return o.forEach((v, i) => walk(v, where, at + '[' + i + ']'));
    if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => walk(v, where, at + '.' + k));
  };
  const read = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
  fs.readdirSync(path.join(ROOT, 'data/pages')).filter(f => f.endsWith('.json')).forEach(f =>
    walk(read(path.join(ROOT, 'data/pages', f)), 'data/pages/' + f, ''));
  ['products.json', 'cases.json', 'faq.json', 'homepage.json', 'site.json'].forEach(f => {
    const p = path.join(ROOT, 'data', f);
    if (fs.existsSync(p)) walk(read(p), 'data/' + f, '');
  });
  return out;
}

/* Content-addressed AND cacheable: the URL ends at its extension. The trailing
   anchor is not pedantry - `photo-1234abcd.jpg?v=1699999` is content-addressed
   and still uncacheable, which is exactly the shape finding 34 was. */
const ADDRESSED = /-[0-9a-f]{8}\.[a-z0-9]+$/i;

const site = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data/site.json'), 'utf8').replace(/^﻿/, '')); }
  catch (e) { return {}; }
})();
const media = site.media || {};
const declared = media.hosts || {};
const base = media.base || '';
const retired = media.retiredHosts || [];

const externals = site.externalHosts || {};

console.log('\n=== where the media is declared to live ===\n');
check('data/site.json declares its media hosts', Object.keys(declared).length > 0,
      Object.keys(declared).join(', ') || 'NONE DECLARED');
Object.entries(declared).forEach(([h, why]) => console.log('        ' + h.padEnd(30) + why));
console.log('        base: ' + (base || '(not set - the assets have not moved yet)'));

/* ---- layer 0: THE GOVERNING RULE ----
   Every absolute URL in data/ is on a declared host. Not every media URL -
   every URL. This is the check that does not depend on recognising an asset by
   its shape, and it is the one that would have caught all three misses in the
   header comment on the day they were introduced. */
const hostOfUrl = u => { try { return new URL(u).hostname; } catch (e) { return null; } };
const allUrls = everyUrl();
const knownHost = h => Boolean(h) && (declared[h] !== undefined || externals[h] !== undefined);

console.log('\n=== the governing rule: every external host is declared (' +
            allUrls.length + ' absolute URL(s) in data/) ===\n');
const byHost = new Map();
allUrls.forEach(r => {
  const h = hostOfUrl(r.url);
  if (!byHost.has(h)) byHost.set(h, { n: 0, first: r });
  byHost.get(h).n++;
});
[...byHost.entries()].sort((a, b) => b[1].n - a[1].n).forEach(([h, v]) => {
  const d = declared[h] !== undefined ? 'media'
          : externals[h] ? (externals[h].kind || 'declared') : 'UNDECLARED';
  console.log('        ' + String(v.n).padStart(4) + '  ' + String(h).padEnd(28) + d);
});
const undeclaredHosts = [...byHost.keys()].filter(h => !knownHost(h));
check('every absolute URL in data/ is on a host declared with a kind and a reason',
      undeclaredHosts.length === 0,
      undeclaredHosts.length ? undeclaredHosts.join(', ') + '  <- add it to data/site.json'
                             : byHost.size + ' host(s), all declared');

const noReason = Object.entries(externals).filter(([, v]) => !v || !v.kind || !v.why || !String(v.why).trim());
check('every declared non-media host states a kind AND a reason', noReason.length === 0,
      noReason.length ? noReason.map(([h]) => h).join(', ')
                      : Object.keys(externals).length + ' host(s) with reasons');

const refs = references();

/* The inverse of the shape heuristic, and the check that catches what the
   heuristic misses: a URL sitting on a MEDIA host that the heuristic did not
   flag. That is exactly what the five Drive document links were. */
const shaped = new Set(refs.map(r => r.url));
/* A host can have two roles. `www.wonder-herb.com` serves our own pages AND,
   under /_files/ugd/, Wix's file store. `media.hostPaths` says which part of
   such a host is media; a host with no entry is media everywhere. Without
   this the check would demand that every canonical and every JSON-LD @id be
   treated as an asset. */
const mediaPath = media.hostPaths || {};
const isMediaUrl = u => {
  const h = hostOfUrl(u);
  if (declared[h] === undefined) return false;
  const prefix = mediaPath[h];
  if (!prefix) return true;
  try { return new URL(u).pathname.indexOf(prefix) === 0; } catch (e) { return false; }
};
const unshapedOnMediaHost = allUrls.filter(r => isMediaUrl(r.url) && !shaped.has(r.url));
check('nothing sits on a media host without being treated as media',
      unshapedOnMediaHost.length === 0,
      unshapedOnMediaHost.length
        ? unshapedOnMediaHost.slice(0, 4).map(r => r.url.slice(0, 64) + ' (' + r.where + ')').join('; ') +
          (unshapedOnMediaHost.length > 4 ? ' +' + (unshapedOnMediaHost.length - 4) + ' more' : '')
        : 'the shape heuristic and the host list agree');
console.log('\n=== every media reference in data/ (' + refs.length + ') ===\n');

const hostOf = u => { try { return new URL(u).hostname; } catch (e) { return null; } };

const bad = refs.filter(r => !hostOf(r.url) || !declared[hostOf(r.url)]);
check('every media reference is on a declared host', bad.length === 0,
      bad.length ? bad.slice(0, 4).map(r => hostOf(r.url) + ' (' + r.where + ')').join('; ') +
                   (bad.length > 4 ? ' +' + (bad.length - 4) + ' more' : '')
                 : refs.length + ' reference(s), hosts: ' +
                   [...new Set(refs.map(r => hostOf(r.url)))].join(', '));

const insecure = refs.filter(r => /^http:\/\//i.test(r.url));
check('none is served over plain http', insecure.length === 0,
      insecure.length ? insecure.map(r => r.where).join(', ') : 'all https');

/* ---- layer 2: only once the assets have moved ---- */
console.log('\n=== after the move (active once data/site.json sets media.base) ===\n');

if (!base) {
  check('media.base is not set, so the post-move rules are not yet in force', true,
        'Phase 10 sets it; these checks turn on with it');
  const onRetired = refs.filter(r => retired.includes(hostOf(r.url)));
  console.log('        references still on a host marked retired: ' + onRetired.length +
              (onRetired.length ? ' (expected until the move)' : ''));
} else {
  const off = refs.filter(r => r.url.indexOf(base) !== 0);
  check('every media reference starts with media.base', off.length === 0,
        off.length ? off.slice(0, 4).map(r => r.where).join('; ') : base);

  const stale = refs.filter(r => retired.includes(hostOf(r.url)));
  check('no reference is left on a retired host', stale.length === 0,
        stale.length ? [...new Set(stale.map(r => hostOf(r.url)))].join(', ')
                     : 'none of: ' + (retired.join(', ') || '(none declared)'));

  /* Content-addressed: <name>-<8 hex>.<ext>. This is what makes an immutable
     cache header safe, and it is why finding 34's ?v= buster could be deleted
     outright instead of replaced. */
  const notAddressed = refs.filter(r => !ADDRESSED.test(r.url));
  check('every media URL is content-addressed', notAddressed.length === 0,
        notAddressed.length ? notAddressed.slice(0, 4).map(r => r.where).join('; ')
                            : refs.length + ' reference(s)');
}

/* ---- the controls: each check must fail when its subject is broken ---- */
console.log('\n=== negative controls ===\n');

const asIfHost = (list, host) => list.filter(r => hostOf(r.url) === host).length;
const fakeRef = { url: 'https://cdn.example.net/thing-12345678.jpg', where: 'CONTROL' };
/* --- the governing rule's own controls --- */
check('an UNDECLARED host WOULD fail the governing rule',
      !knownHost('cdn.evil.example'), 'rejected');
check('a declared host passes it, whether media or a plain link',
      knownHost('wa.me') && knownHost(Object.keys(declared)[0]), 'both accepted');
check('a declared host missing its kind or its reason WOULD fail',
      [['h', { kind: 'link' }], ['i', { why: 'x' }], ['j', {}]]
        .filter(([, v]) => !v || !v.kind || !v.why).length === 3,
      'all three malformed declarations rejected');
check('on a DUAL-ROLE host, only the declared media path counts as media',
      isMediaUrl('https://www.wonder-herb.com/_files/ugd/x.pdf') &&
      !isMediaUrl('https://www.wonder-herb.com/index.html'),
      'the Wix file store is media; our own pages are not');
check('on a media-only host, every URL counts as media',
      isMediaUrl('https://lh3.googleusercontent.com/d/anything'),
      'no hostPaths entry means the whole host is media');

check('a reference on an undeclared host WOULD fail the host check',
      !declared[hostOf(fakeRef.url)], hostOf(fakeRef.url) + ' is not declared');
check('a plain-http reference WOULD fail the https check',
      /^http:\/\//i.test('http://example.com/a.jpg'), 'detected');
check('a URL with no content hash WOULD fail the addressing check',
      !ADDRESSED.test('https://cdn.example.net/photo.jpg'), 'detected');
check('a cache-busted URL WOULD fail the addressing check',
      !ADDRESSED.test('https://cdn.example.net/photo-1234abcd.jpg?v=1699999'),
      'a query string defeats immutable caching (finding 34)');
check('a properly content-addressed URL passes it',
      ADDRESSED.test('https://cdn.example.net/photo-1234abcd.jpg'), 'accepted');
check('the scanner actually finds media, so a green run is not an empty one',
      refs.length > 20, refs.length + ' reference(s) found');
check('it sees a Drive DOCUMENT link, which carries no extension and no media word',
      looksLikeMedia('https://drive.google.com/file/d/1AbC/view?usp=sharing'),
      'five of these were invisible to the first version of this scanner');
check('it ignores ordinary links, which are not media',
      !looksLikeMedia('https://wa.me/85293318571/') &&
      !looksLikeMedia('https://pubmed.ncbi.nlm.nih.gov/12345678/'), 'wa.me and PubMed ignored');

console.log('\n' + (fail ? '=== ' + fail + ' CHECK(S) FAILED ===' : '=== ALL CHECKS PASSED ==='));
process.exit(fail ? 1 : 0);
