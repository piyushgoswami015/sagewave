import Link from "next/link";
import { Arrow, ArrowUpRight, Check } from "@/components/Icons";
import { PHOTOS } from "@/lib/photos";

const TOOLS = [
  {
    n: "01",
    href: "/stem-split",
    img: PHOTOS.stems.src,
    title: "AI Stem & Instrumental Studio",
    copy: "Isolate studio-grade instrumentals, vocals, bass, and drums from your recordings using Hybrid Transformer neural separation.",
  },
  {
    n: "02",
    href: "/reel-to-mp3",
    img: PHOTOS.reelAudio.src,
    title: "Creator Audio Master (MP3)",
    copy: "Extract the original voiceover or audio track from your published social clips as a broadcast-ready 320 kbps MP3.",
  },
  {
    n: "03",
    href: "/reel-download",
    img: PHOTOS.reelVideo.src,
    title: "Creator Clip Archiver (MP4)",
    copy: "Back up your own published short-form videos in original resolution for cross-platform editing and portfolio archiving.",
  },
];

const GUIDES = [
  {
    title: "AI Stem Separation for Practice & Production",
    body: "Musicians, vocal coaches, and remix producers use neural source separation to decompose stereo masters into isolated instrumentals, percussion, basslines, and acapellas—making it easy to rehearse arrangements or study mix balance.",
  },
  {
    title: "Repurposing Your Own Short-Form Audio",
    body: "Podcasters and video creators often record directly inside mobile apps. Extracting a clean 320 kbps CBR MP3 at 44.1 kHz lets you archive your spoken-word clips, build podcast feeds, or master audio in your DAW without generational loss.",
  },
  {
    title: "Privacy-First Ephemeral Processing",
    body: "Unlike cloud storage lockers, Sagewave processes streams in isolated temporary workspaces and automatically purges every file after 60 minutes. We never index, catalog, or redistribute user-submitted media.",
  },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow reveal">AI Audio Studio & Creator Archiving Suite</span>
            <h1 className="reveal d1">
              Keep the sound.
              <br />
              <em className="serif">Craft the mix.</em>
            </h1>
            <p className="hero-lede reveal d2">
              Sagewave is a calm, browser-based audio studio for creators and musicians — separate any recording into
              clean instrumentals & stems, extract 320 kbps audio from your published clips, and back up your own reels.
            </p>
            <div className="hero-cta reveal d3">
              <Link href="/stem-split" className="btn btn-primary">
                Open AI Stem Studio <Arrow size={16} className="arrow" />
              </Link>
              <Link href="/reel-to-mp3" className="btn btn-ghost">
                Creator Audio Backup
              </Link>
            </div>
            <div className="hero-meta reveal d4">
              <div><strong>4 Stems</strong><span>AI neural separation</span></div>
              <div><strong>320</strong><span>kbps LAME MP3 master</span></div>
              <div><strong>60 min</strong><span>auto-purged privacy</span></div>
            </div>
          </div>

          <div className="hero-visual reveal d2">
            <div className="hero-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PHOTOS.hero.src} alt="A record spinning on a turntable" />
            </div>
            <div className="float-card">
              <div className="row">
                <span className="live-dot">AI Demucs Engine</span>
                <span>01:42</span>
              </div>
              <div className="title">session-master.mp3 → instrumental</div>
              <div className="mini-bars" aria-hidden>
                {Array.from({ length: 22 }).map((_, i) => (
                  <i key={i} style={{ animationDelay: `${(i * 97) % 1400}ms`, height: `${30 + ((i * 37) % 70)}%` }} />
                ))}
              </div>
            </div>
            <div className="float-tag">Studio · 320 kbps ✓</div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 24 }}>
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Creator Utilities</span>
              <h2 style={{ marginTop: 14 }}>
                Three studio utilities, <em className="serif">one</em> calm workspace.
              </h2>
            </div>
            <p>Designed for musicians, podcasters, and independent creators managing their own media library.</p>
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
                    Launch utility
                    <span className="circle"><ArrowUpRight size={16} /></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="band">
            <div className="bg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PHOTOS.band.src} alt="" />
            </div>
            <div>
              <span className="eyebrow" style={{ color: "var(--sage)" }}>Workflow</span>
              <h2 style={{ marginTop: 14 }}>
                Built for <em className="serif" style={{ color: "var(--sage)" }}>authorized</em> creator workflows.
              </h2>
              <p style={{ marginTop: 18, color: "rgba(243,236,220,.75)", maxWidth: 440 }}>
                Sign in with Google, select a studio utility, and process your audio or personal social clips in
                seconds. Every job runs in an isolated temporary folder that self-deletes after one hour.
              </p>
            </div>
            <div className="steps">
              <div className="step">
                <span className="n">1</span>
                <div><h4>Provide your source</h4><p>Upload your audio recording or paste a link to your own published clip.</p></div>
              </div>
              <div className="step">
                <span className="n">2</span>
                <div><h4>Studio DSP & AI processing</h4><p>Hybrid Transformer stem separation or 320 kbps LAME audio transcoding.</p></div>
              </div>
              <div className="step">
                <span className="n">3</span>
                <div><h4>Audition & export</h4><p>Preview waveforms right in the browser, then export to your local DAW or archive.</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Audio Engineering Notes</span>
              <h2 style={{ marginTop: 14 }}>
                How creators use <em className="serif">Sagewave</em>.
              </h2>
            </div>
            <p>Ethical, high-resolution audio processing for independent production and rights-cleared archiving.</p>
          </div>

          <div className="tools-grid">
            {GUIDES.map((g) => (
              <article key={g.title} className="tool-card" style={{ padding: 28 }}>
                <span className="badge" style={{ alignSelf: "flex-start", marginBottom: 14 }}>
                  <Check size={13} /> Studio Guide
                </span>
                <h3 style={{ fontSize: "1.3rem", marginBottom: 10 }}>{g.title}</h3>
                <p style={{ color: "var(--muted)", fontSize: "0.94rem", lineHeight: 1.65 }}>{g.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
