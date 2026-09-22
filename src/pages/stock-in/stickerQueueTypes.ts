export type StickerStatus = "PENDING" | "PRINTED";

export interface StickerQueueItem {
  id: number;
  assetId: string;
  listNumber: string;
  batchId: string;
  category: string;
  brand: string;
  model: string;
  processor: string;
  generation?: string;
  ram: string;
  storage: string;
  speed: string;
  screenType: string;
  status: StickerStatus;
  createdAt: string;
  printedAt: string | null;
}
