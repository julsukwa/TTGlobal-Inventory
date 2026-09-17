export class StockOutItemDto {
  assetId: string;
  source: 'scan' | 'list-number' | 'batch';
}

export class CreateStockOutDto {
  customerId: number;
  invoiceNumber: string; // unique identifier, must not be empty
  notes?: string;
  assetIds?: string[]; // kept for backward compatibility — defaults source to 'scan'
  items?: StockOutItemDto[]; // preferred — carries source per item
}
