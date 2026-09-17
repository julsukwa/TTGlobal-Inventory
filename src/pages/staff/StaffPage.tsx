// ─── Staff Management Page ───────────────────────────────────────────────────
//
// Admin-only screen for managing system user accounts (distinct from
// Customers — these are people who log into TT Global Inventory itself).
// Supports creating accounts, changing passwords, editing profile/role, and
// activating/deactivating or deleting accounts.
//
// Business rules:
//   - The username "admin" is the protected system administrator account —
//     it can never be deactivated or deleted (those options are hidden for
//     that row, and the backend also rejects it with 403 defense-in-depth).
//   - Passwords are write-only — StaffMember never carries a password field,
//     and every password input uses type="password" so it is always masked.
//
// Backed by the real /staff API. Search is server-side (debounced); role and
// status filters are applied client-side on top of the fetched list.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Users,
  UserCheck,
  UserX,
  Clock,
  Key,
  Pencil,
  MoreVertical,
  Info,
} from "lucide-react";

import "./StaffPage.css";
import type { StaffMember, StaffRole } from "./staffTypes";
import { apiFetch } from "../../services/api";

import { Modal, StatusBadge, SearchBar, Pagination, Button } from "../../components/ui";

type RoleFilter = "All" | StaffRole;
type StatusFilterValue = "All" | StaffMember["status"];

const ITEMS_PER_PAGE = 5;

const blankAddForm = {
  fullName: "",
  username: "",
  password: "",
  confirmPassword: "",
  email: "",
  role: "STAFF_SALES" as StaffRole,
};

type AddForm = typeof blankAddForm;
type AddFormErrors = Partial<Record<keyof AddForm, string>>;

const ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: "Admin",
  STAFF_SALES: "Sales",
  STAFF_WAREHOUSE: "Warehouse",
  STAFF_WARRANTY: "Warranty",
};

const ROLE_BADGE_CLASSES: Record<StaffRole, string> = {
  ADMIN: "staff-role-admin",
  STAFF_SALES: "staff-role-sales",
  STAFF_WAREHOUSE: "staff-role-warehouse",
  STAFF_WARRANTY: "staff-role-warranty",
};

const STATUS_LABELS: Record<StaffMember["status"], string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

