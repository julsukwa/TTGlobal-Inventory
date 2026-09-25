// ─── Available Inventory Page ─────────────────────────────────────────────────
//
// System-wide view of every inventory item physically present in the company
// (status OK or FAULTY — ISSUED items are never shown here). Reached from the
// Dashboard's "Total Available" / "OK Stock" / "Faulty Stock" cards and from
// the Lists page's eye icon (?listNumber=X), both of which pre-apply a filter
// read from the URL on mount.
//
// Backed by GET /dashboard/inventory (see backend/src/dashboard) — status,
// listNumber, search, category and brand are all supported server-side.
// The Asset Information drawer fetches the fuller GET /inventory/:assetId
// record on open (it alone carries fault types/notes and the adjustment id
// Edit Fault needs) — see inventoryTypes.ts for why the list endpoint can't.

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Download,
  Package,
  CheckCircle2,
  AlertTriangle,
  Eye,
  MoreVertical,
  Printer,
  X,
} from "lucide-react";

import "./InventoryPage.css";
import {
  toAvailableInventoryItem,
} from "./inventoryTypes";
import type { AvailableInventoryItem, BackendAvailableInventoryItem } from "./inventoryTypes";
import type { BackendInventoryItem, InventoryAsset } from "../database/databaseTypes";
import { toInventoryAsset } from "../database/databaseTypes";
import { apiFetch } from "../../services/api";
import { useStickerPrint } from "../../hooks/useStickerPrint";
import { Pagination, Button, Modal, StickerPrintPreview, ListNumberBadge } from "../../components/ui";
import type { AssetStickerProps } from "../../components/ui";

const ITEMS_PER_PAGE = 20;

type StatusFilter = "all" | "OK" | "FAULTY";

interface DropdownValueApi {
  id: number;
  category: string;
  value: string;
  isActive: boolean;
  createdAt: string;
}

// GET /inventory/:assetId's response, narrowed to the one extra field (over
// BackendInventoryItem) Edit Fault needs: the adjustment history, newest
// first, so its [0] is the adjustment currently driving this item's fault.
interface InventoryDetailWithAdjustments extends BackendInventoryItem {
  adjustments: { id: number }[];
}

