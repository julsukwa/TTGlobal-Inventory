import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Scan,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  User,
  X,
} from "lucide-react";

import "./ScanItemsPage.css";
import { mockInventoryPool } from "./mockStockOut";
import type { ScannedItem, ScannedItemSource, Customer } from "./stockOutTypes";
import { Modal, Button } from "../../components/ui";

// BACKEND INTEGRATION SEAM:
// Asset lookup on scan: GET /inventory/:assetId
// Returns the item if it exists and is status Ok or Faulty, errors otherwise.
//
// The two bulk-add methods below (List Number, Batch ID) will eventually
// call their own lookup endpoints too:
//   GET /inventory?listNumber=:listNumber
//   GET /inventory?batchId=:batchId
// both scoped to status Ok/Faulty and not-yet-issued, same as the scan path.

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

/** Which of the two bulk-add sections a pending/skipped-count result belongs
 * to, so feedback renders under the right input. */
type BulkTarget = "list" | "batch";

interface ShipmentOption {
  shipmentId: string;
  vendor: string;
  items: ScannedItem[];
}

interface DisambiguationState {
  listNumber: string;
  options: ShipmentOption[];
  skippedCount: number;
}

interface PendingFaultyAdd {
  items: ScannedItem[];
  source: ScannedItemSource;
  skippedCount: number;
  target: BulkTarget;
}

/** Batch IDs in this system follow ShipmentID-VendorID-YY-NNNN (see
 * mockDatabase.ts) — pulling the vendor segment out of it avoids needing a
 * separate vendor field/lookup just for the disambiguation modal. */
function extractVendorFromBatchId(batchId: string): string {
  const parts = batchId.split("-");
  return parts.length >= 2 ? parts[1] : "—";
}

