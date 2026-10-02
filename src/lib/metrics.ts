// Pure logic behind every number on the board. No imports, no I/O: it runs the
// same in the server, in the browser and under `node --test`.

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Two snapshots closer than this are not compared: the rate would be noise. */
export const MIN_SPAN = 4 * MINUTE;
/** A per-day rate needs at least an hour of snapshots behind it. */
export const MIN_SPAN_DAY = HOUR;

/** "Hot" = among the top HOT_TOP coins by fees in the last hour, and at least HOT_MIN_USD in that hour. */
export const HOT_TOP = 5;
export const HOT_MIN_USD = 25;

/** Prices of quote assets in USD. A missing key means "unpriced": it is never guessed. */
export type Prices = Record<string, number | undefined>;

/** Quote assets that are dollars by construction. */
const DOLLARS = new Set(["USDG", "USDC", "USDT"]);
/** Quote assets that are the same asset as a priced one. */
const SAME_AS: Record<string, string> = { WETH: "ETH", cbBTC: "BTC", CBBTC: "BTC" };

export function priceOf(symbol: string | null | undefined, prices: Prices): number | null {
  if (!symbol) return null;
  if (DOLLARS.has(symbol.toUpperCase())) return 1;
  const key = SAME_AS[symbol] ?? symbol;
  const price = prices[key];
  return typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;
}

/** An amount of a quote asset in USD, or null when the asset has no real price. */
export function toUsd(amount: number | null | undefined, symbol: string | null | undefined, prices: Prices): number | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return null;
  const price = priceOf(symbol, prices);
  return price === null ? null : amount * price;
}

/** One reading of a coin's lifetime creator fees, in its quote asset. */
export interface Snap {
  at: number;
  fees: number | null;
}

export interface Rate {
  /** Quote-asset fees earned per millisecond across the span. */
  perMs: number;
  /** Length of the measured span, in milliseconds. */
  spanMs: number;
  /** Fees earned across the span, in the quote asset. */
  delta: number;
}

/**
 * Rate of fees between the latest snapshot and the oldest one inside `windowMs`
 * before it. Returns null when it cannot be measured yet: fewer than two
 * readings, a span shorter than MIN_SPAN, or a total that went down (bad read).
 */
export function measureRate(snaps: Snap[], windowMs: number, minSpan: number = MIN_SPAN): Rate | null {
  const readings = snaps.filter((s) => s.fees !== null && Number.isFinite(s.fees)).sort((a, b) => a.at - b.at);
  if (readings.length < 2) return null;
  const latest = readings[readings.length - 1];
  const base = readings.find((s) => s.at >= latest.at - windowMs);
  if (!base || base === latest) return null;
  const spanMs = latest.at - base.at;
  if (spanMs < minSpan) return null;
  const delta = (latest.fees as number) - (base.fees as number);
  if (delta < 0) return null;
  return { perMs: delta / spanMs, spanMs, delta };
}

/** Lifetime average per day: total fees divided by the coin's age in days, counting at least one day. */
export function lifetimeDaily(totalUsd: number | null, launchedAt: number | null, now: number): number | null {
  if (totalUsd === null || launchedAt === null || !Number.isFinite(launchedAt)) return null;
  const age = Math.max(now - launchedAt, DAY);
  return totalUsd / (age / DAY);
}

export function isNewThisWeek(launchedAt: number | null, now: number): boolean {
  return launchedAt !== null && now - launchedAt >= 0 && now - launchedAt < 7 * DAY;
}

// A rough reading of the coin's own description. A coin can sit in several themes.
export const THEMES: Record<string, RegExp> = {
  "AI agents": /\bagents?\b/i,
  "AI credits / models": /\b(credits?|inference|openrouter|models?|llm|compute|api)\b/i,
  "Tokenized stocks": /\b(stocks?|equit|rwa|tokenized|etf|dividend|shares?)\b/i,
  Prediction: /\b(predict|bet|odds|rounds?|casino|wager)/i,
  Launchpads: /\blaunch(pad|er)?\b/i,
  "Pays holders": /\b(holders?|stakers?)\b.*\b(earn|paid|pays?|reward|profit|share)|\b(earn|rewards?|pays?)\b.*\bholders?\b/i,
  "Lending / yield": /\b(lend|borrow|yield|vault|neobank|loan)/i,
  "Trading tools": /\b(terminal|bot|scanner|sniper|analysis|aggregat|liquidity)/i,
  Games: /\b(game|play|pvp|arena|battle)/i,
};

export const THEME_NAMES = Object.keys(THEMES);

export function classifyThemes(description: string | null | undefined): string[] {
  const text = (description ?? "").trim();
  if (!text) return [];
  return THEME_NAMES.filter((name) => THEMES[name].test(text));
}

export interface HotCandidate {
  token: string;
  fees1hUsd: number | null;
}

/** Tokens marked HOT: the top HOT_TOP by fees in the last hour, each with at least HOT_MIN_USD. */
export function hotTokens(rows: HotCandidate[], top: number = HOT_TOP, minUsd: number = HOT_MIN_USD): Set<string> {
  return new Set(
    rows
      .filter((r) => r.fees1hUsd !== null && r.fees1hUsd >= minUsd)
      .sort((a, b) => (b.fees1hUsd as number) - (a.fees1hUsd as number))
      .slice(0, top)
      .map((r) => r.token),
  );
}

export type SortDir = "asc" | "desc";

/** Sort by a numeric or text field. Missing values always go last, whatever the direction. */
export function sortRows<T>(rows: T[], key: keyof T, dir: SortDir): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a[key] as unknown;
    const y = b[key] as unknown;
    const xMissing = x === null || x === undefined || (typeof x === "number" && !Number.isFinite(x));
    const yMissing = y === null || y === undefined || (typeof y === "number" && !Number.isFinite(y));
    if (xMissing && yMissing) return 0;
    if (xMissing) return 1;
    if (yMissing) return -1;
    if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
    return String(x).localeCompare(String(y), "en", { sensitivity: "base" }) * sign;
  });
}

/** Share of a total, in whole percent; 0 when the total is 0. */
export function sharePct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
