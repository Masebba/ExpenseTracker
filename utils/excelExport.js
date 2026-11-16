import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const cleanXmlString = (value) => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const xmlCell = (value, styleId) => {
  const style = styleId ? ` ss:StyleID="${styleId}"` : '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<Cell${style}><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  if (typeof value === 'boolean') {
    return `<Cell${style}><Data ss:Type="Boolean">${value ? 1 : 0}</Data></Cell>`;
  }
  return `<Cell${style}><Data ss:Type="String">${cleanXmlString(value)}</Data></Cell>`;
};

/** Build a multi-sheet Excel 2003 XML workbook. Excel and most spreadsheet apps open it directly. */
export function buildExcelXmlWorkbook(sheets) {
  const worksheets = sheets.map((sheet) => {
    const rows = [sheet.headers || [], ...(sheet.rows || [])];
    const xmlRows = rows.map((row, index) => `<Row>${row.map((value) => xmlCell(value, index === 0 ? 'Header' : undefined)).join('')}</Row>`).join('');
    const safeName = String(sheet.name || 'Report').replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Report';
    return `<Worksheet ss:Name="${cleanXmlString(safeName)}"><Table>${xmlRows}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions></Worksheet>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">
<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Title>FinanceTracker Detailed Report</Title><Author>FinanceTracker</Author><Created>${new Date().toISOString()}</Created></DocumentProperties>
<Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="10"/><Interior/></Style><Style ss:ID="Header"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#2F7040" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style></Styles>
${worksheets}</Workbook>`;
}

export async function shareExcelXmlWorkbook({ filename, sheets, dialogTitle = 'Share FinanceTracker Excel report' }) {
  if (!FileSystem.documentDirectory) throw new Error('File storage is unavailable on this device.');
  const safeName = String(filename || 'FinanceTracker-Report').replace(/[^a-zA-Z0-9_-]/g, '-');
  const uri = `${FileSystem.documentDirectory}${safeName}.xls`;
  await FileSystem.writeAsStringAsync(uri, buildExcelXmlWorkbook(sheets), { encoding: FileSystem.EncodingType.UTF8 });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(`The Excel report was created at ${uri}, but this device does not have an available sharing service.`);
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/vnd.ms-excel',
    dialogTitle,
    UTI: 'com.microsoft.excel.xls',
  });
  return uri;
}
