import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  children: ReactNode;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  onClick,
  children,
  type = "button",
  fullWidth = false,
}: ButtonProps) {
  const className = [
    "ui-btn",
    `ui-btn-${variant}`,
    `ui-btn-${size}`,
    fullWidth ? "ui-btn-full" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={className} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
