import { useEffect, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  Hash,
  LayoutGrid,
  Database,
  Tag,
  RefreshCw,
  Copy,
  Info,
  AlertTriangle,
} from "lucide-react";

import "./StockInProcessingPage.css";
import { stockInShipments } from "./mockStockIn";
import type { SessionInventoryItem } from "./manualStockInTypes";

// ─── Processing step definitions ──────────────────────────────────────────────

type StepKey = "batch" | "validation" | "assetIds" | "records" | "sticker" | "reconcile" | "finalise";
type StepStatus = "pending" | "active" | "done";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "batch",      label: "Batch ID Generated"               },
  { key: "validation", label: "Validation Completed"             },
  { key: "assetIds",   label: "Generating Asset IDs"             },
  { key: "records",    label: "Creating Inventory Records"       },
  { key: "sticker",    label: "Adding Items To Sticker Queue"    },
  { key: "reconcile",  label: "Updating Shipment Reconciliation" },
  { key: "finalise",   label: "Finalizing Upload Session"        },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateBatchId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "BCH-";
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function generateAssetId(shipmentId: string, vendor: string, index: number): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const vendorCode = vendor.slice(0, 3).toUpperCase();
  const num = String(index + 1).padStart(4, "0");
  return `${shipmentId}-${vendorCode}-${year}-${num}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogEntry { time: string; message: string; done: boolean; }
interface LiveStats {
  batchGenerated: string;
  assetIdsGenerated: number;
  inventoryRecordsCreated: number;
  stickerQueueEntries: number;
  shipmentReconciliation: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StockInProcessingPage() {
  const navigate = useNavigate();
  const { shipmentId } = useParams();
  const location = useLocation();

  // Session items passed through navigation state from either ManualStockInPage
  // or ImportCsvPreviewPage. Both paths converge on the same SessionInventoryItem
  // shape, so this page (and its downstream completion page) doesn't need to
  // know or care which entry method produced them.
  const sessionItems: SessionInventoryItem[] = location.state?.sessionItems ?? [];
  const source: "manual" | "csv" = location.state?.source ?? "manual";
  const csvFileName: string | undefined = location.state?.csvFileName;
  const csvRowCount: number | undefined = location.state?.csvRowCount;

  const shipment = stockInShipments.find((s) => s.shipmentId === shipmentId);

  const totalItems = sessionItems.reduce((sum, i) => sum + i.quantity, 0);
  const batchId = useState(() => generateBatchId())[0];
  const importDate = useState(() => new Date())[0];

  const [stepStatuses, setStepStatuses] = useState<Record<StepKey, StepStatus>>({
    batch: "pending", validation: "pending", assetIds: "pending",
    records: "pending", sticker: "pending", reconcile: "pending", finalise: "pending",
  });
  const [assetIdsDone, setAssetIdsDone] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Initialising stock-in session...");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [liveStats, setLiveStats] = useState<LiveStats>({
    batchGenerated: "0 / 1",
    assetIdsGenerated: 0,
    inventoryRecordsCreated: 0,
    stickerQueueEntries: 0,
    shipmentReconciliation: "0 / 1",
  });
  const [copied, setCopied] = useState(false);

  const addLog = (message: string, done = false) => {
    setLog((prev) => [{ time: formatTime(new Date()), message, done }, ...prev]);
  };

  const setStep = (key: StepKey, status: StepStatus) => {
    setStepStatuses((prev) => ({ ...prev, [key]: status }));
  };

  // ─── Simulated processing sequence ──────────────────────────────────────────

  useEffect(() => {
    if (!shipment) return;

    const run = async () => {
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

      // Step 1 — Batch ID
      await delay(600);
      setStep("batch", "active");
      setStatusMessage("Generating Batch ID...");
      setOverallProgress(5);
      await delay(800);
      setStep("batch", "done");
      setLiveStats((p) => ({ ...p, batchGenerated: "1 / 1" }));
      addLog(`Batch ID ${batchId} generated`, true);
      setOverallProgress(12);

      // Step 2 — Validation
      await delay(500);
      setStep("validation", "active");
      setStatusMessage(
        source === "csv" ? "Re-validating CSV rows..." : "Validating session records..."
      );
      await delay(700);
      setStep("validation", "done");
      addLog(
        source === "csv"
          ? `Validated ${csvRowCount ?? totalItems} CSV row(s) successfully`
          : "Validation completed successfully",
        true
      );
      setOverallProgress(20);

      // Step 3 — Asset IDs (incremental)
      setStep("assetIds", "active");
      setStatusMessage("Generating asset IDs and creating inventory records...");
      for (let i = 0; i < totalItems; i++) {
        await delay(Math.random() * 120 + 60);
        const assetId = generateAssetId(shipment.shipmentId, shipment.vendor, i);
        addLog(`Generated ${assetId}`);
        setAssetIdsDone(i + 1);
        setLiveStats((p) => ({ ...p, assetIdsGenerated: i + 1 }));
        setOverallProgress(20 + Math.round(((i + 1) / totalItems) * 35));
      }
      setStep("assetIds", "done");
      setOverallProgress(55);

      // Step 4 — Inventory records
      await delay(400);
      setStep("records", "active");
      setStatusMessage("Creating inventory records in the database...");
      addLog("Creating inventory records...");
      await delay(900);
      setStep("records", "done");
      setLiveStats((p) => ({ ...p, inventoryRecordsCreated: totalItems }));
      addLog(`${totalItems} inventory records created`, true);
      setOverallProgress(70);

      // Step 5 — Sticker queue
      await delay(400);
      setStep("sticker", "active");
      setStatusMessage("Adding items to the sticker queue...");
      addLog("Adding items to sticker queue...");
      await delay(700);
      setStep("sticker", "done");
      setLiveStats((p) => ({ ...p, stickerQueueEntries: totalItems }));
      setOverallProgress(80);

      // Step 6 — Reconciliation
      await delay(400);
      setStep("reconcile", "active");
      setStatusMessage("Updating shipment reconciliation...");
      addLog("Updating shipment reconciliation...");
      await delay(700);
      setStep("reconcile", "done");
      setLiveStats((p) => ({ ...p, shipmentReconciliation: "1 / 1" }));
      setOverallProgress(90);

      // Step 7 — Finalise
      await delay(400);
      setStep("finalise", "active");
      setStatusMessage("Finalizing upload session...");
      addLog("Finalizing upload session...");
      await delay(800);
      setStep("finalise", "done");
      setOverallProgress(100);
      addLog("Stock-in session completed successfully", true);

      // Navigate to completion page
      await delay(600);
      navigate(`/stock-in/${shipmentId}/complete`, {
        state: {
          sessionItems,
          batchId,
          totalItems,
          importDate: importDate.toISOString(),
          source,
          csvFileName,
          csvRowCount,
        },
        replace: true,
      });
    };

    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = () => {
    navigator.clipboard.writeText(batchId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!shipment) {
    return <div className="processing-page"><p>Shipment not found.</p></div>;
  }

  return (
    <div className="processing-page">

      {/* ── Breadcrumb ───────────────────────────────────────────────────────── */}
      <div className="processing-breadcrumb">
        Stock In &gt; Shipment Workspace &gt;{" "}
        {source === "csv" ? "Import CSV" : "Manual Entry"} &gt; Processing
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="processing-header">
        <div className="processing-header-left">
          <div className="processing-header-icon">
            <RefreshCw size={22} className="spin-icon" />
          </div>
          <div>
            <h1>Creating Inventory Records</h1>
            <p>
              {source === "csv"
                ? `Please wait while the system imports inventory from ${csvFileName ?? "your CSV file"}.`
                : "Please wait while the system generates inventory records for this stock-in session."}
            </p>
          </div>
        </div>
        <div className="batch-id-card">
          <span className="batch-id-label">BATCH ID</span>
          <div className="batch-id-value">
            {batchId}
            <button className="copy-btn" onClick={handleCopy} title="Copy Batch ID">
              {copied ? <span className="copied-text">Copied!</span> : <Copy size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary strip ───────────────────────────────────────────────────── */}
      <div className="processing-summary-strip">
        <div className="ps-item">
          <div className="ps-icon ps-icon-blue"><Hash size={16} /></div>
          <div>
            <span>Shipment ID</span>
            <h3>{shipment.shipmentId}</h3>
            <p>{shipment.shipmentName}</p>
          </div>
        </div>
        <div className="ps-item">
          <div className="ps-icon ps-icon-purple"><LayoutGrid size={16} /></div>
          <div>
            <span>Vendor</span>
            <h3 className="vendor-name">{shipment.vendor}</h3>
            <p>{shipment.vendor}</p>
          </div>
        </div>
        <div className="ps-item">
          <div className="ps-icon ps-icon-orange"><Database size={16} /></div>
          <div>
            <span>Items To Create</span>
            <h3>{totalItems}</h3>
            <p>Records</p>
          </div>
        </div>
        <div className="ps-item">
          <div className="ps-icon ps-icon-blue"><RefreshCw size={16} /></div>
          <div>
            <span>Import Date</span>
            <h3>{importDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</h3>
            <p>{formatTime(importDate)}</p>
          </div>
        </div>
        <div className="ps-item">
          <div className="ps-icon ps-icon-gray"><Hash size={16} /></div>
          <div>
            <span>Requested By</span>
            <h3>Admin</h3>
            <p>Admin</p>
          </div>
        </div>
      </div>

      {/* ── Three-column body ────────────────────────────────────────────────── */}
      <div className="processing-body">

        {/* Processing Progress */}
        <div className="processing-card progress-card">
          <h2>Processing Progress</h2>
          <div className="progress-bar-wrap">
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${overallProgress}%` }} />
            </div>
            <span className="progress-pct">{overallProgress}%</span>
          </div>
          <p className="progress-status-msg">{statusMessage}</p>

          <div className="step-list">
            {STEPS.map((step) => {
              const status = stepStatuses[step.key];
              const sub =
                step.key === "batch"      ? (status === "done" ? batchId : "Pending") :
                step.key === "assetIds"  ? (status === "done" ? `${totalItems} of ${totalItems} completed` : status === "active" ? `${assetIdsDone} of ${totalItems} completed` : "Pending") :
                step.key === "validation"? (status === "done" ? "All records passed validation." : status === "active" ? "In progress..." : "Pending") :
                status === "done"        ? "Completed" :
                status === "active"      ? "In progress..." :
                "Pending";

              return (
                <div key={step.key} className={`step-item step-${status}`}>
                  <div className="step-indicator">
                    {status === "done"   && <div className="step-dot step-dot-done"><span>✓</span></div>}
                    {status === "active" && <div className="step-dot step-dot-active"><span className="pulse-ring" /></div>}
                    {status === "pending"&& <div className="step-dot step-dot-pending" />}
                    {step.key !== "finalise" && <div className={`step-line ${status === "done" ? "step-line-done" : ""}`} />}
                  </div>
                  <div className="step-text">
                    <strong>{step.label}</strong>
                    <span>{sub}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Statistics */}
        <div className="processing-card stats-card">
          <h2>Live Statistics</h2>
          <div className="stat-list">
            <div className="stat-row">
              <div className="stat-icon stat-icon-blue"><Hash size={16} /></div>
              <span className="stat-label">Batch ID Generated</span>
              <span className="stat-value stat-green">{liveStats.batchGenerated}</span>
            </div>
            <div className="stat-row">
              <div className="stat-icon stat-icon-blue"><LayoutGrid size={16} /></div>
              <span className="stat-label">Asset IDs Generated</span>
              <span className={`stat-value ${liveStats.assetIdsGenerated > 0 ? "stat-green" : "stat-orange"}`}>
                {liveStats.assetIdsGenerated} / {totalItems}
              </span>
            </div>
            <div className="stat-row">
              <div className="stat-icon stat-icon-purple"><Database size={16} /></div>
              <span className="stat-label">Inventory Records Created</span>
              <span className={`stat-value ${liveStats.inventoryRecordsCreated > 0 ? "stat-green" : "stat-orange"}`}>
                {liveStats.inventoryRecordsCreated} / {totalItems}
              </span>
            </div>
            <div className="stat-row">
              <div className="stat-icon stat-icon-orange"><Tag size={16} /></div>
              <span className="stat-label">Sticker Queue Entries</span>
              <span className={`stat-value ${liveStats.stickerQueueEntries > 0 ? "stat-green" : "stat-orange"}`}>
                {liveStats.stickerQueueEntries} / {totalItems}
              </span>
            </div>
            <div className="stat-row">
              <div className="stat-icon stat-icon-pink"><RefreshCw size={16} /></div>
              <span className="stat-label">Shipment Reconciliation</span>
              <span className={`stat-value ${liveStats.shipmentReconciliation === "1 / 1" ? "stat-green" : "stat-orange"}`}>
                {liveStats.shipmentReconciliation}
              </span>
            </div>
          </div>

          <div className="do-not-close-banner">
            <Info size={16} />
            <div>
              <strong>Please do not close this page</strong>
              <p>Your inventory is being created. This may take a few moments.</p>
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className="processing-card log-card">
          <h2>Activity Log</h2>
          <div className="log-list">
            {log.length === 0 && (
              <p className="log-empty">Activity will appear here as processing begins...</p>
            )}
            {log.map((entry, i) => (
              <div key={i} className="log-entry">
                <span className={`log-dot ${entry.done ? "log-dot-done" : "log-dot-progress"}`} />
                <span className="log-time">{entry.time}</span>
                <span className="log-message">{entry.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Warning footer ───────────────────────────────────────────────────── */}
      <div className="processing-warning-footer">
        <AlertTriangle size={16} />
        Please do not close this page or refresh the browser. Doing so may interrupt the process.
      </div>
    </div>
  );
}