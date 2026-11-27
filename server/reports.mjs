const columns = ['Transaksi', 'Kasir', 'Metode', 'Status', 'Total (Rp)', 'Dicatat (WIB)', 'Dibayar (WIB)'];
const methods = { cash: 'Tunai', qris_static: 'QRIS Statis', qris_dynamic: 'QRIS Dinamis' };
const status = { paid: 'Lunas', pending: 'Menunggu', failed: 'Gagal' };
const formatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const money = amount => 'Rp' + amount.toLocaleString('id-ID');
const displayTime = value => value ? formatter.format(new Date(value)).replace('.', ':') : '—';

function reportRow(row) {
  return [row.id, row.employee, methods[row.method], status[row.status], row.amount,
    displayTime(row.created_at), displayTime(row.paid_at)];
}

function csvCell(value) {
  const string = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(string) ? "'" + string : string;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export async function salesReport(res, format, rows, details) {
  const range = details.from + ' – ' + details.to;
  const outlet = details.name + ' · ' + details.outlet;
  const revenue = rows.reduce((sum, row) => sum + (row.status === 'paid' ? row.amount : 0), 0);
  res.attachment('penjualan-kelola.' + format);

  if (format === 'csv') {
    res.type('text/csv; charset=utf-8');
    res.write('\uFEFFTransaksi,Kasir,Metode,Status,Total,Dicatat,Dibayar\r\n');
    for (const row of rows) {
      res.write([row.id, row.employee, row.method, row.status, row.amount, row.created_at, row.paid_at].map(csvCell).join(',') + '\r\n');
    }
    return res.end();
  }

  if (format === 'xlsx') {
    const { default: ExcelJS } = await import('exceljs');
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Penjualan', { views: [{ state: 'frozen', ySplit: 5 }] });
    sheet.columns = [22, 26, 17, 15, 17, 25, 25].map(width => ({ width }));
    sheet.mergeCells('A1:G1');
    sheet.getCell('A1').value = 'Laporan penjualan · Kelola';
    sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF2A5D48' } };
    sheet.addRow([outlet]);
    sheet.addRow([range, 'Pendapatan lunas', revenue]);
    sheet.getCell('C3').numFmt = '"Rp"#,##0';
    sheet.addRow([]);
    const head = sheet.addRow(columns);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A5D48' } };
    sheet.autoFilter = 'A5:G5';
    for (const row of rows) sheet.addRow(reportRow(row)).getCell(5).numFmt = '#,##0';
    return res.send(Buffer.from(await book.xlsx.writeBuffer()));
  }

  const { default: PDFDocument } = await import('pdfkit');
  const pdf = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, autoFirstPage: false });
  const sizes = [119, 126, 111, 86, 84, 119, 119];
  const left = 36;
  let y;
  res.type('application/pdf');
  pdf.pipe(res);

  function beginPage() {
    pdf.addPage();
    pdf.font('Helvetica-Bold').fontSize(20).fillColor('#285846').text('Laporan penjualan', left, 32);
    pdf.font('Helvetica').fontSize(11).fillColor('#445952').text(outlet, left, 61, { width: 765, ellipsis: true, lineBreak: false });
    pdf.fontSize(10).text(range + '  |  Pendapatan lunas: ' + money(revenue), left, 81);
    y = 108;
    pdf.roundedRect(left, y, sizes.reduce((sum, width) => sum + width, 0), 24, 5).fill('#285846');
    printCells(columns, '#ffffff', 'Helvetica-Bold');
  }

  function printCells(values, color, font) {
    let x = left;
    pdf.font(font).fontSize(9).fillColor(color);
    values.forEach((value, index) => {
      pdf.text(String(value), x + 5, y + 7, { width: sizes[index] - 10, height: 13, ellipsis: true });
      x += sizes[index];
    });
    y += 23;
  }

  beginPage();
  if (!rows.length) pdf.font('Helvetica').fontSize(11).fillColor('#445952').text('Tidak ada transaksi dalam filter ini.', left, y + 12);
  for (const [index, row] of rows.entries()) {
    if (y + 24 > pdf.page.height - 36) beginPage();
    if (index % 2 === 0) pdf.rect(left, y, sizes.reduce((sum, width) => sum + width, 0), 23).fill('#edf4ee');
    const values = reportRow(row);
    values[4] = money(row.amount);
    printCells(values, '#263e35', 'Helvetica');
  }
  pdf.end();
}
