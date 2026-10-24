/* One-off import of the client's hand-kept sales workbook into MongoDB.
 *
 *   npm run import:sales -- "Sales report 31072026.xlsx" 2026
 *
 * Reads the twelve monthly sheets into invoices and 客戶名單及價格 into
 * customers. Safe to re-run: an invoice number that already exists is left
 * alone, and a customer is matched by name. Nothing here touches stock -
 * these sales happened before stock was being counted.
 */
const path = require('path');
const ExcelJS = require('exceljs');
const { connect, close, SALES_COLLECTIONS, ensureSalesIndexes } = require('../server/db');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* The client's fixed columns, mapped to the catalogue. The small bottle is
   a quantity column under 雲芝 in their sheet, sharing its price column;
   here it is its own product. */
const COLS = {
  number: 1, date: 2, customer: 3, phone: 4,
  psp: { price: 5, qty: 6 }, small: { price: 5, qty: 7 },
  t3: { price: 8, qty: 9 }, pt3: { price: 10, qty: 11 }, hb: { price: 12, qty: 13 },
  payment: 14, total: 15, remarks: 16
};
const SKU = { psp: 'WH-PSP-500', small: 'WH-PSP-060', t3: 'WH-T3-120', pt3: 'WH-PT3-090', hb: 'WH-HB-180' };
const PRICE_COLS = { 3: 'WH-PSP-500', 5: 'WH-T3-120', 6: 'WH-PT3-090', 7: 'WH-HB-180' }; // 客戶名單: C, E, F, G (D is 石斛)

const text = v => (v === null || v === undefined) ? '' :
  (typeof v === 'object' && v.richText ? v.richText.map(t => t.text).join('') :
   typeof v === 'object' && v.result !== undefined ? String(v.result) : String(v)).trim();
