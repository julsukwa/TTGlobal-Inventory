import type {
  DashboardKPI,
  RecentActivity,
  InventoryOverviewRow,
  StockByCategoryEntry,
} from "./dashboardTypes";

// 5 categories totalling 1,800 units across the system.
export const inventoryOverview: InventoryOverviewRow[] = [
  { category: "Laptop", totalStock: 720, available: 610, faulty: 45, issued: 65 },
  { category: "Desktop", totalStock: 480, available: 390, faulty: 28, issued: 62 },
  { category: "LCD", totalStock: 260, available: 210, faulty: 15, issued: 35 },
  { category: "All In One", totalStock: 190, available: 150, faulty: 12, issued: 28 },
  { category: "Components", totalStock: 150, available: 118, faulty: 9, issued: 23 },
];

// Same 5 categories, expressed as a share of the 1,800-unit total.
export const stockByCategory: StockByCategoryEntry[] = [
  { category: "Laptop", count: 720, percentage: 40.0 },
  { category: "Desktop", count: 480, percentage: 26.7 },
  { category: "LCD", count: 260, percentage: 14.4 },
  { category: "All In One", count: 190, percentage: 10.6 },
  { category: "Components", count: 150, percentage: 8.3 },
];

export const recentActivities: RecentActivity[] = [
  {
    id: 1,
    type: "stock-in",
    description: "Stock In completed for shipment CNT3 — 24 items added to inventory.",
    timestamp: "10 min ago",
    user: "admin",
  },
  {
    id: 2,
    type: "stock-out",
    description: "Issued 12 laptops to Lagos Branch Office.",
    timestamp: "35 min ago",
    user: "Amaka Nwosu",
  },
  {
    id: 3,
    type: "adjustment",
    description: "Marked LIST-B-26-0010 as Faulty (Touchpad Fault, Keyboard Fault).",
    timestamp: "1 hr ago",
    user: "Tunde Bakare",
  },
  {
    id: 4,
    type: "new-item",
    description: "Added a new asset LIST-A-26-0013 to the database.",
    timestamp: "1 hr ago",
    user: "admin",
  },
  {
    id: 5,
    type: "warranty",
    description: "Warranty return logged for asset 006704358 (iMac 24-inch).",
    timestamp: "2 hrs ago",
    user: "Ngozi Eze",
  },
  {
    id: 6,
    type: "stock-out",
    description: "Issued 5 desktops to Abuja Regional Office.",
    timestamp: "2 hrs ago",
    user: "Amaka Nwosu",
  },
  {
    id: 7,
    type: "adjustment",
    description: "Restored asset LIST-A-26-0009 to Ok status.",
    timestamp: "3 hrs ago",
    user: "admin",
  },
  {
    id: 8,
    type: "stock-in",
    description: "Stock In completed for shipment ASH1 — 18 items added to inventory.",
    timestamp: "6 hrs ago",
    user: "Chinedu Okoro",
  },
];

export const adminKPIs: DashboardKPI[] = [
  {
    label: "Inventory Received",
    value: 7665,
    subtext: "units received via Stock In",
    trend: "up",
    trendValue: "+8.7% vs last week",
  },
  {
    label: "Inventory Issued",
    value: 3892,
    subtext: "units issued via Stock Out",
    trend: "up",
    trendValue: "+5.2% vs last week",
  },
  {
    label: "Available Stock (Ok)",
    value: 1478,
    subtext: "units currently in Ok condition",
    trend: "up",
    trendValue: "+3.1% vs last week",
  },
  {
    label: "Faulty Stock",
    value: 109,
    subtext: "units currently marked Faulty",
    trend: "down",
    trendValue: "-4.2% vs last week",
  },
  {
    label: "Low Stock Items",
    value: 3,
    subtext: "categories below reorder threshold",
    trend: "neutral",
    trendValue: "No change vs last week",
  },
];

export const salesKPIs: DashboardKPI[] = [
  {
    label: "Transactions Today",
    value: 14,
    subtext: "stock out transactions completed today",
    trend: "up",
    trendValue: "+3 vs yesterday",
  },
  {
    label: "Items Issued This Month",
    value: 862,
    subtext: "units issued across all stock outs",
    trend: "up",
    trendValue: "+12.4% vs last month",
  },
  {
    label: "Total Customers",
    value: 156,
    subtext: "active customer accounts",
    trend: "up",
    trendValue: "+2 new this week",
  },
];

export const warehouseKPIs: DashboardKPI[] = [
  {
    label: "Items Received Today",
    value: 96,
    subtext: "units imported via Stock In today",
    trend: "up",
    trendValue: "+18 vs yesterday",
  },
  {
    label: "Pending Shipments",
    value: 4,
    subtext: "shipments currently In Progress",
    trend: "neutral",
    trendValue: "No change vs yesterday",
  },
  {
    label: "Sticker Queue",
    value: 37,
    subtext: "items awaiting sticker printing",
    trend: "down",
    trendValue: "-9 vs yesterday",
  },
];

export const warrantyKPIs: DashboardKPI[] = [
  {
    label: "Total Returns",
    value: 214,
    subtext: "warranty return records logged to date",
    trend: "up",
    trendValue: "+6 vs last month",
  },
  {
    label: "Returns This Month",
    value: 21,
    subtext: "warranty returns logged this month",
    trend: "up",
    trendValue: "+4 vs last month",
  },
  {
    label: "Pending Inspection",
    value: 8,
    subtext: "items awaiting condition assessment",
    trend: "down",
    trendValue: "-3 vs last week",
  },
];
