// ─── Lists — core types ────────────────────────────────────────────────────────
//
// Each row is one unique list number's inventory breakdown across every
// batch/shipment it spans — closed (nothing issued yet), open (partially
// sold) or sold (everything issued). Backed by GET /dashboard/lists (see
// backend/src/dashboard), which returns exactly this shape.

export type ListStatus = "closed" | "open" | "sold";

export interface ListRow {
  listNumber: string;
  totalItems: number;
  okCount: number;
  faultyCount: number;
  issuedCount: number;
  status: ListStatus;
}
