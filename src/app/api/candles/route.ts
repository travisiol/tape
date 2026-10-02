import { isKnownPool, isTimeframe, poolCandles } from "@/lib/geckoterminal";

export const dynamic = "force-dynamic";

// Candles for the coin-page chart when the viewer switches timeframe. Served from the
// 5-minute cache in lib/geckoterminal; only pools already resolved for a coin page are allowed.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const pool = url.searchParams.get("pool") ?? "";
  const tf = url.searchParams.get("tf");
  if (!/^0x([0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/.test(pool) || !isTimeframe(tf) || !isKnownPool("robinhood", pool)) {
    return Response.json({ error: "unknown pool or timeframe" }, { status: 400 });
  }
  const candles = await poolCandles("robinhood", pool, tf);
  return Response.json({ candles }, { headers: { "cache-control": "public, max-age=60" } });
}
