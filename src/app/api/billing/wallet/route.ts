import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserWallet, isRazorpayConfigured } from "@/lib/billing";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  const noStoreHeaders = { "Cache-Control": "no-store, no-cache, must-revalidate" };
  if (!session?.user?.email) {
    return NextResponse.json(
      {
        authenticated: false,
        isPremium: false,
        credits: null,
        plan: null,
        premiumExpiresAt: null,
        razorpayConfigured: isRazorpayConfigured(),
      },
      { headers: noStoreHeaders }
    );
  }

  const wallet = await getUserWallet(session.user.email);
  return NextResponse.json(
    {
      authenticated: true,
      email: wallet.email,
      isPremium: wallet.isPremium,
      credits: wallet.credits,
      plan: wallet.plan,
      premiumActivatedAt: wallet.premiumActivatedAt,
      premiumExpiresAt: wallet.premiumExpiresAt,
      totalSongsProcessed: wallet.totalSongsProcessed,
      payments: wallet.payments.slice(0, 10),
      razorpayConfigured: isRazorpayConfigured(),
    },
    { headers: noStoreHeaders }
  );
}
