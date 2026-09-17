// ─── Stock Out — core types ────────────────────────────────────────────────────
//
// A StockOut transaction represents a single sale/issue event where one or
// more inventory items are issued to a customer. Items with status "Ok" OR
// "Faulty" may both be issued — faulty items are regularly sold at discount.
//
// On confirmation every scanned item's status changes: Ok | Faulty → Issued
//
// The invoice number is the unique identifier for every transaction — it maps
// directly to the physical invoice and is required to be unique per transaction.
// No separate system-generated Transaction ID is needed or used.
//
// Backed by the real /stock-out API. See StockOutApiTransaction/StockOutApiItem
// below for the exact shape the backend returns (uppercase OK/FAULTY status,
// no per-item shipmentId) — displayItemStatus() bridges that to the
// "Ok"/"Faulty" display strings ScannedItem/StockOutItemStatus use everywhere
// pre-commit (the scanning session, review, and bulk-add lookups).

export type StockOutItemStatus = "Ok" | "Faulty";

// How an item was added to the current scanning session — surfaced in the
// session table, the review table, the completion table, and the historical
// transaction drawer so every issued item stays traceable to its origin.
export type ScannedItemSource = "scan" | "list-number" | "batch";

export interface ScannedItem {
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
  status: StockOutItemStatus; // original status before issuing
  batchId: string;
  // No longer needed to group by shipment client-side — the backend's bulk
  // lookup endpoints do that server-side and return a shipment id/name/vendor
  // directly for disambiguation. Kept optional (rather than removed) since
  // ScanItemsPage's individual-scan path still sources from mock data shaped
  // with it, and nothing downstream reads it.
  shipmentId?: string;
  source: ScannedItemSource; // how this item was added
  listNumber: string; // the list number this item belongs to
}

// ─── Backend transaction shape ──────────────────────────────────────────────
// Exactly what GET/POST /stock-out return — see backend/src/stock-out. Status
// is the uppercase Prisma enum value (the item's *prior* status before being
// issued); displayItemStatus() below converts it to "Ok"/"Faulty" for display.

export type BackendItemStatus = "OK" | "FAULTY";

export function displayItemStatus(status: BackendItemStatus): StockOutItemStatus {
  return status === "FAULTY" ? "Faulty" : "Ok";
}

export interface StockOutApiItem {
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
  status: BackendItemStatus;
  listNumber: string;
  batchId: string;
  source: ScannedItemSource;
}

export interface StockOutApiTransaction {
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerLocation: string;
  notes: string;
  date: string; // DD/MM/YYYY
  processedBy: string;
  totalItems: number;
  items: StockOutApiItem[];
}

export interface StockOutTransaction {
  // invoiceNumber is the unique identifier — no separate transaction ID
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerLocation: string;
  notes: string;
  date: string;         // display string e.g. "27/06/2026"
  processedBy: string;
  items: ScannedItem[];
  totalItems: number;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  location: string;
  dateAdded: string;
}