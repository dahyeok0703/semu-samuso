import { ImageResponse } from "next/og";

import { siteConfig } from "@/lib/site";

export const alt = `${siteConfig.nameLatin} — ${siteConfig.taglineLatin}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Default Open Graph image (1200×630). Uses Latin text only so it renders
 * reliably with the built-in font (no external Korean webfont fetch at runtime).
 */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        color: "white",
        padding: "72px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 14,
            background: "white",
            color: "#0f172a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 38,
            fontWeight: 800,
          }}
        >
          S
        </div>
        <div style={{ fontSize: 36, fontWeight: 700 }}>{siteConfig.nameLatin}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.1, maxWidth: 900 }}>
          {siteConfig.taglineLatin}
        </div>
        <div style={{ fontSize: 30, color: "#94a3b8" }}>Practice management for tax offices</div>
      </div>

      <div style={{ fontSize: 26, color: "#cbd5e1" }}>
        {siteConfig.url.replace(/^https?:\/\//, "")}
      </div>
    </div>,
    { ...size },
  );
}
