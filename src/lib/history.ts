export interface StudioHistoryItem {
  id: string;
  kind: "audio" | "video" | "stems";
  title: string;
  subtitle: string;
  downloadUrl: string;
  createdAt: number;
}

const KEY = "sagewave_studio_history";

export function addStudioHistory(item: StudioHistoryItem) {
  try {
    const existing = getStudioHistory();
    const filtered = existing.filter((x) => x.id !== item.id);
    const updated = [item, ...filtered].slice(0, 15);
    localStorage.setItem(KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("sagewave-history"));
  } catch {
    /* ignore */
  }
}

export function getStudioHistory(): StudioHistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as StudioHistoryItem[];
    // Filter out items older than 60 minutes (since server purges after 1 hr)
    const cutoff = Date.now() - 60 * 60 * 1000;
    return items.filter((x) => x.createdAt > cutoff);
  } catch {
    return [];
  }
}

export function removeStudioHistory(id: string) {
  try {
    const existing = getStudioHistory();
    const updated = existing.filter((x) => x.id !== id);
    localStorage.setItem(KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("sagewave-history"));
  } catch {
    /* ignore */
  }
}

export function clearStudioHistory() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("sagewave-history"));
  } catch {
    /* ignore */
  }
}
