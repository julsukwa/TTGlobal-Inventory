// ─── Staff — core types ──────────────────────────────────────────────────────
//
// A StaffMember represents a system user account (not a customer or vendor
// contact). Role determines access: "admin" accounts can manage staff,
// inventory and settings; "sales", "warehouse" and "warranty" are scoped,
// non-admin roles — see src/utils/permissions.ts for exactly which modules
// each role can view/edit, and the permissions banner on StaffPage for the
// wording shown to admins.
//
// The username "admin" is treated as the protected system administrator
// account throughout StaffPage — it cannot be deactivated or deleted.
//
// Passwords are never stored or displayed here — this type intentionally has
// no password field. The UI only ever collects a new password (masked,
// type="password") to send onward; it is never read back.
//
// BACKEND INTEGRATION SEAM:
//   GET    /staff               → list all staff accounts
//   POST   /staff                → create account, returns StaffMember
//   PATCH  /staff/:id            → update fullName/email/role
//   PATCH  /staff/:id/status     → activate/deactivate
//   PATCH  /staff/:id/password   → set a new password (write-only)
//   DELETE /staff/:id            → remove account

export interface StaffMember {
  id: number;
  fullName: string;
  username: string;
  role: "admin" | "sales" | "warehouse" | "warranty";
  status: "Active" | "Inactive";
  email: string; // optional, may be empty string
  lastLogin: string; // display string e.g. '12/06/2026 10:24 AM' or 'Never'
  dateCreated: string; // display string e.g. '01/05/2026'
}
