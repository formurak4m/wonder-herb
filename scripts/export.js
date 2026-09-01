/* Write MongoDB back into the committed data/ files.
 *
 * This is the publish step of the hybrid setup: you edit against the database,
 * then run this and commit. The live site keeps serving plain static files, so
 * nothing about hosting or the SEO work changes.
 */
const fs = require('fs');
const path = require('path');
const { connect, close, COLLECTIONS } = require('../server/db');

const DATA = path.join(__dirname, '..', 'data');

const CSV_HEAD = ['SKU', 'Product', 'Price (HKD)', 'On hand', 'Reorder at',
                  'Status', 'Stock value (HKD)', 'Last updated'];
const csvCell = v => '"' + String(v === undefined || v === null ? '' : v).replace(/"/g, '""') + '"';

function stripId(doc) {
  const { _id, pos, ...rest } = doc;
  return rest;
}

async function readList(db, name) {
  const rows = await db.collection(COLLECTIONS[name]).find({}).sort({ pos: 1 }).toArray();
  return rows.map(stripId);
}

/* Write only if the content actually changed, so an unchanged run leaves the
   working tree clean and `git status` stays meaningful. */
function writeIfChanged(file, content) {
  const full = path.join(DATA, file);
  let before = null;
  try { before = fs.readFileSync(full, 'utf8'); } catch (e) { /* new file */ }
  if (before === content) {
    console.log('  ' + file.padEnd(18) + 'unchanged');
    return false;
  }
  fs.writeFileSync(full, content, 'utf8');
  console.log('  ' + file.padEnd(18) + 'written');
  return true;
}

function buildInventoryCsv(products) {
  const lines = [CSV_HEAD.map(csvCell).join(',')];
  products.forEach(p => {
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
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/* The site reads products.json without stock fields; stock is the CSV's job.
   Keeping them apart means a stock change touches one small file, not the
   whole catalogue. */
function forSite(product) {
  const { stock, reorder, stockUpdated, ...rest } = product;
  return rest;
}

(async () => {
  console.log('Exporting MongoDB to data/ ...\n');
  const db = await connect();

  const cases = await readList(db, 'cases');
  const products = await readList(db, 'products');
  const faq = await readList(db, 'faq');
  const movements = await readList(db, 'movements');
  const activity = await readList(db, 'activity');
  const homepageDoc = await db.collection('homepage').findOne({ _id: 'homepage' });
  const homepage = homepageDoc ? stripId(homepageDoc) : {};

  if (!products.length && !cases.length && !faq.length) {
    console.error('The database is empty. Run `npm run seed` first, or you would');
    console.error('overwrite data/ with nothing.');
    process.exit(1);
  }

  let changed = 0;
  changed += writeIfChanged('cases.json', JSON.stringify(cases, null, 2) + '\n');
  changed += writeIfChanged('products.json', JSON.stringify(products.map(forSite), null, 2) + '\n');
  changed += writeIfChanged('faq.json', JSON.stringify(faq, null, 2) + '\n');
  changed += writeIfChanged('homepage.json', JSON.stringify(homepage, null, 2) + '\n');
  changed += writeIfChanged('inventory.csv', buildInventoryCsv(products));
  changed += writeIfChanged('inventory-log.json', JSON.stringify(movements, null, 2) + '\n');
  changed += writeIfChanged('activity-log.json', JSON.stringify(activity, null, 2) + '\n');

  console.log('\n' + changed + ' file(s) changed.');
  if (changed) console.log('Review with `git diff data/`, then commit to publish.');
  await close();
})().catch(err => {
  console.error('\nExport failed:', err.message);
  process.exit(1);
});
