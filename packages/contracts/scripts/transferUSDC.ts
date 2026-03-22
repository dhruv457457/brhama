import { ethers } from "hardhat";

async function main() {
  const usdcAddress = "0x38cFa1c54105d5382e4F3689af819116977A40Ce";
  const recipient = "0xE6a2551c175f8FcCDaeA49D02AdF9d4f4C6e849a"; // Agent smart account
  const amount = ethers.parseUnits("5000", 6); // 5,000 USDC

  const usdc = await ethers.getContractAt("TestUSDC", usdcAddress);
  const [signer] = await ethers.getSigners();

  console.log(`Sender: ${signer.address}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Amount: 5,000 USDC`);

  // Check balance first
  const balance = await usdc.balanceOf(signer.address);
  console.log(`Current balance: ${ethers.formatUnits(balance, 6)} USDC`);

  // Transfer
  const tx = await usdc.transfer(recipient, amount);
  console.log(`Tx submitted: ${tx.hash}`);
  await tx.wait();
  console.log("Transfer confirmed!");

  // Verify
  const recipientBal = await usdc.balanceOf(recipient);
  console.log(`Recipient balance: ${ethers.formatUnits(recipientBal, 6)} USDC`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
