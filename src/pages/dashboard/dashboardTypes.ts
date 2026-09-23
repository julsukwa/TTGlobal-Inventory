// ─── Dashboard — core types ───────────────────────────────────────────────────
//
// The Dashboard is the landing page after login — five KPI cards backed by
// GET /dashboard/stats (see backend/src/dashboard), plus a Recent Activity
// feed assembled client-side from the last few GET /adjustments and
// GET /stock-out records (there is no dedicated activity-log endpoint yet).

import type { BackendAdjustmentRecord } from "../adjustments/adjustmentTypes";
import type { StockOutApiTransaction } from "../stock-out/stockOutTypes";

export interface DashboardStats {
  totalAvailable: number;
  okCount: number;
  faultyCount: number;
  totalLists: number;
  openLists: number;
  isEndOfMonth: boolean;
  daysUntilMonthEnd: number;
}

export type RecentActivityType = "adjustment" | "stock-out";

export interface RecentActivityItem {
  id: string;
  type: RecentActivityType;
  description: string;
  timestamp: string; // display string, exactly as returned by the backend
  user: string;
  sortKey: number; // parsed epoch millis, used only to interleave the two sources by recency
}

// Both sources format dates as "DD/MM/YYYY" or "DD/MM/YYYY HH:mm" — parsed
// here only to merge the two lists by recency, never displayed directly.
function parseDisplayDate(display: string): number {
  const [datePart, timePart] = display.trim().split(" ");
  const [day, month, year] = datePart.split("/").map(Number);
  const [hours, minutes] = (timePart ?? "").split(":").map(Number);
  const date = new Date(
    year ?? 1970,
    (month ?? 1) - 1,
    day ?? 1,
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0
  );
  return date.getTime();
}

export function adjustmentToActivity(record: BackendAdjustmentRecord): RecentActivityItem {
  const faultSummary = record.faultTypes.length ? ` — ${record.faultTypes.join(", ")}` : "";
  return {
    id: `adj-${record.id}`,
    type: "adjustment",
    description: `Marked ${record.assetId} (${record.itemName}) as Faulty${faultSummary}`,
    timestamp: record.date,
    user: record.adjustedBy,
    sortKey: parseDisplayDate(record.date),
  };
}

export function stockOutToActivity(record: StockOutApiTransaction): RecentActivityItem {
  const itemWord = record.totalItems === 1 ? "item" : "items";
  return {
    id: `so-${record.invoiceNumber}`,
    type: "stock-out",
    description: `Issued ${record.totalItems} ${itemWord} to ${record.customerName} — Invoice ${record.invoiceNumber}`,
    timestamp: record.date,
    user: record.processedBy,
    sortKey: parseDisplayDate(record.date),
  };
}
