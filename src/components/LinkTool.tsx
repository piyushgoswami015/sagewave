"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import AudioPlayer from "./AudioPlayer";
import Progress from "./Progress";
import { Alert, Arrow, Check, Clipboard, Clock, Download, File, Refresh } from "./Icons";
import { addStudioHistory } from "@/lib/history";

type Mode = "audio" | "video";

interface Result {
  id: string;
  file: string;
  thumb: string | null;
  title: string;
  uploader: string | null;
  duration: number | null;
  size: number;
}

const IG_RE = /^https?:\/\/(www\.|m\.)?instagram\.com\/(reel|reels|p|tv)\/[A-Za-z0-9_-]+\/?(\?.*)?$/i;

const PHASES: Record<Mode, string[]> = {
  audio: ["Reading link", "Fetching reel", "Encoding 320 kbps MP3"],
  video: ["Reading link", "Fetching reel", "Preparing MP4"],
};

function fmtSize(b: number) {
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
}
function fmtDur(s: number | null) {
  if (!s) return null;
  return `${Math.floor(s / 60)}:${Math.round(s % 60).toString().padStart(2, "0")}`;
}

export default function LinkTool({ mode }: { mode: Mode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const timers = useRef<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const valid = IG_RE.test(url.trim());
  const showInvalid = touched && url.length > 0 && !valid;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Restore saved URL if user just returned from logging in
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`sagewave_pending_${mode}`);
      if (saved) {
        setUrl(saved);
        sessionStorage.removeItem(`sagewave_pending_${mode}`);
      }
    } catch {}
  }, [mode]);

  const animate = () => {
    setPhase(0);
    setPct(6);
    const plan: [number, number, number][] = [
      [500, 1, 22],
      [2500, 1, 48],
      [5000, 2, 70],
      [9000, 2, 84],
      [16000, 2, 92],
    ];
    timers.current = plan.map(([ms, ph, p]) =>
      window.setTimeout(() => {
        setPhase(ph);
        setPct(p);
      }, ms)
    );
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (!valid || busy) return;

    // Require login when clicking Convert / Fetch video
    if (!session?.user) {
      try {
        sessionStorage.setItem(`sagewave_pending_${mode}`, url.trim());
      } catch {}
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);
    animate();
    try {
      const res = await fetch("/api/reel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      timers.current.forEach(clearTimeout);
      setPhase(3);
      setPct(100);
      await new Promise((r) => setTimeout(r, 450));
      setResult(data);
      addStudioHistory({
        id: data.id,
        kind: mode,
        title: data.title || (mode === "audio" ? "Reel Audio Master" : "Reel Video Backup"),
        subtitle: mode === "audio" ? "MP3 · 320 kbps" : "MP4 · Original quality",
        downloadUrl: `/api/files/${data.id}/${data.file}?download=1`,
        createdAt: Date.now(),
      });
    } catch (err) {
      timers.current.forEach(clearTimeout);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text.trim());
      setTouched(true);
    } catch {
      inputRef.current?.focus();
    }
  };

  const reset = () => {
    setResult(null);
    setUrl("");
    setTouched(false);
    setPct(0);
    setPhase(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const fileUrl = result ? `/api/files/${result.id}/${result.file}` : "";

  if (result) {
    return (
      <div className="result">
        <div className="success-line">
          <span className="tick"><Check size={14} /></span>
          {mode === "audio" ? "Your MP3 is ready" : "Your video is ready"}
        </div>

        <div className="result-head">
          <div className="thumb">
            {result.thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/${result.id}/${result.thumb}`} alt="" />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="result-title">{result.title}</div>
            <div className="result-meta">
              {result.uploader && <span>@{result.uploader}</span>}
              {fmtDur(result.duration) && (
                <span><Clock size={14} /> {fmtDur(result.duration)}</span>
              )}
              <span><File size={14} /> {fmtSize(result.size)}</span>
              <span className="badge">{mode === "audio" ? "MP3 · 320 kbps" : "MP4 · original quality"}</span>
            </div>
          </div>
        </div>

        {mode === "audio" ? (
          <AudioPlayer src={fileUrl} />
        ) : (
          <div className="video-frame">
            <video src={fileUrl} controls playsInline preload="metadata" />
          </div>
        )}

        <div className="result-actions">
          <a className="btn btn-primary" href={`${fileUrl}?download=1`} download>
            <Download /> Download {mode === "audio" ? "MP3" : "video"}
          </a>
          <button className="btn btn-ghost" onClick={reset}>
            <Refresh size={16} /> Convert another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="field-label" htmlFor="reel-url">Instagram reel link</label>
      <div className={`url-field${showInvalid ? " invalid" : ""}`}>
        <input
          id="reel-url"
          ref={inputRef}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://www.instagram.com/reel/…"
          value={url}
          disabled={busy}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          onBlur={() => setTouched(true)}
        />
        {!url && !busy && (
          <button type="button" className="paste-btn" onClick={paste}>
            <Clipboard size={15} /> Paste
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy || !url}>
          {busy ? "Working…" : mode === "audio" ? "Convert" : "Fetch video"}
          {!busy && <Arrow size={16} className="arrow" />}
        </button>
      </div>

      {showInvalid ? (
        <p className="hint" style={{ color: "#8a4423" }}>
          <Alert size={14} /> Paste a public clip link like instagram.com/reel/Cx12AbC…
        </p>
      ) : (
        <p className="hint">
          By continuing, you confirm you own the rights or have permission to process this clip (<a href="/terms" style={{ textDecoration: "underline" }}>Terms &amp; DMCA</a>).
        </p>
      )}

      {busy && <Progress phases={PHASES[mode]} active={phase} percent={pct} />}

      {error && (
        <div className="error-msg" role="alert">
          <Alert size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}
    </form>
  );
}
