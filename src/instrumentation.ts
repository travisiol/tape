// Runs once per server instance: starts the refresh loop in the Node runtime.
// Not during `next build`, so building never reads the public endpoints.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { startRefreshLoop } = await import("./lib/refresh");
    startRefreshLoop();
  }
}
