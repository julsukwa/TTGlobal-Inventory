// ─── Inventory Adjustments — core types ───────────────────────────────────────
//
// An adjustment marks previously-good ("Ok") inventory as "Faulty" — the only
// direction supported today (there is no "un-fault" adjustment flow yet).
// Multiple fault types may be recorded against a single item (e.g. a laptop
// can have both a cracked screen and a dead battery).
//
// AdjustmentSessionItem is the in-progress shape used while building a new
// adjustment batch on NewAdjustmentPage (via manual entry or CSV upload),
// before it's committed with POST /adjustments.
//
// Backed by the real /adjustments API — see backend/src/adjustments. The
// backend already returns category/brand/model/specs directly (joined from
// the inventory item), so no separate client-side catalog is needed the way
// the old mock data required.

export type AdjustmentStatus = "Ok" | "Faulty";

// Exactly what GET/POST /adjustments return — see backend/src/adjustments.
export interface BackendAdjustmentRecord {
  id: number;
  assetId: string;
  itemName: string;
  category: string;
  brand: string;
  model: string;
  specs: string;
  faultTypes: string[];
  fromStatus: string; // "OK"
  toStatus: string; // "FAULTY"
  notes: string;
  date: string; // display string e.g. '12/06/2026 10:24'
  adjustedBy: string; // username
}

export interface AdjustmentRecord {
  id: number;
  assetId: string;
  itemName: string;
  category: string;
  brand: string;
  model: string;
  specs: string;
  faultTypes: string[];
  fromStatus: "Ok";
  toStatus: "Faulty";
  date: string;
  adjustedBy: string;
  notes: string;
}

export function toAdjustmentRecord(raw: BackendAdjustmentRecord): AdjustmentRecord {
  return {
    id: raw.id,
    assetId: raw.assetId,
    itemName: raw.itemName,
    category: raw.category,
    brand: raw.brand,
    model: raw.model,
    specs: raw.specs,
    faultTypes: raw.faultTypes,
    fromStatus: "Ok",
    toStatus: "Faulty",
    date: raw.date,
    adjustedBy: raw.adjustedBy,
    notes: raw.notes,
  };
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
