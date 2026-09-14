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
//     that row).
//   - New accounts are created with status "Active", dateCreated = today,
//     and lastLogin = "Never".
//   - Staff-role accounts can only view the stock list and download reports;
//     they cannot add users or update inventory (see the info banner below
//     and the note inside the Add Staff modal).
//   - Passwords are write-only — StaffMember never carries a password field,
//     and every password input uses type="password" so it is always masked.
//
// BACKEND INTEGRATION SEAM: see staffTypes.ts for the planned REST endpoints.
// Everything here runs against local state seeded from mockStaff.

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
import mockStaff from "./mockStaff";
import type { StaffMember } from "./staffTypes";

import { Modal, StatusBadge, SearchBar, Pagination, Button } from "../../components/ui";

type RoleFilter = "All" | StaffMember["role"];
type StatusFilterValue = "All" | StaffMember["status"];

const ITEMS_PER_PAGE = 5;

const blankAddForm = {
  fullName: "",
  username: "",
  password: "",
  confirmPassword: "",
  email: "",
  role: "sales" as StaffMember["role"],
};

type AddForm = typeof blankAddForm;
type AddFormErrors = Partial<Record<keyof AddForm, string>>;

const ROLE_LABELS: Record<StaffMember["role"], string> = {
  admin: "Admin",
  sales: "Sales",
  warehouse: "Warehouse",
  warranty: "Warranty",
};

const ROLE_BADGE_CLASSES: Record<StaffMember["role"], string> = {
  admin: "staff-role-admin",
  sales: "staff-role-sales",
  warehouse: "staff-role-warehouse",
  warranty: "staff-role-warranty",
};

/** Parses the mock "DD/MM/YYYY hh:mm AM/PM" lastLogin format into a Date for
 * comparison. Returns null for "Never" or anything else unparseable. */
