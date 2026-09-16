// ─── Customers Page ─────────────────────────────────────────────────────────
//
// Lists all customers in the system with search, location filtering, and
// pagination. Supports inline add/edit/delete via modals, and exporting the
// current filtered list as a CSV downloaded from the backend. Customer Name
// and Phone Number are the only required fields — Email and Location are
// optional.
//
// Backed by the real /customers API (GET/POST/PATCH/DELETE, plus GET
// /customers/export for the CSV download). Search is server-side (debounced);
// the location filter is applied client-side on top of the fetched list.

import "./CustomerPage.css";
import { useEffect, useState } from "react";

import {
  Plus,
  Trash2,
  Download,
  Search,
  Pencil,
  X,
  Filter,
} from "lucide-react";

import { apiFetch, apiFetchBlob } from "../../services/api";

interface Customer {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  createdAt: string;
  updatedAt: string;
}

function CustomerPage() {
  const [showModal, setShowModal] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [location, setLocation] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [selectedLocation, setSelectedLocation] = useState("All Locations");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [formErrors, setFormErrors] = useState<{ fullName?: string; phone?: string }>({});

  // Fetches on mount (searchTerm starts empty) and again, debounced, whenever
  // the search box changes — the backend does the name/email/phone matching.
  useEffect(() => {
    let cancelled = false;

    const timeoutId = setTimeout(() => {
      setLoading(true);
      setError(null);

      const query = searchTerm.trim();
      const endpoint = query ? `/customers?search=${encodeURIComponent(query)}` : "/customers";

      apiFetch<Customer[]>(endpoint)
        .then((data) => {
          if (!cancelled) setCustomers(data);
        })
        .catch((err: Error) => {
          if (!cancelled) setError(err.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [searchTerm]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveCustomer();
    }
  };

  const handleSaveCustomer = async () => {
    const newErrors: { fullName?: string; phone?: string } = {};
    if (!customerName.trim()) newErrors.fullName = "Customer Name is required.";
    if (!phoneNumber.trim()) newErrors.phone = "Phone Number is required.";

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      return;
    }

    setSaving(true);
    setApiError(null);

    const payload = {
      fullName: customerName.trim(),
      phone: phoneNumber.trim(),
      email: emailAddress.trim(),
      location: location.trim(),
    };

    try {
      if (editingCustomer) {
        const updated = await apiFetch<Customer>(`/customers/${editingCustomer.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const created = await apiFetch<Customer>("/customers", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setCustomers((prev) => [created, ...prev]);
      }

      setCustomerName("");
      setPhoneNumber("");
      setEmailAddress("");
      setLocation("");
      setEditingCustomer(null);
      setFormErrors({});
      setShowModal(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to save customer.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerName(customer.fullName);
    setPhoneNumber(customer.phone);
    setEmailAddress(customer.email);
    setLocation(customer.location);
    setFormErrors({});
    setApiError(null);
    setShowModal(true);
  };

  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer);
    setApiError(null);
    setShowDeleteModal(true);
  };

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return;

    setDeleting(true);
    setApiError(null);

    try {
      await apiFetch(`/customers/${customerToDelete.id}`, { method: "DELETE" });
      setCustomers((prev) => prev.filter((customer) => customer.id !== customerToDelete.id));
      setCustomerToDelete(null);
      setShowDeleteModal(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to delete customer.");
    } finally {
      setDeleting(false);
    }
  };

  // Search is already applied server-side (see the fetch effect above) —
  // this only narrows the fetched list by the client-side location filter.
  const filteredCustomers = customers.filter(
    (customer) => selectedLocation === "All Locations" || customer.location === selectedLocation
  );

  const customersPerPage = 10;

  const totalPages = Math.ceil(
    filteredCustomers.length / customersPerPage
  );

  const startIndex =
    (currentPage - 1) * customersPerPage;

  const endIndex =
    startIndex + customersPerPage;

  const paginatedCustomers =
    filteredCustomers.slice(
      startIndex,
      endIndex
    );

  const handleExportCSV = async () => {
    setApiError(null);

    try {
      const blob = await apiFetchBlob("/customers/export");
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Customer_Report_${new Date()
        .toLocaleDateString("en-GB")
        .replace(/\//g, "-")}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to export customers.");
    }
  };

const locations = [
  "All Locations",
  ...new Set(
    customers
      .map((customer) => customer.location)
      .filter(Boolean)
  ),
];

  return (
    <div className="customer-page">

      {/* Header */}

      <div className="customer-header">

        <div>
          <h1>Customers</h1>

          <p>
            Manage your customers. Add, edit, delete and export customer records.
          </p>
        </div>

        <div className="customer-actions">

          <button
            className="btn-primary"
            onClick={() => {
              setFormErrors({});
              setApiError(null);
              setShowModal(true);
            }}
          >
            <Plus size={16} />
            Add New Customer
          </button>

          <button
            className="btn-secondary"
            onClick={handleExportCSV}
          >
            <Download size={16} />
            Export CSV
          </button>

        </div>

      </div>

      {apiError && <p className="field-error">{apiError}</p>}

      {/* Table Card */}

      <div className="customer-table-card">

        <div className="customer-toolbar">

          <div className="search-wrapper">

            <Search size={16} />

            <input
              type="text"
              className="customer-search"
              placeholder="Search customer by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

          </div>

          <div className="filter-container">

      <button
        className="filter-button"
        onClick={() =>
          setShowFilterMenu(!showFilterMenu)
        }
      >
        <Filter size={16} />
        Filter
      </button>

      {showFilterMenu && (

        <div className="filter-dropdown">

          <div className="filter-title">
            Filter By Location
          </div>

          {locations.map((location) => (

            <button
              key={location}
              className={
                selectedLocation === location
                  ? "filter-option active-filter"
                  : "filter-option"
              }
              onClick={() => {
                setSelectedLocation(location);
                setShowFilterMenu(false);
              }}
            >
              {location}
            </button>

          ))}

        </div>

  )}

</div>
        </div>

        <table className="customer-table">

          <thead>

            <tr>
              <th>#</th>
              <th>Customer Name</th>
              <th>Email</th>
              <th>Phone Number</th>
              <th>Location</th>
              <th>Date Added</th>
              <th>Actions</th>
            </tr>

          </thead>

          <tbody>

            {loading ? (
              <tr>
                <td colSpan={7} className="no-results">
                  Loading...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} className="no-results">
                  Failed to load customers: {error}
                </td>
              </tr>
            ) : paginatedCustomers.length === 0 ? (
              <tr>
                <td colSpan={7} className="no-results">
                  No customers found.
                </td>
              </tr>
            ) : (

            paginatedCustomers.map((customer, index) => (

              <tr key={customer.id}>

                <td>{startIndex +index +1}</td>

                <td className="customer-name">
                  {customer.fullName}
                </td>

                <td>{customer.email}</td>

                <td>{customer.phone}</td>

                <td>{customer.location}</td>

                <td>{new Date(customer.createdAt).toLocaleDateString("en-GB")}</td>

                <td>

                  <div className="table-actions">

                    <button
                      className="customer-action-btn edit-btn"
                      onClick={() => handleEditCustomer(customer)}
                    >
                      <Pencil size={15} />
                    </button>

                    <button
                      className="customer-action-btn delete-btn"
                      onClick={() => handleDeleteClick(customer)}
                    >
                      <Trash2 size={15} />
                    </button>

                  </div>

                </td>

              </tr>

            ))
            )}

          </tbody>

        </table>

        <div className="customer-footer">

          <span>
            Showing
              {" "}
              {filteredCustomers.length === 0
                ? 0
                : startIndex + 1}
              -
              {Math.min(
                endIndex,
                filteredCustomers.length
              )}
              {" "}
              of
              {" "}
              {filteredCustomers.length}
              {" "}
              customers
          </span>

          <div className="pagination">

            <button
              disabled={currentPage === 1}
              onClick={() =>
                setCurrentPage(currentPage - 1)
              }
            >
              {"<"}
            </button>

            {Array.from(
              { length: totalPages },
              (_, index) => (

                <button
                  key={index + 1}
                  className={
                    currentPage === index + 1
                      ? "active-page"
                      : ""
                  }
                  onClick={() =>
                    setCurrentPage(index + 1)
                  }
                >
                  {index + 1}
                </button>

            ))}

            <button
              disabled={currentPage === totalPages}
              onClick={() =>
                setCurrentPage(currentPage + 1)
              }
            >
              {">"}
            </button>

          </div>

        </div>

      </div>

      {/* Modal */}

      {showModal && (

        <div
          className="modal-overlay"
          onClick={() => setShowModal(false)}
        >

          <div
            className="customer-modal"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="modal-header">

              <h2>
                {editingCustomer
                  ? "Edit Customer"
                  : "Add New Customer"}
              </h2>

              <button
                className="close-btn"
                onClick={() => {
                  setShowModal(false);
                  setFormErrors({});
                }}
              >
                <X size={18} />
              </button>

            </div>

            <div className="modal-form">

              <div className="form-field">

                <label>Customer Name *</label>

                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    setFormErrors((prev) => ({ ...prev, fullName: undefined }));
                  }}
                  onKeyDown={handleKeyDown}
                />

                {formErrors.fullName && (
                  <span className="field-error">
                    {formErrors.fullName}
                  </span>
                )}

              </div>

              <div className="form-field">

                <label>Phone Number *</label>

                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    setFormErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  onKeyDown={handleKeyDown}
                />

                {formErrors.phone && (
                  <span className="field-error">
                    {formErrors.phone}
                  </span>
                )}

              </div>

              <div className="form-field">

                <label>Email Address</label>

                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) =>
                    setEmailAddress(e.target.value)
                  }
                  onKeyDown={handleKeyDown}
                />

              </div>

              <div className="form-field">

                <label>Location</label>

                <input
                  type="text"
                  value={location}
                  onChange={(e) =>
                    setLocation(e.target.value)
                  }
                  onKeyDown={handleKeyDown}
                />

              </div>

            </div>

            {apiError && <p className="field-error">{apiError}</p>}

            <div className="modal-actions">

              <button
                className="modal-cancel"
                onClick={() => {
                  setShowModal(false);
                  setFormErrors({});
                }}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="modal-save"
                onClick={handleSaveCustomer}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingCustomer
                  ? "Update Customer"
                  : "Save Customer"}
              </button>

            </div>

          </div>

        </div>

      )}

      {showDeleteModal && (

  <div
    className="modal-overlay"
    onClick={() => setShowDeleteModal(false)}
  >

    <div
      className="delete-modal"
      onClick={(e) => e.stopPropagation()}
    >

      <h2>Delete Customer</h2>

      <p>
        Are you sure you want to delete
        <strong>
          {" "}
          {customerToDelete?.fullName}
        </strong>
        ?
      </p>

      <span>
        This action cannot be undone.
      </span>

      {apiError && <p className="field-error">{apiError}</p>}

      <div className="delete-actions">

        <button
          className="modal-cancel"
          onClick={() => setShowDeleteModal(false)}
          disabled={deleting}
        >
          Cancel
        </button>

        <button
          className="delete-confirm-btn"
          onClick={confirmDeleteCustomer}
          disabled={deleting}
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>

      </div>

    </div>

  </div>

)}

</div>
);
}

export default CustomerPage;
