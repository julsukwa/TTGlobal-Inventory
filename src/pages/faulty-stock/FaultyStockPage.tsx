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
import {
  Download,
  Eye,
  Pencil,
  Printer,
  RotateCcw,
  Search,
  X,
  AlertTriangle,
  AlertOctagon,
  Layers,
} from "lucide-react";

import "./FaultyStockPage.css";
import { toFaultyStockItem } from "./faultyStockTypes";
import type { FaultyStockItem } from "./faultyStockTypes";
import type { BackendInventoryItem } from "../database/databaseTypes";
import { apiFetch } from "../../services/api";
import { useStickerPrint } from "../../hooks/useStickerPrint";

import { Pagination, Button, Modal, StickerPrintPreview, ListNumberBadge } from "../../components/ui";
import type { AssetStickerProps } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { canEdit } from "../../utils/permissions";

function toStickerProps(item: FaultyStockItem): AssetStickerProps {
  return {
    assetId: item.assetId,
    batchId: item.batchId,
    brand: item.brand,
    model: item.model,
    category: item.category,
    processor: item.processor,
    generation: item.generation,
    ram: item.ram,
    storage: item.storage,
    speed: item.speed,
    screenType: item.screenType,
  };
}

interface DropdownValueApi {
  id: number;
  category: string;
  value: string;
  isActive: boolean;
  createdAt: string;
}

// GET /inventory/:assetId's response, narrowed to the one extra field (over
// BackendInventoryItem) this page needs: the adjustment history, newest
// first, so its [0] is the adjustment currently driving this item's fault.
interface InventoryDetailWithAdjustments extends BackendInventoryItem {
  adjustments: { id: number }[];
}

const ITEMS_PER_PAGE = 20;

