/* test:lang-assets - a migrated page must carry the CHINESE asset, never
 * another language's.
 *
 * WHY THIS SUITE EXISTS (docs/FINDINGS.md finding 28). 小册子 swaps both the
 * brochure scan and the link to it per language, on load. The `src` written
 * into the hand-coded markup is the GERMAN/ENGLISH scan, so pre-rendering that
 * markup verbatim published the German brochure to Chinese visitors. SEO,
 * fidelity and behaviour all passed: none of them looks at what a URL POINTS
 * AT. Only the visual diff caught it, and a diff catches it only if someone
 * reads the picture.
 *
 * So the check is: for every asset the ORIGINAL page swaps by language, if the
 * published page carries any of that asset's language variants, it must be the
 * zh one. That is a rule a machine can hold, and it holds for every page that
 * migrates from here on, without anyone remembering.
 *
 * WHERE THE LANGUAGE VARIANTS COME FROM. The live pages keep them in two
 * shapes, both plain object literals in the page's own script:
 *   translations = { zh: {...}, en: {...}, ... }   keys like brochure_page1_img
 *   productData  = { zh: [...], en: [...], ... }   per-product image / link
 * Both are read out of the retired original, never from our own output.
 *
 * Scope: it reads the COMMITTED page at the repo root - the file GitHub Pages
 * serves - so it tests what ships, not a fresh render.
 */
const fs = require('fs');
const path = require('path');
const { readOriginalPage, isRetired } = require(path.join(__dirname, '..', 'renderer', 'source-page.js'));

const ROOT = path.join(__dirname, '..');

let fail = 0;
const check = (label, cond, extra) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '   -> ' + extra : ''));
  if (!cond) fail++;
};

/* An object literal that starts at `const <name> = {`, read with a brace
   scanner so it works whatever the page's indentation is. */
function literalAfter(src, name) {
  const m = src.match(new RegExp('const\\s+' + name + '\\s*=\\s*\\{'));
  if (!m) return null;
  let i = src.indexOf('{', m.index), depth = 0, inStr = null, prev = '';
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (inStr) {
      if (c === inStr && prev !== '\\') inStr = null;
    } else if (c === '"' || c === "'" || c === '`') inStr = c;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { try { return eval('(' + src.slice(i, j + 1) + ')'); } catch (e) { return null; } } }
    prev = c;
  }
  return null;
}

