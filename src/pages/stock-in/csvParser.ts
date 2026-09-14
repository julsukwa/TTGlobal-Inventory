// ─── CSV Parser & Validator ────────────────────────────────────────────────────

import * as XLSX from "xlsx";
import {
  CSV_REQUIRED_COLUMNS,
  type CsvColumn,
  type CsvUploadType,
  type RawCsvRow,
  type ValidatedCsvRow,
  type CsvValidationResult,
} from "./csvImportTypes";

const VALID_COMMENT_VALUES = ["Non-Touch", "Touch Screen"];

/** Strips spaces, hyphens, and underscores and lowercases — so "TouchScreen",
 * "Touch-Screen", "touch_screen", and "Touch Screen" all normalise to the
 * same key and match correctly. */
function normaliseCommentKey(value: string): string {
  return value.toLowerCase().replace(/[\s\-_]/g, "");
}

const COMMENT_LOOKUP: Record<string, string> = {};
VALID_COMMENT_VALUES.forEach((v) => {
  COMMENT_LOOKUP[normaliseCommentKey(v)] = v;
});

const VALID_CATEGORY_VALUES = ["Laptop", "Desktop", "All In One", "Workstation", "LCD"];
const VALID_CONDITION_VALUES = ["New", "Refurb", "Used"];

function isLCDCategory(category: string): boolean {
  return category.trim().toLowerCase() === "lcd";
}

// ── Header normalisation ─────────────────────────────────────────────────────

/** Normalises a header cell for forgiving matching (case/space-insensitive). */
function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "");
}

function buildHeaderLookup(columns: readonly string[]): Record<string, string> {
  const lookup: Record<string, string> = {};
  columns.forEach((col) => {
    lookup[normaliseHeader(col)] = col;
  });
  return lookup;
}

// One lookup per upload type — the two column sets differ (Asset ID is only
// required for detailed uploads), so header matching has to be aware of
// which flow the file is being imported through.
const HEADER_LOOKUPS: Record<CsvUploadType, Record<string, string>> = {
  summary: buildHeaderLookup(CSV_REQUIRED_COLUMNS("summary")),
  detailed: buildHeaderLookup(CSV_REQUIRED_COLUMNS("detailed")),
};

// ── CSV line splitting (handles simple quoted commas) ───────────────────────

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);

  return result.map((cell) => cell.trim());
}

// ── Parsing ───────────────────────────────────────────────────────────────────

export interface ParsedCsv {
  rows: RawCsvRow[];
  fileLevelErrors: string[];
  columnMap: Record<string, number> | null; // maps known column -> index, or null if header invalid
}

/** Shared row-building logic: given a header row and data rows as 2D string
 * arrays, validates the header and converts data rows into RawCsvRow[]. Used
 * by both the CSV text parser and the XLSX sheet parser so a single set of
 * column-matching rules applies regardless of source format. */
function buildRowsFromCells(
  headerCells: string[],
  dataRows: string[][],
  uploadType: CsvUploadType
): ParsedCsv {
  const fileLevelErrors: string[] = [];
  const columnMap: Record<string, number> = {};
  const headerLookup = HEADER_LOOKUPS[uploadType];

  headerCells.forEach((cell, index) => {
    const normalised = normaliseHeader(cell);
    const matched = headerLookup[normalised];
    if (matched) {
      columnMap[matched] = index;
    }
  });

  // Required column validation — every column for this upload type must be present
  const requiredColumns = CSV_REQUIRED_COLUMNS(uploadType);
  const missingColumns = requiredColumns.filter((col) => !(col in columnMap));

  if (missingColumns.length > 0) {
    fileLevelErrors.push(
      `Missing required column${missingColumns.length > 1 ? "s" : ""}: ${missingColumns.join(
        ", "
      )}.`
    );
    return { rows: [], fileLevelErrors, columnMap: null };
  }

  if (dataRows.length === 0) {
    fileLevelErrors.push("The file contains a header row but no data rows.");
    return { rows: [], fileLevelErrors, columnMap };
  }

  const rows: RawCsvRow[] = dataRows.map((cells, idx) => {
    const getCell = (col: CsvColumn) => (cells[columnMap[col]] ?? "").trim();

    return {
      // +2 because idx is 0-based over data rows only, and the header row
      // itself occupies line 1 of the file. This makes rowNumber match what
      // the admin actually sees when counting rows in Excel or a text editor
      // (header = row 1, first data row = row 2), instead of silently
      // treating the first data row as "row 1" and shifting every reported
      // row number down by one relative to the real file.
      rowNumber: idx + 2,
      listNumber: getCell("List Number"),
      assetId: uploadType === "detailed" ? getCell("Asset ID") : "",
      uploadType,
      category: getCell("Category"),
      condition: getCell("Condition"),
      brand: getCell("Brand"),
      model: getCell("Model"),
      processor: getCell("Processor"),
      generation: getCell("Generation"),
      ram: getCell("RAM"),
      storage: getCell("Storage"),
      speed: getCell("Speed"),
      comment: getCell("Comment"),
      quantity: getCell("Quantity"),
    };
  });

  return { rows, fileLevelErrors, columnMap };
}