// The mock inventory pool can only ever contain "Ok" | "Faulty" items (see
// StockOutItemStatus) — a real inventory endpoint could still hand back a
// stale "Issued" row, so this filter is kept (and type-cast) defensively
// rather than assumed away.
function isIssuedStatus(item: ScannedItem): boolean {
  return (item.status as string) === "Issued";
}

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

  // ── Bulk by List Number ───────────────────────────────────────────────────
  const [listNumberInput, setListNumberInput] = useState("");
  const [listError, setListError] = useState<string | null>(null);
  const [listSkipped, setListSkipped] = useState<number | null>(null);

  // ── Bulk by Batch ID ──────────────────────────────────────────────────────
  const [batchIdInput, setBatchIdInput] = useState("");
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchSkipped, setBatchSkipped] = useState<number | null>(null);

  // ── Unified Bulk Add form — which lookup type is currently selected. The
  // two states above stay fully independent; this just decides which one the
  // single input/button/feedback in the Bulk Add card is currently driving.
  const [bulkType, setBulkType] = useState<BulkTarget>("list");

  // ── Shared bulk-add modals ───────────────────────────────────────────────
  const [disambiguation, setDisambiguation] = useState<DisambiguationState | null>(null);
  const [pendingFaultyAdd, setPendingFaultyAdd] = useState<PendingFaultyAdd | null>(null);

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

  // ── Method 1 — Scan Individual Item (unchanged behaviour, source added) ──

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
    setScannedItems((prev) => [...prev, { ...found, source: "scan" }]);
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

  // ── Shared bulk-add plumbing ─────────────────────────────────────────────

  /** Items already-Issued or already in this session are ineligible; returns
   * what's left plus how many were dropped, for the skipped-count message. */
  const filterEligible = (matches: ScannedItem[]) => {
    const eligible = matches.filter(
      (item) => !isIssuedStatus(item) && !scannedItems.some((s) => s.assetId === item.assetId)
    );
    return { eligible, skippedCount: matches.length - eligible.length };
  };

  /** Actually appends items to the session, tagging them with how they were
   * added, and updates the right section's skipped-count feedback. */
  const finalizeAdd = (
    items: ScannedItem[],
    source: ScannedItemSource,
    skippedCount: number,
    target: BulkTarget
  ) => {
    setScannedItems((prev) => [...prev, ...items.map((item) => ({ ...item, source }))]);

    if (target === "list") {
      setListNumberInput("");
      setListSkipped(skippedCount > 0 ? skippedCount : null);
    } else {
      setBatchIdInput("");
      setBatchSkipped(skippedCount > 0 ? skippedCount : null);
    }
  };

  /** Resolves a set of eligible items into either a direct add or the Faulty
   * Items warning modal, depending on whether any of them are Faulty. */
  const resolveAdd = (
    items: ScannedItem[],
    source: ScannedItemSource,
    skippedCount: number,
    target: BulkTarget
  ) => {
    const hasFaulty = items.some((item) => item.status === "Faulty");
    if (hasFaulty) {
      setPendingFaultyAdd({ items, source, skippedCount, target });
      return;
    }
    finalizeAdd(items, source, skippedCount, target);
  };

  const handleConfirmFaultyAdd = () => {
    if (!pendingFaultyAdd) return;
    const { items, source, skippedCount, target } = pendingFaultyAdd;
    setPendingFaultyAdd(null);
    finalizeAdd(items, source, skippedCount, target);
  };

  const handleCancelFaultyAdd = () => setPendingFaultyAdd(null);

  // ── Method 2 — Bulk Add by List Number ───────────────────────────────────

  const handleAddByListNumber = () => {
    const query = listNumberInput.trim();
    setListError(null);
    setListSkipped(null);
    if (!query) return;

    const matches = mockInventoryPool.filter(
      (item) => item.listNumber.trim().toLowerCase() === query.toLowerCase()
    );

    if (matches.length === 0) {
      setListError(`No items found for list number ${query}`);
      return;
    }

    const { eligible, skippedCount } = filterEligible(matches);

    if (eligible.length === 0) {
      setListError(
        `All items in list ${query} have already been issued or added to this session`
      );
      return;
    }

    const uniqueShipmentIds = [...new Set(eligible.map((item) => item.shipmentId))];

    if (uniqueShipmentIds.length > 1) {
      const options: ShipmentOption[] = uniqueShipmentIds.map((shipmentId) => {
        const items = eligible.filter((item) => item.shipmentId === shipmentId);
        return {
          shipmentId,
          vendor: extractVendorFromBatchId(items[0].batchId),
          items,
        };
      });
      setDisambiguation({ listNumber: query, options, skippedCount });
      return;
    }

    resolveAdd(eligible, "list-number", skippedCount, "list");
  };

  const handleSelectShipment = (option: ShipmentOption) => {
    if (!disambiguation) return;
    const { skippedCount } = disambiguation;
    setDisambiguation(null);
    resolveAdd(option.items, "list-number", skippedCount, "list");
  };

  // ── Method 3 — Bulk Add by Batch ID ──────────────────────────────────────

  const handleAddByBatchId = () => {
    const query = batchIdInput.trim();
    setBatchError(null);
    setBatchSkipped(null);
    if (!query) return;

    const matches = mockInventoryPool.filter(
      (item) => item.batchId.trim().toLowerCase() === query.toLowerCase()
    );

    if (matches.length === 0) {
      setBatchError(`No items found for Batch ID ${query}`);
      return;
    }

    const { eligible, skippedCount } = filterEligible(matches);

    if (eligible.length === 0) {
      setBatchError(
        `All items in batch ${query} have already been issued or added to this session`
      );
      return;
    }

    // Batch ID is globally unique to one shipment/import session, so there's
    // never a disambiguation step here.
    resolveAdd(eligible, "batch", skippedCount, "batch");
  };

  // ── Unified Bulk Add form ─────────────────────────────────────────────────
  // Single entry point for both lookup types — dispatches to whichever
  // handler above matches the currently selected bulkType. The underlying
  // logic for each type is untouched; this is purely a UI routing layer.

  const bulkInputValue = bulkType === "list" ? listNumberInput : batchIdInput;
  const bulkError = bulkType === "list" ? listError : batchError;
  const bulkSkipped = bulkType === "list" ? listSkipped : batchSkipped;
  const bulkPlaceholder =
    bulkType === "list" ? "e.g. LIST-A, BATCH-001" : "e.g. CNT1-TTL-26-0001";

  const handleBulkInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (bulkType === "list") {
      setListNumberInput(e.target.value);
      setListError(null);
    } else {
      setBatchIdInput(e.target.value);
      setBatchError(null);
    }
  };

  const runBulkAdd = () => {
    if (bulkType === "list") handleAddByListNumber();
    else handleAddByBatchId();
  };

  const handleBulkKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") runBulkAdd();
  };

  const handleDismissBulkSkipped = () => {
    if (bulkType === "list") setListSkipped(null);
    else setBatchSkipped(null);
  };

  // ── Review / navigation ───────────────────────────────────────────────────

  const handleProceedToReview = () => {
    if (scannedItems.length === 0) return;
    navigate("/stock-out/review", {
      state: {
        ...state,
        items: scannedItems,
      },
    });
  };

  const sourceLabel = (item: ScannedItem) => {
    if (item.source === "list-number") return `List: ${item.listNumber}`;
    if (item.source === "batch") return `Batch: ${item.batchId}`;
    return "Scan";
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

      <div className="scan-methods-grid">
        {/* ── Method 1 — Scan Individual Item (unchanged) ──────────────────────── */}
        <div>
          <h2 className="scan-method-heading">Method 1 — Scan Individual Item</h2>
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
        </div>

        {/* ── Bulk Add — unified List Number / Batch ID lookup ─────────────────── */}
        <div>
          <h2 className="scan-method-heading">Bulk Add</h2>
          <div className="scan-bulk-card">
            <p className="scan-input-desc">
              Add all eligible items by List Number or Batch ID.
            </p>

            <div className="bulk-unified-row">
              <select
                className="bulk-type-select"
                value={bulkType}
                onChange={(e) => setBulkType(e.target.value as BulkTarget)}
              >
                <option value="list">By List Number</option>
                <option value="batch">By Batch ID</option>
              </select>
              <input
                type="text"
                placeholder={bulkPlaceholder}
                value={bulkInputValue}
                onChange={handleBulkInputChange}
                onKeyDown={handleBulkKeyDown}
                className="scan-bulk-input"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                className="scan-add-btn"
                onClick={runBulkAdd}
                disabled={!bulkInputValue.trim()}
              >
                Add Items
              </button>
            </div>

            {bulkError && (
              <div className="scan-feedback scan-feedback-error">
                <AlertTriangle size={14} />
                {bulkError}
              </div>
            )}

            {bulkSkipped !== null && (
              <div className="scan-feedback scan-feedback-info">
                <span>
                  {bulkSkipped} item{bulkSkipped !== 1 ? "s" : ""} were skipped — already
                  issued or already in this session.
                </span>
                <button
                  className="scan-dismiss-btn"
                  onClick={handleDismissBulkSkipped}
                  aria-label="Dismiss"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
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
                    <th>List Number</th>
                    <th>Category</th>
                    <th>Brand</th>
                    <th>Model</th>
                    <th>Specs</th>
                    <th>Status</th>
                    <th>Source</th>
                    <th>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {scannedItems.map((item, idx) => (
                    <tr key={item.assetId}>
                      <td className="scan-row-num">{idx + 1}</td>
                      <td className="scan-asset-id">{item.assetId}</td>
                      <td>{item.listNumber || "—"}</td>
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
                        <span className={`scan-source-pill source-${item.source}`}>{sourceLabel(item)}</span>
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

      {/* ── Shipment disambiguation modal (Method 2 only) ───────────────────── */}
      <Modal
        isOpen={disambiguation !== null}
        onClose={() => setDisambiguation(null)}
        title="Multiple Shipments Found"
        width={480}
      >
        {disambiguation && (
          <>
            <p>
              List number <strong>{disambiguation.listNumber}</strong> exists in{" "}
              <strong>{disambiguation.options.length}</strong> shipments. Choose which
              shipment to pull from:
            </p>
            <div className="scan-shipment-options">
              {disambiguation.options.map((option) => (
                <div key={option.shipmentId} className="scan-shipment-option">
                  <div>
                    <strong>{option.shipmentId}</strong>
                    <span> · {option.vendor}</span>
                    <p>
                      {option.items.length} eligible item{option.items.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Button variant="primary" onClick={() => handleSelectShipment(option)}>
                    Select
                  </Button>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setDisambiguation(null)}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Faulty items warning modal (Methods 2 and 3) ─────────────────────── */}
      <Modal
        isOpen={pendingFaultyAdd !== null}
        onClose={handleCancelFaultyAdd}
        title="Faulty Items Included"
        width={440}
      >
        {pendingFaultyAdd && (
          <>
            <p>
              This list includes{" "}
              <strong>
                {pendingFaultyAdd.items.filter((item) => item.status === "Faulty").length}
              </strong>{" "}
              faulty item(s). These will be marked as Issued on confirmation. Do you want to
              proceed?
            </p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={handleCancelFaultyAdd}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmFaultyAdd}>
                Yes, Add Items
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
