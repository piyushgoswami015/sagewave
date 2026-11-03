import { NextResponse } from "next/server";
import { isMailerConfigured, sendOtpEmail } from "@/lib/mailer";
import { checkRateLimit } from "@/lib/ratelimit";
import { findUserByEmail, generateEmailOtp, validateDeliverableEmail } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = checkRateLimit(`otp:${ip}`, { maxRequests: 6, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many verification requests. Please wait ${rl.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: { email?: string; purpose?: "signup" | "reset" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const purpose = body.purpose === "reset" ? "reset" : "signup";

  try {
    const email = await validateDeliverableEmail(body.email ?? "");
    const existing = await findUserByEmail(email);

    if (purpose === "signup" && existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in instead." },
        { status: 400 }
      );
    }

    if (purpose === "reset" && !existing) {
      return NextResponse.json(
        { error: "No account found with this email address. Please create an account or sign in with Google." },
        { status: 404 }
      );
    }

    if (!isMailerConfigured()) {
      if (purpose === "reset") {
        return NextResponse.json(
          {
            error:
              "Instant tip: If this is a Google/Gmail address, click 'Continue with Google' above to access your account immediately without a password!",
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ sent: false, requiresOtp: false });
    }

    const code = generateEmailOtp(email, purpose);
    await sendOtpEmail({ to: email, code, purpose });
    return NextResponse.json({ sent: true, requiresOtp: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
