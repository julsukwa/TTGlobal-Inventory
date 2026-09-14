export interface SessionInventoryItem {
  id: number;

  listNumber: string;

  assetIdSource: "generated" | "provided";

  providedAssetId: string;

  category: string;

  condition: string;

  brand: string;

  model: string;

  processor: string;

  generation: string;

  ram: string;

  storage: string;

  speed: string;

  screenType: string;

  additionalInfo: string;

  quantity: number;
}

/** One list-number group as rendered in the session table — every item
 * added under the same List Number, plus the group's combined quantity. */
export interface ListNumberGroup {
  listNumber: string;
  items: SessionInventoryItem[];
  totalQuantity: number;
}
