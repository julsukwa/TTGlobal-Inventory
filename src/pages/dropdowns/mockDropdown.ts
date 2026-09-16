// ─── Dropdown value shape ──────────────────────────────────────────────────────
// Description and Active/Inactive status have been removed from this module —
// dropdown values are now simple name + date-added records. Deactivation/
// historical-preservation behavior described in the original documentation has
// been dropped per product decision; values can only be added or edited.
//
// DEPRECATED: `dropdownValues` is now only the real source of data for the
// "vendor" category — see DropdownPage.tsx. Vendor is a separate Prisma
// model (with vendorId/isActive) rather than a DropdownValue category and
// has no backend module yet, so it still reads/writes this mock array. Every
// other category here (itemType, fault, brand, ram, storage, processor,
// condition, generation) is fetched from the real /dropdowns API on load and
// only briefly shows this mock data before that fetch resolves; once a
// Vendor backend module exists, this file can be removed entirely.

export interface DropdownValue {
  id: number;
  name: string;
  dateAdded: string;
}

export const dropdownCategories = [
  {
    id: "itemType",
    name: "Item Type",
    count: 5,
  },

  {
    id: "fault",
    name: "Fault",
    count: 11,
  },

  {
    id: "vendor",
    name: "Vendor",
    count: 24,
  },

  {
    id: "brand",
    name: "Brand",
    count: 27,
  },

  {
    id: "ram",
    name: "RAM",
    count: 10,
  },

  {
    id: "storage",
    name: "Storage",
    count: 8,
  },

  {
    id: "processor",
    name: "Processor",
    count: 16,
  },

  {
    id: "condition",
    name: "Condition",
    count: 3,
  },

  {
    id: "generation",
    name: "Generation",
    count: 9,
  },
];

export const dropdownValues = {
  itemType: [
    { id: 1, name: "Laptop", dateAdded: "10/05/2024" },
    { id: 2, name: "Desktop", dateAdded: "10/05/2024" },
    { id: 3, name: "All In One", dateAdded: "10/05/2024" },
    { id: 4, name: "Workstation", dateAdded: "10/05/2024" },
    { id: 5, name: "LCD", dateAdded: "10/05/2024" },
  ],

  fault: [
    { id: 1, name: "Screen Fault", dateAdded: "10/05/2024" },
    { id: 2, name: "Battery Fault", dateAdded: "10/05/2024" },
    { id: 3, name: "Keyboard Fault", dateAdded: "10/05/2024" },
    { id: 4, name: "LCD Spot", dateAdded: "10/05/2024" },
    { id: 5, name: "Dead Board", dateAdded: "10/05/2024" },
    { id: 6, name: "No Display", dateAdded: "10/05/2024" },
    { id: 7, name: "HDD Failure", dateAdded: "10/05/2024" },
    { id: 8, name: "No Power", dateAdded: "10/05/2024" },
    { id: 9, name: "Touchpad Fault", dateAdded: "10/05/2024" },
    { id: 10, name: "RAM Fault", dateAdded: "10/05/2024" },
    { id: 11, name: "Overheating", dateAdded: "10/05/2024" },
  ],

  vendor: [
    { id: 1, name: "TTL", dateAdded: "10/05/2024" },
    { id: 2, name: "MWS", dateAdded: "10/05/2024" },
  ],

  brand: [
    { id: 1, name: "HP", dateAdded: "10/05/2024" },
    { id: 2, name: "Lenovo", dateAdded: "10/05/2024" },
    { id: 3, name: "Dell", dateAdded: "10/05/2024" },
  ],

  ram: [
    { id: 1, name: "4GB", dateAdded: "10/05/2024" },
    { id: 2, name: "8GB", dateAdded: "10/05/2024" },
    { id: 3, name: "16GB", dateAdded: "10/05/2024" },
  ],

  storage: [
    { id: 1, name: "256GB SSD", dateAdded: "10/05/2024" },
    { id: 2, name: "512GB SSD", dateAdded: "10/05/2024" },
    { id: 3, name: "1TB HDD", dateAdded: "10/05/2024" },
  ],

  processor: [
    { id: 1, name: "Intel Core i5", dateAdded: "10/05/2024" },
    { id: 2, name: "Intel Core i7", dateAdded: "10/05/2024" },
    { id: 3, name: "AMD Ryzen 5", dateAdded: "10/05/2024" },
  ],

  condition: [
    { id: 1, name: "New", dateAdded: "10/05/2024" },
    { id: 2, name: "Refurb", dateAdded: "10/05/2024" },
    { id: 3, name: "Used", dateAdded: "10/05/2024" },
  ],

  generation: [
    { id: 1, name: "10th Gen", dateAdded: "10/05/2024" },
    { id: 2, name: "11th Gen", dateAdded: "10/05/2024" },
    { id: 3, name: "12th Gen", dateAdded: "10/05/2024" },
  ],
};