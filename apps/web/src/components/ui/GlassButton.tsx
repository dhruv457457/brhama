"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "default" | "primary";
  size?: "sm" | "md" | "lg";
}

export function GlassButton({
  children,
  variant = "default",
  size = "md",
  className = "",
  ...props
}: GlassButtonProps) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-3 text-base",
  };

  const variantClass =
    variant === "primary" ? "glass-button-primary" : "glass-button";

  return (
    <button
      className={`${variantClass} ${sizeClasses[size]} font-medium ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
