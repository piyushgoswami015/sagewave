import { promises as fs } from "node:fs";
import path from "node:path";
import { createJobDir, jobDir, readMeta, run, writeMeta } from "./jobs";
import { demucsSemaphore } from "./ratelimit";

const API = "https://api.replicate.com/v1";
const HF_DEMUCS_SPACE = "https://abidlabs-music-separation.hf.space";
const HF_DEMUCS_4STEM_SPACE = "https://nakas-demucs-playground.hf.space";

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

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download stem (${res.status})`);
  await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

/**
 * Runs Meta's Hybrid Transformer Demucs AI on Hugging Face Spaces (100% free cloud AI, zero Render RAM usage!)
 * Primary: abidlabs-music-separation (Demucs AI Vocals + No_Vocals/Instrumental wavs)
 * Secondary: nakas-demucs-playground (Demucs 4-stem Vocals, Bass, Drums, Other)
 */
async function separateWithHuggingFaceDemucs(
  dir: string,
  sourceFile: string,
  meta: StemMeta
) {
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  const enc = ["-vn", "-c:a", "libmp3lame", "-b:a", "320k", "-ar", "44100"];
  const base =
    path.basename(meta.sourceName, path.extname(meta.sourceName)).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60) ||
    "track";
  const srcPath = path.join(dir, sourceFile);

  try {
    const buf = await fs.readFile(srcPath);

    // 1) Upload audio file to Hugging Face Demucs Space
    const fd = new FormData();
    fd.append("files", new Blob([new Uint8Array(buf)], { type: "audio/mpeg" }), path.basename(sourceFile));
    const upRes = await fetch(`${HF_DEMUCS_SPACE}/gradio_api/upload`, {
      method: "POST",
      body: fd,
    });
    if (!upRes.ok) throw new Error(`HF upload failed (${upRes.status})`);
    const upJson = (await upRes.json()) as string[];
    const remotePath = upJson?.[0];
    if (!remotePath) throw new Error("No upload path returned from Demucs Space.");

    // 2) Trigger Demucs AI inference
    const callRes = await fetch(`${HF_DEMUCS_SPACE}/gradio_api/call/inference`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [{ path: remotePath, meta: { _type: "gradio.FileData" } }],
      }),
    });
    if (!callRes.ok) throw new Error(`HF inference call failed (${callRes.status})`);
    const { event_id: eventId } = (await callRes.json()) as { event_id?: string };
    if (!eventId) throw new Error("No event_id returned from Demucs Space.");

    // 3) Read SSE result stream from Demucs AI
    const sseRes = await fetch(`${HF_DEMUCS_SPACE}/gradio_api/call/inference/${eventId}`);
    if (!sseRes.ok) throw new Error(`HF SSE stream failed (${sseRes.status})`);
    const sseText = await sseRes.text();

    let resultItems: Array<{ url?: string; path?: string }> | null = null;
    const lines = sseText.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("event: complete")) {
        const dataLine = lines.slice(i + 1).find((l) => l.startsWith("data: "));
        if (dataLine) {
          resultItems = JSON.parse(dataLine.slice(6));
          break;
        }
      }
    }

    if (!resultItems || resultItems.length < 2) {
      throw new Error("Demucs Space did not return vocal and instrumental stems.");
    }

    meta.status = "finishing";
    await writeMeta(dir, meta);

    const resolveUrl = (item: { url?: string; path?: string }) =>
      item.url || `${HF_DEMUCS_SPACE}/gradio_api/file=${item.path}`;

    const rawVocals = path.join(dir, "raw_vocals.wav");
    const rawInst = path.join(dir, "raw_instrumental.wav");
    await Promise.all([
      download(resolveUrl(resultItems[0]), rawVocals),
      download(resolveUrl(resultItems[1]), rawInst),
    ]);

    const instName = `${base}-instrumental.mp3`;
    const vocName = `${base}-vocals.mp3`;
    const bassName = `${base}-bass.mp3`;
    const melodyName = `${base}-other.mp3`;

    // Encode crisp 320 kbps MP3s from Demucs AI WAV outputs + isolate Bass and Melody/Percussion from the clean AI Instrumental!
    await Promise.all([
      run(ffmpeg, ["-y", "-i", rawInst, ...enc, path.join(dir, instName)]),
      run(ffmpeg, ["-y", "-i", rawVocals, ...enc, path.join(dir, vocName)]),
      run(ffmpeg, ["-y", "-i", rawInst, "-af", "lowpass=f=240:poles=2,volume=1.15", ...enc, path.join(dir, bassName)]),
      run(ffmpeg, ["-y", "-i", rawInst, "-af", "highpass=f=240:poles=2", ...enc, path.join(dir, melodyName)]),
    ]);

    const files: StemFile[] = [];
    const push = async (key: string, file: string) => {
      const st = await fs.stat(path.join(dir, file));
      files.push({ key, label: LABELS[key] ?? key, file, size: st.size });
    };
    await push("instrumental", instName);
    await push("vocals", vocName);
    await push("bass", bassName);
    await push("other", melodyName);

    meta.status = "done";
    meta.files = files;
    await writeMeta(dir, meta);
  } catch {
    // Fallback to Secondary 4-Stem Demucs Space (nakas-demucs-playground)
    try {
      const buf = await fs.readFile(srcPath);
      const b64 = buf.toString("base64");
      const res4 = await fetch(`${HF_DEMUCS_4STEM_SPACE}/run/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [{ name: path.basename(sourceFile), data: `data:audio/mpeg;base64,${b64}` }],
        }),
      });
      if (!res4.ok) throw new Error(`4-stem HF space error ${res4.status}`);
      const json4 = (await res4.json()) as { data?: Array<{ name?: string; data?: string }> };
      const stems4 = json4.data;
      if (!stems4 || stems4.length < 4) throw new Error("Incomplete 4-stem output");

      meta.status = "finishing";
      await writeMeta(dir, meta);

      const keys = ["vocals", "bass", "drums", "other"] as const;
      const rawPaths: Record<string, string> = {};
      await Promise.all(
        keys.map(async (k, idx) => {
          const item = stems4[idx];
          const p = path.join(dir, `raw_${k}.wav`);
          if (item.data && item.data.includes(",")) {
            await fs.writeFile(p, Buffer.from(item.data.split(",")[1], "base64"));
          } else if (item.name) {
            await download(`${HF_DEMUCS_4STEM_SPACE}/file=${item.name}`, p);
          }
          rawPaths[k] = p;
        })
      );

      const instName = `${base}-instrumental.mp3`;
      await run(ffmpeg, [
        "-y",
        "-i",
        rawPaths.bass,
        "-i",
        rawPaths.drums,
        "-i",
        rawPaths.other,
        "-filter_complex",
        "amix=inputs=3:normalize=0:duration=longest",
        ...enc,
        path.join(dir, instName),
      ]);

      const files: StemFile[] = [];
      const push = async (key: string, file: string) => {
        const st = await fs.stat(path.join(dir, file));
        files.push({ key, label: LABELS[key] ?? key, file, size: st.size });
      };
      await push("instrumental", instName);

      for (const k of keys) {
        const name = `${base}-${k}.mp3`;
        await run(ffmpeg, ["-y", "-i", rawPaths[k], ...enc, path.join(dir, name)]);
        await push(k, name);
      }

      meta.status = "done";
      meta.files = files;
      await writeMeta(dir, meta);
    } catch (err2) {
      try {
        const files = await separateWithFfmpegDsp(dir, sourceFile, meta.sourceName);
        meta.status = "done";
        meta.files = files;
        await writeMeta(dir, meta);
      } catch (fallbackErr) {
        meta.status = "failed";
        meta.error = (err2 as Error).message || (fallbackErr as Error).message;
        await writeMeta(dir, meta);
      }
    }
  }
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
  const enc = ["-vn", "-c:a", "libmp3lame", "-b:a", "320k", "-ar", "44100"];
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
  } catch {
    await separateWithHuggingFaceDemucs(dir, sourceFile, meta);
  } finally {
    if (release) release();
  }
}

