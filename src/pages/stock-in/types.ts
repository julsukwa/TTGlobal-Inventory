export interface StockInShipment {
  id: number;

  shipmentId: string;

  shipmentName: string;

  vendor: string;

  itemsSent: number;

  itemsReceived: number;

  shipmentReceivedDate: string;

  status: "Pending" | "In Progress" | "Complete";
}