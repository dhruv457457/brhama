import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GlassNavbar } from "@/components/ui/GlassNavbar";
import { WalletBanner } from "@/components/wallet/WalletBanner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pact — AI Contributor Rewards Protocol",
  description:
    "AI agents that autonomously reward open source contributors via MetaMask ERC-7715 permissions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} glass-bg`}>
        <GlassNavbar />
        <WalletBanner />
        <main className="px-4 py-8 max-w-6xl mx-auto">{children}</main>
      </body>
    </html>
  );
}
