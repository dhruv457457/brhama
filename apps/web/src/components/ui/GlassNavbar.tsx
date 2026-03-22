"use client";

import Link from "next/link";
import { ConnectButton } from "../wallet/ConnectButton";

export function GlassNavbar() {
  return (
    <nav className="glass-card-sm sticky top-4 mx-4 mt-4 z-50 flex items-center justify-between px-6 py-3">
      <div className="flex items-center gap-8">
        <Link href="/" className="text-xl font-bold tracking-tight">
          <span className="text-purple-400">P</span>act
        </Link>
        <div className="hidden sm:flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/permissions"
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            Permissions
          </Link>
          <Link
            href="/contributor"
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            Profile
          </Link>
        </div>
      </div>
      <ConnectButton />
    </nav>
  );
}
