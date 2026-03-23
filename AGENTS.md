# AGENTS.md -- Vela

## What is Vela?

Vela is an autonomous AI agent economy built on MetaMask's ERC-7715 delegation framework. A CEO agent receives a scoped USDC spending delegation from a human user, then autonomously hires worker agents, assigns tasks, evaluates output quality, and executes on-chain payroll -- all without further human intervention.

## System Architecture

```
Human User
  |
  | wallet_grantPermissions (ERC-7715 via MetaMask Flask)
  |
  v
CEO Agent (LangGraph Pipeline)
  |
  |-- ceo_planner    : Analyzes task, decides team composition and budgets
  |-- budget_guardian : Validates on-chain spending capacity via ERC20PeriodTransferEnforcer
  |-- agent_spawner  : Creates sub-delegations per worker agent with scoped USDC limits
  |-- task_executor  : Workers produce output (code, analysis, reports)
  |-- evaluator      : Scores quality (0-10), decides pay/fire
  |-- payroll        : Redeems delegations via ERC-4337 UserOps (real USDC transfers)
  |
  v
On-Chain Settlement (Sepolia)
  USDC transfers via DelegationManager.redeemDelegations()
  Bundled through Pimlico (ERC-4337 v0.7 bundler + paymaster)
```

## Live Deployment

| Service | URL |
|---------|-----|
| Frontend | Vercel deployment |
| Agents Backend | `https://vela-production-b18e.up.railway.app` |
| Onchain Service | `https://vela-production-2e84.up.railway.app` |

## Demo Video

