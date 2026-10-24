/* The client's yearly sales workbook, generated from the database.
 *
 * Mirrors the file they keep by hand: twelve monthly sheets (Dec first, as
 * theirs are), a Stock sheet that carries each month's balance into the next,
 * a Monthly Report, and the customer price list. Everything that was a
 * formula in their file is a formula here too, so the download is still a
 * working spreadsheet, not a printout.
 *
 * The column layout is driven by the product list rather than fixed at five
 * products, so a new product simply appears as another price/qty pair.
 */
const ExcelJS = require('exceljs');
const { COLLECTIONS, SALES_COLLECTIONS } = require('./db');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FONT = 'Arial';
const HKD = '"HK$"#,###';
const DATE = 'd/m/yyyy;@';
const THIN = { style: 'thin', color: { argb: 'FF000000' } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const fill = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: argb } });
const GREY = fill('FFD9D9D9');
const YELLOW = fill('FFFFFF00');
const LILAC = fill('FFCC99FF');
const BLUE = fill('FF3333FF');

/* Column headers use the short names the client writes, not the full
   catalogue titles. A product may carry its own `short`; these are the
   fallbacks for the catalogue as it stands. */
const SHORT = {
  'WH-PSP-500': '雲芝', 'WH-PSP-060': '雲芝 (小瓶裝)', 'WH-T3-120': 'T3',
  'WH-PT3-090': 'PT3', 'WH-HB-180': '乙肝清', 'WH-MB-060': '憶活素'
};
const shortName = p => p.short || SHORT[p.sku] || p.title || p.sku;

