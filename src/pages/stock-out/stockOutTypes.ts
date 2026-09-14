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
// BACKEND INTEGRATION SEAM:
//   POST /stock-out          → create transaction, returns StockOutTransaction
//   GET  /stock-out          → list all transactions
//   GET  /stock-out/:invoiceNumber → single transaction detail
//   GET  /inventory/:assetId → lookup single asset for scanning validation

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
  shipmentId: string;
  source: ScannedItemSource; // how this item was added
  listNumber: string; // the list number this item belongs to
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