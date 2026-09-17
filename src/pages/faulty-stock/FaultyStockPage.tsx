// ─── Faulty Stock Page ────────────────────────────────────────────────────────
//
// Dedicated workspace for monitoring and managing every inventory item
// currently marked Faulty. Admin and Warehouse Staff get full access (edit
// fault types, restore to Ok); Warranty Officer gets read-only access — see
// isReadOnly below, driven by the "faultyStock" module in permissions.ts.
//
// Backed by the real /inventory?status=FAULTY endpoint. Only status and the
// search box are sent server-side — the backend has no batchId/fault-type/
// model filters, so those three stay applied client-side on top of whatever
// the server returns, the same way ViewImportedInventoryPage layers its
// unsupported "condition" filter on top of its server-filtered results.

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Pencil, Printer, RotateCcw, X, AlertTriangle, AlertOctagon, Layers } from "lucide-react";

import "./FaultyStockPage.css";
import { toFaultyStockItem } from "./faultyStockTypes";
import type { FaultyStockItem } from "./faultyStockTypes";
import type { BackendInventoryItem } from "../database/databaseTypes";
import { dropdownValues } from "../dropdowns/mockDropdown";
import { apiFetch } from "../../services/api";

import { SearchBar, Pagination, Button, Modal } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { canEdit } from "../../utils/permissions";

const ITEMS_PER_PAGE = 10;
const ALL_FAULT_TYPES = dropdownValues.fault.map((f) => f.name);

function buildSpecs(item: FaultyStockItem): string {
  return (
    [item.processor, item.generation, item.ram, item.storage, item.speed]
      .filter(Boolean)
      .join(" • ") || "—"
  );
}

/** Splits the "DD/MM/YYYY hh:mm AM/PM" display string into its date and time
 * halves so the table/drawer can render them on separate lines. */
function splitDateMarked(value: string): { date: string; time: string } {
  const [datePart, ...rest] = value.split(" ");
  return { date: datePart ?? "", time: rest.join(" ") };
}

