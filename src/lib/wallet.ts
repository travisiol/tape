"use client";

// Wallet connection by EIP-6963 discovery, used for one thing: a watchlist kept
// per address in this browser. It only reads the address. Nothing is signed or sent.

import { useSyncExternalStore } from "react";

interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

export interface WalletInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

interface Detail {
  info: WalletInfo;
  provider: Eip1193;
}

export interface WalletState {
  wallets: WalletInfo[];
  address: string | null;
  rdns: string | null;
  watch: string[];
  error: string | null;
}

const SAVED = "tape:wallet";
const watchKey = (address: string) => `tape:watch:${address.toLowerCase()}`;

const EMPTY: WalletState = { wallets: [], address: null, rdns: null, watch: [], error: null };
let state: WalletState = EMPTY;
const details = new Map<string, Detail>();
const listeners = new Set<() => void>();
let started = false;
let current: Eip1193 | null = null;

function set(patch: Partial<WalletState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked: the watchlist lasts for this page only
  }
}

function onAccounts(...args: unknown[]) {
  const accounts = (args[0] as string[] | undefined) ?? [];
  const next = accounts[0] ?? null;
  if (!next) return disconnect();
  setAccount(next, state.rdns);
}

function setAccount(address: string | null, rdns: string | null) {
  set({
    address,
    rdns,
    watch: address ? readJson<string[]>(watchKey(address), []) : [],
    error: null,
  });
  writeJson(SAVED, address ? { address, rdns } : null);
}

function attach(provider: Eip1193) {
  if (current && current !== provider) current.removeListener?.("accountsChanged", onAccounts);
  current = provider;
  provider.on?.("accountsChanged", onAccounts);
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  const saved = readJson<{ address: string; rdns: string | null } | null>(SAVED, null);
  window.addEventListener("eip6963:announceProvider", (event) => {
    const detail = (event as CustomEvent<Detail>).detail;
    if (!detail?.info?.rdns || details.has(detail.info.rdns)) return;
    details.set(detail.info.rdns, detail);
    set({ wallets: [...details.values()].map((d) => d.info) });
    // Restore a previous connection silently (eth_accounts never opens a prompt).
    if (saved && saved.rdns === detail.info.rdns && !state.address) {
      detail.provider
        .request({ method: "eth_accounts" })
        .then((accounts) => {
          const list = accounts as string[];
          if (list?.some((a) => a.toLowerCase() === saved.address.toLowerCase())) {
            attach(detail.provider);
            setAccount(list[0], detail.info.rdns);
          }
        })
        .catch(() => {});
    }
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWallet(): WalletState {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}

export async function connect(rdns: string): Promise<boolean> {
  const detail = details.get(rdns);
  if (!detail) return false;
  try {
    const accounts = (await detail.provider.request({ method: "eth_requestAccounts" })) as string[];
    if (!accounts?.[0]) throw new Error("No account was shared.");
    attach(detail.provider);
    setAccount(accounts[0], rdns);
    return true;
  } catch (error) {
    set({ error: error instanceof Error ? error.message : "The wallet did not connect." });
    return false;
  }
}

export function disconnect() {
  current?.removeListener?.("accountsChanged", onAccounts);
  current = null;
  setAccount(null, null);
}

export function toggleWatch(token: string) {
  if (!state.address) return;
  const key = token.toLowerCase();
  const watch = state.watch.includes(key) ? state.watch.filter((t) => t !== key) : [...state.watch, key];
  writeJson(watchKey(state.address), watch);
  set({ watch });
}

// The connect dialog is opened from several places (header, star buttons).
let dialogOpen = false;
const dialogListeners = new Set<() => void>();
export function setDialog(open: boolean) {
  dialogOpen = open;
  for (const l of dialogListeners) l();
}
export function useDialog(): boolean {
  return useSyncExternalStore(
    (l) => {
      dialogListeners.add(l);
      return () => dialogListeners.delete(l);
    },
    () => dialogOpen,
    () => false,
  );
}
