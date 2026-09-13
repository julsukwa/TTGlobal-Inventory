import type { StockInShipment } from "./types";

export const stockInShipments: StockInShipment[] = [
  {
    id: 1,
    shipmentId: "CNT1",
    shipmentName: "Container 1",
    vendor: "TTL",
    itemsSent: 560,
    itemsReceived: 560,
    shipmentReceivedDate: "20/05/2024",
    status: "Complete",
  },

  {
    id: 2,
    shipmentId: "CNT2",
    shipmentName: "Container 2",
    vendor: "TTL",
    itemsSent: 430,
    itemsReceived: 418,
    shipmentReceivedDate: "22/05/2024",
    status: "In Progress",
  },

  {
    id: 3,
    shipmentId: "CNT3",
    shipmentName: "Container 3",
    vendor: "MWS",
    itemsSent: 620,
    itemsReceived: 612,
    shipmentReceivedDate: "19/05/2024",
    status: "In Progress",
  },

  {
    id: 4,
    shipmentId: "ASH1",
    shipmentName: "Air Shipment 1",
    vendor: "MWS",
    itemsSent: 300,
    itemsReceived: 298,
    shipmentReceivedDate: "18/05/2024",
    status: "In Progress",
  },

  {
    id: 5,
    shipmentId: "CONT4",
    shipmentName: "Container 4",
    vendor: "TTL",
    itemsSent: 210,
    itemsReceived: 209,
    shipmentReceivedDate: "17/05/2024",
    status: "In Progress",
  },

  {
    id: 6,
    shipmentId: "ASH2",
    shipmentName: "Air shipment 1",
    vendor: "TTL",
    itemsSent: 815,
    itemsReceived: 803,
    shipmentReceivedDate: "16/05/2026",
    status: "In Progress",
  },

  {
    id: 7,
    shipmentId: "CNT4",
    shipmentName: "Container 4",
    vendor: "TTL",
    itemsSent: 450,
    itemsReceived: 0,
    shipmentReceivedDate: "12/06/2026",
    status: "Pending",
  },
];

