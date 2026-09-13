import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Eye } from "lucide-react";

import "./StockInPage.css";

import { stockInShipments } from "./mockStockIn";

export default function StockInPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filteredShipments = stockInShipments.filter(
    (shipment) => {
      const search = searchTerm.toLowerCase();

      const matchesSearch =
        shipment.shipmentId
          .toLowerCase()
          .includes(search) ||
        shipment.shipmentName
          .toLowerCase()
          .includes(search) ||
        shipment.vendor
          .toLowerCase()
          .includes(search);

      const matchesStatus =
        statusFilter === "All" ||
        shipment.status === statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    }
  );

  const getStatusClass = (
    status: string
  ) => {
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

  const getActionLabel = (
    itemsSent: number,
    itemsReceived: number
  ) => {
    if (itemsReceived === 0) {
      return "Import";
    }

    if (itemsReceived < itemsSent) {
      return "Continue";
    }

    return "Completed";
  };

  const getActionClass = (
    itemsSent: number,
    itemsReceived: number
  ) => {
    if (itemsReceived === 0) {
      return "import-btn";
    }

    if (itemsReceived < itemsSent) {
      return "continue-btn";
    }

    return "completed-btn";
  };

  return (
    <div className="stockin-page">

      <div className="stockin-header">

        <div>

          <h1>Stock In</h1>

          <p>
            Select a shipment to begin
            inventory importation.
          </p>

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
              onChange={(e) =>
                setSearchTerm(
                  e.target.value
                )
              }
            />

          </div>

          <div className="stockin-filter">

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
            >

              <option value="All">
                All Status
              </option>

              <option value="Pending">
                Pending
              </option>

              <option value="In Progress">
                In Progress
              </option>

              <option value="Complete">
                Complete
              </option>

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

            {filteredShipments.length >
            0 ? (

              filteredShipments.map(
                (shipment) => (

                  <tr
                    key={shipment.id}
                  >

                    <td className="shipment-id">
                      {
                        shipment.shipmentId
                      }
                    </td>

                    <td>
                      {
                        shipment.shipmentName
                      }
                    </td>

                    <td>
                      {shipment.vendor}
                    </td>

                    <td>
                      {
                        shipment.itemsSent
                      }
                    </td>

                    <td>
                      {
                        shipment.itemsReceived
                      }
                    </td>

                    <td>
                      {shipment.itemsSent -
                        shipment.itemsReceived}
                    </td>

                    <td>

                      <span
                        className={`status-badge ${getStatusClass(
                          shipment.status
                        )}`}
                      >
                        {
                          shipment.status
                        }
                      </span>

                    </td>

                    <td>
                      {
                        shipment.shipmentReceivedDate
                      }
                    </td>

                    <td>

                      <div className="stockin-actions">

                        <button className="action-btn view-btn">
                          <Eye size={15} />
                        </button>

                        <button
                            className={getActionClass(
                                shipment.itemsSent,
                                shipment.itemsReceived
                            )}
                            onClick={() =>
                                navigate(
                                `/stock-in/${shipment.shipmentId}`
                                )
                            }
                            >
                            {getActionLabel(
                                shipment.itemsSent,
                                shipment.itemsReceived
                            )}
                        </button>

                      </div>

                    </td>

                  </tr>
                )
              )

            ) : (

              <tr>

                <td
                  colSpan={9}
                  className="no-results"
                >
                  No shipments found.
                </td>

              </tr>

            )}

          </tbody>

        </table>

        <div className="stockin-footer">

          <span>
            Showing{" "}
            {
              filteredShipments.length
            }{" "}
            shipments
          </span>

          <div className="pagination">

            <button className="active-page">
              1
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}