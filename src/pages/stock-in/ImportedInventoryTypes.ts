// ─── View Imported Inventory — types ──────────────────────────────────────────
//
// Represents a single inventory record already committed to the system under
// a shipment — i.e. the output of a completed manual or CSV stock-in session.
//
// Matches the shape returned by GET /stock-in/inventory/:shipmentId (a raw
// Prisma InventoryItem), with batchId/uploadType resolved client-side from
// GET /stock-in/batches/:shipmentId since the backend record only carries the
// batch's numeric FK, not its human-readable code.
//
// Status terminology (per TT Global business decision):
//   "OK"     — item is in good working condition, available for use or sale
//   "FAULTY" — item has been marked defective via the Adjustments module
//   "ISSUED" — item has been sold/issued to a customer via Stock Out

export type InventoryItemStatus = "OK" | "FAULTY" | "ISSUED";
export type AssetIdSourceType = "GENERATED" | "PROVIDED";

export interface ImportedInventoryItem {
  id: number;
  assetId: string; // e.g. "CNT1-TTL-26-0001" — ShipmentID-VendorID-Year-Sequence
  assetIdSource: AssetIdSourceType;
  batchId: string; // resolved business batch code, e.g. "CNT1-TTL-26-0001"
  uploadType: string; // "manual" | "csv-summary" | "csv-detailed" — resolved via batch lookup
  listNumber: string;

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
  dateImported: string; // formatted display string derived from importedAt
}
