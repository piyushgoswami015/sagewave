import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://sagewave.in";
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    { url: `${base}/stem-split`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    { url: `${base}/vocal-remover`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/extract-instrumental`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/drum-separator`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/reel-to-mp3`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/reel-download`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
