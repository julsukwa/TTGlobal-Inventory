export class UpdateShipmentDto {
  shipmentName?: string;
  vendorId?: number;
  itemsSent?: number;
  shipmentReceivedDate?: string;
  remarks?: string;
  // shipmentId is intentionally excluded — immutable after creation
}
