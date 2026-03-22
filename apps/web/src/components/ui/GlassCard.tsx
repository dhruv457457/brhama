"use client";

import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  small?: boolean;
}

export function GlassCard({ children, className = "", small }: GlassCardProps) {
  return (
    <div className={`${small ? "glass-card-sm" : "glass-card"} p-6 ${className}`}>
      {children}
    </div>
  );
}
