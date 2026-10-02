import "server-only";
import { db } from "./db";
import { activeByVolume, creatorFees, graduatedCatalog, spotUsd, tokenLinks, type CatalogCoin } from "./pons";
import { DAY, MINUTE } from "./metrics";

/** Minutes between two refreshes. Never less than 5, so the public endpoints are read politely. */
export const REFRESH_MINUTES = Math.max(5, Number(process.env.TAPE_REFRESH_MINUTES) || 10);
/** Coins whose fees are read each refresh: traded in the last 3 days, the biggest by market cap. */
export const TRACK_WINDOW = 3 * DAY;
export const TRACK_LIMIT = Math.max(20, Number(process.env.TAPE_TRACK_LIMIT) || 150);
/** Live coins never read before, added per refresh until every live coin has been read once. */
export const DISCOVER_PER_RUN = 60;
/** Pause between two per-coin reads. */
const GAP_MS = 250;
/** Launchpad pages read for links per refresh (each coin's links are re-read once a day). */
const LINKS_PER_RUN = 25;

type State = { running: Promise<void> | null; timer: ReturnType<typeof setInterval> | null; lastStart: number };
const g = globalThis as unknown as { __tapeRefresh?: State };
const state: State = (g.__tapeRefresh ??= { running: null, timer: null, lastStart: 0 });

const ms = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : null;
};
const sleep = (n: number) => new Promise((resolve) => setTimeout(resolve, n));

