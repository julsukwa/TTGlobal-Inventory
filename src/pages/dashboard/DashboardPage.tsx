// ─── Dashboard Page ─────────────────────────────────────────────────────────
//
// Landing page after login — five KPI cards backed by GET /dashboard/stats,
// each one a full navigational link into the relevant Inventory/Lists view
// (see backend/src/dashboard), plus a Recent Activity feed assembled from
// the last few adjustments and stock-out transactions — see dashboardTypes.ts.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  CheckCircle,
  AlertTriangle,
  List,
  AlertCircle,
  ArrowUpFromLine,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import "./DashboardPage.css";
import { adjustmentToActivity, stockOutToActivity } from "./dashboardTypes";
import type { DashboardStats, RecentActivityItem } from "./dashboardTypes";
import type { BackendAdjustmentRecord } from "../adjustments/adjustmentTypes";
import type { StockOutApiTransaction } from "../stock-out/stockOutTypes";
import { apiFetch } from "../../services/api";

interface KpiCardConfig {
  key: string;
  label: string;
  subtext: string;
  value: number;
  Icon: LucideIcon;
  colorClass: string;
  onClick: () => void;
  danger?: boolean;
  warningText?: string;
}

const ACTIVITY_ICON: Record<RecentActivityItem["type"], { Icon: LucideIcon; colorClass: string }> = {
  adjustment: { Icon: AlertTriangle, colorClass: "dash-activity-icon-red" },
  "stock-out": { Icon: ArrowUpFromLine, colorClass: "dash-activity-icon-indigo" },
};

export default function DashboardPage() {
  const navigate = useNavigate();

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    []
  );

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    apiFetch<DashboardStats>("/dashboard/stats")
      .then(setStats)
      .catch((err: Error) => setStatsError(err.message));
  }, []);

  // Two independent sources, merged and interleaved by recency client-side —
  // there is no dedicated activity-log endpoint yet. Either request may 403
  // depending on the logged-in role (Sales/Warranty can't read /adjustments),
  // so failures are handled per-source rather than failing the whole feed.
  useEffect(() => {
    Promise.allSettled([
      apiFetch<BackendAdjustmentRecord[]>("/adjustments"),
      apiFetch<StockOutApiTransaction[]>("/stock-out"),
    ])
      .then(([adjustmentsResult, stockOutResult]) => {
        const adjustmentItems =
          adjustmentsResult.status === "fulfilled"
            ? adjustmentsResult.value.slice(0, 5).map(adjustmentToActivity)
            : [];
        const stockOutItems =
          stockOutResult.status === "fulfilled"
            ? stockOutResult.value.slice(0, 5).map(stockOutToActivity)
            : [];

        setRecentActivity(
          [...adjustmentItems, ...stockOutItems].sort((a, b) => b.sortKey - a.sortKey).slice(0, 5)
        );
      })
      .finally(() => setActivityLoading(false));
  }, []);

  const kpiCards: KpiCardConfig[] = stats
    ? [
        {
          key: "total-available",
          label: "Total Available",
          subtext: "Items physically present",
          value: stats.totalAvailable,
          Icon: Package,
          colorClass: "dash-kpi-icon-blue",
          onClick: () => navigate("/inventory-available"),
        },
        {
          key: "ok-stock",
          label: "OK Stock",
          subtext: "Items in good condition",
          value: stats.okCount,
          Icon: CheckCircle,
          colorClass: "dash-kpi-icon-green",
          onClick: () => navigate("/inventory-available?status=OK"),
        },
        {
          key: "faulty-stock",
          label: "Faulty Stock",
          subtext: "Items with defects",
          value: stats.faultyCount,
          Icon: AlertTriangle,
          colorClass: "dash-kpi-icon-red",
          onClick: () => navigate("/inventory-available?status=FAULTY"),
        },
        {
          key: "total-lists",
          label: "Total Lists",
          subtext: "Unique list numbers",
          value: stats.totalLists,
          Icon: List,
          colorClass: "dash-kpi-icon-indigo",
          onClick: () => navigate("/lists"),
        },
        {
          key: "open-lists",
          label: "Open Lists",
          subtext: "Partially sold lists",
          value: stats.openLists,
          Icon: AlertCircle,
          colorClass: "dash-kpi-icon-amber",
          onClick: () => navigate("/lists?status=open"),
          danger: stats.isEndOfMonth,
          warningText: stats.isEndOfMonth
            ? `Warning: ${stats.daysUntilMonthEnd} day${
                stats.daysUntilMonthEnd === 1 ? "" : "s"
              } until month end. Open lists must be cleared.`
            : undefined,
        },
      ]
    : [];

  return (
    <div className="dash-page">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="dash-header">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back. Here is your inventory overview.</p>
        </div>
        <div className="dash-date">{todayLabel}</div>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      {statsError ? (
        <p className="field-error">Failed to load dashboard stats: {statsError}</p>
      ) : !stats ? (
        <p className="dash-loading-text">Loading dashboard...</p>
      ) : (
        <div className="dash-kpi-grid dash-kpi-grid-5">
          {kpiCards.map((kpi) => (
            <button
              key={kpi.key}
              type="button"
              className={`dash-kpi-card${kpi.danger ? " dash-kpi-card-danger" : ""}`}
              onClick={kpi.onClick}
            >
              <span className={`dash-kpi-icon ${kpi.colorClass}`}>
                <kpi.Icon size={18} />
              </span>
              <span className="dash-kpi-label">{kpi.label}</span>
              <h2 className="dash-kpi-value">{kpi.value}</h2>
              <p className="dash-kpi-subtext">{kpi.subtext}</p>
              {kpi.warningText && <p className="dash-kpi-warning-banner">{kpi.warningText}</p>}
            </button>
          ))}
        </div>
      )}

      {/* ── Recent Activity ──────────────────────────────────────────────── */}
      <div className="dash-panel">
        <h3>Recent Activity</h3>
        {activityLoading ? (
          <p className="dash-loading-text">Loading...</p>
        ) : recentActivity.length === 0 ? (
          <p className="dash-loading-text">No recent activity to show.</p>
        ) : (
          <ul className="dash-activity-feed">
            {recentActivity.map((activity) => {
              const { Icon, colorClass } = ACTIVITY_ICON[activity.type];
              return (
                <li className="dash-activity-row" key={activity.id}>
                  <span className={`dash-activity-icon ${colorClass}`}>
                    <Icon size={16} />
                  </span>
                  <div className="dash-activity-content">
                    <p className="dash-activity-description">{activity.description}</p>
                    <span className="dash-activity-user">{activity.user}</span>
                  </div>
                  <span className="dash-activity-timestamp">{activity.timestamp}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
