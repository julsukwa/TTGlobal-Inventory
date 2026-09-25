export class UpdateInventoryDto {
  condition?: string;
  brand?: string;
  model?: string;
  processor?: string;
  generation?: string;
  ram?: string;
  storage?: string;
  speed?: string;
  screenType?: string;
  notes?: string;
  // Protected fields that cannot be updated:
  // assetId, assetIdSource, listNumber, batchId, shipmentId, status, importedAt
}
