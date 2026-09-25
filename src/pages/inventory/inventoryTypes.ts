// ─── Available Inventory — core types ─────────────────────────────────────────
//
// The Inventory page shows only physically-present stock (OK + FAULTY,
// never ISSUED) — the same underlying records shown on DatabasePage/
// FaultyStockPage, filtered and summarized for the Dashboard's "Total
// Available" / "OK Stock" / "Faulty Stock" cards.
//
// Backed by GET /dashboard/inventory (see backend/src/dashboard), which
// returns the same batch/shipment shape as GET /inventory, including the
// latest adjustment's faultTypes for FAULTY rows (empty array otherwise).
// The Asset Information drawer still fetches the full record via
// GET /inventory/:assetId (see databaseTypes.ts's BackendInventoryItem/
// toInventoryAsset) on open for fault notes and the adjustment id.

export type AvailableStatus = "OK" | "FAULTY";
export type AvailableAssetIdSource = "GENERATED" | "PROVIDED";

// Exactly what GET /dashboard/inventory returns per row.
export interface BackendAvailableInventoryItem {
  id: number;
  assetId: string;
  assetIdSource: AvailableAssetIdSource;
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
  status: AvailableStatus;
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

export interface AvailableInventoryItem {
  id: number;
  assetId: string;
  listNumber: string;
  batchId: string;
  shipmentId: string;
  shipmentName: string;
  vendorId: string;
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
  status: AvailableStatus;
  importDate: string; // display string derived from importedAt
  faultTypes: string[];
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

export function toAvailableInventoryItem(raw: BackendAvailableInventoryItem): AvailableInventoryItem {
  return {
    id: raw.id,
    assetId: raw.assetId,
    listNumber: raw.listNumber,
    batchId: raw.batch.batchId,
    shipmentId: raw.shipment.shipmentId,
    shipmentName: raw.shipment.shipmentName,
    vendorId: raw.shipment.vendor.vendorId,
    category: raw.category,
    condition: raw.condition,
    brand: raw.brand,
    model: raw.model,
    processor: raw.processor,
    generation: raw.generation,
    ram: raw.ram,
    storage: raw.storage,
    speed: raw.speed,
    screenType: raw.screenType,
    notes: raw.notes,
    status: raw.status,
    importDate: formatDateTime(raw.importedAt),
    faultTypes: raw.faultTypes,
  };
}
