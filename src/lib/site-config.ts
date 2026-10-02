// The one place for TAPE's name, links and network. Chain values come from the
// verified config in the stakeback project (official Robinhood Chain docs,
// chain id read back with eth_chainId = 0x1237).

export const SITE = {
  name: "TAPE",
  hook: "See what the chain is paying for.",
  description:
    "A live board of the coins launched on Robinhood Chain's launchpad, ranked by the creator fees they really earn.",
};

export const CHAIN = {
  id: 4663,
  name: "Robinhood Chain",
  explorerUrl: "https://robinhoodchain.blockscout.com",
};

export const LAUNCHPAD = {
  name: "Pons",
  base: "https://www.ponsfamily.com",
  coinUrl: (token: string) => `https://www.ponsfamily.com/launchpad/${token}`,
  logoUrl: (logo: string | null) => {
    if (!logo) return null;
    if (logo.startsWith("ipfs://")) return `https://www.ponsfamily.com/api/ipfs/content/${logo.slice(7)}`;
    return logo.startsWith("https://") ? logo : null;
  },
};

export const explorerToken = (token: string) => `${CHAIN.explorerUrl}/token/${token}`;

export const dexPageUrl = (pair: string) => `https://dexscreener.com/robinhood/${pair}`;