export default function FaultyStockPage() {
  const { user } = useAuth();
  const isReadOnly = !user || !canEdit(user.role, "faultyStock");

  const [faultyStock, setFaultyStock] = useState<FaultyStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fault type options — live from the Dropdowns module, offered as the Edit
  // Fault checklist. (Named apart from the `faultOptions` filter-dropdown
  // list further down, which is derived from the faulty items themselves.)
  const [activeFaultTypes, setActiveFaultTypes] = useState<string[]>([]);

  useEffect(() => {
    apiFetch<DropdownValueApi[]>("/dropdowns/active/Fault")
      .then((data) => setActiveFaultTypes(data.map((d) => d.value)))
      .catch(() => {
        // Checklist just stays empty on failure — it's read-only anyway.
      });
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [batchFilter, setBatchFilter] = useState("All");
  const [faultFilter, setFaultFilter] = useState("All");
  const [modelFilter, setModelFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedItem, setSelectedItem] = useState<FaultyStockItem | null>(null);

  const { printStickers, showPrintPreview, printSingle, closePrint } = useStickerPrint();

  const [editTarget, setEditTarget] = useState<FaultyStockItem | null>(null);
  const [editFaultTypes, setEditFaultTypes] = useState<string[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const [editError, setEditError] = useState("");
  const [savingEditFault, setSavingEditFault] = useState(false);

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
  // Clamped: restoring the last item on a page can shrink the list under it.
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
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

  const handlePrintSticker = (item: FaultyStockItem) => {
    printSingle(toStickerProps(item));
  };

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

  // The adjustment being edited isn't known to this page directly — only the
  // inventory item is — so this looks it up via GET /inventory/:assetId
  // first (its `adjustments` array is ordered newest-first) before calling
  // PATCH /adjustments/:id with the edited fault types and notes.
  const handleSaveEditFault = async () => {
    if (!editTarget) return;
    if (editFaultTypes.length === 0) {
      setEditError("Select at least one fault type.");
      return;
    }

    setSavingEditFault(true);
    setEditError("");

    try {
      const detail = await apiFetch<InventoryDetailWithAdjustments>(
        `/inventory/${encodeURIComponent(editTarget.assetId)}`
      );
      const latestAdjustment = detail.adjustments[0];
      if (!latestAdjustment) {
        throw new Error("No adjustment record found for this item.");
      }

      await apiFetch(`/adjustments/${latestAdjustment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ faultTypes: editFaultTypes, notes: editNotes }),
      });

      const updated: FaultyStockItem = { ...editTarget, faultTypes: editFaultTypes, notes: editNotes };
      setFaultyStock((prev) => prev.map((i) => (i.assetId === updated.assetId ? updated : i)));

      if (selectedItem?.assetId === updated.assetId) {
        setSelectedItem(updated);
      }

      handleCloseEditFault();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSavingEditFault(false);
    }
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
      "Asset ID,Category,Brand,Model,Processor,Generation,RAM,Storage,Speed,Comment,Fault Types,Date Marked Faulty,Adjusted By,Shipment ID,Batch ID,List Number,Notes";
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

  const rangeStart = filteredItems.length === 0 ? 0 : startIndex + 1;
  const rangeEnd = Math.min(startIndex + ITEMS_PER_PAGE, filteredItems.length);

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

      {/* ── Table card (toolbar + table + footer) ─────────────────────────── */}
      <div className="fs-table-card">
        <div className="fs-toolbar">
          <div className="fs-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search by asset ID, model or list number..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="fs-filter">
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
          </div>

          <div className="fs-filter">
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
          </div>

          <div className="fs-filter">
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
          </div>

          <button className="fs-clear-filters-btn" onClick={handleClearFilters}>
            Clear Filters
          </button>
        </div>

        <div className="fs-table-wrap">
          <table className="fs-table">
            <thead>
              <tr>
                <th>List Number</th>
                <th>Asset ID</th>
                <th>Batch ID</th>
                <th>Category</th>
                <th>Condition</th>
                <th>Brand</th>
                <th>Model</th>
                <th>Processor</th>
                <th>Generation</th>
                <th>RAM</th>
                <th>Storage</th>
                <th>Speed</th>
                <th>Comment</th>
                <th>Status</th>
                <th>Faults</th>
                <th>Created At</th>
                <th className="fs-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={17} className="fs-empty-row">
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={17} className="fs-empty-row">
                    Failed to load faulty stock: {error}
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={17} className="fs-empty-row">
                    No faulty items match your search/filters.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr key={item.assetId}>
                    <td>
                      <ListNumberBadge value={item.listNumber} />
                    </td>
                    <td className="fs-asset-id">{item.assetId}</td>
                    <td>
                      <span className="fs-batch-pill">{item.batchId}</span>
                    </td>
                    <td>
                      <span className="fs-category-badge">{item.category}</span>
                    </td>
                    <td>
                      {item.condition ? (
                        <span
                          className={`condition-badge condition-${item.condition.toLowerCase()}`}
                        >
                          {item.condition}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{item.brand}</td>
                    <td>{item.model}</td>
                    <td className="fs-specs-cell">{item.processor || "—"}</td>
                    <td className="fs-specs-cell">{item.generation || "—"}</td>
                    <td className="fs-specs-cell">{item.ram || "—"}</td>
                    <td className="fs-specs-cell">{item.storage || "—"}</td>
                    <td className="fs-specs-cell">{item.speed || "—"}</td>
                    <td>
                      {item.screenType ? (
                        <span
                          className={`fs-comment-badge ${
                            item.screenType === "Touch Screen"
                              ? "fs-comment-touch"
                              : "fs-comment-nontouch"
                          }`}
                        >
                          {item.screenType}
                        </span>
                      ) : (
                        <span className="fs-comment-blank">—</span>
                      )}
                    </td>
                    <td>
                      <span className="fs-status-pill fs-status-faulty">Faulty</span>
                    </td>
                    <td>
                      <div className="fs-fault-pills">
                        {item.faultTypes.slice(0, 2).map((fault) => (
                          <span key={fault} className="fs-fault-pill">
                            {fault}
                          </span>
                        ))}
                        {item.faultTypes.length > 2 && (
                          <span className="fs-fault-pill-more">+{item.faultTypes.length - 2} more</span>
                        )}
                      </div>
                    </td>
                    <td className="fs-date-cell">{item.importDate}</td>
                    <td className="fs-actions-col">
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
                          onClick={() => handlePrintSticker(item)}
                        >
                          <Printer size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="fs-table-footer">
          <span>
            Showing {rangeStart}–{rangeEnd} of {filteredItems.length} entries
          </span>
          <Pagination
            currentPage={page}
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
              <h2>Asset Details</h2>
              <button className="fs-drawer-close" onClick={handleCloseDrawer}>
                <X size={18} />
              </button>
            </div>

            <div className="fs-drawer-body">
              {/* Asset overview */}
              <div className="fs-drawer-overview">
                <span className="fs-drawer-asset-id">{selectedItem.assetId}</span>
                <h3>
                  {selectedItem.brand} {selectedItem.model}
                </h3>
                <div className="fs-drawer-badges">
                  <span className="fs-status-pill fs-status-faulty">Faulty</span>
                </div>
              </div>

              {/* Technical specifications */}
              <div className="fs-drawer-section">
                <h4>Technical Specifications</h4>
                <div className="fs-drawer-grid">
                  <div>
                    <span>Category</span>
                    <p>{selectedItem.category}</p>
                  </div>
                  <div>
                    <span>Condition</span>
                    <p>{selectedItem.condition || "—"}</p>
                  </div>
                  <div>
                    <span>Brand</span>
                    <p>{selectedItem.brand}</p>
                  </div>
                  <div>
                    <span>Model</span>
                    <p>{selectedItem.model}</p>
                  </div>
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
                    <span>Comment</span>
                    <p>{selectedItem.screenType || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Import information */}
              <div className="fs-drawer-section">
                <h4>Import Information</h4>
                <div className="fs-drawer-grid">
                  <div>
                    <span>Shipment ID</span>
                    <p>{selectedItem.shipmentId}</p>
                  </div>
                  <div>
                    <span>Shipment Name</span>
                    <p>{selectedItem.shipmentName}</p>
                  </div>
                  <div>
                    <span>Vendor</span>
                    <p>{selectedItem.vendorId}</p>
                  </div>
                  <div>
                    <span>Batch ID</span>
                    <p>{selectedItem.batchId}</p>
                  </div>
                  <div>
                    <span>List Number</span>
                    <p>{selectedItem.listNumber || "-"}</p>
                  </div>
                  <div>
                    <span>Date Imported</span>
                    <p>{selectedItem.importDate}</p>
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
            </div>

            <div className="fs-drawer-footer">
              <button
                className="fs-drawer-btn-secondary"
                onClick={() => handlePrintSticker(selectedItem)}
              >
                <Printer size={14} />
                Print Sticker
              </button>
              {!isReadOnly && (
                <>
                  <button
                    className="fs-drawer-btn-secondary"
                    onClick={() => handleOpenEditFault(selectedItem)}
                  >
                    <Pencil size={14} />
                    Edit Fault
                  </button>
                  <button
                    className="fs-drawer-btn-primary"
                    onClick={() => {
                      setRestoreTarget(selectedItem);
                      setRestoreError(null);
                    }}
                  >
                    <RotateCcw size={14} />
                    Restore to Ok
                  </button>
                </>
              )}
            </div>
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
                {activeFaultTypes.map((fault) => (
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
              <Button variant="secondary" onClick={handleCloseEditFault} disabled={savingEditFault}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveEditFault} disabled={savingEditFault}>
                {savingEditFault ? "Saving..." : "Save Changes"}
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

      {showPrintPreview && (
        <StickerPrintPreview stickers={printStickers} onClose={closePrint} />
      )}
    </div>
  );
}
