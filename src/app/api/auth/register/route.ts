import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { registerUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = checkRateLimit(`register:${ip}`, { maxRequests: 6, windowMs: 15 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many sign-up attempts. Please try again in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: { name?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  try {
    const user = await registerUser({
      name: body.name ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
