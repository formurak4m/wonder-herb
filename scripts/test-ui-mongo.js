/* The admin and the site talking to a real MongoDB-backed API in a real DOM.
 * Uses a throwaway database, so your working data is untouched.
 */
process.env.MONGO_DB = process.env.MONGO_DB_TEST || 'wonderherb_test';
const PORT = 4112;
const API = 'http://localhost:' + PORT;

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM, VirtualConsole } = require(path.join(
  require('os').tmpdir(), 'claude',
  'c--Users-DELL-G15-OneDrive-Desktop-wonderhub-wonder-herb',
  'f8b7d956-d3e9-4d6f-b21a-60850f00a2f1', 'scratchpad', 'node_modules', 'jsdom'
));

const app = require('../server/index');
const { connect, close, COLLECTIONS, AUTH_COLLECTIONS } = require('../server/db');

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fail = 0;
const check = (label, cond, extra) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '   -> ' + extra : ''));
  if (!cond) fail++;
};
const settle = ms => new Promise(r => setTimeout(r, ms));

/* Real fetch for the API, disk for the page's own relative files. */
function makeFetch(apiUp) {
  return (url, opts) => {
    const u = String(url);
    if (/^https?:/.test(u)) {
      if (!apiUp()) return Promise.reject(new Error('connection refused'));
      return fetch(u, opts);
    }
    const name = u.split('/').pop();
    try {
      const body = fs.readFileSync(path.join(ROOT, 'data', name), 'utf8');
      return Promise.resolve({
        ok: true, status: 200,
        text: () => Promise.resolve(body),
        json: () => Promise.resolve(JSON.parse(body))
      });
    } catch (e) {
      return Promise.resolve({ ok: false, status: 404 });
    }
  };
}

function loadPage(file, url, apiUp, apiBase) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/navigation/.test(e.message)) console.log('  [page] ' + e.message.split('\n')[0]); });
  return new Promise(resolve => {
    const dom = new JSDOM(read(file), {
      url, runScripts: 'dangerously', virtualConsole: vc,
      beforeParse(w) {
        w.alert = m => { w.__lastAlert = m; };
        w.confirm = () => true;
        w.URL.createObjectURL = () => 'blob:stub';
        if (apiBase) w.WH_API_BASE = apiBase;
        w.fetch = makeFetch(apiUp);
      }
    });
    dom.window.addEventListener('load', () => setTimeout(() => resolve(dom), 40));
  });
}

