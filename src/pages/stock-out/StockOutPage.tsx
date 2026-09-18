import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Eye,
  Download,
  Package,
  ArrowUpFromLine,
} from "lucide-react";

import "./StockOutPage.css";
import type { StockOutApiTransaction } from "./stockOutTypes";
import { displayItemStatus } from "./stockOutTypes";
import { apiFetch } from "../../services/api";
import { Pagination, ListNumberBadge } from "../../components/ui";

const ITEMS_PER_PAGE = 20;

export default function StockOutPage() {
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState<StockOutApiTransaction[]>([]);
  const [yearTransactions, setYearTransactions] = useState<StockOutApiTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] =
    useState<StockOutApiTransaction | null>(null);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      apiFetch<StockOutApiTransaction[]>("/stock-out"),
      apiFetch<StockOutApiTransaction[]>(`/stock-out?year=${currentYear}`),
    ])
      .then(([all, yearly]) => {
        if (cancelled) return;
        setTransactions(all);
        setYearTransactions(yearly);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // currentYear is derived from Date.now() at mount and intentionally not
    // re-evaluated — this page doesn't need to refetch mid-session if the
    // real-world year rolls over while it's open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = transactions.filter((t) => {
    const s = searchTerm.toLowerCase();
    return (
      t.customerName.toLowerCase().includes(s) ||
      t.invoiceNumber.toLowerCase().includes(s)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const paginated = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const buildSpecsString = (item: StockOutApiTransaction["items"][number]) => {
    const parts = [
      item.processor,
      item.generation,
      item.ram,
      item.storage,
      item.speed,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" • ") : "—";
  };

  return (
    <div className="so-page">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="so-header">
        <div>
          <h1>Stock Out</h1>
          <p>Manage inventory issuance and generate delivery notes for customers.</p>
        </div>
        <button
          className="so-new-btn"
          onClick={() => navigate("/stock-out/new")}
        >
          <Plus size={16} />
          New Stock Out
        </button>
      </div>

      {/* ── Summary strip ──────────────────────────────────────────────────── */}
      <div className="so-summary-strip">
        <div className="so-summary-item">
          <div className="so-summary-icon so-icon-blue">
            <ArrowUpFromLine size={16} />
          </div>
          <div>
            <span>Total Transactions</span>
            <h3>{yearTransactions.length}</h3>
            <p>Jan – Dec {currentYear}</p>
          </div>
        </div>
        <div className="so-summary-item">
          <div className="so-summary-icon so-icon-indigo">
            <Package size={16} />
          </div>
          <div>
            <span>Items Issued</span>
            <h3>{yearTransactions.reduce((acc, t) => acc + t.totalItems, 0)}</h3>
            <p>Jan – Dec {currentYear}</p>
          </div>
        </div>
      </div>

      {/* ── Transaction table ──────────────────────────────────────────────── */}
      <div className="so-table-card">
        <div className="so-toolbar">
          <div className="so-search-wrapper">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search by customer name or invoice number..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <table className="so-table">
          <thead>
            <tr>
              <th>Invoice Number</th>
              <th>Customer</th>
              <th>Items Issued</th>
              <th>Date</th>
              <th>Processed By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="so-empty">
                  Loading...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="so-empty">
                  Failed to load transactions: {error}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="so-empty">
                  {transactions.length === 0
                    ? "No stock out transactions yet. Click 'New Stock Out' to get started."
                    : "No transactions match your search."}
                </td>
              </tr>
            ) : (
              paginated.map((t) => (
                <tr key={t.invoiceNumber}>
                  <td>
                    <span className="so-invoice-pill">{t.invoiceNumber}</span>
                  </td>
                  <td>
                    <div className="so-customer-cell">
                      <span className="so-customer-name">{t.customerName}</span>
                      <span className="so-customer-location">{t.customerLocation}</span>
                    </div>
                  </td>
                  <td>
                    <span className="so-items-count">{t.totalItems}</span>
                  </td>
                  <td className="so-date-cell">{t.date}</td>
                  <td>{t.processedBy}</td>
                  <td>
                    <div className="so-row-actions">
                      <button
                        className="so-action-btn so-view-btn"
                        title="View transaction"
                        onClick={() => setSelectedTransaction(t)}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        className="so-action-btn so-download-btn"
                        title="Download delivery note"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="so-table-footer">
          <span>
            Showing {filtered.length === 0 ? 0 : startIndex + 1}–
            {Math.min(startIndex + ITEMS_PER_PAGE, filtered.length)} of {filtered.length} transactions
            {filtered.length !== transactions.length ? ` (${transactions.length} total)` : ""}
          </span>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </div>

      {/* ── Transaction detail drawer ───────────────────────────────────────── */}
      {selectedTransaction && (
        <div
          className="so-drawer-overlay"
          onClick={() => setSelectedTransaction(null)}
        >
          <div className="so-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="so-drawer-header">
              <div>
                <h2>{selectedTransaction.invoiceNumber}</h2>
                <p>Transaction Detail</p>
              </div>
              <button
                className="so-drawer-close"
                onClick={() => setSelectedTransaction(null)}
              >
                ✕
              </button>
            </div>

            <div className="so-drawer-body">
              {/* Customer info */}
              <div className="so-drawer-section">
                <h4>Customer Information</h4>
                <div className="so-drawer-grid">
                  <div>
                    <span>Name</span>
                    <p>{selectedTransaction.customerName}</p>
                  </div>
                  <div>
                    <span>Email</span>
                    <p>{selectedTransaction.customerEmail}</p>
                  </div>
                  <div>
                    <span>Phone</span>
                    <p>{selectedTransaction.customerPhone}</p>
                  </div>
                  <div>
                    <span>Location</span>
                    <p>{selectedTransaction.customerLocation}</p>
                  </div>
                </div>
              </div>

              {/* Transaction info */}
              <div className="so-drawer-section">
                <h4>Transaction Information</h4>
                <div className="so-drawer-grid">
                  <div>
                    <span>Invoice Number</span>
                    <p>{selectedTransaction.invoiceNumber}</p>
                  </div>
                  <div>
                    <span>Date</span>
                    <p>{selectedTransaction.date}</p>
                  </div>
                  <div>
                    <span>Processed By</span>
                    <p>{selectedTransaction.processedBy}</p>
                  </div>
                  <div>
                    <span>Total Items</span>
                    <p>{selectedTransaction.totalItems}</p>
                  </div>
                  {selectedTransaction.notes && (
                    <div className="so-drawer-full">
                      <span>Notes</span>
                      <p>{selectedTransaction.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Items issued */}
              <div className="so-drawer-section">
                <h4>Items Issued ({selectedTransaction.items.length})</h4>
                <div className="so-drawer-items">
                  {selectedTransaction.items.map((item) => (
                    <div key={item.assetId} className="so-drawer-item-row">
                      <div className="so-drawer-item-left">
                        <div>
                          <ListNumberBadge value={item.listNumber} />
                        </div>
                        <span className="so-drawer-asset-id">{item.assetId}</span>
                        <p>
                          {item.brand} {item.model}
                        </p>
                        <span className="so-drawer-specs">
                          {buildSpecsString(item)}
                        </span>
                        <span className="so-drawer-traceability">
                          Batch: {item.batchId || "—"}
                        </span>
                      </div>
                      <div className="so-drawer-item-right">
                        <span
                          className={`so-status-pill ${
                            item.status === "OK"
                              ? "so-status-ok"
                              : "so-status-faulty"
                          }`}
                        >
                          {displayItemStatus(item.status)}
                        </span>
                        <span className="so-drawer-category">{item.category}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="so-drawer-footer">
              <button className="so-drawer-download-btn">
                <Download size={14} />
                Download Delivery Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}