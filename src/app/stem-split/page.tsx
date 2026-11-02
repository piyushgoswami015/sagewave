import ToolHero from "@/components/ToolHero";
import StemTool from "@/components/StemTool";
import { Check } from "@/components/Icons";
import { PHOTOS } from "@/lib/photos";

export const metadata = {
  title: "AI Stem & Instrumental Studio · Sagewave",
  description:
    "Separate any song or recording into studio-quality Instrumental, Vocals, Drums, Bass, and Melody stems using Hybrid Transformer Demucs AI.",
};

export default function Page() {
  return (
    <>
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
            <h3 style={{ marginTop: 10, marginBottom: 12 }}>How Hybrid Transformer source separation works</h3>
            <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.7 }}>
              Traditional vocal removers rely on simple mid-side phase cancellation, which often strips out center-panned
              bass and snare drums. Sagewave uses a dual-domain Hybrid Transformer architecture (Demucs) that analyzes
              both time-domain waveforms and complex spectrograms simultaneously—cleanly isolating vocal harmonics while
              leaving drums, basslines, and acoustic accompaniment intact for practice, backing tracks, and music education.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
