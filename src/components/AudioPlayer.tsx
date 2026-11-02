"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "./Icons";

const BARS = 64;

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/** Deterministic placeholder shape until real peaks are decoded */
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Array.from({ length: BARS }, (_, i) => {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const r = ((h >>> 0) % 1000) / 1000;
    return 0.25 + 0.55 * r * Math.sin((i / BARS) * Math.PI) + 0.15;
  });
}

// Only one player plays at a time
let current: HTMLAudioElement | null = null;

export default function AudioPlayer({ src, bars = BARS }: { src: string; bars?: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const fallback = useMemo(() => seeded(src).slice(0, bars), [src, bars]);
  const [peaks, setPeaks] = useState<number[]>(fallback);

  // Decode real waveform peaks
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(src);
        const buf = await res.arrayBuffer();
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const decoded = await ctx.decodeAudioData(buf);
        const data = decoded.getChannelData(0);
        const step = Math.floor(data.length / bars);
        const out: number[] = [];
        for (let i = 0; i < bars; i++) {
          let max = 0;
          for (let j = i * step; j < (i + 1) * step; j += 32) {
            const v = Math.abs(data[j]);
            if (v > max) max = v;
          }
          out.push(max);
        }
        const peak = Math.max(...out, 0.01);
        if (!cancelled) setPeaks(out.map((v) => 0.12 + 0.88 * (v / peak)));
        ctx.close();
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src, bars]);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      if (current && current !== a) current.pause();
      current = a;
      a.play();
    } else a.pause();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audio.current;
    if (!a || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * dur;
  };

  const progress = dur ? t / dur : 0;

  return (
    <div className="player">
      <button className="play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
        {playing ? <Pause /> : <Play style={{ marginLeft: 2 }} />}
      </button>
      <div className="wave" onClick={seek} role="slider" aria-valuemin={0} aria-valuemax={dur} aria-valuenow={t} aria-label="Seek">
        {peaks.map((p, i) => (
          <i key={i} className={i / peaks.length < progress ? "on" : ""} style={{ height: `${Math.round(p * 100)}%` }} />
        ))}
      </div>
      <span className="time">
        {fmt(t)} / {fmt(dur)}
      </span>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
      />
    </div>
  );
}
