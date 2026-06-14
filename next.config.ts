import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Derive allowed connect/frame origins from configured integrations so the CSP
// stays accurate without hardcoding. Supabase needs https + wss (realtime).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseOrigin = supabaseUrl ? safeOrigin(supabaseUrl) : "";
const supabaseWs = supabaseOrigin ? supabaseOrigin.replace(/^http/, "ws") : "";

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/**
 * Content-Security-Policy. Pragmatic baseline: 'unsafe-inline' is required for
 * Next's inline bootstrap/styles without a nonce pipeline; 'unsafe-eval' is dev
 * only (React Refresh). External origins are limited to Supabase + PortOne. A
 * nonce-based strict CSP is a recommended follow-up (see docs/security-checklist).
 */
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://cdn.portone.io`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data:`,
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs} https://api.portone.io https://cdn.portone.io`.replace(
    /\s+/g,
    " ",
  ),
  `frame-src 'self' https://*.portone.io https://*.tosspayments.com`,
  `worker-src 'self' blob:`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `upgrade-insecure-requests`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // HSTS — 2 years, include subdomains, preload. Effective only over HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Fail the production build on type or lint errors instead of silently shipping.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    serverActions: {
      // Cap server-action request bodies (file uploads go directly to Storage).
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
