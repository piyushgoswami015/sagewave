import crypto from "node:crypto";
import { jobDir, readMeta, writeMeta } from "./jobs";
import { PRICING_PLANS, type PlanId, type PricingPlan } from "./plans";
import { kvGet, kvSet } from "./store";

export { PRICING_PLANS, type PlanId, type PricingPlan };

export interface PaymentRecord {
  paymentId: string;
  orderId: string;
  planId: "premium";
  priceInr: number;
  songsAdded: number;
  activatedAt: string;
  expiresAt: string;
}

export interface UserWallet {
  email: string;
  plan: PlanId;
  isPremium: boolean;
  credits: number;
  premiumActivatedAt: string | null;
  premiumExpiresAt: string | null;
  totalSongsProcessed: number;
  payments: PaymentRecord[];
  /** Jobs whose credit has been deducted but whose result is not confirmed yet (jobId -> ISO start time). */
  pendingJobs?: Record<string, string>;
  updatedAt: string;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
/** A separation job that has not finished after this long is treated as failed and its credit is refunded. */
export const STALE_JOB_MS = 8 * 60 * 1000;

// In-process mutex so concurrent requests never clobber each other's wallet writes.
let chain: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

async function readWallets(): Promise<Record<string, UserWallet>> {
  try {
    const wallets = await kvGet<Record<string, UserWallet>>("wallets", {});
    return wallets && typeof wallets === "object" && !Array.isArray(wallets) ? wallets : {};
  } catch {
    return {};
  }
}

async function writeWallets(wallets: Record<string, UserWallet>): Promise<void> {
  await kvSet("wallets", wallets);
}

function newWallet(email: string): UserWallet {
  return {
    email,
    plan: "free",
    isPremium: false,
    credits: 1, // 1 Free Trial song per account
    premiumActivatedAt: null,
    premiumExpiresAt: null,
    totalSongsProcessed: 0,
    payments: [],
    pendingJobs: {},
    updatedAt: new Date().toISOString(),
  };
}

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function getPlanById(planId: string): PricingPlan | undefined {
  return PRICING_PLANS.find((p) => p.id === planId);
}

/**
 * Enforces expiry rules:
 * 1) premium + (30 days elapsed OR credits exhausted) -> expired, credits 0.
 * 2) free trial + 1 song processed -> locked permanently at 0 credits until upgrading to Premium.
 */
function enforceWalletLifecycle(wallet: UserWallet): boolean {
  let dirty = false;
  const now = Date.now();

  if (wallet.plan === "premium") {
    const expMs = wallet.premiumExpiresAt ? new Date(wallet.premiumExpiresAt).getTime() : 0;
    const timeExpired = !expMs || now >= expMs;
    const songsExhausted = wallet.credits <= 0;

    if (timeExpired || songsExhausted) {
      wallet.plan = "expired";
      wallet.isPremium = false;
      wallet.credits = 0;
      wallet.updatedAt = new Date(now).toISOString();
      dirty = true;
    } else if (!wallet.isPremium) {
      wallet.isPremium = true;
      dirty = true;
    }
  } else {
    // Non-premium (free trial or expired):
    if (wallet.isPremium) {
      wallet.isPremium = false;
      dirty = true;
    }
    // If the account has already processed at least 1 song, the Free Trial is used up permanently.
    const hasPending = wallet.pendingJobs && Object.keys(wallet.pendingJobs).length > 0;
    if (wallet.totalSongsProcessed >= 1 && !hasPending && wallet.credits > 0) {
      wallet.credits = 0;
      wallet.plan = "expired";
      wallet.updatedAt = new Date(now).toISOString();
      dirty = true;
    }
  }

  return dirty;
}

/** Gives one song credit back and restores the plan the user had before the failed job. */
function applyRefund(wallet: UserWallet) {
  wallet.credits += 1;
  wallet.totalSongsProcessed = Math.max(0, wallet.totalSongsProcessed - 1);

  if (wallet.premiumExpiresAt) {
    if (Date.now() < new Date(wallet.premiumExpiresAt).getTime()) {
      wallet.plan = "premium";
      wallet.isPremium = true;
    }
  } else {
    wallet.plan = "free";
    wallet.isPremium = false;
  }
  wallet.updatedAt = new Date().toISOString();
}

/**
 * Settles every pending job of a wallet:
 *  - finished jobs are confirmed (credit stays spent)
 *  - failed / lost (container restarted) / stuck jobs are refunded automatically
 * This runs server-side, so users get their credit back even if they closed the tab.
 */
async function reconcilePendingJobs(wallet: UserWallet): Promise<boolean> {
  const pending = wallet.pendingJobs ?? {};
  let dirty = false;

  for (const [jobId, startedAt] of Object.entries(pending)) {
    let dir: string | null = null;
    try {
      dir = jobDir(jobId);
    } catch {
      dir = null;
    }
    const meta = dir ? await readMeta<Record<string, unknown> & { status?: string }>(dir) : null;
    const startedMs = new Date(startedAt).getTime();
    const age = isNaN(startedMs) ? STALE_JOB_MS + 1000 : Date.now() - startedMs;

    if (meta?.status === "done") {
      delete pending[jobId];
      if (!wallet.isPremium && wallet.totalSongsProcessed >= 1) {
        wallet.credits = 0;
        wallet.plan = "expired";
      }
      dirty = true;
    } else if (meta?.status === "failed" || age > STALE_JOB_MS) {
      delete pending[jobId];
      applyRefund(wallet);
      dirty = true;
      if (dir && meta && meta.status !== "failed") {
        meta.status = "failed";
        meta.error = "Separation took too long and was stopped. Your song credit has been refunded.";
        await writeMeta(dir, meta).catch(() => {});
      }
    }
  }

  wallet.pendingJobs = pending;
  return dirty;
}

/**
 * Gets or initializes a user's wallet. Every new account automatically receives
 * 1 Free Trial song credit (₹0). Also reconciles pending jobs and enforces Premium expiry.
 */
export function getUserWallet(rawEmail: string): Promise<UserWallet> {
  return withLock(async () => {
    const email = (rawEmail || "").trim().toLowerCase();
    if (!email) return newWallet("guest@sagewave.in");
    try {
      const wallets = await readWallets();
      if (!wallets[email]) {
        wallets[email] = newWallet(email);
        await writeWallets(wallets).catch(() => {});
        return wallets[email];
      }

      const wallet = wallets[email];
      const a = await reconcilePendingJobs(wallet).catch(() => false);
      const b = enforceWalletLifecycle(wallet);
      if (a || b) {
        wallets[email] = wallet;
        await writeWallets(wallets).catch(() => {});
      }
      return wallet;
    } catch (err) {
      console.error("[billing] getUserWallet error:", err);
      return newWallet(email);
    }
  });
}

/**
 * Deducts 1 song credit before starting an AI Stem separation job.
 */
export function consumeSongCredit(rawEmail: string): Promise<UserWallet> {
  return withLock(async () => {
    const email = rawEmail.trim().toLowerCase();
    const wallets = await readWallets();
    const wallet = wallets[email] ?? newWallet(email);

    await reconcilePendingJobs(wallet);
    enforceWalletLifecycle(wallet);

    if (wallet.credits <= 0) {
      wallets[email] = wallet;
      await writeWallets(wallets);
      throw new Error("NO_CREDITS");
    }

    wallet.credits -= 1;
    wallet.totalSongsProcessed += 1;
    wallet.updatedAt = new Date().toISOString();

    // Last credit used (30th Premium song, or the single free song): lock after this job.
    if (wallet.credits <= 0) {
      if (wallet.plan === "premium" || wallet.plan === "free") {
        wallet.plan = "expired";
      }
      wallet.isPremium = false;
    }

    wallets[email] = wallet;
    await writeWallets(wallets);
    return wallet;
  });
}

/** Marks a deducted credit as belonging to a running job so it can be settled or refunded later. */
export function markJobPending(rawEmail: string, jobId: string): Promise<void> {
  return withLock(async () => {
    const email = rawEmail.trim().toLowerCase();
    const wallets = await readWallets();
    const wallet = wallets[email];
    if (!wallet) return;
    wallet.pendingJobs = { ...(wallet.pendingJobs ?? {}), [jobId]: new Date().toISOString() };
    wallets[email] = wallet;
    await writeWallets(wallets);
  });
}

/** Confirms a finished job (credit stays spent). */
export function settleJob(rawEmail: string, jobId: string): Promise<void> {
  return withLock(async () => {
    const email = rawEmail.trim().toLowerCase();
    const wallets = await readWallets();
    const wallet = wallets[email];
    if (!wallet) return;
    if (wallet.pendingJobs) {
      delete wallet.pendingJobs[jobId];
    }
    // Settle permanently: if this account has completed a song and is not on active Premium, lock at 0 credits.
    if (!wallet.isPremium && wallet.totalSongsProcessed >= 1) {
      wallet.credits = 0;
      wallet.plan = "expired";
      wallet.updatedAt = new Date().toISOString();
    }
    wallets[email] = wallet;
    await writeWallets(wallets);
  });
}

/** Refunds the credit of a failed job. Idempotent: a job can only be refunded once. */
export function refundPendingJob(rawEmail: string, jobId: string): Promise<boolean> {
  return withLock(async () => {
    const email = rawEmail.trim().toLowerCase();
    const wallets = await readWallets();
    const wallet = wallets[email];
    if (!wallet?.pendingJobs?.[jobId]) return false;
    delete wallet.pendingJobs[jobId];
    applyRefund(wallet);
    wallets[email] = wallet;
    await writeWallets(wallets);
    return true;
  });
}

/** Refund for a job that failed before it was ever registered as pending (e.g. upload error). */
export function refundSongCredit(rawEmail: string): Promise<void> {
  return withLock(async () => {
    const email = rawEmail.trim().toLowerCase();
    const wallets = await readWallets();
    const wallet = wallets[email];
    if (!wallet) return;
    applyRefund(wallet);
    wallets[email] = wallet;
    await writeWallets(wallets);
  });
}

/**
 * Verifies a Razorpay HMAC-SHA256 signature and activates the ₹15 "30 Songs for 30 Days"
 * Studio Premium Pass from the exact timestamp of purchase.
 */
export function verifyAndCreditRazorpayPayment(opts: {
  email: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<UserWallet> {
  return withLock(async () => {
    const secret = process.env.RAZORPAY_KEY_SECRET || "";
    if (!secret) {
      throw new Error("Razorpay secret key is not configured on the server.");
    }

    const plan = getPlanById("premium")!;

    const payload = `${opts.razorpayOrderId}|${opts.razorpayPaymentId}`;
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(opts.razorpaySignature, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new Error("Payment signature verification failed.");
    }

    const email = opts.email.trim().toLowerCase();
    const wallets = await readWallets();
    const wallet = wallets[email] ?? newWallet(email);

    // Idempotency check: prevent crediting the same payment ID twice
    if (wallet.payments.some((p) => p.paymentId === opts.razorpayPaymentId)) {
      return wallet;
    }

    const nowMs = Date.now();
    const activatedAt = new Date(nowMs).toISOString();
    const expiresAt = new Date(nowMs + THIRTY_DAYS_MS).toISOString();

    wallet.plan = "premium";
    wallet.isPremium = true;
    wallet.credits = plan.songs; // 30 songs
    wallet.premiumActivatedAt = activatedAt;
    wallet.premiumExpiresAt = expiresAt;
    wallet.payments.unshift({
      paymentId: opts.razorpayPaymentId,
      orderId: opts.razorpayOrderId,
      planId: "premium",
      priceInr: plan.priceInr,
      songsAdded: plan.songs,
      activatedAt,
      expiresAt,
    });
    wallet.updatedAt = activatedAt;
    wallets[email] = wallet;
    await writeWallets(wallets);

    return wallet;
  });
}
