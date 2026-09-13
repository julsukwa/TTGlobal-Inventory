import "./ImportInventoryPage.css";

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

import { stockInShipments } from "./mockStockIn";

function ImportInventoryPage() {
  const navigate = useNavigate();

  const { shipmentId } = useParams();

  const shipment = stockInShipments.find(
    (item) => item.shipmentId === shipmentId
  );

  if (!shipment) {
    return (
      <div className="import-page">
        <h2>Shipment not found</h2>
      </div>
    );
  }

  const remaining = Math.max(shipment.itemsSent - shipment.itemsReceived, 0);

  const percentage =
    shipment.itemsSent > 0
      ? Math.min((shipment.itemsReceived / shipment.itemsSent) * 100, 100)
      : 0;

  const getReconciliationStatus =
    () => {
      if (
        shipment.itemsReceived === 0
      ) {
        return "Pending";
      }

      if (
        shipment.itemsReceived <
        shipment.itemsSent
      ) {
        return "In Progress";
      }

      return "Complete";
    };

  const reconciliationStatus =
    getReconciliationStatus();

  const getBadgeClass = () => {
    if (
      reconciliationStatus ===
      "Pending"
    ) {
      return "track-pending";
    }

    if (
      reconciliationStatus ===
      "In Progress"
    ) {
      return "track-progress";
    }

    return "track-complete";
  };

  return (
    <div className="import-page">

      <div className="breadcrumb">
        Stock In &gt; Import Inventory
      </div>

      <div className="import-header">

        <div>

          <h1>
            Import Inventory
          </h1>

          <p>
            Manage inventory imports and
            reconciliation for this
            shipment.
          </p>

        </div>

        <button
          className="back-btn"
          onClick={() =>
            navigate("/stock-in")
          }
        >
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

            <span>
              Shipment ID
            </span>

            <h3>
              {
                shipment.shipmentId
              }
            </h3>

            <p>
              {
                shipment.shipmentName
              }
            </p>

          </div>

        </div>

        <div className="summary-item">

          <div className="summary-icon vendor-icon">
            <Building2 size={16} />
          </div>

          <div>

            <span>
              Vendor
            </span>

            <h3>
              {shipment.vendor}
            </h3>

          </div>

        </div>

        <div className="summary-item">

          <div className="summary-icon sent-icon">
            <Truck size={16} />
          </div>

          <div>

            <span>
              Items Sent
            </span>

            <h3>
              {
                shipment.itemsSent
              }
            </h3>

            <p>items</p>

          </div>

        </div>

        <div className="summary-item">

          <div className="summary-icon received-icon">
            <CheckCircle2 size={16} />
          </div>

          <div>

            <span>
              Items Received
            </span>

            <h3>
              {
                shipment.itemsReceived
              }
            </h3>

            <p>items</p>

          </div>

        </div>

        <div className="summary-item">

          <div className="summary-icon remaining-icon">
            <AlertTriangle size={16} />
          </div>

          <div>

            <span>
              Remaining
            </span>

            <h3>
              {remaining}
            </h3>

            <p>items</p>

          </div>

        </div>

        <div className="summary-item">

          <div className="summary-icon date-icon">
            <Calendar size={16} />
          </div>

          <div>

            <span>
              Received Date
            </span>

            <h3>
              {
                shipment.shipmentReceivedDate
              }
            </h3>

          </div>

        </div>

      </div>

      {/* RECONCILIATION */}

      <div className="reconciliation-card">

        <div className="reconciliation-left">

          <h2>
            Shipment Reconciliation
          </h2>

          <p>
            Track the progress of
            received inventory against
            the items sent.
          </p>

        </div>

        <div>

          <div className="progress-bar">

            <div
              className="progress-fill"
              style={{
                width: `${percentage}%`,
              }}
            />

          </div>

        </div>

        <div className="reconciliation-right">

          <strong>
            {
              percentage.toFixed(
                2
              )
            }
            %
          </strong>

          <div
            className={`track-badge ${getBadgeClass()}`}
          >
            {
              reconciliationStatus
            }
          </div>

        </div>

      </div>

      {/* ACTIONS */}

      <h2 className="section-title">
        What would you like to do?
      </h2>

      <div className="action-grid">

        <div className="action-card manual-card">

          <div className="action-icon manual-icon">
            <FilePlus2 size={18} />
          </div>

          <h3>
            Manual Entry
          </h3>

          <p>
            Add inventory items
            manually to this shipment
            one by one.
          </p>

          <button
                onClick={() =>
                    navigate(
                    `/stock-in/${shipment.shipmentId}/manualentry`
                    )
                }
                >
                Add Items
            </button>

        </div>

        <div className="action-card csv-card">

          <div className="action-icon csv-icon">
            <Upload size={18} />
          </div>

          <h3>
            Import CSV
          </h3>

          <p>
            Import multiple inventory
            items in bulk using a CSV
            file.
          </p>

          <button
            onClick={() =>
              navigate(`/stock-in/${shipment.shipmentId}/importcsv`)
            }
          >
            Import CSV
          </button>

        </div>

        <div className="action-card inventory-card">

          <div className="action-icon inventory-icon">
            <List size={18} />
          </div>

          <h3>
            View Inventory
          </h3>

          <p>
            Review, filter and manage
            inventory already imported.
          </p>

          <button
            onClick={() =>
              navigate(`/stock-in/${shipment.shipmentId}/inventory`)
            }
          >
            View Inventory
          </button>

        </div>

        <div className="action-card sticker-card">

          <div className="action-icon sticker-icon">
            <Printer size={18} />
          </div>

          <h3>
            Sticker Queue
          </h3>

          <p>
            View and print stickers
            for inventory items in
            this shipment.
          </p>

          <button>
            Go to Sticker Queue
          </button>

        </div>

      </div>

      <div className="import-info-banner">

        <p>
          All inventory imports are
          validated before creation.
        </p>

        <p>
          Batch IDs are generated
          automatically when stock-in
          is confirmed.
        </p>

      </div>

    </div>
  );
}

export default ImportInventoryPage;