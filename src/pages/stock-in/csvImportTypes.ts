// ─── CSV Import Types ──────────────────────────────────────────────────────────
// These types extend the same shape used by ManualStockInPage's
// SessionInventoryItem so that, once validated, CSV rows can flow through the
// exact same processing/completion pages as manual entry.

import type { SessionInventoryItem } from "./manualStockInTypes";

/**
 * Which of the two CSV upload flows a file is being imported through:
 *   'summary'  — Asset IDs are not known yet; the system generates them.
 *                 Quantity may be greater than 1 per row.
 *   'detailed' — Asset IDs are already known/printed on the items; each row
 *                 is exactly one individual item (Quantity must be 1).
 */
export type CsvUploadType = "summary" | "detailed";

/** Summary upload columns — existing behaviour plus List Number. */
const SUMMARY_COLUMNS = [
  "List Number",
  "Category",
  "Condition",
  "Brand",
  "Model",
  "Processor",
  "Generation",
  "RAM",
  "Storage",
  "Speed",
  "Comment",
  "Quantity",
] as const;

/** Detailed upload columns — Summary columns plus Asset ID. */
const DETAILED_COLUMNS = [
  "List Number",
  "Asset ID",
  "Category",
  "Condition",
  "Brand",
  "Model",
  "Processor",
  "Generation",
  "RAM",
  "Storage",
  "Speed",
  "Comment",
  "Quantity",
] as const;

/**
 * The raw set of column headers the system accepts in an uploaded CSV,
 * dependent on the selected upload type. LCD rows simply leave the
 * tech-spec columns blank. Workstation rows follow the same field
 * requirements as Laptop/Desktop/All In One (no exemptions).
 */
export function CSV_REQUIRED_COLUMNS(uploadType: CsvUploadType): readonly string[] {
  return uploadType === "detailed" ? DETAILED_COLUMNS : SUMMARY_COLUMNS;
}

export type CsvColumn = (typeof SUMMARY_COLUMNS)[number] | (typeof DETAILED_COLUMNS)[number];

/** A single raw row as parsed straight out of the CSV, before validation. */
export interface RawCsvRow {
  rowNumber: number; // 1-based, matches the row's position in the file (excluding header)
  listNumber: string;
  assetId: string; // present in detailed uploads, empty string in summary
  uploadType: CsvUploadType;
  category: string;
  condition: string;
  brand: string;
  model: string;
  processor: string;
  generation: string;
  ram: string;
  storage: string;
  speed: string;
  comment: string; // optional field — may be blank
  quantity: string; // kept as string pre-validation; parsed to number on validate
}

export type RowValidationStatus = "Valid" | "Invalid";

/** A single validation issue tied to a specific row + field. */
export interface CsvRowError {
  rowNumber: number;
  field: string;
  message: string;
}

/** A row after validation, carrying its computed status + any per-row errors. */
export interface ValidatedCsvRow extends RawCsvRow {
  status: RowValidationStatus;
  errors: string[]; // human-readable messages specific to this row
  totalItems: number; // numeric quantity once parsed (0 if invalid)
}

/** Full result of validating an uploaded CSV file against a shipment. */
export interface CsvValidationResult {
  fileName: string;
  fileSizeLabel: string;
  uploadType: CsvUploadType;
  rows: ValidatedCsvRow[];
  validRows: ValidatedCsvRow[];
  invalidRows: ValidatedCsvRow[];
  totalQuantity: number; // sum across ALL rows (valid + invalid) for display
  validQuantity: number; // sum across valid rows only — what will actually import
  remainingCapacity: number; // shipment remaining capacity at time of validation
  fileLevelErrors: string[]; // errors that apply to the whole file (missing columns etc.)
}

/** Converts a validated CSV row into the same session item shape manual entry uses.
 * The CSV "Comment" column maps to screenType; CSV has no additionalInfo column. */
export function csvRowToSessionItem(
  row: ValidatedCsvRow,
  idSeed: number
): SessionInventoryItem {
  return {
    id: idSeed,
    listNumber: row.listNumber,
    assetIdSource: row.uploadType === "detailed" ? "provided" : "generated",
    providedAssetId: row.uploadType === "detailed" ? row.assetId : "",
    category: row.category,
    condition: row.condition,
    brand: row.brand,
    model: row.model,
    processor: row.processor,
    generation: row.generation,
    ram: row.ram,
    storage: row.storage,
    speed: row.speed,
    screenType: row.comment,
    additionalInfo: "",
    quantity: row.totalItems,
  };
}
