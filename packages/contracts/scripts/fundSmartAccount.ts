import { ethers } from "hardhat";

async function main() {
  const smartAccount = "0xE6a2551c175f8FcCDaeA49D02AdF9d4f4C6e849a";
  const amount = ethers.parseEther("0.05");

  const [signer] = await ethers.getSigners();
  console.log(`Sender: ${signer.address}`);
  console.log(`Sending 0.05 ETH to smart account: ${smartAccount}`);

  const tx = await signer.sendTransaction({
    to: smartAccount,
    value: amount,
  });
  console.log(`Tx: ${tx.hash}`);
  await tx.wait();
  console.log("Done! Smart account funded with 0.05 Sepolia ETH");

  const balance = await ethers.provider.getBalance(smartAccount);
  console.log(`Smart account balance: ${ethers.formatEther(balance)} ETH`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
