"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Arrow, Check } from "./Icons";
import { PRICING_PLANS, type PlanId } from "@/lib/billing";

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

export default function PricingCards({ compact = false }: { compact?: boolean }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [credits, setCredits] = useState<number | null>(null);
  const [activePlan, setActivePlan] = useState<PlanId | null>(null);
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchWallet = async () => {
    try {
      const res = await fetch("/api/billing/wallet");
      if (!res.ok) return;
      const data = await res.json();
      if (data.authenticated) {
        setCredits(data.credits);
        setActivePlan(data.plan);
      }
    } catch {}
  };

  useEffect(() => {
    fetchWallet();
    const onSync = () => fetchWallet();
    window.addEventListener("sagewave-wallet", onSync);
    return () => window.removeEventListener("sagewave-wallet", onSync);
  }, [status]);

  const handleBuy = async (planId: PlanId) => {
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

    setBusyPlan(planId);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        setBusyPlan(null);
        setError("Could not load Razorpay Checkout. Please check your internet connection.");
        return;
      }

      const orderRes = await fetch("/api/billing/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        setBusyPlan(null);
        setError(orderData.error || "Could not start checkout.");
        return;
      }

      const rzp = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Sagewave Audio Studio",
        description: `${orderData.planName} Pass — ${orderData.songs} AI Stem Songs`,
        order_id: orderData.orderId,
        prefill: {
          name: orderData.user?.name || "",
          email: orderData.user?.email || "",
        },
        theme: {
          color: "#1d3a2a",
        },
        modal: {
          ondismiss: () => setBusyPlan(null),
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
                planId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            setBusyPlan(null);
            if (!verifyRes.ok) {
              setError(verifyData.error || "Payment verification failed.");
              return;
            }
            setCredits(verifyData.credits);
            setActivePlan(verifyData.plan);
            setSuccessMsg(
              `Payment verified! Added +${orderData.songs} song credits. You now have ${verifyData.credits} songs available.`
            );
            window.dispatchEvent(new Event("sagewave-wallet"));
          } catch {
            setBusyPlan(null);
            setError("Network error while verifying payment.");
          }
        },
      });

      rzp.on("payment.failed", (resp: Record<string, unknown>) => {
        setBusyPlan(null);
        const errObj = resp?.error as { description?: string } | undefined;
        setError(errObj?.description || "Payment was not completed. Please try again.");
      });

      rzp.open();
    } catch {
      setBusyPlan(null);
      setError("Something went wrong while opening Razorpay Checkout.");
    }
  };

  const plans = compact ? PRICING_PLANS.filter((p) => p.id !== "free") : PRICING_PLANS;

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
            padding: "12px 18px",
            borderRadius: 16,
            background: "var(--sage-soft)",
            border: "1px solid var(--line)",
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--forest)", fontSize: "0.92rem" }}>
            Your AI Stem Wallet: <strong>{credits}</strong> {credits === 1 ? "song credit" : "song credits"} available
            {activePlan && ` · Current tier: ${activePlan.toUpperCase()}`}
          </span>
          <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
            Instant UPI · GPay · PhonePe · Cards via Razorpay
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

      <div className={`pricing-grid${compact ? " compact" : ""}`}>
        {plans.map((p) => {
          const isBusy = busyPlan === p.id;
          return (
            <div
              key={p.id}
              className={`pricing-card${p.popular ? " popular" : ""}`}
            >
              {p.popular && <span className="pricing-ribbon">Most Popular</span>}
              <div className="pricing-top">
                <span className="eyebrow" style={{ fontSize: "0.7rem" }}>
                  {p.perSongInr}
                </span>
                <h3 style={{ marginTop: 8, fontSize: "1.45rem" }}>{p.name}</h3>
                <div className="pricing-price">
                  <span className="amt">₹{p.priceInr}</span>
                  <span className="allowance">
                    / {p.songs} {p.songs === 1 ? "song" : "songs"}
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

              <button
                type="button"
                onClick={() => handleBuy(p.id)}
                disabled={busyPlan !== null}
                className={`btn ${p.popular || p.id !== "free" ? "btn-primary" : "btn-ghost"}`}
                style={{ width: "100%", marginTop: "auto" }}
              >
                {isBusy
                  ? "Opening Razorpay…"
                  : p.id === "free"
                    ? "Try 1 Free Song"
                    : `Buy ${p.songs} Songs · ₹${p.priceInr}`}
                {!isBusy && <Arrow size={15} className="arrow" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
