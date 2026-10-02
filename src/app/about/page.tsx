import type { Metadata } from "next";
import { HOT_MIN_USD, HOT_TOP } from "@/lib/metrics";
import { DISCOVER_PER_RUN, REFRESH_MINUTES, TRACK_LIMIT } from "@/lib/refresh";
import { SITE } from "@/lib/site-config";
import { storageIsEphemeral } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `How it works — ${SITE.name}` };

export default function AboutPage() {
  const ephemeral = storageIsEphemeral();
  return (
    <div className="wrap pt-4">
      <article className="prose-tape max-w-[720px]">
        <h1 className="display text-[44px] sm:text-[60px]">How the numbers are measured</h1>
        <p className="!text-[17px]">
          {SITE.name} ranks the coins launched on Robinhood Chain&apos;s launchpad (Pons) by the creator fees they really earn. Every
          number comes from a public source or from {SITE.name}&apos;s own snapshots. Nothing is estimated.
        </p>

        <h2>Sources</h2>
        <p>
          <strong>Coins</strong> — name, symbol, description, market cap, launch date and graduation come from the launchpad&apos;s public
          catalog. <strong>Creator fees</strong> come from the launchpad&apos;s per-coin fee endpoint: the lifetime total the coin has
          earned, in its quote asset. <strong>Links</strong> (X, website, Telegram) are the ones the creator attached on the launchpad.{" "}
          <strong>Prices</strong>: ETH and BTC from Coinbase&apos;s public spot price; USDG counts as one dollar. Coins quoted in other
          assets (for example a stock token) are shown in that asset and marked as not priced — never converted with a guess.{" "}
          <strong>Price charts</strong> on coin pages are drawn by {SITE.name} from GeckoTerminal&apos;s public candles for the coin&apos;s most liquid pool, read at most once every 5 minutes.
        </p>

        <h2>Refresh</h2>
        <p>
          The server reads the catalog once every {REFRESH_MINUTES} minutes, then the fees of each tracked coin one at a time with a pause
          between requests. Visitors never trigger upstream requests: pages read {SITE.name}&apos;s own database. The board covers coins
          traded in the last three days: at each refresh {SITE.name} reads the {TRACK_LIMIT} biggest by market cap, the 50 most traded
          coins still on the curve, every coin it has already seen earn fees, and {DISCOVER_PER_RUN} coins it has never read, so the
          whole set is covered within a few refreshes. Older launches that the fee endpoint does not cover are left out.
        </p>

        <h2>What the columns mean</h2>
        <p>
          <strong>Fees 1h</strong> — fees earned between the latest snapshot and the oldest one within the last hour, scaled to one hour.{" "}
          <strong>Fees / day</strong> — the same over the last 24 hours, scaled to one day. Fees 1h needs two snapshots at least four
          minutes apart, fees / day snapshots spanning at least an hour; until then the cell shows “—”. Hover a figure to see the span it was measured over. <strong>Lifetime / day</strong> —
          all fees so far divided by the coin&apos;s age in days (a coin younger than a day counts as one day), available from the first snapshot. <strong>Fees total</strong> — lifetime fees
          at the current price of the quote asset.
        </p>
        <p>
          <strong>Hot</strong> — a coin is hot when it is in the top {HOT_TOP} by fees in the last hour and earned at least $
          {HOT_MIN_USD} in that hour. <strong>New this week</strong> — launched less than seven days ago. <strong>Themes</strong> — a
          keyword reading of the coin&apos;s description (agents, AI credits, tokenized stocks, prediction, launchpads…); it can be
          wrong, and a coin can have several.
        </p>

        <h2>What “fees” means</h2>
        <p>
          Trades of launchpad coins pay a creator fee. That is the coin&apos;s income: what its project can spend on what it
          promised. {SITE.name} shows how much each coin earns, not where the money goes afterwards, and it does not check what the
          project does with it.
        </p>

        <h2>Wallet</h2>
        <p>
          Connecting a wallet only reads your address, to keep your watchlist in this browser. {SITE.name} never asks you to sign or
          send anything.
        </p>

        <h2>Limits</h2>
        <p>
          The launchpad&apos;s endpoints are public but not documented; if they change, a refresh fails and the board keeps its last
          numbers with their time. Rates measured over a few minutes move a lot; they settle as snapshots accumulate. Market caps are
          the launchpad&apos;s figures.
          {ephemeral ? " On this host the snapshots are kept in temporary storage and restart from zero when the server restarts." : ""}{" "}
          Nothing here is financial advice.
        </p>
      </article>
    </div>
  );
}