function toStickerProps(item: AvailableInventoryItem): AssetStickerProps {
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

const blankDetailsForm = {
  condition: "",
  brand: "",
  model: "",
  processor: "",
  generation: "",
  ram: "",
  storage: "",
  speed: "",
  screenType: "",
  notes: "",
};

type DetailsForm = typeof blankDetailsForm;

export default function InventoryPage() {
  const [searchParams] = useSearchParams();

  const [items, setItems] = useState<AvailableInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const value = searchParams.get("status");
    return value === "OK" || value === "FAULTY" ? value : "all";
  });
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [processorFilter, setProcessorFilter] = useState("all");
  const [generationFilter, setGenerationFilter] = useState("all");
  const [ramFilter, setRamFilter] = useState("all");
  const [storageFilter, setStorageFilter] = useState("all");
  const [listNumberFilter, setListNumberFilter] = useState(() => searchParams.get("listNumber") ?? "");
  const [currentPage, setCurrentPage] = useState(1);

  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [processors, setProcessors] = useState<string[]>([]);
  const [generations, setGenerations] = useState<string[]>([]);
  const [rams, setRams] = useState<string[]>([]);
  const [storages, setStorages] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [activeFaultTypes, setActiveFaultTypes] = useState<string[]>([]);

  useEffect(() => {
    const fetchValues = (category: string) =>
      apiFetch<DropdownValueApi[]>(`/dropdowns/active/${category}`)
        .then((rows) => rows.map((r) => r.value))
        .catch(() => [] as string[]);

    Promise.all([
      fetchValues("Category"),
      fetchValues("Brand"),
      fetchValues("Fault"),
      fetchValues("Processor"),
      fetchValues("Generation"),
      fetchValues("RAM"),
      fetchValues("Storage"),
      fetchValues("Condition"),
    ]).then(
      ([
        categoryValues,
        brandValues,
        faultValues,
        processorValues,
        generationValues,
        ramValues,
        storageValues,
        conditionValues,
      ]) => {
        setCategories(categoryValues);
        setBrands(brandValues);
        setActiveFaultTypes(faultValues);
        setProcessors(processorValues);
        setGenerations(generationValues);
        setRams(ramValues);
        setStorages(storageValues);
        setConditions(conditionValues);
      }
    );
  }, []);

  // ── Fetch — status/listNumber/category/brand are applied server-side;
  // search is debounced so typing doesn't fire a request per keystroke. ─────
  useEffect(() => {
    let cancelled = false;

    const timeoutId = setTimeout(() => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (brandFilter !== "all") params.set("brand", brandFilter);
      if (processorFilter !== "all") params.set("processor", processorFilter);
      if (generationFilter !== "all") params.set("generation", generationFilter);
      if (ramFilter !== "all") params.set("ram", ramFilter);
      if (storageFilter !== "all") params.set("storage", storageFilter);
      if (listNumberFilter.trim()) params.set("listNumber", listNumberFilter.trim());
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      const query = params.toString();

      apiFetch<BackendAvailableInventoryItem[]>(`/dashboard/inventory${query ? `?${query}` : ""}`)
        .then((rows) => {
          if (!cancelled) setItems(rows.map(toAvailableInventoryItem));
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
  }, [
    statusFilter,
    categoryFilter,
    brandFilter,
    processorFilter,
    generationFilter,
    ramFilter,
    storageFilter,
    listNumberFilter,
    searchTerm,
  ]);

  const okCount = useMemo(() => items.filter((i) => i.status === "OK").length, [items]);
  const faultyCount = useMemo(() => items.filter((i) => i.status === "FAULTY").length, [items]);

  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const paginatedItems = items.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setBrandFilter("all");
    setProcessorFilter("all");
    setGenerationFilter("all");
    setRamFilter("all");
    setStorageFilter("all");
    setListNumberFilter("");
    setCurrentPage(1);
  };

  const { printStickers, showPrintPreview, printSingle, closePrint } = useStickerPrint();

  // ── Three-dot row menu ───────────────────────────────────────────────────
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const openMenuRef = useRef<HTMLDivElement>(null);

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

  const handlePrintSticker = (item: AvailableInventoryItem) => {
    setOpenMenuId(null);
    printSingle(toStickerProps(item));
  };

  // ── Asset Information drawer — fetches the full GET /inventory/:assetId
  // record on open so Fault Information is available for FAULTY items. ─────
  const [selectedItem, setSelectedItem] = useState<AvailableInventoryItem | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<InventoryAsset | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadDrawerDetail = (assetId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    apiFetch<BackendInventoryItem>(`/inventory/${encodeURIComponent(assetId)}`)
      .then((raw) => setSelectedDetail(toInventoryAsset(raw)))
      .catch((err: Error) => setDetailError(err.message))
      .finally(() => setDetailLoading(false));
  };

  const handleViewDetails = (item: AvailableInventoryItem) => {
    setSelectedItem(item);
    setSelectedDetail(null);
    loadDrawerDetail(item.assetId);
  };

  const handleCloseDrawer = () => {
    setSelectedItem(null);
    setSelectedDetail(null);
    setDetailError(null);
  };

  // ── Edit Details (OK items) ──────────────────────────────────────────────
  const [detailsEditTarget, setDetailsEditTarget] = useState<AvailableInventoryItem | null>(null);
  const [detailsForm, setDetailsForm] = useState<DetailsForm>(blankDetailsForm);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  const handleOpenEditDetails = (item: AvailableInventoryItem) => {
    setOpenMenuId(null);
    setDetailsEditTarget(item);
    setDetailsForm({
      condition: item.condition,
      brand: item.brand,
      model: item.model,
      processor: item.processor,
      generation: item.generation,
      ram: item.ram,
      storage: item.storage,
      speed: item.speed,
      screenType: item.screenType,
      notes: item.notes,
    });
    setDetailsError("");
  };

  const handleCloseEditDetails = () => {
    setDetailsEditTarget(null);
    setDetailsError("");
  };

  const updateDetailsForm = (field: keyof DetailsForm, value: string) => {
    setDetailsForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveDetails = async () => {
    if (!detailsEditTarget) return;

    setDetailsSaving(true);
    setDetailsError("");

    try {
      const updated = await apiFetch<BackendInventoryItem>(
        `/inventory/${encodeURIComponent(detailsEditTarget.assetId)}`,
        { method: "PATCH", body: JSON.stringify(detailsForm) }
      );

      // Edit Details is only ever offered for OK items, so `updated.status`
      // is always "OK" here — narrowed explicitly since BackendInventoryItem's
      // status type also allows "ISSUED", which never applies on this page.
      const mapped = toAvailableInventoryItem({ ...updated, status: updated.status as "OK" | "FAULTY" });
      setItems((prev) => prev.map((i) => (i.assetId === mapped.assetId ? mapped : i)));

      if (selectedItem?.assetId === mapped.assetId) {
        setSelectedItem(mapped);
        setSelectedDetail(toInventoryAsset(updated));
      }

      handleCloseEditDetails();
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setDetailsSaving(false);
    }
  };

  // ── Edit Fault (FAULTY items) — the current fault types/notes and the
  // adjustment id aren't on the list row, so both are fetched fresh on open. ─
  const [editTarget, setEditTarget] = useState<AvailableInventoryItem | null>(null);
  const [editAdjustmentId, setEditAdjustmentId] = useState<number | null>(null);
  const [editFaultTypes, setEditFaultTypes] = useState<string[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [savingEditFault, setSavingEditFault] = useState(false);

  const handleOpenEditFault = async (item: AvailableInventoryItem) => {
    setOpenMenuId(null);
    setEditTarget(item);
    setEditFaultTypes([]);
    setEditNotes("");
    setEditAdjustmentId(null);
    setEditError("");
    setEditLoading(true);

    try {
      const detail = await apiFetch<InventoryDetailWithAdjustments>(
        `/inventory/${encodeURIComponent(item.assetId)}`
      );
      setEditFaultTypes(detail.faultTypes ?? []);
      setEditNotes(detail.notes);
      setEditAdjustmentId(detail.adjustments[0]?.id ?? null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to load fault details.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleCloseEditFault = () => {
    setEditTarget(null);
    setEditFaultTypes([]);
    setEditNotes("");
    setEditAdjustmentId(null);
    setEditError("");
  };

  const toggleEditFault = (fault: string) => {
    setEditFaultTypes((prev) =>
      prev.includes(fault) ? prev.filter((f) => f !== fault) : [...prev, fault]
    );
    setEditError("");
  };

  const handleSaveEditFault = async () => {
    if (!editTarget) return;
    if (editFaultTypes.length === 0) {
      setEditError("Select at least one fault type.");
      return;
    }
    if (editAdjustmentId === null) {
      setEditError("No adjustment record found for this item.");
      return;
    }

    setSavingEditFault(true);
    setEditError("");

    try {
      await apiFetch(`/adjustments/${editAdjustmentId}`, {
        method: "PATCH",
        body: JSON.stringify({ faultTypes: editFaultTypes, notes: editNotes }),
      });

      setItems((prev) =>
        prev.map((i) => (i.assetId === editTarget.assetId ? { ...i, notes: editNotes } : i))
      );

      if (selectedItem?.assetId === editTarget.assetId) {
        loadDrawerDetail(editTarget.assetId);
      }

      handleCloseEditFault();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSavingEditFault(false);
    }
  };

  // ── Restore to Ok ─────────────────────────────────────────────────────────
  const [restoreTarget, setRestoreTarget] = useState<AvailableInventoryItem | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    setRestoreError(null);

    try {
      await apiFetch(`/inventory/${encodeURIComponent(restoreTarget.assetId)}/restore`, {
        method: "PATCH",
      });

      if (statusFilter === "FAULTY") {
        setItems((prev) => prev.filter((i) => i.assetId !== restoreTarget.assetId));
      } else {
        setItems((prev) =>
          prev.map((i) => (i.assetId === restoreTarget.assetId ? { ...i, status: "OK" } : i))
        );
      }

      if (selectedItem?.assetId === restoreTarget.assetId) {
        handleCloseDrawer();
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
      "List Number,Asset ID,Batch ID,Category,Brand,Model,Processor,Generation,RAM,Storage,Speed,Comment,Status,Fault Types,Import Date";
    const lines = items.map((item) => {
      const cells = [
        item.listNumber,
        item.assetId,
        item.batchId,
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
        item.faultTypes?.join(", ") ?? "",
        item.importDate,
      ];
      return cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",");
    });
    const csvContent = [header, ...lines].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "available_inventory.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const rangeStart = items.length === 0 ? 0 : startIndex + 1;
  const rangeEnd = Math.min(startIndex + ITEMS_PER_PAGE, items.length);

  return (
    <div className="inv-page">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="inv-header">
        <div>
          <h1>Available Inventory</h1>
          <p>All inventory physically present in the company. Issued items are not shown.</p>
        </div>
        <div className="inv-header-actions">
          <Button variant="secondary" onClick={handleExportCsv}>
            <Download size={16} />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Summary strip ─────────────────────────────────────────────────── */}
      <div className="inv-summary-strip">
        <div className="inv-summary-item">
          <div className="inv-summary-icon inv-icon-blue">
            <Package size={16} />
          </div>
          <div>
            <span>Total Shown</span>
            <h3>{items.length}</h3>
          </div>
        </div>

        <div className="inv-summary-item">
          <div className="inv-summary-icon inv-icon-green">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <span>OK Items</span>
            <h3>{okCount}</h3>
          </div>
        </div>

        <div className="inv-summary-item">
          <div className="inv-summary-icon inv-icon-red">
            <AlertTriangle size={16} />
          </div>
          <div>
            <span>Faulty Items</span>
            <h3>{faultyCount}</h3>
          </div>
        </div>
      </div>

      {/* ── Table card ───────────────────────────────────────────────────── */}
      <div className="inv-table-card">
        <div className="inv-toolbar">
          <div className="inv-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search by Asset ID, model or list number..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="inv-filter">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Status</option>
              <option value="OK">Ok</option>
              <option value="FAULTY">Faulty</option>
            </select>
          </div>

          <div className="inv-filter">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="inv-filter">
            <select
              value={brandFilter}
              onChange={(e) => {
                setBrandFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="inv-filter">
            <select
              value={processorFilter}
              onChange={(e) => {
                setProcessorFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Processors</option>
              {processors.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="inv-filter">
            <select
              value={generationFilter}
              onChange={(e) => {
                setGenerationFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Generations</option>
              {generations.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="inv-filter">
            <select
              value={ramFilter}
              onChange={(e) => {
                setRamFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All RAM</option>
              {rams.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="inv-filter">
            <select
              value={storageFilter}
              onChange={(e) => {
                setStorageFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Storage</option>
              {storages.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {listNumberFilter && (
            <button
              className="inv-list-filter-chip"
              onClick={() => {
                setListNumberFilter("");
                setCurrentPage(1);
              }}
              title="Clear list number filter"
            >
              List: {listNumberFilter} <X size={12} />
            </button>
          )}

          <button className="inv-clear-filters-btn" onClick={handleClearFilters}>
            Clear Filters
          </button>
        </div>

        <div className="inv-table-wrap">
          <table className="inv-table">
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
                <th>Import Date</th>
                <th className="inv-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={16} className="inv-empty-row">
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={16} className="inv-empty-row">
                    Failed to load inventory: {error}
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={16} className="inv-empty-row">
                    No inventory items match your search/filters.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr key={item.assetId}>
                    <td>
                      <ListNumberBadge value={item.listNumber} />
                    </td>
                    <td className="inv-asset-id" onClick={() => handleViewDetails(item)}>
                      {item.assetId}
                    </td>
                    <td>
                      <span className="inv-batch-pill">{item.batchId}</span>
                    </td>
                    <td>
                      <span className="inv-category-badge">{item.category}</span>
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
                    <td className="inv-specs-cell">{item.processor || "—"}</td>
                    <td className="inv-specs-cell">{item.generation || "—"}</td>
                    <td className="inv-specs-cell">{item.ram || "—"}</td>
                    <td className="inv-specs-cell">{item.storage || "—"}</td>
                    <td className="inv-specs-cell">{item.speed || "—"}</td>
                    <td>
                      {item.screenType ? (
                        <span
                          className={`inv-comment-badge ${
                            item.screenType === "Touch Screen"
                              ? "inv-comment-touch"
                              : "inv-comment-nontouch"
                          }`}
                        >
                          {item.screenType}
                        </span>
                      ) : (
                        <span className="inv-comment-blank">—</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`inv-status-pill ${
                          item.status === "OK" ? "inv-status-ok" : "inv-status-faulty"
                        }`}
                      >
                        {item.status === "OK" ? "Ok" : "Faulty"}
                      </span>
                    </td>
                    <td className="inv-date-cell">{item.importDate}</td>
                    <td
                      className={`inv-actions-col${
                        openMenuId === item.assetId ? " inv-actions-col-menu-open" : ""
                      }`}
                    >
                      <div className="inv-actions-row">
                        <button
                          className="inv-action-btn"
                          title="View details"
                          onClick={() => handleViewDetails(item)}
                        >
                          <Eye size={14} />
                        </button>

                        <div
                          className="inv-menu-wrapper"
                          ref={openMenuId === item.assetId ? openMenuRef : undefined}
                        >
                          <button
                            className="inv-action-btn"
                            title="More actions"
                            onClick={() =>
                              setOpenMenuId(openMenuId === item.assetId ? null : item.assetId)
                            }
                          >
                            <MoreVertical size={14} />
                          </button>

                          {openMenuId === item.assetId && (
                            <div className="inv-row-menu">
                              {item.status === "OK" ? (
                                <>
                                  <button onClick={() => handleOpenEditDetails(item)}>
                                    Edit Details
                                  </button>
                                  <button onClick={() => handlePrintSticker(item)}>
                                    Print Sticker
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => handleOpenEditFault(item)}>
                                    Edit Fault
                                  </button>
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setRestoreTarget(item);
                                      setRestoreError(null);
                                    }}
                                  >
                                    Restore to Ok
                                  </button>
                                  <button onClick={() => handlePrintSticker(item)}>
                                    Print Sticker
                                  </button>
                                </>
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

        <div className="inv-table-footer">
          <span>
            Showing {rangeStart}–{rangeEnd} of {items.length} entries
          </span>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </div>

      {/* ── Asset Information Drawer ────────────────────────────────────────── */}
      {selectedItem && (
        <div className="inv-drawer-overlay" onClick={handleCloseDrawer}>
          <div className="inv-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="inv-drawer-header">
              <h2>Asset Details</h2>
              <button className="inv-drawer-close" onClick={handleCloseDrawer}>
                <X size={18} />
              </button>
            </div>

            <div className="inv-drawer-body">
              {detailLoading ? (
                <p className="inv-drawer-loading">Loading details...</p>
              ) : detailError ? (
                <p className="inv-drawer-loading">Failed to load details: {detailError}</p>
              ) : selectedDetail ? (
                <>
                  {/* Asset overview */}
                  <div className="inv-drawer-overview">
                    <span className="inv-drawer-asset-id">{selectedDetail.assetId}</span>
                    <h3>
                      {selectedDetail.brand} {selectedDetail.model}
                    </h3>
                    <span
                      className={`inv-status-pill ${
                        selectedDetail.status === "Ok" ? "inv-status-ok" : "inv-status-faulty"
                      }`}
                    >
                      {selectedDetail.status}
                    </span>
                  </div>

                  {/* Technical specifications */}
                  <div className="inv-drawer-section">
                    <h4>Technical Specifications</h4>
                    <div className="inv-drawer-grid">
                      <div>
                        <span>Category</span>
                        <p>{selectedDetail.category}</p>
                      </div>
                      <div>
                        <span>Condition</span>
                        <p>{selectedDetail.condition || "—"}</p>
                      </div>
                      <div>
                        <span>Brand</span>
                        <p>{selectedDetail.brand}</p>
                      </div>
                      <div>
                        <span>Model</span>
                        <p>{selectedDetail.model}</p>
                      </div>
                      <div>
                        <span>Processor</span>
                        <p>{selectedDetail.processor || "—"}</p>
                      </div>
                      <div>
                        <span>Generation</span>
                        <p>{selectedDetail.generation || "—"}</p>
                      </div>
                      <div>
                        <span>RAM</span>
                        <p>{selectedDetail.ram || "—"}</p>
                      </div>
                      <div>
                        <span>Storage</span>
                        <p>{selectedDetail.storage || "—"}</p>
                      </div>
                      <div>
                        <span>Speed</span>
                        <p>{selectedDetail.speed || "—"}</p>
                      </div>
                      <div>
                        <span>Comment</span>
                        <p>{selectedDetail.screenType || "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Import information */}
                  <div className="inv-drawer-section">
                    <h4>Import Information</h4>
                    <div className="inv-drawer-grid">
                      <div>
                        <span>Shipment ID</span>
                        <p>{selectedDetail.shipmentId}</p>
                      </div>
                      <div>
                        <span>Shipment Name</span>
                        <p>{selectedDetail.shipmentName}</p>
                      </div>
                      <div>
                        <span>Vendor</span>
                        <p>{selectedDetail.vendorId}</p>
                      </div>
                      <div>
                        <span>Batch ID</span>
                        <p>{selectedDetail.batchId}</p>
                      </div>
                      <div>
                        <span>List Number</span>
                        <p>{selectedDetail.listNumber || "-"}</p>
                      </div>
                      <div>
                        <span>Date Imported</span>
                        <p>{selectedDetail.importDate}</p>
                      </div>
                    </div>
                  </div>

                  {/* Fault information — FAULTY items only */}
                  {selectedDetail.status === "Faulty" && (
                    <div className="inv-drawer-section">
                      <h4>Fault Information</h4>
                      <div className="inv-fault-pills">
                        {selectedDetail.faultTypes.map((fault) => (
                          <span key={fault} className="inv-fault-pill">
                            {fault}
                          </span>
                        ))}
                      </div>
                      {selectedDetail.notes && (
                        <p className="inv-drawer-notes">{selectedDetail.notes}</p>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {selectedDetail && (
              <div className="inv-drawer-footer">
                <button
                  className="inv-drawer-btn-secondary"
                  onClick={() => handlePrintSticker(selectedItem)}
                >
                  <Printer size={14} />
                  Print Sticker
                </button>
                {selectedDetail.status === "Ok" ? (
                  <button
                    className="inv-drawer-btn-primary"
                    onClick={() => handleOpenEditDetails(selectedItem)}
                  >
                    Edit Details
                  </button>
                ) : (
                  <>
                    <button
                      className="inv-drawer-btn-secondary"
                      onClick={() => handleOpenEditFault(selectedItem)}
                    >
                      Edit Fault
                    </button>
                    <button
                      className="inv-drawer-btn-primary"
                      onClick={() => {
                        setRestoreTarget(selectedItem);
                        setRestoreError(null);
                      }}
                    >
                      Restore to Ok
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Details modal (OK items) ───────────────────────────────────── */}
      <Modal
        isOpen={detailsEditTarget !== null}
        onClose={handleCloseEditDetails}
        title={detailsEditTarget ? `Edit Details — ${detailsEditTarget.assetId}` : undefined}
        width={560}
      >
        {detailsEditTarget && (
          <>
            <div className="inv-form-grid">
              <div className="form-field">
                <label>Condition</label>
                <select
                  value={detailsForm.condition}
                  onChange={(e) => updateDetailsForm("condition", e.target.value)}
                >
                  <option value="">Select condition</option>
                  {detailsForm.condition && !conditions.includes(detailsForm.condition) && (
                    <option value={detailsForm.condition}>{detailsForm.condition}</option>
                  )}
                  {conditions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Brand</label>
                <input
                  type="text"
                  value={detailsForm.brand}
                  onChange={(e) => updateDetailsForm("brand", e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Model</label>
                <input
                  type="text"
                  value={detailsForm.model}
                  onChange={(e) => updateDetailsForm("model", e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Processor</label>
                <input
                  type="text"
                  value={detailsForm.processor}
                  onChange={(e) => updateDetailsForm("processor", e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Generation</label>
                <input
                  type="text"
                  value={detailsForm.generation}
                  onChange={(e) => updateDetailsForm("generation", e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>RAM</label>
                <input
                  type="text"
                  value={detailsForm.ram}
                  onChange={(e) => updateDetailsForm("ram", e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Storage</label>
                <input
                  type="text"
                  value={detailsForm.storage}
                  onChange={(e) => updateDetailsForm("storage", e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Speed</label>
                <input
                  type="text"
                  value={detailsForm.speed}
                  onChange={(e) => updateDetailsForm("speed", e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Comment</label>
                <input
                  type="text"
                  value={detailsForm.screenType}
                  onChange={(e) => updateDetailsForm("screenType", e.target.value)}
                />
              </div>
            </div>

            <div className="form-field inv-form-field-full">
              <label>Notes</label>
              <textarea
                rows={3}
                value={detailsForm.notes}
                onChange={(e) => updateDetailsForm("notes", e.target.value)}
              />
            </div>

            {detailsError && <span className="field-error">{detailsError}</span>}

            <div className="modal-actions">
              <Button variant="secondary" onClick={handleCloseEditDetails} disabled={detailsSaving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveDetails} disabled={detailsSaving}>
                {detailsSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Edit Fault modal (FAULTY items) ─────────────────────────────────── */}
      <Modal
        isOpen={editTarget !== null}
        onClose={handleCloseEditFault}
        title={editTarget ? `Edit Fault — ${editTarget.assetId}` : undefined}
        width={480}
      >
        {editTarget && (
          <>
            {editLoading ? (
              <p className="inv-drawer-loading">Loading...</p>
            ) : (
              <>
                <div className="inv-field">
                  <span className="inv-field-label">Fault Types</span>
                  <div className="inv-fault-checklist">
                    {activeFaultTypes.map((fault) => (
                      <label key={fault} className="inv-fault-checkbox">
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

                <div className="inv-field">
                  <span className="inv-field-label">Notes</span>
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
              status? Its fault record will be cleared.
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

      {showPrintPreview && <StickerPrintPreview stickers={printStickers} onClose={closePrint} />}
    </div>
  );
}
