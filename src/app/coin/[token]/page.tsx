import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FeesChart } from "@/components/FeesChart";
import { StarButton } from "@/components/Wallet";
import { getCoin } from "@/lib/board";
import { PriceChart } from "@/components/PriceChart";
import { geckoTerminalUrl, poolCandles, tokenMarket } from "@/lib/geckoterminal";
import { age, ago, amount, formatPrice, span, usd } from "@/lib/format";
import { HOT_MIN_USD, HOT_TOP } from "@/lib/metrics";
import { LAUNCHPAD, SITE, dexPageUrl, explorerToken } from "@/lib/site-config";

export const dynamic = "force-dynamic";

const serverNow = () => Date.now();
const isAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);

export async function generateMetadata(props: PageProps<"/coin/[token]">): Promise<Metadata> {
  const { token } = await props.params;
  const coin = isAddress(token) ? getCoin(token) : null;
  return { title: coin ? `${coin.row.symbol} — creator fees on ${SITE.name}` : SITE.name };
}

export default async function CoinPage(props: PageProps<"/coin/[token]">) {
  const { token } = await props.params;
  if (!isAddress(token)) notFound();
  const coin = getCoin(token);
  if (!coin) notFound();
  const { row, history } = coin;
  const market = await tokenMarket("robinhood", row.token);
  const now = serverNow();
  // A coin younger than two days reads better in 15-minute candles.
  const firstFrame = row.launchedAt !== null && now - row.launchedAt < 2 * 86_400_000 ? "15m" : "1h";
  const candles = market ? await poolCandles("robinhood", market.pool, firstFrame) : [];
  const notRead = row.feesTotal === null;
  const unpriced = row.feesTotal !== null && row.feesTotalUsd === null;
  const NA = "Not measurable yet";
  const why = notRead ? "TAPE does not read this coin's fees." : unpriced ? `Quoted in ${row.quoteSymbol}, which TAPE does not price.` : null;

  const metrics: { label: string; value: string; note: string; wide?: boolean; change?: number | null }[] = [
    {
      label: "Price",
      value: market?.priceUsd ? formatPrice(market.priceUsd) : "No market yet",
      change: market?.change24h ?? null,
      note: market ? `${market.name} · GeckoTerminal, updated every 5 min.` : "No pool trades this coin yet.",
      wide: true,
    },
    {
      label: "Fees 1h",
      value: row.fees1hUsd !== null ? usd(row.fees1hUsd) : NA,
      note: row.fees1hUsd !== null ? `Over ${span(row.fees1hSpanMs)} of snapshots.` : (why ?? "Needs a second snapshot."),
    },
    {
      label: "Fees / day",
      value: row.feesDayUsd !== null ? usd(row.feesDayUsd) : NA,
      note: row.feesDayUsd !== null ? `Over ${span(row.feesDaySpanMs)} of snapshots.` : (why ?? "Needs an hour of snapshots."),
    },
    { label: "Lifetime / day", value: row.lifetimeDailyUsd !== null ? usd(row.lifetimeDailyUsd) : NA, note: why ?? "Total fees ÷ age." },
    {
      label: "Fees total",
      value: unpriced ? amount(row.feesTotal, row.quoteSymbol) : row.feesTotalUsd !== null ? usd(row.feesTotalUsd) : NA,
      note: notRead ? (why as string) : `${amount(row.feesTotal, row.quoteSymbol)} since launch.`,
    },
    { label: "Market cap", value: usd(row.marketCapUsd), note: `Launchpad · updated ${ago(coin.refreshedAt, now)}.` },
    { label: "Age", value: age(row.launchedAt, now), note: row.launchedAt ? `Launched ${new Date(row.launchedAt).toISOString().slice(0, 10)}.` : "" },
  ];

  const links = [
    { label: "Trade on Pons", href: LAUNCHPAD.coinUrl(row.token), primary: true },
    { label: "Explorer", href: explorerToken(row.token) },
    row.twitter ? { label: "X", href: row.twitter } : null,
    row.website ? { label: "Website", href: row.website } : null,
    row.telegram ? { label: "Telegram", href: row.telegram } : null,
  ].filter(Boolean) as { label: string; href: string; primary?: boolean }[];

  const logo = LAUNCHPAD.logoUrl(row.logo);

  return (
    <div className="wrap pt-2">
      <Link href="/#board" className="text-[14px] font-bold text-muted hover:text-ink">
        ← All coins
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {logo ? (
          <img src={logo} alt="" width={56} height={56} className="h-14 w-14 rounded-full bg-soft object-cover" />
        ) : (
          <span className="grid h-14 w-14 place-items-center rounded-full bg-soft text-[22px] font-black text-muted">{Array.from(row.symbol)[0] ?? ""}</span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="display text-[40px] sm:text-[52px]">{row.symbol}</h1>
            {row.hot && (
              <span className="hot-tag !h-6 !px-2.5 !text-[12px]" title={`Top ${HOT_TOP} by fees in the last hour, at least $${HOT_MIN_USD}.`}>
                HOT
              </span>
            )}
            <StarButton token={row.token} symbol={row.symbol} />
          </div>
          <p className="text-[15px] text-muted">
            {row.name} · {row.graduated ? "graduated" : "on the bonding curve"} · <span className="num text-[13px]">{row.token}</span>
          </p>
        </div>
      </div>
      {row.description && <p className="mt-4 max-w-[760px] text-[16px]">{row.description}</p>}
      {row.themes.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-1.5" title="A rough reading of the coin's own description, by keywords.">
          {row.themes.map((t) => (
            <span key={t} className="rounded-full bg-soft px-3 py-1 text-[13px] font-bold text-muted">
              {t}
            </span>
          ))}
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <section className="card overflow-hidden">
          {market ? (
            <PriceChart
              pool={market.pool}
              initial={candles}
              initialTimeframe={firstFrame}
              title={`${row.symbol} price`}
              links={[
                { label: "DexScreener", href: dexPageUrl(market.pool) },
                { label: "GeckoTerminal", href: geckoTerminalUrl("robinhood", market.pool) },
              ]}
            />
          ) : (
            <>
              <h2 className="px-5 py-3.5 text-[16px] font-black">Price</h2>
              <div className="grid h-[300px] place-items-center bg-soft px-6 text-center text-[15px] text-muted">No market for this coin yet.</div>
            </>
          )}
        </section>

        <aside className="grid content-start gap-3">
          <div className="card grid grid-cols-2 gap-px overflow-hidden bg-line">
            {metrics.map((m) => (
              <div key={m.label} className={`bg-surface px-4 py-3.5 ${m.wide ? "col-span-2" : ""}`}>
                <p className="label">{m.label}</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                  <span className={`bignum leading-none ${m.value === NA || m.value === "No market yet" ? "text-[17px] text-muted" : m.wide ? "text-[32px]" : "text-[26px]"}`}>
                    {m.value}
                  </span>
                  {m.change !== undefined && m.change !== null && (
                    <span className={`num text-[14px] font-bold ${m.change >= 0 ? "text-up" : "text-down"}`}>
                      {m.change >= 0 ? "+" : ""}
                      {m.change.toFixed(1)}% 24h
                    </span>
                  )}
                </p>
                <p className="mt-1.5 text-[12px] leading-snug text-muted">{m.note}</p>
              </div>
            ))}
          </div>
          <div className="card grid gap-2 p-3">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className={`flex h-11 items-center justify-between rounded-xl px-4 text-[15px] font-bold ${l.primary ? "bg-accent text-ink" : "bg-soft hover:bg-hot"}`}
              >
                {l.label}
                <span aria-hidden>↗</span>
              </a>
            ))}
          </div>
        </aside>
      </div>

      <section className="card mt-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[16px] font-black">Fees over time</h2>
          <p className="text-[13px] text-muted">
            Lifetime creator fees in {row.quoteSymbol ?? "the quote asset"}, as read by {SITE.name} at each refresh
            {coin.quotePriceUsd ? ` · 1 ${row.quoteSymbol} = ${usd(coin.quotePriceUsd, { compact: false })}` : ""}
          </p>
        </div>
        <div className="mt-4">
          <FeesChart history={history} quote={row.quoteSymbol} />
        </div>
      </section>
    </div>
  );
}
