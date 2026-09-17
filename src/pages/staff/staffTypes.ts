// ─── Staff — core types ──────────────────────────────────────────────────────
//
// A StaffMember represents a system user account (not a customer or vendor
// contact). Role determines access — see src/utils/permissions.ts for exactly
// which modules each role can view/edit, and the permissions banner on
// StaffPage for the wording shown to admins.
//
// The username "admin" is treated as the protected system administrator
// account throughout StaffPage — it cannot be deactivated or deleted.
//
// Passwords are never stored or displayed here — this type intentionally has
// no password field. The UI only ever collects a new password (masked,
// type="password") to send onward; it is never read back.
//
// Matches the shape returned by GET /staff and GET /staff/:id.

export type StaffRole = "ADMIN" | "STAFF_SALES" | "STAFF_WAREHOUSE" | "STAFF_WARRANTY";

export interface StaffMember {
  id: number;
  fullName: string;
  username: string;
  role: StaffRole;
  status: "ACTIVE" | "INACTIVE";
  email: string | null;
  lastLogin: string | null; // ISO datetime string, or null if never logged in
  createdAt: string; // ISO datetime string
}
