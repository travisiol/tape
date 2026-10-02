"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { setHash, useHash, useNow } from "@/lib/client-stores";
import { age, ago, amount, span, usd } from "@/lib/format";
import { HOT_MIN_USD, HOT_TOP, THEME_NAMES, sortRows, type SortDir } from "@/lib/metrics";
import { LAUNCHPAD } from "@/lib/site-config";
import type { BoardData, BoardRow } from "@/lib/types";
import { setDialog, useWallet } from "@/lib/wallet";
import { StarButton } from "./Wallet";

type Key = "fees1hUsd" | "feesDayUsd" | "lifetimeDailyUsd" | "feesTotalUsd" | "marketCapUsd" | "launchedAt" | "symbol";

const COLUMNS: { key: Key; label: string; tip: string }[] = [
  { key: "fees1hUsd", label: "Fees 1h", tip: "Creator fees earned in the last hour, in USD, measured between TAPE's own snapshots." },
  { key: "feesDayUsd", label: "Fees / day", tip: "Creator fees per day, measured between TAPE's snapshots over the last 24 hours (at least one hour of snapshots)." },
  { key: "lifetimeDailyUsd", label: "Lifetime / day", tip: "Lifetime average: all creator fees earned so far, divided by the coin's age in days (at least one day)." },
  { key: "feesTotalUsd", label: "Fees total", tip: "All creator fees the coin has earned since launch, converted to USD at the current price of its quote asset." },
  { key: "marketCapUsd", label: "Market cap", tip: "Market cap as reported by the launchpad at the last refresh." },
  { key: "launchedAt", label: "Age", tip: "Time since launch." },
];

const GRID = "grid grid-cols-[44px_minmax(210px,1.7fr)_repeat(6,minmax(96px,1fr))_150px_128px] items-center";
const PENDING = "Measured from the next refresh.";
const PENDING_DAY = "Measured once TAPE's snapshots of this coin span an hour.";

function themeSlug(name: string) {
  return "theme-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function rateTitle(row: BoardRow, spanMs: number | null, value: number | null, pending: string = PENDING): string {
  if (value !== null) return `Measured over ${span(spanMs)} of snapshots.`;
  if (row.feesTotal !== null && row.feesTotalUsd === null) return `Quoted in ${row.quoteSymbol ?? "an asset"} that TAPE does not price.`;
  return pending;
}

