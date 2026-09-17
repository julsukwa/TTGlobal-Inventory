export interface ShipmentVendor {
  id: number;
  vendorId: string;
  name: string;
}

export type ShipmentStatus = "PENDING" | "IN_PROGRESS" | "COMPLETE";

// Matches the shape returned by GET /shipments and GET /shipments/:id.
// Inventory Remaining is not part of the API response — it's derived on the
// frontend as itemsReceived - issuedCount wherever it's displayed.
export interface Shipment {
  id: number;
  shipmentId: string;
  shipmentName: string;
  vendor: ShipmentVendor;
  itemsSent: number;
  itemsReceived: number;
  issuedCount: number;
  status: ShipmentStatus;
  shipmentReceivedDate: string; // ISO date string
  remarks: string;
  createdAt: string;
}
