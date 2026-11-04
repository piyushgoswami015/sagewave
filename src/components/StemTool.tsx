"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import AudioPlayer from "./AudioPlayer";
import PricingCards from "./PricingCards";
import Progress from "./Progress";
import { Alert, Check, Close, Download, Layers, Music, Refresh, Upload } from "./Icons";
import { addStudioHistory, removeStudioHistory } from "@/lib/history";

interface StemFile {
  key: string;
  label: string;
  file: string;
  size: number;
}

const PHASES = ["Uploading", "Separating stems", "Mixing instrumental"];
const MAX = 60 * 1024 * 1024;
const ACTIVE_JOB_KEY = "sagewave_active_stem_job";
const ACTIVE_JOB_MAX_AGE_MS = 8 * 60 * 1000;

function fmtSize(b: number) {
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
}
function fmtElapsed(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function StemTool() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [file, setFile] = useState<File | null>(null);
  const [resumeName, setResumeName] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [pct, setPct] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [files, setFiles] = useState<StemFile[] | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const tick = useRef<number | null>(null);
  const poll = useRef<number | null>(null);
  const checkNow = useRef<(() => void) | null>(null);
  const resumed = useRef(false);

  const loadWallet = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/wallet", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.authenticated) {
        setCredits(data.credits);
        setIsPremium(Boolean(data.isPremium));
        setExpiresAt(data.premiumExpiresAt || null);
        setShowUpgrade(data.credits <= 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadWallet();
    const onWallet = () => loadWallet();
    window.addEventListener("sagewave-wallet", onWallet);
    return () => window.removeEventListener("sagewave-wallet", onWallet);
  }, [status, loadWallet]);

  useEffect(
    () => () => {
      if (tick.current) clearInterval(tick.current);
      if (poll.current) clearTimeout(poll.current);
    },
    []
  );

  // Browsers throttle timers in background tabs — poll immediately when the user comes back.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") checkNow.current?.();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

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
    checkNow.current = null;
  };

  const clearActiveJob = () => {
    try {
      localStorage.removeItem(ACTIVE_JOB_KEY);
    } catch {}
  };

  /**
   * Follows a running job until it is done or failed. Used both right after upload and
   * when the user returns to the page (tab switch / refresh) so a running job is never "lost".
   */
  const followJob = useCallback(
    (id: string, displayName: string, startedAt: number) => {
      setJobId(id);
      setBusy(true);
      setPhase(1);
      setPct(18);
      if (tick.current) clearInterval(tick.current);
      tick.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);

      const check = async () => {
        if (poll.current) clearTimeout(poll.current);
        try {
          const r = await fetch(`/api/stems/${id}`, { cache: "no-store" });
          const s = await r.json();
          if (!r.ok) throw new Error(s.error || "Lost track of the job.");
          if (s.status === "done") {
            stopTimers();
            clearActiveJob();
            setPhase(3);
            setPct(100);
            await new Promise((ok) => setTimeout(ok, 450));
            setFiles(s.files);
            const inst = (s.files as StemFile[])?.find((f) => f.key === "instrumental") ?? s.files?.[0];
            if (inst) {
              addStudioHistory({
                id,
                kind: "stems",
                title: displayName,
                subtitle: "4 Stems + Instrumental · 320 kbps",
                downloadUrl: `/api/files/${id}/${inst.file}?download=1`,
                createdAt: Date.now(),
              });
            }
            setBusy(false);
            loadWallet();
            return;
          }
          if (s.status === "failed") throw new Error(s.error || "Separation failed.");
          if (s.status === "finishing") {
            setPhase(2);
            setPct(92);
          } else {
            const k = Math.min(1, (Date.now() - startedAt) / 180000);
            setPct(18 + 70 * (1 - Math.pow(1 - k, 2)));
          }
          poll.current = window.setTimeout(check, 3000);
        } catch (err) {
          stopTimers();
          clearActiveJob();
          removeStudioHistory(id);
          setResumeName(null);
          setError(`${(err as Error).message} Any song credit used for this attempt is refunded automatically.`);
          setBusy(false);
          // The server refunds failed jobs — refresh the counter so the user sees it.
          setTimeout(() => {
            loadWallet();
            window.dispatchEvent(new Event("sagewave-wallet"));
          }, 600);
        }
      };

      checkNow.current = check;
      poll.current = window.setTimeout(check, 2000);
    },
    [loadWallet]
  );

  // Resume a job that was still running when the user switched/closed the tab.
  useEffect(() => {
    if (status !== "authenticated" || resumed.current) return;
    resumed.current = true;
    try {
      const raw = localStorage.getItem(ACTIVE_JOB_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { id: string; name: string; startedAt: number };
      if (!saved?.id || Date.now() - saved.startedAt > ACTIVE_JOB_MAX_AGE_MS) {
        clearActiveJob();
        loadWallet();
        return;
      }
      setResumeName(saved.name);
      setNotice("Your song is still being separated — picking up where you left off.");
      setElapsed(Math.floor((Date.now() - saved.startedAt) / 1000));
      followJob(saved.id, saved.name, saved.startedAt);
    } catch {
      clearActiveJob();
    }
  }, [status, followJob, loadWallet]);

  const start = async () => {
    if (!file || busy) return;

    // Require login when clicking Extract instrumental
    if (!session?.user) {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      return;
    }

    if (credits !== null && credits <= 0) {
      setShowUpgrade(true);
      setError(
        "AI Stem Studio is locked — your Free Trial or 30-day / 30-song Premium Pass has ended. Unlock Studio Premium (₹15 — 30 Songs for 30 Days) below to continue!"
      );
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
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
      if (!res.ok) {
        if (res.status === 402 || data.code === "NO_CREDITS") {
          setCredits(0);
          setIsPremium(false);
          setShowUpgrade(true);
          window.dispatchEvent(new Event("sagewave-wallet"));
        }
        throw new Error(data.error || "Upload failed.");
      }
      if (typeof data.creditsRemaining === "number") {
        setCredits(data.creditsRemaining);
        setIsPremium(Boolean(data.isPremium));
        window.dispatchEvent(new Event("sagewave-wallet"));
      }

      if (data.status === "done" && data.files) {
        stopTimers();
        setJobId(data.id);
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

      // Remember the running job so a tab switch / refresh can resume it instead of losing it.
      try {
        localStorage.setItem(
          ACTIVE_JOB_KEY,
          JSON.stringify({ id: data.id, name: file.name, startedAt: t0 })
        );
      } catch {}
      followJob(data.id, file.name, t0);
    } catch (err) {
      stopTimers();
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const reset = () => {
    setFiles(null);
    setFile(null);
    setResumeName(null);
    setNotice(null);
    setJobId(null);
    setPct(0);
    setPhase(0);
    loadWallet();
  };

  const expDateStr = expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "";

  const walletBar = (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 10,
        marginBottom: 16,
        padding: "10px 14px",
        borderRadius: 14,
        background: isPremium ? "var(--forest)" : "var(--cream)",
        color: isPremium ? "var(--cream)" : "var(--forest)",
        border: "1px solid var(--line)",
        fontSize: "0.85rem",
      }}
    >
      <span style={{ fontWeight: 600 }}>
        {isPremium ? (
          <>
            ★ PREMIUM ACTIVE · <strong>{credits} / 30</strong> songs left
            {expDateStr && ` · Valid till ${expDateStr}`}
          </>
        ) : credits !== null ? (
          credits > 0 ? (
            <>
              Free Trial: <strong>{credits}</strong> free song available
            </>
          ) : (
            <>
              🔒 AI Stem Locked · <strong>0</strong> songs remaining
            </>
          )
        ) : (
          <>
            Free Trial: <strong>1 free song (₹0)</strong> · Studio Premium: <strong>₹15 (30 songs / 30 days)</strong>
          </>
        )}
      </span>
      <button
        type="button"
        onClick={() => setShowUpgrade(!showUpgrade)}
        style={{
          border: 0,
          background: "transparent",
          color: isPremium ? "var(--sage-soft)" : "var(--moss)",
          fontWeight: 600,
          fontSize: "0.84rem",
          padding: 0,
          textDecoration: "underline",
        }}
      >
        {showUpgrade
          ? "Hide Premium pass"
          : isPremium
            ? "Manage / Renew Pass"
            : "Get Studio Premium (₹15 · 30 songs) →"}
      </button>
    </div>
  );

  if (files && jobId) {
    const inst = files.find((f) => f.key === "instrumental");
    const rest = files.filter((f) => f.key !== "instrumental");
    const url = (f: StemFile) => `/api/files/${jobId}/${f.file}`;
    return (
      <div className="result">
        {walletBar}
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
            <AudioPlayer src={url(inst)} bars={52} />
          </div>
        )}

        {rest.length > 0 && (
          <>
            <p className="field-label" style={{ marginTop: 28, marginBottom: 0 }}>Individual stems</p>
            <div className="stem-list">
              {rest.map((f) => (
                <div className="stem-row" key={f.key}>
                  <span className="lbl">{f.label}</span>
                  <AudioPlayer src={url(f)} bars={40} />
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
          {credits !== null && !isPremium && (
            <Link href="/pricing" className="btn btn-light">
              Unlock 30 Songs for 30 Days · ₹15
            </Link>
          )}
        </div>
      </div>
    );
  }

  const shownName = file?.name ?? resumeName;
  const shownSize = file ? fmtSize(file.size) : "";

  return (
    <div>
      {walletBar}

      {notice && (
        <div className="notice">
          <Check size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
          {notice}
        </div>
      )}

      {!shownName ? (
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
              <div className="nm">{shownName}</div>
              <div className="sz">{shownSize}{busy && `${shownSize ? " · " : ""}${fmtElapsed(elapsed)} elapsed`}</div>
            </div>
            {!busy && (
              <button className="x" onClick={() => { setFile(null); setResumeName(null); }} aria-label="Remove file"><Close size={16} /></button>
            )}
          </div>
          <div className="result-actions" style={{ marginTop: 20 }}>
            <button className="btn btn-primary" onClick={start} disabled={busy || !file}>
              <Layers size={17} /> {busy ? "Separating…" : "Extract instrumental"}
            </button>
          </div>
        </>
      )}

      {busy && (
        <>
          <Progress phases={PHASES} active={phase} percent={pct} />
          <p className="hint">
            Studio-grade separation usually takes 1–3 minutes. You can switch tabs — your song keeps processing, and
            if anything goes wrong your song credit is refunded automatically.
          </p>
        </>
      )}

      {error && (
        <div className="error-msg" role="alert">
          <Alert size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {showUpgrade && (
        <div style={{ marginTop: 24, paddingTop: 22, borderTop: "1px dashed var(--line-strong)" }}>
          <div style={{ marginBottom: 14 }}>
            <span className="eyebrow">Unlock AI Stem &amp; Instrumental Studio</span>
            <h4 style={{ marginTop: 6, fontSize: "1.28rem" }}>Studio Premium — 30 Songs for 30 Days (₹15)</h4>
          </div>
          <PricingCards compact />
        </div>
      )}
    </div>
  );
}
