/* One stock movement, applied atomically.
 *
 * Used by the Inventory screen's "Adjust" and by invoices, so a sale entered
 * on the Sales screen lowers the shelf count through exactly the same path.
 */
const { COLLECTIONS, normalise } = require('./db');

/* The new stock is computed by MongoDB inside a single update, not read into
   Node and written back - otherwise two sales landing at the same moment each
   read the same figure and one of them is lost.

   Returns null when there is no product with that SKU. */
async function applyMovement(db, opts) {
  const sku = String(opts.sku || '');
  const type = String(opts.type || 'correction');
  const qty = Math.max(0, parseInt(opts.qty, 10) || 0);
  const note = String(opts.note || '').trim();

  const current = { $ifNull: ['$stock', 0] };
  let nextStock;
  if (type === 'correction') nextStock = { $literal: qty };
  else if (type === 'receive') nextStock = { $add: [current, qty] };
  else nextStock = { $max: [0, { $subtract: [current, qty] }] };   // never negative

  // A pre-order product is meant to sell with an empty shelf, so it keeps
  // that status; anything else follows the count.
  const wasPreorder = { $regexMatch: { input: { $ifNull: ['$status', ''] }, regex: '^pre', options: 'i' } };

  const updated = await db.collection(COLLECTIONS.products).findOneAndUpdate(
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
  if (!product) return null;

  // `product` is the document the update was applied to, so recomputing the
  // result from it gives exactly what was stored.
  const before = parseInt(product.stock, 10) || 0;
  let after;
  if (type === 'correction') after = qty;
  else if (type === 'receive') after = before + qty;
  else after = Math.max(0, before - qty);
  const status = /^pre/i.test(product.status || '')
    ? 'Pre-order'
    : (after <= 0 ? 'Out of Stock' : 'In Stock');

  const movement = {
    at: (opts.at instanceof Date ? opts.at : new Date()).toISOString(),
    by: String(opts.by || ''),
    sku: sku,
    title: product.title || '',
    type: type,
    delta: after - before,
    after: after,
    note: note
  };
  if (opts.ref) movement.ref = String(opts.ref);
  await db.collection(COLLECTIONS.movements).insertOne(
    Object.assign(normalise('movements', movement), { pos: -Date.now(), updatedAt: new Date() }));

  return { product: product, before: before, after: after, status: status, movement: movement };
}

/* Whether a product's stock is being counted at all. Untracked products are
   left alone by invoices: there is no figure to lower. */
async function isTracked(db, sku) {
  const p = await db.collection(COLLECTIONS.products).findOne({ sku: sku }, { projection: { stock: 1 } });
  return !!p && p.stock !== undefined && p.stock !== null && p.stock !== '';
}

module.exports = { applyMovement, isTracked };
