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
  |-- budget_guardian : Validates on-chain spending capacity
  |-- agent_spawner  : Creates sub-delegations per worker agent
  |-- task_executor  : Workers produce output (code, analysis, reports)
  |-- evaluator      : Scores quality (0-10), decides pay/fire
  |-- payroll        : Redeems delegations via ERC-4337 UserOps
  |
  v
On-Chain Settlement (Sepolia)
  USDC transfers via DelegationManager.redeemDelegations()
  Bundled through Pimlico (ERC-4337 bundler + paymaster)
```

## How to Interact

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
Returns streaming SSE with real-time updates from each pipeline node.

**Get run history:**
```
GET /api/agents/history
```

**Analyze agent output:**
```
POST /api/agents/analyze
Content-Type: application/json

{
  "agent_name": "Engineer",
  "agent_role": "engineer",
  "output": "<agent's text output>"
}
```
Returns structured JSON with code snippets, metrics, and analysis.

**Verify agent addresses on-chain:**
```
POST /api/permissions/verify-agents
Content-Type: application/json

{
  "addresses": ["0x1234...", "0x5678..."]
}
```

**Check delegation remaining allowance:**
```
GET /api/delegation/remaining?permissionsContext=<hex>
```

### Frontend

Live deployment: Check the team's submitted deployment URL.

The dashboard provides:
- Task input with natural language parsing
- Real-time pipeline visualization with agent cards
- VS Code-style terminal showing inter-agent communication
- Analytics page with agent node graph and AI-powered output analysis
- Permission manager for ERC-7715 delegation lifecycle

## Agent Roles

| Role | Purpose | Typical Budget |
|------|---------|---------------|
| Engineer | Writes code (Solidity, TypeScript, Python) | $150-300 |
| Analyst | Market analysis, data research | $100-200 |
| Writer | Documentation, reports, content | $50-100 |
| Reviewer | Code review, quality assessment | $50-100 |
| Risk Officer | Security analysis, risk assessment | $100-200 |

## On-Chain Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| Agent Smart Account | `0xE6a2551c175f8FcCDaeA49D02AdF9d4f4C6e849a` |
| DelegationManager | `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3` |
| ContributorRegistry | `0x6ec649B5f74A4864E2F7e0fDB4B02583647E4FD8` |
| USDC | `0x38cFa1c54105d5382e4F3689af819116977A40Ce` |
| ERC20PeriodTransferEnforcer | `0x474e3Ae7E169e940607cC624Da8A15Eb120139aB` |

## Key Technologies

- **ERC-7715**: Permission delegation standard (MetaMask Flask)
- **ERC-4337 v0.7**: Account abstraction for gasless agent transactions
- **MetaMask Delegation Framework**: Sub-delegation chains with caveat enforcers
- **ERC20PeriodTransferEnforcer**: On-chain spending caps per time period
- **LangGraph**: Multi-node AI pipeline with conditional routing
- **ContributorRegistry**: On-chain reputation and payout tracking

## What Makes This Different

1. **Real money flows**: Agents don't simulate payments -- they execute actual USDC transfers on Sepolia via ERC-4337 UserOps
2. **Scoped autonomy**: The human sets a budget cap via ERC-7715. The CEO agent operates freely within that scope but cannot exceed it
3. **Sub-delegation chains**: CEO creates child delegations per worker, each with independent spending limits
4. **Quality-gated payroll**: Workers only get paid if their output scores above threshold. Underperformers get fired (delegation revoked)
5. **Fully on-chain audit trail**: Every hire, payment, and termination is traceable through delegation redemption transactions

## Source Code

GitHub: https://github.com/dhruv457457/VELA
