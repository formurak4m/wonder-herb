/* Spreadsheet reports for the admin.
 *
 * The inventory report follows the layout the client already keeps by hand:
 * a numbered list with SKU, product name, retail price and bottles on hand,
 * a grey bold header row, thin borders, and the same column widths. It is
 * built from MongoDB at the moment it is asked for, so it is never stale.
 */
const ExcelJS = require('exceljs');

const THIN = { style: 'thin', color: { argb: 'FF000000' } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };

/* `products` in the order the editor shows them. Untracked stock is left
   blank rather than written as 0, which would read as sold out. */
async function inventoryWorkbook(products, generatedAt) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Wonder Herb Admin';
  wb.created = generatedAt || new Date();

  const ws = wb.addWorksheet('Inventory', { views: [{ showGridLines: true }] });
  ws.columns = [
    { key: 'n', width: 4.14 },
    { key: 'sku', width: 14 },
    { key: 'title', width: 34 },
    { key: 'price', width: 18.43 },
    { key: 'stock', width: 17.57 }
  ];

  // row 1 is left empty, as in the client's own sheet
  const head = ws.getRow(2);
  head.values = ['', 'SKU', 'Product Name', 'Retail Price (HK$)', 'Inventory (bottle)'];
  head.font = { bold: true };
  for (let c = 2; c <= 5; c++) {
    const cell = head.getCell(c);
    cell.fill = HEADER_FILL;
    cell.border = BORDER;
    cell.alignment = { vertical: 'middle', horizontal: c === 3 ? 'left' : 'center' };
  }
  head.getCell(1).border = BORDER;

  products.forEach((p, i) => {
    const tracked = p.stock !== undefined && p.stock !== null && p.stock !== '';
    const row = ws.getRow(3 + i);
    row.values = [
      i + 1,
      p.sku || '',
      p.title || '',
      Number(parseFloat(p.price) || 0),
      tracked ? Number(parseInt(p.stock, 10) || 0) : null
    ];
    for (let c = 1; c <= 5; c++) row.getCell(c).border = BORDER;
    row.getCell(4).numFmt = '#,##0.00';
    row.getCell(5).numFmt = '#,##0';
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).alignment = { horizontal: 'center' };
  });

  return wb;
}

function inventoryFilename(date) {
  const d = date || new Date();
  const stamp = d.toISOString().slice(0, 10);
  return 'Inventory report ' + stamp + '.xlsx';
}

module.exports = { inventoryWorkbook, inventoryFilename };
