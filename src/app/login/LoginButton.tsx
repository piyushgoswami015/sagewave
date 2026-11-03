"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Arrow, Check, GoogleG } from "@/components/Icons";

const REAL_EMAIL_RE = /^([a-zA-Z0-9._%+-]{2,})@([a-zA-Z0-9-]{2,}(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,12})$/;

export default function LoginButton({
  callbackUrl,
  oauthConfigured,
}: {
  callbackUrl: string;
  oauthConfigured?: boolean;
}) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const router = useRouter();

  const switchMode = (next: "signin" | "signup" | "forgot") => {
    setMode(next);
    setOtpStep(false);
    setOtp("");
    setFormError(null);
    setInfoMessage(null);
  };

  const handleGoogleSignIn = () => {
    setLoadingGoogle(true);
    setFormError(null);
    if (oauthConfigured) {
      signIn("google", { callbackUrl });
      return;
    }
    setLoadingGoogle(false);
    setFormError("Google OAuth is not configured on this server.");
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfoMessage(null);
    const cleanEmail = email.trim().toLowerCase();

    if (!REAL_EMAIL_RE.test(cleanEmail)) {
      setFormError("Please enter a complete, valid email address (for example, yourname@gmail.com).");
      return;
    }

    // ─────────── FORGOT PASSWORD FLOW ───────────
    if (mode === "forgot") {
      if (!otpStep) {
        setLoadingForm(true);
        try {
          const res = await fetch("/api/auth/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: cleanEmail, purpose: "reset" }),
          });
          const data = await res.json();
          setLoadingForm(false);
          if (!res.ok) {
            setFormError(data.error || "Could not send reset code.");
            return;
          }
          setOtpStep(true);
          setInfoMessage(`We sent a 6-digit password reset code to ${cleanEmail}.`);
        } catch {
          setLoadingForm(false);
          setFormError("Network error while requesting reset code. Please try again.");
        }
        return;
      }

      if (otp.trim().length !== 6) {
        setFormError("Please enter the 6-digit verification code from your email.");
        return;
      }
      if (password.length < 6) {
        setFormError("New password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setFormError("Passwords do not match.");
        return;
      }

      setLoadingForm(true);
      try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, otp: otp.trim(), newPassword: password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setLoadingForm(false);
          setFormError(data.error || "Could not reset password.");
          return;
        }
      } catch {
        setLoadingForm(false);
        setFormError("Network error while resetting password.");
        return;
      }

      const signRes = await signIn("credentials", {
        redirect: false,
        email: cleanEmail,
        password,
        callbackUrl,
      });
      if (signRes?.error) {
        setLoadingForm(false);
        switchMode("signin");
        setInfoMessage("Password updated! Please sign in with your new password.");
        return;
      }
      router.push(callbackUrl || "/");
      router.refresh();
      return;
    }

    // ─────────── SIGN UP FLOW ───────────
    if (mode === "signup") {
      if (name.trim().length < 2) {
        setFormError("Please enter your full name (at least 2 characters).");
        return;
      }
      if (password.length < 6) {
        setFormError("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setFormError("Passwords do not match.");
        return;
      }

      if (!otpStep) {
        setLoadingForm(true);
        try {
          const otpRes = await fetch("/api/auth/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: cleanEmail, purpose: "signup" }),
          });
          const otpData = await otpRes.json();
          if (!otpRes.ok) {
            setLoadingForm(false);
            setFormError(otpData.error || "Could not verify email address.");
            return;
          }
          if (otpData.requiresOtp) {
            setLoadingForm(false);
            setOtpStep(true);
            setInfoMessage(`We sent a 6-digit verification code to ${cleanEmail}.`);
            return;
          }
        } catch {
          setLoadingForm(false);
          setFormError("Network error while verifying email. Please try again.");
          return;
        }
      } else if (otp.trim().length !== 6) {
        setFormError("Please enter the 6-digit verification code sent to your email.");
        return;
      }

      setLoadingForm(true);
      try {
        const regRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            email: cleanEmail,
            password,
            otp: otp.trim(),
          }),
        });
        const regData = await regRes.json();
        if (!regRes.ok) {
          setLoadingForm(false);
          setFormError(regData.error || "Could not create account.");
          return;
        }
      } catch {
        setLoadingForm(false);
        setFormError("Network error while creating account. Please try again.");
        return;
      }
    } else {
      // ─────────── SIGN IN FLOW ───────────
      if (!password) {
        setFormError("Please enter your password.");
        return;
      }
      setLoadingForm(true);
    }

    const res = await signIn("credentials", {
      redirect: false,
      email: cleanEmail,
      password,
      callbackUrl,
    });

    if (res?.error) {
      setLoadingForm(false);
      setFormError(res.error);
      return;
    }

    router.push(callbackUrl || "/");
    router.refresh();
  };

  return (
    <div className="auth-card">
      <div className="auth-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          className={mode === "signin" ? "active" : ""}
          onClick={() => switchMode("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={mode === "signup" ? "active" : ""}
          onClick={() => switchMode("signup")}
        >
          Create account
        </button>
      </div>

      <button
        type="button"
        className="google-btn"
        disabled={loadingGoogle || loadingForm}
        onClick={handleGoogleSignIn}
      >
        <GoogleG />
        {loadingGoogle ? "Redirecting to Google…" : "Continue with Google"}
      </button>

      <div className="auth-or">
        <span>
          {mode === "forgot"
            ? "recover account password"
            : mode === "signup"
              ? "or register with verified email"
              : "or sign in with email"}
        </span>
      </div>

      <form onSubmit={handleCredentialsSubmit} className="auth-form" noValidate>
        {mode === "signup" && !otpStep && (
          <div>
            <label className="field-label" htmlFor="auth-name">Full name</label>
            <input
              id="auth-name"
              type="text"
              className="auth-input"
              placeholder="e.g. Piyush Goswami"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
        )}

        <div>
          <label className="field-label" htmlFor="auth-email">Email address</label>
          <input
            id="auth-email"
            type="email"
            className="auth-input"
            placeholder="you@gmail.com"
            value={email}
            disabled={otpStep}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        {otpStep && (
          <div>
            <label className="field-label" htmlFor="auth-otp">6-digit verification code</label>
            <input
              id="auth-otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              className="auth-input"
              placeholder="123456"
              style={{ letterSpacing: "0.25em", fontWeight: 700, textAlign: "center" }}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              required
            />
          </div>
        )}

        {(mode === "signin" || (mode === "signup" && !otpStep) || (mode === "forgot" && otpStep)) && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <label className="field-label" htmlFor="auth-password" style={{ marginBottom: 0 }}>
                {mode === "signup"
                  ? "Create password (min. 6 characters)"
                  : mode === "forgot"
                    ? "New password (min. 6 characters)"
                    : "Password"}
              </label>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "var(--moss)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <input
              id="auth-password"
              type="password"
              className="auth-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
            />
          </div>
        )}

        {((mode === "signup" && !otpStep) || (mode === "forgot" && otpStep)) && (
          <div>
            <label className="field-label" htmlFor="auth-confirm">Confirm password</label>
            <input
              id="auth-confirm"
              type="password"
              className="auth-input"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
        )}

        {infoMessage && (
          <div className="notice" style={{ marginBottom: 0 }}>
            <Check size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
            {infoMessage}
          </div>
        )}

        {formError && (
          <div className="error-msg" style={{ marginTop: 4 }} role="alert">
            <Alert size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{formError}</span>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 6 }}
          disabled={loadingForm || loadingGoogle}
        >
          {loadingForm
            ? "Please wait…"
            : mode === "forgot"
              ? otpStep
                ? "Verify code & update password"
                : "Send 6-digit reset code"
              : mode === "signup"
                ? otpStep
                  ? "Verify code & create account"
                  : "Create studio account"
                : "Sign in to Sagewave"}
          {!loadingForm && <Arrow size={16} className="arrow" />}
        </button>

        {(mode === "forgot" || otpStep) && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ width: "100%" }}
            onClick={() => switchMode("signin")}
          >
            Back to Sign in
          </button>
        )}
      </form>

      <div className="auth-perks">
        <span><Check size={14} /> 320 kbps MP3 &amp; 4-stem AI studio</span>
        <span><Check size={14} /> Auto-purged 60-min privacy</span>
      </div>
    </div>
  );
}
