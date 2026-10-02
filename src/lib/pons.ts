import "server-only";

// Read-only access to the launchpad's own public JSON. It is not a documented
// API and can change without notice, so every call fails loudly.
const BASE = "https://www.ponsfamily.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

async function get(path: string, { json = true, tries = 3 } = {}): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const response = await fetch(BASE + path, {
        headers: { "user-agent": UA, accept: json ? "application/json" : "text/html" },
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return json ? await response.json() : await response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  throw new Error(`launchpad ${path}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

export interface CatalogCoin {
  token: string;
  name?: string;
  symbol?: string;
  description?: string;
  logo?: string;
  marketCapUsd?: number | null;
  graduated?: boolean;
  launchedAt?: string | null;
  latestBuyAt?: string | null;
  version?: string;
  quoteAsset?: { symbol?: string; decimals?: number } | null;
}

/** Every graduated coin. */
export async function graduatedCatalog(): Promise<CatalogCoin[]> {
  const list = await get("/api/pons-launches/graduations?catalog=1&v=12");
  if (!Array.isArray(list) || list.length === 0) throw new Error("launchpad catalog: unexpected shape");
  return list as CatalogCoin[];
}

/** Coins still on the bonding curve, most traded first. */
export async function activeByVolume(age = "24h", pageSize = 50): Promise<CatalogCoin[]> {
  const data = (await get(
    `/api/pons-launches?explore=1&sort=volume&age=${age}&page=1&pageSize=${pageSize}&includeGraduated=0&version=all&v=22`,
  )) as { active?: { items?: unknown } };
  const items = data?.active?.items;
  if (!Array.isArray(items)) throw new Error("launchpad active list: unexpected shape");
  return items as CatalogCoin[];
}

/** Lifetime creator fees a coin has earned, in its quote asset. */
export async function creatorFees(token: string): Promise<{ quoteSymbol: string; earned: number }> {
  const data = (await get(`/api/pons-v2-market/${token.toLowerCase()}/creator-fees`, { tries: 2 })) as {
    quoteAsset?: { symbol?: string; decimals?: number };
    earnedForToken?: string;
  };
  if (data?.earnedForToken === undefined) throw new Error("creator fees: unexpected shape");
  const decimals = data.quoteAsset?.decimals ?? 18;
  return {
    quoteSymbol: data.quoteAsset?.symbol ?? "ETH",
    earned: Number(BigInt(data.earnedForToken)) / 10 ** decimals,
  };
}

/** Links the creator attached to the coin, read from its launchpad page. */
export async function tokenLinks(token: string): Promise<{ website: string | null; twitter: string | null; telegram: string | null }> {
  const html = (await get(`/launchpad/${token}`, { json: false, tries: 2 })) as string;
  const pick = (key: string) => {
    const match = new RegExp(`\\\\"${key}\\\\":\\\\"(https?:[^"\\\\]*)\\\\"`).exec(html);
    return match ? match[1] : null;
  };
  return { website: pick("website"), twitter: pick("twitter"), telegram: pick("telegram") };
}

/** Spot prices in USD from Coinbase's public endpoint. A failed read stays null. */
export async function spotUsd(pair: "ETH-USD" | "BTC-USD"): Promise<number | null> {
  try {
    const response = await fetch(`https://api.coinbase.com/v2/prices/${pair}/spot`, {
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { data?: { amount?: string } };
    const value = Number(json?.data?.amount);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}
