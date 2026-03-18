import { http, createConfig } from "wagmi";
import { mainnet, base, arbitrum, optimism, polygon } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
if (!ALCHEMY_KEY) throw new Error("Missing env var: NEXT_PUBLIC_ALCHEMY_KEY");

export const wagmiConfig = createConfig({
  ssr: true,
  chains: [base, arbitrum, optimism, polygon, mainnet],
  connectors: [injected({ target: "metaMask" })],
  multiInjectedProviderDiscovery: false, // Only MetaMask — no Keplr, Talisman, etc.
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
    [arbitrum.id]: http(`https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
    [optimism.id]: http(`https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
    [polygon.id]: http(`https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
  },
});