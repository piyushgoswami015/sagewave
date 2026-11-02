import type { Metadata } from "next";
import ToolHero from "@/components/ToolHero";
import StemTool from "@/components/StemTool";
import { Check } from "@/components/Icons";
import { PHOTOS } from "@/lib/photos";

export const metadata: Metadata = {
  title: "Separate Drums & Bass from Music Online — Free AI Drum Stem Extractor | Sagewave",
  description:
    "Separate drums and bass from any song online using Hybrid Transformer Demucs AI. Isolate drum tracks, basslines, vocals, and drumless practice mixes in 320 kbps MP3.",
  keywords: [
    "separate drums from music",
    "AI drum separator",
    "isolate bass from song",
    "drum stem extractor online",
    "AI stem separator",
    "free AI music separator",
  ],
  alternates: { canonical: "/drum-separator" },
};

const FAQS = [
  {
    q: "How do I separate drums from a song using AI?",
    a: "Upload your audio file above and click Extract Instrumental. Our 4-stem Hybrid Transformer Demucs engine separates Drums, Bass, Vocals, and Melody & Keys into individual tracks that you can audition and download at 320 kbps MP3.",
  },
  {
    q: "Can bass players and drummers use this to study parts?",
    a: "Yes. Drummers and bassists use isolated drum and bass stems to transcribe grooves, check kick-and-bass lock, or import stems into a DAW for practice.",
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

export default function DrumSeparatorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <ToolHero
        image={PHOTOS.stems.src}
        credit={PHOTOS.stems.credit}
        eyebrow="AI Drum & Bass Stem Studio"
        title={<>Isolate the rhythm. <em className="serif">Study every groove.</em></>}
        lede="Separate drums, basslines, vocals, and harmonic accompaniment from any stereo recording using 4-stem Hybrid Transformer Demucs AI."
      />
      <section className="workspace">
        <div className="container">
          <div className="panel-grid">
            <div className="panel">
              <StemTool />
            </div>
            <aside className="aside">
              <h4>Rhythm Section Stems</h4>
              <ul>
                <li><Check size={16} /> Isolated Drums stem (kick, snare, hats &amp; cymbals)</li>
                <li><Check size={16} /> Isolated Bass stem (electric, upright &amp; synth bass)</li>
                <li><Check size={16} /> Full Instrumental + Vocals + Melody stems included</li>
                <li><Check size={16} /> 320 kbps MP3 exports ready for any DAW timeline</li>
              </ul>
            </aside>
          </div>

          <div className="panel" style={{ marginTop: 28 }}>
            <span className="eyebrow">Rhythm &amp; Transcription</span>
            <h2 style={{ fontSize: "1.6rem", marginTop: 10, marginBottom: 12 }}>
              Separate Drums &amp; Bass from Music for Practice and Production
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.7 }}>
              Transcribing fast drum fills or complex basslines from a dense mix can be challenging. Sagewave decomposes
              stereo audio into discrete rhythmic and harmonic stems so musicians and educators can solo the percussion
              or low-end foundation with clarity.
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
