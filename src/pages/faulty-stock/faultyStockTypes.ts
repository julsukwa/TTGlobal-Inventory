// ─── Faulty Stock — core types ───────────────────────────────────────────────
//
// Dedicated workspace for every inventory item currently marked Faulty — the
// same underlying records shown on DatabasePage filtered to status "Faulty",
// but with fault-specific columns (fault types, date marked faulty) and
// fault-specific actions (edit fault, restore to Ok).
//
// Backed by the real /inventory API (see backend/src/inventory), filtered to
// status=FAULTY. The Adjustments endpoint (who marked an item faulty, and
// when, as its own auditable record) isn't built yet, so in the meantime:
//   - dateMarkedFaulty uses the item's updatedAt as the closest available
//     proxy (sourced from the same InventoryItem returned by GET /inventory)
//   - adjustedBy has no backing data yet and is shown as "—"
// Both should be swapped for real Adjustment records once that endpoint exists.

import type { BackendInventoryItem } from "../database/databaseTypes";

export interface FaultyStockItem {
  assetId: string;
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
  faultTypes: string[];
  dateMarkedFaulty: string; // display string e.g. '18/06/2026 10:34 AM'
  adjustedBy: string; // username of who marked it faulty — not available yet, see above
  shipmentId: string;
  shipmentName: string;
  vendorId: string;
  batchId: string;
  listNumber: string;
  importDate: string; // display string derived from importedAt — shown as "Created At"
  notes: string;
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

export function toFaultyStockItem(raw: BackendInventoryItem): FaultyStockItem {
  return {
    assetId: raw.assetId,
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
    faultTypes: raw.faultTypes,
    dateMarkedFaulty: formatDateTime(raw.updatedAt),
    adjustedBy: "—",
    shipmentId: raw.shipment.shipmentId,
    shipmentName: raw.shipment.shipmentName,
    vendorId: raw.shipment.vendor.vendorId,
    batchId: raw.batch.batchId,
    listNumber: raw.listNumber,
    importDate: formatDateTime(raw.importedAt),
    notes: raw.notes,
  };
}
