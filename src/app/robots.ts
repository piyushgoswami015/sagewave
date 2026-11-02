import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/stem-split", "/reel-to-mp3", "/reel-download", "/about", "/privacy", "/terms", "/login"],
      disallow: ["/api/", "/dashboard/"],
    },
    sitemap: "https://sagewave.in/sitemap.xml",
  };
}
