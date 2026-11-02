import ToolHero from "@/components/ToolHero";
import LinkTool from "@/components/LinkTool";
import { Check } from "@/components/Icons";
import { PHOTOS } from "@/lib/photos";

export const metadata = {
  title: "Creator Audio Extractor (320 kbps MP3) · Sagewave Studio",
  description:
    "Extract and transcode the audio track from your published Instagram Reels or licensed social clips into a studio-grade 320 kbps MP3 for podcasts and DAW editing.",
};

export default function Page() {
  return (
    <>
      <ToolHero
        image={PHOTOS.reelAudio.src}
        credit={PHOTOS.reelAudio.credit}
        eyebrow="Creator Audio Extractor"
        title={<>Extract studio audio <em className="serif">from your clips.</em></>}
        lede="Paste a link to your published reel or rights-cleared clip. We demux the original audio stream and encode a broadcast-ready 320 kbps MP3 for your podcast or DAW."
      />
      <section className="workspace">
        <div className="container">
          <div className="panel-grid">
            <div className="panel">
              <LinkTool mode="audio" />
            </div>
            <aside className="aside">
              <h4>Studio Specifications</h4>
              <ul>
                <li><Check size={16} /> 320 kbps CBR MP3 at 44.1 kHz via LAME encoder</li>
                <li><Check size={16} /> Direct AAC/M4A demux — zero video transcode overhead</li>
                <li><Check size={16} /> Built-in waveform audition player before export</li>
                <li><Check size={16} /> Ephemeral workspace — auto-purged in 60 minutes</li>
              </ul>
            </aside>
          </div>

          <div className="panel" style={{ marginTop: 28 }}>
            <span className="eyebrow">Creator Workflow Guide</span>
            <h3 style={{ marginTop: 10, marginBottom: 12 }}>Why creators archive short-form audio at 320 kbps</h3>
            <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.7 }}>
              When you record voiceovers, interviews, or original musical ideas directly inside mobile social apps,
              the original audio often stays locked inside a vertical video container. Sagewave demuxes the native
              audio stream and encodes it using the LAME MP3 encoder at 320 kbps constant bitrate (44.1 kHz sample
              rate) so you can import your own segments into Logic Pro, Ableton Live, Audacity, or your podcast RSS
              host without unwanted artifacts.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
