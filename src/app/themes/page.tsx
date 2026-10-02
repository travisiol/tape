import type { Metadata } from "next";
import Link from "next/link";
import { getBoard } from "@/lib/board";
import { usd } from "@/lib/format";
import { THEME_NAMES, sharePct } from "@/lib/metrics";
import { SITE } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Themes — ${SITE.name}` };

const slug = (name: string) => "theme-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function ThemesPage() {
  const board = getBoard();
  const rows = board.rows;
  const measured = rows.some((r) => r.feesDayUsd !== null);
  // Basis: fees per day between snapshots when measured, else the lifetime daily average.
  const basis = (r: (typeof rows)[number]) => Math.max(0, (measured ? r.feesDayUsd : r.lifetimeDailyUsd) ?? 0);
  const pool = rows.reduce((sum, r) => sum + basis(r), 0);
  const themes = THEME_NAMES.map((name) => {
    const hit = rows.filter((r) => r.themes.includes(name));
    const fees = hit.reduce((s, r) => s + basis(r), 0);
    const top = [...hit].sort((a, b) => basis(b) - basis(a)).slice(0, 3);
    return { name, coins: hit.length, fees, share: sharePct(fees, pool), fresh: hit.filter((r) => r.isNew).length, top };
  }).sort((a, b) => b.fees - a.fees);
  const unthemed = rows.filter((r) => r.themes.length === 0);
  const max = Math.max(1, ...themes.map((t) => t.fees));

  return (
    <div className="wrap pt-4">
      <h1 className="display text-[44px] sm:text-[60px]">Themes</h1>
      <p className="mt-3 max-w-[680px] text-[16px] text-muted">
        Where the creator fees go, grouped by what each coin says it does. Themes are a rough keyword reading of the coin&apos;s own
        description; a coin can sit in several, so shares add up to more than 100%. Based on{" "}
        {measured ? "fees per day measured between snapshots" : "each coin's lifetime daily average"} for the {rows.length} coins on the board.
      </p>

      {rows.length === 0 ? (
        <div className="card mt-8 px-6 py-14 text-center text-muted">The first refresh is still reading the launchpad.</div>
      ) : (
        <div className="mt-8 grid gap-2">
          <div className="hidden grid-cols-[minmax(160px,1.2fr)_minmax(200px,2fr)_90px_80px_110px] gap-4 px-5 text-[12px] font-bold uppercase tracking-[0.04em] text-muted md:grid">
            <span>Theme</span>
            <span>Share of fees / day</span>
            <span className="text-right">Coins</span>
            <span className="text-right">New</span>
            <span className="text-right">Fees / day</span>
          </div>
          {themes.map((t) => (
            <Link
              key={t.name}
              href={`/#${slug(t.name)}`}
              className="row grid gap-3 px-5 py-4 md:grid-cols-[minmax(160px,1.2fr)_minmax(200px,2fr)_90px_80px_110px] md:items-center md:gap-4"
            >
              <span>
                <span className="block text-[16px] font-black">{t.name}</span>
                <span className="block truncate text-[12px] text-muted">{t.top.map((r) => r.symbol).join(" · ") || "—"}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-soft">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${(t.fees / max) * 100}%` }} />
                </span>
                <span className="num w-10 text-right text-[13px] font-bold">{t.share}%</span>
              </span>
              <span className="num text-[13px] md:text-right">
                <span className="text-muted md:hidden">Coins </span>
                {t.coins}
              </span>
              <span className="num text-[13px] md:text-right" title="Launched in the last 7 days">
                <span className="text-muted md:hidden">Launched this week </span>
                {t.fresh}
              </span>
              <span className="num text-[13px] font-bold md:text-right">{usd(t.fees)}</span>
            </Link>
          ))}
          <p className="mt-2 px-1 text-[13px] text-muted">
            {unthemed.length} coins match no theme. Coins quoted in assets TAPE does not price count as zero here.
          </p>
        </div>
      )}
    </div>
  );
}
