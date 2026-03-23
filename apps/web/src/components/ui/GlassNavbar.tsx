"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "../wallet/ConnectButton";

export function GlassNavbar() {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Economy", icon: "E" },
    { href: "/permissions", label: "Permissions", icon: "P" },
    { href: "/faucet", label: "Faucet", icon: "$" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.04] bg-[#050510]/85 backdrop-blur-2xl">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500/25 to-teal-500/10 border border-purple-500/25 flex items-center justify-center group-hover:border-purple-500/40 transition-all group-hover:shadow-[0_0_20px_rgba(124,58,237,0.15)]">
              <span className="text-purple-400 font-black text-sm">V</span>
            </div>
            <div className="flex flex-col">
              <span className="font-black text-sm tracking-tight text-white/90 leading-none">
                Vela
              </span>
              <span className="text-[8px] text-white/15 font-mono tracking-wider leading-none mt-0.5">
                AI AGENT ECONOMY
              </span>
            </div>
          </Link>
          <div className="hidden sm:flex items-center gap-1">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? "bg-white/[0.06] text-white border border-white/[0.06]"
                      : "text-white/30 hover:text-white/60 hover:bg-white/[0.03]"
                  }`}
                >
                  {isActive && (
                    <span className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-8 h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent" />
                  )}
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <ConnectButton />
      </div>
    </nav>
  );
}