[https://www.youtube.com/watch?v=KoWL5KeubbY](https://www.youtube.com/watch?v=KoWL5KeubbY)

## How to Interact

### Testing as a Judge

1. Visit the live deployment URL
2. Install [MetaMask Flask](https://chromewebstore.google.com/detail/metamask-flask/ljfoeinjpaedjfecbmggjgodbgkmjkjk) (version 13.5.0+)
3. Switch to Sepolia testnet
4. Go to the **Faucet** page (linked in navbar) to mint test USDC -- up to 5,000 per transaction
5. Go to Dashboard, sign an ERC-7715 permission to grant the CEO a USDC budget
6. Enter a task (e.g., "Build a DeFi lending protocol with smart contracts. Budget $500")
7. Watch the pipeline execute live -- agents spawn, work, get evaluated, and get paid on-chain
8. Visit the Analytics page to see the delegation graph, click agents for AI-powered output analysis

### API Endpoints

Base URL for agents backend: `https://vela-production-b18e.up.railway.app`
Base URL for onchain service: `https://vela-production-2e84.up.railway.app`

**Start a pipeline run:**
```
POST /api/agents/run
Content-Type: application/json

{
  "task": "Build a DeFi lending protocol with smart contracts and frontend",
  "budget": 500,
  "permissions_context": "<delegation-context-hex>"
}
```

**Check run status:**
```
GET /api/agents/status/{run_id}
```
Returns real-time updates from each pipeline node.

**Get run history:**
```
GET /api/agents/history
```

**Analyze agent output (AI-powered):**
```
POST /api/agents/analyze-agent
Content-Type: application/json

{
  "agent_name": "Engineer",
  "agent_role": "engineer",
  "output": "<agent's text output>"
}
```
Returns structured JSON with code snippets, file breakdowns, metrics, and analysis. For engineer agents, returns syntax-highlighted code with file tabs and complexity ratings.

**Verify agent addresses on-chain:**
```
POST /api/permissions/verify-agents
Content-Type: application/json

{
  "addresses": ["0x1234...", "0x5678..."]
}
```
Checks each address against the ContributorRegistry contract for on-chain registration, reputation, and payout history.

**Check delegation remaining allowance:**
```
GET /api/delegation/remaining?permissionsContext=<hex>
```

**Mint test USDC (faucet):**
Available via the frontend Faucet page. Mints test USDC on Sepolia for testing the delegation flow.

## Agent Roles

| Role | Purpose | Typical Budget |
|------|---------|---------------|
| Engineer | Writes code (Solidity, TypeScript, Python) | $150-300 |
| Analyst | Market analysis, data research | $75-200 |
| Writer | Documentation, reports, content | $25-100 |
| Reviewer | Code review, quality assessment | $25-100 |
| Risk Officer | Security analysis, risk assessment | $100-200 |

## On-Chain Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| Agent Smart Account | [`0xE6a2551c175f8FcCDaeA49D02AdF9d4f4C6e849a`](https://sepolia.etherscan.io/address/0xE6a2551c175f8FcCDaeA49D02AdF9d4f4C6e849a) |
| DelegationManager | [`0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3`](https://sepolia.etherscan.io/address/0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3) |
| ContributorRegistry | [`0x6ec649B5f74A4864E2F7e0fDB4B02583647E4FD8`](https://sepolia.etherscan.io/address/0x6ec649B5f74A4864E2F7e0fDB4B02583647E4FD8) |
| USDC | [`0x38cFa1c54105d5382e4F3689af819116977A40Ce`](https://sepolia.etherscan.io/address/0x38cFa1c54105d5382e4F3689af819116977A40Ce) |
| ERC20PeriodTransferEnforcer | [`0x474e3Ae7E169e940607cC624Da8A15Eb120139aB`](https://sepolia.etherscan.io/address/0x474e3Ae7E169e940607cC624Da8A15Eb120139aB) |

## Verified Transactions

Real USDC payments executed autonomously by the CEO agent:

| Transaction | Amount | Agent |
|-------------|--------|-------|
| [`0xed1ccc57...`](https://sepolia.etherscan.io/tx/0xed1ccc57e1160bbb841d10a2f0911d9ba4a3a42b11e33062c75aaf6c9bfe1047) | $120 | Engineer |
| [`0x4292d017...`](https://sepolia.etherscan.io/tx/0x4292d0176023572c9af230a6b0d3e570189bac4b407a1e8251e3ecbcaf1dc2a4) | $90 | Risk Officer |
| [`0xae8b5afd...`](https://sepolia.etherscan.io/tx/0xae8b5afd13b8f2b3b8a0d5507796ac7aee31f26f5ace0bf992b65ca334e5bc50) | $45 | Analyst |
| [`0xcafb6cf5...`](https://sepolia.etherscan.io/tx/0xcafb6cf555d2fe01f4eeaccb9f451238bc64b32d6fbbdb9d28b4c9777f379eb4) | $15 | Writer |
| [`0x261d4f01...`](https://sepolia.etherscan.io/tx/0x261d4f01b26f5949620413c2e3f3e9f6e9f83e6f227042cc02c7f2f472d5e749) | $30 | Reviewer |
| [`0x2862baab...`](https://sepolia.etherscan.io/tx/0x2862baabbbcabc3666decdcd95f394dfb82518d1b2c7811da057907693ab61bc) | $180 | Engineer |
| [`0x845a592a...`](https://sepolia.etherscan.io/tx/0x845a592a23ef68156047210a90c181480d95eb7243212a57b3a3349a2990c79a) | $240 | Engineer |
| [`0xd0732271...`](https://sepolia.etherscan.io/tx/0xd07322711f35906b501bcddd07dbb65b9f9894bacbd83ffb6fa6c07ad26de809) | $150 | Risk Officer |
| [`0x09bab331...`](https://sepolia.etherscan.io/tx/0x09bab3317f3074ea4d0025eba7a2ddb5dfc5aa15b7b3228e58bcbe6439251d24) | $150 | Analyst |
| [`0xa7b5a619...`](https://sepolia.etherscan.io/tx/0xa7b5a619ee923c4ce4fbca3eb5ad00b13586aa26af74c82c6700be57c2730e22) | $150 | Risk Officer |

## Key Technologies

- **ERC-7715**: Permission delegation standard (MetaMask Flask)
- **ERC-4337 v0.7**: Account abstraction for gasless agent transactions
- **ERC-8004**: On-chain agent identity (Base Mainnet)
- **MetaMask Delegation Framework**: Sub-delegation chains with caveat enforcers
- **ERC20PeriodTransferEnforcer**: On-chain spending caps per time period
- **LangGraph**: Multi-node AI pipeline with conditional routing and SSE streaming
- **ContributorRegistry**: On-chain reputation and payout tracking
- **MongoDB**: Persistent storage for run history and permissions (with JSON fallback)

## What Makes This Different

1. **Real money flows**: Agents don't simulate payments -- they execute actual USDC transfers on Sepolia via ERC-4337 UserOps
2. **Scoped autonomy**: The human sets a budget cap via ERC-7715. The CEO agent operates freely within that scope but cannot exceed it
3. **Sub-delegation chains**: CEO creates child delegations per worker, each with independent spending limits
4. **Quality-gated payroll**: Workers only get paid proportional to their quality score. Underperformers get fired (delegation revoked, unused funds returned)
5. **Fully on-chain audit trail**: Every hire, payment, and termination is traceable through delegation redemption transactions on Sepolia
6. **AI-powered analytics**: Click any agent to get structured analysis of their output -- engineers show syntax-highlighted code, analysts show research breakdowns
7. **No demo mode**: Every interaction requires a real MetaMask Flask signature. No simulated flows.

## Self-Custody

ERC-8004 agent identity transferred to self-custody wallet: `0x6b4abD80E900F70DFbe9Cf0aA8706EF7C72099b3`

Registration transaction: [View on BaseScan](https://basescan.org/tx/0xd339815c85055d5525f683de1fab871b6a5d96368e0f905cb3a0801f7c6a97c7)

## Source Code

GitHub: [https://github.com/dhruv457457/VELA](https://github.com/dhruv457457/VELA)
