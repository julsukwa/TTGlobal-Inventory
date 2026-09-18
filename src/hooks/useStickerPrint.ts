import { useState } from "react";
import type { AssetStickerProps } from "../components/AssetSticker";

/** Manages the sticker print preview overlay's state — one shared session
 * per page, used for both single-item and batch print actions. */
export function useStickerPrint() {
  const [printStickers, setPrintStickers] = useState<AssetStickerProps[]>([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const printSingle = (item: AssetStickerProps) => {
    setPrintStickers([item]);
    setShowPrintPreview(true);
  };

  const printBatch = (items: AssetStickerProps[]) => {
    setPrintStickers(items);
    setShowPrintPreview(true);
  };

  const closePrint = () => {
    setShowPrintPreview(false);
    setPrintStickers([]);
  };

  return { printStickers, showPrintPreview, printSingle, printBatch, closePrint };
}
