// ─── Faulty Stock — core types ───────────────────────────────────────────────
//
// Dedicated workspace for every inventory item currently marked Faulty — the
// same underlying records shown on DatabasePage filtered to status "Faulty",
// but with fault-specific columns (fault types, date marked faulty, who
// marked it) and fault-specific actions (edit fault, restore to Ok).
//
// BACKEND INTEGRATION SEAM:
//   GET   /inventory/faulty                → list all Faulty assets (this page's data source)
//   PATCH /inventory/:assetId/fault        → update faultTypes and notes (Edit Fault modal)
//   PATCH /inventory/:assetId/restore      → clear faultTypes and set status back to Ok

export interface FaultyStockItem {
  assetId: string;
  category: string;
  brand: string;
  model: string;
  processor: string;
  generation: string;
  ram: string;
  storage: string;
  speed: string;
  screenType: string;
  faultTypes: string[];
  dateMarkedFaulty: string; // display string e.g. '18/06/2026 10:34 AM'
  adjustedBy: string; // username of who marked it faulty
  shipmentId: string;
  batchId: string;
  listNumber: string;
  notes: string;
}
