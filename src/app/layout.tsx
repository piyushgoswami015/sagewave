import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import Providers from "./providers";
import Nav from "@/components/Nav";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["SOFT", "opsz"],
  style: ["normal", "italic"],
});
const body = Instrument_Sans({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "https://sagewave.in"),
  title: {
    default: "Sagewave — Free AI Vocal Remover, Stem Separator & 320 kbps Audio Studio",
    template: "%s",
  },
  description:
    "Free AI vocal remover online and 4-stem music separator. Separate vocals from music, extract instrumental from any MP3/WAV song, isolate drums & bass, and extract 320 kbps audio.",
  keywords: [
    "AI vocal remover online",
    "separate vocals from music",
    "remove vocals from MP3",
    "AI stem separator",
    "extract instrumental from song",
    "separate drums from music",
    "free AI music separator",
    "Demucs online stem splitter",
    "karaoke instrumental maker",
    "Instagram reel to MP3 320kbps",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Sagewave — Free AI Vocal Remover, Stem Separator & 320 kbps Audio Studio",
    description:
      "Separate vocals from music, extract clean instrumentals, drums & bass from any song with Hybrid Transformer Demucs AI, and archive 320 kbps creator audio.",
    url: "https://sagewave.in",
    siteName: "Sagewave",
    locale: "en_IN",
    type: "website",
  },
  icons: { icon: "/favicon.svg" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Sagewave AI Audio Studio",
  url: "https://sagewave.in",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any (Web Browser)",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description:
    "Browser-based AI vocal remover, 4-stem music separator (Vocals, Instrumental, Drums, Bass, Melody), and 320 kbps audio extractor.",
  featureList: [
    "AI Vocal Remover Online",
    "4-Stem AI Music Separator (Vocals, Drums, Bass, Melody)",
    "Extract Instrumental from MP3, WAV, FLAC, M4A",
    "320 kbps CBR MP3 Creator Audio Extractor",
    "MP4 Creator Clip Archiver",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>
          <Nav />
          <main>{children}</main>
          <footer className="footer">
            <div className="container footer-inner">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <small style={{ color: "var(--forest)", fontWeight: 600 }}>
                  © {new Date().getFullYear()} Sagewave Audio Studio. Built for creators, educators & musicians.
                </small>
                <small>
                  For personal creator backups, licensed media, and royalty-free content only. All processed files are automatically purged after 60 minutes.
                </small>
              </div>
              <small style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {/* <Link href="/pricing">Pricing</Link> */}
                <Link href="/stem-split">AI Stem Separator</Link>
                <Link href="/vocal-remover">AI Vocal Remover</Link>
                <Link href="/extract-instrumental">Extract Instrumental</Link>
                <Link href="/drum-separator">Drum & Bass Separator</Link>
                <Link href="/reel-to-mp3">Reel to MP3</Link>
                <Link href="/reel-download">Clip Archiver</Link>
                <Link href="/about">About</Link>
                <Link href="/privacy">Privacy Policy</Link>
                <Link href="/terms">Terms & DMCA</Link>
              </small>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
