import "./ListNumberBadge.css";

export interface ListNumberBadgeProps {
  value?: string | null;
}

/** The blue pill used for a List Number wherever inventory rows are listed.
 * Empty or missing values render a plain "-" instead of an empty pill. */
export function ListNumberBadge({ value }: ListNumberBadgeProps) {
  const text = value?.trim();

  if (!text) return <span className="list-number-empty">-</span>;
  return <span className="list-number-badge">{text}</span>;
}
