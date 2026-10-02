import { refresh } from "@/lib/refresh";

export const dynamic = "force-dynamic";

// Manual refresh for the operator: allowed in development, or with the
// TAPE_REFRESH_SECRET bearer token. Still at most one per minute.
export async function POST(request: Request) {
  const secret = process.env.TAPE_REFRESH_SECRET;
  const auth = request.headers.get("authorization");
  const allowed = process.env.NODE_ENV === "development" || (secret && auth === `Bearer ${secret}`);
  if (!allowed) return Response.json({ error: "forbidden" }, { status: 403 });
  const started = refresh(60_000);
  if (!started) return Response.json({ started: false, reason: "a refresh ran less than a minute ago" });
  await started;
  return Response.json({ started: true, done: true });
}
