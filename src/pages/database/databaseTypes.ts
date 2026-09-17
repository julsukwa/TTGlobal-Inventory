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
// Backed by the real /inventory API — see backend/src/inventory. The backend
// returns uppercase enum values (OK/FAULTY/ISSUED, GENERATED/PROVIDED);
// toInventoryAsset() below maps those to the display strings this page and
// FaultyStockPage use everywhere ("Ok"/"Faulty"/"Issued", "Generated"/"Provided").

export type InventoryAssetStatus = "Ok" | "Faulty" | "Issued";
export type AssetIdSourceDisplay = "Generated" | "Provided";

export interface InventoryAsset {
  assetId: string;
  assetIdSource: AssetIdSourceDisplay;
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
  status: InventoryAssetStatus;
  importDate: string; // display string derived from importedAt, e.g. '12/05/2026 10:24 AM'
  faultTypes: string[]; // empty array if status is not Faulty
  notes: string;
}

// ─── Backend response shape ─────────────────────────────────────────────────
// Exactly what GET/PATCH /inventory return — see backend/src/inventory.

export type BackendItemStatus = "OK" | "FAULTY" | "ISSUED";
export type BackendAssetIdSource = "GENERATED" | "PROVIDED";

export interface BackendInventoryItem {
  id: number;
  assetId: string;
  assetIdSource: BackendAssetIdSource;
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
  screenType: string;
  notes: string;
  status: BackendItemStatus;
  importedAt: string;
  updatedAt: string;
  batch: { batchId: string };
  shipment: {
    shipmentId: string;
    shipmentName: string;
    vendor: { vendorId: string; name: string };
  };
  faultTypes: string[];
}

export function displayStatus(status: BackendItemStatus): InventoryAssetStatus {
  if (status === "FAULTY") return "Faulty";
  if (status === "ISSUED") return "Issued";
  return "Ok";
}

export function displayAssetIdSource(source: BackendAssetIdSource): AssetIdSourceDisplay {
  return source === "PROVIDED" ? "Provided" : "Generated";
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString("en-GB");
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart} ${timePart}`;
}

export function toInventoryAsset(raw: BackendInventoryItem): InventoryAsset {
  return {
    assetId: raw.assetId,
    assetIdSource: displayAssetIdSource(raw.assetIdSource),
    listNumber: raw.listNumber,
    batchId: raw.batch.batchId,
    shipmentId: raw.shipment.shipmentId,
    vendorId: raw.shipment.vendor.vendorId,
    category: raw.category,
    brand: raw.brand,
    model: raw.model,
    processor: raw.processor,
    generation: raw.generation,
    ram: raw.ram,
    storage: raw.storage,
    speed: raw.speed,
    screenType: raw.screenType,
    status: displayStatus(raw.status),
    importDate: formatDateTime(raw.importedAt),
    faultTypes: raw.faultTypes,
    notes: raw.notes,
  };
}

export interface InventoryStats {
  totalInventory: number;
  okCount: number;
  faultyCount: number;
  issuedCount: number;
  categoryCounts: { category: string; count: number }[];
}
