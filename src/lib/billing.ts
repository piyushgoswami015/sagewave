import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export type PlanId = "free" | "starter" | "basic" | "creator" | "pro";

export interface PricingPlan {
  id: PlanId;
  name: string;
  priceInr: number;
  amountPaise: number;
  songs: number;
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
    perSongInr: "₹0",
    tagline: "Test our Hybrid Transformer Demucs quality on 1 track",
    features: [
      "1 full song separation included",
      "Instrumental + Vocals, Drums, Bass & Melody",
      "320 kbps CBR MP3 exports (44.1 kHz)",
      "Unlimited Creator Audio & Clip backups",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    priceInr: 10,
    amountPaise: 1000,
    songs: 3,
    perSongInr: "₹3.33 / song",
    tagline: "Quick session pass for covers & practice tracks",
    features: [
      "3 full song stem separations",
      "Instrumental + 4 isolated stems per song",
      "320 kbps CBR MP3 studio masters",
      "Credits never expire",
    ],
  },
  {
    id: "basic",
    name: "Basic",
    priceInr: 29,
    amountPaise: 2900,
    songs: 10,
    perSongInr: "₹2.90 / song",
    tagline: "Ideal for musicians, singers & karaoke makers",
    popular: true,
    features: [
      "10 full song stem separations",
      "Instrumental + Vocals, Drums, Bass & Melody",
      "320 kbps CBR MP3 studio masters",
      "Credits never expire",
    ],
  },
  {
    id: "creator",
    name: "Creator",
    priceInr: 79,
    amountPaise: 7900,
    songs: 30,
    perSongInr: "₹2.63 / song",
    tagline: "Built for regular remixers, teachers & YouTubers",
    features: [
      "30 full song stem separations",
      "Instrumental + Vocals, Drums, Bass & Melody",
      "320 kbps CBR MP3 studio masters",
      "Credits never expire",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceInr: 149,
    amountPaise: 14900,
    songs: 75,
    perSongInr: "₹1.99 / song",
    tagline: "Maximum studio allowance for producers & DJs",
    features: [
      "75 full song stem separations",
      "Instrumental + Vocals, Drums, Bass & Melody",
      "320 kbps CBR MP3 studio masters",
      "Lowest cost per track · Credits never expire",
    ],
  },
];

export interface PaymentRecord {
  paymentId: string;
  orderId: string;
  planId: PlanId;
  priceInr: number;
  songsAdded: number;
  createdAt: string;
}

export interface UserWallet {
  email: string;
  plan: PlanId;
  credits: number;
  totalSongsProcessed: number;
  payments: PaymentRecord[];
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const WALLETS_FILE = path.join(DATA_DIR, "wallets.json");

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
 * Gets or initializes a user's wallet. Every new account automatically receives
 * 1 Free Trial song credit (₹0).
 */
export async function getUserWallet(rawEmail: string): Promise<UserWallet> {
  const email = rawEmail.trim().toLowerCase();
  const wallets = await readWallets();
  if (!wallets[email]) {
    wallets[email] = {
      email,
      plan: "free",
      credits: 1, // 1 Free Trial song
      totalSongsProcessed: 0,
      payments: [],
      updatedAt: new Date().toISOString(),
    };
    await writeWallets(wallets);
  }
  return wallets[email];
}

/**
 * Deducts 1 song credit before starting an AI Stem separation job.
 * Throws an error if the user has 0 credits remaining.
 */
export async function consumeSongCredit(rawEmail: string): Promise<UserWallet> {
  const email = rawEmail.trim().toLowerCase();
  const wallets = await readWallets();
  const wallet = wallets[email] ?? {
    email,
    plan: "free" as PlanId,
    credits: 1,
    totalSongsProcessed: 0,
    payments: [],
    updatedAt: new Date().toISOString(),
  };

  if (wallet.credits <= 0) {
    throw new Error("NO_CREDITS");
  }

  wallet.credits -= 1;
  wallet.totalSongsProcessed += 1;
  wallet.updatedAt = new Date().toISOString();
  wallets[email] = wallet;
  await writeWallets(wallets);
  return wallet;
}

/**
 * Refunds 1 song credit if an AI separation job fails due to an upstream error,
 * ensuring paying users never lose a credit on a failed separation.
 */
export async function refundSongCredit(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  const wallets = await readWallets();
  const wallet = wallets[email];
  if (!wallet) return;
  wallet.credits += 1;
  wallet.totalSongsProcessed = Math.max(0, wallet.totalSongsProcessed - 1);
  wallet.updatedAt = new Date().toISOString();
  wallets[email] = wallet;
  await writeWallets(wallets);
}

/**
 * Verifies a Razorpay HMAC-SHA256 signature and adds the purchased song credits
 * to the user's wallet with idempotency protection.
 */
export async function verifyAndCreditRazorpayPayment(opts: {
  email: string;
  planId: PlanId;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<UserWallet> {
  const secret = process.env.RAZORPAY_KEY_SECRET || "";
  if (!secret) {
    throw new Error("Razorpay secret key is not configured on the server.");
  }

  const plan = getPlanById(opts.planId);
  if (!plan || plan.priceInr <= 0) {
    throw new Error("Invalid paid plan selected.");
  }

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
    credits: 1,
    totalSongsProcessed: 0,
    payments: [],
    updatedAt: new Date().toISOString(),
  };

  // Idempotency check: prevent crediting the same payment ID twice
  if (wallet.payments.some((p) => p.paymentId === opts.razorpayPaymentId)) {
    return wallet;
  }

  wallet.credits += plan.songs;
  wallet.plan = plan.id;
  wallet.payments.unshift({
    paymentId: opts.razorpayPaymentId,
    orderId: opts.razorpayOrderId,
    planId: plan.id,
    priceInr: plan.priceInr,
    songsAdded: plan.songs,
    createdAt: new Date().toISOString(),
  });
  wallet.updatedAt = new Date().toISOString();
  wallets[email] = wallet;
  await writeWallets(wallets);

  return wallet;
}
