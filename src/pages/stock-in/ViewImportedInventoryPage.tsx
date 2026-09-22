import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Filter,
  Eye,
  Printer,
  X,
  Package,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Download,
} from "lucide-react";

import * as XLSX from "xlsx";

import "./ViewImportedInventoryPage.css";
import { apiFetch } from "../../services/api";
import { useStickerPrint } from "../../hooks/useStickerPrint";
import { StickerPrintPreview, Pagination, ListNumberBadge } from "../../components/ui";
import type { AssetStickerProps } from "../../components/ui";
import type { Shipment } from "../shipments/shipmentTypes";
import type {
  AssetIdSourceType,
  ImportedInventoryItem,
  InventoryItemStatus,
} from "./ImportedInventoryTypes";

const ITEMS_PER_PAGE = 20;

type StatusFilter = "all" | InventoryItemStatus;

function toStickerProps(item: ImportedInventoryItem): AssetStickerProps {
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

interface RawInventoryItem {
  id: number;
  assetId: string;
  assetIdSource: AssetIdSourceType;
  listNumber: string;
  batchId: number;
  category: string;
  condition: string;
  brand: string;
  model: string;
  processor: string;
  generation: string;
  ram: string;
  storage: string;
  speed: string;
  screenType: string;
  notes: string;
  status: InventoryItemStatus;
  importedAt: string;
}

interface RawStockInBatch {
  id: number;
  batchId: string;
  uploadType: string;
}

interface BatchInfo {
  batchId: string;
  uploadType: string;
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString("en-GB");
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
  return `${datePart} ${timePart}`;
}

function formatUploadType(uploadType: string) {
  if (uploadType === "manual") return "Manual Entry";
  if (uploadType === "csv-summary") return "CSV/Excel Import (Summary)";
  if (uploadType === "csv-detailed") return "CSV/Excel Import (Detailed)";
  return uploadType;
}

function mapItem(raw: RawInventoryItem, batchLookup: Map<number, BatchInfo>): ImportedInventoryItem {
  const batchInfo = batchLookup.get(raw.batchId);
  return {
    id: raw.id,
    assetId: raw.assetId,
    assetIdSource: raw.assetIdSource,
    batchId: batchInfo?.batchId ?? `Batch #${raw.batchId}`,
    uploadType: batchInfo?.uploadType ?? "",
    listNumber: raw.listNumber,
    category: raw.category,
    condition: raw.condition,
    brand: raw.brand,
    model: raw.model,
    processor: raw.processor,
    generation: raw.generation,
    ram: raw.ram,
    storage: raw.storage,
    speed: raw.speed,
    screenType: raw.screenType,
    additionalInfo: raw.notes,
    status: raw.status,
    dateImported: formatDateTime(raw.importedAt),
  };
}

export default function ViewImportedInventoryPage() {
  const navigate = useNavigate();
  const { shipmentId } = useParams();

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [batchLookup, setBatchLookup] = useState<Map<number, BatchInfo>>(new Map());
  const [batchCount, setBatchCount] = useState(0);
  const [shipmentLoading, setShipmentLoading] = useState(true);
  const [shipmentError, setShipmentError] = useState<string | null>(null);

  // Unfiltered snapshot — used only to derive stable filter dropdown options
  // and shipment-wide totals (Ok/Faulty counts), independent of active filters.
  const [allItems, setAllItems] = useState<ImportedInventoryItem[]>([]);

  const [items, setItems] = useState<ImportedInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<ImportedInventoryItem | null>(null);

  const { printStickers, showPrintPreview, printSingle, closePrint } = useStickerPrint();

  // ── Shipment + batch lookup (for resolving the numeric batch FK to its
  // human-readable batch code and upload type) ────────────────────────────
  useEffect(() => {
    if (!shipmentId) return;
    setShipmentLoading(true);
    setShipmentError(null);

    Promise.all([
      apiFetch<Shipment>(`/shipments/${shipmentId}`),
      apiFetch<RawStockInBatch[]>(`/stock-in/batches/${shipmentId}`),
    ])
      .then(([shipmentData, batches]) => {
        setShipment(shipmentData);
        setBatchCount(batches.length);
        setBatchLookup(
          new Map(batches.map((b) => [b.id, { batchId: b.batchId, uploadType: b.uploadType }]))
        );
      })
      .catch((err: Error) => setShipmentError(err.message))
      .finally(() => setShipmentLoading(false));
  }, [shipmentId]);

  // ── Unfiltered snapshot for filter options + shipment-wide totals ───────
  useEffect(() => {
    if (!shipmentId) return;
    apiFetch<RawInventoryItem[]>(`/stock-in/inventory/${shipmentId}`)
      .then((rows) => setAllItems(rows.map((row) => mapItem(row, batchLookup))))
      .catch(() => {
        // Filter dropdowns/totals just stay empty on failure — the main
        // (filtered) fetch below still reports its own error if it fails.
      });
  }, [shipmentId, batchLookup]);

  // ── Filtered fetch — search/category/status are applied server-side;
  // condition has no backend filter support, so it's applied client-side
  // below on top of whatever the server returned. Debounced so typing in
  // the search box doesn't fire a request per keystroke. ──────────────────
  useEffect(() => {
    if (!shipmentId) return;
    let cancelled = false;

    const timeoutId = setTimeout(() => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      const query = params.toString();

      apiFetch<RawInventoryItem[]>(`/stock-in/inventory/${shipmentId}${query ? `?${query}` : ""}`)
        .then((rows) => {
          if (!cancelled) setItems(rows.map((row) => mapItem(row, batchLookup)));
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
  }, [shipmentId, categoryFilter, statusFilter, searchTerm, batchLookup]);

  const conditions = useMemo(
    () => Array.from(new Set(allItems.map((item) => item.condition))).filter(Boolean).sort(),
    [allItems]
  );

  const categories = useMemo(
    () => Array.from(new Set(allItems.map((item) => item.category))).filter(Boolean).sort(),
    [allItems]
  );

  // Condition isn't supported by the backend filter, so it's applied here
  // on top of the server-filtered list.
  const filteredItems = useMemo(
    () => items.filter((item) => conditionFilter === "all" || item.condition === conditionFilter),
    [items, conditionFilter]
  );

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const okCount = allItems.filter((i) => i.status === "OK").length;
  const faultyCount = allItems.filter((i) => i.status === "FAULTY").length;

  const handleViewDetails = (item: ImportedInventoryItem) => {
    setSelectedItem(item);
  };

  const handleCloseDrawer = () => {
    setSelectedItem(null);
  };

  const exportXLSX = () => {
    const headers = [
      "Asset ID", "Batch ID", "Category", "Condition", "Brand", "Model",
      "Processor", "Generation", "RAM", "Storage", "Speed", "Comment",
      "Additional Information", "Status", "Import Method", "Date Imported",
    ];

    const dataRows = filteredItems.map((item) => [
      item.assetId,
      item.batchId,
      item.category,
      item.condition,
      item.brand,
      item.model,
      item.processor || "",
      item.generation || "",
      item.ram || "",
      item.storage || "",
      item.speed || "",
      item.screenType || "",
      item.additionalInfo || "",
      item.status,
      formatUploadType(item.uploadType),
      item.dateImported,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

    // Column widths (characters)
    ws["!cols"] = [
      { wch: 22 }, // Asset ID
      { wch: 18 }, // Batch ID
      { wch: 14 }, // Category
      { wch: 12 }, // Condition
      { wch: 14 }, // Brand
      { wch: 22 }, // Model
      { wch: 18 }, // Processor
      { wch: 12 }, // Generation
      { wch: 8  }, // RAM
      { wch: 14 }, // Storage
      { wch: 10 }, // Speed
      { wch: 14 }, // Comment
      { wch: 30 }, // Additional Information
      { wch: 12 }, // Status
      { wch: 24 }, // Import Method
      { wch: 20 }, // Date Imported
    ];

    // Freeze the header row so it stays visible while scrolling
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    // Auto-filter on every header column
    ws["!autofilter"] = { ref: `A1:P1` };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");

    XLSX.writeFile(wb, `${shipment?.shipmentId ?? shipmentId}-inventory.xlsx`);
  };

  const handlePrintSticker = (item: ImportedInventoryItem) => {
    printSingle(toStickerProps(item));
  };

  if (shipmentLoading) {
    return (
      <div className="vii-page">
        <h2>Loading shipment...</h2>
      </div>
    );
  }

  if (shipmentError || !shipment) {
    return (
      <div className="vii-page">
        <h2>{shipmentError ? `Failed to load shipment: ${shipmentError}` : "Shipment not found."}</h2>
      </div>
    );
  }

  return (
    <div className="vii-page">
      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      <div className="vii-breadcrumb">
        Stock In &gt; {shipment.shipmentId} &gt; Import Inventory &gt; View Inventory
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="vii-header">
        <div>
          <h1>Imported Inventory</h1>
          <p>
            All inventory items imported into <strong>{shipment.shipmentId}</strong> across every
            batch and import session.
          </p>
        </div>
        <div className="vii-header-actions">
          <button className="vii-export-btn" onClick={exportXLSX}>
            <Download size={14} />
            Export CSV
          </button>
          <button
            className="vii-back-btn"
            onClick={() => navigate(`/stock-in/${shipment.id}`)}
          >
            <ArrowLeft size={14} />
            Back to Workspace
          </button>
        </div>
      </div>

      {/* ── Summary strip ───────────────────────────────────────────────────── */}
      <div className="vii-summary-card">
        <div className="vii-summary-item">
          <div className="vii-icon vii-icon-blue"><Package size={16} /></div>
          <div>
            <span>Total Inventory</span>
            <h3>{allItems.length}</h3>
            <p>Items in this shipment</p>
          </div>
        </div>

        <div className="vii-summary-item">
          <div className="vii-icon vii-icon-purple"><Layers size={16} /></div>
          <div>
            <span>Batches</span>
            <h3>{batchCount}</h3>
            <p>Import sessions</p>
          </div>
        </div>

        <div className="vii-summary-item">
          <div className="vii-icon vii-icon-green"><CheckCircle2 size={16} /></div>
          <div>
            <span>Ok</span>
            <h3 className="text-green">{okCount}</h3>
            <p>Ready for use or sale</p>
          </div>
        </div>

        <div className="vii-summary-item">
          <div className="vii-icon vii-icon-red"><AlertTriangle size={16} /></div>
          <div>
            <span>Faulty</span>
            <h3 className={faultyCount > 0 ? "text-red" : ""}>{faultyCount}</h3>
            <p>Marked faulty</p>
          </div>
        </div>
      </div>

      {/* ── Table card ──────────────────────────────────────────────────────── */}
      <div className="vii-table-card">
        <div className="vii-toolbar">
          <div className="vii-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search by Asset ID, Model, or Brand..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="vii-filter">
            <Filter size={14} />
            <select value={conditionFilter} onChange={(e) => {
                setConditionFilter(e.target.value);
                setCurrentPage(1);
              }}>
              <option value="all">All Conditions</option>
              {conditions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="vii-filter">
            <select value={categoryFilter} onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}>
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="vii-filter">
            <select value={statusFilter} onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setCurrentPage(1);
              }}>
              <option value="all">All Status</option>
              <option value="OK">Ok</option>
              <option value="FAULTY">Faulty</option>
              <option value="ISSUED">Issued</option>
            </select>
          </div>
        </div>

        <div className="vii-table-wrap">
          <table className="vii-table">
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
                <th>Additional Info</th>
                <th>Status</th>
                <th>Date Imported</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={17} className="vii-empty-row">
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={17} className="vii-empty-row">
                    Failed to load inventory: {error}
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={17} className="vii-empty-row">
                    {allItems.length === 0
                      ? "No inventory has been imported into this shipment yet."
                      : "No items match your search/filter."}
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <ListNumberBadge value={item.listNumber} />
                    </td>
                    <td className="vii-asset-id">{item.assetId}</td>
                    <td>
                      <span className="batch-pill">{item.batchId}</span>
                    </td>
                    <td>
                      <span className="category-badge">{item.category}</span>
                    </td>
                    <td>
                      <span className={`condition-badge condition-${item.condition.toLowerCase()}`}>
                        {item.condition}
                      </span>
                    </td>
                    <td>{item.brand}</td>
                    <td>{item.model}</td>
                    <td className="specs-cell">{item.processor || "—"}</td>
                    <td className="specs-cell">{item.generation || "—"}</td>
                    <td className="specs-cell">{item.ram || "—"}</td>
                    <td className="specs-cell">{item.storage || "—"}</td>
                    <td className="specs-cell">{item.speed || "—"}</td>
                    <td>
                      {item.screenType ? (
                        <span
                          className={`comment-badge ${
                            item.screenType === "Touch Screen" ? "comment-touch" : "comment-nontouch"
                          }`}
                        >
                          {item.screenType}
                        </span>
                      ) : (
                        <span className="comment-blank">—</span>
                      )}
                    </td>
                    <td className="specs-cell">{item.additionalInfo || "—"}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          item.status === "OK"
                            ? "status-ok"
                            : item.status === "FAULTY"
                            ? "status-faulty"
                            : "status-issued"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="date-cell">{item.dateImported}</td>
                    <td>
                      <div className="vii-row-actions">
                        <button
                          className="vii-action-btn"
                          title="View details"
                          onClick={() => handleViewDetails(item)}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className="vii-action-btn"
                          title="Print sticker"
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

        <div className="vii-table-footer">
          <span>
            Showing {filteredItems.length === 0 ? 0 : startIndex + 1}–
            {Math.min(startIndex + ITEMS_PER_PAGE, filteredItems.length)} of{" "}
            {filteredItems.length} items
            {filteredItems.length !== allItems.length ? ` (${allItems.length} in shipment)` : ""}
          </span>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* ── Asset Information Drawer ────────────────────────────────────────── */}
      {selectedItem && (
        <div className="vii-drawer-overlay" onClick={handleCloseDrawer}>
          <div className="vii-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="vii-drawer-header">
              <h2>Asset Details</h2>
              <button className="vii-drawer-close" onClick={handleCloseDrawer}>
                <X size={18} />
              </button>
            </div>

            <div className="vii-drawer-body">
              {/* Asset overview */}
              <div className="vii-drawer-overview">
                <span className="vii-drawer-asset-id">{selectedItem.assetId}</span>
                <h3>
                  {selectedItem.brand} {selectedItem.model}
                </h3>
                <span
                  className={`status-pill ${
                    selectedItem.status === "OK"
                      ? "status-ok"
                      : selectedItem.status === "FAULTY"
                      ? "status-faulty"
                      : "status-issued"
                  }`}
                >
                  {selectedItem.status}
                </span>
              </div>

              {/* Technical specifications */}
              <div className="vii-drawer-section">
                <h4>Technical Specifications</h4>

                <div className="vii-drawer-grid">
                  <div>
                    <span>Category</span>
                    <p>{selectedItem.category}</p>
                  </div>
                  <div>
                    <span>Condition</span>
                    <p>{selectedItem.condition}</p>
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
                  <div className="vii-drawer-full-col">
                    <span>Additional Information</span>
                    <p>{selectedItem.additionalInfo || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Import information */}
              <div className="vii-drawer-section">
                <h4>Import Information</h4>
                <div className="vii-drawer-grid">
                  <div>
                    <span>Shipment ID</span>
                    <p>{shipment.shipmentId}</p>
                  </div>
                  <div>
                    <span>Shipment Name</span>
                    <p>{shipment.shipmentName}</p>
                  </div>
                  <div>
                    <span>Vendor</span>
                    <p>{shipment.vendor.vendorId}</p>
                  </div>
                  <div>
                    <span>Batch ID</span>
                    <p>{selectedItem.batchId}</p>
                  </div>
                  <div>
                    <span>Import Method</span>
                    <p>{formatUploadType(selectedItem.uploadType)}</p>
                  </div>
                  <div>
                    <span>Date Imported</span>
                    <p>{selectedItem.dateImported}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="vii-drawer-footer">
              <button className="vii-drawer-btn-secondary" onClick={() => handlePrintSticker(selectedItem)}>
                <Printer size={14} />
                Print Sticker
              </button>
              {/* TODO: wire up once PATCH /inventory/:assetId exists on the
                  backend — editing is disabled for now rather than faking a
                  local-only save that wouldn't actually persist. */}
              <button className="vii-drawer-btn-primary" disabled title="Editing is not available yet">
                Edit Details (Coming Soon)
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrintPreview && (
        <StickerPrintPreview stickers={printStickers} onClose={closePrint} />
      )}
    </div>
  );
}
