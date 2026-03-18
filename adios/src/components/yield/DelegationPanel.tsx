"use client";

import { Shield, CheckCircle, XCircle, Loader, Zap } from "lucide-react";
import { useDelegation } from "@/hooks/useDelegation";
import { useAccount } from "wagmi";

function isValidAddress(addr: string): boolean {
    return typeof addr === "string" && addr.startsWith("0x") && addr.length === 42;
}

export default function DelegationPanel({ agentAddress }: { agentAddress: string }) {
    const { isConnected } = useAccount();
    const { delegation, signing, error, createAndSign, revoke } = useDelegation(agentAddress);

    if (!isConnected) return (
        <Box>
            <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>
                Connect MetaMask Flask to use Advanced Permissions
            </p>
        </Box>
    );

    // Catches empty string "" that !!agentAddress would pass
    if (!isValidAddress(agentAddress)) return (
        <Box>
            <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>
                Start the yield agent first to enable permissions
            </p>
        </Box>
    );

    return (
        <Box active={!!delegation}>
            {/* Header */}
            <div style={{
                padding: "10px 14px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Shield style={{ width: 13, height: 13, color: delegation ? "var(--neon-cyan)" : "var(--text-muted)" }} />
                    <span style={{
                        fontSize: 10,
                        color: delegation ? "var(--neon-cyan)" : "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        fontWeight: 600,
                    }}>
                        Advanced Permissions
                    </span>
                </div>
                <span style={{
                    fontSize: 9,
                    background: "var(--neon-cyan-ghost)",
                    color: "var(--neon-cyan)",
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontWeight: 700,
                }}>
                    ERC-7715
                </span>
            </div>

            <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                {delegation ? (
                    <>
                        {/* Active state */}
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <CheckCircle style={{ width: 16, height: 16, color: "var(--neon-cyan)", flexShrink: 0, marginTop: 1 }} />
                            <div>
                                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--neon-cyan)" }}>Permission Active</p>
                                <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.5 }}>
                                    Brahma agent can deposit up to 1000 USDC/day. Funds stay in your MetaMask wallet.
                                </p>
                            </div>
                        </div>

                        {/* Agent address */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Agent wallet</span>
                            <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                                {agentAddress.slice(0, 8)}...{agentAddress.slice(-6)}
                            </span>
                        </div>

                        {/* On-chain guard */}
                        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
                            <p style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                                On-Chain Guard (YieldCaveatEnforcer)
                            </p>
                            {[
                                { label: "Aave V3 Pool", ok: true },
                                { label: "LI.FI Diamond", ok: true },
                                { label: "Any other contract", ok: false },
                            ].map(({ label, ok }) => (
                                <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: ok ? "var(--success)" : "var(--danger)" }} />
                                    <span style={{ fontSize: 10, color: ok ? "var(--text-secondary)" : "var(--text-muted)" }}>
                                        {ok ? "✓" : "✗"} {label}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={revoke}
                            style={{
                                width: "100%",
                                padding: "7px",
                                borderRadius: 7,
                                fontSize: 11,
                                fontWeight: 600,
                                border: "1px solid rgba(239,68,68,0.2)",
                                background: "rgba(239,68,68,0.06)",
                                color: "rgba(239,68,68,0.7)",
                                cursor: "pointer",
                            }}
                        >
                            Revoke Permission
                        </button>
                    </>
                ) : (
                    <>
                        {/* Grant state */}
                        <div style={{ padding: "10px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                                Grant Permission
                            </p>
                            <p style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 8 }}>
                                MetaMask Flask shows a rich UI. One click — no fund movement, no vault needed.
                                Agent can spend up to 1000 USDC/day for yield.
                            </p>

                            {/* Agent address preview */}
                            <div style={{ marginBottom: 8, padding: "5px 8px", background: "var(--bg-base)", borderRadius: 6, display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Agent</span>
                                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--neon-cyan-dim)" }}>
                                    {agentAddress.slice(0, 8)}...{agentAddress.slice(-6)}
                                </span>
                            </div>

                            {error && (
                                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
                                    <XCircle style={{ width: 12, height: 12, color: "var(--danger)", flexShrink: 0 }} />
                                    <p style={{ fontSize: 10, color: "var(--danger)", fontFamily: "var(--font-mono)" }}>
                                        {error.slice(0, 100)}
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={createAndSign}
                                disabled={signing}
                                style={{
                                    width: "100%",
                                    padding: "8px",
                                    borderRadius: 7,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    border: "1px solid var(--neon-cyan-muted)",
                                    background: "var(--neon-cyan-ghost)",
                                    color: "var(--neon-cyan)",
                                    cursor: signing ? "not-allowed" : "pointer",
                                    opacity: signing ? 0.5 : 1,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 6,
                                }}
                            >
                                {signing
                                    ? <><Loader style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> Waiting for MetaMask Flask...</>
                                    : <><Zap style={{ width: 13, height: 13 }} /> Grant Advanced Permission</>
                                }
                            </button>
                        </div>

                        {/* Benefits */}
                        <div style={{ padding: "8px 10px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8 }}>
                            {[
                                "No fund movement needed",
                                "On-chain guard rejects unauthorized contracts",
                                "Revoke anytime in MetaMask",
                                "Requires MetaMask Flask 13.5+",
                            ].map((txt) => (
                                <div key={txt} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--neon-cyan)", flexShrink: 0 }} />
                                    <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>{txt}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </Box>
    );
}

function Box({ children, active }: { children: React.ReactNode; active?: boolean }) {
    return (
        <div style={{
            background: active ? "rgba(0,255,224,0.04)" : "var(--bg-base)",
            border: `1px solid ${active ? "var(--neon-cyan-muted)" : "var(--border)"}`,
            borderRadius: 10,
            overflow: "hidden",
            transition: "all 0.3s",
        }}>
            {children}
        </div>
    );
}