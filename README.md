# Vela

**Autonomous AI Agent Economy with On-Chain Delegation**

Vela is a multi-agent system where a CEO agent autonomously hires, evaluates, pays, and fires worker agents using MetaMask ERC-7715 delegated permissions. Every payment flows through ERC-4337 account abstraction with scoped spending limits enforced on-chain.

**Demo Video:** [https://www.youtube.com/watch?v=KoWL5KeubbY](https://www.youtube.com/watch?v=KoWL5KeubbY)

**Live Deployment:** Frontend on Vercel | Agents backend on Railway | Onchain service on Railway

**ERC-8004 Agent Identity:** [View on BaseScan](https://basescan.org/tx/0xd339815c85055d5525f683de1fab871b6a5d96368e0f905cb3a0801f7c6a97c7)

---

## How It Works

A user grants a USDC spending delegation to the CEO agent via MetaMask Flask. The CEO then:

1. **Plans** -- Analyzes the task and decides which roles to hire (engineer, analyst, writer, reviewer, risk officer)
2. **Budgets** -- Validates the wallet can afford the operation against on-chain enforcer limits
3. **Spawns** -- Creates sub-delegations for each worker agent with scoped budgets
4. **Executes** -- Worker agents produce output (code, analysis, reports, reviews)
5. **Evaluates** -- Scores each agent's work quality (0-10) and decides pay/fire
6. **Pays** -- Redeems delegations on-chain, sending USDC to performers and firing underperformers

```
User (MetaMask Flask)
  |
  | ERC-7715 delegation (scoped USDC budget)
  v
CEO Agent (Smart Account: 0xE6a2...849a)
  |
  |-- sub-delegate --> Engineer    ($200) --> evaluate --> pay $120 (6/10)
  |-- sub-delegate --> Analyst     ($75)  --> evaluate --> pay $45  (6/10)
  |-- sub-delegate --> Writer      ($25)  --> evaluate --> pay $15  (6/10)
  |-- sub-delegate --> Reviewer    ($50)  --> evaluate --> pay $30  (6/10)
  |-- sub-delegate --> Risk Officer($150) --> evaluate --> pay $90  (6/10)
  |
  v
On-chain payroll via ERC-4337 UserOps (Pimlico bundler + paymaster)
```

---

## Verified On-Chain Transactions (Sepolia)

These are real USDC transfers executed autonomously by the CEO agent through delegated permissions:

| Agent | Amount | Transaction |
|-------|--------|-------------|
| Engineer | $120 USDC | [`0xed1ccc57...`](https://sepolia.etherscan.io/tx/0xed1ccc57e1160bbb841d10a2f0911d9ba4a3a42b11e33062c75aaf6c9bfe1047) |
| Risk Officer | $90 USDC | [`0x4292d017...`](https://sepolia.etherscan.io/tx/0x4292d0176023572c9af230a6b0d3e570189bac4b407a1e8251e3ecbcaf1dc2a4) |
| Analyst | $45 USDC | [`0xae8b5afd...`](https://sepolia.etherscan.io/tx/0xae8b5afd13b8f2b3b8a0d5507796ac7aee31f26f5ace0bf992b65ca334e5bc50) |
| Writer | $15 USDC | [`0xcafb6cf5...`](https://sepolia.etherscan.io/tx/0xcafb6cf555d2fe01f4eeaccb9f451238bc64b32d6fbbdb9d28b4c9777f379eb4) |
| Reviewer | $30 USDC | [`0x261d4f01...`](https://sepolia.etherscan.io/tx/0x261d4f01b26f5949620413c2e3f3e9f6e9f83e6f227042cc02c7f2f472d5e749) |

Additional payroll runs:

| Agent | Amount | Transaction |
|-------|--------|-------------|
| Engineer | $180 USDC | [`0x2862baab...`](https://sepolia.etherscan.io/tx/0x2862baabbbcabc3666decdcd95f394dfb82518d1b2c7811da057907693ab61bc) |
| Analyst | $150 USDC | [`0x09bab331...`](https://sepolia.etherscan.io/tx/0x09bab3317f3074ea4d0025eba7a2ddb5dfc5aa15b7b3228e58bcbe6439251d24) |
| Risk Officer | $150 USDC | [`0xa7b5a619...`](https://sepolia.etherscan.io/tx/0xa7b5a619ee923c4ce4fbca3eb5ad00b13586aa26af74c82c6700be57c2730e22) |
| Writer | $60 USDC | [`0xbd46d2f4...`](https://sepolia.etherscan.io/tx/0xbd46d2f4a5c17aa5f6c6128b827eb8ed1f46fc46deb0899cff3ea4f27d1242cb) |
| Reviewer | $60 USDC | [`0x94ad8cef...`](https://sepolia.etherscan.io/tx/0x94ad8cefd2151d4cc0c4f8a8c9656c5277a8ddce423e342ff5345c4cd3f9f08b) |
| Engineer | $240 USDC | [`0x845a592a...`](https://sepolia.etherscan.io/tx/0x845a592a23ef68156047210a90c181480d95eb7243212a57b3a3349a2990c79a) |
| Risk Officer | $150 USDC | [`0xd0732271...`](https://sepolia.etherscan.io/tx/0xd07322711f35906b501bcddd07dbb65b9f9894bacbd83ffb6fa6c07ad26de809) |

---

## Architecture

```
apps/
  agents/          # Python FastAPI + LangGraph pipeline (CEO agent economy)
  web/             # Next.js 14 frontend (dashboard, analytics, permissions, faucet)

packages/
  onchain-service/ # TypeScript service (delegation, payroll, ERC-4337 execution)
  contracts/       # Solidity smart contracts (ContributorRegistry, enforcers)
```

### LangGraph Pipeline

Six-node StateGraph with conditional routing:

```
ceo_planner --> budget_guardian --[blocked]--> END
                    |
                [approved]
                    |
              agent_spawner --> task_executor --> evaluator --> payroll --> END
```

Each node streams updates in real-time via SSE. The frontend renders a live agent workspace with role-colored cards, typing animations, and a VS Code-style terminal showing inter-agent communication.

### On-Chain Stack

| Component | Details |
|-----------|---------|
| Account Abstraction | ERC-4337 v0.7 (Pimlico bundler + paymaster) |
| Delegation | MetaMask Delegation Framework (DelegationManager) |
| Permissions | ERC-7715 via MetaMask Flask |
| Spending Limits | ERC20PeriodTransferEnforcer (per-period USDC caps) |
| Agent Registry | ContributorRegistry (stores handles, reputation, payouts) |
| Token | USDC on Sepolia testnet |
| Sub-delegations | CEO creates scoped child delegations per worker agent |
| Agent Identity | ERC-8004 on Base Mainnet |

### Key Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| Agent Smart Account | [`0xE6a2551c175f8FcCDaeA49D02AdF9d4f4C6e849a`](https://sepolia.etherscan.io/address/0xE6a2551c175f8FcCDaeA49D02AdF9d4f4C6e849a) |
| DelegationManager | [`0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3`](https://sepolia.etherscan.io/address/0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3) |
| ContributorRegistry | [`0x6ec649B5f74A4864E2F7e0fDB4B02583647E4FD8`](https://sepolia.etherscan.io/address/0x6ec649B5f74A4864E2F7e0fDB4B02583647E4FD8) |
| USDC | [`0x38cFa1c54105d5382e4F3689af819116977A40Ce`](https://sepolia.etherscan.io/address/0x38cFa1c54105d5382e4F3689af819116977A40Ce) |
| ERC20PeriodTransferEnforcer | [`0x474e3Ae7E169e940607cC624Da8A15Eb120139aB`](https://sepolia.etherscan.io/address/0x474e3Ae7E169e940607cC624Da8A15Eb120139aB) |

---

## For Judges: Testing the Project

### Test USDC Faucet

The app includes a faucet page where you can mint test USDC to interact with the system:

1. Navigate to the **Faucet** page from the landing page navbar
2. Connect your MetaMask wallet (Sepolia network)
3. Mint up to 5,000 test USDC per transaction
4. Use the "Fill Treasury" button to fund the CEO agent's smart account

The faucet mints tokens directly on Sepolia. No real funds are involved.

### Quick Start for Testing

1. Visit the live deployment URL
2. Install [MetaMask Flask](https://chromewebstore.google.com/detail/metamask-flask/ljfoeinjpaedjfecbmggjgodbgkmjkjk) (version 13.5.0+)
3. Switch to Sepolia testnet
4. Mint test USDC from the Faucet page
5. Go to Dashboard, grant an ERC-7715 permission (set budget, e.g. $1000 USDC)
6. Enter a task like: "Build a DeFi lending protocol with smart contracts and security audit. Budget $500"
7. Watch the CEO agent hire workers, execute tasks, evaluate quality, and pay on-chain
8. Navigate to Analytics to see the delegation graph, agent outputs, and spending breakdown

---

## Features

**Dashboard**
- Full-screen layout with collapsible sidebar and run history
- Centered chat input with suggested prompts (appears before first run)
- Live agent workspace with role-colored glow animations
- VS Code-style terminal showing real-time agent communications
- Permission manager with active delegation display and remaining budget
- Pipeline progress tracking with step-by-step visualization

**Analytics**
- Agent node tree showing CEO-to-worker delegation graph with budget edges
- AI-powered agent analysis -- click any agent to get structured output breakdown
- Engineer agents render syntax-highlighted code snippets with file tabs
- Spending donut charts, quality score bars, budget efficiency metrics
- Click-to-copy agent on-chain addresses for Etherscan verification
- Resizable analysis panel with drag handle

**On-Chain**
- Real ERC-7715 permissions via MetaMask Flask (no demo mode)
- Agent address verification against ContributorRegistry
- Real USDC payments via ERC-4337 UserOps through Pimlico
- Scoped sub-delegations with per-agent spending limits
- Automatic payroll execution with quality-based pay decisions
- ERC-8004 agent identity on Base Mainnet

**Infrastructure**
- MongoDB persistence with JSON file fallback for both Python and TypeScript services
- Test USDC faucet for judges and testers
- Deployed on Railway (backends) and Vercel (frontend)

---

## Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- MetaMask Flask (for ERC-7715 delegation)
- MongoDB (optional, falls back to JSON files)

### Install

```bash
# Install Node dependencies
npm install

# Install Python dependencies
cd apps/agents
pip install -r requirements.txt
cd ../..
```

### Environment Variables

Create `.env` at root and `.env.local` in `apps/web/`:

```bash
# Root .env
OPENROUTER_API_KEY=        # LLM provider API key
GITHUB_TOKEN=              # GitHub API token
GITHUB_REPO=owner/repo     # Target repository
MONGODB_URI=               # MongoDB connection string (optional)

# Onchain service
SEPOLIA_RPC_URL=           # Sepolia RPC endpoint
BUNDLER_RPC_URL=           # Pimlico bundler URL
AGENT_PRIVATE_KEY=         # Agent EOA private key (hex)

# apps/web/.env.local
NEXT_PUBLIC_AGENTS_API_URL=http://localhost:8000
NEXT_PUBLIC_ONCHAIN_SERVICE_URL=http://localhost:3001
```

### Run

```bash
# Terminal 1 -- Python agents backend
cd apps/agents
uvicorn main:app --port 8000

# Terminal 2 -- Onchain service
npm run dev:onchain

# Terminal 3 -- Next.js frontend
npm run dev:web
```

Open `http://localhost:3000`

---

## Deployment

| Service | Platform | Root Directory | URL |
|---------|----------|---------------|-----|
| Python agents | Railway | `/apps/agents` | `vela-production-b18e.up.railway.app` |
| Onchain service | Railway | `/packages/onchain-service` | `vela-production-2e84.up.railway.app` |
| Next.js frontend | Vercel | `/apps/web` | Vercel deployment |

**Railway build commands:**
- Python agents: Build `pip install -r requirements.txt`, Start `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Onchain service: Build `npm install && npm run build`, Start `npm start`

---

## Tech Stack

**Frontend:** Next.js 14, TypeScript, Tailwind CSS, Framer Motion, Zustand, ethers.js

**AI Pipeline:** Python, FastAPI, LangGraph, LangChain, OpenRouter (Qwen 32B)

**On-Chain:** Solidity, Hardhat, viem, ERC-4337, ERC-7715, MetaMask Delegation Framework, Pimlico

**Storage:** MongoDB (motor for Python, mongodb for Node.js), JSON file fallback

**Identity:** ERC-8004 agent identity on Base Mainnet

---

## API Endpoints

### Agents Service (Python)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agents/run` | Start a new pipeline run |
| GET | `/api/agents/status/{run_id}` | Get run status with streaming updates |
| GET | `/api/agents/history` | List all run history |
| GET | `/api/agents/history/{run_id}` | Get specific run details |
| POST | `/api/agents/parse-intent` | Parse natural language to task config |
| POST | `/api/agents/analyze-agent` | AI analysis of agent output (returns structured JSON) |

### Onchain Service (TypeScript)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/permissions/grant` | Store a new delegation permission |
| GET | `/api/permissions` | Get active permissions for wallet |
| POST | `/api/permissions/revoke` | Revoke a stored permission |
| GET | `/api/delegation/remaining` | Check remaining delegation allowance |
| POST | `/api/delegation/create-sub` | Create sub-delegation for worker |
| POST | `/api/delegation/redeem` | Execute on-chain payment via UserOp |
| POST | `/api/permissions/verify-agents` | Verify agent addresses on-chain |
| GET | `/api/contributor/:address` | Get contributor reputation data |

---

## How Delegation Works

1. User connects MetaMask Flask and calls `wallet_grantPermissions` (ERC-7715)
2. MetaMask returns a signed delegation with `ERC20PeriodTransferEnforcer` caveats
3. The delegation is stored in MongoDB with budget and period metadata
4. When the CEO runs payroll, it creates sub-delegations per worker agent
5. Each sub-delegation is redeemed via `DelegationManager.redeemDelegations()`
6. The redemption is wrapped in an ERC-4337 UserOp and sent through Pimlico
7. The bundler executes the UserOp, transferring USDC from the user's smart account to the worker

The `ERC20PeriodTransferEnforcer` ensures cumulative transfers never exceed the delegated budget within a given time period, providing trustless spending caps without requiring the user to remain online.

---

## Self-Custody (ERC-8004)

The agent's on-chain identity was registered via The Synthesis hackathon platform as an ERC-8004 NFT on Base Mainnet. The identity has been transferred to self-custody at wallet `0x6b4abD80E900F70DFbe9Cf0aA8706EF7C72099b3`.

Registration transaction: [View on BaseScan](https://basescan.org/tx/0xd339815c85055d5525f683de1fab871b6a5d96368e0f905cb3a0801f7c6a97c7)

---

## License

MIT
