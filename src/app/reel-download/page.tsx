import ToolHero from "@/components/ToolHero";
import LinkTool from "@/components/LinkTool";
import { Check } from "@/components/Icons";
import { PHOTOS } from "@/lib/photos";

export const metadata = {
  title: "Creator Clip Archiver (MP4 Backup) · Sagewave Studio",
  description:
    "Back up and archive your own published short-form social videos as standard H.264/AAC MP4 files for portfolio backups and cross-platform repurposing.",
};

export default function Page() {
  return (
    <>
      <ToolHero
        image={PHOTOS.reelVideo.src}
        credit={PHOTOS.reelVideo.credit}
        eyebrow="Creator Clip Archiver"
        title={<>Back up your clips, <em className="serif">ready for any timeline.</em></>}
        lede="Paste a link to your published reel or authorized clip to remux the highest-resolution video and audio streams into a standard MP4 container for your editing timeline."
      />
      <section className="workspace">
        <div className="container">
          <div className="panel-grid">
            <div className="panel">
              <LinkTool mode="video" />
            </div>
            <aside className="aside">
              <h4>Archival Standards</h4>
              <ul>
                <li><Check size={16} /> Lossless DASH video + AAC audio stream remux into MP4</li>
                <li><Check size={16} /> Compatible with Premiere Pro, Final Cut, CapCut & DaVinci</li>
                <li><Check size={16} /> Works with public links you own or have license to archive</li>
                <li><Check size={16} /> Temporary processing — files auto-delete after 1 hour</li>
              </ul>
            </aside>
          </div>

          <div className="panel" style={{ marginTop: 28 }}>
            <span className="eyebrow">Cross-Platform Repurposing</span>
            <h3 style={{ marginTop: 10, marginBottom: 12 }}>Maintaining video & audio fidelity across editing suites</h3>
            <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.7 }}>
              Social platforms deliver short-form video using separate Dynamic Adaptive Streaming over HTTP (DASH)
              video and audio tracks. Our archiver fetches both native streams and losslessly muxes them into a
              single, standards-compliant MP4 container—preserving frame rate, color profile, and stereo AAC audio
              for your personal portfolio backup or multi-platform content workflow.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
