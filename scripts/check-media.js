/* check:media - the ONLINE half of the media contract. Not part of test:all.
 *
 * WHY IT IS SEPARATE FROM test:media. `npm run test:media` is offline: it reads
 * data/ and asserts that every media URL is on a declared host, is https, and
 * (once media.base is set) is under that base and content-addressed. It can
 * prove the URLs are the RIGHT SHAPE. It cannot prove they RESOLVE, that the
 * bucket serves the right content type, that a browser is allowed to fetch a
 * model, or that the bytes at the far end are the bytes we uploaded.
 *
 * This suite talks to the real host. It is the HARD GATE the owner set for
 * Phase 10: nothing is `git rm --cached` out of the repo until every uploaded
 * URL answers 200, with the right content type, with CORS, with immutable
 * caching, and - because the filenames are content-addressed - with bytes whose
 * hash matches the name they are served under.
 *
 * THE CONTRACT, per asset:
 *   1. 200, with NO redirect. A redirect means the key is wrong; accepting a
 *      200 that arrived after one would let a typo through.
 *   2. Content-Type matches the extension. R2 stores
 *      application/octet-stream when the uploader does not set a type, which
 *      breaks <video> and is invisible to every other gate we have.
 *   3. Cache-Control carries `immutable` and max-age >= a year. That is the
 *      whole point of content-addressing, and it is the fix for finding 34
 *      (72 MB of models re-downloaded on every visit behind a Date.now()
 *      cache-buster).
 *   4. CORS. REQUIRED for .glb, which the hero loader pulls with fetch(): with
 *      no Access-Control-Allow-Origin every 3D model fails silently and the
 *      page still shows its poster, so nothing LOOKS broken. Reported but not
 *      required for <img>/<video> assets, which need none.
 *   5. The served bytes hash to the 8 hex digits in the filename. The name is a
 *      claim about the content; this is the only check that tests the claim.
 *   6. (with data/media-manifest.json) the byte length matches what we uploaded,
 *      and nothing was uploaded that the site does not reference.
 *
 * AND ONE CHECK ON THE BUCKET ITSELF, run first: a key that cannot exist must
 * NOT answer 200. If the host served something friendly for every path, every
 * check above would pass while pointing at nothing - the vacuous-green failure
 * mode that finding 23 and the three.js stub were both about.
 *
 *   node scripts/check-media.js                 the gate: every reference in data/
 *   node scripts/check-media.js --head-only     skip the body download (no hash check)
 *   node scripts/check-media.js --against-current
 *       Run the SAME contract over the media the site references TODAY, on
 *       Drive and Wix, before anything moves. It is expected to FAIL, and the
 *       shape of the failure is the point: it is this suite proving, against
 *       real HTTP responses rather than synthetic ones, that its checks bite.
 *       Exit code is 0 in this mode: it is a demonstration, not a gate.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const ARGS = process.argv.slice(2);
const HEAD_ONLY = ARGS.includes('--head-only');
const AGAINST_CURRENT = ARGS.includes('--against-current');

let fail = 0;
const check = (label, cond, extra) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '   -> ' + extra : ''));
  if (!cond) fail++;
  return cond;
};

/* ------------------------------------------------------------------ the data */

const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
const site = (() => { try { return readJson(path.join(ROOT, 'data/site.json')); } catch (e) { return {}; } })();
const media = site.media || {};
const BASE = media.base || '';
const ORIGINS = (media.corsOrigins && media.corsOrigins.length)
  ? media.corsOrigins : ['https://www.wonder-herb.com'];
const MIN_AGE = media.cacheMinSeconds || 31536000;

const manifest = (() => {
  try { return readJson(path.join(ROOT, 'data/media-manifest.json')); } catch (e) { return null; }
})();

/* The reference scanner is test:media's, deliberately: the two suites must
   disagree about nothing, and a URL this one never sees is a URL the gate does
   not cover. */