(async () => {
  const db = await connect();
  for (const c of Object.values(COLLECTIONS)) await db.collection(c).deleteMany({});
  await db.collection('homepage').deleteMany({});

  await db.collection(COLLECTIONS.products).insertMany([
    { pos: 0, id: 1, sku: 'WH-DB-1', title: 'Database Product One', price: '500.00',
      status: 'In Stock', stock: 25, reorder: 10, desc: 'from mongo', cat: 'special' },
    { pos: 1, id: 2, sku: 'WH-DB-2', title: 'Database Product Two', price: '900.00',
      status: 'In Stock', stock: 3, reorder: 10, desc: 'nearly gone', cat: 'special' }
  ]);
  await db.collection(COLLECTIONS.cases).insertOne({ pos: 0, zh: { title: '資料庫病例' }, en: { title: 'DB case' } });
  await db.collection(COLLECTIONS.faq).insertOne({ pos: 0, id: 1, cat: 'General', q: 'From Mongo?', a: 'Yes.' });

  await db.collection(AUTH_COLLECTIONS.users).deleteMany({});
  await db.collection(AUTH_COLLECTIONS.sessions).deleteMany({});

  const server = app.listen(PORT);
  await new Promise(r => server.once('listening', r));

  /* Saving needs a signed-in account with editing rights, so the suite creates
     an administrator and drives the console as that person. */
  const adminToken = await fetch(API + '/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'UI Admin', email: 'ui-admin@example.com',
                           password: 'ui-suite-password', asAdmin: true })
  }).then(r => r.json()).then(d => d.token);
  let up = true;
  const apiUp = () => up;

  // ------------------------------------------------------------ admin, API up
  console.log('\n=== /admin with MongoDB running ===\n');
  const dom = await loadPage('admin/index.html', 'http://localhost:8000/admin/index.html', apiUp, API);
  const w = dom.window, d = w.document;
  w.localStorage.setItem('wh_admin_token', adminToken);
  await w.eval('restoreSession()');
  await settle(400);

  check('the connection chip says MongoDB is connected',
    /MongoDB connected/.test(d.getElementById('dbChipText').textContent),
    d.getElementById('dbChipText').textContent);
  check('the chip is styled as live', d.getElementById('dbChip').classList.contains('live'));

  const P = () => w.eval('productsData');
  check('products come from MongoDB, not the JSON file',
    P().length === 2 && P()[0].sku === 'WH-DB-1', P().map(p => p.sku).join(','));
  check('stock comes with them', P()[0].stock === 25);
  check('cases come from MongoDB', w.eval('casesData')[0].zh.title === '資料庫病例');
  check('faq comes from MongoDB', w.eval('faqData')[0].q === 'From Mongo?');

  w.switchNav('inventory');
  const rowText = sku => Array.from(d.querySelectorAll('#invBody tr'))
    .find(r => r.textContent.includes(sku)).textContent;
  check('the inventory table shows the database figures', rowText('WH-DB-1').includes('25'));
  check('3 on hand against a reorder level of 10 reads Low stock',
    rowText('WH-DB-2').includes('Low stock'));

  // ------------------------------------------------------------ writes reach mongo
  console.log('\n=== A stock change is written to MongoDB ===\n');
  const idx = P().findIndex(p => p.sku === 'WH-DB-1');
  w.openInvAdjust(idx);
  d.getElementById('inv_type').value = 'sale';
  d.getElementById('inv_qty').value = '25';
  d.getElementById('inv_note').value = 'Sold at the clinic';
  await w.applyInvAdjust();
  await settle(200);

  const inDb = await db.collection(COLLECTIONS.products).findOne({ sku: 'WH-DB-1' });
  check('the new count is in MongoDB', inDb.stock === 0, String(inDb.stock));
  check('MongoDB marked it Out of Stock', inDb.status === 'Out of Stock', inDb.status);
  check('the screen agrees with the database', P()[idx].stock === 0);
  const move = await db.collection(COLLECTIONS.movements).findOne({ sku: 'WH-DB-1' });
  check('the movement is stored server-side with its note',
    move && move.note === 'Sold at the clinic' && move.delta === -25);
  check('the toast says it went to MongoDB',
    /MongoDB/.test(d.getElementById('toast').textContent), d.getElementById('toast').textContent);

  console.log('\n=== Editing a product writes through ===\n');
  w.switchNav('products');
  w.openProdEditor(1);
  d.getElementById('f_prod_price').value = '999.00';
  w.saveProd();
  await settle(300);
  const edited = await db.collection(COLLECTIONS.products).findOne({ sku: 'WH-DB-2' });
  check('the edited price is in MongoDB', edited.price === '999.00', edited.price);
  check('its stock was not lost by the edit', edited.stock === 3, String(edited.stock));

  // ------------------------------------------------------------ the site
  console.log('\n=== The site reads the same database ===\n');
  const cat = await loadPage('產品介紹.html',
    'http://localhost:8000/%E7%94%A2%E5%93%81%E4%BB%8B%E7%B4%B9.html', apiUp, API);
  await settle(300);
  const cw = cat.window;
  const live = cw.eval('productData.zh').find(p => p.sku === 'WH-DB-1');
  check('the catalogue picks up the product from MongoDB', !!live, 'found');
  check('and sees it as out of stock without any export step',
    live && live.status === 'Out of Stock', live && live.status);
  check('a shopper cannot add it', cw.addToCart(live.id, 1, live) === false);

  const det = await loadPage('product.html',
    'http://localhost:8000/product.html?sku=WH-DB-1', apiUp, API);
  await settle(300);
  const btn = det.window.document.getElementById('detailAddBtn');
  check('the product page disables Add to Cart', !!btn && btn.hasAttribute('disabled'));

  // ------------------------------------------------------------ fallback
  console.log('\n=== With MongoDB stopped, nothing breaks ===\n');
  up = false;
  const offline = await loadPage('admin/index.html', 'http://localhost:8000/admin/index.html', apiUp, API);
  offline.window.enterDemo();
  await settle(400);
  const od = offline.window.document;
  check('the chip says the database is offline',
    /offline/i.test(od.getElementById('dbChipText').textContent),
    od.getElementById('dbChipText').textContent);
  check('the admin still loads the committed cases',
    offline.window.eval('casesData').length === JSON.parse(read('data/cases.json')).length);
  check('the admin still loads the committed products',
    offline.window.eval('productsData').length === JSON.parse(read('data/products.json')).length);

  const offlineCat = await loadPage('產品介紹.html',
    'http://localhost:8000/%E7%94%A2%E5%93%81%E4%BB%8B%E7%B4%B9.html', apiUp, API);
  await settle(300);
  check('the catalogue still renders from the committed files',
    offlineCat.window.document.querySelectorAll('.product-card').length > 0,
    offlineCat.window.document.querySelectorAll('.product-card').length + ' cards');

  // ------------------------------------------------------------ published site
  console.log('\n=== The published site never calls localhost ===\n');
  let calledApi = false;
  const vc = new VirtualConsole();
  const pub = new JSDOM(read('產品介紹.html'), {
    url: 'https://www.wonder-herb.com/%E7%94%A2%E5%93%81%E4%BB%8B%E7%B4%B9.html',
    runScripts: 'dangerously', virtualConsole: vc,
    beforeParse(w) {
      w.alert = () => {};
      w.fetch = (url) => {
        if (/localhost|127\.0\.0\.1/.test(String(url))) calledApi = true;
        const name = String(url).split('/').pop();
        try {
          const body = fs.readFileSync(path.join(ROOT, 'data', name), 'utf8');
          return Promise.resolve({ ok: true, status: 200,
            text: () => Promise.resolve(body), json: () => Promise.resolve(JSON.parse(body)) });
        } catch (e) { return Promise.resolve({ ok: false, status: 404 }); }
      };
    }
  });
  await new Promise(r => pub.window.addEventListener('load', () => setTimeout(r, 200)));
  check('no request to a local API from the live domain', calledApi === false);
  check('the live page still renders its catalogue',
    pub.window.document.querySelectorAll('.product-card').length > 0);

  server.close();
  for (const c of Object.values(COLLECTIONS)) await db.collection(c).deleteMany({});
  await db.collection('homepage').deleteMany({});
  await db.collection(AUTH_COLLECTIONS.users).deleteMany({});
  await db.collection(AUTH_COLLECTIONS.sessions).deleteMany({});
  await close();

  console.log('');
  console.log(fail === 0 ? '=== ALL CHECKS PASSED ===' : '=== ' + fail + ' CHECK(S) FAILED ===');
  process.exit(fail ? 1 : 0);
})().catch(err => {
  console.error('\nTest run failed:', err);
  process.exit(1);
});
