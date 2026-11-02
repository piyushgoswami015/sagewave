"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Arrow, Check, GoogleG } from "@/components/Icons";

export default function LoginButton({
  callbackUrl,
  oauthConfigured,
}: {
  callbackUrl: string;
  oauthConfigured?: boolean;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const router = useRouter();

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
    const cleanEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFormError("Please enter a valid email address.");
      return;
    }

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

      setLoadingForm(true);
      try {
        const regRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), email: cleanEmail, password }),
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
          onClick={() => {
            setMode("signin");
            setFormError(null);
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={mode === "signup" ? "active" : ""}
          onClick={() => {
            setMode("signup");
            setFormError(null);
          }}
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
        <span>or {mode === "signup" ? "register with email" : "sign in with email"}</span>
      </div>

      <form onSubmit={handleCredentialsSubmit} className="auth-form" noValidate>
        {mode === "signup" && (
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
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="auth-password">
            {mode === "signup" ? "Create password (min. 6 characters)" : "Password"}
          </label>
          <input
            id="auth-password"
            type="password"
            className="auth-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
          />
        </div>

        {mode === "signup" && (
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
            ? mode === "signup"
              ? "Creating account…"
              : "Verifying credentials…"
            : mode === "signup"
              ? "Create studio account"
              : "Sign in to Sagewave"}
          {!loadingForm && <Arrow size={16} className="arrow" />}
        </button>
      </form>

      <div className="auth-perks">
        <span><Check size={14} /> 320 kbps MP3 &amp; 4-stem AI studio</span>
        <span><Check size={14} /> Auto-purged 60-min privacy</span>
      </div>
    </div>
  );
}
