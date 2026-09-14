import type { MouseEvent, ReactNode } from "react";
import { X } from "lucide-react";
import "./Modal.css";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: number | string;
}

export function Modal({ isOpen, onClose, title, children, width = 520 }: ModalProps) {
  if (!isOpen) return null;

  const resolvedWidth = typeof width === "number" ? `${width}px` : width;

  // Only close when the overlay itself is clicked, not when a click inside
  // the modal content bubbles up to it.
  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="ui-modal-overlay" onClick={handleOverlayClick}>
      <div className="ui-modal" style={{ width: resolvedWidth }}>
        <div className="ui-modal-header">
          {title && <h2 className="ui-modal-title">{title}</h2>}
          <button className="ui-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="ui-modal-body">{children}</div>
      </div>
    </div>
  );
}
