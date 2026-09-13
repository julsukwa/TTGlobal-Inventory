import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  CheckCircle2,
  ArrowLeft,
  LayoutGrid,
  Hash,
  Tag,
  RefreshCw,
  Calendar,
  User,
  Copy,
  ArrowRight,
  List,
  Printer,
  PackagePlus,
  LayoutDashboard,
  Info,
} from "lucide-react";
import { useState } from "react";

import "./StockInCompletePage.css";
import { stockInShipments } from "./mockStockIn";

// ─── Component ────────────────────────────────────────────────────────────────

export default function StockInCompletePage() {
  const navigate = useNavigate();
  const { shipmentId } = useParams();
  const location = useLocation();

  const {
    batchId,
    totalItems,
    importDate,
    source = "manual",
    csvFileName,
    csvRowCount,
  }: {
    batchId?: string;
    totalItems?: number;
    importDate?: string;
    source?: "manual" | "csv";
    csvFileName?: string;
    csvRowCount?: number;
  } = location.state ?? {};

  const isCsv = source === "csv";

  const shipment = stockInShipments.find((s) => s.shipmentId === shipmentId);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(batchId ?? "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const completedDate = importDate ? new Date(importDate) : new Date();
  const formattedDate = completedDate.toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
  const formattedTime = completedDate.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });

  // Shipment reconciliation figures (previous + this session)
  const prevReceived = shipment?.itemsReceived ?? 0;
  const newTotal = prevReceived + (totalItems ?? 0);
  const sent = shipment?.itemsSent ?? 0;
  const isFullyReconciled = newTotal >= sent;

  if (!shipment) {
    return <div className="complete-page"><p>Shipment not found.</p></div>;
  }

  return (
    <div className="complete-page">

      {/* ── Breadcrumb ───────────────────────────────────────────────────────── */}
      <div className="complete-breadcrumb">
        Stock In &gt; Shipment Workspace &gt;{" "}
        {isCsv ? "Import CSV" : "Manual Entry"} &gt; Processing &gt; Completed
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="complete-header">
        <div className="complete-header-left">
          <CheckCircle2 size={34} className="complete-check-icon" />
          <div>
            <h1>
              {isCsv ? "CSV Import Completed Successfully!" : "Manual Stock-In Completed Successfully!"}
            </h1>
            <p>Your inventory records have been created and added to the system.</p>
          </div>
        </div>
        <button
          className="complete-back-btn"
          onClick={() => navigate(`/stock-in/${shipmentId}`)}
        >
          <ArrowLeft size={14} />
          Back to Shipment Workspace
        </button>
      </div>

      {/* ── Summary strip ───────────────────────────────────────────────────── */}
      <div className="complete-summary-strip">
        <div className="cs-item">
          <div className="cs-icon cs-icon-blue"><Hash size={16} /></div>
          <div>
            <span>Shipment ID</span>
            <h3>{shipment.shipmentId}</h3>
            <p>{shipment.shipmentName}</p>
          </div>
        </div>

        <div className="cs-item">
          <div className="cs-icon cs-icon-purple"><LayoutGrid size={16} /></div>
          <div>
            <span>{isCsv ? "CSV File" : "Vendor"}</span>
            <h3 className="cs-vendor" title={isCsv ? csvFileName : shipment.vendor}>
              {isCsv ? (csvFileName ?? "—") : shipment.vendor}
            </h3>
            {isCsv && <p>{csvRowCount ?? "—"} rows</p>}
          </div>
        </div>

        <div className="cs-item cs-item-highlight">
          <div className="cs-icon cs-icon-green"><Tag size={16} /></div>
          <div>
            <span>Batch ID</span>
            <h3 className="cs-batch">
              {batchId ?? "—"}
              <button className="cs-copy-btn" onClick={handleCopy} title="Copy Batch ID">
                {copied ? <span className="cs-copied">Copied!</span> : <Copy size={13} />}
              </button>
            </h3>
            <p>Upload Session Reference</p>
          </div>
        </div>

        <div className="cs-item">
          <div className="cs-icon cs-icon-blue"><LayoutGrid size={16} /></div>
          <div>
            <span>Items Created</span>
            <h3>{totalItems ?? "—"}</h3>
            <p>Inventory Records</p>
          </div>
        </div>

        <div className="cs-item">
          <div className="cs-icon cs-icon-blue"><Calendar size={16} /></div>
          <div>
            <span>Completed On</span>
            <h3>{formattedDate}</h3>
            <p>{formattedTime}</p>
          </div>
        </div>

        <div className="cs-item">
          <div className="cs-icon cs-icon-gray"><User size={16} /></div>
          <div>
            <span>Completed By</span>
            <h3>Admin</h3>
          </div>
        </div>
      </div>

      {/* ── Main body ───────────────────────────────────────────────────────── */}
      <div className="complete-body">

        {/* Left — Stock-In Summary + reconciliation */}
        <div className="complete-left">
          <div className="complete-card">
            <h2>{isCsv ? "Import Summary" : "Stock-In Summary"}</h2>
            <p className="card-sub">
              {isCsv
                ? `Details of the inventory created from ${csvFileName ?? "your CSV file"}.`
                : "Details of the inventory created in this stock-in session."}
            </p>

            <div className="summary-stat-list">
              {isCsv && (
                <div className="summary-stat-row">
                  <div className="ss-icon ss-icon-purple"><Tag size={18} /></div>
                  <div className="ss-text">
                    <strong>CSV Rows Imported</strong>
                    <span>Valid rows processed from {csvFileName ?? "the uploaded file"}</span>
                  </div>
                  <span className="ss-value ss-green">{csvRowCount ?? "—"}</span>
                </div>
              )}

              <div className="summary-stat-row">
                <div className="ss-icon ss-icon-blue"><LayoutGrid size={18} /></div>
                <div className="ss-text">
                  <strong>Inventory Records Created</strong>
                  <span>Total inventory items added to the system</span>
                </div>
                <span className="ss-value ss-green">{totalItems ?? "—"}</span>
              </div>

              <div className="summary-stat-row">
                <div className="ss-icon ss-icon-blue"><Hash size={18} /></div>
                <div className="ss-text">
                  <strong>Asset IDs Generated</strong>
                  <span>Unique asset IDs generated for items</span>
                </div>
                <span className="ss-value ss-green">{totalItems ?? "—"}</span>
              </div>

              <div className="summary-stat-row">
                <div className="ss-icon ss-icon-orange"><Tag size={18} /></div>
                <div className="ss-text">
                  <strong>Sticker Queue Entries</strong>
                  <span>Items added to sticker queue for printing</span>
                </div>
                <span className="ss-value ss-orange">{totalItems ?? "—"}</span>
              </div>

              <div className="summary-stat-row">
                <div className="ss-icon ss-icon-purple"><RefreshCw size={18} /></div>
                <div className="ss-text">
                  <strong>Shipment Reconciliation Updated</strong>
                  <span>Shipment received quantity updated</span>
                </div>
                <span className="ss-value ss-green">+{totalItems ?? "—"}</span>
              </div>
            </div>

            {/* Reconciliation callout */}
            <div className={`reconciliation-callout ${isFullyReconciled ? "callout-complete" : "callout-partial"}`}>
              <CheckCircle2 size={16} />
              <span>
                Shipment Capacity:{" "}
                <strong>
                  {prevReceived} + {totalItems} = {newTotal} / {sent}
                  {isFullyReconciled ? " (100%)" : ` (${Math.round((newTotal / sent) * 100)}%)`}
                </strong>
                <br />
                {isFullyReconciled
                  ? "All items have been successfully accounted for in this shipment."
                  : `${sent - newTotal} item${sent - newTotal !== 1 ? "s" : ""} still pending for this shipment.`}
              </span>
            </div>
          </div>
        </div>

        {/* Right — What Happened + illustration */}
        <div className="complete-right">
          <div className="complete-card">
            <h2>What Happened</h2>
            <p className="card-sub">
              {isCsv
                ? "The following actions were completed for this CSV import."
                : "The following actions were completed for this stock-in session."}
            </p>

            <div className="what-happened-grid">
              {/* Event list */}
              <div className="event-list">
                {[
                  { title: "Batch ID Generated",            desc: `Batch ID ${batchId} has been created for this session.` },
                  { title: "Asset IDs Generated",           desc: `${totalItems} unique asset IDs have been generated.` },
                  { title: "Inventory Records Created",     desc: `${totalItems} inventory records have been created in the system.` },
                  { title: "Sticker Queue Updated",         desc: `${totalItems} items have been added to the sticker queue.` },
                  { title: "Shipment Reconciliation Updated", desc: `Shipment ${shipment.shipmentId} received quantity has been updated.` },
                  {
                    title: isCsv ? "CSV Import Saved" : "Upload Session Saved",
                    desc: isCsv
                      ? `${csvFileName ?? "Your CSV file"} has been saved to import history.`
                      : "Session details have been saved to the system.",
                  },
                ].map((event) => (
                  <div key={event.title} className="event-row">
                    <CheckCircle2 size={16} className="event-check" />
                    <div>
                      <strong>{event.title}</strong>
                      <span>{event.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Illustration */}
              <div className="all-done-illustration">
                <svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" className="box-svg">
                  {/* Box body */}
                  <rect x="30" y="80" width="100" height="65" rx="6" fill="#2e7d32" />
                  {/* Box lid left flap */}
                  <path d="M30 80 L80 60 L80 80 Z" fill="#388e3c" />
                  {/* Box lid right flap */}
                  <path d="M130 80 L80 60 L80 80 Z" fill="#1b5e20" />
                  {/* Box front stripe */}
                  <rect x="30" y="80" width="100" height="8" rx="0" fill="#1b5e20" opacity="0.3"/>
                  {/* Check circle */}
                  <circle cx="80" cy="72" r="22" fill="#fff" />
                  <circle cx="80" cy="72" r="19" fill="#43a047" />
                  <polyline points="70,72 77,79 91,63" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Confetti dots */}
                  <circle cx="30" cy="50" r="4" fill="#fbbf24" />
                  <circle cx="130" cy="45" r="3" fill="#f87171" />
                  <circle cx="20" cy="80" r="3" fill="#818cf8" />
                  <circle cx="140" cy="75" r="4" fill="#34d399" />
                  <line x1="125" y1="30" x2="135" y2="40" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="25" y1="35" x2="32" y2="42" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                <h3 className="all-done-title">All Done!</h3>
                <p className="all-done-sub">Your stock-in session has been completed successfully.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Next actions ────────────────────────────────────────────────────── */}
      <div className="next-actions-card">
        <h2>What would you like to do next?</h2>
        <div className="next-actions-grid">
          <button className="next-action-btn" onClick={() => navigate("/stock-overview")}>
            <div className="na-icon na-icon-blue"><List size={18} /></div>
            <div className="na-text">
              <strong>View Imported Inventory</strong>
              <span>View all inventory items created in this session.</span>
            </div>
            <ArrowRight size={16} className="na-arrow" />
          </button>

          <button className="next-action-btn" onClick={() => navigate("/sticker-queue")}>
            <div className="na-icon na-icon-orange"><Printer size={18} /></div>
            <div className="na-text">
              <strong>Open Sticker Queue</strong>
              <span>Go to sticker queue to view items ready for printing.</span>
            </div>
            <ArrowRight size={16} className="na-arrow" />
          </button>

          <button className="next-action-btn" onClick={() => navigate(`/stock-in/${shipmentId}`)}>
            <div className="na-icon na-icon-green"><PackagePlus size={18} /></div>
            <div className="na-text">
              <strong>Continue Stock In</strong>
              <span>Start another stock-in session for this shipment.</span>
            </div>
            <ArrowRight size={16} className="na-arrow" />
          </button>

          <button className="next-action-btn" onClick={() => navigate(`/stock-in/${shipmentId}`)}>
            <div className="na-icon na-icon-purple"><LayoutDashboard size={18} /></div>
            <div className="na-text">
              <strong>Return to Shipment Workspace</strong>
              <span>Go back to shipment workspace overview.</span>
            </div>
            <ArrowRight size={16} className="na-arrow" />
          </button>
        </div>
      </div>

      {/* ── Info footer ─────────────────────────────────────────────────────── */}
      <div className="complete-info-footer">
        <Info size={15} />
        You can always find this batch using the Batch ID:{" "}
        <strong>{batchId ?? "—"}</strong> in inventory search or batch history.
      </div>
    </div>
  );
}