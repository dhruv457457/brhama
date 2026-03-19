import "dotenv/config";
import { createWalletClient, createPublicClient, http, encodeDeployData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, polygon } from "viem/chains";
import fs from "fs";
import path from "path";

// ── Chain configs ────────────────────────────────────────────────────────────
const CHAIN_CONFIGS = {
  base: {
    chain:      base,
    rpc:        "https://mainnet.base.org",
    name:       "Base Mainnet",
    usdc:       "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    aaveV3Pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
  },
  polygon: {
    chain:      polygon,
    rpc:        "https://polygon-rpc.com",
    name:       "Polygon Mainnet",
    usdc:       "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    aaveV3Pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  },
} as const;

type ChainKey = keyof typeof CHAIN_CONFIGS;

async function deployToChain(chainKey: ChainKey, pk: string) {
  const cfg = CHAIN_CONFIGS[chainKey];

  const account = privateKeyToAccount(
    pk.startsWith("0x") ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`)
  );

  const publicClient = createPublicClient({
    chain: cfg.chain,
    transport: http(cfg.rpc),
  });

  const walletClient = createWalletClient({
    account,
    chain: cfg.chain,
    transport: http(cfg.rpc),
  });

  console.log(`\n${"-".repeat(60)}`);
  console.log(`Deploying to ${cfg.name}`);
  console.log(`  Deployer:   ${account.address}`);
  console.log(`  USDC:       ${cfg.usdc}`);
  console.log(`  Aave V3:    ${cfg.aaveV3Pool}`);

  const artifactPath = path.join(
    process.cwd(),
    "artifacts/contracts/YieldCaveatEnforcer.sol/YieldCaveatEnforcer.json"
  );

  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Artifact not found at ${artifactPath}\nRun: npx hardhat compile`
    );
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const deployData = encodeDeployData({
    abi:      artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args:     [cfg.usdc, cfg.aaveV3Pool],
  });

  console.log(`\nBroadcasting deployment transaction...`);
  const hash = await walletClient.sendTransaction({ data: deployData });

  console.log(`  Tx Hash: ${hash}`);
  console.log(`  Waiting for confirmation...`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  console.log(`\n[OK] ${cfg.name} deployed to: ${receipt.contractAddress}`);

  return {
    chain:   chainKey,
    name:    cfg.name,
    address: receipt.contractAddress as string,
    txHash:  hash,
  };
}

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY not found in .env");

  // When run via `npx hardhat run`, process.argv contains Hardhat internals.
  // Scan ALL argv tokens for recognised chain keys instead of slicing.
  // If none found, deploy to all chains.
  const validKeys = Object.keys(CHAIN_CONFIGS) as ChainKey[];
  const matched   = validKeys.filter(k => process.argv.includes(k));
  const targets   = matched.length > 0 ? matched : validKeys;

  console.log(`\nYieldCaveatEnforcer - Multi-Chain Deploy`);
  console.log(`Deploying to: ${targets.join(", ")}`);

  const results = [];
  for (const chainKey of targets) {
    const result = await deployToChain(chainKey, pk);
    results.push(result);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`DEPLOYMENT SUMMARY`);
  console.log(`${"=".repeat(60)}`);
  for (const r of results) {
    console.log(`\n${r.name}`);
    console.log(`  Contract: ${r.address}`);
    console.log(`  Tx Hash:  ${r.txHash}`);
  }

  console.log(`\nAdd these to your .env:`);
  for (const r of results) {
    console.log(`NEXT_PUBLIC_CAVEAT_ENFORCER_${r.chain.toUpperCase()}=${r.address}`);
  }

  const outputPath = path.join(process.cwd(), "caveat-enforcer-addresses.json");
  const output: Record<string, string> = {};
  for (const r of results) output[r.chain] = r.address;
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nAddresses saved to: caveat-enforcer-addresses.json`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});