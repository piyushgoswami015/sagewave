import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { startSeparation } from "@/lib/stems";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 60 * 1024 * 1024;
const OK_TYPES = /audio\/(mpeg|mp3|wav|x-wav|wave|flac|x-flac|mp4|x-m4a|aac|ogg)/;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Please sign in to use the AI Stem Studio." }, { status: 401 });
  }

  const userKey = session.user.email || session.user.name || "user";
  const rl = checkRateLimit(`stems:${userKey}`, { maxRequests: 5, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Rate limit reached (5 songs per 10 minutes). Please wait ${rl.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Files up to 60 MB please." }, { status: 413 });
  if (file.type && !OK_TYPES.test(file.type) && !/\.(mp3|wav|flac|m4a|aac|ogg)$/i.test(file.name)) {
    return NextResponse.json({ error: "Please upload an audio file (MP3, WAV, FLAC, M4A)." }, { status: 415 });
  }

  try {
    const meta = await startSeparation(file, userKey);
    return NextResponse.json({ id: meta.id, status: meta.status, files: meta.files });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
