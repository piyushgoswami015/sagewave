import type { Metadata } from "next";
import ToolHero from "@/components/ToolHero";
import StemTool from "@/components/StemTool";
import { Check } from "@/components/Icons";
import { PHOTOS } from "@/lib/photos";

export const metadata: Metadata = {
  title: "Extract Instrumental from Song Online — Free AI Backing Track Maker | Sagewave",
  description:
    "Extract the instrumental or background music from any song online for free. Turn MP3, WAV, or FLAC recordings into studio-grade 320 kbps instrumental backing tracks.",
  keywords: [
    "extract instrumental from song",
    "background music extractor",
    "AI instrumental maker online",
    "karaoke backing track maker",
    "song to instrumental converter",
    "free AI music separator",
  ],
  alternates: { canonical: "/extract-instrumental" },
};

const FAQS = [
  {
    q: "How do I extract the instrumental from a song?",
    a: "Upload your song (MP3, WAV, FLAC, or M4A) in the studio box above and press Extract Instrumental. Our neural model isolates all non-vocal instruments—drums, bass, guitars, synths, and keys—into a single 320 kbps instrumental MP3.",
  },
  {
    q: "Can I use this to extract background music for rehearsal or covers?",
    a: "Yes. Vocalists, instrumentalists, and content creators use Sagewave to generate clean instrumental backing tracks from reference recordings for rehearsal, audition tapes, and music education.",
  },
  {
    q: "What file formats can I upload to extract an instrumental?",
    a: "You can upload MP3, WAV, FLAC, M4A, AAC, or OGG audio files up to 60 MB per track.",
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

export default function ExtractInstrumentalPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <ToolHero
        image={PHOTOS.stems.src}
        credit={PHOTOS.stems.credit}
        eyebrow="AI Instrumental Extractor"
        title={<>Extract the instrumental <em className="serif">from any song.</em></>}
        lede="Turn any stereo recording into a clean, phase-coherent instrumental backing track. Powered by Hybrid Transformer Demucs AI and exported at 320 kbps MP3."
      />
      <section className="workspace">
        <div className="container">
          <div className="panel-grid">
            <div className="panel">
              <StemTool />
            </div>
            <aside className="aside">
              <h4>Instrumental Output</h4>
              <ul>
                <li><Check size={16} /> Full stereo instrumental (Drums + Bass + Melody)</li>
                <li><Check size={16} /> Built-in browser waveform player for instant preview</li>
                <li><Check size={16} /> 320 kbps CBR MP3 master at 44.1 kHz</li>
                <li><Check size={16} /> Auto-purged 60 minutes after processing</li>
              </ul>
            </aside>
          </div>

          <div className="panel" style={{ marginTop: 28 }}>
            <span className="eyebrow">Backing Track Studio</span>
            <h2 style={{ fontSize: "1.6rem", marginTop: 10, marginBottom: 12 }}>
              Extract Background Music &amp; Instrumentals with Neural AI
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.7 }}>
              When extracting an instrumental from a mastered song, preserving the transient snap of the drums and the
              warmth of the bassline is essential. Sagewave reconstructs the instrumental directly from neural stems so
              your backing track sounds balanced and natural on studio monitors or headphones.
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
