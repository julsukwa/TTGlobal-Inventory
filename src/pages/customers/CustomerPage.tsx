// ─── Customers Page ─────────────────────────────────────────────────────────
//
// Lists all customers in the system with search, location filtering, and
// pagination. Supports inline add/edit/delete via modals, and exporting the
// current filtered list to an .xlsx report. Customer Name and Phone Number
// are the only required fields — Email and Location are optional.
//
// BACKEND INTEGRATION SEAM: customers are held in local state seeded from
// mockCustomers; a real API would back CRUD here (GET/POST/PATCH/DELETE
// /customers).

import "./CustomerPage.css";
import mockCustomers from "./mockCustomers";
import { useState } from "react";
import * as XLSX from "xlsx";

import {
  Plus,
  Trash2,
  Download,
  Search,
  Pencil,
  X,
  Filter,
} from "lucide-react";

import type { Customer } from "../stock-out/stockOutTypes";

function CustomerPage() {
  const [showModal, setShowModal] = useState(false);

  const [customers, setCustomers] = useState(mockCustomers);
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
  const [formErrors, setFormErrors] = useState<{ name?: string; phone?: string }>({});

  const handleSaveCustomer = () => {
  const newErrors: { name?: string; phone?: string } = {};
  if (!customerName.trim()) newErrors.name = "Customer Name is required.";
  if (!phoneNumber.trim()) newErrors.phone = "Phone Number is required.";

  if (Object.keys(newErrors).length > 0) {
    setFormErrors(newErrors);
    return;
  }

  if (editingCustomer) {

    const updatedCustomers = customers.map((customer) =>
      customer.id === editingCustomer.id
        ? {
            ...customer,
            name: customerName,
            phone: phoneNumber,
            email: emailAddress,
            location: location,
          }
        : customer
    );

    setCustomers(updatedCustomers);

  } else {

    const newCustomer = {
      id: Date.now(),

      name: customerName,
      email: emailAddress,
      phone: phoneNumber,
      location: location,

      dateAdded: new Date().toLocaleDateString("en-GB"),
    };

    setCustomers([newCustomer, ...customers]);
  }

  setCustomerName("");
  setPhoneNumber("");
  setEmailAddress("");
  setLocation("");

  setEditingCustomer(null);
  setFormErrors({});

  setShowModal(false);
};

  const handleEditCustomer = (customer: Customer) => {
  setEditingCustomer(customer);

  setCustomerName(customer.name);
  setPhoneNumber(customer.phone);
  setEmailAddress(customer.email);
  setLocation(customer.location);
  setFormErrors({});

  setShowModal(true);
};

const handleDeleteClick = (customer: Customer) => {
  setCustomerToDelete(customer);
  setShowDeleteModal(true);
};

const confirmDeleteCustomer = () => {

  if (!customerToDelete) return;

  const updatedCustomers = customers.filter(
    (customer) =>
      customer.id !== customerToDelete.id
  );

  setCustomers(updatedCustomers);

  setCustomerToDelete(null);

  setShowDeleteModal(false);
};

  const filteredCustomers = customers.filter(
  (customer) => {

    const matchesSearch =
      customer.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesLocation =
      selectedLocation === "All Locations" ||
      customer.location === selectedLocation;

    return matchesSearch && matchesLocation;
  }
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

  const handleExportCSV = () => {

  const exportData = filteredCustomers.map(
    (customer) => ({
      /*"S/N": index + 1,*/
      "Customer Name": customer.name,
      "Phone Number": customer.phone,
      "Email Address": customer.email,
      Location: customer.location,
      "Date Added": customer.dateAdded,
    })
  );

  const worksheet =
    XLSX.utils.json_to_sheet(exportData);

  worksheet["!cols"] = [
  /*{ wch: 8 },*/
  { wch: 30 },
  { wch: 20 },
  { wch: 35 },
  { wch: 20 },
  { wch: 15 },
  ];

  const workbook =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Customers"
  );

  XLSX.writeFile(
    workbook,
    `Customer_Report_${new Date()
      .toLocaleDateString("en-GB")
      .replace(/\//g, "-")}.xlsx`
  );
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

            {paginatedCustomers.map((customer, index) => (

              <tr key={customer.id}>

                <td>{startIndex +index +1}</td>

                <td className="customer-name">
                  {customer.name}
                </td>

                <td>{customer.email}</td>

                <td>{customer.phone}</td>

                <td>{customer.location}</td>

                <td>{customer.dateAdded}</td>

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

            ))}

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
                    setFormErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                />

                {formErrors.name && (
                  <span className="field-error">
                    {formErrors.name}
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
                />

              </div>

            </div>

            <div className="modal-actions">

              <button
                className="modal-cancel"
                onClick={() => {
                  setShowModal(false);
                  setFormErrors({});
                }}
              >
                Cancel
              </button>

              <button
                className="modal-save"
                onClick={handleSaveCustomer}
              >
                {editingCustomer
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
          {customerToDelete?.name}
        </strong>
        ?
      </p>

      <span>
        This action cannot be undone.
      </span>

      <div className="delete-actions">

        <button
          className="modal-cancel"
          onClick={() => setShowDeleteModal(false)}
        >
          Cancel
        </button>

        <button
          className="delete-confirm-btn"
          onClick={confirmDeleteCustomer}
        >
          Delete
        </button>

      </div>

    </div>

  </div>

)}

</div>
);
}

export default CustomerPage;