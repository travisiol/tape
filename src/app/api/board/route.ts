import { getBoard } from "@/lib/board";

export const dynamic = "force-dynamic";

// The board as JSON, read from TAPE's own snapshots (never from upstream per request).
export function GET() {
  return Response.json(getBoard(), { headers: { "cache-control": "public, max-age=30" } });
}
