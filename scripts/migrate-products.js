/* One-time migration: recover the product catalogue's seven languages.
 *
 *   node --env-file-if-exists=.env scripts/migrate-products.js [--write]
 *
 * WHY THIS EXISTS. 產品介紹.html:1733 carries a `productData` object holding the
 * whole catalogue in ALL SEVEN LANGUAGES - real translations, paid for, live
 * today. `data/products.json` has none of them: its `title` and `desc` are
 * plain strings. Pre-rendering replaces the page's client-side language switch,
 * so migrating the grid from products.json as it stands would silently delete
 * six languages of the client's copy. This recovers them first.
 *
 * It also closes docs/FINDINGS.md finding 8: `image` and `link` exist in the
 * page array and are simply absent from products.json.
 *
 * ===========================================================================
 * MATCH BY SKU. NEVER BY id.
 *
 * The two catalogues both use `id`, and FIVE OF SIX ids cross-map to a
 * DIFFERENT product. Matching by id pairs the standard pack with the trial
 * pack's translations, gives 乙肝清 the PT3 clinic-only ribbon and a HK$0
 * price, and links the PT3 card to the 憶活素 page - and every card still
 * renders, which is what makes it dangerous.
 *
 * The table below is hand-checked, confirmed at P9-T1 against a third source:
 * each page product's `link` points at a detail page that carries the same SKU
 * in its own markup. All six agree. Do NOT derive this table.
 * ===========================================================================
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE_PAGE = '產品介紹.html';

/* SKU -> the `id` in 產品介紹.html's productData array.
   Hand-checked at P9-T1 and confirmed against each detail page's own SKU.
   NEVER match by `id` - five of six ids cross-map to a different product. */
const MATCH = {
  'WH-PSP-500': 2,   // 標準裝 500粒  -> 產品_雲芝糖肽精華_B.html
  'WH-PSP-060': 1,   // 試用裝 60粒   -> 產品_雲芝糖肽精華_A.html
  'WH-T3-120':  3,   // T3            -> 產品_T3.html
  'WH-PT3-090': 6,   // PT3           -> 產品_PT3.html
  'WH-HB-180':  4,   // 乙肝清         -> 產品_乙肝清.html
  'WH-MB-060':  5    // 憶活素         -> 產品_憶活素.html
};

/* Fields the two sources disagree on, which the CLIENT must settle. They are
   NOT migrated: the value in products.json stays exactly as it is, and the
   disagreement is recorded in docs/FINDINGS.md finding 9 rather than written
   into data/ - data/ is published to a public URL and a "clientUnconfirmed"
   flag is project bookkeeping, not site content (the same reasoning that
   removed `updatedAt` at P7-T1a, finding 17). */
const DISPUTED = {
  'WH-MB-060':  ['price'],            // json 880.00   vs page 520
  'WH-PT3-090': ['price']             // json 2480.00  vs page 0 / "僅限診所"
};

/* WHERE THE LINE IS (decided at P9-T1 review, and worth stating because it is
   not obvious):
 *
 *   DISPLAY COPY follows the LIVE PAGE.   MONEY follows NOBODY until the client
 *                                          confirms it.
 *
 * `title.zh` and `desc.zh` also differ between the two sources - all twelve of
 * them - but they are NOT in DISPUTED, because a migration must not change what
 * customers see. products.json's zh copy is not what 產品介紹 displays today; it
 * surfaces only as a fallback on product.html. Keeping it would mean this
 * technical migration silently rewrote six product names and six descriptions on
 * the client's main product page. So the live page's words are carried over, and
 * the products.json versions go on the client reconciliation list as the
 * alternative.
 *
 * Prices are different in kind: a wrong number has commercial consequences, and
 * neither source can be assumed right. Those stay untouched and BLOCK PUBLISH.
 */

const LANGS = ['zh', 'en', 'de', 'es', 'fr', 'ja', 'ru'];

function die(msg) {
  console.error('\nMIGRATION REFUSED: ' + msg + '\n');
  process.exit(1);
}

/* ------------------------------------------------------------------ read -- */

