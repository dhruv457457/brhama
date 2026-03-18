import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: "0.8.28",
  networks: {
    base: {
      type: "http",
      chainType: "op",
      url: "https://mainnet.base.org",
      accounts: [configVariable("PRIVATE_KEY")],
    },
  },
});