const MEDIA_EXT = /\.(jpe?g|png|webp|avif|gif|svg|mp4|webm|glb|gltf|pdf)(\?|#|$)/i;
const MEDIA_HINT = /(googleusercontent|wixstatic|drive\.google\.com\/(thumbnail|uc|file\/d\/)|\/media\/|\/img\/|\/video\/)/i;
const looksLikeMedia = v => typeof v === 'string' && /^https?:\/\//.test(v) &&
  (MEDIA_EXT.test(v) || MEDIA_HINT.test(v));

function references() {
  const out = [];
  const walk = (o, where, at) => {
    if (typeof o === 'string') { if (looksLikeMedia(o)) out.push({ url: o, where: where + at }); return; }
    if (Array.isArray(o)) return o.forEach((v, i) => walk(v, where, at + '[' + i + ']'));
    if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => walk(v, where, at + '.' + k));
  };
  fs.readdirSync(path.join(ROOT, 'data/pages')).filter(f => f.endsWith('.json')).forEach(f =>
    walk(readJson(path.join(ROOT, 'data/pages', f)), 'data/pages/' + f, ''));
  ['products.json', 'cases.json', 'faq.json', 'homepage.json', 'site.json'].forEach(f => {
    const p = path.join(ROOT, 'data', f);
    if (fs.existsSync(p)) walk(readJson(p), 'data/' + f, '');
  });
  const seen = new Set();
  return out.filter(r => (seen.has(r.url) ? false : seen.add(r.url)));
}

/* ------------------------------------------- the contract, as pure functions
   Every live check below is one of these applied to a real response, and every
   negative control is the same function applied to a synthetic one. That is
   what stops the controls from testing a second, kinder copy of the rules. */

const TYPES = {
  jpg: ['image/jpeg'], jpeg: ['image/jpeg'], png: ['image/png'], webp: ['image/webp'],
  avif: ['image/avif'], gif: ['image/gif'], svg: ['image/svg+xml'],
  mp4: ['video/mp4'], webm: ['video/webm'],
  glb: ['model/gltf-binary'], gltf: ['model/gltf+json'], pdf: ['application/pdf']
};
const NEEDS_CORS = /\.(glb|gltf)$/i;          /* fetched by script, not by the parser */

const extOf = url => (url.split('?')[0].split('#')[0].match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
const statusOk = r => r.status === 200;
const notRedirected = r => !(r.status >= 300 && r.status < 400) && !r.redirected;
const contentTypeOk = (url, ct) => {
  const want = TYPES[extOf(url)];
  if (!want) return false;
  return want.includes(String(ct || '').split(';')[0].trim().toLowerCase());
};
const cacheOk = cc => {
  const v = String(cc || '').toLowerCase();
  if (!/\bimmutable\b/.test(v)) return false;
  const m = v.match(/max-age\s*=\s*(\d+)/);
  return Boolean(m) && Number(m[1]) >= MIN_AGE;
};
const corsOk = (allow, origin) => {
  const v = String(allow == null ? '' : allow).trim();
  return v === '*' || (v !== '' && v.toLowerCase() === origin.toLowerCase());
};
/* The URL must END at its extension. Do NOT strip the query first: a URL like
   photo-1234abcd.jpg?v=1699 is content-addressed AND uncacheable, which is
   precisely the shape finding 34 was, and stripping the query lets it through.
   It did, in the first draft of this file - the control below caught it. */
const ADDRESSED = /-([0-9a-f]{8})\.[a-z0-9]+$/i;
const addressedOk = url => ADDRESSED.test(url);
const hashOk = (url, body) => {
  const m = url.match(ADDRESSED);
  if (!m || !body || !body.length) return false;
  return crypto.createHash('sha256').update(body).digest('hex').slice(0, 8) === m[1].toLowerCase();
};
const underBase = url => Boolean(BASE) && url.indexOf(BASE) === 0;

/* ------------------------------------------------------------------ fetching */

async function probe(url, origin, wantBody) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: wantBody ? 'GET' : 'HEAD',
      redirect: 'manual',
      headers: { Origin: origin, 'User-Agent': 'wonder-herb check:media' }
    });
    const body = wantBody && res.status === 200 ? Buffer.from(await res.arrayBuffer()) : null;
    return {
      status: res.status, redirected: res.redirected, ms: Date.now() - t0, body,
      type: res.headers.get('content-type'),
      cache: res.headers.get('cache-control'),
      allow: res.headers.get('access-control-allow-origin'),
      length: res.headers.get('content-length'),
      location: res.headers.get('location')
    };
  } catch (e) {
    return { status: 0, error: e.message, ms: Date.now() - t0 };
  }
}

