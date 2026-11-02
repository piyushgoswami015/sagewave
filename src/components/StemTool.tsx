"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import AudioPlayer from "./AudioPlayer";
import Progress from "./Progress";
import { Alert, Check, Close, Download, Layers, Music, Refresh, Upload } from "./Icons";
import { addStudioHistory } from "@/lib/history";

interface StemFile {
  key: string;
  label: string;
  file: string;
  size: number;
}

const PHASES = ["Uploading", "Separating stems", "Mixing instrumental"];
const MAX = 60 * 1024 * 1024;

function fmtSize(b: number) {
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
}
function fmtElapsed(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function StemTool() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [pct, setPct] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [files, setFiles] = useState<StemFile[] | null>(null);
  const tick = useRef<number | null>(null);
  const poll = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (tick.current) clearInterval(tick.current);
      if (poll.current) clearTimeout(poll.current);
    },
    []
  );

  const pick = (f: File | undefined | null) => {
    setError(null);
    if (!f) return;
    if (!/^audio\//.test(f.type) && !/\.(mp3|wav|flac|m4a|aac|ogg)$/i.test(f.name)) {
      setError("That file isn't audio. Try an MP3, WAV, FLAC or M4A.");
      return;
    }
    if (f.size > MAX) {
      setError("That file is over 60 MB — please use a shorter or compressed track.");
      return;
    }
    setFile(f);
  };

  const stopTimers = () => {
    if (tick.current) clearInterval(tick.current);
    if (poll.current) clearTimeout(poll.current);
  };

  const start = async () => {
    if (!file || busy) return;

    // Require login when clicking Extract instrumental
    if (!session?.user) {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      return;
    }

    setBusy(true);
    setError(null);
    setFiles(null);
    setPhase(0);
    setPct(5);
    setElapsed(0);
    const t0 = Date.now();
    tick.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/stems", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      setJobId(data.id);

      if (data.status === "done" && data.files) {
        stopTimers();
        setPhase(2);
        setPct(100);
        await new Promise((ok) => setTimeout(ok, 450));
        setFiles(data.files);
        const inst = (data.files as StemFile[]).find((f) => f.key === "instrumental") ?? data.files[0];
        if (inst) {
          addStudioHistory({
            id: data.id,
            kind: "stems",
            title: file.name,
            subtitle: "4 Stems + Instrumental · 320 kbps",
            downloadUrl: `/api/files/${data.id}/${inst.file}?download=1`,
            createdAt: Date.now(),
          });
        }
        setBusy(false);
        return;
      }

      setPhase(1);
      setPct(18);
      const sepStart = Date.now();

      const check = async () => {
        try {
          const r = await fetch(`/api/stems/${data.id}`, { cache: "no-store" });
          const s = await r.json();
          if (!r.ok) throw new Error(s.error || "Lost track of the job.");
          if (s.status === "done") {
            stopTimers();
            setPhase(3);
            setPct(100);
            await new Promise((ok) => setTimeout(ok, 450));
            setFiles(s.files);
            const inst = (s.files as StemFile[])?.find((f) => f.key === "instrumental") ?? s.files?.[0];
            if (inst) {
              addStudioHistory({
                id: data.id,
                kind: "stems",
                title: file.name,
                subtitle: "4 Stems + Instrumental · 320 kbps",
                downloadUrl: `/api/files/${data.id}/${inst.file}?download=1`,
                createdAt: Date.now(),
              });
            }
            setBusy(false);
            return;
          }
          if (s.status === "failed") throw new Error(s.error || "Separation failed.");
          if (s.status === "finishing") {
            setPhase(2);
            setPct(92);
          } else {
            // ease toward 88% over ~3 minutes
            const k = Math.min(1, (Date.now() - sepStart) / 180000);
            setPct(18 + 70 * (1 - Math.pow(1 - k, 2)));
          }
          poll.current = window.setTimeout(check, 3000);
        } catch (err) {
          stopTimers();
          setError((err as Error).message);
          setBusy(false);
        }
      };
      poll.current = window.setTimeout(check, 2500);
    } catch (err) {
      stopTimers();
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const reset = () => {
    setFiles(null);
    setFile(null);
    setJobId(null);
    setPct(0);
    setPhase(0);
  };

  if (files && jobId) {
    const inst = files.find((f) => f.key === "instrumental");
    const rest = files.filter((f) => f.key !== "instrumental");
    const url = (f: StemFile) => `/api/files/${jobId}/${f.file}`;
    return (
      <div className="result">
        <div className="success-line">
          <span className="tick"><Check size={14} /></span>
          Separated — vocals removed
        </div>

        {inst && (
          <div className="stem-hero">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap" }}>
              <div>
                <h3>Instrumental</h3>
                <p className="sub">Everything except the voice · MP3 320 kbps · {fmtSize(inst.size)}</p>
              </div>
              <a className="btn btn-primary btn-sm" href={`${url(inst)}?download=1`} download>
                <Download size={16} /> Download
              </a>
            </div>
            <AudioPlayer src={url(inst)} bars={72} />
          </div>
        )}

        {rest.length > 0 && (
          <>
            <p className="field-label" style={{ marginTop: 28, marginBottom: 0 }}>Individual stems</p>
            <div className="stem-list">
              {rest.map((f) => (
                <div className="stem-row" key={f.key}>
                  <span className="lbl">{f.label}</span>
                  <AudioPlayer src={url(f)} bars={48} />
                  <a className="icon-btn" href={`${url(f)}?download=1`} download aria-label={`Download ${f.label}`}>
                    <Download size={16} />
                  </a>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="result-actions">
          <button className="btn btn-ghost" onClick={reset}>
            <Refresh size={16} /> Separate another track
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {!file ? (
        <div
          className={`dropzone${drag ? " drag" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files?.[0]);
          }}
        >
          <input type="file" accept="audio/*,.mp3,.wav,.flac,.m4a" onChange={(e) => pick(e.target.files?.[0])} aria-label="Choose audio file" />
          <div className="dz-icon"><Upload size={24} /></div>
          <div className="dz-title">Drop a song here</div>
          <div className="dz-sub">or <u>browse your files</u> · MP3, WAV, FLAC, M4A up to 60 MB</div>
        </div>
      ) : (
        <>
          <div className="file-pill">
            <div className="ic"><Music size={20} /></div>
            <div style={{ minWidth: 0 }}>
              <div className="nm">{file.name}</div>
              <div className="sz">{fmtSize(file.size)}{busy && ` · ${fmtElapsed(elapsed)} elapsed`}</div>
            </div>
            {!busy && (
              <button className="x" onClick={() => setFile(null)} aria-label="Remove file"><Close size={16} /></button>
            )}
          </div>
          <div className="result-actions" style={{ marginTop: 20 }}>
            <button className="btn btn-primary" onClick={start} disabled={busy}>
              <Layers size={17} /> {busy ? "Separating…" : "Extract instrumental"}
            </button>
          </div>
        </>
      )}

      {busy && (
        <>
          <Progress phases={PHASES} active={phase} percent={pct} />
          <p className="hint">Studio-grade separation takes about 1–3 minutes for a typical song. Keep this tab open.</p>
        </>
      )}

      {error && (
        <div className="error-msg" role="alert">
          <Alert size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