function colLetter(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/* ---------------------------------------------------------------- gather
   Everything the workbook needs, read once. */
async function gather(db, year, month) {
  const products = (await db.collection(COLLECTIONS.products).find({}).sort({ pos: 1 }).toArray())
    .filter(p => p.sku);
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  const invoices = await db.collection(SALES_COLLECTIONS.invoices)
    .find({ date: { $gte: from, $lt: to }, status: { $ne: 'void' } })
    .sort({ date: 1, number: 1 }).toArray();
  const customers = await db.collection(SALES_COLLECTIONS.customers).find({}).sort({ name: 1 }).toArray();
  const movements = await db.collection(COLLECTIONS.movements).find({}).toArray();
  return { year: year, month: month, products: products, invoices: invoices,
           customers: customers, movements: movements, generatedAt: new Date() };
}

/* --------------------------------------------------------- month layout */
function layout(products) {
  const n = products.length;
  const L = { price: [], qty: [] };
  products.forEach((p, i) => { L.price.push(5 + 2 * i); L.qty.push(6 + 2 * i); });
  L.pay = 5 + 2 * n;
  L.total = 6 + 2 * n;
  L.rem = 7 + 2 * n;
  L.rem2 = 8 + 2 * n;
  L.firstRow = 4;
  return L;
}

function monthSheet(wb, name, products, invoices, opts) {
  const L = layout(products);
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 3, topLeftCell: 'A4' }] });
  const rowsNeeded = Math.max(80, invoices.length * 2 + 20);
  L.lastRow = L.firstRow + rowsNeeded - 1;
  const c = colLetter;
  const rng = (col, r1, r2) => c(col) + r1 + ':' + c(col) + r2;

  // widths, as the client's
  ws.getColumn(1).width = 13.86; ws.getColumn(2).width = 12.43; ws.getColumn(3).width = 16.14;
  ws.getColumn(4).width = 11.71;
  products.forEach((p, i) => { ws.getColumn(L.price[i]).width = 13.29; ws.getColumn(L.qty[i]).width = 8.29; });
  ws.getColumn(L.pay).width = 13.29; ws.getColumn(L.total).width = 14;
  ws.getColumn(L.rem).width = 16.71; ws.getColumn(L.rem2).width = 35;

  const bold = (cell, size) => { cell.font = { name: FONT, size: size || 12, bold: true }; };
  const set = (r, col, value) => { const cell = ws.getRow(r).getCell(col); cell.value = value; return cell; };

  // ---- rows 1-2: the month's totals
  bold(set(1, 1, '共發票'));
  const invoiceCount = set(1, 2, { formula: 'COUNT(' + rng(1, L.firstRow, L.lastRow) + ')' });
  invoiceCount.font = { name: FONT, size: 36, bold: true, color: { argb: 'FFC00000' } };
  ws.mergeCells('B1:B2');
  bold(set(2, 1, '張數:'));
  bold(set(1, 3, 'Total Amount this month')); ws.mergeCells('C1:D1');
  const lastAmountCol = L.qty[products.length - 1];
  const amountTotal = set(2, 3, { formula: 'SUM(' + c(L.price[0]) + '2:' + c(lastAmountCol) + '2)' });
  amountTotal.numFmt = HKD; amountTotal.fill = BLUE;
  amountTotal.font = { name: FONT, size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  ws.mergeCells('C2:D2');

  products.forEach((p, i) => {
    const label = set(1, L.price[i], shortName(p) + ' Total:');
    bold(label); label.fill = YELLOW;
    const bottles = set(1, L.qty[i], { formula: 'SUM(' + rng(L.qty[i], L.firstRow, L.lastRow) + ')' });
    bold(bottles); bottles.fill = LILAC;
    const amount = set(2, L.price[i], { formula: 'SUMPRODUCT(' + rng(L.price[i], L.firstRow, L.lastRow) +
      ',' + rng(L.qty[i], L.firstRow, L.lastRow) + ')' });
    amount.numFmt = HKD; amount.font = { name: FONT, size: 12 };
    ws.mergeCells(c(L.price[i]) + '2:' + c(L.qty[i]) + '2');
  });
  bold(set(1, L.pay, '付款方法')); ws.mergeCells(c(L.pay) + '1:' + c(L.pay) + '2');
  bold(set(1, L.total, 'Total Amount')); ws.mergeCells(c(L.total) + '1:' + c(L.total) + '2');
  bold(set(1, L.rem, 'Remarks')); ws.mergeCells(c(L.rem) + '1:' + c(L.rem2) + '2');

  // ---- row 3: the header
  const head = ['Invoice No.', '日期', '客戶', '電話'];
  products.forEach(p => { head.push(shortName(p) + '-單價'); head.push('Qty'); });
  head.push('', '', '', '');
  head.forEach((h, i) => {
    const cell = set(3, i + 1, h);
    cell.fill = GREY; cell.font = { name: FONT, size: 12, bold: true }; cell.border = BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  ws.mergeCells(c(L.rem) + '3:' + c(L.rem2) + '3');

  // ---- the invoices. One row per invoice; a product that appears twice on
  //      the same invoice (two prices) spills onto a continuation row with
  //      no invoice number, the way the client writes it.
  let r = L.firstRow;
  invoices.forEach(inv => {
    const perSku = {};
    (inv.lines || []).forEach(l => { (perSku[l.sku] = perSku[l.sku] || []).push(l); });
    const depth = Math.max(1, ...Object.values(perSku).map(a => a.length));
    for (let k = 0; k < depth; k++) {
      if (k === 0) {
        set(r, 1, inv.number);
        const d = set(r, 2, inv.date); d.numFmt = DATE;
        set(r, 3, inv.customerName || '');
        set(r, 4, inv.phone || '');
        set(r, L.pay, inv.payment || '');
        if (inv.remarks) { set(r, L.rem, inv.remarks); ws.mergeCells(c(L.rem) + r + ':' + c(L.rem2) + r); }
      } else {
        const d = set(r, 2, inv.date); d.numFmt = DATE;
        set(r, 3, inv.customerName || '');
      }
      products.forEach((p, i) => {
        const line = (perSku[p.sku] || [])[k];
        if (!line) return;
        set(r, L.price[i], line.price).numFmt = HKD;
        set(r, L.qty[i], line.qty);
      });
      r++;
    }
  });

  // ---- every data row: the row total as a formula, a payment dropdown
  const pairs = products.map((p, i) => c(L.price[i]) + '{r}*' + c(L.qty[i]) + '{r}').join('+');
  const qtys = products.map((p, i) => c(L.qty[i]) + '{r}').join(',');
  for (let row = L.firstRow; row <= L.lastRow; row++) {
    const cell = ws.getRow(row).getCell(L.total);
    cell.value = { formula: 'IF(SUM(' + qtys.replace(/\{r\}/g, row) + ')>0,' + pairs.replace(/\{r\}/g, row) + ',"")' };
    cell.numFmt = HKD;
    ws.getRow(row).getCell(2).numFmt = DATE;
    for (let col = 1; col <= L.rem2; col++) ws.getRow(row).getCell(col).font = { name: FONT, size: 10 };
    products.forEach((p, i) => { ws.getRow(row).getCell(L.price[i]).numFmt = HKD; });
  }
  ws.dataValidations.add(rng(L.pay, L.firstRow, L.lastRow), {
    type: 'list', allowBlank: true, formulae: ['"Cash,Cheque,Credit Card"']
  });
  ws.pageSetup = { paperSize: 9, orientation: 'portrait' };

  // the cells other sheets refer to
  return {
    name: name, layout: L,
    bottlesCell: i => "'" + name + "'!" + c(L.qty[i]) + '1',
    amountCell: i => "'" + name + "'!" + c(L.price[i]) + '2',
    totalCell: "'" + name + "'!C2"
  };
}

/* ------------------------------------------------------------ Stock sheet
   Per month: opening (= last month's balance), Used (= that month's bottles,
   pulled from the month sheet), each delivery received, then the balance. */
function stockSheet(wb, data, refs) {
  const { products, movements, year } = data;
  const ws = wb.addWorksheet('Stock', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.getColumn(1).width = 22.71; ws.getColumn(2).width = 22.71;
  products.forEach((p, i) => { ws.getColumn(3 + i).width = 22.71; });
  const c = colLetter;

  const head = ['Stocks Checking', 'MONTH'].concat(products.map(shortName));
  head.forEach((h, i) => {
    const cell = ws.getRow(1).getCell(i + 1); cell.value = h;
    cell.font = { name: FONT, size: 12, bold: true }; cell.fill = GREY; cell.border = BORDER;
  });

  // opening stock for January: today's count wound back through this year's movements
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const opening = products.map(p => {
    if (p.stock === undefined || p.stock === null || p.stock === '') return null;
    const delta = movements
      .filter(m => m.sku === p.sku && new Date(m.at) >= yearStart)
      .reduce((s, m) => s + (parseInt(m.delta, 10) || 0), 0);
    return (parseInt(p.stock, 10) || 0) - delta;
  });

  let r = 2;
  let prevBalanceRow = null;
  MONTHS.forEach((mon, mi) => {
    const openRow = r;
    ws.getRow(r).getCell(1).value = 'Stock available';
    ws.getRow(r).getCell(2).value = mon;
    ws.getRow(r).getCell(2).font = { name: FONT, bold: true };
    products.forEach((p, i) => {
      const cell = ws.getRow(r).getCell(3 + i);
      if (prevBalanceRow) cell.value = { formula: c(3 + i) + prevBalanceRow };
      else if (opening[i] !== null) cell.value = opening[i];
    });
    r++;
    ws.getRow(r).getCell(2).value = 'Used';
    products.forEach((p, i) => {
      ws.getRow(r).getCell(3 + i).value = { formula: '-' + refs[mi].bottlesCell(i) };
    });
    r++;
    // deliveries in this month
    const from = new Date(Date.UTC(year, mi, 1)), to = new Date(Date.UTC(year, mi + 1, 1));
    const received = movements
      .filter(m => m.type === 'receive' && !/^(Edited|Voided) invoice/.test(m.note || '') &&
        new Date(m.at) >= from && new Date(m.at) < to)
      .sort((a, b) => new Date(a.at) - new Date(b.at));
    const byDay = {};
    received.forEach(m => {
      const key = String(m.at).slice(0, 10);
      byDay[key] = byDay[key] || { note: '', qty: {} };
      byDay[key].qty[m.sku] = (byDay[key].qty[m.sku] || 0) + (parseInt(m.delta, 10) || 0);
      if (m.note && !byDay[key].note) byDay[key].note = m.note;
    });
    const days = Object.keys(byDay).sort();
    if (!days.length) { ws.getRow(r).getCell(2).value = '入貨   >>'; r++; }
    days.forEach(day => {
      ws.getRow(r).getCell(1).value = byDay[day].note;
      const d = ws.getRow(r).getCell(2); d.value = new Date(day + 'T00:00:00Z'); d.numFmt = DATE;
      products.forEach((p, i) => { if (byDay[day].qty[p.sku]) ws.getRow(r).getCell(3 + i).value = byDay[day].qty[p.sku]; });
      r++;
    });
    ws.getRow(r).getCell(2).value = 'Stock balance';
    ws.getRow(r).getCell(2).font = { name: FONT, bold: true };
    products.forEach((p, i) => {
      const cell = ws.getRow(r).getCell(3 + i);
      cell.value = { formula: 'SUM(' + c(3 + i) + openRow + ':' + c(3 + i) + (r - 1) + ')' };
      cell.font = { name: FONT, bold: true }; cell.fill = GREY;
    });
    prevBalanceRow = r;
    r += 2;
  });
}

/* --------------------------------------------------------- Monthly Report */
function monthlyReportSheet(wb, data, refs) {
  const { products } = data;
  const ws = wb.addWorksheet('Monthly Report');
  const c = colLetter;
  const head = ['MONTH'];
  products.forEach(p => { head.push(shortName(p)); head.push('Total Amount'); });
  head.push('Total');
  head.forEach((h, i) => {
    const cell = ws.getRow(1).getCell(i + 1); cell.value = h;
    cell.font = { name: FONT, size: 12, bold: true }; cell.fill = GREY; cell.border = BORDER;
    ws.getColumn(i + 1).width = i === 0 ? 15.71 : (i % 2 === 1 ? 15.71 : 12.71);
  });
  const totalCol = 2 + products.length * 2;
  MONTHS.forEach((mon, mi) => {
    const r = 2 + mi;
    ws.getRow(r).getCell(1).value = mon.toUpperCase();
    const amountCells = [];
    products.forEach((p, i) => {
      const b = refs[mi].bottlesCell(i), a = refs[mi].amountCell(i);
      ws.getRow(r).getCell(2 + 2 * i).value = { formula: 'IF(' + b + '>0,' + b + ',"")' };
      const amt = ws.getRow(r).getCell(3 + 2 * i);
      amt.value = { formula: 'IF(' + a + '>0,' + a + ',"--")' }; amt.numFmt = HKD;
      amountCells.push(c(3 + 2 * i) + r);
    });
    const t = ws.getRow(r).getCell(totalCol);
    t.value = { formula: 'IF(SUM(' + amountCells.join(',') + ')>0,SUM(' + amountCells.join(',') + '),"-- ")' };
    t.numFmt = HKD; t.font = { name: FONT, bold: true };
    for (let col = 1; col <= totalCol; col++) ws.getRow(r).getCell(col).border = BORDER;
  });
  const gr = 14;
  ws.getRow(gr).getCell(1).value = 'Grand Total';
  for (let col = 2; col <= totalCol; col++) {
    const cell = ws.getRow(gr).getCell(col);
    cell.value = { formula: 'SUBTOTAL(109,' + c(col) + '2:' + c(col) + '13)' };
    if (col % 2 === 1 || col === totalCol) cell.numFmt = HKD;
    cell.font = { name: FONT, bold: true }; cell.fill = GREY; cell.border = BORDER;
  }
  ws.getRow(gr).getCell(1).font = { name: FONT, bold: true };
  ws.getRow(gr).getCell(1).fill = GREY;
}

/* ------------------------------------------------------ customer prices */
function customersSheet(wb, data) {
  const { products, customers } = data;
  const ws = wb.addWorksheet('客戶名單及價格');
  const columns = [{ name: 'Name' }, { name: 'Phone' }].concat(products.map(p => ({ name: shortName(p) })));
  const rows = customers.map(cu => [cu.name || '', cu.phone || '']
    .concat(products.map(p => (cu.prices && cu.prices[p.sku] !== undefined) ? cu.prices[p.sku] : null)));
  if (!rows.length) rows.push(['', ''].concat(products.map(() => null)));
  ws.addTable({
    name: 'Customers', ref: 'A1', headerRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: columns, rows: rows
  });
  for (let i = 1; i <= columns.length; i++) ws.getColumn(i).width = 18.29;
}

/* ------------------------------------------------------------------ build */
async function build(data) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Wonder Herb Admin';
  wb.created = data.generatedAt || new Date();
  const byMonth = MONTHS.map(() => []);
  data.invoices.forEach(inv => { byMonth[new Date(inv.date).getUTCMonth()].push(inv); });

  if (data.month) {
    monthSheet(wb, MONTHS[data.month - 1], data.products, byMonth[data.month - 1]);
    return wb;
  }
  // Dec first, as in the client's file; refs are still indexed Jan=0
  const refs = [];
  for (let mi = 11; mi >= 0; mi--) refs[mi] = monthSheet(wb, MONTHS[mi], data.products, byMonth[mi]);
  stockSheet(wb, data, refs);
  monthlyReportSheet(wb, data, refs);
  customersSheet(wb, data);
  return wb;
}

function filename(year, month) {
  return month ? 'Sales report ' + MONTHS[month - 1] + ' ' + year + '.xlsx'
               : 'Sales report ' + year + '.xlsx';
}

module.exports = { gather, build, filename, layout, shortName, MONTHS };
