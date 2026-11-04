import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Tiny persistent key-value store with Upstash Redis and local disk fallback.
 *
 * - If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set (free Upstash Redis), data lives
 *   in Upstash and survives Render redeploys / restarts.
 * - Robust sanitization handles quotes, whitespace, or "Bearer " prefixes.
 * - Always dual-writes to local disk as a fallback safety net.
 * - Catches all Upstash network errors so server-side rendering (SSR) never crashes.
 */
const DATA_DIR = path.join(process.cwd(), ".data");

interface UpstashConfig {
  url: string;
  token: string;
}

function getUpstashConfig(): UpstashConfig | null {
  const rawUrl = process.env.UPSTASH_REDIS_REST_URL;
  const rawToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!rawUrl || !rawToken) return null;

  const url = rawUrl.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
  const token = rawToken.trim().replace(/^["']|["']$/g, "").replace(/^Bearer\s+/i, "");
  if (!url || !token) return null;
  return { url, token };
}

export function isPersistentStoreConfigured(): boolean {
  return getUpstashConfig() !== null;
}

async function upstash(conf: UpstashConfig, command: unknown[]): Promise<unknown> {
  const res = await fetch(conf.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${conf.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error(`Upstash: ${json.error}`);
  return json.result;
}

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const conf = getUpstashConfig();
  if (conf) {
    try {
      const raw = await upstash(conf, ["GET", `sagewave:${key}`]);
      if (raw === null || raw === undefined) return fallback;
      if (typeof raw === "object") return raw as T;
      if (typeof raw === "string") {
        try {
          return JSON.parse(raw) as T;
        } catch {
          return (raw as unknown) as T;
        }
      }
      return fallback;
    } catch (err) {
      console.warn(
        `[store] Upstash GET failed for "sagewave:${key}", falling back to disk:`,
        (err as Error)?.message || err
      );
    }
  }

  try {
    const content = await fs.readFile(path.join(DATA_DIR, `${key}.json`), "utf8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  const conf = getUpstashConfig();
  if (conf) {
    try {
      await upstash(conf, ["SET", `sagewave:${key}`, JSON.stringify(value)]);
    } catch (err) {
      console.warn(
        `[store] Upstash SET failed for "sagewave:${key}":`,
        (err as Error)?.message || err
      );
    }
  }

  // Dual write to local disk as resilient safety net
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(path.join(DATA_DIR, `${key}.json`), JSON.stringify(value, null, 2), "utf8");
  } catch (err) {
    console.warn(`[store] Local disk write failed for "${key}":`, (err as Error)?.message || err);
  }
}
