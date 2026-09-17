import type { AdjustmentRecord } from "./adjustmentTypes";
import type { ImportedInventoryItem } from "../stock-in/ImportedInventoryTypes";

// ─── Adjustment history ────────────────────────────────────────────────────────
// 10 historical "Ok → Faulty" adjustments, dated across May–June 2026.
// "Battery Issue" deliberately appears twice (records 5 and 8) so it's the
// unambiguous Most Common Fault on the summary strip — every other fault
// type here appears exactly once.
export const mockAdjustments: AdjustmentRecord[] = [
  {
    id: 1,
    assetId: "CNT1-TTL-26-0001",
    itemName: "HP EliteBook 840 G8",
    faultTypes: ["LCD Spot"],
    fromStatus: "Ok",
    toStatus: "Faulty",
    date: "03/05/2026 09:14 AM",
    adjustedBy: "admin",
    notes: "",
  },
  {
    id: 2,
    assetId: "CNT1-TTL-26-0004",
    itemName: "Dell Latitude 5420",
    faultTypes: ["Keyboard Fault"],
    fromStatus: "Ok",
    toStatus: "Faulty",
    date: "05/05/2026 11:40 AM",
    adjustedBy: "Tunde Bakare",
    notes: "Reported by customer during unboxing.",
  },
  {
    id: 3,
    assetId: "CNT2-TTL-26-0012",
    itemName: "HP ProDesk 400 G6",
    faultTypes: ["HDD Failure"],
    fromStatus: "Ok",
    toStatus: "Faulty",
    date: "08/05/2026 02:05 PM",
    adjustedBy: "admin",
    notes: "",
  },
  {
    id: 4,
    assetId: "CNT2-TTL-26-0019",
    itemName: "Dell OptiPlex 7090",
    faultTypes: ["No Display"],
    fromStatus: "Ok",
    toStatus: "Faulty",
    date: "12/05/2026 10:30 AM",
    adjustedBy: "Tunde Bakare",
    notes: "",
  },
  {
    id: 5,
    assetId: "CNT3-MWS-26-0007",
    itemName: "Lenovo ThinkPad T14",
    faultTypes: ["Battery Issue"],
    fromStatus: "Ok",
    toStatus: "Faulty",
    date: "18/05/2026 03:22 PM",
    adjustedBy: "admin",
    notes: "Battery swells slightly when charging.",
  },
  {
    id: 6,
    assetId: "ASH1-MWS-26-0003",
    itemName: "Dell P2422H",
    faultTypes: ["Cracked Screen"],
    fromStatus: "Ok",
    toStatus: "Faulty",
    date: "22/05/2026 09:50 AM",
    adjustedBy: "Tunde Bakare",
    notes: "",
  },
  {
    id: 7,
    assetId: "CONT4-TTL-26-0002",
    itemName: "Lenovo ThinkCentre M720",
    faultTypes: ["Dead Board"],
    fromStatus: "Ok",
    toStatus: "Faulty",
    date: "29/05/2026 01:15 PM",
    adjustedBy: "admin",
    notes: "",
  },
  {
    id: 8,
    assetId: "CNT1-TTL-26-0027",
    itemName: "HP EliteBook 840 G8",
    faultTypes: ["Charging Port Loose", "Battery Issue"],
    fromStatus: "Ok",
    toStatus: "Faulty",
    date: "02/06/2026 08:45 AM",
    adjustedBy: "Tunde Bakare",
    notes: "Two separate faults found during QC.",
  },
  {
    id: 9,
    assetId: "CNT2-TTL-26-0035",
    itemName: "Dell Latitude 5420",
    faultTypes: ["Rubber Damage"],
    fromStatus: "Ok",
    toStatus: "Faulty",
    date: "07/06/2026 04:00 PM",
    adjustedBy: "admin",
    notes: "",
  },
  {
    id: 10,
    assetId: "CNT3-MWS-26-0041",
    itemName: "HP ProDesk 400 G6",
    faultTypes: ["Power Issue"],
    fromStatus: "Ok",
    toStatus: "Faulty",
    date: "11/06/2026 12:10 PM",
    adjustedBy: "Tunde Bakare",
    notes: "",
  },
];

// ─── Ok inventory lookup pool ───────────────────────────────────────────────────
// Stand-in for GET /inventory?status=Ok — the asset IDs a new adjustment
// session can search against on NewAdjustmentPage. Deliberately disjoint from
// the asset IDs already adjusted above (those are already Faulty).
export const mockOkInventoryPool: Pick<
  ImportedInventoryItem,
  | "assetId"
  | "category"
  | "brand"
  | "model"
  | "processor"
  | "generation"
  | "ram"
  | "storage"
  | "speed"
  | "screenType"
  | "status"
