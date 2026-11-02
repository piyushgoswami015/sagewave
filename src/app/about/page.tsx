import Link from "next/link";
import { Check } from "@/components/Icons";

export const metadata = {
  title: "About & Contact · Sagewave Audio Studio",
  description: "Learn about Sagewave's AI stem separation and creator archiving tools, or get in touch with our team.",
};

export default function AboutPage() {
  return (
    <section className="section" style={{ paddingTop: 56 }}>
      <div className="container" style={{ maxWidth: 820 }}>
        <span className="eyebrow">About the Studio</span>
        <h1 style={{ fontSize: "clamp(2.2rem, 4vw, 3.4rem)", margin: "14px 0 18px" }}>
          Calm audio tools for <em className="serif">modern creators.</em>
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "1.08rem", marginBottom: 32 }}>
          Sagewave was built to give independent musicians, podcasters, and video creators a clean, distraction-free
          workspace for stem separation and personal media archiving.
        </p>

        <div className="panel" style={{ display: "grid", gap: 26, lineHeight: 1.7 }}>
          <div>
            <h3>Our Mission</h3>
            <p style={{ color: "var(--muted)", marginTop: 8 }}>
              Most online audio utilities are cluttered with pop-ups, deceptive download buttons, and low-bitrate
              transcoders. Sagewave combines state-of-the-art Hybrid Transformer neural source separation (Demucs) and
              320 kbps LAME MP3 mastering inside a calm, editorial interface.
            </p>
          </div>

          <div>
            <h3>What Makes Sagewave Different</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 10, color: "var(--muted)" }}>
              <li style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Check size={16} /> Studio-grade 4-stem AI separation (Instrumental, Vocals, Drums, Bass & Melody)
              </li>
              <li style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Check size={16} /> True 320 kbps CBR MP3 at 44.1 kHz with interactive waveform auditioning
              </li>
              <li style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Check size={16} /> Ephemeral 60-minute auto-purge privacy for every uploaded or processed file
              </li>
            </ul>
          </div>

          <div>
            <h3>Contact & Support</h3>
            <p style={{ color: "var(--muted)", marginTop: 8 }}>
              Have feedback, partnership inquiries, or a copyright/compliance question? Reach us anytime:
            </p>
            <p style={{ marginTop: 10, color: "var(--forest)", fontWeight: 600 }}>
              General Support, Privacy &amp; DMCA Compliance:{" "}
              <a href="mailto:wavethesage@gmail.com" style={{ textDecoration: "underline" }}>
                wavethesage@gmail.com
              </a>
            </p>
            <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/terms" className="btn btn-ghost btn-sm">Terms & DMCA Policy</Link>
              <Link href="/privacy" className="btn btn-ghost btn-sm">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
