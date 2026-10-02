"use client";

// Candlestick + volume chart in plain SVG, no chart library. Self-contained (only formatPrice
// from lib/format) so it can be copied into other projects: it takes candles (oldest first, USD) for the first timeframe
// and reads other timeframes from `endpoint?pool=…&tf=…` (which must answer { candles }).

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";

export type ChartTimeframe = "15m" | "1h" | "4h" | "1D";
export interface ChartCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface Props {
  pool: string;
  initial: ChartCandle[];
  initialTimeframe?: ChartTimeframe;
  endpoint?: string;
  title?: string;
  links?: { label: string; href: string }[];
  up?: string;
  down?: string;
  height?: number;
}

const FRAMES: ChartTimeframe[] = ["15m", "1h", "4h", "1D"];

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}

function formatTime(t: number, tf: ChartTimeframe): string {
  const iso = new Date(t * 1000).toISOString();
  return tf === "1D" ? iso.slice(5, 10) : tf === "4h" ? `${iso.slice(5, 10)} ${iso.slice(11, 13)}h` : iso.slice(11, 16);
}

export function PriceChart({
  pool,
  initial,
  initialTimeframe = "1h",
  endpoint = "/api/candles",
  title = "Price",
  links = [],
  up = "#168A4A",
  down = "#D83A2E",
  height = 380,
}: Props) {
  const [tf, setTf] = useState<ChartTimeframe>(initialTimeframe);
  const [data, setData] = useState<Record<string, ChartCandle[]>>({ [initialTimeframe]: initial });
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(760);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => setWidth(Math.max(280, Math.round(entries[0].contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pick = (next: ChartTimeframe) => {
    setTf(next);
    setHover(null);
    if (data[next]) return;
    setLoading(true);
    fetch(`${endpoint}?pool=${encodeURIComponent(pool)}&tf=${encodeURIComponent(next)}`)
      .then((r) => (r.ok ? r.json() : { candles: [] }))
      .then((json: { candles?: ChartCandle[] }) => setData((d) => ({ ...d, [next]: json.candles ?? [] })))
      .catch(() => setData((d) => ({ ...d, [next]: [] })))
      .finally(() => setLoading(false));
  };

  const candles = data[tf] ?? [];
  const W = width;
  const H = height;
  const longest = candles.length ? Math.max(...[...candles.map((k) => k.h), ...candles.map((k) => k.l)].map((p) => formatPrice(p).length)) : 8;
  const pad = { l: 8, r: Math.round(longest * 6.9 + 18), t: 12, b: 26 };
  const volH = Math.round((H - pad.t - pad.b) * 0.18);
  const priceBottom = H - pad.b - volH - 8;
  const plotW = W - pad.l - pad.r;
  const lo = candles.length ? Math.min(...candles.map((k) => k.l)) : 0;
  const hi = candles.length ? Math.max(...candles.map((k) => k.h)) : 1;
  const range = hi - lo || hi * 0.02 || 1;
  const yLo = lo - range * 0.06;
  const yHi = hi + range * 0.06;
  const maxV = Math.max(1, ...candles.map((k) => k.v));
  const step = plotW / Math.max(1, candles.length);
  const bodyW = Math.max(1, Math.min(14, step * 0.68));
  const x = (i: number) => pad.l + step * i + step / 2;
  const y = (p: number) => pad.t + (1 - (p - yLo) / (yHi - yLo)) * (priceBottom - pad.t);
  const ticks = Array.from({ length: 5 }, (_, i) => yLo + ((yHi - yLo) * (i + 0.5)) / 5);
  const timeTicks = candles.length ? Array.from({ length: Math.min(5, candles.length) }, (_, i) => Math.round(((candles.length - 1) * i) / Math.max(1, Math.min(5, candles.length) - 1))) : [];
  const shown = hover !== null ? candles[hover] : candles[candles.length - 1];
  const first = candles[0];
  const change = shown && first ? ((shown.c - first.o) / first.o) * 100 : null;

  return (
    <div style={{ fontFamily: "inherit" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 16px" }}>
        <strong style={{ fontSize: 16, fontWeight: 900 }}>{title}</strong>
        <div role="tablist" aria-label="Timeframe" style={{ display: "flex", gap: 4 }}>
          {FRAMES.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={f === tf}
              onClick={() => pick(f)}
              style={{
                height: 28,
                padding: "0 10px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 700,
                background: f === tf ? "currentColor" : "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <span style={{ color: f === tf ? "#fff" : "inherit" }}>{f}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: "0 16px 6px", minHeight: 20, fontSize: 12, fontFamily: "var(--font-mono, ui-monospace, monospace)", opacity: 0.75 }}>
        {shown ? (
          <>
            {formatTime(shown.t, tf)} UTC · O {formatPrice(shown.o)} · H {formatPrice(shown.h)} · L {formatPrice(shown.l)} · C {formatPrice(shown.c)} · Vol{" "}
            {formatVolume(shown.v)}
            {change !== null && hover === null && (
              <span style={{ color: change >= 0 ? up : down }}>
                {" "}
                · {change >= 0 ? "+" : ""}
                {change.toFixed(1)}% over the view
              </span>
            )}
          </>
        ) : null}
      </div>
      <div ref={box} style={{ position: "relative", height: H }}>
        {candles.length === 0 ? (
          <div style={{ height: "100%", display: "grid", placeItems: "center", fontSize: 14, opacity: 0.6 }}>
            {loading ? "Loading candles…" : "No trades in this timeframe yet."}
          </div>
        ) : (
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`${title} candles, ${tf}`}
            style={{ display: "block", opacity: loading ? 0.5 : 1 }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const i = Math.floor((e.clientX - rect.left - pad.l) / step);
              setHover(i >= 0 && i < candles.length ? i : null);
            }}
            onMouseLeave={() => setHover(null)}
          >
            {ticks.map((p) => (
              <g key={p}>
                <line x1={pad.l} x2={W - pad.r} y1={y(p)} y2={y(p)} stroke="currentColor" strokeOpacity={0.08} />
                <text x={W - pad.r + 8} y={y(p) + 4} fontSize={11} fill="currentColor" fillOpacity={0.6} style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>
                  {formatPrice(p)}
                </text>
              </g>
            ))}
            {timeTicks.map((i) => (
              <text
                key={i}
                x={Math.min(Math.max(x(i), pad.l + 20), W - pad.r - 20)}
                y={H - 8}
                fontSize={11}
                textAnchor="middle"
                fill="currentColor"
                fillOpacity={0.6}
                style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}
              >
                {formatTime(candles[i].t, tf)}
              </text>
            ))}
            {candles.map((k, i) => {
              const color = k.c >= k.o ? up : down;
              const top = y(Math.max(k.o, k.c));
              const bodyH = Math.max(1, Math.abs(y(k.o) - y(k.c)));
              const vh = (k.v / maxV) * volH;
              return (
                <g key={k.t}>
                  <rect x={x(i) - bodyW / 2} y={H - pad.b - vh} width={bodyW} height={vh} fill={color} fillOpacity={0.22} />
                  <line x1={x(i)} x2={x(i)} y1={y(k.h)} y2={y(k.l)} stroke={color} strokeWidth={1} />
                  <rect x={x(i) - bodyW / 2} y={top} width={bodyW} height={bodyH} fill={color} rx={bodyW > 4 ? 1 : 0} />
                </g>
              );
            })}
            {hover !== null && candles[hover] && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="3 3" />
                <line x1={pad.l} x2={W - pad.r} y1={y(candles[hover].c)} y2={y(candles[hover].c)} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="3 3" />
              </g>
            )}
            {shown && (
              <g pointerEvents="none">
                <rect x={W - pad.r + 2} y={y(shown.c) - 9} width={pad.r - 4} height={18} rx={4} fill={shown.c >= shown.o ? up : down} />
                <text x={W - pad.r + 8} y={y(shown.c) + 4} fontSize={11} fill="#fff" style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>
                  {formatPrice(shown.c)}
                </text>
              </g>
            )}
          </svg>
        )}
      </div>
      {links.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 14, padding: "8px 16px 12px", fontSize: 12, opacity: 0.7 }}>
          {links.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
              {l.label} ↗
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
