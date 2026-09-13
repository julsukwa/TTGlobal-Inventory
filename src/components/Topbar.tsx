import "./Topbar.css";
import { useNavigate } from "react-router-dom";
import TTglobal from "../assets/TTglobal.jpg";

import {
  Search,
  Bell,
  ArrowDownToLine,
  ArrowUpFromLine,
  Menu,
} from "lucide-react";

interface TopbarProps {
  onMenuToggle: () => void;
}

function Topbar({ onMenuToggle }: TopbarProps) {

  const navigate = useNavigate();
  return (
    <div className="topbar">

      <div className="topbar-left">

        <button className="hamburger-btn" onClick={onMenuToggle} aria-label="Toggle menu">
          <Menu size={20} />
        </button>

        <img src={TTglobal} alt="TT Global" className="topbar-logo" />

        <div className="search-box">

          <Search size={16} />

          <input
            className="search-input"
            placeholder="Search inventory..."
          />

        </div>

      </div>

      <div className="topbar-right">

        <button
          className="topbar-btn"
          onClick={() => navigate("/stock-in")}
        >
          <ArrowDownToLine size={16} />
          <span>Stock In</span>
        </button>

        <button
          className="topbar-btn"
          onClick={() => navigate("/stock-out")}
        >
          <ArrowUpFromLine size={16} />
          <span>Stock Out</span>
        </button>

        <button className="notification-btn">
          <Bell size={18} />
        </button>

        <div className="profile">

          <div className="avatar">
            A
          </div>

          <div className="profile-info">

            <span className="profile-name">
              Admin
            </span>

            <span className="profile-role">
              Administrator
            </span>

          </div>

        </div>

      </div>

    </div>
  );
}

export default Topbar;