import type { Metadata } from "next";
import ToolHero from "@/components/ToolHero";
import StemTool from "@/components/StemTool";
import { Check } from "@/components/Icons";
import { PHOTOS } from "@/lib/photos";

export const metadata: Metadata = {
  title: "Free AI Stem Separator & Vocal Remover Online — Separate Vocals, Drums & Bass | Sagewave",
  description:
    "Free AI music separator and vocal remover online. Upload any MP3, WAV, FLAC, or M4A to separate vocals from music, extract instrumental backing tracks, and isolate drums & bass using Hybrid Transformer Demucs AI.",
  keywords: [
    "AI stem separator",
    "free AI music separator",
    "AI vocal remover online",
    "separate vocals from music",
    "remove vocals from MP3",
    "extract instrumental from song",
    "separate drums from music",
  ],
  alternates: { canonical: "/stem-split" },
};

const FAQS = [
  {
    q: "How do I separate vocals and instruments from a song online for free?",
    a: "Upload your MP3, WAV, FLAC, or M4A file into Sagewave's AI Stem Studio above and click Extract Instrumental. Our Hybrid Transformer Demucs neural network automatically splits the track into a clean Instrumental mix, isolated Vocals, Drums, Bass, and Melody stems at 320 kbps MP3.",
  },
  {
    q: "Why is Hybrid Transformer AI better than standard vocal removers?",
    a: "Older vocal removers use mid-side phase cancellation (OOPS), which accidentally deletes center-panned basslines and snare drums. Sagewave uses a dual-domain Hybrid Transformer architecture (htdemucs) that separates time-domain waveforms and spectrograms simultaneously—keeping the bass punchy and the instrumental mix phase-aligned.",
  },
  {
    q: "Can I separate drums and bass from music for practice or remixing?",
    a: "Yes. When you process a 4-stem separation, Sagewave provides individual players and 320 kbps MP3 downloads for Drums, Bass, Vocals, and Melody & Keys in addition to the master Instrumental backing track.",
  },
  {
    q: "Are my uploaded audio files kept private?",
    a: "Yes. Every uploaded audio file is processed inside an isolated temporary workspace and is automatically deleted from our servers 60 minutes after creation.",
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

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <ToolHero
        image={PHOTOS.stems.src}
        credit={PHOTOS.stems.credit}
        eyebrow="AI Stem & Instrumental Studio"
        title={<>Lift the voice. <em className="serif">Keep the music.</em></>}
        lede="Upload an audio recording and our Hybrid Transformer neural network separates it into Vocals, Drums, Bass, and Melody — plus a clean, phase-aligned Instrumental mix."
      />
      <section className="workspace">
        <div className="container">
          <div className="panel-grid">
            <div className="panel">
              <StemTool />
            </div>
            <aside className="aside">
              <h4>Under the hood</h4>
              <ul>
                <li><Check size={16} /> Hybrid Transformer Demucs (htdemucs) neural architecture</li>
                <li><Check size={16} /> Phase-coherent Instrumental mixed from non-vocal stems</li>
                <li><Check size={16} /> Every stem exported at 320 kbps CBR MP3 (44.1 kHz)</li>
                <li><Check size={16} /> Supports MP3, WAV, FLAC & M4A up to 60 MB</li>
              </ul>
            </aside>
          </div>

          <div className="panel" style={{ marginTop: 28 }}>
            <span className="eyebrow">Technical Overview</span>
            <h2 style={{ fontSize: "1.6rem", marginTop: 10, marginBottom: 12 }}>
              Free AI Stem Separator &amp; Vocal Remover Online
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.7 }}>
              Traditional vocal removers rely on simple mid-side phase cancellation, which often strips out center-panned
              bass and snare drums. Sagewave uses a dual-domain Hybrid Transformer architecture (Demucs) that analyzes
              both time-domain waveforms and complex spectrograms simultaneously—cleanly isolating vocal harmonics while
              leaving drums, basslines, and acoustic accompaniment intact for practice, backing tracks, and music education.
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
