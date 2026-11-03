"use client";

import { useState } from "react";
import { Alert, Check } from "@/components/Icons";

export default function AccountSecurity({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(false);

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        setError(data.error || "Could not update password.");
        return;
      }
      setDone(true);
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setBusy(false);
      setError("Network error while updating password.");
    }
  };

  return (
    <div className="panel" style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <span className="eyebrow">Account Security</span>
          <h3 style={{ marginTop: 6, fontSize: "1.3rem" }}>Password &amp; Recovery ({email})</h3>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setOpen(!open);
            setError(null);
            setDone(false);
          }}
        >
          {open ? "Close" : "Change / Set Password"}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSave} style={{ marginTop: 20, maxWidth: 440 }} className="auth-form">
          <div>
            <label className="field-label" htmlFor="dash-new-pw">New password (min. 6 characters)</label>
            <input
              id="dash-new-pw"
              type="password"
              className="auth-input"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="dash-confirm-pw">Confirm new password</label>
            <input
              id="dash-confirm-pw"
              type="password"
              className="auth-input"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {done && (
            <div className="notice" style={{ marginBottom: 0 }}>
              <Check size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
              Your password has been updated for {email}.
            </div>
          )}

          {error && (
            <div className="error-msg" style={{ marginTop: 0 }}>
              <Alert size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              {busy ? "Saving…" : "Update Password"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
