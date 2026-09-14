import type {
  SessionInventoryItem,
} from "./manualStockInTypes";

export const mockSessionItems: SessionInventoryItem[] = [
  {
    id: 1,
    category: "Laptop",
    condition: "New",
    brand: "HP",
    model: "EliteBook 840 G8",
    processor: "Intel Core i5",
    generation: "11th Gen",
    ram: "8GB",
    storage: "256GB SSD",
    speed: "2.4GHz",
    screenType: "Standard Unit",
    additionalInfo: "",
    quantity: 20,
  },

  {
    id: 2,
    category: "Laptop",
    condition: "Refurb",
    brand: "Dell",
    model: "Latitude 5420",
    processor: "Intel Core i7",
    generation: "11th Gen",
    ram: "16GB",
    storage: "512GB SSD",
    speed: "2.6GHz",
    screenType: "Touch Screen",
    additionalInfo: "",
    quantity: 15,
  },

  {
    id: 3,
    category: "Desktop",
    condition: "Used",
    brand: "HP",
    model: "ProDesk 400 G6",
    processor: "Intel Core i5",
    generation: "10th Gen",
    ram: "8GB",
    storage: "256GB SSD",
    speed: "3.2GHz",
    screenType: "Standard Unit",
    additionalInfo: "",
    quantity: 10,
  },
];