async function runOnce(): Promise<void> {
  const d = db();
  const at = Date.now();
  d.prepare("INSERT OR REPLACE INTO runs (at) VALUES (?)").run(at);
  try {
    const [graduated, active, ethUsd, btcUsd] = await Promise.all([
      graduatedCatalog(),
      activeByVolume("24h", 50),
      spotUsd("ETH-USD"),
      spotUsd("BTC-USD"),
    ]);
    const seen = new Set<string>();
    const all: CatalogCoin[] = [];
    for (const coin of [...graduated, ...active]) {
      const key = coin.token?.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      all.push(coin);
    }

    // Fees are one request per coin, so only for coins that trade. Older launches
    // (no quote asset in the catalog) are not readable by the fee endpoint.
    const measurable = (c: CatalogCoin) => Boolean(c.quoteAsset?.symbol);
    const live = all
      .filter((c) => measurable(c) && at - (ms(c.latestBuyAt) ?? 0) < TRACK_WINDOW)
      .sort((a, b) => (b.marketCapUsd ?? 0) - (a.marketCapUsd ?? 0));
    const liveKeys = new Set(live.map((c) => c.token.toLowerCase()));
    // 1. the biggest live coins by market cap, 2. the most traded coins still on the curve,
    const trackedSet = new Set(live.slice(0, TRACK_LIMIT).map((c) => c.token.toLowerCase()));
    for (const c of active) if (measurable(c)) trackedSet.add(c.token.toLowerCase());
    // 3. every live coin already seen earning fees (small caps can earn a lot),
    const lastReads = d
      .prepare(
        `SELECT s.token, s.fees FROM snapshots s
         WHERE s.fees > 0 AND s.at = (SELECT MAX(at) FROM snapshots WHERE token = s.token AND fees IS NOT NULL)`,
      )
      .all() as { token: string; fees: number }[];
    for (const r of lastReads) if (liveKeys.has(r.token)) trackedSet.add(r.token);
    // 4. and a batch of live coins never read yet, so the whole live set is covered within a few refreshes.
    const readOnce = new Set((d.prepare("SELECT DISTINCT token FROM snapshots").all() as { token: string }[]).map((r) => r.token));
    let discovery = 0;
    for (const c of live) {
      const key = c.token.toLowerCase();
      if (discovery >= DISCOVER_PER_RUN) break;
      if (trackedSet.has(key) || readOnce.has(key)) continue;
      trackedSet.add(key);
      discovery++;
    }

    const upsert = d.prepare(`
      INSERT INTO coins (token, symbol, name, description, logo, graduated, launched_at, quote_symbol, market_cap, latest_buy_at, tracked, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(token) DO UPDATE SET
        symbol = excluded.symbol, name = excluded.name, description = excluded.description, logo = excluded.logo,
        graduated = excluded.graduated, launched_at = excluded.launched_at, quote_symbol = excluded.quote_symbol,
        market_cap = excluded.market_cap, latest_buy_at = excluded.latest_buy_at, tracked = excluded.tracked,
        updated_at = excluded.updated_at`);
    d.exec("BEGIN");
    for (const c of all) {
      const key = c.token.toLowerCase();
      upsert.run(
        key,
        c.symbol ?? "",
        c.name ?? "",
        (c.description ?? "").trim(),
        c.logo ?? null,
        c.graduated ? 1 : 0,
        ms(c.launchedAt),
        c.quoteAsset?.symbol ?? null,
        typeof c.marketCapUsd === "number" ? c.marketCapUsd : null,
        ms(c.latestBuyAt),
        trackedSet.has(key) ? 1 : 0,
        at,
      );
    }
    d.exec("COMMIT");

    const snap = d.prepare("INSERT OR REPLACE INTO snapshots (token, at, market_cap, fees) VALUES (?, ?, ?, ?)");
    const byKey = new Map(all.map((c) => [c.token.toLowerCase(), c]));
    let measured = 0;
    let failed = 0;
    for (const key of trackedSet) {
      const coin = byKey.get(key);
      let fees: number | null = null;
      try {
        fees = (await creatorFees(key)).earned;
        measured++;
      } catch {
        failed++;
      }
      snap.run(key, at, typeof coin?.marketCapUsd === "number" ? coin.marketCapUsd : null, fees);
      await sleep(GAP_MS);
    }

    const stale = d
      .prepare(
        "SELECT token FROM coins WHERE tracked = 1 AND (links_checked_at IS NULL OR links_checked_at < ?) ORDER BY market_cap DESC LIMIT ?",
      )
      .all(at - DAY, LINKS_PER_RUN) as { token: string }[];
    const saveLinks = d.prepare("UPDATE coins SET website = ?, twitter = ?, telegram = ?, links_checked_at = ? WHERE token = ?");
    for (const { token } of stale) {
      try {
        const links = await tokenLinks(token);
        saveLinks.run(links.website, links.twitter, links.telegram, at, token);
      } catch {
        // retried on the next refresh
      }
      await sleep(GAP_MS);
    }

    d.prepare("DELETE FROM snapshots WHERE at < ?").run(at - 30 * DAY);
    d.prepare(
      "UPDATE runs SET finished_at = ?, eth_usd = ?, btc_usd = ?, catalog = ?, tracked = ?, measured = ?, failed = ? WHERE at = ?",
    ).run(Date.now(), ethUsd, btcUsd, all.length, trackedSet.size, measured, failed, at);
    console.log(`[tape] refresh: ${all.length} coins, fees read for ${measured}/${trackedSet.size}${failed ? `, ${failed} failed` : ""}`);
  } catch (error) {
    try {
      d.exec("ROLLBACK");
    } catch {
      // no open transaction
    }
    const message = error instanceof Error ? error.message : String(error);
    d.prepare("UPDATE runs SET finished_at = ?, error = ? WHERE at = ?").run(Date.now(), message, at);
    console.error(`[tape] refresh failed: ${message}`);
  }
}

/** Start a refresh unless one is running or the last one started less than `minGapMs` ago. */
export function refresh(minGapMs: number = REFRESH_MINUTES * MINUTE): Promise<void> | null {
  if (state.running) return state.running;
  // A run left unfinished by a stopped server does not count; it is marked and retried.
  db().prepare("UPDATE runs SET finished_at = at, error = 'interrupted' WHERE finished_at IS NULL").run();
  const lastRun = db().prepare("SELECT MAX(at) AS at FROM runs WHERE error IS NULL").get() as { at: number | null };
  const last = Math.max(state.lastStart, lastRun?.at ?? 0);
  if (Date.now() - last < minGapMs) return null;
  state.lastStart = Date.now();
  state.running = runOnce().finally(() => {
    state.running = null;
  });
  return state.running;
}

export function isRefreshing(): boolean {
  return state.running !== null;
}

/** The background loop: one refresh now (if due), then one every REFRESH_MINUTES. */
export function startRefreshLoop(): void {
  if (state.timer) return;
  refresh();
  state.timer = setInterval(() => refresh(), MINUTE);
}

