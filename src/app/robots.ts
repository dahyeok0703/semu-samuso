import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

/** Allow crawling the marketing/legal pages; keep authenticated app routes out. */
export default function robots(): MetadataRoute.Robots {
  const base = siteConfig.url.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/clients",
        "/calendar",
        "/reminders",
        "/filings",
        "/closings",
        "/engagements",
        "/team",
        "/audit",
        "/admin",
        "/billing",
        "/settings",
        "/onboarding",
        "/update-password",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
