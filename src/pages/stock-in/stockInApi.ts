// ─── Stock In — API request/response shapes ───────────────────────────────────
//
// Shared between ManualStockInPage and ImportCsvPreviewPage (both build a
// session of items and POST them to /stock-in/manual or /stock-in/csv), and
// StockInCompletePage (which renders whatever the API returned).

import type { SessionInventoryItem } from "./manualStockInTypes";

export interface StockInApiItem {
  listNumber: string;
  assetIdSource: "generated" | "provided";
  providedAssetId?: string;
  category: string;
  condition?: string;
  brand: string;
  model: string;
  processor?: string;
  generation?: string;
  ram?: string;
  storage?: string;
  speed?: string;
  screenType?: string;
  notes?: string;
  quantity: number;
}

// Matches the backend's StockInResult (see backend/src/stock-in/stock-in.service.ts).
export interface StockInResult {
  batchId: string;
  shipmentId: string;
  vendorId: string;
  itemsCreated: number;
  assetIds: string[]; // first 10 only for preview
  totalAssetIds: number;
  listNumbers: string[];
  uploadType: string;
}

export function toStockInApiItem(item: SessionInventoryItem): StockInApiItem {
  return {
    listNumber: item.listNumber,
    assetIdSource: item.assetIdSource,
    providedAssetId: item.assetIdSource === "provided" ? item.providedAssetId : undefined,
    category: item.category,
    condition: item.condition || undefined,
    brand: item.brand,
    model: item.model,
    processor: item.processor || undefined,
    generation: item.generation || undefined,
    ram: item.ram || undefined,
    storage: item.storage || undefined,
    speed: item.speed || undefined,
    screenType: item.screenType || undefined,
    notes: item.additionalInfo || undefined,
    quantity: item.quantity,
  };
}
