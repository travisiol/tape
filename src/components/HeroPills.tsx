"use client";

import { setHash } from "@/lib/client-stores";

export function HeroPills() {
  return (
    <div className="mt-6 flex flex-wrap gap-2.5">
      <a
        href="#hot"
        onClick={(e) => {
          e.preventDefault();
          setHash("hot", true);
        }}
        className="pill pill-accent"
      >
        <span className="h-2 w-2 rounded-full bg-ink" aria-hidden />
        Hot this hour
      </a>
      <a
        href="#new"
        onClick={(e) => {
          e.preventDefault();
          setHash("new", true);
        }}
        className="pill pill-line"
      >
        New this week
      </a>
    </div>
  );
}