export default function FaultyStockPage() {
  const { user } = useAuth();
  const isReadOnly = !user || !canEdit(user.role, "faultyStock");

  const [faultyStock, setFaultyStock] = useState<FaultyStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [batchFilter, setBatchFilter] = useState("All");
  const [faultFilter, setFaultFilter] = useState("All");
  const [modelFilter, setModelFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedItem, setSelectedItem] = useState<FaultyStockItem | null>(null);

  const [editTarget, setEditTarget] = useState<FaultyStockItem | null>(null);
  const [editFaultTypes, setEditFaultTypes] = useState<string[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const [editError, setEditError] = useState("");

  const [restoreTarget, setRestoreTarget] = useState<FaultyStockItem | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // ── Fetch — status=FAULTY always applied; search is debounced server-side. ─

  useEffect(() => {
    let cancelled = false;

    const timeoutId = setTimeout(() => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ status: "FAULTY" });
      if (searchTerm.trim()) params.set("search", searchTerm.trim());

      apiFetch<BackendInventoryItem[]>(`/inventory?${params.toString()}`)
        .then((rows) => {
          if (!cancelled) setFaultyStock(rows.map(toFaultyStockItem));
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
  }, [searchTerm]);

  // ── Filter option lists ──────────────────────────────────────────────────

  const batchIds = useMemo(
    () => [...new Set(faultyStock.map((i) => i.batchId))].sort(),
    [faultyStock]
  );
  const models = useMemo(
    () => [...new Set(faultyStock.map((i) => i.model))].sort(),
    [faultyStock]
  );
  const faultOptions = useMemo(() => {
    const unique = new Set<string>();
    faultyStock.forEach((i) => i.faultTypes.forEach((f) => unique.add(f)));
    return [...unique].sort();
  }, [faultyStock]);

  // ── Summary figures ──────────────────────────────────────────────────────

  const mostCommonFault = useMemo(() => {
    const counts = new Map<string, number>();
    faultyStock.forEach((i) => i.faultTypes.forEach((f) => counts.set(f, (counts.get(f) ?? 0) + 1)));
    if (counts.size === 0) return "—";
    const maxCount = Math.max(...counts.values());
    const topFaults = [...counts.entries()]
      .filter(([, c]) => c === maxCount)
      .map(([f]) => f)
      .sort();
    return topFaults[0];
  }, [faultyStock]);

  const categoriesAffected = useMemo(
    () => new Set(faultyStock.map((i) => i.category)).size,
    [faultyStock]
  );

  // ── Client-side filtering (batch/fault/model — unsupported server-side) ──

  const filteredItems = faultyStock.filter((item) => {
    const matchesBatch = batchFilter === "All" || item.batchId === batchFilter;
    const matchesFault = faultFilter === "All" || item.faultTypes.includes(faultFilter);
    const matchesModel = modelFilter === "All" || item.model === modelFilter;

    return matchesBatch && matchesFault && matchesModel;
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleClearFilters = () => {
    setSearchTerm("");
    setBatchFilter("All");
    setFaultFilter("All");
    setModelFilter("All");
    setCurrentPage(1);
  };

  // ── Drawer ────────────────────────────────────────────────────────────────

  const handleViewDetails = (item: FaultyStockItem) => setSelectedItem(item);
  const handleCloseDrawer = () => setSelectedItem(null);

  // Placeholder — sticker printing isn't built yet (separate feature).
  const handlePrintSticker = () => {};

  // ── Edit Fault modal ─────────────────────────────────────────────────────

  const handleOpenEditFault = (item: FaultyStockItem) => {
    setEditTarget(item);
    setEditFaultTypes([...item.faultTypes]);
    setEditNotes(item.notes);
    setEditError("");
  };

  const handleCloseEditFault = () => {
    setEditTarget(null);
    setEditFaultTypes([]);
    setEditNotes("");
    setEditError("");
  };

  const toggleEditFault = (fault: string) => {
    setEditFaultTypes((prev) =>
      prev.includes(fault) ? prev.filter((f) => f !== fault) : [...prev, fault]
    );
    setEditError("");
  };

  // TODO: wire up to the Adjustments endpoint once it exists (it doesn't
  // yet) — that's what should actually persist a fault-type/notes change.
  // Until then this only updates local state so the modal UI keeps working.
  const handleSaveEditFault = () => {
    if (!editTarget) return;
    if (editFaultTypes.length === 0) {
      setEditError("Select at least one fault type.");
      return;
    }

    const updated: FaultyStockItem = { ...editTarget, faultTypes: editFaultTypes, notes: editNotes };
    setFaultyStock((prev) => prev.map((i) => (i.assetId === updated.assetId ? updated : i)));

    if (selectedItem?.assetId === updated.assetId) {
      setSelectedItem(updated);
    }

    handleCloseEditFault();
  };

  // ── Restore to Ok ─────────────────────────────────────────────────────────

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    setRestoreError(null);

    try {
      await apiFetch(`/inventory/${encodeURIComponent(restoreTarget.assetId)}/restore`, {
        method: "PATCH",
      });

      setFaultyStock((prev) => prev.filter((i) => i.assetId !== restoreTarget.assetId));

      if (selectedItem?.assetId === restoreTarget.assetId) {
        setSelectedItem(null);
      }

      setRestoreTarget(null);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Failed to restore item.");
    } finally {
      setRestoring(false);
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExportCsv = () => {
    const header =
      "Asset ID,Category,Brand,Model,Processor,Generation,RAM,Storage,Speed,Screen Type,Fault Types,Date Marked Faulty,Adjusted By,Shipment ID,Batch ID,List Number,Notes";
    const lines = filteredItems.map((item) => {
      const cells = [
        item.assetId,
        item.category,
        item.brand,
        item.model,
        item.processor,
        item.generation,
        item.ram,
        item.storage,
        item.speed,
        item.screenType,
        item.faultTypes.join(" | "),
        item.dateMarkedFaulty,
        item.adjustedBy,
        item.shipmentId,
        item.batchId,
        item.listNumber,
        item.notes,
      ];
      return cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",");
    });
    const csvContent = [header, ...lines].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "faulty_stock.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => window.print();

  return (
    <div className="fs-page">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="fs-header">
        <div>
          <h1>Faulty Stock</h1>
          <p>Monitor and manage all faulty inventory items.</p>
        </div>
        <div className="fs-header-actions">
          <Button variant="secondary" onClick={handleExportCsv}>
            <Download size={16} />
            Export Report
          </Button>
          <Button variant="secondary" onClick={handleExportPdf}>
            <Download size={16} />
            Export PDF
          </Button>
        </div>
      </div>

      {/* ── Summary strip ─────────────────────────────────────────────────── */}
      <div className="fs-summary-strip">
        <div className="fs-summary-item">
          <div className="fs-summary-icon fs-icon-red">
            <AlertTriangle size={16} />
          </div>
          <div>
            <span>Total Faulty Items</span>
            <h3>{faultyStock.length}</h3>
          </div>
        </div>

        <div className="fs-summary-item">
          <div className="fs-summary-icon fs-icon-red">
            <AlertOctagon size={16} />
          </div>
          <div>
            <span>Most Common Fault</span>
            <h3 className="fs-summary-text-value">{mostCommonFault}</h3>
          </div>
        </div>

        <div className="fs-summary-item">
          <div className="fs-summary-icon fs-icon-blue">
            <Layers size={16} />
          </div>
          <div>
            <span>Categories Affected</span>
            <h3>{categoriesAffected}</h3>
          </div>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="fs-filters-card">
        <SearchBar
          value={searchTerm}
          onChange={(value) => {
            setSearchTerm(value);
            setCurrentPage(1);
          }}
          placeholder="Search by asset ID, model or list number..."
          width={280}
        />

        <select
          value={batchFilter}
          onChange={(e) => {
            setBatchFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="All">All Batches</option>
          {batchIds.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <select
          value={faultFilter}
          onChange={(e) => {
            setFaultFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="All">All Faults</option>
          {faultOptions.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>

        <select
          value={modelFilter}
          onChange={(e) => {
            setModelFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="All">All Models</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <button className="fs-clear-filters-btn" onClick={handleClearFilters}>
          Clear Filters
        </button>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="fs-table-card">
        <div className="fs-table-wrap">
          <table className="fs-table">
            <thead>
              <tr>
                <th>Asset ID</th>
                <th>Model</th>
                <th>Specs Details</th>
                <th>Comments</th>
                <th>Faults</th>
                <th>Date Marked Faulty</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="fs-empty-row">
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="fs-empty-row">
                    Failed to load faulty stock: {error}
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="fs-empty-row">
                    No faulty items match your search/filters.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const { date, time } = splitDateMarked(item.dateMarkedFaulty);
                  const visibleFaults = item.faultTypes.slice(0, 2);
                  const extraFaultCount = item.faultTypes.length - visibleFaults.length;

                  return (
                    <tr key={item.assetId}>
                      <td className="fs-asset-id">{item.assetId}</td>
                      <td>
                        <div className="fs-model-cell">
                          <span className="fs-model-name">{item.model}</span>
                          <span className="fs-model-brand">{item.brand}</span>
                        </div>
                      </td>
                      <td className="fs-specs-cell">{buildSpecs(item)}</td>
                      <td className="fs-comments-cell">{item.screenType || "—"}</td>
                      <td>
                        <div className="fs-fault-pills">
                          {visibleFaults.map((fault) => (
                            <span key={fault} className="fs-fault-pill">
                              {fault}
                            </span>
                          ))}
                          {extraFaultCount > 0 && (
                            <span className="fs-fault-pill-more">+{extraFaultCount} more</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="fs-date-cell">
                          <span className="fs-date-value">{date}</span>
                          <span className="fs-time-value">{time}</span>
                        </div>
                      </td>
                      <td>
                        <div className="fs-actions">
                          <button
                            className="fs-action-btn"
                            title="View details"
                            onClick={() => handleViewDetails(item)}
                          >
                            <Eye size={14} />
                          </button>

                          {!isReadOnly && (
                            <button
                              className="fs-action-btn"
                              title="Edit fault"
                              onClick={() => handleOpenEditFault(item)}
                            >
                              <Pencil size={14} />
                            </button>
                          )}

                          {!isReadOnly && (
                            <button
                              className="fs-action-btn"
                              title="Restore to Ok"
                              onClick={() => {
                                setRestoreTarget(item);
                                setRestoreError(null);
                              }}
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}

                          <button
                            className="fs-action-btn"
                            title="Print asset sticker"
                            onClick={handlePrintSticker}
                          >
                            <Printer size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="fs-footer">
          <span>
            Showing {paginatedItems.length} of {filteredItems.length} items
          </span>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* ── Faulty item detail drawer ────────────────────────────────────── */}
      {selectedItem && (
        <div className="fs-drawer-overlay" onClick={handleCloseDrawer}>
          <div className="fs-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="fs-drawer-header">
              <div>
                <h2>{selectedItem.assetId}</h2>
                <p>Faulty Item Detail</p>
              </div>
              <button className="fs-drawer-close" onClick={handleCloseDrawer}>
                <X size={16} />
              </button>
            </div>

            <div className="fs-drawer-body">
              {/* Asset information */}
              <div className="fs-drawer-section">
                <h4>Asset Information</h4>
                <div className="fs-drawer-grid">
                  <div>
                    <span>Asset ID</span>
                    <p className="fs-drawer-mono">{selectedItem.assetId}</p>
                  </div>
                  <div>
                    <span>Category</span>
                    <p>{selectedItem.category}</p>
                  </div>
                  <div>
                    <span>Brand</span>
                    <p>{selectedItem.brand}</p>
                  </div>
                  <div>
                    <span>Model</span>
                    <p>{selectedItem.model}</p>
                  </div>
                </div>
              </div>

              {/* Technical specifications */}
              <div className="fs-drawer-section">
                <h4>Technical Specifications</h4>
                <div className="fs-drawer-grid">
                  <div>
                    <span>Processor</span>
                    <p>{selectedItem.processor || "—"}</p>
                  </div>
                  <div>
                    <span>Generation</span>
                    <p>{selectedItem.generation || "—"}</p>
                  </div>
                  <div>
                    <span>RAM</span>
                    <p>{selectedItem.ram || "—"}</p>
                  </div>
                  <div>
                    <span>Storage</span>
                    <p>{selectedItem.storage || "—"}</p>
                  </div>
                  <div>
                    <span>Speed</span>
                    <p>{selectedItem.speed || "—"}</p>
                  </div>
                  <div>
                    <span>Screen Type</span>
                    <p>{selectedItem.screenType || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Fault information */}
              <div className="fs-drawer-section">
                <h4>Fault Information</h4>
                <div className="fs-fault-pills">
                  {selectedItem.faultTypes.map((fault) => (
                    <span key={fault} className="fs-fault-pill">
                      {fault}
                    </span>
                  ))}
                </div>
                {selectedItem.notes && <p className="fs-drawer-notes">{selectedItem.notes}</p>}
                <div className="fs-drawer-grid fs-drawer-grid-tight">
                  <div>
                    <span>Date Marked Faulty</span>
                    <p>{selectedItem.dateMarkedFaulty}</p>
                  </div>
                  <div>
                    <span>Adjusted By</span>
                    <p>{selectedItem.adjustedBy}</p>
                  </div>
                </div>
              </div>

              {/* Traceability */}
              <div className="fs-drawer-section">
                <h4>Traceability</h4>
                <div className="fs-drawer-grid">
                  <div>
                    <span>Shipment ID</span>
                    <p>{selectedItem.shipmentId}</p>
                  </div>
                  <div>
                    <span>Batch ID</span>
                    <p className="fs-drawer-mono">{selectedItem.batchId}</p>
                  </div>
                  <div>
                    <span>List Number</span>
                    <p>{selectedItem.listNumber}</p>
                  </div>
                </div>
              </div>
            </div>

            {!isReadOnly && (
              <div className="fs-drawer-footer">
                <Button variant="secondary" onClick={() => handleOpenEditFault(selectedItem)}>
                  <Pencil size={14} />
                  Edit Fault
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setRestoreTarget(selectedItem);
                    setRestoreError(null);
                  }}
                >
                  <RotateCcw size={14} />
                  Restore to Ok
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Fault modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={editTarget !== null}
        onClose={handleCloseEditFault}
        title={editTarget ? `Edit Fault — ${editTarget.assetId}` : undefined}
        width={480}
      >
        {editTarget && (
          <>
            <div className="fs-current-faults">
              <span className="fs-field-label">Current Fault Types</span>
              <div className="fs-fault-pills">
                {editTarget.faultTypes.map((fault) => (
                  <span key={fault} className="fs-fault-pill">
                    {fault}
                  </span>
                ))}
              </div>
            </div>

            <div className="fs-field">
              <span className="fs-field-label">Fault Types</span>
              <div className="fs-fault-checklist">
                {ALL_FAULT_TYPES.map((fault) => (
                  <label key={fault} className="fs-fault-checkbox">
                    <input
                      type="checkbox"
                      checked={editFaultTypes.includes(fault)}
                      onChange={() => toggleEditFault(fault)}
                    />
                    {fault}
                  </label>
                ))}
              </div>
              {editError && <span className="field-error">{editError}</span>}
            </div>

            <div className="fs-field">
              <span className="fs-field-label">Notes</span>
              <textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Any additional detail about the fault..."
              />
            </div>

            <div className="modal-actions">
              <Button variant="secondary" onClick={handleCloseEditFault}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveEditFault}>
                Save Changes
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Restore to Ok confirmation ────────────────────────────────────── */}
      <Modal
        isOpen={restoreTarget !== null}
        onClose={() => setRestoreTarget(null)}
        title="Restore Item to Ok"
        width={420}
      >
        {restoreTarget && (
          <>
            <p>
              Are you sure you want to restore <strong>{restoreTarget.assetId}</strong> to Ok
              status? This item will be removed from the Faulty Stock list and its fault record
              will be cleared.
            </p>
            {restoreError && <span className="field-error">{restoreError}</span>}
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setRestoreTarget(null)} disabled={restoring}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmRestore} disabled={restoring}>
                {restoring ? "Restoring..." : "Confirm Restore"}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
