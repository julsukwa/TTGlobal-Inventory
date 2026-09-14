import { Fragment, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  Building2,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  CheckCheck,
} from "lucide-react";

import "./ManualStockInPage.css";
import { stockInShipments } from "./mockStockIn";
import type { ListNumberGroup, SessionInventoryItem } from "./manualStockInTypes";

// ─── Fixed dropdown option sets ────────────────────────────────────────────────
// NOTE FOR BACKEND INTEGRATION: these option sets (category, condition, comment)
// are hardcoded here as a stand-in. Once the Dropdown Management module is
// backed by a real API, these fields should become <select> inputs populated
// from GET /dropdowns/itemType, GET /dropdowns/condition, etc. — replacing the
// hardcoded arrays below with fetched data, same component shape otherwise.

const CATEGORY_OPTIONS = ["Laptop", "Desktop", "All In One", "Workstation", "LCD"];
const CONDITION_OPTIONS = ["New", "Refurb", "Used"];
const SCREEN_TYPE_OPTIONS = ["Touch Screen", "Non-Touch"];

// LCD only needs Brand, Model, Comment, Quantity — no tech-spec fields
const isLCDCategory = (category: string) => category === "LCD";

// ─── Blank form state ──────────────────────────────────────────────────────────

const blankForm = {
  listNumber: "",
  assetIdSource: "generated" as "generated" | "provided",
  providedAssetId: "",
  category: "",
  condition: "",
  brand: "",
  model: "",
  processor: "",
  generation: "",
  ram: "",
  storage: "",
  speed: "",
  screenType: "",
  additionalInfo: "",
  quantity: "",
};

type FormState = typeof blankForm;

// ─── Validation ────────────────────────────────────────────────────────────────