const num = v => {
  if (v && typeof v === 'object' && v.result !== undefined) v = v.result;
  const n = parseFloat(v); return isNaN(n) ? 0 : n;
};
function asDate(v, year) {
  if (v instanceof Date) return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  const n = num(v);
  if (n > 20000) { const d = new Date(Math.round((n - 25569) * 86400000)); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
  return null;
}

function readMonth(ws, mi, year, products) {
  const invoices = [];
  let current = null;
  ws.eachRow((row, r) => {
    if (r < 4 || r > 118) return;                 // rows 119+ are the hidden calc block
    const number = parseInt(num(row.getCell(COLS.number).value), 10);
    const customer = text(row.getCell(COLS.customer).value);
    const lines = [];
    ['psp', 'small', 't3', 'pt3', 'hb'].forEach(key => {
      const qty = parseInt(num(row.getCell(COLS[key].qty).value), 10);
      if (!(qty > 0)) return;
      const price = num(row.getCell(COLS[key].price).value);
      const title = (products[SKU[key]] || {}).title || SKU[key];
      lines.push({ sku: SKU[key], title: title, price: price, qty: qty, amount: Math.round(price * qty * 100) / 100 });
    });
    if (!number && !customer && !lines.length) return;

    if (number > 0) {
      current = {
        number: number,
        date: asDate(row.getCell(COLS.date).value, year) || new Date(Date.UTC(year, mi, 1)),
        customerName: customer,
        phone: text(row.getCell(COLS.phone).value),
        lines: lines,
        payment: text(row.getCell(COLS.payment).value),
        remarks: text(row.getCell(COLS.remarks).value),
        status: 'paid'
      };
      invoices.push(current);
    } else if (current && lines.length) {
      // a continuation row: same invoice, another line at a second price
      current.lines = current.lines.concat(lines);
      const more = text(row.getCell(COLS.remarks).value);
      if (more && current.remarks.indexOf(more) === -1) current.remarks = (current.remarks + ' ' + more).trim();
    }
  });
  invoices.forEach(inv => {
    inv.total = Math.round(inv.lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
    if (/未付/.test(inv.remarks)) inv.status = 'unpaid';
  });
  return invoices;
}

function readCustomers(ws) {
  const out = [];
  ws.eachRow((row, r) => {
    if (r < 2) return;
    const name = text(row.getCell(1).value);
    if (!name) return;
    const prices = {};
    Object.keys(PRICE_COLS).forEach(col => {
      const v = num(row.getCell(Number(col)).value);
      if (v > 0) prices[PRICE_COLS[col]] = v;
    });
    const notes = [];
    const dendrobium = num(row.getCell(4).value);
    if (dendrobium > 0) notes.push('石斛: ' + dendrobium);
    out.push({ name: name, phone: text(row.getCell(2).value), prices: prices, notes: notes.join(' ') });
  });
  return out;
}

async function run(file, year, db) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const productDocs = await db.collection('products').find({}, { projection: { sku: 1, title: 1 } }).toArray();
  const products = {};
  productDocs.forEach(p => { if (p.sku) products[p.sku] = p; });
  await ensureSalesIndexes(db);

  const invoices = db.collection(SALES_COLLECTIONS.invoices);
  const customers = db.collection(SALES_COLLECTIONS.customers);
  const summary = { invoices: 0, skipped: 0, customers: 0, customersUpdated: 0, months: {} };

  // customers first, so invoices can point at them
  const sheetCustomers = wb.getWorksheet('客戶名單及價格');
  const known = {};
  if (sheetCustomers) {
    for (const cu of readCustomers(sheetCustomers)) {
      const existing = known[cu.name] || await customers.findOne({ name: cu.name });
      if (existing) {
        // the same person listed twice: keep the first, fill in any gaps
        const merged = Object.assign({}, cu.prices, existing.prices || {});
        await customers.updateOne({ _id: existing._id }, { $set: { prices: merged, phone: existing.phone || cu.phone } });
        known[cu.name] = Object.assign(existing, { prices: merged });
        summary.customersUpdated++;
      } else {
        const doc = Object.assign({}, cu, { createdAt: new Date(), createdBy: 'import:' + path.basename(file) });
        const r = await customers.insertOne(doc);
        doc._id = r.insertedId;
        known[cu.name] = doc;
        summary.customers++;
      }
    }
  }

  for (let mi = 0; mi < 12; mi++) {
    const ws = wb.getWorksheet(MONTHS[mi]);
    if (!ws) continue;
    const found = readMonth(ws, mi, year, products);
    summary.months[MONTHS[mi]] = found.length;
    for (const inv of found) {
      if (await invoices.findOne({ number: inv.number })) { summary.skipped++; continue; }
      let cu = known[inv.customerName] || (inv.customerName ? await customers.findOne({ name: inv.customerName }) : null);
      if (!cu && inv.customerName) {
        const prices = {};
        inv.lines.forEach(l => { prices[l.sku] = l.price; });
        cu = { name: inv.customerName, phone: inv.phone, prices: prices, notes: '',
               createdAt: new Date(), createdBy: 'import:' + path.basename(file) };
        cu._id = (await customers.insertOne(cu)).insertedId;
        known[inv.customerName] = cu;
        summary.customers++;
      }
      await invoices.insertOne(Object.assign(inv, {
        customerId: cu ? cu._id : null,
        source: 'import',
        importedFrom: path.basename(file),
        stockApplied: [],
        createdAt: new Date(),
        createdBy: 'import'
      }));
      summary.invoices++;
    }
  }
  return summary;
}

module.exports = { run, readMonth, readCustomers };

if (require.main === module) {
  const file = process.argv[2];
  const year = parseInt(process.argv[3], 10) || new Date().getFullYear();
  if (!file) {
    console.error('Usage: npm run import:sales -- "<workbook.xlsx>" <year>');
    process.exit(1);
  }
  (async () => {
    const db = await connect();
    const s = await run(path.resolve(file), year, db);
    console.log('Imported ' + s.invoices + ' invoice(s), skipped ' + s.skipped + ' already present.');
    console.log('Customers: ' + s.customers + ' new, ' + s.customersUpdated + ' merged.');
    console.log('Per month: ' + Object.keys(s.months).map(m => m + ' ' + s.months[m]).join(', '));
    await close();
  })().catch(err => { console.error('Import failed:', err.message); process.exit(1); });
}
