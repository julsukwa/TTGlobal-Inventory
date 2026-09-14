import "./StatusBadge.css";

export interface StatusBadgeProps {
  status: string;
}

// Maps a lower-cased status value to its badge colour class. Add new
// statuses here as the system grows — anything not listed falls back to
// the neutral style below.
const STATUS_CLASS_MAP: Record<string, string> = {
  ok: "ui-status-success",
  complete: "ui-status-success",
  active: "ui-status-success",
  faulty: "ui-status-danger",
  pending: "ui-status-danger",
  inactive: "ui-status-danger",
  issued: "ui-status-issued",
  "in progress": "ui-status-warning",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const key = status.trim().toLowerCase();
  const statusClass = STATUS_CLASS_MAP[key] ?? "ui-status-neutral";

  return <span className={`ui-status-badge ${statusClass}`}>{status}</span>;
}
