// Display helpers shared by server and client components.

export function usd(n: number | null | undefined, { compact = true } = {}): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (compact && abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (compact && abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (compact && abs >= 10_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (abs >= 100) return `$${Math.round(n).toLocaleString("en-US")}`;
  if (abs >= 1) return `$${n.toFixed(2)}`;
  if (abs === 0) return "$0";
  return `$${n.toFixed(2)}`;
}

export function amount(n: number | null | undefined, symbol: string | null): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const digits = n >= 100 ? 0 : n >= 1 ? 2 : 4;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 })} ${symbol ?? ""}`.trim();
}

export function age(launchedAt: number | null, now: number): string {
  if (launchedAt === null || now === 0) return "—";
  const ms = Math.max(0, now - launchedAt);
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

export function span(ms: number | null): string {
  if (ms === null) return "";
  const m = Math.round(ms / 60_000);
  if (m < 90) return `${m} min`;
  return `${(m / 60).toFixed(1)} h`;
}

export function ago(at: number | null, now: number): string {
  if (at === null) return "—";
  if (now === 0) return new Date(at).toISOString().slice(11, 16) + " UTC";
  const m = Math.round((now - at) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

export const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/** A token price in USD with enough decimals for small caps ($0.0003927). */
export function formatPrice(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "—";
  if (p === 0) return "$0";
  const abs = Math.abs(p);
  if (abs >= 1000) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (abs >= 1) return `$${p.toFixed(abs >= 100 ? 2 : 3)}`;
  const digits = Math.min(12, Math.ceil(-Math.log10(abs)) + 3);
  return `$${p.toFixed(digits)}`;
}
