import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Pin the workspace root: other lockfiles higher up the folder tree would otherwise be picked.
  turbopack: { root: resolve(".") },
};

export default nextConfig;
