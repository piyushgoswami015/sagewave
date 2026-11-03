import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPlanById, isRazorpayConfigured } from "@/lib/billing";
import { checkRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Please sign in before purchasing a studio plan." }, { status: 401 });
  }

  const rl = checkRateLimit(`order:${session.user.email}`, { maxRequests: 15, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many order requests. Please wait ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  let body: { planId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const plan = getPlanById(body.planId ?? "");
  if (!plan || plan.priceInr <= 0) {
    return NextResponse.json({ error: "Please select a valid paid studio plan." }, { status: 400 });
  }

  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      {
        error:
          "Razorpay API keys (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) are not configured on the server yet.",
      },
      { status: 503 }
    );
  }

  const keyId = process.env.RAZORPAY_KEY_ID!;
  const keySecret = process.env.RAZORPAY_KEY_SECRET!;
  const basicAuth = Buffer.from(`${keyId}:${keySecret}`, "utf8").toString("base64");

  const receipt = `sw_${plan.id}_${Date.now()}`;
  const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: plan.amountPaise,
      currency: "INR",
      receipt,
      notes: {
        email: session.user.email.toLowerCase(),
        planId: plan.id,
        songs: String(plan.songs),
      },
    }),
  });

  if (!orderRes.ok) {
    const errText = await orderRes.text().catch(() => "");
    return NextResponse.json(
      { error: `Could not create Razorpay order (${orderRes.status}). ${errText.slice(0, 120)}` },
      { status: 502 }
    );
  }

  const order = (await orderRes.json()) as { id: string; amount: number; currency: string };

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId,
    planId: plan.id,
    planName: plan.name,
    songs: plan.songs,
    priceInr: plan.priceInr,
    user: {
      name: session.user.name || "Sagewave Creator",
      email: session.user.email,
    },
  });
}
