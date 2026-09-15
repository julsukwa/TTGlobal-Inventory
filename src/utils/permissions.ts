// ─── Permissions ─────────────────────────────────────────────────────────────
//
// Central map of which roles can view/edit each module of the app. Sidebar
// nav items (and, going forward, route guards / in-page controls) should
// check this rather than hardcoding role checks — see Sidebar.tsx for the
// current consumer.

export type UserRole = "ADMIN" | "STAFF_SALES" | "STAFF_WAREHOUSE" | "STAFF_WARRANTY";

export interface RoutePermission {
  canView: UserRole[];
  canEdit: UserRole[];
}

export const PERMISSIONS: Record<string, RoutePermission> = {
  dashboard:      { canView: ['ADMIN','STAFF_SALES','STAFF_WAREHOUSE','STAFF_WARRANTY'], canEdit: ['ADMIN'] },
  staff:          { canView: ['ADMIN'],                                                  canEdit: ['ADMIN'] },
  customers:      { canView: ['ADMIN','STAFF_SALES','STAFF_WAREHOUSE','STAFF_WARRANTY'], canEdit: ['ADMIN','STAFF_SALES'] },
  dropdowns:      { canView: ['ADMIN'],                                                  canEdit: ['ADMIN'] },
  shipments:      { canView: ['ADMIN','STAFF_SALES','STAFF_WAREHOUSE'],                  canEdit: ['ADMIN'] },
  stockIn:        { canView: ['ADMIN','STAFF_WAREHOUSE'],                                canEdit: ['ADMIN'] },
  stockOut:       { canView: ['ADMIN','STAFF_SALES'],                                    canEdit: ['ADMIN','STAFF_SALES'] },
  adjustments:    { canView: ['ADMIN','STAFF_WAREHOUSE'],                                canEdit: ['ADMIN','STAFF_WAREHOUSE'] },
  database:       { canView: ['ADMIN','STAFF_SALES','STAFF_WAREHOUSE','STAFF_WARRANTY'], canEdit: ['ADMIN'] },
  faultyStock:    { canView: ['ADMIN','STAFF_SALES','STAFF_WAREHOUSE','STAFF_WARRANTY'], canEdit: ['ADMIN','STAFF_WAREHOUSE'] },
  warranty:       { canView: ['ADMIN','STAFF_SALES','STAFF_WAREHOUSE','STAFF_WARRANTY'], canEdit: ['ADMIN','STAFF_WARRANTY'] },
};

export function canView(role: UserRole, module: string): boolean {
  return PERMISSIONS[module]?.canView.includes(role) ?? false;
}

export function canEdit(role: UserRole, module: string): boolean {
  return PERMISSIONS[module]?.canEdit.includes(role) ?? false;
}
