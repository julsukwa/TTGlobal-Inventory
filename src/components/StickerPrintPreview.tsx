// ─── Sticker Print Preview ────────────────────────────────────────────────────
//
// Full-screen overlay that previews one or more asset stickers and prints
// them via the browser's native print dialog. The @media print rules in
// StickerPrintPreview.css hide everything else on the page (sidebar, topbar,
// this overlay's own toolbar) and lay the stickers out one per 50mm x 25mm
// page — see that file for the print-specific layout.

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { AssetSticker } from "./AssetSticker";
import type { AssetStickerProps } from "./AssetSticker";
import "./StickerPrintPreview.css";

export interface StickerPrintPreviewProps {
  stickers: AssetStickerProps[];
  onClose: () => void;
}

export function StickerPrintPreview({ stickers, onClose }: StickerPrintPreviewProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    document.body.setAttribute("data-printing-stickers", "true");
    return () => document.body.removeAttribute("data-printing-stickers");
  }, []);

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 250);
  };

  return createPortal(
    <div className="stk-print-root">
      <div className="stk-print-toolbar">
        <span>
          {stickers.length} sticker{stickers.length !== 1 ? "s" : ""} ready to print
        </span>
        <div className="stk-print-toolbar-actions">
          <button className="stk-print-btn-primary" onClick={handlePrint}>
            <Printer size={14} />
            Print
          </button>
          <button className="stk-print-btn-secondary" onClick={onClose}>
            <X size={14} />
            Close
          </button>
        </div>
      </div>

      <div className="stk-print-grid">
        {stickers.map((sticker, index) => (
          <div className="stk-print-page" key={`${sticker.assetId}-${index}`}>
            <div style={{ width: "50mm", height: "25mm", overflow: "hidden" }}>
              <AssetSticker {...sticker} />
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}
