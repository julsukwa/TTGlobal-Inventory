export class AdjustmentItemDto {
  assetId: string;
  faultTypes: string[]; // array of fault type strings, minimum 1
  notes?: string;
}

export class CreateAdjustmentDto {
  items: AdjustmentItemDto[]; // minimum 1 item
}
