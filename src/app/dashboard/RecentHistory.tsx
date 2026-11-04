"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Clock, Close, Download, Film, Layers, Music } from "@/components/Icons";
import { clearStudioHistory, getStudioHistory, removeStudioHistory, type StudioHistoryItem } from "@/lib/history";

export default function RecentHistory() {
  const [items, setItems] = useState<StudioHistoryItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      const all = getStudioHistory();
      if (!cancelled) setItems(all);

      // Verify that files actually exist on the server; purge broken/incomplete files from history
      const valid: StudioHistoryItem[] = [];
      for (const item of all) {
        try {
          const res = await fetch(item.downloadUrl, { method: "HEAD" });
          if (res.ok) {
            valid.push(item);
          } else if (res.status === 404) {
            removeStudioHistory(item.id);
          } else {
            valid.push(item);
          }
        } catch {
          valid.push(item);
        }
      }
      if (!cancelled) setItems(valid);
    };

    sync();
    window.addEventListener("sagewave-history", sync);
    window.addEventListener("storage", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("sagewave-history", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!items.length) {
    return (
      <div className="panel" style={{ marginTop: 28, textAlign: "center", padding: "36px 24px" }}>
        <span className="eyebrow">Recent Studio Sessions</span>
        <h3 style={{ marginTop: 10, marginBottom: 8 }}>No active files in the last 60 minutes</h3>
        <p style={{ color: "var(--muted)", fontSize: "0.94rem", maxWidth: 460, margin: "0 auto 20px" }}>
          Any song you separate or clip you extract during this session will appear here for quick re-downloading
          until its 60-minute auto-purge timer expires.
        </p>
        <Link href="/stem-split" className="btn btn-primary btn-sm">
          Start your first session <ArrowUpRight size={15} />
        </Link>
      </div>
    );
  }

  return (
    <div className="panel" style={{ marginTop: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <span className="eyebrow">Active Session Exports</span>
          <h3 style={{ marginTop: 6 }}>Recent Studio Files</h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="badge">
            <Clock size={13} /> Auto-purged 60 min after creation
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ fontSize: "0.78rem", padding: "4px 8px" }}
            onClick={() => clearStudioHistory()}
          >
            Clear list
          </button>
        </div>
      </div>

      <div className="stem-list">
        {items.map((item) => (
          <div className="file-pill" key={item.id}>
            <div className="ic">
              {item.kind === "stems" ? (
                <Layers size={18} />
              ) : item.kind === "video" ? (
                <Film size={18} />
              ) : (
                <Music size={18} />
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="nm">{item.title}</div>
              <div className="sz">{item.subtitle}</div>
            </div>
            <a className="btn btn-primary btn-sm" href={item.downloadUrl} download>
              <Download size={15} /> Download
            </a>
            <button
              type="button"
              className="x"
              onClick={() => removeStudioHistory(item.id)}
              aria-label={`Remove ${item.title}`}
              title="Remove from history"
            >
              <Close size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
