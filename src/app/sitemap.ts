import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

/** Public, indexable routes. App (authenticated) routes are excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, "");
  const now = new Date();

  const routes = ["", "/features", "/pricing", "/faq"];
  const legal = ["/legal/terms", "/legal/privacy", "/legal/refund", "/legal/third-party"];

  return [
    ...routes.map((path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.8,
    })),
    ...legal.map((path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
