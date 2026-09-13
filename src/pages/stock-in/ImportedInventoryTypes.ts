// ─── View Imported Inventory — types ──────────────────────────────────────────
//
// Represents a single inventory record already committed to the system under
// a shipment — i.e. the output of a completed manual or CSV stock-in session,
// not a draft/session item awaiting confirmation (see manualStockInTypes.ts
// for that earlier-stage shape).
//
// Per product decision: this page shows EVERY batch/import ever done into a
// shipment, not just the most recent one — batchId is what lets the admin
// tell which import session a given row came from.
//
// Status terminology (per TT Global business decision):
//   "Ok"     — item is in good working condition, available for use or sale
//   "Faulty" — item has been marked defective via the Adjustments module
//   "Issued" — item has been sold/issued to a customer via Stock Out

export type InventoryItemStatus = "Ok" | "Faulty" | "Issued";

export interface ImportedInventoryItem {
  assetId: string; // e.g. "CNT1-TTL-26-0001" — ShipmentID-VendorID-Year-Sequence
  batchId: string; // e.g. "BCH-8F3A91C2" — identifies the import session this came from

  category: string;
  condition: string;
  brand: string;
  model: string;

  processor: string;
  generation: string;
  ram: string;
  storage: string;
  speed: string;

  screenType: string; // "Touch Screen" | "Non-Touch" | "" — dropdown value from manual entry
  additionalInfo: string; // free-text notes, may be ""

  status: InventoryItemStatus;

  source: "manual" | "csv"; // which entry method created this record
  dateImported: string; // ISO-ish display string, e.g. "12/05/2026 10:24 AM"
}

/** Summary of a single import session (one Batch ID), derived from the
 * inventory items that share that batchId. Used to group/filter the table
 * by "which import did this come from." */
export interface BatchSummary {
  batchId: string;
  source: "manual" | "csv";
  itemCount: number;
  dateImported: string;
}