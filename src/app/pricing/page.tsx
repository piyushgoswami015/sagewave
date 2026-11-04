import type { Metadata } from "next";
import PricingCards from "@/components/PricingCards";
import { Check } from "@/components/Icons";

export const metadata: Metadata = {
  title: "Studio Premium (₹15 — 30 Songs for 30 Days) · AI Stem Studio | Sagewave",
  description:
    "Start with 1 Free Trial song per account, then unlock Sagewave Studio Premium for just ₹15 — 30 AI Stem & Instrumental songs for 30 days via UPI, GPay, PhonePe, or Cards.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <section className="section" style={{ paddingTop: 52 }}>
      <div className="container">
        <div className="section-head" style={{ marginBottom: 36 }}>
          <div>
            <span className="eyebrow">AI Stem &amp; Instrumental Studio Membership</span>
            <h1 style={{ fontSize: "clamp(2.3rem, 4.6vw, 3.8rem)", marginTop: 12 }}>
              30 songs for 30 days. <em className="serif">Just ₹15.</em>
            </h1>
          </div>
          <p style={{ maxWidth: 440 }}>
            Every new account includes <strong>1 Free Trial song (₹0)</strong>. Unlock{" "}
            <strong>Studio Premium for ₹15</strong> to get 30 full AI stem separations valid for 30 days from the exact
            moment you buy.
          </p>
        </div>

        <PricingCards />

        <div className="panel" style={{ marginTop: 36, maxWidth: "100%" }}>
          <span className="eyebrow">How Studio Premium Works</span>
          <h2 style={{ fontSize: "1.55rem", marginTop: 10, marginBottom: 16 }}>
            Clear, transparent membership rules
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Check size={18} style={{ color: "var(--moss)", flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: "0.92rem", color: "var(--muted)" }}>
                <strong style={{ color: "var(--forest)" }}>Exact 30-Day Window:</strong> Your Premium membership and{" "}
                <code>★ PREMIUM</code> badge activate the second payment succeeds and remain active for exactly 30 days
                (720 hours).
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Check size={18} style={{ color: "var(--moss)", flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: "0.92rem", color: "var(--muted)" }}>
                <strong style={{ color: "var(--forest)" }}>30 Songs or 30 Days (Whichever Comes First):</strong> Once
                30 days pass <em>or</em> you finish your 30th song, your Premium period concludes and AI Stem locks
                until you renew.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Check size={18} style={{ color: "var(--moss)", flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: "0.92rem", color: "var(--muted)" }}>
                <strong style={{ color: "var(--forest)" }}>Zero Auto-Debit + Error Protection:</strong> One-time ₹15
                UPI/Card payment (never auto-charged). If a song ever fails due to a server error, your song credit is
                automatically restored.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
