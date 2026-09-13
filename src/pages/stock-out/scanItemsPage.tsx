import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Scan,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  User,
} from "lucide-react";

import "./ScanItemsPage.css";
import { mockInventoryPool } from "./mockStockOut";
import type { ScannedItem, Customer } from "./stockOutTypes";

// BACKEND INTEGRATION SEAM:
// Asset lookup on scan: GET /inventory/:assetId
// Returns the item if it exists and is status Ok or Faulty, errors otherwise.

interface LocationState {
  customer: Customer;
  invoiceNumber: string;
  notes: string;
}

type ScanError =
  | "not_found"
  | "already_issued"
  | "duplicate_scan"
  | null;

export default function ScanItemsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  // Guard: if accessed directly without state, redirect back
  useEffect(() => {
    if (!state?.customer || !state?.invoiceNumber) {
      navigate("/stock-out/new");
    }
  }, [state, navigate]);

  const [assetInput, setAssetInput] = useState("");
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [scanError, setScanError] = useState<ScanError>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep input focused for barcode scanner hardware — scanners just type
  // the barcode value and hit Enter, so this field must always have focus.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const buildSpecsString = (item: ScannedItem) => {
    const parts = [
      item.processor,
      item.generation,
      item.ram,
      item.storage,
      item.speed,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" • ") : "—";
  };

  const handleScan = () => {
    const assetId = assetInput.trim().toUpperCase();
    setScanError(null);
    setLastScanned(null);

    if (!assetId) return;

    // Check duplicate in current session
    if (scannedItems.some((i) => i.assetId === assetId)) {
      setScanError("duplicate_scan");
      setAssetInput("");
      return;
    }

    // BACKEND INTEGRATION SEAM: replace lookup below with
    // GET /inventory/:assetId — returns item or 404
    const found = mockInventoryPool.find((i) => i.assetId === assetId);

    if (!found) {
      setScanError("not_found");
      setAssetInput("");
      return;
    }

    // Both Ok and Faulty items are eligible for Stock Out
    setScannedItems((prev) => [...prev, found]);
    setLastScanned(assetId);
    setAssetInput("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleScan();
  };

  const handleRemoveItem = (assetId: string) => {
    setScannedItems((prev) => prev.filter((i) => i.assetId !== assetId));
  };

  const handleProceedToReview = () => {
    if (scannedItems.length === 0) return;
    navigate("/stock-out/review", {
      state: {
        ...state,
        items: scannedItems,
      },
    });
  };

  const getScanErrorMessage = () => {
    switch (scanError) {
      case "not_found":
        return "Asset ID not found in the system. Please check and try again.";
      case "already_issued":
        return "This item has already been issued and cannot be sold again.";
      case "duplicate_scan":
        return "This item has already been scanned in this session.";
      default:
        return null;
    }
  };

  if (!state) return null;

  return (
    <div className="scan-page">
      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <div className="scan-breadcrumb">
        Stock Out &gt; New Stock Out &gt; Scan Items
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="scan-header">
        <div>
          <h1>Scan Items</h1>
          <p>Scan or enter Asset IDs to add items to this transaction.</p>
        </div>
        <button
          className="scan-back-btn"
          onClick={() => navigate("/stock-out/new")}
        >
          <ArrowLeft size={14} />
          Back
        </button>
      </div>

      {/* ── Transaction context banner ───────────────────────────────────────── */}
      <div className="scan-context-banner">
        <div className="scan-context-item">
          <User size={14} />
          <div>
            <span>Customer</span>
            <p>{state.customer.name}</p>
          </div>
        </div>
        <div className="scan-context-divider" />
        <div className="scan-context-item">
          <span className="scan-context-label-icon">📄</span>
          <div>
            <span>Invoice</span>
            <p>{state.invoiceNumber}</p>
          </div>
        </div>
        <div className="scan-context-divider" />
        <div className="scan-context-item">
          <span className="scan-context-label-icon">📦</span>
          <div>
            <span>Items Scanned</span>
            <p className="scan-count">{scannedItems.length}</p>
          </div>
        </div>
      </div>

      <div className="scan-body">
        {/* ── Scanner input ─────────────────────────────────────────────────── */}
        <div className="scan-input-card">
          <div className="scan-input-header">
            <Scan size={16} />
            <h2>Asset ID Entry</h2>
          </div>
          <p className="scan-input-desc">
            Scan a barcode or manually enter an Asset ID, then press Enter or click Add.
          </p>

          <div className="scan-input-row">
            <div className={`scan-input-wrap ${scanError ? "scan-input-has-error" : lastScanned ? "scan-input-success" : ""}`}>
              <input
                ref={inputRef}
                type="text"
                placeholder="e.g. CNT1-TTL-26-0001"
                value={assetInput}
                onChange={(e) => {
                  setAssetInput(e.target.value.toUpperCase());
                  setScanError(null);
                  setLastScanned(null);
                }}
                onKeyDown={handleKeyDown}
                className="scan-asset-input"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button
              className="scan-add-btn"
              onClick={handleScan}
              disabled={!assetInput.trim()}
            >
              Add Item
            </button>
          </div>

          {/* Feedback */}
          {scanError && (
            <div className="scan-feedback scan-feedback-error">
              <AlertTriangle size={14} />
              {getScanErrorMessage()}
            </div>
          )}
          {lastScanned && !scanError && (
            <div className="scan-feedback scan-feedback-success">
              <CheckCircle2 size={14} />
              <strong>{lastScanned}</strong> added successfully.
            </div>
          )}

          <div className="scan-hint">
            <span>✓ Both Ok and Faulty items can be issued</span>
            <span>✓ Hardware barcode scanners are supported</span>
          </div>
        </div>

        {/* ── Session table ──────────────────────────────────────────────────── */}
        <div className="scan-session-card">
          <div className="scan-session-header">
            <h2>Scanned Items ({scannedItems.length})</h2>
            {scannedItems.length > 0 && (
              <button
                className="scan-clear-btn"
                onClick={() => setScannedItems([])}
              >
                Clear All
              </button>
            )}
          </div>

          {scannedItems.length === 0 ? (
            <div className="scan-empty">
              <Scan size={32} />
              <p>No items scanned yet.</p>
              <span>Scan or enter an Asset ID above to add items.</span>
            </div>
          ) : (
            <div className="scan-table-wrap">
              <table className="scan-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Asset ID</th>
                    <th>Category</th>
                    <th>Brand</th>
                    <th>Model</th>
                    <th>Specs</th>
                    <th>Status</th>
                    <th>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {scannedItems.map((item, idx) => (
                    <tr key={item.assetId}>
                      <td className="scan-row-num">{idx + 1}</td>
                      <td className="scan-asset-id">{item.assetId}</td>
                      <td>{item.category}</td>
                      <td>{item.brand}</td>
                      <td>{item.model}</td>
                      <td className="scan-specs">{buildSpecsString(item)}</td>
                      <td>
                        <span
                          className={`scan-status-pill ${
                            item.status === "Ok"
                              ? "scan-status-ok"
                              : "scan-status-faulty"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="scan-remove-btn"
                          onClick={() => handleRemoveItem(item.assetId)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer actions ──────────────────────────────────────────────────── */}
      <div className="scan-footer-actions">
        <button
          className="scan-cancel-btn"
          onClick={() => navigate("/stock-out")}
        >
          Cancel
        </button>
        <button
          className="scan-review-btn"
          onClick={handleProceedToReview}
          disabled={scannedItems.length === 0}
        >
          Review & Confirm ({scannedItems.length} item
          {scannedItems.length !== 1 ? "s" : ""}) →
        </button>
      </div>
    </div>
  );
}