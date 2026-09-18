// ─── Database Page ────────────────────────────────────────────────────────────
//
// The system-wide, cross-shipment inventory repository — every asset ever
// imported, in one searchable/filterable table. This is the same underlying
// data ViewImportedInventoryPage shows scoped to a single shipment; here it's
// unscoped, with a universal search bar plus six independent filters.
//
// The Asset Information drawer follows the exact view/edit toggle pattern
// used on ViewImportedInventoryPage: Asset ID / ID Source / Batch ID /
// Shipment ID / Vendor ID / List Number / Import Date are protected (shown,
// never editable) since they preserve traceability back to the import
// session; only the physical-spec fields and notes can change.
//
// Backed by the real /inventory API — see backend/src/inventory.

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  Download,
  Eye,
  MoreVertical,
  X,
  Pencil,
  Printer,
  RotateCcw,
  Package,
  CheckCircle2,
  AlertTriangle,
  ArrowUpFromLine,
} from "lucide-react";

import "./DatabasePage.css";
import { toInventoryAsset } from "./databaseTypes";
import type { InventoryAsset, BackendInventoryItem, InventoryStats } from "./databaseTypes";
import { apiFetch } from "../../services/api";
import { useStickerPrint } from "../../hooks/useStickerPrint";

import {
  StatusBadge,
  SearchBar,
  Pagination,
  Button,
  Modal,
  StickerPrintPreview,
} from "../../components/ui";
import type { AssetStickerProps } from "../../components/ui";

function toStickerProps(item: InventoryAsset): AssetStickerProps {
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
    screenType: item.screenType,
  };
}

const ITEMS_PER_PAGE = 10;

function buildSpecs(item: InventoryAsset): string {
  return (
    [item.processor, item.generation, item.ram, item.storage, item.speed]
      .filter(Boolean)
      .join(" • ") || "—"
  );
}

