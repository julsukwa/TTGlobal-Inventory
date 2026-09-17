export class CreateShipmentDto {
  shipmentId: string; // unique identifier e.g. CNT1, ASH1
  shipmentName: string;
  vendorId: number; // FK to Vendor.id
  itemsSent: number; // must be positive integer
  shipmentReceivedDate: string; // ISO date string
  remarks?: string;
}
