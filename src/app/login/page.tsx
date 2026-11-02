import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, isAuthConfigured } from "@/lib/auth";
import { PHOTOS } from "@/lib/photos";
import { Mark } from "@/components/Icons";
import LoginButton from "./LoginButton";

export const metadata = {
  title: "Sign in · Sagewave Audio Studio",
  description: "Sign in to Sagewave Audio Studio with Google or your email to access AI stem separation and creator backup tools.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  const session = await getSession();
  const safeCallback = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/dashboard";
  if (session) redirect(safeCallback);

  const configured = isAuthConfigured();

  return (
    <div className="login-wrap">
      <div className="login-photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PHOTOS.login.src} alt="Grand piano keys in warm studio light" />
        <div className="login-quote">
          <span className="badge" style={{ marginBottom: 14, background: "rgba(251,247,238,0.16)", color: "var(--cream)" }}>
            Sagewave Audio Studio
          </span>
          <p>“Where words leave off, music begins.”</p>
          <span>— Heinrich Heine · 4-Stem AI &amp; 320 kbps Mastering Suite</span>
        </div>
      </div>

      <div className="login-panel">
        <div className="login-box reveal">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Mark size={28} />
            <span className="eyebrow">Creator Studio Access</span>
          </div>
          <h1>Welcome back.</h1>
          <p className="sub">
            Sign in with Google in one click or use your email to access the AI Stem Studio and Creator Backup tools.
          </p>

          {error && (
            <div className="error-msg" style={{ marginTop: 0, marginBottom: 20 }}>
              Google sign-in didn’t complete. Please try again or sign in with your email below.
            </div>
          )}

          <LoginButton callbackUrl={safeCallback} oauthConfigured={configured} />

          <p className="login-fine">
            By continuing, you agree to our{" "}
            <Link href="/terms" style={{ textDecoration: "underline", color: "var(--forest)" }}>
              Terms &amp; DMCA Policy
            </Link>{" "}
            and{" "}
            <Link href="/privacy" style={{ textDecoration: "underline", color: "var(--forest)" }}>
              Privacy Policy
            </Link>
            . Only process content you own or have permission to use.
          </p>
        </div>
      </div>
    </div>
  );
}