export default function DatabasePage() {
  // ── Stats (summary strip) ────────────────────────────────────────────────
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<InventoryStats>("/inventory/stats")
      .then(setStats)
      .catch((err: Error) => setStatsError(err.message));
  }, []);

  // Unfiltered snapshot — used only to derive stable filter dropdown options,
  // independent of whatever's currently filtered in the table below.
  const [allItems, setAllItems] = useState<InventoryAsset[]>([]);

  useEffect(() => {
    apiFetch<BackendInventoryItem[]>("/inventory")
      .then((rows) => setAllItems(rows.map(toInventoryAsset)))
      .catch(() => {
        // Filter dropdowns just stay empty on failure — the main (filtered)
        // fetch below still reports its own error if it fails.
      });
  }, []);

  const [inventory, setInventory] = useState<InventoryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The Topbar's global search hands off here via /database?search=X — read
  // it as the initial term so the first fetch is already filtered, and again
  // on any later navigation (location.key changes even for a repeat of the
  // same URL) since this page stays mounted when the operator is already on it.
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("search") ?? "");

  useEffect(() => {
    const urlSearch = searchParams.get("search");
    if (urlSearch !== null) {
      setSearchTerm(urlSearch);
      setCurrentPage(1);
    }
  }, [location.key, searchParams]);

  const [categoryFilter, setCategoryFilter] = useState("All");
  const [brandFilter, setBrandFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [vendorFilter, setVendorFilter] = useState("All");
  const [shipmentFilter, setShipmentFilter] = useState("All");
  const [idSourceFilter, setIdSourceFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedAsset, setSelectedAsset] = useState<InventoryAsset | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<InventoryAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const openMenuRef = useRef<HTMLDivElement>(null);
  const [restoreTarget, setRestoreTarget] = useState<InventoryAsset | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const { printStickers, showPrintPreview, printSingle, closePrint } = useStickerPrint();

  // Close the open three-dot menu on any click outside it — same pattern
  // used on StaffPage.
  useEffect(() => {
    if (openMenuId === null) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (openMenuRef.current && !openMenuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  // ── Filter option lists — derived from the unfiltered snapshot ──────────

  const categories = useMemo(
    () => [...new Set(allItems.map((i) => i.category))].sort(),
    [allItems]
  );
  const brands = useMemo(() => [...new Set(allItems.map((i) => i.brand))].sort(), [allItems]);
  const vendors = useMemo(
    () => [...new Set(allItems.map((i) => i.vendorId))].sort(),
    [allItems]
  );
  const shipments = useMemo(
    () => [...new Set(allItems.map((i) => i.shipmentId))].sort(),
    [allItems]
  );

  // ── Summary figures — from GET /inventory/stats ──────────────────────────

  const totalInventory = stats?.totalInventory ?? 0;
  const okCount = stats?.okCount ?? 0;
  const faultyCount = stats?.faultyCount ?? 0;
  const issuedCount = stats?.issuedCount ?? 0;

  // ── Filtered fetch — search/category/brand/status/vendor/shipment/id
  // source are all applied server-side. Debounced so typing in the search
  // box doesn't fire a request per keystroke. ──────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const timeoutId = setTimeout(() => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (categoryFilter !== "All") params.set("category", categoryFilter);
      if (brandFilter !== "All") params.set("brand", brandFilter);
      if (statusFilter !== "All") params.set("status", statusFilter.toUpperCase());
      if (vendorFilter !== "All") params.set("vendor", vendorFilter);
      if (shipmentFilter !== "All") params.set("shipmentId", shipmentFilter);
      if (idSourceFilter !== "All") {
        params.set("assetIdSource", idSourceFilter === "Generated" ? "GENERATED" : "PROVIDED");
      }
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      const query = params.toString();

      apiFetch<BackendInventoryItem[]>(`/inventory${query ? `?${query}` : ""}`)
        .then((rows) => {
          if (!cancelled) setInventory(rows.map(toInventoryAsset));
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
  }, [categoryFilter, brandFilter, statusFilter, vendorFilter, shipmentFilter, idSourceFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(inventory.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedAssets = inventory.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Keeps a single row's state in sync everywhere it's cached (the current
  // filtered table, the unfiltered dropdown snapshot, and an open drawer)
  // after an edit or restore, without refetching either list from scratch.
  const patchLocalItem = (updated: InventoryAsset) => {
    setInventory((prev) => prev.map((i) => (i.assetId === updated.assetId ? updated : i)));
    setAllItems((prev) => prev.map((i) => (i.assetId === updated.assetId ? updated : i)));
    setSelectedAsset((prev) => (prev?.assetId === updated.assetId ? updated : prev));
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("All");
    setBrandFilter("All");
    setStatusFilter("All");
    setVendorFilter("All");
    setShipmentFilter("All");
    setIdSourceFilter("All");
    setCurrentPage(1);
  };

  // ── Drawer ────────────────────────────────────────────────────────────────

  const handleViewDetails = (item: InventoryAsset) => {
    setSelectedAsset(item);
    setIsEditing(false);
    setEditForm(null);
    setSaveError(null);
    setOpenMenuId(null);
  };

  const handleEditFromMenu = (item: InventoryAsset) => {
    setSelectedAsset(item);
    setEditForm({ ...item });
    setIsEditing(true);
    setSaveError(null);
    setOpenMenuId(null);
  };

  const handleCloseDrawer = () => {
    setSelectedAsset(null);
    setIsEditing(false);
    setEditForm(null);
    setSaveError(null);
  };

  const handleStartEdit = () => {
    if (!selectedAsset) return;
    setEditForm({ ...selectedAsset });
    setIsEditing(true);
    setSaveError(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm(null);
    setSaveError(null);
  };

  const handleEditFieldChange = (field: keyof InventoryAsset, value: string) => {
    if (!editForm) return;
    setEditForm({ ...editForm, [field]: value });
  };

  const handleSaveEdit = async () => {
    if (!editForm) return;
    setSaving(true);
    setSaveError(null);

    try {
      const updated = await apiFetch<BackendInventoryItem>(
        `/inventory/${encodeURIComponent(editForm.assetId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            brand: editForm.brand,
            model: editForm.model,
            processor: editForm.processor,
            generation: editForm.generation,
            ram: editForm.ram,
            storage: editForm.storage,
            speed: editForm.speed,
            screenType: editForm.screenType,
            notes: editForm.notes,
          }),
        }
      );

      const mapped = toInventoryAsset(updated);
      patchLocalItem(mapped);
      setIsEditing(false);
      setEditForm(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrintSticker = (item: InventoryAsset) => {
    printSingle(toStickerProps(item));
  };

  // ── Restore to Ok ─────────────────────────────────────────────────────────

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    setRestoreError(null);

    try {
      const updated = await apiFetch<BackendInventoryItem>(
        `/inventory/${encodeURIComponent(restoreTarget.assetId)}/restore`,
        { method: "PATCH" }
      );

      patchLocalItem(toInventoryAsset(updated));
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
      "Asset ID,ID Source,List Number,Batch ID,Shipment ID,Vendor ID,Category,Brand,Model,Processor,Generation,RAM,Storage,Speed,Screen Type,Status,Import Date,Fault Types,Notes";
    const lines = inventory.map((item) => {
      const cells = [
        item.assetId,
        item.assetIdSource,
        item.listNumber,
        item.batchId,
        item.shipmentId,
        item.vendorId,
        item.category,
        item.brand,
        item.model,
        item.processor,
        item.generation,
        item.ram,
        item.storage,
        item.speed,
        item.screenType,
        item.status,
        item.importDate,
        item.faultTypes.join(" | "),
        item.notes,
      ];
      return cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",");
    });
    const csvContent = [header, ...lines].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "inventory_database.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // No PDF library is part of this project yet, so this uses the browser's
  // native print dialog — every browser offers "Save as PDF" there, which
  // gets a real PDF out without adding a new dependency for one button.
  const handleExportPdf = () => window.print();

  return (
    <div className="db-page">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="db-header">
        <div>
          <h1>Database</h1>
          <p>View, search and manage all inventory records in the system.</p>
        </div>
        <div className="db-header-actions">
          <Button variant="secondary" onClick={handleExportCsv}>
            <Download size={16} />
            Export CSV
          </Button>
          <Button variant="secondary" onClick={handleExportPdf}>
            <Download size={16} />
            Export PDF
          </Button>
        </div>
      </div>

      {statsError && <p className="field-error">Failed to load statistics: {statsError}</p>}

      {/* ── Summary strip ─────────────────────────────────────────────────── */}
      <div className="db-summary-strip">
        <div className="db-summary-item">
          <div className="db-summary-icon db-icon-blue">
            <Package size={16} />
          </div>
          <div>
            <span>Total Inventory</span>
            <h3>{stats ? totalInventory : "—"}</h3>
          </div>
        </div>

        <div className="db-summary-item">
          <div className="db-summary-icon db-icon-green">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <span>Available (Ok)</span>
            <h3>{stats ? okCount : "—"}</h3>
          </div>
        </div>

        <div className="db-summary-item">
          <div className="db-summary-icon db-icon-red">
            <AlertTriangle size={16} />
          </div>
          <div>
            <span>Faulty</span>
            <h3>{stats ? faultyCount : "—"}</h3>
          </div>
        </div>

        <div className="db-summary-item">
          <div className="db-summary-icon db-icon-indigo">
            <ArrowUpFromLine size={16} />
          </div>
          <div>
            <span>Issued</span>
            <h3>{stats ? issuedCount : "—"}</h3>
          </div>
        </div>
      </div>

      {/* ── Universal search ─────────────────────────────────────────────── */}
      <div className="db-universal-search">
        <SearchBar
          value={searchTerm}
          onChange={(value) => {
            setSearchTerm(value);
            setCurrentPage(1);
          }}
          placeholder="Search by Asset ID, Model, Batch ID or List Number..."
        />
      </div>

      {/* ── Advanced filters ─────────────────────────────────────────────── */}
      <div className="db-filters-card">
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="All">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={brandFilter}
          onChange={(e) => {
            setBrandFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="All">All Brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="All">All Statuses</option>
          <option value="Ok">Ok</option>
          <option value="Faulty">Faulty</option>
          <option value="Issued">Issued</option>
        </select>

        <select
          value={vendorFilter}
          onChange={(e) => {
            setVendorFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="All">All Vendors</option>
          {vendors.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        <select
          value={shipmentFilter}
          onChange={(e) => {
            setShipmentFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="All">All Shipments</option>
          {shipments.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={idSourceFilter}
          onChange={(e) => {
            setIdSourceFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="All">All ID Sources</option>
          <option value="Generated">Generated</option>
          <option value="Provided">Provided</option>
        </select>

        <button className="db-clear-filters-btn" onClick={handleClearFilters}>
          Clear Filters
        </button>
      </div>

      {/* ── Results count ─────────────────────────────────────────────────── */}
      <p className="db-results-count">
        Showing {inventory.length} of {stats ? totalInventory : inventory.length} results
      </p>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="db-table-card">
        <div className="db-table-wrap">
          <table className="db-table">
            <thead>
              <tr>
                <th>Asset ID</th>
                <th>ID Source</th>
                <th>List Number</th>
                <th>Batch ID</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Model</th>
                <th>Specs</th>
                <th>Status</th>
                <th>Import Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="db-empty-row">
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={11} className="db-empty-row">
                    Failed to load inventory: {error}
                  </td>
                </tr>
              ) : paginatedAssets.length === 0 ? (
                <tr>
                  <td colSpan={11} className="db-empty-row">
                    No inventory records match your search/filters.
                  </td>
                </tr>
              ) : (
                paginatedAssets.map((item) => (
                  <tr key={item.assetId}>
                    <td>
                      <span className="db-asset-id-cell">
                        <span className="db-asset-id">{item.assetId}</span>
                        <span
                          className={`db-letter-badge ${
                            item.assetIdSource === "Provided"
                              ? "db-letter-badge-grey"
                              : "db-letter-badge-blue"
                          }`}
                          title={item.assetIdSource}
                        >
                          {item.assetIdSource === "Provided" ? "P" : "G"}
                        </span>
                      </span>
                    </td>
                    <td>
                      <span
                        className={`db-source-pill ${
                          item.assetIdSource === "Provided"
                            ? "db-source-provided"
                            : "db-source-generated"
                        }`}
                      >
                        {item.assetIdSource}
                      </span>
                    </td>
                    <td>{item.listNumber}</td>
                    <td className="db-batch-id">{item.batchId}</td>
                    <td>{item.category}</td>
                    <td>{item.brand}</td>
                    <td>{item.model}</td>
                    <td className="db-specs-cell">{buildSpecs(item)}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="db-muted-cell">{item.importDate}</td>
                    <td>
                      <div className="db-actions">
                        <button
                          className="db-action-btn"
                          title="View details"
                          onClick={() => handleViewDetails(item)}
                        >
                          <Eye size={14} />
                        </button>

                        <div
                          className="db-menu-wrapper"
                          ref={openMenuId === item.assetId ? openMenuRef : undefined}
                        >
                          <button
                            className="db-action-btn"
                            title="More actions"
                            onClick={() =>
                              setOpenMenuId(openMenuId === item.assetId ? null : item.assetId)
                            }
                          >
                            <MoreVertical size={14} />
                          </button>

                          {openMenuId === item.assetId && (
                            <div className="db-row-menu">
                              <button onClick={() => handleEditFromMenu(item)}>
                                <Pencil size={13} />
                                Edit Details
                              </button>
                              <button
                                onClick={() => {
                                  handlePrintSticker(item);
                                  setOpenMenuId(null);
                                }}
                              >
                                <Printer size={13} />
                                Print Sticker
                              </button>
                              {item.status === "Faulty" && (
                                <button
                                  className="db-menu-restore"
                                  onClick={() => {
                                    setRestoreTarget(item);
                                    setRestoreError(null);
                                    setOpenMenuId(null);
                                  }}
                                >
                                  <RotateCcw size={13} />
                                  Restore to Ok
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="db-footer">
          <span>
            Showing {inventory.length === 0 ? 0 : startIndex + 1}–
            {Math.min(startIndex + ITEMS_PER_PAGE, inventory.length)} of{" "}
            {inventory.length} entries
          </span>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* ── Asset Information drawer ─────────────────────────────────────── */}
      {selectedAsset && (
        <div className="db-drawer-overlay" onClick={handleCloseDrawer}>
          <div className="db-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="db-drawer-header">
              <div>
                <h2>{selectedAsset.assetId}</h2>
                <p>Asset Information</p>
              </div>
              <button className="db-drawer-close" onClick={handleCloseDrawer}>
                <X size={16} />
              </button>
            </div>

            <div className="db-drawer-body">
              {/* Asset overview */}
              <div className="db-drawer-section">
                <h4>Asset Overview</h4>
                <div className="db-drawer-grid">
                  <div>
                    <span>Asset ID</span>
                    <p className="db-drawer-mono">{selectedAsset.assetId}</p>
                  </div>
                  <div>
                    <span>ID Source</span>
                    <span
                      className={`db-source-pill ${
                        selectedAsset.assetIdSource === "Provided"
                          ? "db-source-provided"
                          : "db-source-generated"
                      }`}
                    >
                      {selectedAsset.assetIdSource}
                    </span>
                  </div>
                  <div>
                    <span>Status</span>
                    <StatusBadge status={selectedAsset.status} />
                  </div>
                  <div>
                    <span>List Number</span>
                    <p>{selectedAsset.listNumber}</p>
                  </div>
                </div>
              </div>

              {/* Technical specifications */}
              <div className="db-drawer-section">
                <h4>Technical Specifications</h4>

                {!isEditing ? (
                  <div className="db-drawer-grid">
                    <div>
                      <span>Category</span>
                      <p>{selectedAsset.category}</p>
                    </div>
                    <div>
                      <span>Brand</span>
                      <p>{selectedAsset.brand}</p>
                    </div>
                    <div>
                      <span>Model</span>
                      <p>{selectedAsset.model}</p>
                    </div>
                    <div>
                      <span>Processor</span>
                      <p>{selectedAsset.processor || "—"}</p>
                    </div>
                    <div>
                      <span>Generation</span>
                      <p>{selectedAsset.generation || "—"}</p>
                    </div>
                    <div>
                      <span>RAM</span>
                      <p>{selectedAsset.ram || "—"}</p>
                    </div>
                    <div>
                      <span>Storage</span>
                      <p>{selectedAsset.storage || "—"}</p>
                    </div>
                    <div>
                      <span>Speed</span>
                      <p>{selectedAsset.speed || "—"}</p>
                    </div>
                    <div>
                      <span>Screen Type</span>
                      <p>{selectedAsset.screenType || "—"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="db-edit-grid">
                    <label>
                      Brand
                      <input
                        value={editForm?.brand ?? ""}
                        onChange={(e) => handleEditFieldChange("brand", e.target.value)}
                      />
                    </label>
                    <label>
                      Model
                      <input
                        value={editForm?.model ?? ""}
                        onChange={(e) => handleEditFieldChange("model", e.target.value)}
                      />
                    </label>
                    <label>
                      Processor
                      <input
                        value={editForm?.processor ?? ""}
                        onChange={(e) => handleEditFieldChange("processor", e.target.value)}
                      />
                    </label>
                    <label>
                      Generation
                      <input
                        value={editForm?.generation ?? ""}
                        onChange={(e) => handleEditFieldChange("generation", e.target.value)}
                      />
                    </label>
                    <label>
                      RAM
                      <input
                        value={editForm?.ram ?? ""}
                        onChange={(e) => handleEditFieldChange("ram", e.target.value)}
                      />
                    </label>
                    <label>
                      Storage
                      <input
                        value={editForm?.storage ?? ""}
                        onChange={(e) => handleEditFieldChange("storage", e.target.value)}
                      />
                    </label>
                    <label>
                      Speed
                      <input
                        value={editForm?.speed ?? ""}
                        onChange={(e) => handleEditFieldChange("speed", e.target.value)}
                      />
                    </label>
                    <label>
                      Screen Type
                      <select
                        value={editForm?.screenType ?? ""}
                        onChange={(e) => handleEditFieldChange("screenType", e.target.value)}
                      >
                        <option value="">Select screen type</option>
                        <option value="Touch Screen">Touch Screen</option>
                        <option value="Non-Touch">Non-Touch</option>
                      </select>
                    </label>
                    <label className="db-edit-full-col">
                      Notes
                      <textarea
                        value={editForm?.notes ?? ""}
                        onChange={(e) => handleEditFieldChange("notes", e.target.value)}
                        rows={2}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Import information */}
              <div className="db-drawer-section">
                <h4>Import Information</h4>
                <div className="db-drawer-grid">
                  <div>
                    <span>Shipment ID</span>
                    <p>{selectedAsset.shipmentId}</p>
                  </div>
                  <div>
                    <span>Vendor ID</span>
                    <p>{selectedAsset.vendorId}</p>
                  </div>
                  <div>
                    <span>Batch ID</span>
                    <p className="db-drawer-mono">{selectedAsset.batchId}</p>
                  </div>
                  <div>
                    <span>Import Date</span>
                    <p>{selectedAsset.importDate}</p>
                  </div>
                </div>
              </div>

              {/* Fault information — Faulty items only */}
              {selectedAsset.status === "Faulty" && !isEditing && (
                <div className="db-drawer-section">
                  <h4>Fault Information</h4>
                  <div className="db-fault-pills">
                    {selectedAsset.faultTypes.map((fault) => (
                      <span key={fault} className="db-fault-pill">
                        {fault}
                      </span>
                    ))}
                  </div>
                  {selectedAsset.notes && <p className="db-drawer-notes">{selectedAsset.notes}</p>}
                </div>
              )}

              {/* Identification */}
              {!isEditing && (
                <div className="db-drawer-section">
                  <h4>Identification</h4>
                  <div className="db-drawer-grid">
                    <div>
                      <span>Asset ID</span>
                      <p className="db-drawer-mono">{selectedAsset.assetId}</p>
                    </div>
                    <div>
                      <span>Batch ID</span>
                      <p className="db-drawer-mono">{selectedAsset.batchId}</p>
                    </div>
                    <div>
                      <span>List Number</span>
                      <p>{selectedAsset.listNumber}</p>
                    </div>
                  </div>
                </div>
              )}

              {isEditing && saveError && <p className="field-error">{saveError}</p>}
            </div>

            <div className="db-drawer-footer">
              {!isEditing ? (
                <>
                  <Button variant="secondary" onClick={() => handlePrintSticker(selectedAsset)}>
                    <Printer size={14} />
                    Print Sticker
                  </Button>
                  <Button variant="primary" onClick={handleStartEdit}>
                    <Pencil size={14} />
                    Edit Details
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={handleCancelEdit} disabled={saving}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleSaveEdit} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
              status? The fault record will be cleared.
            </p>
            {restoreError && <p className="field-error">{restoreError}</p>}
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
