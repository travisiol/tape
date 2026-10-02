import "server-only";

// GeckoTerminal public API (no key): a token's main pool, its price, and OHLCV candles.
// Self-contained so it can be copied into other projects. Every upstream read is cached
// 5 minutes per (token) or per (pool, timeframe) on globalThis: their public limit is about
// 30 requests a minute, so visitors never cause one upstream call each.

export type Timeframe = "15m" | "1h" | "4h" | "1D";
export const TIMEFRAMES: Timeframe[] = ["15m", "1h", "4h", "1D"];

/** One candle; `t` in unix seconds, prices in USD, volume in USD. Oldest first. */
export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface TokenMarket {
  network: string;
  /** Pool address or v4 pool id, as GeckoTerminal names it. */
  pool: string;
  name: string;
  dex: string;
  priceUsd: number | null;
  change24h: number | null;
  volume24hUsd: number | null;
  reserveUsd: number | null;
}

const API = "https://api.geckoterminal.com/api/v2";
const TTL = 5 * 60_000;
const SPEC: Record<Timeframe, { unit: "minute" | "hour" | "day"; aggregate: number; limit: number }> = {
  "15m": { unit: "minute", aggregate: 15, limit: 96 },
  "1h": { unit: "hour", aggregate: 1, limit: 168 },
  "4h": { unit: "hour", aggregate: 4, limit: 180 },
  "1D": { unit: "day", aggregate: 1, limit: 180 },
};

type Entry<T> = { at: number; value: T };
const g = globalThis as unknown as {
  __gtMarkets?: Map<string, Entry<TokenMarket | null>>;
  __gtCandles?: Map<string, Entry<Candle[]>>;
};
const markets = (g.__gtMarkets ??= new Map());
const candles = (g.__gtCandles ??= new Map());

const num = (x: unknown): number | null => {
  const n = Number(x);
  return x !== null && x !== undefined && x !== "" && Number.isFinite(n) ? n : null;
};

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(API + path, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`GeckoTerminal HTTP ${response.status}`);
  return response.json();
}

/** The most liquid pool where `token` is the base token, or null when it has none. */
export async function tokenMarket(network: string, token: string): Promise<TokenMarket | null> {
  const key = `${network}:${token.toLowerCase()}`;
  const hit = markets.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  try {
    const json = (await getJson(`/networks/${network}/tokens/${token.toLowerCase()}/pools`)) as {
      data?: { id?: string; attributes?: Record<string, unknown>; relationships?: Record<string, { data?: { id?: string } }> }[];
    };
    const baseId = `${network}_${token.toLowerCase()}`;
    const pools = (json.data ?? [])
      .filter((p) => p.relationships?.base_token?.data?.id?.toLowerCase() === baseId)
      .map((p) => {
        const a = p.attributes ?? {};
        const change = (a.price_change_percentage as Record<string, unknown> | undefined)?.h24;
        const volume = (a.volume_usd as Record<string, unknown> | undefined)?.h24;
        return {
          network,
          pool: String(a.address ?? (p.id ?? "").replace(`${network}_`, "")),
          name: String(a.name ?? ""),
          dex: String(p.relationships?.dex?.data?.id ?? ""),
          priceUsd: num(a.base_token_price_usd),
          change24h: num(change),
          volume24hUsd: num(volume),
          reserveUsd: num(a.reserve_in_usd),
        } satisfies TokenMarket;
      })
      .filter((p) => /^0x([0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/.test(p.pool))
      .sort((a, b) => (b.reserveUsd ?? 0) - (a.reserveUsd ?? 0));
    const value = pools[0] ?? null;
    markets.set(key, { at: Date.now(), value });
    return value;
  } catch {
    return hit?.value ?? null;
  }
}

/** True when `pool` was returned by tokenMarket() in this process: only those can be charted. */
export function isKnownPool(network: string, pool: string): boolean {
  const wanted = pool.toLowerCase();
  for (const [key, entry] of markets) if (key.startsWith(`${network}:`) && entry.value?.pool.toLowerCase() === wanted) return true;
  return false;
}

/** Candles for a pool, oldest first. An empty list when the read fails and nothing is cached. */
export async function poolCandles(network: string, pool: string, timeframe: Timeframe): Promise<Candle[]> {
  const spec = SPEC[timeframe];
  const key = `${network}:${pool.toLowerCase()}:${timeframe}`;
  const hit = candles.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  try {
    const json = (await getJson(
      `/networks/${network}/pools/${pool.toLowerCase()}/ohlcv/${spec.unit}?aggregate=${spec.aggregate}&limit=${spec.limit}&currency=usd&token=base`,
    )) as { data?: { attributes?: { ohlcv_list?: unknown[][] } } };
    const list = json.data?.attributes?.ohlcv_list ?? [];
    const value: Candle[] = list
      .map((row) => ({ t: Number(row[0]), o: Number(row[1]), h: Number(row[2]), l: Number(row[3]), c: Number(row[4]), v: Number(row[5]) || 0 }))
      .filter((k) => [k.t, k.o, k.h, k.l, k.c].every(Number.isFinite))
      .sort((a, b) => a.t - b.t);
    candles.set(key, { at: Date.now(), value });
    return value;
  } catch {
    return hit?.value ?? [];
  }
}

export const isTimeframe = (x: unknown): x is Timeframe => TIMEFRAMES.includes(x as Timeframe);
export const geckoTerminalUrl = (network: string, pool: string) => `https://www.geckoterminal.com/${network}/pools/${pool}`;
