import { promises as fs } from "node:fs";
import path from "node:path";
import { createJobDir, run, writeMeta } from "./jobs";

const INSTAGRAM_RE =
  /^https?:\/\/(www\.|m\.)?instagram\.com\/(reel|reels|p|tv)\/[A-Za-z0-9_-]+\/?(\?.*)?$/i;

export function isInstagramUrl(url: string) {
  return INSTAGRAM_RE.test(url.trim());
}

export type ReelMode = "audio" | "video";

export interface ReelResult {
  id: string;
  file: string;
  thumb: string | null;
  title: string;
  uploader: string | null;
  duration: number | null;
  size: number;
  mode: ReelMode;
}

function cookieArgs() {
  const args: string[] = [];
  if (process.env.YTDLP_COOKIES_FILE) args.push("--cookies", process.env.YTDLP_COOKIES_FILE);
  else if (process.env.YTDLP_COOKIES_FROM_BROWSER)
    args.push("--cookies-from-browser", process.env.YTDLP_COOKIES_FROM_BROWSER);
  return args;
}

function friendlyError(raw: string) {
  const s = raw.toLowerCase();
  if (s.includes("not installed")) return raw;
  if (s.includes("login required") || s.includes("rate-limit") || s.includes("cookies"))
    return "Instagram wants a logged-in session for this reel. It may be private, or the server needs cookies configured.";
  if (s.includes("404") || s.includes("not found") || s.includes("unavailable"))
    return "We couldn't find that reel. Double-check the link — it may have been removed or be private.";
  if (s.includes("too long")) return raw;
  return "Something went wrong while fetching the reel. Please try again in a moment.";
}

async function resolveBin(envVal: string | undefined, name: string): Promise<string> {
  if (envVal && envVal.startsWith("/")) return envVal;
  const candidates = [
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`,
  ];
  for (const c of candidates) {
    try {
      await fs.access(c);
      return c;
    } catch {
      /* continue */
    }
  }
  return envVal || name;
}

export async function fetchReel(url: string, mode: ReelMode): Promise<ReelResult> {
  const { id, dir } = await createJobDir();
  const ytdlp = await resolveBin(process.env.YTDLP_PATH, "yt-dlp");
  const ffmpeg = await resolveBin(process.env.FFMPEG_PATH, "ffmpeg");
  const ffmpegDir = path.dirname(ffmpeg);

  const common = [
    "--no-playlist",
    "--no-warnings",
    "--restrict-filenames",
    "--write-info-json",
    "--write-thumbnail",
    "--convert-thumbnails",
    "jpg",
    "--ffmpeg-location",
    ffmpegDir,
    "-o",
    "media.%(ext)s",
    "-o",
    "thumbnail:thumb.%(ext)s",
    ...cookieArgs(),
  ];

  const modeArgs =
    mode === "audio"
      ? [
          "-f",
          "ba[ext=m4a]/bestaudio/best",
          "-x",
          "--audio-format",
          "mp3",
          "--audio-quality",
          "0",
          "--embed-metadata",
        ]
      : [
          "-f",
          "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b[ext=mp4]/b",
          "--merge-output-format",
          "mp4",
          "--remux-video",
          "mp4",
        ];

  try {
    await run(ytdlp, [...common, ...modeArgs, url.trim()], { cwd: dir, timeoutMs: 4 * 60 * 1000 });
  } catch (err) {
    // If yt-dlp downloaded the raw stream before post-processing hiccuped, recover with ffmpeg directly
    const existing = await fs.readdir(dir).catch(() => []);
    const rawMedia = existing.find(
      (f) => f.startsWith("media") && !f.endsWith(".json") && !f.endsWith(".part")
    );
    if (mode === "audio" && rawMedia) {
      try {
        await run(
          ffmpeg,
          [
            "-y",
            "-i",
            path.join(dir, rawMedia),
            "-vn",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "320k",
            "-ar",
            "44100",
            path.join(dir, "media.mp3"),
          ],
          { cwd: dir }
        );
      } catch {
        await fs.rm(dir, { recursive: true, force: true });
        throw new Error(friendlyError((err as Error).message));
      }
    } else {
      await fs.rm(dir, { recursive: true, force: true });
      throw new Error(friendlyError((err as Error).message));
    }
  }

  let files = await fs.readdir(dir);

  // If mode is audio and yt-dlp left an m4a/mp4/webm without converting to .mp3, convert it with ffmpeg at 320 kbps
  if (mode === "audio" && !files.some((f) => f.startsWith("media") && f.endsWith(".mp3"))) {
    const src = files.find((f) => f.startsWith("media") && !f.endsWith(".json"));
    if (src) {
      await run(
        ffmpeg,
        [
          "-y",
          "-i",
          path.join(dir, src),
          "-vn",
          "-c:a",
          "libmp3lame",
          "-b:a",
          "320k",
          "-ar",
          "44100",
          path.join(dir, "media.mp3"),
        ],
        { cwd: dir }
      );
      files = await fs.readdir(dir);
    }
  }

  // If mode is video and yt-dlp left separate DASH video + audio tracks unmerged, merge them with ffmpeg
  if (mode === "video" && !files.includes("media.mp4")) {
    const vTrack = files.find((f) => f.startsWith("media.") && f.endsWith(".mp4"));
    const aTrack = files.find((f) => f.startsWith("media.") && (f.endsWith(".m4a") || f.endsWith(".aac")));
    if (vTrack && aTrack) {
      await run(
        ffmpeg,
        [
          "-y",
          "-i",
          path.join(dir, vTrack),
          "-i",
          path.join(dir, aTrack),
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          path.join(dir, "media.mp4"),
        ],
        { cwd: dir }
      );
      files = await fs.readdir(dir);
    }
  }

  const wantExt = mode === "audio" ? ".mp3" : ".mp4";
  const media =
    files.find((f) => f === `media${wantExt}`) ??
    files.find((f) => f.startsWith("media") && f.endsWith(wantExt)) ??
    files.find((f) => f.startsWith("media") && !f.endsWith(".json"));
  if (!media) throw new Error("The download finished but no file was produced.");

  const thumb = files.find((f) => f.startsWith("thumb")) ?? null;

  let info: Record<string, unknown> = {};
  const infoFile = files.find((f) => f.endsWith(".info.json"));
  if (infoFile) {
    try {
      info = JSON.parse(await fs.readFile(path.join(dir, infoFile), "utf8"));
    } catch {}
  }

  const uploader = (info.uploader as string) || (info.channel as string) || null;
  const rawTitle = (info.description as string) || (info.title as string) || "";
  const title =
    rawTitle.split("\n")[0].slice(0, 90).trim() ||
    (uploader ? `Reel by @${uploader}` : "Instagram reel");

  const st = await fs.stat(path.join(dir, media));
  const result: ReelResult = {
    id,
    file: media,
    thumb,
    title,
    uploader,
    duration: typeof info.duration === "number" ? info.duration : null,
    size: st.size,
    mode,
  };
  await writeMeta(dir, { ...result, downloadName: downloadName(uploader, mode) });
  return result;
}

function downloadName(uploader: string | null, mode: ReelMode) {
  const base = (uploader ? `${uploader}-reel` : "instagram-reel").replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${base}${mode === "audio" ? ".mp3" : ".mp4"}`;
}
