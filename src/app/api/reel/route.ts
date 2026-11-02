import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkRateLimit, reelSemaphore } from "@/lib/ratelimit";
import { fetchReel, isInstagramUrl, type ReelMode } from "@/lib/reel";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Please sign in to use this studio tool." }, { status: 401 });
  }

  const userKey = session.user.email || session.user.name || "user";
  const rl = checkRateLimit(`reel:${userKey}`, { maxRequests: 12, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Rate limit reached (12 clips per 10 minutes). Please wait ${rl.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: { url?: string; mode?: ReelMode };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const url = (body.url ?? "").trim();
  const mode: ReelMode = body.mode === "video" ? "video" : "audio";
  if (!isInstagramUrl(url)) {
    return NextResponse.json(
      { error: "That doesn't look like an Instagram reel link. It should start with instagram.com/reel/…" },
      { status: 400 }
    );
  }

  let release: (() => void) | null = null;
  try {
    release = await reelSemaphore.acquire();
    const result = await fetchReel(url, mode);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  } finally {
    if (release) release();
  }
}
