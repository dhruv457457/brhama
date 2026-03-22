export const USDC_SEPOLIA_ADDRESS =
  (process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`) ||
  "0x38cFa1c54105d5382e4F3689af819116977A40Ce";

export const CONTRIBUTOR_REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_CONTRIBUTOR_REGISTRY_ADDRESS as `0x${string}`) ||
  "0x0000000000000000000000000000000000000000";

export const SEPOLIA_CHAIN_ID = 11155111;

export const AGENTS_API_URL =
  process.env.AGENTS_API_URL || "http://localhost:8000";

export const ONCHAIN_SERVICE_URL =
  process.env.NEXT_PUBLIC_ONCHAIN_SERVICE_URL || "http://localhost:3001";
