import type { Metadata } from "next";
import PricingCards from "@/components/PricingCards";
import { Check } from "@/components/Icons";

export const metadata: Metadata = {
  title: "Pricing & Studio Passes — AI Stem & Instrumental Studio | Sagewave",
  description:
    "Affordable pay-as-you-go song passes for Sagewave AI Stem & Instrumental Studio. Start with 1 free song, then top up from ₹10 for 3 songs via UPI, GPay, PhonePe, or Cards.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <section className="section" style={{ paddingTop: 52 }}>
      <div className="container">
        <div className="section-head" style={{ marginBottom: 36 }}>
          <div>
            <span className="eyebrow">AI Stem &amp; Instrumental Studio Pricing</span>
            <h1 style={{ fontSize: "clamp(2.3rem, 4.6vw, 3.8rem)", marginTop: 12 }}>
              Pay per track. <em className="serif">No monthly lock-in.</em>
            </h1>
          </div>
          <p style={{ maxWidth: 420 }}>
            Every new account includes <strong>1 Free Trial song (₹0)</strong>. Need more stems? Top up your studio
            wallet anytime starting at just <strong>₹10</strong> — credits never expire.
          </p>
        </div>

        <PricingCards />

        <div className="panel" style={{ marginTop: 36, maxWidth: "100%" }}>
          <span className="eyebrow">Included in Every Plan</span>
          <h2 style={{ fontSize: "1.55rem", marginTop: 10, marginBottom: 16 }}>
            What counts as 1 song credit?
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Check size={18} style={{ color: "var(--moss)", flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: "0.92rem", color: "var(--muted)" }}>
                <strong style={{ color: "var(--forest)" }}>Full Stem Bundle per Credit:</strong> 1 song credit gives
                you the master Instrumental plus Vocals, Drums, Bass, and Melody downloads for that track.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Check size={18} style={{ color: "var(--moss)", flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: "0.92rem", color: "var(--muted)" }}>
                <strong style={{ color: "var(--forest)" }}>Auto-Refund Guarantee:</strong> If an upload ever fails to
                process due to a server error, your song credit is automatically refunded to your wallet.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Check size={18} style={{ color: "var(--moss)", flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: "0.92rem", color: "var(--muted)" }}>
                <strong style={{ color: "var(--forest)" }}>Free Creator Backup Tools:</strong> The Creator Audio
                Extractor (`/reel-to-mp3`) and Clip Archiver (`/reel-download`) remain free for all signed-in users.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
