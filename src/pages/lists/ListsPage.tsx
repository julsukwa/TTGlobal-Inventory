// ─── Lists Page ─────────────────────────────────────────────────────────────
//
// System-wide view of every unique list number, with its inventory breakdown
// (Ok/Faulty/Issued) and a derived status: closed (nothing issued yet), open
// (partially sold) or sold (everything issued). Reached from the Dashboard's
// "Total Lists"/"Open Lists" cards, both of which pre-apply a status filter
// read from the URL on mount.
//
// Backed by GET /dashboard/lists for the rows and GET /dashboard/stats for
// isEndOfMonth (see backend/src/dashboard) — open lists in the last 7 days of
// the month get a highlighted row, echoing the Dashboard's own end-of-month
// warning. The list is small enough (unique list numbers, not items) to fetch
// once unfiltered and filter/search entirely client-side.

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, List as ListIcon, FolderOpen, CheckCircle2, AlertTriangle } from "lucide-react";

import "./ListsPage.css";
import type { ListRow, ListStatus } from "./listsTypes";
import type { DashboardStats } from "../dashboard/dashboardTypes";
import { apiFetch } from "../../services/api";
import { Pagination, ListNumberBadge } from "../../components/ui";

const ITEMS_PER_PAGE = 20;

type StatusFilter = "all" | ListStatus;

const STATUS_LABELS: Record<ListStatus, string> = {
  closed: "Closed",
  open: "Open",
  sold: "Sold",
};

export default function ListsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [allLists, setAllLists] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<DashboardStats | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const value = searchParams.get("status");
    return value === "closed" || value === "open" || value === "sold" ? value : "all";
  });
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    apiFetch<ListRow[]>("/dashboard/lists")
      .then(setAllLists)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));

    apiFetch<DashboardStats>("/dashboard/stats")
      .then(setStats)
      .catch(() => {
        // The end-of-month row highlight just stays off on failure.
      });
  }, []);

  const openListsCount = useMemo(() => allLists.filter((l) => l.status === "open").length, [allLists]);
  const soldListsCount = useMemo(() => allLists.filter((l) => l.status === "sold").length, [allLists]);

  const filteredLists = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return allLists.filter((l) => {
      const matchesStatus = statusFilter === "all" || l.status === statusFilter;
      const matchesSearch = !query || l.listNumber.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [allLists, statusFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredLists.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const paginatedLists = filteredLists.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const rangeStart = filteredLists.length === 0 ? 0 : startIndex + 1;
  const rangeEnd = Math.min(startIndex + ITEMS_PER_PAGE, filteredLists.length);

  const handleViewInventory = (listNumber: string) => {
    navigate(`/inventory-available?listNumber=${encodeURIComponent(listNumber)}`);
  };

  return (
    <div className="lists-page">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="lists-header">
        <div>
          <h1>Lists</h1>
          <p>Monitor inventory organised by list number.</p>
        </div>
      </div>

      {/* ── Summary strip ─────────────────────────────────────────────────── */}
      <div className="lists-summary-strip">
        <div className="lists-summary-item">
          <div className="lists-summary-icon lists-icon-blue">
            <ListIcon size={16} />
          </div>
          <div>
            <span>Total Lists</span>
            <h3>{allLists.length}</h3>
          </div>
        </div>

        <div className="lists-summary-item">
          <div className="lists-summary-icon lists-icon-amber">
            <FolderOpen size={16} />
          </div>
          <div>
            <span className="lists-summary-label-row">
              Open Lists
              {stats?.isEndOfMonth && (
                <span className="lists-warning-badge">
                  <AlertTriangle size={11} />
                  {stats.daysUntilMonthEnd}d left
                </span>
              )}
            </span>
            <h3>{openListsCount}</h3>
          </div>
        </div>

        <div className="lists-summary-item">
          <div className="lists-summary-icon lists-icon-green">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <span>Sold Lists</span>
            <h3>{soldListsCount}</h3>
          </div>
        </div>
      </div>

      {/* ── Table card ───────────────────────────────────────────────────── */}
      <div className="lists-table-card">
        <div className="lists-toolbar">
          <div className="lists-search">
            <input
              type="text"
              placeholder="Search by list number..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="lists-status-tabs">
            {(["all", "closed", "open", "sold"] as StatusFilter[]).map((value) => (
              <button
                key={value}
                className={`lists-status-tab${statusFilter === value ? " lists-status-tab-active" : ""}`}
                onClick={() => {
                  setStatusFilter(value);
                  setCurrentPage(1);
                }}
              >
                {value === "all" ? "All" : STATUS_LABELS[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="lists-table-wrap">
          <table className="lists-table">
            <thead>
              <tr>
                <th>List Number</th>
                <th>Total Items</th>
                <th>OK</th>
                <th>Faulty</th>
                <th>Issued</th>
                <th>Status</th>
                <th className="lists-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="lists-empty-row">
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="lists-empty-row">
                    Failed to load lists: {error}
                  </td>
                </tr>
              ) : paginatedLists.length === 0 ? (
                <tr>
                  <td colSpan={7} className="lists-empty-row">
                    No lists match your search/filters.
                  </td>
                </tr>
              ) : (
                paginatedLists.map((list) => (
                  <tr
                    key={list.listNumber}
                    className={
                      list.status === "open" && stats?.isEndOfMonth ? "lists-row-warning" : undefined
                    }
                  >
                    <td>
                      <ListNumberBadge value={list.listNumber} />
                    </td>
                    <td>{list.totalItems}</td>
                    <td>{list.okCount}</td>
                    <td>{list.faultyCount}</td>
                    <td>{list.issuedCount}</td>
                    <td>
                      <span className={`lists-status-pill lists-status-${list.status}`}>
                        {STATUS_LABELS[list.status]}
                      </span>
                    </td>
                    <td className="lists-actions-col">
                      <button
                        className="lists-action-btn"
                        title="View inventory for this list"
                        onClick={() => handleViewInventory(list.listNumber)}
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="lists-table-footer">
          <span>
            Showing {rangeStart}–{rangeEnd} of {filteredLists.length} entries
          </span>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </div>
    </div>
  );
}
