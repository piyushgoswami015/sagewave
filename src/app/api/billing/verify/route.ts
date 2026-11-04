import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { verifyAndCreditRazorpayPayment } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  let body: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid verification payload." }, { status: 400 });
  }

  try {
    const wallet = await verifyAndCreditRazorpayPayment({
      email: session.user.email,
      razorpayOrderId: body.razorpay_order_id || "",
      razorpayPaymentId: body.razorpay_payment_id || "",
      razorpaySignature: body.razorpay_signature || "",
    });

    return NextResponse.json({
      ok: true,
      isPremium: wallet.isPremium,
      credits: wallet.credits,
      plan: wallet.plan,
      premiumExpiresAt: wallet.premiumExpiresAt,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
