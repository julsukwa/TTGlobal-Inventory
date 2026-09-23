export class ManualStockInItemDto {
  listNumber?: string; // omitted/empty => item gets a ShipmentID-YY-NNNN asset ID instead
  assetIdSource: 'generated' | 'provided';
  providedAssetId?: string; // required when assetIdSource is 'provided'
  category: string;
  condition?: string;
  brand: string;
  model: string;
  processor?: string;
  generation?: string;
  ram?: string;
  storage?: string;
  speed?: string;
  screenType?: string;
  notes?: string;
  quantity: number; // must be positive integer
}

export class ManualStockInDto {
  shipmentId: number; // FK to Shipment.id
  items: ManualStockInItemDto[];
}
