import "./ShipmentPage.css";
import { useEffect, useState } from "react";

import mockShipments from "./mockShipments";
import type { Shipment } from "./shipmentTypes";

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

function ShipmentPage() {

  const [shipments, setShipments] = useState<Shipment[]>(mockShipments);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [shipmentId, setShipmentId] = useState("");
  const [shipmentName, setShipmentName] = useState("");
  const [vendor, setVendor] = useState("");
  const [itemsSent, setItemsSent] = useState("");
  const [shipmentDate, setShipmentDate] = useState("");
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [shipmentToDelete, setShipmentToDelete] = useState<Shipment | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");

  const closeModal = () => { setShowModal(false); setEditingShipment(null); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveShipment();
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "Complete":   return "status-complete";
      case "In Progress": return "status-progress";
      default:           return "status-pending";
    }
  };

  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    apiFetch<Vendor[]>("/vendors/active")
      .then(setVendors)
      .catch(() => {
        // The vendor dropdown just stays empty on failure — the rest of the
        // page (shipment table) is unaffected since it's still mock-backed.
      });
  }, []);

  const handleSaveShipment = () => {
    if (
      !shipmentId.trim() ||
      !shipmentName.trim() ||
      !vendor ||
      !itemsSent ||
      !shipmentDate
    ) {
      alert("Please complete all fields.");
      return;
    }

    if (editingShipment) {
      const updatedShipments = shipments.map((s) =>
        s.id === editingShipment.id
          ? {
              ...s,
              shipmentId,
              shipmentName,
              vendor,
              itemsSent: Number(itemsSent),
              shipmentReceivedDate: new Date(shipmentDate).toLocaleDateString("en-GB"),
            }
          : s
      );
      setShipments(updatedShipments);
    } else {
      const newShipment: Shipment = {
        id: shipments.length + 1,
        shipmentId,
        shipmentName,
        vendor,
        itemsSent: Number(itemsSent),
        itemsReceived: 0,
        okCount: 0,
        faultyCount: 0,
        issuedCount: 0,
        shipmentReceivedDate: new Date(shipmentDate).toLocaleDateString("en-GB"),
        status: "Pending",
      };
      setShipments([newShipment, ...shipments]);
    }

    setShipmentId("");
    setShipmentName("");
    setVendor("");
    setItemsSent("");
    setShipmentDate("");
    setEditingShipment(null);
    setShowModal(false);
  };

  const filteredShipments = shipments.filter((shipment) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      shipment.shipmentId.toLowerCase().includes(search) ||
      shipment.shipmentName.toLowerCase().includes(search) ||
      shipment.vendor.toLowerCase().includes(search);
    const matchesStatus =
      statusFilter === "All" || shipment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleEditShipment = (shipment: Shipment) => {
    setEditingShipment(shipment);
    setShipmentId(shipment.shipmentId);
    setShipmentName(shipment.shipmentName);
    setVendor(shipment.vendor);
    setItemsSent(shipment.itemsSent.toString());
    const [day, month, year] = shipment.shipmentReceivedDate.split("/");
    setShipmentDate(`${year}-${month}-${day}`);
    setShowModal(true);
  };

  const handleDeleteShipment = (shipment: Shipment) => {
    if (shipment.itemsReceived > 0) {
      setShipmentToDelete(shipment);
      setDeleteBlocked(true);
      setShowDeleteModal(true);
      return;
    }
    setShipmentToDelete(shipment);
    setDeleteBlocked(false);
    setShowDeleteModal(true);
  };

  const confirmDeleteShipment = () => {
    if (!shipmentToDelete) return;
    setShipments(shipments.filter((s) => s.id !== shipmentToDelete.id));
    setShipmentToDelete(null);
    setShowDeleteModal(false);
  };

  return (
    <div className="shipment-page">

      {/* Header */}
      <div className="shipment-header">
        <div>
          <h1>Shipments</h1>
          <p>Track incoming shipments and reconcile received inventory.</p>
        </div>
        <button className="shipment-add-btn" onClick={() => setShowModal(true)}>
          <Plus size={16} />
          New Shipment
        </button>
      </div>

      {/* Table Card */}
      <div className="shipment-table-card">

        {/* Toolbar */}
        <div className="shipment-toolbar">
          <div className="shipment-search-wrapper">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search shipment ID, shipment name or vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="shipment-filter">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Complete">Complete</option>
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
            {filteredShipments.length === 0 ? (
              <tr>
                <td colSpan={10} className="no-results">
                  No shipments found.
                </td>
              </tr>
            ) : (
              filteredShipments.map((shipment) => (
                <tr key={shipment.id}>
                  <td className="shipment-id">{shipment.shipmentId}</td>
                  <td>{shipment.shipmentName}</td>
                  <td>{shipment.vendor}</td>
                  <td>{shipment.itemsSent}</td>
                  <td>{shipment.itemsReceived}</td>
                  
                  <td>
                    <span className={`count-badge ${shipment.issuedCount > 0 ? "count-issued" : "count-zero"}`}>
                      {shipment.issuedCount}
                    </span>
                  </td>
                  <td>
                    <span className={`count-badge ${shipment.itemsReceived - shipment.issuedCount > 0 ? "count-remaining" : "count-zero"}`}>
                      {shipment.itemsReceived - shipment.issuedCount}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusClass(shipment.status)}`}>
                      {shipment.status}
                    </span>
                  </td>
                  <td>{shipment.shipmentReceivedDate}</td>
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
              ))
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
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                >
                  <option value="">Select Vendor</option>
                  {vendors.map((v) => (
                    <option key={v.vendorId} value={v.vendorId}>{`${v.vendorId} — ${v.name}`}</option>
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
            <div className="modal-actions">
              <button className="modal-cancel" onClick={closeModal}>
                Cancel
              </button>
              <button className="modal-save" onClick={handleSaveShipment}>
                {editingShipment ? "Update Shipment" : "Create Shipment"}
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
            {deleteBlocked ? (
              <>
                <h2>Shipment Cannot Be Deleted</h2>
                <p>This shipment already contains received inventory.</p>
                <span>Only shipments with zero received items can be deleted.</span>
                <div className="delete-actions">
                  <button
                    className="modal-cancel"
                    onClick={() => {
                      setShowDeleteModal(false);
                      setShipmentToDelete(null);
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>Delete Shipment</h2>
                <p>
                  Are you sure you want to delete{" "}
                  <strong>{shipmentToDelete?.shipmentId}</strong>?
                </p>
                <span>This action cannot be undone.</span>
                <div className="delete-actions">
                  <button
                    className="modal-cancel"
                    onClick={() => {
                      setShowDeleteModal(false);
                      setShipmentToDelete(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="delete-confirm-btn"
                    onClick={confirmDeleteShipment}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ShipmentPage;