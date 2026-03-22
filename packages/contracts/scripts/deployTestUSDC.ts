import { ethers } from "hardhat";

async function main() {
  const agentAddress = process.env.AGENT_WALLET_ADDRESS;
  if (!agentAddress) {
    throw new Error("AGENT_WALLET_ADDRESS not set in environment");
  }

  console.log("Deploying TestUSDC...");
  const TestUSDC = await ethers.getContractFactory("TestUSDC");
  const usdc = await TestUSDC.deploy();
  await usdc.waitForDeployment();

  const usdcAddress = await usdc.getAddress();
  console.log(`TestUSDC deployed to: ${usdcAddress}`);

  // Mint 10,000 USDC to the agent wallet
  const mintAmount = ethers.parseUnits("10000", 6);
  const tx = await usdc.mint(agentAddress, mintAmount);
  await tx.wait();
  console.log(`Minted 10,000 USDC to agent: ${agentAddress}`);

  // Also mint to the deployer for testing
  const [deployer] = await ethers.getSigners();
  const tx2 = await usdc.mint(deployer.address, mintAmount);
  await tx2.wait();
  console.log(`Minted 10,000 USDC to deployer: ${deployer.address}`);

  console.log("\n--- Update your .env ---");
  console.log(`USDC_ADDRESS=${usdcAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
