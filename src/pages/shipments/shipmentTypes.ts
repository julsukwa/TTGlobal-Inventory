export interface Shipment {
  id: number;
  shipmentId: string;
  shipmentName: string;
  vendor: string;
  itemsSent: number;
  itemsReceived: number;
  // Derived inventory status counts — computed from the inventory records
  // belonging to this shipment. Post-backend these come from the API;
  // for now they are held in the mock and updated optimistically.
  okCount: number;      // items with status "Ok"
  faultyCount: number;  // items with status "Faulty"
  issuedCount: number;  // items with status "Issued" (sold via Stock Out)
  shipmentReceivedDate: string;
  status: "Pending" | "In Progress" | "Complete";
}