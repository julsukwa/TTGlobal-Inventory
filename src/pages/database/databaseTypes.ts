// ─── Database — core types ───────────────────────────────────────────────────
//
// The Database module is the system-wide, cross-shipment view of every
// inventory item ever imported — the same underlying records shown scoped to
// a single shipment on ViewImportedInventoryPage, but searchable/filterable
// across all shipments, vendors and batches at once.
//
// assetIdSource distinguishes how the Asset ID was produced during Stock In:
//   'generated' — system-assigned, format ListNumber-YY-NNNN (e.g. LIST-A-26-0001)
//   'provided'  — the vendor's own asset tag, kept as-is (e.g. '006704358')
// batchId always follows ShipmentID-VendorID-YY-NNNN (e.g. CNT1-TTL-26-0001)
// regardless of assetIdSource — it identifies the import session, not the
// physical asset tag.
//
// BACKEND INTEGRATION SEAM:
//   GET   /inventory                  → list all assets (this page's data source)
//   PATCH /inventory/:assetId         → update editable fields (see DatabasePage)
//   PATCH /inventory/:assetId/restore → clear faultTypes and set status back to Ok

export interface InventoryAsset {
  assetId: string;
  assetIdSource: "generated" | "provided";
  listNumber: string;
  batchId: string;
  shipmentId: string;
  vendorId: string;
  category: string;
  brand: string;
  model: string;
  processor: string;
  generation: string;
  ram: string;
  storage: string;
  speed: string;
  screenType: string;
  status: "Ok" | "Faulty" | "Issued";
  importedBy: string;
  importDate: string; // display string e.g. '12/05/2026 10:24 AM'
  faultTypes: string[]; // empty array if status is not Faulty
  notes: string;
}
