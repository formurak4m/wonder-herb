/* Write MongoDB back into the committed data/ files.
 *
 * This is the publish step of the hybrid setup: you edit against the database,
 * then run this and commit. The live site keeps serving plain static files, so
 * nothing about hosting or the SEO work changes.
 */
const fs = require('fs');
const path = require('path');
const { connect, close, COLLECTIONS, PAGE_COLLECTIONS } = require('../server/db');

const DATA = path.join(__dirname, '..', 'data');
const PAGES_DIR = path.join(DATA, 'pages');
const SLUG_OK = /^[a-z0-9][a-z0-9_-]*$/;

const CSV_HEAD = ['SKU', 'Product', 'Price (HKD)', 'On hand', 'Reorder at',
                  'Status', 'Stock value (HKD)', 'Last updated'];
/* Quote only the cells that need it (RFC 4180), so a seed -> export round trip
   reproduces the file byte for byte instead of re-quoting every cell. */
const csvCell = v => {
  const s = String(v === undefined || v === null ? '' : v);
  return /["\r\n,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

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
      // the reorder point is set per product; it does not depend on stock being tracked
      p.reorder === undefined || p.reorder === null ? (tracked ? 10 : '') : p.reorder,
      p.status || '',
      n === null ? '' : (n * price).toFixed(2),
      p.stockUpdated || ''
    ].map(csvCell).join(','));
  });
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/* Page trees, one file per page, so a layout change is a small readable diff
   rather than one churning blob.
 *
 * Two safety rules, matching the guard the content export already has:
 *
 *   - An empty `pages` collection leaves data/pages/ completely alone. It does
 *     not create the folder and it does not remove anything, so running export
 *     against a database that simply has no page trees yet cannot wipe trees
 *     that are already published.
 *   - Nothing here deletes. A tree that is on disk but no longer in the
 *     database is reported and left in place, so a bad import or a half-seeded
 *     database cannot quietly delete a live page. Removing a page stays a
 *     deliberate `git rm`.
 */
function writePages(trees) {
  if (!trees.length) {
    console.log('  pages/            none in the database, data/pages/ left alone');
    return 0;
  }
  fs.mkdirSync(PAGES_DIR, { recursive: true });

  let changed = 0;
  const written = [];
  trees.forEach(tree => {
    const slug = String(tree.slug === undefined || tree.slug === null ? '' : tree.slug).trim();
    // the slug becomes a filename, so refuse anything that is not plainly one
    if (!SLUG_OK.test(slug)) {
      console.log('  pages/            skipped, unusable slug: ' + JSON.stringify(tree.slug));
      return;
    }
    written.push(slug + '.json');
    changed += writeIfChanged('pages/' + slug + '.json', JSON.stringify(tree, null, 2) + '\n');
  });

  const orphans = fs.readdirSync(PAGES_DIR)
    .filter(f => f.endsWith('.json') && written.indexOf(f) === -1);
  if (orphans.length) {
    console.log('  pages/            ' + orphans.length + ' file(s) not in the database, left in place: '
                + orphans.join(', '));
  }
  return changed;
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
  const pages = await db.collection(PAGE_COLLECTIONS.pages)
    .find({}, { projection: { _id: 0 } }).sort({ slug: 1 }).toArray();

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
  changed += writePages(pages);

  console.log('\n' + changed + ' file(s) changed.');
  if (changed) console.log('Review with `git diff data/`, then commit to publish.');
  await close();
})().catch(err => {
  console.error('\nExport failed:', err.message);
  process.exit(1);
});
