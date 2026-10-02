"use client";

import { useSyncExternalStore } from "react";

// A shared clock: 0 on the server, so nothing time-relative is baked into the HTML.
let now = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const clockListeners = new Set<() => void>();
function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      for (const l of clockListeners) l();
    }, 30_000);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
export function useNow(): number {
  return useSyncExternalStore(subscribeClock, () => now, () => 0);
}

// The board tab lives in the URL hash (#hot, #new, #watchlist, #theme-…), so the hero pills can link to it.
const HASH_EVENT = "tape:hash";
function subscribeHash(listener: () => void) {
  window.addEventListener("hashchange", listener);
  window.addEventListener(HASH_EVENT, listener);
  return () => {
    window.removeEventListener("hashchange", listener);
    window.removeEventListener(HASH_EVENT, listener);
  };
}
export function useHash(): string {
  return useSyncExternalStore(subscribeHash, () => window.location.hash.slice(1), () => "");
}
export function setHash(value: string, scroll = false) {
  history.replaceState(null, "", value ? `#${value}` : window.location.pathname);
  window.dispatchEvent(new Event(HASH_EVENT));
  if (scroll) document.getElementById("board")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
