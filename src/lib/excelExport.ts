'use client';

/**
 * Universal Excel Export Engine for Al-Waseet B2B
 * Generates multi-sheet XML Spreadsheet (.xls) and UTF-8 BOM (.csv) files
 * with full Arabic RTL support, styled headers, and automatic numeric formatting.
 */

export interface ExcelSheetData {
  sheetName: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}

function escapeXml(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet1';
}

/**
 * Exports one or multiple sheets into a styled, RTL Microsoft Excel (.xls) workbook.
 */
export function exportWorkbookToExcel(filenamePrefix: string, sheets: ExcelSheetData[]) {
  if (typeof window === 'undefined' || sheets.length === 0) return;

  const worksheetsXml = sheets
    .map((sheet) => {
      const safeName = escapeXml(sanitizeSheetName(sheet.sheetName));

      const headerCells = sheet.headers
        .map(
          (h) =>
            `<Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`
        )
        .join('');

      const bodyRows = sheet.rows
        .map((row) => {
          const cells = row
            .map((cell) => {
              const isNum =
                typeof cell === 'number' && !Number.isNaN(cell) && Number.isFinite(cell);
              const type = isNum ? 'Number' : 'String';
              const style = isNum ? 'NumberStyle' : 'CellStyle';
              return `<Cell ss:StyleID="${style}"><Data ss:Type="${type}">${escapeXml(
                cell
              )}</Data></Cell>`;
            })
            .join('');
          return `<Row ss:Height="22">${cells}</Row>`;
        })
        .join('\n');

      const columnsDef = sheet.headers
        .map(() => `<Column ss:AutoFitWidth="1" ss:Width="135"/>`)
        .join('');

      return `
  <Worksheet ss:Name="${safeName}" ss:RightToLeft="1">
    <Table ss:DefaultColumnWidth="130" ss:DefaultRowHeight="22">
      ${columnsDef}
      <Row ss:Height="28">
        ${headerCells}
      </Row>
      ${bodyRows}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <DisplayRightToLeft/>
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>1</SplitHorizontal>
      <TopRowBottomPane>1</TopRowBottomPane>
      <ActivePane>2</ActivePane>
    </WorksheetOptions>
  </Worksheet>`;
    })
    .join('\n');

  const workbookXml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center" ss:Horizontal="Right" ss:ReadingOrder="RightToLeft"/>
      <Font ss:FontName="Segoe UI" ss:Size="11" ss:Color="#0F172A"/>
    </Style>
    <Style ss:ID="HeaderStyle">
      <Alignment ss:Vertical="Center" ss:Horizontal="Center" ss:ReadingOrder="RightToLeft"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#047857"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#065F46"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#065F46"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#065F46"/>
      </Borders>
      <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#059669" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="CellStyle">
      <Alignment ss:Vertical="Center" ss:Horizontal="Right" ss:ReadingOrder="RightToLeft"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>
    </Style>
    <Style ss:ID="NumberStyle">
      <Alignment ss:Vertical="Center" ss:Horizontal="Center" ss:ReadingOrder="RightToLeft"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
    </Style>
  </Styles>
  ${worksheetsXml}
</Workbook>`;

  const blob = new Blob(['\uFEFF' + workbookXml], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${filenamePrefix}_${dateStr}.xls`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Convenience helper to export a single table/sheet to Excel (.xls)
 */
export function exportSingleSheetToExcel(
  filenamePrefix: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) {
  exportWorkbookToExcel(filenamePrefix, [{ sheetName, headers, rows }]);
}

/**
 * Extracts all visible HTML `<table>` elements inside the current page's `<main>` container
 * and exports them into an Excel (.xls) workbook.
 */
export function exportVisibleTablesFromDOM(filenamePrefix = 'تقرير_الصفحة') {
  if (typeof window === 'undefined') return false;
  const mainEl = document.querySelector('main') || document.body;
  const tables = Array.from(mainEl.querySelectorAll('table'));

  if (tables.length === 0) return false;

  const sheets: ExcelSheetData[] = [];

  tables.forEach((table, idx) => {
    const headerEls = Array.from(table.querySelectorAll('thead th'));
    const headers = headerEls
      .map((th) => (th.textContent || '').trim())
      .filter((h) => h && h !== 'الإجراءات' && h !== 'إجراءات');

    const bodyRows = Array.from(table.querySelectorAll('tbody tr')).map((tr) => {
      const tds = Array.from(tr.querySelectorAll('td'));
      // Exclude action column if header was excluded
      const sliceLen = headers.length > 0 ? headers.length : tds.length;
      return tds.slice(0, sliceLen).map((td) => {
        const txt = (td.textContent || '').replace(/\s+/g, ' ').trim();
        return txt;
      });
    });

    if (headers.length > 0 || bodyRows.length > 0) {
      sheets.push({
        sheetName: `جدول_${idx + 1}`,
        headers: headers.length > 0 ? headers : ['البيان'],
        rows: bodyRows,
      });
    }
  });

  if (sheets.length === 0) return false;
  exportWorkbookToExcel(filenamePrefix, sheets);
  return true;
}
