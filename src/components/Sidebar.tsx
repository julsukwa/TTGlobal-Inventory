import "./Sidebar.css";
import TTglobal from "../assets/TTglobal.jpg";
import { NavLink } from "react-router-dom";

import {
  LayoutDashboard,
  Users,
  UserRound,
  Truck,
  Settings,
  Database,
  ListFilter,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  LogOut,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { canView } from "../utils/permissions";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();

  // Hides a nav item entirely (not disabled) when the current role has no
  // view permission for that module — see src/utils/permissions.ts.
  const canSee = (moduleKey: string) => !!user && canView(user.role, moduleKey);

  const showSystemSection =
    canSee("adjustments") || canSee("database") || canSee("dropdowns");
  const showStockSection = canSee("stockIn") || canSee("stockOut") || canSee("faultyStock");

  return (
    <aside className={`sidebar${isOpen ? " sidebar--open" : ""}`}>

      <div className="sidebar-logo">
        <img
          src={TTglobal}
          alt="TT Global Logo"
          className="logo-image"
        />
      </div>

      <nav className="sidebar-nav">

        {/* MAIN */}
        <div className="sidebar-section first-section">
          <span>MAIN</span>
        </div>

        {canSee("dashboard") && (
          <NavLink
            to="/dashboard"
            onClick={onClose}
            className={({ isActive }) =>
              isActive ? "sidebar-item active-item" : "sidebar-item"
            }
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </NavLink>
        )}

        {canSee("staff") && (
          <NavLink
            to="/staff"
            onClick={onClose}
            className={({ isActive }) =>
              isActive ? "sidebar-item active-item" : "sidebar-item"
            }
          >
            <Users size={16} />
            <span>Staff</span>
          </NavLink>
        )}

        {canSee("customers") && (
          <NavLink
            to="/customers"
            onClick={onClose}
            className={({ isActive }) =>
              isActive ? "sidebar-item active-item" : "sidebar-item"
            }
          >
            <UserRound size={16} />
            <span>Customers</span>
          </NavLink>
        )}

        {canSee("shipments") && (
          <NavLink
            to="/shipments"
            onClick={onClose}
            className={({ isActive }) =>
              isActive ? "sidebar-item active-item" : "sidebar-item"
            }
          >
            <Truck size={16} />
            <span>Shipments</span>
          </NavLink>
        )}

        {/* SYSTEM SETTINGS */}
        {showSystemSection && (
          <>
            <div className="sidebar-section">
              <span>SYSTEM SETTINGS</span>
            </div>

            {canSee("adjustments") && (
              <NavLink
                to="/adjustments"
                onClick={onClose}
                className={({ isActive }) =>
                  isActive ? "sidebar-item active-item" : "sidebar-item"
                }
              >
                <Settings size={16} />
                <span>Adjustments</span>
              </NavLink>
            )}

            {canSee("database") && (
              <NavLink
                to="/database"
                onClick={onClose}
                className={({ isActive }) =>
                  isActive ? "sidebar-item active-item" : "sidebar-item"
                }
              >
                <Database size={16} />
                <span>Database</span>
              </NavLink>
            )}

            {canSee("dropdowns") && (
              <NavLink
                to="/dropdowns"
                onClick={onClose}
                className={({ isActive }) =>
                  isActive ? "sidebar-item active-item" : "sidebar-item"
                }
              >
                <ListFilter size={16} />
                <span>Dropdowns</span>
              </NavLink>
            )}
          </>
        )}

        {/* STOCK */}
        {showStockSection && (
          <>
            <div className="sidebar-section">
              <span>STOCK</span>
            </div>

            {canSee("stockIn") && (
              <NavLink
                to="/stock-in"
                onClick={onClose}
                className={({ isActive }) =>
                  isActive ? "sidebar-item active-item" : "sidebar-item"
                }
              >
                <ArrowDownToLine size={16} />
                <span>Stock In</span>
              </NavLink>
            )}

            {canSee("stockOut") && (
              <NavLink
                to="/stock-out"
                onClick={onClose}
                className={({ isActive }) =>
                  isActive ? "sidebar-item active-item" : "sidebar-item"
                }
              >
                <ArrowUpFromLine size={16} />
                <span>Stock Out</span>
              </NavLink>
            )}

            {canSee("faultyStock") && (
              <NavLink
                to="/faulty-stock"
                onClick={onClose}
                className={({ isActive }) =>
                  isActive ? "sidebar-item active-item" : "sidebar-item"
                }
              >
                <AlertTriangle size={16} />
                <span>Faulty Stock</span>
              </NavLink>
            )}
          </>
        )}

      </nav>

      {/* Logout — pinned to the bottom of the sidebar via .sidebar-logout-btn's
          margin-top: auto on this flex column. */}
      <button className="sidebar-logout-btn" onClick={logout}>
        <LogOut size={16} />
        <span>Logout</span>
      </button>

    </aside>
  );
}

export default Sidebar;