function parseLastLogin(value: string): Date | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  const [, dd, mm, yyyy, hh, min, ampm] = match;
  let hour = Number(hh) % 12;
  if (ampm.toUpperCase() === "PM") hour += 12;

  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), hour, Number(min));
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>(mockStaff);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
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

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(blankAddForm);
  const [addFormErrors, setAddFormErrors] = useState<AddFormErrors>({});

  const [passwordTarget, setPasswordTarget] = useState<StaffMember | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<{
    newPassword?: string;
    confirmNewPassword?: string;
  }>({});

  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    role: "sales" as StaffMember["role"],
  });

  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);

  // ── Summary figures ──────────────────────────────────────────────────────

  const activeCount = staff.filter((s) => s.status === "Active").length;
  const inactiveCount = staff.filter((s) => s.status === "Inactive").length;

  const mostRecentLogin = useMemo(() => {
    const parsedActiveLogins = staff
      .filter((s) => s.status === "Active")
      .map((s) => ({ raw: s.lastLogin, parsed: parseLastLogin(s.lastLogin) }))
      .filter((entry): entry is { raw: string; parsed: Date } => entry.parsed !== null);

    if (parsedActiveLogins.length === 0) return "Never";

    return parsedActiveLogins.reduce((latest, entry) =>
      entry.parsed > latest.parsed ? entry : latest
    ).raw;
  }, [staff]);

  // ── Search / filter / pagination ─────────────────────────────────────────

  const filteredStaff = staff.filter((member) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      member.fullName.toLowerCase().includes(search) ||
      member.username.toLowerCase().includes(search);
    const matchesRole = roleFilter === "All" || member.role === roleFilter;
    const matchesStatus = statusFilter === "All" || member.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedStaff = filteredStaff.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => setCurrentPage(page);

  // ── Add staff ────────────────────────────────────────────────────────────

  const openAddModal = () => {
    setAddForm(blankAddForm);
    setAddFormErrors({});
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setAddFormErrors({});
  };

  const updateAddForm = (field: keyof AddForm, value: string) => {
    setAddForm((prev) => ({ ...prev, [field]: value }));
    setAddFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleCreateStaff = () => {
    const errors: AddFormErrors = {};

    if (!addForm.fullName.trim()) errors.fullName = "Full name is required.";

    if (!addForm.username.trim()) {
      errors.username = "Username is required.";
    } else if (
      staff.some(
        (s) => s.username.toLowerCase() === addForm.username.trim().toLowerCase()
      )
    ) {
      errors.username = "This username is already taken.";
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

    const newStaffMember: StaffMember = {
      id: Date.now(),
      fullName: addForm.fullName.trim(),
      username: addForm.username.trim(),
      role: addForm.role,
      status: "Active",
      email: addForm.email.trim(),
      lastLogin: "Never",
      dateCreated: new Date().toLocaleDateString("en-GB"),
    };

    setStaff((prev) => [newStaffMember, ...prev]);
    closeAddModal();
  };

  // ── Change password ──────────────────────────────────────────────────────

  const openPasswordModal = (member: StaffMember) => {
    setPasswordTarget(member);
    setNewPassword("");
    setConfirmNewPassword("");
    setPasswordErrors({});
    setOpenMenuId(null);
  };

  const closePasswordModal = () => {
    setPasswordTarget(null);
    setPasswordErrors({});
  };

  const handleUpdatePassword = () => {
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

    // BACKEND INTEGRATION SEAM: PATCH /staff/:id/password { password }
    // The password itself is never kept in local state — this mock simply
    // confirms the update and closes the modal.
    closePasswordModal();
  };

  // ── Edit staff ───────────────────────────────────────────────────────────

  const openEditModal = (member: StaffMember) => {
    setEditingStaff(member);
    setEditForm({ fullName: member.fullName, email: member.email, role: member.role });
    setOpenMenuId(null);
  };

  const closeEditModal = () => setEditingStaff(null);

  const handleSaveEdit = () => {
    if (!editingStaff) return;

    setStaff((prev) =>
      prev.map((s) =>
        s.id === editingStaff.id
          ? {
              ...s,
              fullName: editForm.fullName.trim(),
              email: editForm.email.trim(),
              role: editForm.role,
            }
          : s
      )
    );
    closeEditModal();
  };

  // ── Activate / deactivate / delete ───────────────────────────────────────

  const toggleActive = (member: StaffMember) => {
    if (member.username === "admin") return; // protected account — defence in depth
    setStaff((prev) =>
      prev.map((s) =>
        s.id === member.id
          ? { ...s, status: s.status === "Active" ? "Inactive" : "Active" }
          : s
      )
    );
    setOpenMenuId(null);
  };

  const confirmDeleteStaff = () => {
    if (!staffToDelete) return;
    setStaff((prev) => prev.filter((s) => s.id !== staffToDelete.id));
    setStaffToDelete(null);
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
              <option value="admin">Admin</option>
              <option value="sales">Sales</option>
              <option value="warehouse">Warehouse</option>
              <option value="warranty">Warranty</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilterValue);
                setCurrentPage(1);
              }}
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
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
              {paginatedStaff.length === 0 ? (
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
                      <StatusBadge status={member.status} />
                    </td>
                    <td className="staff-muted-cell">{member.lastLogin}</td>
                    <td className="staff-muted-cell">{member.dateCreated}</td>
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
                              onClick={() =>
                                setOpenMenuId(openMenuId === member.id ? null : member.id)
                              }
                            >
                              <MoreVertical size={14} />
                            </button>

                            {openMenuId === member.id && (
                              <div className="staff-row-menu">
                                <button onClick={() => toggleActive(member)}>
                                  {member.status === "Active" ? "Deactivate" : "Activate"}
                                </button>
                                <button
                                  className="staff-menu-danger"
                                  onClick={() => {
                                    setStaffToDelete(member);
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
              <option value="sales">Sales</option>
              <option value="warehouse">Warehouse</option>
              <option value="warranty">Warranty</option>
              <option value="admin">Admin</option>
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

        <div className="modal-actions">
          <Button variant="secondary" onClick={closeAddModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreateStaff}>
            Create Staff
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
                />
                {passwordErrors.confirmNewPassword && (
                  <span className="field-error">{passwordErrors.confirmNewPassword}</span>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <Button variant="secondary" onClick={closePasswordModal}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleUpdatePassword}>
                Update Password
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
                />
              </div>

              <div className="form-field">
                <label>Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      role: e.target.value as StaffMember["role"],
                    }))
                  }
                >
                  <option value="sales">Sales</option>
                  <option value="warehouse">Warehouse</option>
                  <option value="warranty">Warranty</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="modal-actions">
              <Button variant="secondary" onClick={closeEditModal}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Delete confirmation modal ─────────────────────────────────────── */}
      <Modal
        isOpen={staffToDelete !== null}
        onClose={() => setStaffToDelete(null)}
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

            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setStaffToDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDeleteStaff}>
                Delete
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
