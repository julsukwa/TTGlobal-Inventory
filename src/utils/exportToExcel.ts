// ─── Excel export utility ───────────────────────────────────────────────────
//
// Shared formatter for the "Export Excel" buttons on DatabasePage/InventoryPage.
//
// Uses xlsx-js-style rather than plain xlsx: the standard SheetJS Community
// Edition package parses/reads cell styles but silently drops any style you
// assign before writeFile — cell fills, font color and bold only persist in
// the paid Pro version. xlsx-js-style is a community fork that restores
// writing basic cell styles (fill/font/alignment) while keeping the same
// utils/write API, so it's a drop-in replacement for that one need.
//
// Freeze panes are a separate limitation neither package solves: writing a
// <pane> element (the OOXML markup a frozen header row needs) is *also*
// Pro-only in SheetJS CE, and xlsx-js-style doesn't add it back the way it
// does for styles — the `!freeze` worksheet property is silently a no-op on
// write in both packages. Since an .xlsx file is just a zip of XML parts,
// this works around it by re-opening the just-written file with JSZip and
// injecting the freeze-pane XML into the sheet directly (see
// freezeHeaderRow below) before triggering the download.

import * as XLSX from "xlsx-js-style";
import JSZip from "jszip";

export interface ExportToExcelOptions {
  headers: string[];
  rows: (string | number)[][];
  columnWidths: number[];
  /** 0-based column indexes that render bold in every data row. */
  boldColumns: number[];
  filename: string;
  sheetName?: string;
}

const HEADER_FILL = "4472C4";
const HEADER_FONT_COLOR = "FFFFFF";
const ODD_ROW_FILL = "FFFFFF";
const EVEN_ROW_FILL = "EBF3FB";

const HEADER_ROW_HEIGHT_PT = 20;
const DATA_ROW_HEIGHT_PT = 15;

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Shared column layout for the Database/Inventory stock exports — kept here
// so both pages stay byte-for-byte identical, matching the company's
// existing stock file formatting.
export const STOCK_EXPORT_HEADERS = [
  "LIST #", "TYPE", "CONDITION", "ASSETID", "BRAND", "MODEL", "CPU", "GEN",
  "SPEED", "RAM", "HDD", "COMMENT", "STATUS", "FAULT TYPES",
];
export const STOCK_EXPORT_COLUMN_WIDTHS = [12, 11, 17, 15, 13, 28, 20, 10, 13, 10, 10, 25, 12, 35];
export const STOCK_EXPORT_BOLD_COLUMNS = [5, 6]; // MODEL, CPU

/** Today's date as DD-MM-YYYY, for export filenames. */
export function todayForFilename(): string {
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export async function exportToExcel({
  headers,
  rows,
  columnWidths,
  boldColumns,
  filename,
  sheetName = "Sheet1",
}: ExportToExcelOptions): Promise<void> {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const boldColumnSet = new Set(boldColumns);

  headers.forEach((_, colIndex) => {
    const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: colIndex })];
    if (!cell) return;
    cell.s = {
      fill: { patternType: "solid", fgColor: { rgb: HEADER_FILL } },
      font: { bold: true, color: { rgb: HEADER_FONT_COLOR }, sz: 11 },
      alignment: { horizontal: "center", vertical: "center" },
    };
  });

  rows.forEach((row, rowIndex) => {
    const rowFill = rowIndex % 2 === 0 ? ODD_ROW_FILL : EVEN_ROW_FILL;
    row.forEach((_, colIndex) => {
      const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex })];
      if (!cell) return;
      cell.s = {
        fill: { patternType: "solid", fgColor: { rgb: rowFill } },
        font: { bold: boldColumnSet.has(colIndex) },
      };
    });
  });

  worksheet["!cols"] = columnWidths.map((wch) => ({ wch }));
  worksheet["!rows"] = [
    { hpt: HEADER_ROW_HEIGHT_PT },
    ...rows.map(() => ({ hpt: DATA_ROW_HEIGHT_PT })),
  ];

  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: rows.length, c: headers.length - 1 },
    }),
  };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = await freezeHeaderRow(arrayBuffer);

  downloadBlob(blob, filename);
}

/** Injects OOXML freeze-pane markup into the workbook's first (only) sheet —
 * see the module comment above for why this can't be done via the SheetJS
 * worksheet API directly. Falls back to the unpatched file if the sheet
 * can't be found, so a freeze-pane failure never blocks the download. */
async function freezeHeaderRow(arrayBuffer: ArrayBuffer): Promise<Blob> {
  const sheetPath = "xl/worksheets/sheet1.xml";

  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const sheetFile = zip.file(sheetPath);
    if (!sheetFile) return new Blob([arrayBuffer], { type: XLSX_MIME });

    const xml = await sheetFile.async("string");
    const pane =
      '<pane xSplit="0" ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
      '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>';

    const selfClosingSheetView = /<sheetView([^>]*)\/>/;
    const openSheetView = /(<sheetView[^>]*>)/;

    const patchedXml = selfClosingSheetView.test(xml)
      ? xml.replace(selfClosingSheetView, `<sheetView$1>${pane}</sheetView>`)
      : openSheetView.test(xml)
        ? xml.replace(openSheetView, `$1${pane}`)
        : xml;

    zip.file(sheetPath, patchedXml);
    const patchedArrayBuffer = await zip.generateAsync({ type: "arraybuffer" });
    return new Blob([patchedArrayBuffer], { type: XLSX_MIME });
  } catch {
    return new Blob([arrayBuffer], { type: XLSX_MIME });
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
