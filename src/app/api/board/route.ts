import { getBoard } from "@/lib/board";
import { refreshAfterResponse } from "@/lib/refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The board as JSON, read from TAPE's own snapshots (never from upstream per request).
export function GET() {
  refreshAfterResponse();
  const board = getBoard();
  // While the first board is filling in, every poll must reach the server.
  return Response.json(board, { headers: { "cache-control": board.refreshedAt ? "public, max-age=30" : "no-store" } });
}
