import "./ImportInventoryPage.css";
import { useEffect, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import {
  ArrowLeft,
  Package,
  Building2,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  FilePlus2,
  Upload,
  List,
  Printer,
} from "lucide-react";

import { apiFetch } from "../../services/api";
import type { Shipment, ShipmentStatus } from "../shipments/shipmentTypes";

interface Reconciliation {
  itemsSent: number;
  itemsReceived: number;
  issuedCount: number;
  remaining: number;
  status: ShipmentStatus;
  percentageReceived: number;
}

interface StickerQueueCount {
  count: number;
}

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETE: "Complete",
};

const STATUS_BADGE_CLASSES: Record<ShipmentStatus, string> = {
  PENDING: "track-pending",
  IN_PROGRESS: "track-progress",
  COMPLETE: "track-complete",
};

function formatDateDMY(iso: string) {
  const date = new Date(iso);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

function ImportInventoryPage() {
  const navigate = useNavigate();
  const { shipmentId } = useParams();

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [pendingStickerCount, setPendingStickerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shipmentId) return;

    setLoading(true);
    setError(null);

    Promise.all([
      apiFetch<Shipment>(`/shipments/${shipmentId}`),
      apiFetch<Reconciliation>(`/shipments/${shipmentId}/reconciliation`),
      apiFetch<StickerQueueCount>(`/sticker-queue/shipment/${shipmentId}/count`),
    ])
      .then(([shipmentData, reconciliationData, stickerCountData]) => {
        setShipment(shipmentData);
        setReconciliation(reconciliationData);
        setPendingStickerCount(stickerCountData.count);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [shipmentId]);

  if (loading) {
    return (
      <div className="import-page">
        <h2>Loading shipment...</h2>
      </div>
    );
  }

  if (error || !shipment || !reconciliation) {
    return (
      <div className="import-page">
        <h2>{error ? `Failed to load shipment: ${error}` : "Shipment not found"}</h2>
      </div>
    );
  }

  return (
    <div className="import-page">

      <div className="breadcrumb">
        Stock In &gt; Import Inventory
      </div>

      <div className="import-header">
        <div>
          <h1>Import Inventory</h1>
          <p>Manage inventory imports and reconciliation for this shipment.</p>
        </div>

        <button className="back-btn" onClick={() => navigate("/stock-in")}>
          <ArrowLeft size={14} />
          Back to Shipments
        </button>
      </div>

      {/* SUMMARY */}

      <div className="summary-card">

        <div className="summary-item">
          <div className="summary-icon shipment-icon">
            <Package size={16} />
          </div>
          <div>
            <span>Shipment ID</span>
            <h3>{shipment.shipmentId}</h3>
            <p>{shipment.shipmentName}</p>
          </div>
        </div>

        <div className="summary-item">
          <div className="summary-icon vendor-icon">
            <Building2 size={16} />
          </div>
          <div>
            <span>Vendor</span>
            <h3>{shipment.vendor.vendorId}</h3>
          </div>
        </div>

        <div className="summary-item">
          <div className="summary-icon sent-icon">
            <Truck size={16} />
          </div>
          <div>
            <span>Items Sent</span>
            <h3>{reconciliation.itemsSent}</h3>
            <p>items</p>
          </div>
        </div>

        <div className="summary-item">
          <div className="summary-icon received-icon">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <span>Items Received</span>
            <h3>{reconciliation.itemsReceived}</h3>
            <p>items</p>
          </div>
        </div>

        <div className="summary-item">
          <div className="summary-icon remaining-icon">
            <AlertTriangle size={16} />
          </div>
          <div>
            <span>Remaining</span>
            <h3>{reconciliation.remaining}</h3>
            <p>items</p>
          </div>
        </div>

        <div className="summary-item">
          <div className="summary-icon date-icon">
            <Calendar size={16} />
          </div>
          <div>
            <span>Received Date</span>
            <h3>{formatDateDMY(shipment.shipmentReceivedDate)}</h3>
          </div>
        </div>

      </div>

      {/* RECONCILIATION */}

      <div className="reconciliation-card">
        <div className="reconciliation-left">
          <h2>Shipment Reconciliation</h2>
          <p>Track the progress of received inventory against the items sent.</p>
        </div>

        <div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${reconciliation.percentageReceived}%` }}
            />
          </div>
        </div>

        <div className="reconciliation-right">
          <strong>{reconciliation.percentageReceived.toFixed(2)}%</strong>
          <div className={`track-badge ${STATUS_BADGE_CLASSES[reconciliation.status]}`}>
            {STATUS_LABELS[reconciliation.status]}
          </div>
        </div>
      </div>

      {/* ACTIONS */}

      <h2 className="section-title">What would you like to do?</h2>

      <div className="action-grid">

        <div className="action-card manual-card">
          <div className="action-icon manual-icon">
            <FilePlus2 size={18} />
          </div>
          <h3>Manual Entry</h3>
          <p>Add inventory items manually to this shipment one by one.</p>
          <button onClick={() => navigate(`/stock-in/${shipment.id}/manualentry`)}>
            Add Items
          </button>
        </div>

        <div className="action-card csv-card">
          <div className="action-icon csv-icon">
            <Upload size={18} />
          </div>
          <h3>Import CSV</h3>
          <p>Import multiple inventory items in bulk using a CSV file.</p>
          <button onClick={() => navigate(`/stock-in/${shipment.id}/importcsv`)}>
            Import CSV
          </button>
        </div>

        <div className="action-card inventory-card">
          <div className="action-icon inventory-icon">
            <List size={18} />
          </div>
          <h3>View Inventory</h3>
          <p>Review, filter and manage inventory already imported.</p>
          <button onClick={() => navigate(`/stock-in/${shipment.id}/inventory`)}>
            View Inventory
          </button>
        </div>

        <div className="action-card sticker-card">
          <div className="action-icon sticker-icon">
            <Printer size={18} />
          </div>
          <h3>
            Sticker Queue
            {pendingStickerCount > 0 && (
              <span className="sticker-count-badge">{pendingStickerCount}</span>
            )}
          </h3>
          <p>View and print stickers for inventory items in this shipment.</p>
          <button onClick={() => navigate(`/stock-in/${shipment.id}/sticker-queue`)}>
            Go to Sticker Queue
          </button>
        </div>

      </div>

      <div className="import-info-banner">
        <p>All inventory imports are validated before creation.</p>
        <p>Batch IDs are generated automatically when stock-in is confirmed.</p>
      </div>

    </div>
  );
}

export default ImportInventoryPage;