function formatDateTime(d: Date): string {
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)} ${hours}:${minutes}`;
}

function formatLastLogin(lastLogin: string | null): string {
  return lastLogin ? formatDateTime(new Date(lastLogin)) : "Never";
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const openMenuRef = useRef<HTMLDivElement>(null);

  // Close the open three-dot menu on any click outside it. The ref is
  // attached only to the currently-open row's menu wrapper (see the
  // .staff-menu-wrapper below), so this only ever tracks one element at a
  // time — the standard outside-click pattern for a dropdown with no
  // external library.
  useEffect(() => {
    if (openMenuId === null) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (openMenuRef.current && !openMenuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  // Fetches on mount (searchTerm starts empty) and again, debounced, whenever
  // the search box changes — the backend matches fullName/username.
  useEffect(() => {
    let cancelled = false;

    const timeoutId = setTimeout(() => {
      setLoading(true);
      setError(null);

      const query = searchTerm.trim();
      const endpoint = query ? `/staff?search=${encodeURIComponent(query)}` : "/staff";

      apiFetch<StaffMember[]>(endpoint)
        .then((data) => {
          if (!cancelled) setStaff(data);
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

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(blankAddForm);
  const [addFormErrors, setAddFormErrors] = useState<AddFormErrors>({});
  const [addApiError, setAddApiError] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);

  const [passwordTarget, setPasswordTarget] = useState<StaffMember | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<{
    newPassword?: string;
    confirmNewPassword?: string;
  }>({});
  const [passwordApiError, setPasswordApiError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    role: "STAFF_SALES" as StaffRole,
  });
  const [editApiError, setEditApiError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [deleteApiError, setDeleteApiError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Summary figures ──────────────────────────────────────────────────────

  const activeCount = staff.filter((s) => s.status === "ACTIVE").length;
  const inactiveCount = staff.filter((s) => s.status === "INACTIVE").length;

  const mostRecentLogin = useMemo(() => {
    const activeLogins = staff
      .filter((s) => s.status === "ACTIVE" && s.lastLogin)
      .map((s) => new Date(s.lastLogin as string));

    if (activeLogins.length === 0) return "Never";

    const latest = activeLogins.reduce((a, b) => (b > a ? b : a));
    return formatDateTime(latest);
  }, [staff]);

  // ── Search / filter / pagination ─────────────────────────────────────────
  // Search is already applied server-side (see the fetch effect above) —
  // this only narrows the fetched list by the client-side role/status filters.

  const filteredStaff = staff.filter((member) => {
    const matchesRole = roleFilter === "All" || member.role === roleFilter;
    const matchesStatus = statusFilter === "All" || member.status === statusFilter;
    return matchesRole && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedStaff = filteredStaff.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => setCurrentPage(page);

  // ── Add staff ────────────────────────────────────────────────────────────

  const openAddModal = () => {
    setAddForm(blankAddForm);
    setAddFormErrors({});
    setAddApiError(null);
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setAddFormErrors({});
    setAddApiError(null);
  };

  const updateAddForm = (field: keyof AddForm, value: string) => {
    setAddForm((prev) => ({ ...prev, [field]: value }));
    setAddFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleCreateStaff = async () => {
    const errors: AddFormErrors = {};

    if (!addForm.fullName.trim()) errors.fullName = "Full name is required.";

    if (!addForm.username.trim()) {
      errors.username = "Username is required.";
    }

    if (!addForm.password) {
      errors.password = "Password is required.";
    } else if (addForm.password.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    }

    if (!addForm.confirmPassword) {
      errors.confirmPassword = "Please confirm the password.";
    } else if (addForm.confirmPassword !== addForm.password) {
      errors.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(errors).length > 0) {
      setAddFormErrors(errors);
      return;
    }

    setAddSaving(true);
    setAddApiError(null);

    try {
      const created = await apiFetch<StaffMember>("/staff", {
        method: "POST",
        body: JSON.stringify({
          fullName: addForm.fullName.trim(),
          username: addForm.username.trim(),
          password: addForm.password,
          role: addForm.role,
          email: addForm.email.trim(),
        }),
      });

      setStaff((prev) => [created, ...prev]);
      closeAddModal();
    } catch (err) {
      setAddApiError(err instanceof Error ? err.message : "Failed to create staff member.");
    } finally {
      setAddSaving(false);
    }
  };

  const handleAddStaffKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateStaff();
    }
  };

  // ── Change password ──────────────────────────────────────────────────────

  const openPasswordModal = (member: StaffMember) => {
    setPasswordTarget(member);
    setNewPassword("");
    setConfirmNewPassword("");
    setPasswordErrors({});
    setPasswordApiError(null);
    setOpenMenuId(null);
  };

  const closePasswordModal = () => {
    setPasswordTarget(null);
    setPasswordErrors({});
    setPasswordApiError(null);
  };

  const handleUpdatePassword = async () => {
    if (!passwordTarget) return;

    const errors: { newPassword?: string; confirmNewPassword?: string } = {};

    if (!newPassword) {
      errors.newPassword = "New password is required.";
    } else if (newPassword.length < 6) {
      errors.newPassword = "Password must be at least 6 characters.";
    }

    if (!confirmNewPassword) {
      errors.confirmNewPassword = "Please confirm the new password.";
    } else if (confirmNewPassword !== newPassword) {
      errors.confirmNewPassword = "Passwords do not match.";
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setPasswordSaving(true);
    setPasswordApiError(null);

    try {
      await apiFetch(`/staff/${passwordTarget.id}/change-password`, {
        method: "PATCH",
        body: JSON.stringify({ newPassword }),
      });
      closePasswordModal();
    } catch (err) {
      setPasswordApiError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handlePasswordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleUpdatePassword();
    }
  };

  // ── Edit staff ───────────────────────────────────────────────────────────

  const openEditModal = (member: StaffMember) => {
    setEditingStaff(member);
    setEditForm({ fullName: member.fullName, email: member.email ?? "", role: member.role });
    setEditApiError(null);
    setOpenMenuId(null);
  };

  const closeEditModal = () => {
    setEditingStaff(null);
    setEditApiError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingStaff) return;

    setEditSaving(true);
    setEditApiError(null);

    try {
      const updated = await apiFetch<StaffMember>(`/staff/${editingStaff.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: editForm.fullName.trim(),
          email: editForm.email.trim(),
          role: editForm.role,
        }),
      });
      setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      closeEditModal();
    } catch (err) {
      setEditApiError(err instanceof Error ? err.message : "Failed to update staff member.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveEdit();
    }
  };

  // ── Activate / deactivate / delete ───────────────────────────────────────

  const toggleActive = async (member: StaffMember) => {
    if (member.username === "admin") return; // protected account — defence in depth
    setOpenMenuId(null);
    setTogglingId(member.id);
    setActionError(null);

    try {
      const updated = await apiFetch<StaffMember>(`/staff/${member.id}/toggle-status`, {
        method: "PATCH",
      });
      setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update staff member's status."
      );
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDeleteStaff = async () => {
    if (!staffToDelete) return;

    setDeleting(true);
    setDeleteApiError(null);

    try {
      await apiFetch(`/staff/${staffToDelete.id}`, { method: "DELETE" });
      setStaff((prev) => prev.filter((s) => s.id !== staffToDelete.id));
      setStaffToDelete(null);
    } catch (err) {
      setDeleteApiError(err instanceof Error ? err.message : "Failed to delete staff member.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="staff-page">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="staff-header">
        <div>
          <h1>Staff Management</h1>
          <p>Manage system users, their access credentials and session information.</p>
        </div>
        <Button variant="primary" onClick={openAddModal}>
          <Plus size={16} />
          Add New Staff
        </Button>
      </div>

      {actionError && <p className="field-error">{actionError}</p>}

      {/* ── Summary strip ─────────────────────────────────────────────────── */}
      <div className="staff-summary-strip">
        <div className="staff-summary-item">
          <div className="staff-summary-icon staff-icon-blue">
            <Users size={16} />
          </div>
          <div>
            <span>Total Staff</span>
            <h3>{staff.length}</h3>
          </div>
        </div>

        <div className="staff-summary-item">
          <div className="staff-summary-icon staff-icon-green">
            <UserCheck size={16} />
          </div>
          <div>
            <span>Active Users</span>
            <h3>{activeCount}</h3>
          </div>
        </div>

        <div className="staff-summary-item">
          <div className="staff-summary-icon staff-icon-red">
            <UserX size={16} />
          </div>
          <div>
            <span>Inactive Accounts</span>
            <h3>{inactiveCount}</h3>
          </div>
        </div>

        <div className="staff-summary-item">
          <div className="staff-summary-icon staff-icon-indigo">
            <Clock size={16} />
          </div>
          <div>
            <span>Last Login</span>
            <h3 className="staff-last-login-value">{mostRecentLogin}</h3>
          </div>
        </div>
      </div>

      {/* ── Staff table ───────────────────────────────────────────────────── */}
      <div className="staff-table-card">
        <div className="staff-toolbar">
          <SearchBar
            value={searchTerm}
            onChange={(value) => {
              setSearchTerm(value);
              setCurrentPage(1);
            }}
            placeholder="Search by full name or username..."
            width={320}
          />

          <div className="staff-toolbar-filters">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value as RoleFilter);
                setCurrentPage(1);
              }}
            >
              <option value="All">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="STAFF_SALES">Sales</option>
              <option value="STAFF_WAREHOUSE">Warehouse</option>
              <option value="STAFF_WARRANTY">Warranty</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilterValue);
                setCurrentPage(1);
              }}
            >
              <option value="All">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Full Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Email</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Date Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="staff-empty-row">
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="staff-empty-row">
                    Failed to load staff: {error}
                  </td>
                </tr>
              ) : paginatedStaff.length === 0 ? (
                <tr>
                  <td colSpan={9} className="staff-empty-row">
                    No staff members found.
                  </td>
                </tr>
              ) : (
                paginatedStaff.map((member, index) => (
                  <tr key={member.id}>
                    <td>{startIndex + index + 1}</td>
                    <td className="staff-name-cell">{member.fullName}</td>
                    <td>{member.username}</td>
                    <td>
                      <span className={`staff-role-badge ${ROLE_BADGE_CLASSES[member.role]}`}>
                        {ROLE_LABELS[member.role]}
                      </span>
                    </td>
                    <td>{member.email || "—"}</td>
                    <td>
                      <StatusBadge status={STATUS_LABELS[member.status]} />
                    </td>
                    <td className="staff-muted-cell">{formatLastLogin(member.lastLogin)}</td>
                    <td className="staff-muted-cell">{formatDate(new Date(member.createdAt))}</td>
                    <td>
                      <div className="staff-actions">
                        <button
                          className="staff-action-btn"
                          title="Change Password"
                          onClick={() => openPasswordModal(member)}
                        >
                          <Key size={14} />
                        </button>
                        <button
                          className="staff-action-btn"
                          title="Edit Staff"
                          onClick={() => openEditModal(member)}
                        >
                          <Pencil size={14} />
                        </button>

                        {member.username !== "admin" && (
                          <div
                            className="staff-menu-wrapper"
                            ref={openMenuId === member.id ? openMenuRef : undefined}
                          >
                            <button
                              className="staff-action-btn"
                              title="More actions"
                              disabled={togglingId === member.id}
                              onClick={() =>
                                setOpenMenuId(openMenuId === member.id ? null : member.id)
                              }
                            >
                              <MoreVertical size={14} />
                            </button>

                            {openMenuId === member.id && (
                              <div className="staff-row-menu">
                                <button onClick={() => toggleActive(member)}>
                                  {member.status === "ACTIVE" ? "Deactivate" : "Activate"}
                                </button>
                                <button
                                  className="staff-menu-danger"
                                  onClick={() => {
                                    setStaffToDelete(member);
                                    setDeleteApiError(null);
                                    setOpenMenuId(null);
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="staff-footer">
          <span>
            Showing {filteredStaff.length === 0 ? 0 : startIndex + 1}–
            {Math.min(startIndex + ITEMS_PER_PAGE, filteredStaff.length)} of{" "}
            {filteredStaff.length} entries
          </span>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* ── Permissions info banner ───────────────────────────────────────── */}
      <div className="staff-info-banner">
        <Info size={18} className="staff-info-icon" />
        <p>
          Staff users have role-based access. Sales staff can manage
          customers and process stock out. Warehouse staff can manage stock
          in and adjustments. Warranty staff can manage warranty returns.
          Contact an administrator to change access levels.
        </p>
      </div>

      {/* ── Add New Staff modal ───────────────────────────────────────────── */}
      <Modal isOpen={showAddModal} onClose={closeAddModal} title="Add New Staff" width={520}>
        <div className="staff-form-grid">
          <div className="form-field">
            <label>Full Name *</label>
            <input
              type="text"
              value={addForm.fullName}
              onChange={(e) => updateAddForm("fullName", e.target.value)}
            />
            {addFormErrors.fullName && (
              <span className="field-error">{addFormErrors.fullName}</span>
            )}
          </div>

          <div className="form-field">
            <label>Username *</label>
            <input
              type="text"
              value={addForm.username}
              onChange={(e) => updateAddForm("username", e.target.value)}
            />
            {addFormErrors.username && (
              <span className="field-error">{addFormErrors.username}</span>
            )}
          </div>

          <div className="form-field">
            <label>Password *</label>
            <input
              type="password"
              value={addForm.password}
              onChange={(e) => updateAddForm("password", e.target.value)}
            />
            {addFormErrors.password && (
              <span className="field-error">{addFormErrors.password}</span>
            )}
          </div>

          <div className="form-field">
            <label>Confirm Password *</label>
            <input
              type="password"
              value={addForm.confirmPassword}
              onChange={(e) => updateAddForm("confirmPassword", e.target.value)}
              onKeyDown={handleAddStaffKeyDown}
            />
            {addFormErrors.confirmPassword && (
              <span className="field-error">{addFormErrors.confirmPassword}</span>
            )}
          </div>

          <div className="form-field">
            <label>Email</label>
            <input
              type="email"
              value={addForm.email}
              onChange={(e) => updateAddForm("email", e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Role</label>
            <select
              value={addForm.role}
              onChange={(e) => updateAddForm("role", e.target.value)}
            >
              <option value="STAFF_SALES">Sales</option>
              <option value="STAFF_WAREHOUSE">Warehouse</option>
              <option value="STAFF_WARRANTY">Warranty</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>

        <div className="staff-permissions-note">
          <Info size={16} />
          <p>
            Staff users have role-based access. Sales staff can manage
            customers and process stock out. Warehouse staff can manage
            stock in and adjustments. Warranty staff can manage warranty
            returns. Contact an administrator to change access levels.
          </p>
        </div>

        {addApiError && <p className="field-error">{addApiError}</p>}

        <div className="modal-actions">
          <Button variant="secondary" onClick={closeAddModal} disabled={addSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreateStaff} disabled={addSaving}>
            {addSaving ? "Creating..." : "Create Staff"}
          </Button>
        </div>
      </Modal>

      {/* ── Change Password modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={passwordTarget !== null}
        onClose={closePasswordModal}
        title="Change Password"
        width={420}
      >
        {passwordTarget && (
          <>
            <p className="staff-modal-subtitle">
              Set a new password for <strong>{passwordTarget.fullName}</strong>{" "}
              ({passwordTarget.username}).
            </p>

            <div className="staff-form-grid staff-form-grid-single">
              <div className="form-field">
                <label>New Password *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPasswordErrors((prev) => ({ ...prev, newPassword: undefined }));
                  }}
                />
                {passwordErrors.newPassword && (
                  <span className="field-error">{passwordErrors.newPassword}</span>
                )}
              </div>

              <div className="form-field">
                <label>Confirm New Password *</label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => {
                    setConfirmNewPassword(e.target.value);
                    setPasswordErrors((prev) => ({ ...prev, confirmNewPassword: undefined }));
                  }}
                  onKeyDown={handlePasswordKeyDown}
                />
                {passwordErrors.confirmNewPassword && (
                  <span className="field-error">{passwordErrors.confirmNewPassword}</span>
                )}
              </div>
            </div>

            {passwordApiError && <p className="field-error">{passwordApiError}</p>}

            <div className="modal-actions">
              <Button variant="secondary" onClick={closePasswordModal} disabled={passwordSaving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleUpdatePassword} disabled={passwordSaving}>
                {passwordSaving ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Edit Staff modal ──────────────────────────────────────────────── */}
      <Modal
        isOpen={editingStaff !== null}
        onClose={closeEditModal}
        title="Edit Staff"
        width={480}
      >
        {editingStaff && (
          <>
            <div className="staff-form-grid staff-form-grid-single">
              <div className="form-field">
                <label>Username</label>
                <input type="text" value={editingStaff.username} disabled />
                <small>Usernames cannot be changed.</small>
              </div>

              <div className="form-field">
                <label>Full Name</label>
                <input
                  type="text"
                  value={editForm.fullName}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, fullName: e.target.value }))
                  }
                />
              </div>

              <div className="form-field">
                <label>Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  onKeyDown={handleEditKeyDown}
                />
              </div>

              <div className="form-field">
                <label>Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      role: e.target.value as StaffRole,
                    }))
                  }
                >
                  <option value="STAFF_SALES">Sales</option>
                  <option value="STAFF_WAREHOUSE">Warehouse</option>
                  <option value="STAFF_WARRANTY">Warranty</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>

            {editApiError && <p className="field-error">{editApiError}</p>}

            <div className="modal-actions">
              <Button variant="secondary" onClick={closeEditModal} disabled={editSaving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveEdit} disabled={editSaving}>
                {editSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Delete confirmation modal ─────────────────────────────────────── */}
      <Modal
        isOpen={staffToDelete !== null}
        onClose={() => {
          setStaffToDelete(null);
          setDeleteApiError(null);
        }}
        title="Delete Staff Member"
        width={420}
      >
        {staffToDelete && (
          <>
            <p>
              Are you sure you want to delete{" "}
              <strong>{staffToDelete.fullName}</strong> ({staffToDelete.username})?
            </p>
            <p className="staff-modal-subtitle">This action cannot be undone.</p>

            {deleteApiError && <p className="field-error">{deleteApiError}</p>}

            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setStaffToDelete(null);
                  setDeleteApiError(null);
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDeleteStaff} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
