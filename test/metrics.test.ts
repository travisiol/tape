import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAY,
  HOUR,
  MINUTE,
  classifyThemes,
  hotTokens,
  isNewThisWeek,
  lifetimeDaily,
  measureRate,
  priceOf,
  sortRows,
  toUsd,
} from "../src/lib/metrics.ts";

test("USD conversion uses only real prices", () => {
  const prices = { ETH: 2500, BTC: 60000 };
  assert.equal(toUsd(2, "ETH", prices), 5000);
  assert.equal(toUsd(2, "WETH", prices), 5000);
  assert.equal(toUsd(0.5, "cbBTC", prices), 30000);
  assert.equal(toUsd(10, "USDG", prices), 10);
  assert.equal(toUsd(3, "NVDA", prices), null, "a stock-token quote with no price stays unpriced");
  assert.equal(toUsd(1, "ETH", {}), null, "no ETH price, no USD");
  assert.equal(toUsd(null, "ETH", prices), null);
  assert.equal(priceOf("ETH", { ETH: 0 }), null, "a zero price is not a price");
});

test("rate between snapshots", () => {
  const t0 = 1_000_000_000_000;
  const snaps = [
    { at: t0, fees: 1 },
    { at: t0 + 30 * MINUTE, fees: 1.5 },
    { at: t0 + 60 * MINUTE, fees: 2 },
  ];
  const rate = measureRate(snaps, HOUR);
  assert.ok(rate);
  assert.equal(rate.spanMs, HOUR);
  assert.equal(rate.delta, 1);
  assert.ok(Math.abs(rate.perMs * HOUR - 1) < 1e-9);
  // A window shorter than the history starts from the oldest reading inside it.
  const half = measureRate(snaps, 40 * MINUTE);
  assert.ok(half);
  assert.equal(half.spanMs, 30 * MINUTE);
  assert.ok(Math.abs(half.perMs * HOUR - 1) < 1e-9);
});

test("rate is not measurable yet", () => {
  const t0 = 1_000_000_000_000;
  assert.equal(measureRate([], HOUR), null, "no snapshot");
  assert.equal(measureRate([{ at: t0, fees: 1 }], HOUR), null, "one snapshot");
  assert.equal(measureRate([{ at: t0, fees: 1 }, { at: t0 + MINUTE, fees: 2 }], HOUR), null, "too close together");
  assert.equal(measureRate([{ at: t0, fees: null }, { at: t0 + HOUR, fees: 2 }], 2 * HOUR), null, "a failed read");
  assert.equal(measureRate([{ at: t0, fees: 3 }, { at: t0 + HOUR, fees: 2 }], 2 * HOUR), null, "a total that went down");
  assert.equal(measureRate([{ at: t0, fees: 1 }, { at: t0 + 3 * HOUR, fees: 2 }], HOUR), null, "older reading outside the window");
  assert.equal(measureRate([{ at: t0, fees: 1 }, { at: t0 + 10 * MINUTE, fees: 2 }], DAY, HOUR), null, "a daily rate needs an hour of snapshots");
});

test("lifetime daily average", () => {
  const now = 10 * DAY;
  assert.equal(lifetimeDaily(1000, now - 4 * DAY, now), 250);
  assert.equal(lifetimeDaily(100, now - 10 * MINUTE, now), 100, "a coin younger than a day counts one day");
  assert.equal(lifetimeDaily(null, now - DAY, now), null);
  assert.ok(isNewThisWeek(now - 6 * DAY, now));
  assert.ok(!isNewThisWeek(now - 8 * DAY, now));
});

test("hot rule: top by fees in the last hour, with a floor", () => {
  const rows = [
    { token: "a", fees1hUsd: 500 },
    { token: "b", fees1hUsd: 10 },
    { token: "c", fees1hUsd: null },
    { token: "d", fees1hUsd: 80 },
    { token: "e", fees1hUsd: 30 },
  ];
  assert.deepEqual([...hotTokens(rows, 2, 25)], ["a", "d"]);
  assert.deepEqual([...hotTokens(rows, 10, 25)].sort(), ["a", "d", "e"]);
  assert.equal(hotTokens([{ token: "x", fees1hUsd: null }]).size, 0);
});

test("theme classification", () => {
  assert.deepEqual(classifyThemes("A network for agents with identities on Robinhood Chain."), ["AI agents"]);
  assert.ok(classifyThemes("Mint your own tokenized portfolio of stocks").includes("Tokenized stocks"));
  assert.ok(classifyThemes("A launchpad that sends fees to holders").includes("Launchpads"));
  assert.deepEqual(classifyThemes(""), []);
  assert.deepEqual(classifyThemes(null), []);
});

test("sorting keeps missing values last", () => {
  const rows = [
    { s: "b", v: 2 },
    { s: "a", v: null },
    { s: "c", v: 5 },
  ];
  assert.deepEqual(sortRows(rows, "v", "desc").map((r) => r.s), ["c", "b", "a"]);
  assert.deepEqual(sortRows(rows, "v", "asc").map((r) => r.s), ["b", "c", "a"]);
  assert.deepEqual(sortRows(rows, "s", "asc").map((r) => r.s), ["a", "b", "c"]);
});