export function Board({ initial }: { initial: BoardData }) {
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: Key; dir: SortDir } | null>(null);
  const hash = useHash();
  const now = useNow();
  const wallet = useWallet();
  const router = useRouter();

  // The board is re-read from TAPE's own snapshots every minute (never from upstream per visitor).
  useEffect(() => {
    const id = setInterval(() => {
      fetch("/api/board")
        .then((r) => (r.ok ? r.json() : null))
        .then((next: BoardData | null) => {
          if (next) setData(next);
        })
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const rows = data.rows;
  const hasHourly = rows.some((r) => r.fees1hUsd !== null);
  const themeCounts = useMemo(
    () => THEME_NAMES.map((name) => ({ name, slug: themeSlug(name), count: rows.filter((r) => r.themes.includes(name)).length })),
    [rows],
  );

  const tabs = [
    { id: "", label: "All", count: rows.length },
    { id: "hot", label: "Hot this hour", count: rows.filter((r) => r.hot).length },
    { id: "new", label: "New this week", count: rows.filter((r) => r.isNew).length },
    { id: "watchlist", label: "Watchlist", count: wallet.address ? wallet.watch.length : null },
    ...themeCounts.filter((t) => t.count > 0).map((t) => ({ id: t.slug, label: t.name, count: t.count })),
  ];
  const tab = tabs.some((t) => t.id === hash) ? hash : "";

  const visible = useMemo(() => {
    let list = rows;
    if (tab === "hot") list = list.filter((r) => r.hot);
    else if (tab === "new") list = list.filter((r) => r.isNew);
    else if (tab === "watchlist") list = list.filter((r) => wallet.watch.includes(r.token));
    else if (tab.startsWith("theme-")) {
      const theme = themeCounts.find((t) => t.slug === tab)?.name;
      list = list.filter((r) => theme && r.themes.includes(theme));
    }
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((r) => r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.token.includes(q));
    const active = sort ?? { key: (hasHourly ? "fees1hUsd" : "lifetimeDailyUsd") as Key, dir: "desc" as SortDir };
    return sortRows(list, active.key, active.dir);
  }, [rows, tab, query, sort, hasHourly, wallet.watch, themeCounts]);

  const activeKey = sort?.key ?? (hasHourly ? "fees1hUsd" : "lifetimeDailyUsd");
  const activeDir = sort?.dir ?? "desc";
  const onSort = (key: Key) =>
    setSort((s) => (s?.key === key || (!s && key === activeKey) ? { key, dir: activeDir === "desc" ? "asc" : "desc" } : { key, dir: key === "symbol" ? "asc" : "desc" }));

  const nextDue = data.refreshedAt ? data.refreshedAt + data.refreshMinutes * 60_000 : null;

  return (
    <section id="board" className="wrap scroll-mt-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="scroll-x -mx-4 flex gap-1 px-4 md:mx-0 md:px-0" role="tablist" aria-label="Board views">
          {tabs.map((t) => (
            <button key={t.id || "all"} type="button" role="tab" aria-selected={tab === t.id} className="tab" onClick={() => setHash(t.id)}>
              {t.label}
              {t.count !== null && <span className="num ml-1.5 text-[12px] opacity-60">{t.count}</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden whitespace-nowrap text-[13px] text-muted lg:block" suppressHydrationWarning>
            {data.refreshedAt ? <>Updated {ago(data.refreshedAt, now)}</> : data.refreshing ? "Reading the launchpad…" : "Waiting for the first refresh"}
          </p>
          <label className="relative block w-full md:w-[240px]">
            <span className="sr-only">Search coins</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbol, name or address"
              className="h-10 w-full rounded-full border border-line bg-surface pl-4 pr-4 text-[14px] outline-none placeholder:text-muted focus:border-ink"
            />
          </label>
        </div>
      </div>

      <div className="scroll-x mt-3 -mx-4 px-4 pb-2 md:mx-0 md:px-0">
        <div className="min-w-[1170px]">
          <div className={`${GRID} h-9 px-0 text-[12px] font-bold uppercase tracking-[0.04em] text-muted`} role="row">
            <span className="pl-4">#</span>
            <button type="button" onClick={() => onSort("symbol")} className="sticky left-0 z-10 bg-paper pl-1 text-left uppercase">
              Coin {activeKey === "symbol" ? (activeDir === "asc" ? "↑" : "↓") : ""}
            </button>
            {COLUMNS.map((c) => (
              <button key={c.key} type="button" onClick={() => onSort(c.key)} title={c.tip} className="pr-4 text-right uppercase hover:text-ink">
                <span className={activeKey === c.key ? "text-ink" : ""}>
                  {c.label}
                  {activeKey === c.key ? (activeDir === "desc" ? " ↓" : " ↑") : ""}
                </span>
              </button>
            ))}
            <span className="pl-4" title="A rough reading of the coin's own description, by keywords.">
              <span className="tip">Theme</span>
            </span>
            <span className="pr-4 text-right">Open</span>
          </div>

          {rows.length === 0 ? (
            <div className="card grid place-items-center px-6 py-16 text-center">
              <p className="text-[17px] font-bold">{data.refreshing ? "Reading fees from the launchpad…" : "No coins yet."}</p>
              <p className="mt-1 max-w-[420px] text-[14px] text-muted">
                The first refresh reads every coin traded in the last three days, one at a time. This page fills in when it finishes.
              </p>
            </div>
          ) : visible.length === 0 ? (
            <EmptyTab tab={tab} query={query} connected={Boolean(wallet.address)} hasHourly={hasHourly} />
          ) : (
            <ol className="grid gap-1.5">
              {visible.map((row, i) => (
                <li
                  key={row.token}
                  className={`row ${row.hot ? "row-hot" : ""} ${GRID} h-14 cursor-pointer`}
                  onClick={() => router.push(`/coin/${row.token}`)}
                >
                  <span className="num pl-4 text-[13px] text-muted">{i + 1}</span>
                  <div className={`sticky left-0 z-10 flex min-w-0 items-center gap-2.5 py-1 pl-1 bg-surface`}>
                    <CoinLogo logo={row.logo} symbol={row.symbol} />
                    <Link href={`/coin/${row.token}`} className="min-w-0" onClick={(e) => e.stopPropagation()}>
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[15px] font-bold">{row.symbol || "—"}</span>
                        {row.hot && (
                          <span className="hot-tag" title={`Top ${HOT_TOP} by fees in the last hour, with at least $${HOT_MIN_USD} earned in that hour.`}>
                            HOT
                          </span>
                        )}
                      </span>
                      <span className="block max-w-[150px] truncate text-[12px] text-muted">{row.name}</span>
                    </Link>
                    <StarButton token={row.token} symbol={row.symbol} />
                  </div>
                  <Cell value={row.fees1hUsd} title={rateTitle(row, row.fees1hSpanMs, row.fees1hUsd)} strong />
                  <Cell value={row.feesDayUsd} title={rateTitle(row, row.feesDaySpanMs, row.feesDayUsd, PENDING_DAY)} />
                  <Cell
                    value={row.lifetimeDailyUsd}
                    title={row.lifetimeDailyUsd === null ? rateTitle(row, null, null) : "Lifetime average: total fees ÷ age in days (at least one day)."}
                  />
                  {row.feesTotalUsd === null && row.feesTotal !== null ? (
                    <span className="num pr-4 text-right text-[13px] text-muted" title={`Quoted in ${row.quoteSymbol}; TAPE does not price it.`}>
                      {amount(row.feesTotal, row.quoteSymbol)}
                    </span>
                  ) : (
                    <Cell value={row.feesTotalUsd} title={amount(row.feesTotal, row.quoteSymbol)} />
                  )}
                  <Cell value={row.marketCapUsd} title="Market cap at the last refresh." />
                  <span className="num pr-4 text-right text-[13px]" suppressHydrationWarning>
                    {age(row.launchedAt, now)}
                  </span>
                  <span className="truncate pl-4 pr-2 text-[13px] text-muted" title="A rough reading of the coin's own description, by keywords.">
                    {row.themes[0] ?? "—"}
                    {row.themes.length > 1 && <span className="num text-[11px]"> +{row.themes.length - 1}</span>}
                  </span>
                  <span className="flex justify-end gap-1 pr-3" onClick={(e) => e.stopPropagation()}>
                    <a href={LAUNCHPAD.coinUrl(row.token)} target="_blank" rel="noreferrer" title="Trade on Pons" className="whitespace-nowrap rounded-full bg-soft px-2.5 py-1 text-[12px] font-bold hover:bg-accent">
                      Pons ↗
                    </a>
                    {row.twitter && (
                      <a href={row.twitter} target="_blank" rel="noreferrer" title="X" className="whitespace-nowrap rounded-full bg-soft px-2.5 py-1 text-[12px] font-bold hover:bg-accent">
                        X ↗
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      <p className="mt-3 text-[13px] text-muted" suppressHydrationWarning>
        {rows.length > 0 && (
          <>
            {rows.length} coins traded in the last three days · creator fees read every {data.refreshMinutes} minutes
            {nextDue && now > 0 ? ` · next refresh ${nextDue > now ? `in ${Math.max(1, Math.round((nextDue - now) / 60_000))} min` : "due now"}` : ""} ·{" "}
            <Link href="/about" className="underline underline-offset-2 hover:text-ink">
              how this is measured
            </Link>
          </>
        )}
      </p>
    </section>
  );
}

function Cell({ value, title, strong = false }: { value: number | null; title: string; strong?: boolean }) {
  return (
    <span className={`num pr-4 text-right text-[13px] ${strong && value !== null ? "font-bold" : ""} ${value === null ? "text-muted" : ""}`} title={title}>
      {usd(value)}
    </span>
  );
}

function CoinLogo({ logo, symbol }: { logo: string | null; symbol: string }) {
  const src = LAUNCHPAD.logoUrl(logo);
  if (!src) {
    return (
      <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-soft text-[12px] font-black text-muted" aria-hidden>
        {Array.from(symbol)[0] ?? ""}
      </span>
    );
  }
  return (
    <span className="relative grid h-8 w-8 flex-none place-items-center overflow-hidden rounded-full bg-soft text-[12px] font-black text-muted">
      <span aria-hidden>{Array.from(symbol)[0] ?? ""}</span>
      <img
        src={src}
        alt=""
        width={32}
        height={32}
        loading="lazy"
        className="absolute inset-0 h-8 w-8 object-cover"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    </span>
  );
}

function EmptyTab({ tab, query, connected, hasHourly }: { tab: string; query: string; connected: boolean; hasHourly: boolean }) {
  let title = "Nothing matches.";
  let body: React.ReactNode = query ? `No coin matches “${query}”.` : "No coin in this view right now.";
  if (tab === "watchlist" && !connected) {
    title = "Your watchlist";
    body = (
      <>
        Connect a wallet, then star coins to keep them here.{" "}
        <button type="button" onClick={() => setDialog(true)} className="font-bold text-ink underline underline-offset-2">
          Connect
        </button>
      </>
    );
  } else if (tab === "watchlist" && !query) {
    title = "No coin starred yet.";
    body = "Star a coin on the board to add it here.";
  } else if (tab === "hot" && !query) {
    title = hasHourly ? "No coin is hot right now." : "Hourly fees are not measured yet.";
    body = hasHourly
      ? `A coin is hot when it is in the top ${HOT_TOP} by fees in the last hour and earned at least $${HOT_MIN_USD} in it.`
      : "Fees in the last hour are measured between two refreshes. They appear after the next one.";
  }
  return (
    <div className="card grid place-items-center px-6 py-14 text-center">
      <p className="text-[17px] font-bold">{title}</p>
      <p className="mt-1 max-w-[440px] text-[14px] text-muted">{body}</p>
    </div>
  );
}
