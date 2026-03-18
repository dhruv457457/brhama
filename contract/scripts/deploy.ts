import "dotenv/config"; // ← add this as the very first line
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import fs from "fs";
import path from "path";

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY not found in .env");
    const account = privateKeyToAccount(
        pk.startsWith("0x") ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`)
    );

    const publicClient = createPublicClient({
        chain: base,
        transport: http("https://mainnet.base.org"),
    });

    const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http("https://mainnet.base.org"),
    });

    console.log(`Deploying from wallet: ${account.address}`);

    // 2. Read the compiled Hardhat artifact
    const artifactPath = path.join(
        process.cwd(),
        "artifacts/contracts/YieldCaveatEnforcer.sol/YieldCaveatEnforcer.json"
    );
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    // 3. Broadcast Deployment Transaction
    console.log("Broadcasting deployment transaction to Base Mainnet...");
    const hash = await walletClient.deployContract({
        abi: artifact.abi,
        bytecode: artifact.bytecode as `0x${string}`,
    });

    console.log(`Tx Hash: ${hash}`);
    console.log("Waiting for confirmation (this takes a few seconds)...");

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    console.log(`\n✅ SUCCESS! Contract deployed to: ${receipt.contractAddress}`);
    console.log(`Copy this address into CAVEAT_ENFORCER_ADDRESS in your Next.js app!`);
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});