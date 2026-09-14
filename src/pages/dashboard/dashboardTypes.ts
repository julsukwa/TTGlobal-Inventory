// ─── Dashboard — core types ───────────────────────────────────────────────────
//
// The Dashboard is the role-aware landing page after login — see
// DashboardPage.tsx for how each role's KPI set and section visibility is
// driven off these shapes.
//
// BACKEND INTEGRATION SEAM:
//   GET /dashboard/kpis?role=<role>        → the appropriate DashboardKPI[]
//   GET /dashboard/inventory-overview      → InventoryOverviewRow[]
//   GET /dashboard/stock-by-category       → StockByCategoryEntry[]
//   GET /dashboard/recent-activities       → RecentActivity[]

export interface DashboardKPI {
  label: string;
  value: number | string;
  subtext: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

export interface RecentActivity {
  id: number;
  type: "stock-in" | "stock-out" | "adjustment" | "warranty" | "new-item";
  description: string;
  timestamp: string; // e.g. '10 min ago', '2 hrs ago'
  user: string;
}

export interface InventoryOverviewRow {
  category: string;
  totalStock: number;
  available: number; // Ok status count
  faulty: number;
  issued: number;
}

export interface StockByCategoryEntry {
  category: string;
  count: number;
  percentage: number;
}