export function parseCsvText(text: string, uploadType: CsvUploadType): ParsedCsv {
  // Normalise line endings, strip BOM, drop fully empty lines
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return {
      rows: [],
      fileLevelErrors: ["The uploaded file is empty or could not be read."],
      columnMap: null,
    };
  }

  const headerCells = splitCsvLine(lines[0]);
  const dataRows = lines.slice(1).map((line) => splitCsvLine(line));

  return buildRowsFromCells(headerCells, dataRows, uploadType);
}

/** Parses an uploaded .xlsx/.xls file's first sheet into the same shape as
 * parseCsvText. All cell values are coerced to strings so downstream
 * validation (which expects strings) behaves identically for both formats. */
export async function parseXlsxFile(file: File, uploadType: CsvUploadType): Promise<ParsedCsv> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return {
      rows: [],
      fileLevelErrors: ["The Excel file does not contain any sheets."],
      columnMap: null,
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  // raw: false formats values the way Excel displays them (so numbers/dates
  // come through as readable strings rather than serials); defval ensures
  // empty cells become "" instead of being omitted from the row array.
  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  const nonEmptyGrid = grid.filter(
    (row) => row.length > 0 && row.some((cell) => String(cell).trim() !== "")
  );

  if (nonEmptyGrid.length === 0) {
    return {
      rows: [],
      fileLevelErrors: ["The Excel file is empty or could not be read."],
      columnMap: null,
    };
  }

  const headerCells = nonEmptyGrid[0].map((cell) => String(cell).trim());
  const dataRows = nonEmptyGrid
    .slice(1)
    .map((row) => row.map((cell) => String(cell).trim()));

  return buildRowsFromCells(headerCells, dataRows, uploadType);
}

/** Reads either a CSV or Excel file and returns the parsed result, dispatching
 * on file extension. Use this instead of calling parseCsvText/parseXlsxFile
 * directly when the source format isn't already known. */
export async function parseInventoryFile(
  file: File,
  uploadType: CsvUploadType
): Promise<ParsedCsv> {
  const isExcel = /\.(xlsx|xls)$/i.test(file.name);

  if (isExcel) {
    return parseXlsxFile(file, uploadType);
  }

  const text = await file.text();
  if (!text || text.trim().length === 0) {
    return {
      rows: [],
      fileLevelErrors: ["The file could not be read or is empty."],
      columnMap: null,
    };
  }
  return parseCsvText(text, uploadType);
}

// ── Validation ────────────────────────────────────────────────────────────────

function buildRowConfigKey(row: RawCsvRow): string {
  // Detailed uploads represent individual physical items — many rows sharing
  // identical specs is completely normal there (e.g. ten identical laptops,
  // each with its own Asset ID), so "duplicate" for that upload type means a
  // repeated Asset ID, not a repeated configuration. Summary uploads keep the
  // original spec-based check, scoped per list number so the same
  // configuration is allowed to reappear across different list-number groups.
  if (row.uploadType === "detailed") {
    const assetId = row.assetId.trim().toLowerCase();
    // A blank Asset ID is already flagged by the "required" rule below —
    // give each blank row its own key here so they don't also collide with
    // each other as spurious "duplicates".
    return assetId ? `detailed|${assetId}` : `detailed|blank|${row.rowNumber}`;
  }

  return [
    row.listNumber.toLowerCase(),
    row.category.toLowerCase(),
    row.condition.toLowerCase(),
    row.brand.toLowerCase(),
    row.model.toLowerCase(),
    row.processor.toLowerCase(),
    row.generation.toLowerCase(),
    row.ram.toLowerCase(),
    row.storage.toLowerCase(),
    row.speed.toLowerCase(),
    row.comment.toLowerCase(),
  ].join("|");
}

