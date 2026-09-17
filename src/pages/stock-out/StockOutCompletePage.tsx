import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import {
  CheckCircle2,
  Download,
  ArrowUpFromLine,
  Plus,
} from "lucide-react";

import "./StockOutCompletePage.css";
import type { StockOutApiItem, StockOutApiTransaction } from "./stockOutTypes";
import { displayItemStatus } from "./stockOutTypes";

// BACKEND INTEGRATION SEAM:
// Delivery note PDF: GET /stock-out/:invoiceNumber/delivery-note
// The invoiceNumber is the unique identifier for every transaction.
// For now the Download button is a placeholder — PDF generation will
// be implemented once the backend transaction endpoint is live.

export default function StockOutCompletePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as StockOutApiTransaction | null;

  useEffect(() => {
    if (!state?.invoiceNumber) {
      navigate("/stock-out");
    }
  }, [state, navigate]);

  if (!state) return null;

  const buildSpecsString = (item: StockOutApiItem) => {
    const parts = [
      item.processor,
      item.generation,
      item.ram,
      item.storage,
      item.speed,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" • ") : "—";
  };

  const okCount = state.items.filter((i) => i.status === "OK").length;
  const faultyCount = state.items.filter((i) => i.status === "FAULTY").length;

  return (
    <div className="soc-page">
      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <div className="soc-breadcrumb">
        Stock Out &gt; New Stock Out &gt; Complete
      </div>

      {/* ── Success banner ───────────────────────────────────────────────────── */}
      <div className="soc-success-banner">
        <div className="soc-success-icon">
          <CheckCircle2 size={28} />
        </div>
        <div>
          <h1>Stock Out Completed Successfully!</h1>
          <p>
            {state.totalItems} item
            {state.totalItems !== 1 ? "s have" : " has"} been issued to{" "}
            <strong>{state.customerName}</strong> and marked as Issued in the
            system.
          </p>
        </div>
        <button className="soc-download-btn">
          <Download size={14} />
          Download Delivery Note
        </button>
      </div>

      {/* ── Transaction summary ──────────────────────────────────────────────── */}
      <div className="soc-meta-strip">
        <div className="soc-meta-item">
          <span>Invoice Number</span>
          <p className="soc-invoice-num">{state.invoiceNumber}</p>
        </div>
        <div className="soc-meta-item">
          <span>Customer</span>
          <p>{state.customerName}</p>
        </div>
        <div className="soc-meta-item">
          <span>Location</span>
          <p>{state.customerLocation}</p>
        </div>
        <div className="soc-meta-item">
          <span>Date</span>
          <p>{state.date}</p>
        </div>
        <div className="soc-meta-item">
          <span>Processed By</span>
          <p>{state.processedBy}</p>
        </div>
        <div className="soc-meta-item">
          <span>Items Issued</span>
          <p className="soc-item-count">{state.totalItems}</p>
        </div>
      </div>

      {/* ── Breakdown ────────────────────────────────────────────────────────── */}
      <div className="soc-breakdown">
        <div className="soc-breakdown-item">
          <span className="soc-bd-label">Ok items issued</span>
          <span className="soc-bd-value soc-bd-ok">{okCount}</span>
        </div>
        <div className="soc-breakdown-item">
          <span className="soc-bd-label">Faulty items issued</span>
          <span className="soc-bd-value soc-bd-faulty">{faultyCount}</span>
        </div>
      </div>

      {/* ── Items issued table ───────────────────────────────────────────────── */}
      <div className="soc-card">
        <h2 className="soc-card-title">
          Items Issued ({state.totalItems})
        </h2>
        <div className="soc-table-wrap">
          <table className="soc-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Asset ID</th>
                <th>List Number</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Model</th>
                <th>Specifications</th>
                <th>Comment</th>
                <th>Prior Status</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((item, idx) => (
                <tr key={item.assetId}>
                  <td className="soc-row-num">{idx + 1}</td>
                  <td className="soc-asset-id">{item.assetId}</td>
                  <td>{item.listNumber || "—"}</td>
                  <td>{item.category}</td>
                  <td>{item.brand}</td>
                  <td>{item.model}</td>
                  <td className="soc-specs">{buildSpecsString(item)}</td>
                  <td>{item.screenType || "—"}</td>
                  <td>
                    <span
                      className={`soc-status-pill ${
                        item.status === "OK"
                          ? "soc-status-ok"
                          : "soc-status-faulty"
                      }`}
                    >
                      {displayItemStatus(item.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Next actions ─────────────────────────────────────────────────────── */}
      <div className="soc-next-actions">
        <h3>What would you like to do next?</h3>
        <div className="soc-next-btns">
          <button
            className="soc-next-btn"
            onClick={() => navigate("/stock-out/new")}
          >
            <Plus size={16} />
            New Stock Out
          </button>
          <button
            className="soc-next-btn soc-next-btn-outline"
            onClick={() => navigate("/stock-out")}
          >
            <ArrowUpFromLine size={16} />
            View All Transactions
          </button>
        </div>
      </div>
    </div>
  );
}