>[] = [
  {
    assetId: "CNT4-TTL-26-0005",
    category: "Laptop",
    brand: "HP",
    model: "EliteBook 840 G8",
    processor: "Intel Core i5",
    generation: "11th Gen",
    ram: "8GB",
    storage: "256GB SSD",
    speed: "2.40GHz",
    screenType: "Non-Touch",
    status: "OK",
  },
  {
    assetId: "CNT4-TTL-26-0006",
    category: "Laptop",
    brand: "Dell",
    model: "Latitude 5420",
    processor: "Intel Core i7",
    generation: "11th Gen",
    ram: "16GB",
    storage: "512GB SSD",
    speed: "2.60GHz",
    screenType: "Touch Screen",
    status: "OK",
  },
  {
    assetId: "ASH2-TTL-26-0010",
    category: "Desktop",
    brand: "HP",
    model: "ProDesk 400 G6",
    processor: "Intel Core i5",
    generation: "10th Gen",
    ram: "8GB",
    storage: "256GB SSD",
    speed: "3.20GHz",
    screenType: "Non-Touch",
    status: "OK",
  },
  {
    assetId: "ASH2-TTL-26-0011",
    category: "Desktop",
    brand: "Dell",
    model: "OptiPlex 7090",
    processor: "Intel Core i7",
    generation: "11th Gen",
    ram: "16GB",
    storage: "512GB SSD",
    speed: "3.00GHz",
    screenType: "Non-Touch",
    status: "OK",
  },
  {
    assetId: "CNT3-MWS-26-0050",
    category: "Workstation",
    brand: "Dell",
    model: "Precision 3660",
    processor: "Intel Core i7",
    generation: "12th Gen",
    ram: "32GB",
    storage: "1TB SSD",
    speed: "3.00GHz",
    screenType: "Non-Touch",
    status: "OK",
  },
  {
    assetId: "CNT3-MWS-26-0051",
    category: "All In One",
    brand: "Lenovo",
    model: "ThinkCentre M90a",
    processor: "Intel Core i5",
    generation: "11th Gen",
    ram: "8GB",
    storage: "256GB SSD",
    speed: "2.80GHz",
    screenType: "Touch Screen",
    status: "OK",
  },
  {
    assetId: "ASH1-MWS-26-0020",
    category: "LCD",
    brand: "Dell",
    model: "P2422H",
    processor: "",
    generation: "",
    ram: "",
    storage: "",
    speed: "",
    screenType: "Non-Touch",
    status: "OK",
  },
  {
    assetId: "CONT4-TTL-26-0015",
    category: "Laptop",
    brand: "Lenovo",
    model: "ThinkPad T14",
    processor: "Intel Core i7",
    generation: "12th Gen",
    ram: "16GB",
    storage: "512GB SSD",
    speed: "2.80GHz",
    screenType: "Non-Touch",
    status: "OK",
  },
];

/** Display-only enrichment for the adjustment detail drawer, keyed by
 * itemName. AdjustmentRecord itself intentionally carries only assetId +
 * itemName (not category/brand/model/specs) — a real backend would return
 * these via an inventory join (see BACKEND INTEGRATION SEAM in
 * adjustmentTypes.ts). AdjustmentsPage merges in an entry for every new
 * adjustment applied during the session, so this catalog only needs seeding
 * for the historical records above. */
export interface ItemCatalogEntry {
  category: string;
  brand: string;
  model: string;
  specs: string;
}

export const mockItemCatalog: Record<string, ItemCatalogEntry> = {
  "HP EliteBook 840 G8": {
    category: "Laptop",
    brand: "HP",
    model: "EliteBook 840 G8",
    specs: "Intel Core i5 • 11th Gen • 8GB • 256GB SSD • 2.40GHz",
  },
  "Dell Latitude 5420": {
    category: "Laptop",
    brand: "Dell",
    model: "Latitude 5420",
    specs: "Intel Core i7 • 11th Gen • 16GB • 512GB SSD • 2.60GHz",
  },
  "HP ProDesk 400 G6": {
    category: "Desktop",
    brand: "HP",
    model: "ProDesk 400 G6",
    specs: "Intel Core i5 • 10th Gen • 8GB • 256GB SSD • 3.20GHz",
  },
  "Dell OptiPlex 7090": {
    category: "Desktop",
    brand: "Dell",
    model: "OptiPlex 7090",
    specs: "Intel Core i7 • 11th Gen • 16GB • 512GB SSD • 3.00GHz",
  },
  "Lenovo ThinkPad T14": {
    category: "Laptop",
    brand: "Lenovo",
    model: "ThinkPad T14",
    specs: "Intel Core i7 • 12th Gen • 16GB • 512GB SSD • 2.80GHz",
  },
  "Dell P2422H": {
    category: "LCD",
    brand: "Dell",
    model: "P2422H",
    specs: "—",
  },
  "Lenovo ThinkCentre M720": {
    category: "Desktop",
    brand: "Lenovo",
    model: "ThinkCentre M720",
    specs: "Intel Core i5 • 10th Gen • 8GB • 256GB SSD • 2.90GHz",
  },
};