export function validateCsvRows(
  rawRows: RawCsvRow[],
  remainingCapacity: number,
  fileLevelErrorsFromParse: string[],
  fileName: string,
  fileSizeLabel: string,
  uploadType: CsvUploadType
): CsvValidationResult {
  const fileLevelErrors = [...fileLevelErrorsFromParse];

  // Track configurations we've seen so far to flag in-file duplicates
  const seenConfigs = new Map<string, number>(); // configKey -> first row number

  const validatedRows: ValidatedCsvRow[] = rawRows.map((row) => {
    const errors: string[] = [];
    const category = row.category.trim();
    const isLCD = isLCDCategory(category);

    // Required field validation
    if (!row.listNumber.trim()) {
      errors.push("List Number is required.");
    }

    if (uploadType === "detailed" && !row.assetId.trim()) {
      errors.push("Asset ID is required for detailed uploads.");
    }

    if (!category) {
      errors.push("Category is required.");
    } else if (!VALID_CATEGORY_VALUES.some((c) => c.toLowerCase() === category.toLowerCase())) {
      errors.push(
        `"${category}" is not a recognised category (expected one of: ${VALID_CATEGORY_VALUES.join(", ")}).`
      );
    }

    const condition = row.condition.trim();
    if (!condition) {
      errors.push("Condition is required.");
    } else if (!VALID_CONDITION_VALUES.some((c) => c.toLowerCase() === condition.toLowerCase())) {
      errors.push(
        `"${condition}" is not a recognised condition (expected one of: ${VALID_CONDITION_VALUES.join(", ")}).`
      );
    }

    if (!row.brand.trim()) {
      errors.push("Brand is required.");
    }

    if (!row.model.trim()) {
      errors.push("Model is required.");
    }

    // Tech-spec fields are only required for non-LCD categories
    if (!isLCD) {
      if (!row.processor.trim()) errors.push("Processor is required for this category.");
      if (!row.ram.trim()) errors.push("RAM is required for this category.");
      if (!row.storage.trim()) errors.push("Storage is required for this category.");
    }

    // Comment — silently blank invalid values rather than erroring
    const rawComment = row.comment.trim();
    const cleanedComment = COMMENT_LOOKUP[normaliseCommentKey(rawComment)] ?? "";

    // Quantity validation — must be a valid positive integer
    const qtyTrimmed = row.quantity.trim();
    const qtyNumber = Number(qtyTrimmed);
    const isValidInteger =
      qtyTrimmed !== "" && Number.isInteger(qtyNumber) && qtyNumber > 0;

    if (!isValidInteger) {
      errors.push("Quantity must be a positive whole number.");
    } else if (uploadType === "detailed" && qtyNumber !== 1) {
      errors.push("Detailed uploads must have Quantity = 1 for each row.");
    }

    // Duplicate detection (within file)
    const configKey = buildRowConfigKey(row);
    if (seenConfigs.has(configKey)) {
      const firstRow = seenConfigs.get(configKey)!;
      errors.push(`Duplicate configuration — identical to row ${firstRow}.`);
    } else {
      seenConfigs.set(configKey, row.rowNumber);
    }

    const totalItems = isValidInteger ? qtyNumber : 0;

    // Normalise condition to its canonical casing (e.g. "new" -> "New") so
    // downstream display/badges, which key off the exact canonical string,
    // work regardless of how the admin capitalised it in the file.
    const canonicalCondition =
      VALID_CONDITION_VALUES.find((c) => c.toLowerCase() === condition.toLowerCase()) ??
      condition;

    return {
      ...row,
      comment: cleanedComment,
      category,
      condition: canonicalCondition,
      status: errors.length === 0 ? "Valid" : "Invalid",
      errors,
      totalItems,
    };
  });

  // Shipment capacity validation — runs across all currently-valid rows together,
  // since capacity is a collective constraint, not a per-row one.
  let runningTotal = 0;
  for (const row of validatedRows) {
    if (row.status !== "Valid") continue;
    runningTotal += row.totalItems;
    if (runningTotal > remainingCapacity) {
      row.status = "Invalid";
      row.errors.push(
        `Importing this row would exceed the shipment's remaining capacity (${remainingCapacity}).`
      );
      runningTotal -= row.totalItems; // back it out, it didn't actually fit
    }
  }

  const validRows = validatedRows.filter((r) => r.status === "Valid");
  const invalidRows = validatedRows.filter((r) => r.status === "Invalid");

  const totalQuantity = validatedRows.reduce(
    (sum, r) => sum + (Number(r.quantity) > 0 ? Number(r.quantity) || 0 : 0),
    0
  );
  const validQuantity = validRows.reduce((sum, r) => sum + r.totalItems, 0);

  return {
    fileName,
    fileSizeLabel,
    uploadType,
    rows: validatedRows,
    validRows,
    invalidRows,
    totalQuantity,
    validQuantity,
    remainingCapacity,
    fileLevelErrors,
  };
}

