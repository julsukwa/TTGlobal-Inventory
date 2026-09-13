import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, User, Package } from "lucide-react";

import "./ReviewStockOutPage.css";
import type { ScannedItem, Customer } from "./stockOutTypes";

// BACKEND INTEGRATION SEAM:
// On confirm: POST /stock-out with { customerId, invoiceNumber, notes, assetIds[] }
// Server atomically marks all items Issued and creates the transaction record.

interface LocationState {
  customer: Customer;
  invoiceNumber: string;
  notes: string;
  items: ScannedItem[];
}

export default function ReviewStockOutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  useEffect(() => {
    if (!state?.customer || !state?.items?.length) {
      navigate("/stock-out/new");
    }
  }, [state, navigate]);

  if (!state) return null;

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

  const okCount = state.items.filter((i) => i.status === "Ok").length;
  const faultyCount = state.items.filter((i) => i.status === "Faulty").length;

  const handleConfirm = () => {
    // BACKEND INTEGRATION SEAM:
    // POST /stock-out → { customerId, invoiceNumber, notes, assetIds }
    // On success navigate to completion passing the confirmed transaction data.
    // The invoiceNumber is the unique identifier — no separate transaction ID needed.
    navigate("/stock-out/complete", {
      state: {
        ...state,
        date: new Date().toLocaleDateString("en-GB"),
        processedBy: "Admin",
      },
    });
  };

  return (
    <div className="rev-page">
      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <div className="rev-breadcrumb">
        Stock Out &gt; New Stock Out &gt; Scan Items &gt; Review & Confirm
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="rev-header">
        <div>
          <h1>Review & Confirm</h1>
          <p>
            Review the transaction details below before confirming. This action
            cannot be undone.
          </p>
        </div>
        <button
          className="rev-back-btn"
          onClick={() =>
            navigate("/stock-out/scan", { state })
          }
        >
          <ArrowLeft size={14} />
          Back to Scanning
        </button>
      </div>

      {/* ── Summary cards ───────────────────────────────────────────────────── */}
      <div className="rev-summary-strip">
        <div className="rev-summary-item">
          <div className="rev-summary-icon rev-icon-blue">
            <User size={16} />
          </div>
          <div>
            <span>Customer</span>
            <h3>{state.customer.name}</h3>
            <p>{state.customer.location}</p>
          </div>
        </div>

        <div className="rev-summary-item">
          <div className="rev-summary-icon rev-icon-indigo">
            <span style={{ fontSize: 16 }}>📄</span>
          </div>
          <div>
            <span>Invoice Number</span>
            <h3>{state.invoiceNumber}</h3>
            <p>{new Date().toLocaleDateString("en-GB")}</p>
          </div>
        </div>

        <div className="rev-summary-item">
          <div className="rev-summary-icon rev-icon-green">
            <Package size={16} />
          </div>
          <div>
            <span>Total Items</span>
            <h3>{state.items.length}</h3>
            <p>
              {okCount} Ok · {faultyCount} Faulty
            </p>
          </div>
        </div>
      </div>

      {/* ── Customer details ─────────────────────────────────────────────────── */}
      <div className="rev-card">
        <h2 className="rev-card-title">Customer Information</h2>
        <div className="rev-detail-grid">
          <div>
            <span>Full Name</span>
            <p>{state.customer.name}</p>
          </div>
          <div>
            <span>Email</span>
            <p>{state.customer.email}</p>
          </div>
          <div>
            <span>Phone</span>
            <p>{state.customer.phone}</p>
          </div>
          <div>
            <span>Location</span>
            <p>{state.customer.location}</p>
          </div>
        </div>
        {state.notes && (
          <div className="rev-notes">
            <span>Notes</span>
            <p>{state.notes}</p>
          </div>
        )}
      </div>

      {/* ── Items table ─────────────────────────────────────────────────────── */}
      <div className="rev-card">
        <h2 className="rev-card-title">
          Items to be Issued ({state.items.length})
        </h2>
        <div className="rev-table-wrap">
          <table className="rev-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Asset ID</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Model</th>
                <th>Specifications</th>
                <th>Comment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((item, idx) => (
                <tr key={item.assetId}>
                  <td className="rev-row-num">{idx + 1}</td>
                  <td className="rev-asset-id">{item.assetId}</td>
                  <td>{item.category}</td>
                  <td>{item.brand}</td>
                  <td>{item.model}</td>
                  <td className="rev-specs">{buildSpecsString(item)}</td>
                  <td>{item.screenType || "—"}</td>
                  <td>
                    <span
                      className={`rev-status-pill ${
                        item.status === "Ok"
                          ? "rev-status-ok"
                          : "rev-status-faulty"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Warning notice ───────────────────────────────────────────────────── */}
      <div className="rev-warning">
        <span className="rev-warning-icon">⚠️</span>
        <p>
          Confirming this transaction will mark all{" "}
          <strong>{state.items.length} items</strong> as <strong>Issued</strong>{" "}
          and link them to invoice <strong>{state.invoiceNumber}</strong>. This
          action cannot be undone.
        </p>
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────────── */}
      <div className="rev-actions">
        <button
          className="rev-cancel-btn"
          onClick={() => navigate("/stock-out")}
        >
          Cancel
        </button>
        <button className="rev-confirm-btn" onClick={handleConfirm}>
          Confirm Stock Out →
        </button>
      </div>
    </div>
  );
}