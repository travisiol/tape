import "server-only";
import { db, storageIsEphemeral } from "./db";
import { DAY, HOUR, MIN_SPAN_DAY, classifyThemes, hotTokens, isNewThisWeek, lifetimeDaily, measureRate, toUsd, type Prices, type Snap } from "./metrics";
import { isRefreshing, REFRESH_MINUTES } from "./refresh";
import type { BoardData, BoardRow, CoinDetail } from "./types";

interface CoinRecord {
  token: string;
  symbol: string;
  name: string;
  description: string;
  logo: string | null;
  graduated: number;
  launched_at: number | null;
  quote_symbol: string | null;
  market_cap: number | null;
  tracked: number;
  twitter: string | null;
  website: string | null;
  telegram: string | null;
}

interface RunRecord {
  at: number;
  finished_at: number | null;
  eth_usd: number | null;
  btc_usd: number | null;
  tracked: number | null;
  measured: number | null;
  error: string | null;
}

// Only snapshots of finished refreshes count: a refresh in progress would mix two moments.
const GOOD_RUNS = "SELECT at FROM runs WHERE finished_at IS NOT NULL AND error IS NULL";

function lastGoodRun(): RunRecord | null {
  return (db().prepare("SELECT * FROM runs WHERE finished_at IS NOT NULL AND error IS NULL ORDER BY at DESC LIMIT 1").get() as
    | RunRecord
    | undefined) ?? null;
}

function pricesOf(run: RunRecord | null): Prices {
  const prices: Prices = {};
  if (run?.eth_usd) prices.ETH = run.eth_usd;
  if (run?.btc_usd) prices.BTC = run.btc_usd;
  return prices;
}

function buildRow(coin: CoinRecord, snaps: Snap[], prices: Prices, now: number): BoardRow {
  const sorted = [...snaps].sort((a, b) => a.at - b.at);
  const latest = [...sorted].reverse().find((s) => s.fees !== null) ?? null;
  const feesTotal = latest?.fees ?? null;
  const feesTotalUsd = toUsd(feesTotal, coin.quote_symbol, prices);
  const hourRate = measureRate(sorted, HOUR + 5 * 60_000);
  const dayRate = measureRate(sorted, DAY + 30 * 60_000, MIN_SPAN_DAY);
  return {
    token: coin.token,
    symbol: coin.symbol,
    name: coin.name,
    description: coin.description,
    logo: coin.logo,
    graduated: coin.graduated === 1,
    launchedAt: coin.launched_at,
    quoteSymbol: coin.quote_symbol,
    marketCapUsd: coin.market_cap,
    tracked: coin.tracked === 1,
    themes: classifyThemes(coin.description),
    feesTotal,
    feesTotalUsd,
    fees1hUsd: hourRate ? toUsd(hourRate.perMs * HOUR, coin.quote_symbol, prices) : null,
    fees1hSpanMs: hourRate?.spanMs ?? null,
    feesDayUsd: dayRate ? toUsd(dayRate.perMs * DAY, coin.quote_symbol, prices) : null,
    feesDaySpanMs: dayRate?.spanMs ?? null,
    lifetimeDailyUsd: lifetimeDaily(feesTotalUsd, coin.launched_at, now),
    isNew: isNewThisWeek(coin.launched_at, now),
    hot: false,
    twitter: coin.twitter,
    website: coin.website,
    telegram: coin.telegram,
  };
}

/** The board: every tracked coin with its fee numbers, as of the last finished refresh. */
export function getBoard(): BoardData {
  const d = db();
  const run = lastGoodRun();
  const now = Date.now();
  const prices = pricesOf(run);
  // Coins read in the last finished refresh.
  const coins = d
    .prepare("SELECT c.* FROM coins c JOIN snapshots s ON s.token = c.token AND s.at = ? WHERE s.fees IS NOT NULL")
    .all(run?.at ?? -1) as unknown as CoinRecord[];
  const since = (run?.at ?? now) - DAY - HOUR;
  const snapRows = d.prepare(`SELECT token, at, fees FROM snapshots WHERE at >= ? AND at IN (${GOOD_RUNS})`).all(since) as {
    token: string;
    at: number;
    fees: number | null;
  }[];
  const byToken = new Map<string, Snap[]>();
  for (const s of snapRows) {
    const list = byToken.get(s.token) ?? [];
    list.push({ at: s.at, fees: s.fees });
    byToken.set(s.token, list);
  }
  const rows = coins.map((c) => buildRow(c, byToken.get(c.token) ?? [], prices, now)).filter((r) => r.feesTotal !== null);
  const hot = hotTokens(rows);
  for (const r of rows) r.hot = hot.has(r.token);
  const runs = (d.prepare("SELECT COUNT(*) AS n FROM runs WHERE finished_at IS NOT NULL AND error IS NULL").get() as { n: number }).n;
  return {
    rows,
    refreshedAt: run?.finished_at ?? null,
    snapshots: runs,
    refreshing: isRefreshing(),
    refreshMinutes: REFRESH_MINUTES,
    ethUsd: run?.eth_usd ?? null,
    ephemeral: storageIsEphemeral(),
  };
}

/** One coin, tracked or not, with its fee history. Null when the token is not in the launchpad catalog. */
export function getCoin(token: string): CoinDetail | null {
  const d = db();
  const key = token.toLowerCase();
  const coin = d.prepare("SELECT * FROM coins WHERE token = ?").get(key) as CoinRecord | undefined;
  if (!coin) return null;
  const run = lastGoodRun();
  const prices = pricesOf(run);
  const history = d.prepare(`SELECT at, fees, market_cap FROM snapshots WHERE token = ? AND at IN (${GOOD_RUNS}) ORDER BY at`).all(key) as {
    at: number;
    fees: number | null;
    market_cap: number | null;
  }[];
  const row = buildRow(coin, history.map((h) => ({ at: h.at, fees: h.fees })), prices, Date.now());
  const board = getBoard();
  row.hot = board.rows.some((r) => r.token === key && r.hot);
  return {
    row,
    history: history.filter((h) => h.fees !== null).map((h) => ({ at: h.at, fees: h.fees as number })),
    refreshedAt: run?.finished_at ?? null,
    quotePriceUsd: toUsd(1, coin.quote_symbol, prices),
  };
}

export function hasAnyData(): boolean {
  return lastGoodRun() !== null;
}
