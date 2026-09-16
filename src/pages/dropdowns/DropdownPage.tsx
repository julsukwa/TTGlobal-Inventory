// ─── Dropdown Management Page ───────────────────────────────────────────────
//
// Admin screen for managing the fixed value lists used throughout the system
// (Item Type, Fault, Vendor, Brand, RAM, Storage, Processor, Condition,
// Generation) — e.g. the category/condition options offered during Stock In.
// Backed entirely by the real /dropdowns API: all values are fetched on
// mount (for sidebar counts) and re-fetched per category on selection: add,
// edit, and active/inactive toggling all call through to the backend, which
// never hard-deletes a value. Each category is searched and paginated
// independently; switching category or searching resets to page 1.

import "./DropdownPage.css";
import { useEffect, useState } from "react";

import {
  Search,
  Plus,
  Pencil,
  Power,
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

import { apiFetch, ApiError } from "../../services/api";
import { StatusBadge } from "../../components/ui";

const DROPDOWN_CATEGORIES = [
  { id: "itemType", name: "Item Type" },
  { id: "fault", name: "Fault" },
  { id: "vendor", name: "Vendor" },
  { id: "brand", name: "Brand" },
  { id: "ram", name: "RAM" },
  { id: "storage", name: "Storage" },
  { id: "processor", name: "Processor" },
  { id: "condition", name: "Condition" },
  { id: "generation", name: "Generation" },
];

// Maps this page's local category ids to the `category` string the backend
// DropdownValue table stores (see backend/prisma/schema.prisma).
const BACKEND_CATEGORY: Record<string, string> = {
  itemType: "ItemType",
  fault: "Fault",
  vendor: "Vendor",
  brand: "Brand",
  ram: "RAM",
  storage: "Storage",
  processor: "Processor",
  condition: "Condition",
  generation: "Generation",
};

interface DropdownValue {
  id: number;
  name: string;
  dateAdded: string;
  isActive: boolean;
}

interface BackendDropdownValue {
  id: number;
  category: string;
  value: string;
  isActive: boolean;
  createdAt: string;
}

type DropdownData = {
  [key: string]: DropdownValue[];
};

function toDisplayValue(row: BackendDropdownValue): DropdownValue {
  return {
    id: row.id,
    name: row.value,
    dateAdded: new Date(row.createdAt).toLocaleDateString("en-GB"),
    isActive: row.isActive,
  };
}

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
  const [selectedCategory, setSelectedCategory] = useState("itemType");
  const [dropdownData, setDropdownData] = useState<DropdownData>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<DropdownValue | null>(null);
  const [valueName, setValueName] = useState("");
  const [valueError, setValueError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch every value once on mount so the sidebar can show a count per
  // category without a request per tab.
  useEffect(() => {
    let cancelled = false;

    apiFetch<BackendDropdownValue[]>("/dropdowns")
      .then((rows) => {
        if (cancelled) return;

        const grouped: DropdownData = {};
        for (const [localId, backendCategory] of Object.entries(BACKEND_CATEGORY)) {
          grouped[localId] = rows
            .filter((row) => row.category === backendCategory)
            .map(toDisplayValue);
        }

        setDropdownData((prev) => ({ ...prev, ...grouped }));
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Re-fetch the selected category's values whenever it changes, so the
  // list is always fresh rather than relying solely on the mount-time fetch.
  useEffect(() => {
    const backendCategory = BACKEND_CATEGORY[selectedCategory];
    if (!backendCategory) return;

    let cancelled = false;
    setCategoryLoading(true);

    apiFetch<BackendDropdownValue[]>(
      `/dropdowns?category=${encodeURIComponent(backendCategory)}`
    )
      .then((rows) => {
        if (cancelled) return;
        setDropdownData((prev) => ({
          ...prev,
          [selectedCategory]: rows.map(toDisplayValue),
        }));
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setCategoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCategory]);

  const currentValues = dropdownData[selectedCategory] || [];

  const filteredValues = currentValues.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredValues.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedValues = filteredValues.slice(startIndex, startIndex + itemsPerPage);

  const handleAddClick = () => {
    setEditingItem(null);
    setValueName("");
    setValueError(null);
    setShowModal(true);
  };

  const handleEditClick = (item: DropdownValue) => {
    setEditingItem(item);
    setValueName(item.name);
    setValueError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setValueError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  };

  const handleSave = async () => {
    const trimmedName = valueName.trim();

    if (!trimmedName) {
      setValueError("Value name cannot be empty.");
      return;
    }

    if (trimmedName.length > 50) {
      setValueError("Value name cannot exceed 50 characters.");
      return;
    }

    const backendCategory = BACKEND_CATEGORY[selectedCategory];
    setSaving(true);

    try {
      if (editingItem) {
        const updated = await apiFetch<BackendDropdownValue>(`/dropdowns/${editingItem.id}`, {
          method: "PATCH",
          body: JSON.stringify({ value: trimmedName }),
        });

        setDropdownData((prev) => ({
          ...prev,
          [selectedCategory]: prev[selectedCategory].map((item) =>
            item.id === editingItem.id ? toDisplayValue(updated) : item
          ),
        }));
      } else {
        const created = await apiFetch<BackendDropdownValue>("/dropdowns", {
          method: "POST",
          body: JSON.stringify({ category: backendCategory, value: trimmedName }),
        });

        setDropdownData((prev) => ({
          ...prev,
          [selectedCategory]: [...prev[selectedCategory], toDisplayValue(created)],
        }));
      }

      setValueError(null);
      setShowModal(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setValueError("This value already exists in this category");
      } else {
        setValueError(err instanceof Error ? err.message : "Failed to save value.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: DropdownValue) => {
    setActionError(null);
    const endpoint = item.isActive
      ? `/dropdowns/${item.id}/deactivate`
      : `/dropdowns/${item.id}/reactivate`;

    try {
      const updated = await apiFetch<BackendDropdownValue>(endpoint, { method: "PATCH" });

      setDropdownData((prev) => ({
        ...prev,
        [selectedCategory]: prev[selectedCategory].map((value) =>
          value.id === item.id ? toDisplayValue(updated) : value
        ),
      }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update status.");
    }
  };

  const getCategoryCount = (categoryId: string) => {
    return dropdownData[categoryId]?.length || 0;
  };

  return (
    <div className="dropdown-page">

      <div className="dropdown-header">
        <div>
          <h1>Dropdown Management</h1>
          <p>Manage all dropdown values used throughout the Inventory System.</p>
        </div>
      </div>

      <div className="dropdown-layout">

        {/* LEFT PANEL */}
        <div className="dropdown-sidebar">
          <div className="sidebar-title">Categories</div>

          {DROPDOWN_CATEGORIES.map((category) => (
            <button
              key={category.id}
              className={`category-btn ${
                selectedCategory === category.id ? "active-category" : ""
              }`}
              onClick={() => {
                setSelectedCategory(category.id);
                setCurrentPage(1);
                setActionError(null);
              }}
            >
              <div className="category-left">
                {categoryIcons[category.id as keyof typeof categoryIcons]}
                <span>{category.name}</span>
              </div>

              <span className="category-count">{getCategoryCount(category.id)}</span>
            </button>
          ))}
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
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="toolbar-actions">
              <button className="add-btn" onClick={handleAddClick}>
                <Plus size={16} />
                Add Value
              </button>
            </div>
          </div>

          {actionError && <p className="field-error">{actionError}</p>}

          <div className="table-card">
            <table className="dropdown-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Date Added</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading || categoryLoading ? (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      Loading...
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      Failed to load dropdown values: {loadError}
                    </td>
                  </tr>
                ) : filteredValues.length > 0 ? (
                  paginatedValues.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.dateAdded}</td>
                      <td>
                        <StatusBadge status={item.isActive ? "Active" : "Inactive"} />
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="edit-btn" onClick={() => handleEditClick(item)}>
                            <Pencil size={15} />
                          </button>
                          <button
                            className="edit-btn"
                            title={item.isActive ? "Deactivate" : "Reactivate"}
                            onClick={() => handleToggleActive(item)}
                          >
                            <Power size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      No values found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="dropdown-pagination">
              <span>
                Showing{" "}
                {filteredValues.length === 0 ? 0 : startIndex + 1}
                {" "}to{" "}
                {Math.min(startIndex + itemsPerPage, filteredValues.length)}
                {" "}of{" "}
                {filteredValues.length}
                {" "}entries
              </span>

              <div className="pagination-buttons">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  Previous
                </button>

                <span>
                  Page {currentPage} of {totalPages || 1}
                </span>

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
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
        <div className="modal-overlay" onClick={closeModal}>
          <div className="dropdown-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingItem ? "Edit Value" : "Add Value"}</h2>
              <button className="close-btn" onClick={closeModal}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Value Name</label>
                <input
                  type="text"
                  value={valueName}
                  onChange={(e) => {
                    setValueName(e.target.value);
                    setValueError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
                {valueError && (
                  <span className="field-error">
                    {valueError}
                  </span>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DropdownPage;
