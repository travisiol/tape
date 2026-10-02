# TAPE

**See what the chain is paying for.**

- **Name**: TAPE (set in `src/lib/site-config.ts` and `package.json`)
- **Hook**: See what the chain is paying for.
- **Palette**: background `#FAF7EF`, surface `#FFFFFF`, ink `#11110F`, muted `#6E6A61`, accent `#F2B705` (fills only:
  rails, pills, highlights, buttons with ink text — never text on paper), up `#168A4A`, down `#D83A2E`,
  border `#EEE7D8`, hot row `#FFF4C2`. Tokens in `src/app/globals.css`.
- **Type**: Archivo 500/700/900 (headlines, body, big numbers with tabular figures) and JetBrains Mono 500/700
  (table figures, addresses), via `next/font/google`.
- **Hero object**: `public/hero-tape.png`, a glossy yellow folded ticker tape (generated render), blended into the
  page with `mix-blend-mode: multiply` and a radial mask. Logo: `brand/logo-1024.png` → `public/logo-96.png`.

A live, read-only board of the coins launched on Robinhood Chain's launchpad (Pons), ranked by the creator fees
they really earn. No contract, no token, no key.

```bash
npm install
npm run dev        # http://localhost:3889
npm test           # node --test, pure logic
```

## How it works

- **Refresh loop** (`src/instrumentation.ts` → `src/lib/refresh.ts`): one refresh at start-up, then one every
  `TAPE_REFRESH_MINUTES` (default 10, minimum 5). Each refresh reads the launchpad catalog (graduated coins + the 50
  most traded coins on the curve), ETH and BTC spot prices from Coinbase, then the lifetime creator fees of each tracked
  coin **one request at a time, 250 ms apart**, and the creator links (X, website, Telegram) of 25 coins per refresh
  (each re-read once a day). Visitors never cause upstream requests: pages and `/api/board` read the local database.
- **Tracked coins**: traded in the last 3 days and readable by the fee endpoint (coins with a quote asset): the 150
  biggest by market cap, the 50 most traded on the curve, every live coin already seen earning fees, and 60 never-read
  live coins per refresh (so the whole live set is covered after a few refreshes).
- **Snapshots** (`node:sqlite`, `src/lib/db.ts`): `TAPE_DATA_DIR`, else `./data` when writable, else the OS temp
  folder with a warning (read-only hosts such as Vercel: snapshots are then lost on restart; the about page says so).
  Snapshots older than 30 days are pruned. Only snapshots of finished refreshes are used.
- **Numbers** (`src/lib/metrics.ts`, tested): fees 1h and fees/day are rates between the latest snapshot and the oldest
  one inside the last hour / 24 hours (at least 4 minutes apart for the hour, 1 hour for the day), scaled to an hour / a day. Until two snapshots exist the
  cell shows “—” with the tooltip “Measured from the next refresh.” Lifetime / day = total ÷ age in days (at least one
  day), available from the first snapshot. USD only for ETH/WETH, cbBTC (BTC price) and dollar stablecoins; every other
  quote asset (stock tokens…) is shown in its own unit and marked as not priced.
- **Hot**: top 5 by fees in the last hour, with at least $25 earned in that hour.
- **Themes**: keyword reading of the description (the factory's list), labelled as rough.
- **Coin page** `/coin/[token]`: first-party candlestick + volume chart (15m / 1h / 4h / 1D, hover O/H/L/C) from
  GeckoTerminal's public API (`networks/robinhood/tokens/<token>/pools`, then `pools/<pool>/ohlcv/...`), cached 5 min per
  token and per (pool, timeframe) server-side; “No market for this coin yet.” without a pool. A PRICE tile (USD + 24h change)
  from the same pool, the fee metrics, fees over time from TAPE's snapshots, and links (Trade on Pons, explorer,
  X/website/Telegram when the creator set them; DexScreener and GeckoTerminal under the chart).
- **Reusable chart**: `src/components/PriceChart.tsx` (client, SVG, imports only `formatPrice` from `src/lib/format.ts`)
  + `src/lib/geckoterminal.ts` (server helper with the cache). `src/app/api/candles/route.ts` serves other timeframes
  for pools already resolved by a coin page.
- **Wallet**: EIP-6963 discovery and a small own dialog. Its only use is a watchlist stored per address in
  `localStorage`. No signing, no transaction.
- **Manual refresh**: `POST /api/refresh` — allowed in development, or with `Authorization: Bearer $TAPE_REFRESH_SECRET`.

Pages: `/`, `/coin/[token]`, `/themes`, `/about`. JSON: `/api/board`.

## Scripts

- `node scripts/capture.mjs [base] [outDir]` — screenshots at 1536 and 390 px over CDP (headless Chrome).
- `node scripts/console.mjs <url>` — console errors of one page.

## Not built (and not claimed on the site)

Alerts, trading from the site, portfolio tracking, holder analytics, any token or token utility.

## Owner to-do before going public

- Pick a host with a disk (or set `TAPE_DATA_DIR`) so snapshots survive restarts; on serverless the rates restart
  from “—” after every cold start.
- Set `TAPE_REFRESH_SECRET` if you want manual refreshes in production.
- The launchpad endpoints are public but undocumented: if a refresh fails, the board keeps its last numbers.