async function pooled(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

/* ---------------------------------------------------------------- the controls
   Each applies a contract function above to a value that must be rejected AND
   to one that must be accepted. A control that only ever asserts rejection
   passes just as happily when the function returns false for everything. */
function controls() {
  console.log('\n=== negative controls (the same functions the live checks used) ===\n');
  const origin = ORIGINS[0];

  check('a 404 WOULD fail the status check', !statusOk({ status: 404 }), 'rejected');
  check('a 200 passes it', statusOk({ status: 200 }), 'accepted');

  check('a redirect WOULD fail, so a wrong key cannot pass via a 301',
        !notRedirected({ status: 301 }) && !notRedirected({ status: 200, redirected: true }), 'both rejected');

  check('a model served as application/octet-stream WOULD fail the type check',
        !contentTypeOk('https://x/model-12345678.glb', 'application/octet-stream'),
        "R2's default when the uploader sets no type");
  check('a model served as model/gltf-binary passes it',
        contentTypeOk('https://x/model-12345678.glb', 'model/gltf-binary; charset=utf-8'), 'accepted');
  check('an image served as text/html WOULD fail it',
        !contentTypeOk('https://x/photo-12345678.jpg', 'text/html'),
        'a viewer page or an error page cannot masquerade as the asset');

  check('a one-hour cache WOULD fail the caching check',
        !cacheOk('public, max-age=3600'), 'rejected');
  check('a year without `immutable` WOULD fail it',
        !cacheOk('public, max-age=31536000'),
        'immutable is what removes the revalidation round-trip');
  check('`public, max-age=31536000, immutable` passes it',
        cacheOk('public, max-age=31536000, immutable'), 'accepted');

  check('a missing Access-Control-Allow-Origin WOULD fail the CORS check',
        !corsOk(null, origin) && !corsOk('', origin), 'rejected');
  check("another site's origin WOULD fail it",
        !corsOk('https://example.net', origin), 'rejected');
  check('`*` and our own origin pass it',
        corsOk('*', origin) && corsOk(origin, origin), 'accepted');

  check('a URL with no content hash WOULD fail the addressing check',
        !addressedOk('https://x/photo.jpg'), 'rejected');
  check('a cache-busted URL WOULD fail it',
        !addressedOk('https://x/photo-1234abcd.jpg?v=' + Date.now()),
        'exactly the shape finding 34 was');

  const body = Buffer.from('the bytes we uploaded');
  const sha8 = crypto.createHash('sha256').update(body).digest('hex').slice(0, 8);
  check('bytes that do not hash to the filename WOULD fail the identity check',
        !hashOk('https://x/thing-00000000.jpg', body), 'rejected');
  check('the right bytes under the right name pass it',
        hashOk('https://x/thing-' + sha8 + '.jpg', body), sha8);
  check('an empty body WOULD fail it, so a 200 with no content cannot pass',
        !hashOk('https://x/thing-' + sha8 + '.jpg', Buffer.alloc(0)), 'rejected');

  check('the scanner sees a Drive DOCUMENT link, which has no extension and no media word',
        looksLikeMedia('https://drive.google.com/file/d/1AbC/view?usp=sharing'),
        'five of these were invisible to the first version of this scanner');
  check('it still ignores ordinary outbound links, which are not media',
        !looksLikeMedia('https://wa.me/85293318571/') &&
        !looksLikeMedia('https://pubmed.ncbi.nlm.nih.gov/12345678/'), 'wa.me and PubMed ignored');
  check('the scanner finds media, so a green run is not an empty one',
        references().length > 20, references().length + ' reference(s)');
}

/* ------------------------------------------------------------------- the run */

(async () => {
  const refs = references();
  const origin = ORIGINS[0];

  console.log('\n=== what is being checked ===\n');
  console.log('        mode           ' + (AGAINST_CURRENT
    ? '--against-current (demonstration, expected to FAIL)' : 'GATE'));
  console.log('        media.base     ' + (BASE || '(not set)'));
  console.log('        CORS origin    ' + origin);
  console.log('        min max-age    ' + MIN_AGE + 's');
  console.log('        manifest       ' + (manifest ? manifest.length + ' asset(s)'
    : 'none (data/media-manifest.json absent)'));
  console.log('        body download  ' + (HEAD_ONLY ? 'NO (--head-only: the hash check is skipped)' : 'yes'));
  console.log('        references     ' + refs.length);

  if (!AGAINST_CURRENT && !BASE) {
    console.log('\n  data/site.json sets no media.base, so nothing has been re-hosted yet and there');
    console.log('  is no bucket to check. This suite is the gate for that move.\n');
    console.log('  Until then, prove the contract bites by running it against what the site uses');
    console.log('  TODAY, which does not meet it:\n');
    console.log('      node scripts/check-media.js --against-current\n');
    console.log('  The offline controls below still run, because a gate nobody can exercise');
    console.log('  before the moment it matters is a gate nobody trusts.');
    controls();
    console.log('\n' + (fail ? '=== ' + fail + ' CONTROL(S) FAILED ==='
                             : '=== controls pass; the live layer is waiting for media.base ==='));
    process.exit(fail ? 1 : 0);
  }

  /* ---- the vacuity control, FIRST: if the host answers 200 for a key that
     cannot exist, every check that follows is meaningless. ---- */
  console.log('\n=== does this host distinguish a real key from a missing one? ===\n');
  const missingBase = BASE || (new URL(refs[0].url).origin + '/');
  const missing = missingBase + 'control/definitely-not-a-real-asset-00000000.jpg';
  const gone = await probe(missing, origin, false);
  check('a key that does not exist is NOT served 200', gone.status !== 200,
        missing.replace(/^https?:\/\//, '') + ' -> ' + (gone.error || gone.status));

  /* ---- every reference ---- */
  console.log('\n=== every media reference (' + refs.length + ') ===\n');
  const byKey = manifest ? new Map(manifest.map(a => [a.key, a])) : null;

  const results = await pooled(refs, 6, async ref => {
    const r = await probe(ref.url, origin, !HEAD_ONLY);
    const ext = extOf(ref.url);
    const needsCors = NEEDS_CORS.test(ref.url.split('?')[0]);
    const problems = [];
    if (!statusOk(r)) {
      problems.push('status ' + (r.error || r.status) + (r.location ? ' -> ' + r.location : ''));
    } else {
      if (!notRedirected(r)) problems.push('redirected');
      if (!contentTypeOk(ref.url, r.type)) problems.push('content-type ' + (r.type || 'absent') +
        (TYPES[ext] ? ', expected ' + TYPES[ext].join('/') : ', unknown extension .' + (ext || '(none)')));
      if (!cacheOk(r.cache)) problems.push('cache-control ' + (r.cache || 'absent'));
      if (!corsOk(r.allow, origin)) problems.push((needsCors ? 'CORS ' : 'cors(advisory) ') +
        (r.allow == null ? 'absent' : r.allow));
      if (!addressedOk(ref.url)) problems.push('not content-addressed');
      else if (!HEAD_ONLY && !hashOk(ref.url, r.body)) problems.push('bytes do not hash to the name');
      if (byKey && BASE) {
        const entry = byKey.get(ref.url.slice(BASE.length));
        if (!entry) problems.push('not in the manifest');
        else if (r.body && r.body.length !== entry.bytes) {
          problems.push('length ' + r.body.length + ', manifest says ' + entry.bytes);
        }
      }
    }
    /* CORS is advisory for assets the parser loads, required for fetch()ed models */
    const hard = problems.filter(p => !/^cors\(advisory\)/.test(p));
    return { ref, r, problems, hard, needsCors };
  });

  results.forEach(({ ref, r, problems, hard }) => {
    const name = ref.url.replace(/^https?:\/\//, '').slice(0, 72);
    console.log((hard.length === 0 ? '  PASS  ' : '  FAIL  ') + name.padEnd(74) +
                String(r.status || r.error).padStart(4) + '  ' + String(r.ms).padStart(6) + 'ms' +
                (problems.length ? '\n              ' + problems.join('; ') : ''));
  });

  const bad = results.filter(x => x.hard.length);
  console.log('');
  check('every reference meets the contract', bad.length === 0,
        bad.length ? bad.length + ' of ' + results.length + ' failed' : results.length + ' asset(s)');
  const models = results.filter(x => x.needsCors);
  check('every .glb is fetchable cross-origin (the hero loader uses fetch)',
        models.length > 0 && models.every(x => corsOk(x.r.allow, origin)),
        models.length ? models.length + ' model(s), origin ' + origin
                      : 'NO MODELS FOUND - this check would be vacuous');
  check('every reference is under media.base', !BASE || refs.every(r => underBase(r.url)),
        BASE || 'base not set');
  if (manifest && BASE) {
    const referenced = new Set(refs.map(r => r.url.slice(BASE.length)));
    const orphans = manifest.filter(a => !referenced.has(a.key));
    check('nothing was uploaded that the site does not reference', orphans.length === 0,
          orphans.length ? orphans.slice(0, 4).map(a => a.key).join('; ')
                         : manifest.length + ' asset(s), all referenced');
  }

  controls();

  if (AGAINST_CURRENT) {
    console.log('\n  --against-current: exit 0. The failures above are the demonstration -');
    console.log("  today's media measured against the Phase 10 contract it does not yet meet.");
    process.exit(0);
  }
  console.log('\n' + (fail ? '=== ' + fail + ' CHECK(S) FAILED - NOTHING MAY LEAVE THE REPO ==='
                           : '=== ALL CHECKS PASSED - the gate is clear ==='));
  process.exit(fail ? 1 : 0);
})();
