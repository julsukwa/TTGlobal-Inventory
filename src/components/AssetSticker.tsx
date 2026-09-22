// ─── Asset Sticker ────────────────────────────────────────────────────────────
//
// A single 50mm x 25mm asset ID label, sized for a Zebra label printer via the
// browser's print dialog (see StickerPrintPreview). Renders at true mm size —
// on screen that's small by design; it's a print artifact, not a UI card.

import { QRCodeSVG } from "qrcode.react";
import "./AssetSticker.css";

export interface AssetStickerProps {
  assetId: string;
  batchId: string;
  brand: string;
  model: string;
  category: string;
  processor?: string;
  generation?: string;
  ram?: string;
  storage?: string;
  speed?: string;
  screenType?: string;
}

export function AssetSticker({
  assetId,
  batchId,
  brand,
  model,
  category,
  processor,
  generation,
  ram,
  storage,
  speed,
  screenType,
}: AssetStickerProps) {
  const processorLine = [processor, generation].filter(Boolean).join(" • ");
  const specsLine = [ram, storage, speed].filter(Boolean).join(" • ");

  return (
    <div className="asset-sticker">
      <div className="asset-sticker-info">
        <div className="asset-sticker-details">
          <div className="asset-sticker-title">
            {brand} {model}
          </div>
          <div className="asset-sticker-category">{category}</div>
          {processorLine && <div className="asset-sticker-processor">{processorLine}</div>}
          {specsLine && <div className="asset-sticker-specs">{specsLine}</div>}
          {screenType && <div className="asset-sticker-screen">{screenType}</div>}
        </div>

        <div className="asset-sticker-ids">
          <span className="asset-sticker-asset-id">{assetId}</span>
          <span className="asset-sticker-batch">{batchId}</span>
        </div>
      </div>

      <div className="asset-sticker-qr">
        <QRCodeSVG value={assetId} size={200} fgColor="#000000" bgColor="#ffffff" />
      </div>
    </div>
  );
}
