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
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function Sidebar({ isOpen, onClose }: SidebarProps) {
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

        <div className="sidebar-item">
          <Users size={16} />
          <span>Staff</span>
        </div>

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

        {/* SYSTEM SETTINGS */}
        <div className="sidebar-section">
          <span>SYSTEM SETTINGS</span>
        </div>

        <div className="sidebar-item">
          <Settings size={16} />
          <span>Adjustments</span>
        </div>

        <div className="sidebar-item">
          <Database size={16} />
          <span>Database</span>
        </div>

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

        {/* STOCK */}
        <div className="sidebar-section">
          <span>STOCK</span>
        </div>

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

      </nav>

    </aside>
  );
}

export default Sidebar;