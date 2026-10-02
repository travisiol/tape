"use client";

import { useEffect } from "react";
import { short } from "@/lib/format";
import { connect, disconnect, setDialog, toggleWatch, useDialog, useWallet } from "@/lib/wallet";

export function WalletButton() {
  const wallet = useWallet();
  if (wallet.address) {
    return (
      <button type="button" onClick={() => disconnect()} className="pill pill-line num !h-10 !px-4 !text-[13px]" title="Disconnect">
        <span className="h-2 w-2 rounded-full bg-up" aria-hidden />
        {short(wallet.address)}
      </button>
    );
  }
  return (
    <button type="button" onClick={() => setDialog(true)} className="pill pill-ink !h-10 !px-4 !text-[14px]">
      Connect
    </button>
  );
}

export function WalletDialog() {
  const open = useDialog();
  const wallet = useWallet();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDialog(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-4 sm:items-center" onClick={() => setDialog(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-title"
        className="card fade-up w-full max-w-[400px] p-5 shadow-[0_24px_60px_-20px_rgba(17,17,15,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="wallet-title" className="text-[20px] font-black tracking-tight">
            Connect a wallet
          </h2>
          <button type="button" onClick={() => setDialog(false)} className="text-[22px] leading-none text-muted hover:text-ink" aria-label="Close">
            ×
          </button>
        </div>
        <p className="mt-1.5 text-[14px] text-muted">
          Your address only keys your watchlist in this browser. TAPE never asks you to sign or send anything.
        </p>
        <div className="mt-4 grid gap-2">
          {wallet.wallets.length === 0 ? (
            <p className="rounded-xl bg-soft px-4 py-3 text-[14px] text-muted">
              No browser wallet found. Install one (MetaMask, Rabby, Coinbase Wallet…) and reload the page.
            </p>
          ) : (
            wallet.wallets.map((w) => (
              <button
                key={w.rdns}
                type="button"
                onClick={async () => {
                  if (await connect(w.rdns)) setDialog(false);
                }}
                className="flex h-14 items-center gap-3 rounded-xl border border-line bg-surface px-4 text-left font-bold hover:border-[#d9cfb8]"
              >
                <img src={w.icon} alt="" width={28} height={28} className="rounded-md" />
                {w.name}
              </button>
            ))
          )}
        </div>
        {wallet.error && <p className="mt-3 text-[13px] text-down">{wallet.error}</p>}
      </div>
    </div>
  );
}

export function StarButton({ token, symbol }: { token: string; symbol: string }) {
  const wallet = useWallet();
  const on = wallet.watch.includes(token.toLowerCase());
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!wallet.address) setDialog(true);
        else toggleWatch(token);
      }}
      aria-pressed={on}
      aria-label={on ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
      title={wallet.address ? (on ? "Remove from watchlist" : "Add to watchlist") : "Connect a wallet to keep a watchlist"}
      className="grid h-8 w-8 flex-none place-items-center rounded-full hover:bg-soft"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"
          fill={on ? "var(--accent)" : "none"}
          stroke={on ? "#b88a00" : "var(--muted)"}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
