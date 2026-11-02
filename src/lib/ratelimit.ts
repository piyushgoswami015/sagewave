interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

/**
 * Sliding-window rate limiter per user/IP + category.
 * Returns { ok: true } or { ok: false, retryAfterSec }.
 */
export function checkRateLimit(
  key: string,
  opts: { maxRequests: number; windowMs: number }
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - opts.windowMs;
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= opts.maxRequests) {
    const oldest = bucket.timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + opts.windowMs - now) / 1000));
    buckets.set(key, bucket);
    return { ok: false, retryAfterSec };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { ok: true };
}

/**
 * Simple concurrency semaphore so heavy CPU tasks (like local Demucs AI)
 * queue smoothly instead of exhausting server RAM when multiple users upload at once.
 */
export class Semaphore {
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueueSize = 15
  ) {}

  get stats() {
    return { active: this.active, queued: this.queue.length };
  }

  async acquire(): Promise<() => void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return () => this.release();
    }
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error("The studio server is currently at capacity. Please try again in a minute.");
    }
    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve(() => this.release());
      });
    });
  }

  private release() {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) next();
  }
}

export const reelSemaphore = new Semaphore(4, 25);
export const demucsSemaphore = new Semaphore(1, 10);
