"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { Mark } from "./Icons";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", short: "Dashboard" },
  { href: "/stem-split", label: "AI Stem Studio", short: "Stems" },
  { href: "/reel-to-mp3", label: "Audio Extractor", short: "MP3" },
  { href: "/reel-download", label: "Clip Archiver", short: "MP4" },
  { href: "/pricing", label: "Pricing", short: "Pricing" },
];

const GUEST_STORAGE_KEY = "sagewave_guest_user";

export default function Nav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [guest, setGuest] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    const sync = () => {
      try {
        const raw = localStorage.getItem(GUEST_STORAGE_KEY);
        setGuest(raw ? JSON.parse(raw) : null);
      } catch {
        setGuest(null);
      }
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("sagewave-auth", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("sagewave-auth", sync);
    };
  }, [pathname]);

  const activeUser = session?.user ?? guest;
  const name = activeUser?.name ?? activeUser?.email ?? "";
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = () => {
    try {
      localStorage.removeItem(GUEST_STORAGE_KEY);
      window.dispatchEvent(new Event("sagewave-auth"));
    } catch {}
    if (session) {
      signOut({ callbackUrl: "/" });
    } else {
      setGuest(null);
    }
  };

  return (
    <header className={`nav${scrolled ? " scrolled" : ""}`}>
      <div className="container nav-inner">
        <Link href="/" className="brand" aria-label="Sagewave home">
          <Mark />
          <span className="brand-word">Sagewave</span>
        </Link>

        <nav className="nav-links" aria-label="Tools">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : ""}>
              <span className="nav-lbl-full">{l.label}</span>
              <span className="nav-lbl-short">{l.short}</span>
            </Link>
          ))}
        </nav>

        <div className="nav-right">
          {status === "loading" ? (
            <div className="avatar" style={{ opacity: 0.4 }} />
          ) : activeUser ? (
            <>
              <div className="user-chip">
                <div className="avatar">
                  {session?.user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={session.user.image} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    initials || "S"
                  )}
                </div>
                <span className="user-name">{activeUser.name?.split(" ")[0]}</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : pathname === "/login" ? null : (
            <Link className="btn btn-primary btn-sm" href={`/login?callbackUrl=${encodeURIComponent(pathname === "/" ? "/dashboard" : pathname)}`}>
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