const LANGS = ['zh', 'en', 'de', 'es', 'fr', 'ja', 'ru'];
const looksLikeAsset = v => typeof v === 'string' &&
  (/^https?:\/\//.test(v) || /\.(html|pdf|jpg|jpeg|png|webp|gif|svg|mp4|glb)(\?|#|$)/i.test(v));

/* Every asset the page swaps by language, as { where, zh, others[] }.
   Only entries where the languages actually DISAGREE are returned - a URL that
   is the same in all seven is not a per-language asset. */
function langAssets(src) {
  const out = [];
  const add = (where, byLang) => {
    const zh = byLang.zh;
    const others = Array.from(new Set(LANGS.filter(l => l !== 'zh')
      .map(l => byLang[l]).filter(v => looksLikeAsset(v) && v !== zh)));
    if (looksLikeAsset(zh) && others.length) out.push({ where, zh, others });
  };

  const T = literalAfter(src, 'translations');
  if (T && T.zh) {
    Object.keys(T.zh).forEach(key => {
      const byLang = {};
      LANGS.forEach(l => { if (T[l]) byLang[l] = T[l][key]; });
      add('translations.' + key, byLang);
    });
  }

  const P = literalAfter(src, 'productData');
  if (P && Array.isArray(P.zh)) {
    P.zh.forEach((item, i) => {
      ['image', 'link', 'model'].forEach(field => {
        const byLang = {};
        LANGS.forEach(l => { if (Array.isArray(P[l]) && P[l][i]) byLang[l] = P[l][i][field]; });
        add('productData[' + i + '].' + field, byLang);
      });
    });
  }
  return out;
}

/* A URL in an attribute is HTML-escaped (`&sz=` becomes `&amp;sz=`), so both
   sides are unescaped before comparing - without this the check reports the zh
   asset as absent when it is right there in the markup. */
const unescape = s => String(s).replace(/&amp;/g, '&').replace(/&#x26;/gi, '&');

/* The published page must not carry a non-zh variant of an asset it shows. */
function wrongLanguageAssets(publishedRaw, assets) {
  const published = unescape(publishedRaw);
  const bad = [];
  assets.forEach(a => {
    const carriesZh = published.indexOf(unescape(a.zh)) !== -1;
    a.others.forEach(otherRaw => {
      const other = unescape(otherRaw);
      if (published.indexOf(other) !== -1) {
        bad.push(a.where + ': carries ' + (carriesZh ? 'BOTH zh and ' : '') + 'a non-zh variant ' + other.slice(-48));
      }
    });
  });
  return bad;
}

function main() {

console.log('\n=== per-language assets: a migrated page carries the zh one (finding 28) ===\n');

const PAGES_DIR = path.join(ROOT, 'data', 'pages');
const trees = fs.existsSync(PAGES_DIR)
  ? fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.json')).sort()
      .map(f => JSON.parse(fs.readFileSync(path.join(PAGES_DIR, f), 'utf8')))
  : [];

check('there are migrated pages to check', trees.length > 0, trees.length + ' tree(s)');

let audited = 0;
let withAssets = 0;
trees.forEach(tree => {
  const page = tree.path;
  if (!isRetired(page)) {
    console.log('        skipped ' + page + ' - not retired yet, the root file is still the original');
    return;
  }
  const assets = langAssets(readOriginalPage(page));
  if (assets.length) withAssets++;
  const published = fs.readFileSync(path.join(ROOT, page), 'utf8');
  audited++;
  if (!assets.length) {
    check(page + ': the original swaps no asset by language', true, 'nothing to carry');
    return;
  }
  const bad = wrongLanguageAssets(published, assets);
  check(page + ': every language-specific asset it publishes is the zh one',
        bad.length === 0,
        bad.length ? bad.join('; ')
                   : assets.length + ' per-language asset(s): ' +
                     assets.map(a => a.where).join(', '));
  assets.forEach(a => {
    if (unescape(published).indexOf(unescape(a.zh)) === -1) {
      console.log('        note: ' + page + ' does not show ' + a.where +
                  ' at all (the zh URL is absent, and so is every other language\'s)');
    }
  });
});

check('every retired page was audited', audited > 0, audited + ' page(s)');
/* Canary: if NO migrated page had a per-language asset, every pass above would
   mean nothing - the extractor could simply be finding nothing anywhere. */
check('the audit finds real per-language assets, rather than passing by finding none',
      withAssets > 0, withAssets + ' of ' + audited + ' page(s) swap an asset by language');

/* ------------------------------------------------------------- controls --- */
console.log('\n=== negative controls: the check catches the bug it exists for ===\n');
{
  const assets = [{ where: 'translations.brochure_page1_img',
                    zh: 'https://drive.google.com/thumbnail?id=ZH_SCAN&sz=w1000',
                    others: ['https://drive.google.com/thumbnail?id=DE_SCAN&sz=w1000'] }];
  const german = '<img src="https://drive.google.com/thumbnail?id=DE_SCAN&sz=w1000">';
  const chinese = '<img src="https://drive.google.com/thumbnail?id=ZH_SCAN&sz=w1000">';
  check('a page publishing the German scan is flagged', wrongLanguageAssets(german, assets).length === 1,
        wrongLanguageAssets(german, assets)[0]);
  check('...and the Chinese one passes', wrongLanguageAssets(chinese, assets).length === 0, 'clean');
  check('carrying BOTH is flagged too (a swap left half-done)',
        wrongLanguageAssets(german + chinese, assets).length === 1, 'flagged');

  /* the extractor must actually find a swapped asset, or the suite would pass
     by finding nothing on every page */
  const fakePage = "const translations = { zh: { a_img: 'https://x/zh.jpg', t: '中' }," +
                   " en: { a_img: 'https://x/en.jpg', t: 'en' }, de: { a_img: 'https://x/zh.jpg' } };";
  const found = langAssets(fakePage);
  check('the extractor finds a per-language asset in a translations map',
        found.length === 1 && found[0].zh === 'https://x/zh.jpg' && found[0].others.length === 1,
        found.map(f => f.where).join(', '));
  check('...and ignores a URL that is the same in every language, and plain copy',
        langAssets("const translations = { zh: { u: 'https://x/same.jpg', t: '中' }," +
                   " en: { u: 'https://x/same.jpg', t: 'en' } };").length === 0, 'ignored');
}

console.log('\n' + (fail ? '=== ' + fail + ' CHECK(S) FAILED ===' : '=== ALL CHECKS PASSED ==='));

}

module.exports = { literalAfter, langAssets, wrongLanguageAssets };

if (require.main === module) { main(); process.exit(fail ? 1 : 0); }
