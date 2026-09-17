import { ManualStockInItemDto } from './manual-stock-in.dto.js';

export class CsvStockInDto {
  shipmentId: number;
  uploadType: 'summary' | 'detailed';
  rows: ManualStockInItemDto[]; // reuse the same item DTO
}