function readPageCatalogue() {
  const html = fs.readFileSync(path.join(ROOT, SOURCE_PAGE), 'utf8');
  const m = html.match(/const productData = (\{[\s\S]*?\n    \});/);
  if (!m) die('could not find the productData array in ' + SOURCE_PAGE);
  let data;
  try { data = eval('(' + m[1] + ')'); }
  catch (err) { die('productData did not parse: ' + err.message); }
  return data;
}

const API_BASE = process.env.API_BASE || 'http://localhost:4000';

async function loadProductsFromApi() {
  let res;
  try { res = await fetch(API_BASE + '/api/cms?type=products'); }
  catch (err) { die('the API is not reachable at ' + API_BASE + ' - start it with `npm run dev`'); }
  if (!res.ok) die('GET /api/cms?type=products -> ' + res.status);
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) die('the API returned no products');
  return rows;
}

/* ------------------------------------------------------------- validate --- */

function validate(products, page) {
  const problems = [];

  products.forEach(p => {
    if (!(p.sku in MATCH)) {
      problems.push('products.json has SKU ' + p.sku + ' (' + p.title + ') with no entry in MATCH');
    }
  });

  const claimed = {};
  Object.keys(MATCH).forEach(sku => {
    const id = MATCH[sku];
    if (claimed[id]) problems.push('page id ' + id + ' is claimed by both ' + claimed[id] + ' and ' + sku);
    claimed[id] = sku;
  });

  Object.keys(MATCH).forEach(sku => {
    LANGS.forEach(lang => {
      if (!Array.isArray(page[lang])) {
        problems.push('the page array has no ' + lang + ' catalogue');
        return;
      }
      if (!page[lang].some(x => x.id === MATCH[sku])) {
        problems.push(sku + ' -> page id ' + MATCH[sku] + ' does not exist in the ' + lang + ' catalogue');
      }
    });
  });

  const known = products.map(p => p.sku);
  Object.keys(MATCH).forEach(sku => {
    if (known.indexOf(sku) === -1) problems.push('MATCH names SKU ' + sku + ', which products.json does not have');
  });

  if (problems.length) {
    die(problems.length + ' problem(s):\n  - ' + problems.join('\n  - ') +
        '\n\nNothing was written. An unmatched product stops the migration rather than being skipped.');
  }
}

/* --------------------------------------------------------------- migrate -- */

const isDisputed = (sku, field) =>
  (DISPUTED[sku] || []).indexOf(field) !== -1 || (DISPUTED['*'] || []).indexOf(field) !== -1;

/* Collect one field across all seven languages. */
function perLang(page, id, key) {
  const out = {};
  LANGS.forEach(lang => {
    const row = page[lang].find(x => x.id === id);
    const v = row ? row[key] : undefined;
    if (v !== undefined && v !== null && v !== '') out[lang] = v;
  });
  return out;
}

