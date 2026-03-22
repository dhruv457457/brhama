import { ethers } from "hardhat";

async function main() {
  const agentAddress = process.env.AGENT_WALLET_ADDRESS;
  if (!agentAddress) {
    throw new Error("AGENT_WALLET_ADDRESS not set in environment");
  }

  const ContributorRegistry = await ethers.getContractFactory("ContributorRegistry");
  const registry = await ContributorRegistry.deploy(agentAddress);
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log(`ContributorRegistry deployed to: ${address}`);
  console.log(`Agent address: ${agentAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
