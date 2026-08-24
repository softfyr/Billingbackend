import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

/**
 * 📊 Global Excel Exporter Utility
 * Generates professionally styled Excel files with brand headers, auto column width, number formatting, and HTTP stream piping.
 * 
 * @param {Object} res - Express Response Object
 * @param {Object} options - Export options { filename, sheetName, columns, data, summaryRows }
 */
export const exportToExcel = async (res, options = {}) => {
  const {
    filename = 'export_data',
    sheetName = 'Sheet1',
    columns = [],
    data = [],
    summaryRows = []
  } = options;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // 1. Define Columns with minimum width & auto calculation
  worksheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: Math.max(col.header.length + 5, col.width || 18)
  }));

  // 2. Style Header Row (Indigo Fill #4F46E5, White Bold Text)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 26;
  headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4F46E5' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // 3. Add Data Rows & Apply Auto Formatting
  data.forEach(item => {
    const row = worksheet.addRow(item);
    row.height = 20;
    row.alignment = { vertical: 'middle' };
  });

  // 4. Calculate Column Widths Dynamically
  worksheet.columns.forEach(column => {
    let maxLen = column.header ? column.header.length : 12;
    column.eachCell({ includeEmpty: true }, cell => {
      if (cell.value) {
        const valStr = cell.value.toString();
        if (valStr.length > maxLen) {
          maxLen = valStr.length;
        }
      }
    });
    column.width = Math.min(Math.max(maxLen + 4, 15), 45);
  });

  // 5. Add Summary Rows if provided
  if (summaryRows && summaryRows.length > 0) {
    worksheet.addRow([]); // Blank spacer row
    summaryRows.forEach(sRow => {
      const row = worksheet.addRow(sRow);
      row.font = { bold: true };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3F4F6' } };
    });
  }

  // 6. Set Response Headers & Pipe Stream
  const cleanFilename = `${filename}_${Date.now()}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);

  await workbook.xlsx.write(res);
  res.end();
};

/**
 * 📄 Global CSV Exporter Utility
 * Streams clean CSV formatted text data with proper HTTP headers.
 */
export const exportToCSV = (res, options = {}) => {
  const {
    filename = 'export_data',
    columns = [],
    data = []
  } = options;

  const headerLine = columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',');
  const dataLines = data.map(row => {
    return columns.map(c => {
      const val = row[c.key] !== undefined && row[c.key] !== null ? row[c.key] : '';
      return `"${val.toString().replace(/"/g, '""')}"`;
    }).join(',');
  });

  const csvContent = [headerLine, ...dataLines].join('\n');
  const cleanFilename = `${filename}_${Date.now()}.csv`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
  return res.send(csvContent);
};

/**
 * 📄 Global PDF Table Exporter Utility
 * Generates styled PDF table reports using PDFKit.
 */
export const exportToPDFTable = async (res, options = {}) => {
  const {
    filename = 'report',
    title = 'Data Report',
    businessName = 'SoftFYR Billing Platform',
    columns = [],
    data = [],
    summary = null
  } = options;

  const doc = new PDFDocument({ margin: 30, size: 'A4' });

  const cleanFilename = `${filename}_${Date.now()}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);

  doc.pipe(res);

  // Header Section
  doc.fontSize(18).text(businessName, { align: 'center' });
  doc.fontSize(12).fillColor('#6B7280').text(title, { align: 'center' });
  doc.moveDown(1.5);

  // Summary Metrics Section (if provided)
  if (summary && typeof summary === 'object') {
    doc.fontSize(10).fillColor('#111827');
    Object.entries(summary).forEach(([key, val]) => {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      doc.text(`${label}: ${val}`);
    });
    doc.moveDown(1);
  }

  // Table Headers
  doc.fontSize(9).fillColor('#1F2937');
  const headersStr = columns.map(c => c.header.padEnd(16)).join(' ');
  doc.text(headersStr);
  doc.text('-'.repeat(110));

  // Table Data Rows
  doc.fontSize(8).fillColor('#374151');
  data.forEach(row => {
    const lineStr = columns.map(c => {
      const val = row[c.key] !== undefined && row[c.key] !== null ? row[c.key].toString() : '';
      return val.substring(0, 15).padEnd(16);
    }).join(' ');
    doc.text(lineStr);
  });

  doc.end();
};