function migrate(products, page) {
  const report = [];

  const migrated = products.map(p => {
    const id = MATCH[p.sku];
    const zhRow = page.zh.find(x => x.id === id);
    const out = Object.assign({}, p);
    const changes = [];

    /* title: seven languages, from the live page. products.json's zh name
       carries pack sizes ("T3 複合配方 (120粒)") where the page does not
       ("T3 配方"); all six differ, and the difference is reported. */
    const titles = perLang(page, id, 'name');
    if (titles.zh && titles.zh !== p.title) {
      report.push({ sku: p.sku, field: 'title.zh', json: p.title, page: titles.zh });
    }
    out.title = titles;                               // the live page's words
    changes.push('title 7 langs');

    /* desc: seven languages. FOUND AT P9-T1: all six zh descriptions differ
       between the two sources - not a translation difference, two different
       pieces of copy. And BOTH are customer-facing: 產品介紹.html shows the
       page's version, while product.html:1945 falls back to products.json's
       version for any product its own array does not carry.
       The LIVE PAGE's words are carried over - see the note on DISPUTED above -
       and the products.json version is reported for the client to settle. */
    const descs = perLang(page, id, 'desc');
    if (descs.zh && descs.zh !== p.desc) {
      report.push({ sku: p.sku, field: 'desc.zh', json: p.desc, page: descs.zh });
    }
    out.desc = descs;                                 // the live page's words
    changes.push('desc 7 langs');

    /* finding 8: image and link, recovered */
    if (zhRow.image) { out.image = zhRow.image; changes.push('image'); }
    if (zhRow.link)  { out.link  = zhRow.link;  changes.push('link'); }

    /* the corner ribbon, per language (PT3's "只在指定中西醫診所出售") */
    const ribbon = perLang(page, id, 'badge');
    if (Object.keys(ribbon).length) { out.ribbon = ribbon; changes.push('ribbon 7 langs'); }

    /* priceNote: the page's priceText ONLY when it is words rather than a
       formatted number. HK$3,800.00 is formatting and belongs in the renderer;
       "僅限診所" is content. */
    const notes = {};
    LANGS.forEach(lang => {
      const row = page[lang].find(x => x.id === id);
      if (row && row.priceText && !/^HK\$[\d.,]+$/.test(row.priceText)) notes[lang] = row.priceText;
    });
    if (Object.keys(notes).length) { out.priceNote = notes; changes.push('priceNote 7 langs'); }

    /* price: NEVER touched where disputed */
    if (isDisputed(p.sku, 'price')) {
      changes.push('price LEFT AT products.json (' + p.price + ') - client-unconfirmed, page says ' + zhRow.price);
      report.push({ sku: p.sku, field: 'price', json: p.price, page: String(zhRow.price) });
    }

    console.log('  ' + p.sku.padEnd(12) + changes.join(', '));
    return out;
  });

  return { migrated, report };
}

/* ------------------------------------------------------------------ main -- */

(async () => {
  const write = process.argv.indexOf('--write') !== -1;
  console.log('\nRecovering the product catalogue from ' + SOURCE_PAGE + (write ? '  [--write]' : '  [dry run]') + '\n');

  const page = readPageCatalogue();

  /* Read the products from the API, NOT from data/products.json.
   *
   * They are not the same thing, and the difference caused real data loss on
   * the first run of this script: `data/products.json` is the SITE-FACING
   * projection, which scripts/export.js strips of `stock`, `reorder` and
   * `stockUpdated` (forSite / productForSite). Migrating that file and POSTing
   * it back replaced the database rows with the stripped version - deleting the
   * reorder point on all six products and the stock count on WH-PSP-500.
   *
   * The database is the source of truth. Round-tripping a projection back into
   * its own source is how you lose whatever the projection left out. */
  const products = await loadProductsFromApi();

  validate(products, page);
  console.log('  MATCH validated: ' + Object.keys(MATCH).length + ' SKUs, all present in both sources, no id claimed twice\n');

  const { migrated, report } = migrate(products, page);

  console.log('\n=== client reconciliation list — NOT migrated, NOT decided ===\n');
  report.forEach(r => {
    console.log('  ' + r.sku + '  ' + r.field);
    console.log('      products.json : ' + r.json);
    console.log('      live page     : ' + r.page);
  });

  if (!write) {
    const out = path.join(ROOT, 'renderer', '.build', 'products.migrated.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(migrated, null, 2) + '\n', 'utf8');
    console.log('\nDry run. Preview written to renderer/.build/products.migrated.json');
    console.log('Re-run with --write to push it through the API.');
    return;
  }

  /* Through the existing API, then `npm run export` writes data/ — the normal
     publish path. Never a direct write to data/products.json. */
  const BASE = API_BASE;
  const email = process.env.SUPER_ADMIN_EMAIL, password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) die('SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD are not set (.env)');

  const li = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const auth = await li.json();
  if (!li.ok) die('login failed: ' + (auth.error || li.status));

  const res = await fetch(BASE + '/api/cms?type=products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth.token },
    body: JSON.stringify(migrated)
  });
  const body = await res.json();
  if (!res.ok) die('POST /api/cms?type=products failed: ' + (body.error || res.status));

  console.log('\n  POST /api/cms?type=products -> ' + res.status + '  ' + JSON.stringify(body));
  console.log('\nWritten to MongoDB. Run `npm run export` to write data/, then review the diff.');
})().catch(err => { console.error(err); process.exit(1); });
