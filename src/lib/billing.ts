import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export type PlanId = "free" | "premium" | "expired";

export interface PricingPlan {
  id: "free" | "premium";
  name: string;
  priceInr: number;
  amountPaise: number;
  songs: number;
  durationDays: number | null;
  perSongInr: string;
  tagline: string;
  popular?: boolean;
  features: string[];
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "Free Trial",
    priceInr: 0,
    amountPaise: 0,
    songs: 1,
    durationDays: null,
    perSongInr: "₹0 · One-time trial",
    tagline: "Test our Hybrid Transformer Demucs AI quality on 1 track",
    features: [
      "1 full song AI stem separation per account",
      "Instrumental + Vocals, Drums, Bass & Melody",
      "320 kbps CBR MP3 studio export (44.1 kHz)",
      "Free Creator Audio (MP3) & Clip (MP4) Archiver",
    ],
  },
  {
    id: "premium",
    name: "Studio Premium",
    priceInr: 15,
    amountPaise: 1500,
    songs: 30,
    durationDays: 30,
    perSongInr: "₹15 · 30 Songs for 30 Days",
    tagline: "30 songs for 30 days — just ₹0.50 per track, no auto-debit",
    popular: true,
    features: [
      "30 full song AI stem separations",
      "Valid for 30 days from exact time of purchase",
      "Premium badge active until 30 days or 30 songs finish",
      "320 kbps CBR MP3 Instrumental + 4 stems per song",
    ],
  },
];

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
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const WALLETS_FILE = path.join(DATA_DIR, "wallets.json");
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function readWallets(): Promise<Record<string, UserWallet>> {
  try {
    const raw = await fs.readFile(WALLETS_FILE, "utf8");
    return JSON.parse(raw) as Record<string, UserWallet>;
  } catch {
    return {};
  }
}

async function writeWallets(wallets: Record<string, UserWallet>): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(WALLETS_FILE, JSON.stringify(wallets, null, 2), "utf8");
}

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function getPlanById(planId: string): PricingPlan | undefined {
  return PRICING_PLANS.find((p) => p.id === planId);
}

/**
 * Evaluates and enforces expiry rules on a wallet:
 * 1) If the user is on "premium" and current time >= premiumExpiresAt, remove premium & set credits = 0.
 * 2) If the user is on "premium" and credits <= 0, remove premium immediately.
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
    } else {
      wallet.isPremium = true;
    }
  } else {
    wallet.isPremium = false;
  }

  return dirty;
}

/**
 * Gets or initializes a user's wallet. Every new account automatically receives
 * 1 Free Trial song credit (₹0). Also enforces 30-day / 30-song Premium expiry.
 */
export async function getUserWallet(rawEmail: string): Promise<UserWallet> {
  const email = rawEmail.trim().toLowerCase();
  const wallets = await readWallets();
  if (!wallets[email]) {
    wallets[email] = {
      email,
      plan: "free",
      isPremium: false,
      credits: 1, // 1 Free Trial song per account
      premiumActivatedAt: null,
      premiumExpiresAt: null,
      totalSongsProcessed: 0,
      payments: [],
      updatedAt: new Date().toISOString(),
    };
    await writeWallets(wallets);
    return wallets[email];
  }

  const wallet = wallets[email];
  if (enforceWalletLifecycle(wallet)) {
    wallets[email] = wallet;
    await writeWallets(wallets);
  }
  return wallet;
}

/**
 * Deducts 1 song credit before starting an AI Stem separation job.
 * Automatically removes Premium status if the 30-day window has passed OR if the 30th song is consumed.
 */
export async function consumeSongCredit(rawEmail: string): Promise<UserWallet> {
  const email = rawEmail.trim().toLowerCase();
  const wallets = await readWallets();
  const wallet = wallets[email] ?? {
    email,
    plan: "free" as PlanId,
    isPremium: false,
    credits: 1,
    premiumActivatedAt: null,
    premiumExpiresAt: null,
    totalSongsProcessed: 0,
    payments: [],
    updatedAt: new Date().toISOString(),
  };

  enforceWalletLifecycle(wallet);

  if (wallet.credits <= 0) {
    wallets[email] = wallet;
    await writeWallets(wallets);
    throw new Error("NO_CREDITS");
  }

  wallet.credits -= 1;
  wallet.totalSongsProcessed += 1;
  wallet.updatedAt = new Date().toISOString();

  // If this was their last song credit (e.g., 30th song used before 30 days end, or 1st free trial song used),
  // immediately end Premium / Free status so AI Stem locks after this song!
  if (wallet.credits <= 0) {
    if (wallet.plan === "premium" || wallet.plan === "free") {
      wallet.plan = "expired";
    }
    wallet.isPremium = false;
  }

  wallets[email] = wallet;
  await writeWallets(wallets);
  return wallet;
}

/**
 * Refunds 1 song credit if an AI separation job fails due to an upstream server error,
 * and restores Premium status if their 30-day window is still valid.
 */
export async function refundSongCredit(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  const wallets = await readWallets();
  const wallet = wallets[email];
  if (!wallet) return;

  wallet.credits += 1;
  wallet.totalSongsProcessed = Math.max(0, wallet.totalSongsProcessed - 1);

  if (wallet.premiumExpiresAt && Date.now() < new Date(wallet.premiumExpiresAt).getTime()) {
    wallet.plan = "premium";
    wallet.isPremium = true;
  } else if (!wallet.premiumExpiresAt && wallet.totalSongsProcessed === 0) {
    wallet.plan = "free";
    wallet.isPremium = false;
  }

  wallet.updatedAt = new Date().toISOString();
  wallets[email] = wallet;
  await writeWallets(wallets);
}

/**
 * Verifies a Razorpay HMAC-SHA256 signature and activates the ₹15 "30 Songs for 30 Days"
 * Studio Premium Pass from the exact timestamp of purchase.
 */
export async function verifyAndCreditRazorpayPayment(opts: {
  email: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<UserWallet> {
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
  const wallet = wallets[email] ?? {
    email,
    plan: "free" as PlanId,
    isPremium: false,
    credits: 1,
    premiumActivatedAt: null,
    premiumExpiresAt: null,
    totalSongsProcessed: 0,
    payments: [],
    updatedAt: new Date().toISOString(),
  };

  // Idempotency check: prevent crediting the same payment ID twice
  if (wallet.payments.some((p) => p.paymentId === opts.razorpayPaymentId)) {
    return wallet;
  }

  const nowMs = Date.now();
  const activatedAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + THIRTY_DAYS_MS).toISOString();

  // Activate 30 songs for exactly 30 days from purchase time
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
}
