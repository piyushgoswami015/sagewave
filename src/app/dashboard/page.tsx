import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserWallet } from "@/lib/billing";
import { ArrowUpRight, Check } from "@/components/Icons";
import { PHOTOS } from "@/lib/photos";
import AccountSecurity from "./AccountSecurity";
import RecentHistory from "./RecentHistory";

export const metadata = {
  title: "Creator Studio Dashboard · Sagewave",
  description: "Your personal Sagewave Creator Studio workspace — access AI stem separation, 320 kbps audio extraction, and recent session exports.",
};

const TOOLS = [
  {
    n: "01",
    href: "/stem-split",
    img: PHOTOS.stems.src,
    title: "AI Stem & Instrumental Studio",
    copy: "Upload an MP3, WAV, FLAC, or M4A to isolate Instrumental, Vocals, Drums, Bass, and Melody stems.",
    cta: "Open Stem Studio",
  },
  {
    n: "02",
    href: "/reel-to-mp3",
    img: PHOTOS.reelAudio.src,
    title: "Creator Audio Extractor (MP3)",
    copy: "Extract a broadcast-ready 320 kbps MP3 audio master from your published social clips.",
    cta: "Extract 320 kbps MP3",
  },
  {
    n: "03",
    href: "/reel-download",
    img: PHOTOS.reelVideo.src,
    title: "Creator Clip Archiver (MP4)",
    copy: "Back up your own published short-form video clips as standard H.264/AAC MP4 files.",
    cta: "Archive MP4 Clip",
  },
];

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const firstName = session.user.name?.split(" ")[0] || "Creator";
  let wallet = null;
  try {
    if (session.user.email) {
      wallet = await getUserWallet(session.user.email);
    }
  } catch (err) {
    console.error("[dashboard] Error loading wallet:", err);
  }

  let expStr: string | null = null;
  try {
    if (wallet?.premiumExpiresAt) {
      const d = new Date(wallet.premiumExpiresAt);
      if (!isNaN(d.getTime())) {
        expStr = d.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
    }
  } catch {
    expStr = null;
  }

  return (
    <section className="section" style={{ paddingTop: 48 }}>
      <div className="container">
        <div className="section-head" style={{ marginBottom: 36 }}>
          <div>
            <span className="eyebrow">Creator Studio Workspace</span>
            <h1 style={{ fontSize: "clamp(2.2rem, 4.2vw, 3.4rem)", marginTop: 12 }}>
              Welcome back, <em className="serif">{firstName}.</em>
            </h1>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {wallet?.isPremium ? (
              <span className="badge" style={{ background: "var(--forest)", color: "var(--cream)" }}>
                ★ PREMIUM · {wallet.credits}/30 Songs Left{expStr ? ` · Valid till ${expStr}` : ""}
              </span>
            ) : (
              <>
                <span className="badge">
                  {wallet && wallet.credits > 0
                    ? `Free Trial: ${wallet.credits} Song Left`
                    : "AI Stem Locked (0 Songs Left)"}
                </span>
                <Link href="/pricing" className="btn btn-primary btn-sm">
                  Get Premium · ₹15 <ArrowUpRight size={14} />
                </Link>
              </>
            )}
            <span className="badge">
              <Check size={14} /> {session.user.email}
            </span>
          </div>
        </div>

        <div className="tools-grid">
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href} className="tool-card">
              <div className="photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.img} alt="" />
                <span className="num">{t.n}</span>
              </div>
              <div className="body">
                <h3>{t.title}</h3>
                <p>{t.copy}</p>
                <div className="go">
                  {t.cta}
                  <span className="circle"><ArrowUpRight size={16} /></span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <RecentHistory />
        {session.user.email && <AccountSecurity email={session.user.email} />}
      </div>
    </section>
  );
}
