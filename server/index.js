/* Wonder Herb local CMS API
 *
 * The public site is static and stays that way. This server exists so the
 * admin and the site can share one database while you work: MongoDB is the
 * editing surface, and `npm run export` writes it back into data/ for
 * committing. If this server is not running, both the admin and the site
 * fall back to the committed files exactly as before.
 */
const express = require('express');
const cors = require('cors');
const { connect, COLLECTIONS, normalise, ensureIndexes, URL, DB_NAME } = require('./db');

const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));

/* A module is either a list (cases/products/faq/movements) or the single
   homepage settings document. */
const LIST_MODULES = Object.keys(COLLECTIONS);
const isList = m => LIST_MODULES.indexOf(m) !== -1;

/* Housekeeping fields stay in the database and out of the browser's copy. */
function stripId(doc) {
  if (!doc) return doc;
  const { _id, pos, updatedAt, ...rest } = doc;
  return rest;
}

async function readList(db, name) {
  const rows = await db.collection(COLLECTIONS[name]).find({}).sort({ pos: 1 }).toArray();
  return rows.map(stripId);
}

/* Replace a whole list, preserving the order the editor sees.
 *
 * Written into a temporary collection and renamed over the real one, so a
 * failure part-way through leaves the existing data untouched. A plain
 * deleteMany + insertMany would empty the collection if the insert threw.
 */
async function writeList(db, name, items) {
  const target = COLLECTIONS[name];
  const list = Array.isArray(items) ? items : [];
  const stamp = new Date();

  if (!list.length) {
    await db.collection(target).deleteMany({});
    return 0;
  }

  const tmp = target + '_writing';
  await db.collection(tmp).drop().catch(() => {});
  try {
    await db.collection(tmp).insertMany(list.map((item, i) =>
      Object.assign(normalise(name, item), { pos: i, updatedAt: stamp })));
    await db.collection(tmp).rename(target, { dropTarget: true });
  } catch (err) {
    await db.collection(tmp).drop().catch(() => {});
    throw err;
  }
  await ensureIndexes(db);
  return list.length;
}

async function readHomepage(db) {
  const doc = await db.collection('homepage').findOne({ _id: 'homepage' });
  return doc ? stripId(doc) : {};
}

async function writeHomepage(db, values) {
  await db.collection('homepage').replaceOne(
    { _id: 'homepage' },
    Object.assign({ _id: 'homepage' }, values || {}, { updatedAt: new Date() }),
    { upsert: true }
  );
  return 1;
}

const asyncRoute = fn => (req, res) => fn(req, res).catch(err => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

/* ---------------------------------------------------------------- health */
app.get('/api/health', asyncRoute(async (req, res) => {
  const db = await connect();
  const counts = {};
  for (const name of LIST_MODULES) {
    counts[name] = await db.collection(COLLECTIONS[name]).countDocuments();
  }
  counts.homepage = await db.collection('homepage').countDocuments();
  res.json({ ok: true, db: DB_NAME, url: URL.replace(/\/\/.*@/, '//'), counts });
}));

/* ---------------------------------------------------------------- modules
   Kept on the same /api/cms?type=… shape the admin already speaks, so the
   editor's existing save calls did not have to be rewritten. */
app.get('/api/cms', asyncRoute(async (req, res) => {
  const db = await connect();
  const type = req.query.type;
  if (!type) {
    const all = {};
    for (const name of LIST_MODULES) all[name] = await readList(db, name);
    all.homepage = await readHomepage(db);
    return res.json(all);
  }
  if (type === 'homepage') return res.json(await readHomepage(db));
  if (!isList(type)) return res.status(404).json({ error: 'Unknown type: ' + type });
  res.json(await readList(db, type));
}));

app.post('/api/cms', asyncRoute(async (req, res) => {
  const db = await connect();
  const type = req.query.type;
  if (type === 'homepage') {
    await writeHomepage(db, req.body);
    return res.json({ success: true, type, count: 1 });
  }
  if (!isList(type)) return res.status(404).json({ error: 'Unknown type: ' + type });
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Expected an array for ' + type });
  }
  const count = await writeList(db, type, req.body);
  res.json({ success: true, type, count });
}));

/* ---------------------------------------------------------------- activity
   The dashboard's "Recent changes" trail. Append-only and capped, so it is a
   history rather than something the editor can silently rewrite. */
app.post('/api/activity', asyncRoute(async (req, res) => {
  const db = await connect();
  const entry = {
    at: req.body.at || new Date().toISOString(),
    module: String(req.body.module || 'other'),
    text: String(req.body.text || '').slice(0, 500),
    pos: -Date.now(),
    updatedAt: new Date()
  };
  if (!entry.text) return res.status(400).json({ error: 'An activity entry needs text' });
  await db.collection(COLLECTIONS.activity).insertOne(entry);

  // keep the most recent 200
  const extra = await db.collection(COLLECTIONS.activity)
    .find({}).sort({ pos: 1 }).skip(200).project({ _id: 1 }).toArray();
  if (extra.length) {
    await db.collection(COLLECTIONS.activity).deleteMany({ _id: { $in: extra.map(d => d._id) } });
  }
  res.json({ success: true });
}));

