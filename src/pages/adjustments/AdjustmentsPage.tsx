// ─── Inventory Adjustments Page ──────────────────────────────────────────────
//
// Read-only history of every "Ok → Faulty" adjustment made in the system,
// with search/filter/pagination and a per-record detail drawer. New
// adjustments are created on NewAdjustmentPage (/adjustments/new) and handed
// back here via router state on "Apply Adjustments" — see the note above the
// initial state below for the current limitation of that approach.
//
// Access: Admin and Warehouse Staff only (see src/utils/permissions.ts,
// module key "adjustments").

import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, Download, Eye, X, ClipboardList, CalendarClock, AlertOctagon } from "lucide-react";

import "./AdjustmentsPage.css";
import { mockAdjustments, mockItemCatalog, type ItemCatalogEntry } from "./mockAdjustments";
import type { AdjustmentRecord } from "./adjustmentTypes";

import { StatusBadge, SearchBar, Pagination, Button } from "../../components/ui";

const ITEMS_PER_PAGE = 6;

interface IncomingState {
  newRecords?: AdjustmentRecord[];
  newCatalogEntries?: Record<string, ItemCatalogEntry>;
}

/** Extracts the "YYYY-MM-DD" portion of the mock "DD/MM/YYYY hh:mm AM/PM"
 * date format so date-range filtering can use plain string comparison
 * (ISO-formatted date strings sort correctly without any Date parsing). */
function toIsoDateOnly(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

export default function AdjustmentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = location.state as IncomingState | null;

  // NOTE: this only merges records handed back from a same-navigation round
  // trip through NewAdjustmentPage. Since there's no shared/global store for
  // adjustments (out of scope here), navigating away and back later without
  // that router state resets the list to the seed mock data — the same
  // known limitation the existing Stock Out flow has.
  const [adjustments] = useState<AdjustmentRecord[]>(() => [
    ...(incoming?.newRecords ?? []),
    ...mockAdjustments,
  ]);
  const [itemCatalog] = useState<Record<string, ItemCatalogEntry>>(() => ({
    ...mockItemCatalog,
    ...(incoming?.newCatalogEntries ?? {}),
  }));

  const [searchTerm, setSearchTerm] = useState("");
  const [faultTypeFilter, setFaultTypeFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<AdjustmentRecord | null>(null);

  // ── Summary figures ──────────────────────────────────────────────────────

  const now = new Date();
  const thisMonthCount = adjustments.filter((r) => {
    const match = r.date.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return false;
    const [, , mm, yyyy] = match;
    return Number(mm) - 1 === now.getMonth() && Number(yyyy) === now.getFullYear();
  }).length;

  const mostCommonFault = useMemo(() => {
    const counts = new Map<string, number>();
    adjustments.forEach((r) =>
      r.faultTypes.forEach((f) => counts.set(f, (counts.get(f) ?? 0) + 1))
    );
    if (counts.size === 0) return "—";
    const maxCount = Math.max(...counts.values());
    const topFaults = [...counts.entries()]
      .filter(([, c]) => c === maxCount)
      .map(([f]) => f)
      .sort();
    return topFaults[0];
  }, [adjustments]);

  const faultTypeOptions = useMemo(() => {
    const unique = new Set<string>();
    adjustments.forEach((r) => r.faultTypes.forEach((f) => unique.add(f)));
    return [...unique].sort();
  }, [adjustments]);

  // ── Filtering / pagination ───────────────────────────────────────────────

  const filteredAdjustments = adjustments.filter((record) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      record.assetId.toLowerCase().includes(search) ||
      record.itemName.toLowerCase().includes(search);

    const matchesFault =
      faultTypeFilter === "All" || record.faultTypes.includes(faultTypeFilter);

    const recordIso = toIsoDateOnly(record.date);
    const matchesFrom = !dateFrom || (recordIso !== null && recordIso >= dateFrom);
    const matchesTo = !dateTo || (recordIso !== null && recordIso <= dateTo);

    return matchesSearch && matchesFault && matchesFrom && matchesTo;
  });

  const totalPages = Math.max(1, Math.ceil(filteredAdjustments.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedAdjustments = filteredAdjustments.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  const handleClearFilters = () => {
    setSearchTerm("");
    setFaultTypeFilter("All");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  // ── Export CSV ───────────────────────────────────────────────────────────

  const handleExportCsv = () => {
    const header = "Date & Time,Asset ID,Item Name,Fault Types,From,To,Adjusted By,Notes";
    const lines = filteredAdjustments.map((r) => {
      const faultCell = r.faultTypes.join(" | ").replace(/"/g, '""');
      const notesCell = r.notes.replace(/"/g, '""');
      return `"${r.date}","${r.assetId}","${r.itemName}","${faultCell}","${r.fromStatus}","${r.toStatus}","${r.adjustedBy}","${notesCell}"`;
    });
    const csvContent = [header, ...lines].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "inventory_adjustments.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const catalogFor = (record: AdjustmentRecord): ItemCatalogEntry | undefined =>
    itemCatalog[record.itemName];

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

      {/* ── Summary strip ─────────────────────────────────────────────────── */}
      <div className="adj-summary-strip">
        <div className="adj-summary-item">
          <div className="adj-summary-icon adj-icon-blue">
            <ClipboardList size={16} />
          </div>
          <div>
            <span>Total Adjustments</span>
            <h3>{adjustments.length}</h3>
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
              {paginatedAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="adj-empty-row">
                    No adjustments found.
                  </td>
                </tr>
              ) : (
                paginatedAdjustments.map((record) => (
                  <tr key={record.id}>
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
            Showing {filteredAdjustments.length === 0 ? 0 : startIndex + 1}–
            {Math.min(startIndex + ITEMS_PER_PAGE, filteredAdjustments.length)} of{" "}
            {filteredAdjustments.length} entries
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
                    <p>{catalogFor(selectedRecord)?.category ?? "—"}</p>
                  </div>
                  <div>
                    <span>Brand</span>
                    <p>{catalogFor(selectedRecord)?.brand ?? "—"}</p>
                  </div>
                  <div>
                    <span>Model</span>
                    <p>{catalogFor(selectedRecord)?.model ?? "—"}</p>
                  </div>
                  <div className="adj-drawer-full">
                    <span>Specs</span>
                    <p>{catalogFor(selectedRecord)?.specs ?? "—"}</p>
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
