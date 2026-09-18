// ─── Inventory Adjustments Page ──────────────────────────────────────────────
//
// Read-only history of every "Ok → Faulty" adjustment made in the system,
// with search/filter/pagination and a per-record detail drawer. New
// adjustments are created on NewAdjustmentPage (/adjustments/new) via
// POST /adjustments; this page just refetches from GET /adjustments on
// mount and after returning here, so no router-state hand-off is needed.
//
// Access: Admin and Warehouse Staff only (see src/utils/permissions.ts,
// module key "adjustments").

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Download, Eye, X, ClipboardList, CalendarClock, AlertOctagon } from "lucide-react";

import "./AdjustmentsPage.css";
import { toAdjustmentRecord } from "./adjustmentTypes";
import type { AdjustmentRecord, BackendAdjustmentRecord } from "./adjustmentTypes";
import { apiFetch, apiFetchBlob } from "../../services/api";

import { StatusBadge, SearchBar, Pagination, Button, ListNumberBadge } from "../../components/ui";

const ITEMS_PER_PAGE = 20;

export default function AdjustmentsPage() {
  const navigate = useNavigate();

  // Unfiltered snapshot — used only to derive the summary strip and the
  // fault-type filter's option list, independent of whatever's currently
  // filtered in the table below (the same pattern DatabasePage uses).
  const [allRecords, setAllRecords] = useState<AdjustmentRecord[]>([]);

  useEffect(() => {
    apiFetch<BackendAdjustmentRecord[]>("/adjustments")
      .then((rows) => setAllRecords(rows.map(toAdjustmentRecord)))
      .catch(() => {
        // Summary/filter options just stay empty on failure — the main
        // (filtered) fetch below still reports its own error if it fails.
      });
  }, []);

  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [faultTypeFilter, setFaultTypeFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<AdjustmentRecord | null>(null);

  const [exportError, setExportError] = useState<string | null>(null);

  // ── Filtered fetch — search/faultType/dateFrom/dateTo are all applied
  // server-side. Debounced so typing in the search box doesn't fire a
  // request per keystroke. ─────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const timeoutId = setTimeout(() => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      if (faultTypeFilter !== "All") params.set("faultType", faultTypeFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      // Include the whole "to" day rather than just its midnight instant.
      if (dateTo) params.set("dateTo", `${dateTo}T23:59:59.999`);
      const query = params.toString();

      apiFetch<BackendAdjustmentRecord[]>(`/adjustments${query ? `?${query}` : ""}`)
        .then((rows) => {
          if (!cancelled) setAdjustments(rows.map(toAdjustmentRecord));
        })
        .catch((err: Error) => {
          if (!cancelled) setError(err.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [searchTerm, faultTypeFilter, dateFrom, dateTo]);

  // ── Summary figures ──────────────────────────────────────────────────────

  const now = new Date();
  const thisMonthCount = allRecords.filter((r) => {
    const match = r.date.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return false;
    const [, , mm, yyyy] = match;
    return Number(mm) - 1 === now.getMonth() && Number(yyyy) === now.getFullYear();
  }).length;

  const mostCommonFault = useMemo(() => {
    const counts = new Map<string, number>();
    allRecords.forEach((r) =>
      r.faultTypes.forEach((f) => counts.set(f, (counts.get(f) ?? 0) + 1))
    );
    if (counts.size === 0) return "—";
    const maxCount = Math.max(...counts.values());
    const topFaults = [...counts.entries()]
      .filter(([, c]) => c === maxCount)
      .map(([f]) => f)
      .sort();
    return topFaults[0];
  }, [allRecords]);

  const faultTypeOptions = useMemo(() => {
    const unique = new Set<string>();
    allRecords.forEach((r) => r.faultTypes.forEach((f) => unique.add(f)));
    return [...unique].sort();
  }, [allRecords]);

  const totalPages = Math.max(1, Math.ceil(adjustments.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedAdjustments = adjustments.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleClearFilters = () => {
    setSearchTerm("");
    setFaultTypeFilter("All");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  // ── Export CSV ───────────────────────────────────────────────────────────

  const handleExportCsv = async () => {
    setExportError(null);

    try {
      const blob = await apiFetchBlob("/adjustments/export");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "inventory_adjustments.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export adjustments.");
    }
  };

  return (
    <div className="adj-page">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="adj-header">
        <div>
          <h1>Inventory Adjustments</h1>
          <p>Track faulty stock movements and status changes.</p>
        </div>
        <div className="adj-header-actions">
          <Button variant="secondary" onClick={handleExportCsv}>
            <Download size={16} />
            Export CSV
          </Button>
          <Button variant="primary" onClick={() => navigate("/adjustments/new")}>
            <Plus size={16} />
            New Adjustment
          </Button>
        </div>
      </div>

      {exportError && <p className="field-error">{exportError}</p>}

      {/* ── Summary strip ─────────────────────────────────────────────────── */}
      <div className="adj-summary-strip">
        <div className="adj-summary-item">
          <div className="adj-summary-icon adj-icon-blue">
            <ClipboardList size={16} />
          </div>
          <div>
            <span>Total Adjustments</span>
            <h3>{allRecords.length}</h3>
          </div>
        </div>

        <div className="adj-summary-item">
          <div className="adj-summary-icon adj-icon-indigo">
            <CalendarClock size={16} />
          </div>
          <div>
            <span>This Month</span>
            <h3>{thisMonthCount}</h3>
          </div>
        </div>

        <div className="adj-summary-item">
          <div className="adj-summary-icon adj-icon-red">
            <AlertOctagon size={16} />
          </div>
          <div>
            <span>Most Common Fault</span>
            <h3 className="adj-most-common-value">{mostCommonFault}</h3>
          </div>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="adj-filters-card">
        <SearchBar
          value={searchTerm}
          onChange={(value) => {
            setSearchTerm(value);
            setCurrentPage(1);
          }}
          placeholder="Search by Asset ID or item name..."
          width={280}
        />

        <select
          value={faultTypeFilter}
          onChange={(e) => {
            setFaultTypeFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="All">All Faults</option>
          {faultTypeOptions.map((fault) => (
            <option key={fault} value={fault}>
              {fault}
            </option>
          ))}
        </select>

        <div className="adj-date-range">
          <label>
            From
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
            />
          </label>
        </div>

        <button className="adj-clear-filters-btn" onClick={handleClearFilters}>
          Clear Filters
        </button>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="adj-table-card">
        <div className="adj-table-wrap">
          <table className="adj-table">
            <thead>
              <tr>
                <th>List Number</th>
                <th>Date &amp; Time</th>
                <th>Asset ID</th>
                <th>Item Name</th>
                <th>Fault Types</th>
                <th>From</th>
                <th>To</th>
                <th>Adjusted By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="adj-empty-row">
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="adj-empty-row">
                    Failed to load adjustments: {error}
                  </td>
                </tr>
              ) : paginatedAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="adj-empty-row">
                    No adjustments found.
                  </td>
                </tr>
              ) : (
                paginatedAdjustments.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <ListNumberBadge value={record.listNumber} />
                    </td>
                    <td className="adj-muted-cell">{record.date}</td>
                    <td className="adj-asset-id">{record.assetId}</td>
                    <td className="adj-item-name">{record.itemName}</td>
                    <td>
                      <div className="adj-fault-pills">
                        {record.faultTypes.map((fault) => (
                          <span key={fault} className="adj-fault-pill">
                            {fault}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status="Ok" />
                    </td>
                    <td>
                      <StatusBadge status="Faulty" />
                    </td>
                    <td>{record.adjustedBy}</td>
                    <td>
                      <button
                        className="adj-action-btn"
                        title="View adjustment detail"
                        onClick={() => setSelectedRecord(record)}
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="adj-footer">
          <span>
            Showing {adjustments.length === 0 ? 0 : startIndex + 1}–
            {Math.min(startIndex + ITEMS_PER_PAGE, adjustments.length)} of{" "}
            {adjustments.length} entries
          </span>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* ── Detail drawer ─────────────────────────────────────────────────── */}
      {selectedRecord && (
        <div className="adj-drawer-overlay" onClick={() => setSelectedRecord(null)}>
          <div className="adj-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="adj-drawer-header">
              <div>
                <h2>{selectedRecord.assetId}</h2>
                <p>Adjustment Detail</p>
              </div>
              <button className="adj-drawer-close" onClick={() => setSelectedRecord(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="adj-drawer-body">
              {/* Asset information */}
              <div className="adj-drawer-section">
                <h4>Asset Information</h4>
                <div className="adj-drawer-grid">
                  <div>
                    <span>Asset ID</span>
                    <p>{selectedRecord.assetId}</p>
                  </div>
                  <div>
                    <span>Item Name</span>
                    <p>{selectedRecord.itemName}</p>
                  </div>
                  <div>
                    <span>Category</span>
                    <p>{selectedRecord.category || "—"}</p>
                  </div>
                  <div>
                    <span>Brand</span>
                    <p>{selectedRecord.brand || "—"}</p>
                  </div>
                  <div>
                    <span>Model</span>
                    <p>{selectedRecord.model || "—"}</p>
                  </div>
                  <div className="adj-drawer-full">
                    <span>Specs</span>
                    <p>{selectedRecord.specs || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Fault information */}
              <div className="adj-drawer-section">
                <h4>Fault Information</h4>
                <div className="adj-fault-pills">
                  {selectedRecord.faultTypes.map((fault) => (
                    <span key={fault} className="adj-fault-pill">
                      {fault}
                    </span>
                  ))}
                </div>
                {selectedRecord.notes && (
                  <p className="adj-drawer-notes">{selectedRecord.notes}</p>
                )}
              </div>

              {/* Adjustment record */}
              <div className="adj-drawer-section">
                <h4>Adjustment Record</h4>
                <div className="adj-drawer-grid">
                  <div>
                    <span>From Status</span>
                    <StatusBadge status={selectedRecord.fromStatus} />
                  </div>
                  <div>
                    <span>To Status</span>
                    <StatusBadge status={selectedRecord.toStatus} />
                  </div>
                  <div>
                    <span>Date</span>
                    <p>{selectedRecord.date}</p>
                  </div>
                  <div>
                    <span>Adjusted By</span>
                    <p>{selectedRecord.adjustedBy}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
