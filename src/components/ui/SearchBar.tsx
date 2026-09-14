import type { ChangeEvent } from "react";
import { Search } from "lucide-react";
import "./SearchBar.css";

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  width?: number | string;
}

export function SearchBar({ value, onChange, placeholder, width }: SearchBarProps) {
  const resolvedWidth = typeof width === "number" ? `${width}px` : width;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="ui-search-bar" style={width ? { width: resolvedWidth } : undefined}>
      <Search size={16} className="ui-search-icon" />
      <input
        type="text"
        className="ui-search-input"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
      />
    </div>
  );
}
