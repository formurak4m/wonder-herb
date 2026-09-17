/* test:media - where the site's media is allowed to come from, offline.
 *
 * WHY THIS SUITE EXISTS. A media URL is the one kind of content no existing
 * gate looks at. SEO checks that an og:image EXISTS, never where it points;
 * the fidelity maps compare tags and classes; test:behaviour asserts effects.
 * A photo moved to a bucket nobody can read, a model left on a host that dies
 * at cutover, or a fourth-party CDN quietly added to the page would pass every
 * one of them - the same blind spot that let the German brochure through
 * (finding 28) and hid 72 MB of uncacheable models (finding 34).
 *
 * WHAT IT ASSERTS, in two layers:
 *
 *   1. ALWAYS. Every media reference in data/ is an absolute https URL on a
 *      host DECLARED in data/site.json `media.hosts`, each with a stated
 *      reason. A new host cannot appear without someone writing down why.
 *
 *   2. ONCE `media.base` IS SET (Phase 10, when the assets move to R2). Every
 *      media reference must start with that base; must be content-addressed
 *      (`-<8 hex>.<ext>`), which is what makes `immutable` caching safe and
 *      let finding 34's cache-buster be deleted rather than replaced; and no
 *      reference may remain on a host listed as retired.
 *
 * Layer 2 is data-driven on purpose: the move flips it on by editing
 * data/site.json, not this file. Until then layer 1 is doing real work - it
 * fails today if a reference points anywhere unexpected.
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
const MEDIA_HINT = /(googleusercontent|wixstatic|drive\.google\.com\/(thumbnail|uc)|\/media\/|\/img\/|\/video\/)/i;
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

console.log('\n=== where the media is declared to live ===\n');
check('data/site.json declares its media hosts', Object.keys(declared).length > 0,
      Object.keys(declared).join(', ') || 'NONE DECLARED');
Object.entries(declared).forEach(([h, why]) => console.log('        ' + h.padEnd(30) + why));
console.log('        base: ' + (base || '(not set - the assets have not moved yet)'));

const refs = references();
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
check('it ignores ordinary links, which are not media',
      !looksLikeMedia('https://wa.me/85293318571/') &&
      !looksLikeMedia('https://pubmed.ncbi.nlm.nih.gov/12345678/'), 'wa.me and PubMed ignored');

console.log('\n' + (fail ? '=== ' + fail + ' CHECK(S) FAILED ===' : '=== ALL CHECKS PASSED ==='));
process.exit(fail ? 1 : 0);
