export interface ShipmentWorkspace {
  shipmentId: string;
  shipmentName: string;

  vendorId: string;
  vendorName: string;

  itemsSent: number;
  itemsReceived: number;

  shipmentReceivedDate: string;

  pendingStickers: number;
}