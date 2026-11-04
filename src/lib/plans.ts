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
