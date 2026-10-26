import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return ["", "/signup", "/login", "/demo", "/privacy", "/legal"].map((p) => ({ url: `${base}${p}`, changeFrequency: "monthly", priority: p ? 0.5 : 1 }));
}
