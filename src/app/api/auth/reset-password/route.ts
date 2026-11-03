import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { resetUserPassword, verifyEmailOtp } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = checkRateLimit(`reset:${ip}`, { maxRequests: 6, windowMs: 15 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many reset attempts. Please wait ${rl.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: { email?: string; otp?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  try {
    verifyEmailOtp(body.email ?? "", "reset", body.otp ?? "");
    const user = await resetUserPassword({
      email: body.email ?? "",
      newPassword: body.newPassword ?? "",
    });
    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
