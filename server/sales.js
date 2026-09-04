/* Sales: invoices and customers.
 *
 * This is the client's monthly sales sheet as data. Staff enter an invoice
 * the way they type a row in Excel - customer, then price and quantity per
 * product - and the spreadsheet is generated from what is stored, rather
 * than the other way round.
 *
 * Invoices are never deleted, only voided: they are money, and the record
 * of a mistake is part of the books.
 */
const { ObjectId } = require('mongodb');
const { COLLECTIONS, SALES_COLLECTIONS, ensureSalesIndexes } = require('./db');
const stock = require('./stock');
const salesReport = require('./sales-report');

const PAYMENTS = ['Cash', 'Cheque', 'Credit Card'];

const oid = v => { try { return new ObjectId(String(v)); } catch (e) { return null; } };
const money = v => Math.round((parseFloat(v) || 0) * 100) / 100;

/* ------------------------------------------------------------ shaping */

function publicCustomer(c) {
  if (!c) return null;
  return {
    id: String(c._id),
    name: c.name || '',
    phone: c.phone || '',
    prices: c.prices || {},
    notes: c.notes || '',
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : (c.createdAt || null)
  };
}

function publicInvoice(inv) {
  if (!inv) return null;
  return {
    id: String(inv._id),
    number: inv.number,
    date: inv.date instanceof Date ? inv.date.toISOString().slice(0, 10) : String(inv.date || ''),
    customerId: inv.customerId ? String(inv.customerId) : null,
    customerName: inv.customerName || '',
    phone: inv.phone || '',
    lines: inv.lines || [],
    payment: inv.payment || '',
    remarks: inv.remarks || '',
    total: inv.total || 0,
    status: inv.status || 'paid',
    source: inv.source || 'staff',
    createdBy: inv.createdBy || '',
    createdAt: inv.createdAt instanceof Date ? inv.createdAt.toISOString() : (inv.createdAt || null),
    voidedAt: inv.voidedAt instanceof Date ? inv.voidedAt.toISOString() : null
  };
}

/* What a form sends becomes a clean invoice or a reason it cannot. */
async function cleanInvoiceInput(db, body, existing) {
  const problems = [];

  const number = parseInt(body.number, 10);
  if (!(number > 0)) problems.push('An invoice number is required');

  const date = body.date ? new Date(String(body.date).slice(0, 10) + 'T00:00:00Z') : null;
  if (!date || isNaN(date.getTime())) problems.push('A valid date is required');

  const customerName = String(body.customerName || '').trim().slice(0, 120);
  if (!customerName) problems.push('A customer is required');

  const products = await db.collection(COLLECTIONS.products)
    .find({}, { projection: { sku: 1, title: 1 } }).toArray();
  const bySku = {};
  products.forEach(p => { if (p.sku) bySku[p.sku] = p; });

  const lines = [];
  (Array.isArray(body.lines) ? body.lines : []).forEach(l => {
    const sku = String((l && l.sku) || '').trim();
    const qty = parseInt(l && l.qty, 10);
    const price = money(l && l.price);
    if (!sku && !qty) return;                    // an empty row on the form
    if (!bySku[sku]) { problems.push('Unknown product: ' + (sku || '(blank)')); return; }
    if (!(qty > 0)) { problems.push('Quantity must be at least 1 for ' + bySku[sku].title); return; }
    if (price < 0) { problems.push('Price cannot be negative'); return; }
    lines.push({ sku: sku, title: bySku[sku].title || sku, price: price, qty: qty, amount: money(price * qty) });
  });
  if (!lines.length) problems.push('An invoice needs at least one product line');

  const payment = String(body.payment || '').trim();
  if (payment && PAYMENTS.indexOf(payment) === -1) problems.push('Payment must be Cash, Cheque or Credit Card');

  const status = body.status === 'unpaid' ? 'unpaid' : 'paid';

  let customerId = existing ? existing.customerId : null;
  if (body.customerId !== undefined) customerId = body.customerId ? oid(body.customerId) : null;

  return {
    problems: problems,
    doc: {
      number: number,
      date: date,
      customerId: customerId,
      customerName: customerName,
      phone: String(body.phone || '').trim().slice(0, 40),
      lines: lines,
      payment: payment,
      remarks: String(body.remarks || '').trim().slice(0, 500),
      total: money(lines.reduce((s, l) => s + l.amount, 0)),
      status: status
    }
  };
}

/* ------------------------------------------------------------- stock link
   A sale lowers the shelf count of every tracked product on it. What was
   applied is remembered on the invoice, so an edit or a void can reverse
   exactly that and nothing else. */
async function applyInvoiceStock(db, invoice, by) {
  const applied = [];
  for (const line of invoice.lines) {
    if (!(await stock.isTracked(db, line.sku))) continue;
    await stock.applyMovement(db, {
      sku: line.sku, type: 'sale', qty: line.qty, by: by,
      note: 'Invoice #' + invoice.number, ref: 'invoice:' + invoice.number
    });
    applied.push({ sku: line.sku, qty: line.qty });
  }
  return applied;
}

