// ─── Shipments Page ─────────────────────────────────────────────────────────
//
// Lists all shipments with reconciliation data (items received, issued and
// remaining) and lets admins create, edit and delete shipment records.
//
// Backed by the real /shipments API. Search is server-side (debounced); the
// status filter is applied client-side on top of the fetched list.

import "./ShipmentPage.css";
import { useEffect, useState } from "react";

import type { Shipment, ShipmentStatus } from "./shipmentTypes";

import {
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";

import { apiFetch } from "../../services/api";

interface Vendor {
  id: number;
  vendorId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETE: "Complete",
};

const STATUS_CLASSES: Record<ShipmentStatus, string> = {
  PENDING: "status-pending",
  IN_PROGRESS: "status-progress",
  COMPLETE: "status-complete",
};

// Shipments are stored/received as UTC-midnight ISO strings — read/write the
// date-only value with UTC getters/setters so the displayed day never shifts
// with the viewer's timezone.
function formatDateDMY(iso: string) {
  const date = new Date(iso);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function toDateInputValue(iso: string) {
  const date = new Date(iso);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toIsoDate(dateInputValue: string) {
  return new Date(`${dateInputValue}T00:00:00.000Z`).toISOString();
}

function ShipmentPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | ShipmentStatus>("All");

  const [showModal, setShowModal] = useState(false);
  const [shipmentId, setShipmentId] = useState("");
  const [shipmentName, setShipmentName] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [itemsSent, setItemsSent] = useState("");
  const [shipmentDate, setShipmentDate] = useState("");
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [shipmentToDelete, setShipmentToDelete] = useState<Shipment | null>(null);

  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    apiFetch<Vendor[]>("/vendors/active")
      .then(setVendors)
      .catch(() => {
        // The vendor dropdown just stays empty on failure.
      });
  }, []);

  // Fetches on mount (searchTerm starts empty) and again, debounced, whenever
  // the search box changes — the backend matches shipmentId/shipmentName.
  useEffect(() => {
    let cancelled = false;

    const timeoutId = setTimeout(() => {
      setLoading(true);
      setError(null);

      const query = searchTerm.trim();
      const endpoint = query ? `/shipments?search=${encodeURIComponent(query)}` : "/shipments";

      apiFetch<Shipment[]>(endpoint)
        .then((data) => {
          if (!cancelled) setShipments(data);
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

  const resetForm = () => {
    setShipmentId("");
    setShipmentName("");
    setVendorId("");
    setItemsSent("");
    setShipmentDate("");
    setEditingShipment(null);
  };

  const closeModal = () => {
    setShowModal(false);
    setApiError(null);
    resetForm();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveShipment();
    }
  };

  const handleSaveShipment = async () => {
    if (!shipmentId.trim() || !shipmentName.trim() || !vendorId || !itemsSent || !shipmentDate) {
      setApiError("Please complete all fields.");
      return;
    }

    const itemsSentNum = Number(itemsSent);
    if (!Number.isInteger(itemsSentNum) || itemsSentNum <= 0) {
      setApiError("Items Sent must be a positive integer.");
      return;
    }

    setSaving(true);
    setApiError(null);

    try {
      if (editingShipment) {
        const payload = {
          shipmentName: shipmentName.trim(),
          vendorId: Number(vendorId),
          itemsSent: itemsSentNum,
          shipmentReceivedDate: toIsoDate(shipmentDate),
        };
        const updated = await apiFetch<Shipment>(`/shipments/${editingShipment.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setShipments((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      } else {
        const payload = {
          shipmentId: shipmentId.trim(),
          shipmentName: shipmentName.trim(),
          vendorId: Number(vendorId),
          itemsSent: itemsSentNum,
          shipmentReceivedDate: toIsoDate(shipmentDate),
        };
        const created = await apiFetch<Shipment>("/shipments", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setShipments((prev) => [created, ...prev]);
      }

      resetForm();
      setShowModal(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to save shipment.");
    } finally {
      setSaving(false);
    }
  };

  const filteredShipments = shipments.filter(
    (shipment) => statusFilter === "All" || shipment.status === statusFilter
  );

  const handleEditShipment = (shipment: Shipment) => {
    setEditingShipment(shipment);
    setShipmentId(shipment.shipmentId);
    setShipmentName(shipment.shipmentName);
    setVendorId(String(shipment.vendor.id));
    setItemsSent(shipment.itemsSent.toString());
    setShipmentDate(toDateInputValue(shipment.shipmentReceivedDate));
    setApiError(null);
    setShowModal(true);
  };

  const handleDeleteShipment = (shipment: Shipment) => {
    setShipmentToDelete(shipment);
    setApiError(null);
    setShowDeleteModal(true);
  };

  const confirmDeleteShipment = async () => {
    if (!shipmentToDelete) return;

    setDeleting(true);
    setApiError(null);

    try {
      await apiFetch(`/shipments/${shipmentToDelete.id}`, { method: "DELETE" });
      setShipments((prev) => prev.filter((s) => s.id !== shipmentToDelete.id));
      setShipmentToDelete(null);
      setShowDeleteModal(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to delete shipment.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="shipment-page">

      {/* Header */}
      <div className="shipment-header">
        <div>
          <h1>Shipments</h1>
          <p>Track incoming shipments and reconcile received inventory.</p>
        </div>
        <button
          className="shipment-add-btn"
          onClick={() => {
            resetForm();
            setApiError(null);
            setShowModal(true);
          }}
        >
          <Plus size={16} />
          New Shipment
        </button>
      </div>

      {apiError && !showModal && !showDeleteModal && <p className="field-error">{apiError}</p>}

      {/* Table Card */}
      <div className="shipment-table-card">

        {/* Toolbar */}
        <div className="shipment-toolbar">
          <div className="shipment-search-wrapper">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search shipment ID or shipment name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="shipment-filter">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "All" | ShipmentStatus)}
            >
              <option value="All">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETE">Complete</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <table className="shipment-table">
          <thead>
            <tr>
              <th>Shipment ID</th>
              <th>Shipment Name</th>
              <th>Vendor</th>
              <th>Items Sent</th>
              <th>Items Imported</th>
              <th>Items Issued</th>
              <th>Inventory Remaining</th>
              <th>Status</th>
              <th>Received Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="no-results">
                  Loading...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={10} className="no-results">
                  Failed to load shipments: {error}
                </td>
              </tr>
            ) : filteredShipments.length === 0 ? (
              <tr>
                <td colSpan={10} className="no-results">
                  No shipments found.
                </td>
              </tr>
            ) : (
              filteredShipments.map((shipment) => {
                const remaining = shipment.itemsReceived - shipment.issuedCount;
                return (
                  <tr key={shipment.id}>
                    <td className="shipment-id">{shipment.shipmentId}</td>
                    <td>{shipment.shipmentName}</td>
                    <td>{shipment.vendor.vendorId}</td>
                    <td>{shipment.itemsSent}</td>
                    <td>{shipment.itemsReceived}</td>

                    <td>
                      <span className={`count-badge ${shipment.issuedCount > 0 ? "count-issued" : "count-zero"}`}>
                        {shipment.issuedCount}
                      </span>
                    </td>
                    <td>
                      <span className={`count-badge ${remaining > 0 ? "count-remaining" : "count-zero"}`}>
                        {remaining}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${STATUS_CLASSES[shipment.status]}`}>
                        {STATUS_LABELS[shipment.status]}
                      </span>
                    </td>
                    <td>{formatDateDMY(shipment.shipmentReceivedDate)}</td>
                    <td>
                      <div className="shipment-actions">
                        <button className="action-btn view-btn">
                          <Eye size={15} />
                        </button>
                        <button
                          className="action-btn edit-btn"
                          onClick={() => handleEditShipment(shipment)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="action-btn delete-btn"
                          onClick={() => handleDeleteShipment(shipment)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Footer */}
        <div className="shipment-footer">
          <span>
            Showing {filteredShipments.length} of {shipments.length} shipments
          </span>
          <div className="pagination">
            <button>{"<"}</button>
            <button className="active-page">1</button>
            <button>{">"}</button>
          </div>
        </div>
      </div>

      {/* New / Edit Shipment Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="shipment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingShipment ? "Edit Shipment" : "New Shipment"}</h2>
            </div>
            <div className="modal-form">
              <div className="form-field">
                <label>Shipment ID *</label>
                <input
                  value={shipmentId}
                  onChange={(e) => setShipmentId(e.target.value)}
                  onKeyDown={handleKeyDown}
                  readOnly={!!editingShipment}
                  disabled={!!editingShipment}
                />
              </div>
              <div className="form-field">
                <label>Shipment Name *</label>
                <input
                  value={shipmentName}
                  onChange={(e) => setShipmentName(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <div className="form-field">
                <label>Vendor *</label>
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                >
                  <option value="">Select Vendor</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{`${v.vendorId} — ${v.name}`}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Items Sent *</label>
                <input
                  type="number"
                  value={itemsSent}
                  onChange={(e) => setItemsSent(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <div className="form-field">
                <label>Shipment Received Date *</label>
                <input
                  type="date"
                  value={shipmentDate}
                  onChange={(e) => setShipmentDate(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>
            {apiError && <p className="field-error">{apiError}</p>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button className="modal-save" onClick={handleSaveShipment} disabled={saving}>
                {saving ? "Saving..." : editingShipment ? "Update Shipment" : "Create Shipment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowDeleteModal(false);
            setShipmentToDelete(null);
          }}
        >
          <div
            className="delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Delete Shipment</h2>
            <p>
              Are you sure you want to delete{" "}
              <strong>{shipmentToDelete?.shipmentId}</strong>?
            </p>
            <span>This action cannot be undone.</span>
            {apiError && <p className="field-error">{apiError}</p>}
            <div className="delete-actions">
              <button
                className="modal-cancel"
                onClick={() => {
                  setShowDeleteModal(false);
                  setShipmentToDelete(null);
                }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="delete-confirm-btn"
                onClick={confirmDeleteShipment}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShipmentPage;