/* ---------------------------------------------------------------- stock
   One atomic update per movement, so two people adjusting the same product
   at once cannot overwrite each other the way a whole-list save would. */
app.post('/api/stock/:sku/adjust', asyncRoute(async (req, res) => {
  const db = await connect();
  const sku = req.params.sku;
  const type = String(req.body.type || 'correction');
  const qty = Math.max(0, parseInt(req.body.qty, 10) || 0);
  const note = String(req.body.note || '').trim();

  const products = db.collection(COLLECTIONS.products);

  /* The new stock is computed by MongoDB inside a single atomic update, not
     read into Node and written back — otherwise two sales landing at the same
     moment each read the same figure and one of them is lost. */
  const current = { $ifNull: ['$stock', 0] };
  let nextStock;
  if (type === 'correction') nextStock = { $literal: qty };
  else if (type === 'receive') nextStock = { $add: [current, qty] };
  else nextStock = { $max: [0, { $subtract: [current, qty] }] };   // never negative

  // A pre-order product is meant to sell with an empty shelf, so it keeps
  // that status; anything else follows the count.
  const wasPreorder = { $regexMatch: { input: { $ifNull: ['$status', ''] }, regex: '^pre', options: 'i' } };

  const updated = await products.findOneAndUpdate(
    { sku: sku },
    [
      { $set: { _wasPre: wasPreorder, stock: nextStock } },
      { $set: {
          status: { $cond: ['$_wasPre', 'Pre-order',
            { $cond: [{ $lte: ['$stock', 0] }, 'Out of Stock', 'In Stock'] }] },
          stockUpdated: new Date().toISOString().slice(0, 10)
      } },
      { $unset: '_wasPre' }
    ],
    { returnDocument: 'before' }
  );

  const product = updated && updated.value !== undefined ? updated.value : updated;
  if (!product) return res.status(404).json({ error: 'No product with SKU ' + sku });

  // `product` is the document this update was applied to, so recomputing the
  // result from it gives exactly what was stored.
  const before = parseInt(product.stock, 10) || 0;
  let after;
  if (type === 'correction') after = qty;
  else if (type === 'receive') after = before + qty;
  else after = Math.max(0, before - qty);
  const clamped = after;
  const status = /^pre/i.test(product.status || '')
    ? 'Pre-order'
    : (clamped <= 0 ? 'Out of Stock' : 'In Stock');

  const movement = {
    at: new Date().toISOString(),
    sku: sku,
    title: product.title || '',
    type: type,
    delta: clamped - before,
    after: clamped,
    note: note
  };
  await db.collection(COLLECTIONS.movements).insertOne(
    Object.assign(normalise('movements', movement), { pos: -Date.now(), updatedAt: new Date() }));

  res.json({ success: true, before: before, after: clamped, status: status, movement: movement });
}));

/* ---------------------------------------------------------------- CSV
   Same columns as data/inventory.csv, so the site's existing reader works
   against the live database with no change to how it parses. */
const CSV_HEAD = ['SKU', 'Product', 'Price (HKD)', 'On hand', 'Reorder at',
                  'Status', 'Stock value (HKD)', 'Last updated'];

const csvCell = v => '"' + String(v === undefined || v === null ? '' : v).replace(/"/g, '""') + '"';

app.get('/api/inventory.csv', asyncRoute(async (req, res) => {
  const db = await connect();
  const rows = await readList(db, 'products');
  const lines = [CSV_HEAD.map(csvCell).join(',')];
  rows.forEach(p => {
    const tracked = p.stock !== undefined && p.stock !== null && p.stock !== '';
    const n = tracked ? (parseInt(p.stock, 10) || 0) : null;
    const price = parseFloat(p.price) || 0;
    lines.push([
      p.sku || '', p.title || '', price.toFixed(2),
      n === null ? '' : n,
      tracked ? (p.reorder === undefined ? 10 : p.reorder) : '',
      p.status || '',
      n === null ? '' : (n * price).toFixed(2),
      p.stockUpdated || ''
    ].map(csvCell).join(','));
  });
  res.type('text/csv; charset=utf-8').send('﻿' + lines.join('\r\n') + '\r\n');
}));

if (require.main === module) {
  connect()
    .then(() => app.listen(PORT, () => {
      console.log('Wonder Herb CMS API  ->  http://localhost:' + PORT);
      console.log('MongoDB              ->  ' + URL + '/' + DB_NAME);
    }))
    .catch(err => {
      console.error('Cannot reach MongoDB at ' + URL);
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = app;