async function reverseInvoiceStock(db, invoice, by, why) {
  for (const a of (invoice.stockApplied || [])) {
    await stock.applyMovement(db, {
      sku: a.sku, type: 'receive', qty: a.qty, by: by,
      note: why + ' invoice #' + invoice.number, ref: 'invoice:' + invoice.number
    });
  }
}

/* ------------------------------------------------------------- customers */

function cleanCustomer(body, products) {
  const name = String(body.name || '').trim().slice(0, 120);
  const prices = {};
  const valid = new Set(products.map(p => p.sku));
  Object.keys(body.prices || {}).forEach(sku => {
    if (!valid.has(sku)) return;
    const v = body.prices[sku];
    if (v === '' || v === null || v === undefined) return;
    const n = money(v);
    if (n >= 0) prices[sku] = n;
  });
  return {
    name: name,
    phone: String(body.phone || '').trim().slice(0, 40),
    prices: prices,
    notes: String(body.notes || '').trim().slice(0, 500)
  };
}

/* ----------------------------------------------------------------- mount */

function mount(app, deps) {
  const { connect, requireCan, asyncRoute } = deps;

  // ---- customers
  app.get('/api/sales/customers', asyncRoute(async (req, res) => {
    if (!await requireCan(req, res, 'sales', 'view')) return;
    const db = await connect();
    const rows = await db.collection(SALES_COLLECTIONS.customers)
      .find({}).sort({ name: 1 }).toArray();
    res.json(rows.map(publicCustomer));
  }));

  app.post('/api/sales/customers', asyncRoute(async (req, res) => {
    const actor = await requireCan(req, res, 'sales', 'edit');
    if (!actor) return;
    const db = await connect();
    await ensureSalesIndexes(db);
    const products = await db.collection(COLLECTIONS.products).find({}, { projection: { sku: 1 } }).toArray();
    const doc = cleanCustomer(req.body, products);
    if (!doc.name) return res.status(400).json({ error: 'A customer name is required' });
    doc.createdAt = new Date();
    doc.createdBy = actor.user.email;
    const r = await db.collection(SALES_COLLECTIONS.customers).insertOne(doc);
    doc._id = r.insertedId;
    res.status(201).json({ success: true, customer: publicCustomer(doc) });
  }));

  app.patch('/api/sales/customers/:id', asyncRoute(async (req, res) => {
    const actor = await requireCan(req, res, 'sales', 'edit');
    if (!actor) return;
    const db = await connect();
    const id = oid(req.params.id);
    if (!id) return res.status(404).json({ error: 'No such customer' });
    const products = await db.collection(COLLECTIONS.products).find({}, { projection: { sku: 1 } }).toArray();
    const doc = cleanCustomer(req.body, products);
    if (!doc.name) return res.status(400).json({ error: 'A customer name is required' });
    doc.updatedAt = new Date();
    doc.updatedBy = actor.user.email;
    const r = await db.collection(SALES_COLLECTIONS.customers).findOneAndUpdate(
      { _id: id }, { $set: doc }, { returnDocument: 'after' });
    const after = r && r.value !== undefined ? r.value : r;
    if (!after) return res.status(404).json({ error: 'No such customer' });
    res.json({ success: true, customer: publicCustomer(after) });
  }));

  app.delete('/api/sales/customers/:id', asyncRoute(async (req, res) => {
    const actor = await requireCan(req, res, 'sales', 'edit');
    if (!actor) return;
    const db = await connect();
    const id = oid(req.params.id);
    if (!id) return res.status(404).json({ error: 'No such customer' });
    const used = await db.collection(SALES_COLLECTIONS.invoices).countDocuments({ customerId: id });
    if (used) return res.status(400).json({ error: 'This customer has ' + used + ' invoice(s); keep them for the books' });
    const r = await db.collection(SALES_COLLECTIONS.customers).deleteOne({ _id: id });
    if (!r.deletedCount) return res.status(404).json({ error: 'No such customer' });
    res.json({ success: true });
  }));

  // ---- invoices
  app.get('/api/sales/invoices', asyncRoute(async (req, res) => {
    if (!await requireCan(req, res, 'sales', 'view')) return;
    const db = await connect();
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    const query = {};
    if (year > 0) {
      const from = new Date(Date.UTC(year, month > 0 ? month - 1 : 0, 1));
      const to = month > 0 ? new Date(Date.UTC(year, month, 1)) : new Date(Date.UTC(year + 1, 0, 1));
      query.date = { $gte: from, $lt: to };
    }
    const rows = await db.collection(SALES_COLLECTIONS.invoices)
      .find(query).sort({ date: 1, number: 1 }).limit(2000).toArray();
    res.json(rows.map(publicInvoice));
  }));

  /* The next free invoice number, so the form is pre-filled the way a
     paper book would be. */
  app.get('/api/sales/invoices/next', asyncRoute(async (req, res) => {
    if (!await requireCan(req, res, 'sales', 'view')) return;
    const db = await connect();
    const last = await db.collection(SALES_COLLECTIONS.invoices)
      .find({}, { projection: { number: 1 } }).sort({ number: -1 }).limit(1).toArray();
    res.json({ number: last.length ? (last[0].number + 1) : 1001 });
  }));

  app.post('/api/sales/invoices', asyncRoute(async (req, res) => {
    const actor = await requireCan(req, res, 'sales', 'edit');
    if (!actor) return;
    const db = await connect();
    await ensureSalesIndexes(db);
    const { problems, doc } = await cleanInvoiceInput(db, req.body, null);
    if (problems.length) return res.status(400).json({ error: problems[0], problems: problems });

    doc.source = 'staff';
    doc.createdAt = new Date();
    doc.createdBy = actor.user.email;
    doc.stockApplied = [];
    try {
      const r = await db.collection(SALES_COLLECTIONS.invoices).insertOne(doc);
      doc._id = r.insertedId;
    } catch (err) {
      if (err && err.code === 11000) {
        return res.status(409).json({ error: 'Invoice #' + doc.number + ' already exists' });
      }
      throw err;
    }
    // a sale on paper is a sale on the shelf
    const applied = await applyInvoiceStock(db, doc, actor.user.email);
    await db.collection(SALES_COLLECTIONS.invoices).updateOne({ _id: doc._id }, { $set: { stockApplied: applied } });
    doc.stockApplied = applied;
    res.status(201).json({ success: true, invoice: publicInvoice(doc), stockApplied: applied });
  }));

  app.patch('/api/sales/invoices/:id', asyncRoute(async (req, res) => {
    const actor = await requireCan(req, res, 'sales', 'edit');
    if (!actor) return;
    const db = await connect();
    const id = oid(req.params.id);
    if (!id) return res.status(404).json({ error: 'No such invoice' });
    const invoices = db.collection(SALES_COLLECTIONS.invoices);
    const existing = await invoices.findOne({ _id: id });
    if (!existing) return res.status(404).json({ error: 'No such invoice' });
    if (existing.status === 'void') return res.status(400).json({ error: 'A voided invoice cannot be edited' });

    const merged = Object.assign({}, publicInvoice(existing), req.body);
    const { problems, doc } = await cleanInvoiceInput(db, merged, existing);
    if (problems.length) return res.status(400).json({ error: problems[0], problems: problems });

    doc.updatedAt = new Date();
    doc.updatedBy = actor.user.email;
    try {
      await invoices.updateOne({ _id: id }, { $set: doc });
    } catch (err) {
      if (err && err.code === 11000) return res.status(409).json({ error: 'Invoice #' + doc.number + ' already exists' });
      throw err;
    }

    // the shelf follows the corrected quantities: undo what was applied, apply the new
    await reverseInvoiceStock(db, existing, actor.user.email, 'Edited');
    const fresh = Object.assign({}, existing, doc);
    const applied = await applyInvoiceStock(db, fresh, actor.user.email);
    await invoices.updateOne({ _id: id }, { $set: { stockApplied: applied } });

    res.json({ success: true, invoice: publicInvoice(await invoices.findOne({ _id: id })) });
  }));

  app.post('/api/sales/invoices/:id/void', asyncRoute(async (req, res) => {
    const actor = await requireCan(req, res, 'sales', 'edit');
    if (!actor) return;
    const db = await connect();
    const id = oid(req.params.id);
    if (!id) return res.status(404).json({ error: 'No such invoice' });
    const invoices = db.collection(SALES_COLLECTIONS.invoices);
    const existing = await invoices.findOne({ _id: id });
    if (!existing) return res.status(404).json({ error: 'No such invoice' });
    if (existing.status === 'void') return res.json({ success: true, invoice: publicInvoice(existing) });

    await reverseInvoiceStock(db, existing, actor.user.email, 'Voided');
    await invoices.updateOne({ _id: id }, {
      $set: { status: 'void', voidedAt: new Date(), voidedBy: actor.user.email,
              voidReason: String(req.body.reason || '').slice(0, 300), stockApplied: [] }
    });
    res.json({ success: true, invoice: publicInvoice(await invoices.findOne({ _id: id })) });
  }));

  // ---- the workbook
  app.get('/api/reports/sales.xlsx', asyncRoute(async (req, res) => {
    if (!await requireCan(req, res, 'sales', 'view')) return;
    const db = await connect();
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month, 10) || null;
    const data = await salesReport.gather(db, year, month);
    const wb = await salesReport.build(data);
    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
      'attachment; filename="' + salesReport.filename(year, month) + '"');
    res.send(Buffer.from(await wb.xlsx.writeBuffer()));
  }));
}

module.exports = { mount, publicInvoice, publicCustomer, cleanInvoiceInput, PAYMENTS };