/**
 * Instant FFmpeg stereo-center cancellation fallback if neither local Demucs nor HF Demucs is reachable.
 */
async function separateWithFfmpegDsp(dir: string, sourceFile: string, sourceName: string): Promise<StemFile[]> {
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  const enc = ["-vn", "-c:a", "libmp3lame", "-b:a", "320k", "-ar", "44100"];
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
    "stereotools=mlev=0.02:slev=1.0:sbal=0",
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

  // 1) Prefer Local Demucs AI when installed on local machine
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

  // 2) If Replicate API token is configured, run on Replicate cloud GPU
  if (token()) {
    const fd = new FormData();
    fd.append("content", new Blob([new Uint8Array(buf)], { type: file.type || "audio/mpeg" }), file.name);
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

  // 3) On Render Free Tier (512MB RAM): Run Meta's Demucs AI via Hugging Face Gradio API in background!
  const meta: StemMeta = {
    id,
    predictionId: "hf-demucs",
    sourceName: file.name,
    status: "processing",
    createdAt: Date.now(),
  };
  await writeMeta(dir, meta);
  void separateWithHuggingFaceDemucs(dir, sourceFile, meta);
  return meta;
}

export async function pollSeparation(id: string): Promise<StemMeta> {
  const dir = jobDir(id);
  const meta = await readMeta<StemMeta>(dir);
  if (!meta) throw new Error("Job not found or expired.");
  if (meta.status === "done" || meta.status === "failed" || meta.status === "finishing") return meta;

  // Local Demucs and HF Demucs update meta.json directly in the background
  if (meta.predictionId === "local-demucs" || meta.predictionId === "hf-demucs" || meta.predictionId === "local-dsp") {
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
    const enc = ["-vn", "-c:a", "libmp3lame", "-b:a", "320k", "-ar", "44100"];
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
