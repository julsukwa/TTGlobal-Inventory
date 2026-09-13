import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Filter,
  Eye,
  Pencil,
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
import { stockInShipments } from "./mockStockIn";
import { importedInventory } from "./mockImportedInventory";
import type { ImportedInventoryItem, InventoryItemStatus } from "./ImportedInventoryTypes";

type StatusFilter = "all" | InventoryItemStatus;

// NOTE FOR BACKEND INTEGRATION: this page currently reads from a hardcoded
// mock array (mockImportedInventory.ts) filtered client-side by shipmentId.
// Once a backend exists this becomes GET /shipments/:shipmentId/inventory —
// the filtering, search, and batch-grouping logic below should move
// server-side too (same reasoning as CSV validation: a shared, authoritative
// dataset shouldn't be computed from a snapshot the browser already has).

export default function ViewImportedInventoryPage() {
  const navigate = useNavigate();
  const { shipmentId } = useParams();

  const shipment = stockInShipments.find((s) => s.shipmentId === shipmentId);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<ImportedInventoryItem | null>(null);
  const [localInventory, setLocalInventory] = useState<ImportedInventoryItem[]>(importedInventory);

  // Editable copy used inside the drawer's Edit Details mode. Kept separate
  // from selectedItem so cancelling an edit doesn't leave stray partial state.
  const [editForm, setEditForm] = useState<ImportedInventoryItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const shipmentItems = useMemo(
    () => localInventory.filter((item) => item.assetId.startsWith(`${shipmentId}-`)),
    [localInventory, shipmentId]
  );

  const conditions = useMemo(
    () => Array.from(new Set(shipmentItems.map((item) => item.condition))).sort(),
    [shipmentItems]
  );

  const categories = useMemo(
    () => Array.from(new Set(shipmentItems.map((item) => item.category))).sort(),
    [shipmentItems]
  );

  const filteredItems = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return shipmentItems.filter((item) => {
      const matchesSearch =
        !search ||
        item.assetId.toLowerCase().includes(search) ||
        item.model.toLowerCase().includes(search) ||
        item.brand.toLowerCase().includes(search) ||
        item.batchId.toLowerCase().includes(search);

      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesCondition = conditionFilter === "all" || item.condition === conditionFilter;
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCondition && matchesCategory;
    });
  }, [shipmentItems, searchTerm, statusFilter, conditionFilter, categoryFilter]);

  const okCount = shipmentItems.filter((i) => i.status === "Ok").length;
  const faultyCount = shipmentItems.filter((i) => i.status === "Faulty").length;

  const handleViewDetails = (item: ImportedInventoryItem) => {
    setSelectedItem(item);
    setIsEditing(false);
    setEditForm(null);
  };

  const handleCloseDrawer = () => {
    setSelectedItem(null);
    setIsEditing(false);
    setEditForm(null);
  };

  const handleStartEdit = () => {
    if (!selectedItem) return;
    setEditForm({ ...selectedItem });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm(null);
  };

  const handleEditFieldChange = (field: keyof ImportedInventoryItem, value: string) => {
    if (!editForm) return;
    setEditForm({ ...editForm, [field]: value });
  };

  const handleSaveEdit = () => {
    if (!editForm) return;
    setLocalInventory((prev) =>
      prev.map((i) => (i.assetId === editForm.assetId ? editForm : i))
    );
    setSelectedItem(editForm);
    setIsEditing(false);
  };

  const exportXLSX = () => {
    const headers = [
      "Asset ID", "Batch ID", "Category", "Condition", "Brand", "Model",
      "Processor", "Generation", "RAM", "Storage", "Speed", "Comment",
      "Additional Information", "Status", "Source", "Date Imported",
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
      item.source === "csv" ? "CSV/Excel Import" : "Manual Entry",
      item.dateImported,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

    // Column widths (characters)
    ws["!cols"] = [
      { wch: 22 }, // Asset ID
      { wch: 16 }, // Batch ID
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
      { wch: 18 }, // Source
      { wch: 20 }, // Date Imported
    ];

    // Freeze the header row so it stays visible while scrolling
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    // Auto-filter on every header column
    ws["!autofilter"] = { ref: `A1:P1` };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");

    XLSX.writeFile(wb, `${shipmentId}-inventory.xlsx`);
  };

  const handlePrintSticker = (item: ImportedInventoryItem) => {
    // Sticker printing isn't built yet (separate feature) — this is a
    // placeholder acknowledgement so the action isn't a dead click.
    alert(`Sticker for ${item.assetId} queued for printing.`);
  };

  if (!shipment) {
    return (
      <div className="vii-page">
        <h2>Shipment not found.</h2>
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
            onClick={() => navigate(`/stock-in/${shipment.shipmentId}`)}
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
            <h3>{shipmentItems.length}</h3>
            <p>Items in this shipment</p>
          </div>
        </div>

        <div className="vii-summary-item">
          <div className="vii-icon vii-icon-purple"><Layers size={16} /></div>
          <div>
            <span>Batches</span>
            <h3>{new Set(shipmentItems.map((i) => i.batchId)).size}</h3>
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
              placeholder="Search by Asset ID, Model, Brand, or Batch ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="vii-filter">
            <Filter size={14} />
            <select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)}>
              <option value="all">All Conditions</option>
              {conditions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="vii-filter">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="vii-filter">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="all">All Status</option>
              <option value="Ok">Ok</option>
              <option value="Faulty">Faulty</option>
            </select>
          </div>
        </div>

        <div className="vii-table-wrap">
          <table className="vii-table">
            <thead>
              <tr>
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
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={16} className="vii-empty-row">
                    {shipmentItems.length === 0
                      ? "No inventory has been imported into this shipment yet."
                      : "No items match your search/filter."}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.assetId}>
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
                          item.status === "Ok" ? "status-ok" : "status-faulty"
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
            Showing {filteredItems.length} of {shipmentItems.length} items
          </span>
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
                    selectedItem.status === "Ok" ? "status-ok" : "status-faulty"
                  }`}
                >
                  {selectedItem.status}
                </span>
              </div>

              {/* Technical specifications */}
              <div className="vii-drawer-section">
                <h4>Technical Specifications</h4>

                {!isEditing ? (
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
                ) : (
                  <div className="vii-edit-grid">
                    {/* Asset ID / Batch ID / Shipment / Vendor are intentionally
                        NOT editable here — protected fields per documentation,
                        since they preserve traceability back to the import
                        session and shipment. */}
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
                      Comment
                      <select
                        value={editForm?.screenType ?? ""}
                        onChange={(e) => handleEditFieldChange("screenType", e.target.value)}
                      >
                        <option value="">Select screen type</option>
                        <option value="Touch Screen">Touch Screen</option>
                        <option value="Non-Touch">Non-Touch</option>
                      </select>
                    </label>
                    <label className="vii-edit-full-col">
                      Additional Information
                      <textarea
                        value={editForm?.additionalInfo ?? ""}
                        onChange={(e) => handleEditFieldChange("additionalInfo", e.target.value)}
                        rows={2}
                      />
                    </label>
                  </div>
                )}
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
                    <p>{shipment.vendor}</p>
                  </div>
                  <div>
                    <span>Batch ID</span>
                    <p>{selectedItem.batchId}</p>
                  </div>
                  <div>
                    <span>Import Method</span>
                    <p>{selectedItem.source === "csv" ? "CSV/Excel Import" : "Manual Entry"}</p>
                  </div>
                  <div>
                    <span>Date Imported</span>
                    <p>{selectedItem.dateImported}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="vii-drawer-footer">
              {!isEditing ? (
                <>
                  <button className="vii-drawer-btn-secondary" onClick={() => handlePrintSticker(selectedItem)}>
                    <Printer size={14} />
                    Print Sticker
                  </button>
                  <button className="vii-drawer-btn-primary" onClick={handleStartEdit}>
                    <Pencil size={14} />
                    Edit Details
                  </button>
                </>
              ) : (
                <>
                  <button className="vii-drawer-btn-secondary" onClick={handleCancelEdit}>
                    Cancel
                  </button>
                  <button className="vii-drawer-btn-primary" onClick={handleSaveEdit}>
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}