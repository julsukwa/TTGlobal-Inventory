// ─── Inventory Adjustments — core types ───────────────────────────────────────
//
// An adjustment marks previously-good ("Ok") inventory as "Faulty" — the only
// direction supported today (there is no "un-fault" adjustment flow yet).
// Multiple fault types may be recorded against a single item (e.g. a laptop
// can have both a cracked screen and a dead battery).
//
// AdjustmentSessionItem is the in-progress shape used while building a new
// adjustment batch on NewAdjustmentPage (via manual entry or CSV upload),
// before it's committed as an AdjustmentRecord.
//
// BACKEND INTEGRATION SEAM:
//   GET  /adjustments                     → list all adjustment records
//   POST /adjustments                     → commit a batch of session items,
//                                            returns the created AdjustmentRecord[]
//   GET  /inventory?status=Ok&assetId=:id → asset lookup during manual entry

export type AdjustmentStatus = "Ok" | "Faulty";

export interface AdjustmentRecord {
  id: number;
  assetId: string;
  itemName: string; // e.g. 'HP EliteBook 840 G8'
  faultTypes: string[]; // multiple faults allowed per item e.g. ['LCD Spot', 'Keyboard Fault']
  fromStatus: "Ok";
  toStatus: "Faulty";
  date: string; // display string e.g. '12/06/2026 10:24 AM'
  adjustedBy: string; // username
  notes: string; // optional, may be empty string
}

export interface AdjustmentSessionItem {
  assetId: string;
  itemName: string;
  category: string;
  brand: string;
  model: string;
  specs: string; // combined display string e.g. 'i5 • 11th Gen • 8GB • 256GB SSD • 2.4GHz'
  currentStatus: "Ok"; // only Ok items can be adjusted
  faultTypes: string[];
}
