"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Arrow, Check } from "./Icons";
import { PRICING_PLANS, type PlanId } from "@/lib/plans";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (res: Record<string, unknown>) => void) => void;
    };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function formatExpiry(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function PricingCards({ compact = false }: { compact?: boolean }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [credits, setCredits] = useState<number | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [activePlan, setActivePlan] = useState<PlanId | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchWallet = async () => {
    try {
      const res = await fetch("/api/billing/wallet", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.authenticated) {
        setCredits(data.credits);
        setIsPremium(Boolean(data.isPremium));
        setActivePlan(data.plan);
        setExpiresAt(data.premiumExpiresAt || null);
      }
    } catch {}
  };

  useEffect(() => {
    fetchWallet();
    const onSync = () => fetchWallet();
    window.addEventListener("sagewave-wallet", onSync);
    return () => window.removeEventListener("sagewave-wallet", onSync);
  }, [status]);

  const handleBuy = async (planId: "free" | "premium") => {
    setError(null);
    setSuccessMsg(null);

    if (status !== "authenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname || "/pricing")}`);
      return;
    }

    if (planId === "free") {
      router.push("/stem-split");
      return;
    }

    if (!acceptedTerms) {
      setError("Please tick the checkbox to accept the Terms & Conditions before proceeding to Razorpay payment.");
      return;
    }

    setBusy(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        setBusy(false);
        setError("Could not load Razorpay Checkout. Please check your internet connection.");
        return;
      }

      const orderRes = await fetch("/api/billing/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "premium", acceptedTerms: true }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        setBusy(false);
        setError(orderData.error || "Could not start checkout.");
        return;
      }

      const rzp = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Sagewave Audio Studio",
        description: "Studio Premium — 30 Songs for 30 Days (₹15)",
        order_id: orderData.orderId,
        prefill: {
          name: orderData.user?.name || "",
          email: orderData.user?.email || "",
        },
        theme: {
          color: "#1d3a2a",
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
        handler: async (response: {
          razorpay_order_id?: string;
          razorpay_payment_id?: string;
          razorpay_signature?: string;
        }) => {
          try {
            const verifyRes = await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            setBusy(false);
            if (!verifyRes.ok) {
              setError(verifyData.error || "Payment verification failed.");
              return;
            }
            setCredits(verifyData.credits);
            setIsPremium(Boolean(verifyData.isPremium));
            setActivePlan(verifyData.plan);
            setExpiresAt(verifyData.premiumExpiresAt || null);
            setSuccessMsg(
              `Studio Premium Activated! You now have 30 song credits valid until ${formatExpiry(verifyData.premiumExpiresAt)}.`
            );
            window.dispatchEvent(new Event("sagewave-wallet"));
          } catch {
            setBusy(false);
            setError("Network error while verifying payment.");
          }
        },
      });

      rzp.on("payment.failed", (resp: Record<string, unknown>) => {
        setBusy(false);
        const errObj = resp?.error as { description?: string } | undefined;
        setError(errObj?.description || "Payment was not completed. Please try again.");
      });

      rzp.open();
    } catch {
      setBusy(false);
      setError("Something went wrong while opening Razorpay Checkout.");
    }
  };

  const plans = compact ? PRICING_PLANS.filter((p) => p.id === "premium") : PRICING_PLANS;

  return (
    <div>
      {credits !== null && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 20,
            padding: "14px 18px",
            borderRadius: 16,
            background: isPremium ? "var(--forest)" : "var(--sage-soft)",
            color: isPremium ? "var(--cream)" : "var(--forest)",
            border: "1px solid var(--line)",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "0.92rem" }}>
            {isPremium ? (
              <>
                ★ STUDIO PREMIUM ACTIVE · <strong>{credits} / 30</strong> songs remaining
              </>
            ) : activePlan === "expired" ? (
              <>
                AI Stem Pass Expired · <strong>0</strong> songs remaining — Activate Studio Premium (₹15) to unlock
              </>
            ) : (
              <>
                Free Trial Wallet: <strong>{credits}</strong> {credits === 1 ? "song" : "songs"} remaining
              </>
            )}
          </span>
          <span style={{ fontSize: "0.82rem", opacity: 0.85 }}>
            {isPremium && expiresAt
              ? `Valid until ${formatExpiry(expiresAt)}`
              : "Instant UPI · GPay · PhonePe · Cards via Razorpay"}
          </span>
        </div>
      )}

      {successMsg && (
        <div className="notice" style={{ marginBottom: 20 }}>
          <Check size={16} style={{ verticalAlign: "middle", marginRight: 8 }} />
          <strong>{successMsg}</strong>
        </div>
      )}

      {error && (
        <div className="error-msg" style={{ marginBottom: 20 }} role="alert">
          <Alert size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      <div className={`pricing-grid two-col${compact ? " single-col" : ""}`}>
        {plans.map((p) => {
          const isPremCard = p.id === "premium";
          return (
            <div key={p.id} className={`pricing-card${p.popular ? " popular" : ""}`}>
              {p.popular && <span className="pricing-ribbon">30 Songs for 30 Days</span>}
              <div className="pricing-top">
                <span className="eyebrow" style={{ fontSize: "0.72rem" }}>
                  {p.perSongInr}
                </span>
                <h3 style={{ marginTop: 8, fontSize: "1.6rem" }}>{p.name}</h3>
                <div className="pricing-price">
                  <span className="amt">₹{p.priceInr}</span>
                  <span className="allowance">
                    {isPremCard ? "/ month (30 days · 30 songs)" : "/ 1 free song per account"}
                  </span>
                </div>
                <p className="pricing-tagline">{p.tagline}</p>
              </div>

              <ul className="pricing-features">
                {p.features.map((f) => (
                  <li key={f}>
                    <Check size={15} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {isPremCard && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: "var(--cream)",
                    border: "1px solid var(--line)",
                    fontSize: "0.8rem",
                    color: "var(--ink)",
                    lineHeight: 1.5,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => {
                      setAcceptedTerms(e.target.checked);
                      if (e.target.checked) setError(null);
                    }}
                    style={{ marginTop: 3, accentColor: "var(--forest)", width: 16, height: 16, flexShrink: 0 }}
                  />
                  <span>
                    I have read and agree to the{" "}
                    <Link href="/terms" style={{ textDecoration: "underline", color: "var(--forest)", fontWeight: 600 }}>
                      Terms &amp; Conditions
                    </Link>
                    : Studio Premium is valid for <strong>30 songs or 30 days</strong> from the exact time of purchase
                    (whichever comes first), after which the Premium tag is removed and AI Stem locks until renewed.
                  </span>
                </label>
              )}

              <button
                type="button"
                onClick={() => handleBuy(p.id)}
                disabled={busy}
                className={`btn ${isPremCard ? "btn-primary" : "btn-ghost"}`}
                style={{ width: "100%", marginTop: "auto" }}
              >
                {busy && isPremCard
                  ? "Opening Razorpay…"
                  : isPremCard
                    ? isPremium
                      ? "Renew Studio Premium · ₹15"
                      : "Unlock 30 Songs for 30 Days · ₹15"
                    : "Try 1 Free Song"}
                {!(busy && isPremCard) && <Arrow size={15} className="arrow" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
