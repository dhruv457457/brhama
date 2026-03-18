import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const YieldCaveatEnforcerModule = buildModule("YieldCaveatEnforcerModule", (m) => {
  // Tell Ignition to deploy the contract. No hre.viem needed!
  const enforcer = m.contract("YieldCaveatEnforcer");

  return { enforcer };
});

export default YieldCaveatEnforcerModule;