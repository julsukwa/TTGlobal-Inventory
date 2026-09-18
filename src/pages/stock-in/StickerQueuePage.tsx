import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Filter, Printer, Clock, CheckCircle2, Layers } from "lucide-react";

import "./StickerQueuePage.css";
import { apiFetch } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { canEdit } from "../../utils/permissions";
import type { Shipment } from "../shipments/shipmentTypes";
import type { StickerQueueItem, StickerStatus } from "./stickerQueueTypes";

type StatusFilter = "all" | StickerStatus;

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  const datePart = date.toLocaleDateString("en-GB");
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
  return `${datePart} ${timePart}`;
}

export default function StickerQueuePage() {
  const navigate = useNavigate();
  const { shipmentId } = useParams();
  const { user } = useAuth();
  const isReadOnly = !user || !canEdit(user.role, "stickerQueue");

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [shipmentLoading, setShipmentLoading] = useState(true);
  const [shipmentError, setShipmentError] = useState<string | null>(null);

  const [entries, setEntries] = useState<StickerQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    if (!shipmentId) return;
    setShipmentLoading(true);
    setShipmentError(null);

    apiFetch<Shipment>(`/shipments/${shipmentId}`)
      .then(setShipment)
      .catch((err: Error) => setShipmentError(err.message))
      .finally(() => setShipmentLoading(false));
  }, [shipmentId]);

  const fetchEntries = () => {
    if (!shipmentId) return;
    setLoading(true);
    setError(null);

    apiFetch<StickerQueueItem[]>(`/sticker-queue/shipment/${shipmentId}`)
      .then((rows) => setEntries(rows))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(fetchEntries, [shipmentId]);

  const pendingCount = useMemo(() => entries.filter((e) => e.status === "PENDING").length, [entries]);
  const printedCount = useMemo(() => entries.filter((e) => e.status === "PRINTED").length, [entries]);

  const filteredEntries = useMemo(
    () => entries.filter((e) => statusFilter === "all" || e.status === statusFilter),
    [entries, statusFilter]
  );

  const selectableIds = useMemo(() => filteredEntries.map((e) => e.id), [filteredEntries]);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(selectableIds));
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMarkSelectedPrinted = async () => {
    if (selectedIds.size === 0) return;
    setActionPending(true);
    try {
      await apiFetch(`/sticker-queue/mark-printed`, {
        method: "PATCH",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      setSelectedIds(new Set());
      fetchEntries();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionPending(false);
    }
  };

  const handleMarkAllPrinted = async () => {
    if (!shipmentId || pendingCount === 0) return;
    setActionPending(true);
    try {
      await apiFetch(`/sticker-queue/shipment/${shipmentId}/mark-all-printed`, {
        method: "PATCH",
      });
      setSelectedIds(new Set());
      fetchEntries();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionPending(false);
    }
  };

  if (shipmentLoading) {
    return (
      <div className="sq-page">
        <h2>Loading shipment...</h2>
      </div>
    );
  }

  if (shipmentError || !shipment) {
    return (
      <div className="sq-page">
        <h2>{shipmentError ? `Failed to load shipment: ${shipmentError}` : "Shipment not found."}</h2>
      </div>
    );
  }

  return (
    <div className="sq-page">
      <div className="sq-breadcrumb">
        Stock In &gt; {shipment.shipmentId} &gt; Import Inventory &gt; Sticker Queue
      </div>

      <div className="sq-header">
        <div>
          <h1>Sticker Queue</h1>
          <p>
            Asset ID stickers awaiting print for <strong>{shipment.shipmentId}</strong>.
          </p>
        </div>
        <button className="sq-back-btn" onClick={() => navigate(`/stock-in/${shipment.id}`)}>
          <ArrowLeft size={14} />
          Back to Workspace
        </button>
      </div>

      <div className="sq-summary-card">
        <div className="sq-summary-item">
          <div className="sq-icon sq-icon-amber"><Clock size={16} /></div>
          <div>
            <span>Pending</span>
            <h3 className="text-amber">{pendingCount}</h3>
            <p>Awaiting print</p>
          </div>
        </div>

        <div className="sq-summary-item">
          <div className="sq-icon sq-icon-green"><CheckCircle2 size={16} /></div>
          <div>
            <span>Printed</span>
            <h3 className="text-green">{printedCount}</h3>
            <p>Stickers printed</p>
          </div>
        </div>

        <div className="sq-summary-item">
          <div className="sq-icon sq-icon-blue"><Layers size={16} /></div>
          <div>
            <span>Total</span>
            <h3>{entries.length}</h3>
            <p>Items in sticker queue</p>
          </div>
        </div>
      </div>

      <div className="sq-table-card">
        <div className="sq-toolbar">
          <div className="sq-filter">
            <Filter size={14} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="all">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PRINTED">Printed</option>
            </select>
          </div>

          {!isReadOnly && (
            <div className="sq-toolbar-actions">
              <button
                className="sq-action-secondary"
                disabled={selectedIds.size === 0 || actionPending}
                onClick={handleMarkSelectedPrinted}
              >
                <Printer size={14} />
                Mark Selected as Printed ({selectedIds.size})
              </button>
              <button
                className="sq-action-primary"
                disabled={pendingCount === 0 || actionPending}
                onClick={handleMarkAllPrinted}
              >
                <CheckCircle2 size={14} />
                Mark All Pending as Printed
              </button>
            </div>
          )}
        </div>

        <div className="sq-table-wrap">
          <table className="sq-table">
            <thead>
              <tr>
                {!isReadOnly && (
                  <th className="sq-checkbox-col">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      disabled={selectableIds.length === 0}
                    />
                  </th>
                )}
                <th>Asset ID</th>
                <th>List Number</th>
                <th>Batch ID</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Model</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Printed At</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isReadOnly ? 9 : 10} className="sq-empty-row">
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={isReadOnly ? 9 : 10} className="sq-empty-row">
                    Failed to load sticker queue: {error}
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={isReadOnly ? 9 : 10} className="sq-empty-row">
                    {entries.length === 0
                      ? "No sticker queue entries for this shipment yet."
                      : "No entries match the current filter."}
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id}>
                    {!isReadOnly && (
                      <td className="sq-checkbox-col">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(entry.id)}
                          onChange={() => toggleSelectOne(entry.id)}
                        />
                      </td>
                    )}
                    <td className="sq-asset-id">{entry.assetId}</td>
                    <td>{entry.listNumber}</td>
                    <td>
                      <span className="sq-batch-pill">{entry.batchId}</span>
                    </td>
                    <td>
                      <span className="sq-category-badge">{entry.category}</span>
                    </td>
                    <td>{entry.brand}</td>
                    <td>{entry.model}</td>
                    <td>
                      <span
                        className={`sq-status-pill ${
                          entry.status === "PENDING" ? "sq-status-pending" : "sq-status-printed"
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="sq-date-cell">{formatDateTime(entry.createdAt)}</td>
                    <td className="sq-date-cell">{formatDateTime(entry.printedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="sq-table-footer">
          <span>
            Showing {filteredEntries.length} of {entries.length} entries
          </span>
        </div>
      </div>
    </div>
  );
}
