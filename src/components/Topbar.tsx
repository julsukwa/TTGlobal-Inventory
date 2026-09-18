import "./Topbar.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import TTglobal from "../assets/TTglobal.jpg";

import {
  Search,
  Bell,
  ArrowDownToLine,
  ArrowUpFromLine,
  Menu,
  Loader2,
} from "lucide-react";

import { apiFetch } from "../services/api";
import { displayStatus } from "../pages/database/databaseTypes";
import type { BackendInventoryItem } from "../pages/database/databaseTypes";
import { StatusBadge } from "./ui";

const MIN_SEARCH_CHARS = 2;
const MAX_RESULTS = 8;
const DEBOUNCE_MS = 500;

interface TopbarProps {
  onMenuToggle: () => void;
}

function Topbar({ onMenuToggle }: TopbarProps) {

  const navigate = useNavigate();

  // ── Global inventory search ───────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<BackendInventoryItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const searchBoxRef = useRef<HTMLDivElement>(null);
  const lastSearchedRef = useRef("");
  // Bumped on every new search/reset so a slow earlier response can never
  // overwrite a newer one, or repopulate a dropdown that was already dismissed.
  const requestIdRef = useRef(0);

  const runSearch = useCallback((term: string) => {
    const query = term.trim();
    if (query.length < MIN_SEARCH_CHARS) return;

    lastSearchedRef.current = query;
    const requestId = ++requestIdRef.current;
    setOpen(true);
    setSearching(true);
    setSearchError(null);

    apiFetch<BackendInventoryItem[]>(`/inventory?search=${encodeURIComponent(query)}`)
      .then((rows) => {
        if (requestId === requestIdRef.current) setResults(rows.slice(0, MAX_RESULTS));
      })
      .catch((err: Error) => {
        if (requestId !== requestIdRef.current) return;
        setResults([]);
        setSearchError(err.message);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setSearching(false);
      });
  }, []);

  const resetSearch = () => {
    requestIdRef.current += 1;
    lastSearchedRef.current = "";
    setSearchTerm("");
    setResults([]);
    setSearching(false);
    setSearchError(null);
    setOpen(false);
  };

  // Debounced search-as-you-type. Enter runs the search immediately instead;
  // the lastSearchedRef check stops the pending timer repeating that request.
  useEffect(() => {
    const query = searchTerm.trim();
    if (query.length < MIN_SEARCH_CHARS || query === lastSearchedRef.current) return;

    const timeoutId = setTimeout(() => {
      if (query !== lastSearchedRef.current) runSearch(query);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, runSearch]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);

    if (value.trim().length < MIN_SEARCH_CHARS) {
      requestIdRef.current += 1;
      lastSearchedRef.current = "";
      setResults([]);
      setSearching(false);
      setSearchError(null);
      setOpen(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") runSearch(searchTerm);
    if (e.key === "Escape") resetSearch();
  };

  // Hands off to the Database page, filtered to exactly the clicked item.
  const handleSelectResult = (item: BackendInventoryItem) => {
    navigate(`/database?search=${encodeURIComponent(item.assetId)}`);
    resetSearch();
  };

  return (
    <div className="topbar">

      <div className="topbar-left">

        <button className="hamburger-btn" onClick={onMenuToggle} aria-label="Toggle menu">
          <Menu size={20} />
        </button>

        <img src={TTglobal} alt="TT Global" className="topbar-logo" />

        <div className="search-box" ref={searchBoxRef}>

          <Search size={16} />

          <input
            className="search-input"
            placeholder="Search inventory..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => {
              if (lastSearchedRef.current) setOpen(true);
            }}
          />

          {searching && <Loader2 size={16} className="search-spinner" />}

          {open && (
            <div className="search-results">
              {searching && results.length === 0 ? (
                <div className="search-results-status">Searching...</div>
              ) : searchError ? (
                <div className="search-results-status search-results-error">
                  Search failed: {searchError}
                </div>
              ) : results.length === 0 ? (
                <div className="search-results-status">No results found</div>
              ) : (
                results.map((item) => (
                  <button
                    type="button"
                    key={item.assetId}
                    className="search-result-row"
                    onClick={() => handleSelectResult(item)}
                  >
                    <div className="search-result-main">
                      <span className="search-result-asset-id">{item.assetId}</span>
                      <span className="search-result-name">
                        {item.brand} {item.model}
                      </span>
                      <span className="search-result-category">{item.category}</span>
                    </div>
                    <StatusBadge status={displayStatus(item.status)} />
                  </button>
                ))
              )}
            </div>
          )}

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
