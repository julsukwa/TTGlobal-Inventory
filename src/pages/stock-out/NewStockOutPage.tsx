import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, User, ChevronDown } from "lucide-react";

import "./NewStockOutPage.css";
import mockCustomers from "../customers/mockCustomers";
import type { Customer } from "./stockOutTypes";

// BACKEND INTEGRATION SEAM:
// Customer search: GET /customers?search=:query
// On confirm navigate to scanning workspace passing state, not a DB write yet.

export default function NewStockOutPage() {
  const navigate = useNavigate();

  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ customer?: string; invoice?: string }>({});

  const customers: Customer[] = mockCustomers;

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const s = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s) ||
        c.phone.includes(s)
    );
  }, [customerSearch, customers]);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name);
    setShowDropdown(false);
    setErrors((prev) => ({ ...prev, customer: undefined }));
  };

  const handleCustomerInputChange = (value: string) => {
    setCustomerSearch(value);
    setSelectedCustomer(null);
    setShowDropdown(true);
  };

  const validate = () => {
    const newErrors: { customer?: string; invoice?: string } = {};
    if (!selectedCustomer) {
      newErrors.customer = "Please select a customer from the list.";
    }
    if (!invoiceNumber.trim()) {
      newErrors.invoice = "Invoice number is required.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleProceed = () => {
    if (!validate()) return;

    // Pass initiation data to the scanning workspace via router state.
    // BACKEND INTEGRATION SEAM: no write happens here — transaction is only
    // committed once the operator confirms on the review page.
    navigate("/stock-out/scan", {
      state: {
        customer: selectedCustomer,
        invoiceNumber: invoiceNumber.trim(),
        notes: notes.trim(),
      },
    });
  };

  return (
    <div className="nso-page">
      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <div className="nso-breadcrumb">Stock Out &gt; New Stock Out</div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="nso-header">
        <div>
          <h1>New Stock Out</h1>
          <p>Select a customer and enter the invoice details to begin issuing inventory.</p>
        </div>
        <button className="nso-back-btn" onClick={() => navigate("/stock-out")}>
          <ArrowLeft size={14} />
          Back to Stock Out
        </button>
      </div>

      <div className="nso-body">
        {/* ── Customer selection ─────────────────────────────────────────────── */}
        <div className="nso-card">
          <div className="nso-card-header">
            <User size={16} />
            <h2>Customer Selection</h2>
          </div>
          <p className="nso-card-desc">
            Search for the customer this stock out is being processed for.
          </p>

          <div className="nso-customer-search-wrapper">
            <label className="nso-label">
              Customer <span className="nso-required">*</span>
            </label>
            <div className="nso-customer-input-row">
              <div className="nso-search-input-wrap">
                <Search size={14} className="nso-search-icon" />
                <input
                  type="text"
                  placeholder="Search by name, email or phone..."
                  value={customerSearch}
                  onChange={(e) => handleCustomerInputChange(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  className={errors.customer ? "nso-input-error" : ""}
                />
                <ChevronDown size={14} className="nso-chevron" />
              </div>

              {showDropdown && customerSearch.length > 0 && (
                <div className="nso-customer-dropdown">
                  {filteredCustomers.length === 0 ? (
                    <div className="nso-dropdown-empty">No customers found.</div>
                  ) : (
                    filteredCustomers.map((c) => (
                      <div
                        key={c.id}
                        className="nso-dropdown-item"
                        onMouseDown={() => handleSelectCustomer(c)}
                      >
                        <div className="nso-dropdown-name">{c.name}</div>
                        <div className="nso-dropdown-meta">
                          {c.email} · {c.phone} · {c.location}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            {errors.customer && (
              <span className="nso-error-msg">{errors.customer}</span>
            )}
          </div>

          {/* Customer details auto-populated */}
          {selectedCustomer && (
            <div className="nso-customer-details">
              <div className="nso-detail-row">
                <div>
                  <span>Full Name</span>
                  <p>{selectedCustomer.name}</p>
                </div>
                <div>
                  <span>Email</span>
                  <p>{selectedCustomer.email}</p>
                </div>
                <div>
                  <span>Phone</span>
                  <p>{selectedCustomer.phone}</p>
                </div>
                <div>
                  <span>Location</span>
                  <p>{selectedCustomer.location}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Invoice details ─────────────────────────────────────────────────── */}
        <div className="nso-card">
          <div className="nso-card-header">
            <span className="nso-card-icon">📄</span>
            <h2>Invoice Details</h2>
          </div>
          <p className="nso-card-desc">
            Enter the physical invoice number. This will appear on the generated delivery note.
          </p>

          <div className="nso-form-grid">
            <div className="nso-field">
              <label className="nso-label">
                Invoice Number <span className="nso-required">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. INV-2026-0042"
                value={invoiceNumber}
                onChange={(e) => {
                  setInvoiceNumber(e.target.value);
                  setErrors((prev) => ({ ...prev, invoice: undefined }));
                }}
                className={`nso-text-input ${errors.invoice ? "nso-input-error" : ""}`}
              />
              {errors.invoice && (
                <span className="nso-error-msg">{errors.invoice}</span>
              )}
            </div>

            <div className="nso-field">
              <label className="nso-label">Date</label>
              <input
                type="text"
                value={new Date().toLocaleDateString("en-GB")}
                disabled
                className="nso-text-input nso-input-disabled"
              />
            </div>

            <div className="nso-field nso-field-full">
              <label className="nso-label">
                Notes <span className="nso-optional">(optional)</span>
              </label>
              <textarea
                placeholder="Any additional notes for this stock out..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="nso-textarea"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────────── */}
      <div className="nso-actions">
        <button className="nso-cancel-btn" onClick={() => navigate("/stock-out")}>
          Cancel
        </button>
        <button className="nso-proceed-btn" onClick={handleProceed}>
          Proceed to Item Scanning →
        </button>
      </div>
    </div>
  );
}