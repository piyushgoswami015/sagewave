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
    default: "Sagewave — AI Stem Separator, Audio Mastering & Creator Backup Studio",
    template: "%s",
  },
  description:
    "Studio-grade AI stem separation, 320 kbps audio extraction, and personal social clip archiving for creators, musicians, and podcasters.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Sagewave — AI Stem Separator, Audio Mastering & Creator Backup Studio",
    description:
      "Separate any recording into clean instrumentals & stems, extract 320 kbps audio from your published clips, and back up your own reels.",
    url: "https://sagewave.in",
    siteName: "Sagewave",
    locale: "en_IN",
    type: "website",
  },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
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
              <small style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <Link href="/stem-split">AI Stem Studio</Link>
                <Link href="/reel-to-mp3">Creator Audio Backup</Link>
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
