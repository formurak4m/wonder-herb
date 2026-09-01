/* Load the committed data/ files into MongoDB.
 * Safe to re-run: it replaces each collection with what is in data/.
 * Stock comes from data/inventory.csv and is merged onto the products by SKU.
 */
const fs = require('fs');
const path = require('path');
const { connect, close, COLLECTIONS, normalise, ensureIndexes } = require('../server/db');

const DATA = path.join(__dirname, '..', 'data');

function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    console.log('  (no ' + name + ', skipping)');
    return fallback;
  }
}

/* Same reader the browser uses: quoted fields, embedded commas and newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  text = String(text).replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') { inQuotes = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') { field += c; }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const head = rows.shift().map(h => h.trim());
  return rows.filter(r => r.some(v => String(v).trim() !== '')).map(r => {
    const o = {};
    head.forEach((h, i) => { o[h] = r[i] === undefined ? '' : String(r[i]).trim(); });
    return o;
  });
}

function readInventoryCsv() {
  try {
    return parseCsv(fs.readFileSync(path.join(DATA, 'inventory.csv'), 'utf8'));
  } catch (e) {
    console.log('  (no inventory.csv, products will start untracked)');
    return [];
  }
}

/* Same shape the API writes, so a seeded document and an edited one are
   indistinguishable: numbers as numbers, ordered by `pos`, timestamped. */
async function replaceList(db, name, items) {
  const col = db.collection(COLLECTIONS[name]);
  const stamp = new Date();
  await col.deleteMany({});
  if (items.length) {
    await col.insertMany(items.map((x, i) =>
      Object.assign(normalise(name, x), { pos: i, updatedAt: stamp })));
  }
  console.log('  ' + name.padEnd(10) + items.length + ' document(s)');
}

(async () => {
  console.log('Seeding MongoDB from data/ ...\n');
  const db = await connect();

  const cases = readJson('cases.json', []);
  const products = readJson('products.json', []);
  const faq = readJson('faq.json', []);
  const homepage = readJson('homepage.json', {});
  const inventory = readInventoryCsv();

  // Merge stock from the CSV onto the matching product.
  const bySku = {};
  inventory.forEach(r => { if (r['SKU']) bySku[r['SKU'].trim()] = r; });
  let tracked = 0;
  products.forEach(p => {
    const row = bySku[(p.sku || '').trim()];
    if (!row) return;
    const onHand = (row['On hand'] || '').trim();
    if (onHand !== '') { p.stock = Math.max(0, parseInt(onHand, 10) || 0); tracked++; }
    const reorder = parseInt((row['Reorder at'] || '').trim(), 10);
    if (!isNaN(reorder)) p.reorder = reorder;
    if (/^pre/i.test(row['Status'] || '')) p.status = 'Pre-order';
    if (row['Last updated']) p.stockUpdated = row['Last updated'];
  });

  await replaceList(db, 'cases', cases);
  await replaceList(db, 'products', products);
  await replaceList(db, 'faq', faq);
  await db.collection('homepage').replaceOne(
    { _id: 'homepage' },
    Object.assign({ _id: 'homepage' }, homepage, { updatedAt: new Date() }), { upsert: true });
  console.log('  homepage  ' + Object.keys(homepage).length + ' field(s)');

  // History is never overwritten by a seed - it is a record, not content.
  const moves = await db.collection(COLLECTIONS.movements).countDocuments();
  const acts = await db.collection(COLLECTIONS.activity).countDocuments();
  console.log('  movements ' + moves + ' kept');
  console.log('  activity  ' + acts + ' kept');

  await ensureIndexes(db);

  console.log('\nStock merged from inventory.csv for ' + tracked + ' product(s).');
  console.log('Done. Start the API with:  npm run dev');
  await close();
})().catch(err => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
