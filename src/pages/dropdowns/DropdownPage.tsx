import "./DropdownPage.css";
import { useState } from "react";

import {
  Search,
  Plus,
  Pencil,
  X,
  Package,
  AlertTriangle,
  ShoppingBag,
  BadgeCheck,
  MemoryStick,
  Cpu,
  HardDrive,
  Sparkles,
  Layers,
} from "lucide-react";

import {
  dropdownCategories,
  dropdownValues,
  type DropdownValue,
} from "./mockDropdown";

type DropdownData = {
  [key: string]: DropdownValue[];
};

const categoryIcons = {
  itemType: <Package size={18} />,
  fault: <AlertTriangle size={18} />,
  vendor: <ShoppingBag size={18} />,
  brand: <BadgeCheck size={18} />,
  ram: <MemoryStick size={18} />,
  storage: <HardDrive size={18} />,
  processor: <Cpu size={18} />,
  condition: <Sparkles size={18} />,
  generation: <Layers size={18} />,
};

function DropdownPage() {
  const [selectedCategory, setSelectedCategory] =
    useState("itemType");

  const [dropdownData, setDropdownData] =
    useState<DropdownData>(
      dropdownValues as DropdownData
    );

  const [searchTerm, setSearchTerm] =
    useState("");

    const [currentPage, setCurrentPage] =
  useState(1);

    const itemsPerPage = 5;

  const [showModal, setShowModal] =
    useState(false);

  const [editingItem, setEditingItem] =
    useState<DropdownValue | null>(null);

  const [valueName, setValueName] =
    useState("");

  const currentValues =
    dropdownData[selectedCategory] || [];

  const filteredValues =
    currentValues.filter((item) =>
      item.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(
    filteredValues.length / itemsPerPage
    );

    const startIndex =
    (currentPage - 1) * itemsPerPage;

    const paginatedValues =
    filteredValues.slice(
        startIndex,
        startIndex + itemsPerPage
    );

  const handleAddClick = () => {
    setEditingItem(null);
    setValueName("");
    setShowModal(true);
  };

  const handleEditClick = (
    item: DropdownValue
  ) => {
    setEditingItem(item);
    setValueName(item.name);
    setShowModal(true);
  };

  const handleSave = () => {

    const trimmedName =
      valueName.trim();

    if (!trimmedName) {
      alert(
        "Value name cannot be empty."
      );
      return;
    }

    if (trimmedName.length > 50) {
      alert(
        "Value name cannot exceed 50 characters."
      );
      return;
    }

    const duplicate =
      currentValues.find(
        (item) =>
          item.name.toLowerCase() ===
            trimmedName.toLowerCase() &&
          item.id !==
            editingItem?.id
      );

    if (duplicate) {
      alert(
        `"${trimmedName}" already exists.`
      );
      return;
    }

    if (editingItem) {

      setDropdownData((prev) => ({
        ...prev,

        [selectedCategory]:
          prev[
            selectedCategory
          ].map((item) =>
            item.id === editingItem.id
              ? {
                  ...item,
                  name: trimmedName,
                }
              : item
          ),
      }));

    } else {

      const newItem: DropdownValue = {
        id: Date.now(),

        name: trimmedName,

        dateAdded:
          new Date().toLocaleDateString(
            "en-GB"
          ),
      };

      setDropdownData((prev) => ({
        ...prev,

        [selectedCategory]: [
          ...prev[selectedCategory],
          newItem,
        ],
      }));
    }

    setShowModal(false);
  };

  const getCategoryCount = (
    categoryId: string
  ) => {
    return (
      dropdownData[
        categoryId
      ]?.length || 0
    );
  };

    return (
    <div className="dropdown-page">

      <div className="dropdown-header">

        <div>
          <h1>Dropdown Management</h1>

          <p>
            Manage all dropdown values used
            throughout the Inventory System.
          </p>
        </div>

      </div>

      <div className="dropdown-layout">

        {/* LEFT PANEL */}

        <div className="dropdown-sidebar">

          <div className="sidebar-title">
            Categories
          </div>

          {dropdownCategories.map(
            (category) => (

              <button
                key={category.id}
                className={`category-btn ${
                    selectedCategory === category.id
                    ? "active-category"
                    : ""
                }`}
                onClick={() =>{
                    setSelectedCategory(category.id);
                    setCurrentPage(1);
                }}
                >

                <div className="category-left">

                    {
                    categoryIcons[
                        category.id as keyof typeof categoryIcons
                    ]
                    }

                    <span>
                    {category.name}
                    </span>

                </div>

                <span className="category-count">
                    {getCategoryCount(category.id)}
                </span>

                </button>
            )
          )}

        </div>

        {/* RIGHT PANEL */}

        <div className="dropdown-content">

          <div className="dropdown-toolbar">

            <div className="search-box">

              <Search size={16} />

              <input
                type="text"
                placeholder="Search value..."
                value={searchTerm}
                onChange={(e) =>{
                  setSearchTerm(
                    e.target.value
                  );
                  setCurrentPage(1);
                }}
              />

            </div>

            <div className="toolbar-actions">

              <button
                className="add-btn"
                onClick={
                  handleAddClick
                }
              >

                <Plus size={16} />

                Add Value

              </button>

            </div>

          </div>

          <div className="table-card">

            <table className="dropdown-table">

              <thead>

                <tr>

                  <th>Name</th>

                  <th>
                    Date Added
                  </th>

                  <th>
                    Actions
                  </th>

                </tr>

              </thead>

              <tbody>

                {filteredValues.length >
                0 ? (

                  paginatedValues.map(
                    (item) => (

                      <tr
                        key={item.id}
                      >

                        <td>
                          {item.name}
                        </td>

                        <td>
                          {
                            item.dateAdded
                          }
                        </td>

                        <td>

                          <div className="action-buttons">

                            <button
                              className="edit-btn"
                              onClick={() =>
                                handleEditClick(
                                  item
                                )
                              }
                            >
                              <Pencil
                                size={
                                  15
                                }
                              />
                            </button>

                          </div>

                        </td>

                      </tr>

                    )
                  )

                ) : (

                  <tr>

                    <td
                      colSpan={3}
                      className="empty-state"
                    >
                      No values found
                    </td>

                  </tr>

                )}

              </tbody>

            </table>

                <div className="dropdown-pagination">

            <span>
                Showing{" "}
                {filteredValues.length === 0
                ? 0
                : startIndex + 1}
                {" "}to{" "}
                {Math.min(
                startIndex +
                    itemsPerPage,
                filteredValues.length
                )}
                {" "}of{" "}
                {filteredValues.length}
                {" "}entries
            </span>

            <div className="pagination-buttons">

                <button
                disabled={
                    currentPage === 1
                }
                onClick={() =>
                    setCurrentPage(
                    currentPage - 1
                    )
                }
                >
                Previous
                </button>

                <span>
                Page {currentPage} of{" "}
                {totalPages || 1}
                </span>

                <button
                disabled={
                    currentPage ===
                    totalPages
                }
                onClick={() =>
                    setCurrentPage(
                    currentPage + 1
                    )
                }
                >
                Next
                </button>

            </div>

            </div>
          </div>

          
        </div>

      </div>

      {/* MODAL */}

      {showModal && (

        <div
          className="modal-overlay"
          onClick={() =>
            setShowModal(false)
          }
        >

          <div
            className="dropdown-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modal-header">

              <h2>
                {editingItem
                  ? "Edit Value"
                  : "Add Value"}
              </h2>

              <button
                className="close-btn"
                onClick={() =>
                  setShowModal(
                    false
                  )
                }
              >
                <X size={18} />
              </button>

            </div>

            <div className="modal-body">

              <div className="form-group">

                <label>
                  Value Name
                </label>

                <input
                  type="text"
                  value={valueName}
                  onChange={(e) =>
                    setValueName(
                      e.target.value
                    )
                  }
                  autoFocus
                />

              </div>

            </div>

            <div className="modal-footer">

              <button
                className="cancel-btn"
                onClick={() =>
                  setShowModal(
                    false
                  )
                }
              >
                Cancel
              </button>

              <button
                className="save-btn"
                onClick={handleSave}
              >
                Save
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default DropdownPage;