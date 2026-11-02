import type { Metadata } from "next";
import ToolHero from "@/components/ToolHero";
import StemTool from "@/components/StemTool";
import { Check } from "@/components/Icons";
import { PHOTOS } from "@/lib/photos";

export const metadata: Metadata = {
  title: "AI Vocal Remover Online — Remove Vocals from MP3 & Separate Vocals from Music | Sagewave",
  description:
    "Free AI vocal remover online. Remove vocals from any MP3, WAV, FLAC, or M4A song in seconds and download both the clean 320 kbps instrumental and isolated acapella vocals.",
  keywords: [
    "AI vocal remover online",
    "remove vocals from MP3",
    "separate vocals from music",
    "free online vocal remover",
    "isolate vocals from song",
    "acapella extractor AI",
  ],
  alternates: { canonical: "/vocal-remover" },
};

const FAQS = [
  {
    q: "How can I remove vocals from an MP3 online for free?",
    a: "Drop your MP3 file into the Sagewave AI Vocal Remover above and click Extract Instrumental. Within 1–2 minutes, our neural network separates the lead and backing vocals from the music so you can preview and download the vocal-free instrumental in 320 kbps MP3.",
  },
  {
    q: "Can I also download the isolated vocals (acapella) separately?",
    a: "Yes! Alongside the vocal-free Instrumental track, Sagewave gives you the isolated Vocals stem so singers, producers, and educators can study vocal phrasing or build acapella arrangements.",
  },
  {
    q: "Does removing vocals reduce the audio quality of the music?",
    a: "Because Sagewave uses Hybrid Transformer Demucs AI rather than destructive frequency notch filters, drums, bass, and stereo guitars remain full-bodied and are exported at 320 kbps CBR MP3 (44.1 kHz).",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function VocalRemoverPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <ToolHero
        image={PHOTOS.stems.src}
        credit={PHOTOS.stems.credit}
        eyebrow="AI Vocal Remover Online"
        title={<>Remove vocals from MP3. <em className="serif">Keep pure music.</em></>}
        lede="Separate vocals from music in seconds using Hybrid Transformer AI. Upload any MP3, WAV, FLAC, or M4A track to export a clean 320 kbps instrumental and isolated vocal stem."
      />
      <section className="workspace">
        <div className="container">
          <div className="panel-grid">
            <div className="panel">
              <StemTool />
            </div>
            <aside className="aside">
              <h4>Vocal Remover Specs</h4>
              <ul>
                <li><Check size={16} /> Removes lead &amp; backing vocals without losing bass</li>
                <li><Check size={16} /> Exports both Instrumental &amp; isolated Vocals (Acapella)</li>
                <li><Check size={16} /> Broadcast-grade 320 kbps CBR MP3 output</li>
                <li><Check size={16} /> Private processing — auto-deleted after 60 minutes</li>
              </ul>
            </aside>
          </div>

          <div className="panel" style={{ marginTop: 28 }}>
            <span className="eyebrow">Studio Vocal Isolation</span>
            <h2 style={{ fontSize: "1.6rem", marginTop: 10, marginBottom: 12 }}>
              Separate Vocals from Music Without Phase Artifacts
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.7 }}>
              Whether you are preparing a live vocal performance, creating a karaoke backing track, or studying vocal
              production, our AI vocal remover isolates the human voice from complex stereo mixes while preserving the
              natural stereo imaging and low-end punch of the original recording.
            </p>

            <div className="faq-list" style={{ marginTop: 24 }}>
              {FAQS.map((f) => (
                <details key={f.q} className="faq-item">
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
