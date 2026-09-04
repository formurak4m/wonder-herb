/* Sales: invoices, customers, the stock link, the importer and the workbook.
 * Real Express, real MongoDB, a throwaway database.   npm run test:sales
 */
process.env.MONGO_DB = process.env.MONGO_DB_TEST || 'wonderherb_test';
process.env.PORT = process.env.PORT_TEST || '4115';

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const app = require('../server/index');
const { connect, close, COLLECTIONS, AUTH_COLLECTIONS, SALES_COLLECTIONS } = require('../server/db');
const importer = require('../scripts/import-sales');

const BASE = 'http://localhost:' + process.env.PORT;
let fail = 0;
const check = (label, cond, extra) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '   -> ' + extra : ''));
  if (!cond) fail++;
};
const call = (method, p, body, token) => fetch(BASE + p, {
  method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: body === undefined ? undefined : JSON.stringify(body)
}).then(async r => ({ status: r.status, body: await r.json() }));
const post = (p, b, t) => call('POST', p, b, t), get = (p, t) => call('GET', p, undefined, t);
const patch = (p, b, t) => call('PATCH', p, b, t), del = (p, t) => call('DELETE', p, undefined, t);

(async () => {
  const db = await connect();
  for (const c of Object.values(COLLECTIONS)) await db.collection(c).deleteMany({});
  for (const c of Object.values(AUTH_COLLECTIONS)) await db.collection(c).deleteMany({});
  for (const c of Object.values(SALES_COLLECTIONS)) await db.collection(c).deleteMany({});
  const server = app.listen(Number(process.env.PORT));
  await new Promise(r => server.once('listening', r));

  const admin = (await post('/api/auth/signup', { name: 'Admin', email: 'a@example.com', password: 'suite-password', asAdmin: true })).body.token;
  await post('/api/cms?type=products', [
    { id: 1, sku: 'WH-A', title: 'Alpha', price: '100.00', status: 'In Stock', stock: 10, reorder: 2 },
    { id: 2, sku: 'WH-B', title: 'Beta', price: '250.00', status: 'In Stock' }          // not tracked
  ], admin);
  const stockOf = async sku => (await db.collection(COLLECTIONS.products).findOne({ sku })).stock;

  console.log('\n=== Customers ===\n');
  let r = await post('/api/sales/customers', { name: 'Test Customer', phone: '90000001', prices: { 'WH-A': 80, 'WH-NOPE': 1, 'WH-B': '' } }, admin);
  check('a customer can be added with their own prices', r.status === 201 && r.body.customer.prices['WH-A'] === 80);
  check('a price for a product that does not exist is dropped', !('WH-NOPE' in r.body.customer.prices));
  check('and a blank price is simply not a price', !('WH-B' in r.body.customer.prices));
  const custId = r.body.customer.id;
  check('a nameless customer is refused', (await post('/api/sales/customers', { phone: '1' }, admin)).status === 400);
  r = await patch('/api/sales/customers/' + custId, { name: 'Test Customer', phone: '90000001', prices: { 'WH-A': 85 } }, admin);
  check('a price can be changed', r.status === 200 && r.body.customer.prices['WH-A'] === 85);

  console.log('\n=== Entering an invoice ===\n');
  check('the next invoice number starts at 1001 in an empty book',
    (await get('/api/sales/invoices/next', admin)).body.number === 1001);
  r = await post('/api/sales/invoices', {
    number: 1214, date: '2026-07-02', customerId: custId, customerName: 'Test Customer', phone: '90000001',
    lines: [{ sku: 'WH-A', price: 85, qty: 2 }, { sku: 'WH-B', price: 250, qty: 1 }, { sku: '', qty: '' }],
    payment: 'Cheque', remarks: '代購石斛$800x2'
  }, admin);
  check('an invoice is saved', r.status === 201, JSON.stringify(r.body).slice(0, 120));
  check('with its total worked out', r.body.invoice.total === 420, String(r.body.invoice.total));
  check('an empty line on the form is ignored', r.body.invoice.lines.length === 2);
  check('the product name is filled in from the catalogue', r.body.invoice.lines[0].title === 'Alpha');
  check('it is paid unless said otherwise', r.body.invoice.status === 'paid');
  const invId = r.body.invoice.id;
  check('the next number follows on', (await get('/api/sales/invoices/next', admin)).body.number === 1215);

  console.log('\n=== The sale reaches the shelf ===\n');
  check('the tracked product lost 2', await stockOf('WH-A') === 8, String(await stockOf('WH-A')));
  check('the untracked product is left alone', await stockOf('WH-B') === undefined);
  const move = await db.collection(COLLECTIONS.movements).findOne({ sku: 'WH-A' });
  check('a stock movement records the invoice', move && move.type === 'sale' && /1214/.test(move.note), move && move.note);
  check('the invoice remembers what it took',
    JSON.stringify((await db.collection(SALES_COLLECTIONS.invoices).findOne({ number: 1214 })).stockApplied) === '[{"sku":"WH-A","qty":2}]');

  console.log('\n=== Validation ===\n');
  r = await post('/api/sales/invoices', { number: 1214, date: '2026-07-03', customerName: 'X', lines: [{ sku: 'WH-A', price: 1, qty: 1 }] }, admin);
  check('the same invoice number cannot be used twice', r.status === 409, r.body.error);
  check('and the failed attempt did not touch stock', await stockOf('WH-A') === 8);
  r = await post('/api/sales/invoices', { number: 1215, date: 'not a date', customerName: 'X', lines: [{ sku: 'WH-A', price: 1, qty: 1 }] }, admin);
  check('a bad date is refused', r.status === 400 && /date/i.test(r.body.error), r.body.error);
  r = await post('/api/sales/invoices', { number: 1215, date: '2026-07-03', customerName: 'X', lines: [] }, admin);
  check('an invoice needs a product', r.status === 400, r.body.error);
  r = await post('/api/sales/invoices', { number: 1215, date: '2026-07-03', customerName: 'X', lines: [{ sku: 'WH-ZZ', price: 1, qty: 1 }] }, admin);
  check('an unknown product is refused', r.status === 400 && /Unknown product/.test(r.body.error), r.body.error);
  r = await post('/api/sales/invoices', { number: 1215, date: '2026-07-03', customerName: 'X', lines: [{ sku: 'WH-A', price: 1, qty: 1 }], payment: 'Bitcoin' }, admin);
  check('payment must be one of the three', r.status === 400, r.body.error);

  console.log('\n=== Editing and voiding ===\n');
  r = await patch('/api/sales/invoices/' + invId, { lines: [{ sku: 'WH-A', price: 85, qty: 3 }], status: 'unpaid', remarks: '未付' }, admin);
  check('an invoice can be corrected', r.status === 200 && r.body.invoice.total === 255 && r.body.invoice.status === 'unpaid');
  check('and the shelf follows the corrected quantity (10 - 3)', await stockOf('WH-A') === 7, String(await stockOf('WH-A')));
  r = await post('/api/sales/invoices/' + invId + '/void', { reason: 'entered twice' }, admin);
  check('an invoice can be voided', r.status === 200 && r.body.invoice.status === 'void');
  check('which puts the stock back', await stockOf('WH-A') === 10, String(await stockOf('WH-A')));
  check('the record is kept, not deleted', await db.collection(SALES_COLLECTIONS.invoices).countDocuments({ number: 1214 }) === 1);
  check('a voided invoice cannot be edited', (await patch('/api/sales/invoices/' + invId, { remarks: 'x' }, admin)).status === 400);
  check('voiding twice is harmless', (await post('/api/sales/invoices/' + invId + '/void', {}, admin)).status === 200);
  check('a customer with invoices cannot be deleted', (await del('/api/sales/customers/' + custId, admin)).status === 400);

  console.log('\n=== Listing by month ===\n');
  await post('/api/sales/invoices', { number: 1215, date: '2026-07-14', customerName: 'Two Price Customer', lines: [{ sku: 'WH-B', price: 3000, qty: 2 }, { sku: 'WH-B', price: 2000, qty: 1 }] }, admin);
  await post('/api/sales/invoices', { number: 1216, date: '2026-08-01', customerName: 'Aug', lines: [{ sku: 'WH-B', price: 1, qty: 1 }] }, admin);
  let list = (await get('/api/sales/invoices?year=2026&month=7', admin)).body;
  check('July lists July only, voided included and flagged',
    list.length === 2 && list.every(i => i.date.startsWith('2026-07')) && list.some(i => i.status === 'void'), list.length + ' rows');
  list = (await get('/api/sales/invoices?year=2026', admin)).body;
  check('a year lists all of it', list.length === 3);

  console.log('\n=== Privileges ===\n');
  await post('/api/auth/users', { name: 'S', email: 's@example.com', password: 'staff-password', role: 'staff', permissions: { inventory: 'edit' } }, admin);
  const staff = (await post('/api/auth/login', { email: 's@example.com', password: 'staff-password' })).body.token;
  check('staff without a Sales tick cannot read invoices', (await get('/api/sales/invoices', staff)).status === 403);
  check('nor write one', (await post('/api/sales/invoices', { number: 9, date: '2026-07-01', customerName: 'x', lines: [{ sku: 'WH-A', price: 1, qty: 1 }] }, staff)).status === 403);
  check('nor download the workbook', (await fetch(BASE + '/api/reports/sales.xlsx?year=2026', { headers: { Authorization: 'Bearer ' + staff } })).status === 403);
  check('nobody reads it without signing in', (await get('/api/sales/invoices')).status === 401);
  check('sales is a module on the privilege list', 'sales' in (await get('/api/auth/me', staff)).body.user.permissions);
  const cms = await get('/api/cms?type=invoices');
  check('invoices are not content: not readable through the content API', cms.status === 404);

  console.log('\n=== The client\'s workbook can be imported ===\n');
  /* The workbook itself is not in this repository: it holds real customers,
     phone numbers and medical remarks, and the repository is public. When a
     copy is on this machine the importer is exercised against it; otherwise
     these checks are skipped. Nothing here names anyone - the assertions are
     about shape, not about people. */
  for (const c of Object.values(SALES_COLLECTIONS)) await db.collection(c).deleteMany({});
  await db.collection(COLLECTIONS.movements).deleteMany({});
  const catalogue = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'products.json'), 'utf8').replace(/^\ufeff/, ''));
  await post('/api/cms?type=products', catalogue, admin);
  const file = process.env.SALES_WORKBOOK || path.join(__dirname, '..', 'Sales report 31072026.xlsx');

  if (!fs.existsSync(file)) {
    console.log('  SKIP  no workbook on this machine; set SALES_WORKBOOK to exercise the importer');
    // stand-ins, so the workbook checks below still have rows to look at
    await post('/api/sales/customers', { name: 'Test Customer', phone: '90000001', prices: { [catalogue[0].sku]: 2800 } }, admin);
    await post('/api/sales/customers', { name: 'Two Price Customer', prices: { [catalogue[1].sku]: 3000 } }, admin);
    await post('/api/sales/invoices', { number: 1214, date: '2026-07-02', customerName: 'Test Customer',
      lines: [{ sku: catalogue[0].sku, price: 2800, qty: 1 }], payment: 'Cash' }, admin);
    await post('/api/sales/invoices', { number: 1217, date: '2026-07-14', customerName: 'Two Price Customer',
      lines: [{ sku: catalogue[1].sku, price: 3000, qty: 2 }, { sku: catalogue[1].sku, price: 2000, qty: 1 }] }, admin);
  } else {
    const summary = await importer.run(file, 2026, db);
    check('all twelve month sheets are read', Object.keys(summary.months).length === 12, JSON.stringify(summary.months));
    check('invoices are found in them', summary.invoices > 0, String(summary.invoices));
    const invoices = await db.collection(SALES_COLLECTIONS.invoices).find({}).toArray();
    check('every line amount is its price times its quantity',
      invoices.every(i => i.lines.every(l => Math.abs(l.amount - l.price * l.qty) < 0.001)));
    check('every invoice total is the sum of its lines',
      invoices.every(i => Math.abs(i.total - i.lines.reduce((s, l) => s + l.amount, 0)) < 0.001));
    const skus = new Set(catalogue.map(p => p.sku));
    check('every imported line is a catalogue product',
      invoices.flatMap(i => i.lines).every(l => skus.has(l.sku)));
    check('a second price for the same product joins the invoice above it',
      invoices.some(i => i.lines.length > 1 &&
        i.lines.some((l, n) => n > 0 && l.sku === i.lines[n - 1].sku && l.price !== i.lines[n - 1].price)));
    check('an unpaid marking in the remarks makes the invoice unpaid',
      invoices.filter(i => /\u672a\u4ed8/.test(i.remarks)).every(i => i.status === 'unpaid'));
    const custs = await db.collection(SALES_COLLECTIONS.customers).find({}).toArray();
    check('customers arrive with their own prices',
      custs.length > 0 && custs.some(c => Object.keys(c.prices).length >= 2));
    check('every customer price is against a real product',
      custs.every(c => Object.keys(c.prices).every(sku => skus.has(sku))));
    check('a column that is not one of our products is kept as a note, not invented as one',
      custs.some(c => /\u77f3\u659b/.test(c.notes || '')));
    check('imported sales do not move stock', await db.collection(COLLECTIONS.movements).countDocuments() === 0);
    const again = await importer.run(file, 2026, db);
    check('running the import twice adds nothing', again.invoices === 0 && again.customers === 0, JSON.stringify(again));
  }

  // the small-bottle mapping, on a row shaped the way the client's sheet
  // writes one, so it holds with or without the workbook
  const fake = { eachRow(fn){ fn({ getCell: n => ({ value: [null, 1300, new Date('2026-07-01'), 'Test', '', 700, 0, 2, null, 0, null, 0, null, 0, 'Cash', null, ''][n] }) }, 4); } };
  const small = importer.readMonth(fake, 6, 2026, { 'WH-PSP-060': { title: 'Small' } });
  check('the small-bottle quantity column becomes its own product at the large-bottle price',
    small.length === 1 && small[0].lines.length === 1 && small[0].lines[0].sku === 'WH-PSP-060' &&
    small[0].lines[0].price === 700 && small[0].lines[0].qty === 2, JSON.stringify(small[0] && small[0].lines));

  console.log('\n=== The generated workbook ===\n');
  const xres = await fetch(BASE + '/api/reports/sales.xlsx?year=2026', { headers: { Authorization: 'Bearer ' + admin } });
  check('the yearly workbook downloads', xres.status === 200 && /Sales report 2026\.xlsx/.test(xres.headers.get('content-disposition') || ''));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await xres.arrayBuffer()));
  check('with the client\'s sheets in the client\'s order',
    wb.worksheets.map(w => w.name).join(',') === 'Dec,Nov,Oct,Sep,Aug,Jul,Jun,May,Apr,Mar,Feb,Jan,Stock,Monthly Report,客戶名單及價格',
    wb.worksheets.map(w => w.name).join(','));
  const julWs = wb.getWorksheet('Jul');
  const f = (ws, ref) => { const v = ws.getCell(ref).value; return v && v.formula ? v.formula : v; };
  check('the invoice count is a live formula', f(julWs, 'B1') === 'COUNT(A4:A83)', String(f(julWs, 'B1')));
  check('so is each product\'s bottle total', f(julWs, 'F1') === 'SUM(F4:F83)');
  check('and its HK$ total', /^SUMPRODUCT\(E4:E83,F4:F83\)$/.test(String(f(julWs, 'E2'))), String(f(julWs, 'E2')));
  check('and the month\'s grand total', f(julWs, 'C2') === 'SUM(E2:P2)');
  check('the header row is the client\'s', julWs.getCell('A3').value === 'Invoice No.' && julWs.getCell('E3').value === '雲芝-單價' && julWs.getCell('C3').value === '客戶');
  check('the first July invoice is on row 4 with its customer and figures',
    julWs.getCell('A4').value === 1214 && typeof julWs.getCell('C4').value === 'string' &&
    julWs.getCell('C4').value.length > 0 && julWs.getCell('E4').value === 2800 && julWs.getCell('F4').value === 1);
  check('the row total is a formula', /^IF\(SUM\(F4/.test(String(f(julWs, 'R4'))), String(f(julWs, 'R4')).slice(0, 40));
  // one invoice, the same product at two prices: the second spills onto the
  // next row, which repeats the customer but carries no invoice number
  const contRow = [5, 6, 7, 8, 9, 10].find(n => julWs.getCell('A' + n).value === null && julWs.getCell('C' + n).value);
  check('a second price is a continuation row with no invoice number',
    !!contRow && julWs.getCell('C' + contRow).value === julWs.getCell('C' + (contRow - 1)).value, 'row ' + contRow);
  check('the header is frozen', julWs.views[0].state === 'frozen' && julWs.views[0].ySplit === 3);
  check('payment is a dropdown', JSON.stringify(julWs.dataValidations.model).includes('Cash,Cheque,Credit Card'));
  check('an empty month is still a proper sheet', f(wb.getWorksheet('Nov'), 'B1') === 'COUNT(A4:A83)' && wb.getWorksheet('Nov').getCell('A4').value === null);
  const st = wb.getWorksheet('Stock');
  check('Stock pulls Used from the month sheet', f(st, 'C3') === "-'Jan'!F1", String(f(st, 'C3')));
  check('and carries the balance into the next month', f(st, 'C7') === 'C5' && f(st, 'C5') === 'SUM(C2:C4)');
  const mr = wb.getWorksheet('Monthly Report');
  check('Monthly Report reads each month', f(mr, 'B8') === "IF('Jul'!F1>0,'Jul'!F1,\"\")", String(f(mr, 'B8')));
  check('with a grand total', f(mr, 'B14') === 'SUBTOTAL(109,B2:B13)');
  const cu = wb.getWorksheet('客戶名單及價格');
  check('the price list is a table with a row per customer', cu.getCell('A1').value === 'Name' && cu.rowCount === 1 + await db.collection(SALES_COLLECTIONS.customers).countDocuments());

  const mres = await fetch(BASE + '/api/reports/sales.xlsx?year=2026&month=7', { headers: { Authorization: 'Bearer ' + admin } });
  const mwb = new ExcelJS.Workbook();
  await mwb.xlsx.load(Buffer.from(await mres.arrayBuffer()));
  check('the month-only workbook is one sheet, named for the month',
    /Sales report Jul 2026\.xlsx/.test(mres.headers.get('content-disposition')) && mwb.worksheets.length === 1 && mwb.worksheets[0].name === 'Jul');
  check('with the same rows in it', mwb.getWorksheet('Jul').getCell('A4').value === 1214);

  server.close();
  for (const c of Object.values(COLLECTIONS)) await db.collection(c).deleteMany({});
  for (const c of Object.values(AUTH_COLLECTIONS)) await db.collection(c).deleteMany({});
  for (const c of Object.values(SALES_COLLECTIONS)) await db.collection(c).deleteMany({});
  await close();
  console.log('');
  console.log(fail === 0 ? '=== ALL CHECKS PASSED ===' : '=== ' + fail + ' CHECK(S) FAILED ===');
  process.exit(fail ? 1 : 0);
})().catch(err => { console.error('\nTest run failed:', err); process.exit(1); });
