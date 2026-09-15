// ─── Dashboard Page ─────────────────────────────────────────────────────────
//
// Role-aware landing page after login. A single component renders different
// KPI cards and content sections depending on the logged-in user's role
// (see useAuth()) — Admin gets the full operational picture, Sales/Warehouse/
// Warranty each get a focused 3-KPI view plus their own quick actions.
// All figures are static placeholder data — see mockDashboard.ts.

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUp,
  ArrowDown,
  Minus,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Shield,
  Plus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import "./DashboardPage.css";
import {
  inventoryOverview,
  stockByCategory,
  recentActivities,
  adminKPIs,
  salesKPIs,
  warehouseKPIs,
  warrantyKPIs,
} from "./mockDashboard";
import type { DashboardKPI, RecentActivity } from "./dashboardTypes";

import { Button } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import type { UserRole } from "../../utils/permissions";

const SUBTITLE_BY_ROLE: Record<UserRole, string> = {
  ADMIN: "Welcome back. Here is what is happening with your inventory today.",
  STAFF_SALES: "Here is your sales activity overview.",
  STAFF_WAREHOUSE: "Here is your warehouse operations overview.",
  STAFF_WARRANTY: "Here is your warranty returns overview.",
};

const KPIS_BY_ROLE: Record<UserRole, DashboardKPI[]> = {
  ADMIN: adminKPIs,
  STAFF_SALES: salesKPIs,
  STAFF_WAREHOUSE: warehouseKPIs,
  STAFF_WARRANTY: warrantyKPIs,
};

const ACTIVITY_ICON: Record<RecentActivity["type"], { Icon: LucideIcon; colorClass: string }> = {
  "stock-in": { Icon: ArrowDownToLine, colorClass: "dash-activity-icon-blue" },
  "stock-out": { Icon: ArrowUpFromLine, colorClass: "dash-activity-icon-indigo" },
  adjustment: { Icon: AlertTriangle, colorClass: "dash-activity-icon-red" },
  warranty: { Icon: Shield, colorClass: "dash-activity-icon-amber" },
  "new-item": { Icon: Plus, colorClass: "dash-activity-icon-green" },
};

function TrendIndicator({ trend, trendValue }: Pick<DashboardKPI, "trend" | "trendValue">) {
  if (!trend || !trendValue) return null;

  if (trend === "up") {
    return (
      <p className="dash-kpi-trend dash-trend-up">
        <ArrowUp size={12} />
        {trendValue}
      </p>
    );
  }

  if (trend === "down") {
    return (
      <p className="dash-kpi-trend dash-trend-down">
        <ArrowDown size={12} />
        {trendValue}
      </p>
    );
  }

  return (
    <p className="dash-kpi-trend dash-trend-neutral">
      <Minus size={12} />
      {trendValue}
    </p>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
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

  if (!user) return null;

  const role = user.role;
  const kpis = KPIS_BY_ROLE[role];
  const showAdminSections = role === "ADMIN";
  const showRecentActivities = role === "ADMIN" || role === "STAFF_WAREHOUSE";

  return (
    <div className="dash-page">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="dash-header">
        <div>
          <h1>Dashboard</h1>
          <p>{SUBTITLE_BY_ROLE[role]}</p>
        </div>
        <div className="dash-date">{todayLabel}</div>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className={`dash-kpi-grid ${role === "ADMIN" ? "dash-kpi-grid-5" : "dash-kpi-grid-3"}`}>
        {kpis.map((kpi) => (
          <div className="dash-kpi-card" key={kpi.label}>
            <span className="dash-kpi-label">{kpi.label}</span>
            <h2 className="dash-kpi-value">{kpi.value}</h2>
            <p className="dash-kpi-subtext">{kpi.subtext}</p>
            <TrendIndicator trend={kpi.trend} trendValue={kpi.trendValue} />
          </div>
        ))}
      </div>

      {/* ── Admin-only: Inventory Overview + Stock by Category ─────────────── */}
      {showAdminSections && (
        <div className="dash-two-col">
          <div className="dash-panel">
            <h3>Inventory Overview</h3>
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Total Stock</th>
                    <th>Available (Ok)</th>
                    <th>Faulty</th>
                    <th>Issued</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryOverview.map((row) => (
                    <tr key={row.category}>
                      <td className="dash-table-category">{row.category}</td>
                      <td>{row.totalStock}</td>
                      <td>{row.available}</td>
                      <td>{row.faulty}</td>
                      <td>{row.issued}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="dash-panel-link" onClick={() => navigate("/database")}>
              View all items →
            </button>
          </div>

          <div className="dash-panel">
            <h3>Stock by Category</h3>
            <div className="dash-bar-list">
              {stockByCategory.map((entry) => (
                <div className="dash-bar-row" key={entry.category}>
                  <span className="dash-bar-label">{entry.category}</span>
                  <div className="dash-bar-track">
                    <div className="dash-bar-fill" style={{ width: `${entry.percentage}%` }} />
                  </div>
                  <span className="dash-bar-value">
                    {entry.count} ({entry.percentage.toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
            <button className="dash-panel-link" onClick={() => navigate("/database")}>
              View all locations →
            </button>
          </div>
        </div>
      )}

      {/* ── Admin + Warehouse: Recent Activities ────────────────────────────── */}
      {showRecentActivities && (
        <div className="dash-panel">
          <h3>Recent Activities</h3>
          <ul className="dash-activity-feed">
            {recentActivities.map((activity) => {
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
          {/* No dedicated activity-log page exists yet — placeholder link. */}
          <button className="dash-panel-link">View all activities →</button>
        </div>
      )}

      {/* ── Sales-only: quick actions ───────────────────────────────────────── */}
      {role === "STAFF_SALES" && (
        <div className="dash-panel">
          <h3>Quick Actions</h3>
          <div className="dash-quick-actions">
            <Button variant="primary" onClick={() => navigate("/stock-out/new")}>
              New Stock Out
            </Button>
            <Button variant="secondary" onClick={() => navigate("/customers")}>
              View Customers
            </Button>
          </div>
        </div>
      )}

      {/* ── Warehouse-only: quick actions ───────────────────────────────────── */}
      {role === "STAFF_WAREHOUSE" && (
        <div className="dash-panel">
          <h3>Quick Actions</h3>
          <div className="dash-quick-actions">
            <Button variant="primary" onClick={() => navigate("/stock-in")}>
              Continue Stock In
            </Button>
            <Button variant="secondary" onClick={() => navigate("/faulty-stock")}>
              View Faulty Stock
            </Button>
          </div>
        </div>
      )}

      {/* ── Warranty-only: quick actions ────────────────────────────────────── */}
      {role === "STAFF_WARRANTY" && (
        <div className="dash-panel">
          <h3>Quick Actions</h3>
          <div className="dash-quick-actions">
            <Button variant="primary" onClick={() => navigate("/warranty")}>
              New Warranty Return
            </Button>
            <Button variant="secondary" onClick={() => navigate("/faulty-stock")}>
              View Faulty Stock
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
