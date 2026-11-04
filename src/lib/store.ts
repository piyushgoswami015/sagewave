import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Tiny persistent key-value store.
 *
 * - If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set (free Upstash Redis), data lives
 *   in Upstash and survives Render redeploys / restarts.
 * - Otherwise it falls back to JSON files in ./.data (fine for local dev, but wiped on every Render deploy).
 */
const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const DATA_DIR = path.join(process.cwd(), ".data");

export function isPersistentStoreConfigured(): boolean {
  return Boolean(URL_ && TOKEN);
}

async function upstash(command: unknown[]): Promise<unknown> {
  const res = await fetch(URL_!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Persistent store error (${res.status}).`);
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error(`Persistent store error: ${json.error}`);
  return json.result;
}

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  if (isPersistentStoreConfigured()) {
    const raw = (await upstash(["GET", `sagewave:${key}`])) as string | null;
    if (raw === null || raw === undefined) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, `${key}.json`), "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  if (isPersistentStoreConfigured()) {
    await upstash(["SET", `sagewave:${key}`, JSON.stringify(value)]);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, `${key}.json`), JSON.stringify(value, null, 2), "utf8");
}