// ── File helpers ──────────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Builds the downloadable CSV template for the given upload type — one
 * unified template per type, covering all categories. */
export function buildCsvTemplate(uploadType: CsvUploadType): string {
  const header = CSV_REQUIRED_COLUMNS(uploadType).join(",");

  if (uploadType === "detailed") {
    const sampleLaptop = [
      "LIST-A", "ASSET-0001", "Laptop", "New", "HP", "EliteBook 840 G8",
      "Intel Core i5", "11th Gen", "8GB", "256GB SSD", "2.40GHz", "Non-Touch", "1",
    ].join(",");
    const sampleWorkstation = [
      "LIST-A", "ASSET-0002", "Workstation", "Refurb", "Dell", "Precision 3660",
      "Intel Core i7", "12th Gen", "32GB", "1TB SSD", "3.00GHz", "Non-Touch", "1",
    ].join(",");
    const sampleLcd = [
      "LIST-B", "ASSET-0003", "LCD", "Used", "Dell", "P2422H", "", "", "", "", "", "Non-Touch", "1",
    ].join(",");
    return [header, sampleLaptop, sampleWorkstation, sampleLcd].join("\n");
  }

  const sampleLaptop = [
    "LIST-A", "Laptop", "New", "HP", "EliteBook 840 G8",
    "Intel Core i5", "11th Gen", "8GB", "256GB SSD", "2.40GHz", "Non-Touch", "20",
  ].join(",");
  const sampleWorkstation = [
    "LIST-A", "Workstation", "Refurb", "Dell", "Precision 3660",
    "Intel Core i7", "12th Gen", "32GB", "1TB SSD", "3.00GHz", "Non-Touch", "5",
  ].join(",");
  const sampleLcd = [
    "LIST-B", "LCD", "Used", "Dell", "P2422H", "", "", "", "", "", "Non-Touch", "15",
  ].join(",");
  return [header, sampleLaptop, sampleWorkstation, sampleLcd].join("\n");
}

export function downloadCsvTemplate(uploadType: CsvUploadType): void {
  const csvContent = buildCsvTemplate(uploadType);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `inventory_import_template_${uploadType}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Builds a downloadable error report CSV from a validation result's invalid rows. */
export function downloadErrorReport(result: CsvValidationResult): void {
  const header = "Row,Category,Condition,Brand,Model,Quantity,Errors";
  const lines = result.invalidRows.map((row) => {
    const errorText = row.errors.join(" | ").replace(/"/g, '""');
    return `${row.rowNumber},"${row.category}","${row.condition}","${row.brand}","${row.model}",${row.quantity},"${errorText}"`;
  });
  const csvContent = [header, ...lines].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${result.fileName.replace(/\.csv$/i, "")}_errors.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}