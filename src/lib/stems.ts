import { promises as fs } from "node:fs";
import path from "node:path";
import { createJobDir, jobDir, readMeta, run, writeMeta } from "./jobs";
import { demucsSemaphore } from "./ratelimit";

const API = "https://api.replicate.com/v1";

export interface StemFile {
  key: string; // instrumental | vocals | drums | bass | other ...
  label: string;
  file: string;
  size: number;
}

export interface StemMeta {
  id: string;
  predictionId: string;
  sourceName: string;
  status: "processing" | "finishing" | "done" | "failed";
  error?: string;
  files?: StemFile[];
  createdAt: number;
}

const LABELS: Record<string, string> = {
  instrumental: "Instrumental",
  vocals: "Vocals",
  drums: "Drums",
  bass: "Bass",
  other: "Melody & keys",
  guitar: "Guitar",
  piano: "Piano",
};

function token() {
  return process.env.REPLICATE_API_TOKEN || "";
}

async function resolveDemucsBin(): Promise<string | null> {
  const candidates = [
    process.env.DEMUCS_PATH,
    path.join(process.cwd(), ".venv", "bin", "demucs"),
    "/opt/homebrew/bin/demucs",
    "/usr/local/bin/demucs",
  ].filter(Boolean) as string[];

  for (const bin of candidates) {
    try {
      await fs.access(bin);
      return bin;
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Runs Meta's Hybrid Transformer Demucs (htdemucs) locally in the background
 * and updates meta.json when finished so the frontend progress bar polls smoothly.
 */
async function runLocalDemucsBackground(
  demucsBin: string,
  dir: string,
  sourceFile: string,
  meta: StemMeta
) {
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  const enc = ["-c:a", "libmp3lame", "-b:a", "320k", "-ar", "44100"];
  const base =
    path.basename(meta.sourceName, path.extname(meta.sourceName)).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60) ||
    "track";
  const srcPath = path.join(dir, sourceFile);
  const outRoot = path.join(dir, "demucs_out");
  const modelName = process.env.DEMUCS_LOCAL_MODEL || "htdemucs";

  let release: (() => void) | null = null;
  try {
    release = await demucsSemaphore.acquire();
    await run(
      demucsBin,
      ["-n", modelName, "--mp3", "--mp3-bitrate", "320", "-o", outRoot, srcPath],
      { cwd: dir, timeoutMs: 15 * 60 * 1000 }
    );

    meta.status = "finishing";
    await writeMeta(dir, meta);

    const trackFolder = path.basename(sourceFile, path.extname(sourceFile));
    const stemDir = path.join(outRoot, modelName, trackFolder);
    const stemEntries = await fs.readdir(stemDir);

    const raw: Record<string, string> = {};
    for (const f of stemEntries) {
      const k = path.basename(f, path.extname(f));
      raw[k] = path.join(stemDir, f);
    }

    // Build crisp 320 kbps Instrumental by mixing drums + bass + other (everything except vocals)
    const instName = `${base}-instrumental.mp3`;
    const nonVocalPaths = Object.entries(raw)
      .filter(([k]) => k !== "vocals")
      .map(([, p]) => p);

    if (!nonVocalPaths.length) {
      throw new Error("Demucs did not produce non-vocal stems.");
    }

    const inputs = nonVocalPaths.flatMap((p) => ["-i", p]);
    await run(ffmpeg, [
      "-y",
      ...inputs,
      "-filter_complex",
      `amix=inputs=${nonVocalPaths.length}:normalize=0:duration=longest`,
      ...enc,
      path.join(dir, instName),
    ]);

    const files: StemFile[] = [];
    const push = async (key: string, file: string) => {
      const st = await fs.stat(path.join(dir, file));
      files.push({ key, label: LABELS[key] ?? key, file, size: st.size });
    };
    await push("instrumental", instName);

    for (const key of ["vocals", "drums", "bass", "other", "guitar", "piano"]) {
      if (!raw[key]) continue;
      const name = `${base}-${key}.mp3`;
      await fs.copyFile(raw[key], path.join(dir, name));
      await push(key, name);
    }

    meta.status = "done";
    meta.files = files;
    await writeMeta(dir, meta);
  } catch (err) {
    // Fallback to FFmpeg studio DSP if Demucs fails for any reason
    try {
      const files = await separateWithFfmpegDsp(dir, sourceFile, meta.sourceName);
      meta.status = "done";
      meta.files = files;
      await writeMeta(dir, meta);
    } catch (fallbackErr) {
      meta.status = "failed";
      meta.error = (err as Error).message || (fallbackErr as Error).message;
      await writeMeta(dir, meta);
    }
  } finally {
    if (release) release();
  }
}

/**
 * Instant FFmpeg stereo-center cancellation fallback if neither local Demucs nor Replicate is available.
 */
async function separateWithFfmpegDsp(dir: string, sourceFile: string, sourceName: string): Promise<StemFile[]> {
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  const enc = ["-c:a", "libmp3lame", "-b:a", "320k", "-ar", "44100"];
  const base =
    path.basename(sourceName, path.extname(sourceName)).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60) || "track";

  const src = path.join(dir, sourceFile);
  const instName = `${base}-instrumental.mp3`;
  const vocName = `${base}-vocals.mp3`;
  const bassName = `${base}-bass.mp3`;
  const drumsName = `${base}-drums.mp3`;

  await run(ffmpeg, [
    "-y",
    "-i",
    src,
    "-af",
    "stereotools=mlev=0.015:slev=1.0:sbal=0",
    ...enc,
    path.join(dir, instName),
  ]);
  await run(ffmpeg, [
    "-y",
    "-i",
    src,
    "-af",
    "stereotools=slev=0.02:mlev=1.0,highpass=f=160,lowpass=f=9000",
    ...enc,
    path.join(dir, vocName),
  ]);
  await run(ffmpeg, ["-y", "-i", src, "-af", "lowpass=f=220:poles=2,volume=1.2", ...enc, path.join(dir, bassName)]);
  await run(ffmpeg, ["-y", "-i", src, "-af", "stereotools=mlev=0.25,highpass=f=220", ...enc, path.join(dir, drumsName)]);

  const files: StemFile[] = [];
  const push = async (key: string, file: string) => {
    const st = await fs.stat(path.join(dir, file));
    files.push({ key, label: LABELS[key] ?? key, file, size: st.size });
  };
  await push("instrumental", instName);
  await push("vocals", vocName);
  await push("bass", bassName);
  await push("other", drumsName);
  return files;
}

async function rep(pathname: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Replicate error ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

let cachedVersion: string | null = null;
async function modelVersion() {
  if (cachedVersion) return cachedVersion;
  const model = process.env.REPLICATE_DEMUCS_MODEL || "ryan5453/demucs";
  const data = await rep(`/models/${model}`);
  cachedVersion = data?.latest_version?.id;
  if (!cachedVersion) throw new Error("Could not resolve the Demucs model version.");
  return cachedVersion!;
}

export async function startSeparation(file: File): Promise<StemMeta> {
  const { id, dir } = await createJobDir();
  const ext = path.extname(file.name) || ".mp3";
  const sourceFile = `source${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, sourceFile), buf);

  // 1) Prefer Local Demucs AI when installed (100% free, studio-grade 4-stem neural separation)
  const demucsBin = await resolveDemucsBin();
  if (demucsBin) {
    const meta: StemMeta = {
      id,
      predictionId: "local-demucs",
      sourceName: file.name,
      status: "processing",
      createdAt: Date.now(),
    };
    await writeMeta(dir, meta);
    void runLocalDemucsBackground(demucsBin, dir, sourceFile, meta);
    return meta;
  }

  // 2) If Replicate API token is configured, run on cloud GPU
  if (token()) {
    const fd = new FormData();
    fd.append("content", new Blob([buf], { type: file.type || "audio/mpeg" }), file.name);
    const uploaded = await rep("/files", { method: "POST", body: fd });
    const audioUrl: string = uploaded?.urls?.get;
    if (!audioUrl) throw new Error("Upload to the separation service failed.");

    const version = await modelVersion();
    const prediction = await rep("/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version,
        input: {
          audio: audioUrl,
          model: process.env.DEMUCS_VARIANT || "htdemucs_ft",
        },
      }),
    });

    const meta: StemMeta = {
      id,
      predictionId: prediction.id,
      sourceName: file.name,
      status: "processing",
      createdAt: Date.now(),
    };
    await writeMeta(dir, meta);
    return meta;
  }

  // 3) Fallback to FFmpeg studio DSP
  const files = await separateWithFfmpegDsp(dir, sourceFile, file.name);
  const meta: StemMeta = {
    id,
    predictionId: "local-dsp",
    sourceName: file.name,
    status: "done",
    files,
    createdAt: Date.now(),
  };
  await writeMeta(dir, meta);
  return meta;
}

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download stem (${res.status})`);
  await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

export async function pollSeparation(id: string): Promise<StemMeta> {
  const dir = jobDir(id);
  const meta = await readMeta<StemMeta>(dir);
  if (!meta) throw new Error("Job not found or expired.");
  if (meta.status === "done" || meta.status === "failed" || meta.status === "finishing") return meta;

  // Local Demucs updates meta.json directly in the background
  if (meta.predictionId === "local-demucs" || meta.predictionId === "local-dsp") {
    return meta;
  }

  const pred = await rep(`/predictions/${meta.predictionId}`);
  if (pred.status === "failed" || pred.status === "canceled") {
    meta.status = "failed";
    meta.error = "The separation model couldn't process this file. Try a different track.";
    await writeMeta(dir, meta);
    return meta;
  }
  if (pred.status !== "succeeded") return meta;

  meta.status = "finishing";
  await writeMeta(dir, meta);

  try {
    const output = pred.output as Record<string, string | null> | string[] | string;
    const entries: [string, string][] = [];
    if (output && typeof output === "object" && !Array.isArray(output)) {
      for (const [k, v] of Object.entries(output)) if (typeof v === "string" && v) entries.push([k, v]);
    } else if (Array.isArray(output)) {
      for (const v of output) {
        const k = path.basename(new URL(v).pathname).replace(/\.[^.]+$/, "");
        entries.push([k, v]);
      }
    }
    if (!entries.length) throw new Error("No stems returned.");

    const raw: Record<string, string> = {};
    await Promise.all(
      entries.map(async ([key, url]) => {
        const ext = path.extname(new URL(url).pathname) || ".wav";
        const p = path.join(dir, `raw_${key}${ext}`);
        await download(url, p);
        raw[key] = p;
      })
    );

    const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
    const enc = ["-c:a", "libmp3lame", "-b:a", "320k", "-ar", "44100"];
    const base =
      path.basename(meta.sourceName, path.extname(meta.sourceName)).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60) ||
      "track";

    const instName = `${base}-instrumental.mp3`;
    const noVocals = raw["no_vocals"] || raw["instrumental"] || raw["accompaniment"];
    if (noVocals) {
      await run(ffmpeg, ["-y", "-i", noVocals, ...enc, path.join(dir, instName)]);
    } else {
      const parts = Object.entries(raw)
        .filter(([k]) => k !== "vocals")
        .map(([, p]) => p);
      if (!parts.length) throw new Error("No instrumental stems available.");
      const inputs = parts.flatMap((p) => ["-i", p]);
      await run(ffmpeg, [
        "-y",
        ...inputs,
        "-filter_complex",
        `amix=inputs=${parts.length}:normalize=0:duration=longest`,
        ...enc,
        path.join(dir, instName),
      ]);
    }

    const files: StemFile[] = [];
    const push = async (key: string, file: string) => {
      const st = await fs.stat(path.join(dir, file));
      files.push({ key, label: LABELS[key] ?? key, file, size: st.size });
    };
    await push("instrumental", instName);

    for (const key of ["vocals", "drums", "bass", "other", "guitar", "piano"]) {
      if (!raw[key]) continue;
      const name = `${base}-${key}.mp3`;
      await run(ffmpeg, ["-y", "-i", raw[key], ...enc, path.join(dir, name)]);
      await push(key, name);
    }

    meta.status = "done";
    meta.files = files;
  } catch (err) {
    meta.status = "failed";
    meta.error = (err as Error).message;
  }
  await writeMeta(dir, meta);
  return meta;
}
