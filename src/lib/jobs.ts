import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

export const JOBS_ROOT = path.join("/tmp", "sagewave-jobs");
const MAX_AGE_MS = 60 * 60 * 1000; // files live for one hour

const ID_RE = /^[a-f0-9-]{36}$/;

export function isValidJobId(id: string) {
  return ID_RE.test(id);
}

export async function createJobDir() {
  await fs.mkdir(JOBS_ROOT, { recursive: true });
  void sweepOldJobs();
  const id = crypto.randomUUID();
  const dir = path.join(JOBS_ROOT, id);
  await fs.mkdir(dir);
  return { id, dir };
}

export function jobDir(id: string) {
  if (!isValidJobId(id)) throw new Error("Invalid job id");
  return path.join(JOBS_ROOT, id);
}

async function sweepOldJobs() {
  try {
    const entries = await fs.readdir(JOBS_ROOT);
    const now = Date.now();
    await Promise.all(
      entries.map(async (name) => {
        const p = path.join(JOBS_ROOT, name);
        const st = await fs.stat(p).catch(() => null);
        if (st && now - st.mtimeMs > MAX_AGE_MS) {
          await fs.rm(p, { recursive: true, force: true });
        }
      })
    );
  } catch {
    /* ignore */
  }
}

export function run(
  bin: string,
  args: string[],
  opts: { cwd?: string; timeoutMs?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd: opts.cwd,
      env: {
        ...process.env,
        PATH: `${process.env.PATH ?? ""}:/opt/homebrew/bin:/usr/local/bin`,
      },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("The operation took too long and was stopped."));
    }, opts.timeoutMs ?? 5 * 60 * 1000);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (err.code === "ENOENT") {
        reject(new Error(`"${bin}" is not installed on the server.`));
      } else reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else {
        const e = new Error(stderr || stdout || `${bin} exited with code ${code}`);
        reject(e);
      }
    });
  });
}

export const MIME: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function writeMeta(dir: string, meta: unknown) {
  await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2));
}

export async function readMeta<T>(dir: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(dir, "meta.json"), "utf8")) as T;
  } catch {
    return null;
  }
}
