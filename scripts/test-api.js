/* Integration test: real Express server, real MongoDB, no stubs.
 *
 * Runs against a throwaway database (wonderherb_test) so your working data is
 * never touched. Start it with: npm run test:api
 */
process.env.MONGO_DB = process.env.MONGO_DB_TEST || 'wonderherb_test';
process.env.PORT = process.env.PORT_TEST || '4111';

const app = require('../server/index');
const { connect, close, COLLECTIONS, AUTH_COLLECTIONS } = require('../server/db');

const BASE = 'http://localhost:' + process.env.PORT;
let fail = 0;
const check = (label, cond, extra) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '   -> ' + extra : ''));
  if (!cond) fail++;
};

/* Writing now needs a signed-in account with the right privilege, so the suite
   signs in as an administrator first and every write carries that token. */
let TOKEN = null;
const headers = () => Object.assign({ 'Content-Type': 'application/json' },
  TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {});

const get = (p) => fetch(BASE + p).then(r => r.json());
const post = (p, body) => fetch(BASE + p, {
  method: 'POST',
  headers: headers(),
  body: JSON.stringify(body)
}).then(async r => ({ status: r.status, body: await r.json() }));

(async () => {
  const db = await connect();
  for (const c of Object.values(COLLECTIONS)) await db.collection(c).deleteMany({});
  await db.collection('homepage').deleteMany({});
  await db.collection(AUTH_COLLECTIONS.users).deleteMany({});
  await db.collection(AUTH_COLLECTIONS.sessions).deleteMany({});

  const server = app.listen(Number(process.env.PORT));
  await new Promise(r => server.once('listening', r));

  const boot = await post('/api/auth/signup',
    { name: 'Test Admin', email: 'api-test@example.com', password: 'suite-password-1', asAdmin: true });
  TOKEN = boot.body.token;

  console.log('\n=== Server + MongoDB ===\n');
  const health = await get('/api/health');
  check('the API answers /api/health', health.ok === true);
  check('it reports the database it is using', health.db === process.env.MONGO_DB, health.db);

  console.log('\n=== Modules round-trip through MongoDB ===\n');
  const products = [
    { id: 1, sku: 'WH-A', title: 'Alpha, with comma', price: '100.00', status: 'In Stock',
      desc: 'first', images: [{ url: 'https://e/1.png', alt: 'front' }] },
    { id: 2, sku: 'WH-B', title: 'Beta', price: '250.00', status: 'Pre-order', desc: 'second' }
  ];
  let r = await post('/api/cms?type=products', products);
  check('products save', r.body.success === true && r.body.count === 2);

  const back = await get('/api/cms?type=products');
  check('products read back in the same order',
    back.length === 2 && back[0].sku === 'WH-A' && back[1].sku === 'WH-B');
  check('nested fields survive the round trip',
    back[0].images && back[0].images[0].alt === 'front');
  check('internal mongo fields are not leaked to the browser',
    !('_id' in back[0]) && !('pos' in back[0]));

  await post('/api/cms?type=cases', [{ zh: { title: '麥女士（77歲）' }, en: { title: 'Ms. Mak' } }]);
  const cases = await get('/api/cms?type=cases');
  check('Chinese case text survives MongoDB', cases[0].zh.title === '麥女士（77歲）');

  await post('/api/cms?type=faq', [{ id: 1, cat: 'General', q: 'Q?', a: 'A.' }]);
  check('faq saves', (await get('/api/cms?type=faq')).length === 1);

  await post('/api/cms?type=homepage', { hero_title: 'Hello', contact_email: 'a@b.c' });
  const hp = await get('/api/cms?type=homepage');
  check('homepage is stored as a single document', hp.hero_title === 'Hello');
  check('homepage has no mongo id either', !('_id' in hp));

  const bad = await post('/api/cms?type=nonsense', []);
  check('an unknown module is rejected, not silently stored', bad.status === 404);
  const notArray = await post('/api/cms?type=products', { nope: true });
  check('a non-array list payload is rejected', notArray.status === 400);

  console.log('\n=== Stock movements are atomic ===\n');
  await post('/api/cms?type=products', products);

  r = await post('/api/stock/WH-A/adjust', { type: 'receive', qty: 100, note: 'Invoice 1' });
  check('receiving raises stock', r.body.after === 100, String(r.body.after));
  check('and marks it In Stock', r.body.status === 'In Stock');

  r = await post('/api/stock/WH-A/adjust', { type: 'sale', qty: 30 });
  check('selling lowers stock', r.body.after === 70);

  r = await post('/api/stock/WH-A/adjust', { type: 'sale', qty: 9999 });
  check('stock cannot go negative', r.body.after === 0);
  check('running out marks it Out of Stock', r.body.status === 'Out of Stock');

  r = await post('/api/stock/WH-A/adjust', { type: 'correction', qty: 12 });
  check('a correction sets the exact figure', r.body.after === 12);

  r = await post('/api/stock/WH-B/adjust', { type: 'correction', qty: 0 });
  check('a Pre-order product keeps that status at zero stock',
    r.body.status === 'Pre-order', r.body.status);

  r = await post('/api/stock/WH-NOPE/adjust', { type: 'receive', qty: 1 });
  check('an unknown SKU is a clean 404', r.status === 404);

  // 20 concurrent sales must land exactly, which a read-modify-write would not
  await post('/api/stock/WH-A/adjust', { type: 'correction', qty: 100 });
  await Promise.all(Array.from({ length: 20 }, () =>
    post('/api/stock/WH-A/adjust', { type: 'sale', qty: 1 })));
  const after = (await get('/api/cms?type=products')).find(p => p.sku === 'WH-A');
  check('20 simultaneous sales all land (100 -> 80)', after.stock === 80, String(after.stock));

  const moves = await get('/api/cms?type=movements');
  check('every movement is recorded', moves.length === 26, moves.length + ' movements');
  check('movements carry note, delta and resulting count',
    moves.some(m => m.note === 'Invoice 1' && m.delta === 100 && m.after === 100));

  console.log('\n=== Everything is stored, in the right types ===\n');
  const rawProduct = await db.collection(COLLECTIONS.products).findOne({ sku: 'WH-A' });
  check('numbers are stored as numbers, not strings',
    typeof rawProduct.stock === 'number' && typeof rawProduct.id === 'number',
    typeof rawProduct.stock + '/' + typeof rawProduct.id);
  check('price keeps the "0.00" string the site renders',
    typeof rawProduct.price === 'string', rawProduct.price);
  check('every document is timestamped', rawProduct.updatedAt instanceof Date);
  check('ordering is stored explicitly', typeof rawProduct.pos === 'number');
  check('indexes exist for the fields we query',
    (await db.collection(COLLECTIONS.products).indexes()).some(i => i.key && i.key.sku === 1));

  const cols = (await db.listCollections().toArray()).map(c => c.name).sort();
  check('all six data sets have a collection',
    ['activity', 'cases', 'faq', 'homepage', 'movements', 'products'].every(c => cols.includes(c)),
    cols.join(', '));

  await post('/api/activity', { module: 'products', text: 'Edited product: Alpha' });
  await post('/api/activity', { module: 'inventory', text: 'Received 10' });
  const acts = await get('/api/cms?type=activity');
  check('the activity trail is stored in MongoDB', acts.length === 2, acts.length + ' entries');
  check('newest activity first', acts[0].text === 'Received 10', acts[0].text);
  const emptyAct = await post('/api/activity', { module: 'products', text: '' });
  check('an empty activity entry is rejected', emptyAct.status === 400);

  console.log('\n=== A failed save must not destroy the collection ===\n');
  const kept = await get('/api/cms?type=products');
  // Two documents sharing an _id: a duplicate-key error part-way through the
  // insert, which is exactly the case that used to leave the collection empty.
  const failed = await fetch(BASE + '/api/cms?type=products', {
    method: 'POST', headers: headers(),
    body: JSON.stringify([{ _id: 'dup', sku: 'WH-X' }, { _id: 'dup', sku: 'WH-Y' }])
  });
  check('the failing write is reported as an error, not a success', failed.status === 500,
    String(failed.status));
  const survived = await get('/api/cms?type=products');
  check('the existing products are untouched',
    survived.length === kept.length && survived[0].sku === kept[0].sku,
    survived.length + ' vs ' + kept.length + ' before');
  check('no half-written temp collection is left behind',
    !(await db.listCollections().toArray()).map(c => c.name).some(n => /_writing$/.test(n)));

  console.log('\n=== The CSV the site reads ===\n');
  // read raw bytes: fetch().text() strips a leading BOM, so check the wire form
  const csvBytes = new Uint8Array(await fetch(BASE + '/api/inventory.csv').then(r => r.arrayBuffer()));
  const csv = Buffer.from(csvBytes).toString('utf8');
  console.log(csv.split('\r\n').slice(0, 3).map(l => '    ' + l).join('\n') + '\n');
  check('served as CSV with a BOM for Excel',
    csvBytes[0] === 0xEF && csvBytes[1] === 0xBB && csvBytes[2] === 0xBF);
  check('same header as data/inventory.csv',
    csv.split('\r\n')[0].replace(/^﻿/, '').replace(/"/g, '') ===
    'SKU,Product,Price (HKD),On hand,Reorder at,Status,Stock value (HKD),Last updated');
  check('live stock appears in it', /"WH-A".*"80"/.test(csv.split('\r\n')[1]));
  check('a comma in a product name is quoted, not split',
    csv.split('\r\n')[1].includes('"Alpha, with comma"'));

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
