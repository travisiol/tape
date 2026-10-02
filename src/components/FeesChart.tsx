import { amount } from "@/lib/format";

// Cumulative creator fees as TAPE recorded them, one point per snapshot, in the coin's quote asset.
export function FeesChart({ history, quote }: { history: { at: number; fees: number }[]; quote: string | null }) {
  if (history.length === 0) {
    return (
      <div className="grid h-[200px] place-items-center px-6 text-center text-[14px] text-muted">
        TAPE has not read this coin&apos;s fees. It reads coins traded in the last three days that the launchpad&apos;s fee endpoint covers.
      </div>
    );
  }
  const lo = Math.min(...history.map((h) => h.fees));
  const hi = Math.max(...history.map((h) => h.fees));
  if (history.length < 2 || hi === lo) {
    return (
      <div className="grid h-[200px] place-items-center px-6 text-center">
        <div>
          <p className="text-[14px] text-muted">No movement between snapshots yet.</p>
          <p className="num mt-1 text-[12px] text-muted">
            {amount(hi, quote)} at {history.length} snapshot{history.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>
    );
  }
  const W = 640;
  const H = 200;
  const P = { t: 10, b: 10 };
  const t0 = history[0].at;
  const t1 = history[history.length - 1].at;
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * W;
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const line = history.map((h, i) => `${i ? "L" : "M"}${x(h.at).toFixed(1)},${y(h.fees).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const fmt = (t: number) => new Date(t).toISOString().slice(5, 16).replace("T", " ");
  return (
    <figure>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
        <div className="num flex h-[200px] flex-col justify-between py-1 text-right text-[11px] text-muted">
          <span>{amount(hi, quote)}</span>
          <span>{amount(lo, quote)}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[200px] w-full" preserveAspectRatio="none" role="img" aria-label="Cumulative creator fees over time">
          <path d={area} fill="rgba(242,183,5,0.14)" />
          <path d={line} fill="none" stroke="#F2B705" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
      </div>
      <figcaption className="num mt-2 flex justify-between gap-3 pl-[72px] text-[11px] text-muted">
        <span>{fmt(t0)} UTC</span>
        <span className="text-right">{fmt(t1)} UTC</span>
      </figcaption>
    </figure>
  );
}
