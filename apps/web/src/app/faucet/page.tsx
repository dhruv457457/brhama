"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWalletStore } from "@/store/walletStore";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { ONCHAIN_SERVICE_URL } from "@/lib/constants";
import Link from "next/link";

const AGENT_SMART_ACCOUNT = "0xE6a2551c175f8FcCDaeA49D02AdF9d4f4C6e849a";
const USDC_ADDRESS = "0x38cFa1c54105d5382e4F3689af819116977A40Ce";

const PRESET_AMOUNTS = [500, 1000, 2000, 3000, 5000];

export default function FaucetPage() {
  const { address } = useWalletStore();
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("1000");
  const [minting, setMinting] = useState(false);
  const [result, setResult] = useState<{ txHash: string; amount: number } | null>(null);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<string | null>(null);
  const [agentBalance, setAgentBalance] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Auto-fill connected wallet
  useEffect(() => {
    if (address && !toAddress) setToAddress(address);
  }, [address, toAddress]);

  const fetchBalances = useCallback(async () => {
    setLoadingBalance(true);
    try {
      const target = toAddress || address;
      if (target) {
        const res = await fetch(`${ONCHAIN_SERVICE_URL}/api/permissions/balance/${target}`);
        if (res.ok) {
          const data = await res.json();
          setBalance(data.balance);
        }
      }
      // Agent balance
      const agentRes = await fetch(`${ONCHAIN_SERVICE_URL}/api/permissions/balance/${AGENT_SMART_ACCOUNT}`);
      if (agentRes.ok) {
        const data = await agentRes.json();
        setAgentBalance(data.balance);
      }
    } catch {} finally {
      setLoadingBalance(false);
    }
  }, [toAddress, address]);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  async function handleMint() {
    if (!toAddress) {
      setError("Enter a wallet address");
      return;
    }
    setMinting(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`${ONCHAIN_SERVICE_URL}/api/permissions/faucet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toAddress, amount: parseFloat(amount) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Mint failed");
      }

      const data = await res.json();
      setResult({ txHash: data.txHash, amount: data.amount });
      fetchBalances();
    } catch (err: any) {
      setError(err.message || "Failed to mint");
    } finally {
      setMinting(false);
    }
  }

  async function handleFillPool() {
    setMinting(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`${ONCHAIN_SERVICE_URL}/api/permissions/faucet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toAddress: AGENT_SMART_ACCOUNT, amount: 5000 }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Mint failed");
      }

      const data = await res.json();
      setResult({ txHash: data.txHash, amount: data.amount });
      fetchBalances();
    } catch (err: any) {
      setError(err.message || "Failed to fill pool");
    } finally {
      setMinting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Top bar */}
      <div className="h-14 border-b border-white/[0.06] flex items-center justify-between px-6 bg-[#0a0a0a]/50">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-white/90 tracking-[-0.02em]">Vela</span>
          <span className="text-[9px] text-white/20 font-mono">faucet</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-[11px] text-white/25 hover:text-white/50 font-mono px-3 py-1.5 rounded-lg hover:bg-white/[0.04] transition-all">
            dashboard
          </Link>
          <ConnectButton />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span className="text-[20px] font-bold text-emerald-400/70">$</span>
          </div>
          <h1 className="text-[28px] font-semibold text-white/85 tracking-[-0.03em] mb-2">
            Test USDC Faucet
          </h1>
          <p className="text-[14px] text-white/30 max-w-md mx-auto">
            Mint test USDC on Sepolia to try Vela. Up to 5,000 USDC per request.
          </p>
        </motion.div>

        {/* Agent Pool Balance */}
        <motion.div
          className="card p-5 mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-1">CEO Agent Treasury</p>
              <p className="text-[11px] text-white/20 font-mono">{AGENT_SMART_ACCOUNT.slice(0, 10)}...{AGENT_SMART_ACCOUNT.slice(-8)}</p>
            </div>
            <div className="text-right">
              <p className="text-[24px] font-mono font-semibold text-emerald-400/70">
                {agentBalance !== null ? `$${parseFloat(agentBalance).toLocaleString()}` : "..."}
              </p>
              <p className="text-[10px] text-white/20 font-mono">USDC balance</p>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleFillPool}
              disabled={minting}
              className="btn btn-default w-full py-2.5 text-[12px] font-mono"
            >
              {minting ? "Minting..." : "Fill Treasury (+5,000 USDC)"}
            </button>
          </div>
        </motion.div>

        {/* Mint to wallet */}
        <motion.div
          className="card p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-4">Mint to Wallet</p>

          {/* Your balance */}
          {(toAddress || address) && (
            <div className="card-sm p-3 mb-4 flex items-center justify-between">
              <span className="text-[11px] text-white/30 font-mono">
                {(toAddress || address || "").slice(0, 10)}...
              </span>
              <span className="text-[14px] font-mono text-white/60">
                {loadingBalance ? "..." : balance !== null ? `$${parseFloat(balance).toLocaleString()} USDC` : "---"}
              </span>
            </div>
          )}

          {/* Address input */}
          <div className="mb-4">
            <label className="block text-[10px] text-white/25 uppercase tracking-wider mb-1.5">Recipient Address</label>
            <input
              type="text"
              value={toAddress}
              onChange={(e) => { setToAddress(e.target.value); }}
              placeholder="0x..."
              className="input w-full px-4 py-3 font-mono text-[13px]"
            />
            {address && toAddress !== address && (
              <button
                onClick={() => setToAddress(address)}
                className="text-[10px] text-white/20 hover:text-white/40 font-mono mt-1"
              >
                use connected wallet
              </button>
            )}
          </div>

          {/* Amount presets */}
          <div className="mb-4">
            <label className="block text-[10px] text-white/25 uppercase tracking-wider mb-2">Amount (USDC)</label>
            <div className="flex gap-2 mb-2">
              {PRESET_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAmount(a.toString())}
                  className={`flex-1 py-2 rounded-lg text-[12px] font-mono transition-all border ${
                    amount === a.toString()
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400/80"
                      : "border-white/[0.06] bg-white/[0.02] text-white/30 hover:border-white/[0.12] hover:text-white/50"
                  }`}
                >
                  ${a.toLocaleString()}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input w-full px-4 py-2.5 font-mono text-[13px]"
              placeholder="Custom amount"
            />
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="card-sm p-3 border-red-500/10 mb-4"
              >
                <p className="text-[11px] text-red-400/60">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="card-sm p-4 border-emerald-500/10 mb-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-[12px] text-emerald-400/70 font-medium">
                    Minted ${result.amount.toLocaleString()} USDC
                  </span>
                </div>
                <a
                  href={`https://sepolia.etherscan.io/tx/${result.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-white/25 hover:text-white/50 font-mono underline underline-offset-2 break-all"
                >
                  {result.txHash}
                </a>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mint button */}
          <button
            onClick={handleMint}
            disabled={minting || !toAddress}
            className="btn btn-primary w-full py-3 text-[13px]"
          >
            {minting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-black/15 border-t-black/65 rounded-full animate-spin" />
                Minting...
              </span>
            ) : (
              `Mint ${parseFloat(amount).toLocaleString()} USDC`
            )}
          </button>
        </motion.div>

        {/* Info */}
        <motion.div
          className="mt-6 text-center space-y-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-[11px] text-white/15 font-mono">
            Sepolia testnet only -- TestUSDC contract:&nbsp;
            <a
              href={`https://sepolia.etherscan.io/address/${USDC_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/25 hover:text-white/50 underline underline-offset-2"
            >
              {USDC_ADDRESS.slice(0, 10)}...{USDC_ADDRESS.slice(-6)}
            </a>
          </p>
          <p className="text-[11px] text-white/10 font-mono">
            Anyone can mint -- this is a test token with no real value
          </p>
        </motion.div>
      </div>
    </div>
  );
}
