import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Eye } from "lucide-react";

import "./StockInPage.css";
import { apiFetch } from "../../services/api";
import { Pagination } from "../../components/ui";
import type { Shipment, ShipmentStatus } from "../shipments/shipmentTypes";

const ITEMS_PER_PAGE = 20;

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETE: "Complete",
};

function formatDateDMY(iso: string) {
  const date = new Date(iso);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

export default function StockInPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Shipment[]>("/shipments")
      .then(setShipments)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredShipments = shipments.filter((shipment) => {
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      shipment.shipmentId.toLowerCase().includes(search) ||
      shipment.shipmentName.toLowerCase().includes(search) ||
      shipment.vendor.vendorId.toLowerCase().includes(search);

    const matchesStatus =
      statusFilter === "All" || STATUS_LABELS[shipment.status] === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredShipments.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const paginatedShipments = filteredShipments.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const getStatusClass = (status: string) => {
    switch (status) {
      case "Complete":
        return "status-complete";
      case "In Progress":
        return "status-progress";
      case "Pending":
        return "status-pending";
      default:
        return "";
    }
  };

  const getActionLabel = (itemsSent: number, itemsReceived: number) => {
    if (itemsReceived === 0) return "Import";
    if (itemsReceived < itemsSent) return "Continue";
    return "Completed";
  };

  const getActionClass = (itemsSent: number, itemsReceived: number) => {
    if (itemsReceived === 0) return "import-btn";
    if (itemsReceived < itemsSent) return "continue-btn";
    return "completed-btn";
  };

  return (
    <div className="stockin-page">

      <div className="stockin-header">
        <div>
          <h1>Stock In</h1>
          <p>Select a shipment to begin inventory importation.</p>
        </div>
      </div>

      <div className="stockin-table-card">

        <div className="stockin-toolbar">
          <div className="stockin-search-wrapper">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search shipment ID, shipment name or vendor..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="stockin-filter">
            <select value={statusFilter} onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}>
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Complete">Complete</option>
            </select>
          </div>
        </div>

        <table className="stockin-table">
          <thead>
            <tr>
              <th>Shipment ID</th>
              <th>Shipment Name</th>
              <th>Vendor</th>
              <th>Items Sent</th>
              <th>Items Received</th>
              <th>Remaining</th>
              <th>Status</th>
              <th>Date Received</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="no-results">
                  Loading...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={9} className="no-results">
                  Failed to load shipments: {error}
                </td>
              </tr>
            ) : filteredShipments.length > 0 ? (
              paginatedShipments.map((shipment) => (
                <tr key={shipment.id}>
                  <td className="shipment-id">{shipment.shipmentId}</td>
                  <td>{shipment.shipmentName}</td>
                  <td>{shipment.vendor.vendorId}</td>
                  <td>{shipment.itemsSent}</td>
                  <td>{shipment.itemsReceived}</td>
                  <td>{shipment.itemsSent - shipment.itemsReceived}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(STATUS_LABELS[shipment.status])}`}>
                      {STATUS_LABELS[shipment.status]}
                    </span>
                  </td>
                  <td>{formatDateDMY(shipment.shipmentReceivedDate)}</td>
                  <td>
                    <div className="stockin-actions">
                      <button
                        className="action-btn view-btn"
                        title="View inventory"
                        onClick={() => navigate(`/stock-in/${shipment.id}/inventory`)}
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        className={getActionClass(shipment.itemsSent, shipment.itemsReceived)}
                        onClick={() => navigate(`/stock-in/${shipment.id}`)}
                      >
                        {getActionLabel(shipment.itemsSent, shipment.itemsReceived)}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="no-results">
                  No shipments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="stockin-footer">
          <span>
            Showing {filteredShipments.length === 0 ? 0 : startIndex + 1}–
            {Math.min(startIndex + ITEMS_PER_PAGE, filteredShipments.length)} of{" "}
            {filteredShipments.length} shipments
            {filteredShipments.length !== shipments.length ? ` (${shipments.length} total)` : ""}
          </span>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>

      </div>

    </div>
  );
}
