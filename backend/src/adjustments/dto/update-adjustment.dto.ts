export class UpdateAdjustmentDto {
  faultTypes?: string[]; // must have at least 1 if provided
  notes?: string;
}
