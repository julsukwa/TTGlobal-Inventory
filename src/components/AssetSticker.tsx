// ─── Asset Sticker ────────────────────────────────────────────────────────────
//
// A single 50mm x 25mm asset ID label, sized for a Zebra label printer via the
// browser's print dialog (see StickerPrintPreview). Renders at true mm size —
// on screen that's small by design; it's a print artifact, not a UI card.
//
// Layout: one text column on the left (title, category, specs, then asset
// ID/batch ID) with the QR code floated to the right and vertically centered
// alongside it. The title is rendered as SVG text with `textLength` set to
// the full available column width — this is the one reliable cross-browser
// way to force text of any length onto exactly one line at a fixed width, by
// having the browser adjust glyph spacing rather than truncating with an
// ellipsis or relying on JS-measured scale transforms.

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

const TITLE_WIDTH_MM = 46; // 50mm sticker - 2mm left margin - 2mm right margin (full width)
const TITLE_WIDTH_PX = 174; // 46mm at 96dpi
const TITLE_HEIGHT_PX = 13;

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
  const titleText = `${brand} ${model}`.trim();
  const processorLine = [processor, generation].filter(Boolean).join(" • ");
  const specsLine = [ram, storage, speed].filter(Boolean).join(" • ");

  return (
    <div className="asset-sticker">
      <div className="asset-sticker-title-row">
        <svg
          className="asset-sticker-title"
          width={`${TITLE_WIDTH_MM}mm`}
          height="3.5mm"
          viewBox={`0 0 ${TITLE_WIDTH_PX} ${TITLE_HEIGHT_PX}`}
        >
          <text
            x="0"
            y="10"
            fontFamily="Arial, sans-serif"
            fontSize="11"
            fontWeight="bold"
            fill="#111111"
            textLength={TITLE_WIDTH_PX}
            lengthAdjust="spacingAndGlyphs"
          >
            {titleText}
          </text>
        </svg>
      </div>

      <div className="asset-sticker-info">
        <div className="asset-sticker-details">
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
