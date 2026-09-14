// ─── Permissions ─────────────────────────────────────────────────────────────
//
// Central map of which roles can view/edit each module of the app. Sidebar
// nav items (and, going forward, route guards / in-page controls) should
// check this rather than hardcoding role checks — see Sidebar.tsx for the
// current consumer.

export type UserRole = "admin" | "sales" | "warehouse" | "warranty";

export interface RoutePermission {
  canView: UserRole[];
  canEdit: UserRole[];
}

export const PERMISSIONS: Record<string, RoutePermission> = {
  dashboard:      { canView: ['admin','sales','warehouse','warranty'], canEdit: ['admin'] },
  staff:          { canView: ['admin'],                                canEdit: ['admin'] },
  customers:      { canView: ['admin','sales','warehouse','warranty'], canEdit: ['admin','sales'] },
  dropdowns:      { canView: ['admin'],                                canEdit: ['admin'] },
  shipments:      { canView: ['admin','sales','warehouse'],            canEdit: ['admin'] },
  stockIn:        { canView: ['admin','warehouse'],                    canEdit: ['admin'] },
  stockOut:       { canView: ['admin','sales'],                        canEdit: ['admin','sales'] },
  adjustments:    { canView: ['admin','warehouse'],                    canEdit: ['admin','warehouse'] },
  database:       { canView: ['admin','sales','warehouse','warranty'], canEdit: ['admin'] },
  faultyStock:    { canView: ['admin','sales','warehouse','warranty'], canEdit: ['admin','warehouse'] },
  warranty:       { canView: ['admin','sales','warehouse','warranty'], canEdit: ['admin','warranty'] },
};

export function canView(role: UserRole, module: string): boolean {
  return PERMISSIONS[module]?.canView.includes(role) ?? false;
}

export function canEdit(role: UserRole, module: string): boolean {
  return PERMISSIONS[module]?.canEdit.includes(role) ?? false;
}
