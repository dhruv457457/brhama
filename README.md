# Pact — Autonomous Contributor Rewards Protocol

> **MetaMask Advanced Permissions Dev Cook-Off Hackathon**

Pact uses **ERC-7715 delegated permissions** and **LangGraph AI agents** to automatically analyze GitHub contributions and pay contributors in USDC — without the repo owner touching their wallet .

## How It Works
 
 
```
GitHub PR merged
    ↓
AI Agent scores contribution (LLM via OpenRouter)
    ↓
Budget Guardian checks remaining allowance
    ↓
Delegation Manager creates sub-delegation
    ↓
Executor redeems ERC-7715 permission → USDC transfer
    ↓
Contributor gets paid (gasless, via Pimlico paymaster)
```

## Architecture

```
packages/
  contracts/          # Solidity — ContributorRegistry, TestUSDC
  onchain-service/    # Express (port 3001) — delegation, bundler, permissions
apps/
  agents/             # Python FastAPI + LangGraph (port 8000) — AI pipeline
  web/                # Next.js 14 (port 3000) — dashboard, permissions UI
```

## Key Technologies

- **ERC-7715** — Delegated execution permissions via MetaMask Flask
- **ERC-4337** — Account abstraction (EntryPoint v0.7)
- **MetaMask Smart Accounts Kit** v0.4.0-beta.1
- **Pimlico** — Bundler + Paymaster (gasless for users)
- **LangGraph** — Multi-agent orchestration
- **OpenRouter** — LLM for PR quality scoring

## Deployed Contracts (Sepolia)

| Contract | Address |
|---|---|
| ContributorRegistry | `0x6ec649B5f74A4864E2F7e0fDB4B02583647E4FD8` |
| TestUSDC | `0x38cFa1c54105d5382e4F3689af819116977A40Ce` |
| Agent Smart Account | `0xE6a2551c175f8FcCDaeA49D02AdF9d4f4C6e849a` |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Fill in your keys

# 3. Start onchain service
cd packages/onchain-service && npm run dev

# 4. Start AI agents
cd apps/agents && pip install -e . && uvicorn main:app --port 8000

# 5. Start frontend
cd apps/web && npm run dev
```

## Delegation Flow

1. **Repo owner** connects MetaMask Flask on the Permissions page
2. Signs an ERC-7715 permission granting the agent periodic USDC allowance
3. Permission stored on-chain + in local JSON store
4. **AI agent** monitors GitHub PRs, scores quality, calculates payment
5. **Executor** redeems the delegation via `sendUserOperationWithDelegation`
6. USDC transfers from owner's smart account to contributor — gasless

## License

MIT