function validateForm(
  form: FormState,
  remaining: number,
  editingId: number | null,
  sessionItems: SessionInventoryItem[]
): string | null {
  if (!form.listNumber.trim()) return "List Number is required.";
  if (form.assetIdSource === "provided" && !form.providedAssetId.trim())
    return "Asset ID is required when Provided is selected.";
  if (!form.category) return "Please select a category.";
  if (!form.condition) return "Please select a condition.";
  if (!form.brand.trim()) return "Brand is required.";
  if (!form.model.trim()) return "Model is required.";
  // Comment / screen type is optional — no validation check here by design.

  // Tech-spec fields are only required for non-LCD categories
  if (!isLCDCategory(form.category)) {
    if (!form.processor.trim()) return "Processor is required for this category.";
    if (!form.ram.trim()) return "RAM is required for this category.";
    if (!form.storage.trim()) return "Storage is required for this category.";
  }

  const qty = Number(form.quantity);
  if (!form.quantity || isNaN(qty) || qty <= 0)
    return "Quantity must be a number greater than zero.";

  // When editing, the original quantity for that item was already counted
  // against remaining, so we need to add it back before checking.
  const editingItem = editingId
    ? sessionItems.find((i) => i.id === editingId)
    : null;
  const previousQty = editingItem ? editingItem.quantity : 0;
  const effectiveRemaining = remaining + previousQty;

  if (qty > effectiveRemaining)
    return `Quantity (${qty}) exceeds shipment remaining capacity (${effectiveRemaining}).`;

  return null;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ManualStockInPage() {
  const navigate = useNavigate();
  const { shipmentId } = useParams();

  const shipment = stockInShipments.find(
    (item) => item.shipmentId === shipmentId
  );

  const [sessionItems, setSessionItems] = useState<SessionInventoryItem[]>([]);
  const [form, setForm] = useState<FormState>(blankForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Groups session items by List Number, preserving each group's first-seen
  // order, so the session table can render a section header per group even
  // when items for different list numbers were added in an interleaved order.
  // Declared before the "shipment not found" early return below since hooks
  // must run unconditionally on every render.
  const listNumberGroups: ListNumberGroup[] = useMemo(() => {
    const order: string[] = [];
    const grouped = new Map<string, SessionInventoryItem[]>();

    sessionItems.forEach((item) => {
      if (!grouped.has(item.listNumber)) {
        grouped.set(item.listNumber, []);
        order.push(item.listNumber);
      }
      grouped.get(item.listNumber)!.push(item);
    });

    return order.map((listNumber) => {
      const items = grouped.get(listNumber)!;
      return {
        listNumber,
        items,
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      };
    });
  }, [sessionItems]);

  if (!shipment) {
    return (
      <div className="manual-page">
        <h2>Shipment not found.</h2>
      </div>
    );
  }

  // ─── Derived values ──────────────────────────────────────────────────────────

  const sessionTotal = sessionItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  const remaining = shipment.itemsSent - shipment.itemsReceived - sessionTotal;
  const isLCD = isLCDCategory(form.category);

  // Reusing a List Number that already has items in this session is allowed
  // by design (it appends to that group) — this is just an informational
  // heads-up, not a validation error.
  const existingGroupForListNumber = form.listNumber.trim()
    ? listNumberGroups.find(
        (group) => group.listNumber.toLowerCase() === form.listNumber.trim().toLowerCase()
      )
    : undefined;

  // ─── Form helpers ────────────────────────────────────────────────────────────

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      // When switching to LCD, wipe the tech-spec fields so no stale data is saved
      if (name === "category" && isLCDCategory(value)) {
        updated.processor = "";
        updated.generation = "";
        updated.ram = "";
        updated.storage = "";
        updated.speed = "";
      }
      return updated;
    });
    setError(null);
  };

  const handleAssetIdSourceChange = (source: "generated" | "provided") => {
    setForm((prev) => ({
      ...prev,
      assetIdSource: source,
      // Wipe the provided ID when switching back to generated so no stale
      // value is silently carried into the session item.
      providedAssetId: source === "generated" ? "" : prev.providedAssetId,
    }));
    setError(null);
  };

  // The List Number field is intentionally exempt from the reset below — it
  // persists across "Add to Session" clicks so the operator can add several
  // items under the same group without retyping it every time.
  const resetForm = () => {
    setForm((prev) => ({ ...blankForm, listNumber: prev.listNumber }));
    setEditingId(null);
    setError(null);
  };

  // ─── Add / Update item ───────────────────────────────────────────────────────

  const handleAddItem = () => {
    const validationError = validateForm(
      form,
      remaining,
      editingId,
      sessionItems
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    const newItem: SessionInventoryItem = {
      id: editingId ?? Date.now(),
      listNumber: form.listNumber.trim(),
      assetIdSource: form.assetIdSource,
      providedAssetId: form.assetIdSource === "provided" ? form.providedAssetId.trim() : "",
      category: form.category,
      condition: form.condition,
      brand: form.brand.trim(),
      model: form.model.trim(),
      processor: form.processor.trim(),
      generation: form.generation.trim(),
      ram: form.ram.trim(),
      storage: form.storage.trim(),
      speed: form.speed.trim(),
      screenType: form.screenType,
      additionalInfo: form.additionalInfo.trim(),
      quantity: Number(form.quantity),
    };

    if (editingId !== null) {
      setSessionItems((prev) =>
        prev.map((item) => (item.id === editingId ? newItem : item))
      );
    } else {
      setSessionItems((prev) => [...prev, newItem]);
    }

    resetForm();
  };

  // ─── Edit ────────────────────────────────────────────────────────────────────

  const handleEdit = (item: SessionInventoryItem) => {
    setForm({
      listNumber: item.listNumber,
      assetIdSource: item.assetIdSource,
      providedAssetId: item.providedAssetId,
      category: item.category,
      condition: item.condition,
      brand: item.brand,
      model: item.model,
      processor: item.processor,
      generation: item.generation,
      ram: item.ram,
      storage: item.storage,
      speed: item.speed,
      screenType: item.screenType,
      additionalInfo: item.additionalInfo,
      quantity: item.quantity.toString(),
    });
    setEditingId(item.id);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── Delete ──────────────────────────────────────────────────────────────────

  const handleDeleteRequest = (id: number) => {
    setDeleteTargetId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    setSessionItems((prev) => prev.filter((i) => i.id !== deleteTargetId));
    setDeleteTargetId(null);
    setShowDeleteModal(false);
  };

  // ─── Confirm stock-in ────────────────────────────────────────────────────────

  const handleConfirmStockIn = () => {
    if (sessionItems.length === 0) {
      setError("Add at least one item before confirming stock-in.");
      return;
    }
    setShowConfirmModal(true);
  };

  const finaliseStockIn = () => {
    setShowConfirmModal(false);
    // Pass session items through navigation state so the processing page
    // knows what to process. The backend developer will replace the simulated
    // processing with real API calls on StockInProcessingPage.
    navigate(`/stock-in/${shipment!.shipmentId}/processing`, {
      state: { sessionItems },
    });
  };

  // ─── Confirm-modal Asset ID summary text ───────────────────────────────────
  // Describes what will happen to Asset IDs on confirm, accounting for a
  // session that mixes system-generated and operator-provided IDs.

  const generatedUnitCount = sessionItems
    .filter((item) => item.assetIdSource === "generated")
    .reduce((sum, item) => sum + item.quantity, 0);
  const providedUnitCount = sessionItems
    .filter((item) => item.assetIdSource === "provided")
    .reduce((sum, item) => sum + item.quantity, 0);

  const assetIdSummaryText = (() => {
    if (generatedUnitCount > 0 && providedUnitCount > 0) {
      return `Asset IDs will be generated automatically for ${generatedUnitCount} unit${
        generatedUnitCount !== 1 ? "s" : ""
      }, and ${providedUnitCount} unit${
        providedUnitCount !== 1 ? "s" : ""
      } will keep the Asset ID provided. A Batch ID will also be generated automatically.`;
    }
    if (providedUnitCount > 0) {
      return "Provided Asset IDs will be used exactly as entered. A Batch ID will be generated automatically.";
    }
    return "Asset IDs will be generated automatically. A Batch ID will also be generated automatically.";
  })();

  // ─── Reconciliation ──────────────────────────────────────────────────────────

  const totalReceived = shipment.itemsReceived + sessionTotal;
  const percentage = Math.min(
    (totalReceived / shipment.itemsSent) * 100,
    100
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="manual-page">

      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}

      <div className="manual-breadcrumb">
        Stock In &gt; Import Inventory &gt; Manual Entry
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}

      <div className="manual-header">
        <div>
          <h1>Manual Entry</h1>
          <p>
            Add inventory items individually for shipment{" "}
            <strong>{shipment.shipmentId}</strong>.
          </p>
        </div>
        <button
          className="manual-back-btn"
          onClick={() => navigate(`/stock-in/${shipment.shipmentId}`)}
        >
          <ArrowLeft size={14} />
          Back to Workspace
        </button>
      </div>

      {/* ── Shipment summary strip ──────────────────────────────────────────── */}

      <div className="manual-summary-card">
        <div className="manual-summary-item">
          <div className="ms-icon ms-icon-shipment">
            <Package size={16} />
          </div>
          <div>
            <span>Shipment ID</span>
            <h3>{shipment.shipmentId}</h3>
            <p>{shipment.shipmentName}</p>
          </div>
        </div>

        <div className="manual-summary-item">
          <div className="ms-icon ms-icon-vendor">
            <Building2 size={16} />
          </div>
          <div>
            <span>Vendor</span>
            <h3>{shipment.vendor}</h3>
          </div>
        </div>

        <div className="manual-summary-item">
          <div className="ms-icon ms-icon-sent">
            <Truck size={16} />
          </div>
          <div>
            <span>Items Sent</span>
            <h3>{shipment.itemsSent}</h3>
          </div>
        </div>

        <div className="manual-summary-item">
          <div className="ms-icon ms-icon-received">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <span>Already Received</span>
            <h3>{shipment.itemsReceived}</h3>
          </div>
        </div>

        <div className="manual-summary-item">
          <div className="ms-icon ms-icon-session">
            <Plus size={16} />
          </div>
          <div>
            <span>This Session</span>
            <h3>{sessionTotal}</h3>
          </div>
        </div>

        <div className="manual-summary-item">
          <div
            className={`ms-icon ${
              remaining <= 0 ? "ms-icon-full" : "ms-icon-remaining"
            }`}
          >
            <AlertTriangle size={16} />
          </div>
          <div>
            <span>Remaining</span>
            <h3 className={remaining <= 0 ? "text-green" : ""}>
              {remaining}
            </h3>
          </div>
        </div>

        <div className="manual-summary-item">
          <div className="ms-icon ms-icon-date">
            <Calendar size={16} />
          </div>
          <div>
            <span>Received Date</span>
            <h3>{shipment.shipmentReceivedDate}</h3>
          </div>
        </div>
      </div>

      {/* ── Reconciliation bar ──────────────────────────────────────────────── */}

      <div className="manual-reconciliation-card">
        <div className="reconciliation-left">
          <h2>Shipment Reconciliation</h2>
          <p>Live view including items added in this session.</p>
        </div>
        <div className="reconciliation-center">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
        <div className="reconciliation-right">
          <strong>{percentage.toFixed(1)}%</strong>
          <div
            className={`track-badge ${
              percentage >= 100
                ? "track-complete"
                : percentage > 0
                ? "track-progress"
                : "track-pending"
            }`}
          >
            {percentage >= 100
              ? "Complete"
              : percentage > 0
              ? "In Progress"
              : "Pending"}
          </div>
        </div>
      </div>

      {/* ── Entry form ─────────────────────────────────────────────────────── */}

      <div className="manual-form-card">
        <div className="manual-form-header">
          <h2>{editingId !== null ? "Edit Item" : "Add Item"}</h2>
          {editingId !== null && (
            <button className="cancel-edit-btn" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
        </div>

        {error && <div className="form-error">{error}</div>}

        {/* ── List Number declaration ────────────────────────────────────── */}
        <div className="manual-form-top">
          <div className="form-field">
            <label>
              List Number <span className="required">*</span>
            </label>
            <input
              name="listNumber"
              value={form.listNumber}
              onChange={handleChange}
              placeholder="e.g. LIST-A, BATCH-001, OFFICE-ITEMS"
            />
            {existingGroupForListNumber && (
              <p className="list-number-warning">
                &ldquo;{form.listNumber.trim()}&rdquo; already has{" "}
                {existingGroupForListNumber.items.length} item
                {existingGroupForListNumber.items.length !== 1 ? "s" : ""} (
                {existingGroupForListNumber.totalQuantity} unit
                {existingGroupForListNumber.totalQuantity !== 1 ? "s" : ""}) in this session. New
                items will be added to that group.
              </p>
            )}
          </div>

          {/* ── Asset ID toggle ─────────────────────────────────────────── */}
          <div className="form-field">
            <label>Asset ID</label>
            <div className="asset-id-toggle">
              <label className="asset-id-toggle-option">
                <input
                  type="radio"
                  name="assetIdSource"
                  checked={form.assetIdSource === "generated"}
                  onChange={() => handleAssetIdSourceChange("generated")}
                />
                System Generated (default)
              </label>
              <label className="asset-id-toggle-option">
                <input
                  type="radio"
                  name="assetIdSource"
                  checked={form.assetIdSource === "provided"}
                  onChange={() => handleAssetIdSourceChange("provided")}
                />
                Provided
              </label>
            </div>
          </div>

          {form.assetIdSource === "provided" && (
            <div className="form-field">
              <label>
                Asset ID <span className="required">*</span>
              </label>
              <input
                name="providedAssetId"
                value={form.providedAssetId}
                onChange={handleChange}
                placeholder="e.g. 006704358"
              />
              {Number(form.quantity) > 1 && (
                <p className="list-number-warning">
                  Note: when providing an Asset ID, quantity should typically be 1 since each
                  item has a unique ID.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="manual-form-grid">

          {/* Category */}
          <div className="form-field">
            <label>
              Category <span className="required">*</span>
            </label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
            >
              <option value="">Select category</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Condition */}
          <div className="form-field">
            <label>
              Condition <span className="required">*</span>
            </label>
            <select
              name="condition"
              value={form.condition}
              onChange={handleChange}
            >
              <option value="">Select condition</option>
              {CONDITION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Brand */}
          <div className="form-field">
            <label>
              Brand <span className="required">*</span>
            </label>
            <input
              name="brand"
              value={form.brand}
              onChange={handleChange}
              placeholder="e.g. HP, Dell, Lenovo"
            />
          </div>

          {/* Model */}
          <div className="form-field">
            <label>
              Model <span className="required">*</span>
            </label>
            <input
              name="model"
              value={form.model}
              onChange={handleChange}
              placeholder="e.g. EliteBook 840 G8"
            />
          </div>

          {/* Processor */}
          {!isLCD && (
          <div className="form-field">
            <label>Processor <span className="required">*</span></label>
            <input
              name="processor"
              value={form.processor}
              onChange={handleChange}
              placeholder="e.g. Intel Core i5"
            />
          </div>
          )}

          {/* Generation */}
          {!isLCD && (
          <div className="form-field">
            <label>Generation</label>
            <input
              name="generation"
              value={form.generation}
              onChange={handleChange}
              placeholder="e.g. 11th Gen"
            />
          </div>
          )}

          {/* RAM */}
          {!isLCD && (
          <div className="form-field">
            <label>RAM <span className="required">*</span></label>
            <input
              name="ram"
              value={form.ram}
              onChange={handleChange}
              placeholder="e.g. 8GB"
            />
          </div>
          )}

          {/* Storage */}
          {!isLCD && (
          <div className="form-field">
            <label>Storage <span className="required">*</span></label>
            <input
              name="storage"
              value={form.storage}
              onChange={handleChange}
              placeholder="e.g. 256GB SSD"
            />
          </div>
          )}

          {/* Speed */}
          {!isLCD && (
          <div className="form-field">
            <label>Speed</label>
            <input
              name="speed"
              value={form.speed}
              onChange={handleChange}
              placeholder="e.g. 2.4GHz"
            />
          </div>
          )}

          {/* Comment */}
          <div className="form-field">
            <label>
              Comment <span className="optional">(optional)</span>
            </label>
            <select
              name="screenType"
              value={form.screenType}
              onChange={handleChange}
            >
              <option value="">Select screen type</option>
              {SCREEN_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Additional Information */}
          <div className="form-field form-field-full">
            <label>
              Additional Information <span className="optional">(optional)</span>
            </label>
            <textarea
              name="additionalInfo"
              value={form.additionalInfo}
              onChange={handleChange}
              placeholder="e.g. w/ Charger, missing keycap on F5, backlight issue…"
              rows={2}
            />
          </div>

          {/* Quantity */}
          <div className="form-field">
            <label>
              Quantity <span className="required">*</span>
            </label>
            <input
              name="quantity"
              type="number"
              min={1}
              value={form.quantity}
              onChange={handleChange}
              placeholder="e.g. 20"
            />
          </div>

        </div>

        <div className="manual-form-footer">
          <span className="capacity-hint">
            Remaining shipment capacity:{" "}
            <strong
              className={remaining <= 0 ? "text-green" : ""}
            >
              {remaining <= 0 ? "Full" : remaining}
            </strong>
          </span>
          <div className="form-actions">
            <button className="reset-btn" onClick={resetForm}>
              Clear
            </button>
            <button
              className="add-item-btn"
              onClick={handleAddItem}
              disabled={remaining <= 0 && editingId === null}
            >
              <Plus size={15} />
              {editingId !== null ? "Update Item" : "Add to Session"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Session table ───────────────────────────────────────────────────── */}

      <div className="session-table-card">
        <div className="session-table-header">
          <div>
            <h2>Session Items</h2>
            <p>
              {sessionItems.length === 0
                ? "No items added yet. Use the form above to begin."
                : `${sessionItems.length} item group${
                    sessionItems.length !== 1 ? "s" : ""
                  } · ${sessionTotal} unit${sessionTotal !== 1 ? "s" : ""} total`}
            </p>
          </div>
        </div>

        <table className="session-table">
          <thead>
            <tr>
              <th>#</th>
              <th>List Number</th>
              <th>Asset ID</th>
              <th>Category</th>
              <th>Condition</th>
              <th>Brand</th>
              <th>Model</th>
              <th>Processor</th>
              <th>Gen</th>
              <th>RAM</th>
              <th>Storage</th>
              <th>Speed</th>
              <th>Comment</th>
              <th>Add. Info</th>
              <th>Qty</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessionItems.length === 0 ? (
              <tr>
                <td colSpan={16} className="session-empty">
                  Items added above will appear here before you confirm.
                </td>
              </tr>
            ) : (
              (() => {
                let runningIndex = 0;
                return listNumberGroups.map((group) => (
                  <Fragment key={group.listNumber}>
                    <tr className="session-group-header-row">
                      <td colSpan={16} className="session-group-header">
                        <strong>{group.listNumber}</strong> — {group.items.length} item
                        {group.items.length !== 1 ? "s" : ""}, {group.totalQuantity} unit
                        {group.totalQuantity !== 1 ? "s" : ""} total
                      </td>
                    </tr>
                    {group.items.map((item) => {
                      runningIndex += 1;
                      return (
                        <tr
                          key={item.id}
                          className={editingId === item.id ? "row-editing" : ""}
                        >
                          <td className="row-index">{runningIndex}</td>
                          <td>
                            <span className="list-number-badge">{item.listNumber}</span>
                          </td>
                          <td>
                            {item.assetIdSource === "generated" ? (
                              <span className="asset-id-generated">Generated</span>
                            ) : (
                              <span className="asset-id-provided">{item.providedAssetId}</span>
                            )}
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
                          <td>{item.processor || "—"}</td>
                          <td>{item.generation || "—"}</td>
                          <td>{item.ram || "—"}</td>
                          <td>{item.storage || "—"}</td>
                          <td>{item.speed || "—"}</td>
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
                              <span className="comment-none">—</span>
                            )}
                          </td>
                          <td className="specs-cell">{item.additionalInfo || "—"}</td>
                          <td className="qty-cell">{item.quantity}</td>
                          <td>
                            <div className="session-actions">
                              <button
                                className="session-action-btn edit-action"
                                onClick={() => handleEdit(item)}
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                className="session-action-btn delete-action"
                                onClick={() => handleDeleteRequest(item.id)}
                                title="Remove"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ));
              })()
            )}
          </tbody>
        </table>

        {sessionItems.length > 0 && (
          <div className="session-table-footer">
            <span>
              {sessionItems.length} group{sessionItems.length !== 1 ? "s" : ""},{" "}
              {sessionTotal} unit{sessionTotal !== 1 ? "s" : ""} in this session
            </span>
            <button
              className="confirm-stockin-btn"
              onClick={handleConfirmStockIn}
            >
              <CheckCheck size={15} />
              Confirm Stock-In
            </button>
          </div>
        )}
      </div>

      {/* ── Confirm stock-in modal ──────────────────────────────────────────── */}

      {showConfirmModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            className="manual-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-icon-wrap confirm-icon-wrap">
              <CheckCheck size={24} />
            </div>
            <h2>Confirm Stock-In</h2>
            <p>
              You are about to confirm{" "}
              <strong>
                {sessionTotal} unit{sessionTotal !== 1 ? "s" : ""}
              </strong>{" "}
              across{" "}
              <strong>
                {sessionItems.length} item group
                {sessionItems.length !== 1 ? "s" : ""}
              </strong>{" "}
              spanning{" "}
              <strong>
                {listNumberGroups.length} list number
                {listNumberGroups.length !== 1 ? "s" : ""}
              </strong>{" "}
              for shipment <strong>{shipment.shipmentId}</strong>.
            </p>
            <p className="modal-sub">
              {assetIdSummaryText} This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                className="modal-cancel"
                onClick={() => setShowConfirmModal(false)}
              >
                Go Back
              </button>
              <button
                className="modal-confirm"
                onClick={finaliseStockIn}
              >
                Yes, Confirm Stock-In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete item modal ───────────────────────────────────────────────── */}

      {showDeleteModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowDeleteModal(false);
            setDeleteTargetId(null);
          }}
        >
          <div
            className="manual-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-icon-wrap delete-icon-wrap">
              <Trash2 size={24} />
            </div>
            <h2>Remove Item</h2>
            <p>
              Are you sure you want to remove this item from the session? This
              only affects unsaved session data.
            </p>
            <div className="modal-actions">
              <button
                className="modal-cancel"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteTargetId(null);
                }}
              >
                Cancel
              </button>
              <button
                className="modal-delete"
                onClick={confirmDelete}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}